//! Integration tests for the admin multisig — Finding 1 (Critical) fixes.
//!
//! All tests in this file run the PRODUCTION `require_multisig_auth` because
//! integration tests in `tests/` compile the crate as a library (cfg(test)
//! is false inside the crate), so the real production path runs end-to-end.
//!
//! Every admin call here uses a real ed25519 keypair and a real signature
//! constructed over the contract's canonical message format:
//!
//!   `sha256( nonce_be_8_bytes || fn_name_bytes )`
//!
//! No mock bypasses. If a test passes, the crypto verified correctly.

mod helpers;
use helpers::{AdminKey, make_sigs};

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};
use typhoon_resilience_vault::TyphoonVaultClient;

// Three deterministic test admin seeds.
const SEED_K1: [u8; 32] = [
    0x8a,0x88,0xe3,0xdd,0x74,0x09,0xf1,0x95,
    0xfd,0x52,0xdb,0x2d,0x3c,0xba,0x5d,0x72,
    0xca,0x67,0x09,0xbf,0x1d,0x94,0x12,0x1b,
    0xf3,0x74,0x88,0x01,0xb4,0x0f,0x6f,0x5c,
];
const SEED_K2: [u8; 32] = [
    0x81,0x39,0x77,0x0e,0xa8,0x7d,0x17,0x5f,
    0x56,0xa3,0x54,0x66,0xc3,0x4c,0x7e,0xcc,
    0xcb,0x8d,0x8a,0x91,0xb4,0xee,0x37,0xa2,
    0x5d,0xf6,0x0f,0x5b,0x8f,0xc9,0xb3,0x94,
];
const SEED_K3: [u8; 32] = [
    0xed,0x49,0x28,0xc6,0x28,0xd1,0xc2,0xc6,
    0xea,0xe9,0x03,0x38,0x90,0x59,0x95,0x61,
    0x29,0x59,0x27,0x3a,0x5c,0x63,0xf9,0x36,
    0x36,0xc1,0x46,0x14,0xac,0x87,0x37,0xd1,
];

/// Set up a 2-of-3 multisig vault and return the client plus the three admin keys.
fn setup_2of3(
    env: &Env,
) -> (TyphoonVaultClient<'static>, Address, AdminKey, AdminKey, AdminKey) {
    let k1 = AdminKey::from_seed(SEED_K1);
    let k2 = AdminKey::from_seed(SEED_K2);
    let k3 = AdminKey::from_seed(SEED_K3);

    let cid = env.register(typhoon_resilience_vault::TyphoonVault, ());
    let client = TyphoonVaultClient::new(env, &cid);

    let xlm = Address::generate(env);
    let oracle = Address::generate(env);

    let mut keys: Vec<BytesN<32>> = Vec::new(env);
    keys.push_back(k1.pub_key_bytes(env));
    keys.push_back(k2.pub_key_bytes(env));
    keys.push_back(k3.pub_key_bytes(env));

    // threshold = 2, quorum = 2, mainnet = true
    client.initialize(&keys, &2, &xlm, &2, &true, &oracle);
    env.mock_all_auths();

    (client, cid, k1, k2, k3)
}

// ---------------------------------------------------------------------------
// Positive path: correct signatures are accepted
// ---------------------------------------------------------------------------

#[test]
fn admin_call_with_valid_2of3_signatures_succeeds() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);
    let new_oracle = Address::generate(&env);

    let nonce = client.admin_nonce();
    let sigs = make_sigs(&env, b"set_single_oracle", nonce, &[&k1, &k2]);

    let result = client.try_set_single_oracle(&sigs, &new_oracle);
    assert!(result.is_ok(), "2-of-3 valid signatures must be accepted: {:?}", result);

    // Nonce must have advanced.
    assert_eq!(client.admin_nonce(), nonce + 1);
}

// ---------------------------------------------------------------------------
// Duplicate-signer bypass (Finding 1-B) — must be REJECTED
// ---------------------------------------------------------------------------

#[test]
fn duplicate_signer_cannot_satisfy_threshold() {
    let env = Env::default();
    let (client, _cid, k1, _k2, _k3) = setup_2of3(&env);
    let attacker_oracle = Address::generate(&env);

    // threshold = 2; K1 submitted twice.  Before the fix this would return Ok.
    let nonce = client.admin_nonce();
    let msg = helpers::build_message(nonce, b"set_single_oracle");
    let sig1 = helpers::sign(&env, &k1, &msg);
    let pub1 = k1.pub_key_bytes(&env);

    let mut dup_sigs: Vec<(BytesN<32>, soroban_sdk::BytesN<64>)> = Vec::new(&env);
    dup_sigs.push_back((pub1.clone(), sig1.clone()));
    dup_sigs.push_back((pub1.clone(), sig1.clone())); // same key twice

    let result = client.try_set_single_oracle(&dup_sigs, &attacker_oracle);
    assert!(
        result.is_err(),
        "duplicate signer must NOT satisfy threshold-2: got Ok instead of Err"
    );
    // Nonce must NOT have advanced (auth failed before increment).
    assert_eq!(client.admin_nonce(), nonce, "nonce must not change on failed auth");
}

