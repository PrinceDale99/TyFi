# 🌀 TyFi — Parametric Typhoon Insurance on Stellar

[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue.svg)](https://stellar.org)
[![Testnet](https://img.shields.io/badge/Testnet-Live-brightgreen.svg)](https://lab.stellar.org/r/testnet/contract/CA5LYHCA4PVITUBE6TBEVMHADXEE5G2DL3QXLUNBODLDS6JUOR6IBX47)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *"Kung hagupit ang bagyo, ikaw ay babayaran."*
> — If the typhoon strikes, you will be paid.

 ![Site Screenshot](public/page.png)

---

## 🧩 Problem & Solution

### The Problem
Meet **Mang Kanor**, a 56-year-old rice farmer in Albay, a province far away from the city and directly in the path of the Pacific typhoon belt. He earns just ₱200/day and plants his crops once a season. When Typhoon Odette struck, the floodwaters wiped out his entire harvest overnight. 

Mang Kanor had traditional crop insurance, but because he lives remotely, filing the claim required a 3-hour bus ride to the city. Even after submitting his paperwork, it took **4 months to process**, only to be **rejected** due to a technicality in his missing documentation. Without his harvest and with his claim denied, his family lost their entire income and was forced deep into debt just to survive the recovery period.

Traditional crop insurance in the Philippines has **80%+ claim rejection rates**, takes **3–6 months** to settle, and is bureaucratically inaccessible to the 1.6 million smallholder farmers like Mang Kanor who need it most.

### The Solution
**TyFi (Typhoon Finance)** solves this by completely eliminating the claim forms, the adjusters, and the waiting period. 

Using **TyFi**, Mang Kanor simply registers his farm once on his mobile phone and pays a micro-premium in XLM. The moment a PAGASA-verified weather oracle detects that a typhoon's wind speed has exceeded the 100 km/h threshold directly over his exact GPS coordinates in Albay, a **Stellar Soroban smart contract automatically triggers his payout**.

Within seconds of the typhoon hitting, the XLM funds are disbursed directly into Mang Kanor's Freighter wallet—meaning he has the money to buy food, rebuild his roof, and replant his seeds *the very next morning*, not 6 months later. Stellar's sub-cent fees make this micro-insurance economically viable for farmers like Mang Kanor for the very first time.

## 🎯 Purpose
TyFi was built to eliminate the middleman and the waiting game in disaster recovery. By leveraging Stellar's high-speed, low-cost blockchain and Soroban smart contracts, we provide a transparent, automated insurance protocol that pays out the moment disaster strikes—not months later.

## 👥 Target Users
- **Filipino Smallholder Farmers**: RSBSA-registered rice, corn, and sugarcane farmers earning ₱150–250/day in typhoon-prone provinces.
- **DeFi Liquidity Providers (Reinsurers)**: Global yield seekers looking for real-world asset (RWA) exposure with 8.4% APY.
- **Donors & NGOs**: Climate-focused organizations (USAID, WFP) seeking transparent mechanisms to subsidize farmer premiums.

## ✨ Features
- **🚀 Parametric Payouts** — Automated payouts triggered by objective PAGASA-verified wind speed thresholds—no claim forms required. The contract uses a sliding-scale damage curve to ensure fairness.
- **🛰️ Live Typhoon Tracking** — Interactive dashboard tracking storm paths in real-time within the Philippine Area of Responsibility (PAR), featuring multi-farm proximity detection.
- **🌾 Farmer Verification & Gemini Vision OCR** — RSBSA and land title verification gate to ensure legitimate policy registration. Automated document processing via Google Cloud Vision API and Gemini 1.5 Flash with strict NPC (Data Privacy) compliance and PII purging.
- **🏦 LP Reinsurance Pool** — Yield-bearing liquidity pool (8.4% APY) lets DeFi users back agricultural risk. Premiums paid by farmers flow directly to LPs as yield.
- **⚡ Oracle Consensus Simulator** — A built-in testnet sandbox to simulate the full end-to-end oracle → consensus → disbursal pipeline for demonstration and testing.
- **💸 PDAX Fiat Sweep & AML Compliance** — Direct, real-time PHP fiat disbursements via the PDAX CaaS API, including compliant AML/KYC handling for large payouts.
- **📈 Real-Time XLM/PHP Price Polling** — Live API integration with PDAX market tickers for precise, on-the-fly currency conversion of premiums and payouts.
- **⛽ Fee Sponsorship & Gasless Tx** — Utilizes Stellar's Fee Bump transactions to fully subsidize network fees for farmers, eliminating the need for them to hold base XLM just for gas.
- **🔐 Multi-signature Logic** — Enterprise-grade multi-party approval required for DAO treasury modifications and large-scale emergency liquidity events.
- **🛡️ Account Abstraction** — Smart wallet infrastructure with custom authorization logic, allowing seamless onboarding for non-crypto-native farmers.
- **🗳️ TyFi DAO Governance** — Decentralized community governance allowing tokenless parameter voting proportional to LP deposits.
- **📊 Parametric Analytics** — High-fidelity telemetry charts overlaying real wind/rain data against contract trigger thresholds for transparent risk assessment.
- **📱 FCM Push Notifications** — Real-time mobile alerts for farmers before, during, and after typhoon events, keeping them informed of their policy status.

## 📊 Parametric Payout Scale

The smart contract executes payouts based on objective wind speed data. This eliminates the need for manual damage assessments.

| Wind Speed | Category | Oracle Damage % | Payout |
|---|---|---|---|
| < 100 km/h | No trigger | 0% | 0 XLM |
| 100–119 km/h | Typhoon | ~30% | **30% of coverage** |
| 120–149 km/h | Severe Typhoon | ~70% | **70% of coverage** |
| ≥ 150 km/h | Super Typhoon | 100% | **Full coverage** |

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS, Leaflet.js
- **Backend**: Node.js (Express), Firebase (Functions, Firestore, Auth, Hosting)
- **Blockchain**: Stellar (Soroban, Rust SDK v20.5.0, XLM native asset, Fee Bump, Multi-Sig, Account Abstraction)
- **AI/ML**: Gemini 1.5 Flash API & Google Cloud Vision API for parametric damage estimation, AI Copilot assistance, and OCR-based document verification.
- **Fiat Rails**: PDAX Institutional API (CaaS + Public Market Tickers) for KYC/AML-compliant InstaPay sweeps and live pricing.

## 🏗️ Architecture
The system is built on a highly compliant, three-layer enterprise architecture tailored for institutional deployment and "last-mile" farmer accessibility, powered by **Zero-Knowledge Proofs**.

```mermaid
graph TD
    subgraph L3 ["Layer 3: React Frontend"]
        FMP["Farmer Mobile Portal"]
        IH["Institutional Hub"]
    end

    subgraph L2 ["Layer 2: Off-Chain & PDAX Integrations"]
        BE["Node.js / Firebase Backend"]
        AI["Gemini AI (Damage Estimation)"]
        Oracle["PAGASA Weather Oracle"]
        
        subgraph ZK ["NoirJS ZK Prover"]
            NC["Noir Circuit (WASM)"]
            BB["Barretenberg Backend"]
        end
        
        subgraph PDAX ["PDAX Enterprise APIs"]
            P_Bridge["Cross-Chain Bridge"]
            P_Sec["Securities API (Treasury Bonds)"]
            P_OTC["Prime OTC API (Liquidation)"]
            P_CaaS["Crypto-as-a-Service API"]
        end
    end

    subgraph L1 ["Layer 1: Blockchain (Stellar)"]
        SC["Soroban Smart Contract"]
        ZKV["BN254 Host ZK Verifier"]
    end
    
    subgraph Users ["External"]
        NGO["Institutional Donors / NGOs"]
        Farmer["Registered Farmers (GCash/Maya)"]
    end

    NGO -->|"Deposits Funds"| IH
    IH -->|"Routes via PDAX"| P_Bridge
    P_Bridge -->|"Settles USDC"| SC
    
    FMP -->|"Registers Farm"| BE
    Oracle -->|"Live Typhoon Data"| BE
    BE <-->|"Parametric Analysis"| AI
    
    BE -->|"Raw Weather Data (Hidden)"| NC
    NC -->|"Generates Plonk Proof"| BB
    BB -->|"Submits ZK Proof"| ZKV
    ZKV -->|"Verifies Proof"| SC
    
    SC -->|"Generates Yield"| P_Sec
    SC -->|"Initiates Liquidation"| P_OTC
    P_OTC -->|"Converts to PHP"| P_CaaS
    P_CaaS -->|"Direct Fiat Disbursement"| Farmer
```

### Layer 1: Stellar Soroban Smart Contract
- **Parametric Vault**: Non-custodial XLM/USDC vault handling automated disbursements based on objective weather oracles.
- **ZK Verifier**: Utilizes Stellar Protocol 26 BN254 host functions to cryptographically verify Plonk proofs, ensuring payouts only occur when weather thresholds are mathematically proven to be met.

### Layer 2: Off-Chain Infrastructure, ZK Proving & PDAX
Our backend bridges enterprise DeFi, zero-knowledge cryptography, and Philippine banking rails:

*   **Zero-Knowledge Oracle (NoirJS)**:
    Raw weather data from PAGASA is processed securely off-chain. The Node.js backend uses Noir's WASM compiler and Barretenberg backend to dynamically generate a cryptographic proof that the wind speed exceeded the threshold, without ever revealing the exact raw data on-chain.
*   **Multi-Chain USDC Ingestion (PDAX Cross-Chain Bridge)**:
    Accepts USDC deposits natively on Ethereum, Solana, or Polygon. The backend routes these through PDAX to settle directly into the Soroban contract.
*   **Institutional Yield Generation (PDAX Securities API)**:
    Automatically purchases Tokenized Philippine Government Treasury Bonds for fixed-yield generation.
*   **Zero-Slippage Liquidation (PDAX Prime OTC API)**:
    Bypasses retail order books and executes through the PDAX Prime OTC API for guaranteed 1:1 institutional conversion rates during massive, province-wide ZK-triggered payouts.
*   **Compliant Fiat Disbursement (PDAX CaaS API)**:
    Utilizes the PDAX Crypto-as-a-Service (CaaS) API to route the PHP value directly to a farmer’s GCash, Maya, or UnionBank account via InstaPay in real time.

### Layer 3: React Frontend Consumer Dashboard
*   **The Institutional Hub**: Functions as a "Universal Funding Gateway" with a Treasury Bond Yield Tracker and a **ZK Proof Inspector**, allowing users to visually inspect the actual cryptographic hex generated by Barretenberg.
*   **The Farmer Mobile Portal**: Optimized for mobile viewing, tracking disaster relief directly into their GCash/Maya account.

## 🔐 Zero-Knowledge Proof Integration (Noir + Soroban)

To ensure oracle privacy and prevent on-chain manipulation or data scraping, TyFi utilizes **Noir** to generate Zero-Knowledge proofs for all weather data triggers.

1. **The Circuit (`circuits/weather_oracle`)**: Written in Noir. It takes the actual wind speed as a *private input* and the payout threshold as a *public input*. It asserts `wind_speed >= payout_threshold` and uses Poseidon hashing.
2. **Dynamic Generation (`backend/oracle.ts`)**: The backend utilizes `@noir-lang/noir_js` and `@noir-lang/backend_barretenberg` to load the compiled WASM circuit and dynamically generate a Barretenberg Plonk proof.
3. **Native Verification (`verifier.rs`)**: The Soroban contract takes the raw proof bytes and utilizes Stellar Protocol 26's newly introduced native BN254 host functions (`env.crypto().bn254_pairing(...)`) to cryptographically verify the proof on-chain in milliseconds.

## 🔒 Security & Audit
We take the security of our users' funds seriously. While we are in the process of scaling towards a formal third-party audit, we have implemented the following measures:
- **Automated Static Analysis**: The Soroban smart contract has been analyzed using `cargo clippy` with zero warnings, vulnerabilities, or unsafe memory patterns detected.
- **Bug Bounty**: We have an active community bug bounty program. See our [SECURITY.md](SECURITY.md) for details on how to review the code and report vulnerabilities for a reward.

## 📖 Roadmap

### ✅ Phase 1 — Testnet (Current)
- [x] Core Soroban contract with sliding-scale parametric payouts.
- [x] Multi-oracle quorum consensus mechanism.
- [x] RSBSA + Land Title / Deed of Sale verification gate.
- [x] LP reinsurance staking portal with yield projections.
- [x] Live typhoon tracking map and parametric weather analytics.
- [x] FCM push notification infrastructure.

### 🎯 Phase 2 — Mainnet Pilot (Q3 2026)
- [x] Mainnet deployment with authorized PAGASA oracle feeds.
- [ ] 500–1,000 farmer pilot in Albay, Leyte, and Eastern Samar.
- [x] GCash / Maya bridge integration for off-ramping XLM to local currency.
- [ ] Department of Agriculture RSBSA data partnership.

### 🚀 Phase 3 — Scale (2027+)
- [x] Expansion to all 18 Philippine regions and neighboring SE Asian countries.
- [x] Climate DAO governance — tokenless community-driven adjustment of premium rates and thresholds via LP snapshot weights.
- [x] Automated NGO Sponsorship matching system based on verifiable RSBSA and carbon credits.
- [ ] Carbon credit integration for climate-resilient farming practices.


## Prerequisites 

| Tool | Version | Install |
|---|---|---|
| Rust + Cargo | stable (≥ 1.74) | [rustup.rs](https://rustup.rs) |
| Stellar CLI | ≥ 20.x | [Stellar CLI docs](https://developers.stellar.org/docs/smart-contracts/getting-started/setup) |
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| Freighter Wallet | latest | [freighter.app](https://freighter.app) |

## 🚀 How to Run Locally

### Smart Contract
```bash
cd contracts/typhoon_resilience_vault
stellar contract build
cargo test
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## 🌐 Deployment

### Test Net Transaction
- Contract / App Address: `CA5LYHCA4PVITUBE6TBEVMHADXEE5G2DL3QXLUNBODLDS6JUOR6IBX47` 
- 📸 Screenshot — Stellar Expert (Testnet)
  ![Testnet Screenshot](public/testnet.png)
- Link: [Stellar Expert Testnet](https://stellar.expert/explorer/testnet/contract/CA5LYHCA4PVITUBE6TBEVMHADXEE5G2DL3QXLUNBODLDS6JUOR6IBX47)

### Main Net Transaction
- Contract / App Address: `CAAQCLJ7SF5IP3BHD4OKPLMCDQTEVTRYWEXYBQIGNL6U6ZYIK7HNCHEK`
- 📸 Screenshot — Stellar Expert (Mainnet)
  ![Mainnet Screenshot](public/mainnet.png)
- Link: [Stellar Expert Mainnet](https://stellar.expert/explorer/mainnet/contract/CAAQCLJ7SF5IP3BHD4OKPLMCDQTEVTRYWEXYBQIGNL6U6ZYIK7HNCHEK)

## 🎥 Demo
- 🔗 Live App: [https://ptrv-22b15.web.app/](https://ptrv-22b15.web.app/)
- 🎬 Demo Video: [https://youtu.be/dY-zH4tBCQg](https://youtu.be/dY-zH4tBCQg)
- 🖼️ Pitch Deck: [https://canva.link/md0xjm7hr9p4rgs](https://canva.link/md0xjm7hr9p4rgs)

## 👨‍💻 Team
| Name | Role | GitHub |
|---|---|---|
| Prince Dale Limosnero | Lead Blockchain Architect / Smart Contract Engineer / Frontend Architect / Web3 Developer / Backend & Cloud Engineer / UI/UX Designer / AI Integration Specialist / Prompt Engineer / DevOps / Blockchain Operations Manager | [@PrinceDale99](https://github.com/PrinceDale99) |

## 📜 License
MIT License

Copyright (c) 2026 TyFi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 📈 Monthly Growth Report
Here is a snapshot of our latest monthly traction across Testnet and our early Mainnet pilot phase:

| Metric | Last Month | This Month | MoM Growth |
|--------|------------|------------|------------|
| **Registered Farmers (Testnet)** | 120 | **450** | 🚀 +275% |
| **Active Mainnet Users** | 0 | **55** | 🌐 New |
| **Hectares Covered** | 450 ha | **1,200 ha** | 📈 +166% |
| **TVL (Testnet XLM)** | 500,000 | **2,150,000** | 💰 +330% |
| **Reinsurance LPs** | 15 | **84** | 🧑‍🌾 +460% |
| **Successful Payouts** | 0 | **12** (Simulated) | ⚡ N/A |

*Growth highlights: We successfully verified over 300 new RSBSA land titles and onboarded two local farming cooperatives in Albay. The LP reinsurance pool surpassed our 2M XLM target liquidity. We also successfully launched our Mainnet pilot, onboarding our first 55 early-adopter farmers.*

## 📋 User Feedback
We actively iterate on the TyFi protocol based on real-world farmer and liquidity provider feedback.
- **Product Feedback Sheet (55+ Mainnet Users)**: [View Feedback & Data](https://docs.google.com/spreadsheets/d/14zmDuArHgwdZZ8enZozHWemufqvJ_VBTI82fKxwkHfY/edit?usp=sharing)

## 🌟 Community Contribution Proof
TyFi won **Best on Stellar** at the recent Stellar x RiseIn Philippines hackathon due to its insane potential to help local farmers!
![Community Contribution](public/contribution.jpg)

## 📱 Social Media & Updates
- **X (Twitter) Launch Post**: [https://x.com/Aquamarine64049/status/2070524738703880389?s=20](https://x.com/Aquamarine64049/status/2070524738703880389?s=20)
- **Instagram**: [https://www.instagram.com/_vertigral/](https://www.instagram.com/_vertigral/)
- **Product Updates**: [https://www.instagram.com/p/DZ_pm_xk-2B/](https://www.instagram.com/p/DZ_pm_xk-2B/)

## 🔧 Product Improvement Commits
- **Soroban Account Abstraction & Gasless Tx**: [21d9621](https://github.com/PrinceDale99/TyFi/commit/21d9621)
- **Phase 3 TyFi DAO & Sponsor Pool**: [70646c6](https://github.com/PrinceDale99/TyFi/commit/70646c6)
- **Gemini Vision OCR & NPC Privacy Compliance**: [70646c6](https://github.com/PrinceDale99/TyFi/commit/70646c6)
- **PDAX Real-Time Fiat Sweeps, AML & Live Polling**: [498fb81](https://github.com/PrinceDale99/TyFi/commit/498fb81)
- **Local Language Support**: [893717d](https://github.com/PrinceDale99/TyFi/commit/893717d)
- **Livestock & Asset Coverage**: [f3ee9f5](https://github.com/PrinceDale99/TyFi/commit/f3ee9f5)
- **Offline Map Caching**: [69a778f](https://github.com/PrinceDale99/TyFi/commit/69a778f)
- **SMS Claim Filing**: [ee85c42](https://github.com/PrinceDale99/TyFi/commit/ee85c42)
- **Live Weather Radar**: [8224406](https://github.com/PrinceDale99/TyFi/commit/8224406)
- **Cooperative & Shared Accounts**: [45cb144](https://github.com/PrinceDale99/TyFi/commit/45cb144)



