use soroban_sdk::{contracttype, Bytes, Env};

use crate::types::PasskeySigner;

// Rent policy: the wallet never extends TTLs on the user's transaction path.
// Doing so made a wallet's first payment also pay to keep the *shared* wallet
// code alive (~28 XLM on testnet). Entries live at the network minimum TTL; the
// operator extends shared code via scripts/extend_passkey_ttl.sh, and the
// relayer restores any archived wallet entries automatically before a call.

/// Maximum number of passkeys a single wallet may hold (bounds storage and
/// the cost of signer enumeration).
pub const MAX_SIGNERS: u32 = 10;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Passkey signer keyed by raw credential id (persistent storage).
    Signer(Bytes),
    /// Number of registered signers (instance storage).
    SignerCount,
}

pub fn get_signer(env: &Env, key_id: &Bytes) -> Option<PasskeySigner> {
    env.storage().persistent().get(&DataKey::Signer(key_id.clone()))
}

pub fn has_signer(env: &Env, key_id: &Bytes) -> bool {
    env.storage().persistent().has(&DataKey::Signer(key_id.clone()))
}

pub fn set_signer(env: &Env, key_id: &Bytes, signer: &PasskeySigner) {
    let key = DataKey::Signer(key_id.clone());
    env.storage().persistent().set(&key, signer);
}

pub fn remove_signer(env: &Env, key_id: &Bytes) {
    env.storage().persistent().remove(&DataKey::Signer(key_id.clone()));
}

pub fn signer_count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0)
}

pub fn set_signer_count(env: &Env, count: u32) {
    env.storage().instance().set(&DataKey::SignerCount, &count);
}
