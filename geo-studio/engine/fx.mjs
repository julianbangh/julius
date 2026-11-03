// Geo Studio FX: volumetric-looking explosions (3D particle mushroom clouds), a perspective
// satellite "ground" camera, shockwaves, flashes, missiles, arrows and map pulses.
import { createCanvas, W, H, clamp, lerp, rng, ease, smooth, rgba, deg, scratch } from './core.mjs';
import { lonLatToWorld, mpp } from './geo.mjs';
import { drawLayer } from './tiles.mjs';

// ---------------------------------------------------------------- sprites
const SPR = 192;
function makePuff(kind, seed) {
  const c = createCanvas(SPR, SPR), x = c.getContext('2d'), r = rng(seed), m = SPR / 2;
  const pal = {
    smoke: ['#fffaf3', '#c4b6a6', '#5a4d43'],
    dark: ['#7d7068', '#3f3631', '#1a1512'],
    dust: ['#e0cfb4', '#a8916f', '#5e4c38'],
    hot: ['#fffbe8', '#ffd060', '#ff6a10'],
    warm: ['#ffb066', '#e0561c', '#7a1c06'],
    white: ['#ffffff', '#eef4ff', '#b8c8e0'],
  }[kind];
  const blob = (cx, cy, rr, a) => {
    const g = x.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
    g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, rgba(pal[2], 0));
    x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill();
  };
  blob(m, m, m * 0.78, 1);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = m * (0.18 + 0.42 * Math.sqrt(r()));
    blob(m + Math.cos(a) * d, m + Math.sin(a) * d * 0.9 - m * 0.05, m * (0.16 + 0.22 * r()), 0.55 + 0.45 * r());
  }
  if (kind !== 'hot' && kind !== 'warm' && kind !== 'white') {
    x.globalCompositeOperation = 'source-atop';
    const L = x.createLinearGradient(m * 0.3, m * 0.2, m * 1.6, m * 1.8);
    L.addColorStop(0, 'rgba(255,252,245,0.5)'); L.addColorStop(0.45, 'rgba(0,0,0,0)'); L.addColorStop(1, 'rgba(14,8,4,0.75)');
    x.fillStyle = L; x.fillRect(0, 0, SPR, SPR);
  }
  x.globalCompositeOperation = 'destination-in';
  const e = x.createRadialGradient(m, m, m * 0.45, m, m, m * 0.98);
  e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = e; x.fillRect(0, 0, SPR, SPR);
  return c;
}
let SPRITES = null;
export function sprites() {
  if (SPRITES) return SPRITES;
  SPRITES = {};
  for (const k of ['smoke', 'dark', 'dust', 'hot', 'warm', 'white']) SPRITES[k] = Array.from({ length: 6 }, (_, i) => makePuff(k, 1000 + i * 17 + k.length * 101));
  const glow = createCanvas(256, 256), g = glow.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.18, 'rgba(255,240,190,0.9)'); gr.addColorStop(0.45, 'rgba(255,150,50,0.35)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  SPRITES.glow = glow;
  return SPRITES;
}
function puff(ctx, kind, i, x, y, r, a, comp) {
  if (a <= 0.003 || r < 0.6 || x < -r || y < -r || x > W + r || y > H + r) return;
  const s = SPRITES[kind][i % 6];
  ctx.globalAlpha = Math.min(1, a);
  if (comp) ctx.globalCompositeOperation = comp;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  if (comp) ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- perspective ground camera
/**
 * Ground3D renders satellite imagery onto a tilted ground plane ("Mode 7"), with
 * ground-space decals and a projector for 3D particles.
 * view: { lon, lat, zoom, pitch (deg, 90 = straight down), yaw (deg), layers, cy (principal point) }
 */
export class Ground3D {
  constructor() {
    this.f = 1500;
    this.near = createCanvas(2400, 3000);
    this.far = createCanvas(1700, 1700);
    this.out = null;
  }
  setup(view) {
    const v = this.v = { pitch: 90, yaw: 0, cy: H / 2, cx: W / 2, horizonHaze: '#cfd9e6', skyTop: '#2c5a8f', skyMid: '#8fb3d6', ...view };
    v.cx += v.shakeX || 0; v.cy += v.shakeY || 0;
    const a = clamp(v.pitch, 8, 90) * deg;
    this.sa = Math.sin(a); this.ca = Math.cos(a);
    this.D = this.f;
    this.ps = Math.sin(v.yaw * deg); this.pc = Math.cos(v.yaw * deg);
    [this.wx, this.wy] = lonLatToWorld(v.lon, v.lat, v.zoom);
    this.pxPerKm = 1000 / mpp(v.lat, v.zoom);
    const rows = [];
    let fMin = Infinity, fMax = -Infinity, hw = 0;
    for (let y = 0; y < H; y++) {
      const vv = y - v.cy + 0.5;
      const rz = this.f * this.sa + vv * this.ca;
      if (rz <= this.f * 0.004) { rows.push(null); continue; }
      const t = (this.D * this.sa) / rz;
      const F = t * (this.f * this.ca - vv * this.sa) - this.D * this.ca;
      const dist = Math.hypot(F + this.D * this.ca, this.D * this.sa);
      if (dist > (v.maxDist || 30000)) { rows.push(null); continue; }
      rows.push({ t, F, dist, x0: -t * v.cx });
      fMin = Math.min(fMin, F); fMax = Math.max(fMax, F); hw = Math.max(hw, t * Math.max(v.cx, W - v.cx));
    }
    this.rows = rows;
    let hy = 0; while (hy < H && !rows[hy]) hy++;
    this.horizonY = hy;
    const N = this.near;
    this.nearHW = N.width / 2 - 3;
    this.nearGX = N.width / 2;
    this.nearGY = Math.min(N.height - 4, fMax + 4) ;
    if (N.height - 4 + fMin < 0) this.nearGY = N.height - 4 + Math.max(fMin, -N.height) ;
    this.nearGY = Math.max(-fMin + 4, Math.min(this.nearGY, N.height - 4));
    this.nearMinF = this.nearGY - (N.height - 3); this.nearMaxF = this.nearGY - 3;
    const ext = Math.max(2 * hw, fMax - fMin) + 24;
    this.farK = Math.min(1, (this.far.width - 8) / ext);
    this.farGX = this.far.width / 2; this.farGY = 6 + fMax * this.farK;
    for (const r of rows) if (r) r.near = r.F <= this.nearMaxF && r.F >= this.nearMinF && -r.x0 <= this.nearHW && r.t * (W - v.cx) <= this.nearHW;
    this.needFar = rows.some((r) => r && !r.near);
  }
  toLocal(lon, lat) { const [x, y] = lonLatToWorld(lon, lat, this.v.zoom); return [x - this.wx, -(y - this.wy)]; }
  _view(e, n) { return [e * this.pc + n * this.ps, n * this.pc - e * this.ps]; }
  /** project a 3D point in km (east, north, up) relative to target -> screen {x, y, s (px per km), depth} */
  project(e, n, u) {
    const k = this.pxPerKm;
    const [X, Yf] = this._view(e * k, n * k);
    const Z = u * k;
    const py = Yf + this.D * this.ca, pz = Z - this.D * this.sa;
    const depth = py * this.ca - pz * this.sa;
    if (depth <= 1) return null;
    return { x: this.v.cx + (this.f * X) / depth, y: this.v.cy - (this.f * (py * this.sa + pz * this.ca)) / depth, s: (this.f / depth) * k, depth };
  }
  projectLonLat(lon, lat, u = 0) { const [e, n] = this.toLocal(lon, lat); return this.project(e / this.pxPerKm, n / this.pxPerKm, u); }
  async _paint(cv, k, gx, gy, decals) {
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = this.v.groundFill || '#2a3238'; c.fillRect(0, 0, cv.width, cv.height);
    const cs = this.pc, sn = this.ps;
    c.setTransform(k * cs, -k * sn, k * sn, k * cs, gx, gy);
    const inv = (px, py) => { const x = (px - gx) / k, y = (py - gy) / k; return [x * cs - y * sn, x * sn + y * cs]; };
    const pts = [inv(0, 0), inv(cv.width, 0), inv(0, cv.height), inv(cv.width, cv.height)];
    const view = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    for (const L of this.v.layers || ['bluemarble']) {
      const name = typeof L === 'string' ? L : L.src;
      await drawLayer(c, name, this.v.zoom, this.wx, this.wy, view, { detail: 0.15, maxTiles: 420, lod: Math.log2(k), ...(typeof L === 'string' ? {} : L) });
    }
    if (decals) decals(c, { toLocal: (lon, lat) => { const [e, n] = this.toLocal(lon, lat); return [e, -n]; }, km: this.pxPerKm, scale: k });
    c.setTransform(1, 0, 0, 1, 0, 0);
    const id = c.getImageData(0, 0, cv.width, cv.height);
    return { d: new Uint32Array(id.data.buffer), w: cv.width, h: cv.height };
  }
  static _lut(c, b, sat) { const L = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) L[i] = (i - 128) * c + 128 + b; return { L, sat }; }
  _grade(img) {
    const v = this.v, c = v.contrast ?? 1.14, sat = v.sat ?? 1.12, b = v.bright ?? 0;
    if (c === 1 && sat === 1 && b === 0) return;
    const L = Ground3D._lut(c, b, sat).L, d = img.d;
    for (let i = 0; i < d.length; i++) {
      const p = d[i]; let r = p & 255, g = (p >> 8) & 255, bl = (p >> 16) & 255;
      const y = (r * 77 + g * 150 + bl * 29) >> 8;
      r = L[Math.max(0, Math.min(255, y + (r - y) * sat)) | 0]; g = L[Math.max(0, Math.min(255, y + (g - y) * sat)) | 0]; bl = L[Math.max(0, Math.min(255, y + (bl - y) * sat)) | 0];
      d[i] = 0xff000000 | (bl << 16) | (g << 8) | r;
    }
  }
  static _half(src) {
    const w = src.w >> 1, h = src.h >> 1, d = new Uint32Array(w * h), s = src.d, sw = src.w;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * 2) * sw + x * 2, a = s[i], b = s[i + 1], c = s[i + sw], e = s[i + sw + 1];
      const r = ((a & 255) + (b & 255) + (c & 255) + (e & 255)) >> 2;
      const g = (((a >> 8) & 255) + ((b >> 8) & 255) + ((c >> 8) & 255) + ((e >> 8) & 255)) >> 2;
      const bl = (((a >> 16) & 255) + ((b >> 16) & 255) + ((c >> 16) & 255) + ((e >> 16) & 255)) >> 2;
      d[y * w + x] = 0xff000000 | (bl << 16) | (g << 8) | r;
    }
    return { d, w, h };
  }
  /** Render the ground into ctx (replaces the frame). decals(c, {toLocal, km}) draws in local px (x east, y south). */
  async draw(ctx, decals) {
    const v = this.v;
    const near = await this._paint(this.near, 1, this.nearGX, this.nearGY, decals);
    const nearH = Ground3D._half(near);
    this._grade(near); this._grade(nearH);
    const far = this.needFar ? await this._paint(this.far, this.farK, this.farGX, this.farGY, decals) : null;
    if (far) this._grade(far);
    if (!this.out) this.out = ctx.createImageData(W, H);
    const o = new Uint32Array(this.out.data.buffer);
    const [tr, tg, tb] = hexRGB(v.skyTop), [mr, mg, mb] = hexRGB(v.skyMid), [hr, hg, hb] = hexRGB(v.horizonHaze);
    const hz = v.hazeDist || 3200, hazeMax = v.hazeMax ?? 0.6;
    const lut = Ground3D._lut(v.contrast ?? 1.14, v.bright ?? 0, v.sat ?? 1.12);
    for (let y = 0; y < H; y++) {
      const r = this.rows[y];
      const row = y * W;
      if (!r) {
        const k = this.horizonY > 0 ? y / this.horizonY : 1;
        let cr, cg, cb;
        if (k < 0.75) { const q = k / 0.75; cr = tr + (mr - tr) * q; cg = tg + (mg - tg) * q; cb = tb + (mb - tb) * q; }
        else { const q = (k - 0.75) / 0.25; cr = mr + (hr - mr) * q; cg = mg + (hg - mg) * q; cb = mb + (hb - mb) * q; }
        o.fill(0xff000000 | (cb << 16) | (cg << 8) | cr, row, row + W);
        continue;
      }
      const ha = v.pitch < 85 ? Math.min(1, Math.max(0, 1 - Math.exp(-(r.dist - this.D) / hz))) * hazeMax : 0;
      const ia = 1 - ha, har = hr * ha, hag = hg * ha, hab = hb * ha;
      let src, gx, gy, t;
      if (r.near) {
        if (r.t >= 1.9) { src = nearH; gx = this.nearGX / 2; gy = (this.nearGY - r.F) / 2; t = r.t / 2; }
        else { src = near; gx = this.nearGX; gy = this.nearGY - r.F; t = r.t; }
      } else { src = far; gx = this.farGX; gy = this.farGY - r.F * this.farK; t = r.t * this.farK; }
      const d = src.d, sw = src.w, sh = src.h;
      const x0 = gx + r.x0 * (src === nearH ? 0.5 : r.near ? 1 : this.farK);
      if (t < 1) {
        // bilinear (magnified rows)
        const fy = gy - 0.5; let iy = Math.floor(fy); const ay = fy - iy; if (iy < 0) iy = 0; if (iy > sh - 2) iy = sh - 2;
        const r0 = iy * sw, r1 = r0 + sw;
        for (let x = 0; x < W; x++) {
          const fx = x0 + t * (x + 0.5) - 0.5; let ix = fx | 0; const ax = fx - ix;
          if (ix < 0) ix = 0; else if (ix > sw - 2) ix = sw - 2;
          const p00 = d[r0 + ix], p10 = d[r0 + ix + 1], p01 = d[r1 + ix], p11 = d[r1 + ix + 1];
          const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
          const cr = (p00 & 255) * w00 + (p10 & 255) * w10 + (p01 & 255) * w01 + (p11 & 255) * w11;
          const cg = ((p00 >> 8) & 255) * w00 + ((p10 >> 8) & 255) * w10 + ((p01 >> 8) & 255) * w01 + ((p11 >> 8) & 255) * w11;
          const cb = ((p00 >> 16) & 255) * w00 + ((p10 >> 16) & 255) * w10 + ((p01 >> 16) & 255) * w01 + ((p11 >> 16) & 255) * w11;
          o[row + x] = 0xff000000 | ((cb * ia + hab) << 16) | ((cg * ia + hag) << 8) | (cr * ia + har);
        }
      } else {
        let iy = gy | 0; if (iy < 0) iy = 0; if (iy > sh - 1) iy = sh - 1;
        const r0 = iy * sw;
        for (let x = 0; x < W; x++) {
          let ix = (x0 + t * (x + 0.5)) | 0; if (ix < 0) ix = 0; else if (ix > sw - 1) ix = sw - 1;
          const p = d[r0 + ix];
          o[row + x] = 0xff000000 | ((((p >> 16) & 255) * ia + hab) << 16) | ((((p >> 8) & 255) * ia + hag) << 8) | ((p & 255) * ia + har);
        }
      }
    }
    ctx.putImageData(this.out, 0, 0);
  }
}
function hexRGB(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

// ---------------------------------------------------------------- explosions
/**
 * Build a deterministic explosion. spec: { r5 (km, destruction radius), fire (km), kind:'nuke'|'conv',
 *  height (km visual cloud height), seed, t0 (detonation time) }
 */
export function makeBlast(spec) {
  const s = { kind: 'nuke', seed: 1, ...spec };
  const R5 = s.r5;
  const nuke = s.kind === 'nuke';
  s.fire = s.fire ?? R5 * 0.28;
  s.capH = s.height ?? (nuke ? R5 * 2.6 : R5 * 0.9);
  s.capR = s.capR ?? (nuke ? R5 * 0.6 : R5 * 0.45);
  const r = rng(s.seed);
  s.cap = Array.from({ length: nuke ? 190 : 0 }, (_, i) => ({ th: r() * Math.PI * 2, ph: r() * Math.PI * 2, rr: 0.6 + 0.4 * r(), sz: 0.55 + 0.5 * r(), sp: 0.7 + 0.6 * r(), v: i }));
  s.dome = Array.from({ length: nuke ? 46 : 0 }, (_, i) => ({ a: r() * Math.PI * 2, d: Math.sqrt(r()), sz: 0.6 + 0.5 * r(), v: i + 3 }));
  s.stem = Array.from({ length: nuke ? 90 : 0 }, (_, i) => ({ u: r(), a: r() * Math.PI * 2, d: r(), sz: 0.7 + 0.6 * r(), v: i }));
  s.collar = Array.from({ length: nuke ? 34 : 0 }, (_, i) => ({ a: (i / 34) * Math.PI * 2 + r() * 0.2, sz: 0.7 + 0.5 * r(), v: i }));
  s.base = Array.from({ length: nuke ? 130 : 46 }, (_, i) => ({ a: (i / (nuke ? 130 : 46)) * Math.PI * 2 + r() * 0.3, d: 0.75 + 0.35 * r(), sz: 0.8 + 0.6 * r(), h: r(), v: i }));
  s.fb = Array.from({ length: 26 }, (_, i) => ({ a: r() * Math.PI * 2, b: (r() - 0.5) * Math.PI, d: r() ** 0.6, sz: 0.4 + 0.5 * r(), v: i }));
  s.sparks = Array.from({ length: nuke ? 70 : 60 }, () => ({ a: r() * Math.PI * 2, el: 0.2 + 1.1 * r(), v: 0.6 + 0.9 * r(), life: 0.6 + 0.9 * r() }));
  s.smoke = Array.from({ length: nuke ? 0 : 34 }, (_, i) => ({ a: r() * Math.PI * 2, d: r() ** 0.7, sz: 0.6 + 0.7 * r(), rise: 0.5 + r(), v: i }));
  return s;
}

/** visual timeline helpers (τ = seconds since detonation) */
export function blastFlash(s, τ) { return τ < 0 ? 0 : Math.exp(-τ * (s.kind === 'nuke' ? 3.2 : 9)) * (τ < 0.04 ? τ / 0.04 : 1); }
export function blastShock(s, τ) { const k = s.kind === 'nuke' ? 1.05 : 0.45; return s.r5 * 1.25 * ease.outCubic(τ / k) ; }

/** ground decals for a blast (draw in ground canvas; units px via km) */
export function blastDecals(c, s, τ, km) {
  if (τ < 0) return;
  const R5 = s.r5 * km;
  // glowing ground under fireball
  const glow = Math.exp(-τ * 1.1) * clamp(τ / 0.05);
  if (glow > 0.01) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R5 * 1.4);
    g.addColorStop(0, `rgba(255,230,170,${0.95 * glow})`); g.addColorStop(0.25, `rgba(255,140,40,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R5 * 1.4, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // cloud shadow cast on the ground (sun from the north-west)
  if (s.kind === 'nuke' && τ > 0.3) {
    const fade = clamp((s.life ?? 99) - τ);
    const rise = 1 - Math.exp(-Math.max(0, τ - 0.25) / 1.45);
    const h = (s.fire * 0.95 + (s.capH - s.fire) * rise) * km;
    const capR = lerp(s.fire * 0.8, s.capR, ease.outCubic((τ - 0.2) / 3.0)) * km * 1.25;
    const off = h * 0.85, ang = (s.sunAz ?? 135) * deg; // shadow direction (deg from north, clockwise)
    const sx = Math.sin(ang) * off, sy = -Math.cos(ang) * off * -1;
    const a = clamp((τ - 0.3) / 1.2) * 0.55 * fade;
    c.save();
    c.strokeStyle = `rgba(0,0,0,${a * 0.6})`; c.lineWidth = s.r5 * km * 0.16; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(sx * 0.92, sy * 0.92); c.stroke();
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, capR);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.7, `rgba(0,0,0,${a * 0.8})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, capR * 1.15, capR, ang, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // scorch
  const sc = clamp(τ / 0.6);
  if (sc > 0) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R5);
    g.addColorStop(0, `rgba(20,14,10,${0.78 * sc})`); g.addColorStop(0.55, `rgba(40,30,24,${0.55 * sc})`); g.addColorStop(1, 'rgba(60,50,40,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R5, 0, Math.PI * 2); c.fill();
  }
  // shock ring + dust band
  const sr = blastShock(s, τ) * km;
  const sa = clamp(1 - τ / (s.kind === 'nuke' ? 2.4 : 1.1));
  if (sa > 0 && sr > 1) {
    c.save();
    c.strokeStyle = `rgba(255,255,255,${0.9 * sa})`; c.lineWidth = Math.max(2, R5 * 0.035);
    c.shadowColor = 'rgba(255,255,255,0.8)'; c.shadowBlur = 20;
    c.beginPath(); c.arc(0, 0, sr, 0, Math.PI * 2); c.stroke();
    c.shadowBlur = 0;
    const g = c.createRadialGradient(0, 0, sr * 0.6, 0, 0, sr);
    g.addColorStop(0, 'rgba(200,180,150,0)'); g.addColorStop(0.85, `rgba(215,195,165,${0.45 * sa})`); g.addColorStop(1, 'rgba(230,215,190,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, sr, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

/** Faint striped circle left behind after a blast. */
export function stripedCircle(c, r, { color = '#ffffff', a = 1, stripe = 0, width = 3 } = {}) {
  if (a <= 0 || r <= 0) return;
  c.save();
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  c.save(); c.clip();
  c.strokeStyle = rgba(color, 0.22 * a); c.lineWidth = Math.max(1.2, stripe ? stripe / 3 : r / 40);
  const step = stripe || Math.max(7, r / 9);
  c.beginPath();
  for (let x = -r * 2; x < r * 2; x += step) { c.moveTo(x - r, -r); c.lineTo(x + r, r); }
  c.stroke();
  c.fillStyle = rgba(color, 0.06 * a); c.fillRect(-r, -r, 2 * r, 2 * r);
  c.restore();
  c.strokeStyle = rgba(color, 0.85 * a); c.lineWidth = width; c.setLineDash([Math.max(6, width * 4), Math.max(4, width * 2.5)]);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/**
 * Draw the 3D part of a blast through a projector P(e,n,u)->{x,y,s}. Optionally also into a
 * low-res bloom context. Returns flash intensity.
 */
export function drawBlast3D(ctx, P, s, τ, { bloom = null, sun = 1 } = {}) {
  if (τ < 0) return 0;
  sprites();
  const nuke = s.kind === 'nuke';
  const R5 = s.r5, F = s.fire;
  const items = [];
  const add = (e, n, u, rKm, kind, a, v, hot = 0) => { const p = P(e, n, u); if (p) items.push({ p, r: rKm * p.s, kind, a, v, hot }); };
  // timings
  const tGrow = nuke ? 0.32 : 0.12;
  const fbR = F * ease.outExpo(τ / tGrow) * (nuke ? 1 : 1.0);
  const heat = nuke ? Math.exp(-Math.max(0, τ - 0.25) / 1.6) : Math.exp(-τ / 0.28);
  const rise = nuke ? 1 - Math.exp(-Math.max(0, τ - 0.25) / 1.45) : 0;
  const fbH = (nuke ? F * 0.95 : F * 0.6) + (s.capH - F) * rise;
  const fade = clamp((s.life ?? 99) - τ); // optional dissipation (s.life = seconds)
  // ---- base surge / dust
  const bR = R5 * (nuke ? 0.25 + 0.75 * ease.outCubic(τ / 2.6) : 0.3 + 0.9 * ease.outCubic(τ / 1.2));
  for (const b of s.base) {
    const d = bR * b.d, a = clamp(τ / (nuke ? 0.5 : 0.15)) * (nuke ? 0.6 * clamp(2.2 - τ / 3) : clamp(1.6 - τ / 1.6)) * clamp(1.25 - b.d * 0.4) * fade;
    add(Math.cos(b.a) * d, Math.sin(b.a) * d, R5 * 0.04 * b.h, R5 * (nuke ? 0.12 : 0.22) * b.sz * (0.6 + 0.6 * clamp(τ)), 'dust', a, b.v);
  }
  // ---- stem
  if (nuke) {
    const capRnow = lerp(F * 0.8, s.capR, ease.outCubic((τ - 0.2) / 3.0));
    const minor = capRnow * 0.34;
    const top = Math.max(0, fbH - minor * 0.4);
    const sr = R5 * 0.085 * (0.55 + 0.6 * clamp(τ / 2.2));
    const coolS = Math.exp(-Math.max(0, τ - 0.5) / 0.8);
    for (const st of s.stem) {
      const u = (st.u + τ * 0.16) % 1;
      const h = u * top;
      const w = sr * (1 + 2.6 * (1 - u) ** 4);
      const d = w * st.d * 0.75;
      const a = clamp((τ - 0.3) / 0.7) * 0.95 * clamp(u * 6) * fade;
      add(Math.cos(st.a) * d, Math.sin(st.a) * d, h, w * st.sz, u < 0.25 ? 'dust' : 'smoke', a, st.v, coolS * clamp(u * 1.5 - 0.3) * 0.9);
    }
    // condensation collar on the stem
    const ca = clamp((τ - 0.9) / 0.5) * clamp((3.4 - τ) / 1.2) * fade;
    if (ca > 0) {
      const cr = sr * 3.2 * (0.8 + 0.4 * clamp((τ - 0.9) / 2));
      for (const c of s.collar) add(Math.cos(c.a) * cr, Math.sin(c.a) * cr, top * 0.62, sr * 1.2 * c.sz, 'white', ca * 0.35, c.v);
    }
    // ---- cap: flattened rolling torus + dome
    const coolC = Math.exp(-Math.max(0, τ - 0.35) / 0.75);
    for (const c of s.cap) {
      const th = c.th + τ * 1.1 * c.sp;
      const rad = capRnow + minor * Math.cos(th) * c.rr;
      const e = Math.cos(c.ph) * rad, n = Math.sin(c.ph) * rad;
      const sn = Math.sin(th);
      const u = fbH + minor * sn * c.rr * 0.62;
      const a = clamp((τ - 0.16) / 0.4) * fade;
      const under = sn < -0.15;
      const hot = coolC * (0.45 + 0.55 * Math.cos(th)) * 1.2 + (under ? Math.exp(-Math.max(0, τ - 0.4) / 2.4) * 0.35 : 0);
      add(e, n, u, minor * (0.7 + 0.42 * c.sz), under ? 'dark' : 'smoke', a, c.v, hot);
    }
    for (const d of s.dome) {
      const rr = capRnow * 0.95 * d.d;
      add(Math.cos(d.a) * rr, Math.sin(d.a) * rr, fbH + minor * (0.35 + 0.45 * (1 - d.d * d.d)), minor * (0.75 + 0.4 * d.sz), 'smoke', clamp((τ - 0.25) / 0.5) * fade, d.v, coolC * 0.7 * (1 - d.d));
    }
  } else {
    for (const m of s.smoke) {
      const d = R5 * 0.35 * m.d * (0.5 + clamp(τ / 1.5));
      add(Math.cos(m.a) * d, Math.sin(m.a) * d, R5 * (0.1 + 0.5 * m.rise * clamp(τ / 2.5)), R5 * 0.22 * m.sz * (0.5 + clamp(τ / 1.2)), 'dark', clamp(τ / 0.12) * clamp(2.6 - τ / 1.4) * 0.85 * fade, m.v, heat * 0.8);
    }
  }
  // ---- fireball
  if (fbR > 0) {
    const fa = (nuke ? clamp(1.2 - τ / 1.6) : clamp(1 - τ / 0.6)) * fade;
    for (const f of s.fb) {
      const d = fbR * f.d * 0.55;
      add(Math.cos(f.a) * Math.cos(f.b) * d, Math.sin(f.a) * Math.cos(f.b) * d, fbH * (nuke ? 1 : 0.6) + Math.sin(f.b) * d, fbR * (0.45 + 0.45 * f.sz), heat > 0.35 ? 'hot' : 'warm', fa, f.v, 0);
    }
  }
  // depth sort (far first)
  items.sort((a, b) => b.p.depth - a.p.depth);
  ctx.save();
  for (const it of items) {
    if (it.kind === 'hot' || it.kind === 'warm') { puff(ctx, it.kind, it.v, it.p.x, it.p.y, it.r, it.a, 'lighter'); continue; }
    puff(ctx, it.kind, it.v, it.p.x, it.p.y, it.r, it.a * sun);
    if (it.hot > 0.02) puff(ctx, it.hot > 0.5 ? 'hot' : 'warm', it.v, it.p.x, it.p.y, it.r * 0.92, it.a * it.hot, 'lighter');
  }
  ctx.restore();
  // sparks / debris
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const sp of s.sparks) {
    const tt = τ / sp.life; if (tt <= 0 || tt >= 1) continue;
    const reach = (nuke ? R5 * 0.7 : R5 * 1.1) * sp.v;
    const h = reach * 0.45 * Math.sin(sp.el) * (tt * 2 - tt * tt * 1.4);
    const d = reach * ease.outCubic(tt);
    const p1 = P(Math.cos(sp.a) * d, Math.sin(sp.a) * d, Math.max(0, h + F * 0.3));
    const d0 = reach * ease.outCubic(Math.max(0, tt - 0.06));
    const p0 = P(Math.cos(sp.a) * d0, Math.sin(sp.a) * d0, Math.max(0, reach * 0.45 * Math.sin(sp.el) * ((tt - 0.06) * 2 - (tt - 0.06) ** 2 * 1.4) + F * 0.3));
    if (!p0 || !p1) continue;
    ctx.globalAlpha = (1 - tt) * 0.9; ctx.strokeStyle = tt < 0.4 ? '#fff1c0' : '#ff9a40'; ctx.lineWidth = Math.max(1.5, 0.006 * R5 * p1.s);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.restore();
  // core glow + bloom
  const core = P(0, 0, fbH * (nuke ? 1 : 0.6));
  if (core) {
    const gR = (fbR * 3.2 + F * 0.6) * core.s;
    const ga = (nuke ? 0.95 : 0.9) * Math.max(heat * (nuke ? Math.exp(-Math.max(0, τ - 0.4) / 0.9) : 1), blastFlash(s, τ)) * fade;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga;
    ctx.drawImage(SPRITES.glow, core.x - gR, core.y - gR, gR * 2, gR * 2); ctx.restore();
    if (bloom) {
      const q = bloom.canvas.width / W;
      bloom.save(); bloom.globalCompositeOperation = 'lighter'; bloom.globalAlpha = ga;
      bloom.drawImage(SPRITES.glow, (core.x - gR * 1.6) * q, (core.y - gR * 1.6) * q, gR * 3.2 * q, gR * 3.2 * q); bloom.restore();
    }
  }
  return blastFlash(s, τ);
}

/** Bloom compositing helper. */
export function bloomBegin() {
  const b = scratch('bloom', W / 4, H / 4); const c = b.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, b.width, b.height);
  return c;
}
export function bloomEnd(ctx, bctx, strength = 1) {
  const b2 = scratch('bloom2', W / 4, H / 4); const c2 = b2.getContext('2d');
  c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, b2.width, b2.height);
  c2.filter = 'blur(10px)'; c2.drawImage(bctx.canvas, 0, 0); c2.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = strength;
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(b2, 0, 0, W, H); ctx.restore();
}

/** Full-screen flash with a warm radial bloom at (x,y). */
export function flash(ctx, a, x = W / 2, y = H / 2) {
  if (a <= 0.004) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.9);
  g.addColorStop(0, `rgba(255,255,250,${a})`); g.addColorStop(0.4, `rgba(255,236,200,${a * 0.75})`); g.addColorStop(1, `rgba(255,200,150,${a * 0.45})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Deterministic camera shake offset. */
export function shake(T, amp) {
  if (amp <= 0) return [0, 0];
  return [Math.sin(T * 91.3) * 0.6 + Math.sin(T * 47.1 + 1) * 0.4, Math.cos(T * 83.7) * 0.6 + Math.sin(T * 39.9 + 2) * 0.4].map((v) => v * amp);
}

// ---------------------------------------------------------------- flat-map FX
/** Top-down explosion on a flat map at screen (x,y); size = radius px of the blast. */
export function blast2D(ctx, x, y, size, τ, { seed = 3, bloom = null, nuke = false } = {}) {
  if (τ < 0 || τ > 4) return 0;
  let s = blast2D._c?.get(seed + (nuke ? 1e6 : 0));
  if (!s) { s = makeBlast({ r5: 1, kind: nuke ? 'nuke' : 'conv', seed }); (blast2D._c ||= new Map()).set(seed + (nuke ? 1e6 : 0), s); }
  const P = (e, n, u) => ({ x: x + e * size, y: y - n * size - u * size * 0.15, s: size, depth: 1000 - u });
  // shock ring
  const sr = blastShock(s, τ) * size, sa = clamp(1 - τ / (nuke ? 2 : 0.9));
  if (sa > 0) {
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.85 * sa})`; ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y, sr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  return drawBlast3D(ctx, P, s, τ, { bloom });
}

/** Expanding ring pulses (for highlighting a place). */
export function pulse(ctx, x, y, r, T, color = '#ffffff', a = 1, n = 3) {
  if (a <= 0) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const k = ((T * 0.8 + i / n) % 1);
    ctx.globalAlpha = a * (1 - k) * 0.9; ctx.strokeStyle = color; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(x, y, r * (0.2 + k), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(5, r * 0.09), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function qbez(a, c, b, t) { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }
/** Thick tapered invasion arrow along a curve (screen coords). p = 0..1 growth. */
export function arrow(ctx, a, b, p, { color = '#2f7bff', width = 46, bend = 0.22, a: alpha = 1, outline = '#ffffff', glow = 24, ctrl = null } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  const c = ctrl || [mx - dy * bend, my + dx * bend];
  const N = 48, pe = Math.max(0.02, p);
  const pts = []; for (let i = 0; i <= N; i++) pts.push(qbez(a, c, b, (i / N) * pe));
  const L = [], R = [];
  const headLen = Math.min(width * 1.9, Math.hypot(dx, dy) * 0.35);
  let acc = 0; const seg = [0];
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(acc); }
  const total = acc;
  let cut = pts.length - 1;
  while (cut > 1 && total - seg[cut] < headLen) cut--;
  for (let i = 0; i <= cut; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const w = (width / 2) * (0.35 + 0.65 * (seg[i] / Math.max(1, total)) ** 0.6);
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  const tip = pts[pts.length - 1], base = pts[cut];
  let tx = tip[0] - base[0], ty = tip[1] - base[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const hw = width * 0.95;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (const q of L) ctx.lineTo(q[0], q[1]);
    ctx.lineTo(base[0] - ty * hw, base[1] + tx * hw); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(base[0] + ty * hw, base[1] - tx * hw);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  };
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
  path(); ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.fillStyle = color; ctx.fill(); ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(a[0], a[1], tip[0], tip[1]); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
}

/** Missile on a ballistic arc between screen points; returns head position. */
export function missile(ctx, a, b, p, { color = '#ffd27a', height = 0.32, width = 5, a: alpha = 1 } = {}) {
  if (p <= 0 || alpha <= 0) return null;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const at = (t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(Math.PI * t) * d * height];
  const pe = Math.min(1, p);
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  const N = 40;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * pe, t1 = ((i + 1) / N) * pe;
    const q0 = at(t0), q1 = at(t1);
    const k = (i + 1) / N;
    ctx.strokeStyle = rgba('#ffffff', 0.08 + 0.55 * k * k); ctx.lineWidth = width * (0.5 + 1.6 * k);
    ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
  }
  const h = at(pe);
  if (p < 1) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], width * 6);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, rgba(color, 0.9)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h[0], h[1], width * 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return h;
}

/** Simple vector unit icons (top-down), pointing along `ang`. */
export function unitIcon(ctx, kind, x, y, size, ang = 0, color = '#2f7bff', a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
  ctx.beginPath();
  if (kind === 'jet') {
    ctx.moveTo(60, 0); ctx.lineTo(10, -8); ctx.lineTo(-10, -52); ctx.lineTo(-24, -52); ctx.lineTo(-12, -8); ctx.lineTo(-40, -6); ctx.lineTo(-52, -24); ctx.lineTo(-60, -24); ctx.lineTo(-54, 0);
    ctx.lineTo(-60, 24); ctx.lineTo(-52, 24); ctx.lineTo(-40, 6); ctx.lineTo(-12, 8); ctx.lineTo(-24, 52); ctx.lineTo(-10, 52); ctx.lineTo(10, 8); ctx.closePath();
  } else if (kind === 'ship' || kind === 'carrier') {
    const L = kind === 'carrier' ? 70 : 58, Wd = kind === 'carrier' ? 20 : 14;
    ctx.moveTo(L, 0); ctx.quadraticCurveTo(L * 0.5, -Wd, -L * 0.2, -Wd); ctx.lineTo(-L, -Wd * 0.8); ctx.lineTo(-L, Wd * 0.8); ctx.lineTo(-L * 0.2, Wd); ctx.quadraticCurveTo(L * 0.5, Wd, L, 0); ctx.closePath();
  } else if (kind === 'tank') {
    ctx.roundRect(-40, -28, 80, 56, 10); ctx.moveTo(0, -5); ctx.rect(0, -6, 62, 12);
  } else { ctx.arc(0, 0, 40, 0, Math.PI * 2); }
  ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
  if (kind === 'carrier') { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-50, -3, 90, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-10, 8, 16, 8); }
  if (kind === 'tank') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** Wake/trail behind a moving unit on a polyline (screen coords). */
export function trail(ctx, pts, color = 'rgba(255,255,255,0.6)', width = 6) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const k = i / pts.length;
    ctx.globalAlpha = k * 0.8; ctx.strokeStyle = color; ctx.lineWidth = width * k;
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  ctx.restore();
}

export { qbez };
