import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeatherTrigger, toSymbol, windFloorFor } from './request';

test('windFloorFor picks the highest band the reading clears', () => {
  assert.equal(windFloorFor(99), null);
  assert.equal(windFloorFor(100), 100);
  assert.equal(windFloorFor(135), 120);
  assert.equal(windFloorFor(172), 150);
});

test('toSymbol matches the frontend sanitizeSymbol rule', () => {
  assert.equal(toSymbol('Central Luzon'), 'Central_Luzon');
  assert.equal(toSymbol('Odette (Rai)'), 'Odette__Rai_');
  assert.equal(toSymbol('x'.repeat(40)).length, 32);
});

test('parseWeatherTrigger accepts a valid reading and derives the floor', () => {
  assert.deepEqual(parseWeatherTrigger({ typhoonId: 'ODETTE', region: 'Central Luzon', windSpeed: 172, damagePercentage: 85 }), {
    typhoonId: 'ODETTE',
    region: 'Central_Luzon',
    windSpeed: 172,
    windFloor: 150,
    damagePercentage: 85,
  });
});

test('parseWeatherTrigger rejects bad input', () => {
  const base = { typhoonId: 'ODETTE', region: 'Visayas', windSpeed: 150, damagePercentage: 50 };
  assert.ok('error' in parseWeatherTrigger({ ...base, typhoonId: '' }));
  assert.ok('error' in parseWeatherTrigger({ ...base, region: '!!!' }));
  assert.ok('error' in parseWeatherTrigger({ ...base, windSpeed: 80 }));
  assert.ok('error' in parseWeatherTrigger({ ...base, windSpeed: 150.5 }));
  assert.ok('error' in parseWeatherTrigger({ ...base, damagePercentage: 0 }));
  assert.ok('error' in parseWeatherTrigger({ ...base, damagePercentage: 101 }));
});
