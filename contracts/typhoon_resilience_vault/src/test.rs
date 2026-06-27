use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, token};

// Helper to setup the environment, token, and vault
fn setup() -> (Env, TyphoonVaultClient<'static>, Address, Address, Address, token::Client<'static>, token::StellarAssetClient<'static>) {
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());
    
    let token_client = token::Client::new(&env, &xlm_token);
    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);

    (env, client, admin, oracle, xlm_token, token_client, token_admin_client)
}

#[test]
fn test_successful_payout_with_subsidy() {
    let (env, client, _admin, oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let donor = Address::generate(&env);
    let lp = Address::generate(&env);
    let oracle2 = Address::generate(&env);

    let typhoon_id = Symbol::new(&env, "Yolanda");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    // Initialize contract with admin, XLM token, quorum=2, is_mainnet=false, single_oracle=oracle
    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &2, &xlm_token, &2, &false, &oracle);
    
    env.mock_all_auths();

    // 1. Set Oracles
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.set_oracle(&dummy_bytes, &dummy_sigs, &oracle, &true);
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.set_oracle(&dummy_bytes, &dummy_sigs, &oracle2, &true);

    // 2. RSBSA/KYC Verify Farmer
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);
    assert!(client.is_farmer_verified(&farmer));

    // 3. Deposit Premium Subsidy from Donor
    token_admin.mint(&donor, &1000);
    client.deposit_subsidy(&donor, &1000);
    assert_eq!(client.get_subsidy_balance(), 1000);

    // 4. Deposit Reinsurance Liquidity
    token_admin.mint(&lp, &10000);
    client.deposit_reinsurance(&lp, &5000);
    assert_eq!(client.get_total_reinsurance_deposited(), 5000);
    assert_eq!(client.get_lp_shares(&lp), 5000);

    // 5. Subscribe Farmer
    token_admin.mint(&farmer, &200); // Farmer has 200 tokens
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // With 50% premium subsidy:
    // - Farmer pays 100
    // - Subsidy pool pays 100 (balance becomes 900)
    // - Total reinsurance deposited increases to 5000 + 200 = 5200 (accruing premium as yield to LPs)
    assert_eq!(token.balance(&farmer), 100);
    assert_eq!(client.get_subsidy_balance(), 900);
    assert_eq!(client.get_total_reinsurance_deposited(), 5200);

    // Verify policy is active
    let policy = client.get_farm_policy(&farmer, &farm_id, &season).unwrap();
    assert!(policy.is_active);
    assert_eq!(policy.premium, 200);
    assert_eq!(policy.payout_amount, 2000);

    // 6. Submit damage reports (Combined Oracle + AI Consensus)
    client.submit_weather_report(&oracle, &typhoon_id, &region, &100);
    
    // Quorum is 2, so consensus is not reached yet
    assert_eq!(client.get_consensus_damage_percentage(&typhoon_id, &region), None);

    client.submit_weather_report(&oracle2, &typhoon_id, &region, &100);

    // Quorum reached! Average damage = (100 + 100) / 2 = 100%
    assert_eq!(client.get_consensus_damage_percentage(&typhoon_id, &region), Some(100));

    // 7. Claim parametric payout (100% damage = 100% payout = 2000 tokens)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // Farmer should have 100 (remaining) + 2000 (payout) = 2100 tokens
    assert_eq!(token.balance(&farmer), 2100);

    // Policy should now be inactive
    let updated_policy = client.get_farm_policy(&farmer, &farm_id, &season).unwrap();
    assert!(!updated_policy.is_active);
}

