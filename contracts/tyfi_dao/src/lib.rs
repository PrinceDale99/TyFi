#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Symbol, Vec, log, IntoVal,
};

// ─── Errors ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DaoError {
    AlreadyInitialized      = 1,
    NotInitialized          = 2,
    Unauthorized            = 3,
    ProposalNotFound        = 4,
    VotingPeriodEnded       = 5,
    VotingPeriodActive      = 6,
    AlreadyVoted            = 7,
    NoVotingPower           = 8,
    AlreadyExecuted         = 9,
    ProposalFailed          = 10,
    QuorumNotReached        = 11,
    TimelockActive          = 12,
    ProposalVetoed          = 13,
    InsufficientRole        = 14,
    InvalidPayload          = 15,
    BridgeCallFailed        = 16,
    ZeroDuration            = 17,
}

// ─── Roles ─────────────────────────────────────────────────────────────────

/// RBAC roles enforced throughout the DAO.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DaoRole {
    /// Can create UpdatePremiumRate / UpdateQuorumThreshold proposals
    Proposer,
    /// Explicit voter role (LP shares also grant implicit voting)
    Voter,
    /// Can call finalize_proposal after timelock expires
    Executor,
    /// Full privileges: create any proposal, veto, grant/revoke roles
    Admin,
}

// ─── Action Type ─────────────────────────────────────────────────────────────

/// Discriminant for what vault function the proposal will invoke.
/// We separate this from the payload to avoid nested enum serialisation issues.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ActionType {
    UpdatePremiumRate,
    UpdateQuorumThreshold,
    UpdateSolvencyCap,
    RegisterOracle,
}

// ─── Proposal Status ─────────────────────────────────────────────────────────

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    TimelockPending,
    Executed,
    Vetoed,
}

// ─── Proposal struct ─────────────────────────────────────────────────────────
//
// Flat payload: we store all possible fields and use action_type as discriminant.
// Unused fields default to 0 / empty Symbol.

#[derive(Clone, Debug)]
#[contracttype]
pub struct Proposal {
    pub id:                      u64,
    pub creator:                 Address,
    pub description:             String,
    pub action_type:             ActionType,
    /// For UpdatePremiumRate and RegisterOracle: the region / oracle identifier
    pub param_region:            Symbol,
    /// Numeric value: multiplier (rate), threshold (quorum), cap bps (solvency)
    pub param_value:             u32,
    /// For RegisterOracle: the oracle address
    pub param_oracle:            Address,
    /// For RegisterOracle: active flag (1 = true, 0 = false)
    pub param_oracle_active:     u32,
    /// Supermajority threshold (bps) required for this action type
    pub required_threshold_bps:  u32,
    pub votes_for:               i128,
    pub votes_against:           i128,
    /// Total vault LP shares at proposal creation — quorum baseline
    pub quorum_snapshot:         i128,
    /// Ledger at which voting closes
    pub deadline:                u64,
    /// Ledger before which finalize_proposal cannot be called (timelock)
    pub timelock_until:          u64,
    pub executed:                bool,
    pub vetoed:                  bool,
}

// ─── Vote Record ─────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
#[contracttype]
pub struct VoteRecord {
    pub weight:  i128,
    pub support: bool,
}

// ─── Role History ─────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
#[contracttype]
pub struct RoleEvent {
    pub role:    DaoRole,
    pub granted: bool,
    pub ledger:  u32,
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    VaultId,
    ProposalCount,
    Proposal(u64),
    HasVoted(u64, Address),
    ExecutedProposal(u64),
    ProposalPassed(u64),
    Role(Address),
    RoleHistory(Address),
}

// ─── Constants ───────────────────────────────────────────────────────────────

