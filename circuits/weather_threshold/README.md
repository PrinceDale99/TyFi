# weather_threshold — Groth16 weather trigger circuit

Proves that **an authorized oracle signed a wind reading for a given typhoon and
region, and that the reading meets a payout band**, without putting the raw
reading on-chain. The vault checks the proof inside
`submit_weather_report_zk` with a BN254 pairing check.

| | |
|---|---|
| Proof system | Groth16 over BN254 (snarkjs 0.7.6, circom 2.2.3) |
| Constraints | 8,037 non-linear + 1,428 linear |
| Proof size | 256 bytes (A: 64, B: 128, C: 64) |
| Proving time | ~2.5 s on a laptop (Node, snarkjs) |
| On-chain verification | ~27.7M CPU instructions (28% of the per-tx limit) |

## Statement

Private: `wind_speed`, oracle EdDSA public key `(Ax, Ay)`, signature `(R8x, R8y, S)`.

Public, **in this order** (the vault rebuilds them; the caller cannot choose them):

| # | Signal | Built on-chain from |
|---|---|---|
| 0 | `oracle_key_hash` | `OracleZkKeyHash(oracle)`, set by admin multisig |
| 1 | `typhoon_id` | `symbol_to_field(typhoon_id)` |
| 2 | `region_id` | `symbol_to_field(region)` |
| 3 | `payout_threshold` | `wind_floor` argument |
| 4 | `damage_percentage` | `damage_percentage` argument |

Constraints:

1. `wind_speed >= payout_threshold` (both range-checked to 32 bits)
2. `payout_threshold != 0`
3. `damage_percentage <= 100` (range-checked to 8 bits)
4. `Poseidon(Ax, Ay) == oracle_key_hash`
5. `EdDSAPoseidonVerify((Ax, Ay), (R8, S), Poseidon(typhoon_id, region_id, wind_speed, damage_percentage))`

`symbol_to_field(s) = sha256(XDR(ScVal::Symbol(s)))` with the top byte zeroed,
so it is always below the field modulus. `functions/zk/encoding.ts` and
`contracts/typhoon_resilience_vault/src/lib.rs` implement it identically; the
contract test `symbol_encoding_matches_the_oracle` checks they agree.

Because the vault binds every public input, a proof cannot be replayed for
another storm or region, cannot claim more damage or a higher wind band than
was signed, and cannot come from a key other than the one registered for the
submitting oracle address.

## Build

```bash
npm install
npm run compile   # build/ — R1CS, witness WASM, symbols
npm run setup     # Groth16 setup; writes artifacts/
npm run sync      # copies artifacts into functions/zk/artifacts for the Render service
```

After a new setup, regenerate the contract test fixture and reinstall the
verifying key on the vault:

```bash
cd ../../functions && npx ts-node --transpile-only zk/scripts/gen-contract-fixture.ts
node ../scripts/week4/zk_testnet_rollout.mjs   # set_zk_verifying_key
```

## Trust assumptions

- **Trusted setup.** `scripts/setup.js` runs a single-party powers-of-tau and
  phase-2 contribution. Anyone who kept that entropy could forge proofs. This
  is acceptable for testnet only; mainnet needs a public phase-1 file and a
  multi-party phase 2.
- **Oracle honesty.** The circuit proves the oracle *signed* the reading, not
  that the reading is true. Multi-oracle quorum (`QuorumThreshold`) is the
  defence against a single dishonest oracle.
- **Wind floor, not wind speed.** The vault stores the proven band as
  `OracleWindSpeed`; payout bands compare against that lower bound.
