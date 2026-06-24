import { Keypair, rpc, TransactionBuilder, Networks, Contract, Address, nativeToScVal, Account, xdr, BASE_FEE, Transaction, Operation, Asset } from '@stellar/stellar-sdk';
 // Vite project should have global fetch in Node 18+

const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;
const contractId = 'CCN2PKUYBI33EVUW3NUZ57YWY7DW5V7BS4LMDJTWOMYQUJOFHQAQVFJT';

async function fundWithFriendbot(pubkey) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${pubkey}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${pubkey}: ${await res.text()}`);
  }
}

async function depositToContract(workerKp, amountXlm) {
  const account = await rpcServer.getAccount(workerKp.publicKey());
  const contract = new Contract(contractId);
  const stroops = BigInt(amountXlm) * BigInt(10000000);
  
  let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(
      contract.call(
        "deposit_reinsurance",
        Address.fromString(workerKp.publicKey()).toScVal(),
        nativeToScVal(stroops, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(workerKp);
  
  const res = await rpcServer.sendTransaction(tx);
  if (res.status === "PENDING") {
    let status = res.status;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      const txRes = await rpcServer.getTransaction(res.hash);
      status = txRes.status;
    }
  }
}

async function run() {
  const targetAmount = 529000;
  const numWorkers = Math.ceil(targetAmount / 9900);
  console.log(`Generating ${numWorkers} worker accounts to farm testnet XLM...`);
  
  let totalDeposited = 0;
  for (let i = 0; i < numWorkers; i++) {
    const worker = Keypair.random();
    try {
      await fundWithFriendbot(worker.publicKey());
      await depositToContract(worker, 9900);
      totalDeposited += 9900;
      console.log(`Worker ${i+1}/${numWorkers} deposited 9,900 XLM. Total so far: ${totalDeposited}`);
    } catch (e) {
      console.log(`\nRate limit hit or error on worker ${i}: ${e.message}. Waiting 5 seconds...`);
      await new Promise(r => setTimeout(r, 5000));
      i--; // retry
    }
  }
  console.log(`\nSuccessfully deposited ${totalDeposited} XLM to the contract!`);
}

run().catch(console.error);
