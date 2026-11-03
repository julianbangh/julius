// Geo Studio globe: per-pixel textured orthographic Earth with lighting, ocean glint,
// atmosphere and d3-geo country overlays.
import { geoOrthographic, geoPath } from 'd3-geo';
import { createCanvas, rgba, clamp, rng, W, H, deg } from './core.mjs';
import { equirectTexture } from './tiles.mjs';

let TEX = null, TEXW = 0, TEXH = 0;
let TEX2 = null, TEX2W = 0, TEX2H = 0; // half-size mip
let NIGHT = null;

async function loadTex(layer, date, ext) {
  const img = await equirectTexture(layer, date, ext, 3);
  const cv = createCanvas(img.width, img.height);
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, img.width, img.height);
  const half = createCanvas(img.width >> 1, img.height >> 1);
  const hc = half.getContext('2d'); hc.imageSmoothingQuality = 'high';
  hc.drawImage(img, 0, 0, half.width, half.height);
  const hd = hc.getImageData(0, 0, half.width, half.height);
  return { full: new Uint32Array(d.data.buffer), w: img.width, h: img.height, half: new Uint32Array(hd.data.buffer), hw: half.width, hh: half.height };
}

export async function initGlobe({ night = false } = {}) {
  if (!TEX) {
    const t = await loadTex('BlueMarble_ShadedRelief_Bathymetry', '2004-08-01', 'jpeg');
    TEX = t.full; TEXW = t.w; TEXH = t.h; TEX2 = t.half; TEX2W = t.hw; TEX2H = t.hh;
  }
  if (night && !NIGHT) NIGHT = await loadTex('VIIRS_Black_Marble', '2016-01-01', 'png');
}

const starCache = new Map();
export function drawStars(ctx, seed = 7, a = 1) {
  let s = starCache.get(seed);
  if (!s) {
    s = createCanvas(W, H); const c = s.getContext('2d'); const r = rng(seed);
    const g = c.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, '#0a1430'); g.addColorStop(1, '#02040b');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const x = r() * W, y = r() * H, m = r() ** 3;
      c.fillStyle = `rgba(${200 + 55 * r()},${210 + 45 * r()},255,${0.25 + 0.75 * m})`;
      c.beginPath(); c.arc(x, y, 0.4 + m * 1.6, 0, Math.PI * 2); c.fill();
    }
    starCache.set(seed, s);
  }
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(s, 0, 0); ctx.restore();
}

