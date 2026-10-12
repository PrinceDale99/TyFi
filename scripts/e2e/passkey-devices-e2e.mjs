/**
 * End-to-end test of passkey device management through the real UI:
 *
 *   Device A creates a seedless wallet, unlocks "Your devices" (biometric),
 *   checks that IPs are hidden until revealed, and creates a one-time code.
 *   Device B pastes the code and creates its own passkey; A approves on-chain.
 *   B is then signed in to the same wallet and sends a payment with ITS passkey.
 *   A removes B, and B's passkey is gone from the wallet on-chain.
 *
 * Each device is a separate browser profile with its own virtual authenticator.
 *
 *   APP_URL=http://localhost:5173 node scripts/e2e/passkey-devices-e2e.mjs
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const RECIPIENT = process.env.RECIPIENT || 'GDUF46FCQFNBHNWNENYSDSQPDP3PSL2S7CTKLJELGBOC6SJC62JPKMJ7';
const T = 180_000;

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  puppeteer = createRequire(execSync('npm root -g').toString().trim() + '/')('puppeteer');
}

const text = page => page.evaluate(() => document.body.innerText);
const waitText = (page, needle, timeout = T) =>
  page.waitForFunction(n => document.body.innerText.toLowerCase().includes(n.toLowerCase()), { timeout, polling: 500 }, needle);
const clickText = async (page, label) => {
  const el = await page.waitForFunction(
    l => [...document.querySelectorAll('button')].find(b => b.textContent.includes(l) && !b.disabled),
    { timeout: T, polling: 500 },
    label,
  );
  await el.click();
};
const walletOf = page =>
  page.$$eval('a', links => links.find(a => a.textContent.includes('View wallet on Stellar Expert'))?.href.split('/contract/')[1]);
const txLinks = page => page.$$eval('a[href*="/tx/"]', ls => ls.map(a => ({ label: a.textContent.trim().replace(/\s+/g, ' '), hash: a.href.split('/tx/')[1] })));

async function device(browser, name) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', e => console.error(`  [${name} page error] ${e.message}`));
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
  return { context, page };
}

const results = {};
const browser = await puppeteer.launch({ headless: true });
try {
  const A = await device(browser, 'A');
  const B = await device(browser, 'B');

  console.log('[A] creating wallet…');
  await clickText(A.page, 'Create wallet with Face ID');
  await waitText(A.page, 'View wallet on Stellar Expert');
  results.wallet = await walletOf(A.page);
  console.log(`[A] wallet ${results.wallet}`);

  console.log('[A] unlocking device list…');
  await clickText(A.page, 'Confirm it’s you to view devices');
  await waitText(A.page, 'This device');
  results.ipHiddenByDefault = (await text(A.page)).includes('•••.•••.•••.•••');
  await A.page.click('button[aria-label^="Show Last IP"]');
  results.ipRevealed = !(await text(A.page)).includes('•••.•••.•••.•••') ? 'revealed' : 'still hidden';

  console.log('[A] creating a one-time code…');
  await clickText(A.page, 'Add another device');
  await waitText(A.page, 'Your one-time device code');
  const code = await A.page.$eval('code', c => c.textContent.trim());
  results.codeLength = code.length;

  console.log('[B] joining with the code…');
  await clickText(B.page, 'Use a code from another device');
  await B.page.type('textarea[placeholder^="tyfi-pair-"]', code);
  await clickText(B.page, 'Set up this device');

  console.log('[A] approving the new device…');
  await waitText(A.page, 'A new device wants to use your wallet');
  await clickText(A.page, 'Approve');
  await waitText(A.page, 'can now sign in to this wallet');

  await waitText(B.page, 'View wallet on Stellar Expert');
  results.deviceBWallet = await walletOf(B.page);
  results.sameWallet = results.deviceBWallet === results.wallet;
  console.log(`[B] signed in to ${results.deviceBWallet}`);

  console.log('[B] signing out and back in with only its own passkey…');
  await clickText(B.page, 'Disconnect');
  await clickText(B.page, 'sign in');
  await waitText(B.page, 'View wallet on Stellar Expert');
  results.deviceBSignInRecoveredWallet = (await walletOf(B.page)) === results.wallet;

  console.log('[B] sending 1 XLM with its own passkey…');
  await B.page.type('input[placeholder^="Recipient"]', RECIPIENT);
  await clickText(B.page, 'Send');
  await waitText(B.page, 'Passkey-signed payment');
  results.deviceBPayment = (await txLinks(B.page)).find(l => l.label.includes('Passkey-signed payment'))?.hash;

  console.log('[A] removing device B…');
  await A.page.reload({ waitUntil: 'networkidle2' });
  await clickText(A.page, 'Confirm it’s you to view devices');
  await A.page.waitForFunction(() => document.querySelectorAll('li').length >= 2, { timeout: T });
  results.devicesBeforeRemoval = await A.page.$$eval('li', ls => ls.length);
  // Remove the device that is NOT marked "This device".
  await A.page.evaluate(() => {
    const other = [...document.querySelectorAll('li')].find(li => !li.textContent.toLowerCase().includes('this device'));
    [...other.querySelectorAll('button')].find(b => b.textContent.includes('Remove')).click();
  });
  await clickText(A.page, 'Remove with my fingerprint');
  await waitText(A.page, 'was removed and can no longer sign');
  await A.page.waitForFunction(() => document.querySelectorAll('li').length === 1, { timeout: T, polling: 500 }).catch(() => {});
  results.devicesAfterRemoval = await A.page.$$eval('li', ls => ls.length);

  // On-chain check: device B's passkey must no longer be a signer.
  results.deviceBKeyStillOnChain = await B.page.evaluate(async wallet => {
    const m = await import('/src/lib/passkey/index.ts');
    const chain = await import('/src/lib/passkey/chain.ts');
    const b64 = await import('/src/lib/passkey/base64url.ts');
    const keyId = m.loadPasskeySession().keyId;
    return !!(await chain.getWalletSignerKey(wallet, b64.fromBase64Url(keyId)));
  }, results.wallet);

  results.passed =
    results.sameWallet && results.deviceBSignInRecoveredWallet && results.ipHiddenByDefault && results.ipRevealed === 'revealed' &&
    !!results.deviceBPayment && results.devicesBeforeRemoval === 2 && results.devicesAfterRemoval === 1 &&
    results.deviceBKeyStillOnChain === false;
} finally {
  await browser.close();
}
console.log('\n' + JSON.stringify(results, null, 2));
if (!results.passed) process.exitCode = 1;
