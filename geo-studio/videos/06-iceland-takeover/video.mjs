// 06 — What if Iceland tried to take over the world? Realistically.
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, conquer, fill, outline, globeShot, loadFlags, flagAt, bigText, tag, headline, text, whiteFlash, label, pulseAt } from '../../engine/kit.mjs';
import { unitIcon, trail, shake } from '../../engine/fx.mjs';
import { initGlobe } from '../../engine/globe.mjs';
import { statCard } from '../../engine/ui.mjs';
import { createCanvas } from '../../engine/core.mjs';
import { drawCountry, drawHighlight, loadCountries } from '../../engine/geo.mjs';
let C10;

const ICE = '#5ec8ff', DK = '#e5484d', US = '#2f7bff', UK = '#ff6b6b';
const TORSHAVN = [-6.77, 62.01], KEF = [-22.6, 63.98], REYK = [-21.9, 64.15];
const ROUTE = [[-14.5, 64.6], [-12, 63.6], [-9, 62.6], [-6.9, 62.05]];
let buf;

function heli(ctx, x, y, s, a, t) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = '#e8ecf2'; ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(0, 0, 42, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(38, -4); ctx.lineTo(100, -8); ctx.lineTo(100, 4); ctx.lineTo(38, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d62828'; ctx.fillRect(-10, -26, 20, 52);
  ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-70 * Math.cos(t * 30), -34); ctx.lineTo(70 * Math.cos(t * 30), -34); ctx.stroke();
  ctx.restore();
}
function phone(ctx, x, y, s, a, t) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x + Math.sin(t * 60) * 6 * a, y); ctx.rotate(Math.sin(t * 45) * 0.06); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#1a0505'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-90, 70); ctx.lineTo(-70, -10); ctx.lineTo(70, -10); ctx.lineTo(90, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(0, 30, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.roundRect(-110, -60, 220, 46, 23); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export default {
  music: { file: 'epic_war.mp3', gain: 0.15, start: 20 },
  async setup(g) { await initGlobe(); await loadFlags(g, ['is', 'fo', 'dk', 'us', 'gb']); buf = createCanvas(W, H); C10 = loadCountries('10m'); },
  sfx(g) {
    const L = g.L;
    return [
      { t: 0.1, file: 'riser.wav', gain: 0.45 }, { t: g.wt(0, 'realistically') - 0.05, file: 'impact.wav', gain: 0.8 },
      { t: L(1) + 0.3, file: 'pop.wav', gain: 0.6 }, { t: g.wt(1, 'none') - 0.05, file: 'impact.wav', gain: 0.7 },
      { t: L(2) + 1.5, file: 'pop.wav', gain: 0.5 }, { t: L(2) + 2.6, file: 'pop.wav', gain: 0.5 }, { t: L(2) + 3.6, file: 'pop.wav', gain: 0.5 }, { t: L(2) + 4.6, file: 'pop.wav', gain: 0.5 },
      { t: L(3) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: L(4) + 0.3, file: 'horn.wav', gain: 0.45, dur: 3 }, { t: g.wt(4, 'plants') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: L(5), file: 'pop.wav', gain: 0.8 }, { t: L(6) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(6, 'danish') - 0.2, file: 'horn.wav', gain: 0.45, dur: 2.5 },
      { t: L(7) + 0.3, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(7, 'jets') - 0.1, file: 'launch.wav', gain: 0.5 },
      { t: L(8), file: 'phone.wav', gain: 0.6 }, { t: g.wt(8, 'over') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: g.wt(9, 'three') - 0.1, file: 'impact.wav', gain: 0.9 }, { t: L(10) + 0.4, file: 'riser.wav', gain: 0.4 }, { t: g.wt(10, 'gave') - 0.1, file: 'impact.wav', gain: 0.8 },
      { t: g.wt(11, 'lose') - 0.1, file: 'impact.wav', gain: 0.9 },
    ];
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    if (T < 3.9) {
      globeShot(g, { cx: W / 2, cy: 1050, R: lerp(440, 620, prog(T, 0, 3.9)), lon: lerp(-50, -19, prog(T, 0, 3.9)), lat: lerp(40, 60, prog(T, 0, 3.9)) }, [{ id: 'ISL', color: ICE, a: 1 }]);
      headline(ctx, 'What if Iceland took\nover the world?', { y: 230, a: env(T, 0.05, 3.9, 0.2, 0.3) });
      const r = clamp((T - g.wt(0, 'realistically') + 0.05) / 0.2);
      ctx.save(); ctx.translate(W / 2, 470); ctx.rotate(-0.06); tag(g, 'REALISTICALLY', 0, 0, { a: r, bg: '#c62828', size: 50 }); ctx.restore();
      if (T > 3.5) whiteFlash(g, prog(T, 3.5, 3.9) * 0.7);
      return;
    }
    const keys = [
      [3.9, { lon: -19, lat: 64.9, zoom: 6.0 }], [L(3) - 0.2, { lon: -19, lat: 64.9, zoom: 6.1 }], [L(3) + 1.0, { lon: -12.5, lat: 63.3, zoom: 5.3 }], [g.wt(4, 'plants') - 0.9, { lon: -11, lat: 63, zoom: 5.4 }],
      [g.wt(4, 'plants') + 0.2, { lon: -6.9, lat: 62.05, zoom: 8.4 }], [L(6) - 0.2, { lon: -6.9, lat: 62.05, zoom: 8.6 }], [L(6) + 0.9, { lon: -2, lat: 60, zoom: 4.6 }], [L(7) - 0.2, { lon: -2, lat: 60, zoom: 4.7 }],
      [L(7) + 1.0, { lon: -22.4, lat: 64.0, zoom: 8.9 }], [L(9) - 0.3, { lon: -22.4, lat: 64.0, zoom: 9.1 }], [L(9) + 0.7, { lon: -12, lat: 60, zoom: 4.4 }], [L(10) + 0.5, { lon: -16, lat: 63, zoom: 4.5 }], [80, { lon: -17, lat: 64.5, zoom: 4.9 }],
    ];
    const cam = camAt(T, keys);
    await baseMap(g, cam, { layers: cam.zoom > 5.2 ? ['bluemarble', 's2'] : ['bluemarble'], dim: 0.22, borders: 0.3 });
    // night tint while sailing
    const night = env(T, L(4) - 0.2, g.wt(4, 'plants') - 0.4, 0.5, 0.6);
    if (night > 0) { ctx.fillStyle = `rgba(4,8,30,${0.55 * night})`; ctx.fillRect(0, 0, W, H); }
    // Iceland always highlighted
    if (cam.zoom > 6.5) drawHighlight(ctx, cam, C10.get('ISL'), ICE, 1, { fillAlpha: 0.18, glow: 10 }); else hl(g, cam, 'ISL', ICE, 1, { fillAlpha: 0.3 });
    // Cod Wars fishing limit (thick stroke = buffer)
    if (T > L(10) - 0.3) {
      const a = env(T, L(10) - 0.3, 99, 0.4, 0.3);
      const nm = T < L(10) + 2.4 ? 12 : T < L(10) + 4.8 ? 50 : 200;
      const grow = clamp((T - (L(10) + (nm === 12 ? 0 : nm === 50 ? 2.4 : 4.8))) / 0.8);
      const prevNm = nm === 12 ? 4 : nm === 50 ? 12 : 50;
      const km = (prevNm + (nm - prevNm) * ease.outCubic(grow)) * 1.852;
      const px = km * cam.pxPerKm();
      const b = buf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
      const c = g.countries.get('ISL');
      b.save(); const s = cam.applyZ8(b, c.ox, c.oy, 0); b.lineWidth = (2 * px) / s; b.lineJoin = 'round'; b.strokeStyle = '#5ec8ff'; b.fillStyle = '#5ec8ff'; b.fill(c.path); b.stroke(c.path); b.restore();
      ctx.save(); ctx.globalAlpha = 0.28 * a; ctx.drawImage(buf, 0, 0); ctx.restore();
      const yrs = { 12: '1958', 50: '1972', 200: '1975' };
      const [x, y] = cam.toScreen(-18.5, 64.9 - km / 111 - 0.4);
      label(ctx, `${yrs[nm]}: ${nm} NAUTICAL MILES`, W / 2, Math.min(H - 600, y + 40), { size: 40, color: '#bfeaff', a });
      tag(g, 'THE COD WARS  1958–1976', W / 2, 300, { a, bg: '#0e3a5c', size: 42 });
      // British trawlers pushed out
      for (let i = 0; i < 6; i++) {
        const ang = -0.4 + i * 0.5, r0 = 2.2 + (i % 2) * 0.6;
        const push = ease.inOutQuad(clamp((T - L(10) - 1 - i * 0.2) / 7));
        const lon = -18.5 + Math.cos(ang) * (r0 + push * 6) * 2.1, lat = 64.9 - Math.sin(ang) * (r0 + push * 6) * 0.9 - 1;
        const [tx, ty] = cam.toScreen(lon, lat); unitIcon(ctx, 'ship', tx, ty, 56, ang + Math.PI, UK, a * (1 - clamp((push - 0.85) * 6)));
      }
      flagAt(g, 'gb', W - 160, 420, 60, a * clamp((T - L(10) - 0.5) / 0.4));
    }
    // ---- stat card + army 0
    if (T > L(1) - 0.2 && T < L(2) + 0.2) {
      const a = env(T, L(1) - 0.2, L(2) + 0.2, 0.25, 0.3);
      const n = Math.round(390000 * prog(T, L(1) + 0.2, L(1) + 1.4, ease.outCubic));
      statCard(ctx, { y: 330, flagImg: g.flags.is, name: 'Iceland', value: `${n.toLocaleString('en-US')} PEOPLE`, a, color: ICE });
      const z = clamp((T - g.wt(1, 'none') + 0.1) / 0.25);
      ctx.save(); ctx.translate(W / 2, 600); ctx.rotate(-0.08); tag(g, 'ARMY: 0', 0, 0, { a: a * z, bg: '#c62828', size: 64 }); ctx.restore();
    }
    // ---- coast guard inventory
    if (T > L(2) - 0.1 && T < L(3) + 0.1) {
      const a = env(T, L(2) - 0.1, L(3) + 0.1, 0.25, 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.85)'; ctx.beginPath(); ctx.roundRect(60, 160, W - 120, 470, 32); ctx.fill(); ctx.restore();
      text(ctx, 'THE ENTIRE MILITARY', W / 2, 215, { font: 'MontBlack', size: 40, alpha: a });
      const items = [['200 PEOPLE', L(2) + 1.5, (x, y, b) => { for (let i = 0; i < 5; i++) { ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = '#cfd8ea'; ctx.beginPath(); ctx.arc(x - 80 + i * 40, y - 22, 13, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - 95 + i * 40, y - 6, 30, 40, 8); ctx.fill(); ctx.restore(); } }],
        ['2 PATROL SHIPS', L(2) + 2.6, (x, y, b) => { unitIcon(ctx, 'ship', x - 55, y, 58, 0, ICE, b); unitIcon(ctx, 'ship', x + 55, y, 58, 0, ICE, b); }],
        ['1 PLANE', L(2) + 3.6, (x, y, b) => unitIcon(ctx, 'jet', x, y, 66, -0.3, ICE, b)],
        ['3 HELICOPTERS', L(2) + 4.6, (x, y, b) => { for (let i = 0; i < 3; i++) heli(ctx, x - 80 + i * 80, y + (i % 2) * 10, 50, b, T + i); }]];
      items.forEach(([s, t0, draw], i) => {
        const b = clamp((T - t0) / 0.3) * a; const x = i % 2 ? 790 : 290, y = 340 + Math.floor(i / 2) * 170;
        draw(x, y, b); text(ctx, s, x, y + 70, { font: 'MontBlack', size: 30, alpha: b });
      });
      for (let i = 0; i < 2; i++) { const [x, y] = cam.toScreen(-22.3 + i * 0.6, 63.7 - i * 0.1); unitIcon(ctx, 'ship', x, y, 42, 0.2, ICE, a * clamp((T - L(2) - 2.6) / 0.3)); }
    }
    // ---- route to the Faroes
    if (T > L(3) && T < L(6) + 0.5) {
      const a = env(T, L(3), L(6) + 0.5, 0.3, 0.4);
      const pts = ROUTE.map((p) => cam.toScreen(...p));
      ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([16, 12]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
      if (T < L(4)) { const m = pts[1]; label(ctx, '450 KM', m[0] + 30, m[1] - 50, { size: 48, color: '#ffe14d', a }); }
      if (cam.zoom > 6.5) drawHighlight(ctx, cam, C10.get('FRO'), T > g.wt(4, 'plants') ? ICE : '#ffb020', a, { fillAlpha: 0.35, glow: 10 }); else hl(g, cam, 'FRO', T > g.wt(4, 'plants') ? ICE : '#ffb020', a, { fillAlpha: 0.5 });
      const [fx, fy] = cam.toScreen(-6.9, 62.2);
      if (T < L(4) + 1) label(ctx, 'FAROE ISLANDS', fx, fy - 70, { size: 40, a });
      // sailing fleet
      const p = prog(T, L(4) + 0.2, g.wt(4, 'plants') - 0.2, ease.inOutQuad);
      if (p > 0 && p < 1) {
        const u = p * (ROUTE.length - 1), k = Math.min(ROUTE.length - 2, Math.floor(u)), f = u - k;
        for (let i = 0; i < 2; i++) {
          const lon = lerp(ROUTE[k][0], ROUTE[k + 1][0], f) - i * 0.3, lat = lerp(ROUTE[k][1], ROUTE[k + 1][1], f) + i * 0.15;
          const [x, y] = cam.toScreen(lon, lat);
          const trailPts = []; for (let j = 8; j >= 0; j--) { const uu = Math.max(0, u - j * 0.04), kk = Math.min(ROUTE.length - 2, Math.floor(uu)), ff = uu - kk; trailPts.push(cam.toScreen(lerp(ROUTE[kk][0], ROUTE[kk + 1][0], ff) - i * 0.3, lerp(ROUTE[kk][1], ROUTE[kk + 1][1], ff) + i * 0.15)); }
          trail(ctx, trailPts, 'rgba(255,255,255,0.6)', 6);
          unitIcon(ctx, 'ship', x, y, 46, Math.atan2(ROUTE[k + 1][1] < ROUTE[k][1] ? 0.5 : -0.5, 1), ICE, a);
        }
      }
      if (T > g.wt(4, 'plants') - 0.2 && T < L(6)) {
        const [tx, ty] = cam.toScreen(...TORSHAVN);
        const b = clamp((T - g.wt(4, 'plants') + 0.2) / 0.3) * a;
        ctx.save(); ctx.globalAlpha = b; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 230); ctx.stroke(); ctx.restore();
        flagAt(g, 'is', tx + 70, ty - 190, 90, b, 6);
        label(ctx, 'TÓRSHAVN', tx, ty + 50, { size: 40, a: b });
      }
    }
    if (T > L(5) - 0.1 && T < L(6) + 0.2) bigText(g, 'EMPIRE: 2 COUNTRIES', 330, env(T, L(5) - 0.1, L(6) + 0.2, 0.2, 0.3), { size: 100, color: ICE });
    // ---- Denmark responds
    if (T > L(6) + 0.3 && T < L(7) + 0.3) {
      const a = env(T, L(6) + 0.3, L(7) + 0.3, 0.3, 0.3);
      hl(g, cam, 'DNK', DK, a, { fillAlpha: 0.5 });
      const [dx, dy] = cam.toScreen(10, 56.5); flagAt(g, 'dk', dx, dy - 80, 70, a);
      for (let i = 0; i < 4; i++) {
        const q = ease.inOutQuad(clamp((T - g.wt(6, 'danish') + 0.3 - i * 0.2) / 4));
        const s = [8, 57.5 + i * 0.4], e = [-5.5, 61.6 + i * 0.25];
        const [x, y] = cam.toScreen(lerp(s[0], e[0], q), lerp(s[1], e[1], q));
        unitIcon(ctx, 'ship', x, y, 50, Math.PI + 0.3, DK, a * clamp(q * 8));
      }
      const o = clamp((T - g.wt(6, 'outgunned') + 0.2) / 0.3) * a;
      ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.05); tag(g, 'BADLY OUTGUNNED', 0, 0, { a: o, bg: '#c62828', size: 56 }); ctx.restore();
    }
    // ---- Keflavik
    if (T > L(7) + 0.5 && T < L(9)) {
      const a = env(T, L(7) + 0.5, L(9), 0.3, 0.3);
      const [kx, ky] = cam.toScreen(...KEF);
      pulseAt(g, cam, KEF[0], KEF[1], 120, '#7fb2ff', a);
      flagAt(g, 'us', kx, ky - 140, 80, a, 5);
      label(ctx, 'KEFLAVÍK AIR BASE', kx, ky + 80, { size: 40, a });
      tag(g, 'US DEFENSE AGREEMENT  1951', W / 2, 300, { a, bg: US, size: 40 });
      for (let i = 0; i < 3; i++) { const q = clamp((T - g.wt(7, 'jets') + 0.2 - i * 0.3) / 2); const x = kx - 120 + q * 700 + i * 60, y = ky - 30 - q * 400 - i * 40; unitIcon(ctx, 'jet', x, y, 50, -0.55, US, a * clamp(q * 5) * (1 - clamp((q - 0.8) * 5))); }
    }
    // ---- phone call
    if (T > L(8) - 0.1 && T < L(9)) {
      const a = env(T, L(8) - 0.1, L(9), 0.2, 0.3);
      ctx.save(); ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
      phone(ctx, W / 2, 700, 230, a, T);
      text(ctx, 'INCOMING: WASHINGTON', W / 2, 480, { font: 'MontBlack', size: 46, alpha: a, stroke: 8 });
      const o = clamp((T - g.wt(8, 'over') + 0.1) / 0.3) * a;
      bigText(g, 'WAR OVER IN 1 DAY', 1000, o, { size: 92, color: '#ffe14d' });
    }
    // ---- three times
    if (T > L(9) - 0.1 && T < L(10) - 0.2) {
      const a = env(T, L(9) - 0.1, L(10) - 0.2, 0.25, 0.3);
      flagAt(g, 'is', W / 2 - 180, 360, 110, a, 4); text(ctx, 'VS', W / 2, 360, { font: 'Anton', size: 80, color: '#ffe14d', alpha: a, stroke: 8 }); flagAt(g, 'gb', W / 2 + 180, 360, 110, a, 4);
      const n = clamp((T - g.wt(9, 'three') + 0.1) / 0.3);
      bigText(g, 'WON 3 TIMES', 560, a * n, { size: 120, color: ICE });
    }
    if (T > L(11) - 0.1) {
      const a = env(T, L(11) - 0.1, 99, 0.3, 0.3);
      flagAt(g, 'is', W / 2, 520, 160, a, 6);
      const u = clamp((T - g.wt(11, 'lose') + 0.1) / 0.25);
      ctx.save(); ctx.translate(W / 2, 760); ctx.rotate(-0.06); tag(g, 'UNDEFEATED', 0, 0, { a: a * u, bg: '#0e7a3c', size: 70 }); ctx.restore();
    }
  },
};
