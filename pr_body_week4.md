## Week 4 — End-to-end pipeline: passkey → DAO → cross-contract update → on-chain Groth16 ZK payout

> **Milestone:** Execute the full flow (co-op votes via DAO → passkey wallet signs → vault verifies the ZK proof → payout executes) with a Stellar Expert hash for every key action, publish a captioned 3–5 min walkthrough, ship setup docs, an integration guide and a replication path for SDF reviewers, and release everything under MIT.
>
> **Branch:** `week4/zk-groth16-verifier` → `master`  
> **Tests:** 134 contract · 41 backend · 6 Noir circuit — all passing; frontend type check + build clean  
> **Network:** Stellar Testnet · Full report: [`week4.md`](week4.md) · Replicate it: [`docs/REPLICATION_GUIDE.md`](docs/REPLICATION_GUIDE.md)

---

### ✅ Expected outputs

- [x] **End-to-end flow on testnet, every step with a Stellar Expert hash** ([`week4.md` §1](week4.md), `contracts/deployments/week4-e2e-testnet.json`):
  - Passkey wallet [`CCMMEA3X…FIB5`](https://stellar.expert/explorer/testnet/contract/CCMMEA3XNM2OMEOBRU7PO2ZWQUD4BD3NQDPLPMM6MGMFRRASK4CPFIB5) deposits LP, insures a farm and votes on proposal 6 — all passkey-signed ([vote](https://stellar.expert/explorer/testnet/tx/9988d264d300d9b7c46ff2f131ecafd8d80911f1664db3ec1130509b852d501d))
  - Proposal passes quorum + 60% supermajority ([settle](https://stellar.expert/explorer/testnet/tx/49ba704b8575db2320779a05aebc31cf9bfc051f37f67611f907a14398ca4ba5)) and clears its 12 h timelock
  - **Cross-contract update:** the farmer's passkey wallet finalizes it; `tyfi_dao` calls `vault.update_premium_rate`, Eastern Visayas 100 → 125 ([finalize](https://stellar.expert/explorer/testnet/tx/7fd8c2a3204d3a3457bac478be6a6ac5e3e2e47579d99fbb5628f1ca8d611cdc))
  - **ZK verification on-chain:** `submit_weather_report_zk` verifies a Groth16 proof with BN254 pairings, 29.2M instructions ([report](https://stellar.expert/explorer/testnet/tx/98eee50cf45191c9b69334c33d4729565100bfd939399f84dbfb28fe4c8ee6af))
  - **Payout:** passkey-signed `claim_payout` pays 170 XLM ([claim](https://stellar.expert/explorer/testnet/tx/d9962ba020588862def4e25f6fc348cfd8f660516d336cc726a6f1ba7d497706))
- [x] **Captioned walkthrough video (3:50):** [https://youtu.be/hQO7kVUe3_M](https://youtu.be/hQO7kVUe3_M). Footage is the real app on testnet; burned-in captions + `.srt`.
- [x] **Docs:** [`docs/REPLICATION_GUIDE.md`](docs/REPLICATION_GUIDE.md), [`docs/INTEGRATION_GUIDE.md`](docs/INTEGRATION_GUIDE.md), circuit READMEs, one-command fresh deployment (verified: vault `CCF6BMB3…`, DAO `CDVE6BQN…`).
- [x] **Open-source under MIT:** `LICENSE` + every npm package and Rust crate declares MIT; Soroban contracts, React frontend, integration bridges, Circom **and Noir** circuits.

---

### 📋 What changed

#### 1. Real on-chain ZK verification (`contracts/typhoon_resilience_vault`)
- `verify_zk_proof` returned `true` for any non-empty bytes. It is replaced by a **Groth16 / BN254 verifier** using `env.crypto().bn254()` (`g1_msm` + `pairing_check`).
- `submit_weather_report_zk` takes a typed `Groth16Proof` and **rebuilds all five public inputs itself** (registered oracle key hash, `symbol_to_field(typhoon/region)`, wind band, damage), so a proof can't be replayed, inflated or come from another key. Only the wind band is stored.
- Tests verify a real snarkjs proof in the Soroban host and reject tampered damage, inflated band, other region, unregistered key, swapped/off-curve points, unconfigured verifier.

#### 2. Circuits
- `circuits/weather_threshold` (Circom, Groth16): EdDSA-Poseidon-signed reading, `wind ≥ band`, range checks. Trusted setup script, artifacts, README with trust assumptions.
- `circuits/weather_threshold_noir` (Noir 1.0, UltraHonk): the same statement. One circomlibjs oracle signature satisfies both circuits (tested). The vault verifies the Groth16 one; UltraHonk doesn't fit Soroban's limits today.

#### 3. Oracle (`functions/zk`, `functions/oracle.ts`)
- Prover, Soroban encodings, on-chain submission, request validation; the weather trigger now proves and submits on-chain (no mock proof, no simulated tx).
- The public sandbox no longer texts every farmer or queues a PHP 15,000 fiat sweep per call.

#### 4. Security fixes
- **Testnet vault admin multisig was `threshold = 0`, so every admin call accepted zero signatures.** `initialize` validates `1 ≤ threshold ≤ keys`, auth fails closed on 0, `rotate_admin_multisig` added; the live vault was upgraded and repaired to 1-of-1 (mainnet was already 1-of-1).
- Vault had no `DaoAddress`, so every DAO bridge call failed — linked.
- Testnet claims called a nonexistent `testnet_claim_payout` — now `claim_payout`.

#### 5. Governance UI
- **Finalize & apply to vault** for executors (settles first if needed); timelock state shown.
- Hardcoded "1,248 members / +12 this week" replaced by the vault's real voting supply; passkey users no longer told to "check Freighter".
- Passkey relayer fee cap raised to 1 XLM so DAO votes go through.

#### 6. Scripts, deployment and video
- `scripts/week4/`: idempotent rollout, fresh vault+DAO deployment, e2e pipeline (passkey steps run the app's own code against a Chrome virtual authenticator), `week4.md` evidence renderer.
- `video/week4-walkthrough/`: capture script, narration, script-accurate captions, HyperFrames composition.

---

### 🧪 How to verify
```bash
cd contracts && CARGO_BUILD_JOBS=1 cargo test          # 134 passed
cd functions && npm test                                # 41 passed
cd circuits/weather_threshold_noir && npm test          # 6 passed
```
Read-only checks against the live contracts and the full reproduction path: [`docs/REPLICATION_GUIDE.md`](docs/REPLICATION_GUIDE.md).

### ⚠️ Known limitations
- Single-party Groth16 trusted setup (testnet only).
- Noir circuit verified off-chain; the vault verifies the equivalent Groth16 circuit.
- Video passkey prompts use Chrome's virtual authenticator (stated on screen).
- DAO timelock is 8,640 ledgers (~12 h), so a full pipeline run takes half a day.
