import { Buffer } from 'buffer';
import {
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { PasskeyKit, PasskeySigner, isOnP256Curve } from 'passkey-kit';
import { p256 } from '@noble/curves/nist.js';

import { PASSKEY_STATIC_CONFIG } from './config';

/** Shape of the WebAuthn client the Passkey Kit accepts (its `WebAuthn` option). */
interface WebAuthnClient {
  startRegistration(args: { optionsJSON: PublicKeyCredentialCreationOptionsJSON }): Promise<RegistrationResponseJSON>;
  startAuthentication(args: { optionsJSON: PublicKeyCredentialRequestOptionsJSON }): Promise<AuthenticationResponseJSON>;
}

const sha256 = async (data: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)));

/**
 * WebAuthn client handed to the Stellar Passkey Kit.
 *
 * The kit defaults to `userVerification: "preferred"`; TyFi wallets are bound
 * to device biometrics, and the on-chain wallet rejects assertions without the
 * UV flag, so every ceremony here *requires* user verification (Face ID,
 * fingerprint, Windows Hello or the device PIN) and a discoverable credential
 * so the user can sign in later without remembering anything.
 */
export const strictWebAuthn: WebAuthnClient = {
  startRegistration: ({ optionsJSON }) =>
    startRegistration({
      optionsJSON: {
        ...optionsJSON,
        authenticatorSelection: {
          ...optionsJSON.authenticatorSelection,
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
      },
    }),
  startAuthentication: ({ optionsJSON }) =>
    startAuthentication({ optionsJSON: { ...optionsJSON, userVerification: 'required' } }),
};

let kit: PasskeyKit | null = null;

/** Passkey Kit instance used for the registration ceremony and key extraction. */
export function getPasskeyKit(): PasskeyKit {
  kit ??= new PasskeyKit({
    rpcUrl: PASSKEY_STATIC_CONFIG.rpcUrl,
    networkPassphrase: PASSKEY_STATIC_CONFIG.networkPassphrase,
    walletWasmHash: PASSKEY_STATIC_CONFIG.walletWasmHash,
    rpId: window.location.hostname,
    requireUserVerification: true,
    WebAuthn: strictWebAuthn,
  });
  return kit;
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext;
}

/** Register a new device passkey and return its credential id + secp256r1 public key. */
export async function registerPasskey(userName: string): Promise<{ keyId: string; publicKey: Uint8Array }> {
  const created = await getPasskeyKit().createKey(PASSKEY_STATIC_CONFIG.appName, userName, {
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  if (created.publicKey.length !== 65 || !isOnP256Curve(created.publicKey)) {
    throw new Error('This authenticator returned an unsupported key. Please use a device passkey (ES256).');
  }
  return { keyId: created.keyId, publicKey: created.publicKey };
}

export interface PasskeyAssertion {
  keyId: string;
  authenticatorData: Uint8Array;
  clientDataJson: Uint8Array;
  /** Compact r‖s, low-S normalized (what the contract verifies). */
  signature: Uint8Array;
}

/**
 * Ask the authenticator to sign `payload` (the WebAuthn challenge) via the
 * Passkey Kit's `PasskeySigner`. `keyId` = "any" lets the user pick any
 * discoverable TyFi passkey (used for sign-in).
 */
export async function assertPasskey(payload: Uint8Array, keyId: string | 'any'): Promise<PasskeyAssertion> {
  const prepared = await new PasskeySigner(keyId).sign(Buffer.from(payload), {
    rpId: window.location.hostname,
    webAuthn: strictWebAuthn,
  });
  if (prepared.key.tag !== 'Secp256r1' || prepared.value?.tag !== 'Secp256r1') {
    throw new Error('Unexpected signer type returned by the Passkey Kit');
  }
  const sig = prepared.value.values[0];
  return {
    keyId: Buffer.from(prepared.key.values[0]).toString('base64url'),
    authenticatorData: new Uint8Array(sig.authenticator_data),
    clientDataJson: new Uint8Array(sig.client_data_json),
    signature: new Uint8Array(sig.signature),
  };
}

/**
 * Recover the possible public keys behind an assertion. ECDSA admits up to two
 * candidates; the caller keeps the one that matches an on-chain wallet signer.
 * This is what lets a user sign in on a fresh browser with nothing but the
 * passkey — no seed, no stored key material.
 */
export async function recoverPublicKeys(assertion: PasskeyAssertion): Promise<Uint8Array[]> {
  const clientDataHash = await sha256(assertion.clientDataJson);
  const message = new Uint8Array(assertion.authenticatorData.length + clientDataHash.length);
  message.set(assertion.authenticatorData);
  message.set(clientDataHash, assertion.authenticatorData.length);
  const digest = await sha256(message);

  const candidates: Uint8Array[] = [];
  for (const bit of [0, 1]) {
    try {
      const point = p256.Signature.fromBytes(assertion.signature, 'compact').addRecoveryBit(bit).recoverPublicKey(digest);
      candidates.push(point.toBytes(false));
    } catch {
      // This recovery bit has no valid point.
    }
  }
  return candidates;
}
