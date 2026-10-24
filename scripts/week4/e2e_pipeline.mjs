// Week 4 end-to-end pipeline on Stellar testnet:
//   seedless passkey wallet -> co-op DAO vote -> DAO->vault cross-contract
//   update -> Groth16 weather proof verified by the vault -> payout.
//
// Passkey-signed steps run the app's own transaction code in Chrome against
// the DevTools virtual authenticator, so the WebAuthn -> Passkey Kit ->
// relayer -> __check_auth path is exactly the one real users take.
//
//   APP_URL=http://localhost:5173 BACKEND_URL=http://localhost:3001 \
//     node scripts/week4/e2e_pipeline.mjs <stage|settle|finalize|payout|status>
//
//   stage     create + fund the wallet, verify it as a farmer, deposit LP,
//             subscribe a policy, open the proposal and cast the co-op votes
//   settle    after the voting deadline: execute_proposal (starts the timelock)
//   grant-executor  DAO admin gives the passkey wallet the Executor role, so
//             the farmer (not an operator key) applies the decision
//   finalize  after the timelock: finalize_proposal -> vault update_premium_rate
//   payout    oracle proves the storm on-chain, the farmer claims
//
// Every step is written to contracts/deployments/week4-e2e-testnet.json.
// The wallet's virtual-authenticator credential is kept in
// scripts/week4/.state/ (gitignored) so later phases sign as the same wallet.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { DAO, ID, TxLog, VAULT, XLM_SAC, addressOf, adminSigs, invoke, root, view } from './lib.mjs';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const STATE_FILE = path.join(root, 'scripts', 'week4', '.state', 'e2e-wallet.json');
const LOG_FILE = path.join(root, 'contracts', 'deployments', 'week4-e2e-testnet.json');

// Scenario. Symbols must match the frontend's sanitizeSymbol output.
const REGION = 'Eastern_Visayas';
const FARM_ID = 'TYFI_COOP_FARM_01';
const SEASON = 'Wet Season 2026';
const TYPHOON = 'ODETTE_2026';
const PREMIUM_STROOPS = 200_000_000n; // 20 XLM; the vault covers 10x
const FUND_XLM = 3_000;
const LP_XLM = 1_500;
const PROPOSAL = { multiplier: 125, votingLedgers: 180 }; // ~15 min voting window
const WIND_KMH = 172; // private reading; only the 150 km/h band is published
const DAMAGE_PCT = 85;

const log = new TxLog(LOG_FILE, {
  network: 'testnet',
  vault: VAULT,
  dao: DAO,
  scenario: { region: REGION, farmId: FARM_ID, season: SEASON, typhoon: TYPHOON, premiumMultiplier: PROPOSAL.multiplier },
});
const loadState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const saveState = (s) => {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
};

// ---------------------------------------------------------------------------
// Browser: the real app, signing with a virtual authenticator
// ---------------------------------------------------------------------------

async function loadPuppeteer() {
  try {
    return (await import('puppeteer')).default;
  } catch {
    return createRequire(execSync('npm root -g').toString().trim() + '/')('puppeteer');
  }
}

async function openApp(state) {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error(`  [page error] ${err.message}`));
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  if (state.credential) {
    await cdp.send('WebAuthn.addCredential', { authenticatorId, credential: state.credential });
  }
  await page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
  if (state.session) {
    await page.evaluate((s) => localStorage.setItem('tyfi_passkey_session', s), state.session);
  }
  return { browser, page, cdp, authenticatorId };
}

/** Calls an exported function of frontend/src/lib/stellar.ts inside the page. */
const inApp = (page, fn, ...args) =>
  page.evaluate(
    async (fn, args) => {
      const m = await import('/src/lib/stellar.ts');
      return await m[fn](...args);
    },
    fn,
    args,
  );

