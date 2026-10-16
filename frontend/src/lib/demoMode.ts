import { isInAppWalletId } from './analytics';

/**
 * Demo mode (testnet only) comes in two versions, both of which skip the Didit
 * identity check during onboarding:
 *  - 'sandbox': no wallet at all — a generated DEMO_TESTNET_* id stands in for
 *    the address, so nothing is signed or sent on-chain.
 *  - 'wallet': a real wallet connected through the Stellar Wallets Kit modal,
 *    so testnet transactions are signed and submitted for real.
 */
export type DemoMode = 'sandbox' | 'wallet';

/** Address of the wallet connected via "Demo with my wallet". */
const DEMO_WALLET_KEY = 'typhoon_vault_demo_wallet';

export const newSandboxWalletId = () =>
  `DEMO_TESTNET_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

const readDemoWallet = (): string | null => {
  try {
    return localStorage.getItem(DEMO_WALLET_KEY);
  } catch {
    return null;
  }
};

export const markDemoWallet = (address: string) => {
  try {
    localStorage.setItem(DEMO_WALLET_KEY, address);
  } catch {
    // Storage blocked: the demo still works for this page load.
  }
};

export const clearDemoWallet = () => {
  try {
    localStorage.removeItem(DEMO_WALLET_KEY);
  } catch {
    // Nothing stored.
  }
};

/** Which demo version (if any) the connected address is using. Never active on mainnet. */
export const getDemoMode = (address: string, network: 'testnet' | 'mainnet'): DemoMode | null => {
  if (network !== 'testnet' || !address) return null;
  if (isInAppWalletId(address)) return 'sandbox';
  return readDemoWallet() === address ? 'wallet' : null;
};
