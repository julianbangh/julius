// Geo Studio core: canvas, fonts, math, easing, noise, colour.
import { createCanvas, GlobalFonts, loadImage, Path2D, Image } from '@napi-rs/canvas';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export { createCanvas, loadImage, Path2D, Image };

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const W = 1080;
export const H = 1920;
export const FPS = 30;

// ---------- fonts ----------
let fontsDone = false;
export function registerFonts() {
  if (fontsDone) return;
  const dir = path.join(ROOT, 'assets/fonts');
  const map = {
    'Anton-Regular.ttf': 'Anton',
    'BebasNeue-Regular.ttf': 'Bebas',
    'Montserrat-Black.ttf': 'MontBlack',
    'Montserrat-ExtraBold.ttf': 'MontXB',
    'Montserrat-Bold.ttf': 'MontBold',
    'Montserrat-SemiBold.ttf': 'MontSemi',
  };
  for (const [f, fam] of Object.entries(map)) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, fam);
  }
  fontsDone = true;
}

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, x)));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const deg = Math.PI / 180;

export const ease = {
  linear: (t) => clamp(t),
  inQuad: (t) => clamp(t) ** 2,
  outQuad: (t) => 1 - (1 - clamp(t)) ** 2,
  inOutQuad: (t) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; },
  inCubic: (t) => clamp(t) ** 3,
  outCubic: (t) => 1 - (1 - clamp(t)) ** 3,
  inOutCubic: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; },
  outQuart: (t) => 1 - (1 - clamp(t)) ** 4,
  inOutQuart: (t) => { t = clamp(t); return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2; },
  outExpo: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - 2 ** (-10 * t); },
  inOutExpo: (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2; },
  outBack: (t, s = 1.70158) => { t = clamp(t); const c3 = s + 1; return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2; },
  outElastic: (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; },
};

/** progress of T within [a,b], eased */
export function prog(T, a, b, e = ease.inOutCubic) { return e(invLerp(a, b, T)); }
/** 0→1→0 envelope: fade in over fi, hold, fade out over fo */
export function env(T, a, b, fi = 0.25, fo = 0.25) {
  if (T < a || T > b) return 0;
  return Math.min(smooth((T - a) / fi), smooth((b - T) / fo));
}

// keyframe track: keys = [[t, value|object], ...]; numbers/objects of numbers interpolated
export function track(T, keys, e = ease.inOutCubic) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e1] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (T <= t1) {
      const k = (e1 || e)(invLerp(t0, t1, T));
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      const o = {};
      for (const key of Object.keys(v1)) o[key] = typeof v1[key] === 'number' && typeof v0[key] === 'number' ? lerp(v0[key], v1[key], k) : (k < 0.5 ? v0[key] : v1[key]);
      return o;
    }
  }
  return keys[keys.length - 1][1];
}

// ---------- random / noise ----------
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---------- colour ----------
export function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgba(c, a = 1) {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
export function mix(c1, c2, t) {
  const a = typeof c1 === 'string' ? hex(c1) : c1, b = typeof c2 === 'string' ? hex(c2) : c2;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export const PALETTE = {
  usa: '#2f7bff', usaGlow: '#7fb2ff', red: '#ff3b3b', enemy: '#e5484d', gold: '#ffc83d',
  green: '#2fd27a', purple: '#9b6bff', orange: '#ff8a2a', teal: '#26c6da', white: '#ffffff',
  ink: '#0b1020', yellow: '#ffe14d', africa: '#f4b400', rome: '#b3122e',
};

// offscreen canvas pool
const pool = new Map();
export function scratch(name, w, h) {
  let c = pool.get(name);
  if (!c || c.width !== w || c.height !== h) { c = createCanvas(w, h); pool.set(name, c); }
  return c;
}
