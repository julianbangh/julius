// 02 — What if Africa united and tried taking over the world?
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, conquer, fill, outline, globeShot, loadFlags, flagAt, bigText, tag, headline, text, whiteFlash, mainPolygon, drawMoved, centroidOf, pulseAt, label } from '../../engine/kit.mjs';
import { arrow, blast2D, unitIcon, trail, shake, bloomBegin, bloomEnd, missile } from '../../engine/fx.mjs';
import { initGlobe } from '../../engine/globe.mjs';
import { rng, rgba } from '../../engine/core.mjs';
import { statCard } from '../../engine/ui.mjs';

const GOLD = '#f4b400', NATO = '#2f7bff';
let AFR = [];
const hues = new Map();

function drawAfricaFlag(ctx, x, y, h, a = 1, t = 0, g) {
  const w = h * 1.5;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.fillStyle = '#0f6b3a'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-w / 2, h * 0.32, w, h * 0.18);
  ctx.fillStyle = GOLD; ctx.fillRect(-w / 2, h * 0.28, w, h * 0.05); ctx.fillRect(-w / 2, h * 0.5, w, h * 0.05);
  // gold continent silhouette
  const c = g.countries; ctx.save(); ctx.translate(0, -h * 0.07); const s = h / 95; ctx.scale(s, -s);
  ctx.fillStyle = GOLD; ctx.beginPath();
  for (const k of AFR) { const geom = c.get(k).geometry; const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]; for (const p of polys) { p[0].forEach(([lon, lat], i) => (i ? ctx.lineTo(lon - 17, lat - 2) : ctx.moveTo(lon - 17, lat - 2))); ctx.closePath(); } }
  ctx.fill(); ctx.restore();
  // wave shading
  const gr = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, `rgba(0,0,0,${0.1 + 0.1 * Math.sin(t * 5 + i * 1.5)})`);
  ctx.fillStyle = gr; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.stroke();
  ctx.restore();
}

