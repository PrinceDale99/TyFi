# TyFi Protocol — Week 4 Delivery Evidence

> **Expected output (SOW):** execute the full end-to-end integration flow — *co-op votes via DAO → passkey wallet signs → vault verifies ZK proof → payout executes* — with verifiable Stellar Testnet transaction hashes for every key action; record and publish a captioned 3–5 minute walkthrough of wallet creation, DAO voting, cross-contract parameter updates and ZK-proof payout execution; publish setup documentation, an integration guide and payload snippets that let SDF reviewers replicate the testnet environment; release all source code — Soroban contracts, React frontend, integration bridges and Noir ZK circuits — under the MIT License.
>
> **Network:** Stellar Testnet (`Test SDF Network ; September 2015`)  
> **Soroban SDK:** `27.0.0-rc.1` · **Stellar CLI:** `27.0.0` · **circom** `2.2.3` + **snarkjs** `0.7.6` · **Noir** `1.0.0-rc.6` + **bb.js** `5.2.1`  
> **Branch:** `week4/zk-groth16-verifier` → `master`

---

## 0. Summary

| Milestone | Status | Evidence |
|---|:---:|---|
| End-to-end flow: DAO vote → passkey signature → on-chain ZK verification → payout | ✅ | §1B |
| Testnet tx hash for every key action, linked to Stellar Expert | ✅ | §1, `contracts/deployments/week4-*.json` |
| Vault verifies **real** Groth16 proofs on-chain (BN254 pairing) | ✅ | §2, §1A |
| Cross-contract parameter update (DAO → vault) | ✅ | §1B `finalize` |
| Captioned 3–5 min walkthrough video | ✅ | §5 |
| Setup docs, integration guide, payload snippets, replication path | ✅ | §6 |
| Open-source release under MIT (contracts, frontend, bridges, Noir + Circom circuits) | ✅ | §7 |

---

## 1. 🔗 On-chain proof (Stellar Expert)

<!-- evidence:start -->
### A. Vault rollout (`CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR`)

