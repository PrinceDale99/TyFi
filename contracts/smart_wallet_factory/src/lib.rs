#![no_std]
//! # TyFi Smart Wallet Factory
//!
//! Deploys one seedless [`smart_wallet`] contract per WebAuthn passkey. The
//! passkey's credential id and secp256r1 public key are passed to the wallet's
//! constructor, so a wallet is bound to the device biometric atomically at
//! deployment — there is never an uninitialized wallet or a seed phrase.
//!
//! ## Address derivation
//!
//! `salt = sha256(public_key ‖ key_id)`. Because the salt commits to the public
//! key, the address a user's client derives can only ever hold a wallet
//! controlled by *their* passkey: a front-runner who copies the credential id
//! with a different key lands on a different address. Anyone may pay to deploy
//! a wallet (that is how fee sponsorship works) because only the passkey can
//! authorize anything from it.

mod error;
mod events;
mod storage;

pub use error::Error;

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env};

/// Matches the wallet's own bound on credential id length.
pub const MAX_KEY_ID_LEN: u32 = 255;
const UNCOMPRESSED_POINT_TAG: u8 = 0x04;

#[contract]
pub struct SmartWalletFactory;

#[contractimpl]
impl SmartWalletFactory {
    /// Initialize the factory with its admin and the wallet code to deploy.
    pub fn __constructor(env: Env, admin: Address, wallet_wasm_hash: BytesN<32>) {
        storage::set_admin(&env, &admin);
        storage::set_wallet_wasm_hash(&env, &wallet_wasm_hash);
        storage::bump_instance(&env);
    }

    /// Deploy a seedless smart wallet bound to a passkey and return its address.
    ///
    /// Requires no authorization: the wallet can only ever be controlled by the
    /// passkey whose public key is baked into its constructor, so a sponsor (or
    /// anyone) can pay for the deployment on the user's behalf.
    pub fn deploy(env: Env, key_id: Bytes, public_key: BytesN<65>) -> Result<Address, Error> {
        if storage::is_paused(&env) {
            return Err(Error::DeploymentsPaused);
        }
        validate(&key_id, &public_key)?;

        let deployer = env.deployer().with_current_contract(wallet_salt(&env, &key_id, &public_key));
        if storage::is_wallet(&env, &deployer.deployed_address()) {
            return Err(Error::WalletAlreadyDeployed);
        }

        let wallet = deployer.deploy_v2(storage::wallet_wasm_hash(&env), (key_id.clone(), public_key.clone()));

        storage::record_wallet(&env, &wallet);
        // No TTL extension here: deployments are sponsor-paid and must stay cheap.
        // Factory rent is maintained by the operator (scripts/extend_passkey_ttl.sh).
        events::WalletCreated { wallet: wallet.clone(), key_id, public_key }.publish(&env);
        Ok(wallet)
    }

    /// The deterministic address of the wallet for a passkey, whether or not it
    /// has been deployed yet.
    pub fn get_wallet_address(env: Env, key_id: Bytes, public_key: BytesN<65>) -> Result<Address, Error> {
        validate(&key_id, &public_key)?;
        let salt = wallet_salt(&env, &key_id, &public_key);
        Ok(env.deployer().with_current_contract(salt).deployed_address())
    }

    /// The deployed wallet for a passkey, or `None` if it does not exist yet.
    pub fn get_wallet(env: Env, key_id: Bytes, public_key: BytesN<65>) -> Option<Address> {
        let address = env
            .deployer()
            .with_current_contract(wallet_salt(&env, &key_id, &public_key))
            .deployed_address();
        storage::is_wallet(&env, &address).then_some(address)
    }

    /// Whether `wallet` was deployed by this factory.
    pub fn is_wallet(env: Env, wallet: Address) -> bool {
        storage::is_wallet(&env, &wallet)
    }

    /// Number of wallets deployed by this factory.
    pub fn wallet_count(env: Env) -> u64 {
        storage::wallet_count(&env)
    }

    /// Code hash used for newly deployed wallets.
    pub fn wallet_wasm_hash(env: Env) -> BytesN<32> {
        storage::wallet_wasm_hash(&env)
    }

