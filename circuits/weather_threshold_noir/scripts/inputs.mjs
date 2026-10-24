// Circuit inputs for a reading signed the way the TyFi oracle signs it
// (circomlibjs EdDSA-Poseidon), shared by the tests and the fixture script.
import crypto from 'node:crypto';
import { buildEddsa, buildPoseidon } from 'circomlibjs';

export const TEST_ORACLE_SECRET = Buffer.from('01'.repeat(32), 'hex');

/**
 * Symbol -> field, matching symbol_to_field in the vault and functions/zk/encoding.ts:
 * sha256(XDR(ScVal::Symbol)) with the top byte zeroed. XDR: int32 SCV_SYMBOL (15),
 * uint32 length, bytes padded to a multiple of 4.
 */
export function symbolToField(symbol) {
  const bytes = Buffer.from(symbol, 'ascii');
  const xdr = Buffer.alloc(8 + Math.ceil(bytes.length / 4) * 4);
  xdr.writeInt32BE(15, 0);
  xdr.writeUInt32BE(bytes.length, 4);
  bytes.copy(xdr, 8);
  const digest = crypto.createHash('sha256').update(xdr).digest();
  digest[0] = 0;
  return BigInt('0x' + digest.toString('hex'));
}

let primitives;
const getPrimitives = () => (primitives ??= Promise.all([buildEddsa(), buildPoseidon()]));

export async function signedInputs({ typhoon = 'ZK_STORM', region = 'Visayas', wind = 172, floor = 150, damage = 85, secret = TEST_ORACLE_SECRET, keyHashOverride } = {}) {
  const [eddsa, poseidon] = await getPrimitives();
  const [ax, ay] = eddsa.prv2pub(secret).map((p) => eddsa.F.toObject(p));
  const keyHash = keyHashOverride ?? poseidon.F.toObject(poseidon([ax, ay]));
  const t = symbolToField(typhoon);
  const r = symbolToField(region);
  const sig = eddsa.signPoseidon(secret, poseidon([t, r, BigInt(wind), BigInt(damage)]));
  return {
    oracle_key_hash: keyHash.toString(),
    typhoon_id: t.toString(),
    region_id: r.toString(),
    payout_threshold: String(floor),
    damage_percentage: String(damage),
    wind_speed: String(wind),
    ax: ax.toString(),
    ay: ay.toString(),
    r8x: eddsa.F.toObject(sig.R8[0]).toString(),
    r8y: eddsa.F.toObject(sig.R8[1]).toString(),
    s: sig.S.toString(),
  };
}
