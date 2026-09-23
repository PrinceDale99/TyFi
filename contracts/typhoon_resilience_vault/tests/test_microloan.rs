//! Integration tests for microloan security — Finding 2 (High) fixes.
//!
//! These tests verify the per-farmer loan cap, duplicate loan_id rejection,
//! repayment headroom restoration, and the previously-exploitable multi-call
//! drain pattern.  Farmer verification is set via legitimate admin multisig
//! (real signatures — no mocking of the auth layer).

mod helpers;
use helpers::{AdminKey, make_sigs};

use soroban_sdk::{
    testutils::Address as _, token, Address, BytesN, Env, Symbol, Vec,
};
use typhoon_resilience_vault::TyphoonVaultClient;

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

/// Shared test setup: 1-of-1 admin (K1 only), returns handles needed by tests.
fn setup(
    env: &Env,
) -> (
    TyphoonVaultClient<'static>,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    AdminKey,
    Address, // farmer
    Address, // lp
) {
    let k1 = AdminKey::from_seed(SEED_K1);

    let cid = env.register(typhoon_resilience_vault::TyphoonVault, ());
    let client = TyphoonVaultClient::new(env, &cid);

    let token_admin = Address::generate(env);
    let xlm = env.register_stellar_asset_contract(token_admin.clone());
    let xlm_client = token::Client::new(env, &xlm);
    let xlm_admin = token::StellarAssetClient::new(env, &xlm);

    let oracle = Address::generate(env);
    let farmer = Address::generate(env);
    let lp = Address::generate(env);

    let mut admin_keys: Vec<BytesN<32>> = Vec::new(env);
    admin_keys.push_back(k1.pub_key_bytes(env));

    // 1-of-1 multisig, mainnet mode = false (testnet, no single-oracle restriction)
    client.initialize(&admin_keys, &1, &xlm, &1, &false, &oracle);
    env.mock_all_auths();

    // Use real admin signature to verify the farmer.
    let n0 = client.admin_nonce();
    let sigs = make_sigs(env, b"verify_farmer", n0, &[&k1]);
    client.verify_farmer(&sigs, &farmer, &true);

    (client, xlm_client, xlm_admin, k1, farmer, lp)
}

// ---------------------------------------------------------------------------
// Cap enforcement
// ---------------------------------------------------------------------------

#[test]
fn loan_at_exactly_20pct_cap_succeeds() {
    let env = Env::default();
    let (client, token, xlm_admin, _k1, farmer, lp) = setup(&env);

    // Pool = 100_000; 20% cap = 20_000.
    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    let result = client.try_originate_microloan(
        &farmer,
        &Symbol::new(&env, "L0"),
        &20_000,
        &90,
    );
    assert!(result.is_ok(), "loan exactly at cap must succeed: {:?}", result);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 20_000);
}

#[test]
fn loan_one_over_cap_is_rejected() {
    let env = Env::default();
    let (client, token, xlm_admin, _k1, farmer, lp) = setup(&env);

    // Pool = 100_000; cap = 20_000.
    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    // First loan hits the cap exactly.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000, &90);

    // Any additional amount — even 1 — must be rejected.
    let result = client.try_originate_microloan(
        &farmer,
        &Symbol::new(&env, "L1"),
        &1,
        &90,
    );
    assert!(result.is_err(), "1 token over cap must be rejected");
    // Outstanding must not have changed.
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 20_000);
}

#[test]
fn previously_drainable_five_loan_pattern_is_blocked() {
    let env = Env::default();
    let (client, token, xlm_admin, _k1, farmer, lp) = setup(&env);

    // Replicate the exact drain scenario from poc_microloan_drain.rs:
    // pool = 100_000, five loans of 20_000 each.
    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    let loan_ids = ["L0", "L1", "L2", "L3", "L4"];
    let mut succeeded = 0u32;
    for id in loan_ids.iter() {
        let r = client.try_originate_microloan(
            &farmer,
            &Symbol::new(&env, id),
            &20_000,
            &90,
        );
        if r.is_ok() {
            succeeded += 1;
        }
    }

    // Only the first loan (20_000 = 20% of 100_000) is permitted.
    // Loans 2–5 must all fail — the pool is NOT drainable.
    assert_eq!(
        succeeded, 1,
        "only 1 of 5 loans should succeed; the rest must be rejected by the cap"
    );

    let pool_remaining = token.balance(&client.address);
    // Pool lost 20_000 (one loan), not 100_000.
    assert_eq!(
        pool_remaining, 80_000,
        "pool must retain 80_000 after the single permitted loan"
    );
}

