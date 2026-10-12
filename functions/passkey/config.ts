import { Keypair, Networks, StrKey } from '@stellar/stellar-sdk';

/**
 * Configuration for the seedless passkey relayer.
 *
 * Everything is validated once at startup. If anything required is missing or
 * malformed the relayer is disabled (endpoints answer 503) instead of running
 * with a half-valid configuration.
 */
export interface PasskeyConfig {
  network: 'testnet' | 'mainnet';
  networkPassphrase: string;
  rpcUrl: string;
  /** Fee sponsor: pays every passkey transaction so users never need XLM or a seed. */
  sponsor: Keypair;
  factoryId: string;
  walletWasmHash: string;
  /** Contracts a passkey wallet may invoke through the relayer. */
  allowedContracts: Set<string>;
  /** Hard cap on the total fee (stroops) the sponsor will pay for one transaction. */
  maxFeeStroops: number;
  /** Testnet only: XLM sent to each new wallet so it can be used immediately. */
  welcomeFundingStroops: bigint;
}

const DEFAULT_MAX_FEE_STROOPS = 5_000_000; // 0.5 XLM

export type ConfigResult = { ok: true; config: PasskeyConfig } | { ok: false; reason: string };

const isContractId = (value: string | undefined): value is string => !!value && StrKey.isValidContract(value);

export function loadPasskeyConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult {
  const network = (env.PASSKEY_NETWORK || 'testnet') as PasskeyConfig['network'];
  if (network !== 'testnet' && network !== 'mainnet') {
    return { ok: false, reason: `PASSKEY_NETWORK must be "testnet" or "mainnet", got "${network}"` };
  }
  // Mainnet passkey wallets are not enabled yet (see the frontend mainnet lock).
  if (network === 'mainnet' && env.PASSKEY_ALLOW_MAINNET !== 'true') {
    return { ok: false, reason: 'Passkey relayer is testnet-only until mainnet launch' };
  }

  const secret = env.PASSKEY_SPONSOR_SECRET;
  if (!secret || !StrKey.isValidEd25519SecretSeed(secret)) {
    return { ok: false, reason: 'PASSKEY_SPONSOR_SECRET is missing or not a valid S… secret' };
  }

  const factoryId = env.PASSKEY_FACTORY_ID;
  if (!isContractId(factoryId)) {
    return { ok: false, reason: 'PASSKEY_FACTORY_ID is missing or not a valid C… contract id' };
  }

  const walletWasmHash = (env.PASSKEY_WALLET_WASM_HASH || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(walletWasmHash)) {
    return { ok: false, reason: 'PASSKEY_WALLET_WASM_HASH must be a 32-byte hex string' };
  }

  const extraContracts = (env.PASSKEY_ALLOWED_CONTRACTS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const invalid = extraContracts.find(c => !isContractId(c));
  if (invalid) {
    return { ok: false, reason: `PASSKEY_ALLOWED_CONTRACTS contains an invalid contract id: ${invalid}` };
  }

  const maxFeeStroops = Number(env.PASSKEY_MAX_FEE_STROOPS || DEFAULT_MAX_FEE_STROOPS);
  if (!Number.isInteger(maxFeeStroops) || maxFeeStroops <= 0) {
    return { ok: false, reason: 'PASSKEY_MAX_FEE_STROOPS must be a positive integer' };
  }

  const welcomeXlm = network === 'testnet' ? Number(env.PASSKEY_WELCOME_XLM ?? 5) : 0;
  if (!Number.isFinite(welcomeXlm) || welcomeXlm < 0 || welcomeXlm > 100) {
    return { ok: false, reason: 'PASSKEY_WELCOME_XLM must be between 0 and 100' };
  }

  return {
    ok: true,
    config: {
      network,
      networkPassphrase: network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
      rpcUrl: env.PASSKEY_RPC_URL || (network === 'testnet' ? 'https://soroban-testnet.stellar.org' : 'https://mainnet.sorobanrpc.com'),
      sponsor: Keypair.fromSecret(secret),
      factoryId,
      walletWasmHash,
      allowedContracts: new Set([factoryId, ...extraContracts]),
      maxFeeStroops,
      welcomeFundingStroops: BigInt(Math.round(welcomeXlm * 10_000_000)),
    },
  };
}