#[test]
fn test_yield_bearing_reinsurance_pool() {
    let (env, client, _admin, oracle, xlm_token, token, token_admin) = setup();
    let lp = Address::generate(&env);
    let farmer = Address::generate(&env);
    let farm_id = Symbol::new(&env, "Farm1");
    let region = Symbol::new(&env, "Luzon");
    let season = Symbol::new(&env, "Dry2026");

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &false, &oracle);
    env.mock_all_auths();

    // Mint stablecoins and deposit reinsurance
    token_admin.mint(&lp, &1000);
    client.deposit_reinsurance(&lp, &1000);

    assert_eq!(client.get_lp_shares(&lp), 1000);
    assert_eq!(client.get_total_reinsurance_deposited(), 1000);

    // Subscribe farmer without subsidy (subsidy pool is empty)
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);
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
    let (env, client, _admin, oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);

    let typhoon_id = Symbol::new(&env, "Odette");
    let region = Symbol::new(&env, "Visayas");
    let farm_id = Symbol::new(&env, "Farm2");
    let season = Symbol::new(&env, "Wet2026");

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &false, &oracle);
    env.mock_all_auths();

    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.set_oracle(&dummy_bytes, &dummy_sigs, &oracle, &true);
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);
    
    // Reinsurance deposit to back payouts
    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    // Subscribe farmer
    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Report 30% damage -> matches 30% payout
    client.submit_weather_report(&oracle, &typhoon_id, &region, &30);

    // Claim payout
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // 30% of 2000 payout_amount is 600 tokens.
    assert_eq!(token.balance(&farmer), 600);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_unverified_farmer_subscription_fails() {
    let (env, client, _admin, oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &false, &oracle);
    env.mock_all_auths();

    token_admin.mint(&farmer, &200);
    
    // Farmer is not verified under RSBSA, subscription must fail
    client.subscribe(&farmer, &Symbol::new(&env, "Farm1"), &Symbol::new(&env, "Luzon"), &Symbol::new(&env, "Wet2026"), &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_low_wind_speed_no_payout() {
    let (env, client, _admin, oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "Egay");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &false, &oracle);
    env.mock_all_auths();

    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.set_oracle(&dummy_bytes, &dummy_sigs, &oracle, &true);
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);

    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Report 0% damage (below threshold)
    client.submit_weather_report(&oracle, &typhoon_id, &region, &0);

    // Claim payout should fail with ThresholdNotMet (Contract error 6)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_double_payout_prevention() {
    let (env, client, _admin, oracle, xlm_token, _token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "Pepito");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &false, &oracle);
    env.mock_all_auths();

    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.set_oracle(&dummy_bytes, &dummy_sigs, &oracle, &true);
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);

    token_admin.mint(&lp, &5000);
    client.deposit_reinsurance(&lp, &5000);

    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    client.submit_weather_report(&oracle, &typhoon_id, &region, &100);

    // First payout claim succeeds
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // Second payout claim on same policy must fail with PolicyNotActive (Contract error 5)
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);
}

#[test]
fn test_mainnet_mode_strict_threshold() {
    let (env, client, _admin, oracle, xlm_token, token, token_admin) = setup();
    let farmer = Address::generate(&env);
    let lp = Address::generate(&env);
    let typhoon_id = Symbol::new(&env, "MainnetTyphoon");
    let region = Symbol::new(&env, "Luzon");
    let farm_id = Symbol::new(&env, "Farm1");
    let season = Symbol::new(&env, "Wet2026");

    // Initialize with is_mainnet_mode = true
    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &1, &xlm_token, &1, &true, &oracle);
    env.mock_all_auths();

    // Verify KYC
    let dummy_bytes = soroban_sdk::Bytes::new(&env);
    let dummy_sigs = soroban_sdk::Vec::new(&env);
    client.verify_farmer(&dummy_bytes, &dummy_sigs, &farmer, &true);

    // Deposit liquidity to backing pool
    token_admin.mint(&lp, &10000);
    client.deposit_reinsurance(&lp, &5000);

    // Subscribe farmer
    token_admin.mint(&farmer, &200);
    client.subscribe(&farmer, &farm_id, &region, &season, &200);

    // Single authorized oracle submits 75% damage report
    client.submit_weather_report(&oracle, &typhoon_id, &region, &75);

    // Claim payout
    client.claim_payout(&farmer, &farm_id, &season, &typhoon_id);

    // 75% damage = 75% payout = 1500 tokens
    assert_eq!(token.balance(&farmer), 1500);
}
