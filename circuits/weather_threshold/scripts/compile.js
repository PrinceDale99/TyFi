// Compiles the circuit to R1CS + witness-generator WASM under build/.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
fs.mkdirSync(buildDir, { recursive: true });

execFileSync(
  'circom',
  [path.join(root, 'src', 'weather_threshold.circom'), '--r1cs', '--wasm', '--sym', '-o', buildDir],
  { stdio: 'inherit' },
);
