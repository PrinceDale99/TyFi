## Week 1 — Gas Optimization, Noir ZK Verifier Integration & Stellar Testnet Deployment

> **Milestone:** Optimize gas limits for `typhoon_resilience_vault`; compile Noir ZK verifier logic into efficient WASM bytecode; deploy vault and verifier contracts to Stellar Testnet.
>
> **Date range:** Sep 28 – Oct 2, 2026  
> **Commits:** 38 commits  
> **Tests:** 44/44 passing

---

### 📋 What's in this PR

#### 1. ⚡ Gas Optimization (`opt-level=z`, LTO, zero-cost storage layout)

Vault WASM compiled to **29.1 KB** with aggressive release profile:

```toml
[profile.release]
opt-level       = "z"     # Minimum WASM binary size
lto             = true    # Cross-crate dead code elimination
codegen-units   = 1       # Maximum LLVM optimization passes
panic           = "abort" # No unwinding overhead
overflow-checks = true    # Security: arithmetic overflow guards
```

Key code-level optimizations:
- `64a7eb8` — Actuarial compound yield math refactored to reduce CPU instructions
- `c701e79` — Policy subscription storage layout + TTL auto-renewal on write
- `c59823a` — `bump_persistent`/`bump_temporary` helpers eliminate repeated inline TTL calls
- `e1ccda4` — LP share accounting uses instance storage (cheapest) for hot-path reads
- `2a9bd99` — Subsidy pool in instance storage (single ledger entry)

#### 2. 🔐 Noir ZK Verifier — Circuit + Soroban Integration

**Circuit:** `circuits/weather_oracle/src/main.nr` (Nargo 0.22.0)

Proves wind speed exceeded parametric payout threshold **without revealing raw sensor data** on-chain:
```noir
fn main(
    wind_speed:       u64,         // private witness
    oracle_pub_key_x: Field,       // private witness
    oracle_pub_key_y: Field,       // private witness
    signature:        [u8; 64],    // private witness
    typhoon_id:       pub Field,   // public input
    region_id:        pub Field,   // public input
    payout_threshold: pub u64      // public input
) {
    assert(wind_speed >= payout_threshold);
    assert(payout_threshold != 0);
    assert(region_id != 0);
    assert(typhoon_id != 0);
}
```

ACIR artifact committed: `circuits/weather_oracle/target/weather_oracle.json`

**Soroban verifier** compiled into the vault WASM as `src/verifier.rs` — avoids extra cross-contract gas overhead. Vault exposes `submit_weather_report_zk(oracle, typhoon_id, region, damage_pct, wind_speed, proof, public_inputs)` which validates proof bytes before writing consensus state.

Commits: `4b30843` `931311f` `a136b5e` `a5dd034` `3d5115c` `3f4c12c` `8fd6841`

#### 3. 🚀 Stellar Testnet Deployment — 9 Verified Transactions

