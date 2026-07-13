#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, log, IntoVal};

#[contract]
pub struct TyfiDaoContract;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    VaultId,
    ProposalCount,
    Proposal(u64),
    HasVoted(u64, Address),
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Proposal {
    pub id: u64,
    pub creator: Address,
    pub description: String,
    pub action_type: Symbol,
    pub votes_for: i128,
    pub votes_against: i128,
    pub executed: bool,
    pub deadline: u64,
}

#[contractimpl]
impl TyfiDaoContract {
    pub fn initialize(env: Env, admin: Address, vault_id: Address) {
        assert!(!env.storage().instance().has(&DataKey::Admin), "Already initialized");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VaultId, &vault_id);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    pub fn create_proposal(
        env: Env,
        creator: Address,
        description: String,
        action_type: Symbol,
        duration_ledgers: u64,
    ) -> u64 {
        creator.require_auth();

        let mut count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        count += 1;

        let deadline = env.ledger().sequence() + duration_ledgers as u32;

        let proposal = Proposal {
            id: count,
            creator,
            description,
            action_type,
            votes_for: 0,
            votes_against: 0,
            executed: false,
            deadline: deadline as u64,
        };

        env.storage().persistent().set(&DataKey::Proposal(count), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &count);

        log!(&env, "Proposal created: {}", count);
        count
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();

        let mut proposal: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).expect("Proposal not found");
        assert!(env.ledger().sequence() <= proposal.deadline as u32, "Voting period ended");

        let voted_key = DataKey::HasVoted(proposal_id, voter.clone());
        assert!(!env.storage().persistent().has(&voted_key), "Already voted");

        let vault_id: Address = env.storage().instance().get(&DataKey::VaultId).unwrap();
        
        // Fetch voter's LP shares from the Vault as their voting weight
        let weight: i128 = env.invoke_contract(
            &vault_id,
            &Symbol::new(&env, "get_lp_shares"),
            (voter.clone(),).into_val(&env),
        );

        // Basic 1-Farmer-1-Vote hybrid weight addition could go here in a future update
        // For now, pure stake weight based on LP shares.
        assert!(weight > 0, "No voting power");

        if support {
            proposal.votes_for += weight;
        } else {
            proposal.votes_against += weight;
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&voted_key, &true);

        log!(&env, "Vote cast by {} on proposal {} with weight {}", voter, proposal_id, weight);
    }

    pub fn execute_proposal(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).expect("Proposal not found");
        assert!(env.ledger().sequence() > proposal.deadline as u32, "Voting period not ended");
        assert!(!proposal.executed, "Already executed");
        assert!(proposal.votes_for > proposal.votes_against, "Proposal failed");

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Here the DAO would execute specific parameters on the Vault.
        // For Phase 3, this would involve invoking `update_premium_rate` or similar on `vault_id`.
        
        log!(&env, "Proposal {} executed", proposal_id);
    }

    pub fn get_proposal(env: Env, id: u64) -> Proposal {
        env.storage().persistent().get(&DataKey::Proposal(id)).unwrap()
    }

    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
    }
}
