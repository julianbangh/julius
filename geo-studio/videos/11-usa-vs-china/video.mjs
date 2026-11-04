// 11 — What if the USA and China went to all-out war? (fiction; numbers: DoD, SIPRI 2026, CSIS 2023 wargame)
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, fill, globeShot, loadFlags, flagAt, bigText, tag, headline, text, whiteFlash, label, zoomFor, fitCam, Camera } from '../../engine/kit.mjs';
import { Ground3D, bloomBegin, bloomEnd, flash, shake, unitIcon, trail, missile, blast2D } from '../../engine/fx.mjs';
import { oceanDecal, sunGlint, mark, drawUnits3D, wakeDecals, craterDecals, smokeColumn, boom3D, boomDecal, missile3D, tracer3D, contrail3D, frontLine2D, swarm2D, salvo2D, sub2D, healthBars, healthAt, versusCard, chapterSlam, killFeed, punch, glitch, speedLines } from '../../engine/battle.mjs';
import { initGlobe, drawGlobe, drawStars, globeProjection } from '../../engine/globe.mjs';
import { drawImagery } from '../../engine/tiles.mjs';
import { rng, deg } from '../../engine/core.mjs';
import { drawWeapon } from '../../engine/weapons.mjs';

const US = '#2f7bff', CN = '#e5484d';
const G = new Ground3D();
const FUJIAN = [[119.3, 26.05], [118.1, 24.5], [119.0, 25.4], [117.6, 23.9], [119.6, 26.6]];
const TAIWAN = [[121.2, 25.03], [120.62, 24.2], [120.3, 22.62], [121.5, 25.05], [120.2, 23.0], [121.6, 24.0]];
const BEACH = [120.48, 24.22];
const SEA = [125.5, 22.0];

function circlePts(lon, lat, km, n = 90) {
  const R = 6371, d = km / R, la = lat * deg, lo = lon * deg, out = [];
  for (let i = 0; i <= n; i++) { const b = (i / n) * 2 * Math.PI; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b)); const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)); out.push([lo2 / deg, la2 / deg]); }
  return out;
}

export default {
  music: { file: 'war_hype.mp3', gain: 0.2 },
  finish: { vignette: 0.6, grain: 0.06 },
  async setup(g) {
    await initGlobe({ night: true });
    await loadFlags(g, ['us', 'cn', 'tw']);
    const L = g.L;
    // damage timeline (health after each hit)
    g.hpUS = [[0, 1], [L(3) + 2.4, 0.86], [L(6) + 2.6, 0.62], [L(6) + 3.0, 0.52], [L(9) + 5.2, 0.34], [L(11) + 1.0, 0]];
    g.hpCN = [[0, 1], [L(4) + 1.6, 0.84], [L(4) + 2.6, 0.74], [L(7) + 1.2, 0.58], [L(7) + 2.2, 0.47], [L(9) + 2.6, 0.3], [L(11) + 1.1, 0]];
    g.beats = [0.2, 1.3, L(1), L(1) + 2.4, L(2), L(2) + 2.2, L(3), L(4), L(4) + 1.6, L(5), L(6), L(6) + 2.6, L(7), L(8), L(9), L(10), L(11), L(11) + 1.0];
  },
  sfx(g) {
    const L = g.L, out = [];
    const add = (t, file, gain = 1, dur) => out.push({ t, file, gain, dur });
    add(0.05, 'impact.wav', 1); add(0.35, 'whoosh.wav', 0.7); add(1.3, 'boom.wav', 0.8);
    add(L(1), 'whoosh_fast.wav', 0.6); add(L(1) + 1.2, 'ticker.wav', 0.5); add(g.wt(1, 'navy'), 'ticker.wav', 0.5); add(g.wt(1, '370') - 0.05, 'impact.wav', 0.7);
    add(L(2), 'whoosh_fast.wav', 0.6); add(g.wt(2, '11') - 0.05, 'impact.wav', 0.7); add(g.wt(2, 'air') - 0.3, 'jet.wav', 0.6); add(g.wt(2, 'three') - 0.05, 'cash.wav', 0.7);
    add(L(3) - 0.1, 'impact.wav', 0.9); add(L(3) + 0.9, 'launch.wav', 0.6); add(L(3) + 1.3, 'launch.wav', 0.5); add(L(3) + 2.1, 'boom.wav', 0.8); add(L(3) + 2.5, 'boom_small.wav', 0.7); add(L(3) + 3.0, 'boom.wav', 0.7); add(L(3) + 3.6, 'boom_small.wav', 0.6);
    add(L(4) - 0.4, 'whoosh.wav', 0.8); add(L(4) + 0.2, 'gunfire.wav', 0.5); add(L(4) + 0.9, 'boom.wav', 0.8); add(L(4) + 1.6, 'jet.wav', 0.6); add(L(4) + 1.9, 'boom.wav', 0.8); add(L(4) + 2.4, 'gunfire.wav', 0.5); add(L(4) + 2.7, 'boom_small.wav', 0.7);
    add(L(5) - 0.1, 'impact.wav', 0.9); add(L(5) + 0.6, 'horn.wav', 0.4, 2); add(g.wt(5, 'jets') - 0.4, 'jet.wav', 0.8);
    add(L(6), 'riser.wav', 0.5); add(L(6) + 1.0, 'launch.wav', 0.6); add(L(6) + 1.9, 'whoosh.wav', 0.6); add(L(6) + 2.55, 'nuke.wav', 0.7); add(L(6) + 2.95, 'boom.wav', 0.8);
    add(L(7), 'sonar.wav', 0.7); add(L(7) + 0.6, 'torpedo.wav', 0.6); add(L(7) + 1.2, 'boom.wav', 0.7); add(L(7) + 2.2, 'boom.wav', 0.7);
    add(L(8), 'glitch.wav', 0.8); add(L(8) + 1.2, 'glitch.wav', 0.7); add(g.wt(8, 'power') - 0.1, 'glitch.wav', 0.8);
    add(L(9), 'impact.wav', 0.8); for (let i = 0; i < 24; i++) add(L(9) + 0.4 + i * 0.09, 'pop.wav', 0.35); add(g.wt(9, 'two') - 0.05, 'impact.wav', 0.8);
    add(L(10) - 0.1, 'siren.wav', 0.4, 4.5); add(g.wt(10, '4000') - 0.3, 'ticker.wav', 0.5); add(g.wt(10, '4000'), 'impact.wav', 0.9);
    add(L(11), 'riser.wav', 0.5); add(L(11) + 1.0, 'ko.wav', 1.0);
    return out;
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const pz = punch(T, g.beats, 0.07);
    if (T < L(3) - 0.15) await intro(g, T, pz);
    else if (T < L(4) - 0.35) await taiwanSalvo(g, T, pz);
    else if (T < L(5) - 0.15) await beachBattle(g, T);
    else if (T < L(6) + 1.75) await pacific(g, T, pz);
    else if (T < L(7) - 0.15) await carrierStrike(g, T);
    else if (T < L(8) - 0.1) await subs(g, T, pz);
    else if (T < L(9) - 0.1) await cyber(g, T);
    else await finale(g, T, pz);
    // health bars from the first battle on
    if (T > L(3) - 0.15) {
      const us = healthAt(T, g.hpUS), cn = healthAt(T, g.hpCN);
      healthBars(ctx, { name: 'USA', flag: g.flags.us, ...us }, { name: 'CHINA', flag: g.flags.cn, ...cn }, T, { y: 70 });
    }
    // scene-cut flashes
    for (const t0 of [L(3) - 0.15, L(4) - 0.35, L(5) - 0.15, L(6) + 1.75, L(7) - 0.15, L(8) - 0.1, L(9) - 0.1]) if (T > t0 && T < t0 + 0.25) whiteFlash(g, 0.7 * (1 - (T - t0) / 0.25));
  },
};

