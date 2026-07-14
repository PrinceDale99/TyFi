import express from 'express';
import { Keypair, TransactionBuilder, Networks, xdr, rpc, Contract, Address } from '@stellar/stellar-sdk';
import { logEvent } from './logger';
import { supabase } from './supabase';
import admin from 'firebase-admin';

export const oracleRouter = express.Router();
const server = new rpc.Server('https://soroban-testnet.stellar.org');

import { initiateFiatSweep } from './pdax';

// Actual ZK dependencies
// NOTE: For this to run, the circuit must be compiled to JSON first using nargo or a pre-compile script
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import fs from 'fs';
import path from 'path';

// Helper to safely get Firestore
function getDb(): FirebaseFirestore.Firestore | null {
  try {
    return admin.apps.length ? admin.firestore() : null;
  } catch {
    return null;
  }
}

// ==========================================
// GET /oracle/api/v1/latest
// Frontend polls this to get the latest oracle data
// ==========================================
oracleRouter.get('/api/v1/latest', async (req, res) => {
  const db = getDb();

  if (!db) {
    // If Firestore not available, return a "no data" response
    return res.status(503).json({
      error: 'Oracle data store not available',
      data: null
    });
  }

  try {
    const docRef = db.collection('oracle_state').doc('latest');
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'No oracle data yet. The scraper pushes every 15 minutes.',
        data: null
      });
    }

    const data = doc.data();
    await logEvent('INFO', 'Frontend fetched latest oracle state', {});
    res.json({ success: true, data });
  } catch (error: any) {
    await logEvent('ERROR', 'Failed to fetch oracle state', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch oracle data' });
  }
});