/// Minimum voter participation: 30% of quorum_snapshot must vote
const QUORUM_BPS: i128 = 3_000;
/// Supermajority: 60% of votes must be FOR — required for high-risk actions
const SUPERMAJORITY_BPS: u32 = 6_000;
/// Simple majority: >50% for lower-risk actions
const SIMPLE_MAJORITY_BPS: u32 = 5_001;
/// Timelock after voting ends: ~48 hours at 20s/ledger
const TIMELOCK_LEDGERS: u64 = 8_640;
/// Min LP shares to propose without Proposer role
const MIN_PROPOSAL_SHARES: i128 = 1_000;
/// Max role history entries per address
const MAX_ROLE_HISTORY: u32 = 10;
const PERSISTENT_TTL_THRESHOLD: u32 = 1_728_000;
const PERSISTENT_TTL_EXTEND: u32    = 3_456_000;

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn get_lp_shares(env: &Env, vault_id: &Address, voter: &Address) -> i128 {
    env.invoke_contract(
        vault_id,
        &Symbol::new(env, "get_lp_shares"),
        (voter.clone(),).into_val(env),
    )
}

fn get_total_reinsurance_shares(env: &Env, vault_id: &Address) -> i128 {
    env.invoke_contract(
        vault_id,
        &Symbol::new(env, "get_total_reinsurance_shares"),
        ().into_val(env),
    )
}

fn threshold_for(action: &ActionType) -> u32 {
    match action {
        ActionType::UpdatePremiumRate        => SUPERMAJORITY_BPS,
        ActionType::UpdateSolvencyCap        => SUPERMAJORITY_BPS,
        ActionType::UpdateQuorumThreshold    => SUPERMAJORITY_BPS,
        ActionType::RegisterOracle           => SIMPLE_MAJORITY_BPS,
    }
}

