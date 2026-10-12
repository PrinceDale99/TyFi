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
