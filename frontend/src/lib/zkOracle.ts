import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { NETWORK_CONFIGS } from './stellar';

// Client for the oracle's Groth16 weather trigger (functions/oracle.ts).
// The backend signs the reading, proves it meets a payout band and submits
// the proof to the vault's submit_weather_report_zk verifier.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface ZkWeatherRequest {
  typhoonId: string;
  region: string;
  /** Raw reading in km/h. Sent to the oracle only; it never goes on-chain. */
  windSpeed: number;
  damagePercentage: number;
}

export interface ZkWeatherResult {
  txHash: string;
  typhoonId: string;
  region: string;
  windFloor: number;
  damagePercentage: number;
  zk: {
    /** a || b || c, hex — 256 bytes. */
    proof: string;
    /** [oracle_key_hash, typhoon_id, region_id, wind_floor, damage] */
    publicSignals: string[];
    provingMs: number;
    cpuInstructions?: number;
    ledger: number;
  };
}

export async function requestZkWeatherProof(req: ZkWeatherRequest): Promise<ZkWeatherResult> {
  const res = await fetch(`${BACKEND_URL}/oracle/api/v1/weather-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, network: 'testnet' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : `Oracle returned ${res.status}`);
  }
  return data as ZkWeatherResult;
}

/** Reads the i128 stroop amount returned by a confirmed claim_payout transaction. */
export async function getClaimedPayoutStroops(txHash: string): Promise<bigint | null> {
  const server = new rpc.Server(NETWORK_CONFIGS.testnet.sorobanRpcUrl);
  const tx = await server.getTransaction(txHash);
  if (tx.status !== rpc.Api.GetTransactionStatus.SUCCESS || !tx.returnValue) return null;
  return BigInt(scValToNative(tx.returnValue));
}

export const explorerTxUrl = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