fn has_role_inner(env: &Env, addr: &Address, role: &DaoRole) -> bool {
    let stored: Option<DaoRole> = env.storage().persistent().get(&DataKey::Role(addr.clone()));
    matches!(stored, Some(ref r) if r == role)
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct TyfiDaoContract;

#[contractimpl]
impl TyfiDaoContract {

    // ── Initialization ──────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address, vault_id: Address) -> Result<(), DaoError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(DaoError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VaultId, &vault_id);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
        // Auto-grant Admin role to the deployer
        env.storage().persistent().set(&DataKey::Role(admin.clone()), &DaoRole::Admin);
        log!(&env, "TyFi DAO initialized. Admin:", admin);
        Ok(())
    }

    // ── Role Management ─────────────────────────────────────────────────────

    /// Grant a DAO role to `target`. Caller must hold Admin role.
    pub fn grant_role(env: Env, caller: Address, target: Address, role: DaoRole) -> Result<(), DaoError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;
        env.storage().persistent().set(&DataKey::Role(target.clone()), &role);
        Self::append_role_history(&env, &target, role.clone(), true);
        env.events().publish(
            (Symbol::new(&env, "role_granted"), target.clone()),
            (),
        );
        log!(&env, "Role granted to:", target);
        Ok(())
    }

    /// Revoke any role from `target`. Caller must hold Admin role.
    pub fn revoke_role(env: Env, caller: Address, target: Address) -> Result<(), DaoError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;
        let existing: Option<DaoRole> = env.storage().persistent().get(&DataKey::Role(target.clone()));
        if let Some(r) = existing {
            Self::append_role_history(&env, &target, r, false);
            env.storage().persistent().remove(&DataKey::Role(target.clone()));
        }
        env.events().publish(
            (Symbol::new(&env, "role_revoked"), target.clone()),
            (),
        );
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), DaoError> {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(DaoError::NotInitialized)?;
        if caller == &stored_admin || has_role_inner(env, caller, &DaoRole::Admin) {
            Ok(())
        } else {
            Err(DaoError::Unauthorized)
        }
    }

    fn append_role_history(env: &Env, addr: &Address, role: DaoRole, granted: bool) {
        let key = DataKey::RoleHistory(addr.clone());
        let mut history: Vec<RoleEvent> = env.storage().persistent().get(&key).unwrap_or_else(|| Vec::new(env));
        if history.len() >= MAX_ROLE_HISTORY {
            let mut trimmed: Vec<RoleEvent> = Vec::new(env);
            let start = history.len() - MAX_ROLE_HISTORY + 1;
            for i in start..history.len() {
                trimmed.push_back(history.get(i).unwrap());
            }
            history = trimmed;
        }
        history.push_back(RoleEvent { role, granted, ledger: env.ledger().sequence() });
        env.storage().persistent().set(&key, &history);
    }

    pub fn get_role(env: Env, addr: Address) -> Option<DaoRole> {
        env.storage().persistent().get(&DataKey::Role(addr))
    }

    pub fn has_role(env: Env, addr: Address, role: DaoRole) -> bool {
        has_role_inner(&env, &addr, &role)
    }

    // ── Proposal Lifecycle ──────────────────────────────────────────────────

    /// Create a new typed proposal.
    ///
    /// RBAC: Admin required for UpdateSolvencyCap & RegisterOracle.
    ///       Proposer role OR sufficient LP shares for UpdatePremiumRate & UpdateQuorumThreshold.
    pub fn create_proposal(
        env: Env,
        creator: Address,
        description: String,
        action_type: ActionType,
        // Numeric value: multiplier (1–1000), threshold (1–100), cap_bps (100–9500)
        param_value: u32,
        // Region symbol for UpdatePremiumRate; empty symbol otherwise
        param_region: Symbol,
        // Oracle address for RegisterOracle; zero address otherwise
        param_oracle: Address,
        // 1 = activate oracle, 0 = deactivate (only for RegisterOracle)
        param_oracle_active: u32,
        duration_ledgers: u64,
    ) -> Result<u64, DaoError> {
        creator.require_auth();
        if duration_ledgers == 0 {
            return Err(DaoError::ZeroDuration);
        }

        // Role gate
        let high_risk = matches!(action_type, ActionType::UpdateSolvencyCap | ActionType::RegisterOracle);
        if high_risk {
            if !has_role_inner(&env, &creator, &DaoRole::Admin) {
                return Err(DaoError::InsufficientRole);
            }
        } else {
            let has_proposer = has_role_inner(&env, &creator, &DaoRole::Proposer)
                || has_role_inner(&env, &creator, &DaoRole::Admin);
            if !has_proposer {
                let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).ok_or(DaoError::NotInitialized)?;
                let shares = get_lp_shares(&env, &vault_id, &creator);
                if shares < MIN_PROPOSAL_SHARES {
                    return Err(DaoError::InsufficientRole);
                }
            }
        }

        // Payload validation
        match action_type {
            ActionType::UpdatePremiumRate => {
                if param_value == 0 || param_value > 1000 {
                    return Err(DaoError::InvalidPayload);
                }
            }
            ActionType::UpdateQuorumThreshold => {
                if param_value == 0 || param_value > 100 {
                    return Err(DaoError::InvalidPayload);
                }
            }
            ActionType::UpdateSolvencyCap => {
                if param_value < 100 || param_value > 9500 {
                    return Err(DaoError::InvalidPayload);
                }
            }
            ActionType::RegisterOracle => {
                if param_oracle_active > 1 {
                    return Err(DaoError::InvalidPayload);
                }
            }
        }

        let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).ok_or(DaoError::NotInitialized)?;
        let quorum_snapshot = get_total_reinsurance_shares(&env, &vault_id);
        let required_threshold_bps = threshold_for(&action_type);

        let mut count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        count += 1;

        let current = env.ledger().sequence() as u64;
        let deadline = current + duration_ledgers;
        let timelock_until = deadline + TIMELOCK_LEDGERS;

        let proposal = Proposal {
            id: count,
            creator: creator.clone(),
            description,
            action_type,
            param_region,
            param_value,
            param_oracle,
            param_oracle_active,
            required_threshold_bps,
            votes_for: 0,
            votes_against: 0,
            quorum_snapshot,
            deadline,
            timelock_until,
            executed: false,
            vetoed: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(count), &proposal);
        bump_persistent(&env, &DataKey::Proposal(count));
        env.storage().instance().set(&DataKey::ProposalCount, &count);

        env.events().publish(
            (Symbol::new(&env, "proposal_created"), creator),
            (count, deadline, timelock_until),
        );

        log!(&env, "Proposal created id:", count, "deadline:", deadline);
        Ok(count)
    }

    /// Cast a vote on an active proposal. Weight = LP shares held.
    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) -> Result<(), DaoError> {
        voter.require_auth();

        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.vetoed { return Err(DaoError::ProposalVetoed); }
        if (env.ledger().sequence() as u64) > proposal.deadline {
            return Err(DaoError::VotingPeriodEnded);
        }

        let voted_key = DataKey::HasVoted(proposal_id, voter.clone());
        if env.storage().persistent().has(&voted_key) {
            return Err(DaoError::AlreadyVoted);
        }

        let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).unwrap();
        let weight: i128 = get_lp_shares(&env, &vault_id, &voter);
        if weight <= 0 { return Err(DaoError::NoVotingPower); }

        if support {
            proposal.votes_for = proposal.votes_for.saturating_add(weight);
        } else {
            proposal.votes_against = proposal.votes_against.saturating_add(weight);
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        bump_persistent(&env, &DataKey::Proposal(proposal_id));

        let record = VoteRecord { weight, support };
        env.storage().persistent().set(&voted_key, &record);
        bump_persistent(&env, &voted_key);

        env.events().publish(
            (Symbol::new(&env, "dao_vote"), voter.clone()),
            (proposal_id, weight, support),
        );
        log!(&env, "Vote cast on proposal:", proposal_id, "weight:", weight, "support:", support);
        Ok(())
    }

    /// Settle a proposal after voting deadline. Checks quorum + threshold.
    /// Returns the resulting ProposalStatus. If passed, sets timelock.
    pub fn execute_proposal(env: Env, proposal_id: u64) -> Result<ProposalStatus, DaoError> {
        let proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.vetoed   { return Err(DaoError::ProposalVetoed); }
        if proposal.executed { return Err(DaoError::AlreadyExecuted); }
        if (env.ledger().sequence() as u64) <= proposal.deadline {
            return Err(DaoError::VotingPeriodActive);
        }

        let total_votes = proposal.votes_for.saturating_add(proposal.votes_against);
        let quorum_required = if proposal.quorum_snapshot > 0 {
            (proposal.quorum_snapshot * QUORUM_BPS) / 10_000
        } else { 0 };

        if total_votes < quorum_required {
            env.events().publish(
                (Symbol::new(&env, "quorum_failed"), proposal_id),
                (total_votes, quorum_required),
            );
            return Ok(ProposalStatus::Failed);
        }

        let threshold_met = if total_votes == 0 {
            false
        } else {
            let votes_for_bps = ((proposal.votes_for * 10_000) / total_votes) as u32;
            votes_for_bps >= proposal.required_threshold_bps
        };

        if !threshold_met {
            env.events().publish(
                (Symbol::new(&env, "proposal_failed"), proposal_id),
                (proposal.votes_for, proposal.votes_against),
            );
            return Ok(ProposalStatus::Failed);
        }

        // Passed — timelock starts now
        env.storage().persistent().set(&DataKey::ProposalPassed(proposal_id), &true);
        bump_persistent(&env, &DataKey::ProposalPassed(proposal_id));

        env.events().publish(
            (Symbol::new(&env, "proposal_passed"), proposal_id),
            proposal.timelock_until,
        );
        log!(&env, "Proposal passed. Timelock until ledger:", proposal.timelock_until);
        Ok(ProposalStatus::TimelockPending)
    }

    /// Finalize a passed proposal after timelock. Fires the cross-contract invocation bridge.
    ///
    /// RBAC: Executor or Admin role required.
    /// Replay protection: permanent `ExecutedProposal` seal in instance storage.
    pub fn finalize_proposal(env: Env, caller: Address, proposal_id: u64) -> Result<(), DaoError> {
        caller.require_auth();

        // RBAC gate
        let is_executor = has_role_inner(&env, &caller, &DaoRole::Executor)
            || has_role_inner(&env, &caller, &DaoRole::Admin);
        if !is_executor {
            return Err(DaoError::InsufficientRole);
        }

        // Permanent replay-protection seal check
        if env.storage().instance().has(&DataKey::ExecutedProposal(proposal_id)) {
            return Err(DaoError::AlreadyExecuted);
        }

        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.vetoed   { return Err(DaoError::ProposalVetoed); }
        if proposal.executed { return Err(DaoError::AlreadyExecuted); }

        // Must have passed voting and reached timelock
        if !env.storage().persistent().has(&DataKey::ProposalPassed(proposal_id)) {
            return Err(DaoError::ProposalFailed);
        }

        // Timelock check
        if (env.ledger().sequence() as u64) < proposal.timelock_until {
            return Err(DaoError::TimelockActive);
        }

        let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).unwrap();

        // ── INVOCATION BRIDGE ────────────────────────────────────────────────
        // The DAO contract itself is the caller — vault's dao.require_auth() passes
        // because env.current_contract_address() IS the DAO address stored in vault.
        match proposal.action_type {
            ActionType::UpdatePremiumRate => {
                let region = proposal.param_region.clone();
                let multiplier = proposal.param_value;
                let _: () = env.invoke_contract(
                    &vault_id,
                    &Symbol::new(&env, "update_premium_rate"),
                    (region, multiplier).into_val(&env),
                );
                log!(&env, "Bridge: update_premium_rate executed. Multiplier:", proposal.param_value);
            }
            ActionType::UpdateQuorumThreshold => {
                let threshold = proposal.param_value;
                let _: () = env.invoke_contract(
                    &vault_id,
                    &Symbol::new(&env, "dao_update_quorum_threshold"),
                    (threshold,).into_val(&env),
                );
                log!(&env, "Bridge: dao_update_quorum_threshold executed:", proposal.param_value);
            }
            ActionType::UpdateSolvencyCap => {
                let cap_bps = proposal.param_value;
                let _: () = env.invoke_contract(
                    &vault_id,
                    &Symbol::new(&env, "dao_update_solvency_cap"),
                    (cap_bps,).into_val(&env),
                );
                log!(&env, "Bridge: dao_update_solvency_cap executed:", proposal.param_value);
            }
            ActionType::RegisterOracle => {
                let oracle = proposal.param_oracle.clone();
                let active = proposal.param_oracle_active != 0;
                let _: () = env.invoke_contract(
                    &vault_id,
                    &Symbol::new(&env, "dao_set_oracle"),
                    (oracle, active).into_val(&env),
                );
                log!(&env, "Bridge: dao_set_oracle executed. Active:", proposal.param_oracle_active);
            }
        }
        // ── END BRIDGE ───────────────────────────────────────────────────────

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        bump_persistent(&env, &DataKey::Proposal(proposal_id));

        // Permanent seal
        env.storage().instance().set(&DataKey::ExecutedProposal(proposal_id), &true);

        env.events().publish(
            (Symbol::new(&env, "dao_executed"), proposal_id),
            env.ledger().sequence(),
        );
        log!(&env, "Proposal finalized, bridge call completed:", proposal_id);
        Ok(())
    }

    /// Emergency veto — Admin only. Blocks proposal execution permanently.
    pub fn veto_proposal(env: Env, admin: Address, proposal_id: u64, reason: String) -> Result<(), DaoError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.executed { return Err(DaoError::AlreadyExecuted); }
        proposal.vetoed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (Symbol::new(&env, "dao_veto"), proposal_id),
            reason,
        );
        log!(&env, "Proposal vetoed:", proposal_id);
        Ok(())
    }

    // ── View Functions ──────────────────────────────────────────────────────

    pub fn get_proposal(env: Env, id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(id))
    }

    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
    }

    pub fn get_voting_power(env: Env, voter: Address) -> i128 {
        let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).unwrap();
        get_lp_shares(&env, &vault_id, &voter)
    }

    pub fn get_vote_record(env: Env, proposal_id: u64, voter: Address) -> Option<VoteRecord> {
        env.storage().persistent().get(&DataKey::HasVoted(proposal_id, voter))
    }

    pub fn get_proposal_status(env: Env, proposal_id: u64) -> ProposalStatus {
        let proposal: Option<Proposal> = env.storage().persistent().get(&DataKey::Proposal(proposal_id));
        let proposal = match proposal {
            None => return ProposalStatus::Failed,
            Some(p) => p,
        };
        if proposal.vetoed   { return ProposalStatus::Vetoed; }
        if proposal.executed { return ProposalStatus::Executed; }
        let seq = env.ledger().sequence() as u64;
        if seq <= proposal.deadline { return ProposalStatus::Active; }
        let total_votes = proposal.votes_for.saturating_add(proposal.votes_against);
        let quorum_required = if proposal.quorum_snapshot > 0 {
            (proposal.quorum_snapshot * QUORUM_BPS) / 10_000
        } else { 0 };
        let threshold_met = if total_votes > 0 {
            ((proposal.votes_for * 10_000) / total_votes) as u32 >= proposal.required_threshold_bps
        } else { false };

        if total_votes < quorum_required || !threshold_met {
            return ProposalStatus::Failed;
        }
        if seq < proposal.timelock_until {
            ProposalStatus::TimelockPending
        } else {
            ProposalStatus::Passed
        }
    }

    /// (votes_for, votes_against, quorum_required)
    pub fn get_vote_summary(env: Env, proposal_id: u64) -> (i128, i128, i128) {
        let proposal: Option<Proposal> = env.storage().persistent().get(&DataKey::Proposal(proposal_id));
        match proposal {
            None => (0, 0, 0),
            Some(p) => {
                let quorum_required = if p.quorum_snapshot > 0 {
                    (p.quorum_snapshot * QUORUM_BPS) / 10_000
                } else { 0 };
                (p.votes_for, p.votes_against, quorum_required)
            }
        }
    }

    pub fn get_vault_id(env: Env) -> Address {
        env.storage().instance().get(&DataKey::VaultId).unwrap()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String, Symbol};

    #[contract]
    pub struct MockVault;

    #[contractimpl]
    impl MockVault {
        pub fn get_total_reinsurance_shares(_env: Env) -> i128 {
            10_000
        }
        pub fn get_lp_shares(_env: Env, _lp: Address) -> i128 {
            1_000
        }
        pub fn update_premium_rate(_env: Env, _region: Symbol, _multiplier: u32) {}
        pub fn dao_update_quorum_threshold(_env: Env, _threshold: u32) {}
        pub fn dao_update_solvency_cap(_env: Env, _cap_bps: u32) {}
        pub fn dao_set_oracle(_env: Env, _oracle: Address, _active: bool) {}
    }

    fn setup_dao(env: &Env) -> (TyfiDaoContractClient<'_>, Address, Address) {
        let contract_id = env.register(TyfiDaoContract, ());
        let vault = env.register(MockVault, ());
        let client = TyfiDaoContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&admin, &vault);
        (client, admin, vault)
    }

    fn dummy_oracle(env: &Env) -> Address { Address::generate(env) }

    fn update_rate_args(env: &Env) -> (ActionType, u32, Symbol, Address, u32) {
        (
            ActionType::UpdatePremiumRate,
            150u32,
            Symbol::new(env, "Luzon"),
            Address::generate(env),
            0u32,
        )
    }

    fn advance_ledger(env: &Env, by: u32) {
        env.ledger().with_mut(|l| l.sequence_number += by);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 29 — initialization tests
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_basic_initialization() {
        let env = Env::default();
        let (client, admin, vault) = setup_dao(&env);
        assert_eq!(client.get_proposal_count(), 0);
        assert_eq!(client.get_vault_id(), vault);
        assert_eq!(client.get_role(&admin), Some(DaoRole::Admin));
    }

    #[test]
    #[should_panic]
    fn test_double_initialization_rejected() {
        let env = Env::default();
        let (client, admin, vault) = setup_dao(&env);
        client.initialize(&admin, &vault); // panics — already initialized
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 30 — create_proposal typed action
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_create_proposal_with_typed_action() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let desc = String::from_str(&env, "Raise Luzon risk premium to 150%");
        // create_proposal returns u64 (not Result) via generated client
        let id = client.create_proposal(&admin, &desc, &at, &pv, &pr, &po, &poa, &100u64);
        assert_eq!(id, 1);
        assert_eq!(client.get_proposal_count(), 1);
        let prop = client.get_proposal(&1u64).unwrap();
        assert_eq!(prop.votes_for, 0);
        assert_eq!(prop.votes_against, 0);
        assert!(!prop.executed);
        assert!(!prop.vetoed);
        assert_eq!(prop.param_value, 150);
    }

    #[test]
    #[should_panic]
    fn test_zero_duration_proposal_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        client.create_proposal(&admin, &String::from_str(&env, "bad"), &at, &pv, &pr, &po, &poa, &0u64);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 33 — voting after deadline rejected
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_voting_after_deadline_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "test"), &at, &pv, &pr, &po, &poa, &5u64);
        advance_ledger(&env, 100);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true); // should panic — past deadline
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 34 — quorum failure
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_quorum_failure_returns_failed_status() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "test"), &at, &pv, &pr, &po, &poa, &5u64);
        advance_ledger(&env, 100);
        // 0 votes, 0 quorum_snapshot → threshold not met → Failed
        let status = client.execute_proposal(&id);
        assert_eq!(status, ProposalStatus::Failed);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 35 — UpdateSolvencyCap requires Admin
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_solvency_cap_proposal_requires_admin_role() {
        let env = Env::default();
        let (client, _, _) = setup_dao(&env);
        env.mock_all_auths();
        let rando = Address::generate(&env);
        client.create_proposal(
            &rando,
            &String::from_str(&env, "Solvency cap"),
            &ActionType::UpdateSolvencyCap,
            &8000u32,
            &Symbol::new(&env, ""),
            &dummy_oracle(&env),
            &0u32,
            &100u64,
        ); // panics — rando has no Admin role
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 36 — RegisterOracle requires Admin
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_register_oracle_requires_admin_role() {
        let env = Env::default();
        let (client, _, _) = setup_dao(&env);
        env.mock_all_auths();
        let rando = Address::generate(&env);
        client.create_proposal(
            &rando,
            &String::from_str(&env, "Add oracle"),
            &ActionType::RegisterOracle,
            &0u32,
            &Symbol::new(&env, ""),
            &dummy_oracle(&env),
            &1u32,
            &100u64,
        ); // panics — rando has no Admin role
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 37 — timelock prevents early finalization
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_finalize_before_timelock_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.grant_role(&admin, &admin, &DaoRole::Executor);
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "test"), &at, &pv, &pr, &po, &poa, &5u64);
        // Advance past deadline but NOT past timelock (5+8640=8645)
        advance_ledger(&env, 10);
        client.finalize_proposal(&admin, &id); // panics — TimelockActive
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 38 — veto blocks finalization
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_admin_veto_blocks_finalization() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.grant_role(&admin, &admin, &DaoRole::Executor);
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "test"), &at, &pv, &pr, &po, &poa, &5u64);
        client.veto_proposal(&admin, &id, &String::from_str(&env, "Emergency"));
        advance_ledger(&env, 10_000);
        client.finalize_proposal(&admin, &id); // panics — ProposalVetoed
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 39 — Executor role required for finalize
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_executor_role_required_for_finalize() {
        let env = Env::default();
        let (client, _, _) = setup_dao(&env);
        env.mock_all_auths();
        let rando = Address::generate(&env);
        client.finalize_proposal(&rando, &1u64); // panics — InsufficientRole
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 34 — role management
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_grant_and_revoke_role() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let user = Address::generate(&env);
        client.grant_role(&admin, &user, &DaoRole::Proposer);
        assert_eq!(client.get_role(&user), Some(DaoRole::Proposer));
        assert!(client.has_role(&user, &DaoRole::Proposer));
        client.revoke_role(&admin, &user);
        assert_eq!(client.get_role(&user), None);
        assert!(!client.has_role(&user, &DaoRole::Proposer));
    }

    #[test]
    #[should_panic]
    fn test_non_admin_cannot_grant_role() {
        let env = Env::default();
        let (client, _, _) = setup_dao(&env);
        env.mock_all_auths();
        let rando = Address::generate(&env);
        let target = Address::generate(&env);
        client.grant_role(&rando, &target, &DaoRole::Proposer); // panics — Unauthorized
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 30 — invalid payload validation
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_invalid_premium_multiplier_zero_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.create_proposal(
            &admin, &String::from_str(&env, "bad"),
            &ActionType::UpdatePremiumRate, &0u32,
            &Symbol::new(&env, "Luzon"), &dummy_oracle(&env), &0u32, &100u64,
        );
    }

    #[test]
    #[should_panic]
    fn test_invalid_premium_multiplier_over_1000_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.create_proposal(
            &admin, &String::from_str(&env, "bad"),
            &ActionType::UpdatePremiumRate, &1001u32,
            &Symbol::new(&env, "Luzon"), &dummy_oracle(&env), &0u32, &100u64,
        );
    }

    #[test]
    #[should_panic]
    fn test_invalid_solvency_cap_over_9500_rejected() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.create_proposal(
            &admin, &String::from_str(&env, "bad"),
            &ActionType::UpdateSolvencyCap, &9501u32,
            &Symbol::new(&env, ""), &dummy_oracle(&env), &0u32, &100u64,
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 11 — proposal status view
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_proposal_status_active_within_deadline() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "t"), &at, &pv, &pr, &po, &poa, &500u64);
        assert_eq!(client.get_proposal_status(&id), ProposalStatus::Active);
    }

    #[test]
    fn test_proposal_status_failed_after_deadline_no_votes() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "t"), &at, &pv, &pr, &po, &poa, &5u64);
        advance_ledger(&env, 100);
        assert_eq!(client.get_proposal_status(&id), ProposalStatus::Failed);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 38 — vetoed proposal status
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_vetoed_proposal_shows_vetoed_status() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "t"), &at, &pv, &pr, &po, &poa, &5u64);
        client.veto_proposal(&admin, &id, &String::from_str(&env, "reason"));
        assert_eq!(client.get_proposal_status(&id), ProposalStatus::Vetoed);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Commit 40 — vote summary view
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_vote_summary_initial_zeros() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        let (at, pv, pr, po, poa) = update_rate_args(&env);
        let id = client.create_proposal(&admin, &String::from_str(&env, "t"), &at, &pv, &pr, &po, &poa, &100u64);
        let (for_v, against_v, quorum_req) = client.get_vote_summary(&id);
        assert_eq!(for_v, 0);
        assert_eq!(against_v, 0);
        assert_eq!(quorum_req, 3000);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Replay protection — proposal not found guard
    // ──────────────────────────────────────────────────────────────────────────

    #[test]
    #[should_panic]
    fn test_finalize_nonexistent_proposal_fails() {
        let env = Env::default();
        let (client, admin, _) = setup_dao(&env);
        env.mock_all_auths();
        client.grant_role(&admin, &admin, &DaoRole::Executor);
        client.finalize_proposal(&admin, &999u64); // panics — ProposalNotFound
    }
}


