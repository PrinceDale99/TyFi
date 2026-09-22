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
        assert!(duration_ledgers > 0, "Duration must be greater than zero");

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

        log!(&env, "Proposal {} executed", proposal_id);
    }

    pub fn get_proposal(env: Env, id: u64) -> Proposal {
        env.storage().persistent().get(&DataKey::Proposal(id)).unwrap()
    }

    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

    #[test]
    fn test_dao_initialization_and_proposal_lifecycle() {
        let env = Env::default();
        let contract_id = env.register(TyfiDaoContract, ());
        let client = TyfiDaoContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let vault = Address::generate(&env);
        let creator = Address::generate(&env);

        client.initialize(&admin, &vault);
        assert_eq!(client.get_proposal_count(), 0);

        env.mock_all_auths();

        let desc = String::from_str(&env, "Update Luzon risk multiplier to 120%");
        let action = Symbol::new(&env, "update_rate");
        let prop_id = client.create_proposal(&creator, &desc, &action, &100);

        assert_eq!(prop_id, 1);
        assert_eq!(client.get_proposal_count(), 1);

        let prop = client.get_proposal(&1);
        assert_eq!(prop.creator, creator);
        assert_eq!(prop.votes_for, 0);
        assert_eq!(prop.votes_against, 0);
        assert!(!prop.executed);
    }

    #[test]
    #[should_panic(expected = "Duration must be greater than zero")]
    fn test_zero_duration_proposal_rejected() {
        let env = Env::default();
        let contract_id = env.register(TyfiDaoContract, ());
        let client = TyfiDaoContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let vault = Address::generate(&env);
        let creator = Address::generate(&env);

        client.initialize(&admin, &vault);
        env.mock_all_auths();

        let desc = String::from_str(&env, "Invalid proposal");
        let action = Symbol::new(&env, "invalid");
        client.create_proposal(&creator, &desc, &action, &0);
    }
}
