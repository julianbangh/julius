// Geo Studio UI: captions, headlines, labels, flags, counters, charts, grading.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, W, H, createCanvas, loadImage, rgba, clamp, ease, rng, lerp, smooth } from './core.mjs';

// ---------- captions ----------
export function chunkWords(words, { maxWords = 3, maxChars = 18 } = {}) {
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.w.length + 1, 0) + w.w.length;
    if (cur.length && (cur.length >= maxWords || chars > maxChars || (prev && w.s - prev.e > 0.38) || prev.line !== w.line)) flush();
    cur.push(w);
    if (/[.?!:;,…]$/.test(w.w)) flush();
  }
  flush();
  return chunks.map((ws, i) => ({ words: ws, s: ws[0].s, e: ws[ws.length - 1].e }));
}

/** Big Shorts-style karaoke captions. */
export function drawCaptions(ctx, chunks, T, { y = 1390, size = 82, color = '#fff', hi = '#ffe14d', stroke = 13, hide = false } = {}) {
  if (hide) return;
  let ch = null;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const next = chunks[i + 1];
    const end = next ? Math.min(next.s, c.e + 0.45) : c.e + 0.6;
    if (T >= c.s - 0.04 && T < end) { ch = c; break; }
  }
  if (!ch) return;
  const age = T - ch.s;
  const pop = 1 + 0.16 * (1 - ease.outBack(clamp(age / 0.16)));
  ctx.save();
  ctx.font = `${size}px MontBlack`;
  ctx.textBaseline = 'middle';
  const texts = ch.words.map((w) => w.w.toUpperCase());
  const space = size * 0.4;
  const widths = texts.map((t) => ctx.measureText(t).width);
  let total = widths.reduce((a, b) => a + b, 0) + space * (texts.length - 1);
  let scale = pop;
  if (total * scale > W - 90) scale *= (W - 90) / (total * scale);
  ctx.translate(W / 2, y);
  ctx.scale(scale, scale);
  let x = -total / 2;
  ctx.lineJoin = 'round';
  for (let i = 0; i < texts.length; i++) {
    const w = ch.words[i];
    const active = T >= w.s - 0.02 && T < (ch.words[i + 1]?.s ?? ch.e + 0.4);
    ctx.save();
    const cx = x + widths[i] / 2;
    ctx.translate(cx, 0);
    if (active) ctx.scale(1.07, 1.07);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.strokeStyle = '#000'; ctx.lineWidth = stroke; ctx.strokeText(texts[i], -widths[i] / 2, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = active ? hi : color;
    ctx.fillText(texts[i], -widths[i] / 2, 0);
    ctx.restore();
    x += widths[i] + space;
  }
  ctx.restore();
}

// ---------- text helpers ----------
export function text(ctx, str, x, y, { font = 'MontXB', size = 48, color = '#fff', align = 'center', stroke = 0, strokeColor = '#000', alpha = 1, shadow = 0, baseline = 'middle', maxW = 0, letter = 0 } = {}) {
  if (alpha <= 0) return 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if (letter) ctx.letterSpacing = `${letter}px`;
  let w = ctx.measureText(str).width;
  if (maxW && w > maxW) { const k = maxW / w; ctx.translate(x, y); ctx.scale(k, k); x = 0; y = 0; w = maxW; }
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = shadow; ctx.shadowOffsetY = shadow / 3; }
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = strokeColor; ctx.lineWidth = stroke; ctx.strokeText(str, x, y); ctx.shadowColor = 'transparent'; }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.restore();
  return w;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

/** Headline pill at the top (hook text). */
export function headline(ctx, str, { y = 250, a = 1, size = 74, bg = 'rgba(8,12,24,0.78)', color = '#fff', accent = '#ffe14d', sub = '' } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const k = 0.92 + 0.08 * ease.outBack(a);
  ctx.translate(W / 2, y); ctx.scale(k, k);
  ctx.font = `${size}px Anton`;
  const lines = str.split('\n');
  const tw = Math.min(W - 80, Math.max(...lines.map((l) => ctx.measureText(l.toUpperCase()).width)) + 70);
  const lh = size * 1.12;
  const th = lines.length * lh + 36 + (sub ? 50 : 0);
  ctx.fillStyle = bg; roundRect(ctx, -tw / 2, -th / 2, tw, th, 26); ctx.fill();
  ctx.fillStyle = accent; roundRect(ctx, -tw / 2, -th / 2, 12, th, [26, 0, 0, 26]); ctx.fill();
  lines.forEach((l, i) => text(ctx, l.toUpperCase(), 0, -th / 2 + 18 + lh * (i + 0.5), { font: 'Anton', size, color, maxW: tw - 60 }));
  if (sub) text(ctx, sub, 0, th / 2 - 38, { font: 'MontBold', size: 34, color: '#cfd8ea', maxW: tw - 60 });
  ctx.restore();
}

