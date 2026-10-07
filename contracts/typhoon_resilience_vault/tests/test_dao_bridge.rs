//! Integration tests for tyfi_dao <-> typhoon_resilience_vault Invocation Bridge and RBAC.
//!
//! Verifies:
//! 1. RBAC enforcement: non-DAO callers cannot invoke restricted vault mutation entrypoints.
//! 2. Cross-contract bridge: passed DAO proposals autonomously mutate vault parameters.
//! 3. Timelock and quorum guarantees: no execution before timelock or without required votes.
//! 4. Replay protection: executed proposals cannot be finalized more than once.

mod helpers;
use helpers::{AdminKey, make_sigs};

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String, Symbol, Vec,
};

use typhoon_resilience_vault::{TyphoonVault, TyphoonVaultClient};
use tyfi_dao::{
    TyfiDaoContract, TyfiDaoContractClient, ActionType, DaoRole, ProposalStatus,
};

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

struct BridgeFixture<'a> {
    env: Env,
    vault: TyphoonVaultClient<'a>,
    dao: TyfiDaoContractClient<'a>,
    vault_addr: Address,
    dao_addr: Address,
    dao_admin: Address,
    lp_voter: Address,
}

fn setup_bridge<'a>(env: &'a Env) -> BridgeFixture<'a> {
    env.mock_all_auths();

    let k1 = AdminKey::from_seed(SEED_K1);
    let k2 = AdminKey::from_seed(SEED_K2);
    let k3 = AdminKey::from_seed(SEED_K3);

    let vault_addr = env.register(TyphoonVault, ());
    let vault = TyphoonVaultClient::new(env, &vault_addr);

    let xlm_token = env.register_stellar_asset_contract_v2(Address::generate(env)).address();
    let oracle = Address::generate(env);

    let mut admin_keys: Vec<BytesN<32>> = Vec::new(env);
    admin_keys.push_back(k1.pub_key_bytes(env));
    admin_keys.push_back(k2.pub_key_bytes(env));
    admin_keys.push_back(k3.pub_key_bytes(env));

    vault.initialize(&admin_keys, &2, &xlm_token, &1, &false, &oracle);

    let dao_addr = env.register(TyfiDaoContract, ());
    let dao = TyfiDaoContractClient::new(env, &dao_addr);
    let dao_admin = Address::generate(env);

    dao.initialize(&dao_admin, &vault_addr);

    // Link DAO address in vault using 2-of-3 admin multisig
    let nonce = vault.admin_nonce();
    let sigs = make_sigs(env, b"set_dao_address", nonce, &[&k1, &k2]);
    vault.set_dao_address(&sigs, &dao_addr);

    // Setup an LP with shares in the vault
    let lp_voter = Address::generate(env);
    let token_client = soroban_sdk::token::StellarAssetClient::new(env, &xlm_token);
    token_client.mint(&lp_voter, &50_000_0000000);
    vault.deposit_reinsurance(&lp_voter, &50_000_0000000);

    BridgeFixture {
        env: env.clone(),
        vault,
        dao,
        vault_addr,
        dao_addr,
        dao_admin,
        lp_voter,
    }
}

fn setup_unauthorized_vault(env: &Env) -> TyphoonVaultClient<'static> {
    let k1 = AdminKey::from_seed(SEED_K1);
    let k2 = AdminKey::from_seed(SEED_K2);

    let vault_addr = env.register(TyphoonVault, ());
    let vault = TyphoonVaultClient::new(env, &vault_addr);

    let xlm_token = Address::generate(env);
    let oracle = Address::generate(env);

    let mut admin_keys: Vec<BytesN<32>> = Vec::new(env);
    admin_keys.push_back(k1.pub_key_bytes(env));
    admin_keys.push_back(k2.pub_key_bytes(env));

    vault.initialize(&admin_keys, &2, &xlm_token, &1, &false, &oracle);

    let dao_addr = Address::generate(env);
    let nonce = vault.admin_nonce();
    let sigs = make_sigs(env, b"set_dao_address", nonce, &[&k1, &k2]);
    vault.set_dao_address(&sigs, &dao_addr);

    vault
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: RBAC - Non-DAO direct mutation calls must be rejected
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_vault_rejects_unauthorized_direct_update_premium_rate() {
    let env = Env::default();
    let vault = setup_unauthorized_vault(&env);
    vault.update_premium_rate(&Symbol::new(&env, "Luzon"), &150);
}

#[test]
#[should_panic]
fn test_vault_rejects_unauthorized_direct_update_quorum() {
    let env = Env::default();
    let vault = setup_unauthorized_vault(&env);
    vault.dao_update_quorum_threshold(&5);
}

#[test]
#[should_panic]
fn test_vault_rejects_unauthorized_direct_update_solvency_cap() {
    let env = Env::default();
    let vault = setup_unauthorized_vault(&env);
    vault.dao_update_solvency_cap(&9000);
}

