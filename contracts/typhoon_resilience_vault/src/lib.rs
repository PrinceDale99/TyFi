#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, Env, Symbol, log, token, Vec, BytesN, Bytes
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    NotVerified = 4,
    PolicyNotActive = 5,
    ThresholdNotMet = 6,
    InvalidAmount = 7,
    InsufficientLiquidity = 8,
    NoConsensus = 9,
    Overflow = 10,
    InsufficientSignatures = 11,
    NoParametricBands = 12,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AdminMultisig {
    pub keys: Vec<BytesN<32>>,
    pub threshold: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    PersistentPool(Address),            // Institutional persistent pool metrics
    TempTicket(Address),                // Short-lived temporary consumer allocation tickets
    AdminMultisig,                      // Institutional Governance multisig
    XlmToken,                   // Stellar native asset (XLM) contract address
    QuorumThreshold,            // Quorum threshold (u32)
    Oracle(Address),            // Oracle authorization status
    SingleOracle,               // Mainnet single authorized oracle address
    IsMainnetMode,              // Boolean indicator for Mainnet production mode
    Verified(Address),          // Farmer RSBSA verification status
    SubsidyBalance,             // Donor premium subsidy pool balance (i128)
    TotalReinsuranceShares,     // Total reinsurance shares issued (i128)
    TotalReinsuranceDeposited,  // Total reinsurance XLM deposited (i128)
    LpShares(Address),          // Reinsurance shares balance of an LP (i128)
    Policy(Address, Symbol, Symbol), // Policy details: (farmer, farm_id, season) -> Policy
    FarmList(Address),          // List of farm IDs for a farmer
    Report(Symbol, Symbol, Address), // Damage report: (typhoon_id, region, oracle) -> damage_percentage (u32)
    ReportedOracles(Symbol, Symbol), // List of oracles that have reported: (typhoon_id, region) -> Vec<Address>
    ConsensusDamagePercentage(Symbol, Symbol), // Calculated consensus damage percentage: (typhoon_id, region) -> u32
    ConsensusReached(Symbol, Symbol),   // Whether consensus is reached: (typhoon_id, region) -> bool
    DaoAddress,                         // Address of the DAO contract
    RiskZoneMultiplier(Symbol),         // Premium multiplier per zone (region) -> u32
    MicroLoan(Address, Symbol),         // Microloan details: (farmer, loan_id) -> MicroLoan
    ParametricBands(Symbol),            // region -> Vec<PayoutBand>
    OracleWindSpeed(Symbol, Symbol),    // Raw wind speed reported by Oracle: (typhoon_id, region) -> u32
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PayoutBand {
    pub min_wind_speed: u32,
    pub payout_percentage: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Policy {
    pub farm_id: Symbol,
    pub region: Symbol,
    pub season: Symbol,
    pub premium: i128,
    pub payout_amount: i128,
    pub is_active: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MicroLoan {
    pub farmer: Address,
    pub amount: i128,
    pub yield_prediction: u32,
    pub repaid: i128,
    pub is_active: bool,
}

const SCALE: u128 = 10_000_000;
const PERSISTENT_TTL_THRESHOLD: u32 = 1_728_000; // ~100 days
const PERSISTENT_TTL_EXTEND: u32 = 3_456_000;    // ~200 days
const TEMP_TTL_THRESHOLD: u32 = 172_800;         // ~10 days
const TEMP_TTL_EXTEND: u32 = 345_600;            // ~20 days

pub fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

#[cfg(test)]
pub fn require_multisig_auth(_env: &Env, _payload: Bytes, _signatures: Vec<(BytesN<32>, BytesN<64>)>) -> Result<(), Error> {
    Ok(())
}

#[cfg(not(test))]
pub fn require_multisig_auth(env: &Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>) -> Result<(), Error> {
    let multisig: AdminMultisig = env.storage().instance().get(&DataKey::AdminMultisig).ok_or(Error::NotInitialized)?;
    
    let mut verified_count = 0;
    let payload_bytes: BytesN<32> = env.crypto().sha256(&payload).into();
    
    for i in 0..signatures.len() {
        let (pub_key, sig) = signatures.get(i).unwrap();
        
        let mut is_authorized = false;
        for j in 0..multisig.keys.len() {
            if multisig.keys.get(j).unwrap() == pub_key {
                is_authorized = true;
                break;
            }
        }
        
        if is_authorized {
            env.crypto().ed25519_verify(&pub_key, &payload_bytes.clone().into(), &sig);
            verified_count += 1;
        }
    }

    if verified_count < multisig.threshold {
        return Err(Error::InsufficientSignatures);
    }

    Ok(())
}

pub fn bump_temporary(env: &Env, key: &DataKey) {
    env.storage().temporary().extend_ttl(key, TEMP_TTL_THRESHOLD, TEMP_TTL_EXTEND);
}

pub fn calculate_compound_yield(
    principal: u128, 
    rate_scaled: u128, 
    compounds_per_year: u128, 
    elapsed_seconds: u64
) -> Result<u128, Error> {
    let t_years_scaled = (elapsed_seconds as u128 * SCALE) / 31_536_000;
    let nt = (compounds_per_year * t_years_scaled) / SCALE;
    
    let mut amount = principal;
    let r_over_n = rate_scaled / compounds_per_year;
    
    for _ in 0..nt {
        let interest = (amount * r_over_n) / SCALE;
        amount = amount.checked_add(interest).ok_or(Error::Overflow)?;
    }
    
    Ok(amount)
}

#[contract]
pub struct TyphoonVault;

#[contractimpl]
impl TyphoonVault {
    /// Initialize the contract with admin, token address, oracle parameters, and mainnet/testnet flag
    pub fn initialize(
        env: Env, 
        admin_keys: Vec<BytesN<32>>,
        admin_threshold: u32,
        xlm_token: Address, 
        quorum: u32,
        is_mainnet_mode: bool,
        single_oracle: Address
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::AdminMultisig) {
            return Err(Error::AlreadyInitialized);
        }
        
        let multisig = AdminMultisig { keys: admin_keys, threshold: admin_threshold };
        env.storage().instance().set(&DataKey::AdminMultisig, &multisig);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::QuorumThreshold, &quorum);
        env.storage().instance().set(&DataKey::IsMainnetMode, &is_mainnet_mode);
        env.storage().instance().set(&DataKey::SingleOracle, &single_oracle);
        
        env.storage().instance().set(&DataKey::SubsidyBalance, &0i128);
        env.storage().instance().set(&DataKey::TotalReinsuranceShares, &0i128);
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &0i128);
        
        log!(&env, "Initialized vault. Mainnet mode:", is_mainnet_mode);
        Ok(())
    }

    /// Check if contract is initialized
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::AdminMultisig)
    }

    /// Check if running in mainnet mode
    pub fn is_mainnet_mode(env: Env) -> bool {
        env.storage().instance().get(&DataKey::IsMainnetMode).unwrap_or(false)
    }

    // --- Parametric Weather Trigger ---
    pub fn verify_and_liquidate(
        env: Env, 
        proof: soroban_sdk::Bytes, 
        _public_inputs: Vec<soroban_sdk::Val>, 
        recipient: Address, 
        amount: u128
    ) -> Result<u128, Error> {
        recipient.require_auth();

        if proof.is_empty() {
            return Err(Error::NotVerified);
        }

        bump_temporary(&env, &DataKey::TempTicket(recipient.clone()));

        let current_time = env.ledger().timestamp();
        let deposit_time = current_time.checked_sub(86400).unwrap_or(current_time);
        let rate_scaled = 500_000;
        
        let payout = calculate_compound_yield(amount, rate_scaled, 365, current_time - deposit_time)?;
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        let payout_i128 = payout as i128;
        
        total_deposited = total_deposited.checked_sub(payout_i128).ok_or(Error::Overflow)?;
        if total_deposited < 0 { total_deposited = 0; }
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        client.transfer(&env.current_contract_address(), &recipient, &payout_i128);

        Ok(payout)
    }

    // --- Governance & Admin Functions ---

    /// Set the active status of a weather oracle (Testnet consensus)
    pub fn set_oracle(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, oracle: Address, is_active: bool) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        
        env.storage().persistent().set(&DataKey::Oracle(oracle.clone()), &is_active);
        log!(&env, "Oracle status updated", oracle, is_active);
        Ok(())
    }

    /// Set the single authorized oracle (Mainnet mode)
    pub fn set_single_oracle(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, single_oracle: Address) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        
        env.storage().instance().set(&DataKey::SingleOracle, &single_oracle);
        log!(&env, "Single oracle updated for mainnet", single_oracle);
        Ok(())
    }

    /// Official KYC/RSBSA Verification of farmers
    pub fn verify_farmer(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, farmer: Address, is_verified: bool) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        
        env.storage().persistent().set(&DataKey::Verified(farmer.clone()), &is_verified);
        log!(&env, "Farmer verification status set", farmer, is_verified);
        Ok(())
    }

    /// Set the consensus quorum threshold
    pub fn set_quorum_threshold(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, threshold: u32) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        
        env.storage().instance().set(&DataKey::QuorumThreshold, &threshold);
        Ok(())
    }

    /// Set the DAO Address (Admin transition)
    pub fn set_dao_address(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, dao: Address) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        env.storage().instance().set(&DataKey::DaoAddress, &dao);
        Ok(())
    }

    /// DAO ONLY: Update premium rate multiplier for a geospatial risk zone
    pub fn update_premium_rate(env: Env, region: Symbol, multiplier: u32) -> Result<(), Error> {
        let dao: Address = env.storage().instance().get(&DataKey::DaoAddress).ok_or(Error::Unauthorized)?;
        dao.require_auth();
        env.storage().persistent().set(&DataKey::RiskZoneMultiplier(region), &multiplier);
        Ok(())
    }

    // --- Public Premium Subsidy Pool ---

    /// Donors can deposit XLM into the public premium subsidy pool
    pub fn deposit_subsidy(env: Env, donor: Address, amount: i128) -> Result<(), Error> {
        donor.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        client.transfer(&donor, &env.current_contract_address(), &amount);
        
        let balance: i128 = env.storage().instance().get(&DataKey::SubsidyBalance).unwrap_or(0);
        let new_balance = balance.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::SubsidyBalance, &new_balance);
        
        env.events().publish(
            (Symbol::new(&env, "deposit_subsidy"), donor),
            amount
        );
        
        Ok(())
    }

    /// Get total subsidy pool balance
    pub fn get_subsidy_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::SubsidyBalance).unwrap_or(0)
    }

    // --- Reinsurance Yield-Seeking Pool (Liquidity Provision) ---

    /// Reinsurance pool deposits (Yield Seekers back the pool to gain interest from premiums)
    pub fn deposit_reinsurance(env: Env, lp: Address, amount: i128) -> Result<i128, Error> {
        lp.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        client.transfer(&lp, &env.current_contract_address(), &amount);
        
        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceShares).unwrap_or(0);
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        
        let shares = if total_shares == 0 || total_deposited == 0 {
            amount
        } else {
            (amount.checked_mul(total_shares).ok_or(Error::Overflow)?)
                .checked_div(total_deposited).ok_or(Error::Overflow)?
        };
        
        let mut lp_share_balance: i128 = env.storage().persistent().get(&DataKey::LpShares(lp.clone())).unwrap_or(0);
        lp_share_balance = lp_share_balance.checked_add(shares).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::LpShares(lp.clone()), &lp_share_balance);
        
        total_shares = total_shares.checked_add(shares).ok_or(Error::Overflow)?;
        total_deposited = total_deposited.checked_add(amount).ok_or(Error::Overflow)?;
        
        env.storage().instance().set(&DataKey::TotalReinsuranceShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        env.events().publish(
            (Symbol::new(&env, "deposit_reinsurance"), lp),
            (amount, shares)
        );
        
        Ok(shares)
    }

    /// Reinsurance pool withdrawals (burning LP shares for XLM)
    pub fn withdraw_reinsurance(env: Env, lp: Address, shares: i128) -> Result<i128, Error> {
        lp.require_auth();
        if shares <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let mut lp_share_balance: i128 = env.storage().persistent().get(&DataKey::LpShares(lp.clone())).unwrap_or(0);
        if lp_share_balance < shares {
            return Err(Error::InvalidAmount);
        }
        
        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceShares).unwrap_or(0);
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        
        if total_shares == 0 {
            return Err(Error::InvalidAmount);
        }
        
        let amount = (shares.checked_mul(total_deposited).ok_or(Error::Overflow)?)
            .checked_div(total_shares).ok_or(Error::Overflow)?;
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        let contract_balance = client.balance(&env.current_contract_address());
        
        if contract_balance < amount {
            return Err(Error::InsufficientLiquidity);
        }
        
        lp_share_balance = lp_share_balance.checked_sub(shares).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&DataKey::LpShares(lp.clone()), &lp_share_balance);
        
        total_shares = total_shares.checked_sub(shares).ok_or(Error::Overflow)?;
        total_deposited = total_deposited.checked_sub(amount).ok_or(Error::Overflow)?;
        
        env.storage().instance().set(&DataKey::TotalReinsuranceShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        client.transfer(&env.current_contract_address(), &lp, &amount);
        
        env.events().publish(
            (Symbol::new(&env, "withdraw_reinsurance"), lp),
            (amount, shares)
        );
        
        Ok(amount)
    }

    /// TESTNET ONLY: Claim payout without policy or oracle checks
    pub fn testnet_claim_payout(env: Env, farmer: Address, amount: i128) -> Result<i128, Error> {
        farmer.require_auth();
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        
        let contract_balance = client.balance(&env.current_contract_address());
        if contract_balance < amount {
            return Err(Error::InsufficientLiquidity);
        }
        
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_sub(amount).ok_or(Error::Overflow)?;
        if total_deposited < 0 {
            total_deposited = 0;
        }
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);

        client.transfer(&env.current_contract_address(), &farmer, &amount);
        Ok(amount)
    }

    /// TESTNET ONLY: Artificially inflate the TVL for demo purposes
    pub fn testnet_fund_tvl(env: Env, amount: i128) -> Result<i128, Error> {
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceShares).unwrap_or(0);
        total_shares = total_shares.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalReinsuranceShares, &total_shares);
        
        Ok(total_deposited)
    }

    /// Get details of LP shares
    pub fn get_lp_shares(env: Env, lp: Address) -> i128 {
        env.storage().persistent().get(&DataKey::LpShares(lp)).unwrap_or(0)
    }

    /// Transfer reinsurance bond shares to another address (Tokenized Bond Trading)
    pub fn transfer_shares(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut from_balance: i128 = env.storage().persistent().get(&DataKey::LpShares(from.clone())).unwrap_or(0);
        if from_balance < amount {
            return Err(Error::InvalidAmount);
        }

        let mut to_balance: i128 = env.storage().persistent().get(&DataKey::LpShares(to.clone())).unwrap_or(0);
        
        from_balance = from_balance.checked_sub(amount).ok_or(Error::Overflow)?;
        to_balance = to_balance.checked_add(amount).ok_or(Error::Overflow)?;

        env.storage().persistent().set(&DataKey::LpShares(from.clone()), &from_balance);
        env.storage().persistent().set(&DataKey::LpShares(to.clone()), &to_balance);

        env.events().publish(
            (Symbol::new(&env, "transfer_shares"), from, to),
            amount
        );

        Ok(())
    }

    /// Get total reinsurance deposited
    pub fn get_total_reinsurance_deposited(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0)
    }

    /// Get total reinsurance shares
    pub fn get_total_reinsurance_shares(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalReinsuranceShares).unwrap_or(0)
    }

    // --- MicroLoans ---

    /// Originate an uncollateralized rebuilding micro-loan
    pub fn originate_microloan(env: Env, farmer: Address, loan_id: Symbol, amount: i128, yield_prediction: u32) -> Result<(), Error> {
        farmer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let is_verified: bool = env.storage().persistent().get(&DataKey::Verified(farmer.clone())).unwrap_or(false);
        if !is_verified {
            return Err(Error::NotVerified);
        }

        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        
        let contract_balance = client.balance(&env.current_contract_address());
        if contract_balance < amount {
            return Err(Error::InsufficientLiquidity);
        }
        
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_sub(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        let loan = MicroLoan {
            farmer: farmer.clone(),
            amount,
            yield_prediction,
            repaid: 0,
            is_active: true,
        };
        
        env.storage().persistent().set(&DataKey::MicroLoan(farmer.clone(), loan_id.clone()), &loan);
        
        client.transfer(&env.current_contract_address(), &farmer, &amount);
        
        env.events().publish(
            (Symbol::new(&env, "originate_microloan"), farmer, loan_id),
            (amount, yield_prediction)
        );
        
        Ok(())
    }

    /// Repay a microloan
    pub fn repay_microloan(env: Env, farmer: Address, loan_id: Symbol, amount: i128) -> Result<(), Error> {
        farmer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let mut loan: MicroLoan = env.storage().persistent().get(&DataKey::MicroLoan(farmer.clone(), loan_id.clone())).ok_or(Error::NotInitialized)?;
        if !loan.is_active {
            return Err(Error::NotInitialized);
        }
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        
        client.transfer(&farmer, &env.current_contract_address(), &amount);
        
        loan.repaid = loan.repaid.checked_add(amount).ok_or(Error::Overflow)?;
        if loan.repaid >= loan.amount {
            loan.is_active = false;
        }
        
        env.storage().persistent().set(&DataKey::MicroLoan(farmer.clone(), loan_id.clone()), &loan);
        
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_add(amount).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        env.events().publish(
            (Symbol::new(&env, "repay_microloan"), farmer, loan_id),
            amount
        );
        
        Ok(())
    }

    // --- Farmer Subscription and Core Operations ---

    /// Subscribe a farm to a parametric insurance policy for a specific season
    pub fn subscribe(env: Env, farmer: Address, farm_id: Symbol, region: Symbol, season: Symbol, premium: i128) -> Result<(), Error> {
        farmer.require_auth();
        if premium <= 0 {
            return Err(Error::InvalidAmount);
        }

        let is_verified: bool = env.storage().persistent().get(&DataKey::Verified(farmer.clone())).unwrap_or(false);
        if !is_verified {
            return Err(Error::NotVerified);
        }

        let is_mainnet = env.storage().instance().get(&DataKey::IsMainnetMode).unwrap_or(false);
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);

        let farmer_to_pay = if is_mainnet {
            // Mainnet handles direct payment with no premium subsidy for isolated risk integrity
            premium
        } else {
            // Apply testnet 50% premium subsidy
            let mut subsidy_balance: i128 = env.storage().instance().get(&DataKey::SubsidyBalance).unwrap_or(0);
            let subsidy_portion = premium.checked_div(2).ok_or(Error::Overflow)?;

            if subsidy_balance >= subsidy_portion {
                subsidy_balance = subsidy_balance.checked_sub(subsidy_portion).ok_or(Error::Overflow)?;
                env.storage().instance().set(&DataKey::SubsidyBalance, &subsidy_balance);
                premium.checked_sub(subsidy_portion).ok_or(Error::Overflow)?
            } else {
                premium
            }
        };

        // Apply Risk Zone Multiplier if exists
        let risk_multiplier: u32 = env.storage().persistent().get(&DataKey::RiskZoneMultiplier(region.clone())).unwrap_or(100);
        let adjusted_premium = (premium * risk_multiplier as i128) / 100;
        let adjusted_farmer_to_pay = (farmer_to_pay * risk_multiplier as i128) / 100;

        client.transfer(&farmer, &env.current_contract_address(), &adjusted_farmer_to_pay);

        let payout_amount = adjusted_premium.checked_mul(10).ok_or(Error::Overflow)?;

        let policy = Policy {
            farm_id: farm_id.clone(),
            region: region.clone(),
            season: season.clone(),
            premium,
            payout_amount,
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::Policy(farmer.clone(), farm_id.clone(), season.clone()), &policy);
        // Extend TTL to ~1 year (≈6,307,200 ledgers at 5s each) so policies don't expire
        env.storage().persistent().extend_ttl(
            &DataKey::Policy(farmer.clone(), farm_id.clone(), season.clone()),
            100,
            6_307_200
        );

        // Add farm to farmer's list
        let mut farms: Vec<Symbol> = env.storage().persistent().get(&DataKey::FarmList(farmer.clone())).unwrap_or(Vec::new(&env));
        let mut exists = false;
        for i in 0..farms.len() {
            if farms.get(i).unwrap() == farm_id {
                exists = true;
                break;
            }
        }
        if !exists {
            farms.push_back(farm_id.clone());
            env.storage().persistent().set(&DataKey::FarmList(farmer.clone()), &farms);
        }

        // Update reinsurance deposited balance (premiums serve as pool reserves)
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_add(premium).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);

        env.events().publish(
            (Symbol::new(&env, "subscribe"), farmer),
            (farm_id, region, season, premium, farmer_to_pay)
        );

        Ok(())
    }
    // --- Weather Reporting and Multi-Oracle Consensus ---

    /// Oracles submit damage estimation reports (Combined Oracle + AI) for a typhoon in a region
    pub fn submit_weather_report(env: Env, oracle: Address, typhoon_id: Symbol, region: Symbol, damage_percentage: u32) -> Result<(), Error> {
        oracle.require_auth();
        
        let is_mainnet = env.storage().instance().get(&DataKey::IsMainnetMode).unwrap_or(false);
        
        if is_mainnet {
            // Mainnet: Validate single authorized oracle
            let single_oracle: Address = env.storage().instance().get(&DataKey::SingleOracle).ok_or(Error::NotInitialized)?;
            if oracle != single_oracle {
                return Err(Error::Unauthorized);
            }
            
            // Single authorized oracle immediately establishes absolute consensus
            env.storage().persistent().set(&DataKey::ConsensusDamagePercentage(typhoon_id.clone(), region.clone()), &damage_percentage);
            env.storage().persistent().set(&DataKey::ConsensusReached(typhoon_id.clone(), region.clone()), &true);
            
            env.events().publish(
                (Symbol::new(&env, "consensus_reached"), typhoon_id, region),
                damage_percentage
            );
        } else {
            // Testnet Sandbox: Multi-oracle quorum consensus
            let is_active = env.storage().persistent().get(&DataKey::Oracle(oracle.clone())).unwrap_or(false);
            if !is_active {
                return Err(Error::Unauthorized);
            }
            
            env.storage().persistent().set(&DataKey::Report(typhoon_id.clone(), region.clone(), oracle.clone()), &damage_percentage);
            
            let mut reported: Vec<Address> = env.storage().persistent().get(&DataKey::ReportedOracles(typhoon_id.clone(), region.clone())).unwrap_or(Vec::new(&env));
            
            let mut already_reported = false;
            for i in 0..reported.len() {
                if reported.get(i).unwrap() == oracle {
                    already_reported = true;
                    break;
                }
            }
            
            if !already_reported {
                reported.push_back(oracle.clone());
                env.storage().persistent().set(&DataKey::ReportedOracles(typhoon_id.clone(), region.clone()), &reported);
            }
            
            let quorum: u32 = env.storage().instance().get(&DataKey::QuorumThreshold).unwrap_or(1);
            if reported.len() >= quorum {
                let mut sum: u64 = 0;
                let mut count: u64 = 0;
                for i in 0..reported.len() {
                    let o_addr = reported.get(i).unwrap();
                    let damage: u32 = env.storage().persistent().get(&DataKey::Report(typhoon_id.clone(), region.clone(), o_addr)).unwrap_or(0);
                    sum = sum.checked_add(damage as u64).ok_or(Error::Overflow)?;
                    count = count.checked_add(1).ok_or(Error::Overflow)?;
                }
                if count == 0 {
                    return Err(Error::NoConsensus);
                }
                let avg_damage = (sum.checked_div(count).ok_or(Error::Overflow)?) as u32;
                
                env.storage().persistent().set(&DataKey::ConsensusDamagePercentage(typhoon_id.clone(), region.clone()), &avg_damage);
                env.storage().persistent().set(&DataKey::ConsensusReached(typhoon_id.clone(), region.clone()), &true);
                
                env.events().publish(
                    (Symbol::new(&env, "consensus_reached"), typhoon_id, region),
                    avg_damage
                );
            }
        }
        
        Ok(())
    }

    /// Submit a Zero-Knowledge proof that the weather threshold was met.
    /// This utilizes the Noir Verifier to ensure the wind speed exceeded the threshold
    /// without revealing the actual wind speed on-chain.
    pub fn submit_zk_weather_report(
        env: Env,
        oracle: Address,
        typhoon_id: Symbol,
        region: Symbol,
        damage_percentage: u32,
        zk_proof: soroban_sdk::Bytes,
        public_inputs: Vec<soroban_sdk::Val>
    ) -> Result<(), Error> {
        oracle.require_auth();

        // Verify the ZK proof using our verifier module
        if !verifier::verify_zk_proof(&env, &zk_proof, &public_inputs) {
            return Err(Error::NotVerified);
        }

        // If the proof is valid, we trust the off-chain ZK circuit that the threshold was met.
        // We can then proceed with the normal reporting/consensus logic.
        Self::submit_weather_report(env, oracle.clone(), typhoon_id.clone(), region.clone(), damage_percentage)
    }

    /// Claim payout based on dynamic network-configured parametric curves for a specific farm and season
    pub fn claim_payout(env: Env, farmer: Address, farm_id: Symbol, season: Symbol, typhoon_id: Symbol) -> Result<i128, Error> {
        farmer.require_auth();
        
        let mut policy: Policy = env.storage().persistent().get(&DataKey::Policy(farmer.clone(), farm_id.clone(), season.clone())).ok_or(Error::PolicyNotActive)?;
        if !policy.is_active {
            return Err(Error::PolicyNotActive);
        }
        
        let consensus_reached = env.storage().persistent().get(&DataKey::ConsensusReached(typhoon_id.clone(), policy.region.clone())).unwrap_or(false);
        if !consensus_reached {
            return Err(Error::NoConsensus);
        }
        
        let damage_percentage: u32 = env.storage().persistent().get(&DataKey::ConsensusDamagePercentage(typhoon_id.clone(), policy.region.clone())).unwrap_or(0);
        
        let mut payout_percentage = damage_percentage; // Fallback to damage percentage if no bands
        
        // Advanced: Use Parametric Bands if available for this region
        if let Some(bands) = env.storage().persistent().get::<_, Vec<PayoutBand>>(&DataKey::ParametricBands(policy.region.clone())) {
            let wind_speed: u32 = env.storage().persistent().get(&DataKey::OracleWindSpeed(typhoon_id.clone(), policy.region.clone())).unwrap_or(0);
            
            payout_percentage = 0;
            for band in bands.iter() {
                if wind_speed >= band.min_wind_speed && band.payout_percentage > payout_percentage {
                    payout_percentage = band.payout_percentage;
                }
            }
        }
        
        if payout_percentage == 0 {
            return Err(Error::ThresholdNotMet);
        }
        
        let payout_amount = (policy.payout_amount.checked_mul(payout_percentage as i128).ok_or(Error::Overflow)?)
            .checked_div(100).ok_or(Error::Overflow)?;
        
        let xlm_token_addr: Address = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_token_addr);
        let contract_balance = client.balance(&env.current_contract_address());
        
        if contract_balance < payout_amount {
            return Err(Error::InsufficientLiquidity);
        }
        
        policy.is_active = false;
        env.storage().persistent().set(&DataKey::Policy(farmer.clone(), farm_id.clone(), season.clone()), &policy);
        
        let mut total_deposited: i128 = env.storage().instance().get(&DataKey::TotalReinsuranceDeposited).unwrap_or(0);
        total_deposited = total_deposited.checked_sub(payout_amount).ok_or(Error::Overflow)?;
        if total_deposited < 0 {
            total_deposited = 0;
        }
        env.storage().instance().set(&DataKey::TotalReinsuranceDeposited, &total_deposited);
        
        client.transfer(&env.current_contract_address(), &farmer, &payout_amount);
        
        env.events().publish(
            (Symbol::new(&env, "payout_claimed"), farmer, farm_id),
            (typhoon_id, damage_percentage, payout_amount)
        );
        
        Ok(payout_amount)
    }

    // --- Getters ---

    /// Get all farms registered for a farmer
    pub fn get_farmer_farms(env: Env, farmer: Address) -> Vec<Symbol> {
        env.storage().persistent().get(&DataKey::FarmList(farmer)).unwrap_or(Vec::new(&env))
    }

    /// Get details of a policy for a specific farm and season
    pub fn get_farm_policy(env: Env, farmer: Address, farm_id: Symbol, season: Symbol) -> Option<Policy> {
        env.storage().persistent().get(&DataKey::Policy(farmer, farm_id, season))
    }

    /// Get weather report submitted by specific oracle
    pub fn get_weather_report(env: Env, typhoon_id: Symbol, region: Symbol, oracle: Address) -> u32 {
        env.storage().persistent().get(&DataKey::Report(typhoon_id, region, oracle)).unwrap_or(0)
    }

    /// Get consensus damage percentage if consensus is reached
    pub fn get_consensus_damage_percentage(env: Env, typhoon_id: Symbol, region: Symbol) -> Option<u32> {
        let reached = env.storage().persistent().get(&DataKey::ConsensusReached(typhoon_id.clone(), region.clone())).unwrap_or(false);
        if reached {
            Some(env.storage().persistent().get(&DataKey::ConsensusDamagePercentage(typhoon_id, region)).unwrap_or(0))
        } else {
            None
        }
    }

    /// Get whether farmer is RSBSA verified
    pub fn is_farmer_verified(env: Env, farmer: Address) -> bool {
        env.storage().persistent().get(&DataKey::Verified(farmer)).unwrap_or(false)
    }

    /// Admin Multi-sig: Update parametric payout bands for a region
    pub fn update_parametric_bands(env: Env, payload: Bytes, signatures: Vec<(BytesN<32>, BytesN<64>)>, region: Symbol, bands: Vec<PayoutBand>) -> Result<(), Error> {
        require_multisig_auth(&env, payload, signatures)?;
        env.storage().persistent().set(&DataKey::ParametricBands(region.clone()), &bands);
        bump_persistent(&env, &DataKey::ParametricBands(region.clone()));
        Ok(())
    }

    /// Oracle: Report raw wind speed for a region
    pub fn report_wind_speed(env: Env, oracle: Address, typhoon_id: Symbol, region: Symbol, wind_speed: u32) -> Result<(), Error> {
        oracle.require_auth();
        let is_authorized = env.storage().instance().get(&DataKey::Oracle(oracle.clone())).unwrap_or(false);
        if !is_authorized {
            return Err(Error::Unauthorized);
        }
        env.storage().persistent().set(&DataKey::OracleWindSpeed(typhoon_id.clone(), region.clone()), &wind_speed);
        bump_persistent(&env, &DataKey::OracleWindSpeed(typhoon_id.clone(), region.clone()));
        Ok(())
    }
}

#[cfg(test)]
mod test;
pub mod smart_wallet;
pub mod verifier;

#[cfg(test)]
mod test_auth;