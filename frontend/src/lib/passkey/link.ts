import { Address, BASE_FEE, Contract, Operation, rpc, StrKey, TransactionBuilder, xdr, type Transaction } from '@stellar/stellar-sdk';

import { getRelayerConfig } from './api';
import { PasskeyAuthorizationError, signWalletAuthEntries } from './authorize';
import { passkeyRpc, readContract } from './chain';
import { PASSKEY_STATIC_CONFIG } from './config';
import type { PasskeySession } from './session';

/**
 * Linking a seedless passkey wallet with an existing account (Freighter,
 * WalletConnect, Albedo…), recorded on-chain by the factory.
 *
 * `link_account` requires both parties: the existing account authorizes by
 * being the transaction source (its wallet extension signs the envelope and
 * pays the small fee), and the passkey wallet authorizes with a biometric
 * assertion. Neither side can be linked without the other's consent.
 */

export type LinkStage = 'preparing' | 'passkey' | 'account' | 'confirming';

const POLL_INTERVAL_MS = 2_000;
const POLL_ATTEMPTS = 45;

const factory = () => new Contract(PASSKEY_STATIC_CONFIG.factoryId);

/** The account linked to a passkey wallet, or null. */
export async function getLinkedAccount(wallet: string): Promise<string | null> {
  return ((await readContract(PASSKEY_STATIC_CONFIG.factoryId, 'linked_account', new Address(wallet).toScVal())) as string | undefined) ?? null;
}

/** The passkey wallet linked to an account, or null. */
export async function getLinkedWallet(account: string): Promise<string | null> {
  return ((await readContract(PASSKEY_STATIC_CONFIG.factoryId, 'linked_wallet', new Address(account).toScVal())) as string | undefined) ?? null;
}

/** Build, simulate and assemble a transaction sourced from `account`. */
async function prepare(account: string, op: xdr.Operation, auth?: xdr.SorobanAuthorizationEntry[]): Promise<{ tx: Transaction; sim: rpc.Api.SimulateTransactionSuccessResponse }> {
  const server = passkeyRpc();
  const source = await server.getAccount(account);
  const operation = auth
    ? Operation.invokeHostFunction({ func: op.body().invokeHostFunctionOp().hostFunction(), auth })
    : op;
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSKEY_STATIC_CONFIG.networkPassphrase })
    .addOperation(operation)
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new PasskeyAuthorizationError('simulation', sim.error);
  return { tx, sim: sim as rpc.Api.SimulateTransactionSuccessResponse };
}

async function submit(signedXdr: string): Promise<string> {
  const server = passkeyRpc();
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSKEY_STATIC_CONFIG.networkPassphrase);
  const sent = await server.sendTransaction(tx);
  if (sent.status !== 'PENDING') throw new Error(`The network rejected the transaction (${sent.status}).`);
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await server.getTransaction(sent.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error('The link transaction failed on-chain.');
  }
  throw new Error(`The network is slow to confirm. Check transaction ${sent.hash} on Stellar Expert.`);
}

/**
 * Link `session`'s passkey wallet with `account`. `signEnvelope` must sign the
 * transaction XDR with the account's wallet (e.g. Freighter) and return it.
 */
export async function linkPasskeyToAccount(
  session: PasskeySession,
  account: string,
  signEnvelope: (txXdr: string) => Promise<string>,
  onStage: (stage: LinkStage) => void = () => {},
): Promise<string> {
  if (!StrKey.isValidEd25519PublicKey(account)) throw new Error('Linking needs a classic G… account (Freighter, WalletConnect, Albedo).');
  const config = await getRelayerConfig();

  onStage('preparing');
  const op = factory().call('link_account', new Address(session.walletAddress).toScVal(), new Address(account).toScVal());
  const recorded = await prepare(account, op);

  onStage('passkey');
  // The wallet's entry gets a biometric signature; the account's entry is a
  // source-account credential satisfied by the envelope signature below.
  const signedAuth = await signWalletAuthEntries(session, recorded.sim.result?.auth ?? [], config.networkPassphrase, { allowOthers: true });

  // Re-simulate with the real passkey signature so resources include __check_auth.
  const { tx, sim } = await prepare(account, op, signedAuth);
  const assembled = rpc.assembleTransaction(tx, sim).build();

  onStage('account');
  const signedXdr = await signEnvelope(assembled.toXDR());

  onStage('confirming');
  return submit(signedXdr);
}

/** Remove the link from the account side (only the account's wallet signs). */
export async function unlinkFromAccount(wallet: string, account: string, signEnvelope: (txXdr: string) => Promise<string>): Promise<string> {
  const op = factory().call('unlink_account', new Address(wallet).toScVal(), new Address(account).toScVal());
  const { tx, sim } = await prepare(account, op);
  return submit(await signEnvelope(rpc.assembleTransaction(tx, sim).build().toXDR()));
}
