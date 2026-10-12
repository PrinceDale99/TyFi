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

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    /// Contract version, bumped on every interface or behaviour change.
    pub fn version(_env: Env) -> u32 {
        1
    }
}
