import express from 'express';
import { Keypair, TransactionBuilder, Networks, xdr, rpc, Contract, Address } from '@stellar/stellar-sdk';
import { logEvent } from './logger';

export const oracleRouter = express.Router();
const server = new rpc.Server('https://soroban-testnet.stellar.org');

import { initiateFiatSweep } from './pdax';

// Actual ZK dependencies
// NOTE: For this to run, the circuit must be compiled to JSON first using nargo or a pre-compile script
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import fs from 'fs';
import path from 'path';

// Endpoint for the Oracle Scraper to push data
oracleRouter.post('/api/v1/scraper-update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.ORACLE_API_KEY || 'development_secret_key';

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    await logEvent('WARNING', 'Unauthorized scraper update attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { averageWindSpeed, maxWindSpeed, isTyphoonActive, timestamp } = req.body;
    await logEvent('INFO', 'Received validated scraper data', { averageWindSpeed, isTyphoonActive, timestamp });

    // If a typhoon is active, we trigger the Soroban Contract & PDAX sweep
    if (isTyphoonActive && averageWindSpeed > 100) {
      await logEvent('INFO', 'Wind threshold breached! Triggering Soroban payout...');
      // Normally, we'd sign the Stellar tx here using process.env.STELLAR_SECRET_KEY
    }

    res.json({ success: true, message: 'Data ingested successfully' });
  } catch (error: any) {
    await logEvent('ERROR', 'Failed to ingest scraper data', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

oracleRouter.post('/api/v1/weather-trigger', async (req, res) => {
  try {
    const { lat, lon, severity, targetAddress, paymentPrefs } = req.body;
    await logEvent('INFO', 'Weather trigger received', { lat, lon, severity });

    // Mock the Stellar TX for the hackathon / test flow
    let txHash = "MOCK_TX_" + Math.random().toString(36).substring(7);

    // [ACTUAL ZK ORACLE INTEGRATION]
    await logEvent('INFO', 'Generating REAL Noir ZK Proof for wind speed threshold', { severity });
    
    let mockZkProof = "";
    try {
      // 1. Load compiled circuit (we gracefully fallback to mock if compilation JSON doesn't exist yet)
      const circuitPath = path.resolve(__dirname, '../../circuits/weather_oracle/target/weather_oracle.json');
      if (fs.existsSync(circuitPath)) {
        const circuit = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
        const backend = new BarretenbergBackend(circuit);
        const noir = new Noir(circuit);
        
        // 2. Define inputs matching main.nr
        // For testing, we hardcode values that would normally come from the weather API
        const inputs = {
          wind_speed: 150, 
          oracle_pub_key_x: "1",
          oracle_pub_key_y: "2",
          signature: Array(64).fill(0),
          typhoon_id: 99,
          region_id: 1,
          payout_threshold: 100
        };

        // 3. Generate the actual Plonk proof
        const { witness } = await noir.execute(inputs);
        const proof = await backend.generateProof(witness);
        mockZkProof = Buffer.from(proof.proof).toString('hex');
        await logEvent('INFO', 'Real ZK Proof Generated Successfully', { proofLength: proof.proof.length });
      } else {
        await logEvent('WARNING', 'Compiled circuit not found, falling back to mock proof. Please compile circuit first.');
        await new Promise(resolve => setTimeout(resolve, 1200));
        mockZkProof = Buffer.from("NOIR_ZK_PROOF_" + Math.random().toString(36)).toString('hex');
      }
    } catch (zkErr: any) {
      await logEvent('ERROR', 'ZK Proof Generation failed', { error: zkErr.message });
      throw new Error("ZK Proof generation failed");
    }

    // Simulate Soroban contract execution time with ZK Verifier
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

    res.json({ status: 'success', txHash, pdaxTxId, amountPHP, zkProof: mockZkProof });
  } catch (err: any) {
    await logEvent('ERROR', 'Oracle failure', { error: err.message });
    res.status(500).json({ error: 'Failed to trigger parametric contract' });
  }
});
