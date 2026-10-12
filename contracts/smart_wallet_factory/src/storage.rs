use soroban_sdk::{contracttype, Address, BytesN, Env};

const TTL_THRESHOLD: u32 = 120_960; // ~7 days at 5s ledgers: refresh once below this
const TTL_EXTEND_TO: u32 = 518_400; // ~30 days: keeps per-wallet rent low; any use refreshes it

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    WalletWasmHash,
    Paused,
    WalletCount,
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

pub fn is_wallet(env: &Env, wallet: &Address) -> bool {
    env.storage().persistent().has(&DataKey::IsWallet(wallet.clone()))
}

/// One persistent entry per wallet, created at the network minimum TTL (no
/// prepaid rent). The address itself is derivable from the passkey, so no
/// salt → address map is stored.
pub fn record_wallet(env: &Env, wallet: &Address) {
    env.storage().persistent().set(&DataKey::IsWallet(wallet.clone()), &true);
    env.storage().instance().set(&DataKey::WalletCount, &(wallet_count(env) + 1));
}
