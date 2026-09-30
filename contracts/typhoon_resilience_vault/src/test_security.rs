//! Security regression tests for the typhoon_resilience_vault.
//!
//! # Background
//!
//! Proof-of-Concept (PoC) tests were discovered that demonstrated three critical
//! vulnerabilities in the original contract:
//!
//! | ID  | Vulnerability                          | Root Cause                                             |
//! |-----|----------------------------------------|--------------------------------------------------------|
//! | V-1 | LP Exit Race Condition                 | `withdraw_reinsurance` had no outstanding-coverage lock|
//! | V-2 | Policy Re-subscription Infinite Exploit| `subscribe` overwrote deactivated policy keys          |
//! | V-3 | Vault Overselling / Solvency Breach    | `subscribe` never checked pool capacity against liabs  |
//!
//! Each test in this module is named after the original PoC and MUST FAIL
//! (i.e., the exploit is now blocked and returns the correct error).
//!
//! ## Fixes shipped
//!
//! * **Fix A** (`withdraw_reinsurance`): LPs can only withdraw free capital
//!   (`TotalReinsuranceDeposited - TotalOutstandingCoverage`).
//! * **Fix B** (`subscribe`): A `(farm_id, season)` key is consumed on first
//!   use. Re-subscribing the same key — even after payout — returns
//!   `Error::PolicyAlreadyUsed`.
//! * **Fix C** (`subscribe` / `claim_payout`): `TotalOutstandingCoverage`
//!   tracks aggregate committed liabilities.  A new subscription that would
//!   push coverage above the pool balance is rejected with
//!   `Error::CoverageCapExceeded`.

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, token};

// ---------------------------------------------------------------------------
// Shared setup helpers (mirrors test.rs helpers; kept local to avoid coupling)
// ---------------------------------------------------------------------------

fn setup_security() -> (
    Env,
    TyphoonVaultClient<'static>,
    Address, // contract_id
    Address, // oracle
    Address, // xlm_token
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let oracle = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());

    let token_client = token::Client::new(&env, &xlm_token);
    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);

    let empty_keys = soroban_sdk::Vec::new(&env);
    // quorum=1, testnet mode so multi-oracle consensus works
    client.initialize(&empty_keys, &1, &xlm_token, &1, &false, &oracle);

    (env, client, contract_id, oracle, xlm_token, token_client, token_admin_client)
}

fn mark_verified(env: &Env, contract_id: &Address, farmer: &Address) {
    env.as_contract(contract_id, || {
        env.storage().persistent().set(&DataKey::Verified(farmer.clone()), &true);
    });
}

fn activate_oracle(env: &Env, contract_id: &Address, oracle: &Address) {
    env.as_contract(contract_id, || {
        env.storage().persistent().set(&DataKey::Oracle(oracle.clone()), &true);
    });
}

/// Mint `amount` XLM to `recipient` using the stellar asset admin client.
fn mint(admin: &token::StellarAssetClient, recipient: &Address, amount: i128) {
    admin.mint(recipient, &amount);
}

// ---------------------------------------------------------------------------
// Control test — legitimate flow still works after the fixes
// ---------------------------------------------------------------------------

