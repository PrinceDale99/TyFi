use soroban_sdk::{contractevent, Bytes, BytesN};

/// Emitted when a passkey is registered (constructor or `add_signer`).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignerAdded {
    #[topic]
    pub key_id: Bytes,
    pub public_key: BytesN<65>,
}

/// Emitted when a passkey is removed.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignerRemoved {
    #[topic]
    pub key_id: Bytes,
}

/// Emitted when the wallet replaces its own code.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WalletUpgraded {
    pub new_wasm_hash: BytesN<32>,
}
