// Copies the runtime proving artifacts into the backend, which Render deploys
// from functions/ alone. Run after `npm run setup`.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'artifacts');
const dest = path.join(__dirname, '..', '..', '..', 'functions', 'zk', 'artifacts');
fs.mkdirSync(dest, { recursive: true });

for (const file of ['weather_threshold.wasm', 'weather_threshold_final.zkey', 'verification_key.json']) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
  console.log(`synced ${file}`);
}
