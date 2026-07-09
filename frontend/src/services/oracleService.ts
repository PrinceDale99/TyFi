/**
 * oracleService.ts
 * Polls the main TyFi backend for the latest on-chain oracle data
 * pushed by the Oracle Scraper (https://tyfi-oracle.onrender.com)
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-backend.onrender.com';
const ORACLE_CACHE_KEY = 'tyfi_oracle_cache';
const ORACLE_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes — matches the 15-min cron + buffer

export interface OracleData {
  averageWindSpeed: number;
  maxWindSpeed: number;
  averageRainfall: number;
  maxRainfall: number;
  isTyphoonActive: boolean;
  triggerThresholdMet: boolean;
  scraperTimestamp: string;
  receivedAt?: any;
}

let _cachedOracle: OracleData | null = null;
let _cacheTime = 0;
let _fetchPromise: Promise<OracleData | null> | null = null;

/**
 * Fetch the latest oracle data from the main backend.
 * Returns null if unavailable (network down, not yet scraped, etc.)
 * Uses an in-memory + localStorage cache so we don't hammer the backend.
 */
export async function fetchOracleData(): Promise<OracleData | null> {
  const now = Date.now();

  // Return in-memory cache if fresh
  if (_cachedOracle && now - _cacheTime < ORACLE_CACHE_TTL_MS) {
    return _cachedOracle;
  }

  // Deduplicate concurrent requests
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/oracle/api/v1/latest`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!res.ok) {
        // Backend alive but no data yet → try localStorage cache
        return getLocalCache();
      }

      const json = await res.json();
      if (!json.success || !json.data) return getLocalCache();

      const data: OracleData = json.data;
      _cachedOracle = data;
      _cacheTime = now;

      // Persist to localStorage for offline resilience
      localStorage.setItem(ORACLE_CACHE_KEY, JSON.stringify({ data, time: now }));

      console.log('[Oracle] Fetched live oracle data:', data);
      return data;
    } catch (err) {
      console.warn('[Oracle] Fetch failed, using cache:', err);
      return getLocalCache();
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

function getLocalCache(): OracleData | null {
  try {
    const raw = localStorage.getItem(ORACLE_CACHE_KEY);
    if (!raw) return null;
    const { data, time } = JSON.parse(raw);
    if (Date.now() - time > ORACLE_CACHE_TTL_MS * 3) return null; // Stale after 1h
    return data as OracleData;
  } catch {
    return null;
  }
}

/**
 * Manually trigger a scrape from the oracle scraper.
 * Useful for the debug dashboard or when user navigates to the monitor tab.
 */
export async function triggerOracleScrape(): Promise<boolean> {
  try {
    const res = await fetch('https://tyfi-oracle.onrender.com/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Force-clear the in-memory cache so the next call re-fetches.
 */
export function invalidateOracleCache() {
  _cachedOracle = null;
  _cacheTime = 0;
}