export default {
  music: { file: 'epic_war.mp3', gain: 0.16, start: 6 },
  async setup(g) {
    await initGlobe();
    AFR = g.countries.list.filter((c) => c.continent === 'Africa').map((c) => c.id);
    const r = rng(5);
    for (const id of AFR) hues.set(id, `hsl(${Math.floor(r() * 360)},70%,55%)`);
    await loadFlags(g, ['us']);
  },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.1, file: 'riser.wav', gain: 0.5 }, { t: 2.8, file: 'impact.wav', gain: 0.8 },
      { t: g.wt(1, 'one') - 0.05, file: 'impact.wav', gain: 0.8 }, { t: g.wt(1, 'overnight'), file: 'whoosh.wav', gain: 0.6 },
      { t: L(2) + 0.6, file: 'whoosh_fast.wav', gain: 0.5 }, { t: L(2) + 1.4, file: 'whoosh_fast.wav', gain: 0.5 }, { t: L(2) + 2.2, file: 'whoosh_fast.wav', gain: 0.5 }, { t: g.wt(2, '15') - 0.3, file: 'ticker.wav', gain: 0.5 },
      { t: L(3) + 0.3, file: 'ticker.wav', gain: 0.5 }, { t: g.wt(3, '2'), file: 'impact.wav', gain: 0.7 },
      { t: g.wt(4, '70') - 0.1, file: 'pop.wav', gain: 0.8 },
      { t: L(5) + 0.3, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(5, 'close') + 0.2, file: 'impact.wav', gain: 0.8 }, { t: g.wt(5, 'ships') - 0.2, file: 'horn.wav', gain: 0.4, dur: 2.5 },
      { t: L(6) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(6, 'jumps') - 0.2, file: 'launch.wav', gain: 0.4 },
      { t: L(7) + 0.2, file: 'whoosh.wav', gain: 0.6 },
      { t: g.wt(8, '50') - 0.1, file: 'cash.wav', gain: 0.6 }, { t: g.wt(8, 'three') - 0.2, file: 'ticker.wav', gain: 0.5 },
      { t: L(9) + 0.2, file: 'launch.wav', gain: 0.5 }, { t: L(9) + 1.1, file: 'boom.wav', gain: 0.7 }, { t: L(9) + 1.5, file: 'boom_small.wav', gain: 0.6 },
      { t: L(10) + 0.2, file: 'riser.wav', gain: 0.4 }, { t: g.wt(10, 'wait') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    if (T < 3.9 || T > L(10) - 0.3) return globeScenes(g, T);
    const keys = [
      [3.9, { lon: 20, lat: 2, zoom: 3.6 }], [L(4) + 0.4, { lon: 20, lat: 2, zoom: 3.6 }], [L(5) + 0.6, { lon: 30, lat: 28, zoom: 6.3 }], [g.wt(5, 'ships') - 0.4, { lon: 31, lat: 27, zoom: 6.0 }],
      [g.wt(5, 'ships') + 0.8, { lon: 30, lat: 5, zoom: 3.3 }], [L(6) - 0.2, { lon: 30, lat: 5, zoom: 3.3 }], [L(6) + 0.9, { lon: 4, lat: 37, zoom: 5.0 }], [L(7) - 0.4, { lon: 6, lat: 37.5, zoom: 5.1 }],
      [L(7) + 0.6, { lon: 43, lat: 13.5, zoom: 6.6 }], [L(8) - 0.2, { lon: 43, lat: 13.5, zoom: 6.8 }], [L(8) + 0.6, { lon: 15, lat: 20, zoom: 3.6 }], [L(9) - 0.2, { lon: 15, lat: 20, zoom: 3.6 }], [L(9) + 0.6, { lon: 8, lat: 38, zoom: 4.9 }], [L(10), { lon: 8, lat: 38, zoom: 5.0 }],
    ];
    const cam = camAt(T, keys);
    const sh = T > L(9) + 1 ? 14 * Math.exp(-(T - L(9) - 1) * 2) : 0;
    const [sx, sy] = shake(T, sh);
    ctx.save(); ctx.translate(sx, sy);
    await baseMap(g, cam, { layers: cam.zoom > 7.5 ? ['bluemarble', 's2'] : ['bluemarble'], dim: 0.28, borders: 0.18 });
    // colours -> unify
    const unify = prog(T, g.wt(1, 'one') - 0.1, g.wt(1, 'one') + 1.2, ease.inOutQuad);
    for (const id of AFR) {
      const c = g.countries.get(id);
      const d = Math.hypot(c.label[0] - 20, c.label[1] - 2) / 40;
      const u = clamp(unify * 1.6 - d * 0.6);
      if (u < 1) fill(g, cam, id, hues.get(id), 0.6 * (1 - u) * clamp((T - 3.9) / 0.3));
      if (u > 0) fill(g, cam, id, GOLD, 0.5 * u);
      if (u < 1) outline(g, cam, id, '#fff', 1.6, 0.8 * (1 - u));
    }
    // outer border glow of the united continent
    if (unify > 0.5) { ctx.save(); ctx.globalAlpha = (unify - 0.5) * 2; for (const id of AFR) outline(g, cam, id, '#ffe9a6', 3, 0.55); ctx.restore(); }
    // flag + title
    if (T > g.wt(1, 'one') - 0.2 && T < L(2) + 0.2) {
      const a = env(T, g.wt(1, 'one') - 0.2, L(2) + 0.2, 0.25, 0.3);
      drawAfricaFlag(ctx, W / 2, 300, 200, a, T, g);
      const b = env(T, g.wt(1, 'overnight'), L(2) + 0.2, 0.25, 0.3);
      bigText(g, 'UNITED STATES', 500, b, { size: 92, color: '#fff', sub: 'OF AFRICA', subColor: GOLD });
    }
    // true-size comparison
    if (T > L(2) - 0.2 && T < L(3) + 0.3) {
      const a = env(T, L(2) - 0.2, L(3) + 0.3, 0.2, 0.4);
      const items = [['USA', [-1, 22], '#2f7bff', 0.4, 'USA'], ['CHN', [31, 2], '#e5484d', 1.2, 'CHINA'], ['IND', [21, -19], '#ff8a2a', 2.0, 'INDIA']];
      for (const [id, to, col, t0, nm] of items) {
        const c = g.countries.get(id), geom = mainPolygon(c.geometry), from = centroidOf(c.geometry);
        const q = ease.inOutCubic(clamp((T - L(2) - t0) / 1.0));
        const start = [to[0] + (id === 'USA' ? -60 : id === 'CHN' ? 60 : 40), to[1] + 30];
        const pos = [lerp(start[0], to[0], q), lerp(start[1], to[1], q)];
        drawMoved(g, cam, geom, from, pos, { fill: col, alpha: 0.65, a: a * clamp((T - L(2) - t0 + 0.2) / 0.3) });
        const [lx, ly] = cam.toScreen(pos[0], pos[1]);
        label(ctx, nm, lx, ly, { size: 40, a: a * q });
      }
      const n = 1.5 * prog(T, g.wt(2, '15') - 0.3, g.wt(2, '15') + 1.0, ease.outCubic);
      statCard(ctx, { y: 300, name: 'Population', value: `${n.toFixed(1)} BILLION`, a: a * clamp((T - g.wt(2, '15') + 0.4) / 0.3), color: GOLD, sub: '30.4 million km² of land' });
    }
    // army
    if (T > L(3) - 0.1 && T < L(4)) {
      const a = env(T, L(3) - 0.1, L(4), 0.2, 0.3);
      const n = Math.round(2e6 * prog(T, L(3) + 0.3, L(3) + 1.8, ease.outCubic));
      bigText(g, n.toLocaleString('en-US'), 330, a, { size: 130, color: GOLD, sub: 'SOLDIERS', subColor: '#fff' });
      const r = rng(9);
      for (let i = 0; i < 46; i++) {
        const lon = -10 + r() * 50, lat = -25 + r() * 50; const c = clamp((T - L(3) - 0.2 - i * 0.03) / 0.25);
        const [x, y] = cam.toScreen(lon, lat); unitIcon(ctx, 'tank', x, y, 34, -Math.PI / 2, GOLD, a * c);
      }
    }
    // cobalt
    if (T > L(4) - 0.1 && T < L(5) + 0.2) {
      const a = env(T, L(4) - 0.1, L(5) + 0.2, 0.25, 0.3);
      hl(g, cam, 'COD', '#3dd6ff', a, { fillAlpha: 0.6 });
      const [x, y] = cam.toScreen(23, -3); label(ctx, 'DR CONGO', x, y, { size: 38, a });
      // battery
      const bx = W / 2, by = 330, bw = 300, bh = 150, f = 0.7 * prog(T, g.wt(4, '70') - 0.4, g.wt(4, '70') + 0.6);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.85)'; ctx.beginPath(); ctx.roundRect(bx - bw / 2 - 30, by - bh / 2 - 30, bw + 90, bh + 60, 26); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 18); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw / 2 + 4, by - 30, 18, 60);
      ctx.fillStyle = '#3dd6ff'; ctx.beginPath(); ctx.roundRect(bx - bw / 2 + 12, by - bh / 2 + 12, (bw - 24) * f, bh - 24, 10); ctx.fill(); ctx.restore();
      text(ctx, `${Math.round(f * 100)}%`, bx, by + 4, { font: 'Anton', size: 80, alpha: a, stroke: 8 });
      text(ctx, 'OF THE WORLD’S COBALT', bx + 15, by + 140, { font: 'MontBlack', size: 36, alpha: a, stroke: 8 });
    }
    // Suez closed + route around Africa
    if (T > L(5) && T < L(6) + 0.3) {
      const a = env(T, L(5), L(6) + 0.3, 0.3, 0.3);
      const [x, y] = cam.toScreen(32.35, 30.6);
      const c = clamp((T - g.wt(5, 'close') - 0.1) / 0.3);
      ctx.save(); ctx.globalAlpha = a * c; ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 18; ctx.lineCap = 'round';
      const s = 46 * (0.8 + 0.2 * ease.outBack(c)); ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); ctx.restore();
      tag(g, 'SUEZ CANAL: CLOSED', W / 2, 300, { a: a * c, bg: '#c62828', size: 44 });
      // ship route
      const route = [[5, 44], [-8, 37], [-18, 22], [-17, 6], [5, -2], [11, -18], [17, -35.5], [32, -32], [45, -15], [55, 5], [68, 15], [80, 6]];
      const p = prog(T, g.wt(5, 'ships') - 0.2, L(6) - 0.2, ease.inOutQuad);
      const pts = []; const N = 120;
      for (let i = 0; i <= N * p; i++) { const u = (i / N) * (route.length - 1), k = Math.floor(u), f = u - k; const A = route[Math.min(k, route.length - 1)], B = route[Math.min(k + 1, route.length - 1)]; pts.push(cam.toScreen(lerp(A[0], B[0], f), lerp(A[1], B[1], f))); }
      if (pts.length > 1) {
        ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([18, 14]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore();
        const h = pts[pts.length - 1], h0 = pts[Math.max(0, pts.length - 3)];
        unitIcon(ctx, 'ship', h[0], h[1], 50, Math.atan2(h[1] - h0[1], h[0] - h0[0]), '#ffffff', a);
        if (p > 0.55) { const [cx, cy] = cam.toScreen(19, -36); label(ctx, 'CAPE OF GOOD HOPE', cx, cy + 40, { size: 30, a: a * clamp((p - 0.55) * 5) }); }
      }
    }
    // Gibraltar + Sicily
    if (T > L(6) - 0.1 && T < L(7) + 0.2) {
      const a = env(T, L(6) - 0.1, L(7) + 0.2, 0.3, 0.3);
      const p1 = prog(T, L(6) + 0.8, L(6) + 2.6, ease.outCubic), p2 = prog(T, g.wt(6, 'jumps') - 0.2, g.wt(6, 'jumps') + 1.6, ease.outCubic);
      arrow(ctx, cam.toScreen(-5.6, 34.8), cam.toScreen(-4.2, 38.5), p1, { color: GOLD, width: 46, a, bend: 0.1 });
      arrow(ctx, cam.toScreen(10.3, 36.5), cam.toScreen(14, 37.6), p2, { color: GOLD, width: 46, a, bend: -0.15 });
      conquer(g, cam, 'ESP', GOLD, [-5.6, 36], clamp(p1 * 1.2 - 0.6) * 0.5);
      const [x, y] = cam.toScreen(-5.5, 35.95); label(ctx, '14 KM', x - 90, y, { size: 40, a: a * p1, color: '#ffe14d' });
      const [x2, y2] = cam.toScreen(12, 37.2); label(ctx, 'SICILY', x2 + 60, y2 - 40, { size: 34, a: a * p2 });
    }
    // Bab-el-Mandeb
    if (T > L(7) && T < L(8) + 0.2) {
      const a = env(T, L(7), L(8) + 0.2, 0.3, 0.3);
      const p = prog(T, L(7) + 0.7, L(7) + 2.4, ease.outCubic);
      arrow(ctx, cam.toScreen(42.9, 12.0), cam.toScreen(43.9, 13.6), p, { color: GOLD, width: 50, a, bend: 0.05 });
      const [x, y] = cam.toScreen(43.4, 12.7); label(ctx, '26 KM', x + 120, y + 40, { size: 44, a: a * p, color: '#ffe14d' });
      const [x2, y2] = cam.toScreen(46, 15.5); label(ctx, 'ARABIA', x2, y2, { size: 40, a });
    }
    // budget
    if (T > L(8) - 0.1 && T < L(9)) {
      const a = env(T, L(8) - 0.1, L(9), 0.25, 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,10,20,0.86)'; ctx.beginPath(); ctx.roundRect(70, 200, W - 140, 760, 34); ctx.fill(); ctx.restore();
      text(ctx, 'MILITARY SPENDING PER YEAR', W / 2, 260, { font: 'MontBlack', size: 38, alpha: a });
      const bars = [['ALL OF AFRICA', 52, GOLD], ['UNITED STATES', 997, NATO]];
      bars.forEach(([n, v, col], i) => {
        const p = prog(T, L(8) + 0.6 + i * 0.5, L(8) + 2.2 + i * 0.5, ease.outCubic);
        const y = 360 + i * 230, bw = (W - 470) * (v / 997) * p;
        text(ctx, n, 130, y - 45, { font: 'MontBlack', size: 34, align: 'left', alpha: a });
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.beginPath(); ctx.roundRect(130, y, Math.max(14, bw), 90, 14); ctx.fill(); ctx.restore();
        text(ctx, `$${Math.round(v * p)}B`, 150 + Math.max(14, bw), y + 46, { font: 'Anton', size: 64, align: 'left', alpha: a, stroke: 8 });
      });
      const c = clamp((T - g.wt(8, 'three') + 0.3) / 0.4);
      text(ctx, 'THE US SPENDS AFRICA’S', W / 2, 840, { font: 'MontBlack', size: 36, alpha: a * c });
      text(ctx, 'WHOLE YEAR IN 19 DAYS', W / 2, 900, { font: 'Anton', size: 64, color: '#ffe14d', alpha: a * c, stroke: 8 });
    }
    // NATO stops the invasion
    if (T > L(9) - 0.2 && T < L(10)) {
      const a = env(T, L(9) - 0.2, L(10), 0.3, 0.3);
      const bl = bloomBegin();
      const targets = [[-4.4, 36.9], [-5.2, 36.4], [13.5, 37.3], [12.6, 37.7], [14.8, 37.0]];
      targets.forEach((tt, i) => {
        const s = cam.toScreen(tt[0] + (i < 2 ? 3 : -2), tt[1] + 6), e = cam.toScreen(...tt);
        const p = clamp((T - L(9) - 0.3 - i * 0.15) / 0.8);
        if (p < 1) unitIcon(ctx, 'jet', lerp(s[0], e[0], p), lerp(s[1], e[1], p), 44, Math.atan2(e[1] - s[1], e[0] - s[0]), NATO, a);
        else blast2D(ctx, e[0], e[1], 70, T - L(9) - 1.1 - i * 0.15, { seed: 50 + i, bloom: bl });
      });
      bloomEnd(ctx, bl, 0.9);
      tag(g, 'NATO', W / 2, 300, { a, bg: NATO, size: 56 });
      text(ctx, 'THE INVASION STALLS', W / 2, 400, { font: 'Anton', size: 70, alpha: a * clamp((T - L(9) - 1) / 0.4), stroke: 8 });
    }
    ctx.restore();
  },
};

