// Proves and verifies the Noir circuit with UltraHonk (bb.js 0.87.0, Keccak
// transcript: the format the on-chain verifier in contracts/noir_verifier
// accepts), using a reading signed by circomlibjs, the same EdDSA-Poseidon
// signer the TyFi oracle uses for the Groth16 circuit. A pass here means one
// oracle signature satisfies both the Circom and the Noir version.
//
// Requires target/weather_threshold_noir.json (`npm run compile`, see README).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { signedInputs, symbolToField } from '../scripts/inputs.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const program = JSON.parse(fs.readFileSync(path.join(root, 'target', 'weather_threshold_noir.json'), 'utf8'));
const KECCAK = { keccak: true };

let backend, noir;

before(() => {
  backend = new UltraHonkBackend(program.bytecode, { threads: 1 });
  noir = new Noir(program);
});
after(async () => {
  await backend?.destroy();
});

test('symbol encoding matches the vault fixture', () => {
  // TYPHOON_FIELD for "ZK_STORM" in contracts/typhoon_resilience_vault/src/zk_fixture.rs starts 0x00 0x7f 0x73 0xd4.
  assert.ok(symbolToField('ZK_STORM').toString(16).padStart(64, '0').startsWith('007f73d4'));
});

test('a circomlibjs-signed reading above the floor proves and verifies with UltraHonk', async () => {
  const { witness } = await noir.execute(await signedInputs());
  const proof = await backend.generateProof(witness, KECCAK);
  assert.equal(await backend.verifyProof(proof, KECCAK), true);
  // The on-chain verifier takes exactly 14,592 proof bytes.
  assert.equal(proof.proof.length, 14592);

  // Public inputs come out in declaration order: key hash, typhoon, region, threshold, damage.
  assert.equal(proof.publicInputs.length, 5);
  assert.equal(BigInt(proof.publicInputs[3]), 150n);
  assert.equal(BigInt(proof.publicInputs[4]), 85n);
});

test('the committed verification key matches the circuit', async () => {
  const vk = await backend.getVerificationKey(KECCAK);
  assert.ok(Buffer.from(vk).equals(fs.readFileSync(path.join(root, 'artifacts', 'vk'))), 'artifacts/vk is stale: run npm run compile');
});

test('changing a public input invalidates the proof', async () => {
  const { witness } = await noir.execute(await signedInputs());
  const proof = await backend.generateProof(witness, KECCAK);
  const tampered = [...proof.publicInputs];
  tampered[4] = '0x' + (100n).toString(16).padStart(64, '0'); // claim 100% damage
  assert.equal(await backend.verifyProof({ ...proof, publicInputs: tampered }, KECCAK), false);
});

test('a reading below the floor has no witness', async () => {
  await assert.rejects(noir.execute(await signedInputs({ wind: 120 })), /wind below payout threshold/);
});

test('a key other than the registered one is rejected', async () => {
  const registered = await signedInputs();
  await assert.rejects(
    noir.execute(await signedInputs({ secret: Buffer.from('02'.repeat(32), 'hex'), keyHashOverride: BigInt(registered.oracle_key_hash) })),
    /unregistered oracle key/,
  );
});

test('a signature over a different reading is rejected', async () => {
  const signedFor85 = await signedInputs({ damage: 85 });
  await assert.rejects(noir.execute({ ...signedFor85, damage_percentage: '95' }), /bad oracle signature/);
});