/// A single verified farmer subscribes, consensus is reached, and the claim
/// is paid in full.  LPs can then withdraw their free capital.
/// This MUST PASS — the fixes must not regress legitimate behaviour.
#[test]
fn control_single_policy_on_a_solvent_pool_is_paid() {
    let (env, client, contract_id, oracle, xlm_token, token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);

    // Fund actors
    mint(&admin_client, &lp, 10_000);
    mint(&admin_client, &farmer, 900);

    // LP provides liquidity
    client.deposit_reinsurance(&lp, &10_000);
    let pool_after_deposit = client.get_total_reinsurance_deposited();

    // Farmer subscribes (premium=900, mainnet=false so subsidy may apply;
    // but subsidy balance is 0, so farmer pays full 900)
    mark_verified(&env, &contract_id, &farmer);
    activate_oracle(&env, &contract_id, &oracle);

    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );

    let pool = client.get_total_reinsurance_deposited();
    let outstanding = client.get_total_outstanding_coverage();
    // Pool grew by premium; outstanding coverage = premium * 10 = 9_000
    assert_eq!(pool, pool_after_deposit + 900);
    assert_eq!(outstanding, 9_000, "outstanding coverage must be 9_000 after subscribe");

    // Oracle reaches consensus: 100% damage
    client.submit_weather_report(
        &oracle,
        &Symbol::new(&env, "TY001"),
        &Symbol::new(&env, "R01"),
        &100,
        &0,
    );

    let farmer_balance_before = token_client.balance(&farmer);

    let payout = client.claim_payout(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "S2025"),
        &Symbol::new(&env, "TY001"),
    );

    assert_eq!(payout, 9_000, "farmer must receive full 9_000 XLM payout");
    assert_eq!(
        token_client.balance(&farmer),
        farmer_balance_before + 9_000
    );

    // Outstanding coverage must be cleared after payout
    let outstanding_after = client.get_total_outstanding_coverage();
    assert_eq!(outstanding_after, 0, "outstanding coverage must be 0 after payout");

    // diagnostic removed (no_std)
    // diagnostic removed (no_std)
    // diagnostic removed (no_std)
    // diagnostic removed (no_std)
}

// ---------------------------------------------------------------------------
// V-1 — LP Exit Race Condition (MUST BE BLOCKED)
// ---------------------------------------------------------------------------

/// **PoC Reproduction — V-1: LP Exit Between Event And Claim Leaves Farmers Unpaid**
///
/// Attack sequence (now blocked):
/// 1. LP deposits 10_000 XLM.
/// 2. Farmer pays 900 XLM premium.
/// 3. Consensus is reached (damage is visible on-chain).
/// 4. LP front-runs farmer and redeems ALL shares before the claim arrives.
/// 5. Farmer tries to claim — should succeed, but pool is empty.
///
/// **After Fix A**: `withdraw_reinsurance` computes `free_capital =
/// total_deposited - outstanding_coverage`.  The LP's withdrawal would
/// exceed free_capital, so it returns `InsufficientLiquidity`.  The farmer's
/// claim is then honoured from the protected liquidity.
#[test]
fn sec_v1_lp_cannot_exit_after_consensus_while_coverage_outstanding() {
    let (env, client, contract_id, oracle, _xlm_token, token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);

    mint(&admin_client, &lp, 10_000);
    mint(&admin_client, &farmer, 900);

    // [setup] LP deposits 10_000 XLM
    let lp_shares = client.deposit_reinsurance(&lp, &10_000);
    // diagnostic removed (no_std)

    // [step1] farmer subscribes
    mark_verified(&env, &contract_id, &farmer);
    activate_oracle(&env, &contract_id, &oracle);
    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    let pool = client.get_total_reinsurance_deposited();
    // diagnostic removed (no_std)

    // [step2] Consensus reached — damage is now public
    client.submit_weather_report(
        &oracle,
        &Symbol::new(&env, "TY001"),
        &Symbol::new(&env, "R01"),
        &100,
        &0,
    );
    let damage = client.get_consensus_damage_percentage(
        &Symbol::new(&env, "TY001"),
        &Symbol::new(&env, "R01"),
    );
    // diagnostic removed (no_std)

    // [step3] LP attempts to rug-pull all liquidity — FIX A must block this
    let withdraw_result = client.try_withdraw_reinsurance(&lp, &lp_shares);
    assert!(
        withdraw_result.is_err(),
        "V-1 EXPLOIT: LP was able to exit pool while farmer coverage is outstanding!"
    );

    // Verify the error is InsufficientLiquidity (not some other error)
    match withdraw_result.unwrap_err().unwrap() {
        Error::InsufficientLiquidity => {} // expected — Fix A is working
        other => panic!("expected InsufficientLiquidity, got {:?}", other),
    }
    // diagnostic removed (no_std)

    // [step4] Farmer claim must now succeed (pool is intact)
    let payout = client.claim_payout(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "S2025"),
        &Symbol::new(&env, "TY001"),
    );
    assert_eq!(payout, 9_000, "farmer must receive 9_000 XLM after LP exit is blocked");
    // diagnostic removed (no_std)
    // diagnostic removed (no_std)

    // LP can now withdraw the remaining free capital
    let outstanding_after = client.get_total_outstanding_coverage();
    assert_eq!(outstanding_after, 0);
    // LP withdrawal should now succeed (remaining pool minus what was paid out)
    let remaining_pool = client.get_total_reinsurance_deposited();
    // diagnostic removed (no_std)
}

