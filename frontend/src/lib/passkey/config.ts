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
  factoryId: import.meta.env.VITE_PASSKEY_FACTORY_ID || 'CDL7BZJG6R3HNNVV5XDYR3WJ735DD3P63YCI4VTB2DEDTYS3NAWRV7WM',
  walletWasmHash: import.meta.env.VITE_PASSKEY_WALLET_WASM_HASH || '5d59961865c3bc4a03db146e5a47e361b5eb7f5392fc379e3c2f0457e6dac4b1',
  relayerUrl: `${import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com'}/api/passkey`,
  /** Name shown in the OS passkey prompt. */
  appName: 'TyFi Vault',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
};
