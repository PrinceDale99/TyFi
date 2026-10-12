//! Tests use real secp256r1 keys and real WebAuthn message construction:
//! nothing on the signature path is mocked, so `secp256r1_verify` runs exactly
//! as it does on-chain.
extern crate std;

use std::format;
use std::string::String;

use p256::ecdsa::{signature::hazmat::PrehashSigner, Signature as EcdsaSignature, SigningKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{
    vec,
    xdr::{
        self, HashIdPreimage, HashIdPreimageSorobanAuthorization, InvokeContractArgs, Limits,
        ScVal, SorobanAddressCredentials, SorobanAuthorizationEntry, SorobanAuthorizedFunction,
        SorobanAuthorizedInvocation, SorobanCredentials, WriteXdr,
    },
    Address, Bytes, BytesN, Env, IntoVal, Map, TryFromVal, Val,
};

use crate::{
    base64url, Error, Secp256r1Signature, Signature, SignerKey, Signatures, SmartWallet,
    SmartWalletClient,
};

const FLAG_UP: u8 = 0x01;
const FLAG_UV: u8 = 0x04;
const FLAGS_OK: u8 = FLAG_UP | FLAG_UV;

/// A software passkey: a P-256 key plus its WebAuthn credential id.
struct TestPasskey {
    key_id: [u8; 16],
    signing_key: SigningKey,
}

impl TestPasskey {
    fn new(seed: u8) -> Self {
        let mut scalar = [seed; 32];
        scalar[0] = 0x01; // keep the scalar well inside the curve order
        Self {
            key_id: [seed; 16],
            signing_key: SigningKey::from_bytes(&scalar.into()).unwrap(),
        }
    }

    fn key_id(&self, env: &Env) -> Bytes {
        Bytes::from_array(env, &self.key_id)
    }

    fn public_key(&self, env: &Env) -> BytesN<65> {
        let point = self.signing_key.verifying_key().to_encoded_point(false);
        BytesN::from_array(env, point.as_bytes().try_into().unwrap())
    }

    /// Build a WebAuthn assertion exactly as a browser authenticator would.
    fn assert(&self, env: &Env, payload: &[u8; 32], opts: AssertOpts) -> Secp256r1Signature {
        let mut auth_data = std::vec![0x49u8; 32]; // rpIdHash
        auth_data.push(opts.flags);
        auth_data.extend_from_slice(&[0, 0, 0, 1]); // signCount
        auth_data.truncate(opts.auth_data_len.unwrap_or(auth_data.len()));

        let challenge = String::from_utf8(base64url::encode_32(&opts.challenge.unwrap_or(*payload)).to_vec()).unwrap();
        let client_data = opts.client_data.unwrap_or_else(|| {
            format!(
                r#"{{"type":"{}","challenge":"{}","origin":"https://www.tyfi.site","crossOrigin":false}}"#,
                opts.kind, challenge
            )
        });

        let mut message = auth_data.clone();
        message.extend_from_slice(&Sha256::digest(client_data.as_bytes()));
        let digest = Sha256::digest(&message);

        let signer = opts.signing_key.unwrap_or(&self.signing_key);
        let sig: EcdsaSignature = signer.sign_prehash(&digest).unwrap();
        let sig = sig.normalize_s().unwrap_or(sig);
        let sig_bytes: [u8; 64] = if opts.high_s { to_high_s(&sig) } else { sig.to_bytes().into() };

        Secp256r1Signature {
            authenticator_data: Bytes::from_slice(env, &auth_data),
            client_data_json: Bytes::from_slice(env, client_data.as_bytes()),
            signature: BytesN::from_array(env, &sig_bytes),
        }
    }

    fn signatures(&self, env: &Env, assertion: Secp256r1Signature) -> Signatures {
        let mut map = Map::new(env);
        map.set(SignerKey::Secp256r1(self.key_id(env)), Signature::Secp256r1(assertion));
        Signatures(map)
    }
}

struct AssertOpts<'a> {
    flags: u8,
    kind: &'a str,
    challenge: Option<[u8; 32]>,
    client_data: Option<String>,
    auth_data_len: Option<usize>,
    signing_key: Option<&'a SigningKey>,
    high_s: bool,
}

impl Default for AssertOpts<'_> {
    fn default() -> Self {
        Self {
            flags: FLAGS_OK,
            kind: "webauthn.get",
            challenge: None,
            client_data: None,
            auth_data_len: None,
            signing_key: None,
            high_s: false,
        }
    }
}

/// Convert a low-S signature into its malleable high-S twin (s' = n - s).
fn to_high_s(sig: &EcdsaSignature) -> [u8; 64] {
    use p256::elliptic_curve::ops::Neg;
    let (r, s) = sig.split_scalars();
    let high = EcdsaSignature::from_scalars(r, s.neg()).unwrap();
    high.to_bytes().into()
}