const L = (() => { const v = [-0.55, 0.5, 0.67]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
const Hh = (() => { const v = [L[0], L[1], L[2] + 1]; const n = Math.hypot(...v); return v.map((x) => x / n); })();

/**
 * Render the globe. opts: {cx, cy, R, lon, lat, q (internal scale), light (0..1 strength),
 * night (0..1 blend of city lights on the dark side), tint}
 */
export function drawGlobe(ctx, { cx = W / 2, cy = H / 2, R = 420, lon = 0, lat = 20, q = null, light = 1, night = 0, grade = 1 } = {}) {
  q = q ?? (R > 700 ? 0.5 : R > 380 ? 0.75 : 1);
  const r = Math.max(2, Math.round(R * q));
  const size = r * 2 + 2;
  const cv = createCanvas(size, size);
  const c = cv.getContext('2d');
  const img = c.createImageData(size, size);
  const out = new Uint32Array(img.data.buffer);
  const useHalf = r < 900;
  const tex = useHalf ? TEX2 : TEX, tw = useHalf ? TEX2W : TEXW, th = useHalf ? TEX2H : TEXH;
  const sl = Math.sin(lat * deg), cl = Math.cos(lat * deg);
  const l0 = lon * deg;
  const nt = night > 0 && NIGHT ? NIGHT : null;
  for (let py = 0; py < size; py++) {
    const y = (r - py + 0.5) / r;
    if (Math.abs(y) > 1) continue;
    const span = Math.sqrt(1 - y * y);
    const xs = Math.max(0, Math.floor(r - span * r)), xe = Math.min(size - 1, Math.ceil(r + span * r));
    for (let px = xs; px <= xe; px++) {
      const x = (px - r + 0.5) / r;
      const d2 = x * x + y * y;
      if (d2 >= 1) continue;
      const z = Math.sqrt(1 - d2);
      // inverse orthographic
      const phi = Math.asin(clamp(z * sl + y * cl, -1, 1));
      const lam = l0 + Math.atan2(x, z * cl - y * sl);
      let u = (lam / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1;
      const v = 0.5 - phi / Math.PI;
      const ti = (Math.min(th - 1, (v * th) | 0) * tw + Math.min(tw - 1, (u * tw) | 0));
      const p = tex[ti];
      let R0 = p & 255, G0 = (p >> 8) & 255, B0 = (p >> 16) & 255;
      // lighting
      const ndl = x * L[0] + y * L[1] + z * L[2];
      const dif = 0.28 + 0.9 * Math.max(0, ndl) * light + (1 - light) * 0.7;
      let rr = R0 * dif, gg = G0 * dif, bb = B0 * dif;
      const ocean = B0 > R0 + 12 && B0 >= G0 ? 1 : 0;
      if (ocean) {
        const ndh = Math.max(0, x * Hh[0] + y * Hh[1] + z * Hh[2]);
        const sp = ndh ** 160 * 95 * light;
        rr += sp; gg += sp; bb += sp;
      }
      if (nt && ndl < 0.15) {
        const k = clamp((0.15 - ndl) * 3) * night;
        const p2 = nt.full[(Math.min(nt.h - 1, (v * nt.h) | 0) * nt.w + Math.min(nt.w - 1, (u * nt.w) | 0))];
        rr += (p2 & 255) * k * 1.2; gg += ((p2 >> 8) & 255) * k * 1.05; bb += ((p2 >> 16) & 255) * k * 0.7;
      }
      // atmosphere rim
      const rim = (1 - z) ** 2.6;
      rr = rr * (1 - rim * 0.55) + 110 * rim * 1.1; gg = gg * (1 - rim * 0.55) + 170 * rim * 1.1; bb = bb * (1 - rim * 0.55) + 255 * rim * 1.15;
      rr *= grade; gg *= grade; bb *= grade;
      out[py * size + px] = (255 << 24) | (Math.min(255, bb) << 16) | (Math.min(255, gg) << 8) | Math.min(255, rr);
    }
  }
  c.putImageData(img, 0, 0);
  // halo
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.13);
  halo.addColorStop(0, 'rgba(120,180,255,0.55)');
  halo.addColorStop(0.35, 'rgba(80,140,255,0.18)');
  halo.addColorStop(1, 'rgba(40,80,200,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.13, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(cv, cx - R - 1 / q, cy - R - 1 / q, (size / q), (size / q));
  ctx.restore();
}

export function globeProjection({ cx = W / 2, cy = H / 2, R = 420, lon = 0, lat = 20 }) {
  return geoOrthographic().rotate([-lon, -lat]).scale(R).translate([cx, cy]).clipAngle(90).precision(0.4);
}

/** Overlay countries on the globe. items: [{c, fill, alpha, stroke}] ; borders: alpha for all borders */
export function drawGlobeCountries(ctx, view, countries, { borders = 0.28, items = [] } = {}) {
  const proj = globeProjection(view);
  const gp = geoPath(proj, ctx);
  ctx.save();
  if (borders > 0) {
    ctx.beginPath();
    for (const c of countries.list) gp(c.geometry);
    ctx.strokeStyle = `rgba(255,255,255,${borders})`; ctx.lineWidth = Math.max(0.6, view.R / 600); ctx.stroke();
  }
  for (const it of items) {
    if (!it.c || (it.alpha ?? 1) <= 0) continue;
    ctx.beginPath(); gp(it.c.geometry || it.c);
    if (it.fill) { ctx.globalAlpha = (it.alpha ?? 1) * (it.fillAlpha ?? 0.6); ctx.shadowColor = it.fill; ctx.shadowBlur = it.glow ?? 20; ctx.fillStyle = it.fill; ctx.fill(); ctx.shadowBlur = 0; }
    ctx.globalAlpha = (it.alpha ?? 1) * 0.95; ctx.strokeStyle = it.stroke || '#fff'; ctx.lineWidth = it.width ?? 2.2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return proj;
}

/** Equivalent Web Mercator zoom for a globe of radius R viewed at latitude lat. */
export function globeToZoom(R, lat) { return Math.log2((2 * Math.PI * R * Math.cos(lat * deg)) / 256); }
export function zoomToGlobeR(z, lat) { return (256 * 2 ** z) / (2 * Math.PI * Math.cos(lat * deg)); }
