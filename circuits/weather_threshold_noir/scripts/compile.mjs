// Compiles with native nargo 1.0.0-rc.6 to target/weather_threshold_noir.json.
// Noir ships no Windows build (and noir_wasm's file manager breaks on Windows
// paths), so on Windows this runs nargo inside WSL against the same checkout.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => {
  if (process.platform !== 'win32') {
    execFileSync('bash', ['-lc', cmd], { cwd: root, stdio: 'inherit' });
    return;
  }
  const wslPath = execFileSync('wsl', ['wslpath', '-a', root.replace(/\\/g, '/')], { encoding: 'utf8' }).trim();
  execFileSync('wsl', ['bash', '-lc', `export PATH="$HOME/.nargo/bin:$PATH" && cd "${wslPath}" && ${cmd}`], { stdio: 'inherit' });
};

run('nargo --version && nargo compile && nargo test');
