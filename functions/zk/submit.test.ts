import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xdr } from '@stellar/stellar-sdk';
import { proofToScVal } from './submit';

test('proofToScVal encodes the Groth16Proof struct as a sorted a/b/c map', () => {
  const proof = { a: Buffer.alloc(64, 1), b: Buffer.alloc(128, 2), c: Buffer.alloc(64, 3) };
  const roundTrip = xdr.ScVal.fromXDR(proofToScVal(proof).toXDR());
  const entries = roundTrip.map()!;

  assert.deepEqual(entries.map((e) => e.key().sym().toString()), ['a', 'b', 'c']);
  assert.deepEqual(entries.map((e) => e.val().bytes().length), [64, 128, 64]);
  assert.equal(entries[1].val().bytes()[0], 2);
});
