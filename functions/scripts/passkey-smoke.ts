/**
 * Relayer smoke test against a live network.
 *
 * Generates a throwaway P-256 key pair (standing in for a passkey), asks the
 * relayer to deploy its wallet through the factory, then requests testnet
 * welcome funding. Prints Stellar Expert links for every transaction.
 *
 *   PASSKEY_SPONSOR_SECRET=S… PASSKEY_FACTORY_ID=C… PASSKEY_WALLET_WASM_HASH=… \
 *     npx ts-node --transpile-only scripts/passkey-smoke.ts
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { loadPasskeyConfig } from '../passkey/config';
import { PasskeyRelayer } from '../passkey/relayer';

async function main() {
  const loaded = loadPasskeyConfig();
  if (!loaded.ok) throw new Error(loaded.reason);
  const relayer = new PasskeyRelayer(loaded.config);
  const explorer = `https://stellar.expert/explorer/${loaded.config.network}`;

  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const rawKey = Buffer.concat([Buffer.from([0x04]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]);
  const keyId = randomBytes(16);

  console.log('Sponsor:', relayer.sponsorPublicKey, await relayer.health());
  const deployed = await relayer.deployWallet(keyId, rawKey);
  console.log('Wallet:', deployed.walletAddress, deployed.hash ? `${explorer}/tx/${deployed.hash}` : '(already deployed)');

  const again = await relayer.deployWallet(keyId, rawKey);
  console.log('Idempotent re-deploy →', again.alreadyDeployed ? 'returned existing wallet' : 'UNEXPECTED new deployment');

  const funded = await relayer.fundWallet(deployed.walletAddress);
  console.log('Welcome funding:', funded ? `${explorer}/tx/${funded.hash}` : 'skipped (already funded)');
  console.log('Factory wallet check:', await relayer.isFactoryWallet(deployed.walletAddress));
}

main().catch(err => {
  console.error('Smoke test failed:', err.code ?? '', err.message, err.detail ?? '');
  process.exit(1);
});