// ------------------------------------------------------------------ 0–2: intro + stat fight
async function intro(g, T, pz) {
  const ctx = g.ctx, L = g.L;
  const view = { cx: W / 2, cy: T < L(1) - 0.1 ? 1100 : 1420, R: (T < L(1) - 0.1 ? 560 : 470) + pz * 900, lon: lerp(150, 170, prog(T, 0, L(3))), lat: 22 };
  globeShot(g, view, [{ id: 'USA', color: US, a: 1 }, { id: 'CHN', color: CN, a: 1 }], { borders: 0.2 });
  if (T < L(1) - 0.1) {
    const a = env(T, 0, L(1) - 0.1, 0.01, 0.3);
    versusCard(ctx, g.flags.us, g.flags.cn, 'USA', 'CHINA', T, 0.0, { a });
    chapterSlam(ctx, 'ALL-OUT WAR', T, 1.3, { y: 1560, dur: 1.9, color: '#ffe14d' });
    g.caption.hide = true;
    return;
  }
  // stat fight rows
  ctx.save(); ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgba(6,9,18,0.92)'; ctx.beginPath(); ctx.roundRect(30, 90, W - 60, 900, 34); ctx.fill(); ctx.restore();
  flagAt(g, 'us', 160, 170, 84, 1, 4); flagAt(g, 'cn', W - 160, 170, 84, 1, 4);
  text(ctx, 'TALE OF THE TAPE', W / 2, 170, { font: 'Anton', size: 62, color: '#ffe14d' });
  const rows = [
    ['ACTIVE TROOPS', '1.3M', '2.0M', 1.3, 2.0, L(1) + 0.9, 'cn'],
    ['NAVY SHIPS', '296', '370+', 296, 370, g.wt(1, 'navy') - 0.1, 'cn'],
    ['AIRCRAFT CARRIERS', '11', '3', 11, 3, g.wt(2, '11') - 0.1, 'us'],
    ['MILITARY BUDGET', '$997B', '$314B', 997, 314, g.wt(2, 'three') - 0.2, 'us'],
  ];
  rows.forEach(([name, a1, b1, av, bv, t0, win], i) => {
    const q = clamp((T - t0) / 0.25); if (q <= 0) return;
    const y = 290 + i * 165, k = ease.outBack(q);
    text(ctx, name, W / 2, y, { font: 'MontBlack', size: 36, color: '#cfd8ea', alpha: q });
    const mx = Math.max(av, bv), bw = 390;
    const pa = prog(T, t0, t0 + 0.6, ease.outCubic);
    ctx.save(); ctx.globalAlpha = q;
    ctx.shadowColor = US; ctx.shadowBlur = 16; ctx.fillStyle = US; ctx.fillRect(W / 2 - 20 - bw * (av / mx) * pa, y + 30, bw * (av / mx) * pa, 62);
    ctx.shadowColor = CN; ctx.fillStyle = CN; ctx.fillRect(W / 2 + 20, y + 30, bw * (bv / mx) * pa, 62); ctx.shadowBlur = 0;
    ctx.restore();
    text(ctx, a1, W / 2 - 40, y + 62, { font: 'Anton', size: 66, align: 'right', alpha: q, stroke: 8 });
    text(ctx, b1, W / 2 + 40, y + 62, { font: 'Anton', size: 66, align: 'left', alpha: q, stroke: 8 });
    const wq = clamp((T - t0 - 0.45) / 0.2);
    if (wq > 0) mark(ctx, 'tick', win === 'us' ? 80 : W - 80, y + 60, 70 * (0.6 + 0.4 * ease.outBack(wq)), wq);
  });
  const sc = [(T > g.wt(2, '11') + 0.3 ? 1 : 0) + (T > g.wt(2, 'three') + 0.3 ? 1 : 0), (T > L(1) + 1.3 ? 1 : 0) + (T > g.wt(1, 'navy') + 0.3 ? 1 : 0)];
  text(ctx, `${sc[0]} - ${sc[1]}`, W / 2, 935, { font: 'Anton', size: 110, color: '#fff', stroke: 12, alpha: clamp((T - L(1) - 1.3) / 0.2) });
  // jets streak across for "air force"
  const jt = T - (g.wt(2, 'air') - 0.3);
  if (jt > 0 && jt < 1.6) for (let i = 0; i < 5; i++) { const x = -200 + jt * 1100 + i * 60, y = 1180 - i * 40 - jt * 120; unitIcon(ctx, 'jet', x, y, 70, -0.12, US, 1); trail(ctx, [[x - 300, y + 36], [x - 150, y + 18], [x - 40, y + 4]], 'rgba(255,255,255,0.7)', 6); }
}

