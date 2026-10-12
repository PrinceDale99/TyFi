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


---

## ➕ Post-merge follow-ups (Week 3, 56 commits on `master`)

PR #5 was merged before these follow-ups landed, and GitHub does not allow adding commits to a merged pull request, so they are recorded here. All of them are on `master` (`dc69e1a..6778962`). Full details: [`week3.md`](week3.md) §12–13 and [`docs/passkey-architecture.md`](docs/passkey-architecture.md).

### 1. Link an existing Freighter / WalletConnect account to a passkey wallet
- `smart_wallet_factory.link_account(wallet, account)` requires **both** signatures (the account's envelope + the passkey). Links are one-to-one, and either side can `unlink_account`. The factory was **upgraded in place**: same address, all wallet registrations kept ([upgrade tx](https://stellar.expert/explorer/testnet/tx/549a1ae3c8f56fc44b15cbd48853e3fbf5cf335e2412f23ef15d9c11adb0dbd8)).
- The TyFi profile carries over to the passkey wallet. The **Settings → Passkey sign-in** panel offers to create a new passkey or link an existing one.
- Proof: [link](https://stellar.expert/explorer/testnet/tx/7874272049b87cba32c7bce0a9c48fd648ea1ba159a194352ef1d3ccd9e511ee) · [unlink](https://stellar.expert/explorer/testnet/tx/796f7635bab27d2e6dcd45a5f33499b14cc04ebf52cafc6ceb70d6dbcfb13bde) · [re-link](https://stellar.expert/explorer/testnet/tx/6667f9c6c5c1d0abe825b6228475aa1f4f01f74b9bb3103d11199640b7a13980). 4 new factory tests (16 total) + `scripts/e2e/passkey-link-e2e.mjs`.

### 2. Backend stability on Render's free tier
- **Root cause:** the instance was OOM-killed in a restart loop (two Node processes, one running the full TypeScript type-checker). Proxy errors without CORS headers showed up in browsers as "blocked by CORS policy".
- **Fixes:**
  - one process with the event listener in-process
  - testnet-only listener by default
  - `--max-old-space-size=384` heap cap (measured ~184 MB)
  - a GitHub Actions keep-alive ping every 10 minutes
  - one shared, backed-off XLM-rate poller instead of eight 10-second pollers
  - passkey requests retry through cold starts and say "Waking up TyFi's servers…"

### 3. Multiple devices per passkey wallet
- **Add another device:** a one-time code (`tyfi-pair-…`, 256-bit, 10 minutes, single use, stored only as a SHA-256 hash). The new device creates **its own passkey**, and the original device approves with a biometric, which runs `add_signer` on-chain. A passkey private key never leaves its device, so the code pairs devices; it does not copy a key.
- **Your devices:** name and type, added / last used, and IP addresses (**hidden until the eye is tapped**). Viewing requires a server-verified WebAuthn proof checked against the on-chain signer key, and the session lasts 15 minutes.
- **Remove:** on-chain `remove_signer` approved by biometric. The last device can't be removed.
- Paired devices sign in with only their own passkey; the wallet lookup is re-verified on-chain.
- Proof: [payment signed by the paired device](https://stellar.expert/explorer/testnet/tx/be73b50b0120a3ee6c1cc4ca04e84ca743174e9e402fed9b13136f782dcc80f4). 29 relayer unit tests + `scripts/e2e/passkey-devices-e2e.mjs` (two browser profiles: pair → paired sign-in → pay → remove → key verified gone on-chain).

### 4. Approve transactions with passkey + Passkey settings shortcut
- The **"Approve transactions with passkey"** toggle on `/passkey` is on by default. When an extension account is linked to a passkey wallet, TyFi acts as the passkey wallet, so **all transactions** (deposits, policies, claims, subsidies, DAO votes/proposals, payments) are approved with a biometric and fee-sponsored. When the toggle is off, the extension approves. Changes apply live across tabs.
- **Settings → Passkey settings** opens `/passkey`. The **Add another device** and **Use a code from another device** buttons were made prominent.

### Commit log
<details>
<summary><b>Account linking</b> (20 commits)</summary>

- [`aba56c8`](https://github.com/PrinceDale99/TyFi/commit/aba56c87815c361cfb4084b7891cfc4cbf6ae4a3) feat(factory): add account-link errors and events
- [`b29421a`](https://github.com/PrinceDale99/TyFi/commit/b29421ad2ad57bb708b5d1126f715d678018236b) feat(factory): add account-link error codes
- [`36b148e`](https://github.com/PrinceDale99/TyFi/commit/36b148eb3dd29f768e8cf34ff2023684060fe1f4) feat(factory): store bidirectional wallet-account links
- [`0207550`](https://github.com/PrinceDale99/TyFi/commit/02075500f10cfcf988efb7ab96f396b6d5162a9c) feat(factory): link passkey wallets to existing accounts with dual consent
- [`82e1590`](https://github.com/PrinceDale99/TyFi/commit/82e15909f75f8b00c73d48c53e381e141530e07b) chore(contracts): ignore generated test snapshots
- [`b7836be`](https://github.com/PrinceDale99/TyFi/commit/b7836bee2d5716def9f9942b9f4b25677820d747) test(factory): cover dual-consent linking, one-to-one links and unlinking
- [`67d597b`](https://github.com/PrinceDale99/TyFi/commit/67d597b96e4879498041024d604193a2212100cf) chore(deploy): add in-place factory upgrade script
- [`84903f6`](https://github.com/PrinceDale99/TyFi/commit/84903f6622ed791e908bdc764c3fc28898b289f0) deploy(testnet): upgrade factory in place with account linking
- [`323f44a`](https://github.com/PrinceDale99/TyFi/commit/323f44af5f0b7014427d0bcfb6068a7f2cce1c01) fix(passkey): retry through backend cold starts instead of failing as CORS errors
- [`5a274b3`](https://github.com/PrinceDale99/TyFi/commit/5a274b3423ab1762e24aceafcd09e22f22642879) refactor(passkey): load relayer config through the retrying client
- [`b7715b7`](https://github.com/PrinceDale99/TyFi/commit/b7715b70b50ac28af42766edac15f7b6d8502a99) feat(ui): tell users when TyFi servers are waking up
- [`1361e7e`](https://github.com/PrinceDale99/TyFi/commit/1361e7e3cfb3f843fadccee8c585ed9f131099e4) refactor(passkey): extract reusable wallet auth-entry signing
- [`ff362f4`](https://github.com/PrinceDale99/TyFi/commit/ff362f4ba86dbed246e8fd6fcb8dcf57020a6505) feat(passkey): expose generic read-only contract calls
- [`e84ff5c`](https://github.com/PrinceDale99/TyFi/commit/e84ff5c07d4bc508ac11549487af0f137378b179) feat(passkey): link passkey wallets to Freighter/WalletConnect accounts on-chain
- [`f24b210`](https://github.com/PrinceDale99/TyFi/commit/f24b21012477fa1c530de181652df9d1715c0e4d) feat(ui): link a passkey to an extension-connected account from Settings
- [`318a20e`](https://github.com/PrinceDale99/TyFi/commit/318a20eb06d623eb1ed857b42e7aad438daaca34) feat(app): carry profiles to linked passkey wallets and add the link panel to Settings
- [`95b6388`](https://github.com/PrinceDale99/TyFi/commit/95b63883cfcc33e2487a3a3db11b13b4bcbbe30d) test(e2e): verify passkey-to-account linking, unlinking and relinking on testnet
- [`4454cae`](https://github.com/PrinceDale99/TyFi/commit/4454cae8e004aee629da2455c80f8ba108b1edc2) deploy(testnet): record account-linking proof transactions
- [`da16cbe`](https://github.com/PrinceDale99/TyFi/commit/da16cbe776dbb4fb651a7d94cdc518e1c3bfa986) docs: document account linking and cold-start handling
- [`62503a7`](https://github.com/PrinceDale99/TyFi/commit/62503a760ce794106457b5b9f195b56a47376b74) docs(week3): add account-linking addendum with on-chain proofs

</details>
<details>
<summary><b>Backend stability</b> (6 commits)</summary>

- [`232d34d`](https://github.com/PrinceDale99/TyFi/commit/232d34d6432a820b6e702bbe3e2d95a156f77e5c) perf(listener): make event listener importable and testnet-only by default
- [`2f47bef`](https://github.com/PrinceDale99/TyFi/commit/2f47bef0fb05f2bb3750dc7518aa4cab7a0cb94d) perf(server): run the event listener in-process instead of a second Node process
- [`fa73795`](https://github.com/PrinceDale99/TyFi/commit/fa73795bc129a170c1df8396f187ae490a99f423) perf(server): single-process start with a heap cap below the 512 MB host limit
- [`a59efea`](https://github.com/PrinceDale99/TyFi/commit/a59efea8b9d82f63a63c28d1629b2fdb0f330f3d) ci: ping the backend every 10 minutes so the free instance never sleeps
- [`f5283ca`](https://github.com/PrinceDale99/TyFi/commit/f5283ca9c0219118a30ac5818562b782dc85f7de) perf(frontend): share one backed-off XLM rate poller instead of eight 10s pollers
- [`008b408`](https://github.com/PrinceDale99/TyFi/commit/008b4084773781212e90bc6c2bb2e4daf0fcf29e) docs(functions): document event listener process settings

</details>
<details>
<summary><b>Multi-device passkeys</b> (26 commits)</summary>

- [`6b9a4f7`](https://github.com/PrinceDale99/TyFi/commit/6b9a4f7d1c6ed6562f0c1fa2d4ba69ad5f64dd1b) feat(relayer): verify WebAuthn assertions server-side against on-chain signer keys
- [`100e5b1`](https://github.com/PrinceDale99/TyFi/commit/100e5b1cd4959c85634844a39e36d8987e831d61) test(relayer): cover server-side WebAuthn verification with real P-256 keys
- [`763000d`](https://github.com/PrinceDale99/TyFi/commit/763000d74e74113d4645f0f2feb7d3bc766e75c6) feat(relayer): describe passkey devices from user agents for the security review
- [`90493a3`](https://github.com/PrinceDale99/TyFi/commit/90493a34ab3f2f24c38dec819b8e5385c0559140) feat(relayer): single-use challenges and short-lived HMAC passkey sessions
- [`814fe28`](https://github.com/PrinceDale99/TyFi/commit/814fe288311d59eb60db0817011d50dca5bc87ea) feat(relayer): one-time hashed device pairing codes with owner approval
- [`069c1f4`](https://github.com/PrinceDale99/TyFi/commit/069c1f4396c56b7cb9b08a6a6c23bbcfda5996e3) feat(relayer): store passkey device metadata in Firestore with a memory fallback
- [`cd63d2b`](https://github.com/PrinceDale99/TyFi/commit/cd63d2b3743f0cf73aaebb32c592883adaac9605) feat(relayer): sponsor wallet self-managed add/remove of passkey devices
- [`e51f7b8`](https://github.com/PrinceDale99/TyFi/commit/e51f7b8e81f4d722e9ac0e0fbe845e29107af8ad) feat(relayer): read a wallet's on-chain signer key for proof verification
- [`585224e`](https://github.com/PrinceDale99/TyFi/commit/585224ee32fe3e0657188e98dd9c8a4038ce2bbe) feat(relayer): configure accepted passkey sites, origins and session secret
- [`fa9af82`](https://github.com/PrinceDale99/TyFi/commit/fa9af82d80110bd00d112b61a36fdb9a52279f1c) feat(relayer): passkey-proven device list, pairing and removal endpoints
- [`a4a6c0d`](https://github.com/PrinceDale99/TyFi/commit/a4a6c0d9f89f5d017df2789484248c159af4b1bf) feat(relayer): mount device routes and record the first device on wallet creation
- [`9a83a31`](https://github.com/PrinceDale99/TyFi/commit/9a83a31adb8b1e380ba85b1ee5be1a1438ccee30) docs(functions): document device-management passkey settings
- [`10cf27f`](https://github.com/PrinceDale99/TyFi/commit/10cf27f5a0f05117690650cced7ec3e4da5cfd77) feat(passkey): authenticated relayer requests for device sessions
- [`faf73cb`](https://github.com/PrinceDale99/TyFi/commit/faf73cb8952721a12e696a67b85e07e88ef091d2) feat(passkey): device sessions, pairing codes, approval and removal client
- [`6b1ca0c`](https://github.com/PrinceDale99/TyFi/commit/6b1ca0c63ef7710ba57d92b814e5e456f9709ea1) feat(passkey): sign in on paired devices with on-chain signer verification
- [`2da7a65`](https://github.com/PrinceDale99/TyFi/commit/2da7a6500608435ef2206612597bbf66f1cfe2a7) feat(ui): device panel with hidden IPs, removal and one-time pairing approval
- [`72f3c20`](https://github.com/PrinceDale99/TyFi/commit/72f3c203d35c5aafe2c4e8c75d34cf9c2fcb1d98) feat(ui): set up a new device from a one-time code during onboarding
- [`dce6f80`](https://github.com/PrinceDale99/TyFi/commit/dce6f80d95df6f06403180d670aab093153febf6) feat(ui): show the device panel on the passkey wallet card
- [`dc9446b`](https://github.com/PrinceDale99/TyFi/commit/dc9446b974b8b7a3f9d54e8b9978eee6eee7d40b) feat(app): add passkey device management to Settings
- [`c81d8b0`](https://github.com/PrinceDale99/TyFi/commit/c81d8b0fdcb70cbfde7db246eb601e795e0a35e5) test(e2e): verify device pairing, paired sign-in, payment and removal on testnet
- [`1e587c6`](https://github.com/PrinceDale99/TyFi/commit/1e587c64261bcfc5f548ebfc9fce13f4aa1e430a) deploy(testnet): record device-pairing proof
- [`7af1a5b`](https://github.com/PrinceDale99/TyFi/commit/7af1a5bb09733819a954a4030b7c38ae2d2d3a75) docs: document multi-device pairing, device review and removal
- [`d887910`](https://github.com/PrinceDale99/TyFi/commit/d88791062bc13c50f3587094e26d2c013b60572d) docs(week3): add multi-device passkey addendum
- [`67e1d4c`](https://github.com/PrinceDale99/TyFi/commit/67e1d4ced6fdc09b5bb6d55615f142cfadee57ce) docs(week3): correct relayer test count
- [`371713e`](https://github.com/PrinceDale99/TyFi/commit/371713ed60540316b99052fab8ef776031fd0453) fix(ui): show Add another device without unlocking the device list first
- [`06c7375`](https://github.com/PrinceDale99/TyFi/commit/06c73759acad5f20807eff540bb39fbfbe859411) fix(ui): make Use a code from another device a visible button

</details>
<details>
<summary><b>Approval toggle & settings</b> (4 commits)</summary>

- [`b81ef65`](https://github.com/PrinceDale99/TyFi/commit/b81ef6597d63fb87d489093ee4e33ba12b5b963d) feat(passkey): persist the transaction approval mode preference
- [`aa2719b`](https://github.com/PrinceDale99/TyFi/commit/aa2719b978449cfc17dfa7acb133232a7cccca9f) feat(ui): approve-transactions-with-passkey toggle
- [`e79ab55`](https://github.com/PrinceDale99/TyFi/commit/e79ab55675e177cb892edb38b83c11d1e543f901) feat(ui): show the passkey approval toggle on the passkey page
- [`6778962`](https://github.com/PrinceDale99/TyFi/commit/677896219566fd111a5391dc8c4c105a66ff59ed) feat(app): act as the linked passkey wallet when passkey approval is on, add Passkey settings shortcut

</details>