| Step | Transaction |
|---|---|
| Upload Groth16 vault wasm (54,558 bytes) | [`fdb732d6…327ac2`](https://stellar.expert/explorer/testnet/tx/fdb732d6943b6a865c928acf9d28b7ac2ca88bcdea9c28e0375bf25f6b327ac2) |
| Upgrade vault in place | [`6d46601e…e49e19`](https://stellar.expert/explorer/testnet/tx/6d46601e285b44bf5374562bd3bfe09ecc77a4e9b8c64776c8f56c96c2e49e19) |
| Repair zero-threshold admin multisig → 1-of-1 | [`1d4fd139…20e62b`](https://stellar.expert/explorer/testnet/tx/1d4fd139e26a02f105b6233dce4a2c134f3ea03322ce0d58364e6e326120e62b) |
| Install Groth16 verifying key | [`b8d75f5f…20cb87`](https://stellar.expert/explorer/testnet/tx/b8d75f5fb8444f4f74d5bcd09028dcade5ee0476432e0c68e34a8bf5d720cb87) |
| Activate ZK oracle | [`67b6dfec…291db1`](https://stellar.expert/explorer/testnet/tx/67b6dfec9ce4dc8e81ef2f36a417bf85a137c22cb63b31bb5d51c0ea63291db1) |
| Register oracle's EdDSA key hash | [`8d0b8245…993257`](https://stellar.expert/explorer/testnet/tx/8d0b8245cd7f0228977b9ea61a2d0a507d716fb5b4f66b7b5696cd2824993257) |
| Link DAO (enables cross-contract updates) | [`261fa626…af7601`](https://stellar.expert/explorer/testnet/tx/261fa6265fa348f65c63969ea10d0a6d996f0660fe597acf8214930193af7601) |

### B. End-to-end pipeline

Passkey wallet: [`CCMMEA3XNM2OMEOBRU7PO2ZWQUD4BD3NQDPLPMM6MGMFRRASK4CPFIB5`](https://stellar.expert/explorer/testnet/contract/CCMMEA3XNM2OMEOBRU7PO2ZWQUD4BD3NQDPLPMM6MGMFRRASK4CPFIB5) · DAO proposal 6

| Step | Signed by | Transaction |
|---|---|---|
| Seedless wallet created by the factory | passkey | [`ba3aec2b…5fe696`](https://stellar.expert/explorer/testnet/tx/ba3aec2b2cbe775d9467dddd547f4239a347331cd321135b8c0be8e3d25fe696) |
| Co-op treasury funds the wallet | co-op treasury | [`44754883…adc282`](https://stellar.expert/explorer/testnet/tx/44754883de05e9fc116f2fa6cb1f5ce6d9c0f7fb7c5d7d00203b92957cadc282) |
| Farm verified | vault admin multisig | [`7b0944b8…cb1df2`](https://stellar.expert/explorer/testnet/tx/7b0944b8457faa339b94ede5b1432c1fc393a9ceb32834380667d8d65dcb1df2) |
| LP deposit → voting power | passkey wallet | [`77b166e4…b91bc3`](https://stellar.expert/explorer/testnet/tx/77b166e4156a547068fad9ee6a1778f3d9d5e05b3bb59d7c4337e22b2ab91bc3) |
| Farm insured (Eastern Visayas) | passkey wallet | [`00896d37…ca0f2e`](https://stellar.expert/explorer/testnet/tx/00896d37e2204b45caad32d6a20af96c38137bc3805acd0519b8f5b540ca0f2e) |
| Proposal 6: premium multiplier → 125 | co-op member | [`50350b75…e992c9`](https://stellar.expert/explorer/testnet/tx/50350b755a3a5300036dfd6dc117c4738da9fbe4c82dbc8fee5ec3f23de992c9) |
| Vote FOR proposal 6 | passkey wallet | [`9988d264…2d501d`](https://stellar.expert/explorer/testnet/tx/9988d264d300d9b7c46ff2f131ecafd8d80911f1664db3ec1130509b852d501d) |
| Vote FOR proposal 6 | co-op LP | [`a25edf5e…d7d8ce`](https://stellar.expert/explorer/testnet/tx/a25edf5e244e311bee41646ed1f952943c82e315a888a1839bc0188da6d7d8ce) |
| Vote FOR proposal 6 | co-op LP | [`83327054…eef6ce`](https://stellar.expert/explorer/testnet/tx/833270546bdf5bc9de8122586057b60f00fdd2aa34acda3480a36648b2eef6ce) |
| Settle: quorum + 60% met → timelock | anyone | [`49ba704b…ca4ba5`](https://stellar.expert/explorer/testnet/tx/49ba704b8575db2320779a05aebc31cf9bfc051f37f67611f907a14398ca4ba5) |
| Farmer wallet made a DAO executor | DAO admin | [`6d584eb6…87a3d6`](https://stellar.expert/explorer/testnet/tx/6d584eb63e96240b1b1efffee07301daa25bec17c18f4f089e19c9481387a3d6) |
| Finalize: DAO → vault.update_premium_rate (100 → 125) | passkey wallet | [`7fd8c2a3…611cdc`](https://stellar.expert/explorer/testnet/tx/7fd8c2a3204d3a3457bac478be6a6ac5e3e2e47579d99fbb5628f1ca8d611cdc) |
| Groth16 weather proof verified by the vault | ZK oracle | [`98eee50c…8ee6af`](https://stellar.expert/explorer/testnet/tx/98eee50cf45191c9b69334c33d4729565100bfd939399f84dbfb28fe4c8ee6af) |
| Payout claimed (+170.00 XLM) | passkey wallet | [`d9962ba0…497706`](https://stellar.expert/explorer/testnet/tx/d9962ba020588862def4e25f6fc348cfd8f660516d336cc726a6f1ba7d497706) |
| Wallet created on camera | passkey | [`e9b247d6…1a9ece`](https://stellar.expert/explorer/testnet/tx/e9b247d6434592918f120228c10c4eccc328f609916b41d3d1df0dcb961a9ece) |
| Live proposal for the video vote | co-op member | [`d35864da…fdaf79`](https://stellar.expert/explorer/testnet/tx/d35864daefe825ca82cacd3da1e8233a5faf96567173d1fe2dee912845fdaf79) |
| Vote cast on camera | passkey wallet | [`af87d974…797c33`](https://stellar.expert/explorer/testnet/tx/af87d9742b693d769f812cb89e6eebe2815944bfb23dab952a3db47ecd797c33) |
<!-- evidence:end -->

### C. Reviewer-reproducible fresh deployment

`scripts/week4/deploy_fresh_testnet.mjs` deployed and configured a brand-new
vault + DAO pair from scratch — see
[`fresh-testnet-2026-10-23T14-41-59-398Z.json`](contracts/deployments/fresh-testnet-2026-10-23T14-41-59-398Z.json)
(vault `CCF6BMB3…YIJ`, DAO `CDVE6BQN…OYK`).

---

## 2. Zero-knowledge proofs, verified on-chain

Week 1 shipped `verify_zk_proof`, which **returned `true` for any non-empty
bytes**, and a Noir circuit whose proof was never checked anywhere. Week 4
replaces both:

| | Before | After |
|---|---|---|
| Statement | `wind >= threshold` with no oracle binding | Oracle's registered EdDSA-Poseidon key signed *(typhoon, region, wind, damage)* and `wind ≥ band` |
| Proof system | Barretenberg Plonk, mock fallback | **Groth16 / BN254** (circom + snarkjs) |
| On-chain check | none (stub) | `e(-A,B)·e(α,β)·e(vk_x,γ)·e(C,δ) == 1` via `env.crypto().bn254()` |
| Public inputs | caller-supplied | **rebuilt by the vault**: key hash, `symbol_to_field(typhoon)`, `symbol_to_field(region)`, band, damage |
| What goes on-chain | raw wind speed | only the payout band (100/120/150 km/h) |
| Cost | — | ~30.4M CPU instructions on testnet (limit 100M), 256-byte proof, ~1.4 s proving |

Rejection cases covered by `contracts/typhoon_resilience_vault/src/test_zk.rs`
against a real proof: tampered damage, inflated band, replay to another
region, unregistered oracle key, swapped and off-curve points, unconfigured
verifier, inactive oracle.

**Noir.** The same statement is implemented in Noir
(`circuits/weather_threshold_noir`, UltraHonk). One circomlibjs oracle
signature satisfies both circuits (tested). The vault verifies the Groth16
version because an UltraHonk verifier does not fit Soroban's per-transaction
limits today; the Noir version is proven and verified off-chain with bb.js.

**Trust assumptions.** Single-party trusted setup (testnet only; mainnet needs
a multi-party phase 2). The proof shows the oracle *signed* the reading;
oracle honesty is addressed by multi-oracle quorum.

---

## 3. Security fixes found this week

| Issue | Impact | Fix |
|---|---|---|
| Testnet vault admin multisig was `keys=[] threshold=0`; `verified_count < threshold` was `0 < 0` | **Anyone** could call `upgrade`, `set_oracle`, `verify_farmer`, `set_dao_address` with no signatures | `initialize` requires `1 ≤ threshold ≤ keys`; auth fails closed on 0; `rotate_admin_multisig` with a one-time legacy repair; live vault repaired (§1A). Mainnet was already 1-of-1. |
| ZK verifier stub | Any bytes passed as a "proof" | Real Groth16 verifier (§2) |
| Vault had no `DaoAddress` | Every DAO `finalize_proposal` bridge call failed | `set_dao_address` via multisig (§1A) |
| Public weather sandbox texted every farmer and queued a PHP 15,000 fiat sweep per call | Spam / unintended payouts | Removed; payout is the on-chain claim |
| Testnet claims called `testnet_claim_payout`, which does not exist | Every testnet claim failed | Claims use `claim_payout` on both networks |
| DAO page showed hardcoded "1,248 members, +12 this week" | Fabricated metrics | Shows real on-chain voting supply |

---

## 4. Tests

| Suite | Result |
|---|---|
| Contracts (`cargo test`, vault + DAO + wallets) | **134 passed** |
| Backend (`functions`, prover/encoding/request/passkey) | **41 passed** |
| Noir circuit (`circuits/weather_threshold_noir`, UltraHonk) | **6 passed** |
| Frontend type check + production build | clean |

---

## 5. Walkthrough video

`video/week4-walkthrough/` holds everything needed to rebuild the video:

- **Footage:** captured from the real app on testnet by
  `capture/capture.mjs`. Every on-screen transaction appears in §1B. Passkey
  prompts are performed by Chrome's DevTools virtual authenticator (a stand-in
  for Face ID / fingerprint hardware), which the video states on screen.
- **Narration:** `narration/*.txt`, voiced locally with Kokoro (`hyperframes tts`, `af_heart`).
- **Captions:** burned in, plus `tyfi-week4-walkthrough.srt`. Text is the
  script itself; timing comes from Parakeet word timestamps.
- **Edit:** HyperFrames composition generated by `tools/compose.mjs`.

Published (YouTube): [https://youtu.be/hQO7kVUe3_M](https://youtu.be/hQO7kVUe3_M)

---

## 6. Documentation

- [`docs/REPLICATION_GUIDE.md`](docs/REPLICATION_GUIDE.md): read-only checks, test suites, and full reproduction on fresh contracts (`deploy_fresh_testnet.mjs` + `e2e_pipeline.mjs`).
- [`docs/INTEGRATION_GUIDE.md`](docs/INTEGRATION_GUIDE.md): contract interfaces, encodings, REST and CLI payloads, error codes.
- [`circuits/weather_threshold/README.md`](circuits/weather_threshold/README.md) and [`circuits/weather_threshold_noir/README.md`](circuits/weather_threshold_noir/README.md): circuit statements, constraints, trust assumptions.

---

## 7. Open-source release

`LICENSE` is MIT, and every package declares it: all npm packages
(`package.json`, `frontend`, `functions`, `oracle-scraper`, both circuits, the
video project) and every Rust crate (`typhoon_resilience_vault`, `tyfi_dao`,
`smart_wallet`, `smart_wallet_factory`, `zk_weather_consensus`). Vendored Noir
libraries keep their upstream Apache-2.0 licenses
(`circuits/weather_threshold_noir/vendor/`).

---

## 8. Known limitations

- Groth16 trusted setup is single-party (testnet only).
- The Noir circuit is verified off-chain; the vault verifies the equivalent Groth16 circuit.
- The passkey relayer sponsors fees up to 1 XLM per transaction (`PASSKEY_MAX_FEE_STROOPS`).
- The DAO timelock is 8,640 ledgers (~12 h), so a full pipeline run takes half a day.
