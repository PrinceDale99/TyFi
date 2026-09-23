use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, token};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/// Creates a minimal test environment with the vault initialized.
///
/// Admin keys and threshold are irrelevant for these unit tests because we
/// bypass the multisig entirely by writing directly to contract storage via
/// `env.as_contract()`.  Real multisig auth is exercised in the integration
/// tests under `tests/`.
fn setup() -> (Env, TyphoonVaultClient<'static>, Address, Address, Address, token::Client<'static>, token::StellarAssetClient<'static>) {
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let oracle = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());

    let token_client = token::Client::new(&env, &xlm_token);
    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);

    // Initialize with an empty key list — the threshold is irrelevant for
    // unit tests because we never call admin functions through the client.
    // quorum=1: a single oracle report is enough for these business-logic tests.
    let empty_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&empty_keys, &1, &xlm_token, &1, &false, &oracle);

    (env, client, contract_id, oracle, xlm_token, token_client, token_admin_client)
}

/// Directly marks a farmer as verified in storage, bypassing multisig.
/// This is the correct unit-test pattern: we are testing business logic,
/// not the auth layer (which has its own integration tests).
fn set_farmer_verified(env: &Env, contract_id: &Address, farmer: &Address, verified: bool) {
    env.as_contract(contract_id, || {
        env.storage()
            .persistent()
            .set(&DataKey::Verified(farmer.clone()), &verified);
    });
}

/// Directly marks an oracle as active in storage, bypassing multisig.
fn set_oracle_active(env: &Env, contract_id: &Address, oracle: &Address, active: bool) {
    env.as_contract(contract_id, || {
        env.storage()
            .persistent()
            .set(&DataKey::Oracle(oracle.clone()), &active);
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_successful_payout_with_subsidy() {
    // This test specifically exercises two-oracle quorum (quorum=2).
    // It self-initializes rather than using setup() which uses quorum=1.
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let oracle = Address::generate(&env);
    let oracle2 = Address::generate(&env);
    let farmer = Address::generate(&env);
    let donor = Address::generate(&env);
    let lp = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin_addr.clone());
    let token = token::Client::new(&env, &xlm_token);
    let token_admin = token::StellarAssetClient::new(&env, &xlm_token);

    let typhoon_id = Symbol::new(&env, "Yolanda");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    // quorum=2: two distinct oracle reports needed before consensus is reached.
    let empty_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&empty_keys, &1, &xlm_token, &2, &false, &oracle);

    env.mock_all_auths();

    // Set oracle and farmer status directly in storage (bypassing multisig).
    set_oracle_active(&env, &contract_id, &oracle, true);
    set_oracle_active(&env, &contract_id, &oracle2, true);
    set_farmer_verified(&env, &contract_id, &farmer, true);
    assert!(client.is_farmer_verified(&farmer));

    // Deposit Premium Subsidy from Donor
    token_admin.mint(&donor, &1000);
    client.deposit_subsidy(&donor, &1000);
    assert_eq!(client.get_subsidy_balance(), 1000);

    // Deposit Reinsurance Liquidity
    token_admin.mint(&lp, &10000);
    client.deposit_reinsurance(&lp, &5000);
    assert_eq!(client.get_total_reinsurance_deposited(), 5000);
    assert_eq!(client.get_lp_shares(&lp), 5000);

    // Subscribe Farmer
    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // With 50% premium subsidy:
    // - Farmer pays 100
    // - Subsidy pool pays 100 (balance becomes 900)
    // - Total reinsurance deposited increases to 5000 + 200 = 5200
    assert_eq!(token.balance(&farmer), 100);
    assert_eq!(client.get_subsidy_balance(), 900);
    assert_eq!(client.get_total_reinsurance_deposited(), 5200);

    // Verify policy is active
    let policy = client.get_farm_policy(&farmer, &farm_id, &season).unwrap();
    assert!(policy.is_active);
    assert_eq!(policy.premium, 200);
    assert_eq!(policy.payout_amount, 2000);

    // Submit damage reports — quorum=2 means first report does NOT reach consensus.
    client.submit_weather_report(&oracle, &typhoon_id, &region, &100, &150);
    assert_eq!(client.get_consensus_damage_percentage(&typhoon_id, &region), None,
        "quorum=2: first report must not yet establish consensus");

    client.submit_weather_report(&oracle2, &typhoon_id, &region, &100, &150);
    assert_eq!(client.get_consensus_damage_percentage(&typhoon_id, &region), Some(100),
        "quorum=2: second report establishes consensus at average 100%");

    // Claim parametric payout (100% damage = 100% payout = 2000 tokens)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // Farmer: 100 (remaining) + 2000 (payout) = 2100 tokens
    assert_eq!(token.balance(&farmer), 2100);

    // Policy should now be inactive
    let updated_policy = client.get_farm_policy(&farmer, &farm_id, &season).unwrap();
    assert!(!updated_policy.is_active);
}

#[test]
fn test_yield_bearing_reinsurance_pool() {
    let (env, client, contract_id, oracle, xlm_token, token, token_admin) = setup();
    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);
    let farm_id = Symbol::new(&env, "Farm1");
    let region = Symbol::new(&env, "Luzon");
    let season = Symbol::new(&env, "Dry2026");

    env.mock_all_auths();

    // Mint stablecoins and deposit reinsurance
    token_admin.mint(&lp, &1000);
    client.deposit_reinsurance(&lp, &1000);

    assert_eq!(client.get_lp_shares(&lp), 1000);
    assert_eq!(client.get_total_reinsurance_deposited(), 1000);

    // Subscribe farmer without subsidy (subsidy pool is empty)
    set_farmer_verified(&env, &contract_id, &farmer, true);
    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Reinsurance pool deposited is now 1200 due to premium accrual
    assert_eq!(client.get_total_reinsurance_deposited(), 1200);

    // LP withdraws their shares
    client.withdraw_reinsurance(&lp, &1000);

    // LP should receive their original 1000 + 200 yield = 1200 tokens
    assert_eq!(token.balance(&lp), 1200);
    assert_eq!(client.get_lp_shares(&lp), 0);
}

