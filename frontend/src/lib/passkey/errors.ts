import { PasskeyApiError } from './api';
import { PasskeyAuthorizationError } from './authorize';

/** smart_wallet contract errors (contracts/smart_wallet/src/error.rs). */
const WALLET_ERRORS: Record<number, string> = {
  1: 'No passkey signature was provided.',
  2: 'This passkey is not registered on the wallet.',
  4: 'Your authenticator did not confirm you were present.',
  5: 'Biometric or PIN verification is required. Please use a passkey that supports it.',
  9: 'The signature was for a different transaction. Please try again.',
};

const RELAYER_ERRORS: Record<string, string> = {
  RATE_LIMITED: 'Too many attempts from this network. Please wait a few minutes and try again.',
  PASSKEY_DISABLED: 'Seedless wallets are temporarily unavailable. Please try again later.',
  UNKNOWN_WALLET: 'This wallet was not created by TyFi and cannot use sponsored fees.',
  CONTRACT_NOT_ALLOWED: 'This action is not available for passkey wallets yet.',
  FEE_LIMIT_EXCEEDED: 'This transaction is too large to sponsor. Please try a smaller action.',
  CONFIRMATION_TIMEOUT: 'The network is slow to confirm. Check your wallet on Stellar Expert in a minute.',
  NETWORK_ERROR: 'Could not reach TyFi. Check your internet connection and try again.',
  TIMEOUT: 'TyFi took too long to respond. Please try again.',
  INVALID_KEY: 'Your device returned a passkey TyFi cannot use. Please try another device.',
};

/** Turn any passkey-flow error into one short sentence a user can act on. */
export function describePasskeyError(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: unknown };
  const domName = (e?.cause as { name?: string } | undefined)?.name ?? e?.name;
  const message = String(e?.message ?? err ?? '');

  if (domName === 'NotAllowedError' || /not allowed|cancel|timed out|WebAuthn authentication failed/i.test(message)) {
    return 'The passkey prompt was closed or timed out. Nothing was changed — try again when ready.';
  }
  if (domName === 'InvalidStateError') {
    return 'This device already has a TyFi passkey. Use "Sign in with passkey" instead.';
  }
  if (domName === 'SecurityError') {
    return 'Passkeys only work on the official TyFi site over HTTPS.';
  }
  if (err instanceof PasskeyApiError) {
    if (err.contractError && WALLET_ERRORS[err.contractError]) return WALLET_ERRORS[err.contractError];
    return RELAYER_ERRORS[err.code] ?? err.message;
  }
  if (err instanceof PasskeyAuthorizationError && err.stage === 'simulation') {
    if (/balance|insufficient|#10\b/i.test(message)) return 'Your wallet balance is too low for this action.';
    return `The network rejected this action: ${message.split('\n')[0].slice(0, 160)}`;
  }
  return message || 'Something went wrong with the passkey. Please try again.';
}
