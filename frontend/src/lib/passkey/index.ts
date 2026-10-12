/**
 * Seedless passkey smart wallets (Week 3).
 *
 *   createSeedlessWallet / signInWithPasskey  — onboarding (account.ts)
 *   invokeWithPasskey                         — biometric transaction authorization (authorize.ts)
 *   relayerApi                                — fee-sponsored submission (api.ts)
 */
export { createSeedlessWallet, signInWithPasskey, type CreateStage, type SignInStage, type CreatedWallet } from './account';
export { invokeWithPasskey, hostFunctionOf, PasskeyAuthorizationError, type AuthorizeStage } from './authorize';
export { getRelayerConfig, onServiceWaking, PasskeyApiError, relayerApi, type RelayerConfig } from './api';
export { getXlmBalance } from './chain';
export { PASSKEY_STATIC_CONFIG } from './config';
export { parseXlmAmount, xlmTransfer } from './payments';
export { clearPasskeySession, isPasskeyWalletAddress, loadPasskeySession, type PasskeySession } from './session';
export { isPasskeySupported } from './webauthn';
export { describePasskeyError } from './errors';
