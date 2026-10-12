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

use soroban_sdk::{contract, contractimpl, Bytes, BytesN, Env};

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

    /// Contract version, bumped on every interface or behaviour change.
    pub fn version(_env: Env) -> u32 {
        1
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
