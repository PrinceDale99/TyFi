import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeStore, SESSION_TTL_MS, SessionSigner } from './sessions';

test('challenges are single-use, wallet-bound and expire', () => {
  const store = new ChallengeStore();
  const { challengeId } = store.issue('CWALLET');
  assert.equal(store.consume(challengeId, 'COTHER'), null, 'wrong wallet');
  const { challengeId: id2 } = store.issue('CWALLET');
  assert.ok(store.consume(id2, 'CWALLET'));
  assert.equal(store.consume(id2, 'CWALLET'), null, 'second use');
  const { challengeId: id3 } = store.issue('CWALLET', 0);
  assert.equal(store.consume(id3, 'CWALLET', 3 * 60_000), null, 'expired');
});

test('session tokens verify, expire and resist tampering', () => {
  const signer = new SessionSigner('x'.repeat(40));
  const { token } = signer.issue('CWALLET', 'key', 1_000);
  assert.deepEqual(signer.verify(token, 2_000), { wallet: 'CWALLET', keyId: 'key', exp: 1_000 + SESSION_TTL_MS });
  assert.equal(signer.verify(token, 1_000 + SESSION_TTL_MS + 1), null, 'expired');

  const [body, mac] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ wallet: 'CVICTIM', keyId: 'key', exp: Date.now() + 1e9 })).toString('base64url');
  assert.equal(signer.verify(`${forged}.${mac}`), null, 'forged body');
  assert.equal(new SessionSigner('y'.repeat(40)).verify(token, 2_000), null, 'other secret');
  assert.equal(signer.verify(`${body}`), null);
  assert.equal(signer.verify(42), null);
});
