import { useState, useEffect, useCallback } from 'react';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  group: 'majors' | 'asia-pacific';
}

export const CURRENCIES: CurrencyInfo[] = [
  // ── Majors ──────────────────────────────────────────
  { code: 'usd', name: 'US Dollar',           symbol: '$',   flag: '🇺🇸', group: 'majors' },
  { code: 'eur', name: 'Euro',                symbol: '€',   flag: '🇪🇺', group: 'majors' },
  { code: 'gbp', name: 'British Pound',       symbol: '£',   flag: '🇬🇧', group: 'majors' },
  { code: 'jpy', name: 'Japanese Yen',        symbol: '¥',   flag: '🇯🇵', group: 'majors' },
  { code: 'cad', name: 'Canadian Dollar',     symbol: 'CA$', flag: '🇨🇦', group: 'majors' },
  { code: 'aud', name: 'Australian Dollar',   symbol: 'A$',  flag: '🇦🇺', group: 'majors' },
  { code: 'chf', name: 'Swiss Franc',         symbol: 'Fr',  flag: '🇨🇭', group: 'majors' },
  { code: 'cny', name: 'Chinese Yuan',        symbol: '¥',   flag: '🇨🇳', group: 'majors' },
  // ── Asia-Pacific ─────────────────────────────────────
  { code: 'php', name: 'Philippine Peso',     symbol: '₱',   flag: '🇵🇭', group: 'asia-pacific' },
  { code: 'sgd', name: 'Singapore Dollar',    symbol: 'S$',  flag: '🇸🇬', group: 'asia-pacific' },
  { code: 'myr', name: 'Malaysian Ringgit',   symbol: 'RM',  flag: '🇲🇾', group: 'asia-pacific' },
  { code: 'idr', name: 'Indonesian Rupiah',   symbol: 'Rp',  flag: '🇮🇩', group: 'asia-pacific' },
  { code: 'thb', name: 'Thai Baht',           symbol: '฿',   flag: '🇹🇭', group: 'asia-pacific' },
  { code: 'vnd', name: 'Vietnamese Dong',     symbol: '₫',   flag: '🇻🇳', group: 'asia-pacific' },
  { code: 'krw', name: 'South Korean Won',    symbol: '₩',   flag: '🇰🇷', group: 'asia-pacific' },
  { code: 'hkd', name: 'Hong Kong Dollar',    symbol: 'HK$', flag: '🇭🇰', group: 'asia-pacific' },
  { code: 'twd', name: 'Taiwan Dollar',       symbol: 'NT$', flag: '🇹🇼', group: 'asia-pacific' },
  { code: 'inr', name: 'Indian Rupee',        symbol: '₹',   flag: '🇮🇳', group: 'asia-pacific' },
  { code: 'pkr', name: 'Pakistani Rupee',     symbol: '₨',   flag: '🇵🇰', group: 'asia-pacific' },
  { code: 'bdt', name: 'Bangladeshi Taka',    symbol: '৳',   flag: '🇧🇩', group: 'asia-pacific' },
  { code: 'lkr', name: 'Sri Lankan Rupee',    symbol: 'Rs',  flag: '🇱🇰', group: 'asia-pacific' },
  { code: 'npr', name: 'Nepalese Rupee',      symbol: 'Rs',  flag: '🇳🇵', group: 'asia-pacific' },
  { code: 'mmk', name: 'Myanmar Kyat',        symbol: 'K',   flag: '🇲🇲', group: 'asia-pacific' },
  { code: 'khr', name: 'Cambodian Riel',      symbol: '៛',   flag: '🇰🇭', group: 'asia-pacific' },
  { code: 'lak', name: 'Lao Kip',            symbol: '₭',   flag: '🇱🇦', group: 'asia-pacific' },
  { code: 'bnd', name: 'Brunei Dollar',       symbol: 'B$',  flag: '🇧🇳', group: 'asia-pacific' },
  { code: 'mnt', name: 'Mongolian Tögrög',    symbol: '₮',   flag: '🇲🇳', group: 'asia-pacific' },
  { code: 'kzt', name: 'Kazakhstani Tenge',   symbol: '₸',   flag: '🇰🇿', group: 'asia-pacific' },
  { code: 'nzd', name: 'New Zealand Dollar',  symbol: 'NZ$', flag: '🇳🇿', group: 'asia-pacific' },
  { code: 'fjd', name: 'Fijian Dollar',       symbol: 'FJ$', flag: '🇫🇯', group: 'asia-pacific' },
  { code: 'pgk', name: 'Papua New Guinea Kina', symbol: 'K', flag: '🇵🇬', group: 'asia-pacific' },
  { code: 'mvr', name: 'Maldivian Rufiyaa',   symbol: 'Rf',  flag: '🇲🇻', group: 'asia-pacific' },
];

const STORAGE_KEY = 'tyfi_selected_currency';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

let _cachedRates: Record<string, number> = { php: 9.0, usd: 0.16, eur: 0.15 };

export const useXlmRates = () => {
  const [rates, setRates] = useState<Record<string, number>>(_cachedRates);
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'php'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const setSelectedCurrency = (code: string) => {
    setSelectedCurrencyState(code.toLowerCase());
    localStorage.setItem(STORAGE_KEY, code.toLowerCase());
  };

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    const codes = CURRENCIES.map(c => c.code).join(',');
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=${codes}`
      );
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const data = await res.json();
      if (data?.stellar) {
        _cachedRates = { ..._cachedRates, ...data.stellar };
        setRates({ ..._cachedRates });
        setLastUpdated(new Date());
      }
    } catch {
      // Fallback: backend for PHP + USD
      try {
        const res2 = await fetch(`${BACKEND_URL}/api/v1/xlm-rate`);
        const data2 = await res2.json();
        if (data2?.rate) _cachedRates = { ..._cachedRates, php: data2.rate };
        if (data2?.usd)  _cachedRates = { ..._cachedRates, usd: data2.usd };
        setRates({ ..._cachedRates });
      } catch { /* keep last known rates */ }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 60_000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  const selectedInfo = CURRENCIES.find(c => c.code === selectedCurrency) ?? CURRENCIES[0];

  const convert = (xlm: number): number => xlm * (rates[selectedCurrency] ?? 0);

  const format = (xlm: number): string => {
    const val = convert(xlm);
    const sym = selectedInfo.symbol;
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 10_000)    return `${sym}${Math.round(val).toLocaleString()}`;
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ── Backward-compatibility shims ──────────────────────────────────────────
  const formatPhp = (xlm: number) => {
    const val = xlm * (rates.php ?? 9);
    return `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatUsd = (xlm: number) => {
    const val = xlm * (rates.usd ?? 0.16);
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return {
    rates,
    selectedCurrency,
    setSelectedCurrency,
    selectedInfo,
    convert,
    format,
    formatPhp,
    formatUsd,
    rate: rates.php ?? 9,       // compat
    usdRate: rates.usd ?? 0.16, // compat
    isLoading,
    lastUpdated,
  };
};
