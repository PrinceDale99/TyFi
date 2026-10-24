# weather_threshold_noir: the weather trigger statement in Noir

The same statement as [`../weather_threshold`](../weather_threshold) (Circom):
**an authorized oracle signed a wind reading for a typhoon and region, and the
reading meets a payout band**. The vault verifies both versions on-chain.

| | Circom (`weather_threshold`) | Noir (this folder) |
|---|---|---|
| Proof system | Groth16 / BN254 | UltraHonk (Barretenberg 0.87.0, Keccak transcript) |
| Verified by | the vault, `submit_weather_report_zk` | the vault, `submit_weather_report_noir` → [`contracts/noir_verifier`](../../contracts/noir_verifier) |
| CPU instructions per report (testnet, limit 400M) | ~30.4M | ~87.4M (verifier alone: 57.7M) |
| Proof size | 256 bytes | 14,592 bytes |
| Proving time (laptop) | ~1.4 s | ~6 s |
| Hides the wind reading | yes | **no** (see below) |
| Trusted setup | circuit-specific, single-party | none (universal SRS) |
| Signature | EdDSA-Poseidon over Baby Jubjub | same |
| Public inputs | key hash, typhoon, region, threshold, damage | same, same order |

### How the vault verifies it

`contracts/noir_verifier` stores this circuit's verification key
([`artifacts/vk`](artifacts/vk), from `bb write_vk --oracle_hash keccak`) at
deployment and verifies proofs with Soroban's BN254 host functions through
[`ultrahonk_soroban_verifier`](https://github.com/NethermindEth/rs-soroban-ultrahonk)
(NethermindEth, MIT OR Apache-2.0). The vault rebuilds the five public inputs
from the oracle's registered key hash and the report's typhoon, region, band
and damage, so a proof only verifies for the exact report it was made for. The
testnet run (second farm, storm `KRISTINE_2026`, passkey claim) is in
[`week4.md` §1C](../../week4.md).

### Not zero-knowledge

The Soroban verifier implements Barretenberg's **non-ZK** UltraHonk flavor
(`UltraKeccakFlavor`). A proof shows the statement is true, but its protocol
messages depend on the witness, so it does not hide the private inputs (the
raw wind reading and the signature). The Groth16 path does hide them, which is
why it stays the oracle's default; use the Noir path when a circuit-specific
trusted setup is the bigger concern. The two circuits use the same Poseidon
parameters and EdDSA construction, so **one oracle signature satisfies both**
(the tests sign with circomlibjs, the oracle's signer).

## Constraints

1. `wind_speed >= payout_threshold` (`u32`)
2. `payout_threshold != 0`
3. `damage_percentage <= 100` (`u8`)
4. `poseidon::bn254::hash_2([ax, ay]) == oracle_key_hash`
5. `eddsa_verify::<PoseidonHasher>(ax, ay, s, r8x, r8y, hash_4([typhoon_id, region_id, wind_speed, damage_percentage]))`

`typhoon_id` and `region_id` use the vault's `symbol_to_field` encoding
(`sha256(XDR(ScVal::Symbol))`, top byte zeroed).

## Build and test

Toolchain: `nargo` **1.0.0-beta.9** and `bb` **0.87.0**, the versions the
on-chain verifier supports. Install them with
`noirup -v 1.0.0-beta.9` and `bbup -v 0.87.0`. `bb` also needs `jq`. Noir has
no Windows build, so on Windows the compile script runs them in WSL.

```bash
npm install
npm run compile         # nargo compile + nargo test, bb write_vk -> artifacts/vk,
                        # and copies the circuit to functions/zk/artifacts for the oracle
npm test                # bb.js prove/verify (Keccak) + rejection tests, no nargo needed
npm run prove-fixture   # artifacts/proof + artifacts/public_inputs for the verifier tests
```

Set `NARGO=/path/to/nargo` and `BB=/path/to/bb` to use binaries that are not on
`PATH`. `target/weather_threshold_noir.json` and `artifacts/` are committed, so
`npm test` and the contract tests work without nargo or bb. Library
dependencies are vendored; see [`vendor/README.md`](vendor/README.md).

The verifier contract's own tests check the committed proof in the Soroban host:

```bash
cd ../../contracts/noir_verifier && cargo test -- --nocapture   # prints the CPU instruction count
```

## License

MIT (see the repository [`LICENSE`](../../LICENSE)). Vendored libraries keep
their Apache-2.0 licenses.