function globeScenes(g, T) {
  const ctx = g.ctx, L = g.L;
  if (T < 3.9) {
    const view = { cx: W / 2, cy: 1040, R: lerp(400, 520, prog(T, 0, 3.9)), lon: lerp(-10, 18, prog(T, 0, 3.9)), lat: 5 };
    const items = AFR.map((id) => ({ id, color: hues.get(id), a: clamp((T - 0.3 - (hues.get(id).length % 7) * 0.08) / 0.3), fillAlpha: 0.5 }));
    globeShot(g, view, items);
    headline(ctx, 'What if Africa\nunited?', { y: 230, a: env(T, 0.05, 3.9, 0.2, 0.3) });
    if (T > 3.5) whiteFlash(g, prog(T, 3.5, 3.9) * 0.8);
    return;
  }
  const t0 = L(10) - 0.3;
  const view = { cx: W / 2, cy: 1060, R: lerp(560, 470, prog(T, t0, t0 + 9)), lon: lerp(10, 25, prog(T, t0, t0 + 9)), lat: 4 };
  globeShot(g, view, AFR.map((id) => ({ id, color: GOLD, a: 1, fillAlpha: 0.55 })));
  if (T < t0 + 0.4) whiteFlash(g, 0.8 * (1 - prog(T, t0, t0 + 0.4)));
  // 1 in 3 people
  const a = env(T, g.wt(10, '2100') - 0.3, 99, 0.3, 0.3);
  text(ctx, 'BY 2100', W / 2, 220, { font: 'MontBlack', size: 48, alpha: a, stroke: 8 });
  for (let i = 0; i < 3; i++) {
    const x = W / 2 + (i - 1) * 190, y = 380, col = i === 1 ? GOLD : '#9aa6bd';
    const c = clamp((T - g.wt(10, 'one') + 0.2 - i * 0.12) / 0.3) * a;
    ctx.save(); ctx.globalAlpha = c; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 55, 34, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - 50, y - 12, 100, 120, [40, 40, 10, 10]); ctx.fill(); ctx.restore();
  }
  text(ctx, '1 IN 3 HUMANS', W / 2, 560, { font: 'Anton', size: 84, color: GOLD, alpha: clamp((T - g.wt(10, 'one') - 0.3) / 0.3) * a, stroke: 8 });
  const w = clamp((T - g.wt(10, 'wait') + 0.1) / 0.3);
  bigText(g, 'IT JUST HAS TO WAIT.', 1720, w, { size: 92, color: '#fff' });
  if (w > 0) g.caption.hide = true;
}
