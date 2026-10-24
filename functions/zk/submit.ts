import { Address, Contract, Keypair, nativeToScVal, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { SorobanGroth16Proof } from './encoding';

// Submits a Groth16-backed weather report to the vault's
// submit_weather_report_zk entrypoint and waits for the ledger result.

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

export async function submitZkReport(report: ZkReportSubmission, cfg: SubmitConfig): Promise<SubmitResult> {
  const server = new rpc.Server(cfg.rpcUrl);
  const source = await server.getAccount(cfg.oracle.publicKey());
  const vault = new Contract(cfg.vaultContractId);

  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: cfg.passphrase })
    .addOperation(
      vault.call(
        'submit_weather_report_zk',
        new Address(cfg.oracle.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol(report.typhoonId),
        xdr.ScVal.scvSymbol(report.region),
        nativeToScVal(report.damagePercentage, { type: 'u32' }),
        nativeToScVal(report.windFloor, { type: 'u32' }),
        proofToScVal(report.proof),
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
