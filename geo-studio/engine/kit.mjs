// Geo Studio kit: high-level scene helpers shared by video storyboards.
import { W, H, clamp, ease, env, prog, track, rgba, lerp, smooth } from './core.mjs';
import { Camera, drawCountry, drawHighlight, drawConquest, zoomFor } from './geo.mjs';
import { drawImagery, credits } from './tiles.mjs';
import { drawGlobe, drawStars, drawGlobeCountries, globeToZoom } from './globe.mjs';
import { flag, drawFlag, text, headline, label } from './ui.mjs';
import { pulse } from './fx.mjs';

export { W, H, clamp, ease, env, prog, track, rgba, lerp, smooth, zoomFor, Camera };

/** Flat camera from a keyframe track [[t, {lon, lat, zoom, rot?}], ...] */
export function camAt(T, keys, e = ease.inOutCubic, { fit = true } = {}) {
  const v = track(T, keys, e);
  return fitCam(new Camera({ lon: v.lon, lat: v.lat, zoom: v.zoom, rot: v.rot || 0 }), fit);
}
/** keep a flat camera inside the Mercator world vertically (no empty space above the Arctic) */
export function fitCam(cam, fit = true) {
  if (!fit) return cam;
  const minZ = Math.log2(H / 256) + 0.02;
  let { lon, lat, zoom } = cam;
  if (zoom < minZ) zoom = minZ;
  let c = new Camera({ lon, lat, zoom, rot: cam.rot });
  const top = c.wy - c.cy, bot = c.wy + (c.h - c.cy);
  if (top < 0) c = new Camera({ lon, lat: worldLat(c, c.cy), zoom, rot: cam.rot });
  else if (bot > c.ws) c = new Camera({ lon, lat: worldLat(c, c.ws - (c.h - c.cy)), zoom, rot: cam.rot });
  return c;
}
function worldLat(c, wy) { const n = Math.PI - (2 * Math.PI * wy) / c.ws; return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }

/** Satellite base map with grading, dim and borders. */
export async function baseMap(g, cam, { layers = ['bluemarble'], dim = 0.28, borders = 0.32, tint = '#07101f', borderWidth = 1.2 } = {}) {
  const ctx = g.ctx;
  ctx.fillStyle = '#0a1a33'; ctx.fillRect(0, 0, W, H);
  await drawImagery(ctx, cam, layers.map((l) => (l === 's2' ? { src: 's2', comp: 'lighten' } : l)));
  if (dim > 0) { ctx.fillStyle = rgba(tint, dim); ctx.fillRect(0, 0, W, H); }
  if (borders > 0) for (const c of g.countries.list) drawCountry(ctx, cam, c, { stroke: '#ffffff', width: borderWidth, strokeAlpha: borders });
  g.creditText = credits(layers);
}

export function hl(g, cam, id, color, a = 1, o) { drawHighlight(g.ctx, cam, g.countries.get(id), color, a, o); }
export function conquer(g, cam, id, color, origin, p, o) { drawConquest(g.ctx, cam, g.countries.get(id), color, origin, p, o); }
export function fill(g, cam, id, color, a = 0.6) { drawCountry(g.ctx, cam, g.countries.get(id), { fill: color, fillAlpha: a }); }
export function outline(g, cam, id, color = '#fff', w = 2.5, a = 1) { drawCountry(g.ctx, cam, g.countries.get(id), { stroke: color, width: w, strokeAlpha: a }); }

/** Globe shot with stars and optional highlighted countries. items: [{id, color, a}] */
export function globeShot(g, view, items = [], { stars = 1, borders = 0.22, night = 0 } = {}) {
  drawStars(g.ctx, 7, stars);
  drawGlobe(g.ctx, { ...view, night });
  drawGlobeCountries(g.ctx, view, g.countries, { borders, items: items.map((it) => ({ c: g.countries.get(it.id) || it.c, fill: it.color, alpha: it.a ?? 1, fillAlpha: it.fillAlpha ?? 0.55 })) });
  g.creditText = 'NASA Blue Marble';
}

/** Preload flags into g.flags by 2-letter code. */
export async function loadFlags(g, codes) {
  g.flags = g.flags || {};
  for (const c of codes) g.flags[c] = await flag(c);
}
export function flagAt(g, code, x, y, h, a = 1, wave = 0) { return drawFlag(g.ctx, g.flags[code], x, y, h, { a, wave, t: g.T }); }