#[test]
fn test_sliding_scale_damage_curve() {
    let (env, client, contract_id, oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    let typhoon_id = Symbol::new(&env, "Odette");
    let region = Symbol::new(&env, "Visayas");
    let farm_id = Symbol::new(&env, "Farm2");
    let season = Symbol::new(&env, "Wet2026");

    env.mock_all_auths();

    set_oracle_active(&env, &contract_id, &oracle, true);
    set_farmer_verified(&env, &contract_id, &farmer, true);

    // Reinsurance deposit to back payouts
    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    // Subscribe farmer
    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Report 30% damage -> matches 30% payout
    client.submit_weather_report(&oracle, &typhoon_id, &region, &30, &90);

    // Claim payout
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // 30% of 2000 payout_amount is 600 tokens.
    assert_eq!(token.balance(&farmer), 600);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_unverified_farmer_subscription_fails() {
    let (env, client, _contract_id, _oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);

    env.mock_all_auths();

    token_admin.mint(&farmer, &200);

    // Farmer is not verified under RSBSA, subscription must fail
    client.subscribe(&farmer, &Symbol::new(&env, "Farm1"), &Symbol::new(&env, "Luzon"), &Symbol::new(&env, "Wet2026"), &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_low_wind_speed_no_payout() {
    let (env, client, contract_id, oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "Egay");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    env.mock_all_auths();

    set_oracle_active(&env, &contract_id, &oracle, true);
    set_farmer_verified(&env, &contract_id, &farmer, true);

    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Report 0% damage (below threshold)
    client.submit_weather_report(&oracle, &typhoon_id, &region, &0, &0);

    // Claim payout should fail with ThresholdNotMet (Contract error 6)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_double_payout_prevention() {
    let (env, client, contract_id, oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "Pepito");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    env.mock_all_auths();

    set_oracle_active(&env, &contract_id, &oracle, true);
    set_farmer_verified(&env, &contract_id, &farmer, true);

    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    client.submit_weather_report(&oracle, &typhoon_id, &region, &100, &150);

    // First payout claim succeeds
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // Second payout claim on same policy must fail with PolicyNotActive (Contract error 5)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);
}

#[test]
fn test_mainnet_mode_strict_threshold() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let oracle = Address::generate(&env);
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "MainnetTyphoon");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());
    let token = token::Client::new(&env, &xlm_token);
    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);

    // Initialize with is_mainnet_mode = true and oracle as the single oracle
    let empty_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&empty_keys, &1, &xlm_token, &1, &true, &oracle);

    env.mock_all_auths();

    // Set farmer verified directly in storage
    set_farmer_verified(&env, &contract_id, &farmer, true);

    // Deposit liquidity to backing pool
    token_admin_client.mint(&lp, &10000);
    client.deposit_reinsurance(&lp, &5000);

    // Subscribe farmer
    token_admin_client.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Single authorized oracle submits 75% damage report
    client.submit_weather_report(&oracle, &typhoon_id, &region, &75, &130);

    // Claim payout
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // 75% damage = 75% payout = 1500 tokens
    assert_eq!(token.balance(&farmer), 1500);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_invalid_damage_percentage_rejected() {
    let (env, client, _contract_id, oracle, xlm_token, _token, _token_admin) = setup();
    let typhoon_id = Symbol::new(&env, "SuperTyphoon");
    let region = Symbol::new(&env, "Luzon");

    env.mock_all_auths();

    // damage_percentage > 100 must be rejected with InvalidAmount (#7)
    client.submit_weather_report(&oracle, &typhoon_id, &region, &150, &200);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_consensus_cannot_be_overwritten() {
    let (env, client, contract_id, oracle, _xlm_token, _token, _token_admin) = setup();
    let typhoon_id = Symbol::new(&env, "TyphoonX");
    let region = Symbol::new(&env, "Luzon");

    env.mock_all_auths();

    // Mark oracle as active (testnet mode requires authorized oracle).
    set_oracle_active(&env, &contract_id, &oracle, true);

    // First report establishes consensus
    client.submit_weather_report(&oracle, &typhoon_id, &region, &80, &140);
    assert_eq!(client.get_consensus_damage_percentage(&typhoon_id, &region), Some(80));

    // Second report must fail with AlreadyInitialized (#1) to prevent consensus overwrite
    client.submit_weather_report(&oracle, &typhoon_id, &region, &90, &160);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_invalid_parametric_bands_rejected() {
    let (env, client, contract_id, _oracle, xlm_token, _token, _token_admin) = setup();
    let region = Symbol::new(&env, "Luzon");

    env.mock_all_auths();

    // Directly set parametric bands via storage to bypass multisig in unit test,
    // but the validation happens inside update_parametric_bands so we still
    // want to exercise the entrypoint.  Use direct storage write for the
    // multisig state so the function can pass auth, then call normally.
    // Because the #[cfg(test)] stub is gone, we write the admin nonce and
    // an empty threshold so the multisig produces a clean rejection path
    // through invalid bands rather than InsufficientSignatures.
    //
    // The correct way to unit-test admin input validation without real sigs
    // is to write the bands directly and assert the contract rejects them.
    // We write a band with payout_percentage > 100 via contract storage and
    // then call claim_payout which would read it — but that's convoluted.
    //
    // Instead, initialize with threshold=0 so auth always passes in this
    // edge-case unit test (threshold=0 means verified_count(0) >= threshold(0)).
    let env2 = Env::default();
    let cid2 = env2.register_contract(None, TyphoonVault);
    let c2 = TyphoonVaultClient::new(&env2, &cid2);
    let empty_keys = soroban_sdk::Vec::new(&env2);
    let tok_admin = Address::generate(&env2);
    let xlm2 = env2.register_stellar_asset_contract(tok_admin.clone());
    let oracle2 = Address::generate(&env2);
    // threshold = 0: no signatures needed (empty list satisfies 0 >= 0)
    c2.initialize(&empty_keys, &0, &xlm2, &1, &false, &oracle2);
    env2.mock_all_auths();

    let mut bands = soroban_sdk::Vec::new(&env2);
    bands.push_back(PayoutBand { min_wind_speed: 100, payout_percentage: 120 }); // Invalid > 100%

    let empty_sigs: soroban_sdk::Vec<(BytesN<32>, BytesN<64>)> = soroban_sdk::Vec::new(&env2);
    c2.update_parametric_bands(&empty_sigs, &region, &bands);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_update_premium_rate_zero_rejected() {
    let (env, client, contract_id, _oracle, _xlm_token, _token, _token_admin) = setup();
    let dao = Address::generate(&env);
    let region = Symbol::new(&env, "Luzon");

    env.mock_all_auths();

    // Set DAO address directly in storage to bypass multisig
    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::DaoAddress, &dao);
    });

    // Multiplier 0 must be rejected
    client.update_premium_rate(&region, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_microloan_insufficient_solvency_fails() {
    let (env, client, contract_id, _oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let loan_id = Symbol::new(&env, "Loan1");

    env.mock_all_auths();

    set_farmer_verified(&env, &contract_id, &farmer, true);

    // Mint tokens to vault directly without depositing through reinsurance
    // (contract has balance, but total_deposited = 0)
    token_admin.mint(&client.address, &1000);

    // Should fail with InsufficientLiquidity (#8) because pool deposit accounting is 0
    client.originate_microloan(&farmer, &loan_id, &500, &85);
}

#[test]
fn test_microloan_cap_prevents_over_borrowing() {
    let (env, client, contract_id, _oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    env.mock_all_auths();

    set_farmer_verified(&env, &contract_id, &farmer, true);

    // Pool = 100_000 tokens. Cap per farmer = 20% = 20_000.
    token_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    // First loan: 20_000 — exactly at cap, must succeed.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000, &90);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 20_000);

    // Second loan: 1 token over cap — must fail with LoanCapExceeded (#13).
    let r = client.try_originate_microloan(&farmer, &Symbol::new(&env, "L1"), &1, &90);
    assert!(r.is_err(), "second loan beyond cap must be rejected");
}

#[test]
fn test_microloan_repayment_restores_headroom() {
    let (env, client, contract_id, _oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    env.mock_all_auths();

    set_farmer_verified(&env, &contract_id, &farmer, true);

    // Pool = 100_000 tokens. Cap = 20%.
    token_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    // Borrow up to cap.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000, &90);

    // Repay the loan fully.
    client.repay_microloan(&farmer, &Symbol::new(&env, "L0"), &20_000);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 0);

    // Now a fresh loan should succeed.
    client.originate_microloan(&farmer, &Symbol::new(&env, "L1"), &20_000, &90);
    assert_eq!(client.get_farmer_outstanding_principal(&farmer), 20_000);
}

#[test]
fn test_duplicate_loan_id_rejected() {
    let (env, client, contract_id, _oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    env.mock_all_auths();

    set_farmer_verified(&env, &contract_id, &farmer, true);

    token_admin.mint(&lp, &100_000);
    client.deposit_reinsurance(&lp, &100_000);

    let loan_id = Symbol::new(&env, "L0");
    client.originate_microloan(&farmer, &loan_id, &5_000, &90);

    // Using the same loan_id while it is still active must fail.
    let r = client.try_originate_microloan(&farmer, &loan_id, &5_000, &90);
    assert!(r.is_err(), "duplicate active loan_id must be rejected");
}
