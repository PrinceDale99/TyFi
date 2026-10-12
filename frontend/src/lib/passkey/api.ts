import { PASSKEY_STATIC_CONFIG } from './config';

/** Error returned by the TyFi passkey relayer (see functions/passkey/router.ts). */
export class PasskeyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** Soroban contract error number when the network rejected the call. */
    public readonly contractError?: number,
  ) {
    super(message);
    this.name = 'PasskeyApiError';
  }
}

const REQUEST_TIMEOUT_MS = 90_000; // relayer waits for ledger confirmation

async function request<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PASSKEY_STATIC_CONFIG.relayerUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new PasskeyApiError(json?.error?.code ?? `HTTP_${res.status}`, json?.error?.message ?? `Request failed (${res.status})`, json?.error?.contractError);
    }
    return json as T;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new PasskeyApiError('TIMEOUT', 'The passkey service took too long to respond. Please try again.');
    }
    if (err instanceof PasskeyApiError) throw err;
    throw new PasskeyApiError('NETWORK_ERROR', 'Could not reach the passkey service. Check your connection.');
  } finally {
    clearTimeout(timer);
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
