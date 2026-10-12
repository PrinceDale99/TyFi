import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

/**
 * One shared XLM→PHP/USD rate poller for the whole page.
 *
 * Previously every component using this hook (8 of them) polled the backend
 * every 10s on its own — ~48 requests/minute per open tab, which helped push
 * the small backend instance over its limits. Now a single poller refreshes
 * every 60s, backs off while the backend is unreachable, and pauses while the
 * tab is hidden.
 */
const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let rate = 9.0;
let usdRate = 0.25;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach(fn => fn());

async function fetchRate() {
  if (inFlight) return;
  inFlight = true;
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/xlm-rate`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (typeof data?.rate === 'number') rate = data.rate;
    if (typeof data?.usd === 'number') usdRate = data.usd;
    failures = 0;
    notify();
  } catch (error) {
    failures++;
    if (failures === 1) console.warn('XLM rate unavailable, using last known rate:', (error as Error).message);
  } finally {
    inFlight = false;
  }
}

function schedule() {
  if (timer || subscribers.size === 0) return;
  const delay = Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
  timer = setTimeout(async () => {
    timer = null;
    if (document.visibilityState === 'visible') await fetchRate();
    schedule();
  }, delay);
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  if (subscribers.size === 1) {
    fetchRate().then(schedule);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

export const useXlmToPhp = () => {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);

  const convert = (xlm: number) => xlm * rate;
  const convertToUsd = (xlm: number) => xlm * usdRate;
  const formatPhp = (xlm: number) =>
    `₱${convert(xlm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUsd = (xlm: number) =>
    `$${convertToUsd(xlm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return { rate, usdRate, convert, convertToUsd, formatPhp, formatUsd, isLoading: false };
};
