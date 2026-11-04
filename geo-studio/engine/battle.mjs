// Geo Studio battle kit: low-poly 3D units on the Ground3D satellite camera (lit faces, cast
// shadows, wakes, contrails), 3D missiles, tracers, muzzle flashes, splashes, smoke columns and
// craters — plus flat-map war FX (burning front lines, swarms, salvos) and game-style UI
// (health bars, versus card, chapter slams, kill feed, punch-in zoom, glitch).
import { W, H, clamp, lerp, rng, ease, rgba, hex, createCanvas } from './core.mjs';
import { sprites, puff, makeBlast, drawBlast3D, blastDecals, blast2D, missile as missile2D, unitIcon, flash, shake } from './fx.mjs';
import { text } from './ui.mjs';

// =====================================================================  low-poly models
// Model space: x forward, y left, z up; length ~1. Faces are [points[], colourKey].
function prism(poly, z0, z1, key) {
  const faces = [[poly.map(([x, y]) => [x, y, z1]), key + 'T']];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    faces.push([[[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]], key]);
  }
  return faces;
}
const box = (x0, x1, y0, y1, z0, z1, key) => prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, key);
const MODELS = {
  tank: [...box(-0.5, 0.5, -0.27, 0.27, 0, 0.2, 'h'), ...box(-0.26, 0.16, -0.19, 0.19, 0.2, 0.34, 't'), ...box(0.12, 0.8, -0.035, 0.035, 0.25, 0.3, 'g')],
  apc: [...prism([[0.5, -0.2], [0.5, 0.2], [-0.5, 0.25], [-0.5, -0.25]], 0, 0.24, 'h'), ...box(-0.1, 0.12, -0.08, 0.08, 0.24, 0.3, 't')],
  launcher: [...box(-0.5, 0.5, -0.22, 0.22, 0, 0.18, 'h'), ...prism([[-0.45, -0.12], [0.35, -0.12], [0.35, 0.12], [-0.45, 0.12]], 0.18, 0.4, 'g')],
  destroyer: [...prism([[0.5, 0], [0.32, -0.07], [-0.45, -0.07], [-0.5, -0.05], [-0.5, 0.05], [-0.45, 0.07], [0.32, 0.07]], 0, 0.05, 'h'),
    ...box(-0.16, 0.12, -0.045, 0.045, 0.05, 0.13, 't'), ...box(-0.03, 0.01, -0.015, 0.015, 0.13, 0.22, 'g'), ...box(0.2, 0.3, -0.03, 0.03, 0.05, 0.09, 't')],
  carrier: [...prism([[0.5, 0.0], [0.44, -0.1], [-0.5, -0.1], [-0.5, 0.12], [0.36, 0.12]], 0, 0.045, 'd'), ...box(-0.06, 0.09, 0.075, 0.11, 0.045, 0.12, 't')],
  landing: [...prism([[0.5, -0.18], [0.5, 0.18], [-0.5, 0.2], [-0.5, -0.2]], 0, 0.11, 'h'), ...box(-0.5, -0.3, -0.12, 0.12, 0.11, 0.2, 't')],
  jet: [...prism([[0.5, 0], [0.14, -0.07], [-0.02, -0.46], [-0.16, -0.46], [-0.1, -0.07], [-0.34, -0.07], [-0.44, -0.2], [-0.5, -0.2], [-0.47, 0], [-0.5, 0.2], [-0.44, 0.2], [-0.34, 0.07], [-0.1, 0.07], [-0.16, 0.46], [-0.02, 0.46], [0.14, 0.07]], 0, 0.035, 'h')],
  sub: [...prism([[0.5, 0], [0.4, -0.05], [-0.45, -0.05], [-0.5, 0], [-0.45, 0.05], [0.4, 0.05]], -0.02, 0.04, 'h'), ...box(0.05, 0.16, -0.02, 0.02, 0.04, 0.1, 't')],
};
export const TEAM = {
  us: { h: '#5f7f9f', hT: '#8fb0d0', t: '#6d8fb2', tT: '#a7c6e6', g: '#3f556c', gT: '#5c7892', d: '#4b5560', dT: '#6f7b88', accent: '#2f7bff' },
  cn: { h: '#9a5a4a', hT: '#c88068', t: '#a8604e', tT: '#d6907a', g: '#5a3328', gT: '#7a4a3c', d: '#5a4a46', dT: '#7e6a64', accent: '#e5484d' },
  neutral: { h: '#7a7a72', hT: '#a3a39a', t: '#86867e', tT: '#b0b0a6', g: '#4e4e48', gT: '#6a6a62', d: '#5a5a5a', dT: '#7a7a7a', accent: '#ffffff' },
};
const LIGHT = (() => { const v = [-0.45, 0.55, 0.72]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
const SUN = [0.55, -0.45]; // shadow offset per km of height (east, north)

function shadeHex(c, k) { const [r, g, b] = hex(c); return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`; }

/**
 * Draw 3D units through a Ground3D camera. units: [{ kind, team, e, n, u (km), heading (rad), size (km length), a, hit (0..1 burning) }]
 */
export function drawUnits3D(ctx, G, units, { shadows = true } = {}) {
  const cam = G.camKm();
  const faces = [];
  for (const un of units) {
    if ((un.a ?? 1) <= 0) continue;
    const model = MODELS[un.kind]; if (!model) continue;
    const cs = Math.cos(un.heading || 0), sn = Math.sin(un.heading || 0), S = un.size || 0.05, u0 = un.u || 0;
    const pal = TEAM[un.team] || TEAM.neutral;
    const tw = (x, y, z) => [un.e + (x * cs - y * sn) * S, un.n + (x * sn + y * cs) * S, u0 + z * S];
    if (shadows) {
      const top = model.filter((f) => f[1].endsWith('T'));
      for (const [pts] of top) {
        const sp = pts.map(([x, y, z]) => { const [e, n, u] = tw(x, y, z); return G.project(e + SUN[0] * u, n + SUN[1] * u, 0); });
        if (sp.some((p) => !p)) continue;
        faces.push({ depth: sp[0].depth + 1e6, shadow: true, sp, a: (un.a ?? 1) * (u0 > 0.05 ? 0.28 : 0.42) });
      }
    }
    for (const [pts, key] of model) {
      const wp = pts.map(([x, y, z]) => tw(x, y, z));
      // normal
      const [a, b, c] = wp; const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const cx = wp.reduce((s, p) => s + p[0], 0) / wp.length, cy = wp.reduce((s, p) => s + p[1], 0) / wp.length, cz = wp.reduce((s, p) => s + p[2], 0) / wp.length;
      if (nx * (cam[0] - cx) + ny * (cam[1] - cy) + nz * (cam[2] - cz) < 0) continue;
      const sp = wp.map(([e, n, u]) => G.project(e, n, u)); if (sp.some((p) => !p)) continue;
      const lit = 0.5 + 0.6 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const base = pal[key] || pal[key.replace('T', '')] || '#888';
      const burnt = un.hit ? lerp(1, 0.45, clamp(un.hit)) : 1;
      faces.push({ depth: sp.reduce((s, p) => s + p.depth, 0) / sp.length, sp, color: shadeHex(base, lit * burnt), a: un.a ?? 1, accent: key === 'hT' && un.stripe !== false ? pal.accent : null });
    }
  }
  faces.sort((p, q) => q.depth - p.depth);
  ctx.save(); ctx.lineJoin = 'round';
  for (const f of faces) {
    ctx.beginPath(); f.sp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    if (f.shadow) { ctx.globalAlpha = f.a; ctx.fillStyle = '#000'; ctx.fill(); continue; }
    ctx.globalAlpha = f.a; ctx.fillStyle = f.color; ctx.fill();
    ctx.strokeStyle = 'rgba(10,12,16,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (f.accent) { ctx.globalAlpha = f.a * 0.55; ctx.strokeStyle = f.accent; ctx.lineWidth = 2.5; ctx.stroke(); }
  }
  ctx.restore();
}

/** Ship wakes and foam as ground decals (call inside G.draw decals). ships: [{e, n, heading, size, speed (0..1)}] */
export function wakeDecals(c, h, ships, T) {
  c.save();
  for (const s of ships) {
    const k = h.km, L = s.size * k, sp = s.speed ?? 1; if (sp <= 0) continue;
    const x = s.e * k, y = -s.n * k, cs = Math.cos(-(s.heading || 0)), sn = Math.sin(-(s.heading || 0));
    c.save(); c.translate(x, y); c.rotate(-(s.heading || 0)); // local: +x forward
    const len = L * (3 + 3 * sp);
    const g = c.createLinearGradient(L * 0.4, 0, -len, 0); g.addColorStop(0, `rgba(255,255,255,${0.75 * sp})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.lineWidth = Math.max(1.5, L * 0.05); c.lineCap = 'round';
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(L * 0.45, 0); c.quadraticCurveTo(-len * 0.3, side * L * 0.25, -len, side * len * 0.32); c.stroke(); }
    c.fillStyle = g; c.beginPath(); c.ellipse(-len * 0.35, 0, len * 0.4, L * 0.12 + len * 0.03, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  c.restore();
}

/** Crater / scorch decals. pts: [{e, n, r (km), t0}] */
export function craterDecals(c, h, pts, T) {
  for (const p of pts) {
    if (T < p.t0) continue;
    const a = clamp((T - p.t0) / 0.3), x = p.e * h.km, y = -p.n * h.km, r = p.r * h.km;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(15,10,8,${0.85 * a})`); g.addColorStop(0.6, `rgba(35,25,20,${0.6 * a})`); g.addColorStop(1, 'rgba(40,30,25,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
}

/** Rising, wind-drifting smoke column with fire at the base. */
export function smokeColumn(ctx, G, e, n, T, { seed = 1, height = 0.6, size = 0.08, wind = [0.5, 0.15], fire = 1, a = 1, n: count = 14 } = {}) {
  if (a <= 0) return;
  sprites();
  const r = rng(seed), L = 4;
  const items = [];
  for (let i = 0; i < count; i++) {
    const ph = ((T + (i / count) * L + r() * 0.3) % L) / L;
    const u = ph * height, de = wind[0] * ph * ph * height, dn = wind[1] * ph * ph * height;
    const p = G.project(e + de + (r() - 0.5) * size * 0.4, n + dn + (r() - 0.5) * size * 0.4, u);
    if (!p) continue;
    items.push({ p, r: size * (0.6 + 2.2 * ph) * p.s, al: a * Math.min(1, ph * 7) * (1 - ph) ** 1.1 * 0.85, v: i + seed, dark: ph < 0.35 });
  }
  items.sort((x, y) => y.p.depth - x.p.depth);
  for (const it of items) puff(ctx, it.dark ? 'dark' : 'smoke', it.v, it.p.x, it.p.y, it.r, it.al);
  if (fire > 0) {
    const p = G.project(e, n, size * 0.3); if (!p) return;
    for (let k = 0; k < 4; k++) {
      const fl = 0.7 + 0.3 * Math.sin(T * 23 + k * 2 + seed);
      puff(ctx, k % 2 ? 'hot' : 'warm', k + seed, p.x + Math.sin(T * 9 + k) * size * p.s * 0.3, p.y - k * size * p.s * 0.35, size * p.s * (0.9 - k * 0.15) * fl, fire * a * 0.9, 'lighter');
    }
  }
}

/** Small explosion on the 3D ground (lite particle blast). Cache blasts by seed. */
const blastCache = new Map();
export function boom3D(ctx, G, e, n, tau, { r = 0.06, seed = 1, bloom = null, water = false } = {}) {
  if (tau < 0 || tau > 4) return 0;
  const key = seed * 1000 + Math.round(r * 1e4);
  let b = blastCache.get(key); if (!b) { b = makeBlast({ r5: r, kind: 'conv', seed, lite: true }); blastCache.set(key, b); }
  if (water) return splash3D(ctx, G, e, n, tau, { r, seed });
  return drawBlast3D(ctx, (x, y, z) => G.project(e + x, n + y, z), b, tau, { bloom });
}
export function boomDecal(c, h, e, n, tau, r = 0.06, seed = 1) {
  if (tau < 0 || tau > 4) return;
  const key = seed * 1000 + Math.round(r * 1e4);
  let b = blastCache.get(key); if (!b) { b = makeBlast({ r5: r, kind: 'conv', seed, lite: true }); blastCache.set(key, b); }
  c.save(); c.translate(e * h.km, -n * h.km); blastDecals(c, b, tau, h.km); c.restore();
}

/** Water splash: white column + ring. */
export function splash3D(ctx, G, e, n, tau, { r = 0.05, seed = 1 } = {}) {
  if (tau < 0 || tau > 2.5) return 0;
  sprites();
  const rr = rng(seed);
  for (let i = 0; i < 12; i++) {
    const a = rr() * Math.PI * 2, d = rr() * r * 0.4, up = r * (1.5 + rr() * 2) * Math.sin(Math.min(Math.PI, tau * 2.2));
    const p = G.project(e + Math.cos(a) * d * (1 + tau), n + Math.sin(a) * d * (1 + tau), Math.max(0, up * (0.4 + 0.6 * i / 12)));
    if (p) puff(ctx, 'white', i + seed, p.x, p.y, r * 0.5 * p.s * (0.8 + tau), clamp(1 - tau / 2.5) * 0.85);
  }
  return Math.exp(-tau * 10) * 0.2;
}

/** 3D ballistic missile from A to B (km coords) with smoke trail. p: 0..1 flight progress. */
export function missile3D(ctx, G, A, B, p, { apex = 0.6, size = 0.02, a = 1, seed = 1 } = {}) {
  if (p <= 0 || p > 1 || a <= 0) return null;
  sprites();
  const at = (t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), Math.sin(Math.PI * t) * apex + lerp(A[2] || 0, B[2] || 0, t)];
  for (let i = 18; i >= 1; i--) {
    const t = p - i * 0.018; if (t <= 0) continue;
    const [e, n, u] = at(t); const q = G.project(e, n, u); if (!q) continue;
    const age = i / 18;
    puff(ctx, 'smoke', i + seed, q.x, q.y, size * (1 + age * 4) * q.s, a * (1 - age) * 0.55);
  }
  const [e, n, u] = at(p); const q = G.project(e, n, u); if (!q) return null;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  const gr = Math.max(8, size * 3 * q.s);
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, gr); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,190,90,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, gr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  return q;
}

/** Tracer round + muzzle flash between two 3D points; p 0..1. */
export function tracer3D(ctx, G, A, B, p, { color = '#ffd27a', a = 1, width = 3 } = {}) {
  if (p < 0 || p > 1.05) return;
  const m = (t) => G.project(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2] || 0, B[2] || 0, t) + Math.sin(Math.PI * t) * 0.01);
  const h = m(Math.min(1, p)), t0 = m(Math.max(0, p - 0.18)); if (!h || !t0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(h.x, h.y); ctx.stroke();
  if (p < 0.12) { const s = G.project(A[0], A[1], A[2] || 0); if (s) { const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 30); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,160,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}

/** Contrail behind a jet: list of 3D points (oldest first). */
export function contrail3D(ctx, G, pts, { a = 1, width = 0.006 } = {}) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const p0 = G.project(...pts[i - 1]), p1 = G.project(...pts[i]); if (!p0 || !p1) continue;
    const k = i / pts.length; ctx.globalAlpha = a * k * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, width * p1.s * (1.5 - k));
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.restore();
}

// =====================================================================  flat-map war FX
/** Burning front line along screen points: glowing core, flames, random artillery flashes. */
export function frontLine2D(ctx, pts, T, { a = 1, seed = 3, flames = true, bursts = true, width = 10, color = '#ff8a2a', bloom = null } = {}) {
  if (a <= 0 || pts.length < 2) return;
  sprites();
  const r = rng(seed);
  // jagged path
  const path = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 6; k++) {
    const t = k / 6, x = lerp(pts[i][0], pts[i + 1][0], t), y = lerp(pts[i][1], pts[i + 1][1], t);
    const j = Math.sin(T * 3 + i * 7 + k * 2.3 + seed) * 4 + (r() - 0.5) * 8; path.push([x + j, y - j]);
  }
  path.push(pts[pts.length - 1]);
  ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.22); ctx.lineWidth = width * 7; ctx.shadowColor = color; ctx.shadowBlur = 40; ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.85); ctx.lineWidth = width * 1.8; ctx.shadowBlur = 18; ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = width * 0.55; ctx.stroke();
  ctx.restore();
  if (flames) for (let i = 0; i < path.length; i += 2) {
    const fl = 0.6 + 0.4 * Math.sin(T * 17 + i * 1.7);
    puff(ctx, i % 3 ? 'warm' : 'hot', i, path[i][0], path[i][1] - width, width * 2.2 * fl, a * 0.8, 'lighter');
    if (i % 4 === 0) puff(ctx, 'dark', i, path[i][0] + 6, path[i][1] - width * 4 - (T * 30 + i * 13) % 40, width * 3, a * 0.35);
  }
  if (bursts) for (let k = 0; k < 6; k++) {
    const per = 1.4, ph = ((T + k * 0.37 + seed) % per) / per, idx = Math.floor((k * 97 + Math.floor((T + k * 0.37 + seed) / per) * 31) % path.length);
    const [x, y] = path[idx]; blast2D(ctx, x, y, width * 4.5, ph * 1.2, { seed: 70 + k, bloom });
  }
}

/** A column of units marching along a lon/lat path; p = 0..1 how far the head has got. */
export function swarm2D(ctx, cam, path, p, { n = 12, kind = 'tank', color = '#2f7bff', size = 34, spread = 0.6, a = 1, seed = 5 } = {}) {
  if (p <= 0 || a <= 0) return;
  const r = rng(seed);
  const seg = (t) => { const u = clamp(t) * (path.length - 1), k = Math.min(path.length - 2, Math.floor(u)), f = u - k; return [lerp(path[k][0], path[k + 1][0], f), lerp(path[k][1], path[k + 1][1], f)]; };
  for (let i = 0; i < n; i++) {
    const t = p - (i / n) * 0.35; if (t <= 0) continue;
    const [lon, lat] = seg(t), [lon2, lat2] = seg(t + 0.01);
    const [x, y] = cam.toScreen(lon, lat), [x2, y2] = cam.toScreen(lon2, lat2);
    const ang = Math.atan2(y2 - y, x2 - x), off = (r() - 0.5) * size * spread * 2;
    unitIcon(ctx, kind, x - Math.sin(ang) * off, y + Math.cos(ang) * off, size, ang, color, a * clamp(t * 6));
  }
}

/** Missile salvo on a flat map: launches staggered over `spread` seconds, blasts on arrival. */
export function salvo2D(ctx, cam, from, to, T, t0, { n = 10, flight = 0.9, spread = 1.2, seed = 9, height = 0.3, color = '#ffd27a', jitter = 0.8, size = 60, bloom = null, a = 1 } = {}) {
  const r = rng(seed);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const ts = t0 + r() * spread;
    const f = from[i % from.length], tt = to[i % to.length];
    const A = cam.toScreen(f[0] + (r() - 0.5) * jitter * 0.5, f[1] + (r() - 0.5) * jitter * 0.5);
    const B = cam.toScreen(tt[0] + (r() - 0.5) * jitter, tt[1] + (r() - 0.5) * jitter);
    const p = (T - ts) / flight;
    if (p > 0 && p < 1) missile2D(ctx, A, B, p, { color, height, width: 5, a });
    if (p >= 1) { blast2D(ctx, B[0], B[1], size, (T - ts - flight), { seed: seed + i, bloom }); hits++; }
  }
  return hits;
}

/** Sub icon + sonar ping. */
export function sub2D(ctx, x, y, size, ang, T, { color = '#2f7bff', a = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(-6, -26, 22, 14); ctx.strokeRect(-6, -26, 22, 14);
  ctx.restore();
  const k = (T * 0.9) % 1; ctx.save(); ctx.globalAlpha = a * (1 - k) * 0.7; ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, size * (0.5 + k * 2.2), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// =====================================================================  game-style UI
const dmgMem = new Map();
/** Fighting-game health bars at the top. left/right: { name, flag (img), v (0..1), color } */
export function healthBars(ctx, left, right, T, { y = 128, a = 1 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const bw = 400, bh = 34, gap = 90;
  for (const [side, s] of [[-1, left], [1, right]]) {
    const x0 = side < 0 ? W / 2 - gap / 2 - bw : W / 2 + gap / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(x0 - 6, y - 6, bw + 12, bh + 12, 10); ctx.fill();
    const lag = s.lag ?? s.v;
    const fillW = (v) => bw * clamp(v);
    const xf = (w) => (side < 0 ? x0 + bw - w : x0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(xf(fillW(lag)), y, fillW(lag), bh);
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, s.v > 0.35 ? '#7dff8a' : '#ffd15c'); g.addColorStop(1, s.v > 0.35 ? '#1fae4b' : '#e0532b');
    ctx.fillStyle = g; ctx.fillRect(xf(fillW(s.v)), y, fillW(s.v), bh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x0, y, bw, bh);
    if (s.flag) { const fh = 46, fw = (s.flag.width / s.flag.height) * fh; ctx.drawImage(s.flag, side < 0 ? x0 : x0 + bw - fw, y + bh + 12, fw, fh); }
    text(ctx, s.name, side < 0 ? x0 + 80 : x0 + bw - 80, y + bh + 36, { font: 'MontBlack', size: 30, align: side < 0 ? 'left' : 'right', stroke: 6 });
  }
  text(ctx, 'VS', W / 2, y + bh / 2 + 2, { font: 'Anton', size: 52, color: '#ffe14d', stroke: 8 });
  ctx.restore();
}
/** Smoothly interpolated health from damage events [[t, v], ...] (v = health after hit). Returns {v, lag}. */
export function healthAt(T, events) {
  let v = events[0][1], lag = v;
  for (let i = 1; i < events.length; i++) {
    const [t, val] = events[i];
    if (T >= t) { const prev = events[i - 1][1]; v = lerp(prev, val, ease.outCubic(clamp((T - t) / 0.25))); lag = lerp(prev, val, ease.inOutQuad(clamp((T - t - 0.35) / 0.6))); }
  }
  return { v, lag };
}

/** Big split-screen versus intro: flags slam in from the sides, lightning in the middle. */
export function versusCard(ctx, flagL, flagR, nameL, nameR, T, t0, { a = 1, colL = '#1f4fbf', colR = '#b31d24' } = {}) {
  const t = T - t0; if (t < 0 || a <= 0) return;
  const k = ease.outBack(clamp(t / 0.35), 1.4);
  ctx.save(); ctx.globalAlpha = a;
  const tilt = 160;
  ctx.save(); ctx.translate(-(1 - k) * W, 0);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W / 2 + tilt, 0); ctx.lineTo(W / 2 - tilt, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
  ctx.fillStyle = colL; ctx.fillRect(0, 0, W, H);
  if (flagL) { const fh = 520, fw = (flagL.width / flagL.height) * fh; ctx.globalAlpha = a * 0.9; ctx.drawImage(flagL, W * 0.28 - fw / 2, H * 0.3 - fh / 2, fw, fh); }
  ctx.restore();
  ctx.save(); ctx.translate((1 - k) * W, 0);
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W / 2 + tilt, 0); ctx.lineTo(W / 2 - tilt, H); ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
  ctx.fillStyle = colR; ctx.fillRect(0, 0, W, H);
  if (flagR) { const fh = 520, fw = (flagR.width / flagR.height) * fh; ctx.globalAlpha = a * 0.9; ctx.drawImage(flagR, W * 0.72 - fw / 2, H * 0.7 - fh / 2, fw, fh); }
  ctx.restore();
  // lightning seam
  if (t > 0.3) {
    const r = rng(Math.floor(T * 20)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#bfe0ff'; ctx.shadowBlur = 30; ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); let x = W / 2 + tilt, y = 0; ctx.moveTo(x, y);
    while (y < H) { y += 60 + r() * 60; x = W / 2 + tilt - (2 * tilt * y) / H + (r() - 0.5) * 70; ctx.lineTo(x, y); }
    ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  }
  const s = 1 + 0.25 * (1 - ease.outBack(clamp((t - 0.25) / 0.3)));
  ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.scale(s, s);
  text(ctx, 'VS', 0, 0, { font: 'Anton', size: 260, color: '#ffe14d', stroke: 22, alpha: clamp((t - 0.25) / 0.15) });
  ctx.restore();
  text(ctx, nameL, W * 0.28, H * 0.3 + 330, { font: 'Anton', size: 96, stroke: 12, alpha: clamp((t - 0.2) / 0.2) });
  text(ctx, nameR, W * 0.72, H * 0.7 - 330, { font: 'Anton', size: 96, stroke: 12, alpha: clamp((t - 0.2) / 0.2) });
  ctx.restore();
  if (t < 0.6) flash(ctx, Math.max(0, 0.6 - t) * 0.8);
}

/** Chapter slam ("ROUND 1"): big text that slams down with a shockwave line. */
export function chapterSlam(ctx, str, T, t0, { y = 300, a = 1, color = '#fff', sub = '', subColor = '#ffe14d', dur = 2.2 } = {}) {
  const t = T - t0; if (t < 0 || t > dur || a <= 0) return;
  const al = a * Math.min(clamp(t / 0.08), clamp((dur - t) / 0.3));
  const s = 1 + 1.6 * (1 - ease.outExpo(clamp(t / 0.22)));
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(s, s);
  text(ctx, str, 0, 0, { font: 'Anton', size: 130, color, stroke: 16, alpha: al, shadow: 30, maxW: W - 80 });
  ctx.restore();
  if (sub) text(ctx, sub, W / 2, y + 100, { font: 'MontBlack', size: 40, color: subColor, stroke: 8, alpha: al * clamp((t - 0.2) / 0.2), maxW: W - 100 });
  if (t < 0.5) { const w = W * ease.outCubic(t / 0.5); ctx.save(); ctx.globalAlpha = al * (1 - t / 0.5); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(W / 2 - w / 2, y + 70); ctx.lineTo(W / 2 + w / 2, y + 70); ctx.stroke(); ctx.restore(); }
}

/** Kill feed lines on the right: items [{ t, text, color }] */
export function killFeed(ctx, items, T, { x = W - 40, y = 420, a = 1 } = {}) {
  let row = 0;
  for (const it of items) {
    const t = T - it.t; if (t < 0 || t > 3.2) continue;
    const al = a * Math.min(clamp(t / 0.15), clamp((3.2 - t) / 0.4)), dx = (1 - ease.outBack(clamp(t / 0.3))) * 300;
    ctx.save(); ctx.globalAlpha = al; ctx.font = '30px MontBlack'; const w = ctx.measureText(it.text).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.roundRect(x - w + dx, y + row * 62 - 26, w, 52, 12); ctx.fill();
    ctx.fillStyle = it.color || '#fff'; ctx.fillRect(x - w + dx, y + row * 62 - 26, 8, 52);
    ctx.restore();
    text(ctx, it.text, x - 20 + dx, y + row * 62, { font: 'MontBlack', size: 30, align: 'right', alpha: al, color: '#fff' });
    row++;
  }
}

/** Camera punch-in: returns an extra zoom amount kicked at each beat time, decaying fast. */
export function punch(T, beats, amt = 0.12) {
  let z = 0;
  for (const b of beats) { const t = T - b; if (t >= 0 && t < 0.6) z += amt * Math.exp(-t * 7) * Math.sin(Math.min(Math.PI / 2, t * 30)); }
  return z;
}

/** Cyber glitch: sliced horizontal bands shifted + scanlines + RGB tint. */
export function glitch(ctx, canvas, T, a = 1, seed = 1) {
  if (a <= 0) return;
  const r = rng(Math.floor(T * 15) + seed);
  const snap = createCanvas(W, H); snap.getContext('2d').drawImage(canvas, 0, 0);
  for (let i = 0; i < 9 * a; i++) {
    const y = r() * H, h = 20 + r() * 90, dx = (r() - 0.5) * 120 * a;
    ctx.drawImage(snap, 0, y, W, h, dx, y, W, h);
  }
  ctx.save(); ctx.globalAlpha = 0.12 * a; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(snap, 10 * a, 0); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.18 * a; ctx.fillStyle = '#000'; for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.06 * a; ctx.fillStyle = r() > 0.5 ? '#00ffd0' : '#ff2bd6'; ctx.fillRect(0, 0, W, H); ctx.restore();
}

/** Speed lines radiating from a point (for punch transitions). */
export function speedLines(ctx, x, y, T, a = 1, n = 40) {
  if (a <= 0) return;
  const r = rng(Math.floor(T * 30));
  ctx.save(); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ang = r() * Math.PI * 2, r0 = 300 + r() * 300, r1 = r0 + 300 + r() * 500;
    ctx.lineWidth = 2 + r() * 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); ctx.stroke();
  }
  ctx.restore();
}

export { shake, flash };

// =====================================================================  procedural ocean
let WAVES = null;
function waveTexture() {
  if (WAVES) return WAVES;
  const S = 512, c = createCanvas(S, S), x = c.getContext('2d'), r = rng(42);
  x.fillStyle = '#0b4166'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) { const g = x.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 60 + r() * 120); g.addColorStop(0, `rgba(${r() > 0.5 ? '20,90,130' : '4,30,55'},0.35)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  x.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const px = r() * S, py = r() * S, len = 4 + r() * 16, a = 0.04 + r() * 0.16;
    x.strokeStyle = `rgba(200,235,255,${a})`; x.lineWidth = 1 + r() * 1.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + len / 2, py + oy - 2, px + ox + len, py + oy); x.stroke(); }
  }
  WAVES = c; return c;
}
/** Paint an open-ocean surface (waves drifting with time) over the ground canvas. Call first in decals. */
export function oceanDecal(c, h, T, { tile = 1.7, alpha = 1 } = {}) {
  const tex = waveTexture();
  const s = (tile * h.km) / tex.width;
  c.save(); c.globalAlpha = alpha;
  c.fillStyle = '#0a3a5c'; c.fillRect(-1e5, -1e5, 2e5, 2e5);
  const pat = c.createPattern(tex, 'repeat');
  c.scale(s, s); c.translate((T * 18) % tex.width, (T * 7) % tex.width);
  c.fillStyle = pat; c.fillRect(-1e5 / s, -1e5 / s, 2e5 / s, 2e5 / s);
  c.restore();
}
/** Screen-space sun glint near the horizon. */
export function sunGlint(ctx, G, a = 1) {
  const y = Math.max(0, G.horizonY) + 40;
  const g = ctx.createRadialGradient(W * 0.62, y, 0, W * 0.62, y, 700);
  g.addColorStop(0, `rgba(255,236,200,${0.55 * a})`); g.addColorStop(0.3, `rgba(255,200,140,${0.18 * a})`); g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

/** Drawn tick / cross marks (the fonts have no ✔ ✖ glyphs). */
export function mark(ctx, kind, x, y, s, a = 1, color = '#ffe14d') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, col] of [[s * 0.34, '#000'], [s * 0.2, color]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    if (kind === 'tick') { ctx.moveTo(-s * 0.4, 0); ctx.lineTo(-s * 0.1, s * 0.3); ctx.lineTo(s * 0.45, -s * 0.35); }
    else { ctx.moveTo(-s * 0.35, -s * 0.35); ctx.lineTo(s * 0.35, s * 0.35); ctx.moveTo(s * 0.35, -s * 0.35); ctx.lineTo(-s * 0.35, s * 0.35); }
    ctx.stroke();
  }
  ctx.restore();
}

/** Shared land border between two countries (from their Natural Earth rings), as the longest run of [lon, lat]. */
export function sharedBorder(cA, cB, tol = 0.03) {
  const ringsOf = (g) => (g.type === 'MultiPolygon' ? g.coordinates.flatMap((p) => p) : g.coordinates);
  const grid = new Map(), key = (x, y) => `${Math.round(x / tol)},${Math.round(y / tol)}`;
  for (const ring of ringsOf(cB.geometry)) for (const [x, y] of ring) grid.set(key(x, y), 1);
  const near = (x, y) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (grid.has(`${Math.round(x / tol) + dx},${Math.round(y / tol) + dy}`)) return true; return false; };
  let best = [];
  for (const ring of ringsOf(cA.geometry)) {
    let run = [];
    for (const p of ring.concat(ring.slice(0, 1))) { if (near(p[0], p[1])) run.push(p); else { if (run.length > best.length) best = run; run = []; } }
    if (run.length > best.length) best = run;
  }
  return best;
}