// ------------------------------------------------------------------ 3: Taiwan missile salvo
async function taiwanSalvo(g, T, pz) {
  const ctx = g.ctx, L = g.L, t0 = L(3);
  const cam = camAt(T, [[t0 - 0.2, { lon: 120.0, lat: 24.2, zoom: 6.75 }], [L(4), { lon: 120.3, lat: 24.1, zoom: 7.05 }]]);
  const c2 = new Camera({ lon: cam.lon, lat: cam.lat, zoom: cam.zoom + pz });
  const sh = T > t0 + 2.1 ? 18 * Math.exp(-(T - t0 - 2.1) * 1.2) : 0;
  const [sx, sy] = shake(T, sh);
  ctx.save(); ctx.translate(sx, sy);
  await baseMap(g, c2, { layers: ['bluemarble', 's2'], dim: 0.2, borders: 0.35 });
  hl(g, c2, 'TWN', US, 0.9, { fillAlpha: 0.2 }); hl(g, c2, 'CHN', CN, 0.9, { fillAlpha: 0.15 });
  const bl = bloomBegin();
  salvo2D(ctx, c2, FUJIAN, TAIWAN, T, t0 + 0.8, { n: 54, flight: 1.1, spread: 2.8, height: 0.35, jitter: 0.55, size: 64, bloom: bl, seed: 4 });
  bloomEnd(ctx, bl, 1);
  // strait ruler
  const r = clamp((T - g.wt(3, '130') + 0.3) / 0.4);
  if (r > 0) { const A = c2.toScreen(119.6, 25.3), B = c2.toScreen(lerp(119.6, 121.0, r), 25.3); ctx.save(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore(); label(ctx, '130 KM', (A[0] + B[0]) / 2, A[1] - 44, { size: 50, color: '#ffe14d', a: r }); }
  const [tx, ty] = c2.toScreen(121, 23.6); label(ctx, 'TAIWAN', tx + 30, ty, { size: 52 });
  ctx.restore();
  chapterSlam(ctx, 'ROUND 1: TAIWAN', T, t0 - 0.1, { y: 330, dur: 2.0 });
  killFeed(ctx, [{ t: t0 + 2.2, text: 'AIRBASE HIT', color: CN }, { t: t0 + 2.9, text: 'RADAR DESTROYED', color: CN }, { t: t0 + 3.6, text: 'PORT ON FIRE', color: CN }], T, { y: 480 });
}

// ------------------------------------------------------------------ 4: 3D beach landing battle
const RB = rng(77);
const SHORE = 0.55; // km east of the camera target
const CRAFT = Array.from({ length: 9 }, (_, i) => ({ n: (i - 4) * 0.36 + (RB() - 0.5) * 0.12, e0: SHORE - 2.1 - RB() * 0.5, sp: 0.5 + RB() * 0.12, hitAt: i % 3 === 1 ? [0.95, 1.85, 2.7][Math.floor(i / 3)] : 9 }));
const DEF = Array.from({ length: 5 }, (_, i) => ({ e: SHORE + 1.1 + RB() * 0.5, n: (i - 2) * 0.45 + (RB() - 0.5) * 0.2 }));
async function beachBattle(g, T) {
  const ctx = g.ctx, L = g.L, tau = T - (L(4) - 0.35);
  const z = zoomFor(5.2, W, BEACH[1]) + 0.07 * tau;
  const [sx, sy] = shake(T, 6 + [0.95, 1.85, 2.7].reduce((m, h) => (tau > h && tau < h + 1.5 ? Math.max(m, 16 * Math.exp(-(tau - h) * 2.5)) : m), 0));
  G.setup({ lon: BEACH[0] - 0.006, lat: BEACH[1], zoom: z, pitch: 46 - tau * 1.2, yaw: 92 - tau * 3, layers: ['bluemarble', { src: 's2', comp: 'lighten' }], cy: 1080, shakeX: sx, shakeY: sy, hazeMax: 0.4, skyTop: '#2a3d5c', skyMid: '#8a9db8', horizonHaze: '#b9c3cf' });
  // positions (km, east/north relative to beach)
  const stopE = SHORE - 0.12;
  const craft = CRAFT.map((c, i) => { const hit = c.hitAt < 9 && tau > c.hitAt; const e = hit ? Math.min(stopE, c.e0 + c.sp * c.hitAt) : Math.min(stopE, c.e0 + c.sp * tau); return { ...c, e, hit, burn: hit ? clamp((tau - c.hitAt) / 0.6) : 0, landed: !hit && c.e0 + c.sp * tau >= stopE, tLand: (stopE - c.e0) / c.sp, i }; });
  const tanksCN = craft.filter((c) => c.landed).flatMap((c, k) => [0, 1].map((j) => { const tt = tau - c.tLand - j * 0.35; if (tt < 0) return null; return { kind: 'tank', team: 'cn', e: SHORE + Math.min(0.7, tt * 0.32), n: c.n + (j ? 0.09 : -0.09), heading: 0, size: 0.17 }; })).filter(Boolean);
  const craters = [];
  const booms = [];
  craft.forEach((c) => { if (c.hitAt < 9) { booms.push({ e: c.e, n: c.n, t: c.hitAt, r: 0.13, water: false }); } });
  // defender shots and splashes
  for (let k = 0; k < 16; k++) { const ts = 0.25 + k * 0.24; const tgt = craft[(k * 5) % craft.length]; const e = tgt.e + (RB() - 0.5) * 0.45; booms.push({ e, n: tgt.n + (RB() - 0.5) * 0.35, t: ts + 0.35, r: 0.05, water: e < SHORE - 0.05 }); }
  booms.forEach((b) => { if (!b.water) craters.push({ e: b.e, n: b.n, r: b.r * 0.9, t0: b.t + 0.1 }); });
  await G.draw(ctx, (c, h) => {
    wakeDecals(c, h, craft.filter((x) => !x.hit && !x.landed).map((x) => ({ e: x.e, n: x.n, heading: 0, size: 0.3, speed: 1 })), tau);
    craterDecals(c, h, craters, tau);
    booms.forEach((b, i) => boomDecal(c, h, b.e, b.n, tau - b.t, b.r, 30 + i));
  });
  const units = [];
  craft.forEach((c) => units.push({ kind: 'landing', team: 'cn', e: c.e, n: c.n, heading: 0, size: 0.3, hit: c.burn }));
  units.push(...tanksCN);
  DEF.forEach((d, i) => units.push({ kind: 'tank', team: 'us', e: d.e, n: d.n, heading: Math.PI, size: 0.19 }));
  // jets strafing north->south
  const jets = [0, 1, 2].map((i) => { const jt = tau - 1.25 - i * 0.18; return jt > -0.2 && jt < 2.2 ? { kind: 'jet', team: 'us', e: SHORE - 0.9 + i * 0.25, n: 2.6 - jt * 2.6, u: 0.45 + i * 0.05, heading: -Math.PI / 2, size: 0.26, jt } : null; }).filter(Boolean);
  units.push(...jets);
  for (const j of jets) contrail3D(ctx, G, Array.from({ length: 10 }, (_, k) => [j.e, j.n + k * 0.18, j.u]), { a: 0.8 });
  drawUnits3D(ctx, G, units);
  // effects
  const bl = bloomBegin(); let fl = 0;
  DEF.forEach((d, i) => { for (let k = 0; k < 4; k++) { const ts = 0.2 + i * 0.21 + k * 0.85; const tgt = craft[(i + k) % craft.length]; tracer3D(ctx, G, [d.e - 0.1, d.n, 0.04], [tgt.e, tgt.n, 0.03], (tau - ts) / 0.4); } });
  for (const j of jets) { const mt = j.jt - 0.25; if (mt > 0 && mt < 0.7) missile3D(ctx, G, [j.e, j.n + 0.4, j.u], [craft[5 + (j.e > -1.2 ? 1 : 0)].e, craft[5].n, 0], mt / 0.7, { apex: -0.1, size: 0.02 }); }
  booms.forEach((b, i) => { fl = Math.max(fl, boom3D(ctx, G, b.e, b.n, tau - b.t, { r: b.r, seed: 30 + i, bloom: bl, water: b.water })); });
  craft.forEach((c, i) => { if (c.burn > 0) smokeColumn(ctx, G, c.e, c.n, T, { seed: 90 + i, height: 0.9, size: 0.09, a: c.burn, wind: [0.8, 0.25] }); });
  smokeColumn(ctx, G, SHORE + 0.9, -1.1, T, { seed: 5, height: 1.0, size: 0.1, wind: [0.8, 0.25] }); smokeColumn(ctx, G, SHORE + 1.6, 1.0, T, { seed: 6, height: 0.8, size: 0.08, wind: [0.8, 0.25] });
  bloomEnd(ctx, bl, 1);
  flash(ctx, fl * 0.6);
  chapterSlam(ctx, 'D-DAY: TAIWAN', T, L(4) - 0.3, { y: 330, dur: 1.8, sub: 'BIGGEST INVASION SINCE 1944' });
  killFeed(ctx, [{ t: L(4) - 0.35 + 1.0, text: 'LANDING SHIP DESTROYED', color: US }, { t: L(4) - 0.35 + 1.9, text: 'LANDING SHIP DESTROYED', color: US }, { t: L(4) - 0.35 + 2.75, text: 'TANKS ASHORE', color: CN }], T, { y: 520 });
  g.creditText = 'Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · NASA';
}
function stopEReached(c) { return -0.26; }

// ------------------------------------------------------------------ 5–6a: Pacific + carrier-killer range
async function pacific(g, T, pz) {
  const ctx = g.ctx, L = g.L;
  const cam0 = camAt(T, [[L(5) - 0.2, { lon: 131, lat: 24, zoom: 4.15 }], [L(6) - 0.2, { lon: 132, lat: 23, zoom: 4.0 }], [L(6) + 1.8, { lon: 130, lat: 22, zoom: 3.6 }]]);
  const cam = new Camera({ lon: cam0.lon, lat: cam0.lat, zoom: cam0.zoom + pz });
  await baseMap(g, cam, { dim: 0.32, borders: 0.3 });
  hl(g, cam, 'CHN', CN, 0.8, { fillAlpha: 0.15 }); hl(g, cam, 'TWN', US, 0.8, { fillAlpha: 0.25 }); hl(g, cam, 'JPN', US, 0.6, { fillAlpha: 0.12 });
  const bases = [['GUAM', 144.8, 13.4], ['OKINAWA', 127.8, 26.3], ['YOKOSUKA', 139.7, 35.3]];
  for (const [n, lon, lat] of bases) { const [x, y] = cam.toScreen(lon, lat); label(ctx, n, x, y - 40, { size: 30, a: clamp((T - L(5) - 0.2) / 0.3) }); }
  // carrier groups racing in
  const p = prog(T, L(5), L(6) + 1.6, ease.inOutQuad);
  const groups = [[[144.8, 13.4], [126, 21.5]], [[139.7, 35.3], [124.5, 26]], [[134, 17], [124, 23.5]]];
  groups.forEach(([s, e], gi) => {
    for (let k = 0; k < 4; k++) {
      const q = clamp(p - k * 0.03); const lon = lerp(s[0], e[0], q) + (k % 2) * 0.6, lat = lerp(s[1], e[1], q) + (k > 1 ? 0.5 : -0.3);
      const [x, y] = cam.toScreen(lon, lat); const [x0, y0] = cam.toScreen(lerp(s[0], e[0], Math.max(0, q - 0.08)) + (k % 2) * 0.6, lerp(s[1], e[1], Math.max(0, q - 0.08)) + (k > 1 ? 0.5 : -0.3));
      trail(ctx, [[x0, y0], [(x0 + x) / 2, (y0 + y) / 2], [x, y]], 'rgba(255,255,255,0.6)', 6);
      unitIcon(ctx, k === 0 ? 'carrier' : 'ship', x, y, k === 0 ? 74 : 52, Math.atan2(y - y0, x - x0), US, 1);
    }
  });
  // jet swarm
  const jp = prog(T, g.wt(5, 'jets') - 0.6, L(6) + 1.2);
  swarm2D(ctx, cam, [[129, 26.5], [124.5, 25], [121.5, 24.2]], jp, { n: 30, kind: 'jet', color: US, size: 48, spread: 1.6, seed: 8 });
  swarm2D(ctx, cam, [[144, 14], [133, 19], [123.5, 22.8]], jp * 0.9, { n: 22, kind: 'jet', color: US, size: 46, spread: 1.8, seed: 9 });
  chapterSlam(ctx, 'ROUND 2: THE PACIFIC', T, L(5) - 0.15, { y: 330, dur: 2.0 });
  // carrier-killer range rings
  if (T > L(6) - 0.1) {
    const a = clamp((T - L(6) + 0.1) / 0.3);
    for (const [km, name, t1, col] of [[1500, 'DF-21D: 1,500 KM', L(6) + 0.1, '#ff9a3c'], [4000, 'DF-26: 4,000 KM', L(6) + 0.6, '#ff3b3b']]) {
      const q = ease.outCubic(clamp((T - t1) / 0.8)); if (q <= 0) continue;
      const pts = circlePts(116.5, 26.5, km * q).map((pp) => cam.toScreen(...pp));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,40,40,0.08)'; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([22, 12]); ctx.shadowColor = col; ctx.shadowBlur = 18;
      ctx.beginPath(); pts.forEach((pp, i) => (i ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      const top = pts[Math.floor(pts.length * 0.12)]; label(ctx, name, Math.min(W - 200, top[0]), top[1] + 40, { size: 32, color: col, a: a * q });
    }
    const bl = bloomBegin();
    salvo2D(ctx, cam, [[117, 26], [116, 24.5], [118, 28]], [[126, 21.5], [124.5, 26], [124, 23.5]], T, L(6) + 0.9, { n: 9, flight: 0.9, spread: 0.6, height: 0.4, size: 70, bloom: bl, seed: 21 });
    bloomEnd(ctx, bl, 1);
    tag(g, 'CARRIER KILLERS', W / 2, 1220, { a: clamp((T - g.wt(6, 'carrier') + 0.1) / 0.2), bg: '#c62828', size: 50 });
  }
}

// ------------------------------------------------------------------ 6b: 3D carrier strike at sea
async function carrierStrike(g, T) {
  const ctx = g.ctx, L = g.L, tau = T - (L(6) + 1.75);
  const z = zoomFor(4.6, W, SEA[1]);
  const hitT = [0.75, 1.15];
  const [sx, sy] = shake(T, hitT.reduce((m, h) => (tau > h && tau < h + 2 ? Math.max(m, 26 * Math.exp(-(tau - h) * 2.2)) : m), 3));
  G.setup({ lon: SEA[0], lat: SEA[1], zoom: z, pitch: 30, yaw: 20 + tau * 4, layers: [], cy: 1060, shakeX: sx, shakeY: sy, hazeMax: 0.6, hazeDist: 3500, skyTop: '#1b2f52', skyMid: '#c98f6a', horizonHaze: '#e8b48a', contrast: 1.1, sat: 1.15 });
  const car = { kind: 'carrier', team: 'us', e: 0.12 * tau, n: 0.04 * tau, heading: 0.35, size: 0.75, hit: clamp((tau - hitT[0]) / 0.8) * 0.8 };
  const esc = [{ kind: 'destroyer', team: 'us', e: -1.0 + 0.12 * tau, n: -0.6 + 0.04 * tau, heading: 0.35, size: 0.38 }, { kind: 'destroyer', team: 'us', e: 1.1 + 0.12 * tau, n: 0.9 + 0.04 * tau, heading: 0.35, size: 0.38 }];
  await G.draw(ctx, (c, h) => {
    oceanDecal(c, h, T);
    wakeDecals(c, h, [car, ...esc].map((u) => ({ e: u.e, n: u.n, heading: u.heading, size: u.size, speed: 1 })), tau);
    hitT.forEach((ht, i) => boomDecal(c, h, car.e + i * 0.15, car.n, tau - ht, 0.28, 60 + i));
  });
  sunGlint(ctx, G, 1);
  drawUnits3D(ctx, G, [car, ...esc]);
  const bl = bloomBegin(); let fl = 0;
  hitT.forEach((ht, i) => { const p = (tau - (ht - 0.75)) / 0.75; if (p > 0 && p < 1) missile3D(ctx, G, [car.e - 3 + i, car.n + 5, 3], [car.e + i * 0.15, car.n, 0.04], p, { apex: 0.4, size: 0.035 }); fl = Math.max(fl, boom3D(ctx, G, car.e + i * 0.15, car.n, tau - ht, { r: 0.28, seed: 60 + i, bloom: bl })); });
  if (tau > hitT[0]) smokeColumn(ctx, G, car.e, car.n, T, { seed: 61, height: 1.6, size: 0.22, a: clamp((tau - hitT[0]) / 0.5), wind: [0.9, 0.3], n: 18 });
  bloomEnd(ctx, bl, 1.1);
  flash(ctx, fl * 0.8);
  killFeed(ctx, [{ t: L(6) + 1.75 + hitT[0], text: 'US CARRIER HIT', color: CN }], T, { y: 520 });
  g.creditText = 'NASA Blue Marble';
}

// ------------------------------------------------------------------ 7: submarines
async function subs(g, T, pz) {
  const ctx = g.ctx, L = g.L, t0 = L(7) - 0.15;
  const cam0 = camAt(T, [[t0, { lon: 119.9, lat: 24.0, zoom: 7.3 }], [L(8), { lon: 119.85, lat: 24.05, zoom: 7.5 }]]);
  const cam = new Camera({ lon: cam0.lon, lat: cam0.lat, zoom: cam0.zoom + pz });
  await baseMap(g, cam, { layers: ['bluemarble', 's2'], dim: 0.15, borders: 0.3 });
  // underwater tint
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,40,70,0.55)'); gr.addColorStop(1, 'rgba(0,15,35,0.75)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = (i * 131 + T * 40) % W, y = H - ((i * 97 + T * (80 + i * 3)) % H); ctx.fillStyle = 'rgba(180,230,255,0.25)'; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2); ctx.fill(); }
  const tau = T - t0;
  const ships = Array.from({ length: 7 }, (_, i) => ({ lon: 119.35 + (i % 4) * 0.33, lat: 23.55 + Math.floor(i / 4) * 0.75 + (i % 2) * 0.18, hit: [1.2, 1.7, 2.2, 2.6, 9, 9, 9][i] }));
  const subsP = [[120.3, 23.2], [119.1, 24.9], [120.35, 24.95]];
  const bl = bloomBegin();
  ships.forEach((s, i) => { const [x, y] = cam.toScreen(s.lon, s.lat); const sunk = tau > s.hit; unitIcon(ctx, 'ship', x, y + (sunk ? (tau - s.hit) * 20 : 0), 66, Math.PI * 0.1, sunk ? '#552222' : CN, sunk ? clamp(1 - (tau - s.hit) / 1.2) : 1); if (s.hit < 9) blast2D(ctx, x, y, 80, tau - s.hit, { seed: 80 + i, bloom: bl }); });
  subsP.forEach((p, i) => { const [x, y] = cam.toScreen(...p); sub2D(ctx, x, y, 96, -0.4 + i * 0.6, T + i * 0.3, { color: US }); });
  // torpedo lines
  ships.forEach((s, i) => { if (s.hit > 9) return; const from = cam.toScreen(...subsP[i % 3]), to = cam.toScreen(s.lon, s.lat); const p = clamp((tau - (s.hit - 0.6)) / 0.6); if (p > 0 && p < 1) { ctx.save(); ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(lerp(from[0], to[0], p), lerp(from[1], to[1], p)); ctx.stroke(); ctx.restore(); } });
  bloomEnd(ctx, bl, 0.9);
  chapterSlam(ctx, 'UNDER THE SEA', T, t0, { y: 330, dur: 1.6, color: '#7fe3ff' });
  killFeed(ctx, ships.filter((s) => s.hit < 9).map((s) => ({ t: t0 + s.hit, text: 'INVASION SHIP SUNK', color: US })), T, { y: 480 });
}

