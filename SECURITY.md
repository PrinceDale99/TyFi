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

### Reporting a Vulnerability
Please reach out to the core team directly before disclosing any vulnerability publicly. See the main repository for contact information.
