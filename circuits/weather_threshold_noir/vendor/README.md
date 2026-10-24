# Vendored Noir libraries

Unmodified sources (except the `[dependencies]` paths in `eddsa/Nargo.toml`),
pinned to revisions that compile on Noir 1.0. All are Apache-2.0; each folder
keeps its license.

| Folder | Upstream | Revision | Why this revision |
|---|---|---|---|
| `eddsa/` | github.com/noir-lang/eddsa | `1ed4e552` (main, 2026-10-20) | The latest tag, v0.1.3, depends on `ec` v0.1.2, which uses the `u1` type removed in Noir 1.0. `main` moved to `noir-edwards` but has no tag yet. |
| `edwards/` | github.com/noir-lang/noir-edwards | `v0.2.5` | What eddsa `main` pins. The archive has no LICENSE file; see `edwards/NOTICE`. |
| `poseidon/` | github.com/noir-lang/poseidon | `v0.3.0` | What eddsa `main` pins. Circom-compatible BN254 Poseidon (`bn254::hash_N`). |

They are vendored rather than referenced by git tag so the circuit builds
reproducibly offline; switch back to git dependencies once eddsa tags a
Noir 1.0 release.