// ------------------------------------------------------------------ 8: cyber + blackout
async function cyber(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(8) - 0.1, tau = T - t0;
  const dark = clamp((T - g.wt(8, 'power') + 0.5) / 1.3);
  const halves = [
    { cam: new Camera({ lon: -96 + tau * 0.6, lat: 38.5, zoom: 4.05 + tau * 0.04, cy: 480 }), y0: 0, name: 'USA', col: US,
      cities: [[-74, 40.7], [-87.6, 41.9], [-118.2, 34], [-95.4, 29.8], [-122.4, 37.8], [-112, 33.4], [-104.9, 39.7], [-97, 32.8], [-84.4, 33.7], [-80.2, 25.8], [-93.3, 45], [-90.2, 38.6], [-77, 38.9], [-71, 42.4]] },
    { cam: new Camera({ lon: 112 - tau * 0.6, lat: 32.5, zoom: 4.05 + tau * 0.04, cy: 1440 }), y0: 960, name: 'CHINA', col: CN,
      cities: [[116.4, 39.9], [121.5, 31.2], [113.3, 23.1], [104, 30.7], [114.3, 30.6], [120.2, 30.3], [126.6, 45.7], [117.2, 39.1], [108.9, 34.3], [118.8, 32], [106.5, 29.6], [113.6, 34.7], [123.4, 41.8], [119.3, 26.1]] },
  ];
  for (const hv of halves) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, hv.y0, W, 960); ctx.clip();
    ctx.fillStyle = '#020309'; ctx.fillRect(0, hv.y0, W, 960);
    await drawImagery(ctx, hv.cam, ['blackmarble']);
    hv.cities.forEach((ll, i) => { const q = clamp(dark * 1.9 - (i % 7) * 0.12); if (q <= 0) return; const [x, y] = hv.cam.toScreen(...ll); const r = 30 + 120 * ease.outCubic(q); const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(0,0,0,${0.97 * q})`); gg.addColorStop(0.7, `rgba(0,0,0,${0.8 * q})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    const lights = Math.round(100 - 88 * dark);
    text(ctx, `${hv.name} POWER ${lights}%`, W / 2, hv.y0 + (hv.y0 ? 870 : 240), { font: 'Anton', size: 60, color: lights < 50 ? '#ff4d4d' : '#ffffff', stroke: 8 });
  }
  // glitchy divider + satellites getting blinded along it
  ctx.save(); ctx.fillStyle = '#ff2bd6'; ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 24; ctx.fillRect(0, 955, W, 10); ctx.restore();
  for (let i = 0; i < 6; i++) {
    const x = ((i * 190 + tau * 260) % (W + 200)) - 100, y = 960 + Math.sin(tau * 3 + i) * 18, blind = tau > 0.3 + i * 0.18;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = blind ? '#ff4040' : '#e8f2ff'; ctx.fillRect(-14, -9, 28, 18); ctx.fillStyle = blind ? '#7a1010' : '#3b6ea8'; ctx.fillRect(-52, -6, 32, 12); ctx.fillRect(20, -6, 32, 12); ctx.restore();
    if (blind && tau < 0.55 + i * 0.18) flash(ctx, 0.35, x, y);
  }
  tag(g, 'CYBER WAR', W / 2, 960, { a: clamp(tau / 0.2), bg: '#7b2fe4', size: 56 });
  const ga = Math.max(env(T, t0, t0 + 0.7, 0.05, 0.3), env(T, t0 + 1.2, t0 + 1.8, 0.05, 0.3), env(T, g.wt(8, 'power') - 0.1, g.wt(8, 'power') + 0.6, 0.05, 0.3));
  glitch(ctx, g.canvas, T, ga, 3);
  g.caption.y = 1560;
  g.creditText = 'NASA Black Marble';
}

