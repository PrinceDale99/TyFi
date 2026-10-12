import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { AssertionError, verifyAssertion } from './webauthnVerify';

const sha256 = (d: Buffer | string) => createHash('sha256').update(d).digest();

function passkey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]);
  return { privateKey, raw };
}

function assertionFor(
  key: ReturnType<typeof passkey>,
  challenge: Buffer,
  o: { rpId?: string; flags?: number; type?: string; origin?: string; challengeOverride?: string } = {},
) {
  const authData = Buffer.concat([sha256(o.rpId ?? 'www.tyfi.site'), Buffer.from([o.flags ?? 0x05]), Buffer.from([0, 0, 0, 1])]);
  const clientData = Buffer.from(JSON.stringify({
    type: o.type ?? 'webauthn.get',
    challenge: o.challengeOverride ?? challenge.toString('base64url'),
    origin: o.origin ?? 'https://www.tyfi.site',
  }));
  const signature = sign('sha256', Buffer.concat([authData, sha256(clientData)]), { key: key.privateKey, dsaEncoding: 'ieee-p1363' });
  return {
    keyId: 'a2V5',
    authenticatorData: authData.toString('base64url'),
    clientDataJSON: clientData.toString('base64url'),
    signature: signature.toString('base64url'),
  };
}

const opts = { allowedRpIds: ['www.tyfi.site', 'tyfi.site'], allowedOrigins: ['https://www.tyfi.site'] };

test('accepts a genuine biometric assertion', () => {
  const key = passkey();
  const challenge = randomBytes(32);
  verifyAssertion({ ...opts, assertion: assertionFor(key, challenge), publicKey: key.raw, expectedChallenge: challenge });
});

test('rejects a signature from a different passkey', () => {
  const challenge = randomBytes(32);
  assert.throws(
    () => verifyAssertion({ ...opts, assertion: assertionFor(passkey(), challenge), publicKey: passkey().raw, expectedChallenge: challenge }),
    /Signature verification failed/,
  );
});

test('rejects a replayed assertion for another challenge', () => {
  const key = passkey();
  assert.throws(
    () => verifyAssertion({ ...opts, assertion: assertionFor(key, randomBytes(32)), publicKey: key.raw, expectedChallenge: randomBytes(32) }),
    /Challenge mismatch/,
  );
});

test('rejects assertions without user verification, wrong site, wrong origin or wrong type', () => {
  const key = passkey();
  const challenge = randomBytes(32);
  const cases: [Parameters<typeof assertionFor>[2], RegExp][] = [
    [{ flags: 0x01 }, /verification is required/],
    [{ rpId: 'evil.example' }, /different site/],
    [{ origin: 'https://evil.example' }, /Unexpected origin/],
    [{ type: 'webauthn.create' }, /authentication ceremony/],
  ];
  for (const [o, msg] of cases) {
    assert.throws(() => verifyAssertion({ ...opts, assertion: assertionFor(key, challenge, o), publicKey: key.raw, expectedChallenge: challenge }), msg);
  }
});

test('rejects tampered authenticator data', () => {
  const key = passkey();
  const challenge = randomBytes(32);
  const a = assertionFor(key, challenge);
  const auth = Buffer.from(a.authenticatorData, 'base64url');
  auth[36] ^= 0xff; // flip the sign counter after signing
  assert.throws(
    () => verifyAssertion({ ...opts, assertion: { ...a, authenticatorData: auth.toString('base64url') }, publicKey: key.raw, expectedChallenge: challenge }),
    AssertionError,
  );
});
