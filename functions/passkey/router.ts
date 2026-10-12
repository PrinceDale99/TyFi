import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { StrKey } from '@stellar/stellar-sdk';

import { logEvent } from '../logger';
import { loadPasskeyConfig } from './config';
import { KeyValidationError, parseKeyId, parsePublicKey } from './keys';
import { decodeInvocation, PolicyError } from './policy';
import { PasskeyRelayer, RelayerError } from './relayer';
import { registerDeviceRoutes } from './devicesRouter';

/**
 * HTTP API for seedless passkey wallets (mounted at /api/passkey).
 *
 *   GET  /config                 public network + contract settings for the frontend
 *   GET  /health                 sponsor balance and RPC reachability
 *   POST /wallets                { keyId, publicKey } → deploy (or find) the wallet
 *   POST /wallets/:address/fund  testnet welcome XLM for a factory wallet
 *   POST /submit                 { func, auth[] } → sponsor a passkey-authorized call
 *
 * The browser never holds a secret: the sponsor key lives only here, and the
 * relayer only ever pays fees — every state change is authorized on-chain by
 * the user's passkey.
 */

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message } } });

const STATUS_BY_RELAYER_CODE: Record<string, number> = {
  SIMULATION_FAILED: 422,
  FEE_LIMIT_EXCEEDED: 422,
  UNKNOWN_WALLET: 403,
  FUNDING_UNAVAILABLE: 403,
  TRANSACTION_FAILED: 422,
  SUBMISSION_FAILED: 502,
  CONFIRMATION_TIMEOUT: 504,
};

/** Contract return values may contain bigint (i128/u64), which JSON cannot encode. */
export const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
};

/** Extract "Error(Contract, #N)" so the client can map it to a readable message. */
const contractErrorCode = (detail?: string): number | undefined => {
  const match = detail?.match(/Error\(Contract, #(\d+)\)/);
  return match ? Number(match[1]) : undefined;
};

function sendError(res: Response, err: unknown, route: string) {
  if (err instanceof KeyValidationError) {
    return res.status(400).json({ error: { code: 'INVALID_KEY', message: err.message } });
  }
  if (err instanceof PolicyError) {
    return res.status(400).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof RelayerError) {
    logEvent('WARNING', `[Passkey] ${route} rejected: ${err.code}`, { message: err.message, detail: err.detail?.slice(0, 500) });
    return res.status(STATUS_BY_RELAYER_CODE[err.code] ?? 502).json({
      error: { code: err.code, message: err.message, contractError: contractErrorCode(err.detail) },
    });
  }
  logEvent('ERROR', `[Passkey] ${route} failed unexpectedly`, { message: (err as Error)?.message });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected relayer error' } });
}

export function createPasskeyRouter(): Router {
  const router = Router();
  const loaded = loadPasskeyConfig();

  if ('reason' in loaded) {
    console.warn(`[Passkey] Relayer disabled: ${loaded.reason}`);
    // Keep the reason server-side; clients only learn the feature is off.
    router.get('/config', (_req, res) => res.json({ enabled: false }));
    router.use((_req, res) => res.status(503).json({ error: { code: 'PASSKEY_DISABLED', message: 'Passkey wallets are not configured on this server' } }));
    return router;
  }

  const { config } = loaded as Extract<typeof loaded, { ok: true }>;
  const relayer = new PasskeyRelayer(config);
  const deviceRoutes = registerDeviceRoutes(router, { relayer, config });
  console.log(`[Passkey] Relayer enabled on ${config.network}: factory ${config.factoryId}, sponsor ${relayer.sponsorPublicKey}`);

  router.get('/config', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      enabled: true,
      network: config.network,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      factoryId: config.factoryId,
      walletWasmHash: config.walletWasmHash,
      sponsor: relayer.sponsorPublicKey,
      allowedContracts: relayer.allowedContracts,
      welcomeFundingXlm: Number(config.welcomeFundingStroops) / 1e7,
    });
  });

  router.get('/health', limiter(60_000, 30, 'Too many health checks'), async (_req, res) => {
    try {
      res.json({ ok: true, ...(await relayer.health()) });
    } catch (err) {
      sendError(res, err, 'health');
    }
  });

  router.post('/wallets', limiter(10 * 60_000, 10, 'Too many wallet creations from this network, try again later'), async (req: Request, res: Response) => {
    try {
      const keyId = parseKeyId(req.body?.keyId);
      const publicKey = parsePublicKey(req.body?.publicKey);
      const result = await relayer.deployWallet(keyId, publicKey);
      if (!result.alreadyDeployed) await deviceRoutes.recordNewWallet(result.walletAddress, keyId.toString('base64url'), req);
      logEvent('INFO', '[Passkey] Wallet ready', { wallet: result.walletAddress, hash: result.hash, alreadyDeployed: result.alreadyDeployed });
      res.status(result.alreadyDeployed ? 200 : 201).json(result);
    } catch (err) {
      sendError(res, err, 'deploy');
    }
  });

  router.post('/wallets/:address/fund', limiter(60 * 60_000, 5, 'Too many funding requests, try again later'), async (req: Request, res: Response) => {
    try {
      const address = String(req.params.address);
      if (!StrKey.isValidContract(address)) {
        return res.status(400).json({ error: { code: 'INVALID_ADDRESS', message: 'Expected a C… smart wallet address' } });
      }
      const result = await relayer.fundWallet(address);
      res.json(result ? jsonSafe({ funded: true, ...result }) : { funded: false, reason: 'Wallet already has a balance' });
    } catch (err) {
      sendError(res, err, 'fund');
    }
  });

  router.post('/submit', limiter(60_000, 20, 'Too many transactions, please slow down'), async (req: Request, res: Response) => {
    try {
      const { hostFunction, auth } = decodeInvocation(req.body?.func, req.body?.auth);
      const result = await relayer.submitInvocation(hostFunction, auth);
      logEvent('INFO', '[Passkey] Sponsored invocation', { contract: result.contractId, fn: result.functionName, hash: result.hash });
      res.json(jsonSafe(result));
    } catch (err) {
      sendError(res, err, 'submit');
    }
  });

  return router;
}
