// 09 — What if the Roman Empire came back today? (117 AD provinces: AWMC / klokantech roman-empire, CC BY 4.0)
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, fill, outline, loadFlags, flagAt, bigText, tag, headline, text, label, pulseAt } from '../../engine/kit.mjs';
import { lonLatToWorld, loadGeoJSON } from '../../engine/geo.mjs';
import { Path2D } from '../../engine/core.mjs';

const ROME = '#b3122e', EAST = '#7b3fe4', GOLD = '#ffc83d';
const INSIDE = ['TUR', 'ITA', 'FRA', 'EGY', 'ESP', 'GBR', 'DEU', 'BEL', 'SYR', 'GRC', 'TUN', 'PRT', 'ISR', 'ROU', 'CHE', 'AUT', 'NLD', 'BGR', 'LBN', 'SRB', 'DZA', 'PSX', 'MAR', 'HUN', 'HRV', 'BIH', 'ALB', 'JOR', 'SVN', 'MKD', 'LBY', 'KOS', 'CYP', 'LUX', 'MNE', 'CYN', 'MLT', 'JEY', 'AND', 'GGY', 'MCO', 'LIE', 'SMR', 'VAT'];
const CITIES = [['LONDON', -0.13, 51.5, 'london'], ['PARIS', 2.35, 48.86, 'paris'], ['MADRID', -3.7, 40.42, 'madrid'], ['ISTANBUL', 28.98, 41.01, 'istanbul'], ['CAIRO', 31.24, 30.04, 'cairo'], ['JERUSALEM', 35.21, 31.77, 'jerusalem']];
let PROV = [];

function provPath(geom) {
  const p = new Path2D();
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  let x0 = 1e9, y0 = 1e9;
  for (const poly of polys) for (const [lon, lat] of poly[0]) { const [x, y] = lonLatToWorld(lon, lat, 8); x0 = Math.min(x0, x); y0 = Math.min(y0, y); }
  let cx = 0, cy = 0, n = 0;
  for (const poly of polys) for (const ring of poly) ring.forEach(([lon, lat], i) => { const [x, y] = lonLatToWorld(lon, lat, 8); if (i === 0) p.moveTo(x - x0, y - y0); else p.lineTo(x - x0, y - y0); cx += lon; cy += lat; n++; });
  return { path: p, ox: x0, oy: y0, c: [cx / n, cy / n] };
}
function drawProv(ctx, cam, pr, fillC, a, dx = 0) {
  ctx.save(); ctx.translate(dx, 0);
  const s = cam.applyZ8(ctx, pr.ox, pr.oy, 0);
  const m = ctx.getTransform(); ctx.setTransform(m.a, m.b, m.c, m.d, m.e + dx, m.f);
  ctx.globalAlpha = a * 0.62; ctx.fillStyle = fillC; ctx.fill(pr.path, 'evenodd');
  ctx.globalAlpha = a * 0.9; ctx.strokeStyle = '#ffd6dd'; ctx.lineWidth = 1.4 / s; ctx.stroke(pr.path);
  ctx.restore();
}

