import { Networks } from '@stellar/stellar-sdk';

/**
 * Frontend ↔ backend ↔ Soroban bridge settings for seedless passkey wallets.
 *
 * Contract ids default to the Week 3 testnet deployment
 * (contracts/deployments/testnet-passkey.json) and can be overridden with
 * VITE_PASSKEY_* variables. The sponsor address and the "enabled" flag come
 * from the backend at runtime, so the browser bundle never holds a secret.
 */
export const PASSKEY_STATIC_CONFIG = {
  network: 'testnet' as const,
  networkPassphrase: Networks.TESTNET,
  rpcUrl: import.meta.env.VITE_PASSKEY_RPC_URL || 'https://soroban-testnet.stellar.org',
  factoryId: import.meta.env.VITE_PASSKEY_FACTORY_ID || 'CBN5WLCDEIMPGDIXCDTF6PI2TZF7GWLMLOQ2FECC4EKMPFNIY4DE2T4M',
  walletWasmHash: import.meta.env.VITE_PASSKEY_WALLET_WASM_HASH || 'b1bd3f95c1f461bfe612751aad6b139e600c5507cec5dbd3b8afbfd47e3254c0',
  relayerUrl: `${import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com'}/api/passkey`,
  /** Name shown in the OS passkey prompt. */
  appName: 'TyFi Vault',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
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

let cached: Promise<RelayerConfig> | null = null;

/**
 * Load the relayer configuration once. Fails loudly if the backend points at a
 * different factory than this build: signing for one deployment and submitting
 * to another would only produce confusing on-chain failures.
 */
export function getRelayerConfig(): Promise<RelayerConfig> {
  cached ??= (async () => {
    const res = await fetch(`${PASSKEY_STATIC_CONFIG.relayerUrl}/config`);
    if (!res.ok) throw new Error(`Passkey service unavailable (HTTP ${res.status})`);
    const config = (await res.json()) as RelayerConfig;
    if (!config.enabled) throw new Error('Passkey wallets are not enabled on this server yet');
    if (config.factoryId !== PASSKEY_STATIC_CONFIG.factoryId) {
      throw new Error('Passkey configuration mismatch between app and server (factory id)');
    }
    return config;
  })().catch(err => {
    cached = null; // allow a retry after a transient failure
    throw err;
  });
  return cached;
}
