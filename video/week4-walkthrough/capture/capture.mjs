// Records the walkthrough's screen footage from the real app on testnet.
//
//   APP_URL=http://localhost:5173 node video/week4-walkthrough/capture/capture.mjs <scene>
//
// Scenes: wallet | prep-dao | dao | finalize | zk | proofs
//
// Every on-chain action in the footage really happens: passkey steps are
// signed by a DevTools virtual authenticator (Chrome's stand-in for Face ID /
// fingerprint hardware), and each transaction is appended to
// contracts/deployments/week4-e2e-testnet.json. Headless Chrome draws no
// mouse pointer, so a cursor overlay is animated to each element before the
// real click. Footage lands in footage/ (gitignored), Stellar Expert
// screenshots in proofs/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { xdr } from '@stellar/stellar-sdk';
import { DAO, ID, TxLog, VAULT, addressOf, invoke, root, view } from '../../../scripts/week4/lib.mjs';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const HERE = path.join(root, 'video', 'week4-walkthrough');
const FOOTAGE = path.join(HERE, 'footage');
const PROOFS = path.join(HERE, 'proofs');
const STATE_FILE = path.join(root, 'scripts', 'week4', '.state', 'e2e-wallet.json');
const VIDEO_STATE = path.join(root, 'scripts', 'week4', '.state', 'video.json');
const log = new TxLog(path.join(root, 'contracts', 'deployments', 'week4-e2e-testnet.json'), {});
const SPONSOR = 'GDUF46FCQFNBHNWNENYSDSQPDP3PSL2S7CTKLJELGBOC6SJC62JPKMJ7'; // passkey relayer fee source
const VIEWPORT = { width: 1920, height: 1080 };
// The /passkey page is a narrow column. Screencasts record CSS pixels, so a
// smaller viewport would just be upscaled; instead zoom the page 1.5x inside a
// 1080p viewport so it fills the frame at native resolution.
const PASSKEY_ZOOM = 1.5;
const zoomPage = (page, zoom) => page.evaluate((z) => { document.documentElement.style.zoom = String(z); window.__zoom = z; }, zoom);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d = {}) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
fs.mkdirSync(FOOTAGE, { recursive: true });
fs.mkdirSync(PROOFS, { recursive: true });

const puppeteer = (() => {
  try {
    return createRequire(import.meta.url)('puppeteer');
  } catch {
    return createRequire(execSync('npm root -g').toString().trim() + '/')('puppeteer');
  }
})();

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

async function launch(credential) {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: VIEWPORT, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error(`  [page error] ${err.message}`));
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  if (credential) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  return { browser, page, cdp, authenticatorId };
}

const CURSOR_JS = `(() => {
  if (document.getElementById('__cursor')) return;
  const c = document.createElement('div');
  c.id = '__cursor';
  c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#fff" stroke="#0b1020" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: '50vw', top: '60vh', zIndex: 2147483647, pointerEvents: 'none',
    transition: 'left 0.7s cubic-bezier(.3,.8,.3,1), top 0.7s cubic-bezier(.3,.8,.3,1)', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' });
  document.body.appendChild(c);
  const r = document.createElement('div');
  r.id = '__ripple';
  Object.assign(r.style, { position: 'fixed', width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #38bdf8',
    zIndex: 2147483646, pointerEvents: 'none', opacity: 0, transform: 'translate(-50%,-50%) scale(.4)', transition: 'all .45s ease-out' });
  document.body.appendChild(r);
})()`;

async function cursorTo(page, handle) {
  await page.evaluate(CURSOR_JS);
  await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await sleep(600);
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // The overlay lives inside the (possibly zoomed) document, so undo the zoom.
  await page.evaluate(({ x, y }) => {
    const z = window.__zoom || 1;
    Object.assign(document.getElementById('__cursor').style, { left: `${(x - 6) / z}px`, top: `${(y - 4) / z}px` });
  }, { x, y });
  await sleep(850);
  return { x, y };
}

async function click(page, handle) {
  const { x, y } = await cursorTo(page, handle);
  await page.evaluate(({ x, y }) => {
    const r = document.getElementById('__ripple');
    const z = window.__zoom || 1;
    Object.assign(r.style, { transition: 'none', left: `${x / z}px`, top: `${y / z}px`, opacity: 1, transform: 'translate(-50%,-50%) scale(.4)' });
    requestAnimationFrame(() => Object.assign(r.style, { transition: 'all .45s ease-out', opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }));
  }, { x, y });
  await page.mouse.click(x, y);
}

const byText = (page, selector, text, timeout = 60_000) =>
  page.waitForFunction((sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t) && e.offsetParent !== null), { timeout }, selector, text);

