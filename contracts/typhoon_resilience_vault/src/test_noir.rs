extern crate std;
use super::*;
use crate::zk_fixture as fx;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env, Symbol};

// The real UltraHonk verifier (contracts/noir_verifier) needs soroban-sdk 28, so
// it can't run in this crate's test host. These tests use a stand-in verifier
// that accepts exactly the Noir fixture proof with the public inputs the
// circuit committed to (circuits/weather_threshold_noir/artifacts). That checks
// the vault builds the circuit's public inputs byte for byte and wires the
// result through; contracts/noir_verifier/tests verifies the proof itself.

const NOIR_PROOF: &[u8] = include_bytes!("../../../circuits/weather_threshold_noir/artifacts/proof");
const NOIR_PUBLIC_INPUTS: &[u8] = include_bytes!("../../../circuits/weather_threshold_noir/artifacts/public_inputs");

#[contract]
struct FixtureVerifier;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
enum FixtureError {
    VerificationFailed = 4,
}

#[contractimpl]
impl FixtureVerifier {
    pub fn verify_proof(env: Env, public_inputs: Bytes, proof: Bytes) -> Result<(), FixtureError> {
        if public_inputs == Bytes::from_slice(&env, NOIR_PUBLIC_INPUTS) && proof == Bytes::from_slice(&env, NOIR_PROOF) {
            Ok(())
        } else {
            Err(FixtureError::VerificationFailed)
        }
    }
}

fn setup() -> (Env, TyphoonVaultClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);
    let oracle = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(Address::generate(&env));
    client.initialize(&soroban_sdk::vec![&env, BytesN::from_array(&env, &[7u8; 32])], &1, &xlm_token, &1, &false, &oracle);
    let verifier = env.register_contract(None, FixtureVerifier);
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::Oracle(oracle.clone()), &true);
        env.storage().instance().set(&DataKey::NoirVerifier, &verifier);
        env.storage().persistent().set(
            &DataKey::OracleZkKeyHash(oracle.clone()),
            &U256::from_be_bytes(&env, &Bytes::from_array(&env, &fx::ORACLE_KEY_HASH)),
        );
    });
    (env, client, contract_id, oracle)
}

fn proof(env: &Env) -> Bytes {
    Bytes::from_slice(env, NOIR_PROOF)
}

#[test]
fn valid_proof_reaches_consensus() {
    let (env, client, contract_id, oracle) = setup();
    let typhoon = Symbol::new(&env, fx::TYPHOON);
    let region = Symbol::new(&env, fx::REGION);

    client.submit_weather_report_noir(&oracle, &typhoon, &region, &fx::DAMAGE, &fx::WIND_FLOOR, &proof(&env));

    assert_eq!(client.get_weather_report(&typhoon, &region, &oracle), fx::DAMAGE);
    env.as_contract(&contract_id, || {
        let reached: bool = env.storage().persistent().get(&DataKey::ConsensusReached(typhoon.clone(), region.clone())).unwrap();
        let wind: u32 = env.storage().persistent().get(&DataKey::OracleWindSpeed(typhoon.clone(), region.clone())).unwrap();
        assert!(reached);
        assert_eq!(wind, fx::WIND_FLOOR);
    });
}

#[test]
fn tampered_damage_is_rejected() {
    let (env, client, _, oracle) = setup();
    let res = client.try_submit_weather_report_noir(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &100,
        &fx::WIND_FLOOR,
        &proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn proof_cannot_be_replayed_for_another_region() {
    let (env, client, _, oracle) = setup();
    let res = client.try_submit_weather_report_noir(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, "Bicol"),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn another_oracle_key_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::OracleZkKeyHash(oracle.clone()), &U256::from_u32(&env, 1));
    });
    let res = client.try_submit_weather_report_noir(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn unconfigured_verifier_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    env.as_contract(&contract_id, || env.storage().instance().remove(&DataKey::NoirVerifier));
    let res = client.try_submit_weather_report_noir(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::ZkNotConfigured)));
}
