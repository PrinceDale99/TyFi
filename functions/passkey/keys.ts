import { createPublicKey } from 'node:crypto';

export const MAX_KEY_ID_BYTES = 255;

export class KeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyValidationError';
  }
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Decode a WebAuthn credential id sent as base64url (as returned by `credential.id`). */
export function parseKeyId(value: unknown): Buffer {
  if (typeof value !== 'string' || !BASE64URL.test(value)) {
    throw new KeyValidationError('keyId must be a base64url string');
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length === 0 || bytes.length > MAX_KEY_ID_BYTES) {
    throw new KeyValidationError(`keyId must decode to 1–${MAX_KEY_ID_BYTES} bytes`);
  }
  return bytes;
}

/**
 * Decode a secp256r1 public key sent as base64url or hex, and verify it is an
 * uncompressed SEC1 point that actually lies on the P-256 curve. The contract
 * only checks the 0x04 tag, so this stops the sponsor paying to deploy wallets
 * that could never sign anything.
 */
export function parsePublicKey(value: unknown): Buffer {
  if (typeof value !== 'string') {
    throw new KeyValidationError('publicKey must be a string');
  }
  const bytes = /^[0-9a-fA-F]{130}$/.test(value)
    ? Buffer.from(value, 'hex')
    : BASE64URL.test(value) ? Buffer.from(value, 'base64url') : Buffer.alloc(0);
  if (bytes.length !== 65 || bytes[0] !== 0x04) {
    throw new KeyValidationError('publicKey must be a 65-byte uncompressed secp256r1 point (0x04 ‖ X ‖ Y)');
  }
  try {
    createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: bytes.subarray(1, 33).toString('base64url'), y: bytes.subarray(33).toString('base64url') },
      format: 'jwk',
    });
  } catch {
    throw new KeyValidationError('publicKey is not a point on the P-256 curve');
  }
  return bytes;
}
