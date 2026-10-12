use soroban_sdk::{contracttype, Bytes, BytesN, Map};

/// Identifies a signer of the wallet.
///
/// Wire-compatible with the Stellar Passkey Kit `SignerKey::Secp256r1(keyId)`
/// variant, so signatures produced by the kit's `PasskeySigner` can be passed
/// to this wallet unchanged. Only passkeys are supported: there is deliberately
/// no Ed25519 variant.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SignerKey {
    /// Raw WebAuthn credential id.
    Secp256r1(Bytes),
}

/// A WebAuthn assertion produced by the authenticator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Secp256r1Signature {
    /// Raw `authenticatorData` (rpIdHash ‖ flags ‖ signCount ‖ extensions).
    pub authenticator_data: Bytes,
    /// Raw `clientDataJSON` bytes as signed by the authenticator.
    pub client_data_json: Bytes,
    /// Compact `r ‖ s` signature with s normalized to the low half of the order.
    pub signature: BytesN<64>,
}

/// A signature for one signer. Wire-compatible with the Passkey Kit
/// `Signature::Secp256r1` variant.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Signature {
    Secp256r1(Secp256r1Signature),
}

/// The value passed as the `signature` of a Soroban address credential for
/// this wallet: one entry per signer that approves the payload.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Signatures(pub Map<SignerKey, Signature>);

/// A registered passkey signer.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PasskeySigner {
    /// Uncompressed SEC1 secp256r1 public key (`0x04 ‖ X ‖ Y`).
    pub public_key: BytesN<65>,
    /// Ledger timestamp at which the signer was added.
    pub added_at: u64,
}
