import { Keypair, Contract, rpc, TransactionBuilder, Networks, xdr, nativeToScVal } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CAS5CPEPNDP5J6LEQLRJWOXHICCNL5KXHGQTVYD4E4FTTOWFSXVXPT5Q';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const XLM_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Use a generated dummy admin key for initialization
const adminKeypair = Keypair.random();

async function init() {
  const server = new rpc.Server(RPC_URL);
  
  // Fund the admin account using Friendbot so it has XLM to pay for tx fees
  console.log('Funding admin account via Friendbot...');
  await fetch(`https://friendbot.stellar.org?addr=${adminKeypair.publicKey()}`);

  const adminAccount = await server.getAccount(adminKeypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  console.log('Inflating TVL to 2 Million XLM...');
  const tvlAccount = await server.getAccount(adminKeypair.publicKey());
  const tvlTx = new TransactionBuilder(tvlAccount, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('testnet_fund_tvl', nativeToScVal(20000000000000, { type: 'i128' })) // 2M XLM
    )
    .setTimeout(30)
    .build();

  tvlTx.sign(adminKeypair);
  let prepTvlTx = await server.prepareTransaction(tvlTx);
  prepTvlTx.sign(adminKeypair);
  let tvlRes = await server.sendTransaction(prepTvlTx);
  console.log('TVL Inflate Tx:', tvlRes.hash);
}

init().catch(console.error);