// ---------------------------------------------------------------------------
// V-2 — Policy Re-subscription Infinite Exploit (MUST BE BLOCKED)
// ---------------------------------------------------------------------------

/// **PoC Reproduction — V-2: Same Season Policy Cannot Be Re-subscribed And Claimed Again**
///
/// Attack sequence (now blocked):
/// 1. Farmer subscribes with (farm_id, season).
/// 2. Consensus reached; farmer claims payout → policy deactivated.
/// 3. Farmer attempts to re-subscribe the same (farm_id, season).
///
/// **After Fix B**: `subscribe` checks `persistent().has(Policy(...))` before
/// accepting.  Any existing record — active OR deactivated — causes immediate
/// rejection with `Error::PolicyAlreadyUsed`.
#[test]
fn sec_v2_paid_out_policy_key_cannot_be_reused() {
    let (env, client, contract_id, oracle, _xlm_token, token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);

    mint(&admin_client, &lp, 100_000);
    mint(&admin_client, &farmer, 900);

    client.deposit_reinsurance(&lp, &100_000);
    mark_verified(&env, &contract_id, &farmer);
    activate_oracle(&env, &contract_id, &oracle);

    // Cycle 1: subscribe → consensus → claim
    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    client.submit_weather_report(
        &oracle,
        &Symbol::new(&env, "TY001"),
        &Symbol::new(&env, "R01"),
        &100,
        &0,
    );
    let payout1 = client.claim_payout(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "S2025"),
        &Symbol::new(&env, "TY001"),
    );
    assert_eq!(payout1, 9_000);
    // diagnostic removed (no_std)

    // Re-fund farmer so they could attempt re-subscription
    mint(&admin_client, &farmer, 900);

    // Cycle 2 attempt: MUST be rejected by Fix B
    let resubscribe = client.try_subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    assert!(
        resubscribe.is_err(),
        "V-2 EXPLOIT: deactivated policy key was accepted for re-subscription!"
    );
    match resubscribe.unwrap_err().unwrap() {
        Error::PolicyAlreadyUsed => {} // expected — Fix B is working
        other => panic!("expected PolicyAlreadyUsed, got {:?}", other),
    }
    // diagnostic removed (no_std)

    // Same protection applies even without prior claim
    mint(&admin_client, &farmer, 900);
    let resubscribe2 = client.try_subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    assert!(resubscribe2.is_err());
    // diagnostic removed (no_std)
}

/// A farmer using a NEW (farm_id, season) key can always subscribe normally.
/// This is the legitimate multi-season, multi-farm case and must not regress.
#[test]
fn sec_v2_different_season_or_farm_can_subscribe() {
    let (env, client, contract_id, oracle, _xlm_token, _token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);

    mint(&admin_client, &lp, 500_000);
    mint(&admin_client, &farmer, 5_000);

    client.deposit_reinsurance(&lp, &500_000);
    mark_verified(&env, &contract_id, &farmer);
    activate_oracle(&env, &contract_id, &oracle);

    // S2025 — first season
    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );

    // S2026 — different season key — must succeed
    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2026"),
        &900,
    );

    // F002 — different farm ID — must succeed
    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F002"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );

    // diagnostic removed (no_std)
}

