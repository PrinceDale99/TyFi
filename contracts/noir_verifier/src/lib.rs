#![no_std]
//! On-chain verifier for the Noir version of the TyFi weather circuit
//! (`circuits/weather_threshold_noir`).
//!
//! Wraps `ultrahonk_soroban_verifier` (NethermindEth/rs-soroban-ultrahonk,
//! MIT OR Apache-2.0), which verifies Barretenberg UltraHonk proofs with the
//! Keccak transcript (`bb prove --oracle_hash keccak`) using Soroban's BN254
//! host functions. The verification key is fixed at deployment; the vault
//! calls `verify_proof` with public inputs it rebuilds itself, so this
//! contract needs no access control.
//!
//! Note: the supported flavor is non-zero-knowledge. It proves the statement
//! is true but does not hide the private inputs; see the circuit README.
use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Bytes, Env, Symbol};
use ultrahonk_soroban_verifier::{UltraHonkVerifier, VkLoadError, PROOF_BYTES};

const VK: Symbol = symbol_short!("vk");

#[contract]
pub struct NoirVerifier;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    VkInvalidLength = 1,
    VkInvalidParameters = 2,
    ProofParseError = 3,
    VerificationFailed = 4,
    VkNotSet = 5,
    AlreadyInitialized = 6,
    VkInvalidPoint = 7,
}

fn load(env: &Env, vk: &Bytes) -> Result<UltraHonkVerifier, Error> {
    UltraHonkVerifier::new(env, vk).map_err(|e| match e {
        VkLoadError::WrongLength => Error::VkInvalidLength,
        VkLoadError::InvalidParameters => Error::VkInvalidParameters,
        VkLoadError::InvalidPoint => Error::VkInvalidPoint,
    })
}

#[contractimpl]
impl NoirVerifier {
    /// Stores the circuit's verification key (`bb write_vk`, 1,760 bytes) once.
    pub fn __constructor(env: Env, vk: Bytes) -> Result<(), Error> {
        if env.storage().instance().has(&VK) {
            return Err(Error::AlreadyInitialized);
        }
        load(&env, &vk)?;
        env.storage().instance().set(&VK, &vk);
        Ok(())
    }

    /// The stored verification key, so anyone can check it against the circuit.
    pub fn vk(env: Env) -> Result<Bytes, Error> {
        env.storage().instance().get(&VK).ok_or(Error::VkNotSet)
    }

    /// Verifies `proof` (14,592 bytes) for `public_inputs` (32-byte big-endian
    /// field elements in circuit order).
    pub fn verify_proof(env: Env, public_inputs: Bytes, proof: Bytes) -> Result<(), Error> {
        if proof.len() as usize != PROOF_BYTES {
            return Err(Error::ProofParseError);
        }
        let vk: Bytes = env.storage().instance().get(&VK).ok_or(Error::VkNotSet)?;
        load(&env, &vk)?
            .verify(&proof, &public_inputs)
            .map_err(|_| Error::VerificationFailed)
    }
}
