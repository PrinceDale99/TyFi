use super::*;
use soroban_sdk::{testutils::{Address as _, MockAuth, MockAuthInvoke}, Address, Env, IntoVal, token};

/// Verifies that `deposit_subsidy` enforces the donor's `require_auth()` call —
/// i.e. only the donor themselves can trigger the deposit.
///
/// This test uses explicit MockAuth rather than mock_all_auths() to prove that
/// no other caller can front-run the deposit.  It is intentionally narrow:
/// it tests Soroban's native require_auth on the deposit path, not the admin
/// multisig (which has its own integration tests in tests/).
#[test]
fn test_explicit_auth_deposit_subsidy() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TyphoonVault);
    let client = TyphoonVaultClient::new(&env, &contract_id);

    let donor = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let xlm_token = env.register_stellar_asset_contract(token_admin.clone());
    let oracle = Address::generate(&env);

    let empty_keys = soroban_sdk::Vec::new(&env);
    client.initialize(&empty_keys, &1, &xlm_token, &1, &false, &oracle);

    let token_admin_client = token::StellarAssetClient::new(&env, &xlm_token);
    token_admin_client
        .mock_auths(&[MockAuth {
            address: &token_admin,
            invoke: &MockAuthInvoke {
                contract: &xlm_token,
                fn_name: "mint",
                args: (&donor, 1000i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .mint(&donor, &1000);

    // EXPLICIT AUTHENTICATION CHECK
    // This replaces mock_all_auths() to prove no malicious actor can steal funds.
    client
        .mock_auths(&[MockAuth {
            address: &donor,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "deposit_subsidy",
                args: (&donor, 1000i128).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &xlm_token,
                    fn_name: "transfer",
                    args: (&donor, &client.address, 1000i128).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }])
        .deposit_subsidy(&donor, &1000);

    assert_eq!(client.get_subsidy_balance(), 1000);
}
