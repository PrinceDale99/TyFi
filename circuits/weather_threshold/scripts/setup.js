// Groth16 trusted setup for the weather_threshold circuit.
//
// Runs a local, single-party powers-of-tau (2^14) and one phase-2 contribution
// with fresh random entropy, then copies the artifacts the oracle and the vault
// need into artifacts/. A single-party ceremony is fine for testnet; mainnet
// needs a multi-party phase 2 (or a public phase-1 ptau) before launch.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const build = path.join(root, 'build');
const artifacts = path.join(root, 'artifacts');
const cli = path.join(root, 'node_modules', 'snarkjs', 'build', 'cli.cjs');
const POWER = 14;

const snarkjs = (...args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
const entropy = () => crypto.randomBytes(32).toString('hex');
const b = (f) => path.join(build, f);

const r1cs = b('weather_threshold.r1cs');
if (!fs.existsSync(r1cs)) {
  console.error('build/weather_threshold.r1cs missing — run `npm run compile` first.');
  process.exit(1);
}

// Phase 1 (circuit-independent)
snarkjs('powersoftau', 'new', 'bn128', String(POWER), b('pot_0000.ptau'));
snarkjs('powersoftau', 'contribute', b('pot_0000.ptau'), b('pot_0001.ptau'), '--name=tyfi-phase1', `-e=${entropy()}`);
snarkjs('powersoftau', 'prepare', 'phase2', b('pot_0001.ptau'), b('pot_final.ptau'));

// Phase 2 (circuit-specific)
snarkjs('groth16', 'setup', r1cs, b('pot_final.ptau'), b('weather_threshold_0000.zkey'));
snarkjs('zkey', 'contribute', b('weather_threshold_0000.zkey'), b('weather_threshold_final.zkey'), '--name=tyfi-phase2', `-e=${entropy()}`);
snarkjs('zkey', 'verify', r1cs, b('pot_final.ptau'), b('weather_threshold_final.zkey'));
snarkjs('zkey', 'export', 'verificationkey', b('weather_threshold_final.zkey'), b('verification_key.json'));

fs.mkdirSync(artifacts, { recursive: true });
fs.copyFileSync(b('weather_threshold_js/weather_threshold.wasm'), path.join(artifacts, 'weather_threshold.wasm'));
fs.copyFileSync(b('weather_threshold_final.zkey'), path.join(artifacts, 'weather_threshold_final.zkey'));
fs.copyFileSync(b('verification_key.json'), path.join(artifacts, 'verification_key.json'));
console.log(`Artifacts written to ${artifacts}`);
