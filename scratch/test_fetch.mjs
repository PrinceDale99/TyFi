import { rpc, Contract, TransactionBuilder, Account, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const DAO_CONTRACT_ID = 'CC7C3BOK226Q6D2O6LFHPNP7ENSNUZ4QBLUC4ZIOUO6PQHZHZETVP37F';
const server = new rpc.Server(RPC_URL);

async function main() {
  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const daoContract = new Contract(DAO_CONTRACT_ID);

  try {
    const txCount = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: 'Test SDF Network ; September 2015' })
      .addOperation(daoContract.call('get_proposal_count'))
      .setTimeout(30)
      .build();

    const countResult = await server.simulateTransaction(txCount);
    console.log("Count result:", rpc.Api.isSimulationSuccess(countResult));
    const count = Number(scValToNative(countResult.result.retval));
    console.log("Count:", count);

    for (let i = 1; i <= count; i++) {
      const txProp = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: 'Test SDF Network ; September 2015' })
        .addOperation(daoContract.call('get_proposal', nativeToScVal(i, { type: 'u64' })))
        .setTimeout(30)
        .build();

      const propResult = await server.simulateTransaction(txProp);
      console.log(`Prop ${i} result:`, rpc.Api.isSimulationSuccess(propResult));
      if (rpc.Api.isSimulationSuccess(propResult)) {
        const p = scValToNative(propResult.result.retval);
        const actionTypeStr = typeof p.action_type === 'string' ? p.action_type : String(p.action_type);
        const descStr = typeof p.description === 'string' ? p.description : String(p.description);
        const approximateDeadlineTs = Date.now() + (Number(p.deadline) * 5000) - (Date.now() % 5000); 
        const mapped = {
                  id: Number(p.id || p[0]),
                  creator: p.creator || p[1],
                  description: descStr || p[2],
                  actionType: actionTypeStr || p[3],
                  votesFor: Number(p.votes_for || p[4] || 0),
                  votesAgainst: Number(p.votes_against || p[5] || 0),
                  executed: p.executed || p[6] || false,
                  deadline: approximateDeadlineTs, 
        };
        console.log("Proposal Mapped:", mapped);
        console.log("Is Active:", mapped.deadline > Date.now());
      } else {
        console.log("Prop Error:", propResult.error);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

main();
