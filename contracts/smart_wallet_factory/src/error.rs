use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The credential id is empty or longer than the maximum accepted length.
    InvalidKeyId = 1,
    /// The public key is not a 65-byte uncompressed SEC1 point (0x04 prefix).
    InvalidPublicKey = 2,
    /// A wallet for this (credential id, public key) pair already exists.
    WalletAlreadyDeployed = 3,
    /// Wallet creation is paused by the factory admin.
    DeploymentsPaused = 4,
    /// `accept_admin` was called with no pending admin transfer.
    NoPendingAdmin = 5,
    /// The wallet being linked was not deployed by this factory.
    NotAFactoryWallet = 6,
    /// This account is already linked to a passkey wallet.
    AccountAlreadyLinked = 7,
    /// This passkey wallet is already linked to an account.
    WalletAlreadyLinked = 8,
    /// There is no link to remove.
    NotLinked = 9,
    /// An account cannot be linked to itself or to another factory wallet.
    InvalidLink = 10,
    /// Only the wallet or its linked account may remove a link.
    NotLinkParty = 11,
}