/** Map label with outline. */
export function label(ctx, str, x, y, { size = 38, color = '#fff', a = 1, font = 'MontXB', dot = false, dotColor = '#fff', up = 0 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  if (dot) { ctx.fillStyle = dotColor; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  text(ctx, str, x, y - up, { font, size, color, stroke: Math.max(5, size * 0.18), shadow: 8 });
  ctx.restore();
}

// ---------- flags ----------
const flagCache = new Map();
export async function flag(code) {
  code = code.toLowerCase();
  if (flagCache.has(code)) return flagCache.get(code);
  const f = path.join(ROOT, 'assets/flags', `${code}.png`);
  if (!fs.existsSync(f)) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const r = await fetch(`https://flagcdn.com/w320/${code}.png`);
    if (!r.ok) { flagCache.set(code, null); return null; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const img = await loadImage(fs.readFileSync(f));
  flagCache.set(code, img);
  return img;
}
export function drawFlag(ctx, img, x, y, h, { a = 1, wave = 0, t = 0, round = 8, shadow = true } = {}) {
  if (!img || a <= 0) return;
  const w = (img.width / img.height) * h;
  ctx.save(); ctx.globalAlpha = a;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; }
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, round); ctx.fillStyle = '#000'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip();
  if (wave) {
    const strips = 24;
    for (let i = 0; i < strips; i++) {
      const sx = (img.width / strips) * i, sw = img.width / strips + 1;
      const dy = Math.sin(t * 6 + i * 0.5) * wave * (i / strips);
      ctx.drawImage(img, sx, 0, sw, img.height, x - w / 2 + (w / strips) * i, y - h / 2 + dy, w / strips + 1, h);
    }
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, `rgba(0,0,0,${0.12 + 0.12 * Math.sin(t * 6 + i * 1.6)})`);
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  } else ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, round); ctx.stroke();
  ctx.restore();
  return w;
}

/** Card with flag + name + big value. */
export function statCard(ctx, { x = W / 2, y = 330, flagImg = null, name = '', value = '', sub = '', a = 1, color = '#ffe14d', w = 860 } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const k = 0.85 + 0.15 * ease.outBack(clamp(a));
  ctx.translate(x, y); ctx.scale(k, k);
  const h = sub ? 250 : 210;
  ctx.fillStyle = 'rgba(8,12,24,0.82)'; roundRect(ctx, -w / 2, -h / 2, w, h, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  let tx = -w / 2 + 40;
  if (flagImg) { const fw = (flagImg.width / flagImg.height) * 110; drawFlag(ctx, flagImg, tx + fw / 2, -h / 2 + 105, 110); tx += fw + 34; }
  text(ctx, name.toUpperCase(), tx, -h / 2 + 62, { font: 'MontBlack', size: 44, align: 'left', maxW: w / 2 + 40 - tx + w / 2 - 40 });
  text(ctx, value, tx, -h / 2 + 140, { font: 'Anton', size: 92, align: 'left', color, maxW: w - 80 - (tx + w / 2) });
  if (sub) text(ctx, sub, 0, h / 2 - 34, { font: 'MontBold', size: 30, color: '#cdd6e6', maxW: w - 60 });
  ctx.restore();
}

export function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
export function fmtBig(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 2).replace(/0$/, '').replace(/\.0$/, '').replace(/\.$/, '') + 'M';
  return fmtInt(n);
}

// ---------- grading & finishing ----------
let grainTiles = null;
export function finish(ctx, T, { vignette = 0.55, grain = 0.05, warm = 0 } = {}) {
  if (vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (warm) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,170,90,${warm})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (grain > 0) {
    if (!grainTiles) {
      grainTiles = [];
      for (let k = 0; k < 4; k++) {
        const c = createCanvas(256, 256); const x = c.getContext('2d'); const d = x.createImageData(256, 256); const r = rng(99 + k);
        for (let i = 0; i < d.data.length; i += 4) { const v = (r() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
        x.putImageData(d, 0, 0); grainTiles.push(c);
      }
    }
    const tile = grainTiles[Math.floor(T * 24) % 4];
    ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(tile, 'repeat'); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** Small source/credit line at the bottom. */
export function credit(ctx, str, a = 0.75) {
  if (!str) return;
  text(ctx, str, W / 2, H - 34, { font: 'MontSemi', size: 20, color: `rgba(255,255,255,${a})`, stroke: 3, strokeColor: 'rgba(0,0,0,0.6)' });
}

// ---------- charts ----------
/** Animated line chart. pts: [[x(0..1), value]], p: reveal 0..1 */
export function lineChart(ctx, pts, p, { x = 80, y = 430, w = 920, h = 620, min = 0, max = 140, color = '#ffb020', grid = [50, 100], unit = '$', labels = [], a = 1 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(6,10,20,0.72)'; roundRect(ctx, x - 30, y - 40, w + 60, h + 110, 28); ctx.fill();
  const X = (u) => x + u * w, Y = (v) => y + h - ((v - min) / (max - min)) * h;
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
  for (const gv of grid) { ctx.beginPath(); ctx.moveTo(x, Y(gv)); ctx.lineTo(x + w, Y(gv)); ctx.stroke(); text(ctx, `${unit}${gv}`, x + 8, Y(gv) - 20, { size: 26, align: 'left', color: 'rgba(255,255,255,0.55)', font: 'MontBold' }); }
  ctx.setLineDash([]);
  const upto = p * (pts[pts.length - 1][0]);
  const vis = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] <= upto) vis.push(pts[i]);
    else { if (i > 0) { const a0 = pts[i - 1], k = (upto - a0[0]) / (pts[i][0] - a0[0]); vis.push([upto, lerp(a0[1], pts[i][1], k)]); } break; }
  }
  if (vis.length > 1) {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, rgba(color, 0.45)); grad.addColorStop(1, rgba(color, 0));
    ctx.beginPath(); ctx.moveTo(X(vis[0][0]), Y(min));
    for (const q of vis) ctx.lineTo(X(q[0]), Y(q[1]));
    ctx.lineTo(X(vis[vis.length - 1][0]), Y(min)); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); vis.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.stroke(); ctx.shadowBlur = 0;
    const last = vis[vis.length - 1];
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
  }
  for (const L of labels) {
    if (L[0] > upto + 0.001) continue;
    text(ctx, L[1], X(L[0]), y + h + 40, { size: 26, color: 'rgba(255,255,255,0.75)', font: 'MontBold' });
  }
  ctx.restore();
  return { X, Y, last: vis[vis.length - 1] };
}

export { smooth };
