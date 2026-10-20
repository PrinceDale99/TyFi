// Week 4 testnet rollout: upgrade the vault in place to the Groth16 build,
// repair its zero-threshold admin multisig, and configure the ZK oracle.
//
//   node scripts/week4/zk_testnet_rollout.mjs
//
// Identities (stellar CLI): `deployer` pays fees, `admin` becomes the vault's
// 1-of-1 multisig signer, `tyfi_zk_oracle` is created if missing. The oracle's
// EdDSA secret is read from ORACLE_ZK_PRIVATE_KEY in functions/.env (and
// generated there if absent). Every step's tx hash is written to
// contracts/deployments/week4-zk-testnet.json. Steps that already took effect
// on-chain are skipped, so the script is safe to re-run.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');
const VAULT = 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR';
const BUILT_WASM = path.join(root, 'contracts', 'target', 'wasm32v1-none', 'release', 'typhoon_resilience_vault.wasm');
const WASM = path.join(root, 'contracts', 'target', 'typhoon_resilience_vault.optimized.wasm');
const ENV_FILE = path.join(root, 'functions', '.env');
const OUT = path.join(root, 'contracts', 'deployments', 'week4-zk-testnet.json');
const NET = ['--network', 'testnet'];

const log = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { network: 'testnet', vault: VAULT, steps: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(log, null, 2) + '\n');

