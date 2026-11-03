// 07 — The Mercator lie: true sizes, by sliding countries on the sphere (shape and area preserved).
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, outline, bigText, tag, headline, text, label, mainPolygon, drawMoved, centroidOf } from '../../engine/kit.mjs';
import { geomScreenPath } from '../../engine/geo.mjs';
import { deg } from '../../engine/core.mjs';

const GRN = '#5ec8ff', AFR = '#ffb020', RUS = '#e5484d', CAN = '#ff6b6b', BRA = '#2fd27a';
const EUROPE = [['FRA', [-8.5, 9], 0], ['ESP', [-1, 7.5], 0], ['DEU', [-11.5, 15.5], 0], ['ITA', [6, 6.5], 35], ['GBR', [42, 6], 0], ['POL', [15, -27], 0], ['ROU', [26, -32], 0], ['GRC', [36, -6], 0], ['PRT', [-14, 12], 0], ['AUT', [12, 7.5], 0]];
const FIT = [['USA', [2, 19.5], '#2f7bff', 'USA', 0], ['CHN', [30, 1], '#e5484d', 'CHINA', -18], ['IND', [26, -20], '#ff8a2a', 'INDIA', 8]];

function circlePts(lon, lat, km, n = 48) {
  const R = 6371, d = km / R, out = [];
  const la = lat * deg, lo = lon * deg;
  for (let i = 0; i <= n; i++) {
    const b = (i / n) * 2 * Math.PI;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    out.push([lo2 / deg, la2 / deg]);
  }
  return out;
}

