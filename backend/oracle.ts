import express from 'express';
import { Keypair, TransactionBuilder, Networks, xdr, rpc, Contract, Address } from '@stellar/stellar-sdk';
import { logEvent } from './logger';

export const oracleRouter = express.Router();
const server = new rpc.Server('https://soroban-testnet.stellar.org');

import { initiateFiatSweep } from './pdax';

oracleRouter.post('/api/v1/weather-trigger', async (req, res) => {
  try {
    const { lat, lon, severity, targetAddress, paymentPrefs } = req.body;
    await logEvent('INFO', 'Weather trigger received', { lat, lon, severity });

    // Mock the Stellar TX for the hackathon / test flow
    let txHash = "MOCK_TX_" + Math.random().toString(36).substring(7);
    
    // Simulate Soroban contract execution time
    await new Promise(resolve => setTimeout(resolve, 800));

    // Calculate PHP equivalent (e.g. 50,000 XLM yield at 58.20 PHP = ~2.9m PHP)
    // Default fallback to 15000 if not provided in the request
    const amountPHP = req.body.amountPHP || 15000;
    
    let pdaxTxId = "PENDING";
    try {
      await logEvent('INFO', 'Initiating PDAX Fiat Sweep', { amountPHP, paymentPrefs });
      pdaxTxId = await initiateFiatSweep(amountPHP, paymentPrefs);
      await logEvent('INFO', 'PDAX Fiat Sweep Success', { pdaxTxId });
    } catch (pdaxError: any) {
      await logEvent('ERROR', 'PDAX Fiat Sweep Failed', { error: pdaxError.message });
      // We will still return the error in the response so the frontend can see it
      return res.status(502).json({ error: 'PDAX Sweep Failed: ' + pdaxError.message });
    }

    res.json({ status: 'success', txHash, pdaxTxId, amountPHP });
  } catch (err: any) {
    await logEvent('ERROR', 'Oracle failure', { error: err.message });
    res.status(500).json({ error: 'Failed to trigger parametric contract' });
  }
});
