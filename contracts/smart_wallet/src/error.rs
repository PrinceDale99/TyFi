use soroban_sdk::contracterror;

/// Every failure path of the wallet has a stable, typed error code so that
/// clients (and the relayer) can explain rejections instead of seeing a VM trap.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// `__check_auth` was called with an empty signature map.
    NoSignatures = 1,
    /// A signature references a passkey that is not registered on this wallet.
    UnknownSigner = 2,
    /// Authenticator data is shorter than the 37-byte WebAuthn minimum.
    AuthenticatorDataTooShort = 3,
    /// The User Present (UP) flag is not set in the authenticator data.
    UserNotPresent = 4,
    /// The User Verified (UV) flag is not set: no biometric / PIN check happened.
    UserNotVerified = 5,
    /// `clientDataJSON` exceeds the maximum accepted size.
    ClientDataTooLarge = 6,
    /// `clientDataJSON` could not be parsed.
    ClientDataMalformed = 7,
    /// `clientDataJSON.type` is not `webauthn.get`.
    InvalidClientDataType = 8,
    /// `clientDataJSON.challenge` does not equal the Soroban signature payload.
    ChallengeMismatch = 9,
    /// The public key is not a 65-byte uncompressed SEC1 point (0x04 prefix).
    InvalidPublicKey = 10,
    /// The credential id is empty or longer than the maximum accepted length.
    InvalidKeyId = 11,
    /// A signer with this credential id already exists.
    SignerAlreadyExists = 12,
    /// Removing this signer would leave the wallet without any signer.
    LastSigner = 13,
    /// The wallet already holds the maximum number of passkey signers.
    TooManySigners = 14,
}
