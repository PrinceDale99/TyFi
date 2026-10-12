import { describe, expect, it, vi } from 'vitest';
import { Address, hash, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist.js';

vi.mock('./config', () => ({
  PASSKEY_STATIC_CONFIG: { rpcUrl: '', networkPassphrase: Networks.TESTNET, walletWasmHash: '00'.repeat(32), appName: 'test' },
}));

import { authorizationPayload, encodeSignatures } from './encoding';
import { recoverPublicKeys, type PasskeyAssertion } from './webauthn';

const sha256 = (b: Uint8Array) => new Uint8Array(hash(Buffer.from(b)));

/** Build a WebAuthn assertion the way an authenticator does, with a real P-256 key. */
function fakeAuthenticator(payload: Uint8Array) {
  const secretKey = p256.utils.randomSecretKey();
  const publicKey = p256.getPublicKey(secretKey, false);
  const authenticatorData = new Uint8Array([...new Uint8Array(32).fill(0x49), 0x05, 0, 0, 0, 1]);
  const clientDataJson = new TextEncoder().encode(
    JSON.stringify({ type: 'webauthn.get', challenge: Buffer.from(payload).toString('base64url'), origin: 'https://www.tyfi.site' }),
  );
  const digest = sha256(new Uint8Array([...authenticatorData, ...sha256(clientDataJson)]));
  const signature = p256.sign(digest, secretKey, { prehash: false, lowS: true });
  const assertion: PasskeyAssertion = { keyId: 'a2V5LWlk', authenticatorData, clientDataJson, signature };
  return { publicKey, assertion };
}

describe('recoverPublicKeys', () => {
  it('recovers the signing passkey public key from an assertion alone', async () => {
    const { publicKey, assertion } = fakeAuthenticator(new Uint8Array(32).fill(7));
    const candidates = await recoverPublicKeys(assertion);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(c => Buffer.compare(Buffer.from(c), Buffer.from(publicKey)) === 0)).toBe(true);
    for (const c of candidates) expect(c.length).toBe(65);
  });

  it('does not recover the key when the client data was tampered with', async () => {
    const { publicKey, assertion } = fakeAuthenticator(new Uint8Array(32).fill(7));
    const tampered = { ...assertion, clientDataJson: new TextEncoder().encode('{"type":"webauthn.get","challenge":"x"}') };
    const candidates = await recoverPublicKeys(tampered);
    expect(candidates.some(c => Buffer.compare(Buffer.from(c), Buffer.from(publicKey)) === 0)).toBe(false);
  });
});

describe('encodeSignatures', () => {
  it('encodes Signatures(Map<SignerKey, Signature>) like the contract type', () => {
    const { assertion } = fakeAuthenticator(new Uint8Array(32));
    const scVal = encodeSignatures([assertion]);

    const outer = scVal.vec()!;
    expect(outer).toHaveLength(1); // tuple struct → single-field vec
    const [entry] = outer[0].map()!;
    expect(entry.key().vec()![0].sym().toString()).toBe('Secp256r1');
    expect(Buffer.from(entry.key().vec()![1].bytes()).toString('base64url')).toBe(assertion.keyId);

    const [tag, body] = entry.val().vec()!;
    expect(tag.sym().toString()).toBe('Secp256r1');
    expect(body.map()!.map(e => e.key().sym().toString())).toEqual(['authenticator_data', 'client_data_json', 'signature']);
  });

  it('sorts multiple signers by credential id as Soroban maps require', () => {
    const a = { ...fakeAuthenticator(new Uint8Array(32)).assertion, keyId: Buffer.from([2]).toString('base64url') };
    const b = { ...fakeAuthenticator(new Uint8Array(32)).assertion, keyId: Buffer.from([1]).toString('base64url') };
    const ids = encodeSignatures([a, b]).vec()![0].map()!.map(e => e.key().vec()![1].bytes()[0]);
    expect(ids).toEqual([1, 2]);
  });

  it('rejects signatures that are not 64-byte compact form', () => {
    const { assertion } = fakeAuthenticator(new Uint8Array(32));
    expect(() => encodeSignatures([{ ...assertion, signature: new Uint8Array(70) }])).toThrow(/64 bytes/);
  });
});

describe('authorizationPayload', () => {
  const wallet = StrKey.encodeContract(Buffer.alloc(32, 4));
  const entry = (nonce: string) =>
    new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(wallet).toScAddress(),
          nonce: xdr.Int64.fromString(nonce),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({ contractAddress: Address.fromString(wallet).toScAddress(), functionName: 'add_signer', args: [] }),
        ),
        subInvocations: [],
      }),
    });

  it('is a 32-byte hash bound to nonce, expiration and network', () => {
    const base = authorizationPayload(entry('1'), Networks.TESTNET, 100);
    expect(base).toHaveLength(32);
    expect(authorizationPayload(entry('1'), Networks.TESTNET, 100).equals(base)).toBe(true);
    expect(authorizationPayload(entry('2'), Networks.TESTNET, 100).equals(base)).toBe(false);
    expect(authorizationPayload(entry('1'), Networks.TESTNET, 101).equals(base)).toBe(false);
    expect(authorizationPayload(entry('1'), Networks.PUBLIC, 100).equals(base)).toBe(false);
  });
});

describe('parseXlmAmount', async () => {
  const { parseXlmAmount } = await import('./payments');
  it('converts decimal XLM to stroops exactly', () => {
    expect(parseXlmAmount('1')).toBe(10_000_000n);
    expect(parseXlmAmount('0.0000001')).toBe(1n);
    expect(parseXlmAmount('12.5')).toBe(125_000_000n);
  });
  it('rejects zero, negatives, and excess precision', () => {
    for (const bad of ['0', '-1', '1.00000001', 'abc', '']) expect(() => parseXlmAmount(bad)).toThrow();
  });
});
