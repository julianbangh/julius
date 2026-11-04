// 03 — How big do bombs get? Every weapon dropped on Central Park, in 3D over real aerial imagery.
import { W, H, clamp, ease, env, prog, lerp, track, zoomFor, bigText, headline, text, whiteFlash, fadeBlack, globeShot } from '../../engine/kit.mjs';
import { Ground3D, makeBlast, drawBlast3D, blastDecals, stripedCircle, bloomBegin, bloomEnd, flash, shake } from '../../engine/fx.mjs';
import { initGlobe, globeToZoom } from '../../engine/globe.mjs';
import { drawWeapon } from '../../engine/weapons.mjs';
import { label } from '../../engine/ui.mjs';

const CP = [-73.9654, 40.7812];
const G = new Ground3D();
// line, art, name, yield, radius km, kind, sync word, ring colour, ring label
const WEAPONS = [
  { line: 1, art: 'grenade', name: 'Hand grenade', y: '180 g of explosive', r: 0.005, kind: 'conv', word: 'kill', col: '#ffffff', lab: '5 m' },
  { line: 2, art: 'mk84', name: '2,000 lb bomb', y: '430 kg of explosive', r: 0.035, kind: 'conv', word: '35', col: '#ffffff', lab: '35 m' },
  { line: 3, art: 'moab', name: 'MOAB', y: '11 tons of TNT', r: 0.10, kind: 'conv', word: 'about', col: '#ffe14d', lab: '100 m' },
  { line: 4, art: 'davy', name: 'Davy Crockett', y: '20 tons of TNT', r: 0.12, kind: 'nuke', word: '120', col: '#ffe14d', lab: '120 m', extra: { r: 0.4, col: '#57ff7a', lab: 'RADIATION 400 m', word: 'plus' } },
  { line: 5, art: 'littleboy', name: 'Little Boy', y: '15 kilotons', r: 1.13, kind: 'nuke', word: '11', col: '#ffb020', lab: '1.1 km' },
  { line: 6, art: 'w88', name: 'W88 warhead', y: '475 kilotons', r: 3.57, kind: 'nuke', word: 'three', col: '#ff8a2a', lab: '3.5 km' },
  { line: 7, art: 'b83', name: 'B83', y: '1.2 megatons', r: 4.9, kind: 'nuke', word: '5', col: '#ff6a3a', lab: '5 km' },
  { line: 8, art: 'bravo', name: 'Castle Bravo', y: '15 megatons', r: 11.3, kind: 'nuke', word: '11', col: '#ff4a4a', lab: '11 km' },
  { line: 9, art: 'tsar', name: 'Tsar Bomba', y: '50 megatons', r: 16.9, kind: 'nuke', word: '50', col: '#ff2d55', lab: '17 km', extra: { r: 47, col: '#ff9a3c', lab: 'BURNS 47 km', word: 'burns' } },
];
const PLACES = [
  ['CENTRAL PARK', -73.9654, 40.7829, 14.2, 18], ['MANHATTAN', -73.995, 40.733, 12.4, 15.2], ['THE BRONX', -73.87, 40.85, 10.6, 14], ['BROOKLYN', -73.95, 40.65, 10.6, 14],
  ['QUEENS', -73.80, 40.72, 10.6, 14], ['NEW JERSEY', -74.18, 40.80, 10.2, 13.6], ['STATEN ISLAND', -74.15, 40.58, 10.6, 13], ['LONG ISLAND', -73.35, 40.80, 9.2, 11.5],
];
let det = [], blasts = [];

