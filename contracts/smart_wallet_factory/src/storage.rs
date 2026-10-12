use soroban_sdk::{contracttype, Address, BytesN, Env};

const TTL_THRESHOLD: u32 = 518_400; // ~30 days
const TTL_EXTEND_TO: u32 = 2_073_600; // ~120 days

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    WalletWasmHash,
    Paused,
    WalletCount,
    /// Deployment salt → wallet address (persistent).
    Wallet(BytesN<32>),
    /// Wallet address → true, for "was this wallet made by this factory?" checks.
    IsWallet(Address),
}

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn pending_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}

pub fn set_pending_admin(env: &Env, admin: Option<&Address>) {
    match admin {
        Some(a) => env.storage().instance().set(&DataKey::PendingAdmin, a),
        None => env.storage().instance().remove(&DataKey::PendingAdmin),
    }
}

pub fn wallet_wasm_hash(env: &Env) -> BytesN<32> {
    env.storage().instance().get(&DataKey::WalletWasmHash).unwrap()
}

pub fn set_wallet_wasm_hash(env: &Env, hash: &BytesN<32>) {
    env.storage().instance().set(&DataKey::WalletWasmHash, hash);
}

pub fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

pub fn wallet_count(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::WalletCount).unwrap_or(0)
}

pub fn wallet_for_salt(env: &Env, salt: &BytesN<32>) -> Option<Address> {
    env.storage().persistent().get(&DataKey::Wallet(salt.clone()))
}

pub fn is_wallet(env: &Env, wallet: &Address) -> bool {
    env.storage().persistent().has(&DataKey::IsWallet(wallet.clone()))
}

pub fn record_wallet(env: &Env, salt: &BytesN<32>, wallet: &Address) {
    let by_salt = DataKey::Wallet(salt.clone());
    let by_address = DataKey::IsWallet(wallet.clone());
    env.storage().persistent().set(&by_salt, wallet);
    env.storage().persistent().set(&by_address, &true);
    env.storage().persistent().extend_ttl(&by_salt, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage().persistent().extend_ttl(&by_address, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage().instance().set(&DataKey::WalletCount, &(wallet_count(env) + 1));
}
