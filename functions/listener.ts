import { rpc, scValToNative } from '@stellar/stellar-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import { logEvent } from './logger';
import { NETWORK_CONFIGS } from './config';

dotenv.config();

const BACKEND_URL = `http://localhost:${process.env.PORT || 3001}`;

async function pollEvents(network: 'testnet' | 'mainnet') {
  const config = NETWORK_CONFIGS[network];
  const RPC_URL = config.rpcUrl;
  const CONTRACT_ID = config.vaultContractId;

  if (!CONTRACT_ID) {
    await logEvent('WARNING', `CONTRACT_ID not set for ${network}. Listener in standby mode.`);
    return;
  }

  const server = new rpc.Server(RPC_URL);

  await logEvent('INFO', `Starting Soroban event listener for ${network}...`, { 
    rpcUrl: RPC_URL, 
    contractId: CONTRACT_ID 
  });
  
  let startLedger: number | undefined;

  while (true) {
    try {
      if (startLedger === undefined) {
        const latestLedgerRes = await server.getLatestLedger();
        startLedger = latestLedgerRes.sequence;
        await logEvent('INFO', `Initialized blockchain listener starting at ledger ${startLedger} on ${network}`);
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
          const topics = event.topic.map(t => scValToNative(t as any));
          const value = scValToNative(event.value as any);

          await logEvent('NOTICE', `New Soroban event parsed at ledger ${event.ledger} on ${network}`, {
            topics,
            value
          });

          if (topics[0] === 'payout_claimed') {
            const farmer = topics[1];
            const farmId = topics[2];
            const [typhoonId, damage, amount] = value;
            
            await logEvent('INFO', `Detected on-chain payout for farmer ${farmer} on ${network}`, {
              farmer, farmId, typhoonId, damage, amount
            });
            
            await axios.post(`${BACKEND_URL}/api/notify-payout`, {
              address: farmer, amount: amount, region: 'Your Region', network
            }).catch(() => {});

            await axios.post(`${BACKEND_URL}/api/execute-offramp`, {
              address: farmer, amount: amount, network
            }).catch(err => {
              logEvent('ERROR', `PDAX Off-ramp trigger failed in listener on ${network}`, { 
                errorMessage: err.message, address: farmer
              });
            });
          }

          if (topics[0] === 'subscribe') {
            const farmer = topics[1];
            const [farmId, region, season, premium, paidAmount] = value;

            await logEvent('INFO', `Detected on-chain subscription for farmer ${farmer} on ${network}`, {
              farmer, farmId, txHash: event.id
            });

            await axios.post(`${BACKEND_URL}/api/generate-certificate`, {
              address: farmer, farmId, region, season, premium, txHash: event.id, network
            }).catch(err => {
              logEvent('ERROR', `Failed to trigger certificate generation on ${network}`, { 
                errorMessage: err.message, address: farmer
              });
            });
          }
        } catch (parseError: any) {
          await logEvent('ERROR', `Error parsing ledger event details on ${network}`, {
            errorMessage: parseError.message, rawEvent: event
          });
        }
      }

      if (response.latestLedger) {
        startLedger = response.latestLedger + 1;
      }

    } catch (error: any) {
      if (error.message && error.message.includes('startLedger must be within the ledger range')) {
        // This just means we are caught up and waiting for the next ledger to close.
        // We can safely ignore this error and wait for the next polling cycle.
      } else {
        await logEvent('ERROR', `Exception occurred during ledger polling cycle on ${network}`, {
          errorMessage: error.message
        });
      }
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

// Start listeners for both networks concurrently
pollEvents('testnet');
pollEvents('mainnet');
