import { hash, xdr } from '@stellar/stellar-sdk';

/**
 * XDR encoding for the TyFi smart wallet's `__check_auth` signature type:
 *
 *   struct Signatures(Map<SignerKey, Signature>)            → Vec[Map]
 *   enum   SignerKey { Secp256r1(Bytes) }                   → Vec[Symbol, Bytes]
 *   enum   Signature { Secp256r1(Secp256r1Signature) }      → Vec[Symbol, Map]
 *   struct Secp256r1Signature { authenticator_data, client_data_json, signature }
 *          → Map with keys sorted (as Soroban requires)
 *
 * This is the same layout the Stellar Passkey Kit produces for its own wallets.
 */
export interface EncodableAssertion {
  keyId: string; // base64url
  authenticatorData: Uint8Array;
  clientDataJson: Uint8Array;
  signature: Uint8Array; // 64-byte compact r‖s
}

const sym = (s: string) => xdr.ScVal.scvSymbol(s);
const bytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const entry = (key: xdr.ScVal, val: xdr.ScVal) => new xdr.ScMapEntry({ key, val });

export function encodeSignatures(assertions: EncodableAssertion[]): xdr.ScVal {
  const entries = assertions.map(a => {
    if (a.signature.length !== 64) throw new Error('Passkey signature must be 64 bytes (compact r‖s)');
    const signerKey = xdr.ScVal.scvVec([sym('Secp256r1'), bytes(Buffer.from(a.keyId, 'base64url'))]);
    const signature = xdr.ScVal.scvVec([
      sym('Secp256r1'),
      xdr.ScVal.scvMap([
        entry(sym('authenticator_data'), bytes(a.authenticatorData)),
        entry(sym('client_data_json'), bytes(a.clientDataJson)),
        entry(sym('signature'), bytes(a.signature)),
      ]),
    ]);
    return entry(signerKey, signature);
  });
  // Soroban maps must be sorted by key; keys here are Vec[Symbol, Bytes], so
  // ordering by the credential id bytes matches the host's ordering.
  entries.sort((x, y) => Buffer.compare(x.key().vec()![1].bytes(), y.key().vec()![1].bytes()));
  return xdr.ScVal.scvVec([xdr.ScVal.scvMap(entries)]);
}

/**
 * The 32-byte payload a Soroban address credential signs:
 * sha256(HashIdPreimage::SorobanAuthorization{ networkId, nonce, expiration, invocation }).
 * It becomes the WebAuthn challenge, so the biometric prompt is bound to this
 * exact invocation, nonce and expiry.
 */
export function authorizationPayload(
  authEntry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
  signatureExpirationLedger: number,
): Buffer {
  const credentials = authEntry.credentials().address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(networkPassphrase)),
      nonce: credentials.nonce(),
      signatureExpirationLedger,
      invocation: authEntry.rootInvocation(),
    }),
  );
  return hash(preimage.toXDR());
}
