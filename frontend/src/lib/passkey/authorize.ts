import { Address, BASE_FEE, Operation, rpc, TransactionBuilder, xdr, type Transaction } from '@stellar/stellar-sdk';

import { getRelayerConfig, relayerApi, type SubmitResponse } from './api';
import { passkeyRpc } from './chain';
import { authorizationPayload, encodeSignatures } from './encoding';
import type { PasskeySession } from './session';
import { assertPasskey } from './webauthn';

/** How long a passkey signature stays valid (~5 minutes of ledgers). */
const SIGNATURE_VALIDITY_LEDGERS = 60;

export type AuthorizeStage = 'simulation' | 'wallet_signing' | 'submission';

export class PasskeyAuthorizationError extends Error {
  readonly stage: AuthorizeStage;
  constructor(stage: AuthorizeStage, message: string) {
    super(message);
    this.name = 'PasskeyAuthorizationError';
    this.stage = stage;
  }
}

/** Extract the single host function from a built (unsigned) transaction. */
export function hostFunctionOf(tx: Transaction): xdr.HostFunction {
  if (tx.operations.length !== 1 || tx.operations[0].type !== 'invokeHostFunction') {
    throw new Error('Expected exactly one contract invocation');
  }
  return (tx.operations[0] as Operation.InvokeHostFunction).func;
}

/**
 * Authorize a contract call with the user's passkey and submit it through the
 * fee-sponsoring relayer.
 *
 *  1. Simulate (recording mode) to learn which authorizations the call needs.
 *  2. For each entry belonging to the wallet, the passkey signs the exact
 *     Soroban payload (invocation + nonce + expiry) — one biometric prompt.
 *  3. The relayer re-simulates with the signed entries, so the network itself
 *     runs the wallet's __check_auth before the sponsor pays anything.
 */
export async function invokeWithPasskey(
  session: PasskeySession,
  hostFunction: xdr.HostFunction,
  onStage: (stage: AuthorizeStage) => void = () => {},
): Promise<SubmitResponse> {
  const config = await getRelayerConfig();
  const server = passkeyRpc();

  onStage('simulation');
  const source = await server.getAccount(config.sponsor);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: config.networkPassphrase })
    .addOperation(Operation.invokeHostFunction({ func: hostFunction, auth: [] }))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new PasskeyAuthorizationError('simulation', sim.error);
  }

  const entries = sim.result?.auth ?? [];
  if (entries.length === 0) {
    throw new PasskeyAuthorizationError('simulation', 'This action does not require your wallet’s authorization.');
  }

  onStage('wallet_signing');
  const signed = await signWalletAuthEntries(session, entries, config.networkPassphrase);

  onStage('submission');
  return relayerApi.submit(hostFunction.toXDR('base64'), signed.map(e => e.toXDR('base64')));
}

/**
 * Sign every authorization entry that belongs to the passkey wallet (one
 * biometric prompt each). Entries for other parties are returned unchanged
 * when `allowOthers` is set (e.g. a co-signing classic account that signs the
 * envelope itself); otherwise they are rejected.
 */
export async function signWalletAuthEntries(
  session: PasskeySession,
  entries: xdr.SorobanAuthorizationEntry[],
  networkPassphrase: string,
  { allowOthers = false }: { allowOthers?: boolean } = {},
): Promise<xdr.SorobanAuthorizationEntry[]> {
  const expiration = (await passkeyRpc().getLatestLedger()).sequence + SIGNATURE_VALIDITY_LEDGERS;
  const out: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of entries) {
    const credentials = entry.credentials();
    const isAddress = credentials.switch() === xdr.SorobanCredentialsType.sorobanCredentialsAddress();
    const signer = isAddress ? Address.fromScAddress(credentials.address().address()).toString() : null;
    if (signer !== session.walletAddress) {
      if (allowOthers) {
        out.push(entry);
        continue;
      }
      throw new PasskeyAuthorizationError(
        'simulation',
        isAddress ? `This action also needs authorization from ${signer}.` : 'This action needs a classic account signature and cannot be sponsored.',
      );
    }

    const payload = authorizationPayload(entry, networkPassphrase, expiration);
    const assertion = await assertPasskey(payload, session.keyId);
    if (assertion.keyId !== session.keyId) {
      throw new PasskeyAuthorizationError('wallet_signing', 'A different passkey was used. Please use the passkey for this wallet.');
    }
    credentials.address().signatureExpirationLedger(expiration);
    credentials.address().signature(encodeSignatures([assertion]));
    out.push(entry);
  }
  return out;
}
