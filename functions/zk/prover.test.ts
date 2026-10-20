import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { groth16 } from 'snarkjs';
import { loadOracleZkKey, proveWeatherReading, shutdownProver } from './prover';
import { g2Bytes, symbolToField } from './encoding';

const vk = require(path.join(__dirname, 'artifacts', 'verification_key.json'));
const BN254_R = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const TEST_KEY = '01'.repeat(32);

after(shutdownProver);

const reading = { typhoonId: 'ZK_STORM', region: 'Visayas', windSpeed: 172, windFloor: 150, damagePercentage: 85 };

test('symbolToField fits the BN254 scalar field and is deterministic', () => {
  const f = symbolToField('Visayas');
  assert.ok(f < BN254_R);
  assert.equal(f, symbolToField('Visayas'));
  assert.notEqual(f, symbolToField('Luzon'));
});

test('g2Bytes puts the imaginary component first', () => {
  const out = g2Bytes([['1', '2'], ['3', '4'], ['1', '0']]);
  assert.equal(out.length, 128);
  assert.equal(out[31], 2);
  assert.equal(out[63], 1);
  assert.equal(out[95], 4);
  assert.equal(out[127], 3);
});

test('a signed reading above the floor proves and verifies', async () => {
  const key = await loadOracleZkKey(TEST_KEY);
  const { publicSignals, proof } = await proveWeatherReading(reading, key);

  // Public signal order is what the vault feeds into its IC MSM.
  assert.deepEqual(publicSignals, [
    key.keyHash.toString(),
    symbolToField('ZK_STORM').toString(),
    symbolToField('Visayas').toString(),
    '150',
    '85',
  ]);
  assert.equal(proof.a.length, 64);
  assert.equal(proof.b.length, 128);
  assert.equal(proof.c.length, 64);
});

test('the raw proof verifies off-chain and fails with a tampered signal', async () => {
  const key = await loadOracleZkKey(TEST_KEY);
  const { buildEddsa, buildPoseidon } = require('circomlibjs');
  // Re-run fullProve directly to get the snarkjs-native proof object.
  const eddsa = await buildEddsa();
  const poseidon = await buildPoseidon();
  const t = symbolToField(reading.typhoonId);
  const r = symbolToField(reading.region);
  const sig = eddsa.signPoseidon(key.privateKey, poseidon([t, r, 172n, 85n]));
  const { proof, publicSignals } = await groth16.fullProve(
    {
      oracle_key_hash: key.keyHash.toString(), typhoon_id: t.toString(), region_id: r.toString(),
      payout_threshold: '150', damage_percentage: '85', wind_speed: '172',
      Ax: key.Ax.toString(), Ay: key.Ay.toString(),
      R8x: eddsa.F.toObject(sig.R8[0]).toString(), R8y: eddsa.F.toObject(sig.R8[1]).toString(), S: sig.S.toString(),
    },
    path.join(__dirname, 'artifacts', 'weather_threshold.wasm'),
    path.join(__dirname, 'artifacts', 'weather_threshold_final.zkey'),
  );
  assert.equal(await groth16.verify(vk, publicSignals, proof), true);

  const tampered = [...publicSignals];
  tampered[4] = '100'; // claim more damage than was signed
  assert.equal(await groth16.verify(vk, tampered, proof), false);
});

test('a reading below the floor cannot be proven', async () => {
  const key = await loadOracleZkKey(TEST_KEY);
  await assert.rejects(proveWeatherReading({ ...reading, windSpeed: 120 }, key));
});

test('a reading signed by a different key cannot be proven against the registered hash', async () => {
  const registered = await loadOracleZkKey(TEST_KEY);
  const other = await loadOracleZkKey('02'.repeat(32));
  await assert.rejects(proveWeatherReading(reading, { ...other, keyHash: registered.keyHash }));
});

test('loadOracleZkKey rejects malformed secrets', async () => {
  await assert.rejects(loadOracleZkKey('abc'));
  await assert.rejects(loadOracleZkKey(undefined));
});