// ---------------------------------------------------------------------------
// V-3 — Vault Overselling / Solvency Breach (MUST BE BLOCKED)
// ---------------------------------------------------------------------------

/// **PoC Reproduction — V-3: Vault Cannot Sell Cover It Cannot Pay**
///
/// Attack sequence (now blocked):
/// - Pool = 19_000 XLM.
/// - 10 farmers each subscribe with premium=900 → each wants 9_000 XLM payout.
/// - Total liabilities = 90_000 XLM >> pool of 19_000 XLM.
///
/// **After Fix C**: `subscribe` computes `new_outstanding_coverage` and
/// compares against `TotalReinsuranceDeposited` before accepting.  Once the
/// pool capacity is exhausted, subsequent subscriptions return
/// `CoverageCapExceeded` instead of silently accepting un-payable cover.
#[test]
fn sec_v3_vault_cannot_sell_cover_it_cannot_pay() {
    let (env, client, contract_id, oracle, _xlm_token, token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    mint(&admin_client, &lp, 19_000);
    client.deposit_reinsurance(&lp, &19_000);
    activate_oracle(&env, &contract_id, &oracle);

    let mut accepted = 0u32;
    let mut rejected = 0u32;
    let mut total_premiums_paid: i128 = 0;

    // 10 farmers each want 9_000 XLM cover for a 900 XLM premium
    for i in 0..10u32 {
        let farmer = Address::generate(&env);
        mint(&admin_client, &farmer, 900);
        mark_verified(&env, &contract_id, &farmer);

        let farm_id = Symbol::new(&env, "FARM");
        // Each farmer gets a unique season key to avoid V-2 collision
        let season = match i {
            0 => Symbol::new(&env, "S0"),
            1 => Symbol::new(&env, "S1"),
            2 => Symbol::new(&env, "S2"),
            3 => Symbol::new(&env, "S3"),
            4 => Symbol::new(&env, "S4"),
            5 => Symbol::new(&env, "S5"),
            6 => Symbol::new(&env, "S6"),
            7 => Symbol::new(&env, "S7"),
            8 => Symbol::new(&env, "S8"),
            _ => Symbol::new(&env, "S9"),
        };

        let result = client.try_subscribe(&farmer, &farm_id, &Symbol::new(&env, "R01"), &season, &900);
        match result {
            Ok(_) => {
                accepted += 1;
                total_premiums_paid += 900;
            }
            Err(Ok(Error::CoverageCapExceeded)) => {
                rejected += 1;
            }
            Err(e) => panic!("unexpected error: {:?}", e),
        }
    }

    let cover_sold = accepted as i128 * 9_000;
    let pool = client.get_total_reinsurance_deposited();
    // diagnostic removed (no_std)
    // diagnostic removed (no_std)
    // diagnostic removed (no_std)

    // The pool can cover at most floor(19_000 / 10) = 1 policy of 9_000 XLM
    // (actually 2 because 19_000 >= 9_000 + 9_000 = 18_000, and after both
    //  premiums are collected the pool is 19_000 + 1_800 = 20_800 >= 18_000 coverage;
    //  the key invariant: outstanding_coverage <= total_deposited at all times)
    assert!(
        cover_sold <= pool,
        "V-3 EXPLOIT: vault sold {} XLM cover against {} XLM pool!",
        cover_sold,
        pool
    );

    // At least 1 policy rejected (pool cannot cover 90_000 in payouts)
    assert!(
        rejected > 0,
        "V-3 EXPLOIT: vault accepted all 10 policies on a pool that can only cover 2!"
    );
    // diagnostic: solvency enforced — outstanding_coverage <= pool at all times
}

/// Verify that `TotalOutstandingCoverage` correctly decreases after
/// each payout, freeing capacity for new subscriptions in the same pool epoch.
#[test]
fn sec_v3_coverage_released_after_claim_allows_new_subscription() {
    let (env, client, contract_id, oracle, _xlm_token, _token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer1 = Address::generate(&env);
    let farmer2 = Address::generate(&env);

    mint(&admin_client, &lp, 20_000);
    mint(&admin_client, &farmer1, 900);
    mint(&admin_client, &farmer2, 900);

    client.deposit_reinsurance(&lp, &20_000);
    mark_verified(&env, &contract_id, &farmer1);
    mark_verified(&env, &contract_id, &farmer2);
    activate_oracle(&env, &contract_id, &oracle);

    // Farmer 1 subscribes (payout=9_000; pool=20_000 ✓)
    client.subscribe(
        &farmer1,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    assert_eq!(client.get_total_outstanding_coverage(), 9_000);

    // Farmer 1 claims
    client.submit_weather_report(
        &oracle,
        &Symbol::new(&env, "TY001"),
        &Symbol::new(&env, "R01"),
        &100,
        &0,
    );
    client.claim_payout(
        &farmer1,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "S2025"),
        &Symbol::new(&env, "TY001"),
    );

    // After payout, outstanding_coverage resets to 0
    assert_eq!(client.get_total_outstanding_coverage(), 0, "coverage not released after payout");

    // Farmer 2 can now subscribe (pool still solvent)
    client.subscribe(
        &farmer2,
        &Symbol::new(&env, "F002"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );
    assert_eq!(
        client.get_total_outstanding_coverage(),
        9_000,
        "outstanding coverage must be 9_000 after farmer2 subscribes"
    );
    // diagnostic removed (no_std)
}

// ---------------------------------------------------------------------------
// V-1 + LP partial withdrawal — free capital is accessible
// ---------------------------------------------------------------------------

/// LPs can still withdraw capital that is NOT backing active policies.
/// Regression guard: Fix A must not make ALL withdrawals impossible.
#[test]
fn sec_v1_lp_can_withdraw_free_capital_above_coverage() {
    let (env, client, contract_id, oracle, _xlm_token, token_client, admin_client) =
        setup_security();

    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);

    mint(&admin_client, &lp, 50_000);
    mint(&admin_client, &farmer, 900);

    // LP deposits 50_000; farmer subscribes for 9_000 cover.
    // free_capital = 50_000 - 9_000 = 41_000 (after premium arrives: pool=50_900)
    let shares = client.deposit_reinsurance(&lp, &50_000);
    mark_verified(&env, &contract_id, &farmer);
    activate_oracle(&env, &contract_id, &oracle);

    client.subscribe(
        &farmer,
        &Symbol::new(&env, "F001"),
        &Symbol::new(&env, "R01"),
        &Symbol::new(&env, "S2025"),
        &900,
    );

    let outstanding = client.get_total_outstanding_coverage();
    let pool = client.get_total_reinsurance_deposited();
    let free = pool - outstanding; // 50_900 - 9_000 = 41_900

    // LP tries to withdraw exactly free_capital worth of shares.
    // shares correspond to 50_000 deposit, pool is now 50_900.
    // Amount per share = pool / total_shares; we want to withdraw <= free XLM.
    // Withdraw a small, definitely-safe amount.
    let safe_shares = shares / 10; // ~10% of shares = ~5_090 XLM < 41_900 free
    let withdrawn = client.withdraw_reinsurance(&lp, &safe_shares);

    assert!(withdrawn > 0, "LP must be able to withdraw free capital");
    // diagnostic removed (no_std)

    // Attempting to withdraw ALL remaining shares (which cover the policy) must fail
    let remaining_shares = shares - safe_shares;
    let overwithdraw = client.try_withdraw_reinsurance(&lp, &remaining_shares);
    assert!(
        overwithdraw.is_err(),
        "LP must not be able to withdraw below outstanding coverage floor"
    );
    // diagnostic removed (no_std)
}