// ---------------------------------------------------------------------------
// Repayment restores headroom
// ---------------------------------------------------------------------------

#[test]
fn full_repayment_restores_loan_headroom() {
    let env = Env::default();
    let (client, token, xlm_admin, _k1, farmer, lp) = setup(&env);

    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    // Borrow to cap.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000, &90);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 20_000);

    // Repay fully.
    xlm_admin.mint(&farmer, &20_000); // give back what was borrowed
    client.repay_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 0);

    // Should now be able to take another loan.
    let r = client.try_originate_microloan(
        &farmer,
        &Symbol::new(&env, "L1"),
        &20_000,
        &90,
    );
    assert!(r.is_ok(), "headroom restored after full repayment: {:?}", r);
}

#[test]
fn partial_repayment_increases_headroom_proportionally() {
    let env = Env::default();
    let (client, token, xlm_admin, _k1, farmer, lp) = setup(&env);

    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    // Borrow 20_000 (full cap).
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000, &90);

    // Repay 10_000 (half).
    xlm_admin.mint(&farmer, &10_000);
    client.repay_microloan(&farmer, &Symbol::new(&env, "L0"), &10_000);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 10_000);

    // Should be able to borrow another 10_000 (remaining headroom).
    // Note: pool has grown back by 10_000 on repay, so cap is recalculated.
    // Pool = 90_000 - 20_000 + 10_000 = 80_000 +10_000 repay = pool now has 80_000 tokens,
    // total_deposited also updated. Cap = 20% of total_deposited.
    // Total_deposited after: 100_000 - 20_000 + 10_000 = 90_000. Cap = 18_000.
    // Outstanding = 10_000. Headroom = 18_000 - 10_000 = 8_000.
    let r = client.try_originate_microloan(
        &farmer,
        &Symbol::new(&env, "L1"),
        &8_000,
        &90,
    );
    assert!(r.is_ok(), "should fit within recalculated headroom: {:?}", r);
}

// ---------------------------------------------------------------------------
// Duplicate loan_id rejected
// ---------------------------------------------------------------------------

#[test]
fn duplicate_active_loan_id_rejected() {
    let env = Env::default();
    let (client, _token, xlm_admin, _k1, farmer, lp) = setup(&env);

    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    let loan_id = Symbol::new(&env, "L0");
    client.originate_microloan(&farmer, &loan_id, &5_000, &90);

    // Same loan_id while still active — must fail.
    let r = client.try_originate_microloan(&farmer, &loan_id, &5_000, &90);
    assert!(r.is_err(), "duplicate active loan_id must be rejected");
}

#[test]
fn closed_loan_id_can_be_reused() {
    let env = Env::default();
    let (client, _token, xlm_admin, _k1, farmer, lp) = setup(&env);

    xlm_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    let loan_id = Symbol::new(&env, "L0");
    client.originate_microloan(&farmer, &loan_id, &5_000, &90);

    // Repay the full loan.
    xlm_admin.mint(&farmer, &5_000);
    client.repay_microloan(&farmer, &loan_id, &5_000);

    // loan is now inactive — same ID can be reused.
    let r = client.try_originate_microloan(&farmer, &loan_id, &5_000, &90);
    assert!(r.is_ok(), "closed loan_id must be reusable: {:?}", r);
}

// ---------------------------------------------------------------------------
// Cap scales with pool size
// ---------------------------------------------------------------------------

#[test]
fn cap_is_recalculated_against_current_pool_size() {
    let env = Env::default();
    let (client, _token, xlm_admin, k1, farmer, lp) = setup(&env);

    // Start with a small pool.
    xlm_admin.mint(&lp, &10_000);
    client.deposit_reinsurance(&lp, &10_000);

    // Cap = 20% of 10_000 = 2_000. Borrow 2_000 — succeeds.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &2_000, &90);

    // Repay so headroom is restored.
    xlm_admin.mint(&farmer, &2_000);
    client.repay_microloan(&farmer, &Symbol::new(&env, "L0"), &2_000);

    // A second LP deposits, growing the pool to ~20_000.
    let lp2 = Address::generate(&env);
    xlm_admin.mint(&lp2, &10_000);
    client.deposit_reinsurance(&lp2, &10_000);

    // Cap is now 20% of ~20_000 = 4_000. A 4_000 loan should succeed.
    let r = client.try_originate_microloan(
        &farmer,
        &Symbol::new(&env, "L1"),
        &4_000,
        &90,
    );
    assert!(r.is_ok(), "cap should grow with pool: {:?}", r);
}