fn setup(env: &Env, passkey: &TestPasskey) -> (Address, SmartWalletClient<'static>) {
    let address = env.register(SmartWallet, (passkey.key_id(env), passkey.public_key(env)));
    (address.clone(), SmartWalletClient::new(env, &address))
}

fn check_auth(env: &Env, wallet: &Address, payload: &[u8; 32], sigs: Signatures) -> Result<(), Result<Error, soroban_sdk::InvokeError>> {
    env.try_invoke_contract_check_auth::<Error>(
        wallet,
        &BytesN::from_array(env, payload),
        sigs.into_val(env),
        &vec![env],
    )
}

// ─── Constructor ─────────────────────────────────────────────────────────────

#[test]
fn constructor_registers_initial_passkey() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (_, client) = setup(&env, &pk);

    assert_eq!(client.signer_count(), 1);
    let signer = client.get_signer(&pk.key_id(&env)).unwrap();
    assert_eq!(signer.public_key, pk.public_key(&env));
    assert_eq!(client.version(), 1);
}

#[test]
#[should_panic]
fn constructor_rejects_compressed_or_untagged_public_key() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let mut bad = [0u8; 65];
    bad[0] = 0x02;
    env.register(SmartWallet, (pk.key_id(&env), BytesN::from_array(&env, &bad)));
}

#[test]
#[should_panic]
fn constructor_rejects_empty_key_id() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    env.register(SmartWallet, (Bytes::new(&env), pk.public_key(&env)));
}

#[test]
#[should_panic]
fn constructor_rejects_oversized_key_id() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    env.register(SmartWallet, (Bytes::from_slice(&env, &[1u8; 256]), pk.public_key(&env)));
}

// ─── __check_auth: success ───────────────────────────────────────────────────

#[test]
fn valid_biometric_assertion_authorizes() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [42u8; 32];

    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts::default()));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Ok(()));
}

#[test]
fn client_data_field_order_and_extra_fields_are_accepted() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [9u8; 32];
    let challenge = String::from_utf8(base64url::encode_32(&payload).to_vec()).unwrap();
    // Some authenticators put `challenge` first and append extra fields.
    let client_data = format!(
        r#"{{"challenge":"{}","origin":"https://www.tyfi.site","type":"webauthn.get","other_keys_can_be_added_here":"do not compare clientDataJSON against a template"}}"#,
        challenge
    );
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { client_data: Some(client_data), ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Ok(()));
}

#[test]
fn any_registered_passkey_can_authorize() {
    let env = Env::default();
    env.mock_all_auths();
    let first = TestPasskey::new(7);
    let second = TestPasskey::new(8);
    let (wallet, client) = setup(&env, &first);
    client.add_signer(&second.key_id(&env), &second.public_key(&env));

    let payload = [3u8; 32];
    let sigs = second.signatures(&env, second.assert(&env, &payload, AssertOpts::default()));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Ok(()));
}

// ─── __check_auth: rejections ────────────────────────────────────────────────

#[test]
fn rejects_empty_signature_map() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let empty = Signatures(Map::new(&env));
    assert_eq!(check_auth(&env, &wallet, &[1u8; 32], empty), Err(Ok(Error::NoSignatures)));
}

#[test]
fn rejects_unregistered_passkey() {
    let env = Env::default();
    let owner = TestPasskey::new(7);
    let stranger = TestPasskey::new(9);
    let (wallet, _) = setup(&env, &owner);
    let payload = [1u8; 32];
    let sigs = stranger.signatures(&env, stranger.assert(&env, &payload, AssertOpts::default()));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::UnknownSigner)));
}

#[test]
fn rejects_assertion_for_a_different_payload() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    // Signed for payload A, replayed against payload B.
    let assertion = pk.assert(&env, &[1u8; 32], AssertOpts::default());
    assert_eq!(
        check_auth(&env, &wallet, &[2u8; 32], pk.signatures(&env, assertion)),
        Err(Ok(Error::ChallengeMismatch))
    );
}

#[test]
fn rejects_registration_ceremony_type() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { kind: "webauthn.create", ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::InvalidClientDataType)));
}

#[test]
fn rejects_missing_user_presence() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { flags: FLAG_UV, ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::UserNotPresent)));
}

#[test]
fn rejects_missing_user_verification_biometric() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { flags: FLAG_UP, ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::UserNotVerified)));
}

#[test]
fn rejects_truncated_authenticator_data() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { auth_data_len: Some(36), ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::AuthenticatorDataTooShort)));
}

#[test]
fn rejects_malformed_client_data() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { client_data: Some(String::from("{not json")), ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::ClientDataMalformed)));
}

