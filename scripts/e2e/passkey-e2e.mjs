/**
 * End-to-end test of seedless passkey accounts, driven through the real UI.
 *
 * Chrome's DevTools virtual authenticator stands in for the device's secure
 * enclave (CTAP2, internal transport, user verification = true), so the full
 * WebAuthn → Passkey Kit → relayer → factory → __check_auth path runs exactly
 * as it does with Face ID / Touch ID, and every transaction lands on testnet.
 *
 *   APP_URL=http://localhost:5173 node scripts/e2e/passkey-e2e.mjs [accounts=2]
 *   (requires `puppeteer`: npm i -g puppeteer)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Use a local puppeteer if present, otherwise the globally installed one.
let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  puppeteer = createRequire(execSync('npm root -g').toString().trim() + '/')('puppeteer');
}

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const ACCOUNTS = Number(process.argv[2] || 2);
const RECIPIENT = process.env.RECIPIENT || 'GDUF46FCQFNBHNWNENYSDSQPDP3PSL2S7CTKLJELGBOC6SJC62JPKMJ7';
const STEP_TIMEOUT = 120_000;

const clickByText = async (page, text) => {
  const handle = await page.waitForFunction(
    t => [...document.querySelectorAll('button')].find(b => b.textContent.includes(t)),
    { timeout: STEP_TIMEOUT },
    text,
  );
  await handle.click();
};

/** The connected wallet, read from its "View wallet on Stellar Expert" link. */
const walletAddressOf = page =>
  page.$$eval('a', links => links.find(a => a.textContent.includes('View wallet on Stellar Expert'))?.href.split('/contract/')[1]);

const txLinks = page =>
  page.$$eval('a[href*="/tx/"]', links => links.map(a => ({ label: a.querySelector('span')?.textContent?.trim(), hash: a.href.split('/tx/')[1] })));

async function runAccount(browser, index) {
  try {
    return await runAccountSteps(browser, index);
  } catch (err) {
    for (const ctx of browser.browserContexts()) {
      for (const p of await ctx.pages()) {
        const text = await p.evaluate(() => document.body.innerText).catch(() => '');
        console.error(`  [page state] ${text.replace(/\s+/g, ' ').slice(0, 800)}`);
        await p.screenshot({ path: `e2e-failure-${index}.png`, fullPage: true }).catch(() => {});
      }
    }
    throw err;
  }
}

async function runAccountSteps(browser, index) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', err => console.error(`  [page error] ${err.message}`));
  page.on('console', msg => msg.type() === 'error' && console.error(`  [console] ${msg.text()}`));

  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
  await page.type('input[placeholder^="Wallet nickname"]', `E2E reviewer account ${index}`);

  console.log(`\n[${index}] Creating seedless wallet…`);
  await clickByText(page, 'Create wallet with Face ID');
  await page.waitForFunction(() => document.body.innerText.includes('View wallet on Stellar Expert') || document.querySelector('[role=alert]'), { timeout: STEP_TIMEOUT });
  const alert = await page.$eval('[role=alert]', e => e.textContent).catch(() => null);
  if (alert) throw new Error(`Wallet creation failed in the UI: ${alert}`);
  const wallet = await walletAddressOf(page);
  console.log(`[${index}] Wallet ${wallet}`);

  // Wait until the welcome XLM shows up so the payment can succeed.
  const balance = () => page.$$eval('.text-2xl', els => parseFloat(els.map(e => e.textContent).find(t => /\d/.test(t)) ?? '0'));
  for (let attempt = 0; attempt < 20 && (await balance()) <= 0; attempt++) {
    await new Promise(r => setTimeout(r, 3000));
    await clickByText(page, 'XLM'); // balance refresh
  }
  console.log(`[${index}] Balance ${await balance()} XLM`);

  console.log(`[${index}] Sending 1 XLM, authorized by the passkey…`);
  await page.type('input[placeholder^="Recipient"]', RECIPIENT);
  await clickByText(page, 'Send');
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('passkey-signed payment'), { timeout: STEP_TIMEOUT });

  const links = await txLinks(page);
  const credentials = await cdp.send('WebAuthn.getCredentials', { authenticatorId });

  console.log(`[${index}] Signing out and back in with only the passkey…`);
  await clickByText(page, 'Disconnect');
  await clickByText(page, 'sign in');
  await page.waitForFunction(() => document.body.innerText.includes('View wallet on Stellar Expert'), { timeout: STEP_TIMEOUT });
  const signedInWallet = await walletAddressOf(page);

  await context.close();
  return {
    account: index,
    wallet,
    signInRecoveredSameWallet: signedInWallet === wallet,
    passkey: { credentialId: credentials.credentials[0]?.credentialId, userVerification: true, signCount: credentials.credentials[0]?.signCount },
    transactions: links.map(l => ({ ...l, url: `https://stellar.expert/explorer/testnet/tx/${l.hash}` })),
  };
}

const browser = await puppeteer.launch({ headless: true });
const results = [];
try {
  for (let i = 1; i <= ACCOUNTS; i++) results.push(await runAccount(browser, i));
} finally {
  await browser.close();
}
console.log('\n' + JSON.stringify(results, null, 2));
