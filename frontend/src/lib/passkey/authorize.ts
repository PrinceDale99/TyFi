import { Address, BASE_FEE, Operation, rpc, TransactionBuilder, xdr, type Transaction } from '@stellar/stellar-sdk';

import { relayerApi, type SubmitResponse } from './api';
import { passkeyRpc } from './chain';
import { getRelayerConfig } from './config';
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
  const expiration = (await server.getLatestLedger()).sequence + SIGNATURE_VALIDITY_LEDGERS;
  const signed: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of entries) {
    const credentials = entry.credentials();
    if (credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
      throw new PasskeyAuthorizationError('simulation', 'This action needs a classic account signature and cannot be sponsored.');
    }
    const signer = Address.fromScAddress(credentials.address().address()).toString();
    if (signer !== session.walletAddress) {
      throw new PasskeyAuthorizationError('simulation', `This action also needs authorization from ${signer}.`);
    }

    const payload = authorizationPayload(entry, config.networkPassphrase, expiration);
    const assertion = await assertPasskey(payload, session.keyId);
    if (assertion.keyId !== session.keyId) {
      throw new PasskeyAuthorizationError('wallet_signing', 'A different passkey was used. Please use the passkey for this wallet.');
    }
    credentials.address().signatureExpirationLedger(expiration);
    credentials.address().signature(encodeSignatures([assertion]));
    signed.push(entry);
  }

  onStage('submission');
  return relayerApi.submit(hostFunction.toXDR('base64'), signed.map(e => e.toXDR('base64')));
}