function stellar(args, { quiet = false } = {}) {
  const out = execFileSync('stellar', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'] });
  return out.trim();
}

function invokeLogged(step, source, fn, args) {
  try {
    const out = execFileSync(
      'stellar',
      ['contract', 'invoke', '--id', VAULT, '--source', source, ...NET, '--send=yes', '-v', '--', fn, ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return record(step, out, '');
  } catch (e) {
    console.error(e.stderr?.toString() ?? e.message);
    throw new Error(`${step} failed`);
  }
}

function record(step, stdout, stderr) {
  const hash = (stdout + stderr).match(/\b[0-9a-f]{64}\b/)?.[0];
  log.steps.push({ step, txHash: hash ?? null, at: new Date().toISOString() });
  save();
  console.log(`✔ ${step}${hash ? `  tx ${hash}` : ''}`);
  return hash;
}

function view(fn, args = []) {
  return stellar(['contract', 'invoke', '--id', VAULT, '--source', 'deployer', ...NET, '--send=no', '--', fn, ...args], { quiet: true });
}

function secretOf(identity) {
  return stellar(['keys', 'show', identity], { quiet: true });
}

function rawPub(identity) {
  return Keypair.fromSecret(secretOf(identity)).rawPublicKey().toString('hex');
}

/** 1-of-1 multisig signature over sha256(nonce_be_u64 || fn_name). */
function adminSigs(fnName) {
  const nonce = BigInt(view('admin_nonce').replace(/"/g, ''));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(nonce);
  const digest = crypto.createHash('sha256').update(Buffer.concat([msg, Buffer.from(fnName)])).digest();
  const admin = Keypair.fromSecret(secretOf('admin'));
  return JSON.stringify([[admin.rawPublicKey().toString('hex'), admin.sign(digest).toString('hex')]]);
}

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
  let env = fs.readFileSync(ENV_FILE, 'utf8');
  if (/^ORACLE_SECRET_KEY=S[A-Z0-9]{55}\s*$/m.test(env)) return;
  env = env.replace(/^ORACLE_SECRET_KEY=.*\n?/m, '');
  env += `${env.endsWith('\n') ? '' : '\n'}ORACLE_SECRET_KEY=${secret}\n`;
  fs.writeFileSync(ENV_FILE, env);
  console.log('• wrote ORACLE_SECRET_KEY for tyfi_zk_oracle to functions/.env');
}

async function main() {
  // 1. Optimize and upload the Groth16 build (unoptimized it exceeds 64 KiB).
  if (!fs.existsSync(BUILT_WASM)) throw new Error(`Build the vault first: ${BUILT_WASM}`);
  stellar(['contract', 'optimize', '--wasm', BUILT_WASM, '--wasm-out', WASM], { quiet: true });
  const wasmHash = crypto.createHash('sha256').update(fs.readFileSync(WASM)).digest('hex');
  log.wasmHash = wasmHash;
  log.wasmSizeBytes = fs.statSync(WASM).size;
  if (!log.steps.some((s) => s.step === 'upload_wasm')) {
    const out = execFileSync('stellar', ['contract', 'upload', '--wasm', WASM, '--source', 'deployer', ...NET, '-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    record('upload_wasm', out, '');
  }

  // 2. Upgrade in place, then 3. repair the multisig straight away.
  let upgraded = true;
  try {
    view('get_admin_multisig');
  } catch {
    upgraded = false; // pre-week-4 code has no get_admin_multisig
  }
  if (!upgraded) {
    invokeLogged('upgrade_vault', 'deployer', 'upgrade', ['--signatures', '[]', '--new_wasm_hash', wasmHash]);
  }
  const current = JSON.parse(view('get_admin_multisig'));
  const adminKey = rawPub('admin');
  if (current.threshold === 0) {
    invokeLogged('rotate_admin_multisig', 'deployer', 'rotate_admin_multisig', ['--signatures', '[]', '--keys', JSON.stringify([adminKey]), '--threshold', '1']);
  }
  const repaired = JSON.parse(view('get_admin_multisig'));
  if (repaired.threshold !== 1 || repaired.keys[0] !== adminKey) {
    throw new Error(`Unexpected admin multisig after rotation: ${JSON.stringify(repaired)}`);
  }
  log.adminMultisig = { keys: repaired.keys, threshold: repaired.threshold, signer: Keypair.fromSecret(secretOf('admin')).publicKey() };
  save();

  // 4. Oracle identity.
  try {
    stellar(['keys', 'address', 'tyfi_zk_oracle'], { quiet: true });
  } catch {
    stellar(['keys', 'generate', 'tyfi_zk_oracle', ...NET, '--fund'], { quiet: true });
    console.log('• created and funded tyfi_zk_oracle');
  }
  const oracleSecret = secretOf('tyfi_zk_oracle');
  const oracle = Keypair.fromSecret(oracleSecret).publicKey();
  log.oracle = oracle;
  ensureOracleSecretInEnv(oracleSecret);

  // 5. Verifying key, oracle activation and oracle signing key.
  const vkArg = execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', `
    const { encodeVerifyingKey } = require('./zk/encoding');
    const vk = encodeVerifyingKey(require('./zk/artifacts/verification_key.json'));
    const hex = (b) => b.toString('hex');
    process.stdout.write(JSON.stringify({ alpha: hex(vk.alpha), beta: hex(vk.beta), gamma: hex(vk.gamma), delta: hex(vk.delta), ic: vk.ic.map(hex) }));
  `], { cwd: path.join(root, 'functions'), encoding: 'utf8' });

  if (view('get_zk_verifying_key') === 'null') {
    invokeLogged('set_zk_verifying_key', 'deployer', 'set_zk_verifying_key', ['--signatures', adminSigs('set_zk_verifying_key'), '--vk', vkArg]);
  }

  invokeLogged('set_oracle_active', 'deployer', 'set_oracle', ['--signatures', adminSigs('set_oracle'), '--oracle', oracle, '--is_active', 'true']);

  const zkSecret = ensureZkSecret();
  const keyHash = execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', `
    require('./zk/prover').loadOracleZkKey().then(async (k) => {
      process.stdout.write(k.keyHash.toString());
      await require('./zk/prover').shutdownProver();
    });
  `], { cwd: path.join(root, 'functions'), encoding: 'utf8', env: { ...process.env, ORACLE_ZK_PRIVATE_KEY: zkSecret } }).trim();
  log.oracleZkKeyHash = keyHash;
  save();
  if (view('get_oracle_zk_key', ['--oracle', oracle]).replace(/"/g, '') !== keyHash) {
    invokeLogged('set_oracle_zk_key', 'deployer', 'set_oracle_zk_key', ['--signatures', adminSigs('set_oracle_zk_key'), '--oracle', oracle, '--key_hash', keyHash]);
  }

  console.log(`\nDone. Log: ${path.relative(root, OUT)}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
