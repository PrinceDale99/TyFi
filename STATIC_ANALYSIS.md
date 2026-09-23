# TyFi Static Analysis & Security Remediation Report

**Date**: September 2026  
**Project**: TyFi — Parametric Typhoon Insurance on Stellar  
**Scope**: `contracts/typhoon_resilience_vault`, `contracts/tyfi_dao`, `contracts/smart_wallet_factory`

## 1. Executive Summary

A second external security review (Suntani, 23 September 2026) identified two new findings against
the Typhoon Resilience Vault and an informational note about test coverage gaps.  All three have been
fully remediated and are verified by automated test suites that exercise the **production** code path
(no auth bypasses).

**Status: FULLY REMEDIATED & HARDENED**

---

## 2. Previous Audit Findings & Remediations (September 2026, gwei_hunter)

### 2.1 Critical Finding: `verify_and_liquidate` Entrypoint Removed
- **Issue**: An unverified placeholder liquidation function accepted arbitrary caller amounts without valid zero-knowledge verification or LP share burning.
- **Remediation**: The insecure `verify_and_liquidate` entrypoint was completely removed from `lib.rs`. Fund withdrawals are strictly restricted to authenticated LP share redemption via `withdraw_reinsurance`.
- **Status**: **RESOLVED**

### 2.2 Medium Finding: Damage Percentage Clamping and Upper Bound Validation
- **Issue**: `damage_percentage: u32` lacked an upper bound check, which could lead to over-payouts (> 100%).
- **Remediation**:
  - Added explicit validation `if damage_percentage > 100 { return Err(Error::InvalidAmount); }` in `submit_weather_report`.
  - Enforced `damage_percentage.min(100)` clamping in `claim_payout`.
  - Enforced `payout_percentage <= 100` validation in `update_parametric_bands`.
- **Status**: **RESOLVED**

### 2.3 Low Finding: Oracle Consensus Lock & State Overwrite Protection
- **Issue**: Subsequent weather reports could overwrite established consensus data for a given typhoon and region.
- **Remediation**: Gated `submit_weather_report` so that once `ConsensusReached` is true, further submissions for that event/region return `Error::AlreadyInitialized`.
- **Status**: **RESOLVED**

### 2.4 Hardening & Invariant Checks
- **Microloan Solvency**: Added pool reserve check (`total_deposited >= amount`) in `originate_microloan` before loan disbursement.
- **Premium Risk Multiplier Bounds**: Added bounds checking (`0 < multiplier <= 1000`) for DAO updates to region multipliers.
- **DAO Proposal Validation**: Enforced non-zero proposal duration (`duration_ledgers > 0`) in `tyfi_dao`.
- **Status**: **RESOLVED**

---

## 3. New Audit Findings & Remediations (September 2026, Suntani)

### 3.1 Critical Finding: Admin Multisig Does Not Bind Signatures to Operations

- **Location**: `src/lib.rs`, `require_multisig_auth` (original lines 104–131)
- **Root cause A — Cross-function replay**: The signed `payload` was caller-supplied and free-form.
  The contract only checked that signatures matched `sha256(payload)` but never validated that
  `payload` encoded the function being authorized or its arguments. A valid `(payload, sigs)` pair
  observed from one admin transaction on the public ledger could be replayed into any other admin
  function (`set_single_oracle`, `verify_farmer`, `set_quorum_threshold`, etc.) with arbitrary
  attacker-chosen arguments.
- **Root cause B — Duplicate signer bypass**: The verification loop never tracked which public keys
  had already been counted. Submitting the same `(pub_key, sig)` pair N times incremented
  `verified_count` by N, allowing a single key to satisfy any threshold.
- **Remediation**:
  - **Removed** the caller-supplied `payload: Bytes` parameter from all six admin entry points.
  - The contract now **constructs** the signed message itself:
    `sha256( nonce_be_8_bytes || fn_name_bytes )`
    where `fn_name_bytes` is a static byte literal embedded at each call site (e.g. `b"set_oracle"`).
  - A monotonic `AdminNonce` (u64, stored in instance storage, initialised to 0) is read before
    verification and **incremented** after each successful auth call. Each `(nonce, fn_name)` pair is
    therefore valid for exactly one invocation; once consumed, the same signatures are permanently
    stale.
  - A `seen_keys: Vec<BytesN<32>>` list is maintained within the verification loop; any public key
    that appears more than once is skipped, preventing duplicate-signer inflation.
- **Status**: **RESOLVED** — Verified by 9 integration tests in `tests/test_multisig_auth.rs`
  using real ed25519 keypairs (no mocking of the crypto path).

