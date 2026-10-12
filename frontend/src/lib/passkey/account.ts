import { fromBase64Url, toBase64Url } from './base64url';
import { getRelayerConfig, relayerApi } from './api';
import { findWallet, getWalletSignerKey } from './chain';
import { savePasskeySession, type PasskeySession } from './session';
import { assertPasskey, recoverPublicKeys, registerPasskey } from './webauthn';

export type CreateStage = 'checking' | 'biometric' | 'deploying' | 'funding' | 'done';
export type SignInStage = 'biometric' | 'locating' | 'done';

export interface CreatedWallet {
  session: PasskeySession;
  deployTxHash?: string;
  fundingTxHash?: string;
}

const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Create a seedless smart wallet:
 *   1. the device creates a passkey (biometric prompt) — the private key never
 *      leaves its secure hardware, and there is no seed phrase to back up;
 *   2. the relayer deploys a smart_wallet bound to that public key through the
 *      factory, paying the fee;
 *   3. on testnet, the wallet receives a small welcome balance.
 */
export async function createSeedlessWallet(userName: string, onStage: (s: CreateStage) => void = () => {}): Promise<CreatedWallet> {
  onStage('checking');
  const config = await getRelayerConfig(); // fail before prompting if the service is down

  onStage('biometric');
  const { keyId, publicKey } = await registerPasskey(userName);

  onStage('deploying');
  const deployed = await relayerApi.deployWallet(keyId, toBase64Url(publicKey));

  // Never trust the relayer's word for the address: confirm on-chain that the
  // factory bound *this* passkey to the returned wallet.
  const onChain = await findWallet(fromBase64Url(keyId), publicKey);
  if (onChain !== deployed.walletAddress) {
    throw new Error('Wallet verification failed: the on-chain wallet does not match this passkey.');
  }

  const session: PasskeySession = {
    version: 1,
    keyId,
    publicKey: toBase64Url(publicKey),
    walletAddress: deployed.walletAddress,
    createdTxHash: deployed.hash,
    connectedAt: Date.now(),
  };
  savePasskeySession(session);

  let fundingTxHash: string | undefined;
  if (config.network === 'testnet' && config.welcomeFundingXlm > 0) {
    onStage('funding');
    try {
      fundingTxHash = (await relayerApi.fundWallet(deployed.walletAddress)).hash;
    } catch {
      // Funding is a convenience; the wallet is fully usable without it.
    }
  }

  onStage('done');
  return { session, deployTxHash: deployed.hash, fundingTxHash };
}

/**
 * Sign in on any browser with only the passkey. The user picks one of their
 * TyFi passkeys; the public key is recovered from the assertion and the wallet
 * is located through the factory, then cross-checked against the signer stored
 * in the wallet contract itself.
 */
export async function signInWithPasskey(onStage: (s: SignInStage) => void = () => {}): Promise<PasskeySession> {
  onStage('biometric');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await assertPasskey(challenge, 'any');

  onStage('locating');
  const keyIdBytes = fromBase64Url(assertion.keyId);
  for (const candidate of await recoverPublicKeys(assertion)) {
    const wallet = await findWallet(keyIdBytes, candidate);
    if (!wallet) continue;
    const registered = await getWalletSignerKey(wallet, keyIdBytes);
    if (!registered || !equalBytes(registered, candidate)) continue;

    const session: PasskeySession = {
      version: 1,
      keyId: assertion.keyId,
      publicKey: toBase64Url(candidate),
      walletAddress: wallet,
      connectedAt: Date.now(),
    };
    savePasskeySession(session);
    onStage('done');
    return session;
  }
  throw new Error('No TyFi wallet was found for this passkey. Create a wallet first.');
}
