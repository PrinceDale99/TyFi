import crypto from 'crypto';
import { xdr } from '@stellar/stellar-sdk';

// Encodings shared between the oracle prover and the vault's Groth16 verifier.
// Everything here must stay byte-for-byte in sync with
// contracts/typhoon_resilience_vault/src/{lib.rs,verifier.rs}.

/**
 * Symbol -> BN254 scalar, matching `symbol_to_field` in the vault:
 * sha256(XDR(ScVal::Symbol)) with the top byte zeroed.
 */
export function symbolToField(symbol: string): bigint {
  const digest = crypto.createHash('sha256').update(xdr.ScVal.scvSymbol(symbol).toXDR()).digest();
  digest[0] = 0;
  return BigInt('0x' + digest.toString('hex'));
}

function fpBytes(value: string | bigint): Buffer {
  return Buffer.from(BigInt(value).toString(16).padStart(64, '0'), 'hex');
}

/** snarkjs G1 [x, y, z] (affine, z = 1) -> 64 bytes be(x) || be(y). */
export function g1Bytes(p: (string | bigint)[]): Buffer {
  return Buffer.concat([fpBytes(p[0]), fpBytes(p[1])]);
}

/**
 * snarkjs G2 [[x.c0, x.c1], [y.c0, y.c1], z] -> 128 bytes
 * be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0) (Soroban/Ethereum order).
 */
export function g2Bytes(p: (string | bigint)[][]): Buffer {
  return Buffer.concat([fpBytes(p[0][1]), fpBytes(p[0][0]), fpBytes(p[1][1]), fpBytes(p[1][0])]);
}

export interface SorobanGroth16Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

export interface SorobanVerifyingKey {
  alpha: Buffer;
  beta: Buffer;
  gamma: Buffer;
  delta: Buffer;
  ic: Buffer[];
}

export function encodeProof(proof: any): SorobanGroth16Proof {
  return { a: g1Bytes(proof.pi_a), b: g2Bytes(proof.pi_b), c: g1Bytes(proof.pi_c) };
}

export function encodeVerifyingKey(vk: any): SorobanVerifyingKey {
  return {
    alpha: g1Bytes(vk.vk_alpha_1),
    beta: g2Bytes(vk.vk_beta_2),
    gamma: g2Bytes(vk.vk_gamma_2),
    delta: g2Bytes(vk.vk_delta_2),
    ic: vk.IC.map(g1Bytes),
  };
}
