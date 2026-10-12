/**
 * End-to-end test of linking an existing account with a seedless passkey wallet.
 *
 * - A fresh testnet G-account stands in for the user's Freighter/WalletConnect
 *   account (its key signs the transaction envelope, as the extension would).
 * - Chrome's virtual authenticator stands in for the device passkey.
 * - The real frontend modules (served by the Vite dev server) run the link and
 *   unlink flows, so the exact production code path lands on testnet.
 *
 *   APP_URL=http://localhost:5173 node scripts/e2e/passkey-link-e2e.mjs
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const here = path.dirname(fileURLToPath(import.meta.url));

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  puppeteer = createRequire(execSync('npm root -g').toString().trim() + '/')('puppeteer');
}
// Reuse the frontend's stellar-sdk for the Node-side "extension" signer.
const { Keypair, Networks, TransactionBuilder } = createRequire(path.join(here, '../../frontend/package.json'))('@stellar/stellar-sdk');

const account = Keypair.random();
console.log(`Existing account (stands in for Freighter): ${account.publicKey()}`);
const fund = await fetch(`https://friendbot.stellar.org/?addr=${account.publicKey()}`);
if (!fund.ok) throw new Error(`Friendbot failed: ${fund.status}`);

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error(`  [page error] ${e.message}`));
  const cdp = await page.createCDPSession();
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  // The "extension": sign whatever envelope the app hands us with the account key.
  await page.exposeFunction('signEnvelopeForTest', xdr => {
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    tx.sign(account);
    return tx.toXDR();
  });

  await page.goto(`${APP_URL}/passkey`, { waitUntil: 'networkidle2' });
  const result = await page.evaluate(async accountId => {
    const m = await import('/src/lib/passkey/index.ts');
    const created = await m.createSeedlessWallet('E2E link test');
    const wallet = created.session.walletAddress;
    const linkTx = await m.linkPasskeyToAccount(created.session, accountId, xdr => window.signEnvelopeForTest(xdr));
    const afterLink = { linkedWallet: await m.getLinkedWallet(accountId), linkedAccount: await m.getLinkedAccount(wallet) };
    const unlinkTx = await m.unlinkFromAccount(wallet, accountId, xdr => window.signEnvelopeForTest(xdr));
    const afterUnlink = { linkedWallet: await m.getLinkedWallet(accountId), linkedAccount: await m.getLinkedAccount(wallet) };
    const relinkTx = await m.linkPasskeyToAccount(created.session, accountId, xdr => window.signEnvelopeForTest(xdr));
    return { wallet, createTx: created.deployTxHash, linkTx, afterLink, unlinkTx, afterUnlink, relinkTx };
  }, account.publicKey());

  const ok =
    result.afterLink.linkedWallet === result.wallet &&
    result.afterLink.linkedAccount === account.publicKey() &&
    result.afterUnlink.linkedWallet === null &&
    result.afterUnlink.linkedAccount === null;

  const tx = h => `https://stellar.expert/explorer/testnet/tx/${h}`;
  console.log(JSON.stringify({
    passed: ok,
    account: account.publicKey(),
    wallet: result.wallet,
    transactions: {
      createWallet: tx(result.createTx),
      link: tx(result.linkTx),
      unlink: tx(result.unlinkTx),
      relink: tx(result.relinkTx),
    },
    afterLink: result.afterLink,
    afterUnlink: result.afterUnlink,
  }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