// ---------------------------------------------------------------------------
// Cross-function replay (Finding 1-A) — signatures for fn A must not work for fn B
// ---------------------------------------------------------------------------

#[test]
fn signatures_for_set_oracle_cannot_be_replayed_into_set_single_oracle() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);

    // Step 1 — perform a legitimate set_oracle call with valid signatures.
    let nonce_before = client.admin_nonce();
    let sigs_for_set_oracle = make_sigs(&env, b"set_oracle", nonce_before, &[&k1, &k2]);
    let legit_oracle = Address::generate(&env);
    let r1 = client.try_set_oracle(&sigs_for_set_oracle, &legit_oracle, &true);
    assert!(r1.is_ok(), "legitimate set_oracle call must succeed");
    let nonce_after = client.admin_nonce();
    assert_eq!(nonce_after, nonce_before + 1);

    // Step 2 — attempt to replay the SAME signatures (now stale nonce) into
    // set_single_oracle with the attacker's address.
    // The nonce has advanced, so the message hash no longer matches.
    let attacker = Address::generate(&env);
    let r2 = client.try_set_single_oracle(&sigs_for_set_oracle, &attacker);
    assert!(
        r2.is_err(),
        "replaying stale set_oracle signatures into set_single_oracle must fail"
    );
    assert_eq!(client.admin_nonce(), nonce_after, "nonce must not change on replay attempt");
}

#[test]
fn fresh_signatures_for_wrong_function_name_are_rejected() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);

    // Build signatures with the CORRECT nonce but for the WRONG function name.
    let nonce = client.admin_nonce();
    let sigs_wrong_fn = make_sigs(&env, b"set_oracle", nonce, &[&k1, &k2]);

    // Try to use them for set_single_oracle (different fn_name in the message).
    let attacker = Address::generate(&env);
    let result = client.try_set_single_oracle(&sigs_wrong_fn, &attacker);
    assert!(
        result.is_err(),
        "signatures for a different fn_name must be rejected even with the correct nonce"
    );
    assert_eq!(client.admin_nonce(), nonce);
}

// ---------------------------------------------------------------------------
// Nonce increment prevents any replay of the same (fn_name, nonce) pair
// ---------------------------------------------------------------------------

#[test]
fn same_signatures_cannot_be_used_twice() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);
    let oracle_addr = Address::generate(&env);

    // First call — should succeed.
    let nonce = client.admin_nonce();
    let sigs = make_sigs(&env, b"set_oracle", nonce, &[&k1, &k2]);
    let r1 = client.try_set_oracle(&sigs, &oracle_addr, &true);
    assert!(r1.is_ok(), "first call must succeed");

    // Second call with the identical signature vector — nonce has advanced, must fail.
    let r2 = client.try_set_oracle(&sigs, &oracle_addr, &true);
    assert!(r2.is_err(), "replaying the same signatures must be rejected");
}

// ---------------------------------------------------------------------------
// Threshold enforcement: fewer than required signatures must fail
// ---------------------------------------------------------------------------

#[test]
fn zero_signatures_rejected_for_threshold_2() {
    let env = Env::default();
    let (client, _cid, _k1, _k2, _k3) = setup_2of3(&env);
    let oracle = Address::generate(&env);

    let empty: Vec<(BytesN<32>, soroban_sdk::BytesN<64>)> = Vec::new(&env);
    let result = client.try_set_single_oracle(&empty, &oracle);
    assert!(result.is_err(), "0 signatures must be rejected");
}

#[test]
fn one_signature_rejected_for_threshold_2() {
    let env = Env::default();
    let (client, _cid, k1, _k2, _k3) = setup_2of3(&env);
    let oracle = Address::generate(&env);

    let nonce = client.admin_nonce();
    let sigs = make_sigs(&env, b"set_single_oracle", nonce, &[&k1]);
    let result = client.try_set_single_oracle(&sigs, &oracle);
    assert!(result.is_err(), "1-of-3 must not satisfy threshold 2");
}

// ---------------------------------------------------------------------------
// Nonce advances sequentially across different admin functions
// ---------------------------------------------------------------------------