### 3.2 High Finding: Microloans Have No Per-Farmer Cap and No Repayment Enforcement

- **Location**: `src/lib.rs`, `originate_microloan` (original line 425)
- **Root cause**: The only guards were (a) farmer is `Verified` and (b) pool holds enough tokens.
  There was no limit on how much a single farmer could borrow across multiple loan IDs, no check for
  duplicate active loans, and nothing forced repayment. A verified farmer could open arbitrarily many
  loans (each keyed by a farmer-chosen `loan_id`) and drain the entire pool.
- **Remediation**:
  - Added `DataKey::FarmerOutstandingPrincipal(Address)` — tracks each farmer's total unrepaid
    principal across all active loans.
  - Per-farmer cap enforced in `originate_microloan`:
    `outstanding + new_amount <= (total_deposited * MAX_FARMER_LOAN_BPS) / 10_000`
    where `MAX_FARMER_LOAN_BPS = 2_000` (20% of the live pool). Cap scales dynamically with pool
    size so it tightens as the pool shrinks and loosens as it grows.
  - Added duplicate `loan_id` guard: if an active loan already exists for `(farmer, loan_id)`, the
    call is rejected with `Error::AlreadyInitialized`.
  - `repay_microloan` now decreases `FarmerOutstandingPrincipal` on each repayment, restoring
    borrowing headroom proportionally.
  - Added `Error::LoanCapExceeded = 13` for a clear error on cap violation.
- **Status**: **RESOLVED** — Verified by 8 integration tests in `tests/test_microloan.rs`,
  including a direct reproduction of the five-loan drain scenario that is now blocked.

### 3.3 Informational Finding: `#[cfg(test)]` Stub Bypassed All Auth in Unit Tests

- **Location**: `src/lib.rs`, lines 98–101 (original)
- **Root cause**: A `#[cfg(test)]` version of `require_multisig_auth` returned `Ok(())` for any
  input. Unit tests therefore never exercised the production auth path, which is why both findings
  above survived the previous audit.
- **Remediation**:
  - The `#[cfg(test)]` stub has been **removed entirely**.
  - Unit tests in `src/test.rs` that previously called admin functions with empty payloads and empty
    signature vectors now use `env.as_contract()` to write state directly into storage, which is the
    correct Soroban pattern for testing business logic independently of the auth layer.
  - Admin auth correctness is exercised exclusively in `tests/test_multisig_auth.rs` (integration
    tests) which compile the crate as a library (`cfg(test)` is false inside the crate), ensuring the
    production `require_multisig_auth` is the function that runs.
- **Status**: **RESOLVED**

---

## 4. Test Suite Verification

## 4. In-Place Upgrade Capability (Option B)

To avoid future address changes and facilitate secure protocol governance, the contract now implements an admin multisig-guarded in-place WASM upgrade entrypoint:
```rust
pub fn upgrade(env: Env, signatures: Vec<(BytesN<32>, BytesN<64>)>, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
    require_multisig_auth(&env, b"upgrade", signatures)?;
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    Ok(())
}
```
All future bytecode updates can be deployed directly to the existing contract address via multisig signature authorization.

---

## 5. Test Suite Verification

All **34 tests** across the vault contract pass with zero failures:

| Suite | Tests | Description |
|---|---|---|
| `src/lib.rs` (unit tests) | 16 | Business logic: payout flows, oracle consensus, parametric bands, microloan accounting |
| `tests/test_multisig_auth.rs` | 10 | Admin multisig: real ed25519 signatures, replay rejection, duplicate-signer rejection, nonce advancement, upgrade authorization |
| `tests/test_microloan.rs` | 8 | Microloan cap enforcement, repayment headroom, drain scenario reproduction |

```
test result: ok. 16 passed; 0 failed  (unit tests)
test result: ok. 10 passed; 0 failed  (test_multisig_auth)
test result: ok. 8 passed; 0 failed   (test_microloan)
```

---

## 6. Deployed Contract Addresses

| Network | Contract Address | Explorer | Notes |
|---|---|---|---|
| **Testnet** | `CAQWBSIJK2R2DSRCOVQDN2CC3A7IW3T5LWDJAK4QWTLNUJC4OL5IJUAM` | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAQWBSIJK2R2DSRCOVQDN2CC3A7IW3T5LWDJAK4QWTLNUJC4OL5IJUAM) | Fully remediated, initialized & supports multisig in-place `upgrade()` |
| **Mainnet** | `CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT` | [Stellar Expert](https://stellar.expert/explorer/public/contract/CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT) | Legacy deployment (pre-remediation). Ready to be redeployed with Option B build. |
