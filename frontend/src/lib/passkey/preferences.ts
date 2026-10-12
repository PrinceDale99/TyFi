/**
 * How transactions are approved when the user has both a wallet extension
 * account (Freighter, WalletConnect…) and a linked passkey wallet.
 *
 *   'passkey'   — act as the linked passkey wallet: every transaction is
 *                 approved with a fingerprint / face / device PIN, fees sponsored.
 *   'extension' — act as the extension account: approvals happen in the extension.
 *
 * A classic G-account cannot be authorized by a passkey (it only accepts
 * Ed25519 keys), so "approve with passkey" means transacting from the linked
 * passkey wallet. Stored per browser; contains no secrets.
 */
export type ApprovalMode = 'passkey' | 'extension';

const STORAGE_KEY = 'tyfi_tx_approval_mode';
const EVENT = 'tyfi:approval-mode';

export function getApprovalMode(): ApprovalMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'extension' ? 'extension' : 'passkey';
  } catch {
    return 'passkey';
  }
}

export function setApprovalMode(mode: ApprovalMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

/** Notified when the mode changes in this tab or another tab. */
export function onApprovalModeChange(listener: (mode: ApprovalMode) => void): () => void {
  const local = (e: Event) => listener((e as CustomEvent<ApprovalMode>).detail);
  const cross = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener(getApprovalMode());
  };
  window.addEventListener(EVENT, local);
  window.addEventListener('storage', cross);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener('storage', cross);
  };
}
