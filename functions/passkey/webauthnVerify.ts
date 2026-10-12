import { createHash, createPublicKey, verify } from 'node:crypto';

/**
 * Server-side WebAuthn assertion verification, used to prove a request comes
 * from the owner of a passkey wallet before showing private data (device list,
 * IP addresses) or issuing device-pairing codes.
 *
 * The public key is always read from the wallet contract on-chain, never taken
 * from the request.
 */
export interface AssertionInput {
  keyId: string; // base64url credential id
  authenticatorData: string; // base64url
  clientDataJSON: string; // base64url
  signature: string; // base64url, 64-byte compact r‖s
}

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;

export function verifyAssertion(opts: {
  assertion: AssertionInput;
  publicKey: Buffer; // 65-byte uncompressed P-256 key
  expectedChallenge: Buffer;
  allowedRpIds: readonly string[];
  allowedOrigins: readonly string[];
}): void {
  const { assertion, publicKey, expectedChallenge } = opts;
  const authData = Buffer.from(assertion.authenticatorData ?? '', 'base64url');
  const clientDataRaw = Buffer.from(assertion.clientDataJSON ?? '', 'base64url');
  const signature = Buffer.from(assertion.signature ?? '', 'base64url');

  if (authData.length < 37) throw new AssertionError('authenticatorData too short');
  const rpIdHash = authData.subarray(0, 32);
  if (!opts.allowedRpIds.some(rp => sha256(rp).equals(rpIdHash))) throw new AssertionError('Passkey belongs to a different site');
  const flags = authData[32];
  if (!(flags & FLAG_UP) || !(flags & FLAG_UV)) throw new AssertionError('Biometric or PIN verification is required');

  let clientData: { type?: string; challenge?: string; origin?: string };
  try {
    clientData = JSON.parse(clientDataRaw.toString('utf8'));
  } catch {
    throw new AssertionError('clientDataJSON is not valid JSON');
  }
  if (clientData.type !== 'webauthn.get') throw new AssertionError('Not an authentication ceremony');
  if (clientData.challenge !== expectedChallenge.toString('base64url')) throw new AssertionError('Challenge mismatch');
  if (!clientData.origin || !opts.allowedOrigins.includes(clientData.origin)) throw new AssertionError('Unexpected origin');

  if (signature.length !== 64 || publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new AssertionError('Malformed signature or public key');
  }
  const key = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: publicKey.subarray(1, 33).toString('base64url'), y: publicKey.subarray(33).toString('base64url') },
    format: 'jwk',
  });
  const signed = Buffer.concat([authData, sha256(clientDataRaw)]);
  if (!verify('sha256', signed, { key, dsaEncoding: 'ieee-p1363' }, signature)) {
    throw new AssertionError('Signature verification failed');
  }
}
