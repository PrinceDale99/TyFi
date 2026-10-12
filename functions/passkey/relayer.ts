import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import type { PasskeyConfig } from './config';
import { validateInvocation, type PolicyContext } from './policy';

const POLL_INTERVAL_MS = 1_500;
const POLL_ATTEMPTS = 40; // ~60s
const TX_TIMEOUT_SECONDS = 60;
/** A wallet with at least this many stroops (1 XLM) gets no further welcome funding. */
const FUNDING_THRESHOLD_STROOPS = 10_000_000n;

export type RelayerErrorCode =
  | 'SIMULATION_FAILED'
  | 'FEE_LIMIT_EXCEEDED'
  | 'SUBMISSION_FAILED'
  | 'TRANSACTION_FAILED'
  | 'CONFIRMATION_TIMEOUT'
  | 'UNKNOWN_WALLET'
  | 'FUNDING_UNAVAILABLE';

export class RelayerError extends Error {
  constructor(public readonly code: RelayerErrorCode, message: string, public readonly detail?: string) {
    super(message);
    this.name = 'RelayerError';
  }
}

export interface SubmissionResult {
  hash: string;
  ledger: number;
  returnValue?: unknown;
}

export interface DeployResult {
  walletAddress: string;
  /** Present only when this call deployed the wallet. */
  hash?: string;
  alreadyDeployed: boolean;
}

/**
 * Fee-sponsoring relayer for seedless passkey wallets.
 *
 * The sponsor account is the envelope source of every transaction and pays the
 * fees; passkey wallets authorize their own calls through Soroban address
 * credentials that the relayer never signs.
 */
export class PasskeyRelayer {
  private readonly server: rpc.Server;
  private readonly factory: Contract;
  private readonly policy: PolicyContext;
  private readonly nativeAssetId: string;
  /** is_wallet() never flips from true, so positives are cached forever. */
  private readonly knownWallets = new Set<string>();
  /** Sponsor submissions are serialized so sequence numbers never collide. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: PasskeyConfig) {
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith('http://localhost') });
    this.factory = new Contract(config.factoryId);
    this.nativeAssetId = Asset.native().contractId(config.networkPassphrase);
    this.policy = {
      allowedContracts: new Set([...config.allowedContracts, this.nativeAssetId]),
      blockedContracts: new Set([config.factoryId]),
      sponsorPublicKey: config.sponsor.publicKey(),
    };
  }

  get sponsorPublicKey(): string {
    return this.config.sponsor.publicKey();
  }

  get allowedContracts(): string[] {
    return [...this.policy.allowedContracts].filter(c => !this.policy.blockedContracts.has(c));
  }

  // ── Public operations ────────────────────────────────────────────────────

  /** Deploy (or locate) the smart wallet bound to a passkey. Idempotent. */
  async deployWallet(keyId: Buffer, publicKey: Buffer): Promise<DeployResult> {
    const args = [xdr.ScVal.scvBytes(keyId), xdr.ScVal.scvBytes(publicKey)];
    const existing = await this.read(this.factory, 'get_wallet', args);
    if (existing) {
      this.knownWallets.add(existing as string);
      return { walletAddress: existing as string, alreadyDeployed: true };
    }

    const result = await this.submit(
      this.factory.call('deploy', ...args).body().invokeHostFunctionOp().hostFunction(),
      [],
    );
    const walletAddress = result.returnValue as string;
    this.knownWallets.add(walletAddress);
    return { walletAddress, hash: result.hash, alreadyDeployed: false };
  }

