// Week 4 testnet rollout: bring a vault to the Groth16 build and configure
// its ZK oracle. Used for the in-place upgrade of the TyFi testnet vault and,
// with VAULT_ID / DAO_ID set, to configure a fresh deployment
// (scripts/week4/deploy_fresh_testnet.mjs runs it for you).
//
//   node scripts/week4/zk_testnet_rollout.mjs
//
// Identities (stellar CLI, see lib.mjs for the env overrides): DEPLOYER pays
// fees, ADMIN_IDENTITY is the vault's 1-of-1 multisig signer, ORACLE_IDENTITY
// is created and funded if missing. The oracle's EdDSA secret is read from
// ORACLE_ZK_PRIVATE_KEY in functions/.env (generated there if absent). Steps
// that already took effect on-chain are skipped, so the script is safe to re-run.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { DAO, ID, NET, TxLog, VAULT, addressOf, adminSigs, invoke, root, secretOf, sendCli, stellar, view } from './lib.mjs';

const BUILT_WASM = path.join(root, 'contracts', 'target', 'wasm32v1-none', 'release', 'typhoon_resilience_vault.wasm');
const WASM = path.join(root, 'contracts', 'target', 'typhoon_resilience_vault.optimized.wasm');
const ENV_FILE = path.join(root, 'functions', '.env');
const OUT = process.env.ROLLOUT_LOG || path.join(root, 'contracts', 'deployments', 'week4-zk-testnet.json');

const log = new TxLog(OUT, { network: 'testnet', vault: VAULT });
const vaultTx = (step, fn, args) => log.record(step, { hash: invoke(VAULT, ID.deployer, fn, args).hash, actor: ID.deployer });
const rawPub = (identity) => Keypair.fromSecret(secretOf(identity)).rawPublicKey().toString('hex');

function ensureZkSecret() {
  let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const existing = env.match(/^ORACLE_ZK_PRIVATE_KEY=([0-9a-fA-F]{64})\s*$/m)?.[1];
  if (existing) return existing;
  const secret = crypto.randomBytes(32).toString('hex');
  env += `${env.endsWith('\n') || !env ? '' : '\n'}ORACLE_ZK_PRIVATE_KEY=${secret}\n`;
  fs.writeFileSync(ENV_FILE, env);
  console.log('• generated ORACLE_ZK_PRIVATE_KEY in functions/.env');
  return secret;
}

function ensureOracleSecretInEnv(secret) {
  let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  if (/^ORACLE_SECRET_KEY=S[A-Z0-9]{55}\s*$/m.test(env)) return;
  env = env.replace(/^ORACLE_SECRET_KEY=.*\n?/m, '');
  env += `${env.endsWith('\n') || !env ? '' : '\n'}ORACLE_SECRET_KEY=${secret}\n`;
  fs.writeFileSync(ENV_FILE, env);
  console.log(`• wrote ORACLE_SECRET_KEY for ${ID.oracle} to functions/.env`);
}

/** Runs a snippet in functions/ (ts-node) and returns its stdout. */
const inFunctions = (code, env = {}) =>
  execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', code], {
    cwd: path.join(root, 'functions'),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  }).trim();

