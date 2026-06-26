import express from 'express';
import { Keypair, TransactionBuilder, Networks, xdr, SorobanRpc, Contract, Address } from 'stellar-sdk';
import { logEvent } from './logger';

export const oracleRouter = express.Router();
const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

oracleRouter.post('/api/v1/weather-trigger', async (req, res) => {
  try {
    const { lat, lon, severity, targetAddress } = req.body;
    await logEvent('INFO', 'Weather trigger received', { lat, lon, severity });

    const proofBuffer = Buffer.from(JSON.stringify({ lat, lon, severity, verified: true }));
    
    const sourceKeypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY as string);
    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());
    
    const contract = new Contract(process.env.CONTRACT_ID as string);
    const amountVal = xdr.ScVal.scvU128(new xdr.Scu128({ hi: 0, lo: xdr.Uint64.fromString("50000000") }));
    
    const tx = new TransactionBuilder(sourceAccount, { fee: '10000', networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call("verify_and_liquidate", 
        xdr.ScVal.scvBytes(proofBuffer),
        xdr.ScVal.scvVec([]),
        new Address(targetAddress).toScVal(),
        amountVal
      ))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(sourceKeypair);

    const sendResponse = await server.sendTransaction(preparedTx);
    res.json({ status: 'success', txHash: sendResponse.hash });
  } catch (err: any) {
    await logEvent('ERROR', 'Oracle failure', { error: err.message });
    res.status(500).json({ error: 'Failed to trigger parametric contract' });
  }
});