#[test]
fn nonce_advances_independently_per_call() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);
    let oracle1 = Address::generate(&env);
    let oracle2 = Address::generate(&env);

    assert_eq!(client.admin_nonce(), 0);

    let sigs0 = make_sigs(&env, b"set_oracle", 0, &[&k1, &k2]);
    client.set_oracle(&sigs0, &oracle1, &true);
    assert_eq!(client.admin_nonce(), 1);

    let sigs1 = make_sigs(&env, b"set_single_oracle", 1, &[&k1, &k2]);
    client.set_single_oracle(&sigs1, &oracle2);
    assert_eq!(client.admin_nonce(), 2);
}

// ---------------------------------------------------------------------------
// Verify farmer + full payout chain with real multisig (end-to-end)
// ---------------------------------------------------------------------------

#[test]
fn full_admin_multisig_to_payout_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let k1 = AdminKey::from_seed(SEED_K1);
    let k2 = AdminKey::from_seed(SEED_K2);
    let k3 = AdminKey::from_seed(SEED_K3);

    let cid = env.register(typhoon_resilience_vault::TyphoonVault, ());
    let client = TyphoonVaultClient::new(&env, &cid);

    let token_admin = Address::generate(&env);
    let xlm = env.register_stellar_asset_contract(token_admin.clone());
    let xlm_client = soroban_sdk::token::Client::new(&env, &xlm);
    let xlm_admin = soroban_sdk::token::StellarAssetClient::new(&env, &xlm);

    let oracle = Address::generate(&env);
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    let mut admin_keys: Vec<BytesN<32>> = Vec::new(&env);
    admin_keys.push_back(k1.pub_key_bytes(&env));
    admin_keys.push_back(k2.pub_key_bytes(&env));
    admin_keys.push_back(k3.pub_key_bytes(&env));

    // Initialize: 2-of-3, mainnet mode, oracle as single oracle.
    client.initialize(&admin_keys, &2, &xlm, &2, &true, &oracle);

    // Fund pool and farmer.
    xlm_admin.mint(&lp, &50_000);
    client.deposit_reinsurance(&lp, &50_000);

    xlm_admin.mint(&farmer, &1_000);

    // --- Admin: verify farmer (nonce = 0) ---
    let n0 = client.admin_nonce();
    let sigs_verify = make_sigs(&env, b"verify_farmer", n0, &[&k1, &k2]);
    client.verify_farmer(&sigs_verify, &farmer, &true);
    assert!(client.is_farmer_verified(&farmer));
    assert_eq!(client.admin_nonce(), 1);

    // Subscribe.
    let farm_id = soroban_sdk::Symbol::new(&env, "FarmA");
    let region = soroban_sdk::Symbol::new(&env, "Luzon");
    let season = soroban_sdk::Symbol::new(&env, "Wet2026");
    let typhoon = soroban_sdk::Symbol::new(&env, "Tisoy");
    client.subscribe(&farmer, &farm_id, &region, &season, &1_000);

    // Single oracle submits 80% damage.
    client.submit_weather_report(&oracle, &typhoon, &region, &80, &140);
    assert_eq!(client.get_consensus_damage_percentage(&typhoon, &region), Some(80));

    // Claim payout: 80% of (1_000 * 10) = 8_000.
    let payout = client.claim_payout(&farmer, &farm_id, &season, &typhoon);
    assert_eq!(payout, 8_000);
}

#[test]
fn upgrade_multisig_auth_enforced() {
    let env = Env::default();
    let (client, _cid, k1, k2, _k3) = setup_2of3(&env);
    let dummy_hash = BytesN::from_array(&env, &[0x42u8; 32]);

    // 1. Unsigned upgrade fails
    let empty: Vec<(BytesN<32>, soroban_sdk::BytesN<64>)> = Vec::new(&env);
    let r1 = client.try_upgrade(&empty, &dummy_hash);
    assert!(r1.is_err(), "upgrade without signatures must fail");

    // 2. Wrong function name signature fails
    let nonce = client.admin_nonce();
    let wrong_sigs = make_sigs(&env, b"set_oracle", nonce, &[&k1, &k2]);
    let r2 = client.try_upgrade(&wrong_sigs, &dummy_hash);
    assert!(r2.is_err(), "upgrade with mismatched fn signatures must fail");

    // 3. Single signature fails threshold 2
    let single_sig = make_sigs(&env, b"upgrade", nonce, &[&k1]);
    let r3 = client.try_upgrade(&single_sig, &dummy_hash);
    assert!(r3.is_err(), "upgrade with single signature must fail 2-of-3 threshold");
}
