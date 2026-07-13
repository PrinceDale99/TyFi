import * as StellarSdk from '@stellar/stellar-sdk';
import { db } from './db';
import { pdax } from './pdax';
import dotenv from 'dotenv';

dotenv.config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const BRIDGE_ESCROW_ACCOUNT = process.env.BRIDGE_ESCROW_ACCOUNT || 'GD_MOCK_ESCROW_ADDRESS';

export async function setupStellarListener() {
  console.log(`[Stellar] Connecting to Horizon to watch Escrow Account: ${BRIDGE_ESCROW_ACCOUNT}`);

  // Fetch the latest cursor (in production we would persist the cursor in the DB)
  server.payments()
    .forAccount(BRIDGE_ESCROW_ACCOUNT)
    .cursor('now')
    .stream({
      onmessage: async (payment) => {
        if (payment.type === 'payment' && payment.asset_type === 'native') {
          console.log(`[Stellar] Received payment of ${payment.amount} XLM! Tx Hash: ${payment.transaction_hash}`);
          await handleIncomingPayout(payment.transaction_hash, payment.from, parseFloat(payment.amount));
        }
      },
      onerror: (error) => {
        console.error('[Stellar] Streaming error:', error);
      }
    });
}

/**
 * Executes the full fiat sweep pipeline using idempotency locks.
 */
async function handleIncomingPayout(txHash: string, farmerId: string, amountXlm: number) {
  try {
    // 1. Lock transaction
    const isNew = await db.initializePayout(txHash, farmerId, amountXlm);
    if (!isNew) {
      console.log(`[Idempotency] Transaction ${txHash} already processed. Skipping.`);
      return;
    }
    await db.updateStatus(txHash, 'EXECUTING');

    // 2. Perform AML Velocity Check (Simulated for now)
    if (amountXlm > 10000) {
      console.warn(`[AML] Velocity limit exceeded for farmer ${farmerId}. Flagging for manual review.`);
      await db.updateStatus(txHash, 'MANUAL_REVIEW');
      return;
    }

    // 3. Sell on PDAX
    const { orderId, amountPhp } = await pdax.sellXLM(amountXlm);
    
    // 4. Sweep to Fiat
    const receipt = await pdax.sweepToFiat(amountPhp, farmerId);
    
    // 5. Complete
    await db.updateStatus(txHash, 'COMPLETED', {
      amount_php: amountPhp,
      pdax_order_id: orderId,
      instapay_receipt: receipt
    });
    
    console.log(`[Pipeline] Successfully processed and swept payout for ${farmerId}.`);
    
  } catch (error) {
    console.error(`[Pipeline] Error processing payout for ${txHash}:`, error);
    await db.updateStatus(txHash, 'FAILED');
  }
}
