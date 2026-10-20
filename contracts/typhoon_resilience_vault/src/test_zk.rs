extern crate std;
use super::*;
use crate::zk_fixture as fx;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

// These tests verify a real snarkjs Groth16 proof (see zk_fixture.rs) with the
// BN254 host functions. Setup writes the VK and oracle key directly to storage;
// the multisig paths are covered in test_auth.rs.

fn setup() -> (Env, TyphoonVaultClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);
    let oracle = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(Address::generate(&env));
    client.initialize(&Vec::new(&env), &1, &xlm_token, &1, &false, &oracle);
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::Oracle(oracle.clone()), &true);
    });
    (env, client, contract_id, oracle)
}

fn fixture_vk(env: &Env) -> Groth16VerifyingKey {
    let mut ic = Vec::new(env);
    for p in fx::VK_IC.iter() {
        ic.push_back(BytesN::from_array(env, p));
    }
    Groth16VerifyingKey {
        alpha: BytesN::from_array(env, &fx::VK_ALPHA),
        beta: BytesN::from_array(env, &fx::VK_BETA),
        gamma: BytesN::from_array(env, &fx::VK_GAMMA),
        delta: BytesN::from_array(env, &fx::VK_DELTA),
        ic,
    }
}

fn fixture_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: BytesN::from_array(env, &fx::PROOF_A),
        b: BytesN::from_array(env, &fx::PROOF_B),
        c: BytesN::from_array(env, &fx::PROOF_C),
    }
}

fn u256(env: &Env, be: &[u8; 32]) -> U256 {
    U256::from_be_bytes(env, &Bytes::from_array(env, be))
}

fn install_zk(env: &Env, contract_id: &Address, oracle: &Address, key_hash: U256) {
    env.as_contract(contract_id, || {
        env.storage().instance().set(&DataKey::ZkVerifyingKey, &fixture_vk(env));
        env.storage().persistent().set(&DataKey::OracleZkKeyHash(oracle.clone()), &key_hash);
    });
}

#[test]
fn symbol_encoding_matches_the_oracle() {
    let env = Env::default();
    let typhoon = Symbol::new(&env, fx::TYPHOON);
    let region = Symbol::new(&env, fx::REGION);
    assert_eq!(symbol_to_field(&env, &typhoon), u256(&env, &fx::TYPHOON_FIELD));
    assert_eq!(symbol_to_field(&env, &region), u256(&env, &fx::REGION_FIELD));
}

#[test]
fn valid_proof_reaches_consensus() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));
    let typhoon = Symbol::new(&env, fx::TYPHOON);
    let region = Symbol::new(&env, fx::REGION);

    client.submit_weather_report_zk(&oracle, &typhoon, &region, &fx::DAMAGE, &fx::WIND_FLOOR, &fixture_proof(&env));

    assert_eq!(client.get_weather_report(&typhoon, &region, &oracle), fx::DAMAGE);
    env.as_contract(&contract_id, || {
        let reached: bool = env.storage().persistent().get(&DataKey::ConsensusReached(typhoon.clone(), region.clone())).unwrap();
        let wind: u32 = env.storage().persistent().get(&DataKey::OracleWindSpeed(typhoon.clone(), region.clone())).unwrap();
        assert!(reached);
        // Only the proven lower bound is stored, never the private reading.
        assert_eq!(wind, fx::WIND_FLOOR);
    });
}

#[test]
fn verification_fits_the_network_cpu_budget() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));
    env.cost_estimate().budget().reset_default();

    client.submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );

    let cpu = env.cost_estimate().budget().cpu_instruction_cost();
    std::println!("submit_weather_report_zk cpu instructions: {}", cpu);
    // Soroban's per-transaction limit is 100M instructions.
    assert!(cpu < 100_000_000, "verification used {} instructions", cpu);
}

#[test]
fn tampered_damage_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &100, // proof was generated for 85
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn inflated_wind_floor_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &200, // a higher band than the proof attests to
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn proof_cannot_be_replayed_for_another_region() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, "Luzon"),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn proof_from_an_unregistered_key_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    // The oracle address is registered to a different signing key.
    install_zk(&env, &contract_id, &oracle, U256::from_u32(&env, 12345));

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn swapped_proof_points_are_rejected() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));
    let mut proof = fixture_proof(&env);
    // A and C are both valid G1 points, so this reaches the pairing check.
    core::mem::swap(&mut proof.a, &mut proof.c);

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &proof,
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn malformed_proof_point_traps() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));
    let mut a = fx::PROOF_A;
    a[63] ^= 0x01; // no longer on the curve

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &Groth16Proof { a: BytesN::from_array(&env, &a), ..fixture_proof(&env) },
    );
    assert!(res.is_err(), "an off-curve point must not verify");
}

#[test]
fn unconfigured_verifier_is_rejected() {
    let (env, client, _contract_id, oracle) = setup();

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::ZkNotConfigured)));
}

#[test]
fn inactive_oracle_with_valid_proof_is_rejected() {
    let (env, client, contract_id, oracle) = setup();
    install_zk(&env, &contract_id, &oracle, u256(&env, &fx::ORACLE_KEY_HASH));
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(&DataKey::Oracle(oracle.clone()), &false);
    });

    let res = client.try_submit_weather_report_zk(
        &oracle,
        &Symbol::new(&env, fx::TYPHOON),
        &Symbol::new(&env, fx::REGION),
        &fx::DAMAGE,
        &fx::WIND_FLOOR,
        &fixture_proof(&env),
    );
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
}
