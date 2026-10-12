# TyFi Protocol — Week 3 Delivery Evidence

> **Expected Output:** *"Achieve functional, seedless passkey smart account creation and transaction authorization bound strictly to device biometrics live on the Stellar Testnet. Successfully create at least 2 testnet smart accounts via the Passkey Kit. Deploy a live prototype URL allowing reviewers to independently test passkey account creation. Generate verifiable Stellar Expert transaction links that mathematically prove the seedless deployment of a `smart_wallet_factory` account. Verify that 'Seedless Passkey Authentication Live on dApp' hits the required technical milestone."*
>
> **Network:** Stellar Testnet — `Test SDF Network ; September 2015` (Protocol 29)  
> **Soroban SDK:** `27.0.0-rc.1` · **Stellar JS SDK:** `16.3.1` · **Passkey Kit:** `passkey-kit@0.19.1`  
> **Branch:** `week3/passkey-smart-wallets` → `master`  
> **Delivery Date:** 2026-10-12

---

## 0. Summary

| Milestone | Status | Evidence |
|---|:---:|---|
| `smart_wallet_factory` integrated with the Stellar Passkey Kit SDK | ✅ | §2, §5 |
| Frontend ↔ backend ↔ Soroban factory environment bridge configured | ✅ | §6 |
| `__check_auth` intercepts and validates Protocol 21 `secp256r1` WebAuthn signatures | ✅ | §3 |
| Default Ed25519 authentication overridden by prime256v1 (P-256) | ✅ | §3 |
| Biometric registration and login buttons connected to the Passkey SDK | ✅ | §5 |
| Seamless biometric UI pipeline (no keys, no jargon, no seed) | ✅ | §5 |
| Device biometrics bound to wallet creation, seed phrases bypassed entirely | ✅ | §2, §3 |
| ≥ 2 testnet smart accounts created via the Passkey Kit | ✅ (2) | §1 |
| Live prototype URL for reviewers | ✅ | §7 |
| Verifiable Stellar Expert links proving seedless factory deployment | ✅ | §1 |
| "Seedless Passkey Authentication Live on dApp" | ✅ | §1, §8 |

---

## 1. 🔗 On-Chain Proof (Stellar Expert)

### A. Deployed contracts

