
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SmartWalletError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidSignature = 3,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    PublicKey, // Stores the ed25519 public key (BytesN<32>)
}

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    pub fn init_wallet(env: Env, public_key: BytesN<32>) -> Result<(), SmartWalletError> {
        if env.storage().instance().has(&DataKey::PublicKey) {
            return Err(SmartWalletError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::PublicKey, &public_key);
        Ok(())
    }
}

#[contractimpl]
impl CustomAccountInterface for SmartWallet {
    type Error = SmartWalletError;
    type Signature = BytesN<64>; // ed25519 signature

    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: soroban_sdk::crypto::Hash<32>,
        signature: BytesN<64>,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), SmartWalletError> {
        let public_key: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::PublicKey)
            .ok_or(SmartWalletError::NotInitialized)?;
        
        env.crypto().ed25519_verify(&public_key, &signature_payload.into(), &signature);

        Ok(())
    }
}
