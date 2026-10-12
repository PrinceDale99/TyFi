# Seedless Passkey Smart Wallets — Architecture & Threat Model

TyFi lets a farmer open a Stellar account with the fingerprint or face unlock already on their phone. There is no seed phrase, no browser extension and no XLM needed up front.

## Components

| Layer | Component | Responsibility |
|---|---|---|
| Device | Platform authenticator (Face ID, Touch ID, Windows Hello, Android biometrics) | Creates and stores a **secp256r1 (prime256v1 / P-256)** passkey; signs WebAuthn assertions after user verification |
| Frontend | `frontend/src/lib/passkey/*` | Passkey Kit SDK registration + `PasskeySigner` assertions, Soroban auth-entry signing, key recovery for sign-in |
| Backend | `functions/passkey/*` (`/api/passkey`) | Fee-sponsoring relayer: deploys wallets, sponsors passkey-authorized calls, testnet welcome funding |
| Contract | `contracts/smart_wallet` | Custom account: `__check_auth` verifies WebAuthn signatures with the Protocol 21 `secp256r1_verify` host function |
| Contract | `contracts/smart_wallet_factory` | Deploys one wallet per passkey at a deterministic, public-key-committed address |

## Flows

### Create a wallet

```
User taps "Create wallet with Face ID"
  │
  ├─ PasskeyKit.createKey()  ── WebAuthn create (ES256, residentKey + userVerification required)
  │      → credential id + 65-byte P-256 public key (private key stays in the secure enclave)
  │
  ├─ POST /api/passkey/wallets { keyId, publicKey }
  │      relayer validates the key is on-curve, then submits (sponsor = envelope source)
  │      factory.deploy(key_id, public_key)
  │        salt   = sha256(public_key ‖ key_id)
  │        wallet = deploy_v2(wallet_wasm, constructor(key_id, public_key))   ← atomic binding
  │
  ├─ frontend re-reads factory.get_wallet(key_id, public_key) on-chain and checks it matches
  └─ (testnet) sponsor sends 5 XLM welcome balance through the native SAC
```

### Authorize a transaction

```
App builds a contract call (vault deposit, DAO vote, XLM transfer, …)
  │
  ├─ simulate (recording mode) → SorobanAuthorizationEntry for the wallet address
  ├─ payload = sha256(HashIdPreimage::SorobanAuthorization{networkId, nonce, expiration, invocation})
  ├─ PasskeySigner.sign(payload)  ── WebAuthn get, challenge = base64url(payload), UV required
  ├─ credentials.signature = Signatures({ Secp256r1(keyId): Secp256r1{authenticatorData, clientDataJSON, sig} })
  │
  └─ POST /api/passkey/submit { func, auth[] }
         relayer: policy checks → re-simulate WITH the signed entries (network runs __check_auth)
                  → fee cap → sponsor signs envelope → submit → wait for ledger confirmation
```

### Sign in on a new browser

The user picks a TyFi passkey; the assertion over a random challenge yields at most two ECDSA public-key candidates. For each candidate the client asks the factory for `get_wallet(key_id, candidate)` and confirms `wallet.get_signer(key_id)` returns that exact key. No seed, no server-side account database.

## On-chain verification (`__check_auth`)

For every entry of the `Signatures` map:

1. The signer key id must be registered on the wallet (`UnknownSigner`).
2. `authenticatorData` ≥ 37 bytes; flags must include **UP** (user present) and **UV** (user verified — biometric/PIN). Without UV the assertion is rejected (`UserNotVerified`).
3. `clientDataJSON` ≤ 1024 bytes, parsed with `serde-json-core`; `type` must be `webauthn.get`; `challenge` must equal `base64url(signature_payload)` byte for byte (`ChallengeMismatch`).
4. `secp256r1_verify(public_key, sha256(authenticatorData ‖ sha256(clientDataJSON)), signature)`. The host rejects malleable high-S signatures.

Replay protection comes from the Soroban host: the nonce and expiration ledger are part of `signature_payload`, and each nonce can only be consumed once. There is **no Ed25519 path** — the default account check is replaced entirely by WebAuthn P-256.

## Threat model

| Threat | Mitigation |
|---|---|
| Stolen relayer/sponsor key | The sponsor is only ever the envelope source. Relayer policy forbids source-account auth entries, forbids the sponsor as an authorizer and only accepts contract (smart-wallet) authorizers, so the sponsor key cannot authorize wallet actions. Worst case is fee spend, bounded by `PASSKEY_MAX_FEE_STROOPS` and rate limits. |
| Relayer swaps the call or arguments | Signatures cover the full invocation tree; a different call or argument set changes the payload and fails `__check_auth` (covered by `host_rejects_auth_entry_reused_for_different_arguments`). |
| Simulation adds unexpected authorization | Relayer refuses to sign if the assembled transaction's auth differs from the passkey-signed entries. |
| Front-running a wallet deployment | Salt commits to the public key; a copied credential id with another key deploys to a different address (`front_runner_with_copied_key_id_cannot_claim_the_victims_address`). Deploying someone else's wallet for them is harmless: only their passkey controls it. |
| Phishing site requests an assertion | WebAuthn binds credentials to the RP ID (`tyfi.site`); a passkey will not sign for another origin. |
| Assertion replay | Nonce + expiration ledger inside the signed payload; challenge must match exactly. |
| Signature malleability | Low-S enforced by the client (`compactSignature`) and by the host verifier. |
| Lockout | The last passkey can never be removed (`LastSigner`). Users can add a second device's passkey (`add_signer`, self-authorized). |
| Resource exhaustion | ≤ 10 signers per wallet, ≤ 10 signatures per check, ≤ 1024-byte client data, ≤ 4 auth entries per relayed call, per-IP rate limits. |
| Unexpected rent costs | Contracts never extend TTLs on user transactions; the operator maintains shared code/factory TTL (`scripts/extend_passkey_ttl.sh`) and the relayer restores archived wallet entries on demand. |

## Costs (measured on testnet, 2026-10-12)

| Action | Fee paid by sponsor |
|---|---|
| Create a wallet (`factory.deploy`) | 0.0357 XLM |
| Passkey-authorized XLM transfer | 0.0024 XLM |

## Operations

- **Deploy:** `scripts/deploy_passkey_testnet.sh [identity]` → writes `contracts/deployments/testnet-passkey.json`.
- **Rent:** run `scripts/extend_passkey_ttl.sh` weekly.
- **Relayer env:** see `functions/.env.example` (`PASSKEY_*`). The relayer stays disabled (HTTP 503) unless every required value is valid.
- **Smoke test:** `functions/scripts/passkey-smoke.ts`. **UI end-to-end:** `scripts/e2e/passkey-e2e.mjs`.

## Known limitations

- Mainnet is intentionally disabled for passkey wallets until an external audit (the relayer refuses `PASSKEY_NETWORK=mainnet` unless explicitly overridden).
- Account recovery requires a second registered passkey (synced passkeys via iCloud Keychain / Google Password Manager also carry over to new devices).
- The welcome XLM faucet is testnet-only.
