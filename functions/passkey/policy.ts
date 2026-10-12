import { Address, xdr } from '@stellar/stellar-sdk';

/**
 * Transaction policy for the fee-sponsoring relayer.
 *
 * The sponsor signs the transaction envelope, so the relayer must guarantee
 * that the sponsor's signature can never authorize anything except paying the
 * fee. The rules:
 *
 *  1. Exactly one host function, and it must be a contract invocation
 *     (no contract uploads/creations through the generic endpoint).
 *  2. The invoked contract must be on the allowlist.
 *  3. Every authorization entry must use *address* credentials. A
 *     source-account credential would be satisfied by the sponsor's envelope
 *     signature — i.e. the sponsor would be authorizing the call.
 *  4. Every authorizing address must be a contract (a smart wallet), never the
 *     sponsor account itself.
 *  5. At least one authorization entry is required, so anonymous callers can't
 *     make the sponsor pay for unauthenticated calls. (Whether each address is a
 *     wallet deployed by our factory is checked on-chain by the relayer.)
 */

export const MAX_AUTH_ENTRIES = 4;

export type PolicyErrorCode =
  | 'INVALID_XDR'
  | 'UNSUPPORTED_HOST_FUNCTION'
  | 'CONTRACT_NOT_ALLOWED'
  | 'MISSING_AUTHORIZATION'
  | 'TOO_MANY_AUTH_ENTRIES'
  | 'SOURCE_ACCOUNT_AUTH_FORBIDDEN'
  | 'NON_CONTRACT_SIGNER'
  | 'SPONSOR_AUTH_FORBIDDEN';

export class PolicyError extends Error {
  constructor(public readonly code: PolicyErrorCode, message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

export interface PolicyContext {
  allowedContracts: ReadonlySet<string>;
  /** Contracts that may only be reached through dedicated endpoints (e.g. the factory). */
  blockedContracts: ReadonlySet<string>;
  sponsorPublicKey: string;
}

export interface ValidatedInvocation {
  hostFunction: xdr.HostFunction;
  auth: xdr.SorobanAuthorizationEntry[];
  contractId: string;
  functionName: string;
  /** Contract addresses (smart wallets) that authorized this invocation. */
  signers: string[];
}

export function decodeInvocation(funcXdr: unknown, authXdr: unknown): { hostFunction: xdr.HostFunction; auth: xdr.SorobanAuthorizationEntry[] } {
  if (typeof funcXdr !== 'string' || !Array.isArray(authXdr) || authXdr.some(a => typeof a !== 'string')) {
    throw new PolicyError('INVALID_XDR', 'Expected { func: string, auth: string[] } (base64 XDR)');
  }
  if (authXdr.length > MAX_AUTH_ENTRIES) {
    throw new PolicyError('TOO_MANY_AUTH_ENTRIES', `At most ${MAX_AUTH_ENTRIES} authorization entries are accepted`);
  }
  try {
    return {
      hostFunction: xdr.HostFunction.fromXDR(funcXdr, 'base64'),
      auth: (authXdr as string[]).map(a => xdr.SorobanAuthorizationEntry.fromXDR(a, 'base64')),
    };
  } catch {
    throw new PolicyError('INVALID_XDR', 'Host function or authorization entry is not valid XDR');
  }
}

export function validateInvocation(
  hostFunction: xdr.HostFunction,
  auth: xdr.SorobanAuthorizationEntry[],
  ctx: PolicyContext,
): ValidatedInvocation {
  if (hostFunction.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    throw new PolicyError('UNSUPPORTED_HOST_FUNCTION', 'Only contract invocations can be sponsored');
  }
  const args = hostFunction.invokeContract();
  const contractId = Address.fromScAddress(args.contractAddress()).toString();
  const functionName = args.functionName().toString();

  if (ctx.blockedContracts.has(contractId) || !ctx.allowedContracts.has(contractId)) {
    throw new PolicyError('CONTRACT_NOT_ALLOWED', `Contract ${contractId} cannot be invoked through the relayer`);
  }
  if (auth.length === 0) {
    throw new PolicyError('MISSING_AUTHORIZATION', 'A passkey-signed authorization entry is required');
  }
  if (auth.length > MAX_AUTH_ENTRIES) {
    throw new PolicyError('TOO_MANY_AUTH_ENTRIES', `At most ${MAX_AUTH_ENTRIES} authorization entries are accepted`);
  }

  const signers: string[] = [];
  for (const entry of auth) {
    const credentials = entry.credentials();
    if (credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
      throw new PolicyError('SOURCE_ACCOUNT_AUTH_FORBIDDEN', 'Source-account authorization would be signed by the sponsor');
    }
    const signer = Address.fromScAddress(credentials.address().address()).toString();
    if (signer === ctx.sponsorPublicKey) {
      throw new PolicyError('SPONSOR_AUTH_FORBIDDEN', 'The sponsor account cannot be an authorizer');
    }
    if (!signer.startsWith('C')) {
      throw new PolicyError('NON_CONTRACT_SIGNER', 'Only smart-wallet (contract) authorizations are sponsored');
    }
    signers.push(signer);
  }

  return { hostFunction, auth, contractId, functionName, signers };
}
