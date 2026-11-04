// 11 — What if the USA and China went to all-out war? (fiction; numbers: DoD, SIPRI 2026, CSIS 2023 wargame)
// War from the first frame: every line plays over combat footage; numbers are small overlays.
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, text, label, zoomFor, Camera } from '../../engine/kit.mjs';
import { Ground3D, bloomBegin, bloomEnd, flash, shake, unitIcon, trail, blast2D, makeBlast, drawBlast3D, blastDecals, puff, sprites } from '../../engine/fx.mjs';
import { oceanDecal, sunGlint, mark, drawUnits3D, wakeDecals, craterDecals, smokeColumn, boom3D, boomDecal, missile3D, tracer3D, contrail3D, swarm2D, salvo2D, sub2D, glitch } from '../../engine/battle.mjs';
import { drawImagery } from '../../engine/tiles.mjs';
import { rng, deg } from '../../engine/core.mjs';

const US = '#2f7bff', CN = '#e5484d';
const G = new Ground3D();
const FUJIAN = [[119.3, 26.05], [118.1, 24.5], [119.0, 25.4], [117.6, 23.9], [119.6, 26.6]];
const TAIWAN = [[121.2, 25.03], [120.62, 24.2], [120.3, 22.62], [121.5, 25.05], [120.2, 23.0], [121.6, 24.0]];
const COAST = [119.55, 25.45];
const BEACH = [120.48, 24.22];
const SEA = [125.5, 22.0];
const DUSK = { skyTop: '#121a2e', skyMid: '#a5604b', horizonHaze: '#e8a676' };

function circlePts(lon, lat, km, n = 90) {
  const R = 6371, d = km / R, la = lat * deg, lo = lon * deg, out = [];
  for (let i = 0; i <= n; i++) { const b = (i / n) * 2 * Math.PI; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b)); const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)); out.push([lo2 / deg, la2 / deg]); }
  return out;
}
const fwd = (yaw) => [Math.sin(yaw * deg), Math.cos(yaw * deg)];
const right = (yaw) => [Math.cos(yaw * deg), -Math.sin(yaw * deg)];
const headingOf = (yaw) => Math.atan2(Math.cos(yaw * deg), Math.sin(yaw * deg));

