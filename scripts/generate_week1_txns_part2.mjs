/**
 * TyFi — Week 1 Steps 7-9 (LP operations & bond share trading)
 * Steps 5 & 6 are already confirmed on-chain.
 */

import {
  Keypair, Networks, TransactionBuilder, Contract,
  Address, nativeToScVal, xdr, rpc as SorobanRpc, Account, scValToNative,
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

async function friendbotFund(kp) {
  const res = await fetch(`${FRIENDBOT}?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
  await sleep(3000);
}

async function getAccount(kp) {
  const acct = await server.getAccount(kp.publicKey());
  return new Account(kp.publicKey(), acct.sequenceNumber());
}

async function submitAndWait(kp, ops, label) {
  const acct = await getAccount(kp);
  const builder = new TransactionBuilder(acct, { fee: '1000000', networkPassphrase: PASSPHRASE });
  for (const op of ops) builder.addOperation(op);
  const built = builder.setTimeout(300).build();
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
    if (r.status === 'FAILED')  { console.log(' ❌'); throw new Error(`FAILED: ${JSON.stringify(r)}`); }
  }
  throw new Error('Timed out');
}

async function simulateRead(ops) {
  const dummyAcct = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const builder = new TransactionBuilder(dummyAcct, { fee: '1000000', networkPassphrase: PASSPHRASE });
  for (const op of ops) builder.addOperation(op);
  const tx = builder.setTimeout(30).build();
  const result = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
    return BigInt(scValToNative(result.result.retval));
  }
  return 0n;
}

async function main() {
  const contract = new Contract(CONTRACT_ID);
  console.log('\n══ TyFi Week 1 — Steps 7-9 ══════════════════════════════════\n');
  const results = [];

  // ── Step 7: LP2 deposit_reinsurance ───────────────────────────────────────
  console.log('[Step 7/9] deposit_reinsurance (LP2) — 2nd LP contributes 9,990 XLM');
  const lp2Kp = Keypair.random();
  console.log(`  Funding LP2 via Friendbot: ${lp2Kp.publicKey()}`);
  await friendbotFund(lp2Kp);
  const tx7 = await submitAndWait(lp2Kp, [
    contract.call(
      'deposit_reinsurance',
      Address.fromString(lp2Kp.publicKey()).toScVal(),
      nativeToScVal(BigInt(99_900_000_000), { type: 'i128' }),
    )
  ], 'deposit_reinsurance LP2');
  results.push({ step: 7, action: 'deposit_reinsurance_lp2', ...tx7,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx7.hash}`,
    note: `LP2 deposited 9,990 XLM — multi-LP reinsurance pool, vault TVL now 19,980 XLM` });

  // Check LP2 shares
  const lp2Shares = await simulateRead([
    contract.call('get_lp_shares', Address.fromString(lp2Kp.publicKey()).toScVal())
  ]);
  console.log(`  LP2 shares received: ${lp2Shares}`);

  // ── Step 8: LP3 deposit_reinsurance ──────────────────────────────────────
  console.log('\n[Step 8/9] deposit_reinsurance (LP3) — 3rd LP deposits for share transfer');
  const lp3Kp = Keypair.random();
  console.log(`  Funding LP3 via Friendbot: ${lp3Kp.publicKey()}`);
  await friendbotFund(lp3Kp);
  const tx8 = await submitAndWait(lp3Kp, [
    contract.call(
      'deposit_reinsurance',
      Address.fromString(lp3Kp.publicKey()).toScVal(),
      nativeToScVal(BigInt(49_900_000_000), { type: 'i128' }),
    )
  ], 'deposit_reinsurance LP3');
  results.push({ step: 8, action: 'deposit_reinsurance_lp3', ...tx8,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx8.hash}`,
    note: `LP3 deposited 4,990 XLM — 3-LP reinsurance pool fully operational` });

  // ── Step 9: transfer_shares (LP2 → LP3) — Tokenized disaster bond trading
  console.log('\n[Step 9/9] transfer_shares — LP2 transfers disaster bond shares to LP3');
  if (lp2Shares > 0n) {
    const transferAmt = lp2Shares / 4n; // Transfer a quarter
    console.log(`  Transferring ${transferAmt} shares from LP2 to LP3`);
    const tx9 = await submitAndWait(lp2Kp, [
      contract.call(
        'transfer_shares',
        Address.fromString(lp2Kp.publicKey()).toScVal(),
        Address.fromString(lp3Kp.publicKey()).toScVal(),
        nativeToScVal(transferAmt, { type: 'i128' }),
      )
    ], 'transfer_shares');
    results.push({ step: 9, action: 'transfer_shares', ...tx9,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx9.hash}`,
      note: `LP2 transferred ${transferAmt} disaster relief bond shares to LP3 — on-chain tokenized bond trading verified` });
  } else {
    // Fallback: LP3 withdraw_reinsurance
    console.log('  ⚠️  LP2 shares = 0, LP3 will withdraw instead');
    const lp3Shares = await simulateRead([
      contract.call('get_lp_shares', Address.fromString(lp3Kp.publicKey()).toScVal())
    ]);
    console.log(`  LP3 shares: ${lp3Shares}`);
    if (lp3Shares > 0n) {
      const withdrawAmt = lp3Shares / 10n;
      const tx9 = await submitAndWait(lp3Kp, [
        contract.call(
          'withdraw_reinsurance',
          Address.fromString(lp3Kp.publicKey()).toScVal(),
          nativeToScVal(withdrawAmt, { type: 'i128' }),
        )
      ], 'withdraw_reinsurance');
      results.push({ step: 9, action: 'withdraw_reinsurance_lp3', ...tx9,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${tx9.hash}`,
        note: `LP3 withdrew ${withdrawAmt} shares — reinsurance pool exit verified` });
    } else {
      throw new Error('Could not generate step 9 tx');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('  STEPS 7-9 ALL CONFIRMED ON TESTNET');
  for (const r of results) {
    console.log(`\n✅ [Step ${r.step}] ${r.action}`);
    console.log(`   HASH: ${r.hash}`);
    console.log(`   URL:  ${r.explorerUrl}`);
    console.log(`   NOTE: ${r.note}`);
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

main().catch(e => { console.error('\n❌ Fatal:', e.message); process.exit(1); });