  /**
   * Sponsor a contract invocation that one or more passkey wallets have
   * already authorized (signed auth entries). Re-simulating with the signed
   * entries makes the network verify every passkey signature before the
   * sponsor signs anything.
   */
  async submitInvocation(hostFunction: xdr.HostFunction, auth: xdr.SorobanAuthorizationEntry[]): Promise<SubmissionResult & { contractId: string; functionName: string }> {
    const validated = validateInvocation(hostFunction, auth, this.policy);
    for (const signer of validated.signers) {
      if (!(await this.isFactoryWallet(signer))) {
        throw new RelayerError('UNKNOWN_WALLET', `${signer} is not a wallet deployed by the TyFi factory`);
      }
    }
    const result = await this.submit(validated.hostFunction, validated.auth);
    return { ...result, contractId: validated.contractId, functionName: validated.functionName };
  }

  /**
   * Testnet only: send a small XLM balance to a newly created wallet so the
   * user can try transfers immediately. Only factory wallets below 1 XLM qualify.
   */
  async fundWallet(wallet: string): Promise<SubmissionResult | null> {
    if (this.config.network !== 'testnet' || this.config.welcomeFundingStroops <= 0n) {
      throw new RelayerError('FUNDING_UNAVAILABLE', 'Welcome funding is only available on testnet');
    }
    if (!(await this.isFactoryWallet(wallet))) {
      throw new RelayerError('UNKNOWN_WALLET', `${wallet} is not a wallet deployed by the TyFi factory`);
    }
    const sac = new Contract(this.nativeAssetId);
    const balance = BigInt((await this.read(sac, 'balance', [nativeToScVal(Address.fromString(wallet))])) as bigint ?? 0n);
    if (balance >= FUNDING_THRESHOLD_STROOPS) return null;

    const transfer = sac.call(
      'transfer',
      nativeToScVal(Address.fromString(this.sponsorPublicKey)),
      nativeToScVal(Address.fromString(wallet)),
      nativeToScVal(this.config.welcomeFundingStroops, { type: 'i128' }),
    );
    // This one call is authorized by the sponsor itself (source-account auth):
    // it is built entirely server-side and never reachable from user input.
    return this.submit(transfer.body().invokeHostFunctionOp().hostFunction(), null);
  }

  async isFactoryWallet(address: string): Promise<boolean> {
    if (this.knownWallets.has(address)) return true;
    const result = await this.read(this.factory, 'is_wallet', [nativeToScVal(Address.fromString(address))]);
    if (result === true) this.knownWallets.add(address);
    return result === true;
  }

  /** The public key registered on `wallet` for credential `keyId` (on-chain), or null. */
  async getWalletSigner(wallet: string, keyId: Buffer): Promise<Buffer | null> {
    const signer = (await this.read(new Contract(wallet), 'get_signer', [xdr.ScVal.scvBytes(keyId)])) as { public_key?: Uint8Array } | undefined;
    return signer?.public_key ? Buffer.from(signer.public_key) : null;
  }

  async health(): Promise<{ sponsorBalanceXlm: number; latestLedger: number }> {
    const [account, latest] = await Promise.all([
      this.server.getAccountEntry(this.sponsorPublicKey),
      this.server.getLatestLedger(),
    ]);
    return { sponsorBalanceXlm: Number(account.balance().toBigInt()) / 1e7, latestLedger: latest.sequence };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Read-only contract call via simulation. */
  private async read(contract: Contract, method: string, args: xdr.ScVal[]): Promise<unknown> {
    const source = await this.server.getAccount(this.sponsorPublicKey);
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new RelayerError('SIMULATION_FAILED', `Read ${method} failed`, sim.error);
    }
    return sim.result ? scValToNative(sim.result.retval) : undefined;
  }