| Item | Value |
|---|---|
| `smart_wallet_factory` | [`CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM`](https://stellar.expert/explorer/testnet/contract/CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM) |
| `smart_wallet` WASM hash (installed, instantiated per passkey) | `5d59961865c3bc4a03db146e5a47e361b5eb7f5392fc379e3c2f0457e6dac4b1` (16,822 bytes) |
| Factory WASM size | 8,438 bytes |
| Factory admin | `GC4GMBGK7DUGXJWGFEJFWGENX3MG3KOZAHJ3W2GGN2J3YRAO3QFCHNGC` |
| Fee sponsor (relayer) | `GDUF46FCQFNBHNWNENYSDSQPDP3PSL2S7CTKLJELGBOC6SJC62JPKMJ7` — envelope source only, never an authorizer |

| Step | Action | TX |
|:---:|---|:---:|
| 1 | Upload `smart_wallet` WASM | [98eaa2a0…da09c](https://stellar.expert/explorer/testnet/tx/98eaa2a028983ff1abd46ccd544a357bd1c798cf0c4a4c3c8c8ed1b38d4da09c) |
| 2 | Upload `smart_wallet_factory` WASM | [103c9a0b…bd546](https://stellar.expert/explorer/testnet/tx/103c9a0bbf3fa6cb26d5358168fbb7bec590de3ee876110adf224668787bd546) |
| 3 | Deploy factory (constructor: admin, wallet WASM hash) | [8d56062e…42495](https://stellar.expert/explorer/testnet/tx/8d56062e096d2de591a5e717c70b50d0136adbb19c890da983849cc1dfa42495) |
| 4 | Operator: extend shared wallet code TTL | [bbf94239…60037](https://stellar.expert/explorer/testnet/tx/bbf94239b24dfa75506a7d27429bfcd086423d04ce29c048adc44dd0fb260037) |
| 5 | Operator: extend factory instance TTL | [19bbf438…09283](https://stellar.expert/explorer/testnet/tx/19bbf438fee6bca9f06d539808b0ade3c9e79797b4d7b5970daabf017cb09283) |
| 6 | Operator: extend factory code TTL | [1477003a…eae2d](https://stellar.expert/explorer/testnet/tx/1477003aae0e68b6aeb0b36e824616dd4f3a265d9b3af78c9fd46029ad2eae2d) |

### B. Seedless smart accounts created through the Passkey Kit UI

Each account below was created by clicking **"Create wallet with Face ID / fingerprint"** on the `/passkey` page. The Passkey Kit ran the WebAuthn registration ceremony (ES256, user verification required), the relayer deployed the wallet through the factory, and a 1 XLM payment was then **authorized only by a passkey signature** verified on-chain by `__check_auth`. Finally the session was cleared and the account was **signed back into using only the passkey**, which recovered the same wallet.

| # | Smart account | `factory.deploy` (seedless creation) | Welcome XLM | Passkey-signed 1 XLM payment |
|:---:|---|:---:|:---:|:---:|
| 1 | [`CBF4KRNXMZWV5FW4OT5MWHKTGYM52MBSY7V2DL6LCF3AEHQ5K7INW35B`](https://stellar.expert/explorer/testnet/contract/CBF4KRNXMZWV5FW4OT5MWHKTGYM52MBSY7V2DL6LCF3AEHQ5K7INW35B) | [59bc1451…c4f03](https://stellar.expert/explorer/testnet/tx/59bc1451b23880e2c47b506917c2c233bde60385c3f7cdba2f93c701380c4f03) | [18b59842…f9c5a](https://stellar.expert/explorer/testnet/tx/18b59842a33131d84f957ac1b572b9371be3709ea585843ab5c880e3e0ff9c5a) | [ef1beec6…d37a5](https://stellar.expert/explorer/testnet/tx/ef1beec636f93c2f1f994832485a2a86f9935dba83dc35b34c7fa9aebf8d37a5) |
| 2 | [`CDJBGVJLYSHSUR2AJOINQIM6CG3WIQOUW62GIYRDRELUVU35YVB6J6AX`](https://stellar.expert/explorer/testnet/contract/CDJBGVJLYSHSUR2AJOINQIM6CG3WIQOUW62GIYRDRELUVU35YVB6J6AX) | [5eb2ad96…f2b85](https://stellar.expert/explorer/testnet/tx/5eb2ad96d4cd99e19efb6d2e2e51c92a8a048aef667de9eb2aa1b899510f2b85) | [1e358a96…93b21](https://stellar.expert/explorer/testnet/tx/1e358a96ce72d7ea548341ebd610635422539b2db120b5d468592becee793b21) | [22d6d010…c97b1](https://stellar.expert/explorer/testnet/tx/22d6d010beb2e45b6ae628c9434365a84a4a5e85a0cc5a070a7189c9871c97b1) |

**Why these links prove seedless deployment.** In each `factory.deploy` transaction:
- **Source and fees:** the source account is the sponsor, which pays the fee.
- **Contract creation:** the wallet is created by the factory contract through `deploy_v2`.
- **Wallet binding:** the only key material passed in is a passkey credential id and a 65-byte P-256 public key. The constructor binds them atomically.
- **No user keypair:** no Ed25519 keypair or seed phrase belongs to the user at any point.

In each payment transaction, the wallet's `SorobanAddressCredentials.signature` is a `Signatures` map holding a WebAuthn `authenticatorData` / `clientDataJSON` / P-256 signature. The network accepted it only after `__check_auth` verified it.

> **About the authenticator used for these two accounts:** they were created by `scripts/e2e/passkey-e2e.mjs`, which drives the real production UI in Chrome with the DevTools **virtual authenticator** (CTAP2, internal/platform transport, user verification = true). Everything above the authenticator is the shipping code path: WebAuthn API, Passkey Kit, relayer, factory and `__check_auth`. Reviewers can create additional accounts on physical devices (Face ID, Touch ID, Windows Hello, Android fingerprint) at the prototype URL in §7.

### C. Cost per action (paid by the sponsor, measured on-chain)

| Action | Fee |
|---|---|
| Create a seedless wallet | **0.0357625 XLM** |
| Passkey-authorized transfer | **0.0024021 XLM** |

---

## 2. 🏭 `smart_wallet_factory` (rewritten)

`contracts/smart_wallet_factory/src/lib.rs` replaces the Week 1 stub, which deployed a WASM without binding any key.

| Function | Auth | Purpose |
|---|---|---|
| `__constructor(admin, wallet_wasm_hash)` | — | One-time initialization at deploy |
| `deploy(key_id, public_key) → Address` | none (sponsor-payable) | Deploys a wallet via `deploy_v2` with constructor args `(key_id, public_key)` |
| `get_wallet_address(key_id, public_key)` | view | Deterministic address before deployment |
| `get_wallet(key_id, public_key)` / `is_wallet(address)` / `wallet_count()` | view | Registry lookups (used by sign-in and the relayer) |
| `set_paused(bool)` | admin | Emergency stop for new wallets (existing wallets unaffected) |
| `propose_admin` / `accept_admin` | admin / pending admin | Two-step admin transfer |
| `set_wallet_wasm_hash` / `upgrade` | admin | Code rotation for new wallets / factory upgrade |

**Address derivation:** `salt = sha256(public_key ‖ key_id)`. Because the salt commits to the public key, someone who copies a user's credential id from the mempool and pairs it with their own key deploys to a *different* address. The victim's wallet still lands exactly where their client expects. Deployment needs no authorization: deploying someone else's wallet for them is harmless, because only their passkey can ever control it. This is how fee sponsorship works.

---

## 3. 🔏 `smart_wallet` — Protocol 21 secp256r1 `__check_auth`

`contracts/smart_wallet` is a Soroban **custom account** (`CustomAccountInterface`). It replaces the default Ed25519 account check with WebAuthn P-256 verification.

```rust
fn __check_auth(env, signature_payload: Hash<32>, signatures: Signatures, _ctx) -> Result<(), Error> {
    // non-empty, ≤ MAX_SIGNERS entries
    for (SignerKey::Secp256r1(key_id), Signature::Secp256r1(assertion)) in signatures {
        let signer = storage::get_signer(&env, &key_id).ok_or(Error::UnknownSigner)?;
        webauthn::verify(&env, &signature_payload, &assertion, &signer.public_key)?;
    }
    Ok(())
}
```

`webauthn::verify` performs:

1. **Authenticator data:** at least 37 bytes. Flags must include **UP (0x01)** and **UV (0x04)**. UV means the device performed biometric or PIN verification, which is how accounts are bound "strictly to device biometrics".
2. **clientDataJSON:** at most 1024 bytes, parsed with `serde-json-core`; field order and extra fields are tolerated. `type == "webauthn.get"`, and `challenge == base64url(signature_payload)`, compared byte for byte.
3. **Signature:** `env.crypto().secp256r1_verify(public_key, sha256(authenticatorData ‖ sha256(clientDataJSON)), signature)`. This is the native Protocol 21 host function for prime256v1. The host rejects malleable high-S signatures (proven by test).

**Other functions:**
- `__constructor(key_id, public_key)`: binds the first passkey atomically, so there is never an uninitialized window.
- `add_signer` / `remove_signer` / `upgrade`: self-authorized, so they require a passkey assertion.
- `remove_signer` can never remove the last passkey.
- Read functions: `get_signer`, `signer_count`, `version`.

The `SignerKey` / `Signature` / `Signatures` types are **wire-compatible with the Stellar Passkey Kit**, so its `PasskeySigner` output is accepted as is.

### Typed errors

`NoSignatures(1) UnknownSigner(2) AuthenticatorDataTooShort(3) UserNotPresent(4) UserNotVerified(5) ClientDataTooLarge(6) ClientDataMalformed(7) InvalidClientDataType(8) ChallengeMismatch(9) InvalidPublicKey(10) InvalidKeyId(11) SignerAlreadyExists(12) LastSigner(13) TooManySigners(14)`

---

## 4. 🛰️ Fee-Sponsoring Relayer (`functions/passkey`, `/api/passkey`)

| Endpoint | Purpose | Rate limit (per client IP) |
|---|---|---|
| `GET /config` | Public network/contract settings for the frontend | — |
| `GET /health` | Sponsor balance, latest ledger | 30/min |
| `POST /wallets` | `{keyId, publicKey}` → deploy or find the wallet (idempotent) | 10 / 10 min |
| `POST /wallets/:address/fund` | Testnet welcome XLM (factory wallets below 1 XLM only) | 5 / hour |
| `POST /submit` | `{func, auth[]}` → sponsor a passkey-authorized invocation | 20/min |

**Sponsor-safety policy** (`policy.ts`, unit-tested). The sponsor signs the envelope, so it must never be able to authorize anything:
- Exactly one `invokeContract` host function, to an **allowlisted** contract: vault, DAO, or native XLM SAC. The factory is reachable only through `/wallets`.
- Every auth entry must use **address credentials**. Source-account credentials are rejected, because the sponsor's envelope signature would satisfy them.
- Authorizers must be contracts, never the sponsor, and must be **wallets deployed by this factory** (checked on-chain, then cached).
- The relayer **re-simulates with the passkey-signed entries**, so the network runs `__check_auth` before the sponsor signs. It refuses to sign if assembly would add authorization that wasn't provided.
- A per-transaction **fee cap** applies (`PASSKEY_MAX_FEE_STROOPS`, default 0.5 XLM).
- Submissions are **serialized** (no sequence collisions) and confirmation is polled for up to about 60s.
- Archived wallet state is **auto-restored** with a `RestoreFootprint` before the call.
- Configuration **fails closed**: any invalid `PASSKEY_*` value disables the endpoints (HTTP 503). Mainnet is refused unless explicitly enabled.
- `app.set('trust proxy', 1)` is now set, so every rate limiter (including pre-existing ones) keys on the real client IP behind Render's proxy.

---

## 5. 📱 Frontend: Passkey Kit Integration & Biometric UX

`frontend/src/lib/passkey/`:

| Module | Role |
|---|---|
| `webauthn.ts` | Passkey Kit `PasskeyKit.createKey` (registration) and `PasskeySigner` (assertions), driven by a strict WebAuthn client that **forces** `userVerification: "required"` and discoverable credentials; on-curve key check; ECDSA public-key recovery |
| `account.ts` | `createSeedlessWallet` (register → deploy → **re-verify on-chain** → testnet funding) and `signInWithPasskey` (assertion → key recovery → factory lookup → signer cross-check) |
| `authorize.ts` | `invokeWithPasskey`: simulate → sign each wallet auth entry over the exact Soroban payload → relayer |
| `encoding.ts` | XDR encoding of `Signatures(Map<SignerKey, Signature>)` and the `HashIdPreimage::SorobanAuthorization` payload |
| `config.ts` / `api.ts` / `chain.ts` / `session.ts` / `errors.ts` / `payments.ts` / `base64url.ts` | Environment bridge, relayer client, on-chain reads, secret-free session, plain-language errors, exact XLM amounts, browser-safe base64url |

**UI:**
- **Wallet picker:** "Create wallet with Face ID / fingerprint" and "I already have a passkey wallet — sign in" come first (testnet).
- **Progress:** step-by-step text tells users what their device is about to ask and why: *"Confirm with your fingerprint, face or device PIN" → "Creating your wallet on Stellar — TyFi pays the fee" → "Adding free test XLM"*.
- **Errors:** WebAuthn, relayer and contract errors map to one actionable sentence (e.g. a cancelled prompt says "Nothing was changed — try again when ready").
- **Dashboard:** vault and DAO actions from a passkey wallet are authorized by biometric and fee-sponsored, with the same analytics funnel as extension wallets. Smart-wallet balances are read from the native asset contract.
- **Mock removed:** the previous mock (`WEBAUTHN_SPONSORED_…` fake addresses and timed delays) is gone.

---

## 6. ⚙️ Environment Bridge (frontend ↔ backend ↔ Soroban)

| Where | Setting | Value |
|---|---|---|
| Frontend (`.env.example`) | `VITE_BACKEND_URL` | `https://tyfi-yzbn.onrender.com` |
| Frontend | `VITE_PASSKEY_FACTORY_ID` / `VITE_PASSKEY_WALLET_WASM_HASH` / `VITE_PASSKEY_RPC_URL` | defaults to the deployment above |
| Backend (`functions/.env.example`) | `PASSKEY_NETWORK` | `testnet` |
| Backend | `PASSKEY_SPONSOR_SECRET` | secret manager only |
| Backend | `PASSKEY_FACTORY_ID`, `PASSKEY_WALLET_WASM_HASH` | as above |
| Backend | `PASSKEY_ALLOWED_CONTRACTS` | vault `CARODUWJ…`, DAO `CB3A3IZM…` |
| Backend | `PASSKEY_MAX_FEE_STROOPS`, `PASSKEY_WELCOME_XLM`, `TRUST_PROXY_HOPS` | `5000000`, `5`, `1` |

At startup the frontend checks that the backend's factory id matches its own build and refuses to proceed on a mismatch. The single source of truth for deployed values is `contracts/deployments/testnet-passkey.json`.

---

## 7. 🌐 Live Prototype for Reviewers

**URL:** https://www.tyfi.site/passkey (also reachable from **Connect Wallet** on https://www.tyfi.site).

1. Open the page on a phone or laptop with Face ID, Touch ID, Windows Hello or an Android fingerprint.
2. Tap **Create wallet with Face ID / fingerprint** and confirm the device prompt.
3. Your wallet address appears with a **Wallet created by factory** Stellar Expert link, plus 5 test XLM.
4. Paste any testnet address, tap **Send**, and confirm with your biometric. A **Passkey-signed payment** link appears.
5. Tap **Disconnect**, then **sign in** with the passkey to recover the same wallet with no seed phrase.

---

## 8. 🧪 Testing

| Suite | Count | Notes |
|---|---:|---|
| `smart_wallet` (Rust) | 30 | 27 contract + 3 base64url. **Real P-256 keys** via `p256`. Covers every rejection path, high-S malleability, tampered data, multi-signer maps, and **host-driven auth entries** (`set_auths`) that prove the full Soroban auth path, including argument-swap rejection |
| `smart_wallet_factory` (Rust) | 12 | Deploys the **real compiled wallet WASM**; covers deterministic addresses, duplicates, front-running, end-to-end passkey verification on factory-made wallets, pause, two-step admin and code rotation |
| Relayer (`node:test`) | 14 | Sponsor policy (source-account auth, sponsor as signer, G-account signers, non-allowlisted contracts, uploads, entry limits) and key parsing with real P-256 keys, including off-curve rejection |
| Frontend (`vitest`) | 10 | Public-key recovery from real P-256 WebAuthn assertions, XDR encoding layout and ordering, auth payload binding to nonce/expiry/network, XLM parsing, base64url parity with Node |
| Browser E2E (`scripts/e2e/passkey-e2e.mjs`) | 2 accounts | Real UI + virtual authenticator against testnet: create, fund, passkey-signed payment, sign-out, passkey-only sign-in |
| `cargo clippy --all-targets` | 0 warnings | `smart_wallet`, `smart-wallet-factory` |

```bash
cd contracts && stellar contract build --package smart_wallet && cargo test -p smart_wallet -p smart-wallet-factory
cd functions && npm test
cd frontend && npm test
APP_URL=http://localhost:5173 node scripts/e2e/passkey-e2e.mjs 2
```

---

## 9. 💸 Rent Engineering (problem found and fixed during delivery)

The first deployment prepaid about 120 days of storage rent inside `deploy`. The relayer's fee cap blocked it: a single wallet would have cost **~141 XLM**.

| Iteration | Change | Wallet creation | First payment |
|---|---|---:|---:|
| 1 | Extend all entries to ~120 days on create | ~141 XLM | — |
| 2 | Extend to ~30 days | ~28.8 XLM | — |
| 3 | Create at network minimum TTL; extend on use | 0.054 XLM | ~28.6 XLM (`__check_auth` extended shared code) |
| **4 (final)** | **No TTL extension on user transactions**; operator script for shared code + factory; relayer auto-restore | **0.036 XLM** | **0.0024 XLM** |

The superseded factories are listed in `contracts/deployments/testnet-passkey.json` under `superseded`.

---

## 10. 🔒 Security Notes & Known Limitations

- **Threat model:** documented in [`docs/passkey-architecture.md`](docs/passkey-architecture.md); invariants are summarized in [`SECURITY.md`](SECURITY.md).
- **Testnet only:** mainnet passkey wallets stay disabled until an independent audit, matching the app's mainnet lock.
- **Recovery:** relies on a second registered passkey or platform passkey sync (iCloud Keychain / Google Password Manager).
- **Funding:** the welcome XLM faucet is testnet-only.

---

## 11. 📁 Files Delivered

- `contracts/smart_wallet/` *(new)*: `lib.rs`, `webauthn.rs`, `base64url.rs`, `types.rs`, `storage.rs`, `events.rs`, `error.rs`, `test.rs`
- `contracts/smart_wallet_factory/` *(rewritten)*: `lib.rs`, `storage.rs`, `events.rs`, `error.rs`, `test.rs`
- `contracts/deployments/testnet-passkey.json`
- `scripts/deploy_passkey_testnet.sh`, `scripts/extend_passkey_ttl.sh`, `scripts/build_contracts.sh`, `scripts/e2e/passkey-e2e.mjs`
- `functions/passkey/`: `config.ts`, `policy.ts`, `keys.ts`, `relayer.ts`, `router.ts` (+ tests); `functions/scripts/passkey-smoke.ts`
- `frontend/src/lib/passkey/*`, `frontend/src/components/PasskeyOnboarding.tsx`, `PasskeyWalletCard.tsx`, `PasskeyLab.tsx`
- `docs/passkey-architecture.md`, `SECURITY.md`, `README.md`, `week3.md`, `pr_body_week3.md`

---

## 12. ➕ Addendum: Linking Existing Accounts & Cold-Start Resilience

**Account linking.** Users connected with Freighter, WalletConnect or Albedo can link their account to a seedless passkey wallet (**Settings → Passkey sign-in**). `smart_wallet_factory.link_account(wallet, account)` requires *both* signatures — the account's (envelope) and the passkey's (`__check_auth`). Links are one-to-one, either party can unlink, and the TyFi profile carries over to the passkey wallet so the user can switch to biometric sign-in without losing their farms or verification.

| Item | Link |
|---|---|
| Factory upgraded in place (same address) | [upload](https://stellar.expert/explorer/testnet/tx/bea4f302ace1ffc8540dc519ad8b33240d31e0e5e6fcdb340227e5d56f485709) · [upgrade](https://stellar.expert/explorer/testnet/tx/549a1ae3c8f56fc44b15cbd48853e3fbf5cf335e2412f23ef15d9c11adb0dbd8) — `wallet_count` 5 → 5 |
| Link (account + passkey) | [7874272…511ee](https://stellar.expert/explorer/testnet/tx/7874272049b87cba32c7bce0a9c48fd648ea1ba159a194352ef1d3ccd9e511ee) |
| Unlink (account side) | [796f763…13bde](https://stellar.expert/explorer/testnet/tx/796f7635bab27d2e6dcd45a5f33499b14cc04ebf52cafc6ceb70d6dbcfb13bde) |
| Re-link | [6667f9c…13980](https://stellar.expert/explorer/testnet/tx/6667f9c6c5c1d0abe825b6228475aa1f4f01f74b9bb3103d11199640b7a13980) |

Tests: 4 new factory tests (16 total) and `scripts/e2e/passkey-link-e2e.mjs`, which runs the real frontend link/unlink code against testnet.

**Cold starts.** The Render backend sleeps when idle and its wake-up responses lack CORS headers, which surfaced as "blocked by CORS policy" in browsers. The passkey client now retries those transparently and tells the user the servers are waking up.

## 13. ➕ Addendum: Multi-Device Passkeys (pairing, device review, removal)

Users can now use their seedless wallet on more than one device without ever exposing a key:

- **Add another device** (Settings / wallet card → *Your devices*): generates a one-time code (`tyfi-pair-…`, 256-bit, 10 minutes, single use, stored only as a SHA-256 hash). The new device pastes it under *Connect Wallet → Use a code from another device*, creates **its own passkey**, and the original device approves with a biometric, which adds the new passkey on-chain via `add_signer`.
- **Review devices:** after a server-verified passkey proof, each device shows its name/type (e.g. "Android · Chrome"), when it was added and last used, and its IP addresses — **hidden by default**, revealed with the eye icon.
- **Remove a device:** on-chain `remove_signer` approved by biometric; the last device can never be removed.

| Proof | Link |
|---|---|
| Payment signed by the *paired* device's own passkey | [be73b50b…dcc80f4](https://stellar.expert/explorer/testnet/tx/be73b50b0120a3ee6c1cc4ca04e84ca743174e9e402fed9b13136f782dcc80f4) |

Tests: 33 relayer unit tests (WebAuthn verification, sessions, pairing codes, user-agent parsing, self-admin policy) and `scripts/e2e/passkey-devices-e2e.mjs`, which pairs a second virtual device, signs in on it with only its passkey, pays with it, and removes it — confirming on-chain that its key is gone.
