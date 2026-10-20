import express from 'express';
import { Keypair, TransactionBuilder, Networks, xdr, rpc, Contract, Address } from '@stellar/stellar-sdk';
import { logEvent } from './logger';
import { supabase } from './supabase';
import admin from 'firebase-admin';

export const oracleRouter = express.Router();
const server = new rpc.Server('https://soroban-testnet.stellar.org');

import { safeInitiatePayout } from './payoutService';
import { sendSms } from './smsHandler';

import { NETWORK_CONFIGS } from './config';
import { loadOracleZkKey, proveWeatherReading } from './zk/prover';
import { submitZkReport } from './zk/submit';
import { parseWeatherTrigger } from './zk/request';

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
  const expectedKey = process.env.ORACLE_API_KEY;
  if (!expectedKey) {
    await logEvent('ERROR', 'ORACLE_API_KEY is not set — rejecting all scraper updates for safety');
    return res.status(503).json({ error: 'Oracle service not configured' });
  }

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

      // PROACTIVE SMS ALERTS
      const db = getDb();
      if (db) {
        try {
          const farmersSnapshot = await db.collection('farmers').get();
          for (const doc of farmersSnapshot.docs) {
            const farmer = doc.data();
            if (farmer.phoneNumber) {
              const dynamicPayout = farmer.insuredValue || 15000;
              const msg = `🚨 TyFi Alert: A severe typhoon has been detected in your registered region. Your estimated farm damage compensation is PHP ${dynamicPayout}. \n\nType CLAIM to begin assessment, or type AUTO CLAIM for instant payout. Stay safe!`;
              await sendSms(farmer.phoneNumber, msg).catch(e => console.error("Proactive SMS failed", e));
            }
          }
        } catch (e) {
          console.error("Failed to query farmers for proactive SMS", e);
        }
      }

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

              const amountPHP = user.insured_value || 15000;
              
              await logEvent('INFO', `Triggering Auto Collect payout for ${user.wallet_address}`, { amountPHP, provider: prefs.provider });
              
              const result = await safeInitiatePayout(amountPHP, prefs, {
                phoneNumber: user.phone_number,
                walletAddress: user.wallet_address,
                source: 'AUTO_COLLECT_ORACLE'
              });
              
              await logEvent('INFO', `Auto Collect payout queued/sent for ${user.wallet_address}`, { txId: result.txId, mode: result.mode });
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
// Testnet sandbox: the oracle signs a wind reading, proves in Groth16 that it
// meets a payout band, and submits the proof to the vault's on-chain verifier.
// ==========================================
oracleRouter.post('/api/v1/weather-trigger', async (req, res) => {
  const { paymentPrefs, network = 'testnet' } = req.body;
  const parsed = parseWeatherTrigger(req.body);
  if ('error' in parsed) {
    return res.status(400).json({ error: parsed.error });
  }
  if (network !== 'testnet') {
    return res.status(403).json({ error: 'The weather sandbox only runs on testnet' });
  }
  const oracleSecret = process.env.ORACLE_SECRET_KEY;
  if (!oracleSecret) {
    return res.status(503).json({ error: 'Oracle signing key is not configured' });
  }

  let txHash: string;
  let zk: { proof: string; publicSignals: string[]; provingMs: number; cpuInstructions?: number; ledger: number };
  try {
    await logEvent('INFO', 'Weather trigger received', { ...parsed, windSpeed: undefined, network });

    const key = await loadOracleZkKey();
    const proven = await proveWeatherReading(parsed, key);
    await logEvent('INFO', 'Groth16 weather proof generated', { provingMs: proven.provingMs });

    const config = NETWORK_CONFIGS.testnet;
    const submitted = await submitZkReport(
      { typhoonId: parsed.typhoonId, region: parsed.region, windFloor: parsed.windFloor, damagePercentage: parsed.damagePercentage, proof: proven.proof },
      { rpcUrl: config.rpcUrl, passphrase: config.passphrase, vaultContractId: config.vaultContractId, oracle: Keypair.fromSecret(oracleSecret) },
    );
    txHash = submitted.txHash;
    zk = {
      proof: Buffer.concat([proven.proof.a, proven.proof.b, proven.proof.c]).toString('hex'),
      publicSignals: proven.publicSignals,
      provingMs: proven.provingMs,
      cpuInstructions: submitted.cpuInstructions,
      ledger: submitted.ledger,
    };
    await logEvent('INFO', 'ZK weather report verified on-chain', { txHash, ledger: submitted.ledger });
  } catch (err: any) {
    await logEvent('ERROR', 'ZK weather report failed', { error: err.message });
    const rejected = /Error\(Contract, #17\)/.test(err.message);
    return res.status(rejected ? 422 : 502).json({
      error: rejected ? 'The vault rejected the proof' : 'Could not prove or submit the weather report',
      detail: err.message,
    });
  }

  try {
    const amountPHP = req.body.amountPHP || 15000;
    
    // PROACTIVE SMS ALERTS for Sandbox Simulation
    const db = getDb();
    if (db) {
      try {
        const farmersSnapshot = await db.collection('farmers').get();
        for (const doc of farmersSnapshot.docs) {
          const farmer = doc.data();
          if (farmer.phoneNumber) {
            const dynamicPayout = farmer.insuredValue || 15000;
            const msg = `🚨 TyFi Alert: A severe typhoon has been detected in your registered region. Your estimated farm damage compensation is PHP ${dynamicPayout}. \n\nType CLAIM to begin assessment, or type AUTO CLAIM for instant payout. Stay safe!`;
            await sendSms(farmer.phoneNumber, msg).catch(e => console.error("Proactive SMS failed", e));
          }
        }
      } catch (e) {
        console.error("Failed to query farmers for proactive SMS", e);
      }
    }

    let pdaxTxId = "PENDING";
    try {
      await logEvent('INFO', 'Initiating payout via safeInitiatePayout', { amountPHP, paymentPrefs });
      const result = await safeInitiatePayout(amountPHP, paymentPrefs, {
        source: 'WEATHER_TRIGGER_SANDBOX'
      });
      pdaxTxId = result.txId;
      await logEvent('INFO', `Payout result: ${result.mode}`, { txId: result.txId });
    } catch (pdaxError: any) {
      await logEvent('ERROR', 'Payout failed unexpectedly', { error: pdaxError.message });
      pdaxTxId = 'FAILED';
    }

    res.json({
      status: 'success',
      txHash,
      pdaxTxId,
      amountPHP,
      typhoonId: parsed.typhoonId,
      region: parsed.region,
      windFloor: parsed.windFloor,
      damagePercentage: parsed.damagePercentage,
      zk,
    });
  } catch (err: any) {
    // The proof is already verified on-chain; only the off-chain follow-ups failed.
    await logEvent('ERROR', 'Post-verification follow-up failed', { error: err.message, txHash });
    res.json({ status: 'verified', txHash, zk, warning: 'Alerts or fiat payout failed after on-chain verification' });
  }
});
