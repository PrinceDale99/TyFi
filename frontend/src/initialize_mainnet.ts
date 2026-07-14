import { Contract, Networks, rpc, TransactionBuilder, BASE_FEE, Address, xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';

const MAINNET_RPC = 'https://mainnet.sorobanrpc.com';
const VAULT_CONTRACT = 'CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT';
const XLM_TOKEN = 'CAS3J7GYIGIRONDJMCRWUNIM5B4E6MM6K7GIGJ7N2PNEZNDD4V5S5NFR';

async function initMainnet() {
  StellarWalletsKit.init({
    selectedWalletId: FREIGHTER_ID,
    network: Networks.PUBLIC as any,
    modules: [new FreighterModule()]
  });

  const { address } = await StellarWalletsKit.fetchAddress();
  console.log(`Connected wallet: ${address}`);

  const server = new rpc.Server(MAINNET_RPC);
  const account = await server.getAccount(address);
  const contract = new Contract(VAULT_CONTRACT);

  const adminAddress = Address.fromString(address);
  const rawPubkey = (adminAddress.toScVal().value() as any).ed25519();
  const bytesN32Val = xdr.ScVal.scvBytes(rawPubkey);

  const adminKeysVec = xdr.ScVal.scvVec([bytesN32Val]);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(
      contract.call(
        'initialize',
        adminKeysVec,
        nativeToScVal(1, { type: 'u32' }), // admin_threshold
        Address.fromString(XLM_TOKEN).toScVal(), // xlm_token
        nativeToScVal(1, { type: 'u32' }), // quorum
        nativeToScVal(true, { type: 'bool' }), // is_mainnet_mode
        Address.fromString(address).toScVal() // single_oracle
      )
    )
    .setTimeout(300)
    .build();

  const preparedTx = await server.prepareTransaction(tx) as any;
  console.log('Requesting signature via Freighter...');
  
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(preparedTx.toXDR(), {
    address,
    networkPassphrase: Networks.PUBLIC
  });

  console.log('Submitting to Mainnet...');
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, Networks.PUBLIC);
  const result = await server.sendTransaction(signedTx as any);

  
  if (result.status !== 'PENDING') {
    throw new Error(`Failed to submit: ${JSON.stringify(result)}`);
  }

  console.log(`Transaction submitted! Hash: ${result.hash}`);
  
  let status: string = result.status;
  while (status === 'PENDING' || status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    const txRes = await server.getTransaction(result.hash);
    status = txRes.status;
  }
  
  if (status === 'SUCCESS') {
    console.log('✅ Mainnet Vault Initialized successfully!');
  } else {
    console.error('❌ Failed:', status);
  }
}

initMainnet().catch(console.error);
