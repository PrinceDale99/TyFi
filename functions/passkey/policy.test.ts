import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Address, Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import { decodeInvocation, PolicyError, validateInvocation, type PolicyContext } from './policy';

const contract = (seed: number) => StrKey.encodeContract(Buffer.alloc(32, seed));
const VAULT = contract(1);
const FACTORY = contract(2);
const OTHER = contract(3);
const WALLET = contract(4);
const sponsor = Keypair.random();

const ctx: PolicyContext = {
  allowedContracts: new Set([VAULT, FACTORY]),
  blockedContracts: new Set([FACTORY]),
  sponsorPublicKey: sponsor.publicKey(),
};

function invoke(contractId: string, fn = 'deposit_subsidy'): xdr.HostFunction {
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(contractId).toScAddress(),
      functionName: fn,
      args: [],
    }),
  );
}

function invocationFor(contractId: string, fn = 'deposit_subsidy') {
  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({ contractAddress: Address.fromString(contractId).toScAddress(), functionName: fn, args: [] }),
    ),
    subInvocations: [],
  });
}

function addressAuth(signer: string): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(signer).toScAddress(),
        nonce: xdr.Int64.fromString('1'),
        signatureExpirationLedger: 100,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocationFor(VAULT),
  });
}

function sourceAccountAuth(): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: invocationFor(VAULT),
  });
}

const expectCode = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof PolicyError && e.code === code);

test('accepts an allowlisted invocation authorized by a smart wallet', () => {
  const result = validateInvocation(invoke(VAULT), [addressAuth(WALLET)], ctx);
  assert.equal(result.contractId, VAULT);
  assert.equal(result.functionName, 'deposit_subsidy');
  assert.deepEqual(result.signers, [WALLET]);
});

test('rejects contracts that are not allowlisted', () => {
  expectCode(() => validateInvocation(invoke(OTHER), [addressAuth(WALLET)], ctx), 'CONTRACT_NOT_ALLOWED');
});

test('rejects the factory on the generic endpoint (deployments use /deploy)', () => {
  expectCode(() => validateInvocation(invoke(FACTORY, 'deploy'), [addressAuth(WALLET)], ctx), 'CONTRACT_NOT_ALLOWED');
});

test('rejects source-account credentials that the sponsor signature would satisfy', () => {
  expectCode(() => validateInvocation(invoke(VAULT), [sourceAccountAuth()], ctx), 'SOURCE_ACCOUNT_AUTH_FORBIDDEN');
});

test('rejects the sponsor as an explicit authorizer', () => {
  expectCode(() => validateInvocation(invoke(VAULT), [addressAuth(sponsor.publicKey())], ctx), 'SPONSOR_AUTH_FORBIDDEN');
});

test('rejects classic G-account authorizers', () => {
  expectCode(() => validateInvocation(invoke(VAULT), [addressAuth(Keypair.random().publicKey())], ctx), 'NON_CONTRACT_SIGNER');
});

test('requires at least one authorization entry', () => {
  expectCode(() => validateInvocation(invoke(VAULT), [], ctx), 'MISSING_AUTHORIZATION');
});

test('rejects non-invoke host functions such as contract uploads', () => {
  const upload = xdr.HostFunction.hostFunctionTypeUploadContractWasm(Buffer.from([0, 97, 115, 109]));
  expectCode(() => validateInvocation(upload, [addressAuth(WALLET)], ctx), 'UNSUPPORTED_HOST_FUNCTION');
});

test('decodeInvocation rejects malformed payloads and too many entries', () => {
  expectCode(() => decodeInvocation(123, []), 'INVALID_XDR');
  expectCode(() => decodeInvocation('not-xdr', []), 'INVALID_XDR');
  const entry = addressAuth(WALLET).toXDR('base64');
  expectCode(() => decodeInvocation(invoke(VAULT).toXDR('base64'), [entry, entry, entry, entry, entry]), 'TOO_MANY_AUTH_ENTRIES');
});

test('decodeInvocation round-trips valid XDR', () => {
  const decoded = decodeInvocation(invoke(VAULT).toXDR('base64'), [addressAuth(WALLET).toXDR('base64')]);
  assert.equal(decoded.auth.length, 1);
  assert.equal(validateInvocation(decoded.hostFunction, decoded.auth, ctx).contractId, VAULT);
});

test('allows a wallet to manage its own passkeys when it is the only authorizer', () => {
  const result = validateInvocation(invoke(WALLET, 'add_signer'), [addressAuth(WALLET)], ctx);
  assert.equal(result.functionName, 'add_signer');
  validateInvocation(invoke(WALLET, 'remove_signer'), [addressAuth(WALLET)], ctx);
});

test('rejects self-admin calls authorized by another wallet, and other self-calls', () => {
  expectCode(() => validateInvocation(invoke(WALLET, 'add_signer'), [addressAuth(OTHER)], ctx), 'CONTRACT_NOT_ALLOWED');
  expectCode(() => validateInvocation(invoke(WALLET, 'upgrade'), [addressAuth(WALLET)], ctx), 'CONTRACT_NOT_ALLOWED');
});
