# Vendored Noir libraries

Unmodified sources (except the `[dependencies]` paths in `eddsa/Nargo.toml`),
pinned to the tagged releases that build with Noir **1.0.0-beta.9**, the
toolchain the on-chain UltraHonk verifier supports (Barretenberg 0.87.0). All
are Apache-2.0; each folder keeps its license.

| Folder | Upstream | Revision |
|---|---|---|
| `eddsa/` | github.com/noir-lang/eddsa | `v0.1.3` |
| `ec/` | github.com/noir-lang/ec | `v0.1.2` (what eddsa v0.1.3 pins) |
| `poseidon/` | github.com/noir-lang/poseidon | `v0.1.1` (what eddsa v0.1.3 pins); Circom-compatible BN254 Poseidon (`bn254::hash_N`) |

They are vendored rather than referenced by git tag so the circuit builds
reproducibly offline.
