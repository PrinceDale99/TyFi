import { StrKey } from '@stellar/stellar-sdk';

/**
 * The connected passkey wallet. Contains only public data (credential id,
 * public key, wallet address): there is no secret to store — the private key
 * never leaves the device's secure hardware.
 */
export interface PasskeySession {
  version: 1;
  keyId: string; // base64url credential id
  publicKey: string; // base64url 65-byte secp256r1 key
  walletAddress: string; // C… smart wallet
  createdTxHash?: string;
  connectedAt: number;
}

const STORAGE_KEY = 'tyfi_passkey_session';

export function loadPasskeySession(): PasskeySession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PasskeySession;
    const valid =
      s?.version === 1 &&
      typeof s.keyId === 'string' &&
      typeof s.publicKey === 'string' &&
      StrKey.isValidContract(s.walletAddress);
    return valid ? s : null;
  } catch {
    return null;
  }
}

export function savePasskeySession(session: PasskeySession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the wallet still works for this tab.
  }
}

export function clearPasskeySession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const isPasskeyWalletAddress = (address: string | null | undefined, session = loadPasskeySession()) =>
  !!address && !!session && session.walletAddress === address;
