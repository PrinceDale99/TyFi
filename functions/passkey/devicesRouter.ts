import type { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { StrKey } from '@stellar/stellar-sdk';

import { logEvent } from '../logger';
import type { PasskeyConfig } from './config';
import { createDeviceStore, type DeviceStore } from './deviceStore';
import { KeyValidationError, parseKeyId, parsePublicKey } from './keys';
import { PairingStore } from './pairing';
import type { PasskeyRelayer } from './relayer';
import { ChallengeStore, SessionSigner, type SessionClaims } from './sessions';
import { describeDevice } from './userAgent';
import { AssertionError, verifyAssertion, type AssertionInput } from './webauthnVerify';

/**
 * Device management for seedless passkey wallets (mounted under /api/passkey).
 *
 *   POST /devices/challenge                    { wallet } → one-time challenge
 *   POST /devices/session                      { wallet, challengeId, assertion } → session token
 *   GET  /devices                              (session) → devices with name, type, IPs
 *   POST /devices/:keyId/removed               (session) → confirm an on-chain remove_signer
 *   POST /devices/pairing                      (session) → one-time pairing code
 *   GET  /devices/pairing                      (session) → code status + device awaiting approval
 *   POST /devices/pairing/:requestId/complete  (session) → confirm the on-chain add_signer
 *   POST /devices/pairing/:requestId/reject    (session)
 *   POST /devices/pairing/claim                { code, keyId, publicKey } (new device)
 *   GET  /devices/pairing/:requestId/status    ?token= (new device)
 *   GET  /devices/lookup/:keyId                → wallet for a credential added by pairing
 *
 * Every security-relevant fact is re-read from the chain: the signer key used
 * to verify a session, and whether a device was really added or removed.
 */

const limiter = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } });

const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

const clientIp = (req: Request) => (req.ip || '').replace(/^::ffff:/, '') || 'unknown';

