//! Admin multisig configuration: zero-threshold vaults must not accept
//! unsigned admin calls, and key rotation is quorum-gated.

mod helpers;
use helpers::{make_sigs, AdminKey};

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Symbol, Vec};
use typhoon_resilience_vault::{AdminMultisig, DataKey, Error, PayoutBand, TyphoonVault, TyphoonVaultClient};

const SEED_A: [u8; 32] = [0x11; 32];
const SEED_B: [u8; 32] = [0x22; 32];

fn deploy(env: &Env) -> (TyphoonVaultClient<'static>, Address) {
    let cid = env.register(TyphoonVault, ());
    (TyphoonVaultClient::new(env, &cid), cid)
}

fn keys(env: &Env, admins: &[&AdminKey]) -> Vec<BytesN<32>> {
    let mut v = Vec::new(env);
    for k in admins {
        v.push_back(k.pub_key_bytes(env));
    }
    v
}

fn no_sigs(env: &Env) -> Vec<(BytesN<32>, BytesN<64>)> {
    Vec::new(env)
}

/// Recreates the state of vaults initialized before threshold validation.
fn force_legacy_zero_threshold(env: &Env, cid: &Address) {
    env.as_contract(cid, || {
        env.storage().instance().set(&DataKey::AdminMultisig, &AdminMultisig { keys: Vec::new(env), threshold: 0 });
    });
}

#[test]
fn initialize_rejects_zero_threshold() {
    let env = Env::default();
    let (client, _) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    let r = client.try_initialize(&keys(&env, &[&a]), &0, &Address::generate(&env), &1, &false, &Address::generate(&env));
    assert_eq!(r, Err(Ok(Error::InsufficientSignatures)));
}

#[test]
fn initialize_rejects_threshold_above_key_count() {
    let env = Env::default();
    let (client, _) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    let r = client.try_initialize(&keys(&env, &[&a]), &2, &Address::generate(&env), &1, &false, &Address::generate(&env));
    assert_eq!(r, Err(Ok(Error::InsufficientSignatures)));
}

#[test]
fn zero_threshold_vault_fails_closed_for_admin_calls() {
    let env = Env::default();
    let (client, cid) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    client.initialize(&keys(&env, &[&a]), &1, &Address::generate(&env), &1, &false, &Address::generate(&env));
    force_legacy_zero_threshold(&env, &cid);

    // Previously 0 >= 0 let these through with no signatures at all.
    assert_eq!(client.try_set_oracle(&no_sigs(&env), &Address::generate(&env), &true), Err(Ok(Error::Unauthorized)));
    assert_eq!(client.try_upgrade(&no_sigs(&env), &BytesN::from_array(&env, &[0x42; 32])), Err(Ok(Error::Unauthorized)));
}

#[test]
fn legacy_zero_threshold_can_be_repaired_once_then_needs_quorum() {
    let env = Env::default();
    let (client, cid) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    let b = AdminKey::from_seed(SEED_B);
    client.initialize(&keys(&env, &[&a]), &1, &Address::generate(&env), &1, &false, &Address::generate(&env));
    force_legacy_zero_threshold(&env, &cid);

    client.rotate_admin_multisig(&no_sigs(&env), &keys(&env, &[&a]), &1);
    assert_eq!(client.get_admin_multisig(), Some(AdminMultisig { keys: keys(&env, &[&a]), threshold: 1 }));

    // The unsigned path is gone once a real threshold is set.
    let hijack = client.try_rotate_admin_multisig(&no_sigs(&env), &keys(&env, &[&b]), &1);
    assert_eq!(hijack, Err(Ok(Error::InsufficientSignatures)));

    // And the restored key can now authorize admin calls.
    let sigs = make_sigs(&env, b"set_oracle", client.admin_nonce(), &[&a]);
    client.set_oracle(&sigs, &Address::generate(&env), &true);
}

#[test]
fn rotation_requires_current_quorum_and_valid_new_config() {
    let env = Env::default();
    let (client, _) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    let b = AdminKey::from_seed(SEED_B);
    client.initialize(&keys(&env, &[&a]), &1, &Address::generate(&env), &1, &false, &Address::generate(&env));

    // A new config with threshold 0 is rejected even with valid signatures.
    let sigs = make_sigs(&env, b"rotate_admin_multisig", client.admin_nonce(), &[&a]);
    assert_eq!(client.try_rotate_admin_multisig(&sigs, &keys(&env, &[&b]), &0), Err(Ok(Error::InsufficientSignatures)));

    // A signature from the incoming key does not count; only the current set does.
    let wrong = make_sigs(&env, b"rotate_admin_multisig", client.admin_nonce(), &[&b]);
    assert_eq!(client.try_rotate_admin_multisig(&wrong, &keys(&env, &[&b]), &1), Err(Ok(Error::InsufficientSignatures)));

    let sigs = make_sigs(&env, b"rotate_admin_multisig", client.admin_nonce(), &[&a]);
    client.rotate_admin_multisig(&sigs, &keys(&env, &[&a, &b]), &2);
    assert_eq!(client.get_admin_multisig().unwrap().threshold, 2);
}

#[test]
fn invalid_parametric_bands_are_rejected_with_valid_signatures() {
    let env = Env::default();
    let (client, _) = deploy(&env);
    let a = AdminKey::from_seed(SEED_A);
    client.initialize(&keys(&env, &[&a]), &1, &Address::generate(&env), &1, &false, &Address::generate(&env));

    let mut bands = Vec::new(&env);
    bands.push_back(PayoutBand { min_wind_speed: 100, payout_percentage: 120 }); // > 100%

    let sigs = make_sigs(&env, b"update_parametric_bands", client.admin_nonce(), &[&a]);
    let r = client.try_update_parametric_bands(&sigs, &Symbol::new(&env, "Luzon"), &bands);
    assert_eq!(r, Err(Ok(Error::InvalidAmount)));
}
