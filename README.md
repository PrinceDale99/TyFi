# 🌀 TyFi — Parametric Typhoon Insurance on Stellar

[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue.svg)](https://stellar.org)
[![Testnet](https://img.shields.io/badge/Testnet-Live-brightgreen.svg)](https://lab.stellar.org/r/testnet/contract/CBMNXUY6U2PO56JB5TZNUNQQZFXVUJ6XOZ3T3LJZJ3U6RH64RXTP3WRN)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *"Kung hagupit ang bagyo, ikaw ay babayaran."*
> — If the typhoon strikes, you will be paid.

---

## 🧩 The Problem: A Climate Credit Gap
Traditional crop insurance in the Philippines is broken. Smallholder farmers face:
- **High Rejection Rates**: 80%+ of claims are denied due to complex paperwork or subjective damage assessment.
- **Liquidity Lag**: Payouts take 3–6 months—long after the farmer needs seeds for the next season.
- **Micro-Scale Inaccessibility**: 1.6M+ farmers earning ₱150–250/day are "uninsurable" by traditional banks.

## 🌟 The Solution: TyFi
TyFi is a decentralized parametric insurance protocol built on **Stellar Soroban**. It replaces manual claims with objective data. If a typhoon's wind speed exceeds a contract-defined threshold (verified by oracles), the payout is triggered **instantly and automatically**.

---

## 🏗️ Technical Architecture

### 1. Soroban Smart Contract (`contracts/`)
The "Source of Truth" for the insurance vault.
- **Consensus Oracle Mechanism**: Implements a multi-oracle quorum. Payouts are only triggered when a majority of authorized oracles report consistent damage data for a specific Typhoon ID and Region.
- **Sliding-Scale Damage Curve**: Instead of binary "hit/miss," the contract uses a damage percentage (0–100%) to calculate payouts proportional to the storm's severity.
- **State Management**: Uses efficient `DataKey` mapping to track:
    - **RSBSA Verification**: Farmers must be verified (Admin-gated) to prevent sybil attacks.
    - **Reinsurance Pool**: A yield-bearing vault where Liquidity Providers (LPs) deposit XLM to back the risk in exchange for premium-based yield.
    - **Subsidy Pool**: A dedicated balance for NGOs/Donors to pay premiums on behalf of verified farmers.

### 2. AI Risk Engine (`frontend/src/services/aiService.ts`)
Powered by **Google Gemini API**, our AI Copilot acts as a "Smart Surveyor."
- **Multimodal Assessment**: Analyzes live weather metrics (Wind Speed, Rainfall, Gusts) against farm coordinates and crop types.
- **Crop Vulnerability Modeling**: Differentiates risk between Rice (lodging/flooding), Bananas (shallow roots), and Coconuts (wind resistance).
- **Proactive Advisories**: Provides farmers with actionable steps (e.g., "Harvest early," "Clear drainage") based on the predicted storm trajectory.

### 3. Real-Time Infrastructure (`backend/` & `functions/`)
- **Stellar Event Listener**: A Node.js service that monitors the Soroban ledger for `payout_triggered` events.
- **Notification Engine**: Bridges blockchain events to real-world alerts via **Firebase Cloud Messaging (FCM)**.
- **Certificate Service**: Automatically generates tamper-proof PDF insurance certificates (via `pdfkit`) containing the contract hash and policy details.

---

## 📊 Parametric Payout Scale

The smart contract executes payouts based on objective wind speed data from the Philippine Area of Responsibility (PAR).

| Wind Speed | Category | Damage Estimate | Payout % |
|---|---|---|---|
| < 100 km/h | Tropical Storm | 0% | **0%** |
| 100–119 km/h | Typhoon | ~30% | **30%** |
| 120–149 km/h | Severe Typhoon | ~70% | **70%** |
| ≥ 150 km/h | Super Typhoon | 100% | **100%** |

---

## 📂 Project Structure

```text
typhoon-resilience-vault/
├── contracts/                  # Soroban Smart Contracts (Rust)
│   └── typhoon_resilience_vault/
│       ├── src/                # Contract logic & tests
│       └── test_snapshots/     # Verified execution traces
├── frontend/                   # React 19 Dashboard (Vite + TS)
│   ├── src/components/         # Modular UI (Map, Copilot, Wallet)
│   ├── src/services/           # AI, Weather, and Stellar integration
│   └── src/locales/            # Multi-dialect support (Tagalog, Cebuano, Waray)
├── backend/                    # Node.js Middleware & Event Listener
│   ├── server.ts               # API for FCM & Certificates
│   └── listener.ts             # Soroban Ledger observer
└── functions/                  # Firebase Cloud Functions (Auto-scaling)
```

---

## 🚀 Getting Started

### Prerequisites
- **Rust/Cargo**: `stable` (v1.74+)
- **Stellar CLI**: `v20.x`
- **Node.js**: `v18.x`+
- **Freighter Wallet**: [Installed Extension](https://www.freighter.app/)

### Installation & Development

1. **Clone the repo**
   ```bash
   git clone https://github.com/PrinceDale99/TyFi.git
   cd typhoon-resilience-vault
   ```

2. **Setup Dependencies**
   ```bash
   npm run install:all
   ```

3. **Build & Test Contracts**
   ```bash
   cd contracts/typhoon_resilience_vault
   stellar contract build
   cargo test
   ```

4. **Launch Application**
   ```bash
   # Run frontend (Root script)
   npm run dev
   
   # Run backend listener
   npm run listener
   ```

---

## 🧪 Testing Suite
We use a combination of unit tests and snapshot testing to ensure payout safety.
- **Double Payout Prevention**: Ensures a farmer cannot claim twice for the same storm.
- **Subsidy Depletion**: Tests contract behavior when the donor pool is empty.
- **Oracle Quorum**: Validates that 2/3 oracles must agree before state mutation.

Run tests: `cargo test -- --nocapture`

---

## 🌐 Deployment Status

| Network | Contract ID | Explorer |
|---|---|---|
| **Testnet** | `CBMNXU...3WRN` | [View on Stellar.expert](https://stellar.expert/explorer/testnet/contract/CBMNXUY6U2PO56JB5TZNUNQQZFXVUJ6XOZ3T3LJZJ3U6RH64RXTP3WRN) |
| **Mainnet** | `CAAQCL...HCHEK` | [View on Stellar.expert](https://stellar.expert/explorer/mainnet/contract/CAAQCLJ7SF5IP3BHD4OKPLMCDQTEVTRYWEXYBQIGNL6U6ZYIK7HNCHEK) |

---

## 👨‍💻 Team
- **Prince Dale Limosnero** — *Lead Blockchain Architect / Full-Stack Developer* ([@PrinceDale99](https://github.com/PrinceDale99))

## 📜 License
MIT License. See [LICENSE](LICENSE) for details.
