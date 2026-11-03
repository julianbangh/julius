// 08 — What if the oceans dropped 120 m? Real bathymetry reveals the Ice Age coastlines.
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, bigText, tag, headline, text, label } from '../../engine/kit.mjs';
import { drawSeaDrop } from '../../engine/terrain.mjs';
import { unitIcon } from '../../engine/fx.mjs';

function gauge(ctx, drop, a) {
  if (a <= 0) return;
  const x = W - 120, y0 = 430, h = 620;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(6,10,20,0.8)'; ctx.beginPath(); ctx.roundRect(x - 70, y0 - 70, 140, h + 150, 24); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(x - 22, y0, 44, h, 22); ctx.fill();
  const k = clamp(drop / 120);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#5ec8ff'); g.addColorStop(1, '#1a4f8f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - 22, y0 + h * k, 44, h * (1 - k), 22); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '22px MontBold'; ctx.textAlign = 'center';
  for (const m of [0, 40, 80, 120]) { const yy = y0 + (h * m) / 120; ctx.fillRect(x + 26, yy - 1, 14, 3); }
  ctx.restore();
  text(ctx, 'SEA LEVEL', x, y0 - 36, { font: 'MontBlack', size: 22, alpha: a });
  text(ctx, `-${Math.round(drop)} m`, x, y0 + h + 44, { font: 'Anton', size: 46, color: '#5ec8ff', alpha: a, stroke: 6 });
}

