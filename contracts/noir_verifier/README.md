# noir_verifier

On-chain verifier for the Noir weather circuit
([`circuits/weather_threshold_noir`](../../circuits/weather_threshold_noir)).
The vault's `submit_weather_report_noir` calls `verify_proof` with public inputs
it builds itself.

| Function | |
|---|---|
| `__constructor(vk: Bytes)` | Stores the circuit's 1,760-byte UltraHonk verification key once. |
| `vk() -> Bytes` | The stored key, so anyone can compare it with `circuits/weather_threshold_noir/artifacts/vk`. |
| `verify_proof(public_inputs: Bytes, proof: Bytes)` | Verifies a 14,592-byte proof against 32-byte big-endian public inputs in circuit order. Errors: `ProofParseError` (#3), `VerificationFailed` (#4). |

Built on [`ultrahonk_soroban_verifier`](https://crates.io/crates/ultrahonk_soroban_verifier)
0.1.0 (NethermindEth/rs-soroban-ultrahonk, MIT OR Apache-2.0), which supports
Barretenberg 0.87.0 proofs with the Keccak transcript, non-zero-knowledge
flavor. It needs soroban-sdk 28 and protocol 28+, so this crate is its own
Cargo workspace, separate from the vault's (soroban-sdk 27).

**Testnet:** [`CBOR46OZEO26T7HWG7SG7WZB34ZBPJXTO2F5EUJLXQGUVC3MSB2LERW6`](https://stellar.expert/explorer/testnet/contract/CBOR46OZEO26T7HWG7SG7WZB34ZBPJXTO2F5EUJLXQGUVC3MSB2LERW6)

```bash
cargo test -- --nocapture   # verifies the committed fixture proof; prints CPU instructions (~57.7M)
stellar contract build      # soroban-sdk 28 contracts must be built with the stellar CLI
```

Deploy and link it to a vault with `scripts/week4/noir_testnet_rollout.mjs`.