export default {
  music: { file: 'curious.mp3', gain: 0.17 },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.1, file: 'riser.wav', gain: 0.4 }, { t: g.wt(0, 'lying') - 0.05, file: 'impact.wav', gain: 0.8 },
      { t: L(1) + 0.4, file: 'pop.wav', gain: 0.6 }, { t: g.wt(1, 'africa') - 0.1, file: 'pop.wav', gain: 0.6 },
      { t: L(2) + 0.6, file: 'whoosh.wav', gain: 0.7 }, { t: g.wt(3, '14') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: L(4) + 0.6, file: 'ticker.wav', gain: 0.4 }, { t: L(5) + 0.2, file: 'pop.wav', gain: 0.6 }, { t: g.wt(5, 'slide') - 0.1, file: 'whoosh.wav', gain: 0.7 },
      { t: L(6) + 0.2, file: 'pop.wav', gain: 0.6 }, { t: g.wt(6, 'reality') - 0.2, file: 'whoosh.wav', gain: 0.7 }, { t: g.wt(6, '17') - 0.1, file: 'impact.wav', gain: 0.7 },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ t: L(7) + 0.5 + i * 0.35, file: 'pop.wav', gain: 0.5 })), { t: g.wt(8, 'lie') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const keys = [[0, { lon: -12, lat: 30, zoom: 3.25 }], [L(4) - 0.2, { lon: -12, lat: 30, zoom: 3.25 }], [L(4) + 0.8, { lon: 0, lat: 20, zoom: 2.95 }], [L(5) - 0.2, { lon: 0, lat: 20, zoom: 2.95 }],
      [L(5) + 0.6, { lon: 50, lat: 30, zoom: 3.2 }], [L(6) - 0.2, { lon: 50, lat: 30, zoom: 3.2 }], [L(6) + 0.7, { lon: -75, lat: 22, zoom: 3.2 }], [L(7) - 0.2, { lon: -75, lat: 22, zoom: 3.2 }], [L(7) + 0.7, { lon: 20, lat: 3, zoom: 3.55 }], [99, { lon: 20, lat: 3, zoom: 3.6 }]];
    const cam = camAt(T, keys);
    await baseMap(g, cam, { dim: 0.35, borders: 0.22 });
    // hook
    if (T < L(1)) {
      headline(ctx, 'This map is\nlying to you', { y: 240, a: env(T, 0.05, L(1), 0.2, 0.3) });
      const s = clamp((T - g.wt(0, 'lying') + 0.05) / 0.2);
      ctx.save(); ctx.translate(W / 2, 620); ctx.rotate(-0.1); tag(g, 'FAKE SIZES', 0, 0, { a: s, bg: '#c62828', size: 70 }); ctx.restore();
    }
    // Greenland vs Africa
    const grn = g.countries.get('GRL'), afr = 'Africa';
    if (T > L(1) - 0.1 && T < L(4)) {
      const a = env(T, L(1) - 0.1, L(4), 0.3, 0.4);
      hl(g, cam, 'GRL', GRN, a * clamp((T - L(1) - 0.3) / 0.3), { fillAlpha: 0.5 });
      const af = clamp((T - g.wt(1, 'africa') + 0.1) / 0.3) * a;
      for (const c of g.countries.list) if (c.continent === afr) hl(g, cam, c.id, AFR, af, { fillAlpha: 0.4, glow: 0, edge: 1 });
      // slide a true-size copy down
      const from = centroidOf(grn.geometry);
      const q = ease.inOutCubic(clamp((T - L(2) - 0.5) / 2.6));
      const q2 = ease.inOutCubic(clamp((T - L(3) - 0.2) / 1.6));
      const to = [lerp(lerp(from[0], -28, q), 20, q2), lerp(lerp(from[1], 2, q), 4, q2)];
      if (T > L(2) + 0.3) {
        drawMoved(g, cam, mainPolygon(grn.geometry), from, to, { fill: GRN, alpha: 0.8, a });
        const [x, y] = cam.toScreen(...to); label(ctx, 'GREENLAND', x, y, { size: 34, a });
      }
      const [ax, ay] = cam.toScreen(20, -8);
      if (T < L(2) + 0.3) label(ctx, 'AFRICA', ax, ay, { size: 56, a: af });
      const k = clamp((T - g.wt(3, '14') + 0.1) / 0.3) * a;
      bigText(g, '14× BIGGER', 300, k, { size: 140, color: AFR, sub: 'AFRICA vs GREENLAND', subColor: '#fff' });
    }
    // Mercator + Tissot circles
    if (T > L(4) - 0.1 && T < L(5)) {
      const a = env(T, L(4) - 0.1, L(5), 0.3, 0.3);
      const n = prog(T, L(4) + 0.5, L(4) + 3.5);
      let i = 0;
      for (const lat of [-60, -40, -20, 0, 20, 40, 60, 70]) for (const lon of [-120, -80, -40, 0, 40, 80, 120]) {
        const c = clamp(n * 12 - i++ * 0.15); if (c <= 0) continue;
        const pts = circlePts(lon, lat, 420).map((p) => cam.toScreen(...p));
        ctx.save(); ctx.globalAlpha = a * c * 0.85; ctx.fillStyle = 'rgba(255,225,77,0.35)'; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.5;
        ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      tag(g, 'MERCATOR PROJECTION • 1569', W / 2, 260, { a, bg: '#1b2a44', size: 40 });
      text(ctx, 'EVERY CIRCLE IS THE SAME REAL SIZE', W / 2, 360, { font: 'MontBlack', size: 34, alpha: a * clamp((T - L(4) - 2) / 0.4), stroke: 8 });
    }
    // Russia vs Africa
    if (T > L(5) - 0.1 && T < L(6)) {
      const a = env(T, L(5) - 0.1, L(6), 0.3, 0.3);
      for (const c of g.countries.list) if (c.continent === afr) hl(g, cam, c.id, AFR, a * 0.8, { fillAlpha: 0.35, glow: 0, edge: 1 });
      hl(g, cam, 'RUS', RUS, a * (1 - prog(T, g.wt(5, 'slide'), g.wt(5, 'slide') + 0.6)) , { fillAlpha: 0.55 });
      const rus = g.countries.get('RUS'), from = centroidOf(rus.geometry);
      const q = ease.inOutCubic(clamp((T - g.wt(5, 'slide')) / 2.2));
      if (T > g.wt(5, 'slide') - 0.2) { const to = [lerp(from[0], 20, q), lerp(from[1], 5, q)]; drawMoved(g, cam, mainPolygon(rus.geometry), from, to, { fill: RUS, alpha: 0.75, a }); const [x, y] = cam.toScreen(...to); label(ctx, 'RUSSIA', x, y, { size: 40, a }); }
      const s = clamp((T - g.wt(5, 'smaller') + 0.1) / 0.3) * a;
      bigText(g, 'SMALLER THAN AFRICA', 300, s, { size: 84, color: '#fff', sub: 'RUSSIA 17.1M km²  vs  AFRICA 30.4M km²', subColor: AFR });
    }
    // Canada vs Brazil
    if (T > L(6) - 0.1 && T < L(7)) {
      const a = env(T, L(6) - 0.1, L(7), 0.3, 0.3);
      hl(g, cam, 'BRA', BRA, a, { fillAlpha: 0.5 });
      const can = g.countries.get('CAN'), from = centroidOf(can.geometry);
      const q = ease.inOutCubic(clamp((T - g.wt(6, 'reality') + 0.2) / 2.0));
      hl(g, cam, 'CAN', CAN, a * (1 - q), { fillAlpha: 0.5 });
      if (q > 0) { const to = [lerp(from[0], -54, q), lerp(from[1], -9, q)]; drawMoved(g, cam, mainPolygon(can.geometry), from, to, { fill: CAN, alpha: 0.6, a }); }
      const [bx, by] = cam.toScreen(-52, -12); label(ctx, 'BRAZIL', bx, by + 120, { size: 40, a });
      const s = clamp((T - g.wt(6, '17') + 0.1) / 0.3) * a;
      bigText(g, 'ONLY 17% BIGGER', 300, s, { size: 104, color: CAN, sub: 'CANADA 9.98M km²  vs  BRAZIL 8.5M km²', subColor: '#fff' });
    }
    // fit everything inside Africa
    if (T > L(7) - 0.1) {
      const a = env(T, L(7) - 0.1, 99, 0.3, 0.3);
      for (const c of g.countries.list) if (c.continent === afr) outline(g, cam, c.id, AFR, 3, a);
      const items = [...FIT.map((f) => [f[0], f[1], f[2], f[3], f[4]]), ...EUROPE.map(([id, to, r]) => [id, to, '#a78bfa', '', r])];
      items.forEach(([id, to, col, nm, roll], i) => {
        const c = g.countries.get(id), from = centroidOf(c.geometry);
        const t0 = L(7) + 0.5 + Math.min(i, 3) * 0.35 + Math.max(0, i - 3) * 0.12;
        const q = ease.outCubic(clamp((T - t0) / 0.8));
        if (q <= 0) return;
        const start = [to[0] + (from[0] - to[0]) * (1 - q), to[1] + (from[1] - to[1]) * (1 - q)];
        drawMoved(g, cam, mainPolygon(c.geometry), from, start, { fill: col, alpha: 0.7, a, width: 2, glow: 6, roll: roll * q });
        if (nm) { const [x, y] = cam.toScreen(...start); label(ctx, nm, x, y, { size: 38, a: a * q }); }
      });
      const e = clamp((T - L(7) - 2.6) / 0.4) * a;
      const [ex, ey] = cam.toScreen(-6, 6); label(ctx, '+ EUROPE', ex, ey + 110, { size: 40, color: '#d6c8ff', a: e });
      const l = clamp((T - g.wt(8, 'lie') + 0.1) / 0.3);
      bigText(g, 'THE SIZES ARE A LIE', 280, l, { size: 92, color: '#fff' });
    }
  },
};
