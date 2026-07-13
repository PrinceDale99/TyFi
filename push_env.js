const fs = require('fs');
const { execSync } = require('child_process');

const envFile = 'frontend/.env';
const lines = fs.readFileSync(envFile, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim() || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  const key = line.slice(0, idx).trim();
  const val = line.slice(idx + 1).trim();
  
  console.log('Processing: ' + key);
  try {
    // Remove first
    console.log('  Removing old...');
    execSync(`npx vercel env rm ${key} production preview development --yes`, { stdio: 'ignore' });
  } catch (e) {} // ignore if it doesn't exist

  try {
    // Add new (using node's built-in child_process to pipe correctly)
    console.log('  Adding new...');
    const cmds = ['production', 'preview', 'development'];
    for (const envName of cmds) {
      execSync(`npx vercel env add ${key} ${envName}`, {
        input: val,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }
    console.log('  Success: ' + key);
  } catch (e) {
    console.log('  Failed to add ' + key + ': ' + e.message);
  }
}