export default {
  music: { file: 'epic_war.mp3', gain: 0.16, start: 35 },
  async setup(g) {
    const gj = loadGeoJSON('data/roman_provinces.geojson');
    PROV = gj.features.filter((f) => f.geometry).map((f) => ({ name: f.properties.name, ...provPath(f.geometry) }));
    for (const p of PROV) p.d = Math.hypot(p.c[0] - 12.5, p.c[1] - 42);
    await loadFlags(g, ['fr', 'gb', 'it', 'tr']);
  },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.1, file: 'riser.wav', gain: 0.4 }, { t: 1.9, file: 'impact.wav', gain: 0.8 },
      { t: L(1) + 0.3, file: 'whoosh.wav', gain: 0.5 }, { t: g.wt(1, '5') - 0.1, file: 'ticker.wav', gain: 0.4 },
      { t: L(2) + 0.6, file: 'ticker.wav', gain: 0.5, dur: 1.6 }, { t: g.wt(2, '40') - 0.1, file: 'impact.wav', gain: 0.8 },
      ...CITIES.map((c) => ({ t: g.wt(3, c[3]) - 0.05, file: 'pop.wav', gain: 0.6 })),
      { t: L(4) + 0.2, file: 'ticker.wav', gain: 0.5 }, { t: g.wt(4, 'more') - 0.1, file: 'pop.wav', gain: 0.7 },
      { t: g.wt(5, '16') - 0.1, file: 'cash.wav', gain: 0.6 }, { t: g.wt(5, 'third') - 0.1, file: 'impact.wav', gain: 0.7 },
      { t: L(6) + 0.2, file: 'impact.wav', gain: 0.8 }, { t: L(7) + 0.3, file: 'whoosh.wav', gain: 0.5 }, { t: g.wt(7, 'paris') - 0.05, file: 'pop.wav', gain: 0.6 }, { t: g.wt(7, 'london') - 0.05, file: 'pop.wav', gain: 0.6 },
      { t: g.wt(8, 'splits') - 0.1, file: 'boom.wav', gain: 0.7 }, { t: g.wt(8, 'last') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const keys = [[0, { lon: 12.5, lat: 41.9, zoom: 6.5 }], [2.4, { lon: 14, lat: 40, zoom: 4.5 }], [L(3) - 0.2, { lon: 16, lat: 40, zoom: 4.3 }], [99, { lon: 17, lat: 40, zoom: 4.35 }]];
    const cam = camAt(T, keys);
    await baseMap(g, cam, { dim: 0.3, borders: T > L(2) - 0.2 ? 0.32 * clamp((T - L(2) + 0.2) / 0.5) : 0.08 });
    g.creditText += ' · Roman provinces: AWMC (CC BY 4.0)';
    // provinces spread from Rome
    const grow = prog(T, 0.3, L(1) + 3.2, ease.inOutQuad) * 40;
    const split = prog(T, g.wt(8, 'splits') - 0.2, g.wt(8, 'splits') + 1.2, ease.inOutCubic);
    const dim = T > L(2) - 0.2 && T < L(7) ? 0.55 : 1;
    for (const p of PROV) {
      const a = clamp((grow - p.d) / 4);
      if (a <= 0) continue;
      const west = p.c[0] < 19.4;
      const col = split > 0 && !west ? EAST : ROME;
      drawProv(ctx, cam, p, col, a * dim, split * (west ? -40 : 40));
    }
    // modern countries inside
    if (T > L(2) - 0.2 && T < L(4)) {
      const a = env(T, L(2) - 0.2, L(4), 0.3, 0.4);
      let n = 0;
      INSIDE.forEach((id, i) => { const q = clamp((T - L(2) - 0.4 - i * 0.05) / 0.25); if (q > 0 && g.countries.get(id)) { n++; outline(g, cam, id, '#ffe14d', 2.5, a * q); } });
      const k = Math.round(44 * prog(T, L(2) + 0.4, L(2) + 2.6));
      bigText(g, `${k} COUNTRIES`, 300, a, { size: 120, color: GOLD });
    }
    // headline + hook
    if (T < L(1)) headline(ctx, 'What if Rome\ncame back?', { y: 220, a: env(T, 0.05, L(1) + 0.3, 0.2, 0.3) });
    if (T > L(1) - 0.1 && T < L(2)) {
      const a = env(T, L(1) - 0.1, L(2), 0.3, 0.3);
      tag(g, '117 AD • PEAK OF ROME', W / 2, 250, { a, bg: ROME, size: 44 });
      const km = Math.round(5e6 * prog(T, g.wt(1, '5') - 0.6, g.wt(1, '5') + 0.8));
      bigText(g, `${km.toLocaleString('en-US')} km²`, 400, a * clamp((T - g.wt(1, '5') + 0.8) / 0.3), { size: 96 });
      const [bx, by] = cam.toScreen(-2, 53.5); label(ctx, 'BRITAIN', bx, by, { size: 40, a: a * clamp((T - g.wt(1, 'britain')) / 0.3) });
      const [ex, ey] = cam.toScreen(31, 26); label(ctx, 'EGYPT', ex, ey, { size: 40, a: a * clamp((T - g.wt(1, 'egypt')) / 0.3) });
    }
    // cities
    if (T > L(3) - 0.2 && T < L(4) + 0.5) {
      const a = env(T, L(3) - 0.2, L(4) + 0.5, 0.2, 0.4);
      for (const [n, lon, lat, w] of CITIES) { const q = clamp((T - g.wt(3, w) + 0.1) / 0.25); if (q <= 0) continue; const [x, y] = cam.toScreen(lon, lat); pulseAt(g, cam, lon, lat, 60, GOLD, a * q); label(ctx, n, x, y - 46, { size: 36, a: a * q }); }
    }
    // population vs EU
    if (T > L(4) - 0.1 && T < L(5)) {
      const a = env(T, L(4) - 0.1, L(5), 0.25, 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.86)'; ctx.beginPath(); ctx.roundRect(70, 160, W - 140, 420, 32); ctx.fill(); ctx.restore();
      const p1 = prog(T, L(4) + 0.3, L(4) + 1.6, ease.outCubic), p2 = prog(T, g.wt(4, 'more') - 0.2, g.wt(4, 'more') + 0.8, ease.outCubic);
      const bw = W - 380;
      text(ctx, 'NEW ROME', 120, 240, { font: 'MontBlack', size: 36, align: 'left', alpha: a });
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ROME; ctx.beginPath(); ctx.roundRect(120, 270, bw * p1, 90, 14); ctx.fill(); ctx.restore();
      text(ctx, `${Math.round(560 * p1)}M`, 140 + bw * p1, 318, { font: 'Anton', size: 60, align: 'left', alpha: a, stroke: 8 });
      text(ctx, 'EUROPEAN UNION', 120, 420, { font: 'MontBlack', size: 36, align: 'left', alpha: a * clamp(p2 * 3) });
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#2f63d6'; ctx.beginPath(); ctx.roundRect(120, 450, bw * (450 / 560) * p2, 90, 14); ctx.fill(); ctx.restore();
      text(ctx, `${Math.round(450 * p2)}M`, 140 + bw * (450 / 560) * p2, 498, { font: 'Anton', size: 60, align: 'left', alpha: a * clamp(p2 * 3), stroke: 8 });
    }
    // GDP ranking
    if (T > L(5) - 0.1 && T < L(6)) {
      const a = env(T, L(5) - 0.1, L(6), 0.25, 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.86)'; ctx.beginPath(); ctx.roundRect(70, 160, W - 140, 640, 32); ctx.fill(); ctx.restore();
      text(ctx, 'BIGGEST ECONOMIES (GDP)', W / 2, 220, { font: 'MontBlack', size: 36, alpha: a });
      const rows = [['1  UNITED STATES', 30, '#2f7bff'], ['2  CHINA', 19, '#e5484d'], ['3  NEW ROME', 16, ROME], ['4  GERMANY', 4.7, '#9aa6bd']];
      rows.forEach(([n, v, c], i) => {
        const p = prog(T, L(5) + 0.4 + i * 0.35, L(5) + 1.4 + i * 0.35, ease.outCubic), y = 290 + i * 125, bw = (W - 420) * (v / 30) * p;
        text(ctx, n, 120, y, { font: 'MontBlack', size: 30, align: 'left', alpha: a, color: i === 2 ? GOLD : '#fff' });
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c; if (i === 2) { ctx.shadowColor = GOLD; ctx.shadowBlur = 20; } ctx.beginPath(); ctx.roundRect(120, y + 26, Math.max(8, bw), 56, 12); ctx.fill(); ctx.restore();
        text(ctx, `$${v}T`, 140 + Math.max(8, bw), y + 56, { font: 'Anton', size: 44, align: 'left', alpha: a, stroke: 6 });
      });
    }
    // nukes
    if (T > L(6) - 0.1 && T < L(7)) {
      const a = env(T, L(6) - 0.1, L(7), 0.25, 0.3);
      hl(g, cam, 'FRA', '#ffe14d', a, { fillAlpha: 0.45 }); hl(g, cam, 'GBR', '#ffe14d', a, { fillAlpha: 0.45 });
      flagAt(g, 'fr', W / 2 - 120, 300, 90, a); flagAt(g, 'gb', W / 2 + 120, 300, 90, a);
      bigText(g, 'NUCLEAR: ~515 WARHEADS', 470, a, { size: 92, color: '#ffe14d' });
    }
    // who's in charge
    if (T > L(7) - 0.1 && T < L(8)) {
      const a = env(T, L(7) - 0.1, L(8), 0.25, 0.3);
      const pin = (lon, lat, s, t0, col) => { const q = clamp((T - t0) / 0.25) * a; if (q <= 0) return; const [x, y] = cam.toScreen(lon, lat); pulseAt(g, cam, lon, lat, 70, col, q); label(ctx, s, x, y - 52, { size: 40, a: q, color: col }); };
      pin(12.5, 41.9, 'ROME?', g.wt(7, 'rome') - 0.1, GOLD); pin(28.98, 41.01, 'ISTANBUL?', g.wt(7, 'istanbul') - 0.1, '#c9a6ff');
      pin(2.35, 48.86, 'PARIS?', g.wt(7, 'paris') - 0.1, '#ffffff'); pin(-0.13, 51.5, 'LONDON?', g.wt(7, 'london') - 0.1, '#ffffff');
      tag(g, "WHO'S IN CHARGE?", W / 2, 280, { a, bg: '#1b2a44', size: 52 });
    }
    // split
    if (split > 0) {
      const [x1, y1] = cam.toScreen(19.4, 50), [x2, y2] = cam.toScreen(19.4, 22);
      ctx.save(); ctx.globalAlpha = clamp(split * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.setLineDash([18, 12]); ctx.shadowColor = '#fff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      const [wx, wy] = cam.toScreen(4, 44), [ex, ey] = cam.toScreen(33, 37);
      label(ctx, 'WEST', wx - 40, wy, { size: 46, a: split, color: '#ffb3c0' }); label(ctx, 'EAST', ex + 40, ey, { size: 46, a: split, color: '#d6c2ff' });
      bigText(g, 'EXACTLY LIKE 395 AD', 300, clamp((T - g.wt(8, 'last') + 0.2) / 0.3), { size: 96, color: '#fff' });
    }
  },
};
