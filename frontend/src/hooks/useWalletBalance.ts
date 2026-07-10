import { useState, useEffect, useCallback } from 'react';

const HORIZON_MAINNET = 'https://horizon.stellar.org';
const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';

export interface WalletBalance {
  xlm: number;
  assets: { code: string; issuer: string; balance: number }[];
}

export const useWalletBalance = (address: string, network: 'testnet' | 'mainnet') => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const horizon = network === 'mainnet' ? HORIZON_MAINNET : HORIZON_TESTNET;

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${horizon}/accounts/${address}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const xlm = parseFloat(
        data.balances?.find((b: any) => b.asset_type === 'native')?.balance ?? '0'
      );

      const assets = (data.balances ?? [])
        .filter((b: any) => b.asset_type !== 'native')
        .map((b: any) => ({
          code: b.asset_code,
          issuer: b.asset_issuer,
          balance: parseFloat(b.balance),
        }));

      setBalance({ xlm, assets });
      setLastUpdated(new Date());
      setCountdown(30);
    } catch (e: any) {
      console.error('useWalletBalance: failed to fetch', e);
      setError('Could not fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [address, horizon]);

  // Initial fetch + 30-second polling
  useEffect(() => {
    if (!address) return;
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Countdown ticker
  useEffect(() => {
    if (!lastUpdated) return;
    setCountdown(30);
    const tick = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1_000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  return { balance, isLoading, lastUpdated, countdown, error, refresh: fetchBalance };
};