export default {
  music: { file: 'curious.mp3', gain: 0.16, start: 10 },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.2, file: 'drain.wav', gain: 0.5, dur: 3.2 }, { t: 3.3, file: 'impact.wav', gain: 0.7 },
      { t: L(1) + 0.2, file: 'drain.wav', gain: 0.35, dur: 2.5 }, { t: L(2) + 0.4, file: 'drain.wav', gain: 0.4, dur: 3 }, { t: g.wt(2, 'doggerland') - 0.1, file: 'pop.wav', gain: 0.7 },
      { t: L(3) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(3, 'bering') - 0.1, file: 'pop.wav', gain: 0.7 },
      { t: L(4) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: L(4) + 0.8, file: 'drain.wav', gain: 0.4, dur: 3 },
      { t: L(5) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: L(5) + 0.8, file: 'drain.wav', gain: 0.4, dur: 3 }, { t: g.wt(5, 'sundaland') - 0.1, file: 'pop.wav', gain: 0.7 },
      { t: L(6) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(6, 'single') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: L(7) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(7, '20000') - 0.1, file: 'impact.wav', gain: 0.7 }, { t: g.wt(8, 'who') - 0.1, file: 'impact.wav', gain: 0.8 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const keys = [
      [0, { lon: 112, lat: 0, zoom: 3.5 }], [3.6, { lon: 112, lat: 0, zoom: 3.6 }], [4.4, { lon: 6.2, lat: 53.6, zoom: 7.0 }], [L(2) - 0.2, { lon: 6.2, lat: 53.6, zoom: 7.1 }],
      [L(2) + 0.8, { lon: 2.5, lat: 54, zoom: 5.0 }], [L(3) - 0.2, { lon: 2.5, lat: 54, zoom: 5.1 }], [L(3) + 0.9, { lon: -170, lat: 64.5, zoom: 4.6 }], [L(4) - 0.2, { lon: -170, lat: 64.5, zoom: 4.7 }],
      [L(4) + 0.9, { lon: 51.5, lat: 27, zoom: 5.4 }], [L(5) - 0.2, { lon: 51.5, lat: 27, zoom: 5.5 }], [L(5) + 0.9, { lon: 108, lat: 3, zoom: 4.3 }], [L(6) - 0.2, { lon: 108, lat: 3, zoom: 4.35 }],
      [L(6) + 0.9, { lon: 138, lat: -12, zoom: 3.9 }], [L(7) - 0.2, { lon: 138, lat: -12, zoom: 3.95 }], [L(7) + 1.0, { lon: 118, lat: 8, zoom: 3.15 }], [99, { lon: 112, lat: 8, zoom: 3.25 }],
    ];
    const cam = camAt(T, keys);
    // sea-level track (metres below today)
    const drop = T < 3.7 ? 120 * ease.inOutCubic(clamp((T - 0.3) / 2.8)) : T < 4.4 ? 120 * (1 - prog(T, 3.7, 4.4)) :
      T < L(2) ? 10 * prog(T, L(1) + 0.2, L(1) + 2.5) : T < L(3) ? lerp(10, 50, prog(T, L(2) + 0.6, L(2) + 3.8)) : T < L(4) ? lerp(50, 55, prog(T, L(3) + 1, L(3) + 3)) :
      T < L(5) ? lerp(55, 70, prog(T, L(4) + 1, L(4) + 3.6)) : T < L(6) ? lerp(70, 100, prog(T, L(5) + 1, L(5) + 4)) : T < L(7) ? lerp(100, 120, prog(T, L(6) + 0.9, L(6) + 3.4)) : 120;
    await baseMap(g, cam, { layers: cam.zoom > 6.2 ? ['bluemarble', 's2'] : ['bluemarble'], dim: 0.12, borders: 0.28 });
    await drawSeaDrop(ctx, cam, drop);
    g.creditText += ' · Elevation: AWS Terrain Tiles';
    gauge(ctx, drop, T > 0.2 ? 1 : 0);
    if (T < 3.9) headline(ctx, 'What if the oceans\ndropped 120 m?', { y: 220, a: env(T, 0.05, 3.9, 0.2, 0.3) });
    const lab = (s, lon, lat, t0, t1, size = 46, color = '#fff') => { const a = env(T, t0, t1, 0.3, 0.3); if (a > 0) { const [x, y] = cam.toScreen(lon, lat); label(ctx, s, x, y, { size, a, color }); } };
    // -10: harbours
    if (T > L(1) && T < L(2)) {
      const a = env(T, L(1), L(2), 0.3, 0.3);
      const [x, y] = cam.toScreen(5.2, 53.35); unitIcon(ctx, 'ship', x, y, 60, 0.4 + Math.sin(T * 2) * 0.03, '#ff8a2a', a);
      tag(g, 'HARBORS RUN DRY', W / 2 - 60, 300, { a: a * clamp((T - g.wt(1, 'harbors')) / 0.3), bg: '#1b2a44', size: 44 });
      lab('WADDEN SEA', 6.4, 53.75, L(1) + 0.4, L(2), 40, '#ffe9a6');
    }
    lab('DOGGERLAND', 2.8, 54.7, g.wt(2, 'doggerland') - 0.2, L(3), 56, '#ffe9a6');
    lab('BRITAIN', -2.2, 53, L(2) + 0.6, L(3), 40);
    lab('BERINGIA', -169, 65.6, g.wt(3, 'bering') - 0.3, L(4), 56, '#ffe9a6');
    lab('ASIA', 178, 67.5, L(3) + 0.8, L(4), 40); lab('AMERICA', -158, 66.5, L(3) + 0.8, L(4), 40);
    // first Americans walking path
    if (T > g.wt(3, 'path') - 0.5 && T < L(4)) {
      const a = env(T, g.wt(3, 'path') - 0.5, L(4), 0.3, 0.3), p = prog(T, g.wt(3, 'path') - 0.4, L(4) - 0.4);
      const pts = [[176, 66], [-178, 65.6], [-172, 65.2], [-166, 65.4], [-160, 66.5]].map((q) => cam.toScreen(...q));
      ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([6, 14]); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 8; ctx.beginPath();
      const n = Math.max(1, Math.round((pts.length - 1) * p)); for (let i = 0; i <= n; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore();
    }
    lab('PERSIAN GULF: DRAINED', 51.5, 27.4, L(4) + 1.4, L(5), 44, '#ffe9a6'); lab('IRAN', 54.5, 30.8, L(4) + 0.8, L(5), 40); lab('SAUDI ARABIA', 46, 24.5, L(4) + 0.8, L(5), 40);
    lab('SUNDALAND', 108, 4.5, g.wt(5, 'sundaland') - 0.3, L(6), 60, '#ffe9a6'); lab('BORNEO', 114, 0.5, L(5) + 1.2, L(6), 36); lab('SUMATRA', 101, -1.5, L(5) + 1.2, L(6), 36);
    lab('SAHUL', 138, -11, g.wt(6, 'single') - 0.3, L(7), 64, '#ffe9a6'); lab('AUSTRALIA', 134, -24, L(6) + 0.8, L(7), 40); lab('NEW GUINEA', 143, -5, L(6) + 0.8, L(7), 36);
    if (T > L(7) - 0.1) {
      const a = env(T, L(7) - 0.1, L(8) - 0.2, 0.3, 0.3);
      bigText(g, '20,000 YEARS AGO', 300, a * clamp((T - g.wt(7, '20000') + 0.2) / 0.3), { size: 96, color: '#fff', sub: 'THE LAST ICE AGE', subColor: '#5ec8ff' });
    }
    if (T > L(8) - 0.2) {
      const a = env(T, L(8) - 0.2, 99, 0.3, 0.3);
      for (const [lon, lat] of [[108, 4], [138, -11], [2.8, 54.7], [-169, 65]]) { const [x, y] = cam.toScreen(lon, lat); text(ctx, '?', x, y, { font: 'Anton', size: 90, color: '#ffe14d', stroke: 10, alpha: a * (0.6 + 0.4 * Math.sin(T * 6 + lon)) }); }
      bigText(g, 'WHO GETS THE NEW LAND?', 300, a * clamp((T - g.wt(8, 'who') + 0.2) / 0.3), { size: 84, color: '#ffe14d' });
    }
  },
};
