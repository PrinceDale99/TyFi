## Week 3 — Seedless Passkey Smart Wallets (secp256r1 `__check_auth` + Stellar Passkey Kit)

> **Milestone:** Integrate `smart_wallet_factory` with the Stellar Passkey Kit SDK, validate Protocol 21 `secp256r1` WebAuthn signatures natively in `__check_auth` (replacing Ed25519), and ship biometric registration/login so users get seedless smart accounts bound to device biometrics — live on Stellar Testnet.
>
> **Branch:** `week3/passkey-smart-wallets` → `master`  
> **Tests:** 42 contract · 14 relayer · 10 frontend · browser E2E (2 accounts) — all passing; `cargo clippy` clean  
> **Network:** Stellar Testnet (Protocol 29) · Full report: [`week3.md`](week3.md) · Threat model: [`docs/passkey-architecture.md`](docs/passkey-architecture.md)

---

### ✅ Expected outputs

- [x] **Seedless passkey smart account creation + transaction authorization bound to device biometrics, live on testnet.**
- [x] **≥ 2 testnet smart accounts via the Passkey Kit:**
  1. [`CBF4KRNX…NW35B`](https://stellar.expert/explorer/testnet/contract/CBF4KRNXMZWV5FW4OT5MWHKTGYM52MBSY7V2DL6LCF3AEHQ5K7INW35B): [factory deploy](https://stellar.expert/explorer/testnet/tx/59bc1451b23880e2c47b506917c2c233bde60385c3f7cdba2f93c701380c4f03) · [passkey-signed payment](https://stellar.expert/explorer/testnet/tx/ef1beec636f93c2f1f994832485a2a86f9935dba83dc35b34c7fa9aebf8d37a5)
  2. [`CDJBGVJL…6J6AX`](https://stellar.expert/explorer/testnet/contract/CDJBGVJLYSHSUR2AJOINQIM6CG3WIQOUW62GIYRDRELUVU35YVB6J6AX): [factory deploy](https://stellar.expert/explorer/testnet/tx/5eb2ad96d4cd99e19efb6d2e2e51c92a8a048aef667de9eb2aa1b899510f2b85) · [passkey-signed payment](https://stellar.expert/explorer/testnet/tx/22d6d010beb2e45b6ae628c9434365a84a4a5e85a0cc5a070a7189c9871c97b1)
- [x] **Live prototype URL:** https://www.tyfi.site/passkey
- [x] **Stellar Expert proof of seedless factory deployment:** factory [`CDL7BZJG…RV7WM`](https://stellar.expert/explorer/testnet/contract/CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM) ([deploy tx](https://stellar.expert/explorer/testnet/tx/8d56062e096d2de591a5e717c70b50d0136adbb19c890da983849cc1dfa42495)) + the links above.
- [x] **"Seedless Passkey Authentication Live on dApp"**: passkey create / sign in is in the main wallet picker, and vault and DAO actions from passkey wallets are biometric-authorized.

---

### 📋 What changed

#### 1. `contracts/smart_wallet` (new) — WebAuthn custom account
- `__check_auth` verifies WebAuthn assertions with the **Protocol 21 `secp256r1_verify`** host function. There is **no Ed25519 path**.
- Enforces UP + **UV (biometric)** flags, `webauthn.get`, and an exact `challenge == base64url(signature_payload)` match. `clientDataJSON` is bounded and parsed with `serde-json-core`. Malleable high-S signatures are rejected.
- The first passkey is bound atomically in `__constructor`. `add_signer` / `remove_signer` / `upgrade` are self-authorized, and the last passkey can't be removed.
- Signature types are wire-compatible with the Passkey Kit `PasskeySigner`.

#### 2. `contracts/smart_wallet_factory` (rewritten)
- `deploy(key_id, public_key)` uses `deploy_v2` with constructor binding. `salt = sha256(public_key ‖ key_id)` makes deployment front-running resistant.
- Also adds a deterministic address view, an `is_wallet` registry, an emergency pause, two-step admin transfer, and code rotation.

#### 3. `functions/passkey` — fee-sponsoring relayer (`/api/passkey`)
- `POST /wallets`, `POST /submit`, `POST /wallets/:addr/fund` (testnet), `GET /config`, `GET /health`.
- **The sponsor can never authorize:** it rejects source-account auth, rejects the sponsor or G-accounts as signers, and requires signers to be factory wallets. The network re-simulates with the signed entries, and the relayer refuses to sign if any authorization is added during assembly.
- Fee cap, per-IP rate limits (with `trust proxy` fixed globally), serialized submissions, auto-restore of archived state, and fail-closed configuration.

#### 4. Frontend — Passkey Kit integration & biometric UX
- The `PasskeyKit.createKey` + `PasskeySigner` WebAuthn client **requires** user verification.
- Seedless creation re-verifies the deployed wallet on-chain. Passkey-only **sign-in on any browser** works through public-key recovery and an on-chain signer check.
- `PasskeyOnboarding` / `PasskeyWalletCard` / `PasskeyLab` (`/passkey`) give step-by-step biometric guidance and plain-language errors.
- Vault and DAO transactions route through biometric authorization. The old mocked biometric onboarding is gone.

#### 5. Ops, docs, tests
- `scripts/deploy_passkey_testnet.sh`, `scripts/extend_passkey_ttl.sh`, the relayer smoke test, and the virtual-authenticator E2E.
- `contracts/deployments/testnet-passkey.json`, `docs/passkey-architecture.md`, `SECURITY.md`, `README.md`, `week3.md`.
- `@stellar/stellar-sdk` upgraded to 16.3.1 (frontend + backend) for protocol 29 and Passkey Kit compatibility.

---

### 💸 Rent engineering
The relayer's fee cap blocked the first deployment design at **~141 XLM per wallet** (prepaid TTLs). The final design keeps rent off user transactions:

| Action | Cost |
|---|---|
| Wallet creation | **0.036 XLM** |
| Passkey-signed payment | **0.0024 XLM** |

See `week3.md` §9.

---

### 🚀 Deployment checklist (after merge)
1. **Render (backend):** set `PASSKEY_NETWORK=testnet`, `PASSKEY_SPONSOR_SECRET` (secret), `PASSKEY_FACTORY_ID`, `PASSKEY_WALLET_WASM_HASH`, and `PASSKEY_ALLOWED_CONTRACTS` (see `functions/.env.example`).
2. **Vercel (frontend):** no new variables are required (the defaults point at the testnet deployment).
3. **Schedule** `scripts/extend_passkey_ttl.sh` weekly.

### 🧪 How to verify locally
```bash
cd contracts && stellar contract build --package smart_wallet && cargo test -p smart_wallet -p smart-wallet-factory
cd functions && npm test
cd frontend && npm test && npm run build
APP_URL=http://localhost:5173 node scripts/e2e/passkey-e2e.mjs 2
```
