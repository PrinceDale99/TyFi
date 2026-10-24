# weather_threshold_noir — the weather trigger statement in Noir

The same statement as [`../weather_threshold`](../weather_threshold) (Circom):
**an authorized oracle signed a wind reading for a typhoon and region, and the
reading meets a payout band**, without revealing the reading.

| | Circom (`weather_threshold`) | Noir (this folder) |
|---|---|---|
| Proof system | Groth16 / BN254 | UltraHonk (Barretenberg) |
| Verified by | **the vault, on-chain** (`submit_weather_report_zk`) | `bb.js` off-chain |
| Proving time (laptop) | ~1.4–2.5 s | ~1 s |
| Signature | EdDSA-Poseidon over Baby Jubjub | same |
| Public inputs | key hash, typhoon, region, threshold, damage | same, same order |

### Which one does the vault use, and why both?

Soroban verifies proofs with its BN254 host functions. A Groth16 proof is three
curve points and one 4-pair pairing check (~30M CPU instructions on testnet,
under a third of the per-transaction limit), so that is what the vault
verifies. An UltraHonk verifier needs far more field and curve work per proof
and does not fit Soroban's limits today, so the Noir version is proven and
verified off-chain.

The two circuits are kept equivalent on purpose: they use the same Poseidon
parameters and the same EdDSA construction, so **one oracle signature
satisfies both** (the tests sign with circomlibjs, the oracle's signer, and
prove here). If an on-chain UltraHonk verifier becomes practical, the oracle
can switch proof systems without changing what it signs.

## Constraints

1. `wind_speed >= payout_threshold` (`u32`)
2. `payout_threshold != 0`
3. `damage_percentage <= 100` (`u8`)
4. `poseidon::bn254::hash_2([ax, ay]) == oracle_key_hash`
5. `eddsa_verify::<PoseidonHasher>(ax, ay, s, r8x, r8y, hash_4([typhoon_id, region_id, wind_speed, damage_percentage]))`

`typhoon_id` and `region_id` use the vault's `symbol_to_field` encoding
(`sha256(XDR(ScVal::Symbol))`, top byte zeroed).

## Build and test

Needs `nargo` 1.0.0-rc.6 ([noirup](https://noir-lang.org/docs/getting_started/noir_installation)).
Noir has no Windows build, so on Windows the compile script runs nargo in WSL.

```bash
npm install
npm run compile   # nargo compile + nargo test -> target/weather_threshold_noir.json
npm test          # UltraHonk prove/verify + rejection tests (bb.js, no nargo needed)
```

`target/weather_threshold_noir.json` is committed, so `npm test` works without
nargo. Library dependencies are vendored; see [`vendor/README.md`](vendor/README.md).
