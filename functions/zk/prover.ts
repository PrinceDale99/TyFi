import path from 'path';
import { buildEddsa, buildPoseidon } from 'circomlibjs';
import { groth16 } from 'snarkjs';
import { encodeProof, symbolToField, SorobanGroth16Proof } from './encoding';

// Groth16 prover for circuits/weather_threshold. Artifacts are synced into
// functions/zk/artifacts by circuits/weather_threshold/scripts/sync-artifacts.js
// because the Render service only ships the functions/ directory.
const ARTIFACTS = path.join(__dirname, 'artifacts');
export const CIRCUIT_WASM = path.join(ARTIFACTS, 'weather_threshold.wasm');
export const CIRCUIT_ZKEY = path.join(ARTIFACTS, 'weather_threshold_final.zkey');

let primitives: Promise<{ eddsa: any; poseidon: any }> | null = null;
function getPrimitives() {
  primitives ??= Promise.all([buildEddsa(), buildPoseidon()]).then(([eddsa, poseidon]) => ({ eddsa, poseidon }));
  return primitives;
}

/** Stops snarkjs's cached BN128 worker threads so the process can exit. */
export async function shutdownProver(): Promise<void> {
  const curve = (globalThis as any).curve_bn128;
  if (curve) {
    await curve.terminate();
    delete (globalThis as any).curve_bn128;
  }
}

export interface OracleZkKey {
  privateKey: Buffer;
  Ax: bigint;
  Ay: bigint;
  /** Poseidon(Ax, Ay) — registered on the vault with set_oracle_zk_key. */
  keyHash: bigint;
}

/** Derives the oracle's Baby Jubjub EdDSA key from a 32-byte hex secret. */
export async function loadOracleZkKey(secretHex: string | undefined = process.env.ORACLE_ZK_PRIVATE_KEY): Promise<OracleZkKey> {
  if (!secretHex || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error('ORACLE_ZK_PRIVATE_KEY must be 32 bytes of hex');
  }
  const { eddsa, poseidon } = await getPrimitives();
  const privateKey = Buffer.from(secretHex, 'hex');
  const [Axf, Ayf] = eddsa.prv2pub(privateKey);
  const Ax = eddsa.F.toObject(Axf) as bigint;
  const Ay = eddsa.F.toObject(Ayf) as bigint;
  const keyHash = poseidon.F.toObject(poseidon([Ax, Ay])) as bigint;
  return { privateKey, Ax, Ay, keyHash };
}

export interface WeatherReading {
  typhoonId: string;
  region: string;
  /** Raw reading in km/h — stays private, never leaves the oracle. */
  windSpeed: number;
  /** Public lower bound the proof attests to; must be <= windSpeed. */
  windFloor: number;
  damagePercentage: number;
}

export interface WeatherProof {
  proof: SorobanGroth16Proof;
  publicSignals: string[];
  keyHash: bigint;
  provingMs: number;
}

/**
 * The oracle's EdDSA-Poseidon signature over (typhoon, region, wind, damage)
 * as circuit inputs, named as in the Noir circuit. Both circuits check the
 * same signature.
 */
export async function signReading(reading: WeatherReading, key: OracleZkKey) {
  const { eddsa, poseidon } = await getPrimitives();
  const typhoonField = symbolToField(reading.typhoonId);
  const regionField = symbolToField(reading.region);
  const msg = poseidon([typhoonField, regionField, BigInt(reading.windSpeed), BigInt(reading.damagePercentage)]);
  const sig = eddsa.signPoseidon(key.privateKey, msg);
  return {
    oracle_key_hash: key.keyHash.toString(),
    typhoon_id: typhoonField.toString(),
    region_id: regionField.toString(),
    payout_threshold: String(reading.windFloor),
    damage_percentage: String(reading.damagePercentage),
    wind_speed: String(reading.windSpeed),
    ax: key.Ax.toString(),
    ay: key.Ay.toString(),
    r8x: eddsa.F.toObject(sig.R8[0]).toString(),
    r8y: eddsa.F.toObject(sig.R8[1]).toString(),
    s: sig.S.toString(),
  };
}

export async function proveWeatherReading(reading: WeatherReading, key: OracleZkKey): Promise<WeatherProof> {
  const s = await signReading(reading, key);
  const input = {
    oracle_key_hash: s.oracle_key_hash,
    typhoon_id: s.typhoon_id,
    region_id: s.region_id,
    payout_threshold: s.payout_threshold,
    damage_percentage: s.damage_percentage,
    wind_speed: s.wind_speed,
    Ax: s.ax,
    Ay: s.ay,
    R8x: s.r8x,
    R8y: s.r8y,
    S: s.s,
  };

  const started = Date.now();
  const { proof, publicSignals } = await groth16.fullProve(input, CIRCUIT_WASM, CIRCUIT_ZKEY);
  return { proof: encodeProof(proof), publicSignals, keyHash: key.keyHash, provingMs: Date.now() - started };
}
