// Compiles with nargo 1.0.0-beta.9 to target/weather_threshold_noir.json, runs
// the circuit's Noir tests, and writes the UltraHonk verification key the
// on-chain verifier is deployed with (artifacts/vk, Barretenberg 0.87.0,
// Keccak transcript). The compiled circuit is copied to functions/zk/artifacts
// for the oracle's prover, since the Render service only ships functions/.
// Noir ships no Windows build, so on Windows this runs inside WSL against the
// same checkout.
//
// Override the binaries with NARGO=/path/to/nargo and BB=/path/to/bb.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nargo = process.env.NARGO || 'nargo';
const bb = process.env.BB || 'bb';
const run = (cmd) => {
  const env = 'export PATH="$HOME/.nargo/bin:$HOME/.bb:$HOME/.bb/bin:$HOME/bin:$PATH"';
  if (process.platform !== 'win32') {
    execFileSync('bash', ['-lc', `${env} && ${cmd}`], { cwd: root, stdio: 'inherit' });
    return;
  }
  const wslPath = execFileSync('wsl', ['wslpath', '-a', root.replace(/\\/g, '/')], { encoding: 'utf8' }).trim();
  execFileSync('wsl', ['bash', '-lc', `${env} && cd "${wslPath}" && ${cmd}`], { stdio: 'inherit' });
};

run([
  `${nargo} --version`,
  `${nargo} compile`,
  `${nargo} test`,
  `${bb} --version`,
  `${bb} write_vk --scheme ultra_honk --oracle_hash keccak --bytecode_path target/weather_threshold_noir.json --output_path artifacts`,
].join(' && '));

const oracleCopy = path.join(root, '..', '..', 'functions', 'zk', 'artifacts', 'weather_threshold_noir.json');
fs.copyFileSync(path.join(root, 'target', 'weather_threshold_noir.json'), oracleCopy);
console.log(`copied the circuit to ${path.relative(path.join(root, '..', '..'), oracleCopy)}`);