async function main() {
  // 1. Optimize and upload the Groth16 build (unoptimized it exceeds 64 KiB).
  if (!fs.existsSync(BUILT_WASM)) throw new Error(`Build the vault first: ${BUILT_WASM}`);
  stellar(['contract', 'optimize', '--wasm', BUILT_WASM, '--wasm-out', WASM], { quiet: true });
  const wasmHash = crypto.createHash('sha256').update(fs.readFileSync(WASM)).digest('hex');
  log.data.wasmHash = wasmHash;
  log.data.wasmSizeBytes = fs.statSync(WASM).size;

  // 2. Upgrade in place if the vault runs pre-week-4 code (no get_admin_multisig).
  let upgraded = true;
  try {
    view(VAULT, 'get_admin_multisig');
  } catch {
    upgraded = false;
  }
  if (!upgraded) {
    if (!log.has('upload_wasm')) {
      log.record('upload_wasm', { hash: sendCli(ID.deployer, ['contract', 'upload', '--wasm', WASM, '--source', ID.deployer, ...NET]), actor: ID.deployer });
    }
    vaultTx('upgrade_vault', 'upgrade', ['--signatures', '[]', '--new_wasm_hash', wasmHash]);
  }

  // 3. Repair a legacy zero-threshold multisig straight away.
  const adminKey = rawPub(ID.admin);
  if (JSON.parse(view(VAULT, 'get_admin_multisig')).threshold === 0) {
    vaultTx('rotate_admin_multisig', 'rotate_admin_multisig', ['--signatures', '[]', '--keys', JSON.stringify([adminKey]), '--threshold', '1']);
  }
  const multisig = JSON.parse(view(VAULT, 'get_admin_multisig'));
  if (multisig.threshold !== 1 || multisig.keys[0] !== adminKey) {
    throw new Error(`Unexpected admin multisig: ${JSON.stringify(multisig)} (expected 1-of-1 ${ID.admin})`);
  }
  log.data.adminMultisig = { keys: multisig.keys, threshold: multisig.threshold, signer: addressOf(ID.admin) };
  log.save();

  // 4. Oracle identity.
  try {
    addressOf(ID.oracle);
  } catch {
    stellar(['keys', 'generate', ID.oracle, ...NET, '--fund'], { quiet: true });
    console.log(`• created and funded ${ID.oracle}`);
  }
  const oracleSecret = secretOf(ID.oracle);
  const oracle = Keypair.fromSecret(oracleSecret).publicKey();
  log.data.oracle = oracle;
  ensureOracleSecretInEnv(oracleSecret);

  // 5. Verifying key, oracle activation and oracle signing key.
  const vkArg = inFunctions(`
    const { encodeVerifyingKey } = require('./zk/encoding');
    const vk = encodeVerifyingKey(require('./zk/artifacts/verification_key.json'));
    const hex = (b) => b.toString('hex');
    process.stdout.write(JSON.stringify({ alpha: hex(vk.alpha), beta: hex(vk.beta), gamma: hex(vk.gamma), delta: hex(vk.delta), ic: vk.ic.map(hex) }));
  `);
  if (view(VAULT, 'get_zk_verifying_key') === 'null') {
    vaultTx('set_zk_verifying_key', 'set_zk_verifying_key', ['--signatures', adminSigs('set_zk_verifying_key'), '--vk', vkArg]);
  }

  vaultTx('set_oracle_active', 'set_oracle', ['--signatures', adminSigs('set_oracle'), '--oracle', oracle, '--is_active', 'true']);

  const zkSecret = ensureZkSecret();
  const keyHash = inFunctions(`
    require('./zk/prover').loadOracleZkKey().then(async (k) => {
      process.stdout.write(k.keyHash.toString());
      await require('./zk/prover').shutdownProver();
    });
  `, { ORACLE_ZK_PRIVATE_KEY: zkSecret });
  log.data.oracleZkKeyHash = keyHash;
  log.save();
  if (view(VAULT, 'get_oracle_zk_key', ['--oracle', oracle]).replace(/"/g, '') !== keyHash) {
    vaultTx('set_oracle_zk_key', 'set_oracle_zk_key', ['--signatures', adminSigs('set_oracle_zk_key'), '--oracle', oracle, '--key_hash', keyHash]);
  }

  // 6. Link the DAO so finalize_proposal's cross-contract calls are accepted.
  //    The vault has no getter for it, so read its instance storage directly.
  const instance = stellar(['contract', 'read', '--id', VAULT, ...NET, '--durability', 'persistent', '--output', 'json'], { quiet: true });
  if (!new RegExp(`DaoAddress[\\s\\S]{0,300}${DAO}`).test(instance)) {
    vaultTx('set_dao_address', 'set_dao_address', ['--signatures', adminSigs('set_dao_address'), '--dao', DAO]);
  }
  log.data.dao = DAO;
  log.save();

  console.log(`\nDone. Log: ${path.relative(root, OUT)}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
