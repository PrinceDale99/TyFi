// Generates the fixture proof the verifier tests use (artifacts/proof and
// artifacts/public_inputs): the reading from the vault's Groth16 fixture
// (ZK_STORM / Visayas, wind 172 km/h, band 150, damage 85), signed by the
// test oracle key 0x0101..01 with circomlibjs, proven with bb.js 0.87.0 using
// the Keccak transcript the on-chain verifier expects.
//
//   npm run compile && npm run prove-fixture
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { signedInputs } from './inputs.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const program = JSON.parse(fs.readFileSync(path.join(root, 'target', 'weather_threshold_noir.json'), 'utf8'));

const inputs = await signedInputs({});
const { witness } = await new Noir(program).execute(inputs);
const backend = new UltraHonkBackend(program.bytecode, { threads: 1 });
try {
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
  if (!(await backend.verifyProof({ proof, publicInputs }, { keccak: true }))) throw new Error('fixture proof does not verify');
  const out = path.join(root, 'artifacts');
  fs.writeFileSync(path.join(out, 'proof'), proof);
  fs.writeFileSync(path.join(out, 'public_inputs'), Buffer.concat(publicInputs.map((h) => Buffer.from(h.slice(2).padStart(64, '0'), 'hex'))));
  console.log(`artifacts/proof (${proof.length} bytes), artifacts/public_inputs (${publicInputs.length} inputs)`);
} finally {
  await backend.destroy();
}
