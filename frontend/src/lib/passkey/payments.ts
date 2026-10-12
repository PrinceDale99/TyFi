import { Address, Asset, Contract, nativeToScVal, StrKey, xdr } from '@stellar/stellar-sdk';

import { PASSKEY_STATIC_CONFIG } from './config';

const STROOPS_PER_XLM = 10_000_000n;

/** Parse a user-entered XLM amount into stroops without floating-point error. */
export function parseXlmAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) throw new Error('Enter an amount with at most 7 decimal places.');
  const [whole, fraction = ''] = trimmed.split('.');
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, '0'));
  if (stroops <= 0n) throw new Error('Amount must be greater than zero.');
  return stroops;
}

/** Host function for a native XLM transfer from a passkey wallet (SAC `transfer`). */
export function xlmTransfer(from: string, to: string, stroops: bigint): xdr.HostFunction {
  if (!StrKey.isValidContract(from)) throw new Error('Sender must be a smart wallet address.');
  if (!StrKey.isValidEd25519PublicKey(to) && !StrKey.isValidContract(to)) {
    throw new Error('Recipient must be a valid G… or C… Stellar address.');
  }
  if (to === from) throw new Error('Recipient must be different from your wallet.');
  const sac = new Contract(Asset.native().contractId(PASSKEY_STATIC_CONFIG.networkPassphrase));
  return sac
    .call('transfer', new Address(from).toScVal(), new Address(to).toScVal(), nativeToScVal(stroops, { type: 'i128' }))
    .body()
    .invokeHostFunctionOp()
    .hostFunction();
}
