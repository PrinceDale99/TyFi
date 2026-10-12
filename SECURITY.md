# NOTICE TO THE PUBLIC: OUR BUG BOUNTY PROGRAM IS CURRENTLY CLOSED DUE TO ONGOING DEVELOPMENT

# 🏆 Security Hall of Fame

The TyFi protocol is built on transparency, resilience, and community trust. We are deeply grateful to the independent security researchers and white-hat hackers who dedicate their time and expertise to reviewing our Soroban smart contracts. 

Their proactive disclosures are critical to securing our infrastructure and protecting our farmers.

Below is a list of individuals who have made significant contributions to the security of the TyFi protocol.

### 2026

* **[gwei_hunter]** 
  * **Date:** September 2026
  * **Severity:** CRITICAL
  * **Contribution:** Conducted a comprehensive audit of the Typhoon Resilience Vault prior to scaled deployment. Responsibly disclosed a critical vulnerability bypassing zero-knowledge proof verification, alongside medium and low-severity findings regarding oracle data clamping and consensus finalization locks. Their exceptional work successfully prevented a potential mainnet exploit.


# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Automated Static Analysis

We utilize standard Rust security and linting tools to ensure the integrity of our smart contracts.

### Cargo Clippy
The Soroban smart contract was analyzed using `cargo clippy` with strict linting rules.
**Result:** No warnings, vulnerabilities, or unsafe memory patterns detected. The build compiles cleanly.

TyFi is committed to the security of our farmers and liquidity providers. We invite the developer community to review our Soroban smart contract.

If you discover a critical vulnerability (e.g., unauthorized fund withdrawal, oracle manipulation), please report it to us immediately.

## Seedless Passkey Wallets (Week 3)

`smart_wallet` and `smart_wallet_factory` were added in Week 3. Their full threat model is in [docs/passkey-architecture.md](docs/passkey-architecture.md). Key invariants:

- **Passkey-only authorization.** `__check_auth` accepts only WebAuthn secp256r1 assertions verified with the native `secp256r1_verify` host function; there is no Ed25519 or admin bypass.
- **Biometric required.** Assertions without the User Verified (UV) flag are rejected on-chain.
- **Exact payload binding.** The WebAuthn challenge must equal the Soroban signature payload (invocation + nonce + expiry); replay is prevented by host nonces.
- **Sponsor can never authorize.** The relayer rejects source-account credentials, the sponsor as an authorizer, and any assembly that adds authorization not signed by a passkey. Fees are capped per transaction and endpoints are rate limited per client IP.
- **No lockout.** The last passkey on a wallet cannot be removed.

**Static analysis:** `cargo clippy -p smart_wallet -p smart-wallet-factory --all-targets` reports no warnings. **Tests:** 42 contract tests (real P-256 signatures, no mocked crypto), 14 relayer unit tests, 10 frontend unit tests, and a browser end-to-end test against testnet.

**Status:** testnet only. Mainnet passkey wallets stay disabled until an independent audit.

### Reporting a Vulnerability
Please reach out to the core team directly before disclosing any vulnerability publicly. See the main repository for contact information.
