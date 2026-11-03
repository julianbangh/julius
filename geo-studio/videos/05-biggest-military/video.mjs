// 05 — Who has the biggest military? Smallest to biggest (active personnel, IISS Military Balance 2025, approx.)
import { W, H, clamp, ease, env, prog, lerp, baseMap, hl, loadFlags, flagAt, bigText, tag, headline, text, whiteFlash, label, pulseAt, globeShot, fitCam, Camera } from '../../engine/kit.mjs';
import { initGlobe } from '../../engine/globe.mjs';

const C = [
  { line: 1, id: 'CRI', code: 'cr', name: 'Costa Rica', n: 0, show: '0', note: 'NO ARMY SINCE 1948', at: [-84.1, 9.9], z: 6.4 },
  { line: 2, id: 'VAT', code: 'va', name: 'Vatican City', n: 135, show: '135', note: 'SMALLEST ARMY ON EARTH', at: [12.4534, 41.9029], z: 13.6 },
  { line: 3, id: 'LUX', code: 'lu', name: 'Luxembourg', n: 1000, show: '1,000', at: [6.1, 49.75], z: 7.6 },
  { line: 4, id: 'IRL', code: 'ie', name: 'Ireland', n: 7500, show: '7,500', at: [-8, 53.3], z: 6.0 },
  { line: 5, id: 'GBR', code: 'gb', name: 'United Kingdom', n: 140000, show: '140,000', at: [-2.8, 54.2], z: 5.3 },
  { line: 6, id: 'TUR', code: 'tr', name: 'Turkey', n: 355000, show: '355,000', note: '#2 IN NATO', at: [35, 39], z: 5.0 },
  { line: 7, id: 'PAK', code: 'pk', name: 'Pakistan', n: 660000, show: '660,000', at: [69.5, 30], z: 4.9 },
  { line: 8, id: 'RUS', code: 'ru', name: 'Russia', n: 1134000, show: '1.1 MILLION', at: [92, 61], z: 3.2 },
  { line: 9, id: 'PRK', code: 'kp', name: 'North Korea', n: 1280000, show: '1.28 MILLION', note: 'OUT OF 26 MILLION PEOPLE', at: [127.2, 40.2], z: 5.9 },
  { line: 10, id: 'USA', code: 'us', name: 'United States', n: 1316000, show: '1.3 MILLION', at: [-98, 39], z: 3.7 },
  { line: 11, id: 'IND', code: 'in', name: 'India', n: 1475000, show: '1.5 MILLION', at: [79, 22], z: 4.25 },
  { line: 12, id: 'CHN', code: 'cn', name: 'China', n: 2035000, show: '2 MILLION+', note: '#1 BY SOLDIERS', at: [104, 35], z: 3.8 },
];
const NEXT9 = [['CHINA', 314], ['RUSSIA', 149], ['GERMANY', 88.5], ['INDIA', 86.1], ['UK', 81.8], ['KSA', 80.3], ['UKRAINE', 64.7], ['FRANCE', 64.7], ['JAPAN', 55.3]];
const COLS = ['#ff6b6b', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#5f9dff', '#a29bfe', '#fd79a8', '#c8d6e5'];

function current(g, T) { let i = 0; while (i < C.length - 1 && T > g.L(C[i + 1].line) - 0.6) i++; return i; }

function flyCam(g, T) {
  const i = current(g, T);
  const cur = C[i];
  const prev = i > 0 ? C[i - 1] : { at: [-60, 25], z: 3.0 };
  const t0 = g.L(cur.line) - 0.6, t1 = g.L(cur.line) + 0.5;
  const e = ease.inOutCubic(clamp((T - t0) / (t1 - t0)));
  let dl = cur.at[0] - prev.at[0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
  const dist = Math.hypot(dl, cur.at[1] - prev.at[1]);
  const dip = Math.min(3, dist / 40) * Math.sin(Math.PI * e);
  return fitCam(new Camera({ lon: prev.at[0] + dl * e, lat: lerp(prev.at[1], cur.at[1], e), zoom: lerp(prev.z, cur.z, e) - dip + Math.max(0, T - g.L(cur.line)) * 0.04 }));
}

export default {
  music: { file: 'tense_doc.mp3', gain: 0.16, start: 8 },
  async setup(g) { await initGlobe(); await loadFlags(g, C.map((c) => c.code).concat(['us'])); },
  sfx(g) {
    const out = [{ t: 0.1, file: 'riser.wav', gain: 0.45 }, { t: 3.0, file: 'whoosh.wav', gain: 0.6 }];
    C.forEach((c) => {
      out.push({ t: g.L(c.line) - 0.6, file: 'whoosh_fast.wav', gain: 0.45 });
      out.push({ t: g.L(c.line) + 0.4, file: c.n > 1e6 ? 'impact.wav' : 'pop.wav', gain: 0.7 });
      if (c.n > 1000) out.push({ t: g.L(c.line) + 0.5, file: 'ticker.wav', gain: 0.35, dur: 0.9 });
    });
    out.push({ t: g.L(13) + 0.2, file: 'whoosh.wav', gain: 0.6 }, { t: g.wt(13, 'trillion') - 0.1, file: 'cash.wav', gain: 0.7 }, { t: g.wt(13, 'next') - 0.1, file: 'impact.wav', gain: 0.9 });
    return out;
  },
  async frame(g, T) {
    const ctx = g.ctx, L = g.L;
    if (T < L(1) - 0.6) {
      globeShot(g, { cx: W / 2, cy: 1050, R: 460, lon: lerp(-30, 40, T / 5), lat: 25 }, C.map((c, i) => ({ id: c.id, color: '#ffb020', a: clamp((T - 0.5 - i * 0.2) / 0.3) })));
      headline(ctx, 'Who has the\nbiggest military?', { y: 230, a: env(T, 0.05, L(1) - 0.6, 0.2, 0.3) });
      return;
    }
    if (T < L(13) - 0.1) {
      const cam = flyCam(g, T);
      const sat = cam.zoom > 9;
      await baseMap(g, cam, { layers: sat ? ['bluemarble', 's2'] : ['bluemarble'], dim: sat ? 0.1 : 0.3, borders: sat ? 0 : 0.3 });
      const i = current(g, T);
      const c = C[i];
      const a = clamp((T - L(c.line) + 0.2) / 0.4);
      if (c.id === 'VAT') {
        pulseAt(g, cam, c.at[0], c.at[1], 110, '#ffe14d', a);
        const [x, y] = cam.toScreen(...c.at);
        label(ctx, 'VATICAN CITY', x, y - 150, { size: 46, a });
      } else hl(g, cam, c.id, '#ffb020', a, { fillAlpha: 0.45 });
      const k = c.n === 0 ? 0 : prog(T, L(c.line) + 0.3, L(c.line) + 1.4, ease.outCubic);
      const shown = c.n >= 1e6 ? (k < 1 ? `${((c.n * k) / 1e6).toFixed(2)} MILLION` : c.show) : c.n === 0 ? '0' : Math.round(c.n * k).toLocaleString('en-US');
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,24,0.86)'; ctx.beginPath(); ctx.roundRect(50, 150, W - 100, 330, 32); ctx.fill(); ctx.restore();
      flagAt(g, c.code, 190, 245, 100, a);
      text(ctx, c.name.toUpperCase(), 320, 220, { font: 'MontBlack', size: 50, align: 'left', alpha: a, maxW: 640 });
      text(ctx, shown, 320, 305, { font: 'Anton', size: 92, align: 'left', color: '#ffb020', alpha: a, maxW: 640 });
      text(ctx, 'ACTIVE TROOPS', 320, 370, { font: 'MontBold', size: 28, align: 'left', color: '#cfd8ea', alpha: a });
      const frac = (c.n * k) / 2035000;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(90, 410, W - 180, 34, 17); ctx.fill();
      ctx.fillStyle = '#ffb020'; ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.roundRect(90, 410, Math.max(6, (W - 180) * frac), 34, 17); ctx.fill(); ctx.restore();
      text(ctx, 'BAR = SHARE OF CHINA’S ARMY', W / 2, 470, { font: 'MontBold', size: 22, color: '#9aa6bd', alpha: a });
      if (c.note) tag(g, c.note, W / 2, 570, { a: a * clamp((T - L(c.line) - 1.0) / 0.3), bg: c.id === 'CHN' ? '#c62828' : '#1b2a44', size: 36 });
      text(ctx, `#${C.length - i}`, W - 110, 200, { font: 'Anton', size: 60, color: 'rgba(255,255,255,0.35)', alpha: a });
      g.creditText += ' · Troops: IISS Military Balance 2025 (approx.)';
      return;
    }
    const a = env(T, L(13) - 0.1, 99, 0.3, 0.3);
    globeShot(g, { cx: W / 2, cy: 1350, R: 520, lon: lerp(-90, -60, prog(T, L(13), L(13) + 9)), lat: 30 }, [{ id: 'USA', color: '#2f7bff', a: 1 }]);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,10,20,0.86)'; ctx.beginPath(); ctx.roundRect(60, 160, W - 120, 760, 34); ctx.fill(); ctx.restore();
    text(ctx, 'MILITARY SPENDING (2024)', W / 2, 220, { font: 'MontBlack', size: 38, alpha: a });
    const full = W - 260, sc = full / 997;
    const p1 = prog(T, L(13) + 0.6, g.wt(13, 'trillion') + 0.2, ease.outCubic);
    flagAt(g, 'us', 160, 320, 56, a);
    text(ctx, 'UNITED STATES', 220, 320, { font: 'MontBlack', size: 34, align: 'left', alpha: a });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#2f7bff'; ctx.shadowColor = '#2f7bff'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.roundRect(130, 380, Math.max(10, 997 * sc * p1), 110, 16); ctx.fill(); ctx.restore();
    text(ctx, `$${Math.round(997 * p1)}B`, 150, 438, { font: 'Anton', size: 70, align: 'left', alpha: a, stroke: 8 });
    const p2 = prog(T, g.wt(13, 'next') - 0.2, g.wt(13, 'next') + 1.6, ease.outCubic);
    text(ctx, 'NEXT 9 COUNTRIES COMBINED', 130, 560, { font: 'MontBlack', size: 34, align: 'left', alpha: a * clamp(p2 * 3) });
    let x = 130;
    NEXT9.forEach(([n, v], i) => {
      const q = clamp(p2 * 9 - i);
      const w = v * sc * q;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COLS[i]; ctx.beginPath(); ctx.roundRect(x, 610, Math.max(0, w - 3), 110, 10); ctx.fill(); ctx.restore();
      if (q > 0.9 && v > 80) text(ctx, n, x + w / 2, 665, { font: 'MontBlack', size: 20, color: '#0b1020', alpha: a });
      x += w;
    });
    text(ctx, `$${Math.round(984 * p2)}B`, 130, 790, { font: 'Anton', size: 70, align: 'left', color: '#ff9f43', alpha: a * clamp(p2 * 3), stroke: 8 });
    text(ctx, 'Source: SIPRI, 2024 spending', W / 2, 880, { font: 'MontSemi', size: 24, color: '#9aa6bd', alpha: a });
  },
};
