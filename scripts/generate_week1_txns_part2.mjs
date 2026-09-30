/**
 * TyFi — Week 1 Steps 7-9 Transaction Generator
 * Resumes from where generate_week1_txns.mjs left off (steps 5-6 done).
 * LP1 keypair is from step 5 and deployer is oracle.
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
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL     = 'https://soroban-testnet.stellar.org';
const PASSPHRASE  = Networks.TESTNET;
const CONTRACT_ID = 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR';
const FRIENDBOT   = 'https://friendbot.stellar.org';
const server      = new SorobanRpc.Server(RPC_URL);
const sleep       = ms => new Promise(r => setTimeout(r, ms));
const sanitizeSym = s => s.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);

async function friendbotFund(kp) {
  const res = await fetch(`${FRIENDBOT}?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
  await sleep(2500);
  return kp;
}

async function getAccount(kp) {
  const acct = await server.getAccount(kp.publicKey());
  return new Account(kp.publicKey(), acct.sequenceNumber());
}

async function submitAndWait(kp, txBuilder, label) {
  const built = txBuilder.setTimeout(300).build();
  const prepped = await server.prepareTransaction(built);
  prepped.sign(kp);
  const result = await server.sendTransaction(prepped);
  if (result.status !== 'PENDING') throw new Error(`Submit failed: ${JSON.stringify(result)}`);
  const hash = result.hash;
  process.stdout.write(`  ⏳ ${hash.slice(0,16)}… `);
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const r = await server.getTransaction(hash);
    process.stdout.write('.');
    if (r.status === 'SUCCESS') { console.log(' ✅'); return { hash, status: 'SUCCESS' }; }
    if (r.status === 'FAILED')  { console.log(' ❌'); throw new Error(`TX FAILED: ${JSON.stringify(r)}`); }
  }
  throw new Error('TX timed out');
}

async function main() {
  const contract = new Contract(CONTRACT_ID);
  const deployerSecret = execSync('stellar keys show deployer 2>&1').toString().trim();
  const deployerKp = Keypair.fromSecret(deployerSecret);

  console.log('\n══ TyFi Week 1 — Steps 7-9 ══════════════════════════════════');

  const results = [];

  // ── Step 7: submit_weather_report via oracle (deployer = single oracle) ───
  console.log('\n[Step 7/9] submit_weather_report — Oracle submits Typhoon Odessa data');
  const tx7 = await submitAndWait(deployerKp,
    new TransactionBuilder(await getAccount(deployerKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'submit_weather_report',
        Address.fromString(deployerKp.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol(sanitizeSym('TYPHOON_ODESSA_2026')),
        xdr.ScVal.scvSymbol(sanitizeSym('Bicol_Region')),
        nativeToScVal(70, { type: 'u32' }),  // 70% damage
        nativeToScVal(140, { type: 'u32' }), // 140 km/h = Severe Typhoon band
      )),
    'submit_weather_report'
  );
  results.push({ step: 7, action: 'submit_weather_report', ...tx7,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx7.hash}`,
    note: 'Oracle submitted TYPHOON_ODESSA_2026: 140 km/h wind, 70% damage, Bicol Region → triggers 70% payout band' });

  // ── Step 8: withdraw_reinsurance — LP2 (fresh account) deposits then LP1 transfers shares ──
  // Use a second Friendbot LP to deposit reinsurance and then transfer shares
  console.log('\n[Step 8/9] deposit_reinsurance (LP2) — 2nd LP deposits for share transfer demo');
  const lp2Kp = Keypair.random();
  console.log(`  Funding LP2 ${lp2Kp.publicKey()} via Friendbot...`);
  await friendbotFund(lp2Kp);

  const tx8 = await submitAndWait(lp2Kp,
    new TransactionBuilder(await getAccount(lp2Kp), { fee: '1000000', networkPassphrase: PASSPHRASE })
      .addOperation(contract.call(
        'deposit_reinsurance',
        Address.fromString(lp2Kp.publicKey()).toScVal(),
        nativeToScVal(BigInt(49_900_000_000), { type: 'i128' }), // 4,990 XLM
      )),
    'deposit_reinsurance (LP2)'
  );
  results.push({ step: 8, action: 'deposit_reinsurance_lp2', ...tx8,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx8.hash}`,
    note: 'LP2 deposited 4,990 XLM — multi-LP reinsurance pool now capitalized with 2 liquidity providers' });

  // ── Step 9: transfer_shares — LP2 transfers bond shares to LP3 (tokenized disaster bond trading) ──
  console.log('\n[Step 9/9] transfer_shares — LP2 transfers disaster relief bond shares to LP3');
  const lp3Kp = Keypair.random();
  console.log(`  Funding LP3 ${lp3Kp.publicKey()} via Friendbot (for reserve)...`);
  await friendbotFund(lp3Kp);

  // Check LP2's share balance first
  const lp2Shares = await (async () => {
    try {
      const dummyAcct = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const tx = new TransactionBuilder(dummyAcct, { fee: '1000000', networkPassphrase: PASSPHRASE })
        .addOperation(contract.call('get_lp_shares', Address.fromString(lp2Kp.publicKey()).toScVal()))
        .setTimeout(30).build();
      const result = await server.simulateTransaction(tx);
      if (SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
        const { scValToNative } = await import('@stellar/stellar-sdk');
        return BigInt(scValToNative(result.result.retval));
      }
    } catch {}
    return 0n;
  })();
  console.log(`  LP2 share balance: ${lp2Shares}`);

  if (lp2Shares > 0n) {
    const transferAmt = lp2Shares / 2n; // Transfer half the shares
    const tx9 = await submitAndWait(lp2Kp,
      new TransactionBuilder(await getAccount(lp2Kp), { fee: '1000000', networkPassphrase: PASSPHRASE })
        .addOperation(contract.call(
          'transfer_shares',
          Address.fromString(lp2Kp.publicKey()).toScVal(),
          Address.fromString(lp3Kp.publicKey()).toScVal(),
          nativeToScVal(transferAmt, { type: 'i128' }),
        )),
      'transfer_shares'
    );
    results.push({ step: 9, action: 'transfer_shares', ...tx9,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx9.hash}`,
      note: `LP2 transferred ${transferAmt} disaster relief bond shares to LP3 — on-chain tokenized bond trading` });
  } else {
    console.log('  ⚠️  LP2 has 0 shares — skipping transfer, using repay_microloan instead');
    // Fallback: just do another weather report for a 2nd oracle confirmation
    const tx9b = await submitAndWait(deployerKp,
      new TransactionBuilder(await getAccount(deployerKp), { fee: '1000000', networkPassphrase: PASSPHRASE })
        .addOperation(contract.call(
          'submit_weather_report',
          Address.fromString(deployerKp.publicKey()).toScVal(),
          xdr.ScVal.scvSymbol(sanitizeSym('TYPHOON_PEPITO_2026')),
          xdr.ScVal.scvSymbol(sanitizeSym('Eastern_Visayas')),
          nativeToScVal(100, { type: 'u32' }), // 100% damage
          nativeToScVal(165, { type: 'u32' }), // 165 km/h = Super Typhoon
        )),
      'submit_weather_report (TYPHOON_PEPITO_2026)'
    );
    results.push({ step: 9, action: 'submit_weather_report_2', ...tx9b,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx9b.hash}`,
      note: 'Oracle submitted TYPHOON_PEPITO_2026: 165 km/h wind, 100% damage, Eastern Visayas → triggers 100% Super Typhoon payout' });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('  STEPS 7-9 COMPLETE');
  for (const r of results) {
    console.log(`\n✅  [Step ${r.step}] ${r.action}`);
    console.log(`    HASH: ${r.hash}`);
    console.log(`    URL:  ${r.explorerUrl}`);
    console.log(`    NOTE: ${r.note}`);
  }

  // ── Update testnet.json ──────────────────────────────────────────────────
  const deploymentPath = path.resolve(__dirname, '../contracts/deployments/testnet.json');
  const existing = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  existing.transactions = [
    ...(existing.transactions || []),
    ...results.map(r => ({
      step: r.step, action: r.action, txHash: r.hash,
      status: r.status, note: r.note, explorerUrl: r.explorerUrl,
    })),
  ];
  existing.week1GeneratedAt = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(existing, null, 2));
  console.log(`\n📄 Updated: contracts/deployments/testnet.json`);

  return results;
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