// ==========================================
// POST /oracle/api/v1/scraper-update
// The Oracle Scraper pushes data to this endpoint every 15 minutes
// ==========================================
oracleRouter.post('/api/v1/scraper-update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.ORACLE_API_KEY || 'development_secret_key';

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    await logEvent('WARNING', 'Unauthorized scraper update attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      averageWindSpeed,
      maxWindSpeed,
      averageRainfall,
      maxRainfall,
      isTyphoonActive,
      timestamp
    } = req.body;

    await logEvent('INFO', 'Received validated scraper data', {
      averageWindSpeed,
      maxWindSpeed,
      isTyphoonActive,
      timestamp
    });

    // Build state document to persist
    const oracleState = {
      averageWindSpeed: averageWindSpeed ?? 0,
      maxWindSpeed: maxWindSpeed ?? 0,
      averageRainfall: averageRainfall ?? 0,
      maxRainfall: maxRainfall ?? 0,
      isTyphoonActive: isTyphoonActive ?? false,
      scraperTimestamp: timestamp ?? new Date().toISOString(),
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Derived trigger status
      triggerThresholdMet: isTyphoonActive && (maxWindSpeed ?? 0) > 100
    };

    // Persist to Firestore so the frontend can poll it
    const db = getDb();
    if (db) {
      await db.collection('oracle_state').doc('latest').set(oracleState, { merge: true });
      // Also append to history
      await db.collection('oracle_history').add(oracleState);
      await logEvent('INFO', 'Oracle state persisted to Firestore', {});
    }

    // If a typhoon is active above threshold → trigger Soroban Contract & PDAX sweep
    if (isTyphoonActive && (maxWindSpeed ?? 0) > 100) {
      await logEvent('INFO', 'Wind threshold breached! Preparing Soroban payout pipeline...');

      const secretKey = process.env.TREASURY_SECRET_KEY;
      if (secretKey) {
        try {
          const keypair = Keypair.fromSecret(secretKey);
          await logEvent('INFO', 'Soroban keypair loaded. In production this signs the weather report TX.', {
            publicKey: keypair.publicKey()
          });
          // submitWeatherReportOnChain() would be called here in a full on-chain integration
        } catch (stellarErr: any) {
          await logEvent('ERROR', 'Stellar keypair load error', { error: stellarErr.message });
        }
      }

      // PRODUCTION AUTO-COLLECT LOGIC:
      // Fetch all users who have opted into Auto Collect
      try {
        await logEvent('INFO', 'Scanning Supabase for Auto Collect subscribers...');
        const { data: users, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('is_auto_collect_enabled', true);

        if (error) {
          await logEvent('ERROR', 'Failed to fetch Auto Collect subscribers', { error: error.message });
        } else if (users && users.length > 0) {
          await logEvent('INFO', `Found ${users.length} users with Auto Collect enabled. Initiating sweeps...`);
          
          for (const user of users) {
            try {
              // Format the payment prefs for the PDAX sweep
              const prefs = {
                method: user.payment_method || 'fiat',
                provider: user.fiat_provider || 'gcash',
                accountNumber: user.account_number || '09000000000',
                accountName: user.account_name || 'Typhoon Survivor',
                autoCollect: true
              };

              // Assume a standard payout of 15,000 PHP for parametric triggers
              const amountPHP = 15000;
              
              await logEvent('INFO', `Triggering Auto Collect Fiat Sweep for ${user.wallet_address}`, { amountPHP, provider: prefs.provider });
              
              const pdaxTxId = await initiateFiatSweep(amountPHP, prefs);
              
              await logEvent('INFO', `Auto Collect Sweep Success for ${user.wallet_address}`, { pdaxTxId });
            } catch (sweepErr: any) {
              await logEvent('ERROR', `Auto Collect Sweep Failed for ${user.wallet_address}`, { error: sweepErr.message });
            }
          }
        } else {
          await logEvent('INFO', 'No users currently opted into Auto Collect.');
        }
      } catch (err: any) {
        await logEvent('ERROR', 'Auto Collect execution failed', { error: err.message });
      }
    }

    res.json({
      success: true,
      message: 'Data ingested successfully',
      triggerThresholdMet: oracleState.triggerThresholdMet
    });
  } catch (error: any) {
    await logEvent('ERROR', 'Failed to ingest scraper data', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// POST /oracle/api/v1/weather-trigger
// Manual weather trigger from frontend sandbox
// ==========================================
oracleRouter.post('/api/v1/weather-trigger', async (req, res) => {
  try {
    const { lat, lon, severity, targetAddress, paymentPrefs, network = 'testnet' } = req.body;
    await logEvent('INFO', `Weather trigger received on ${network}`, { lat, lon, severity, network });

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
        await logEvent('WARNING', 'Compiled circuit not found, falling back to mock proof.');
        await new Promise(resolve => setTimeout(resolve, 1200));
        mockZkProof = Buffer.from("NOIR_ZK_PROOF_" + Math.random().toString(36)).toString('hex');
      }
    } catch (zkErr: any) {
      await logEvent('ERROR', 'ZK Proof Generation failed', { error: zkErr.message });
      throw new Error("ZK Proof generation failed");
    }

    // Simulate Soroban contract execution time with ZK Verifier
    await new Promise(resolve => setTimeout(resolve, 800));

    const amountPHP = req.body.amountPHP || 15000;
    
    let pdaxTxId = "PENDING";
    try {
      await logEvent('INFO', 'Initiating PDAX Fiat Sweep', { amountPHP, paymentPrefs });
      pdaxTxId = await initiateFiatSweep(amountPHP, paymentPrefs);
      await logEvent('INFO', 'PDAX Fiat Sweep Success', { pdaxTxId });
    } catch (pdaxError: any) {
      await logEvent('ERROR', 'PDAX Fiat Sweep Failed', { error: pdaxError.message });
      return res.status(502).json({ error: 'PDAX Sweep Failed: ' + pdaxError.message });
    }

    res.json({ status: 'success', txHash, pdaxTxId, amountPHP, zkProof: mockZkProof });
  } catch (err: any) {
    await logEvent('ERROR', 'Oracle failure', { error: err.message });
    res.status(500).json({ error: 'Failed to trigger parametric contract' });
  }
});