/** clean number overlay */
function statPill(ctx, value, sub, y, a, color = '#ffffff') {
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
const count = (T, t0, t1, v) => v * ease.outCubic(clamp((T - t0) / (t1 - t0)));

export default {
  music: { file: 'war_hype.mp3', gain: 0.2 },
  sfxGain: 0.5,
  finish: { vignette: 0.55, grain: 0.045 },
  async setup(g) { sprites(); },
  sfx(g) {
    const L = g.L, out = [];
    const add = (t, file, gain = 1, dur) => out.push({ t, file, gain, dur });
    add(0.0, 'rumble.wav', 0.7, 3.5); add(0.15, 'launch.wav', 0.55); add(0.9, 'launch.wav', 0.45); add(1.7, 'launch.wav', 0.45);
    add(L(1) + 0.2, 'horn.wav', 0.35, 2.5);
    add(g.wt(2, 'air') - 0.6, 'jet.wav', 0.6);
    add(L(3) + 0.8, 'launch.wav', 0.35); add(L(3) + 2.1, 'boom.wav', 0.5); add(L(3) + 3.2, 'boom_small.wav', 0.4);
    add(L(4) - 0.3, 'gunfire.wav', 0.3); add(L(4) + 0.6, 'boom.wav', 0.5); add(L(4) + 1.3, 'jet.wav', 0.45); add(L(4) + 2.3, 'boom_small.wav', 0.4);
    add(g.wt(5, 'jets') - 0.5, 'jet.wav', 0.4);
    add(L(6) + 1.0, 'launch.wav', 0.35); add(L(6) + 2.45, 'boom.wav', 0.6); add(L(6) + 2.9, 'rumble.wav', 0.4, 2.5);
    add(L(7) - 0.1, 'sonar.wav', 0.35); add(L(7) + 0.8, 'boom_small.wav', 0.4); add(L(7) + 1.7, 'boom_small.wav', 0.35);
    add(L(8) + 0.1, 'glitch.wav', 0.3);
    add(L(9), 'rumble.wav', 0.35, 4);
    add(L(10) + 0.4, 'nuke.wav', 0.6); add(L(10) + 1.7, 'nuke.wav', 0.45); add(L(10) + 2.8, 'nuke.wav', 0.4);
    return out;
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    const cuts = [0, L(1) - 0.2, L(2) - 0.2, L(3) - 0.2, L(4) - 0.35, L(5) - 0.15, L(6) + 1.75, L(7) - 0.15, L(8) - 0.1, L(9) - 0.1, L(10) - 0.1];
    if (T < cuts[1]) await coldOpen(g, T);
    else if (T < cuts[2]) await fleet(g, T);
    else if (T < cuts[3]) await carrierGroup(g, T);
    else if (T < cuts[4]) await taiwanSalvo(g, T);
    else if (T < cuts[5]) await beachBattle(g, T, T - cuts[4]);
    else if (T < cuts[6]) await pacific(g, T);
    else if (T < cuts[7]) await carrierStrike(g, T);
    else if (T < cuts[8]) await subs(g, T);
    else if (T < cuts[9]) await cyber(g, T);
    else if (T < cuts[10]) await aftermath(g, T);
    else await nukes(g, T);
    // soft cuts: quick fade up from black
    for (const c of cuts.slice(1)) if (T > c && T < c + 0.16) { ctx.fillStyle = `rgba(0,0,0,${0.7 * (1 - (T - c) / 0.16)})`; ctx.fillRect(0, 0, W, H); }
    if (T < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - T / 0.25})`; ctx.fillRect(0, 0, W, H); }
  },
};

// ------------------------------------------------------------------ 0: missiles launch at dusk (3D)
const RL = rng(11);
const LAUNCHERS = Array.from({ length: 8 }, (_, i) => ({ s: 0.15 + (i % 2) * 0.35 + RL() * 0.15, w: (i - 3.5) * 0.24 + (RL() - 0.5) * 0.06, ts: -0.7 + [0, 4, 1, 5, 2, 6, 3, 7][i] * 0.24, jit: (RL() - 0.5) * 6 }));
async function coldOpen(g, T) {
  const ctx = g.ctx, yaw = 108, f = fwd(yaw), r = right(yaw);
  const [sx, sy] = shake(T, 3);
  G.setup({ lon: COAST[0], lat: COAST[1], zoom: zoomFor(2.6, W, COAST[1]) - T * 0.06, pitch: 12 + T * 2.2, yaw, layers: ['bluemarble', { src: 's2', comp: 'lighten' }], cy: 1180, shakeX: sx, shakeY: sy, hazeMax: 0.75, hazeDist: 2400, bright: -18, contrast: 1.1, sat: 1.0, ...DUSK });
  const pos = LAUNCHERS.map((l) => [l.s * f[0] + l.w * r[0], l.s * f[1] + l.w * r[1]]);
  await G.draw(ctx, (c, h) => craterDecals(c, h, pos.map(([e, n], i) => ({ e, n, r: 0.05, t0: LAUNCHERS[i].ts })), T));
  // dusk falloff over the near ground (Sentinel-2 is 10 m imagery; this close it is soft anyway)
  const fg = ctx.createLinearGradient(0, 1240, 0, H); fg.addColorStop(0, 'rgba(12,9,16,0)'); fg.addColorStop(1, 'rgba(12,9,16,0.6)');
  ctx.fillStyle = fg; ctx.fillRect(0, 1240, W, H - 1240);
  sunGlint(ctx, G, 0.7);
  drawUnits3D(ctx, G, pos.map(([e, n]) => ({ kind: 'launcher', team: 'cn', e, n, heading: headingOf(yaw), size: 0.2, stripe: false })));
  const bl = bloomBegin();
  LAUNCHERS.forEach((l, i) => {
    const [e, n] = pos[i]; const age = T - l.ts; if (age < 0) return;
    for (let k = 0; k < 9; k++) { const a2 = age - k * 0.04; if (a2 < 0) continue; const q = G.project(e + Math.cos(k * 2.1) * 0.04 * (1 + a2 * 1.5), n + Math.sin(k * 2.1) * 0.04 * (1 + a2 * 1.5), 0.02 + a2 * 0.025); if (q) puff(ctx, 'white', k + i, q.x, q.y, (0.05 + a2 * 0.08) * q.s, clamp(1 - a2 / 3) * 0.75); }
    const gl = G.project(e, n, 0.02); if (gl && age < 1.2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rr = 0.25 * gl.s; const gg = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, rr); gg.addColorStop(0, `rgba(255,190,110,${0.6 * (1 - age / 1.2)})`); gg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gl.x, gl.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    const B = [e + f[0] * 160 + l.jit, n + f[1] * 160 + l.jit, 0];
    const q = missile3D(ctx, G, [e, n, 0.05], B, age / 9, { apex: 40, size: 0.05, seed: i, trail: 34, trailStep: 0.006 });
    if (q) { const qq = bl.canvas.width / W; bl.save(); bl.globalCompositeOperation = 'lighter'; bl.fillStyle = 'rgba(255,170,80,0.95)'; bl.beginPath(); bl.arc(q.x * qq, q.y * qq, 16, 0, Math.PI * 2); bl.fill(); bl.restore(); }
    if (age < 0.4) { const s0 = G.project(e, n, 0.05); if (s0) flash(ctx, (0.4 - age) * 0.25, s0.x, s0.y); }
  });
  bloomEnd(ctx, bl, 0.9);
  g.creditText = 'Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · NASA';
}

// ------------------------------------------------------------------ 1: the Chinese fleet (3D)
const RF = rng(21);
const FLEET = Array.from({ length: 30 }, (_, i) => ({ s: Math.floor(i / 6) * 0.95 + (RF() - 0.5) * 0.3, w: ((i % 6) - 2.5) * 0.8 + (RF() - 0.5) * 0.25, kind: i % 3 === 0 ? 'landing' : 'destroyer' }));
async function fleet(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(1) - 0.2, tau = T - t0;
  const bearing = 95, yaw = 62 + tau * 2.5, f = fwd(bearing), r = right(bearing), v = 0.35;
  const ce = f[0] * v * tau, cn = f[1] * v * tau;
  G.setup({ lon: 121.5, lat: 23.5, zoom: zoomFor(5.5 + tau * 0.35, W, 23.5), pitch: 18 + tau * 2.4, yaw, layers: [], cy: 1150, hazeMax: 0.6, hazeDist: 3200, contrast: 1.1, sat: 1.15, ...DUSK });
  const ships = FLEET.map((s, i) => ({ kind: s.kind, team: 'cn', e: -s.s * f[0] + s.w * r[0], n: -s.s * f[1] + s.w * r[1], heading: headingOf(bearing), size: s.kind === 'landing' ? 0.32 : 0.42 }));
  await G.draw(ctx, (c, h) => { oceanDecal(c, h, T, { shift: [ce, cn] }); wakeDecals(c, h, ships.map((s) => ({ ...s, speed: 1 })), T); });
  sunGlint(ctx, G, 1);
  drawUnits3D(ctx, G, ships);
  statPill(ctx, Math.round(count(T, g.wt(1, '2') - 0.2, g.wt(1, '2') + 0.8, 2e6)).toLocaleString('en-US'), 'CHINESE SOLDIERS', 330, env(T, g.wt(1, '2') - 0.2, g.wt(1, 'biggest') - 0.1, 0.25, 0.3));
  statPill(ctx, `${Math.round(count(T, g.wt(1, '370') - 0.6, g.wt(1, '370') + 0.3, 370))}+ SHIPS`, 'BIGGEST NAVY ON EARTH', 330, env(T, g.wt(1, 'biggest') - 0.1, L(2) - 0.2, 0.25, 0.3), '#ffb3b3');
  g.creditText = 'Ships: US DoD China Military Power Report';
}

// ------------------------------------------------------------------ 2: US carrier group + jet formation (3D)
async function carrierGroup(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(2) - 0.2, tau = T - t0;
  const bearing = 330, yaw = 350 - tau * 3, f = fwd(bearing), v = 0.12;
  const ce = f[0] * v * tau, cn = f[1] * v * tau;
  G.setup({ lon: 134, lat: 21, zoom: zoomFor(2.8 + tau * 0.2, W, 21), pitch: 16 + tau * 1.6, yaw, layers: [], cy: 1150, hazeMax: 0.55, hazeDist: 3400, contrast: 1.1, sat: 1.15, skyTop: '#1d3a66', skyMid: '#8fb0d4', horizonHaze: '#d7e3ee' });
  const ships = [{ kind: 'carrier', e: 0, n: 0, size: 0.75 }, { kind: 'destroyer', e: 0.9, n: -0.6, size: 0.36 }, { kind: 'destroyer', e: -0.9, n: -0.4, size: 0.36 }, { kind: 'destroyer', e: 0.3, n: 1.2, size: 0.36 }, { kind: 'destroyer', e: -0.5, n: -1.4, size: 0.36 }]
    .map((s) => ({ ...s, team: 'us', heading: headingOf(bearing) }));
  await G.draw(ctx, (c, h) => { oceanDecal(c, h, T, { shift: [ce, cn] }); wakeDecals(c, h, ships.map((s) => ({ ...s, speed: 0.8 })), T); });
  sunGlint(ctx, G, 0.6);
  const ff = fwd(yaw), rr = right(yaw), jets = [];
  const t1 = g.wt(2, 'air') - 1.4;
  [[0, 0], [-0.25, -0.2], [0.25, -0.2], [-0.5, -0.4], [0.5, -0.4], [-0.75, -0.6], [0.75, -0.6]].forEach(([w, s]) => {
    const d = -1.6 + (T - t1) * 1.1 + s; if (d < -2 || d > 7) return;
    jets.push({ kind: 'jet', team: 'us', e: ff[0] * d + rr[0] * w * 0.6, n: ff[1] * d + rr[1] * w * 0.6, u: 0.16 + Math.abs(w) * 0.03, heading: headingOf(yaw), size: 0.16 });
  });
  for (const j of jets) contrail3D(ctx, G, Array.from({ length: 12 }, (_, k) => [j.e - ff[0] * (12 - k) * 0.1, j.n - ff[1] * (12 - k) * 0.1, j.u]), { a: 0.7, width: 0.006 });
  drawUnits3D(ctx, G, [...ships, ...jets]);
  statPill(ctx, `${Math.round(count(T, g.wt(2, '11') - 0.4, g.wt(2, '11') + 0.3, 11))} CARRIERS`, 'CHINA HAS 3', 330, env(T, g.wt(2, '11') - 0.4, g.wt(2, 'air') - 0.1, 0.25, 0.3), '#b3d1ff');
  statPill(ctx, '$997B vs $314B', 'MILITARY SPENDING PER YEAR (SIPRI)', 330, env(T, g.wt(2, 'three') - 0.4, L(3) - 0.2, 0.25, 0.3), '#b3d1ff');
  g.creditText = 'Spending: SIPRI 2025';
}

// ------------------------------------------------------------------ 3: Taiwan missile salvo (map)
async function taiwanSalvo(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(3);
  const cam = camAt(T, [[t0 - 0.2, { lon: 120.0, lat: 24.2, zoom: 6.75 }], [L(4), { lon: 120.3, lat: 24.1, zoom: 7.05 }]]);
  const [sx, sy] = shake(T, T > t0 + 2.1 ? 6 * Math.exp(-(T - t0 - 2.1) * 1.2) : 0);
  ctx.save(); ctx.translate(sx, sy);
  await baseMap(g, cam, { layers: ['bluemarble', 's2'], dim: 0.2, borders: 0.35 });
  hl(g, cam, 'TWN', US, 0.9, { fillAlpha: 0.18 }); hl(g, cam, 'CHN', CN, 0.9, { fillAlpha: 0.12 });
  const bl = bloomBegin();
  salvo2D(ctx, cam, FUJIAN, TAIWAN, T, t0 + 0.6, { n: 54, flight: 1.1, spread: 3.0, height: 0.35, jitter: 0.55, size: 58, bloom: bl, seed: 4 });
  bloomEnd(ctx, bl, 0.9);
  const r = clamp((T - g.wt(3, '130') + 0.3) / 0.4);
  if (r > 0) { const A = cam.toScreen(119.6, 25.3), B = cam.toScreen(lerp(119.6, 121.0, r), 25.3); ctx.save(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore(); label(ctx, '130 KM', (A[0] + B[0]) / 2, A[1] - 44, { size: 48, color: '#ffe14d', a: r }); }
  const [tx, ty] = cam.toScreen(121, 23.6); label(ctx, 'TAIWAN', tx + 30, ty, { size: 50 });
  ctx.restore();
}

// ------------------------------------------------------------------ 4 + 9: 3D beach landing (and its aftermath)
const RB = rng(77);
const SHORE = 0.55;
const CRAFT = Array.from({ length: 9 }, (_, i) => ({ n: (i - 4) * 0.36 + (RB() - 0.5) * 0.12, e0: SHORE - 2.1 - RB() * 0.5, sp: 0.5 + RB() * 0.12, hitAt: i % 3 === 1 ? [0.95, 1.85, 2.7][Math.floor(i / 3)] : 9 }));
const DEF = Array.from({ length: 5 }, (_, i) => ({ e: SHORE + 1.1 + RB() * 0.5, n: (i - 2) * 0.45 + (RB() - 0.5) * 0.2 }));
const SHOTS = Array.from({ length: 16 }, (_, k) => ({ ts: 0.25 + k * 0.24, ci: (k * 5) % 9, de: (RB() - 0.5) * 0.45, dn: (RB() - 0.5) * 0.35 }));
async function beachBattle(g, T, tau, { aftermath = false, orbit = 0 } = {}) {
  const ctx = g.ctx, tc = Math.min(tau, 3.5);
  const z = zoomFor(5.2, W, BEACH[1]) + 0.07 * tc - (aftermath ? 0.25 : 0);
  const big = [0.95, 1.85, 2.7].reduce((m, h) => (tau > h && tau < h + 1.5 ? Math.max(m, 5 * Math.exp(-(tau - h) * 2.5)) : m), 0);
  const [sx, sy] = shake(T, aftermath ? 0 : 1.5 + big);
  G.setup({ lon: BEACH[0] - 0.006, lat: BEACH[1], zoom: z, pitch: (aftermath ? 40 : 46) - tc * 1.2, yaw: 92 - tc * 3 + orbit, layers: ['bluemarble', { src: 's2', comp: 'lighten' }], cy: 1080, shakeX: sx, shakeY: sy, hazeMax: 0.4, skyTop: '#2a3d5c', skyMid: '#8a9db8', horizonHaze: '#b9c3cf' });
  const stopE = SHORE - 0.12;
  const craft = CRAFT.map((c, i) => { const hit = c.hitAt < 9 && tau > c.hitAt; const e = hit ? Math.min(stopE, c.e0 + c.sp * c.hitAt) : Math.min(stopE, c.e0 + c.sp * tau); return { ...c, e, hit, burn: hit ? clamp((tau - c.hitAt) / 0.6) : 0, landed: !hit && c.e0 + c.sp * tau >= stopE, tLand: (stopE - c.e0) / c.sp, i }; });
  const tanksCN = craft.filter((c) => c.landed).flatMap((c) => [0, 1].map((j) => { const tt = Math.min(tau, 4) - c.tLand - j * 0.35; if (tt < 0) return null; return { kind: 'tank', team: 'cn', e: SHORE + Math.min(0.7, tt * 0.32), n: c.n + (j ? 0.09 : -0.09), heading: 0, size: 0.17, hit: aftermath && (c.i + j) % 2 ? 0.9 : 0 }; })).filter(Boolean);
  const booms = craft.filter((c) => c.hitAt < 9).map((c, i) => ({ e: c.e, n: c.n, t: c.hitAt, r: 0.13, water: false, seed: 30 + i }));
  SHOTS.forEach((s, k) => { const tgt = craft[s.ci]; const e = tgt.e + s.de; booms.push({ e, n: tgt.n + s.dn, t: s.ts + 0.35, r: 0.05, water: e < SHORE - 0.05, seed: 40 + k }); });
  const craters = booms.filter((b) => !b.water).map((b) => ({ e: b.e, n: b.n, r: b.r * 0.9, t0: b.t + 0.1 }));
  await G.draw(ctx, (c, h) => {
    wakeDecals(c, h, craft.filter((x) => !x.hit && !x.landed).map((x) => ({ e: x.e, n: x.n, heading: 0, size: 0.3, speed: 1 })), tau);
    craterDecals(c, h, craters, tau);
    booms.forEach((b) => boomDecal(c, h, b.e, b.n, tau - b.t, b.r, b.seed));
  });
  const units = craft.map((c) => ({ kind: 'landing', team: 'cn', e: c.e, n: c.n, heading: 0, size: 0.3, hit: c.burn }));
  units.push(...tanksCN, ...DEF.map((d) => ({ kind: 'tank', team: 'us', e: d.e, n: d.n, heading: Math.PI, size: 0.19 })));
  const jets = aftermath ? [] : [0, 1, 2].map((i) => { const jt = tau - 1.25 - i * 0.18; return jt > -0.2 && jt < 2.2 ? { kind: 'jet', team: 'us', e: SHORE - 0.9 + i * 0.25, n: 2.6 - jt * 2.6, u: 0.45 + i * 0.05, heading: -Math.PI / 2, size: 0.26, jt } : null; }).filter(Boolean);
  units.push(...jets);
  for (const j of jets) contrail3D(ctx, G, Array.from({ length: 10 }, (_, k) => [j.e, j.n + k * 0.18, j.u]), { a: 0.7 });
  drawUnits3D(ctx, G, units);
  const bl = bloomBegin(); let fl = 0;
  if (!aftermath) {
    DEF.forEach((d, i) => { for (let k = 0; k < 4; k++) { const ts = 0.2 + i * 0.21 + k * 0.85; const tgt = craft[(i + k) % craft.length]; tracer3D(ctx, G, [d.e - 0.1, d.n, 0.04], [tgt.e, tgt.n, 0.03], (tau - ts) / 0.4); } });
    for (const j of jets) { const mt = j.jt - 0.25; if (mt > 0 && mt < 0.7) missile3D(ctx, G, [j.e, j.n + 0.4, j.u], [craft[5].e, craft[5].n, 0], mt / 0.7, { apex: -0.1, size: 0.02 }); }
    booms.forEach((b) => { fl = Math.max(fl, boom3D(ctx, G, b.e, b.n, tau - b.t, { r: b.r, seed: b.seed, bloom: bl, water: b.water })); });
  }
  craft.forEach((c, i) => { if (c.burn > 0) smokeColumn(ctx, G, c.e, c.n, T, { seed: 90 + i, height: aftermath ? 1.6 : 0.9, size: aftermath ? 0.12 : 0.09, a: c.burn, wind: [0.8, 0.25] }); });
  tanksCN.forEach((t, i) => { if (t.hit) smokeColumn(ctx, G, t.e, t.n, T, { seed: 120 + i, height: 0.8, size: 0.06, wind: [0.8, 0.25] }); });
  smokeColumn(ctx, G, SHORE + 0.9, -1.1, T, { seed: 5, height: 1.0, size: 0.1, wind: [0.8, 0.25] }); smokeColumn(ctx, G, SHORE + 1.6, 1.0, T, { seed: 6, height: 0.8, size: 0.08, wind: [0.8, 0.25] });
  bloomEnd(ctx, bl, 0.9);
  flash(ctx, fl * 0.35);
  g.creditText = 'Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · NASA';
}

// ------------------------------------------------------------------ 5–6a: Pacific + carrier-killer range (map)
async function pacific(g, T) {
  const ctx = g.ctx, L = g.L;
  const cam = camAt(T, [[L(5) - 0.2, { lon: 131, lat: 24, zoom: 4.15 }], [L(6) - 0.2, { lon: 132, lat: 23, zoom: 4.0 }], [L(6) + 1.8, { lon: 130, lat: 22, zoom: 3.65 }]]);
  await baseMap(g, cam, { dim: 0.3, borders: 0.3 });
  hl(g, cam, 'CHN', CN, 0.8, { fillAlpha: 0.14 }); hl(g, cam, 'TWN', US, 0.8, { fillAlpha: 0.22 }); hl(g, cam, 'JPN', US, 0.6, { fillAlpha: 0.1 });
  for (const [n, lon, lat] of [['GUAM', 144.8, 13.4], ['OKINAWA', 127.8, 26.3], ['YOKOSUKA', 139.7, 35.3]]) { const [x, y] = cam.toScreen(lon, lat); label(ctx, n, x, y - 40, { size: 30, a: clamp((T - L(5) - 0.2) / 0.3) }); }
  const p = prog(T, L(5), L(6) + 1.6, ease.inOutQuad);
  [[[144.8, 13.4], [126, 21.5]], [[139.7, 35.3], [124.5, 26]], [[134, 17], [124, 23.5]]].forEach(([s, e]) => {
    for (let k = 0; k < 4; k++) {
      const q = clamp(p - k * 0.03), o = [(k % 2) * 0.6, k > 1 ? 0.5 : -0.3];
      const [x, y] = cam.toScreen(lerp(s[0], e[0], q) + o[0], lerp(s[1], e[1], q) + o[1]); const [x0, y0] = cam.toScreen(lerp(s[0], e[0], Math.max(0, q - 0.08)) + o[0], lerp(s[1], e[1], Math.max(0, q - 0.08)) + o[1]);
      trail(ctx, [[x0, y0], [(x0 + x) / 2, (y0 + y) / 2], [x, y]], 'rgba(255,255,255,0.6)', 6);
      unitIcon(ctx, k === 0 ? 'carrier' : 'ship', x, y, k === 0 ? 74 : 52, Math.atan2(y - y0, x - x0), US, 1);
    }
  });
  const jp = prog(T, g.wt(5, 'jets') - 0.6, L(6) + 1.2);
  swarm2D(ctx, cam, [[129, 26.5], [124.5, 25], [121.5, 24.2]], jp, { n: 30, kind: 'jet', color: US, size: 46, spread: 1.6, seed: 8 });
  swarm2D(ctx, cam, [[144, 14], [133, 19], [123.5, 22.8]], jp * 0.9, { n: 22, kind: 'jet', color: US, size: 44, spread: 1.8, seed: 9 });
  if (T > L(6) - 0.1) {
    const a = clamp((T - L(6) + 0.1) / 0.3);
    for (const [km, name, t1, col] of [[1500, 'DF-21D: 1,500 KM', L(6) + 0.1, '#ff9a3c'], [4000, 'DF-26: 4,000 KM', L(6) + 0.6, '#ff3b3b']]) {
      const q = ease.outCubic(clamp((T - t1) / 0.8)); if (q <= 0) continue;
      const pts = circlePts(116.5, 26.5, km * q).map((pp) => cam.toScreen(...pp));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,40,40,0.07)'; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([22, 12]); ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.beginPath(); pts.forEach((pp, i) => (i ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      const top = pts[Math.floor(pts.length * 0.12)]; label(ctx, name, Math.min(W - 200, top[0]), top[1] + 40, { size: 32, color: col, a: a * q });
    }
    const bl = bloomBegin();
    salvo2D(ctx, cam, [[117, 26], [116, 24.5], [118, 28]], [[126, 21.5], [124.5, 26], [124, 23.5]], T, L(6) + 0.9, { n: 9, flight: 0.9, spread: 0.6, height: 0.4, size: 64, bloom: bl, seed: 21 });
    bloomEnd(ctx, bl, 0.9);
  }
}

// ------------------------------------------------------------------ 6b: 3D carrier strike at sea
async function carrierStrike(g, T) {
  const ctx = g.ctx, L = g.L, tau = T - (L(6) + 1.75);
  const hitT = [0.75, 1.15];
  const [sx, sy] = shake(T, hitT.reduce((m, h) => (tau > h && tau < h + 2 ? Math.max(m, 8 * Math.exp(-(tau - h) * 2.2)) : m), 1));
  G.setup({ lon: SEA[0], lat: SEA[1], zoom: zoomFor(4.6, W, SEA[1]), pitch: 26, yaw: 20 + tau * 4, layers: [], cy: 1060, shakeX: sx, shakeY: sy, hazeMax: 0.6, hazeDist: 3500, contrast: 1.1, sat: 1.15, ...DUSK });
  const car = { kind: 'carrier', team: 'us', e: 0.12 * tau, n: 0.04 * tau, heading: 0.35, size: 0.75, hit: clamp((tau - hitT[0]) / 0.8) * 0.8 };
  const esc = [{ kind: 'destroyer', team: 'us', e: -1.0 + 0.12 * tau, n: -0.6 + 0.04 * tau, heading: 0.35, size: 0.38 }, { kind: 'destroyer', team: 'us', e: 1.1 + 0.12 * tau, n: 0.9 + 0.04 * tau, heading: 0.35, size: 0.38 }];
  await G.draw(ctx, (c, h) => { oceanDecal(c, h, T); wakeDecals(c, h, [car, ...esc].map((u) => ({ ...u, speed: 1 })), tau); hitT.forEach((ht, i) => boomDecal(c, h, car.e + i * 0.15, car.n, tau - ht, 0.28, 60 + i)); });
  sunGlint(ctx, G, 1);
  drawUnits3D(ctx, G, [car, ...esc]);
  const bl = bloomBegin(); let fl = 0;
  hitT.forEach((ht, i) => { const p = (tau - (ht - 0.75)) / 0.75; if (p > 0 && p < 1) missile3D(ctx, G, [car.e - 3 + i, car.n + 5, 3], [car.e + i * 0.15, car.n, 0.04], p, { apex: 0.4, size: 0.035 }); fl = Math.max(fl, boom3D(ctx, G, car.e + i * 0.15, car.n, tau - ht, { r: 0.28, seed: 60 + i, bloom: bl })); });
  if (tau > hitT[0]) smokeColumn(ctx, G, car.e, car.n, T, { seed: 61, height: 1.6, size: 0.22, a: clamp((tau - hitT[0]) / 0.5), wind: [0.9, 0.3], n: 18 });
  bloomEnd(ctx, bl, 1);
  flash(ctx, fl * 0.45);
  g.creditText = '';
}

// ------------------------------------------------------------------ 7: submarines (map)
async function subs(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(7) - 0.15, tau = T - t0;
  const cam = camAt(T, [[t0, { lon: 119.9, lat: 24.0, zoom: 7.3 }], [L(8), { lon: 119.85, lat: 24.05, zoom: 7.5 }]]);
  await baseMap(g, cam, { layers: ['bluemarble', 's2'], dim: 0.15, borders: 0.3 });
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,40,70,0.5)'); gr.addColorStop(1, 'rgba(0,15,35,0.7)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = (i * 131 + T * 40) % W, y = H - ((i * 97 + T * (80 + i * 3)) % H); ctx.fillStyle = 'rgba(180,230,255,0.22)'; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2); ctx.fill(); }
  const ships = Array.from({ length: 7 }, (_, i) => ({ lon: 119.35 + (i % 4) * 0.33, lat: 23.55 + Math.floor(i / 4) * 0.75 + (i % 2) * 0.18, hit: [1.0, 1.6, 2.2, 2.7, 9, 9, 9][i] }));
  const subsP = [[120.3, 23.2], [119.1, 24.9], [120.35, 24.95]];
  const bl = bloomBegin();
  ships.forEach((s, i) => { const [x, y] = cam.toScreen(s.lon, s.lat); const sunk = tau > s.hit; unitIcon(ctx, 'ship', x, y + (sunk ? (tau - s.hit) * 20 : 0), 66, Math.PI * 0.1, sunk ? '#552222' : CN, sunk ? clamp(1 - (tau - s.hit) / 1.2) : 1); if (s.hit < 9) blast2D(ctx, x, y, 72, tau - s.hit, { seed: 80 + i, bloom: bl }); });
  subsP.forEach((p, i) => { const [x, y] = cam.toScreen(...p); sub2D(ctx, x, y, 96, -0.4 + i * 0.6, T + i * 0.3, { color: US }); });
  ships.forEach((s, i) => { if (s.hit > 9) return; const from = cam.toScreen(...subsP[i % 3]), to = cam.toScreen(s.lon, s.lat); const p = clamp((tau - (s.hit - 0.6)) / 0.6); if (p > 0 && p < 1) { ctx.save(); ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(lerp(from[0], to[0], p), lerp(from[1], to[1], p)); ctx.stroke(); ctx.restore(); } });
  bloomEnd(ctx, bl, 0.9);
}

// ------------------------------------------------------------------ 8: cyber blackout (split screen)
async function cyber(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(8) - 0.1, tau = T - t0;
  const dark = clamp((T - g.wt(8, 'power') + 0.5) / 1.3);
  const halves = [
    { cam: new Camera({ lon: -96 + tau * 0.6, lat: 38.5, zoom: 4.05 + tau * 0.04, cy: 480 }), y0: 0, name: 'USA', cities: [[-74, 40.7], [-87.6, 41.9], [-118.2, 34], [-95.4, 29.8], [-122.4, 37.8], [-112, 33.4], [-104.9, 39.7], [-97, 32.8], [-84.4, 33.7], [-80.2, 25.8], [-93.3, 45], [-90.2, 38.6], [-77, 38.9], [-71, 42.4]] },
    { cam: new Camera({ lon: 112 - tau * 0.6, lat: 32.5, zoom: 4.05 + tau * 0.04, cy: 1440 }), y0: 960, name: 'CHINA', cities: [[116.4, 39.9], [121.5, 31.2], [113.3, 23.1], [104, 30.7], [114.3, 30.6], [120.2, 30.3], [126.6, 45.7], [117.2, 39.1], [108.9, 34.3], [118.8, 32], [106.5, 29.6], [113.6, 34.7], [123.4, 41.8], [119.3, 26.1]] },
  ];
  for (const hv of halves) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, hv.y0, W, 960); ctx.clip();
    ctx.fillStyle = '#020309'; ctx.fillRect(0, hv.y0, W, 960);
    await drawImagery(ctx, hv.cam, ['blackmarble']);
    hv.cities.forEach((ll, i) => { const q = clamp(dark * 1.9 - (i % 7) * 0.12); if (q <= 0) return; const [x, y] = hv.cam.toScreen(...ll); const r = 30 + 120 * ease.outCubic(q); const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(0,0,0,${0.97 * q})`); gg.addColorStop(0.7, `rgba(0,0,0,${0.8 * q})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    const lights = Math.round(100 - 88 * dark);
    text(ctx, `${hv.name} POWER ${lights}%`, W / 2, hv.y0 + (hv.y0 ? 870 : 240), { font: 'Anton', size: 58, color: lights < 50 ? '#ff6b6b' : '#ffffff', stroke: 8 });
  }
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, 957, W, 6); ctx.restore();
  glitch(ctx, g.canvas, T, 0.6 * Math.max(env(T, t0, t0 + 0.5, 0.05, 0.25), env(T, g.wt(8, 'power') - 0.1, g.wt(8, 'power') + 0.4, 0.05, 0.25)), 3);
  g.caption.y = 1560;
  g.creditText = 'NASA Black Marble';
}

// ------------------------------------------------------------------ 9: aftermath + war-game results (3D)
async function aftermath(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(9) - 0.1, tau = T - t0;
  await beachBattle(g, T, 3.6 + tau * 0.1, { aftermath: true, orbit: -30 + tau * 4 });
  const a = clamp((tau - 0.3) / 0.4);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,10,20,0.66)'; ctx.beginPath(); ctx.roundRect(70, 170, W - 140, 520, 30); ctx.fill(); ctx.restore();
  text(ctx, 'CSIS WAR GAME', W / 2, 235, { font: 'Anton', size: 58, color: '#ffe14d', alpha: a });
  text(ctx, 'CHINA INVADES TAIWAN, 24 TIMES', W / 2, 295, { font: 'MontBlack', size: 30, alpha: a });
  for (let i = 0; i < 24; i++) {
    const q = clamp((T - L(9) - 0.6 - i * 0.07) / 0.15) * a; if (q <= 0) continue;
    const x = 190 + (i % 12) * 64, y = 375 + Math.floor(i / 12) * 66, fail = i !== 5 && i !== 17;
    ctx.save(); ctx.globalAlpha = q; ctx.fillStyle = fail ? 'rgba(31,174,75,0.9)' : 'rgba(138,109,31,0.9)'; ctx.beginPath(); ctx.roundRect(x - 26, y - 26, 52, 52, 10); ctx.fill(); ctx.restore();
    if (fail) mark(ctx, 'cross', x, y, 30, q, '#ffffff'); else text(ctx, '?', x, y + 2, { font: 'MontBlack', size: 30, alpha: q });
  }
  text(ctx, 'THE INVASION USUALLY FAILED', W / 2, 510, { font: 'Anton', size: 50, color: '#8dffa0', alpha: clamp((T - g.wt(9, 'usually') + 0.2) / 0.3) * a });
  text(ctx, 'US LOSSES: 2 CARRIERS · ~3,200 TROOPS', W / 2, 590, { font: 'MontBlack', size: 34, color: '#ff9a9a', alpha: clamp((T - g.wt(9, 'two') + 0.2) / 0.3) * a });
  text(ctx, 'IN 3 WEEKS', W / 2, 640, { font: 'MontBlack', size: 30, alpha: clamp((T - g.wt(9, 'weeks') + 0.2) / 0.3) * a });
  g.creditText = 'CSIS, "The First Battle of the Next War" (2023)';
}

// ------------------------------------------------------------------ 10–11: mushroom clouds on the horizon (3D)
const NUKES = [{ e: 3, n: 24, dt: 0.35, r5: 4.5, seed: 7 }, { e: -8, n: 36, dt: 1.5, r5: 5.5, seed: 8 }, { e: 10, n: 50, dt: 2.6, r5: 6.5, seed: 9 }];
let NB = null;
async function nukes(g, T) {
  const ctx = g.ctx, L = g.L, t0 = L(10) - 0.1, tau = T - t0;
  if (!NB) NB = NUKES.map((k) => makeBlast({ r5: k.r5, kind: 'nuke', seed: k.seed }));
  const lastBlast = NUKES.reduce((m, k) => (tau > k.dt ? k.dt : m), -9);
  const [sx, sy] = shake(T, tau - lastBlast < 2 ? 4 * Math.exp(-(tau - lastBlast) * 2) : 0.6);
  G.setup({ lon: 123, lat: 23, zoom: zoomFor(5, W, 23), pitch: 13 + tau * 0.6, yaw: 8, layers: [], cy: 1320, shakeX: sx, shakeY: sy, hazeMax: 0.8, hazeDist: 4200, maxDist: 60000, contrast: 1.08, sat: 1.1, bright: -10, ...DUSK });
  await G.draw(ctx, (c, h) => {
    oceanDecal(c, h, T);
    NUKES.forEach((k, i) => { c.save(); c.translate(k.e * h.km, -k.n * h.km); blastDecals(c, NB[i], (tau - k.dt) * 0.5, h.km); c.restore(); });
  });
  sunGlint(ctx, G, 0.8);
  const bl = bloomBegin(); let fl = 0;
  [...NUKES.keys()].sort((a, b) => NUKES[b].n - NUKES[a].n).forEach((i) => {
    const k = NUKES[i], tt = (tau - k.dt) * 0.5; // half speed: they are huge and far away
    fl = Math.max(fl, drawBlast3D(ctx, (x, y, z) => G.project(k.e + x, k.n + y, z), NB[i], tt, { bloom: bl }));
  });
  bloomEnd(ctx, bl, 1.1);
  flash(ctx, fl * 0.5, W / 2, 700);
  const n = Math.round(4320 * prog(T, L(10) + 0.2, g.wt(10, '4000') + 0.4, ease.inOutQuad));
  statPill(ctx, n.toLocaleString('en-US'), 'NUCLEAR WARHEADS BETWEEN THEM', 300, env(T, L(10) + 0.1, L(11) - 0.1, 0.3, 0.3), '#ffd0c4');
  const w = clamp((T - g.wt(11, 'probably') + 0.1) / 0.5);
  if (w > 0) text(ctx, 'NO ONE WINS', W / 2, 330, { font: 'Anton', size: 130, color: '#ffffff', alpha: w, shadow: 24 });
  const end = clamp((T - (g.Le(11) + 0.3)) / 0.6);
  if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
  g.creditText = 'Warheads: SIPRI Yearbook 2026';
}
