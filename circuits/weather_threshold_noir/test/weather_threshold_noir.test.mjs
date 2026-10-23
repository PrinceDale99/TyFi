// Proves and verifies the Noir circuit with UltraHonk (bb.js), using a reading
// signed by circomlibjs — the same EdDSA-Poseidon signer the TyFi oracle uses
// for the Groth16 circuit. A pass here means one oracle signature satisfies
// both the Circom and the Noir version of the statement.
//
// Requires target/weather_threshold_noir.json (`nargo compile`, see README).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { buildEddsa, buildPoseidon } from 'circomlibjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const program = JSON.parse(fs.readFileSync(path.join(root, 'target', 'weather_threshold_noir.json'), 'utf8'));

/**
 * Symbol -> field, matching symbol_to_field in the vault and functions/zk/encoding.ts:
 * sha256(XDR(ScVal::Symbol)) with the top byte zeroed. XDR: int32 SCV_SYMBOL (15),
 * uint32 length, bytes padded to a multiple of 4.
 */
function symbolToField(symbol) {
  const bytes = Buffer.from(symbol, 'ascii');
  const xdr = Buffer.alloc(8 + Math.ceil(bytes.length / 4) * 4);
  xdr.writeInt32BE(15, 0);
  xdr.writeUInt32BE(bytes.length, 4);
  bytes.copy(xdr, 8);
  const digest = crypto.createHash('sha256').update(xdr).digest();
  digest[0] = 0;
  return BigInt('0x' + digest.toString('hex'));
}

let eddsa, poseidon, api, backend, noir;
const ORACLE_SECRET = Buffer.from('01'.repeat(32), 'hex');

before(async () => {
  [eddsa, poseidon] = await Promise.all([buildEddsa(), buildPoseidon()]);
  api = await Barretenberg.new();
  backend = new UltraHonkBackend(program.bytecode, api);
  noir = new Noir(program);
});
after(async () => {
  await api?.destroy();
});

function inputsFor({ typhoon = 'ZK_STORM', region = 'Visayas', wind = 172, floor = 150, damage = 85, secret = ORACLE_SECRET, keyHashOverride } = {}) {
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

test('symbol encoding matches the vault fixture', () => {
  // TYPHOON_FIELD for "ZK_STORM" in contracts/typhoon_resilience_vault/src/zk_fixture.rs starts 0x00 0x7f 0x73 0xd4.
  assert.ok(symbolToField('ZK_STORM').toString(16).padStart(64, '0').startsWith('007f73d4'));
});

test('a circomlibjs-signed reading above the floor proves and verifies with UltraHonk', async () => {
  const { witness } = await noir.execute(inputsFor());
  const proof = await backend.generateProof(witness);
  assert.equal(await backend.verifyProof(proof), true);

  // Public inputs come out in declaration order: key hash, typhoon, region, threshold, damage.
  assert.equal(proof.publicInputs.length, 5);
  assert.equal(BigInt(proof.publicInputs[3]), 150n);
  assert.equal(BigInt(proof.publicInputs[4]), 85n);
});

test('changing a public input invalidates the proof', async () => {
  const { witness } = await noir.execute(inputsFor());
  const proof = await backend.generateProof(witness);
  const tampered = [...proof.publicInputs];
  tampered[4] = '0x' + (100n).toString(16).padStart(64, '0'); // claim 100% damage
  assert.equal(await backend.verifyProof({ ...proof, publicInputs: tampered }), false);
});

test('a reading below the floor has no witness', async () => {
  await assert.rejects(noir.execute(inputsFor({ wind: 120 })), /wind below payout threshold/);
});

test('a key other than the registered one is rejected', async () => {
  const registered = inputsFor();
  await assert.rejects(
    noir.execute(inputsFor({ secret: Buffer.from('02'.repeat(32), 'hex'), keyHashOverride: BigInt(registered.oracle_key_hash) })),
    /unregistered oracle key/,
  );
});

test('a signature over a different reading is rejected', async () => {
  const signedFor85 = inputsFor({ damage: 85 });
  await assert.rejects(noir.execute({ ...signedFor85, damage_percentage: '95' }), /bad oracle signature/);
});