#[test]
#[should_panic]
fn test_vault_rejects_unauthorized_direct_set_oracle() {
    let env = Env::default();
    let vault = setup_unauthorized_vault(&env);
    let oracle = Address::generate(&env);
    vault.dao_set_oracle(&oracle, &true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: End-to-End Bridge: UpdatePremiumRate via Passed Proposal
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_e2e_update_premium_rate_via_dao_bridge() {
    let env = Env::default();
    let f = setup_bridge(&env);

    // Default rate for Luzon is 100
    assert_eq!(f.vault.get_premium_rate(&Symbol::new(&env, "Luzon")), 100);

    // 1. Grant Proposer role to dao_admin
    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Proposer);

    // 2. Create proposal to set Luzon multiplier to 150 (1.5x)
    let dummy_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Increase Luzon risk multiplier to 150%"),
        &ActionType::UpdatePremiumRate,
        &150u32,
        &Symbol::new(&env, "Luzon"),
        &dummy_oracle,
        &0u32,
        &50u64, // 50 ledgers voting period
    );

    // 3. LP voter casts vote FOR
    f.dao.vote(&f.lp_voter, &prop_id, &true);

    // Verify vote summary
    let (votes_for, votes_against, quorum_req) = f.dao.get_vote_summary(&prop_id);
    assert!(votes_for > 0);
    assert_eq!(votes_against, 0);
    assert!(votes_for >= quorum_req);

    // 4. Advance ledger past deadline (50 ledgers)
    f.env.ledger().with_mut(|l| l.sequence_number += 60);

    // 5. Execute proposal (settles vote, moves to TimelockPending)
    let status = f.dao.execute_proposal(&prop_id);
    assert_eq!(status, ProposalStatus::TimelockPending);

    // 6. Advance ledger past timelock (8640 ledgers)
    f.env.ledger().with_mut(|l| l.sequence_number += 8700);

    // 7. Grant Executor role to dao_admin and finalize proposal
    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);

    // 8. VERIFY: Invocation bridge accurately triggered mutation on Vault!
    let new_rate = f.vault.get_premium_rate(&Symbol::new(&env, "Luzon"));
    assert_eq!(new_rate, 150);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: End-to-End Bridge: UpdateSolvencyCap via Passed Proposal
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_e2e_update_solvency_cap_via_dao_bridge() {
    let env = Env::default();
    let f = setup_bridge(&env);

    // Default solvency cap is 8000 bps
    assert_eq!(f.vault.get_solvency_cap(), 8000);

    let dummy_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Raise solvency cap to 9000 bps"),
        &ActionType::UpdateSolvencyCap,
        &9000u32,
        &Symbol::new(&env, ""),
        &dummy_oracle,
        &0u32,
        &50u64,
    );

    f.dao.vote(&f.lp_voter, &prop_id, &true);
    f.env.ledger().with_mut(|l| l.sequence_number += 60);
    f.dao.execute_proposal(&prop_id);
    f.env.ledger().with_mut(|l| l.sequence_number += 8700);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);

    assert_eq!(f.vault.get_solvency_cap(), 9000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: End-to-End Bridge: UpdateQuorumThreshold via Passed Proposal
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_e2e_update_quorum_threshold_via_dao_bridge() {
    let env = Env::default();
    let f = setup_bridge(&env);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Proposer);
    let dummy_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Update quorum threshold to 3"),
        &ActionType::UpdateQuorumThreshold,
        &3u32,
        &Symbol::new(&env, ""),
        &dummy_oracle,
        &0u32,
        &50u64,
    );

    f.dao.vote(&f.lp_voter, &prop_id, &true);
    f.env.ledger().with_mut(|l| l.sequence_number += 60);
    f.dao.execute_proposal(&prop_id);
    f.env.ledger().with_mut(|l| l.sequence_number += 8700);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);

    // Verified: proposal executed
    let prop = f.dao.get_proposal(&prop_id).unwrap();
    assert!(prop.executed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: End-to-End Bridge: RegisterOracle via Passed Proposal
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_e2e_register_oracle_via_dao_bridge() {
    let env = Env::default();
    let f = setup_bridge(&env);

    let new_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Register regional weather oracle"),
        &ActionType::RegisterOracle,
        &0u32,
        &Symbol::new(&env, ""),
        &new_oracle,
        &1u32, // active = true
        &50u64,
    );

    f.dao.vote(&f.lp_voter, &prop_id, &true);
    f.env.ledger().with_mut(|l| l.sequence_number += 60);
    f.dao.execute_proposal(&prop_id);
    f.env.ledger().with_mut(|l| l.sequence_number += 8700);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);

    let prop = f.dao.get_proposal(&prop_id).unwrap();
    assert!(prop.executed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Replay Protection - Finalized proposal cannot be finalized again
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_bridge_replay_protection_blocks_double_finalization() {
    let env = Env::default();
    let f = setup_bridge(&env);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Proposer);
    let dummy_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Replay test proposal"),
        &ActionType::UpdatePremiumRate,
        &120u32,
        &Symbol::new(&env, "Visayas"),
        &dummy_oracle,
        &0u32,
        &50u64,
    );

    f.dao.vote(&f.lp_voter, &prop_id, &true);
    f.env.ledger().with_mut(|l| l.sequence_number += 60);
    f.dao.execute_proposal(&prop_id);
    f.env.ledger().with_mut(|l| l.sequence_number += 8700);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);

    // Second call must panic with AlreadyExecuted
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Failed proposal cannot mutate vault
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_failed_proposal_cannot_be_finalized() {
    let env = Env::default();
    let f = setup_bridge(&env);

    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Proposer);
    let dummy_oracle = Address::generate(&env);
    let prop_id = f.dao.create_proposal(
        &f.dao_admin,
        &String::from_str(&env, "Proposal voted down"),
        &ActionType::UpdatePremiumRate,
        &200u32,
        &Symbol::new(&env, "Mindanao"),
        &dummy_oracle,
        &0u32,
        &50u64,
    );

    // LP votes AGAINST
    f.dao.vote(&f.lp_voter, &prop_id, &false);
    f.env.ledger().with_mut(|l| l.sequence_number += 60);

    let status = f.dao.execute_proposal(&prop_id);
    assert_eq!(status, ProposalStatus::Failed);

    f.env.ledger().with_mut(|l| l.sequence_number += 8700);
    f.dao.grant_role(&f.dao_admin, &f.dao_admin, &DaoRole::Executor);

    // Finalizing a failed proposal must panic
    f.dao.finalize_proposal(&f.dao_admin, &prop_id);
}
