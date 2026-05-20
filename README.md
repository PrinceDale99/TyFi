# 🌀 TyFi — Parametric Typhoon Insurance on Stellar

[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue.svg)](https://stellar.org)
[![Testnet](https://img.shields.io/badge/Testnet-Live-brightgreen.svg)](https://lab.stellar.org/r/testnet/contract/CB62WJ6VDF4JSYX6DWOPPYFBCM4ULM2WX4CEJADZCHSY7RLUFBVP2GFW)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *"Kung hagupit ang bagyo, ikaw ay babayaran."*
> — If the typhoon strikes, you will be paid.

---

## 📌 Project Overview

**TyFi** (Typhoon Finance) is a **decentralized parametric crop insurance protocol** built on Stellar Soroban that automatically pays Filipino smallholder farmers in XLM within minutes of a typhoon crossing a verified wind-speed threshold — no claim forms, no adjusters, no waiting.

---

## 🎯 Problem & Solution

### Problem

> A rice farmer in Albay earns ₱200/day and plants once a season — when Typhoon Odette wiped out his harvest in 2021, he filed an insurance claim that took 4 months to process, was rejected due to missing documentation, and lost his entire family's income with no recourse, leaving him deeper in debt than before the storm.

Traditional crop insurance in the Philippines has **80%+ claim rejection rates**, takes **3–6 months** to settle, and is bureaucratically inaccessible to the 1.6 million smallholder farmers who need it most.

### Solution

> TyFi lets a verified Filipino farmer pay a small XLM premium on-chain, and the moment PAGASA-verified oracle data confirms a typhoon exceeds 100 km/h over their registered region, a Soroban smart contract autonomously transfers their full payout in XLM directly to their Freighter wallet — because Stellar's 5-second finality and sub-cent fees make real-time parametric insurance for ₱200/day earners economically viable for the first time.

Stellar is **essential** — not optional. Sub-cent fees mean premiums aren't eaten by gas costs. 5-second finality means payouts arrive before the storm does. The native asset (XLM) removes bridge risk entirely for users who cannot afford to lose funds to a failed cross-chain transaction.

---

## ⛓️ Stellar Features Used

| Feature | How TyFi Uses It |
|---|---|
| **XLM transfers** | Premium payments and parametric payout disbursements — all in native XLM |
| **Soroban smart contracts** | Core insurance vault: policy issuance, oracle consensus, and auto-payout logic |
| **Trustlines** | Farmer wallet authorization gate (Freighter wallet must connect to interact) |
| **Soroban Events** | On-chain event emission (`payout_claimed`, `consensus_reached`) polled by the backend listener for FCM push notifications |

> **Not used**: Custom tokens, Built-in DEX, Clawback/Compliance — TyFi deliberately uses only native XLM to eliminate additional trust assumptions for low-income users.

---

## 👥 Target Users

### Primary: Filipino Smallholder Farmers
- **Who**: RSBSA-registered rice, corn, and sugarcane farmers, earning ₱150–250/day
- **Where**: Typhoon-prone provinces — Albay, Leyte, Eastern Samar, Surigao del Sur
- **Why they care**: A single typhoon erases a season's income; they need money *during* recovery, not 6 months later

### Secondary: DeFi Liquidity Providers (Reinsurers)
- **Who**: Crypto-native yield seekers looking for real-world asset exposure
- **Where**: Global (no geographic restriction)
- **Why they care**: 8.4% APY yield from premium pools backed by weather risk, not speculative volatility

### Tertiary: Donors & NGOs
- **Who**: Climate-focused organizations (USAID, World Food Programme, local LGUs)
- **Why they care**: Subsidy pool mechanism lets them directly reduce farmer premium burden on-chain, with transparent, auditable impact

---

## 🚀 Core Feature — MVP Demo Flow

**The end-to-end transaction that proves TyFi works:**

```
1. Farmer connects Freighter wallet → admin calls verify_farmer() → farmer is RSBSA-gated on-chain
         ↓
2. Farmer calls subscribe(farm_id="FARM001", region="albay", season="wet2025", premium=10 XLM)
   → Contract pulls 10 XLM from farmer wallet → Policy stored on-chain with payout_amount = 100 XLM
         ↓
3. Oracle submits: submit_weather_report(typhoon_id="odette2", region="albay", damage_percentage=70)
   → Quorum reached → consensus_reached event emitted on-chain
         ↓
4. Farmer calls claim_payout(farm_id="FARM001", season="wet2025", typhoon_id="odette2")
   → Contract calculates: 100 XLM × 70% = 70 XLM
   → XLM transferred to farmer wallet in < 10 seconds
   → payout_claimed event emitted → backend listener triggers FCM push notification to farmer's phone
```

**Demo-able in under 2 minutes** using the Oracle Consensus Simulator tab in the live UI.

---

## 🏆 Why This Wins

TyFi directly targets Stellar's mission of **financial inclusion for the unbanked** — deploying a complete, functional DeFi primitive (parametric insurance) to one of the world's most disaster-exposed populations using Stellar's unique combination of speed, cost, and accessibility. Judges see a live testnet contract, a polished production UI, real weather oracle integration, and a go-to-market strategy with named pilot regions — not a proof of concept, but a protocol ready for a 500-farmer pilot the moment the hackathon ends.

---

## 🗺️ How It Works

```
Farmer registers → Uploads land title / deed of sale → Pays premium → Policy activates
         ↓
Weather oracle monitors wind speed & rainfall in real-time (Open-Meteo + PAGASA)
         ↓
Typhoon data submitted → Multi-oracle consensus OR single mainnet oracle validates
         ↓
Soroban contract auto-executes → XLM disbursed proportionally to damage %
         ↓
Farmer receives payout within minutes, not months
```

### Parametric Payout Scale

| Wind Speed | Category | Oracle Damage % | Payout |
|---|---|---|---|
| < 100 km/h | No trigger | 0% | 0 XLM |
| 100–119 km/h | Typhoon | ~30% | **30% of coverage** |
| 120–149 km/h | Severe Typhoon | ~70% | **70% of coverage** |
| ≥ 150 km/h | Super Typhoon | 100% | **Full coverage** |

---

## 💻 Tech Stack

### Blockchain Layer
- **Smart Contracts**: Soroban Rust SDK `v20.5.0`
- **Network**: Stellar Testnet (live) + Mainnet (ready)
- **Assets**: Native XLM — no stablecoin dependency, no bridge risk
- **Live Contract**: [`CB62WJ6...BVVP2GFW`](https://lab.stellar.org/r/testnet/contract/CB62WJ6VDF4JSYX6DWOPPYFBCM4ULM2WX4CEJADZCHSY7RLUFBVP2GFW)

### Frontend Layer
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Vanilla CSS — glassmorphism, dual-network theme engine, micro-animations
- **Mapping**: Leaflet.js with PAR boundary overlays and multi-farm proximity detection
- **Wallet**: Freighter API (Stellar's native browser extension wallet)

### Backend / Infra
- **Notifications**: Firebase Cloud Messaging (FCM) via Express.js backend
- **Oracle Feeds**: Open-Meteo API + PAGASA data integration
- **Event Listener**: Soroban contract event poller (`backend/listener.ts`)
- **AI Damage Assessment**: Gemini API for parametric damage estimation

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (React 19)"
        UI[Dashboard & Monitor]
        Map[PAR Typhoon Map]
        Wallet[Freighter Wallet]
    end

    subgraph "Oracle & Infra Layer"
        Oracle[PAGASA + Open-Meteo]
        FCM[Firebase Cloud Messaging]
        Listener[Soroban Event Listener]
        AI[Gemini AI Assessment]
    end

    subgraph "Blockchain (Stellar Soroban)"
        Vault[TRV Smart Contract]
        Pool[Reinsurance LP Pool]
        Payout[Parametric Payout Engine]
    end

    Oracle -->|Wind & Rain data| Vault
    AI -->|Damage % estimate| Vault
    UI -->|subscribe()| Vault
    Wallet -->|Auth & Sign| Vault
    Vault -->|claim_payout()| Payout
    Payout -->|XLM| Wallet
    Listener -->|Payout events| FCM
    FCM -->|Push alerts| UI
```

---

## 🗓️ MVP Timeline (Target: May 22)

| Day | Milestone |
|---|---|
| **May 17** | Soroban contract finalized — `subscribe`, `submit_weather_report`, `claim_payout` tested (7 passing) |
| **May 18** | Frontend integrated with Freighter wallet; XLM payout flow wired end-to-end |
| **May 19** | RSBSA + land title verification gate added; LP reinsurance portal live |
| **May 20** | Oracle consensus simulator, typhoon tracking map, FCM notifications, TyFi rebrand |
| **May 21** | README, documentation polish, final testnet verification |
| **May 22** | ✅ Submission — live testnet demo, recorded walkthrough, deployed frontend |

---

## 🛠️ Getting Started

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust + Cargo | stable (≥ 1.74) | [rustup.rs](https://rustup.rs) |
| Stellar CLI | ≥ 20.x | [Stellar CLI docs](https://developers.stellar.org/docs/smart-contracts/getting-started/setup) |
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| Freighter Wallet | latest | [freighter.app](https://freighter.app) |

```bash
# Verify your toolchain
rustc --version          # rustc 1.74+
stellar --version        # stellar 20.x+
node --version           # v18+
```

---

### 📦 Smart Contract

#### Build
```bash
cd contracts
stellar contract build
# Output: target/wasm32v1-none/release/typhoon_resilience_vault.wasm
```

#### Test
```bash
cd contracts
cargo test
# Runs 7 unit tests covering: initialize, subscribe, oracle consensus,
# claim_payout, reinsurance deposit/withdraw, and subsidy pool
```

#### Deploy to Testnet
```bash
stellar contract deploy \
  --network testnet \
  --source <YOUR_SECRET_KEY> \
  --wasm contracts/target/wasm32v1-none/release/typhoon_resilience_vault.wasm
```

#### Initialize Contract
```bash
stellar contract invoke \
  --network testnet \
  --source <YOUR_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --xlm_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --quorum 2 \
  --is_mainnet_mode false \
  --single_oracle <ORACLE_ADDRESS>
```

#### Sample CLI Invocations

**Register (verify) a farmer:**
```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- verify_farmer \
  --admin <ADMIN_ADDRESS> \
  --farmer GDUMMYFARMERADDRESS000000000000000000000000000000000000 \
  --is_verified true
```

**Subscribe a farm to a policy:**
```bash
stellar contract invoke \
  --network testnet \
  --source <FARMER_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- subscribe \
  --farmer <FARMER_ADDRESS> \
  --farm_id FARM001 \
  --region albay \
  --season wet2025 \
  --premium 10000000
# Note: amounts are in stroops (1 XLM = 10,000,000 stroops)
```

**Submit a weather report (oracle):**
```bash
stellar contract invoke \
  --network testnet \
  --source <ORACLE_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- submit_weather_report \
  --oracle <ORACLE_ADDRESS> \
  --typhoon_id odette2 \
  --region albay \
  --damage_percentage 70
```

**Claim a payout:**
```bash
stellar contract invoke \
  --network testnet \
  --source <FARMER_SECRET_KEY> \
  --id <CONTRACT_ID> \
  -- claim_payout \
  --farmer <FARMER_ADDRESS> \
  --farm_id FARM001 \
  --season wet2025 \
  --typhoon_id odette2
```

---

### 🖥️ Frontend

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

> **Environment**: The frontend auto-connects to the testnet contract. For custom deployment, update `CONTRACT_ID` in `frontend/src/config.ts`.

---

### 🔔 Backend (Soroban Event Listener + FCM)

```bash
cd backend
cp .env.example .env   # Configure your Firebase + Soroban credentials
npm install
npm run dev
# Listener polling at http://localhost:3001
```

**Required `.env` variables:**
```env
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
PORT=3001
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_CLIENT_EMAIL=<your-service-account-email>
FIREBASE_PRIVATE_KEY=<your-private-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

---

## ✨ Key Features

- **🚀 Parametric Payouts** — No manual claims. Payouts auto-trigger on objective damage percentage data from verified weather oracles.
- **🛰️ Live Typhoon Tracking** — Interactive dashboard tracking storm paths in real-time within the Philippine Area of Responsibility (PAR).
- **🌾 RSBSA + Land Title Verification** — KYC/ownership gating (Deed of Sale or Land Title upload) prevents fraudulent policy registrations.
- **🏦 LP Reinsurance Pool** — Yield-bearing liquidity pool (8.4% APY) lets DeFi users back agricultural risk and earn from premiums.
- **⚡ Oracle Consensus Simulator** — Testnet sandbox simulates the full end-to-end oracle → consensus → disbursal pipeline.
- **📊 Parametric Weather Analytics** — SVG telemetry charts overlaying real wind/rain data vs. contract trigger thresholds.
- **🎨 Dual-Network Theme Engine** — UI morphs from sky-blue (testnet) to emerald-green (mainnet) on network switch.
- **📱 FCM Push Notifications** — Firebase Cloud Messaging alerts farmers before, during, and after a typhoon event.

---

## 📖 Roadmap

### ✅ Phase 1 — Testnet (Complete)
- [x] Core Soroban contract with sliding-scale parametric payouts
- [x] Live testnet deployment (`CB62WJ6VDF4JSYX6DWOPPYFBCM4ULM2WX4CEJADZCHSY7RLUFBVP2GFW`)
- [x] Multi-oracle quorum consensus + single-oracle mainnet mode
- [x] RSBSA + Land Title / Deed of Sale verification gate
- [x] LP reinsurance staking portal with APY yield projections
- [x] Automated oracle consensus simulator (full end-to-end sandbox)
- [x] Live typhoon tracking map with multi-farm proximity detection
- [x] Parametric weather analytics chart with interactive tooltips
- [x] FCM push notification infrastructure

### 🎯 Phase 2 — Mainnet Pilot (Q3 2026)
- [ ] Mainnet deployment with authorized PAGASA oracle
- [ ] 500–1,000 farmer pilot in Albay, Leyte, and Eastern Samar
- [ ] GCash / Maya bridge for farmers without Freighter wallets
- [ ] Department of Agriculture RSBSA data partnership

### 🚀 Phase 3 — Scale (2027+)
- [ ] All 18 Philippine regions
- [ ] Climate DAO governance — farmers vote on premium rates and thresholds
- [ ] Vietnam, Bangladesh, Pacific island expansion
- [ ] Carbon credit integration for climate-resilient farming practices
- [ ] Open protocol — any insurer or NGO can deploy a TRV vault

---

## The Stakes

> **₱7.1 billion** in uncompensated losses from Typhoon Odette alone.
> **1.6 million farmers** left without recourse.
> **20 typhoons per year**, every year, with intensity rising due to climate change.

TyFi is not just a DeFi application — it is **infrastructure for climate survival**. We are building the financial rails that give Filipino farmers a fighting chance against a warming world, on Stellar, because fast, cheap, and accessible is not optional when your users earn ₱200 a day and a typhoon is three hours away.

---

## 📄 License

```
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
```

---

*Made with 🌀 for the Philippines. Built on Stellar Soroban.*
