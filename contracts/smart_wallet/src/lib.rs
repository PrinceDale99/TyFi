#![no_std]
//! # TyFi Smart Wallet
//!
//! A Soroban custom account contract whose only signers are WebAuthn passkeys
//! (secp256r1 / prime256v1, verified natively by the Protocol 21 host function
//! `secp256r1_verify`). There is no Ed25519 key and no seed phrase: every
//! authorization is a biometric assertion from the user's device.

mod base64url;
mod error;
mod events;
mod storage;
mod types;
mod webauthn;

pub use error::Error;
pub use types::{PasskeySigner, Secp256r1Signature, Signature, SignerKey, Signatures};

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    Bytes, BytesN, Env, Vec,
};

/// WebAuthn credential ids are at most 1023 bytes by spec; real platform
/// authenticators use 16–64. A tighter bound limits storage-key size.
pub const MAX_KEY_ID_LEN: u32 = 255;

/// SEC1 tag for an uncompressed elliptic-curve point.
const UNCOMPRESSED_POINT_TAG: u8 = 0x04;

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    /// Create the wallet bound to its first passkey.
    ///
    /// Runs exactly once, atomically with deployment, so there is no window in
    /// which an uninitialized wallet could be claimed by someone else.
    pub fn __constructor(env: Env, key_id: Bytes, public_key: BytesN<65>) -> Result<(), Error> {
        insert_signer(&env, &key_id, &public_key)?;
        storage::bump_instance(&env);
        Ok(())
    }

    /// Register an additional passkey (e.g. a second device).
    ///
    /// Requires the wallet's own authorization, i.e. a WebAuthn assertion from
    /// an already-registered passkey.
    pub fn add_signer(env: Env, key_id: Bytes, public_key: BytesN<65>) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        insert_signer(&env, &key_id, &public_key)?;
        storage::bump_instance(&env);
        Ok(())
    }

    /// Remove a passkey. The last remaining passkey can never be removed, so
    /// the wallet can never be locked out by its own signers.
    pub fn remove_signer(env: Env, key_id: Bytes) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        if !storage::has_signer(&env, &key_id) {
            return Err(Error::UnknownSigner);
        }
        let count = storage::signer_count(&env);
        if count <= 1 {
            return Err(Error::LastSigner);
        }
        storage::remove_signer(&env, &key_id);
        storage::set_signer_count(&env, count - 1);
        events::SignerRemoved { key_id }.publish(&env);
        storage::bump_instance(&env);
        Ok(())
    }

    /// Replace the wallet's code. Only the wallet itself (a passkey assertion)
    /// can upgrade it; the wallet address and storage are preserved.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        env.current_contract_address().require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        events::WalletUpgraded { new_wasm_hash }.publish(&env);
    }

    /// The registered signer for a credential id, if any.
    pub fn get_signer(env: Env, key_id: Bytes) -> Option<PasskeySigner> {
        storage::get_signer(&env, &key_id)
    }

    /// Number of registered passkey signers.
    pub fn signer_count(env: Env) -> u32 {
        storage::signer_count(&env)
    }

    /// Contract version, bumped on every interface or behaviour change.
    pub fn version(_env: Env) -> u32 {
        1
    }
}

#[contractimpl]
impl CustomAccountInterface for SmartWallet {
    type Signature = Signatures;
    type Error = Error;

    /// Called by the Soroban host whenever this wallet's address must
    /// authorize an invocation (`require_auth`). Replaces the default Ed25519
    /// account check with WebAuthn secp256r1 verification.
    ///
    /// Every signature in the map must come from a registered passkey and must
    /// verify; one valid passkey signature is sufficient to authorize. Replay
    /// protection (nonce + expiration ledger) is enforced by the host, because
    /// both are part of `signature_payload`.
    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: Signatures,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        if signatures.0.is_empty() {
            return Err(Error::NoSignatures);
        }
        // A wallet has at most MAX_SIGNERS passkeys, so a larger map can only
        // be an attempt to burn resources on signature verification.
        if signatures.0.len() > storage::MAX_SIGNERS {
            return Err(Error::TooManySigners);
        }

        for (signer_key, signature) in signatures.0.iter() {
            let SignerKey::Secp256r1(key_id) = signer_key;
            let Signature::Secp256r1(assertion) = signature;

            let signer = storage::get_signer(&env, &key_id).ok_or(Error::UnknownSigner)?;
            webauthn::verify(&env, &signature_payload, &assertion, &signer.public_key)?;
        }

        storage::bump_instance(&env);
        Ok(())
    }
}

fn validate_key_id(key_id: &Bytes) -> Result<(), Error> {
    if key_id.is_empty() || key_id.len() > MAX_KEY_ID_LEN {
        return Err(Error::InvalidKeyId);
    }
    Ok(())
}

fn validate_public_key(public_key: &BytesN<65>) -> Result<(), Error> {
    // Only the encoding is checked here; a point that is not on the curve can
    // never produce a valid secp256r1_verify, so it cannot authorize anything.
    if public_key.get(0) != Some(UNCOMPRESSED_POINT_TAG) {
        return Err(Error::InvalidPublicKey);
    }
    Ok(())
}

/// Validate and store a new passkey signer, enforcing uniqueness and the cap.
fn insert_signer(env: &Env, key_id: &Bytes, public_key: &BytesN<65>) -> Result<(), Error> {
    validate_key_id(key_id)?;
    validate_public_key(public_key)?;
    if storage::has_signer(env, key_id) {
        return Err(Error::SignerAlreadyExists);
    }
    let count = storage::signer_count(env);
    if count >= storage::MAX_SIGNERS {
        return Err(Error::TooManySigners);
    }

    storage::set_signer(
        env,
        key_id,
        &PasskeySigner {
            public_key: public_key.clone(),
            added_at: env.ledger().timestamp(),
        },
    );
    storage::set_signer_count(env, count + 1);
    events::SignerAdded {
        key_id: key_id.clone(),
        public_key: public_key.clone(),
    }
    .publish(env);
    Ok(())
}

#[cfg(test)]
mod test;
