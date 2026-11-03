// 10 — Why do three out of four Canadians live near the US border?
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, fill, outline, loadFlags, flagAt, bigText, tag, headline, text, label, mainPolygon, drawMoved, centroidOf } from '../../engine/kit.mjs';
import { loadGeoJSON, screenPathFor } from '../../engine/geo.mjs';
import { arrow } from '../../engine/fx.mjs';
import { createCanvas } from '../../engine/core.mjs';

const RED = '#e5484d', BAND = '#ffe14d', ICE = '#bfe9ff', ROCK = '#c49a6c', US = '#2f7bff';
const SHIELD = [[-123, 66], [-118, 62], [-115, 61], [-111, 59], [-104, 56], [-98, 52], [-95, 49.3], [-88, 48.5], [-84, 46.6], [-80.5, 45], [-76, 45.6], [-71, 47], [-66, 50], [-57, 51.5], [-60, 56], [-64, 60], [-70, 62], [-78, 62.5], [-90, 64], [-95, 68], [-110, 68], [-123, 66]];
const PERMA = [[-141, 60], [-125, 58.5], [-112, 56.5], [-100, 56], [-92, 54], [-82, 51.5], [-72, 51], [-62, 52.5], [-55, 53], [-50, 60], [-50, 84], [-141, 84], [-141, 60]];
const RAIL = [[-123.1, 49.28], [-120.3, 50.7], [-114.07, 51.05], [-110.7, 50.04], [-104.6, 50.45], [-97.14, 49.9], [-89.25, 48.38], [-81, 46.5], [-75.7, 45.42], [-73.57, 45.5], [-71.2, 46.8], [-66.1, 45.3], [-63.57, 44.65]];
let CITIES = [], NUNAVUT, LAKES = [], bufCv;

