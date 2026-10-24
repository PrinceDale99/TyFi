// Re-encodes Puppeteer screencasts into renderable MP4s.
//
// page.screencast() writes MP4s without a usable index (ffprobe reports no
// duration), which HyperFrames rejects as VIDEO_SOURCE_UNRENDERABLE. This
// rewrites each file in footage/ as constant-30fps H.264 (yuv420p) with the
// moov atom up front. Already-normalized files are skipped.
//
//   node video/week4-walkthrough/tools/normalize-footage.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const footage = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'footage');

const hasDuration = (file) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  return out !== '' && out !== 'N/A';
};

for (const name of fs.readdirSync(footage).filter((f) => f.endsWith('.mp4'))) {
  const file = path.join(footage, name);
  if (hasDuration(file)) {
    console.log(`ok       ${name}`);
    continue;
  }
  const tmp = path.join(footage, `.${name}.tmp.mp4`);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', file,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-r', '30', '-fps_mode', 'cfr', '-movflags', '+faststart', '-an', tmp,
  ]);
  fs.renameSync(tmp, file);
  console.log(`encoded  ${name}`);
}