// ------------------------------------------------------------------ 9–11: wargame, nukes, double KO
async function finale(g, T, pz) {
  const ctx = g.ctx, L = g.L;
  if (T < L(10) - 0.1) {
    const cam = new Camera({ lon: 121, lat: 24.2, zoom: 6.4 + pz + (T - L(9)) * 0.03 });
    await baseMap(g, cam, { layers: ['bluemarble', 's2'], dim: 0.45, borders: 0.3 });
    // burning strait: front line of fire along Taiwan's west coast
    const coast = [[121.0, 25.2], [120.7, 24.6], [120.4, 24.0], [120.2, 23.3], [120.1, 22.6]].map((p) => cam.toScreen(...p));
    const bl = bloomBegin();
    frontLine2D(ctx, coast, T, { width: 9, bloom: bl, seed: 5 });
    bloomEnd(ctx, bl, 0.8);
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(6,9,18,0.9)'; ctx.beginPath(); ctx.roundRect(60, 200, W - 120, 760, 34); ctx.fill(); ctx.restore();
    text(ctx, 'CSIS WAR GAME', W / 2, 265, { font: 'Anton', size: 64, color: '#ffe14d' });
    text(ctx, 'CHINA INVADES TAIWAN × 24', W / 2, 330, { font: 'MontBlack', size: 34 });
    for (let i = 0; i < 24; i++) {
      const q = clamp((T - L(9) - 0.4 - i * 0.09) / 0.15); if (q <= 0) continue;
      const x = 150 + (i % 8) * 112, y = 420 + Math.floor(i / 8) * 112, fail = i !== 5 && i !== 17;
      ctx.save(); ctx.globalAlpha = q; ctx.translate(x, y); ctx.scale(0.6 + 0.4 * ease.outBack(q), 0.6 + 0.4 * ease.outBack(q));
      ctx.fillStyle = fail ? '#1fae4b' : '#8a6d1f'; ctx.beginPath(); ctx.roundRect(-46, -46, 92, 92, 16); ctx.fill(); ctx.restore();
      if (fail) mark(ctx, 'cross', x, y, 54, q, '#ffffff'); else text(ctx, '?', x, y + 2, { font: 'MontBlack', size: 48, alpha: q });
    }
    text(ctx, 'INVASION USUALLY FAILS', W / 2, 790, { font: 'Anton', size: 56, color: '#7dff8a', alpha: clamp((T - L(9) - 2.7) / 0.3), stroke: 6 });
    const lq = clamp((T - g.wt(9, 'two') + 0.2) / 0.3);
    if (lq > 0) {
      for (let i = 0; i < 2; i++) { unitIcon(ctx, 'carrier', 330 + i * 160, 880, 90, 0, US, lq); ctx.save(); ctx.globalAlpha = lq; ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(280 + i * 160, 850); ctx.lineTo(380 + i * 160, 910); ctx.moveTo(380 + i * 160, 850); ctx.lineTo(280 + i * 160, 910); ctx.stroke(); ctx.restore(); }
      text(ctx, '~3,200 US TROOPS', 760, 870, { font: 'Anton', size: 50, color: '#ff8080', alpha: clamp((T - g.wt(9, 'thousands') + 0.2) / 0.3), stroke: 6 });
      text(ctx, 'IN 3 WEEKS', 760, 925, { font: 'MontBlack', size: 30, alpha: clamp((T - g.wt(9, 'weeks') + 0.2) / 0.3) });
    }
    g.creditText += ' · CSIS "The First Battle of the Next War" (2023)';
    return;
  }
  // nukes + KO on a red-alert night globe
  const tau = T - L(10);
  globeShot(g, { cx: W / 2, cy: 1120, R: 520 + pz * 800, lon: lerp(-160, -175, prog(T, L(10), L(11) + 2)), lat: 30 }, [{ id: 'USA', color: US, a: 1 }, { id: 'CHN', color: CN, a: 1 }], { night: 1, borders: 0.15 });
  const al = 0.5 + 0.5 * Math.sin(tau * 7);
  const gg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75); gg.addColorStop(0, 'rgba(255,0,0,0)'); gg.addColorStop(1, `rgba(255,20,20,${0.45 * al})`); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  const n = Math.round(4320 * prog(T, L(10) + 0.3, g.wt(10, '4000') + 0.4, ease.inOutQuad));
  if (T < L(11) + 0.6) bigText(g, n.toLocaleString('en-US'), 360, clamp((T - L(10) - 0.2) / 0.3), { size: 170, color: '#ff4d4d', sub: 'NUCLEAR WARHEADS', subColor: '#fff' });
  for (let i = 0; i < 6; i++) { const mt = tau - 0.6 - i * 0.25; if (mt < 0 || mt > 2) continue; const x = 300 + i * 100, y = 1600 - mt * 900; drawWeapon(ctx, 'w88', x, y, 90, -Math.PI / 2); trail(ctx, [[x, y + 260], [x, y + 160], [x, y + 50]], 'rgba(255,255,255,0.6)', 10); }
  if (T > L(11) - 0.1) {
    const w = clamp((T - L(11) + 0.1) / 0.2);
    bigText(g, 'WHO WINS?', 360, w * (T < L(11) + 1.0 ? 1 : 0), { size: 150, color: '#fff' });
    if (T > L(11) + 1.0) {
      const k = T - L(11) - 1.0;
      if (k < 0.25) whiteFlash(g, 0.9 * (1 - k / 0.25));
      chapterSlam(ctx, 'DOUBLE K.O.', T, L(11) + 1.0, { y: 520, dur: 9, color: '#ffe14d', sub: 'NOBODY WINS' });
      speedLines(ctx, W / 2, 520, T, clamp(1 - k / 0.8));
    }
  }
  g.creditText = 'NASA Black Marble · Warheads: SIPRI Yearbook 2026';
}
