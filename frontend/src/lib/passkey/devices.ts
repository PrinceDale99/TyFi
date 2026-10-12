import { Buffer } from 'buffer';
import { Contract, xdr } from '@stellar/stellar-sdk';

import { request } from './api';
import { invokeWithPasskey } from './authorize';
import { fromBase64Url, toBase64Url } from './base64url';
import { getWalletSignerKey } from './chain';
import { savePasskeySession, type PasskeySession } from './session';
import { assertPasskey, registerPasskey } from './webauthn';

/**
 * Passkey devices: list, add (pair) and remove.
 *
 * A passkey cannot be copied off its device, so "using the wallet on another
 * device" means giving that device its own passkey and adding it to the wallet
 * as an extra signer. The one-time code only connects the two devices; the
 * wallet's existing passkey must approve the addition on-chain.
 */

export interface DeviceInfo {
  keyId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;
  browser: string;
  addedAt: number;
  addedIp: string;
  lastSeenAt: number;
  lastSeenIp: string;
  current: boolean;
}

export interface DeviceSession {
  token: string;
  expiresAt: number;
  wallet: string;
  keyId: string;
}

export interface PairingRequestInfo {
  requestId: string;
  keyId: string;
  publicKey: string;
  device: { deviceName: string; deviceType: string; os: string; browser: string };
  ipAddress: string;
  claimedAt: number;
}

export interface PairingState {
  status: 'none' | 'open' | 'claimed' | 'approved' | 'rejected' | 'expired';
  expiresAt?: number;
  request?: PairingRequestInfo;
}

const bytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Prove ownership with one biometric prompt; the session lasts 15 minutes. */
export async function startDeviceSession(session: PasskeySession): Promise<DeviceSession> {
  const { challengeId, challenge } = await request<{ challengeId: string; challenge: string }>('/devices/challenge', { wallet: session.walletAddress });
  const assertion = await assertPasskey(fromBase64Url(challenge), session.keyId);
  const issued = await request<{ token: string; expiresAt: number; keyId: string }>('/devices/session', {
    wallet: session.walletAddress,
    challengeId,
    assertion: {
      keyId: assertion.keyId,
      authenticatorData: toBase64Url(assertion.authenticatorData),
      clientDataJSON: toBase64Url(assertion.clientDataJson),
      signature: toBase64Url(assertion.signature),
    },
  });
  return { token: issued.token, expiresAt: issued.expiresAt, wallet: session.walletAddress, keyId: issued.keyId };
}

export async function listDevices(ds: DeviceSession): Promise<DeviceInfo[]> {
  return (await request<{ devices: DeviceInfo[] }>('/devices', undefined, ds.token)).devices;
}

export const createPairingCode = (ds: DeviceSession) => request<{ code: string; expiresAt: number }>('/devices/pairing', {}, ds.token);

export const getPairingState = (ds: DeviceSession) => request<PairingState>('/devices/pairing', undefined, ds.token);

/** Approve a waiting device: the wallet adds its passkey on-chain (biometric prompt). */
export async function approvePairing(session: PasskeySession, ds: DeviceSession, pending: PairingRequestInfo): Promise<string> {
  const call = new Contract(session.walletAddress)
    .call('add_signer', bytes(fromBase64Url(pending.keyId)), bytes(fromBase64Url(pending.publicKey)))
    .body().invokeHostFunctionOp().hostFunction();
  const result = await invokeWithPasskey(session, call);
  await request(`/devices/pairing/${encodeURIComponent(pending.requestId)}/complete`, {}, ds.token);
  return result.hash;
}

export const rejectPairing = (ds: DeviceSession, requestId: string) =>
  request(`/devices/pairing/${encodeURIComponent(requestId)}/reject`, {}, ds.token);

/** Remove a device's passkey from the wallet on-chain (biometric prompt). The last passkey cannot be removed. */
export async function removeDevice(session: PasskeySession, ds: DeviceSession, keyId: string): Promise<string> {
  const call = new Contract(session.walletAddress)
    .call('remove_signer', bytes(fromBase64Url(keyId)))
    .body().invokeHostFunctionOp().hostFunction();
  const result = await invokeWithPasskey(session, call);
  await request(`/devices/${encodeURIComponent(keyId)}/removed`, {}, ds.token);
  return result.hash;
}

export type ClaimStage = 'biometric' | 'waiting' | 'verifying' | 'done';

const CLAIM_POLL_MS = 3_000;
const CLAIM_TIMEOUT_MS = 10 * 60_000;

/**
 * New device: create this device's passkey, redeem the code, then wait for the
 * other device to approve. The result is re-verified on-chain before signing in.
 */
export async function joinWithPairingCode(
  code: string,
  onStage: (stage: ClaimStage) => void = () => {},
  signal?: AbortSignal,
): Promise<PasskeySession> {
  const trimmed = code.trim();
  if (!/^tyfi-pair-[A-Za-z0-9_-]{43}$/.test(trimmed)) {
    throw new Error('That doesn’t look like a TyFi device code. Copy the whole code, starting with “tyfi-pair-”.');
  }

  onStage('biometric');
  const { keyId, publicKey } = await registerPasskey(`TyFi · ${new Date().toLocaleDateString()}`);
  const { requestId, claimToken } = await request<{ requestId: string; claimToken: string }>('/devices/pairing/claim', {
    code: trimmed,
    keyId,
    publicKey: toBase64Url(publicKey),
  });

  onStage('waiting');
  const deadline = Date.now() + CLAIM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Cancelled');
    await new Promise(r => setTimeout(r, CLAIM_POLL_MS));
    const status = await request<{ status: PairingState['status']; wallet?: string }>(
      `/devices/pairing/${encodeURIComponent(requestId)}/status?token=${encodeURIComponent(claimToken)}`,
    );
    if (status.status === 'rejected') throw new Error('The request was declined on your other device.');
    if (status.status === 'expired') throw new Error('The approval window expired. Make a new code and try again.');
    if (status.status === 'approved' && status.wallet) {
      onStage('verifying');
      const onChain = await getWalletSignerKey(status.wallet, fromBase64Url(keyId));
      if (!onChain || !sameBytes(onChain, publicKey)) throw new Error('Could not confirm this device on the wallet. Please try again.');
      const session: PasskeySession = {
        version: 1,
        keyId,
        publicKey: toBase64Url(publicKey),
        walletAddress: status.wallet,
        connectedAt: Date.now(),
      };
      savePasskeySession(session);
      onStage('done');
      return session;
    }
  }
  throw new Error('No approval yet. Make a new code on your other device and try again.');
}

/** Wallet for a credential added by pairing (the factory only knows each wallet's first passkey). */
export async function lookupWalletForKey(keyId: string): Promise<string | null> {
  return (await request<{ wallet: string | null }>(`/devices/lookup/${encodeURIComponent(keyId)}`)).wallet;
}