const waitText = (page, text, timeout = 180_000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

async function record(page, name, fn) {
  const file = path.join(FOOTAGE, `${name}.mp4`);
  const recorder = await page.screencast({ path: file, fps: 30, quality: 18 });
  try {
    await fn();
  } finally {
    await recorder.stop();
  }
  console.log(`\u{1F3AC} ${path.relative(root, file)}`);
}

/** Opens the app connected as the staged co-op wallet on the given tab. */
async function openAsCoopFarmer(tab) {
  const state = readJson(STATE_FILE);
  if (!state.wallet) throw new Error('Run scripts/week4/e2e_pipeline.mjs stage first');
  const ctx = await launch(state.credential);
  await ctx.page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
  // The app's local profile for this wallet. The farm mirrors the policy the
  // pipeline subscribed on-chain (TYFI_COOP_FARM_01, Eastern Visayas, 200 XLM cover).
  await ctx.page.evaluate(({ W, session, tab }) => {
    const net = 'testnet';
    localStorage.setItem('tyfi_passkey_session', session);
    localStorage.setItem('typhoon_vault_walletId', 'passkey');
    localStorage.setItem('typhoon_vault_walletAddress', W);
    localStorage.setItem('typhoon_vault_isWalletConnected', 'true');
    localStorage.setItem('typhoon_vault_network', net);
    localStorage.setItem(`typhoon_vault_legal_consent_${net}_${W}`, 'true');
    localStorage.setItem(`typhoon_vault_role_${net}_${W}`, 'farmer');
    localStorage.setItem(`typhoon_vault_${net}_${W}`, JSON.stringify({
      hasAgreedToLegal: true, role: 'farmer', isVerified: true, claims: [],
      farms: [{ id: 'TYFI_COOP_FARM_01', farmerName: 'Co-op Farmer', rsbsaNumber: 'RSBSA-08-0001', farmName: 'Co-op Rice Farm 01', region: 'Eastern Visayas', season: 'Wet Season 2026', cropType: 'Rice', plantingDate: '2026-07-01', farmSize: 2, initialInvestment: 20, expectedHarvestValue: 200, totalCropValue: 200, latitude: 11.24, longitude: 125.0, isInsured: true }],
    }));
    localStorage.setItem('typhoon_vault_activeTab', tab);
  }, { W: state.wallet, session: state.session, tab });
  await ctx.page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' });
  await sleep(5000); // let live data (proposals, balances) load before recording
  return { ...ctx, state };
}

/** The relayer is the fee source of passkey transactions; find the one that called `fn`. */
function sponsorTxFor(fn, sinceIso) {
  const res = execSync(`curl -s "https://horizon-testnet.stellar.org/accounts/${SPONSOR}/operations?order=desc&limit=40"`).toString();
  for (const op of JSON.parse(res)._embedded.records) {
    if (op.created_at < sinceIso || op.type !== 'invoke_host_function') continue;
    const name = (op.parameters ?? []).map((p) => { try { return xdr.ScVal.fromXDR(p.value, 'base64').sym().toString(); } catch { return null; } }).find((s) => s === fn);
    if (name) return op.transaction_hash;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

async function wallet() {
  const { browser, page, cdp, authenticatorId } = await launch();
  try {
    await page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
    await zoomPage(page, PASSKEY_ZOOM);
    await record(page, '02-wallet', async () => {
      await sleep(1500);
      const input = await page.$('input[placeholder^="Wallet nickname"]');
      await click(page, input);
      await page.type('input[placeholder^="Wallet nickname"]', 'Co-op farmer, Leyte', { delay: 70 });
      await sleep(500);
      await click(page, await byText(page, 'button', 'Create wallet with Face ID'));
      await waitText(page, 'View wallet on Stellar Expert');
      await sleep(3500);
      await cursorTo(page, await byText(page, 'a', 'View wallet on Stellar Expert'));
      await sleep(2500);
    });
    const session = JSON.parse(await page.evaluate(() => localStorage.getItem('tyfi_passkey_session')));
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    const v = readJson(VIDEO_STATE);
    writeJson(VIDEO_STATE, { ...v, wallet: session.walletAddress, credential: credentials[0] });
    log.record('video_passkey_wallet_created', { hash: session.createdTxHash ?? null, actor: 'passkey (virtual authenticator)', wallet: session.walletAddress });
  } finally {
    await browser.close();
  }
}

/** Opens a fresh proposal for the farmer to vote on in the DAO scene. */
function prepDao() {
  const v = readJson(VIDEO_STATE);
  if (v.liveProposalId) return console.log(`proposal ${v.liveProposalId} already prepared`);
  const { hash, result } = invoke(DAO, ID.funder, 'create_proposal', [
    '--creator', addressOf(ID.funder),
    '--description', 'Raise the Central_Luzon premium multiplier to 110 for the 2027 season',
    '--action_type', 'UpdatePremiumRate', '--param_value', '110', '--param_region', 'Central_Luzon',
    '--param_oracle', addressOf(ID.funder), '--param_oracle_active', '0',
    '--duration_ledgers', '1440', // ~2 h, long enough to record
  ]);
  const id = Number(result.replace(/"/g, ''));
  writeJson(VIDEO_STATE, { ...v, liveProposalId: id });
  log.record('video_create_proposal', { hash, actor: `co-op member (${ID.funder})`, proposalId: id });
}

async function dao() {
  const { liveProposalId } = readJson(VIDEO_STATE);
  if (!liveProposalId) throw new Error('Run the prep-dao scene first');
  const { browser, page } = await openAsCoopFarmer('governance');
  try {
    const since = new Date().toISOString();
    await record(page, '04-dao', async () => {
      await sleep(2500);
      await cursorTo(page, await byText(page, 'p', 'Your Voting Power'));
      await sleep(2000);
      const card = await page.waitForFunction((id) => [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === `TIP-${id}`)?.closest('.p-6'), {}, liveProposalId);
      const voteFor = await card.evaluateHandle((c) => [...c.querySelectorAll('button')].find((b) => b.textContent.includes('Vote For')));
      await click(page, voteFor);
      await waitText(page, 'Vote confirmed on-chain');
      await sleep(4000);
      const tip6 = await page.waitForFunction(() => [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'TIP-6'));
      await cursorTo(page, tip6);
      await sleep(5000);
    });
    log.record('video_passkey_vote', { hash: sponsorTxFor('vote', since), actor: 'passkey wallet', proposalId: liveProposalId, support: true });
  } finally {
    await browser.close();
  }
}

async function finalize() {
  const { browser, page } = await openAsCoopFarmer('governance');
  try {
    const before = Number(view(VAULT, 'get_premium_rate', ['--region', 'Eastern_Visayas']).replace(/"/g, ''));
    const since = new Date().toISOString();
    await record(page, '05-finalize', async () => {
      await sleep(2000);
      const tip6 = await page.waitForFunction(() => [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'TIP-6')?.closest('.p-6'));
      await cursorTo(page, tip6);
      await sleep(1500);
      const button = await tip6.evaluateHandle((c) => [...c.querySelectorAll('button')].find((b) => b.textContent.includes('Finalize')));
      await click(page, button);
      await waitText(page, 'the DAO updated the vault on-chain');
      await sleep(5000);
    });
    const after = Number(view(VAULT, 'get_premium_rate', ['--region', 'Eastern_Visayas']).replace(/"/g, ''));
    log.record('finalize_proposal_cross_contract', { hash: sponsorTxFor('finalize_proposal', since), actor: 'passkey wallet (DAO executor)', premiumRateBefore: before, premiumRateAfter: after });
  } finally {
    await browser.close();
  }
}

async function zk() {
  const { browser, page } = await openAsCoopFarmer('zk');
  try {
    const before = view('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', 'balance', ['--id', readJson(STATE_FILE).wallet]).replace(/"/g, '');
    await record(page, '06-zk', async () => {
      await sleep(2000);
      await cursorTo(page, await byText(page, 'span', 'Observed wind (private)'));
      await sleep(2500);
      await click(page, await byText(page, 'button', 'Generate proof'));
      await waitText(page, 'Proof verified by the vault');
      await sleep(2500);
      await cursorTo(page, await byText(page, 'div', 'Public inputs (rebuilt by the contract)'));
      await sleep(5000);
      await click(page, await byText(page, 'button', 'Claim payout'));
      await waitText(page, 'Paid by the vault contract');
      await sleep(5000);
    });
    const links = await page.$$eval('a[href*="/tx/"]', (as) => as.map((a) => a.href.split('/tx/')[1]));
    const after = view('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', 'balance', ['--id', readJson(STATE_FILE).wallet]).replace(/"/g, '');
    const text = await page.evaluate(() => document.body.innerText);
    log.record('zk_weather_report', { hash: links[0] ?? null, actor: 'ZK oracle (tyfi_zk_oracle)', windFloor: 150, damagePercentage: 85, provingTime: text.match(/Proving time\s*([\d.]+ s)/)?.[1] });
    log.record('passkey_claim_payout', { hash: links[1] ?? null, actor: 'passkey wallet', balanceBeforeStroops: before, balanceAfterStroops: after });
  } finally {
    await browser.close();
  }
}

/** Full-page Stellar Expert captures of the key transactions, for proof inserts. */
async function proofs() {
  const steps = log.data.steps.filter((s) => s.txHash);
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1920, height: 1080 } });
  try {
    const page = await browser.newPage();
    for (const s of steps) {
      const out = path.join(PROOFS, `${s.step}.png`);
      if (fs.existsSync(out)) continue;
      await page.goto(`https://stellar.expert/explorer/testnet/tx/${s.txHash}`, { waitUntil: 'networkidle2', timeout: 90_000 });
      await sleep(3000);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`\u{1F4F8} ${path.relative(root, out)}`);
    }
  } finally {
    await browser.close();
  }
}

const scenes = { wallet, 'prep-dao': prepDao, dao, finalize, zk, proofs };
const scene = process.argv[2];
if (!scenes[scene]) {
  console.error(`usage: node video/week4-walkthrough/capture/capture.mjs <${Object.keys(scenes).join('|')}>`);
  process.exit(1);
}
Promise.resolve(scenes[scene]()).catch((e) => {
  console.error(e);
  process.exit(1);
});
