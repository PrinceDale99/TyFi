// Builds burned-in caption cues and an .srt from the narration script.
//
// Caption text comes from narration/*.txt (never from ASR, which hears "TyFi"
// as "TIFI"); only the timing comes from the Parakeet word timestamps in
// audio/<scene>.words.json. Each cue covers a run of spoken words, and its
// start/end are read from the ASR words at the same relative position.
//
//   node video/week4-walkthrough/tools/captions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeline = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const MAX_WORDS = 7;

// Spoken form (for the TTS voice) -> how it should read on screen.
const DISPLAY = [
  ['B N two fifty-four', 'BN254'],
  ['check-auth function', '__check_auth'],
  ['one hundred seventy-two kilometers per hour', '172 km/h'],
  ['one hundred fifty kilometer band', '150 km/h band'],
  ['one hundred twenty-five percent', '125%'],
  ['one hundred to one hundred twenty-five', '100 to 125'],
  ['thirty million instructions', '30M instructions'],
  ['thirty percent', '30%'],
  ['sixty percent', '60%'],
  ['eighty-five percent', '85%'],
  ['twelve-hour', '12-hour'],
  ['proposal six', 'proposal 6'],
  ['update premium rate', 'update_premium_rate'],
].map(([from, to]) => [from.split(' '), to]);

/**
 * Display tokens, each remembering the span of spoken words it stands for, so
 * a substitution never straddles two cues and timing still maps to the audio.
 */
function displayTokens(spoken) {
  const bare = (w) => w.replace(/[.,:;!?]+$/, '');
  const out = [];
  for (let i = 0; i < spoken.length; ) {
    const rule = DISPLAY.find(([from]) => from.every((f, k) => bare(spoken[i + k] ?? '') === f));
    if (rule) {
      const n = rule[0].length;
      const punct = spoken[i + n - 1].slice(bare(spoken[i + n - 1]).length);
      out.push({ text: rule[1] + punct, from: i, to: i + n - 1 });
      i += n;
    } else {
      out.push({ text: spoken[i], from: i, to: i });
      i += 1;
    }
  }
  return out;
}

/** Splits tokens into cues at sentence/clause ends, at most MAX_WORDS each. */
function chunk(tokens) {
  const cues = [];
  let cur = [];
  tokens.forEach((t) => {
    cur.push(t);
    const end = /[.!?]$/.test(t.text);
    const pause = /[,:;]$/.test(t.text) && cur.length >= 3;
    if (end || pause || cur.length >= MAX_WORDS) {
      // Don't leave a single word dangling on its own cue.
      if (cur.length === 1 && cues.length && !/[.!?]$/.test(cues.at(-1).at(-1).text)) cues.at(-1).push(...cur);
      else cues.push(cur);
      cur = [];
    }
  });
  if (cur.length) cues.push(cur);
  return cues;
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};

const all = [];
for (const scene of timeline.scenes) {
  const spoken = fs.readFileSync(path.join(here, 'narration', `${scene.id}.txt`), 'utf8').trim().split(/\s+/);
  const asr = JSON.parse(fs.readFileSync(path.join(here, 'audio', `${scene.id}.words.json`), 'utf8'));
  const at = (i) => asr[Math.min(asr.length - 1, Math.round((i * asr.length) / spoken.length))];
  const offset = scene.start + scene.voAt;
  for (const cue of chunk(displayTokens(spoken))) {
    all.push({
      scene: scene.id,
      start: +(offset + at(cue[0].from).start).toFixed(3),
      end: +(offset + at(cue.at(-1).to).end).toFixed(3),
      text: cue.map((t) => t.text).join(' '),
    });
  }
}

// Close tiny gaps so captions don't flicker between cues within a sentence run.
for (let i = 0; i < all.length - 1; i++) {
  const gap = all[i + 1].start - all[i].end;
  if (all[i + 1].scene === all[i].scene && gap > 0 && gap < 0.35) all[i].end = all[i + 1].start;
}

fs.writeFileSync(path.join(here, 'captions.json'), JSON.stringify(all, null, 1));
fs.writeFileSync(path.join(here, 'captions.js'), `window.__CAPTIONS__ = ${JSON.stringify(all)};\n`);
fs.writeFileSync(
  path.join(here, 'tyfi-week4-walkthrough.srt'),
  all.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'),
);
console.log(`${all.length} cues, last ends at ${all.at(-1).end}s`);