/** Country label at its label point. */
export function countryLabel(g, cam, id, str, a = 1, { size = 40, color = '#fff', dy = 0 } = {}) {
  const c = g.countries.get(id); if (!c) return;
  const [x, y] = cam.toScreen(c.label[0], c.label[1]);
  label(g.ctx, str ?? c.name.toUpperCase(), x, y + dy, { size, color, a });
}

export function pulseAt(g, cam, lon, lat, r, color, a = 1) { const [x, y] = cam.toScreen(lon, lat); pulse(g.ctx, x, y, r, g.T, color, a); }

/** Big centred number / title. */
export function bigText(g, str, y, a = 1, { size = 150, color = '#fff', font = 'Anton', stroke = 16, sub = '', subColor = '#ffe14d' } = {}) {
  if (a <= 0) return;
  const k = 0.85 + 0.15 * ease.outBack(clamp(a));
  const ctx = g.ctx; ctx.save(); ctx.translate(W / 2, y); ctx.scale(k, k);
  text(ctx, str, 0, 0, { font, size, color, stroke, alpha: a, shadow: 20, maxW: W - 80 });
  if (sub) text(ctx, sub, 0, size * 0.72, { font: 'MontBlack', size: size * 0.3, color: subColor, stroke: 8, alpha: a, maxW: W - 100 });
  ctx.restore();
}

export function fadeBlack(g, a) { if (a > 0) { g.ctx.fillStyle = `rgba(0,0,0,${clamp(a)})`; g.ctx.fillRect(0, 0, W, H); } }
export function whiteFlash(g, a) { if (a > 0) { g.ctx.fillStyle = `rgba(255,255,255,${clamp(a)})`; g.ctx.fillRect(0, 0, W, H); } }

/** Pill tag (e.g. "UN", "NATO") */
export function tag(g, str, x, y, { a = 1, bg = '#1f6feb', color = '#fff', size = 42, font = 'MontBlack' } = {}) {
  if (a <= 0) return;
  const ctx = g.ctx; ctx.save(); ctx.globalAlpha = a; ctx.font = `${size}px ${font}`;
  const w = ctx.measureText(str).width + size * 1.1, h = size * 1.55;
  const k = 0.8 + 0.2 * ease.outBack(clamp(a));
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
  text(ctx, str, 0, 2, { font, size, color });
  ctx.restore();
}

export { text, headline, label, drawFlag };

// ---------- voice loudness envelope (for lip-flap) ----------
import { execFileSync } from 'node:child_process';
import path from 'node:path';
export function loadEnvelope(g, fps = 30) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(g.vdir, 'audio/voice.wav'), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1 << 28 });
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  const hop = Math.floor(16000 / fps), out = [];
  for (let i = 0; i + hop <= s.length; i += hop) { let a = 0; for (let j = i; j < i + hop; j++) a += (s[j] / 32768) ** 2; out.push(Math.sqrt(a / hop)); }
  const mx = Math.max(...out) || 1;
  g.env = out.map((v) => v / mx);
  g.amp = (T) => g.env[Math.max(0, Math.min(g.env.length - 1, Math.round(T * fps)))] || 0;
}

// ---------- geometry helpers ----------
import { moveGeometry, geomScreenPath } from './geo.mjs';
/** largest polygon of a (Multi)Polygon, as a Polygon */
export function mainPolygon(geom) {
  if (geom.type === 'Polygon') return geom;
  let best = null, n = -1;
  for (const p of geom.coordinates) if (p[0].length > n) { n = p[0].length; best = p; }
  return { type: 'Polygon', coordinates: best };
}
/** draw a geometry moved on the sphere from `from` to `to` (true-size preserving) */
export function drawMoved(g, cam, geom, from, to, { fill = '#2f7bff', alpha = 0.7, stroke = '#fff', width = 3, glow = 18, a = 1, roll = 0 } = {}) {
  if (a <= 0) return;
  const p = geomScreenPath(moveGeometry(geom, from, to, roll), cam);
  const ctx = g.ctx; ctx.save(); ctx.globalAlpha = a * alpha; ctx.shadowColor = fill; ctx.shadowBlur = glow; ctx.fillStyle = fill; ctx.fill(p, 'evenodd');
  ctx.shadowBlur = 0; ctx.globalAlpha = a; ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(p); ctx.restore();
  return p;
}
export function centroidOf(geom) {
  const ring = mainPolygon(geom).coordinates[0];
  let x = 0, y = 0; for (const [a, b] of ring) { x += a; y += b; } return [x / ring.length, y / ring.length];
}
export { moveGeometry, geomScreenPath };
