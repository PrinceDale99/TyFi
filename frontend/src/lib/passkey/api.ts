import { PASSKEY_STATIC_CONFIG } from './config';

/** Error returned by the TyFi passkey relayer (see functions/passkey/router.ts). */
export class PasskeyApiError extends Error {
  readonly code: string;
  /** Soroban contract error number when the network rejected the call. */
  readonly contractError?: number;

  constructor(code: string, message: string, contractError?: number) {
    super(message);
    this.name = 'PasskeyApiError';
    this.code = code;
    this.contractError = contractError;
  }
}

const REQUEST_TIMEOUT_MS = 90_000; // relayer waits for ledger confirmation

/**
 * The backend runs on a host that sleeps when idle. While it wakes, its proxy
 * answers 502/503 (or 429) without CORS headers, which browsers report as a
 * network error. Those responses never reach TyFi, so retrying is safe: wallet
 * deployment and funding are idempotent, and a re-sent signed call cannot run
 * twice because its Soroban nonce is single-use.
 */
const WAKE_RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 12_000, 15_000, 20_000];

type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();

/** Subscribe to "the TyFi server is waking up" notifications (for UI copy). */
export function onServiceWaking(listener: WakeListener): () => void {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
}
const notifyWaking = (waking: boolean) => wakeListeners.forEach(l => l(waking));

class RetryableError extends Error {}

async function attempt<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${PASSKEY_STATIC_CONFIG.relayerUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new PasskeyApiError('TIMEOUT', 'The passkey service took too long to respond. Please try again.');
      }
      throw new RetryableError('network'); // includes CORS-less proxy errors while waking
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Proxy-level errors carry no TyFi error body; our own errors always do.
      if (!json?.error && [429, 502, 503, 504].includes(res.status)) throw new RetryableError(String(res.status));
      throw new PasskeyApiError(json?.error?.code ?? `HTTP_${res.status}`, json?.error?.message ?? `Request failed (${res.status})`, json?.error?.contractError);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

/** `token` = a device-management session token (see devices.ts). */
export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  try {
    for (let i = 0; ; i++) {
      try {
        return await attempt<T>(path, body, token);
      } catch (err) {
        if (!(err instanceof RetryableError)) throw err;
        if (i >= WAKE_RETRY_DELAYS_MS.length) {
          throw new PasskeyApiError('NETWORK_ERROR', 'Could not reach the passkey service. Check your connection.');
        }
        notifyWaking(true);
        await new Promise(r => setTimeout(r, WAKE_RETRY_DELAYS_MS[i]));
      }
    }
  } finally {
    notifyWaking(false);
  }
}

export interface DeployResponse {
  walletAddress: string;
  hash?: string;
  alreadyDeployed: boolean;
}

export interface SubmitResponse {
  hash: string;
  ledger: number;
  returnValue?: unknown;
  contractId: string;
  functionName: string;
}

export const relayerApi = {
  deployWallet: (keyId: string, publicKey: string) => request<DeployResponse>('/wallets', { keyId, publicKey }),
  fundWallet: (wallet: string) =>
    request<{ funded: boolean; hash?: string; reason?: string }>(`/wallets/${encodeURIComponent(wallet)}/fund`, {}),
  submit: (func: string, auth: string[]) => request<SubmitResponse>('/submit', { func, auth }),
};

export interface RelayerConfig {
  enabled: boolean;
  network: 'testnet' | 'mainnet';
  networkPassphrase: string;
  rpcUrl: string;
  factoryId: string;
  walletWasmHash: string;
  sponsor: string;
  allowedContracts: string[];
  welcomeFundingXlm: number;
}

let cachedConfig: Promise<RelayerConfig> | null = null;

/**
 * Load the relayer configuration once (with wake-up retries). Fails loudly if
 * the backend points at a different factory than this build: signing for one
 * deployment and submitting to another would only produce confusing failures.
 */
export function getRelayerConfig(): Promise<RelayerConfig> {
  cachedConfig ??= (async () => {
    const config = await request<RelayerConfig>('/config');
    if (!config.enabled) throw new Error('Passkey wallets are not enabled on this server yet');
    if (config.factoryId !== PASSKEY_STATIC_CONFIG.factoryId) {
      throw new Error('Passkey configuration mismatch between app and server (factory id)');
    }
    return config;
  })().catch(err => {
    cachedConfig = null; // allow a retry after a transient failure
    throw err;
  });
  return cachedConfig;
}
