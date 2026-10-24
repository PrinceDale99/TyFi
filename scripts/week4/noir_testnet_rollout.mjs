// Noir on-chain verification rollout on testnet:
//   1. upgrade the vault to the build with submit_weather_report_noir,
//   2. deploy contracts/noir_verifier with the weather circuit's UltraHonk
//      verification key (circuits/weather_threshold_noir/artifacts/vk),
//   3. point the vault at it (set_noir_verifier, admin multisig).
// Idempotent: finished steps are skipped on re-run.
//
//   cargo build --release --target wasm32v1-none -p typhoon_resilience_vault      (in contracts/)
//   stellar contract build                                                        (in contracts/noir_verifier/; soroban-sdk 28 requires it)
//   node scripts/week4/noir_testnet_rollout.mjs
//
// Set NOIR_VERIFIER_TARGET if contracts/noir_verifier was built with a custom
// CARGO_TARGET_DIR. With VAULT_ID set (your own vault), steps go to
// contracts/deployments/noir-<vault>.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ID, NET, TxLog, VAULT, adminSigs, invoke, latestTx, addressOf, root, stellar, view } from './lib.mjs';

const VAULT_BUILT = path.join(root, 'contracts', 'target', 'wasm32v1-none', 'release', 'typhoon_resilience_vault.wasm');
const VAULT_WASM = path.join(root, 'contracts', 'target', 'typhoon_resilience_vault.optimized.wasm');
const VERIFIER_TARGET = process.env.NOIR_VERIFIER_TARGET || path.join(root, 'contracts', 'noir_verifier', 'target');
const VERIFIER_BUILT = path.join(VERIFIER_TARGET, 'wasm32v1-none', 'release', 'noir_verifier.wasm');
const VK = path.join(root, 'circuits', 'weather_threshold_noir', 'artifacts', 'vk');
// One log per vault: the TyFi vault's is week4-noir-testnet.json.
const OUT = process.env.NOIR_ROLLOUT_LOG
  || path.join(root, 'contracts', 'deployments', process.env.VAULT_ID ? `noir-${VAULT}.json` : 'week4-noir-testnet.json');

const log = new TxLog(OUT, { network: 'testnet', vault: VAULT });
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function main() {
  // 1. Vault upgrade (optimized: the unoptimized build exceeds 64 KiB).
  stellar(['contract', 'optimize', '--wasm', VAULT_BUILT, '--wasm-out', VAULT_WASM], { quiet: true });
  const vaultHash = sha256(VAULT_WASM);
  if (!log.has('upgrade_vault_noir')) {
    stellar(['contract', 'upload', '--wasm', VAULT_WASM, '--source', ID.deployer, ...NET], { quiet: true });
    log.record('upload_vault_wasm', { hash: latestTx(addressOf(ID.deployer)), actor: ID.deployer, wasmHash: vaultHash });
    const { hash } = invoke(VAULT, ID.deployer, 'upgrade', ['--signatures', adminSigs('upgrade'), '--new_wasm_hash', vaultHash]);
    log.record('upgrade_vault_noir', { hash, actor: 'vault admin multisig', wasmHash: vaultHash });
  }

  // 2. Verifier with the circuit's verification key fixed at deployment.
  if (!log.data.noirVerifier) {
    const vkHex = fs.readFileSync(VK).toString('hex');
    const id = stellar(['contract', 'deploy', '--wasm', VERIFIER_BUILT, '--source', ID.deployer, ...NET, '--', '--vk', vkHex]).trim().split('\n').pop();
    log.data.noirVerifier = id;
    log.data.noirVerifierWasmHash = sha256(VERIFIER_BUILT);
    log.data.vkSha256 = sha256(VK);
    log.record('deploy_noir_verifier', { hash: latestTx(addressOf(ID.deployer)), actor: ID.deployer, contract: id });
  }

  // 3. The vault only accepts Noir proofs checked by this verifier.
  const current = view(VAULT, 'get_noir_verifier').replace(/"/g, '');
  if (current !== log.data.noirVerifier) {
    const { hash } = invoke(VAULT, ID.deployer, 'set_noir_verifier', ['--signatures', adminSigs('set_noir_verifier'), '--verifier', log.data.noirVerifier]);
    log.record('set_noir_verifier', { hash, actor: 'vault admin multisig', verifier: log.data.noirVerifier });
  }
  console.log(`vault ${VAULT} -> noir verifier ${log.data.noirVerifier}`);
}

main();
