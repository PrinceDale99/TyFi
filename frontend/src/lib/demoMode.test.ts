import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDemoWallet, getDemoMode, markDemoWallet, newSandboxWalletId } from './demoMode';

const WALLET = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('demo mode', () => {
  it('treats generated sandbox ids as the no-wallet demo on testnet only', () => {
    const id = newSandboxWalletId();
    expect(id).toMatch(/^DEMO_TESTNET_[A-Z0-9]+$/);
    expect(getDemoMode(id, 'testnet')).toBe('sandbox');
    expect(getDemoMode(id, 'mainnet')).toBeNull();
  });

  it('flags only the address connected through "Demo with my wallet"', () => {
    expect(getDemoMode(WALLET, 'testnet')).toBeNull();
    markDemoWallet(WALLET);
    expect(getDemoMode(WALLET, 'testnet')).toBe('wallet');
    expect(getDemoMode('GOTHERADDRESS', 'testnet')).toBeNull();
    expect(getDemoMode(WALLET, 'mainnet')).toBeNull();
    clearDemoWallet();
    expect(getDemoMode(WALLET, 'testnet')).toBeNull();
  });

  it('is never active without an address or when storage is unavailable', () => {
    expect(getDemoMode('', 'testnet')).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => markDemoWallet(WALLET)).not.toThrow();
    expect(getDemoMode(WALLET, 'testnet')).toBeNull();
  });
});
