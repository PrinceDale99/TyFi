# 🌀 TyFi (TRV)

[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue.svg)](https://stellar.org)
[![Testnet](https://img.shields.io/badge/Testnet-Live-brightgreen.svg)](https://lab.stellar.org/r/testnet/contract/CB62WJ6VDF4JSYX6DWOPPYFBCM4ULM2WX4CEJADZCHSY7RLUFBVP2GFW)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *"Kung hagupit ang bagyo, ikaw ay babayaran."*
> — If the typhoon strikes, you will be paid.

---

## The Problem

The Philippines is the most typhoon-exposed country on Earth. Every year, an average of **20 typhoons** make landfall — devastating rice fields, coconut groves, and sugarcane farms that millions of smallholder families depend on entirely for their livelihoods.

Yet the people most at risk are the **least protected**:

- Traditional crop insurance has **80%+ rejection rates** on claims due to documentation disputes and slow adjusters
- Average payout processing takes **3–6 months** — long after a farmer's savings are gone and debt has accumulated
- Most farmers earn less than ₱200/day. A single typhoon can erase an **entire season's harvest** overnight
- After Typhoon Odette (2021), over **1.6 million farmers** received zero compensation despite ₱7.1 billion in total agricultural losses

This is the **protection gap** — a catastrophic mismatch between the people who need insurance most and the people who can actually access it.

---

## What We Built

**TyFi (TRV)** is a **decentralized parametric insurance protocol** built on Stellar Soroban, designed specifically for Filipino smallholder farmers.

Instead of a claims adjuster deciding whether your farm was damaged — **the weather decides**. The moment a typhoon's wind speed crosses a pre-agreed threshold over a farmer's registered region, a Soroban smart contract triggers an **instant XLM payout directly to the farmer's wallet**. No paperwork. No appeals. No waiting.

> *"If the storm hit, you get paid. Code guarantees it."*

---

## How It Works

```
Farmer registers → Uploads land title / deed of sale → Pays premium → Policy activates
         ↓
Weather oracle monitors wind speed & rainfall in real-time
         ↓
Typhoon crosses parametric threshold (100 / 120 / 150 km/h)
         ↓
Soroban contract auto-executes → XLM disbursed to wallet (30% / 70% / 100%)
         ↓
Farmer receives payout within minutes, not months
```

### Three tiers of parametric payout

| Wind Speed | Category | Payout |
|---|---|---|
| < 100 km/h | No trigger | 0% |
| 100–119 km/h | Typhoon | **30%** |
| 120–149 km/h | Severe Typhoon | **70%** |
| ≥ 150 km/h | Super Typhoon | **100%** |

---

## What Makes It Different

| Traditional Insurance | TyFi |
|---|---|
| Claims take 3–6 months | Payouts in **< 10 minutes** |
| Manual damage assessment | **Automated oracle consensus** |
| Paperwork & disputes | **Code-enforced transparency** |
| Only covers large farms | Accessible to any wallet holder |
| Profits leave the country | **Liquidity stays in the protocol** |
| Opaque pricing | **On-chain, auditable premiums** |
| Single point of failure | **Decentralized, censorship-resistant** |

---

## ✨ Key Features

- **🚀 Parametric Payouts** — No manual claims. Payouts auto-trigger on objective wind speed data from verified weather oracles.
- **🛰️ Live Typhoon Tracking** — Interactive dashboard tracking storm paths in real-time within the Philippine Area of Responsibility (PAR).
- **🌾 RSBSA + Land Title Verification** — KYC/ownership gating (Deed of Sale or Land Title upload) prevents fraudulent policy registrations.
- **🏦 LP Reinsurance Pool** — Yield-bearing liquidity pool (8.4% APY) lets DeFi users back agricultural risk and earn from premiums.
- **⚡ Oracle Consensus Simulator** — Testnet sandbox simulates the full end-to-end oracle → claim → disbursal pipeline.
- **📊 Parametric Weather Analytics** — SVG telemetry charts overlaying real wind/rain data vs. contract trigger thresholds.
- **🎨 Dual-Network Theme Engine** — UI morphs from sky-blue (testnet) to emerald-green (mainnet) on network switch.
- **📱 FCM Push Notifications** — Firebase Cloud Messaging alerts farmers before, during, and after a typhoon event.

---

## 💻 Tech Stack

### Blockchain Layer
- **Smart Contracts**: Soroban Rust SDK v21
- **Network**: Stellar Testnet (live) + Mainnet (ready)
- **Assets**: Native XLM — no stablecoin dependency, no bridge risk
- **Live Contract**: [`CB62WJ6...BVVP2GFW`](https://lab.stellar.org/r/testnet/contract/CB62WJ6VDF4JSYX6DWOPPYFBCM4ULM2WX4CEJADZCHSY7RLUFBVP2GFW)

### Frontend Layer
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Vanilla CSS — glassmorphism, theme morphing, micro-animations
- **Mapping**: Leaflet.js with PAR boundary overlays and multi-farm proximity detection
- **Wallet**: Freighter API (Stellar's native browser extension wallet)

### Backend / Infra
- **Notifications**: Firebase Cloud Messaging (FCM) via Express backend
- **Oracle Feeds**: Open-Meteo API + PAGASA data integration
- **Event Listener**: Soroban contract event poller (`listener.ts`)

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
    end

    subgraph "Blockchain (Stellar Soroban)"
        Vault[TRV Smart Contract]
        Pool[Reinsurance LP Pool]
        Payout[Parametric Payout Engine]
    end

    Oracle -->|Wind & Rain data| Vault
    UI -->|subscribe()| Vault
    Wallet -->|Auth & Sign| Vault
    Vault -->|claim_payout()| Payout
    Payout -->|XLM| Wallet
    Listener -->|Payout events| FCM
    FCM -->|Push alerts| UI
```

---

## 🚀 Getting Started

### Prerequisites
- [Rust & Cargo](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/smart-contracts/getting-started/setup)
- [Node.js](https://nodejs.org/) v18+

### Smart Contract
```bash
cd contracts/typhoon_resilience_vault
cargo test                        # Run all 7 tests
stellar contract build            # Build WASM
stellar contract deploy --network testnet --source <YOUR_KEY> \
  --wasm target/wasm32v1-none/release/typhoon_resilience_vault.wasm
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

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

The TyFi is not just a DeFi application — it is **infrastructure for climate survival**. We are building the financial rails that give Filipino farmers a fighting chance against a warming world, on Stellar, because fast, cheap, and accessible is not optional when your users earn ₱200 a day and a typhoon is three hours away.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

*Made with 🌀 for the Philippines. Built on Stellar Soroban.*
