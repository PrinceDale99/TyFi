import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { loadOracleZkKey } from './prover';
import { NOIR_PROOF_BYTES, proveWeatherReadingNoir } from './noirProver';

// Same reading and test oracle key as the vault fixtures, so the public inputs
// must equal circuits/weather_threshold_noir/artifacts/public_inputs.
const FIXTURE_PUBLIC_INPUTS = path.join(__dirname, '..', '..', 'circuits', 'weather_threshold_noir', 'artifacts', 'public_inputs');

test('proves a reading with the Noir circuit in the verifier\'s format', async () => {
  const key = await loadOracleZkKey('01'.repeat(32));
  const proven = await proveWeatherReadingNoir(
    { typhoonId: 'ZK_STORM', region: 'Visayas', windSpeed: 172, windFloor: 150, damagePercentage: 85 },
    key,
  );
  assert.equal(proven.proof.length, NOIR_PROOF_BYTES);
  const inputs = Buffer.concat(proven.publicInputs.map((h) => Buffer.from(h.slice(2).padStart(64, '0'), 'hex')));
  assert.ok(inputs.equals(fs.readFileSync(FIXTURE_PUBLIC_INPUTS)), 'public inputs differ from the vault fixture');
});

test('a reading below the claimed band has no proof', async () => {
  const key = await loadOracleZkKey('01'.repeat(32));
  await assert.rejects(
    proveWeatherReadingNoir({ typhoonId: 'ZK_STORM', region: 'Visayas', windSpeed: 120, windFloor: 150, damagePercentage: 85 }, key),
    /wind below payout threshold/,
  );
});