  /**
   * Build, simulate, fee-check, sign and submit one host function with the
   * sponsor as source. `auth`:
   *   - `[]`   → the call needs no authorization (e.g. factory.deploy),
   *   - array  → pre-signed passkey auth entries, kept exactly as provided,
   *   - `null` → server-built call; use the auth entries the simulation records.
   */
  private submit(hostFunction: xdr.HostFunction, auth: xdr.SorobanAuthorizationEntry[] | null): Promise<SubmissionResult> {
    const run = async (): Promise<SubmissionResult> => {
      const build = async () => {
        const source = await this.server.getAccount(this.sponsorPublicKey);
        return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
          .addOperation(Operation.invokeHostFunction({ func: hostFunction, auth: auth ?? [] }))
          .setTimeout(TX_TIMEOUT_SECONDS)
          .build();
      };

      let tx = await build();
      let sim = await this.server.simulateTransaction(tx);
      if (rpc.Api.isSimulationRestore(sim)) {
        // Entries of a dormant wallet were archived (they live at the network
        // minimum TTL until used). Restore them first, then re-simulate.
        await this.restore(sim.restorePreamble);
        tx = await build();
        sim = await this.server.simulateTransaction(tx);
      }
      if (rpc.Api.isSimulationError(sim)) {
        throw new RelayerError('SIMULATION_FAILED', 'The network rejected this transaction during simulation', sim.error);
      }
      const prepared = rpc.assembleTransaction(tx, sim).build();
      if (auth !== null) {
        // Assembly must not add authorization the caller didn't provide: recorded
        // entries could be satisfied by the sponsor's envelope signature.
        const finalAuth = ((prepared.operations[0] as Operation.InvokeHostFunction).auth ?? []).map(a => a.toXDR('base64'));
        const expected = auth.map(a => a.toXDR('base64'));
        if (finalAuth.length !== expected.length || finalAuth.some((a, i) => a !== expected[i])) {
          throw new RelayerError('SIMULATION_FAILED', 'Simulation required authorization that was not provided by a passkey');
        }
      }
      if (Number(prepared.fee) > this.config.maxFeeStroops) {
        throw new RelayerError('FEE_LIMIT_EXCEEDED', `Fee ${prepared.fee} stroops exceeds the sponsor limit of ${this.config.maxFeeStroops}`);
      }
      prepared.sign(this.config.sponsor);

      const sent = await this.server.sendTransaction(prepared);
      if (sent.status !== 'PENDING') {
        throw new RelayerError('SUBMISSION_FAILED', `Submission returned ${sent.status}`, sent.errorResult?.toXDR('base64'));
      }
      return this.waitForConfirmation(sent.hash);
    };

    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Submit a RestoreFootprint operation for archived entries (sponsor-paid). */
  private async restore(preamble: { minResourceFee: string; transactionData: { build(): xdr.SorobanTransactionData } }): Promise<void> {
    const fee = Number(BASE_FEE) + Number(preamble.minResourceFee);
    if (fee > this.config.maxFeeStroops) {
      throw new RelayerError('FEE_LIMIT_EXCEEDED', `Restoring archived wallet state would cost ${fee} stroops`);
    }
    const source = await this.server.getAccount(this.sponsorPublicKey);
    const restoreTx = new TransactionBuilder(source, { fee: String(fee), networkPassphrase: this.config.networkPassphrase })
      .setSorobanData(preamble.transactionData.build())
      .addOperation(Operation.restoreFootprint({}))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();
    restoreTx.sign(this.config.sponsor);
    const sent = await this.server.sendTransaction(restoreTx);
    if (sent.status !== 'PENDING') {
      throw new RelayerError('SUBMISSION_FAILED', `State restore returned ${sent.status}`);
    }
    await this.waitForConfirmation(sent.hash);
  }

  private async waitForConfirmation(hash: string): Promise<SubmissionResult> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const tx = await this.server.getTransaction(hash);
      if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash, ledger: tx.ledger, returnValue: tx.returnValue ? scValToNative(tx.returnValue) : undefined };
      }
      if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new RelayerError('TRANSACTION_FAILED', `Transaction ${hash} failed on-chain`, tx.resultXdr?.toXDR('base64'));
      }
    }
    throw new RelayerError('CONFIRMATION_TIMEOUT', `Transaction ${hash} was not confirmed in time`);
  }
}
