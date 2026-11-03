#!/usr/bin/env node
// Geo Studio renderer.
//   node engine/render.mjs <slug>                    full render (parallel chunks) + audio mix
//   node engine/render.mjs <slug> --still 1.5,8,20   render stills to out/<slug>/stills
//   node engine/render.mjs <slug> --from 10 --to 14  render a time range only (preview mp4)
//   node engine/render.mjs <slug> --mix              re-mix audio onto the existing silent video
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT, W, H, FPS, createCanvas, registerFonts } from './core.mjs';
import { chunkWords, drawCaptions, finish, credit } from './ui.mjs';
import { loadCountries } from './geo.mjs';
import { mixAudio } from './audio.mjs';

const args = process.argv.slice(2);
const slug = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
if (!slug) { console.error('usage: render.mjs <slug> [--still t,..] [--from a --to b] [--workers n]'); process.exit(1); }

const VDIR = path.join(ROOT, 'videos', slug);
const OUT = path.join(ROOT, 'out', slug);
fs.mkdirSync(OUT, { recursive: true });

async function loadVideo() {
  registerFonts();
  const mod = (await import(pathToFileURL(path.join(VDIR, 'video.mjs')).href)).default;
  const timing = JSON.parse(fs.readFileSync(path.join(VDIR, 'timing.json'), 'utf8'));
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const lines = timing.lines;
  const g = {
    W, H, ctx, canvas, timing, lines, words: timing.words, slug, vdir: VDIR,
    duration: timing.duration + (mod.tail ?? 0.9),
    chunks: chunkWords(timing.words, mod.captionOpts || {}),
    countries: loadCountries('50m'),
    L: (i) => lines[i].s, Le: (i) => lines[i].e,
    /** time of the k-th occurrence of `word` (case-insensitive prefix) in line i */
    wt(i, word, k = 0) {
      const ws = timing.words.filter((w) => w.line === i && w.w.toLowerCase().replace(/[^a-z0-9%$]/g, '').startsWith(word.toLowerCase()));
      return (ws[k] || ws[0] || { s: lines[i].s }).s;
    },
    caption: { y: 1390 },
    creditText: '',
  };
  if (mod.setup) await mod.setup(g);
  return { mod, g };
}

async function drawFrame(mod, g, T) {
  const ctx = g.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
  g.T = T; g.caption = { y: 1390, ...(mod.caption || {}) }; g.creditText = '';
  ctx.save();
  await mod.frame(g, T);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
  finish(ctx, T, mod.finish || {});
  if (g.creditText) credit(ctx, g.creditText);
  drawCaptions(ctx, g.chunks, T, g.caption);
}

function ffmpegEncoder(file) {
  return spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function renderRange(f0, f1, file) {
  const { mod, g } = await loadVideo();
  const tmp = file.replace(/\.mp4$/, '.part.mp4');
  const enc = ffmpegEncoder(tmp);
  const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await drawFrame(mod, g, f / FPS);
    const data = g.ctx.getImageData(0, 0, W, H).data;
    if (!enc.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise((r) => enc.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) process.stderr.write(`  [${slug} ${f0}-${f1}] frame ${f} ${(((f - f0 + 1) / ((Date.now() - t0) / 1000))).toFixed(1)} fps\n`);
  }
  enc.stdin.end();
  await done;
  fs.renameSync(tmp, file);
}

async function stills(times) {
  const { mod, g } = await loadVideo();
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const t0 = Date.now();
    await drawFrame(mod, g, t);
    const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
    fs.writeFileSync(f, await g.canvas.encode('jpeg', 88));
    console.log(f, `${Date.now() - t0} ms`);
  }
}

async function full() {
  const { g } = await loadVideo();
  const from = Number(opt('--from', 0)), to = Number(opt('--to', g.duration));
  const F0 = Math.round(from * FPS), F1 = Math.round(Math.min(to, g.duration) * FPS);
  const workers = Number(opt('--workers', Math.max(2, Math.min(4, os.cpus().length - 1))));
  const nChunks = Math.max(workers, Math.ceil((F1 - F0) / 150));
  const per = Math.ceil((F1 - F0) / nChunks);
  const cdir = path.join(OUT, 'chunks'); fs.mkdirSync(cdir, { recursive: true });
  for (const f of fs.readdirSync(cdir)) fs.rmSync(path.join(cdir, f));
  const jobs = [];
  for (let i = 0; i < nChunks; i++) { const a = F0 + i * per, b = Math.min(F1, a + per); if (a < b) jobs.push({ a, b, file: path.join(cdir, `c${String(i).padStart(3, '0')}.mp4`) }); }
  console.log(`${slug}: ${F1 - F0} frames in ${jobs.length} chunks on ${workers} workers`);
  const t0 = Date.now();
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++];
      await new Promise((res, rej) => {
        const p = spawn(process.execPath, [path.join(ROOT, 'engine/render.mjs'), slug, '--chunk', String(j.a), String(j.b), j.file], { stdio: ['ignore', 'inherit', 'inherit'] });
        p.on('close', (c) => (c === 0 ? res() : rej(new Error(`chunk ${j.a} failed`))));
      });
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  const list = path.join(cdir, 'list.txt');
  fs.writeFileSync(list, jobs.map((j) => `file '${j.file}'`).join('\n'));
  const silent = path.join(OUT, 'silent.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  console.log(`video done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (from === 0 && !has('--from')) await mix();
  else console.log(silent);
}

async function mix() {
  const { mod, g } = await loadVideo();
  const final = path.join(ROOT, 'out', `${slug}.mp4`);
  await mixAudio({ g, mod, video: path.join(OUT, 'silent.mp4'), out: final });
  console.log('final:', final);
}

if (has('--chunk')) {
  const i = args.indexOf('--chunk');
  await renderRange(Number(args[i + 1]), Number(args[i + 2]), args[i + 3]);
} else if (has('--still')) {
  await stills(opt('--still', '0').split(',').map(Number));
} else if (has('--mix')) {
  await mix();
} else {
  await full();
}
process.exit(0);
