// 04 — Why did oil prices go up so much? The real 2026 story (Brent crude, to 3 Nov 2026).
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, fill, loadFlags, flagAt, bigText, tag, headline, text, whiteFlash, label, pulseAt } from '../../engine/kit.mjs';
import { arrow, blast2D, missile, unitIcon, shake, bloomBegin, bloomEnd } from '../../engine/fx.mjs';
import { lineChart } from '../../engine/ui.mjs';
import { rgba } from '../../engine/core.mjs';

// Brent (USD/bbl), approximate closes from EIA / Reuters reporting; spikes marked as intraday
const D = (m, d) => { const days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304]; return (days[m - 1] + d) / 307; };
const BRENT = [[D(1, 2), 61], [D(1, 9), 63.3], [D(1, 31), 70.7], [D(2, 5), 67.6], [D(2, 19), 71.7], [D(2, 27), 72.5], [D(3, 3), 81.5], [D(3, 6), 92.7], [D(3, 9), 101], [D(3, 11), 92], [D(3, 18), 112.2],
  [D(3, 27), 112.6], [D(4, 2), 109], [D(4, 8), 94.8], [D(4, 17), 90.4], [D(4, 23), 105.1], [D(4, 29), 118], [D(4, 30), 126], [D(5, 4), 114.4], [D(5, 6), 100], [D(5, 12), 107.3], [D(5, 19), 111.3],
  [D(5, 27), 94.3], [D(6, 3), 97.8], [D(6, 12), 87.3], [D(6, 19), 80.6], [D(6, 24), 73.7], [D(7, 1), 71.6], [D(7, 8), 78], [D(7, 17), 88.1], [D(7, 23), 100.5], [D(7, 30), 88.4], [D(8, 7), 83.6],
  [D(8, 14), 88.5], [D(8, 20), 93.7], [D(8, 28), 89.3], [D(9, 4), 95.3], [D(9, 9), 101.2], [D(9, 17), 104.8], [D(9, 26), 103.1], [D(10, 1), 102.3], [D(10, 8), 104.3], [D(10, 16), 109.9], [D(10, 23), 113], [D(10, 30), 113.5], [D(11, 3), 105]];
const MONTHS = [[D(1, 1), 'JAN'], [D(3, 1), 'MAR'], [D(5, 1), 'MAY'], [D(7, 1), 'JUL'], [D(9, 1), 'SEP'], [D(11, 1), 'NOV']];
const HORMUZ = [56.42, 26.55];

