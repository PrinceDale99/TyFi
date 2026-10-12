//! WebAuthn (FIDO2) assertion verification for Soroban.
//!
//! A passkey does not sign the Soroban payload directly. The authenticator
//! signs `authenticatorData ‖ SHA-256(clientDataJSON)`, and the payload is
//! embedded (base64url) as the `challenge` inside `clientDataJSON`. Verifying
//! an assertion therefore means:
//!
//! 1. checking the authenticator flags (user present + user verified),
//! 2. checking `clientDataJSON` is a `webauthn.get` ceremony whose challenge is
//!    exactly the Soroban signature payload being authorized, and
//! 3. verifying the ECDSA secp256r1 (prime256v1 / P-256) signature with the
//!    native Protocol 21 host function `secp256r1_verify`.

use serde::Deserialize;
use soroban_sdk::{crypto::Hash, BytesN, Env};

use crate::{base64url, error::Error, types::Secp256r1Signature};

/// Upper bound on accepted `clientDataJSON` size. Real authenticators emit
/// ~130–250 bytes; the bound keeps parsing cost and memory fixed.
pub const MAX_CLIENT_DATA_LEN: usize = 1024;

/// `rpIdHash` (32) + `flags` (1) + `signCount` (4).
const AUTHENTICATOR_DATA_MIN_LEN: u32 = 37;
const FLAGS_INDEX: u32 = 32;
/// User Present.
const FLAG_UP: u8 = 0x01;
/// User Verified (biometric or device PIN).
const FLAG_UV: u8 = 0x04;

const WEBAUTHN_GET: &str = "webauthn.get";

/// The only `clientDataJSON` fields the wallet needs; everything else
/// (`origin`, `crossOrigin`, …) is ignored. The rpId is already bound by the
/// authenticator: a credential only ever signs for the domain it was created on.
#[derive(Deserialize)]
struct ClientData<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    challenge: &'a str,
}

/// Verify a WebAuthn assertion over `payload` for `public_key`.
///
/// Returns a typed error for every policy failure. An invalid ECDSA signature
/// makes the host function trap, which aborts the authorization outright.
pub fn verify(
    env: &Env,
    payload: &Hash<32>,
    signature: &Secp256r1Signature,
    public_key: &BytesN<65>,
) -> Result<(), Error> {
    verify_authenticator_flags(signature)?;
    verify_client_data(payload, signature)?;

    // message = authenticatorData ‖ SHA-256(clientDataJSON); digest = SHA-256(message)
    let mut message = signature.authenticator_data.clone();
    message.extend_from_array(&env.crypto().sha256(&signature.client_data_json).to_array());
    let digest = env.crypto().sha256(&message);

    env.crypto().secp256r1_verify(public_key, &digest, &signature.signature);
    Ok(())
}

fn verify_authenticator_flags(signature: &Secp256r1Signature) -> Result<(), Error> {
    let data = &signature.authenticator_data;
    if data.len() < AUTHENTICATOR_DATA_MIN_LEN {
        return Err(Error::AuthenticatorDataTooShort);
    }
    let flags = data.get(FLAGS_INDEX).ok_or(Error::AuthenticatorDataTooShort)?;
    if flags & FLAG_UP == 0 {
        return Err(Error::UserNotPresent);
    }
    // Seedless accounts are bound to device biometrics: an assertion without
    // user verification (e.g. a security key tap with no PIN) is rejected.
    if flags & FLAG_UV == 0 {
        return Err(Error::UserNotVerified);
    }
    Ok(())
}

fn verify_client_data(payload: &Hash<32>, signature: &Secp256r1Signature) -> Result<(), Error> {
    let len = signature.client_data_json.len() as usize;
    if len > MAX_CLIENT_DATA_LEN {
        return Err(Error::ClientDataTooLarge);
    }
    let mut buf = [0u8; MAX_CLIENT_DATA_LEN];
    signature.client_data_json.copy_into_slice(&mut buf[..len]);

    let (client_data, _) = serde_json_core::from_slice::<ClientData>(&buf[..len])
        .map_err(|_| Error::ClientDataMalformed)?;

    if client_data.kind != WEBAUTHN_GET {
        return Err(Error::InvalidClientDataType);
    }
    let expected = base64url::encode_32(&payload.to_array());
    if client_data.challenge.as_bytes() != expected {
        return Err(Error::ChallengeMismatch);
    }
    Ok(())
}