#[test]
fn rejects_oversized_client_data() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let padding = "x".repeat(1100);
    let challenge = String::from_utf8(base64url::encode_32(&payload).to_vec()).unwrap();
    let client_data = format!(r#"{{"type":"webauthn.get","challenge":"{}","pad":"{}"}}"#, challenge, padding);
    let sigs = pk.signatures(&env, pk.assert(&env, &payload, AssertOpts { client_data: Some(client_data), ..Default::default() }));
    assert_eq!(check_auth(&env, &wallet, &payload, sigs), Err(Ok(Error::ClientDataTooLarge)));
}

#[test]
fn rejects_signature_from_wrong_private_key() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let attacker = TestPasskey::new(11);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    // Correct key id, but signed by a different private key.
    let assertion = pk.assert(&env, &payload, AssertOpts { signing_key: Some(&attacker.signing_key), ..Default::default() });
    assert!(check_auth(&env, &wallet, &payload, pk.signatures(&env, assertion)).is_err());
}

#[test]
fn rejects_tampered_authenticator_data() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let mut assertion = pk.assert(&env, &payload, AssertOpts::default());
    // Flip a byte of the rpIdHash after signing: the flags still pass, the signature must not.
    assertion.authenticator_data.set(0, 0x00);
    assert!(check_auth(&env, &wallet, &payload, pk.signatures(&env, assertion)).is_err());
}

#[test]
fn rejects_malleable_high_s_signature() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (wallet, _) = setup(&env, &pk);
    let payload = [1u8; 32];
    let assertion = pk.assert(&env, &payload, AssertOpts { high_s: true, ..Default::default() });
    assert!(check_auth(&env, &wallet, &payload, pk.signatures(&env, assertion)).is_err());
}

#[test]
fn every_signature_in_the_map_must_verify() {
    let env = Env::default();
    env.mock_all_auths();
    let first = TestPasskey::new(7);
    let second = TestPasskey::new(8);
    let (wallet, client) = setup(&env, &first);
    client.add_signer(&second.key_id(&env), &second.public_key(&env));

    let payload = [5u8; 32];
    let mut map = Map::new(&env);
    map.set(SignerKey::Secp256r1(first.key_id(&env)), Signature::Secp256r1(first.assert(&env, &payload, AssertOpts::default())));
    // A valid first signature must not carry an invalid second one.
    map.set(SignerKey::Secp256r1(second.key_id(&env)), Signature::Secp256r1(second.assert(&env, &payload, AssertOpts { flags: FLAG_UP, ..Default::default() })));
    assert_eq!(check_auth(&env, &wallet, &payload, Signatures(map)), Err(Ok(Error::UserNotVerified)));
}

// ─── Signer management ───────────────────────────────────────────────────────

#[test]
#[should_panic]
fn add_signer_requires_wallet_authorization() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (_, client) = setup(&env, &pk);
    let other = TestPasskey::new(8);
    client.add_signer(&other.key_id(&env), &other.public_key(&env));
}

#[test]
fn add_signer_rejects_duplicates_and_enforces_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let pk = TestPasskey::new(1);
    let (_, client) = setup(&env, &pk);

    assert_eq!(
        client.try_add_signer(&pk.key_id(&env), &pk.public_key(&env)),
        Err(Ok(Error::SignerAlreadyExists))
    );
    for seed in 2..=10u8 {
        let extra = TestPasskey::new(seed);
        client.add_signer(&extra.key_id(&env), &extra.public_key(&env));
    }
    assert_eq!(client.signer_count(), 10);
    let eleventh = TestPasskey::new(11);
    assert_eq!(
        client.try_add_signer(&eleventh.key_id(&env), &eleventh.public_key(&env)),
        Err(Ok(Error::TooManySigners))
    );
}

#[test]
fn remove_signer_never_removes_the_last_passkey() {
    let env = Env::default();
    env.mock_all_auths();
    let first = TestPasskey::new(7);
    let second = TestPasskey::new(8);
    let (_, client) = setup(&env, &first);

    assert_eq!(client.try_remove_signer(&first.key_id(&env)), Err(Ok(Error::LastSigner)));
    client.add_signer(&second.key_id(&env), &second.public_key(&env));
    client.remove_signer(&first.key_id(&env));
    assert_eq!(client.signer_count(), 1);
    assert!(client.get_signer(&first.key_id(&env)).is_none());
    assert_eq!(client.try_remove_signer(&first.key_id(&env)), Err(Ok(Error::UnknownSigner)));
}

#[test]
#[should_panic]
fn upgrade_requires_wallet_authorization() {
    let env = Env::default();
    let pk = TestPasskey::new(7);
    let (_, client) = setup(&env, &pk);
    client.upgrade(&BytesN::from_array(&env, &[0u8; 32]));
}
