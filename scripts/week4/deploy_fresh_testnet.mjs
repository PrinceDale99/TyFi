// Deploys a brand-new TyFi vault + DAO pair on testnet and configures it for
// the ZK payout flow, so reviewers can reproduce everything on contracts they
// control. See docs/REPLICATION_GUIDE.md.
//
//   CARGO_BUILD_JOBS=1 node scripts/week4/deploy_fresh_testnet.mjs
//
// Uses the CLI identities from lib.mjs (DEPLOYER, ADMIN_IDENTITY, ORACLE_IDENTITY).
// Writes contracts/deployments/fresh-testnet-<timestamp>.json and prints the
// env vars that point the frontend, backend and scripts at the new contracts.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { ID, NET, TxLog, XLM_SAC, addressOf, latestTx, root, secretOf, stellar } from './lib.mjs';

const OUT = path.join(root, 'contracts', 'deployments', `fresh-testnet-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const target = path.join(root, 'contracts', 'target');
const log = new TxLog(OUT, { network: 'testnet' });

function build(crate) {
  execFileSync('cargo', ['build', '--target', 'wasm32v1-none', '--release', '-p', crate], {
    cwd: path.join(root, 'contracts'),
    stdio: 'inherit',
    env: { CARGO_BUILD_JOBS: '1', ...process.env },
  });
  const out = path.join(target, `${crate}.optimized.wasm`);
  stellar(['contract', 'optimize', '--wasm', path.join(target, 'wasm32v1-none', 'release', `${crate}.wasm`), '--wasm-out', out], { quiet: true });
  return out;
}

function deploy(step, wasm) {
  const id = stellar(['contract', 'deploy', '--wasm', wasm, '--source', ID.deployer, ...NET], { quiet: true });
  log.record(step, { hash: latestTx(addressOf(ID.deployer)), actor: ID.deployer, contractId: id });
  return id;
}

function call(step, contract, fn, args) {
  stellar(['contract', 'invoke', '--id', contract, '--source', ID.deployer, ...NET, '--send=yes', '--', fn, ...args], { quiet: true });
  log.record(step, { hash: latestTx(addressOf(ID.deployer)), actor: ID.deployer });
}

try {
  addressOf(ID.oracle);
} catch {
  stellar(['keys', 'generate', ID.oracle, ...NET, '--fund'], { quiet: true });
}

const vault = deploy('deploy_vault', build('typhoon_resilience_vault'));
const adminKey = Keypair.fromSecret(secretOf(ID.admin)).rawPublicKey().toString('hex');
call('initialize_vault', vault, 'initialize', [
  '--admin_keys', JSON.stringify([adminKey]),
  '--admin_threshold', '1',
  '--xlm_token', XLM_SAC,
  '--quorum', '1',
  '--is_mainnet_mode', 'false',
  '--single_oracle', addressOf(ID.oracle),
]);

const dao = deploy('deploy_dao', build('tyfi_dao'));
call('initialize_dao', dao, 'initialize', ['--admin', addressOf(ID.deployer), '--vault_id', vault]);

log.data.vault = vault;
log.data.dao = dao;
log.save();

// Groth16 verifying key, ZK oracle, DAO link. Testnet submissions occasionally
// time out; the rollout is idempotent, so resuming it is always safe.
try {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'week4', 'zk_testnet_rollout.mjs')], {
    stdio: 'inherit',
    env: { ...process.env, VAULT_ID: vault, DAO_ID: dao, ROLLOUT_LOG: OUT },
  });
} catch {
  console.error(`\nConfiguration stopped part-way. Resume with:\n  VAULT_ID=${vault} DAO_ID=${dao} ROLLOUT_LOG=${path.relative(root, OUT)} node scripts/week4/zk_testnet_rollout.mjs`);
  process.exit(1);
}

console.log(`
Deployed. Point everything at the new contracts:

  # frontend/.env.local
  VITE_TESTNET_VAULT_ID=${vault}
  VITE_TESTNET_DAO_ID=${dao}

  # functions/.env  (PASSKEY_ALLOWED_CONTRACTS must include both)
  CONTRACT_ID_TESTNET=${vault}
  DAO_CONTRACT_ID_TESTNET=${dao}

  # scripts
  export VAULT_ID=${vault} DAO_ID=${dao}

Log: ${path.relative(root, OUT)}`);
