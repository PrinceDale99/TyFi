//! Signing helpers for TyphoonVault admin multisig integration tests.
//!
//! The contract's `require_multisig_auth` function verifies ed25519 signatures
//! over the message:
//!
//!   `sha256( nonce_be_8_bytes || fn_name_bytes )`
//!
//! where `nonce` is the current value of `DataKey::AdminNonce` in instance
//! storage (starts at 0, incremented by 1 after each successful admin call).
//!
//! These helpers mirror that construction so tests can produce valid signatures
//! without any mocking — the production crypto path runs end-to-end.

use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{BytesN, Env, Vec};

/// A test admin keypair.
pub struct AdminKey {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
}

impl AdminKey {
    /// Create from a 32-byte seed.
    pub fn from_seed(seed: [u8; 32]) -> Self {
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        Self { signing_key, verifying_key }
    }

    /// Returns the 32-byte public key as a Soroban `BytesN<32>`.
    pub fn pub_key_bytes(&self, env: &Env) -> BytesN<32> {
        BytesN::from_array(env, self.verifying_key.as_bytes())
    }
}

/// Build the message that the contract verifies:
///   `sha256( nonce_be_8_bytes || fn_name_bytes )`
pub fn build_message(nonce: u64, fn_name: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(nonce.to_be_bytes());
    hasher.update(fn_name);
    hasher.finalize().into()
}

/// Sign `message_hash` with `key` and return the 64-byte signature as a
/// Soroban `BytesN<64>`.
pub fn sign(env: &Env, key: &AdminKey, message_hash: &[u8; 32]) -> BytesN<64> {
    let sig = key.signing_key.sign(message_hash);
    // sig.to_bytes() returns [u8; 64]; deref to get &[u8; 64]
    BytesN::from_array(env, &sig.to_bytes())
}

/// Produce a complete `Vec<(BytesN<32>, BytesN<64>)>` of signatures for
/// a given function call, ready to pass to the contract.
///
/// `nonce` must match the value currently stored in the contract
/// (obtainable via `client.admin_nonce()`).
pub fn make_sigs(
    env: &Env,
    fn_name: &[u8],
    nonce: u64,
    keys: &[&AdminKey],
) -> Vec<(BytesN<32>, BytesN<64>)> {
    let msg = build_message(nonce, fn_name);
    let mut sigs = Vec::new(env);
    for key in keys {
        let pub_key = key.pub_key_bytes(env);
        let sig = sign(env, key, &msg);
        sigs.push_back((pub_key, sig));
    }
    sigs
}
