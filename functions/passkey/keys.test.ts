import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { KeyValidationError, parseKeyId, parsePublicKey } from './keys';

function realPublicKey(): Buffer {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  return Buffer.concat([Buffer.from([0x04]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]);
}

test('parseKeyId accepts base64url credential ids', () => {
  const id = Buffer.from('credential-id-0123456789');
  assert.deepEqual(parseKeyId(id.toString('base64url')), id);
});

test('parseKeyId rejects empty, oversized and non-base64url values', () => {
  for (const bad of ['', 'has spaces', 'pad==', 42, Buffer.alloc(256, 1).toString('base64url')]) {
    assert.throws(() => parseKeyId(bad), KeyValidationError);
  }
});

test('parsePublicKey accepts real P-256 keys as base64url and hex', () => {
  const key = realPublicKey();
  assert.deepEqual(parsePublicKey(key.toString('base64url')), key);
  assert.deepEqual(parsePublicKey(key.toString('hex')), key);
});

test('parsePublicKey rejects compressed points and points off the curve', () => {
  const key = realPublicKey();
  const compressed = Buffer.concat([Buffer.from([0x02]), key.subarray(1, 33)]);
  assert.throws(() => parsePublicKey(compressed.toString('base64url')), KeyValidationError);

  const offCurve = Buffer.from(key);
  offCurve[64] ^= 0x01; // perturb Y
  assert.throws(() => parsePublicKey(offCurve.toString('base64url')), /not a point on the P-256 curve/);
});
