# TyFi — Reviewer Replication Guide (Stellar Testnet)

This guide lets you independently check every Week 4 claim, at three depths:

1. **Read-only (5 min):** open the recorded transactions and query the live contracts.
2. **Tests (15 min):** run the contract, backend and circuit test suites locally.
3. **Full reproduction (~1 h + a 12 h DAO timelock):** deploy your own vault and DAO,
   then run the whole pipeline (passkey wallet → DAO vote → cross-contract update →
   ZK-verified payout) on contracts you control.

Everything runs on **Stellar Testnet** (`Test SDF Network ; September 2015`).

---

## What you are verifying

| Claim | Where it is checked |
|---|---|
| The vault verifies Groth16 proofs on-chain with BN254 pairings, not a stub | §2 `submit_weather_report_zk` tx; §3 `cargo test -p typhoon_resilience_vault test_zk` |
| A proof can't be replayed for another storm or region, inflated, or come from an unregistered key | §3 `test_zk.rs` rejection tests |
| The raw wind reading never goes on-chain; only the payout band does | §2 tx call args (`wind_floor`), §3 `valid_proof_reaches_consensus` |
| A seedless passkey wallet signs LP deposits, policies, DAO votes and claims | §2 `passkey_*` steps; their auth entries are `secp256r1` WebAuthn signatures checked by the wallet's `__check_auth` |
| The DAO changes vault parameters through a cross-contract call | §2 `finalize_proposal_cross_contract` tx (invocation tree DAO → vault `update_premium_rate`) |
| Admin calls need the multisig (the zero-threshold bypass is closed) | §2 `get_admin_multisig`; §3 `test_admin_multisig.rs` |
| The same oracle signature satisfies the Circom and the Noir circuit | §3 `circuits/weather_threshold_noir` tests |

---

## 1. Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| Node.js | 24.x | backend, frontend, scripts, circuit tests |
| Rust + `wasm32v1-none` target | 1.94 (stable) | building/testing contracts |
| Stellar CLI | 27.0.0 | deploying and invoking contracts |
| circom | 2.2.3 | only to rebuild the Groth16 circuit |
| nargo | 1.0.0-rc.6 | only to rebuild the Noir circuit (Linux/macOS, or WSL on Windows) |
| Chrome (via `puppeteer`) | `npm i -g puppeteer` | the passkey steps of the e2e pipeline |

```bash
git clone https://github.com/PrinceDale99/TyFi.git
cd TyFi
npm install                       # also installs frontend/ and functions/
(cd circuits/weather_threshold && npm install)
(cd circuits/weather_threshold_noir && npm install)
```

> Low-memory machines: prefix cargo commands with `CARGO_BUILD_JOBS=1`.

---

## 2. Read-only verification of the TyFi deployment

