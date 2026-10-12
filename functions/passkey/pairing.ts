import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import type { DeviceDescription } from './userAgent';

/**
 * One-time device pairing codes.
 *
 * A passkey's private key cannot leave its device, so a new device gets its own
 * passkey, and the existing device approves adding it to the wallet:
 *
 *   owner device:  create()  -> shows the code (256-bit random, 10 min, one use)
 *   new device:    claim()   -> submits its new passkey public key with the code
 *   owner device:  current() -> sees the device name and IP, approves with a
 *                               biometric (on-chain add_signer, wallet-authorized)
 *   new device:    status()  -> learns it was approved and signs in
 *
 * The code alone grants nothing: only the wallet's existing passkey can add a
 * signer on-chain. Only a SHA-256 hash of each code is kept, in memory.
 */

export const CODE_TTL_MS = 10 * 60_000;
const CODE_PREFIX = 'tyfi-pair-';

export type PairingStatus = 'open' | 'claimed' | 'approved' | 'rejected' | 'expired';

export interface PairingRequest {
  requestId: string;
  keyId: string; // base64url
  publicKey: string; // base64url
  device: DeviceDescription;
  ipAddress: string;
  claimedAt: number;
}

interface Pairing {
  wallet: string;
  codeHash: string;
  status: PairingStatus;
  expiresAt: number;
  request?: PairingRequest;
  claimTokenHash?: string;
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const isPairingCode = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(CODE_PREFIX) && /^[A-Za-z0-9_-]{43}$/.test(value.slice(CODE_PREFIX.length));

export class PairingStore {
  private readonly byWallet = new Map<string, Pairing>();
  private readonly byCodeHash = new Map<string, Pairing>();
  private readonly byRequestId = new Map<string, Pairing>();

  /** Create a fresh code for `wallet`, cancelling any previous one. */
  create(wallet: string, now = Date.now()): { code: string; expiresAt: number } {
    this.cancel(wallet);
    const code = CODE_PREFIX + randomBytes(32).toString('base64url');
    const pairing: Pairing = { wallet, codeHash: hash(code), status: 'open', expiresAt: now + CODE_TTL_MS };
    this.byWallet.set(wallet, pairing);
    this.byCodeHash.set(pairing.codeHash, pairing);
    return { code, expiresAt: pairing.expiresAt };
  }

  /** Redeem a code from the new device. Returns null for unknown, used or expired codes. */
  claim(
    code: string,
    request: Omit<PairingRequest, 'requestId' | 'claimedAt'>,
    now = Date.now(),
  ): { requestId: string; claimToken: string; wallet: string } | null {
    if (!isPairingCode(code)) return null;
    const pairing = this.byCodeHash.get(hash(code));
    if (!pairing || this.refresh(pairing, now) !== 'open') return null;

    const requestId = randomUUID();
    const claimToken = randomBytes(32).toString('base64url');
    pairing.status = 'claimed';
    pairing.request = { ...request, requestId, claimedAt: now };
    pairing.claimTokenHash = hash(claimToken);
    pairing.expiresAt = now + CODE_TTL_MS; // time for the owner to approve
    this.byCodeHash.delete(pairing.codeHash); // the code itself is now spent
    this.byRequestId.set(requestId, pairing);
    return { requestId, claimToken, wallet: pairing.wallet };
  }

  /** The owner's view: the code status and any device waiting for approval. */
  current(wallet: string, now = Date.now()): { status: PairingStatus; expiresAt: number; request?: PairingRequest } | null {
    const pairing = this.byWallet.get(wallet);
    if (!pairing) return null;
    return { status: this.refresh(pairing, now), expiresAt: pairing.expiresAt, request: pairing.request };
  }

  /** Resolve a claimed request (after the owner's on-chain approval, or a rejection). */
  resolve(wallet: string, requestId: string, outcome: 'approved' | 'rejected', now = Date.now()): PairingRequest | null {
    const pairing = this.byRequestId.get(requestId);
    if (!pairing || pairing.wallet !== wallet || this.refresh(pairing, now) !== 'claimed') return null;
    pairing.status = outcome;
    return pairing.request ?? null;
  }

  /** The new device polls with its private claim token. */
  status(requestId: string, claimToken: string, now = Date.now()): { status: PairingStatus; wallet?: string } | null {
    const pairing = this.byRequestId.get(requestId);
    if (!pairing?.claimTokenHash || typeof claimToken !== 'string' || !sameHash(pairing.claimTokenHash, hash(claimToken))) return null;
    const status = this.refresh(pairing, now);
    return status === 'approved' ? { status, wallet: pairing.wallet } : { status };
  }

  cancel(wallet: string): void {
    const pairing = this.byWallet.get(wallet);
    if (!pairing) return;
    this.byWallet.delete(wallet);
    this.byCodeHash.delete(pairing.codeHash);
    if (pairing.request) this.byRequestId.delete(pairing.request.requestId);
  }

  private refresh(pairing: Pairing, now: number): PairingStatus {
    if ((pairing.status === 'open' || pairing.status === 'claimed') && pairing.expiresAt < now) pairing.status = 'expired';
    return pairing.status;
  }
}
