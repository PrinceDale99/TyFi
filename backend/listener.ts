import { rpc, xdr, scValToNative } from '@stellar/stellar-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import { logEvent } from './logger';

dotenv.config();

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-rpc.mainnet.stellar.org';
const CONTRACT_ID = process.env.CONTRACT_ID || '';
const BACKEND_URL = `http://localhost:${process.env.PORT || 3001}`;

const server = new rpc.Server(RPC_URL);

async function pollEvents() {
  await logEvent('INFO', 'Starting Soroban event listener...', { 
    rpcUrl: RPC_URL, 
    contractId: CONTRACT_ID 
  });
  
  let startLedger: number | undefined;

  while (true) {
    try {
      if (!CONTRACT_ID) {
        await logEvent('WARNING', 'CONTRACT_ID not set in .env. Listener in standby mode.');
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      // Initialize startLedger if not set
      if (startLedger === undefined) {
        const latestLedgerRes = await server.getLatestLedger();
        startLedger = latestLedgerRes.sequence;
        await logEvent('INFO', `Initialized blockchain listener starting at ledger ${startLedger}`);
      }

      const response = await server.getEvents({
        startLedger: startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
            topics: [
               ['*']
            ]
          }
        ],
        limit: 50
      } as any);

      for (const event of response.events) {
        try {
          // Parse event
          const topics = event.topic.map(t => scValToNative(t as any));
          const value = scValToNative(event.value as any);

          await logEvent('NOTICE', `New Soroban event parsed at ledger ${event.ledger}`, {
            topics,
            value
          });

          // In Soroban, topics are often symbol-based. 
          // If the first topic is "payout_claimed", handle it.
          if (topics[0] === 'payout_claimed') {
            const farmer = topics[1];
            const farmId = topics[2];
            const [typhoonId, damage, amount] = value;
            
            await logEvent('INFO', `Detected on-chain payout for farmer ${farmer}`, {
              farmer,
              farmId,
              typhoonId,
              damage,
              amount
            });
            
            // Call notification API
            await axios.post(`${BACKEND_URL}/api/notify-payout`, {
              address: farmer,
              amount: amount,
              region: 'Your Region'
            });
          }

          // Handle "subscribe" event for certificate generation
          if (topics[0] === 'subscribe') {
            const farmer = topics[1];
            const [farmId, region, season, premium, paidAmount] = value;

            await logEvent('INFO', `Detected on-chain subscription for farmer ${farmer}`, {
              farmer,
              farmId,
              region,
              season,
              premium,
              paidAmount,
              txHash: event.id
            });

            // Call certificate generation API
            await axios.post(`${BACKEND_URL}/api/generate-certificate`, {
              address: farmer,
              farmId,
              region,
              season,
              premium,
              txHash: event.id
            }).catch(err => {
              logEvent('ERROR', 'Failed to trigger certificate generation', { 
                errorMessage: err.message,
                address: farmer
              });
            });
          }
        } catch (parseError: any) {
          await logEvent('ERROR', 'Error parsing ledger event details', {
            errorMessage: parseError.message,
            rawEvent: event
          });
        }
      }

      // Update startLedger for next poll to avoid duplicates
      if (response.latestLedger) {
        startLedger = response.latestLedger + 1;
      }

    } catch (error: any) {
      await logEvent('ERROR', 'Exception occurred during ledger polling cycle', {
        errorMessage: error.message
      });
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

pollEvents();
