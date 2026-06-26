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

## Bug Bounty Program

TyFi is committed to the security of our farmers and liquidity providers. We invite the developer community to review our Soroban smart contract.

If you discover a critical vulnerability (e.g., unauthorized fund withdrawal, oracle manipulation), please report it to us immediately. 
Valid bug reports that lead to a code fix may be eligible for a reward in XLM or USDC.

### Reporting a Vulnerability
Please reach out to the core team directly before disclosing any vulnerability publicly. See the main repository for contact information.
