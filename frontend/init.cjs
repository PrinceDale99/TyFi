const { rpc, Contract, Address, nativeToScVal, TransactionBuilder, BASE_FEE, Networks, Keypair, xdr, StrKey } = require('@stellar/stellar-sdk');

(async () => {
  try {
    const server = new rpc.Server('https://soroban-testnet.stellar.org');
    const contract = new Contract('CCN2PKUYBI33EVUW3NUZ57YWY7DW5V7BS4LMDJTWOMYQUJOFHQAQVFJT');
    const kp = Keypair.fromSecret('SANESKUCL6HYCVVMZF7MSNEI5HC3TZAWZJOZEGO5R2WWFPBMGMXCZC6U');
    
    const account = await server.getAccount(kp.publicKey());
    
    // contract address scval
    const xlmContractIdBuffer = StrKey.decodeContract('CAMB6K2KOVZGEGXX5V7C3QMI6FVLZM7LS5TJOOUX74MFOMP32RCEAYIQ');
    const xlmContractAddressScVal = xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeContract(xlmContractIdBuffer));
    
    // admin address scval
    const adminAccountIdBuffer = StrKey.decodeEd25519PublicKey(kp.publicKey());
    const adminAddressScVal = xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeAccount(xdr.PublicKey.publicKeyTypeEd25519(adminAccountIdBuffer)));
    
    // initialize(env: Env, admin: Address, xlm_token: Address, quorum: u32, is_mainnet_mode: bool, single_oracle: Address)
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(
        contract.call(
          'initialize',
          adminAddressScVal,
          xlmContractAddressScVal,
          nativeToScVal(1, { type: 'u32' }),
          nativeToScVal(false, { type: 'bool' }),
          adminAddressScVal
        )
      )
      .setTimeout(30)
      .build();
      
    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(kp);
    
    const sendResult = await server.sendTransaction(preparedTx);
    console.log("Send Result:", sendResult);
    
    let status = sendResult.status;
    let txResult;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await server.getTransaction(sendResult.hash);
      status = txResult.status;
    }
    console.log("Final status:", status);
    if (txResult) {
      console.log("Result XDR:", txResult.resultXdr);
    }
  } catch (err) {
    console.error(err);
  }
})();
