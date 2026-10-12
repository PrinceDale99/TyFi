import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE_TTL_MS, isPairingCode, PairingStore } from './pairing';

const device = { deviceName: 'Android · Chrome', deviceType: 'mobile' as const, os: 'Android', browser: 'Chrome' };
const req = { keyId: 'bmV3', publicKey: 'cGs', device, ipAddress: '203.0.113.7' };

test('codes are long, prefixed and unguessable', () => {
  const store = new PairingStore();
  const a = store.create('CW1').code;
  const b = store.create('CW2').code;
  assert.ok(isPairingCode(a) && isPairingCode(b));
  assert.ok(a.length >= 50);
  assert.notEqual(a, b);
});

test('full pairing flow: claim once, approve, new device learns the wallet', () => {
  const store = new PairingStore();
  const { code } = store.create('CW1');
  const claim = store.claim(code, req);
  assert.ok(claim);
  assert.equal(store.claim(code, req), null, 'a code works once');
  assert.equal(store.current('CW1')?.request?.ipAddress, '203.0.113.7');
  assert.deepEqual(store.status(claim!.requestId, claim!.claimToken), { status: 'claimed' });
  assert.ok(store.resolve('CW1', claim!.requestId, 'approved'));
  assert.deepEqual(store.status(claim!.requestId, claim!.claimToken), { status: 'approved', wallet: 'CW1' });
});

test('status needs the private claim token; other wallets cannot resolve', () => {
  const store = new PairingStore();
  const claim = store.claim(store.create('CW1').code, req)!;
  assert.equal(store.status(claim.requestId, 'guess'), null);
  assert.equal(store.resolve('CW2', claim.requestId, 'approved'), null);
});

test('codes expire, and a new code cancels the old one', () => {
  const store = new PairingStore();
  const { code } = store.create('CW1', 0);
  assert.equal(store.claim(code, req, CODE_TTL_MS + 1), null, 'expired');
  const old = store.create('CW1').code;
  store.create('CW1');
  assert.equal(store.claim(old, req), null, 'replaced');
  assert.equal(store.claim('tyfi-pair-' + 'A'.repeat(43), req), null, 'unknown');
  assert.equal(store.claim('not-a-code', req), null, 'malformed');
});
