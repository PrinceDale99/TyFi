import fs from 'fs';
import path from 'path';
import { OracleZkKey, signReading, WeatherReading } from './prover';

// UltraHonk prover for circuits/weather_threshold_noir, the proof the vault
// checks in submit_weather_report_noir through contracts/noir_verifier.
// The compiled circuit is copied into functions/zk/artifacts by the circuit's
// `npm run compile`, because the Render service only ships functions/.
// bb.js and noir_js are loaded on first use: they are only needed for Noir
// reports and the prover's WASM memory is large.
export const NOIR_CIRCUIT = path.join(__dirname, 'artifacts', 'weather_threshold_noir.json');

/** Proof size the on-chain verifier accepts (Barretenberg 0.87.0, Keccak transcript). */
export const NOIR_PROOF_BYTES = 14592;

export interface NoirWeatherProof {
  proof: Buffer;
  /** Hex field elements in circuit order: key hash, typhoon, region, wind floor, damage. */
  publicInputs: string[];
  provingMs: number;
}

export async function proveWeatherReadingNoir(reading: WeatherReading, key: OracleZkKey): Promise<NoirWeatherProof> {
  const [{ Noir }, { UltraHonkBackend }] = await Promise.all([import('@noir-lang/noir_js'), import('@aztec/bb.js')]);
  const program = JSON.parse(fs.readFileSync(NOIR_CIRCUIT, 'utf8'));
  const inputs = await signReading(reading, key);

  const started = Date.now();
  const { witness } = await new Noir(program).execute(inputs);
  const backend = new UltraHonkBackend(program.bytecode, { threads: 1 });
  try {
    // keccak: the transcript the Soroban verifier implements.
    const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
    if (proof.length !== NOIR_PROOF_BYTES) {
      throw new Error(`Unexpected UltraHonk proof size ${proof.length}`);
    }
    return { proof: Buffer.from(proof), publicInputs, provingMs: Date.now() - started };
  } finally {
    await backend.destroy();
  }
}
