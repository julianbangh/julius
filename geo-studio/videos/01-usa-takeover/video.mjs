// 01 — What if the United States got mad and wanted to take the entire world?
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, conquer, fill, globeShot, loadFlags, flagAt, countryLabel, pulseAt, bigText, tag, headline, text, whiteFlash, fadeBlack, loadEnvelope, rgba } from '../../engine/kit.mjs';
import { loadPuppet, drawPuppet } from '../../engine/puppet.mjs';
import { arrow, blast2D, missile, unitIcon, trail, shake, flash, bloomBegin, bloomEnd } from '../../engine/fx.mjs';
import { initGlobe, globeProjection } from '../../engine/globe.mjs';
import { statCard } from '../../engine/ui.mjs';

const US = '#2f7bff', ALLY = '#4fa3ff', RED = '#e5484d';
const CENTRAL = ['MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN'];
let P;

export default {
  music: { file: 'epic_war.mp3', gain: 0.17 },
  async setup(g) {
    P = await loadPuppet('trump');
    await initGlobe();
    await loadFlags(g, ['us', 'il', 'ca', 'dk', 'ru', 'cn']);
    loadEnvelope(g);
  },
  sfx(g) {
    return [
      { t: 0.12, file: 'pop.wav', gain: 0.9 }, { t: 2.84, file: 'click.wav', gain: 1 }, { t: 2.86, file: 'impact.wav', gain: 0.9 },
      { t: 2.9, file: 'siren.wav', gain: 0.35, dur: 2.2 }, { t: 3.9, file: 'whoosh.wav', gain: 0.7 },
      { t: 5.0, file: 'whoosh_fast.wav', gain: 0.5 }, { t: g.wt(1, 'israel') - 0.05, file: 'pop.wav', gain: 0.8 },
      { t: 9.4, file: 'ticker.wav', gain: 0.5 }, { t: 12.6, file: 'rumble.wav', gain: 0.6, dur: 3 }, { t: g.wt(2, 'week') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: g.L(3) + 0.1, file: 'impact.wav', gain: 0.8 }, { t: g.wt(3, 'sanctions') - 0.05, file: 'pop.wav', gain: 0.9 }, { t: g.wt(3, 'whole') - 0.6, file: 'riser.wav', gain: 0.5 },
      { t: g.L(4) + 0.1, file: 'whoosh.wav', gain: 0.6 }, { t: g.L(4) + 1.6, file: 'launch.wav', gain: 0.4 },
      { t: g.L(5) + 0.2, file: 'horn.wav', gain: 0.45, dur: 2.5 }, { t: g.L(6) + 0.2, file: 'boom.wav', gain: 0.9 }, { t: g.L(6) + 0.55, file: 'boom_small.wav', gain: 0.7 }, { t: g.L(6) + 0.9, file: 'boom_small.wav', gain: 0.6 },
      { t: g.L(7) + 0.1, file: 'whoosh.wav', gain: 0.6 }, ...CENTRAL.map((c, i) => ({ t: g.L(7) + 0.5 + i * 0.28, file: 'pop.wav', gain: 0.5 })), { t: g.wt(7, 'carriers') - 0.2, file: 'horn.wav', gain: 0.4, dur: 2 },
      { t: g.L(8) - 0.3, file: 'whoosh.wav', gain: 0.7 }, { t: g.wt(8, 'russia') - 0.05, file: 'impact.wav', gain: 0.9 }, { t: g.wt(8, 'two') - 0.4, file: 'riser.wav', gain: 0.5 },
      ...Array.from({ length: 11 }, (_, i) => ({ t: g.L(9) + 0.3 + i * 0.13, file: 'pop.wav', gain: 0.45 })), { t: g.wt(9, 'three') - 0.05, file: 'impact.wav', gain: 0.7 },
      { t: g.wt(9, 'battle') - 1.0, file: 'launch.wav', gain: 0.5 }, { t: g.wt(9, 'battle') - 0.1, file: 'boom.wav', gain: 0.7 }, { t: g.wt(9, 'battle') + 0.3, file: 'boom_small.wav', gain: 0.6 },
      { t: g.L(10), file: 'rumble.wav', gain: 0.6, dur: 4 }, { t: g.wt(10, 'part') - 0.1, file: 'impact.wav', gain: 1 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    if (T < 40.0) await flat(g, T);
    else await globePart(g, T);
    // cross-fade flat -> globe
    if (T > 39.4 && T < 40.0) whiteFlash(g, prog(T, 39.4, 40.0, ease.inQuad) * 0.9);
    if (T >= 40.0 && T < 40.5) whiteFlash(g, 0.9 * (1 - prog(T, 40.0, 40.5)));
  },
};

async function flat(g, T) {
  const ctx = g.ctx, L = g.L;
  const tSlam = 2.84;
  const keys = [
    [0, { lon: -98, lat: 39, zoom: 3.55 }], [3.7, { lon: -98, lat: 39, zoom: 3.55 }], [4.6, { lon: -98, lat: 55, zoom: 3.3 }],
    [15.9, { lon: -98, lat: 55, zoom: 3.3 }], [16.9, { lon: -35, lat: 35, zoom: 2.95 }], [22.4, { lon: -30, lat: 35, zoom: 2.97 }],
    [23.4, { lon: -62, lat: 67, zoom: 3.6 }], [27.6, { lon: -58, lat: 67, zoom: 3.65 }], [28.6, { lon: -24, lat: 65, zoom: 3.5 }], [33.8, { lon: -24, lat: 65, zoom: 3.5 }],
    [34.7, { lon: -92, lat: 19, zoom: 3.25 }], [37.4, { lon: -90, lat: 18, zoom: 3.3 }], [38.6, { lon: -45, lat: 33, zoom: 3.0 }], [40, { lon: -40, lat: 33, zoom: 3.0 }],
  ];
  let cam = camAt(T, keys);
  // shake after the button
  const sh = T > tSlam ? 22 * Math.exp(-(T - tSlam) * 3) : 0;
  const sh2 = T > L(6) + 0.2 && T < L(6) + 2 ? 16 * Math.exp(-(T - L(6) - 0.2) * 2.5) : 0;
  const [sx, sy] = shake(T, sh + sh2);
  ctx.save(); ctx.translate(sx, sy);
  await baseMap(g, cam, { dim: 0.3 });
  // --- ownership state
  const usHeld = (id) => {
    if (id === 'USA') return 1;
    if (id === 'CAN') return clamp((T - (L(2) + 3.0)) / 3.2);
    if (id === 'GRL') return clamp((T - (L(6) + 0.3)) / 1.4);
    const i = CENTRAL.indexOf(id); if (i >= 0) return clamp((T - (L(7) + 0.5 + i * 0.28)) / 0.6);
    return 0;
  };
  // world turns red
  const redWave = (c) => { const d = Math.abs((c.label[0] ?? 0) - 15) / 200; return clamp((T - (L(3) + 3.3 + d * 2.2)) / 0.6); };
  for (const c of g.countries.list) {
    if (['USA', 'CAN', 'GRL', 'ISR', 'ATA', ...CENTRAL].includes(c.id)) continue;
    const a = redWave(c); if (a > 0) fill(g, cam, c.id, RED, 0.42 * a);
  }
  // US + conquered
  hl(g, cam, 'USA', US, 1, { fillAlpha: 0.5 + 0.15 * Math.sin(T * 5) * (T < 4 ? 1 : 0) });
  if (T > L(1) && T < L(2) + 3) hl(g, cam, 'CAN', RED, 0.55 + 0.25 * Math.sin(T * 6), { fillAlpha: 0.35 });
  conquer(g, cam, 'CAN', US, [-79, 44], usHeld('CAN'));
  if (T > L(4) && T < L(6) + 0.3) hl(g, cam, 'GRL', RED, 0.6 + 0.25 * Math.sin(T * 6), { fillAlpha: 0.32 });
  conquer(g, cam, 'GRL', US, [-60, 70], usHeld('GRL'));
  for (const id of CENTRAL) conquer(g, cam, id, US, [-104, 26], usHeld(id));
  if (T > L(1) + 2) hl(g, cam, 'ISR', ALLY, clamp((T - g.wt(1, 'israel')) / 0.4));

  // --- arrows into Canada
  if (T > L(1) - 0.3 && T < L(3)) {
    const a = env(T, L(1) - 0.3, L(3), 0.3, 0.6);
    const p = prog(T, L(1) + 0.2, L(1) + 2.6, ease.outCubic);
    const A = [[[-122.5, 47.5], [-123, 55]], [[-104, 46], [-106, 55.5]], [[-84, 42.4], [-76, 47.5]]];
    for (const [s, e] of A) arrow(ctx, cam.toScreen(...s), cam.toScreen(...e), p, { color: US, width: 44, a });
  }
  // --- alliance badge
  if (T > g.wt(1, 'israel') - 0.1 && T < L(2)) {
    const a = env(T, g.wt(1, 'israel') - 0.1, L(2), 0.25, 0.3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,24,0.8)'; ctx.beginPath(); ctx.roundRect(W / 2 - 300, 170, 600, 170, 30); ctx.fill();
    flagAt(g, 'us', W / 2 - 150, 255, 100, a, 4); flagAt(g, 'il', W / 2 + 150, 255, 100, a, 4);
    text(ctx, '+', W / 2, 250, { font: 'Anton', size: 90, color: '#ffe14d', stroke: 8 });
    text(ctx, 'THE ALLIANCE', W / 2, 370, { font: 'MontBlack', size: 40, color: '#fff', stroke: 8, alpha: a });
    ctx.restore();
  }
  // --- Canada stat card + week
  if (T > L(2) - 0.2 && T < L(3)) {
    const a = env(T, L(2) - 0.2, L(3) - 0.3, 0.25, 0.3);
    const n = Math.round(65000 * prog(T, L(2) + 0.2, L(2) + 1.6, ease.outCubic));
    statCard(ctx, { y: 330, flagImg: g.flags.ca, name: 'Canada', value: `${n.toLocaleString('en-US')} TROOPS`, sub: 'guarding 9.98 million km²', a, color: '#ff6b6b' });
    const wk = env(T, g.wt(2, 'week') - 0.1, L(3) - 0.1, 0.15, 0.3);
    bigText(g, 'FALLS IN 1 WEEK', 1180, wk, { size: 110, color: '#7fb2ff' });
  }
  // --- UN
  if (T > L(3) && T < L(4) + 0.4) {
    const a = env(T, L(3), L(4) + 0.4, 0.2, 0.4);
    tag(g, 'UNITED NATIONS', W / 2, 330, { a, bg: '#4b92db', size: 46 });
    const s1 = env(T, g.wt(3, 'emergency') - 0.1, L(4) + 0.4, 0.15, 0.4);
    tag(g, 'EMERGENCY SESSION', W / 2, 440, { a: s1, bg: '#1b2a44', size: 36 });
    const s2 = env(T, g.wt(3, 'sanctions') - 0.05, L(4) + 0.4, 0.12, 0.4);
    ctx.save(); ctx.translate(W / 2, 560); ctx.rotate(-0.08); tag(g, 'SANCTIONS', 0, 0, { a: s2, bg: '#c62828', size: 56 }); ctx.restore();
  }
  // --- Greenland push
  if (T > L(4) + 0.6 && T < L(7)) {
    const a = env(T, L(4) + 0.6, L(7), 0.3, 0.5);
    const p = prog(T, L(4) + 1.2, L(4) + 4.0, ease.inOutCubic);
    arrow(ctx, cam.toScreen(-95, 62), cam.toScreen(-75, 70), p, { color: US, width: 46, a });
    arrow(ctx, cam.toScreen(-68, 63), cam.toScreen(-52, 66), p, { color: US, width: 46, a });
    // jets
    for (let i = 0; i < 4; i++) {
      const q = clamp((T - (L(4) + 1.5 + i * 0.35)) / 2.4); if (q <= 0 || q >= 1) continue;
      const s = cam.toScreen(-88 + i * 3, 61), e = cam.toScreen(-48 + i * 2, 71);
      const x = lerp(s[0], e[0], q), y = lerp(s[1], e[1], q);
      unitIcon(ctx, 'jet', x, y, 46, Math.atan2(e[1] - s[1], e[0] - s[0]), US, a);
    }
  }
  // --- Denmark + UN resist
  if (T > L(5) - 0.2 && T < L(7)) {
    const a = env(T, L(5) - 0.2, L(7), 0.3, 0.4);
    const p = prog(T, L(5) + 0.1, L(5) + 2.6, ease.outCubic);
    arrow(ctx, cam.toScreen(9, 56), cam.toScreen(-30, 64), p * (T < L(6) + 0.3 ? 1 : 1 - prog(T, L(6) + 0.3, L(6) + 1.0)), { color: RED, width: 40, a });
    const sp = cam.toScreen(10, 56); flagAt(g, 'dk', sp[0], sp[1] - 80, 70, a);
    tag(g, 'UN', sp[0] + 120, sp[1] - 80, { a, bg: '#4b92db', size: 34 });
    for (let i = 0; i < 3; i++) {
      const q = clamp((T - (L(5) + 0.4 + i * 0.3)) / 3.0) * 0.8;
      const s = cam.toScreen(-8, 61 + i), e = cam.toScreen(-32, 64.5 + i * 0.6);
      unitIcon(ctx, 'ship', lerp(s[0], e[0], q), lerp(s[1], e[1], q), 40, Math.PI, RED, a * (T < L(6) + 0.5 ? 1 : 0));
    }
  }
  // --- plow through
  if (T > L(6) - 0.1 && T < L(7) + 0.5) {
    const a = env(T, L(6) - 0.1, L(7) + 0.5, 0.15, 0.5);
    arrow(ctx, cam.toScreen(-58, 66), cam.toScreen(-8, 62), prog(T, L(6), L(6) + 0.9, ease.outExpo), { color: US, width: 70, a, glow: 40 });
    const bl = bloomBegin();
    for (let i = 0; i < 3; i++) { const [bx, by] = cam.toScreen(-34 + i * 5, 64.5 + i * 0.6); blast2D(ctx, bx, by, 90, T - (L(6) + 0.2 + i * 0.35), { seed: 20 + i, bloom: bl }); }
    bloomEnd(ctx, bl, 0.9);
  }
  // --- carriers across the Atlantic
  if (T > g.wt(7, 'carriers') - 0.6) {
    const a = env(T, g.wt(7, 'carriers') - 0.6, 40.2, 0.3, 0.2);
    for (let i = 0; i < 5; i++) {
      const q = clamp((T - (g.wt(7, 'carriers') - 0.4 + i * 0.12)) / 4.0);
      const lon = lerp(-72, -38, q), lat = 36 + (i - 2) * 2.2 + Math.sin(q * 3 + i) * 0.4;
      const pts = []; for (let k = 0; k <= 10; k++) pts.push(cam.toScreen(lerp(-72, lon, k / 10), lat));
      trail(ctx, pts, 'rgba(255,255,255,0.5)', 7);
      const [x, y] = cam.toScreen(lon, lat);
      unitIcon(ctx, 'carrier', x, y, 52, 0, US, a);
    }
  }
  ctx.restore();

  // --- HOOK: puppet pops up from the middle of the US
  if (T < 4.6) {
    g.caption.y = 1690;
    const pop = T < 3.8 ? prog(T, 0.1, 0.55, ease.linear) : 1 - prog(T, 3.8, 4.5, ease.inCubic);
    const slam = clamp((T - 1.0) / 2.7);
    const press = T > tSlam ? Math.min(1, (T - tSlam) / 0.06) * (1 - prog(T, tSlam + 0.5, tSlam + 0.9) * 0.3) : 0;
    const talk = T < 3.8 ? clamp(g.amp(T) * 1.5 - 0.15) : 0;
    const [px, py] = shake(T, sh * 0.5);
    // drop shadow on the map
    ctx.save(); ctx.globalAlpha = 0.45 * pop; ctx.fillStyle = '#000'; ctx.filter = 'blur(18px)';
    ctx.beginPath(); ctx.ellipse(W / 2 + 20, 1520, 420 * pop, 60 * pop, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    drawPuppet(ctx, P, W / 2 + px, 1230 + py, 0.9, { t: T, pop, slam, talk, press });
    headline(ctx, 'What if the USA\ntook the world?', { y: 165, a: env(T, 0.05, 4.2, 0.2, 0.4), size: 70 });
    // alarm
    if (T > tSlam) {
      const al = (0.5 + 0.5 * Math.sin((T - tSlam) * 14)) * (1 - prog(T, tSlam + 1.2, tSlam + 2.0));
      ctx.save(); const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,20,20,${0.55 * al})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
      flash(ctx, Math.exp(-(T - tSlam) * 8) * 0.35, W / 2 - 140, 1100);
    }
  }
}

async function globePart(g, T) {
  const ctx = g.ctx, L = g.L;
  const lon = T < L(8) + 0.4 ? lerp(-40, 70, prog(T, 40.0, L(8) + 0.4)) : T < L(9) ? lerp(70, 100, prog(T, L(8) + 0.4, L(9))) : lerp(100, 140, prog(T, L(9), L(10) + 3));
  const lat = lerp(33, 38, prog(T, 40, 44));
  const R = T < L(10) ? lerp(470, 430, prog(T, 40, L(9))) : lerp(430, 360, prog(T, L(10), L(10) + 3));
  const view = { cx: W / 2, cy: 1010, R, lon, lat };
  const rc = clamp((T - g.wt(8, 'russia')) / 0.5);
  const world = clamp((T - (g.wt(8, 'two') - 0.2)) / 1.2);
  const items = [];
  const held = ['USA', 'CAN', 'GRL', 'ISR', ...CENTRAL];
  for (const c of g.countries.list) {
    if (held.includes(c.id)) items.push({ c, color: c.id === 'ISR' ? ALLY : US, a: 1 });
    else if (c.id === 'RUS' || c.id === 'CHN') items.push({ c, color: RED, a: rc });
    else if (world > 0) items.push({ c, color: RED, a: world * 0.75, fillAlpha: 0.45 });
  }
  globeShot(g, view, items.map((it) => ({ c: it.c, color: it.color, a: it.a, fillAlpha: it.fillAlpha })));
  // Russia + China flags
  if (T > g.wt(8, 'russia') - 0.1 && T < L(9)) {
    const a = env(T, g.wt(8, 'russia') - 0.1, L(9), 0.2, 0.3);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.8)'; ctx.beginPath(); ctx.roundRect(W / 2 - 300, 170, 600, 170, 30); ctx.fill(); ctx.restore();
    flagAt(g, 'ru', W / 2 - 150, 255, 100, a, 4); flagAt(g, 'cn', W / 2 + 150, 255, 100, a, 4);
    text(ctx, '+', W / 2, 250, { font: 'Anton', size: 90, color: '#ff6b6b', stroke: 8, alpha: a });
    const b = env(T, g.wt(8, 'two') - 0.1, L(9), 0.2, 0.3);
    bigText(g, '2/3 OF EARTH', 430, b, { size: 96, color: '#ff6b6b', sub: 'VS ONE SUPERPOWER', subColor: '#7fb2ff' });
  }
  // carriers 11 vs 3
  if (T > L(9) - 0.1 && T < L(10)) {
    const a = env(T, L(9) - 0.1, L(10), 0.2, 0.3);
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = 'rgba(6,10,20,0.85)'; ctx.beginPath(); ctx.roundRect(60, 150, W - 120, 470, 34); ctx.fill(); ctx.restore();
    text(ctx, 'SUPERCARRIERS', W / 2, 205, { font: 'MontBlack', size: 40, color: '#cfd8ea', alpha: a });
    for (let i = 0; i < 11; i++) {
      const q = clamp((T - (L(9) + 0.3 + i * 0.13)) / 0.2);
      unitIcon(ctx, 'carrier', 150 + (i % 6) * 156, 290 + Math.floor(i / 6) * 90, 58, 0, US, a * q);
    }
    flagAt(g, 'us', 140, 470, 56, a); text(ctx, '11', 250, 470, { font: 'Anton', size: 80, color: '#7fb2ff', alpha: a, align: 'left' });
    const b = clamp((T - (g.wt(9, 'three') - 0.1)) / 0.2) * a;
    for (let i = 0; i < 3; i++) unitIcon(ctx, 'carrier', 620 + i * 120, 560, 50, 0, RED, b);
    text(ctx, 'NEXT BEST: 3', 760, 470, { font: 'Anton', size: 64, color: '#ff6b6b', alpha: b });
    // battles: missiles across the globe
    const pr = globeProjection(view);
    const bl = bloomBegin();
    const tb = g.wt(9, 'battle') - 1.0;
    const shots = [[[165, 25], [122, 31]], [[160, 40], [129, 37]], [[170, 15], [121, 24]], [[168, 50], [142, 46]]];
    shots.forEach(([s, e], i) => {
      const A = pr(s), B = pr(e); if (!A || !B) return;
      const p = clamp((T - tb - i * 0.15) / 0.9);
      missile(ctx, A, B, p, { height: 0.35, a, width: 8 });
      if (p >= 1) blast2D(ctx, B[0], B[1], 85, T - tb - i * 0.15 - 0.9, { seed: 40 + i, bloom: bl });
    });
    bloomEnd(ctx, bl, 0.9);
  }
  // ending
  if (T > L(10) - 0.1) {
    const a = env(T, L(10) - 0.1, 99, 0.3, 0.3);
    const n = Math.round(8e9 * prog(T, L(10) + 0.2, L(10) + 2.4, ease.outCubic));
    bigText(g, n.toLocaleString('en-US'), 330, a, { size: 104, color: '#fff', sub: 'PEOPLE TO HOLD', subColor: '#ff6b6b' });
    const p2 = clamp((T - (g.wt(10, 'part') - 0.1)) / 0.25);
    bigText(g, 'PART 2?', 640, p2, { size: 170, color: '#ffe14d' });
  }
}