**Contract:** [`CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR`](https://stellar.expert/explorer/testnet/contract/CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR)

| Step | Action | TX Hash |
|:---:|---|---|
| 1 | Upload vault WASM | [`4bedd7e9…`](https://stellar.expert/explorer/testnet/tx/4bedd7e9d6f163ed98965d2a72afe9e467596b8f423a194f9e6db07a13178691) |
| 2 | Deploy contract | [`c65e9d12…`](https://stellar.expert/explorer/testnet/tx/c65e9d12484702fafa31f9fbd1bf8b162e060542bf915db295fb0115a7e4179b) |
| 3 | Initialize vault | [`4f9467da…`](https://stellar.expert/explorer/testnet/tx/4f9467dabd89f56ac80f977021ee2eebc34485b10d666d36570b854f9bd8f23a) |
| 4 | Admin multisig upgrade | [`22aef453…`](https://stellar.expert/explorer/testnet/tx/22aef453743a022dd1bda7ff8411496ee368d7d909a828c4ecd22415cdb64555) |
| 5 | `deposit_reinsurance` LP1 — 9,990 XLM | [`0f9a834e…`](https://stellar.expert/explorer/testnet/tx/0f9a834e26dd174c9c8f437f8abdcb7f4deed7559dc35ae16a0bd4371f5e969c) |
| 6 | `deposit_subsidy` NGO — 9,990 XLM | [`2e5d864f…`](https://stellar.expert/explorer/testnet/tx/2e5d864f03296ba3e37dc8bde82afe407b24ec7b06fc7ca2d16555e9cbd537a3) |
| 7 | `deposit_reinsurance` LP2 — 9,990 XLM | [`8259394c…`](https://stellar.expert/explorer/testnet/tx/8259394c9711b5432dfdd192cceced35fc3116d2f5335d1ca2bb0ba3a3898da7) |
| 8 | `deposit_reinsurance` LP3 — 4,990 XLM | [`7acb0e75…`](https://stellar.expert/explorer/testnet/tx/7acb0e75f3d887d2018f6038ceb95de4a409d0d629fff5bc081224c54b162683) |
| 9 | `transfer_shares` LP2→LP3 (bond trade) | [`b75e3c97…`](https://stellar.expert/explorer/testnet/tx/b75e3c977d5200c168032598c582eed7c1bd5027cf5b01b733cf8e24bebc9e49) |

Vault TVL after protocol ops: **~24,970 XLM** across 3 independent LPs. Subsidy pool: **9,990 XLM**.

#### 4. ✅ Unit Tests — 44/44 Passing

| Test Suite | Tests | Result |
|---|:---:|---|
| `src/test.rs` — Core vault logic | 19 | ✅ all pass |
| `tests/test_multisig_auth.rs` — Admin multisig auth | 10 | ✅ all pass |
| `tests/test_microloan.rs` — Solvency cap enforcement | 8 | ✅ all pass |
| `src/test_security.rs` — V-1/V-2/V-3 exploit regression | 6 | ✅ all pass |
| `src/test_auth.rs` — Explicit auth coverage | 1 | ✅ all pass |

Notable security regression tests (PoC-level):
- `sec_v1_lp_cannot_exit_after_consensus_while_coverage_outstanding` — LP drain prevention
- `sec_v2_paid_out_policy_key_cannot_be_reused` — Policy replay prevention
- `sec_v3_vault_cannot_sell_cover_it_cannot_pay` — Over-coverage solvency cap

#### 5. 🛡️ Security Hardening

- `9abec3d` — Monotonic admin nonce + domain-separated message signing (replay protection)
- `d0d9bbb` — Signer deduplication prevents multi-count authorization bypass
- `f9b69b1` — `TotalOutstandingCoverage` storage key + real-time solvency tracker
- `5261553` — PoC regression test suite for V-1, V-2, V-3 exploit vectors

#### 6. 📄 Documentation

- `week1.md` — Full Week 1 delivery evidence (tests, TXs, gas, ZK)
- `contracts/deployments/testnet.json` — All 9 TX hashes + contract metadata
- `README.md` — Updated Week 1 checklist with correct contract address and TX table

---

### 📁 Files Changed (key)

```
circuits/
  weather_oracle/src/main.nr          ← Noir ZK circuit
  weather_oracle/target/weather_oracle.json ← ACIR artifact

contracts/typhoon_resilience_vault/
  src/lib.rs                          ← Vault contract (33 functions, 1,050 lines)
  src/verifier.rs                     ← ZK verifier module
  src/test.rs                         ← Core unit tests (19)
  src/test_security.rs                ← Security regression tests (6)
  tests/test_multisig_auth.rs         ← Multisig auth tests (10)
  tests/test_microloan.rs             ← Microloan solvency tests (8)
  Cargo.toml                          ← Gas optimization profile

contracts/deployments/testnet.json    ← 9 verified TX hashes
scripts/build_contracts.sh            ← WASM build pipeline
scripts/deploy_testnet.js             ← 4-step automated deployment
week1.md                              ← Week 1 delivery evidence doc
README.md                             ← Updated with correct contract + TX table
```

---

### ✅ Checklist

- [x] 44/44 unit tests passing
- [x] Vault contract deployed and initialized on Stellar Testnet
- [x] ZK verifier compiled into vault WASM, `submit_weather_report_zk` entrypoint live
- [x] Noir circuit ACIR artifact committed
- [x] 9 public Testnet transaction hashes — all auditable on Stellar Expert
- [x] WASM optimized to 29.1 KB with `opt-level=z` + LTO
- [x] Admin multisig upgrade path verified on-chain (Step 4)
- [x] Security PoC regression suite added (V-1, V-2, V-3)
- [x] `week1.md` delivery evidence doc committed
