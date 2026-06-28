const { Keypair } = require('@stellar/stellar-sdk');
const { execSync } = require('child_process');

const TARGET = 'CCA7FZTWEJDESXHLOENHB6FV3DN5YZYZDNZWKKUPPP2NGNSJCZ7APEYH';
const TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'; // testnet native XLM

async function fundAndTransfer() {
  console.log("Starting funding script to reach 2,000,000 XLM...");
  let totalFunded = 0;
  let target = 2000000;
  
  while (totalFunded < target) {
    try {
      const pair = Keypair.random();
      const secret = pair.secret();
      const pubkey = pair.publicKey();
      
      // 1. Fund the new random account using Friendbot (gives 10,000 XLM)
      const res = await fetch(`https://friendbot.stellar.org?addr=${pubkey}`);
      if (!res.ok) {
        console.error(`Friendbot rate limit or error, retrying...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      
      // 2. Deposit 9,990 XLM to the contract via Soroban invocation
      const amountStr = "99900000000"; // 9,990 XLM in stroops
      
      const cmd = `stellar contract invoke --id ${TARGET} --network testnet --source ${secret} -- deposit_reinsurance --lp ${pubkey} --amount ${amountStr}`;
      
      execSync(cmd, { stdio: 'ignore' });
      
      totalFunded += 9990;
      console.log(`Successfully funded 9,990 XLM! Total: ${totalFunded} / 2,000,000 XLM`);
      
    } catch (e) {
      console.error(`Error during transfer loop:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log(`Finished! Total funded: ${totalFunded} XLM`);
}

fundAndTransfer();