export default {
  music: { file: 'dark_nuclear.mp3', gain: 0.2 },
  sfxGain: 0.5,
  async setup(g) {
    await initGlobe();
    det = WEAPONS.map((w) => Math.max(g.L(w.line) + 0.9, g.wt(w.line, w.word) - 0.25));
    blasts = WEAPONS.map((w, i) => makeBlast({ r5: w.r, kind: w.kind, seed: 11 + i * 7, fire: w.kind === 'nuke' ? w.r * 0.26 : w.r * 0.45 }));
    WEAPONS.forEach((w) => { if (w.extra) w.extra.t = g.wt(w.line, w.extra.word) - 0.1; });
  },
  sfx(g) {
    const out = [{ t: 0.0, file: 'riser.wav', gain: 0.5 }, { t: 2.2, file: 'whoosh.wav', gain: 0.8 }, { t: 3.6, file: 'whoosh.wav', gain: 0.6 }];
    WEAPONS.forEach((w, i) => {
      out.push({ t: g.L(w.line) - 0.1, file: 'pop.wav', gain: 0.6 });
      out.push({ t: det[i] - 0.9, file: 'whistle.wav', gain: 0.35, dur: 0.9 });
      out.push({ t: det[i], file: w.kind === 'conv' ? (w.r < 0.05 ? 'boom_small.wav' : 'boom.wav') : 'nuke.wav', gain: w.kind === 'conv' ? 0.6 : Math.min(0.75, 0.45 + w.r / 40) });
    });
    out.push({ t: det[8] + 0.4, file: 'rumble.wav', gain: 0.8 }, { t: g.L(10), file: 'impact.wav', gain: 0.9 });
    return out;
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    // ---------------- hook: globe dive
    const tGround = 2.35;
    if (T < tGround + 0.35) {
      const R = 430 * Math.exp(Math.log(1700 / 430) * ease.inCubic(clamp(T / tGround)));
      const lon = lerp(-45, CP[0], ease.outCubic(clamp(T / 1.8))), lat = lerp(22, CP[1], ease.outCubic(clamp(T / 1.8)));
      globeShot(g, { cx: W / 2, cy: H / 2, R, lon, lat }, [{ id: 'USA', color: '#ff3b3b', a: 1 - clamp(T / 1.5), fillAlpha: 0.2 }], { borders: 0.25 });
      headline(ctx, 'How big do\nbombs get?', { y: 220, a: env(T, 0.05, 4.8, 0.2, 0.4) });
      if (T < tGround) return;
    }
    // ---------------- ground camera
    const zooms = WEAPONS.map((w) => clamp(zoomFor(w.r * 2.7, W, CP[1]), 9.4, 20.4));
    const keys = [[tGround, { z: globeToZoom(1700, CP[1]), pitch: 90 }], [3.9, { z: 15.2, pitch: 90 }], [det[0] - 1.2, { z: zooms[0], pitch: 58 }]];
    for (let i = 1; i < WEAPONS.length; i++) { keys.push([det[i] - 2.3, { z: zooms[i - 1], pitch: 58 }]); keys.push([det[i] - 1.0, { z: zooms[i], pitch: i >= 7 ? 62 : 58 }]); }
    const burns = WEAPONS[8].extra.t;
    keys.push([burns - 0.4, { z: zooms[8], pitch: 62 }], [burns + 1.6, { z: zoomFor(47 * 2.5, W, CP[1]), pitch: 66 }], [70, { z: zoomFor(47 * 2.8, W, CP[1]), pitch: 68 }]);
    keys.sort((a, b) => a[0] - b[0]);
    const cv = track(T, keys, ease.inOutCubic);
    // look at each mushroom cloud from the side: drop the camera low while it rises, then lift back up
    let dip = 0;
    WEAPONS.forEach((w, i) => { if (w.kind !== 'nuke' || w.r < 1) return; const t = T - det[i]; const nextGap = i < WEAPONS.length - 1 ? det[i + 1] - det[i] : 99;
      const hold = Math.min(3.0, nextGap - 2.6); dip = Math.max(dip, ease.inOutCubic(clamp((t - 0.15) / 0.9)) * (1 - ease.inOutCubic(clamp((t - hold) / 1.0)))); });
    cv.pitch = lerp(cv.pitch, 33, dip);
    cv.z -= 0.85 * dip; // pull back so the whole cloud fits under the card
    const yaw = 29 + 26 * ease.inOutQuad(clamp((T - 5) / 64));
    // shake from the latest blast
    let shk = 0;
    det.forEach((d, i) => { const tt = T - d; if (tt > 0.05 && tt < 3) shk = Math.max(shk, (WEAPONS[i].kind === 'nuke' ? 9 : 4) * Math.exp(-tt * 2.6)); });
    const [sx, sy] = shake(T, shk);
    // close-ups: NYS 30 cm + USGS aerials; wide shots: seamless Sentinel-2 (USGS is a per-state patchwork when zoomed out)
    const nearA = clamp((cv.z - 13.9) / 0.5);
    const layers = nearA >= 1 ? ['usgs', 'nys'] : ['bluemarble', { src: 's2', comp: 'lighten' }, ...(nearA > 0 ? [{ src: 'usgs', alpha: nearA }, { src: 'nys', alpha: nearA }] : [])];
    G.setup({ lon: CP[0], lat: CP[1], zoom: cv.z, pitch: cv.pitch, yaw, layers, groundFill: '#3a4644', cy: lerp(1020, 1300, dip), shakeX: sx, shakeY: sy, hazeMax: 0.45, skyTop: '#1d3557', skyMid: '#7fa6c9', horizonHaze: '#c8d3df' });
    await G.draw(ctx, (c, h) => {
      // persistent striped circles (drawn under live blasts)
      WEAPONS.forEach((w, i) => {
        const a = clamp((T - det[i] - 1.6) / 0.8) * 0.9;
        if (a > 0) stripedCircle(c, w.r * h.km, { color: w.col, a, width: Math.max(2, 3 / h.scale) });
        if (w.extra) { const b = clamp((T - w.extra.t) / 0.6); if (b > 0) stripedCircle(c, w.extra.r * h.km, { color: w.extra.col, a: b * 0.85, width: 3 }); }
      });
      WEAPONS.forEach((w, i) => { const tau = T - det[i]; if (tau > -0.1 && tau < 6) blastDecals(c, blasts[i], tau, h.km); });
    });
    // ---------------- falling bomb + blasts
    const P = (e, n, u) => G.project(e, n, u);
    const bl = bloomBegin();
    let fl = 0;
    WEAPONS.forEach((w, i) => {
      const tau = T - det[i];
      if (tau > -0.9 && tau < 0) {
        const q = 1 + tau / 0.9; // 0..1
        const h0 = w.r * 9 + 0.02;
        const p = P(0, 0, h0 * (1 - q * q));
        if (p) { const s = Math.max(34, Math.min(160, w.r * 0.9 * p.s + 40 * (1 - q))); drawWeapon(ctx, w.art, p.x, p.y, s, Math.PI / 2); }
      }
      if (tau > 0 && tau < 7.5) { const life = 6.5; blasts[i].life = life; fl = Math.max(fl, drawBlast3D(ctx, P, blasts[i], tau, { bloom: bl })); }
    });
    bloomEnd(ctx, bl, 1);
    // ---------------- labels
    for (const [name, lon, lat, z0, z1] of PLACES) {
      const a = Math.min(clamp((cv.z - z0) / 0.4), clamp((z1 - cv.z) / 0.4)) * (T > 3.8 ? 1 : 0);
      if (a <= 0) continue;
      const p = G.projectLonLat(lon, lat, 0); if (p && p.y > 120 && p.y < H - 60) label(ctx, name, p.x, p.y, { size: 30, a: a * 0.9, color: '#e8f0ff' });
    }
    WEAPONS.forEach((w, i) => {
      const a = clamp((T - det[i] - 1.7) / 0.6);
      if (a <= 0) return;
      const tag = (r, str, col) => {
        const f = [-Math.sin(yaw * Math.PI / 180), Math.cos(yaw * Math.PI / 180)];
        const p = P(f[0] * r, f[1] * r, 0);
        if (!p || p.y < 90 || p.y > H - 60 || p.x < 0 || p.x > W) return;
        const prox = WEAPONS.slice(i + 1).some((v, j) => T > det[i + 1 + j] + 1.5 && Math.abs(Math.log(v.r / r)) < 0.35);
        if (!prox) label(ctx, str, p.x, p.y - 18, { size: 34, color: col, a });
      };
      const big = (r) => r * G.pxPerKm * (G.f / (G.D)) > 45;
      if (big(w.r)) tag(w.r, w.lab, w.col);
      if (w.extra && T > w.extra.t + 0.3 && big(w.extra.r)) tag(w.extra.r, w.extra.lab, w.extra.col);
    });
    // flash
    const core = G.project(0, 0, 0);
    flash(ctx, fl * 0.6, core?.x ?? W / 2, core?.y ?? H / 2);
    // ---------------- weapon card
    WEAPONS.forEach((w, i) => {
      const next = i < WEAPONS.length - 1 ? L(WEAPONS[i + 1].line) - 0.2 : L(10) - 0.1;
      const a = env(T, L(w.line) - 0.15, next, 0.25, 0.2);
      if (a <= 0) return;
      const slide = (1 - ease.outCubic(clamp((T - L(w.line) + 0.15) / 0.45))) * 300;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(slide, 0);
      ctx.fillStyle = 'rgba(8,10,18,0.84)'; ctx.beginPath(); ctx.roundRect(40, 110, W - 80, 290, 34); ctx.fill();
      ctx.strokeStyle = w.col; ctx.lineWidth = 4; ctx.stroke();
      drawWeapon(ctx, w.art, 245, 255, 300, -0.12);
      text(ctx, w.name.toUpperCase(), 690, 190, { font: 'MontBlack', size: 50, maxW: 560 });
      text(ctx, w.y.toUpperCase(), 690, 262, { font: 'Anton', size: 54, color: w.col, maxW: 560 });
      text(ctx, `DESTRUCTION RADIUS ${w.lab.toUpperCase()}`, 690, 338, { font: 'MontBold', size: 28, color: '#cfd8ea', maxW: 560 });
      ctx.restore();
    });
    // crossfade from globe
    if (T < tGround + 0.35) whiteFlash(g, 1 - clamp((T - tGround) / 0.35));
    // ending
    if (T > L(10) - 0.1) {
      const a = env(T, L(10) - 0.1, 99, 0.3, 0.3);
      ctx.save(); ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#3a0a00'; ctx.fillRect(0, 0, W, H); ctx.restore();
      bigText(g, 'ONE BOMB.', 330, a, { size: 160, color: '#fff', sub: 'THE WHOLE CITY GONE', subColor: '#ff8a5a' });
    }
    g.creditText = 'Imagery: NYS ITS · USGS · Sentinel-2 by EOX (CC BY 4.0) · NASA  |  5 psi radii, approx.';
  },
};
