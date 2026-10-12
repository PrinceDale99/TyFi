use soroban_sdk::{contractevent, Address, Bytes, BytesN};

/// Emitted for every seedless wallet the factory deploys. Indexers and the
/// TyFi backend use it to prove a wallet was created by this factory.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WalletCreated {
    #[topic]
    pub wallet: Address,
    pub key_id: Bytes,
    pub public_key: BytesN<65>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WalletWasmUpdated {
    pub wasm_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeploymentsPausedChanged {
    pub paused: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferStarted {
    #[topic]
    pub pending_admin: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferred {
    #[topic]
    pub admin: Address,
}

/// A passkey wallet and an existing account (Freighter / WalletConnect / …)
/// were linked with the consent of both.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountLinked {
    #[topic]
    pub wallet: Address,
    #[topic]
    pub account: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountUnlinked {
    #[topic]
    pub wallet: Address,
    #[topic]
    pub account: Address,
}
