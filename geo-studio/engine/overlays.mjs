// Geo Studio overlays that sit on top of live footage: stat pills, count-ups, soft scene cuts.
import { W, H, clamp, ease } from './core.mjs';
import { text } from './ui.mjs';

/** A clean number overlay: big value + small caption on a dark pill, centred at y. a = 0..1. */
export function statPill(ctx, value, sub, y, a, color = '#ffffff') {
  if (a <= 0) return;
  const k = 0.94 + 0.06 * ease.outCubic(a);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y); ctx.scale(k, k);
  ctx.font = '104px Anton'; const w = Math.max(ctx.measureText(value).width + 110, 520);
  ctx.fillStyle = 'rgba(6,10,20,0.58)'; ctx.beginPath(); ctx.roundRect(-w / 2, -86, w, 172, 26); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y); ctx.scale(k, k);
  text(ctx, value, 0, -16, { font: 'Anton', size: 104, color, shadow: 16 });
  text(ctx, sub, 0, 54, { font: 'MontBlack', size: 30, color: '#d7dfef' });
  ctx.restore();
}

/** Value counting up from 0 to v between t0 and t1 (ease-out). */
export const countUp = (T, t0, t1, v) => v * ease.outCubic(clamp((T - t0) / (t1 - t0)));

/** Soft cuts: a short fade up from black after each cut time, and a fade in on frame 0. */
export function softCuts(g, T, cuts, { dur = 0.16, depth = 0.7, intro = 0.25 } = {}) {
  const ctx = g.ctx;
  let a = 0;
  for (const c of cuts) if (c > 0 && T > c && T < c + dur) a = Math.max(a, depth * (1 - (T - c) / dur));
  if (T < intro) a = Math.max(a, 1 - T / intro);
  if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
}