    pub fn admin(env: Env) -> Address {
        storage::admin(&env)
    }

    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }

    // ── Account linking ──────────────────────────────────────────────────────

    /// Link a passkey wallet to an existing account (e.g. a Freighter or
    /// WalletConnect G-address) so the user keeps one identity across both.
    ///
    /// Both sides must authorize: the account with its own signature and the
    /// wallet with a passkey assertion. Neither can be linked without the
    /// consent of the other, and each side can hold at most one link.
    pub fn link_account(env: Env, wallet: Address, account: Address) -> Result<(), Error> {
        if !storage::is_wallet(&env, &wallet) {
            return Err(Error::NotAFactoryWallet);
        }
        if account == wallet || storage::is_wallet(&env, &account) {
            return Err(Error::InvalidLink);
        }
        if storage::linked_wallet(&env, &account).is_some() {
            return Err(Error::AccountAlreadyLinked);
        }
        if storage::linked_account(&env, &wallet).is_some() {
            return Err(Error::WalletAlreadyLinked);
        }
        account.require_auth();
        wallet.require_auth();

        storage::set_link(&env, &wallet, &account);
        events::AccountLinked { wallet, account }.publish(&env);
        Ok(())
    }

    /// Remove a link. Either party may do it on its own: `caller` must be the
    /// wallet or its linked account, and must authorize.
    pub fn unlink_account(env: Env, wallet: Address, caller: Address) -> Result<(), Error> {
        let account = storage::linked_account(&env, &wallet).ok_or(Error::NotLinked)?;
        if caller != wallet && caller != account {
            return Err(Error::NotLinkParty);
        }
        caller.require_auth();
        storage::remove_link(&env, &wallet, &account);
        events::AccountUnlinked { wallet, account }.publish(&env);
        Ok(())
    }

    /// The passkey wallet linked to `account`, if any.
    pub fn linked_wallet(env: Env, account: Address) -> Option<Address> {
        storage::linked_wallet(&env, &account)
    }

    /// The account linked to a passkey `wallet`, if any.
    pub fn linked_account(env: Env, wallet: Address) -> Option<Address> {
        storage::linked_account(&env, &wallet)
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /// Emergency stop for new wallet creation. Existing wallets are unaffected:
    /// the factory has no authority over deployed wallets.
    pub fn set_paused(env: Env, paused: bool) {
        storage::admin(&env).require_auth();
        storage::set_paused(&env, paused);
        storage::bump_instance(&env);
        events::DeploymentsPausedChanged { paused }.publish(&env);
    }

    /// Start a two-step admin transfer. The new admin must call `accept_admin`,
    /// so a typo can never hand the factory to an unreachable address.
    pub fn propose_admin(env: Env, new_admin: Address) {
        storage::admin(&env).require_auth();
        storage::set_pending_admin(&env, Some(&new_admin));
        storage::bump_instance(&env);
        events::AdminTransferStarted { pending_admin: new_admin }.publish(&env);
    }

    /// Change the wallet code used for *new* wallets. Existing wallets keep
    /// their code; each wallet can only be upgraded by its own passkey.
    pub fn set_wallet_wasm_hash(env: Env, wasm_hash: BytesN<32>) {
        storage::admin(&env).require_auth();
        storage::set_wallet_wasm_hash(&env, &wasm_hash);
        storage::bump_instance(&env);
        events::WalletWasmUpdated { wasm_hash }.publish(&env);
    }

    /// Upgrade the factory contract itself.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        storage::admin(&env).require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Complete a pending admin transfer.
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let pending = storage::pending_admin(&env).ok_or(Error::NoPendingAdmin)?;
        pending.require_auth();
        storage::set_admin(&env, &pending);
        storage::set_pending_admin(&env, None);
        storage::bump_instance(&env);
        events::AdminTransferred { admin: pending }.publish(&env);
        Ok(())
    }
}

fn validate(key_id: &Bytes, public_key: &BytesN<65>) -> Result<(), Error> {
    if key_id.is_empty() || key_id.len() > MAX_KEY_ID_LEN {
        return Err(Error::InvalidKeyId);
    }
    if public_key.get(0) != Some(UNCOMPRESSED_POINT_TAG) {
        return Err(Error::InvalidPublicKey);
    }
    Ok(())
}

/// `sha256(public_key ‖ key_id)`. The public key is fixed-length, so the
/// concatenation is unambiguous.
fn wallet_salt(env: &Env, key_id: &Bytes, public_key: &BytesN<65>) -> BytesN<32> {
    let mut preimage = Bytes::from_array(env, &public_key.to_array());
    preimage.append(key_id);
    env.crypto().sha256(&preimage).into()
}

#[cfg(test)]
mod test;
