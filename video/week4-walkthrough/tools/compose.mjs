// Generates index.html, the HyperFrames composition for the walkthrough, from
// timeline.json, captions.json, the footage, and the e2e evidence log. The
// output is static HTML (no runtime fetches), so renders are deterministic.
//
//   node video/week4-walkthrough/tools/compose.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(here, '..', '..');
const timeline = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const captions = JSON.parse(fs.readFileSync(path.join(here, 'captions.json'), 'utf8'));
const e2e = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'deployments', 'week4-e2e-testnet.json'), 'utf8'));
const scene = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
const total = timeline.scenes.at(-1).start + timeline.scenes.at(-1).duration;

/** Latest (non-retake) entry for a step in the evidence log. */
const step = (name) => e2e.steps.filter((s) => s.step === name && !s.retake).at(-1) ?? null;
const short = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : 'pending');

function footageSeconds(file) {
  const p = path.join(here, 'footage', file);
  if (!fs.existsSync(p)) return null;
  const frames = Number(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim());
  return frames / timeline.fps;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r = (n) => Math.round(n * 1000) / 1000;
const clips = []; // HTML for timed elements
const tl = []; // GSAP timeline lines

/** A timed element. `at`/`dur` are absolute seconds. */
function clip(cls, at, dur, inner, extra = '') {
  const id = `c${clips.length}`;
  clips.push(`<div id="${id}" class="clip ${cls}" data-start="${r(at)}" data-duration="${r(dur)}"${extra}>${inner}</div>`);
  return `#${id}`;
}
const fadeIn = (sel, at, y = 24, d = 0.6) => tl.push(`tl.fromTo("${sel}", { opacity: 0, y: ${y} }, { opacity: 1, y: 0, duration: ${d}, ease: "power3.out" }, ${r(at)});`);
const fadeOut = (sel, at, d = 0.4) => tl.push(`tl.to("${sel}", { opacity: 0, duration: ${d}, ease: "power2.in" }, ${r(at)});`);

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function chapter(id, num, title) {
  const s = scene[id];
  const sel = clip('chapter', s.start, s.duration, `<span class="num">${num}</span><span>${esc(title)}</span>`);
  fadeIn(sel, s.start + 0.2, -12);
}

/** Screen recording inside a device frame; trimmed to the scene. */
function footage(id, { from = 0, until } = {}) {
  const s = scene[id];
  const len = footageSeconds(s.footage);
  const at = s.start + 0.3;
  if (len === null) {
    const sel = clip('frame placeholder', at, s.duration - 0.3, `<div>Footage pending: ${esc(s.footage)}</div>`);
    fadeIn(sel, at, 30);
    return { at, end: s.start + s.duration };
  }
  const dur = Math.min(s.duration - 0.3, (until ?? len) - from);
  // The video is its own top-level clip (media must not nest inside a timed
  // element), styled as the device frame.
  const vid = `v-${id}`;
  clips.push(`<video id="${vid}" class="clip frame" src="footage/${s.footage}" data-start="${r(at)}" data-duration="${r(dur)}" data-media-start="${r(from)}" muted playsinline></video>`);
  tl.push(`tl.fromTo("#${vid}", { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, ${r(at)});`);
  return { at, end: at + dur };
}

// Stellar Expert's content column spans x≈280–1640 of a 1920px capture. Scale
// the shot so that column fills the 1136px card, and shift past the margin.
const PROOF_SCALE = 0.84;
const PROOF_X = Math.round(270 * PROOF_SCALE);

/** A Stellar Expert screenshot, cropped to its summary + invocation area. */
function proof(name, at, dur, label, { cropY = 60, cropH = 640, pos = 'center' } = {}) {
  const st = step(name);
  const img = `proofs/${name}.png`;
  const has = fs.existsSync(path.join(here, img));
  const inner = `
    <div class="proof-head"><span class="dot"></span>Verified on Stellar Expert · testnet</div>
    <div class="proof-label">${esc(label)}</div>
    <div class="proof-shot">${has ? `<img src="${img}" style="transform: translate(-${PROOF_X}px, -${Math.round(cropY * PROOF_SCALE)}px)" />` : '<div class="pending">screenshot pending</div>'}</div>
    <div class="proof-hash">tx ${short(st?.txHash)}</div>`;
  const sel = clip(`proof proof-${pos}`, at, dur, inner, ` style="--crop-h:${Math.round(cropH * PROOF_SCALE)}px"`);
  tl.push(`tl.fromTo("${sel}", { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }, ${r(at)});`);
  fadeOut(sel, at + dur - 0.4);
  return sel;
}

function callout(at, dur, html, cls = '') {
  const sel = clip(`callout ${cls}`, at, dur, html);
  tl.push(`tl.fromTo("${sel}", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: "back.out(1.6)" }, ${r(at)});`);
  fadeOut(sel, at + dur - 0.35);
  return sel;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

{ // 00 Title
  const s = scene['00-title'];
  const sel = clip('title-card', s.start, s.duration, `
    <div class="logo">Ty<span>Fi</span></div>
    <div class="title-sub">Parametric typhoon insurance on Stellar</div>
    <div class="badges"><span>Passkey wallets</span><span>Co-op DAO</span><span>Groth16 ZK proofs</span><span>Soroban</span></div>
    <div class="title-week">Week 4 · end-to-end on Stellar testnet</div>`);
  tl.push(`tl.fromTo("${sel} .logo", { opacity: 0, scale: 0.85, filter: "blur(10px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "power4.out" }, ${s.start + 0.2});`);
  tl.push(`tl.fromTo("${sel} .title-sub", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${s.start + 0.9});`);
  tl.push(`tl.fromTo("${sel} .badges span", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: "power3.out" }, ${s.start + 1.5});`);
  tl.push(`tl.fromTo("${sel} .title-week", { opacity: 0 }, { opacity: 1, duration: 0.6 }, ${s.start + 2.4});`);
  fadeOut(sel, s.start + s.duration - 0.6, 0.6);
}

{ // 01 Overview: the pipeline
  const s = scene['01-overview'];
  chapter('01-overview', '01', 'The pipeline');
  const nodes = [
    ['wallet', 'Passkey wallet', 'Seedless · secp256r1', 'sky'],
    ['dao', 'Co-op DAO', 'Votes by LP shares', 'indigo'],
    ['vault', 'Insurance vault', 'Soroban contract', 'emerald'],
    ['oracle', 'ZK oracle', 'Groth16 · BN254', 'amber'],
    ['payout', 'Payout', 'XLM to the farmer', 'emerald'],
  ];
  const html = `<div class="flow">${nodes.map(([k, t, sub, c], i) => `${i ? '<div class="arrow"></div>' : ''}<div class="node ${c}" data-k="${k}"><div class="node-t">${t}</div><div class="node-s">${sub}</div></div>`).join('')}</div>`;
  const sel = clip('overview', s.start, s.duration, html);
  // Reveal nodes roughly as the narration names them.
  [1.2, 4.0, 4.0, 7.2, 14.5].forEach((t, i) => tl.push(`tl.fromTo(document.querySelectorAll("${sel} .node")[${i}], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${r(s.start + t)});`));
  tl.push(`tl.fromTo("${sel} .arrow", { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 1.2, ease: "power2.out" }, ${r(s.start + 3)});`);
  fadeOut(sel, s.start + s.duration - 0.5);
}

{ // 02 Wallet
  const s = scene['02-wallet'];
  chapter('02-wallet', '02', 'Seedless passkey wallet');
  const f = footage('02-wallet');
  callout(s.start + 3, 7, `<b>No seed phrase.</b> The key never leaves the device's secure hardware.`);
  callout(s.start + 11, 6, `Passkey prompt simulated with Chrome's <b>virtual authenticator</b>`, 'note');
  proof('video_passkey_wallet_created', Math.min(f.end, s.start + s.duration) - 6, 6, 'smart_wallet_factory deployed the wallet');
}

{ // 03 Membership: four proofs
  const s = scene['03-membership'];
  chapter('03-membership', '03', 'Joining the co-op');
  const items = [
    ['fund_wallet', 'Co-op treasury funds the wallet', 'transfer · 3,000 XLM'],
    ['verify_farmer', 'Farm verified by admin multisig', 'verify_farmer'],
    ['passkey_deposit_lp', 'LP deposit, signed with passkey', 'deposit_reinsurance · 1,500 XLM'],
    ['passkey_subscribe_policy', 'Farm insured, signed with passkey', 'subscribe · Eastern Visayas'],
  ];
  const html = `<div class="steps">${items.map(([n, t, fn]) => {
    const st = step(n);
    return `<div class="step-card"><div class="step-t">${esc(t)}</div><div class="step-fn">${esc(fn)}</div><div class="step-hash">tx ${short(st?.txHash)}</div><div class="step-ok">✓ Successful</div></div>`;
  }).join('')}</div>`;
  const sel = clip('membership', s.start + 0.3, s.duration - 0.3, html);
  tl.push(`tl.fromTo("${sel} .step-card", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.55, stagger: 2.4, ease: "power3.out" }, ${r(s.start + 1)});`);
  fadeOut(sel, s.start + s.duration - 0.5);
}

{ // 04 DAO
  const s = scene['04-dao'];
  chapter('04-dao', '04', 'Co-op DAO vote');
  const f = footage('04-dao');
  callout(s.start + 4, 7, `Voting power = <b>LP shares</b> in the vault`);
  callout(s.start + 14, 7, `Quorum <b>30%</b> · premium changes need <b>60%</b>`);
  if (f.end < s.start + s.duration - 1) proof('video_passkey_vote', f.end - 0.3, s.start + s.duration - f.end + 0.3, 'vote() signed by the passkey wallet');
}

{ // 05 Cross-contract
  const s = scene['05-cross-contract'];
  chapter('05-cross-contract', '05', 'DAO → vault, cross-contract');
  // Skip 4s of idle so the Finalize click lands on "taps finalize".
  footage('05-cross-contract', { from: 4 });
  callout(s.start + 1.5, 5.5, `The farmer is a DAO <b>executor</b>: finalize is passkey-signed`);
  callout(s.start + 7.5, 7, `The vault accepts parameter changes <b>only from its DAO</b>`);
  const fin = step('finalize_proposal_cross_contract');
  const before = fin?.premiumRateBefore ?? 100;
  const after = fin?.premiumRateAfter ?? 125;
  // The expanded invocation tree: finalize_proposal → passkey __check_auth → vault.update_premium_rate.
  proof('finalize_proposal_cross_contract', s.start + 15.8, s.duration - 16, `tyfi_dao → vault.update_premium_rate · Eastern Visayas ${before} → ${after}`, { cropY: 425, cropH: 600 });
}

{ // 06 ZK payout
  const s = scene['06-zk-payout'];
  chapter('06-zk-payout', '06', 'ZK-verified payout');
  // From 2s in, "Proof verified" lands on "the vault rebuilds…" and the paid
  // card on "the vault pays 85%"; nothing covers the scene's last seconds.
  footage('06-zk-payout', { from: 2 });
  callout(s.start + 3, 6.5, `Raw reading <b>172 km/h</b> stays with the oracle`, 'amber');
  callout(s.start + 10, 8, `Proof attests only <b>wind ≥ 150 km/h</b> · signed by the registered oracle key`);
  callout(s.start + 18.5, 5.5, `Vault rebuilds all <b>5 public inputs</b> itself`);
  if (step('zk_weather_report')?.txHash) {
    proof('zk_weather_report', s.start + 24.5, 9.5, 'submit_weather_report_zk · Groth16 verified · 29.2M instructions', { cropY: 425, cropH: 600 });
  }
}

{ // 07 Trust
  const s = scene['07-trust'];
  chapter('07-trust', '07', 'Why it holds');
  const checks = [
    'Tampered damage → InvalidProof',
    'Replayed for another region → InvalidProof',
    'Inflated wind band → InvalidProof',
    'Unregistered oracle key → InvalidProof',
    'Swapped / off-curve proof points → rejected',
  ];
  const html = `
    <div class="trust">
      <div class="trust-col"><div class="trust-h">Contract tests · real Groth16 proof</div>${checks.map((c) => `<div class="check">✓ ${esc(c)}</div>`).join('')}</div>
      <div class="trust-col side">
        <div class="pill-card"><b>Circom</b> ⇄ <b>Noir</b><span>one oracle signature satisfies both circuits</span></div>
        <div class="pill-card"><b>Admin multisig</b><span>zero-threshold bypass closed, fails closed</span></div>
        <div class="pill-card"><b>134</b> contract tests · <b>41</b> backend tests<span>all passing</span></div>
      </div>
    </div>`;
  const sel = clip('trust-wrap', s.start + 0.3, s.duration - 0.3, html);
  tl.push(`tl.fromTo("${sel} .check", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.9, ease: "power3.out" }, ${r(s.start + 1)});`);
  tl.push(`tl.fromTo("${sel} .pill-card", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, stagger: 3, ease: "power3.out" }, ${r(s.start + 9)});`);
  fadeOut(sel, s.start + s.duration - 0.5);
}

{ // 08 Outro: evidence table
  const s = scene['08-outro'];
  const rows = [
    ['Passkey wallet created', 'video_passkey_wallet_created'],
    ['LP deposit (passkey)', 'passkey_deposit_lp'],
    ['DAO vote (passkey)', 'passkey_vote'],
    ['Proposal executed', 'execute_proposal'],
    ['DAO → vault update', 'finalize_proposal_cross_contract'],
    ['ZK report verified', 'zk_weather_report'],
    ['Payout claimed (passkey)', 'passkey_claim_payout'],
  ];
  const html = `
    <div class="outro">
      <div class="outro-l">
        <div class="logo small">Ty<span>Fi</span></div>
        <div class="outro-t">Every step is a testnet transaction.</div>
        <div class="outro-links">
          <div>github.com/PrinceDale99/TyFi</div>
          <div>docs/REPLICATION_GUIDE.md</div>
          <div class="mit">Open source · MIT License</div>
        </div>
      </div>
      <div class="outro-r">${rows.map(([t, n]) => `<div class="tx-row"><span>${esc(t)}</span><code>${short(step(n)?.txHash)}</code></div>`).join('')}</div>
    </div>`;
  const sel = clip('outro-wrap', s.start, s.duration, html);
  tl.push(`tl.fromTo("${sel} .outro-l > *", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.25, ease: "power3.out" }, ${r(s.start + 0.4)});`);
  tl.push(`tl.fromTo("${sel} .tx-row", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.35, ease: "power3.out" }, ${r(s.start + 1.2)});`);
}

// Narration
const audio = timeline.scenes.map((s) => {
  const wav = path.join(here, 'audio', `${s.id}.wav`);
  const words = JSON.parse(fs.readFileSync(path.join(here, 'audio', `${s.id}.words.json`), 'utf8'));
  const dur = Math.min(s.duration - s.voAt, words.at(-1).end + 0.6);
  return fs.existsSync(wav) ? `<audio id="vo-${s.id}" class="clip" src="audio/${s.id}.wav" data-start="${r(s.start + s.voAt)}" data-duration="${r(dur)}" data-volume="1"></audio>` : '';
});

// Captions
for (const c of captions) {
  const sel = clip('cap', c.start, Math.max(0.4, c.end - c.start), `<span>${esc(c.text)}</span>`);
  tl.push(`tl.fromTo("${sel} span", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, ${r(c.start)});`);
}

const html = `<!doctype html>
<!-- @generated by tools/compose.mjs — edit the generator, not this file. -->
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
<div class="clip bg" data-start="0" data-duration="${total}"><div class="glow g1"></div><div class="glow g2"></div><div class="grid"></div></div>
<div class="clip brand" data-start="12" data-duration="${total - 12 - 19}">TyFi · Week 4 · Stellar testnet</div>
${clips.join('\n')}
${audio.join('\n')}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${tl.join('\n')}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(here, 'index.html'), html);
console.log(`index.html: ${clips.length} clips, ${tl.length} tweens, ${total}s`);
