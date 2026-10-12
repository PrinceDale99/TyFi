//! Factory tests deploy the real compiled `smart_wallet` WASM (build it first:
//! `stellar contract build --package smart_wallet`) and exercise it with real
//! secp256r1 WebAuthn assertions.
extern crate std;

use std::format;

use p256::ecdsa::{signature::hazmat::PrehashSigner, Signature as EcdsaSignature, SigningKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{testutils::Address as _, vec, Address, Bytes, BytesN, Env, IntoVal, Map};

use crate::{Error, SmartWalletFactory, SmartWalletFactoryClient};

mod wallet {
    #[allow(unused_imports)]
    use soroban_sdk::auth::Context;
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/smart_wallet.wasm");
}

struct TestPasskey {
    key_id: [u8; 16],
    signing_key: SigningKey,
}

impl TestPasskey {
    fn new(seed: u8) -> Self {
        let mut scalar = [seed; 32];
        scalar[0] = 0x01;
        Self { key_id: [seed; 16], signing_key: SigningKey::from_bytes(&scalar.into()).unwrap() }
    }

    fn key_id(&self, env: &Env) -> Bytes {
        Bytes::from_array(env, &self.key_id)
    }

    fn public_key(&self, env: &Env) -> BytesN<65> {
        let point = self.signing_key.verifying_key().to_encoded_point(false);
        BytesN::from_array(env, point.as_bytes().try_into().unwrap())
    }

    fn signatures(&self, env: &Env, payload: &[u8; 32]) -> wallet::Signatures {
        let mut auth_data = std::vec![0x49u8; 32];
        auth_data.push(0x05); // UP | UV
        auth_data.extend_from_slice(&[0, 0, 0, 1]);
        let challenge = base64url(payload);
        let client_data = format!(r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://www.tyfi.site"}}"#, challenge);
        let mut message = auth_data.clone();
        message.extend_from_slice(&Sha256::digest(client_data.as_bytes()));
        let sig: EcdsaSignature = self.signing_key.sign_prehash(&Sha256::digest(&message)).unwrap();
        let sig = sig.normalize_s().unwrap_or(sig);

        let mut map = Map::new(env);
        map.set(
            wallet::SignerKey::Secp256r1(self.key_id(env)),
            wallet::Signature::Secp256r1(wallet::Secp256r1Signature {
                authenticator_data: Bytes::from_slice(env, &auth_data),
                client_data_json: Bytes::from_slice(env, client_data.as_bytes()),
                signature: BytesN::from_array(env, &sig.to_bytes().into()),
            }),
        );
        wallet::Signatures(map)
    }
}

fn base64url(input: &[u8; 32]) -> std::string::String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = std::string::String::new();
    for chunk in input.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        let chars = chunk.len() + 1;
        for i in 0..chars {
            out.push(A[((n >> (18 - 6 * i)) & 63) as usize] as char);
        }
    }
    out
}

struct Setup {
    env: Env,
    admin: Address,
    factory: SmartWalletFactoryClient<'static>,
    wasm_hash: BytesN<32>,
}

fn setup() -> Setup {
    let env = Env::default();
    let wasm_hash = env.deployer().upload_contract_wasm(wallet::WASM);
    let admin = Address::generate(&env);
    let id = env.register(SmartWalletFactory, (admin.clone(), wasm_hash.clone()));
    let factory = SmartWalletFactoryClient::new(&env, &id);
    Setup { env, admin, factory, wasm_hash }
}

// ─── Deployment ──────────────────────────────────────────────────────────────

#[test]
fn deploys_wallet_bound_to_passkey() {
    let s = setup();
    let pk = TestPasskey::new(7);
    let address = s.factory.deploy(&pk.key_id(&s.env), &pk.public_key(&s.env));

    let wallet = wallet::Client::new(&s.env, &address);
    assert_eq!(wallet.signer_count(), 1);
    assert_eq!(wallet.get_signer(&pk.key_id(&s.env)).unwrap().public_key, pk.public_key(&s.env));
    assert!(s.factory.is_wallet(&address));
    assert_eq!(s.factory.wallet_count(), 1);
    assert_eq!(s.factory.get_wallet(&pk.key_id(&s.env), &pk.public_key(&s.env)), Some(address));
}

#[test]
fn predicted_address_matches_deployed_address() {
    let s = setup();
    let pk = TestPasskey::new(7);
    let predicted = s.factory.get_wallet_address(&pk.key_id(&s.env), &pk.public_key(&s.env));
    assert_eq!(s.factory.get_wallet(&pk.key_id(&s.env), &pk.public_key(&s.env)), None);
    let deployed = s.factory.deploy(&pk.key_id(&s.env), &pk.public_key(&s.env));
    assert_eq!(predicted, deployed);
}

#[test]
fn deployment_needs_no_authorization_so_sponsors_can_pay() {
    // No mock_all_auths: any account may submit the deployment.
    let s = setup();
    let pk = TestPasskey::new(7);
    s.factory.deploy(&pk.key_id(&s.env), &pk.public_key(&s.env));
    assert!(s.env.auths().is_empty());
}

#[test]
fn second_deployment_for_same_passkey_is_rejected() {
    let s = setup();
    let pk = TestPasskey::new(7);
    s.factory.deploy(&pk.key_id(&s.env), &pk.public_key(&s.env));
    assert_eq!(
        s.factory.try_deploy(&pk.key_id(&s.env), &pk.public_key(&s.env)),
        Err(Ok(Error::WalletAlreadyDeployed))
    );
}

#[test]
fn front_runner_with_copied_key_id_cannot_claim_the_victims_address() {
    let s = setup();
    let victim = TestPasskey::new(7);
    let attacker = TestPasskey::new(66);

    let victim_address = s.factory.get_wallet_address(&victim.key_id(&s.env), &victim.public_key(&s.env));
    // Attacker reuses the victim's credential id with their own key.
    let attacker_wallet = s.factory.deploy(&victim.key_id(&s.env), &attacker.public_key(&s.env));
    assert_ne!(attacker_wallet, victim_address);

    // The victim's wallet still deploys to the address their client expects.
    let victim_wallet = s.factory.deploy(&victim.key_id(&s.env), &victim.public_key(&s.env));
    assert_eq!(victim_wallet, victim_address);
}

#[test]
fn rejects_invalid_key_material() {
    let s = setup();
    let pk = TestPasskey::new(7);
    assert_eq!(s.factory.try_deploy(&Bytes::new(&s.env), &pk.public_key(&s.env)), Err(Ok(Error::InvalidKeyId)));
    assert_eq!(
        s.factory.try_deploy(&Bytes::from_slice(&s.env, &[1u8; 256]), &pk.public_key(&s.env)),
        Err(Ok(Error::InvalidKeyId))
    );
    let mut compressed = [0u8; 65];
    compressed[0] = 0x03;
    assert_eq!(
        s.factory.try_deploy(&pk.key_id(&s.env), &BytesN::from_array(&s.env, &compressed)),
        Err(Ok(Error::InvalidPublicKey))
    );
    assert_eq!(s.factory.wallet_count(), 0);
}
