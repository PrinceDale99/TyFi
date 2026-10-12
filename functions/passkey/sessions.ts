import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Proof-of-ownership sessions for passkey wallets.
 *
 * 1. The client asks for a challenge for its wallet (single use, 2 minutes).
 * 2. The passkey signs it; the server verifies the assertion against the
 *    signer key stored on-chain (webauthnVerify.ts).
 * 3. The server issues a short-lived HMAC token scoped to that wallet + key,
 *    so the device panel doesn't ask for a biometric on every click.
 */

const CHALLENGE_TTL_MS = 2 * 60_000;
const MAX_PENDING_CHALLENGES = 10_000;
export const SESSION_TTL_MS = 15 * 60_000;

interface PendingChallenge {
  wallet: string;
  challenge: Buffer;
  expiresAt: number;
}

export class ChallengeStore {
  private readonly pending = new Map<string, PendingChallenge>();

  issue(wallet: string, now = Date.now()): { challengeId: string; challenge: string } {
    this.sweep(now);
    if (this.pending.size >= MAX_PENDING_CHALLENGES) {
      // Bounded memory: drop the oldest entry rather than grow without limit.
      const oldest = this.pending.keys().next().value;
      if (oldest) this.pending.delete(oldest);
    }
    const challengeId = randomUUID();
    const challenge = randomBytes(32);
    this.pending.set(challengeId, { wallet, challenge, expiresAt: now + CHALLENGE_TTL_MS });
    return { challengeId, challenge: challenge.toString('base64url') };
  }

  /** Returns the challenge once (single use) if it exists, is fresh and matches the wallet. */
  consume(challengeId: string, wallet: string, now = Date.now()): Buffer | null {
    const entry = this.pending.get(challengeId);
    this.pending.delete(challengeId);
    if (!entry || entry.wallet !== wallet || entry.expiresAt < now) return null;
    return entry.challenge;
  }

  private sweep(now: number) {
    for (const [id, c] of this.pending) if (c.expiresAt < now) this.pending.delete(id);
  }
}

export interface SessionClaims {
  wallet: string;
  keyId: string;
  exp: number;
}

export class SessionSigner {
  private readonly secret: Buffer;

  /** Without a configured secret a random one is used: sessions then simply end on restart. */
  constructor(secret?: string) {
    this.secret = secret && secret.length >= 32 ? Buffer.from(secret) : randomBytes(32);
  }

  issue(wallet: string, keyId: string, now = Date.now()): { token: string; expiresAt: number } {
    const claims: SessionClaims = { wallet, keyId, exp: now + SESSION_TTL_MS };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { token: `${body}.${this.mac(body)}`, expiresAt: claims.exp };
  }

  verify(token: unknown, now = Date.now()): SessionClaims | null {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims;
      return typeof claims.wallet === 'string' && typeof claims.keyId === 'string' && claims.exp > now ? claims : null;
    } catch {
      return null;
    }
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
