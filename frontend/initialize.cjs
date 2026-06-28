const { rpc, Contract, nativeToScVal, TransactionBuilder, BASE_FEE, Networks, Keypair, xdr, StrKey } = require('@stellar/stellar-sdk');

(async () => {
  try {
    const server = new rpc.Server('https://soroban-testnet.stellar.org');
    const contract = new Contract('CCA7FZTWEJDESXHLOENHB6FV3DN5YZYZDNZWKKUPPP2NGNSJCZ7APEYH');
    
    // We will use a random keypair for admin and fund it
    const kp = Keypair.random();
    console.log("Admin Public Key:", kp.publicKey());
    
    console.log("Funding admin via friendbot...");
    await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
    
    const account = await server.getAccount(kp.publicKey());
    
    // XLM token on testnet
    const xlmContractIdBuffer = StrKey.decodeContract('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
    const xlmContractAddressScVal = xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeContract(xlmContractIdBuffer));
    
    // Single oracle address
    const oracleIdBuffer = StrKey.decodeEd25519PublicKey(kp.publicKey());
    const oracleAddressScVal = xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeAccount(xdr.PublicKey.publicKeyTypeEd25519(oracleIdBuffer)));

    // admin_keys is Vec<BytesN<32>>
    const adminKeysScVal = xdr.ScVal.scvVec([ xdr.ScVal.scvBytes(oracleIdBuffer) ]);

    console.log("Building transaction...");
    // initialize(env: Env, admin_keys: Vec<BytesN<32>>, admin_threshold: u32, xlm_token: Address, quorum: u32, is_mainnet_mode: bool, single_oracle: Address)
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(
        contract.call(
          'initialize',
          adminKeysScVal,
          nativeToScVal(1, { type: 'u32' }),
          xlmContractAddressScVal,
          nativeToScVal(1, { type: 'u32' }),
          nativeToScVal(false, { type: 'bool' }),
          oracleAddressScVal
        )
      )
      .setTimeout(30)
      .build();
      
    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(kp);
    
    console.log("Sending transaction...");
    const sendResult = await server.sendTransaction(preparedTx);
    console.log("Send Result Hash:", sendResult.hash);
    
    let status = sendResult.status;
    let txResult;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await server.getTransaction(sendResult.hash);
      status = txResult.status;
    }
    console.log("Final status:", status);
    if (status === "SUCCESS") {
      console.log("Contract successfully initialized!");
    } else {
      console.error("Initialization failed:", txResult);
    }
  } catch (err) {
    console.error(err);
  }
})();
