import { WeatherReading } from './prover';

/** Wind-speed payout bands in km/h (typhoon, severe, super typhoon). */
export const PAYOUT_BANDS_KMH = [100, 120, 150] as const;

// At least one alphanumeric so input like "!!!" (-> "___") is rejected.
const SYMBOL_RE = /^(?=.*[A-Za-z0-9])[A-Za-z0-9_]{1,32}$/;

/**
 * Free text -> Soroban Symbol. Must match sanitizeSymbol in
 * frontend/src/lib/stellar.ts, which policies are subscribed with, or the
 * proven region will not match the policy's region at claim time.
 */
export function toSymbol(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);
}

/**
 * The public wind floor the proof attests to: the highest payout band the
 * private reading clears. Publishing the band instead of the reading keeps the
 * raw sensor value off-chain. Returns null below the lowest band.
 */
export function windFloorFor(windSpeed: number): number | null {
  const met = PAYOUT_BANDS_KMH.filter((band) => windSpeed >= band);
  return met.length ? met[met.length - 1] : null;
}

export function parseWeatherTrigger(body: any): WeatherReading | { error: string } {
  const typhoonId = toSymbol(String(body?.typhoonId ?? ''));
  const region = toSymbol(String(body?.region ?? ''));
  const windSpeed = Number(body?.windSpeed);
  const damagePercentage = Number(body?.damagePercentage);

  if (!SYMBOL_RE.test(typhoonId)) return { error: 'typhoonId is required' };
  if (!SYMBOL_RE.test(region)) return { error: 'region is required' };
  if (!Number.isInteger(windSpeed) || windSpeed < 0 || windSpeed > 500) {
    return { error: 'windSpeed must be an integer between 0 and 500 km/h' };
  }
  if (!Number.isInteger(damagePercentage) || damagePercentage < 1 || damagePercentage > 100) {
    return { error: 'damagePercentage must be an integer between 1 and 100' };
  }
  const windFloor = windFloorFor(windSpeed);
  if (windFloor === null) {
    return { error: `windSpeed ${windSpeed} km/h is below the lowest payout band (${PAYOUT_BANDS_KMH[0]} km/h)` };
  }
  return { typhoonId, region, windSpeed, windFloor, damagePercentage };
}