| Contract | Address |
|---|---|
| Vault (`typhoon_resilience_vault`, Groth16 build, wasm `9ec723fa…`) | [`CARODUWJ…XCQZR`](https://stellar.expert/explorer/testnet/contract/CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR) |
| DAO (`tyfi_dao`) | [`CB3A3IZM…6KPY`](https://stellar.expert/explorer/testnet/contract/CB3A3IZMHF7EUM75CP5FFA6XZNABLRZAT5JL6XC4SZX3FWGRVMQM6KPY) |
| Passkey wallet factory | [`CDL7BZJG…V7WM`](https://stellar.expert/explorer/testnet/contract/CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM) |
| ZK oracle account | [`GAOYA37U…Z4RQ`](https://stellar.expert/explorer/testnet/account/GAOYA37UORCXQSC2TIYL3OHUV3GSRXQY2JACGJ5OV3UWCF2TGO74Z4RQ) |

Every transaction is recorded with its Stellar Expert link in:

- [`contracts/deployments/week4-zk-testnet.json`](../contracts/deployments/week4-zk-testnet.json): vault upgrade, multisig repair, verifying key, oracle registration, DAO link.
- [`contracts/deployments/week4-e2e-testnet.json`](../contracts/deployments/week4-e2e-testnet.json): the end-to-end pipeline, step by step, with the actor that signed each step.
- [`week4.md`](../week4.md): the same, as a table.

Query the live state yourself (any funded identity works as `--source`; these are simulations and send nothing):

```bash
V=CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR
D=CB3A3IZMHF7EUM75CP5FFA6XZNABLRZAT5JL6XC4SZX3FWGRVMQM6KPY
q() { stellar contract invoke --id "$1" --source <your-identity> --network testnet --send=no -- "${@:2}"; }

q $V get_admin_multisig            # {"keys":["b86604ca…"],"threshold":1}
q $V get_zk_verifying_key          # alpha/beta/gamma/delta + 6 IC points
q $V get_oracle_zk_key --oracle GAOYA37UORCXQSC2TIYL3OHUV3GSRXQY2JACGJ5OV3UWCF2TGO74Z4RQ
q $V get_premium_rate --region Eastern_Visayas              # 100 before proposal 6 is finalized, 125 after
q $V get_consensus_damage_percentage --typhoon_id ODETTE_2026 --region Eastern_Visayas
q $D get_proposal --id 6
q $D get_vote_summary --proposal_id 6
```

On Stellar Expert, open the `zk_weather_report` transaction from the e2e log and
check that the call to `submit_weather_report_zk` carries a 256-byte proof
(`a`, `b`, `c`), the `wind_floor` band and no raw wind speed, and that it emits
`zk_report_verified`.

---

## 3. Run the test suites

```bash
# Contracts: 134 tests, including real-proof Groth16 verification and multisig hardening
cd contracts && CARGO_BUILD_JOBS=1 cargo test && cd ..

# Backend: prover, encodings, request validation, passkey relayer policy (41 tests)
cd functions && npm test && cd ..

# Noir circuit: UltraHonk prove/verify of a circomlibjs-signed reading (no nargo needed)
cd circuits/weather_threshold_noir && npm test && cd ../..

# Frontend type check + build
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build && cd ..
```

The ZK contract tests use [`zk_fixture.rs`](../contracts/typhoon_resilience_vault/src/zk_fixture.rs),
a real proof generated by `functions/zk/scripts/gen-contract-fixture.ts`. The
cost test prints the verifier's CPU use (~27.7M instructions in the test host,
~30.4M measured on testnet; the per-transaction limit is 100M).

---

## 4. Full reproduction on your own contracts

### 4.1 Identities

The scripts drive the Stellar CLI. Create and fund four identities (names are
overridable, see [`scripts/week4/lib.mjs`](../scripts/week4/lib.mjs)):

```bash
for id in deployer admin freighter_wallet tyfi_zk_oracle; do
  stellar keys generate $id --network testnet --fund
done
```

| Identity | Env override | Role |
|---|---|---|
| `deployer` | `DEPLOYER` | pays fees; DAO admin and executor |
| `admin` | `ADMIN_IDENTITY` | the vault's 1-of-1 admin multisig key |
| `freighter_wallet` | `FUNDER` | co-op treasury: funds the farmer wallet and creates the proposal |
| `tyfi_zk_oracle` | `ORACLE_IDENTITY` | submits ZK weather reports |

### 4.2 Deploy and configure

```bash
CARGO_BUILD_JOBS=1 node scripts/week4/deploy_fresh_testnet.mjs
```

This builds and optimizes the vault and DAO, deploys and initializes them,
then runs [`zk_testnet_rollout.mjs`](../scripts/week4/zk_testnet_rollout.mjs) to:
install the Groth16 verifying key, activate the oracle, register its EdDSA key
hash, and link the DAO. It writes `ORACLE_SECRET_KEY` and `ORACLE_ZK_PRIVATE_KEY`
to `functions/.env` if they are missing, and prints the env vars to use next.
Our verified run: [`fresh-testnet-2026-10-23T14-41-59-398Z.json`](../contracts/deployments/fresh-testnet-2026-10-23T14-41-59-398Z.json).

If testnet times out a submission, re-run the command the script prints; every
step checks on-chain state first.

### 4.3 Run the backend and frontend

`functions/.env` (start from `functions/.env.example`) needs, at minimum:

```bash
PORT=3001
ORACLE_SECRET_KEY=S…            # written by the rollout
ORACLE_ZK_PRIVATE_KEY=…         # written by the rollout
CONTRACT_ID_TESTNET=<your vault>
DAO_CONTRACT_ID_TESTNET=<your DAO>
PASSKEY_NETWORK=testnet
PASSKEY_SPONSOR_SECRET=S…       # a funded account that pays passkey fees
PASSKEY_FACTORY_ID=CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM
PASSKEY_WALLET_WASM_HASH=5d59961865c3bc4a03db146e5a47e361b5eb7f5392fc379e3c2f0457e6dac4b1
PASSKEY_ALLOWED_CONTRACTS=<your vault>,<your DAO>
```

`frontend/.env.local`:

```bash
VITE_BACKEND_URL=http://localhost:3001
VITE_TESTNET_VAULT_ID=<your vault>
VITE_TESTNET_DAO_ID=<your DAO>
```

```bash
(cd functions && npm run start)          # http://localhost:3001
(cd frontend && npx vite --port 5173)    # http://localhost:5173
```

### 4.4 Run the end-to-end pipeline

```bash
export VAULT_ID=<your vault> DAO_ID=<your DAO>
export APP_URL=http://localhost:5173 BACKEND_URL=http://localhost:3001

node scripts/week4/e2e_pipeline.mjs stage     # wallet, funding, KYC flag, LP, policy, proposal, votes
node scripts/week4/e2e_pipeline.mjs status    # deadline and timelock countdown
node scripts/week4/e2e_pipeline.mjs settle    # after the ~15 min voting window
node scripts/week4/e2e_pipeline.mjs finalize  # after the timelock (8,640 ledgers ≈ 12 h)
node scripts/week4/e2e_pipeline.mjs payout    # ZK report + passkey-signed claim
```

What each step does and who signs it:

| Step | Signer | Contract call |
|---|---|---|
| `passkey_wallet_created` | passkey (WebAuthn, virtual authenticator) | factory `deploy` |
| `fund_wallet` | co-op treasury | XLM SAC `transfer` |
| `verify_farmer` | vault admin multisig | vault `verify_farmer` |
| `passkey_deposit_lp` | passkey wallet | vault `deposit_reinsurance` |
| `passkey_subscribe_policy` | passkey wallet | vault `subscribe` |
| `create_proposal` | co-op member | DAO `create_proposal(UpdatePremiumRate)` |
| `passkey_vote`, `vote_*` | passkey wallet, co-op LPs | DAO `vote` |
| `execute_proposal` | anyone | DAO `execute_proposal` (quorum + 60% supermajority) |
| `finalize_proposal_cross_contract` | DAO executor | DAO `finalize_proposal` → vault `update_premium_rate` |
| `zk_weather_report` | ZK oracle | vault `submit_weather_report_zk` (Groth16 verified) |
| `passkey_claim_payout` | passkey wallet | vault `claim_payout` |

The passkey steps run the app's own transaction code
(`frontend/src/lib/stellar.ts`) in headless Chrome, with a DevTools virtual
authenticator standing in for Face ID or a fingerprint. The WebAuthn assertion,
the Passkey Kit, the fee-sponsoring relayer and the wallet's `__check_auth` are
the same ones a phone uses. The authenticator's credential is saved in
`scripts/week4/.state/` (gitignored) so later phases sign as the same wallet.

On a fresh deployment only the passkey wallet holds LP shares, so it alone
meets the 30% quorum; the co-op LP votes are skipped automatically.

### 4.5 Try it in the UI

Open `http://localhost:5173/passkey` to create a passkey wallet, then use the
app's **DAO Governance** and **ZK Payout** tabs (testnet). The ZK Payout tab
shows the proven band, the public inputs, the proof bytes and both transaction
links.

---

## 5. Rebuilding the ZK artifacts (optional)

```bash
cd circuits/weather_threshold
npm run compile && npm run setup && npm run sync     # new R1CS, zkey, VK → functions/zk/artifacts
cd ../../functions && npx ts-node --transpile-only zk/scripts/gen-contract-fixture.ts
cd ../contracts && cargo test -p typhoon_resilience_vault test_zk
```

A new setup produces a new verifying key, so install it on your vault (the
rollout only installs a key when none is set; call `set_zk_verifying_key`
directly to replace one). The setup is a single-party ceremony and is
appropriate for testnet only; see
[`circuits/weather_threshold/README.md`](../circuits/weather_threshold/README.md).

The Noir circuit: `cd circuits/weather_threshold_noir && npm run compile` (runs
nargo, through WSL on Windows).

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `transaction submission timeout` | Testnet congestion. Re-run the script; steps are idempotent. |
| Relayer `FEE_LIMIT_EXCEEDED` | Raise `PASSKEY_MAX_FEE_STROOPS` (default 1 XLM). A DAO vote prepares at ~0.59 XLM. |
| `Error(Contract, #17)` from the vault | `InvalidProof`: the proof does not match the inputs the vault rebuilt (wrong region/typhoon symbol, oracle key, band or damage). |
| `Error(Contract, #16)` | `ZkNotConfigured`: no verifying key, or the oracle has no registered key hash. Run the rollout. |
| DAO `Error(Contract, #12)` on finalize | Still in the timelock; `e2e_pipeline.mjs status` shows the remaining time. |
| Claim fails with `NoConsensus` (#9) | The ZK report's region symbol must equal the policy's region exactly (`Eastern Visayas` → `Eastern_Visayas`). |
| `nargo` not found on Windows | Noir has no Windows build; install it in WSL (`noirup -v 1.0.0-rc.6`). |
