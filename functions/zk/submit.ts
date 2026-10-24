import { Address, Contract, Keypair, nativeToScVal, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { SorobanGroth16Proof } from './encoding';

// Submits a ZK-backed weather report to the vault and waits for the ledger
// result: Groth16 proofs to submit_weather_report_zk, UltraHonk (Noir) proofs
// to submit_weather_report_noir.

/** Groth16Proof contracttype -> ScMap with keys in sorted order (a, b, c). */
export function proofToScVal(proof: SorobanGroth16Proof): xdr.ScVal {
  const entry = (key: string, val: Buffer) =>
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val: xdr.ScVal.scvBytes(val) });
  return xdr.ScVal.scvMap([entry('a', proof.a), entry('b', proof.b), entry('c', proof.c)]);
}

export interface ZkReportSubmission {
  typhoonId: string;
  region: string;
  windFloor: number;
  damagePercentage: number;
  proof: SorobanGroth16Proof;
}

export interface SubmitConfig {
  rpcUrl: string;
  passphrase: string;
  vaultContractId: string;
  oracle: Keypair;
}

export interface SubmitResult {
  txHash: string;
  ledger: number;
  cpuInstructions?: number;
}

const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 40;

export function submitZkReport(report: ZkReportSubmission, cfg: SubmitConfig): Promise<SubmitResult> {
  return submitReport('submit_weather_report_zk', report, proofToScVal(report.proof), cfg);
}

export interface NoirReportSubmission extends Omit<ZkReportSubmission, 'proof'> {
  /** 14,592-byte UltraHonk proof of circuits/weather_threshold_noir. */
  proof: Buffer;
}

/** Same report, backed by an UltraHonk proof checked by the vault's Noir verifier. */
export function submitNoirReport(report: NoirReportSubmission, cfg: SubmitConfig): Promise<SubmitResult> {
  return submitReport('submit_weather_report_noir', report, xdr.ScVal.scvBytes(report.proof), cfg);
}

async function submitReport(
  method: string,
  report: Omit<ZkReportSubmission, 'proof'>,
  proof: xdr.ScVal,
  cfg: SubmitConfig,
): Promise<SubmitResult> {
  const server = new rpc.Server(cfg.rpcUrl);
  const source = await server.getAccount(cfg.oracle.publicKey());
  const vault = new Contract(cfg.vaultContractId);

  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: cfg.passphrase })
    .addOperation(
      vault.call(
        method,
        new Address(cfg.oracle.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol(report.typhoonId),
        xdr.ScVal.scvSymbol(report.region),
        nativeToScVal(report.damagePercentage, { type: 'u32' }),
        nativeToScVal(report.windFloor, { type: 'u32' }),
        proof,
      ),
    )
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // The contract error (e.g. InvalidProof = #17) is in the simulation message.
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  const cpuInstructions = Number(sim.transactionData?.build().resources().instructions() ?? 0) || undefined;

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(cfg.oracle);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(`sendTransaction rejected: ${sent.errorResult?.toXDR('base64') ?? 'unknown'}`);
  }

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { txHash: sent.hash, ledger: res.ledger, cpuInstructions };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction ${sent.hash} failed on-chain`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Transaction ${sent.hash} not confirmed after ${(POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}
