use soroban_sdk::{contracttype, Bytes, Env};

use crate::types::PasskeySigner;

/// ~30 days at 5s ledgers: entries are extended once they drop below this.
const TTL_THRESHOLD: u32 = 518_400;
/// ~120 days at 5s ledgers: the TTL entries are extended to.
const TTL_EXTEND_TO: u32 = 2_073_600;

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

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn get_signer(env: &Env, key_id: &Bytes) -> Option<PasskeySigner> {
    let key = DataKey::Signer(key_id.clone());
    let signer: Option<PasskeySigner> = env.storage().persistent().get(&key);
    if signer.is_some() {
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    signer
}

pub fn has_signer(env: &Env, key_id: &Bytes) -> bool {
    env.storage().persistent().has(&DataKey::Signer(key_id.clone()))
}

pub fn set_signer(env: &Env, key_id: &Bytes, signer: &PasskeySigner) {
    let key = DataKey::Signer(key_id.clone());
    env.storage().persistent().set(&key, signer);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
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