function pumpSign(ctx, x, y, rows, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  const w = 640, h = 120 + rows.length * 150;
  ctx.fillStyle = '#111418'; ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.roundRect(-w / 2 + 20, -h / 2 + 18, w - 40, 76, 14); ctx.fill();
  text(ctx, 'GAS', 0, -h / 2 + 58, { font: 'Anton', size: 60 });
  rows.forEach(([name, price], i) => {
    const yy = -h / 2 + 130 + i * 150;
    text(ctx, name, -w / 2 + 40, yy + 60, { font: 'MontBlack', size: 40, align: 'left' });
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(-30, yy, 330, 120, 12); ctx.fill();
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 24;
    text(ctx, `$${price.toFixed(2)}`, 135, yy + 62, { font: 'Anton', size: 96, color: '#ffd23c' });
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

export default {
  music: { file: 'tense_doc.mp3', gain: 0.17 },
  async setup(g) { await loadFlags(g, ['us', 'il', 'ir']); },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.05, file: 'ticker.wav', gain: 0.6 }, { t: 1.6, file: 'ticker.wav', gain: 0.6 }, { t: 2.6, file: 'impact.wav', gain: 0.8 },
      { t: L(1) + 0.2, file: 'pop.wav', gain: 0.6 }, { t: L(2) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(2, 'war') - 0.5, file: 'launch.wav', gain: 0.5 }, { t: g.wt(2, 'war') + 0.3, file: 'boom.wav', gain: 0.8 }, { t: g.wt(2, 'iran') + 0.2, file: 'boom_small.wav', gain: 0.6 },
      { t: L(3) + 0.1, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(3, 'shut') - 0.05, file: 'impact.wav', gain: 0.9 },
      { t: g.wt(4, '21') - 0.2, file: 'pop.wav', gain: 0.6 }, { t: g.wt(4, 'fifth') - 0.2, file: 'horn.wav', gain: 0.35, dur: 2.5 },
      { t: L(5) + 0.1, file: 'riser.wav', gain: 0.5 }, { t: g.wt(5, '100') - 0.05, file: 'impact.wav', gain: 0.9 },
      { t: g.wt(6, 'crashed') - 0.1, file: 'whoosh_fast.wav', gain: 0.6 }, { t: g.wt(6, '126') - 0.1, file: 'impact.wav', gain: 0.9 },
      { t: g.wt(7, 'fell') - 0.1, file: 'whoosh.wav', gain: 0.5 },
      { t: L(8) + 0.3, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(8, 'tankers') + 0.1, file: 'boom.wav', gain: 0.8 }, { t: g.wt(8, 'tankers') + 0.5, file: 'boom_small.wav', gain: 0.6 }, { t: g.wt(8, '100') - 0.05, file: 'impact.wav', gain: 0.8 },
      { t: L(9) + 0.2, file: 'ticker.wav', gain: 0.6 }, { t: g.wt(9, 'record') - 0.05, file: 'cash.wav', gain: 0.7 },
      { t: L(10) + 0.2, file: 'boom_small.wav', gain: 0.5 }, { t: g.wt(10, '105') - 0.05, file: 'impact.wav', gain: 0.8 }, { t: g.wt(10, '45') - 0.05, file: 'pop.wav', gain: 0.8 },
      { t: L(11) + 0.1, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(11, 'expensive') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const keys = [
      [0, { lon: 50, lat: 28, zoom: 3.3 }], [L(2) - 0.3, { lon: 50, lat: 28, zoom: 3.6 }], [L(2) + 0.6, { lon: 47, lat: 29, zoom: 4.7 }], [L(3) - 0.2, { lon: 49, lat: 28.5, zoom: 4.8 }],
      [L(3) + 0.9, { lon: 56.5, lat: 26.45, zoom: 8.3 }], [L(5) - 0.3, { lon: 56.5, lat: 26.45, zoom: 8.6 }], [L(5) + 0.8, { lon: 53, lat: 27, zoom: 5.6 }], [L(8) - 0.2, { lon: 53, lat: 27, zoom: 5.7 }],
      [L(8) + 0.8, { lon: 50.5, lat: 26.8, zoom: 6.6 }], [L(9) - 0.3, { lon: 50.5, lat: 26.8, zoom: 6.7 }], [L(9) + 0.6, { lon: 53, lat: 27, zoom: 5.6 }], [L(11) - 0.3, { lon: 53, lat: 27, zoom: 5.7 }], [L(11) + 0.8, { lon: 56.4, lat: 26.5, zoom: 7.3 }], [80, { lon: 56.4, lat: 26.5, zoom: 7.6 }],
    ];
    const cam = camAt(T, keys);
    const sh = [g.wt(2, 'war') + 0.3, g.wt(8, 'tankers') + 0.1].reduce((m, t0) => (T > t0 && T < t0 + 2 ? Math.max(m, 16 * Math.exp(-(T - t0) * 2.5)) : m), 0);
    const [sx, sy] = shake(T, sh);
    ctx.save(); ctx.translate(sx, sy);
    await baseMap(g, cam, { layers: cam.zoom > 6.8 ? ['bluemarble', 's2'] : ['bluemarble'], dim: 0.3, borders: 0.3 });
    // war
    if (T > L(2) - 0.2 && T < L(5) + 0.5) {
      const a = env(T, L(2) - 0.2, L(5) + 0.5, 0.3, 0.5);
      hl(g, cam, 'IRN', '#e5484d', a * 0.9, { fillAlpha: cam.zoom > 6 ? 0.12 : 0.38, glow: cam.zoom > 6 ? 0 : 18 });
      if (T < L(3) + 0.5) { hl(g, cam, 'ISR', '#2f7bff', a); const b = env(T, L(2), L(3) + 0.5, 0.3, 0.3);
        const [ix, iy] = cam.toScreen(54, 33); label(ctx, 'IRAN', ix, iy, { size: 50, a: b });
        const tw = g.wt(2, 'war') - 0.5; const bl = bloomBegin();
        [[[35, 31.5], [51.4, 35.7]], [[35, 31.5], [51.7, 32.6]], [[48, 25], [53.5, 27.2]]].forEach(([s, e], i) => {
          const p = clamp((T - tw - i * 0.25) / 0.8); const A = cam.toScreen(...s), B = cam.toScreen(...e);
          missile(ctx, A, B, p, { a: b, width: 7 }); if (p >= 1) blast2D(ctx, B[0], B[1], 70, T - tw - i * 0.25 - 0.8, { seed: 7 + i, bloom: bl });
        });
        bloomEnd(ctx, bl, 0.9);
        ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = 'rgba(8,12,24,0.82)'; ctx.beginPath(); ctx.roundRect(W / 2 - 330, 190, 660, 160, 28); ctx.fill(); ctx.restore();
        flagAt(g, 'us', W / 2 - 230, 270, 84, b); flagAt(g, 'il', W / 2 - 60, 270, 84, b); text(ctx, 'VS', W / 2 + 70, 268, { font: 'Anton', size: 70, color: '#ffe14d', alpha: b }); flagAt(g, 'ir', W / 2 + 210, 270, 84, b);
        text(ctx, 'FEB 28, 2026', W / 2, 395, { font: 'MontBlack', size: 40, alpha: b, stroke: 8 });
      }
    }
    // Hormuz shut + tankers
    if (T > L(3) && T < L(5) + 0.6) {
      const a = env(T, L(3), L(5) + 0.6, 0.3, 0.4);
      const c = clamp((T - g.wt(3, 'shut')) / 0.3);
      const A = cam.toScreen(56.5, 26.2), B = cam.toScreen(56.3, 26.95);
      ctx.save(); ctx.globalAlpha = a * c; ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 16; ctx.setLineDash([30, 16]); ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore();
      tag(g, 'STRAIT OF HORMUZ: CLOSED', W / 2, 300, { a: a * c, bg: '#c62828', size: 42 });
      // ruler
      const r = clamp((T - g.wt(4, '21') + 0.3) / 0.5);
      if (r > 0) {
        const P1 = cam.toScreen(56.47, 26.43), P2 = cam.toScreen(lerp(56.47, 56.33, r), lerp(26.43, 26.86, r));
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P2[0], P2[1]); ctx.stroke();
        for (const P of [P1, P2]) { ctx.beginPath(); ctx.arc(P[0], P[1], 10, 0, Math.PI * 2); ctx.fillStyle = '#ffe14d'; ctx.fill(); } ctx.restore();
        label(ctx, '21 MILES', (P1[0] + P2[0]) / 2 + 150, (P1[1] + P2[1]) / 2, { size: 52, color: '#ffe14d', a: a * r });
      }
      // queue of stopped tankers
      for (let i = 0; i < 9; i++) {
        const q = clamp((T - L(4) - 0.2 - i * 0.12) / 0.4);
        const [x, y] = cam.toScreen(57.2 + (i % 3) * 0.3, 25.6 + Math.floor(i / 3) * 0.25);
        unitIcon(ctx, 'ship', x, y, 46, Math.PI * 0.85, '#ff8a2a', a * q);
      }
      const f = clamp((T - g.wt(4, 'fifth') + 0.2) / 0.4);
      bigText(g, '20%', 520, a * f, { size: 150, color: '#ffb020', sub: 'OF THE WORLD’S OIL', subColor: '#fff' });
    }
    // Saudi tanker strikes
    if (T > L(8) + 0.3 && T < L(9) + 0.3) {
      const a = env(T, L(8) + 0.3, L(9) + 0.3, 0.3, 0.3);
      const t0 = g.wt(8, 'tankers') + 0.1; const bl = bloomBegin();
      [[50.4, 26.9], [50.9, 26.4], [50.1, 27.3]].forEach((p, i) => {
        const [x, y] = cam.toScreen(...p); unitIcon(ctx, 'ship', x, y, 52, 0.3, '#ff8a2a', a);
        blast2D(ctx, x, y, 80, T - t0 - i * 0.4, { seed: 30 + i, bloom: bl });
      });
      bloomEnd(ctx, bl, 0.9);
      const [lx, ly] = cam.toScreen(47.5, 24.8); label(ctx, 'SAUDI ARABIA', lx, ly, { size: 44, a });
    }
    ctx.restore();
    // ---- hook: pump sign
    if (T < L(1) + 0.2) {
      const a = env(T, 0, L(1) + 0.2, 0.1, 0.3);
      const k = ease.inQuad(clamp(T / 2.6));
      pumpSign(ctx, W / 2, 900, [['REGULAR', lerp(3.09, 4.29, k) + Math.sin(T * 40) * 0.02 * (1 - k)], ['DIESEL', lerp(3.69, 6.06, k)]], a);
      headline(ctx, 'Why did oil prices\ngo up so much?', { y: 230, a: env(T, 0.05, L(1), 0.2, 0.3) });
    }
    // ---- diesel record
    if (T > L(9) - 0.1 && T < L(10) + 0.2) {
      const a = env(T, L(9) - 0.1, L(10) + 0.2, 0.25, 0.3);
      const k = prog(T, L(9) + 0.2, g.wt(9, 'record'), ease.outCubic);
      pumpSign(ctx, W / 2, 820, [['DIESEL', lerp(5.2, 6.06, k)]], a);
      tag(g, 'RECORD HIGH • SEP 11', W / 2, 560, { a: a * clamp((T - g.wt(9, 'record')) / 0.3), bg: '#c62828', size: 40 });
    }
    // ---- chart
    const chartOn = (T > L(1) - 0.1 && T < L(2) + 0.2) || (T > L(5) - 0.1 && T < L(9) - 0.1) || (T > L(10) - 0.1 && T < L(11) + 0.1);
    if (chartOn) {
      const a = Math.max(env(T, L(1) - 0.1, L(2) + 0.2, 0.25, 0.3), env(T, L(5) - 0.1, L(9) - 0.1, 0.3, 0.3), env(T, L(10) - 0.1, L(11) + 0.1, 0.3, 0.3));
      // reveal: Feb 27 at L1, Mar 9 by end of L5, Apr 30 by L6 end, Jul 1 by L7 end, Jul 23 by L8 end, Nov 3 by L10
      const rv = [[L(1), D(1, 2)], [L(1) + 2.2, D(2, 27)], [L(5) + 0.2, D(2, 27)], [g.wt(5, '100'), D(3, 9)], [L(6) + 0.3, D(3, 27)], [g.wt(6, 'crashed') + 0.2, D(4, 8)], [g.wt(6, '126'), D(4, 30)],
        [L(7) + 0.3, D(5, 20)], [g.wt(7, '72'), D(7, 1)], [L(8) + 0.5, D(7, 8)], [g.wt(8, '100'), D(7, 23)], [L(10) + 0.4, D(9, 26)], [g.wt(10, '105'), D(11, 3)]];
      let x = rv[0][1];
      for (let i = 1; i < rv.length; i++) { if (T >= rv[i][0]) x = rv[i][1]; else { x = lerp(rv[i - 1][1], rv[i][1], ease.inOutQuad(clamp((T - rv[i - 1][0]) / (rv[i][0] - rv[i - 1][0])))); break; } }
      const res = lineChart(ctx, BRENT, x, { x: 110, y: 440, w: 860, h: 560, min: 50, max: 135, grid: [60, 80, 100, 120], color: '#ffb020', labels: MONTHS, a });
      text(ctx, 'BRENT CRUDE, $ PER BARREL', W / 2, 430 - 20, { font: 'MontBlack', size: 30, color: 'rgba(255,255,255,0.8)', alpha: a });
      if (res.last) {
        const [px, py] = [res.X(res.last[0]), res.Y(res.last[1])];
        text(ctx, `$${Math.round(res.last[1])}`, px, py - 64, { font: 'Anton', size: 76, color: '#fff', stroke: 10, alpha: a });
      }
      const marks = [[D(3, 9), 101, '$100 · MAR 9', g.wt(5, '100'), -150], [D(4, 8), 94.8, 'CEASEFIRE', g.wt(6, 'crashed'), 44], [D(4, 30), 126, '4-YR HIGH $126', g.wt(6, '126'), -40], [D(7, 1), 71.6, 'STRAIT REOPENS', g.wt(7, 'deal'), 44], [D(7, 23), 100.5, 'STRIKES RESUME', g.wt(8, 'strikes'), -150]];
      for (const [mx, mv, s, t0, off] of marks) { const b = clamp((T - t0) / 0.3) * a; if (b > 0) { ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(res.X(mx), res.Y(mv), 9, 0, Math.PI * 2); ctx.fill(); ctx.restore(); text(ctx, s, res.X(mx) + (off < -100 ? -20 : 0), res.Y(mv) + (off < -100 ? -46 : off), { font: 'MontBlack', size: 24, alpha: b, stroke: 6 }); } }
      const pc = clamp((T - g.wt(10, '45')) / 0.3) * a;
      if (pc > 0) tag(g, '+45% SINCE FEBRUARY', W / 2, 1160, { a: pc, bg: '#c62828', size: 46 });
    }
    // ---- ending
    if (T > L(11)) {
      const a = env(T, L(11), 99, 0.3, 0.3);
      tag(g, 'STILL MOSTLY CLOSED', W / 2, 300, { a, bg: '#c62828', size: 46 });
      const A = cam.toScreen(56.5, 26.2), B = cam.toScreen(56.3, 26.95);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 16; ctx.setLineDash([30, 16]); ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore();
    }
    g.creditText = (g.creditText ? g.creditText + ' · ' : '') + 'Prices: EIA, Reuters (Brent, approx.)';
  },
};
