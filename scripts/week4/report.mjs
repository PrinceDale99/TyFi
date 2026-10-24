// Renders the Week 4 evidence tables from the deployment logs into week4.md,
// between the <!-- evidence:start --> / <!-- evidence:end --> markers, so the
// report always matches contracts/deployments/*.json.
//
//   node scripts/week4/report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'deployments', f), 'utf8'));
const rollout = read('week4-zk-testnet.json');
const e2e = read('week4-e2e-testnet.json');
const link = (h) => (h ? `[\`${h.slice(0, 8)}…${h.slice(-6)}\`](https://stellar.expert/explorer/testnet/tx/${h})` : '_pending_');

const ROLLOUT_LABELS = {
  upload_wasm: 'Upload Groth16 vault wasm (54,558 bytes)',
  upgrade_vault: 'Upgrade vault in place',
  rotate_admin_multisig: 'Repair zero-threshold admin multisig → 1-of-1',
  set_zk_verifying_key: 'Install Groth16 verifying key',
  set_oracle_active: 'Activate ZK oracle',
  set_oracle_zk_key: "Register oracle's EdDSA key hash",
  set_dao_address: 'Link DAO (enables cross-contract updates)',
};

const E2E_LABELS = {
  passkey_wallet_created: ['Seedless wallet created by the factory', 'passkey'],
  fund_wallet: ['Co-op treasury funds the wallet', 'co-op treasury'],
  verify_farmer: ['Farm verified', 'vault admin multisig'],
  passkey_deposit_lp: ['LP deposit → voting power', 'passkey wallet'],
  passkey_subscribe_policy: ['Farm insured (Eastern Visayas)', 'passkey wallet'],
  create_proposal: ['Proposal 6: premium multiplier → 125', 'co-op member'],
  passkey_vote: ['Vote FOR proposal 6', 'passkey wallet'],
  vote_freighter_wallet: ['Vote FOR proposal 6', 'co-op LP'],
  vote_deployer: ['Vote FOR proposal 6', 'co-op LP'],
  execute_proposal: ['Settle: quorum + 60% met → timelock', 'anyone'],
  grant_executor_role: ['Farmer wallet made a DAO executor', 'DAO admin'],
  finalize_proposal_cross_contract: ['Finalize: DAO → vault.update_premium_rate', 'passkey wallet'],
  zk_weather_report: ['Groth16 weather proof verified by the vault', 'ZK oracle'],
  passkey_claim_payout: ['Payout claimed', 'passkey wallet'],
  video_passkey_wallet_created: ['Wallet created on camera', 'passkey'],
  video_create_proposal: ['Live proposal for the video vote', 'co-op member'],
  video_passkey_vote: ['Vote cast on camera', 'passkey wallet'],
};

const latest = (steps) => {
  const seen = new Map();
  for (const s of steps) if (!s.retake) seen.set(s.step, s);
  return [...seen.values()];
};

const rolloutRows = latest(rollout.steps).map((s) => `| ${ROLLOUT_LABELS[s.step] ?? s.step} | ${link(s.txHash)} |`);
const order = Object.keys(E2E_LABELS);
const e2eSteps = latest(e2e.steps);
const e2eRows = order.map((k) => {
  const s = e2eSteps.find((x) => x.step === k);
  const [label, signer] = E2E_LABELS[k];
  let note = '';
  if (k === 'finalize_proposal_cross_contract' && s?.premiumRateAfter) note = ` (${s.premiumRateBefore} → ${s.premiumRateAfter})`;
  if (k === 'passkey_claim_payout' && s?.balanceAfterStroops) note = ` (+${((Number(s.balanceAfterStroops) - Number(s.balanceBeforeStroops)) / 1e7).toFixed(2)} XLM)`;
  return `| ${label}${note} | ${signer} | ${link(s?.txHash)} |`;
});

const block = `<!-- evidence:start -->
### A. Vault rollout (\`${rollout.vault}\`)

| Step | Transaction |
|---|---|
${rolloutRows.join('\n')}

### B. End-to-end pipeline

Passkey wallet: [\`${e2e.wallet}\`](https://stellar.expert/explorer/testnet/contract/${e2e.wallet}) · DAO proposal ${e2e.proposalId}

| Step | Signed by | Transaction |
|---|---|---|
${e2eRows.join('\n')}
<!-- evidence:end -->`;

const file = path.join(root, 'week4.md');
const md = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, md.replace(/<!-- evidence:start -->[\s\S]*<!-- evidence:end -->/, block));
console.log(`week4.md: ${rolloutRows.length} rollout rows, ${e2eRows.length} pipeline rows (${e2eRows.filter((r) => r.includes('_pending_')).length} pending)`);