export function registerDeviceRoutes(router: Router, deps: { relayer: PasskeyRelayer; config: PasskeyConfig }): {
  recordNewWallet: (wallet: string, keyId: string, req: Request) => Promise<void>;
} {
  const { relayer, config } = deps;
  const challenges = new ChallengeStore();
  const sessions = new SessionSigner(config.sessionSecret);
  const pairings = new PairingStore();
  // Created lazily: Firebase Admin initializes after the router is mounted.
  let store: DeviceStore | null = null;
  const devices = () => (store ??= createDeviceStore());

  const authed = (req: Request, res: Response): SessionClaims | null => {
    const claims = sessions.verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!claims) fail(res, 401, 'SESSION_REQUIRED', 'Confirm it’s you with your passkey first');
    return claims;
  };

  const guard = (handler: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof KeyValidationError) return fail(res, 400, 'INVALID_KEY', err.message);
      logEvent('ERROR', '[Passkey devices] request failed', { path: req.path, message: (err as Error)?.message });
      fail(res, 500, 'INTERNAL_ERROR', 'Unexpected error');
    }
  };

  router.post('/devices/challenge', limiter(10 * 60_000, 30), guard(async (req, res) => {
    const wallet = String(req.body?.wallet ?? '');
    if (!StrKey.isValidContract(wallet)) return fail(res, 400, 'INVALID_ADDRESS', 'Expected a C… wallet address');
    res.json(challenges.issue(wallet));
  }));

  router.post('/devices/session', limiter(10 * 60_000, 30), guard(async (req, res) => {
    const wallet = String(req.body?.wallet ?? '');
    const assertion = req.body?.assertion as AssertionInput | undefined;
    if (!StrKey.isValidContract(wallet) || !assertion?.keyId) return fail(res, 400, 'INVALID_REQUEST', 'wallet and assertion are required');
    const challenge = challenges.consume(String(req.body?.challengeId ?? ''), wallet);
    if (!challenge) return fail(res, 400, 'CHALLENGE_EXPIRED', 'This sign-in prompt expired. Please try again.');

    const keyId = parseKeyId(assertion.keyId);
    const publicKey = await relayer.getWalletSigner(wallet, keyId);
    if (!publicKey) return fail(res, 403, 'NOT_A_SIGNER', 'This passkey is not registered on the wallet');
    try {
      verifyAssertion({ assertion, publicKey, expectedChallenge: challenge, allowedRpIds: config.allowedRpIds, allowedOrigins: config.allowedOrigins });
    } catch (err) {
      if (err instanceof AssertionError) return fail(res, 403, 'INVALID_ASSERTION', err.message);
      throw err;
    }

    await devices().touch(wallet, assertion.keyId, describeDevice(req.headers['user-agent']), clientIp(req));
    res.json({ ...sessions.issue(wallet, assertion.keyId), keyId: assertion.keyId });
  }));

  router.get('/devices', limiter(60_000, 60), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    const records = await devices().list(claims.wallet);
    // Drop records whose passkey is no longer a signer on-chain (removed elsewhere).
    const live = [];
    for (const r of records) {
      if (await relayer.getWalletSigner(claims.wallet, Buffer.from(r.keyId, 'base64url'))) live.push(r);
      else await devices().markRemoved(claims.wallet, r.keyId);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ devices: live.map(({ wallet: _w, removedAt: _r, ...d }) => ({ ...d, current: d.keyId === claims.keyId })) });
  }));

  router.post('/devices/:keyId/removed', limiter(60_000, 20), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    const keyId = String(req.params.keyId);
    if (await relayer.getWalletSigner(claims.wallet, parseKeyId(keyId))) {
      return fail(res, 409, 'STILL_A_SIGNER', 'That passkey is still on the wallet');
    }
    await devices().markRemoved(claims.wallet, keyId);
    logEvent('INFO', '[Passkey devices] device removed', { wallet: claims.wallet });
    res.json({ removed: true });
  }));

  router.post('/devices/pairing', limiter(10 * 60_000, 10), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    res.set('Cache-Control', 'no-store');
    res.json(pairings.create(claims.wallet));
  }));

  router.get('/devices/pairing', limiter(60_000, 60), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    res.set('Cache-Control', 'no-store');
    res.json(pairings.current(claims.wallet) ?? { status: 'none' });
  }));

  router.post('/devices/pairing/claim', limiter(10 * 60_000, 10), guard(async (req, res) => {
    const keyId = parseKeyId(req.body?.keyId);
    const publicKey = parsePublicKey(req.body?.publicKey);
    const claim = pairings.claim(String(req.body?.code ?? ''), {
      keyId: keyId.toString('base64url'),
      publicKey: publicKey.toString('base64url'),
      device: describeDevice(req.headers['user-agent']),
      ipAddress: clientIp(req),
    });
    if (!claim) return fail(res, 404, 'INVALID_CODE', 'This code is wrong, already used or expired. Make a new one on your other device.');
    res.json({ requestId: claim.requestId, claimToken: claim.claimToken });
  }));

  router.get('/devices/pairing/:requestId/status', limiter(60_000, 60), guard(async (req, res) => {
    const status = pairings.status(String(req.params.requestId), String(req.query.token ?? ''));
    if (!status) return fail(res, 404, 'NOT_FOUND', 'Unknown pairing request');
    res.set('Cache-Control', 'no-store');
    res.json(status);
  }));

  router.post('/devices/pairing/:requestId/complete', limiter(60_000, 20), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    const pending = pairings.current(claims.wallet)?.request;
    if (!pending || pending.requestId !== req.params.requestId) return fail(res, 404, 'NOT_FOUND', 'No device is waiting for approval');

    // Only mark approved once the chain says the new passkey is a signer.
    const onChain = await relayer.getWalletSigner(claims.wallet, Buffer.from(pending.keyId, 'base64url'));
    if (!onChain || onChain.toString('base64url') !== pending.publicKey) {
      return fail(res, 409, 'NOT_ADDED', 'The new device has not been added on-chain yet');
    }
    pairings.resolve(claims.wallet, pending.requestId, 'approved');
    await devices().add(claims.wallet, pending.keyId, pending.device, pending.ipAddress);
    logEvent('INFO', '[Passkey devices] device paired', { wallet: claims.wallet, device: pending.device.deviceName });
    res.json({ approved: true });
  }));

  router.post('/devices/pairing/:requestId/reject', limiter(60_000, 20), guard(async (req, res) => {
    const claims = authed(req, res);
    if (!claims) return;
    pairings.resolve(claims.wallet, String(req.params.requestId), 'rejected');
    res.json({ rejected: true });
  }));

  router.get('/devices/lookup/:keyId', limiter(60_000, 30), guard(async (req, res) => {
    const keyId = String(req.params.keyId);
    parseKeyId(keyId);
    res.json({ wallet: await devices().findWallet(keyId) });
  }));

  return {
    recordNewWallet: async (wallet, keyId, req) => {
      try {
        await devices().add(wallet, keyId, describeDevice(req.headers['user-agent']), clientIp(req));
      } catch (err) {
        // Device metadata is a convenience; never fail wallet creation over it.
        logEvent('WARNING', '[Passkey devices] could not record new wallet device', { message: (err as Error)?.message });
      }
    },
  };
}
