/**
 * TyFi — Week 1 Verifiable On-Chain Transaction Generator
 *
 * Uses Friendbot-funded throwaway keypairs to generate 5 real, verifiable
 * Soroban transactions against the deployed typhoon_resilience_vault.
 *
 * Contract: CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR
 * Network:  Stellar Testnet
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  xdr,
  rpc as SorobanRpc,
  Account,
} from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL    = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR';
const HORIZON    = 'https://horizon-testnet.stellar.org';
const FRIENDBOT  = 'https://friendbot.stellar.org';

const server = new SorobanRpc.Server(RPC_URL);
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const sanitizeSym = s => s.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);

// Fund an account via Friendbot and return its Keypair
async function friendbotFund(kp) {
  const res = await fetch(`${FRIENDBOT}?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.status} ${await res.text()}`);
  await sleep(2500); // Wait for ledger
  return kp;
}

// Sign & submit a transaction, wait for confirmation
async function submitAndWait(kp, txBuilder) {
  const built = txBuilder.setTimeout(300).build();
  const prepped = await server.prepareTransaction(built);
  prepped.sign(kp);
  const result = await server.sendTransaction(prepped);
  if (result.status !== 'PENDING') {
    throw new Error(`Submission failed: ${JSON.stringify(result)}`);
  }
  const hash = result.hash;
  process.stdout.write(`  ⏳ ${hash.slice(0,16)}… `);
  let tries = 0;
  while (tries < 30) {
    await sleep(2000);
    const r = await server.getTransaction(hash);
    process.stdout.write('.');
    if (r.status === 'SUCCESS') { console.log(' ✅'); return { hash, status: 'SUCCESS' }; }
    if (r.status === 'FAILED')  { console.log(' ❌'); throw new Error(`TX failed: ${JSON.stringify(r)}`); }
    tries++;
  }
  throw new Error('TX timed out');
}

async function getAccount(kp) {
  const acct = await server.getAccount(kp.publicKey());
  return new Account(kp.publicKey(), acct.sequenceNumber());
}

async function main() {
  const contract = new Contract(CONTRACT_ID);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   TyFi Week 1 — Verifiable Testnet Transaction Generator  ║');
  console.log(`║   Contract: ${CONTRACT_ID.slice(0,20)}…   ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = [];

  // ── Step 5: deposit_reinsurance ───────────────────────────────────────────
  console.log('[Step 5/9] deposit_reinsurance — LP deposits 9,990 XLM liquidity');
  const lpKp = Keypair.random();
  console.log(`  Funding LP account ${lpKp.publicKey()} via Friendbot...`);
  await friendbotFund(lpKp);

  const tx5 = await submitAndWait(lpKp,
    new TransactionBuilder(await getAccount(lpKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'deposit_reinsurance',
        Address.fromString(lpKp.publicKey()).toScVal(),
        nativeToScVal(BigInt(99_900_000_000), { type: 'i128' }), // 9,990 XLM
      ))
  );
  results.push({ step: 5, action: 'deposit_reinsurance', ...tx5,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx5.hash}`,
    note: `LP deposited 9,990 XLM into reinsurance pool — TVL funded` });

  // ── Step 6: deposit_subsidy ──────────────────────────────────────────────
  console.log('\n[Step 6/9] deposit_subsidy — NGO/Sponsor deposits 9,990 XLM premium subsidy');
  const sponsorKp = Keypair.random();
  console.log(`  Funding sponsor account ${sponsorKp.publicKey()} via Friendbot...`);
  await friendbotFund(sponsorKp);

  const tx6 = await submitAndWait(sponsorKp,
    new TransactionBuilder(await getAccount(sponsorKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'deposit_subsidy',
        Address.fromString(sponsorKp.publicKey()).toScVal(),
        nativeToScVal(BigInt(99_900_000_000), { type: 'i128' }), // 9,990 XLM
      ))
  );
  results.push({ step: 6, action: 'deposit_subsidy', ...tx6,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx6.hash}`,
    note: `NGO/Sponsor deposited 9,990 XLM premium subsidy — farmers receive 50% discount` });

  // ── Step 7: verify_farmer (admin verifies a test farmer) ─────────────────
  console.log('\n[Step 7/9] verify_farmer — Admin verifies farmer for policy registration');
  const farmerKp = Keypair.random();
  console.log(`  Funding farmer account ${farmerKp.publicKey()} via Friendbot...`);
  await friendbotFund(farmerKp);

  // Use deployer key (admin) to verify the farmer
  const { execSync } = await import('child_process');
  const deployerSecret = execSync('stellar keys show deployer 2>&1').toString().trim();
  const deployerKp = Keypair.fromSecret(deployerSecret);

  const tx7 = await submitAndWait(deployerKp,
    new TransactionBuilder(await getAccount(deployerKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'verify_farmer',
        Address.fromString(farmerKp.publicKey()).toScVal(),
      ))
  );
  results.push({ step: 7, action: 'verify_farmer', ...tx7,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx7.hash}`,
    note: `Admin verified farmer ${farmerKp.publicKey().slice(0,8)}… for RSBSA-gated policy registration` });

  // ── Step 8: subscribe — Farmer registers insurance policy ────────────────
  console.log('\n[Step 8/9] subscribe — Verified farmer registers typhoon policy');
  const tx8 = await submitAndWait(farmerKp,
    new TransactionBuilder(await getAccount(farmerKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'subscribe',
        Address.fromString(farmerKp.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol(sanitizeSym('FARM_BICOL_001')),
        xdr.ScVal.scvSymbol(sanitizeSym('Bicol_Region')),
        xdr.ScVal.scvSymbol(sanitizeSym('Wet_Season_2026')),
        nativeToScVal(BigInt(100_000_000), { type: 'i128' }), // 10 XLM premium
      ))
  );
  results.push({ step: 8, action: 'subscribe', ...tx8,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx8.hash}`,
    note: `Farmer registered FARM_BICOL_001 policy, Bicol Region, Wet Season 2026, 10 XLM premium` });

  // ── Step 9: testnet_claim_payout — Parametric payout disbursement ─────────
  console.log('\n[Step 9/9] testnet_claim_payout — Parametric typhoon payout disbursed to farmer');
  const tx9 = await submitAndWait(deployerKp,
    new TransactionBuilder(await getAccount(deployerKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'testnet_claim_payout',
        Address.fromString(farmerKp.publicKey()).toScVal(),
        nativeToScVal(BigInt(70_000_000), { type: 'i128' }), // 7 XLM = 70% band payout
      ))
  );
  results.push({ step: 9, action: 'testnet_claim_payout', ...tx9,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx9.hash}`,
    note: `Parametric payout of 7 XLM (70% band — Severe Typhoon) disbursed to farmer` });

  // ── Results summary ───────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('  WEEK 1 — ALL VERIFIABLE ON-CHAIN TRANSACTIONS');
  console.log('══════════════════════════════════════════════════════════════\n');
  for (const r of results) {
    console.log(`✅  [Step ${r.step}] ${r.action}`);
    console.log(`    HASH: ${r.hash}`);
    console.log(`    URL:  ${r.explorerUrl}`);
    console.log(`    NOTE: ${r.note}\n`);
  }

  // ── Update testnet.json ──────────────────────────────────────────────────
  const deploymentPath = path.resolve(__dirname, '../contracts/deployments/testnet.json');
  const existing = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  existing.transactions = [
    ...(existing.transactions || []),
    ...results.map(r => ({
      step: r.step,
      action: r.action,
      txHash: r.hash,
      status: r.status,
      note: r.note,
      explorerUrl: r.explorerUrl,
    })),
  ];
  existing.week1GeneratedAt = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(existing, null, 2));
  console.log(`📄 Updated: contracts/deployments/testnet.json\n`);

  // ── README block ─────────────────────────────────────────────────────────
  console.log('── README-READY MARKDOWN ──────────────────────────────────────\n');
  for (const r of results) {
    const short = `${r.hash.slice(0,8)}…${r.hash.slice(-8)}`;
    console.log(`- **\`${r.action}\`** — [\`${short}\`](${r.explorerUrl})  `);
    console.log(`  _${r.note}_`);
  }
  console.log('\n──────────────────────────────────────────────────────────────');

  // Return results for piping
  return results;
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  if (e.message.includes('HostError')) {
    console.error('\nDiagnostic: Contract error. Check if contract is initialized and caller has correct auth.');
  }
  process.exit(1);
});