export default {
  music: { file: 'curious.mp3', gain: 0.16, start: 30 },
  async setup(g) {
    const pp = loadGeoJSON('data/ne_50m_populated_places_simple.geojson');
    CITIES = pp.features.filter((f) => f.properties.adm0name === 'Canada' && f.properties.pop_max > 90000).map((f) => ({ name: f.properties.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], pop: f.properties.pop_max }));
    const a1 = loadGeoJSON('data/ne_50m_admin_1_states_provinces.geojson');
    NUNAVUT = a1.features.find((f) => f.properties.name === 'Nunavut').geometry;
    const lk = loadGeoJSON('data/ne_50m_lakes.geojson');
    LAKES = lk.features.filter((f) => { const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0][0][0]; return c[0] < -60 && c[0] > -135 && c[1] > 41.5 && c[1] < 70; }).map((f) => f.geometry);
    bufCv = createCanvas(W, H);
    await loadFlags(g, ['ca', 'us', 'mx']);
  },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.2, file: 'pop.wav', gain: 0.6 }, { t: g.wt(0, 'right') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: L(1) + 0.2, file: 'ticker.wav', gain: 0.5 }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: L(1) + 1.2 + i * 0.25, file: 'pop.wav', gain: 0.4 })),
      { t: L(2) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: L(3) + 0.2, file: 'rumble.wav', gain: 0.4, dur: 3 },
      { t: L(4) + 0.2, file: 'pop.wav', gain: 0.6 }, { t: g.wt(4, 'mexico') - 0.2, file: 'whoosh.wav', gain: 0.7 }, { t: g.wt(4, '40000') - 0.1, file: 'impact.wav', gain: 0.7 },
      { t: L(5) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: L(6) + 0.2, file: 'riser.wav', gain: 0.4 }, { t: L(7) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(7, 'three') - 0.1, file: 'cash.wav', gain: 0.6 },
      { t: g.wt(8, 'thin') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const keys = [[0, { lon: -97, lat: 60, zoom: 3.45 }], [L(5) - 0.3, { lon: -97, lat: 60, zoom: 3.5 }], [L(5) + 0.8, { lon: -79, lat: 46.5, zoom: 5.0 }], [L(6) - 0.3, { lon: -79, lat: 46.5, zoom: 5.1 }],
      [L(6) + 0.8, { lon: -95, lat: 52, zoom: 3.6 }], [L(7) - 0.2, { lon: -95, lat: 52, zoom: 3.6 }], [L(7) + 0.8, { lon: -97, lat: 46, zoom: 3.45 }], [L(8) - 0.2, { lon: -97, lat: 46, zoom: 3.45 }], [L(8) + 0.8, { lon: -97, lat: 56, zoom: 3.5 }], [99, { lon: -97, lat: 56, zoom: 3.55 }]];
    const cam = camAt(T, keys);
    await baseMap(g, cam, { dim: 0.3, borders: 0.3 });
    const can = g.countries.get('CAN'), usa = g.countries.get('USA');
    const thin = clamp((T - g.wt(8, 'thin') + 0.4) / 0.6);
    hl(g, cam, 'CAN', RED, 1 - thin * 0.75, { fillAlpha: 0.16, glow: 8 });
    // 160 km band = Canada ∩ (US thickened by 160 km)
    const bandA = clamp((T - g.wt(0, 'right') + 0.2) / 0.5);
    if (bandA > 0) {
      const b = bufCv.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
      const px = 160 * cam.pxPerKm();
      b.save(); let s = cam.applyZ8(b, usa.ox, usa.oy, 0); b.lineWidth = (2 * px) / s; b.lineJoin = 'round'; b.strokeStyle = '#fff'; b.fillStyle = '#fff'; b.stroke(usa.path); b.fill(usa.path); b.restore();
      b.save(); b.globalCompositeOperation = 'source-in'; s = cam.applyZ8(b, can.ox, can.oy, 0); b.fillStyle = BAND; b.fill(can.path, 'evenodd'); b.restore();
      ctx.save(); ctx.globalAlpha = 0.62 * bandA; ctx.shadowColor = BAND; ctx.shadowBlur = 24; ctx.drawImage(bufCv, 0, 0); ctx.restore();
    }
    if (T < L(1)) headline(ctx, 'Why do 3 in 4 Canadians\nlive right here?', { y: 230, a: env(T, 0.05, L(1), 0.2, 0.3) });
    if (T > 0.5 && T < g.wt(0, 'right')) tag(g, '#2 BIGGEST COUNTRY ON EARTH', W / 2, 1180, { a: env(T, 0.5, g.wt(0, 'right'), 0.3, 0.3), bg: '#1b2a44', size: 38 });
    // 76% + cities
    if (T > L(1) - 0.1 && T < L(2) + 0.2) {
      const a = env(T, L(1) - 0.1, L(2) + 0.2, 0.25, 0.3);
      const p = Math.round(76 * prog(T, L(1) + 0.2, L(1) + 1.4, ease.outCubic));
      bigText(g, `${p}%`, 330, a, { size: 170, color: BAND, sub: 'LIVE WITHIN 160 KM OF THE US', subColor: '#fff' });
    }
    if (T > L(1) + 0.8) {
      const a = clamp((T - L(1) - 0.8) / 0.4) * (1 - thin * 0.3);
      CITIES.forEach((c, i) => { const q = clamp((T - L(1) - 1 - i * 0.04) / 0.3) * a; if (q <= 0) return; const [x, y] = cam.toScreen(c.lon, c.lat); const r = 3 + Math.sqrt(c.pop) / 120 * Math.min(2, 2 ** (cam.zoom - 3.5));
        ctx.save(); ctx.globalAlpha = q; ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (c.pop > 900000 && T < L(2) + 0.3) label(ctx, c.name.toUpperCase(), x, y - r - 22, { size: 26, a: q * env(T, L(1) + 1, L(2) + 0.3, 0.3, 0.3) }); });
    }
    // permafrost
    if (T > L(2) - 0.1 && T < L(3) + 0.2) {
      const a = env(T, L(2) - 0.1, L(3) + 0.2, 0.3, 0.3) * clamp((T - L(2) - 0.4) / 0.6);
      ctx.save(); const cp = cam.applyZ8(ctx, can.ox, can.oy, 0); ctx.clip(can.path, 'evenodd'); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const pp = screenPathFor({ type: 'Polygon', coordinates: [PERMA] }, (lon, lat) => cam.toScreen(lon, lat));
      ctx.globalAlpha = 0.6 * a; ctx.fillStyle = ICE; ctx.fill(pp);
      ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -W; x < W * 2; x += 26) { ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.4, H); } ctx.save(); ctx.clip(pp); ctx.stroke(); ctx.restore();
      ctx.restore();
      tag(g, '≈ HALF OF CANADA: PERMAFROST', W / 2, 330, { a, bg: '#2b6a8f', size: 38 });
    }
    // Canadian Shield + lakes
    if (T > L(3) - 0.1 && T < L(4) + 0.2) {
      const a = env(T, L(3) - 0.1, L(4) + 0.2, 0.3, 0.3) * clamp((T - L(3) - 0.2) / 0.6);
      ctx.save(); cam.applyZ8(ctx, can.ox, can.oy, 0); ctx.clip(can.path, 'evenodd'); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sp = screenPathFor({ type: 'Polygon', coordinates: [SHIELD] }, (lon, lat) => cam.toScreen(lon, lat));
      ctx.globalAlpha = 0.55 * a; ctx.fillStyle = ROCK; ctx.fill(sp); ctx.globalAlpha = a; ctx.strokeStyle = '#ffe0b8'; ctx.lineWidth = 3; ctx.stroke(sp); ctx.restore();
      const lk = clamp((T - g.wt(3, 'endless') + 0.2) / 0.4) * a;
      if (lk > 0) for (const geo of LAKES) { const p = screenPathFor(geo, (lon, lat) => cam.toScreen(lon, lat)); ctx.save(); ctx.globalAlpha = lk; ctx.fillStyle = '#4fc3ff'; ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 10; ctx.fill(p); ctx.restore(); }
      const [x, y] = cam.toScreen(-88, 56); label(ctx, 'CANADIAN SHIELD', x, y, { size: 44, a, color: '#ffe0b8' });
    }
    // Nunavut vs Mexico
    if (T > L(4) - 0.1 && T < L(5) + 0.2) {
      const a = env(T, L(4) - 0.1, L(5) + 0.2, 0.3, 0.3);
      const np = screenPathFor(NUNAVUT, (lon, lat) => cam.toScreen(lon, lat));
      ctx.save(); ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#9b6bff'; ctx.fill(np, 'evenodd'); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(np); ctx.restore();
      const [nx, ny] = cam.toScreen(-92, 66); label(ctx, 'NUNAVUT', nx, ny - 80, { size: 44, a });
      const mex = g.countries.get('MEX'), from = centroidOf(mex.geometry);
      const q = ease.inOutCubic(clamp((T - g.wt(4, 'mexico') + 0.2) / 1.6));
      if (q > 0) drawMoved(g, cam, mainPolygon(mex.geometry), from, [lerp(from[0], -95, q), lerp(from[1], 65, q)], { fill: '#2fd27a', alpha: 0.6, a, roll: -20 * q });
      const k = clamp((T - g.wt(4, '40000') + 0.2) / 0.3) * a;
      bigText(g, '40,000 PEOPLE', 330, k, { size: 110, color: '#c9b6ff', sub: 'IN AN AREA BIGGER THAN MEXICO', subColor: '#fff' });
    }
    // south: farmland, lakes, St Lawrence
    if (T > L(5) - 0.1 && T < L(6) + 0.2) {
      const a = env(T, L(5) - 0.1, L(6) + 0.2, 0.3, 0.3);
      for (const geo of LAKES) { const p = screenPathFor(geo, (lon, lat) => cam.toScreen(lon, lat)); ctx.save(); ctx.globalAlpha = a * clamp((T - g.wt(5, 'great') + 0.2) / 0.4); ctx.fillStyle = '#4fc3ff'; ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 16; ctx.fill(p); ctx.restore(); }
      const p = prog(T, g.wt(5, 'lawrence') - 0.3, g.wt(5, 'lawrence') + 1.6, ease.outCubic);
      arrow(ctx, cam.toScreen(-76.5, 44.2), cam.toScreen(-62, 49.5), p, { color: '#4fc3ff', width: 40, a, bend: -0.12 });
      const [x, y] = cam.toScreen(-69, 48.6); label(ctx, 'ST. LAWRENCE', x, y - 60, { size: 36, a: a * p });
      const [fx, fy] = cam.toScreen(-81, 43.4); label(ctx, 'FARMLAND', fx, fy + 20, { size: 34, a: a * clamp((T - g.wt(5, 'farmland') + 0.2) / 0.3), color: '#b7f28a' });
    }
    // railway
    if (T > L(6) - 0.1 && T < L(7) + 0.4) {
      const a = env(T, L(6) - 0.1, L(7) + 0.4, 0.3, 0.3), p = prog(T, L(6) + 0.3, L(6) + 3.0, ease.inOutQuad);
      const pts = RAIL.map((q) => cam.toScreen(...q)); const n = (pts.length - 1) * p;
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= Math.floor(n); i++) ctx.lineTo(pts[i][0], pts[i][1]); const k = Math.floor(n), f = n - k; if (k < pts.length - 1) ctx.lineTo(lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f)); };
      path(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 14; ctx.stroke(); path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.stroke(); ctx.restore();
      tag(g, 'THE RAILWAY', W / 2, 330, { a, bg: '#1b2a44', size: 46 });
    }
    // exports to the US
    if (T > L(7) - 0.1 && T < L(8)) {
      const a = env(T, L(7) - 0.1, L(8), 0.3, 0.3);
      hl(g, cam, 'USA', US, a, { fillAlpha: 0.4 });
      const p = prog(T, L(7) + 1, L(7) + 2.6, ease.outCubic);
      for (const [s, e] of [[[-114, 53], [-108, 44]], [[-97, 52], [-95, 43]], [[-79, 47], [-81, 40]]]) arrow(ctx, cam.toScreen(...s), cam.toScreen(...e), p, { color: BAND, width: 40, a, bend: 0.1 });
      const k = clamp((T - g.wt(7, 'three') + 0.2) / 0.3) * a;
      bigText(g, '75% OF EXPORTS', 330, k, { size: 110, color: BAND, sub: 'GO TO THE UNITED STATES', subColor: '#fff' });
    }
    if (thin > 0) bigText(g, 'A LONG, THIN COUNTRY', 330, thin, { size: 92, color: BAND });
    g.creditText += ' · 76%: Statistics Canada (2021 census)';
  },
};