async function createWallet(page, cdp, authenticatorId) {
  await page.type('input[placeholder^="Wallet nickname"]', 'TyFi co-op farmer');
  const button = await page.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Create wallet with Face ID')), { timeout: 120_000 });
  await button.click();
  await page.waitForFunction(() => document.body.innerText.includes('View wallet on Stellar Expert') || document.querySelector('[role=alert]'), { timeout: 180_000 });
  const alert = await page.$eval('[role=alert]', (e) => e.textContent).catch(() => null);
  if (alert) throw new Error(`Wallet creation failed: ${alert}`);

  const session = await page.evaluate(() => localStorage.getItem('tyfi_passkey_session'));
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  const parsed = JSON.parse(session);
  return { wallet: parsed.walletAddress, createdTxHash: parsed.createdTxHash ?? null, session, credential: credentials[0] };
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function stage() {
  const state = loadState();
  const { browser, page, cdp, authenticatorId } = await openApp(state);
  try {
    // 1. Seedless wallet, created by the factory from a passkey.
    if (!state.wallet) {
      const created = await createWallet(page, cdp, authenticatorId);
      Object.assign(state, created);
      saveState(state);
      log.data.wallet = state.wallet;
      log.record('passkey_wallet_created', { hash: created.createdTxHash, actor: 'passkey (virtual authenticator)', wallet: state.wallet });
    }
    const wallet = state.wallet;

    // 2. Fund it from the co-op treasury account.
    if (!log.has('fund_wallet')) {
      const { hash } = invoke(XLM_SAC, ID.funder, 'transfer', ['--from', addressOf(ID.funder), '--to', wallet, '--amount', String(BigInt(FUND_XLM) * 10_000_000n)]);
      log.record('fund_wallet', { hash, actor: `co-op treasury (${ID.funder})`, amountXlm: FUND_XLM });
    }

    // 3. Co-op admin verifies the farmer (vault admin multisig).
    if (!log.has('verify_farmer')) {
      const { hash } = invoke(VAULT, ID.deployer, 'verify_farmer', ['--signatures', adminSigs('verify_farmer'), '--farmer', wallet, '--is_verified', 'true']);
      log.record('verify_farmer', { hash, actor: 'vault admin multisig' });
    }

    // 4. LP deposit -> voting power. Signed with the passkey.
    if (!log.has('passkey_deposit_lp')) {
      const hash = await inApp(page, 'contributeLiquidityOnChain', wallet, LP_XLM, 'lp', 'deposit', 'testnet');
      log.record('passkey_deposit_lp', { hash, actor: 'passkey wallet', amountXlm: LP_XLM, lpShares: view(VAULT, 'get_lp_shares', ['--lp', wallet]) });
    }

    // 5. Insure the farm. Signed with the passkey.
    if (!log.has('passkey_subscribe_policy')) {
      const hash = await inApp(page, 'registerPolicyOnChain', wallet, FARM_ID, REGION, Number(PREMIUM_STROOPS), SEASON, 'testnet');
      log.record('passkey_subscribe_policy', { hash, actor: 'passkey wallet', farmId: FARM_ID, region: REGION, premiumStroops: String(PREMIUM_STROOPS) });
    }

    // 6. Co-op proposal: raise the region's premium multiplier.
    if (!log.has('create_proposal')) {
      const before = view(VAULT, 'get_premium_rate', ['--region', REGION]);
      const { hash, result } = invoke(DAO, ID.funder, 'create_proposal', [
        '--creator', addressOf(ID.funder),
        '--description', `Raise the ${REGION} premium multiplier to ${PROPOSAL.multiplier} after the 2026 typhoon season`,
        '--action_type', 'UpdatePremiumRate',
        '--param_value', String(PROPOSAL.multiplier),
        '--param_region', REGION,
        '--param_oracle', addressOf(ID.funder),
        '--param_oracle_active', '0',
        '--duration_ledgers', String(PROPOSAL.votingLedgers),
      ]);
      const proposalId = Number(result.replace(/"/g, ''));
      log.data.proposalId = proposalId;
      log.record('create_proposal', { hash, actor: `co-op member (${ID.funder})`, proposalId, premiumRateBefore: Number(before.replace(/"/g, '')) });
    }
    const proposalId = log.data.proposalId;

    // 7. Votes: the passkey wallet, then the other co-op LPs.
    if (!log.has('passkey_vote')) {
      const hash = await inApp(page, 'voteOnDaoProposal', proposalId, true, 'testnet', wallet);
      log.record('passkey_vote', { hash, actor: 'passkey wallet', proposalId, support: true });
    }
    for (const voter of [ID.funder, ID.deployer]) {
      if (log.has(`vote_${voter}`)) continue;
      // On a fresh deployment these accounts may hold no LP shares (vote would fail with NoVotingPower).
      if (view(VAULT, 'get_lp_shares', ['--lp', addressOf(voter)]).replace(/"/g, '') === '0') continue;
      const { hash } = invoke(DAO, voter, 'vote', ['--voter', addressOf(voter), '--proposal_id', String(proposalId), '--support', 'true']);
      log.record(`vote_${voter}`, { hash, actor: `co-op LP (${voter})`, proposalId, support: true });
    }
    status();
  } finally {
    await browser.close();
  }
}

function proposal() {
  return JSON.parse(view(DAO, 'get_proposal', ['--id', String(log.data.proposalId)]));
}

function status() {
  const p = proposal();
  const ledger = JSON.parse(spawnSync('curl', ['-s', 'https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1'], { encoding: 'utf8' }).stdout)._embedded.records[0].sequence;
  const summary = JSON.parse(view(DAO, 'get_vote_summary', ['--proposal_id', String(log.data.proposalId)]));
  console.log(`\nProposal ${log.data.proposalId}: ${view(DAO, 'get_proposal_status', ['--proposal_id', String(log.data.proposalId)])}`);
  console.log(`  votes for/against/quorum-snapshot: ${summary.join(' / ')}`);
  console.log(`  ledger now ${ledger}; voting ends ${p.deadline} (~${Math.max(0, p.deadline - ledger) * 5}s); timelock ends ${p.timelock_until} (~${(Math.max(0, p.timelock_until - ledger) * 5 / 3600).toFixed(1)}h)`);
}

function settle() {
  const { hash, result } = invoke(DAO, ID.deployer, 'execute_proposal', ['--proposal_id', String(log.data.proposalId)]);
  log.record('execute_proposal', { hash, actor: 'anyone (deployer)', status: result });
}

/** The co-op (DAO admin) designates the farmer's passkey wallet as an executor. */
function grantExecutor() {
  const { wallet } = loadState();
  if (log.has('grant_executor_role')) return;
  const { hash } = invoke(DAO, ID.deployer, 'grant_role', ['--caller', addressOf(ID.deployer), '--target', wallet, '--role', 'Executor']);
  log.record('grant_executor_role', { hash, actor: 'DAO admin', target: wallet, role: 'Executor' });
}

async function finalize() {
  const state = loadState();
  const before = Number(view(VAULT, 'get_premium_rate', ['--region', REGION]).replace(/"/g, ''));
  const role = view(DAO, 'get_role', ['--addr', state.wallet]);
  let hash, actor;
  if (/Executor|Admin/.test(role)) {
    // The farmer's passkey wallet applies the co-op's decision.
    const { browser, page } = await openApp(state);
    try {
      hash = await inApp(page, 'finalizeDaoProposal', log.data.proposalId, 'testnet', state.wallet);
      actor = 'passkey wallet (DAO executor)';
    } finally {
      await browser.close();
    }
  } else {
    hash = invoke(DAO, ID.deployer, 'finalize_proposal', ['--caller', addressOf(ID.deployer), '--proposal_id', String(log.data.proposalId)]).hash;
    actor = `DAO executor (${ID.deployer})`;
  }
  const after = Number(view(VAULT, 'get_premium_rate', ['--region', REGION]).replace(/"/g, ''));
  log.record('finalize_proposal_cross_contract', { hash, actor, premiumRateBefore: before, premiumRateAfter: after });
}

async function payout() {
  const state = loadState();
  if (!log.has('zk_weather_report')) {
    const res = await fetch(`${BACKEND_URL}/oracle/api/v1/weather-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typhoonId: TYPHOON, region: REGION, windSpeed: WIND_KMH, damagePercentage: DAMAGE_PCT, network: 'testnet' }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Oracle: ${JSON.stringify(body)}`);
    log.record('zk_weather_report', {
      hash: body.txHash,
      actor: 'ZK oracle (tyfi_zk_oracle)',
      windFloor: body.windFloor,
      damagePercentage: body.damagePercentage,
      provingMs: body.zk.provingMs,
      cpuInstructions: body.zk.cpuInstructions,
      publicSignals: body.zk.publicSignals,
    });
  }
  if (!log.has('passkey_claim_payout')) {
    const { browser, page } = await openApp(state);
    try {
      const before = view(XLM_SAC, 'balance', ['--id', state.wallet]);
      const hash = await inApp(page, 'claimPayoutOnChain', state.wallet, FARM_ID, SEASON, 'testnet', TYPHOON);
      const after = view(XLM_SAC, 'balance', ['--id', state.wallet]);
      log.record('passkey_claim_payout', { hash, actor: 'passkey wallet', balanceBeforeStroops: before.replace(/"/g, ''), balanceAfterStroops: after.replace(/"/g, '') });
    } finally {
      await browser.close();
    }
  }
}

const phases = { stage, settle, 'grant-executor': grantExecutor, finalize, payout, status };
const phase = process.argv[2];
if (!phases[phase]) {
  console.error(`usage: node scripts/week4/e2e_pipeline.mjs <${Object.keys(phases).join('|')}>`);
  process.exit(1);
}
Promise.resolve(phases[phase]()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
