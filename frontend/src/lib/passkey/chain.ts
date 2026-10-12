import { Account, Address, Asset, BASE_FEE, Contract, rpc, scValToNative, TransactionBuilder, xdr } from '@stellar/stellar-sdk';

import { PASSKEY_STATIC_CONFIG } from './config';

/**
 * Read-only views of the passkey contracts, via RPC simulation. These never
 * sign or submit anything, so they use a throwaway zero-sequence source.
 */
const READ_SOURCE = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');

let server: rpc.Server | null = null;
export const passkeyRpc = () => (server ??= new rpc.Server(PASSKEY_STATIC_CONFIG.rpcUrl));

async function read(contractId: string, method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  const tx = new TransactionBuilder(READ_SOURCE, { fee: BASE_FEE, networkPassphrase: PASSKEY_STATIC_CONFIG.networkPassphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await passkeyRpc().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method} failed: ${sim.error}`);
  return sim.result ? scValToNative(sim.result.retval) : undefined;
}

const bytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));

/** The factory wallet bound to (credential id, public key), or null. */
export async function findWallet(keyId: Uint8Array, publicKey: Uint8Array): Promise<string | null> {
  const wallet = await read(PASSKEY_STATIC_CONFIG.factoryId, 'get_wallet', bytes(keyId), bytes(publicKey));
  return (wallet as string | undefined) ?? null;
}

/** The public key registered on `wallet` for `keyId`, or null. */
export async function getWalletSignerKey(wallet: string, keyId: Uint8Array): Promise<Uint8Array | null> {
  const signer = (await read(wallet, 'get_signer', bytes(keyId))) as { public_key: Uint8Array } | undefined;
  return signer ? new Uint8Array(signer.public_key) : null;
}

/** Native XLM balance of a smart wallet, in XLM. */
export async function getXlmBalance(wallet: string): Promise<number> {
  const sac = Asset.native().contractId(PASSKEY_STATIC_CONFIG.networkPassphrase);
  const stroops = (await read(sac, 'balance', new Address(wallet).toScVal())) as bigint;
  return Number(stroops ?? 0n) / 1e7;
}
