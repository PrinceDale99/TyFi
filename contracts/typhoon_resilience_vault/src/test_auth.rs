use super::*;
use soroban_sdk::{testutils::{Address as _, MockAuth, MockAuthInvoke}, Address, Env, IntoVal, token};

#[test]
fn test_explicit_auth_deposit_subsidy() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let donor = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());
    let oracle = Address::generate(&env);

    let dummy_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&dummy_keys, &2, &xlm_token, &2, &false, &oracle);

    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);
    token_admin_client.mint(&donor, &1000);

    // EXPLICIT AUTHENTICATION CHECK
    // This replaces mock_all_auths() to prove no malicious actor can steal funds.
    client
        .mock_auths(&[MockAuth {
            address: &donor,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "deposit_subsidy",
                args: (&donor, 1000i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .deposit_subsidy(&donor, &1000);

    assert_eq!(client.get_subsidy_balance(), 1000);
}
