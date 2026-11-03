// Geo Studio geography: Web Mercator camera, countries, true-size reprojection.
import fs from 'node:fs';
import path from 'node:path';
import { geoRotation } from 'd3-geo';
import { ROOT, Path2D, W, H, rgba, deg } from './core.mjs';

export const TILE = 256;
const MAXLAT = 85.05112878;

export function worldSize(z) { return TILE * 2 ** z; }
export function lonLatToWorld(lon, lat, z) {
  const s = worldSize(z);
  const la = Math.max(-MAXLAT, Math.min(MAXLAT, lat)) * deg;
  return [((lon + 180) / 360) * s, (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * s];
}
export function worldToLonLat(x, y, z) {
  const s = worldSize(z);
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return [lon, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
}
/** metres per pixel at latitude for zoom z */
export function mpp(lat, z) { return (40075016.686 * Math.cos(lat * deg)) / worldSize(z); }
/** zoom so that `km` spans `px` pixels at latitude */
export function zoomFor(km, px, lat) { return Math.log2((40075016.686 * Math.cos(lat * deg) * px) / (km * 1000 * TILE)); }
export function haversineKm(a, b) {
  const R = 6371, dLat = (b[1] - a[1]) * deg, dLon = (b[0] - a[0]) * deg;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * deg) * Math.cos(b[1] * deg) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Flat top-down Web Mercator camera. */
export class Camera {
  constructor({ lon = 0, lat = 0, zoom = 2, rot = 0, cx = W / 2, cy = H / 2, w = W, h = H } = {}) {
    Object.assign(this, { lon, lat, zoom, rot, cx, cy, w, h });
    [this.wx, this.wy] = lonLatToWorld(lon, lat, zoom);
    this.ws = worldSize(zoom);
  }
  toScreen(lon, lat) {
    let [x, y] = lonLatToWorld(lon, lat, this.zoom);
    let dx = x - this.wx;
    if (dx > this.ws / 2) dx -= this.ws; else if (dx < -this.ws / 2) dx += this.ws;
    const dy = y - this.wy;
    if (!this.rot) return [this.cx + dx, this.cy + dy];
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.cx + dx * c - dy * s, this.cy + dx * s + dy * c];
  }
  fromScreen(sx, sy) {
    let dx = sx - this.cx, dy = sy - this.cy;
    if (this.rot) { const c = Math.cos(-this.rot), s = Math.sin(-this.rot); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    return worldToLonLat(this.wx + dx, this.wy + dy, this.zoom);
  }
  /** pixels per km at the camera centre */
  pxPerKm() { return 1000 / mpp(this.lat, this.zoom); }
  /** apply a transform so that drawing in z8 world-px (relative to origin [ox,oy]) lands on screen */
  applyZ8(ctx, ox = 0, oy = 0, wrap = 0) {
    const s = 2 ** (this.zoom - 8);
    const [wx8, wy8] = [this.wx / s, this.wy / s];
    const tx = (ox - wx8 + wrap * worldSize(8)) * s, ty = (oy - wy8) * s;
    if (!this.rot) ctx.setTransform(s, 0, 0, s, this.cx + tx, this.cy + ty);
    else {
      const c = Math.cos(this.rot), si = Math.sin(this.rot);
      ctx.setTransform(s * c, s * si, -s * si, s * c, this.cx + tx * c - ty * si, this.cy + tx * si + ty * c);
    }
    return s;
  }
}

// ---------- countries ----------
const cache = {};
function buildPath(geom, ox, oy, project) {
  const p = new Path2D();
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : geom.type === 'Polygon' ? [geom.coordinates] : [];
  for (const poly of polys) for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      if (i === 0) p.moveTo(x - ox, y - oy); else p.lineTo(x - ox, y - oy);
    }
    p.closePath();
  }
  return p;
}
function bboxOf(geom) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  for (const poly of polys) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

export function loadCountries(res = '50m') {
  if (cache[res]) return cache[res];
  const gj = JSON.parse(fs.readFileSync(path.join(ROOT, `data/ne_${res}_admin_0_countries.geojson`), 'utf8'));
  const list = [];
  const z8 = (lon, lat) => lonLatToWorld(lon, lat, 8);
  for (const f of gj.features) {
    const p = f.properties;
    if (!f.geometry) continue;
    const bb = bboxOf(f.geometry);
    const [ox, oy] = z8(bb[0], bb[3]);
    const c = {
      id: p.ADM0_A3, iso3: p.ISO_A3 !== '-99' ? p.ISO_A3 : p.ADM0_A3, a2: (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2) || '',
      name: p.NAME, long: p.NAME_LONG, continent: p.CONTINENT, region: p.REGION_UN, subregion: p.SUBREGION,
      pop: p.POP_EST, gdp: p.GDP_MD, label: [p.LABEL_X, p.LABEL_Y], bbox: bb, geometry: f.geometry,
      ox, oy, path: buildPath(f.geometry, ox, oy, z8),
    };
    list.push(c);
  }
  const byId = new Map();
  for (const c of list) { byId.set(c.id, c); byId.set(c.iso3, c); byId.set(c.name.toLowerCase(), c); if (c.a2) byId.set(c.a2.toLowerCase(), c); }
  cache[res] = { list, byId, get: (k) => byId.get(k) || byId.get(String(k).toLowerCase()) };
  return cache[res];
}

/** Draw a country path onto the flat camera. style: {fill, stroke, width (screen px), alpha} */
export function drawCountry(ctx, cam, c, style = {}) {
  if (!c) return;
  ctx.save();
  for (const wrap of [-1, 0, 1]) {
    if (wrap !== 0 && cam.zoom > 3.2) continue;
    const s = cam.applyZ8(ctx, c.ox, c.oy, wrap);
    if (style.fill) { ctx.globalAlpha = style.fillAlpha ?? style.alpha ?? 1; ctx.fillStyle = style.fill; ctx.fill(c.path, 'evenodd'); }
    if (style.stroke) {
      ctx.globalAlpha = style.strokeAlpha ?? style.alpha ?? 1; ctx.strokeStyle = style.stroke; ctx.lineWidth = (style.width ?? 1.5) / s;
      ctx.lineJoin = 'round'; ctx.stroke(c.path);
    }
  }
  ctx.restore();
}

/** Glowing highlight: soft outer glow + fill + bright edge */
export function drawHighlight(ctx, cam, c, color, a = 1, { fillAlpha = 0.55, glow = 18, edge = 3 } = {}) {
  if (!c || a <= 0) return;
  ctx.save();
  ctx.shadowColor = rgba(color, 0.9 * a); ctx.shadowBlur = glow;
  drawCountry(ctx, cam, c, { fill: color, fillAlpha: fillAlpha * a });
  ctx.restore();
  drawCountry(ctx, cam, c, { stroke: '#ffffff', width: edge, strokeAlpha: 0.9 * a });
}

/** Fill country clipped to a growing circle (conquest wipe from lon/lat origin). */
export function drawConquest(ctx, cam, c, color, origin, p, { fillAlpha = 0.62, edge = 2.5 } = {}) {
  if (!c || p <= 0) return;
  const [sx, sy] = cam.toScreen(origin[0], origin[1]);
  const [x0, y0] = cam.toScreen(c.bbox[0], c.bbox[3]);
  const [x1, y1] = cam.toScreen(c.bbox[2], c.bbox[1]);
  const far = Math.max(Math.hypot(x0 - sx, y0 - sy), Math.hypot(x1 - sx, y1 - sy), Math.hypot(x0 - sx, y1 - sy), Math.hypot(x1 - sx, y0 - sy)) + 40;
  const r = p >= 1 ? 1e5 : far * p;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.1, r), 0, Math.PI * 2); ctx.clip();
  drawCountry(ctx, cam, c, { fill: color, fillAlpha });
  ctx.restore();
  if (p < 1) {
    // bright front line on the wipe edge
    ctx.save();
    const s = cam.applyZ8(ctx, c.ox, c.oy, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.restore();
  }
  drawCountry(ctx, cam, c, { stroke: '#fff', width: edge, strokeAlpha: 0.75 * Math.min(1, p * 3) });
}

// ---------- true size ----------
/** Move a geometry on the sphere so its anchor goes from `from` to `to` (shape and true size preserved). */
export function moveGeometry(geom, from, to, roll = 0) {
  const r1 = geoRotation([-from[0], -from[1], roll]);
  const r2 = geoRotation([-to[0], -to[1]]);
  const tf = (pt) => r2.invert(r1(pt));
  const mapRing = (ring) => ring.map(tf);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(mapRing) };
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map((poly) => poly.map(mapRing)) };
}
/** Path in screen px for an arbitrary geometry on a flat camera (handles dateline by unwrapping). */
export function geomScreenPath(geom, cam) {
  const p = new Path2D();
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  for (const poly of polys) for (const ring of poly) {
    let prevX = null, off = 0;
    for (let i = 0; i < ring.length; i++) {
      let [x, y] = lonLatToWorld(ring[i][0], ring[i][1], cam.zoom);
      if (prevX !== null) { const d = x + off - prevX; if (d > cam.ws / 2) off -= cam.ws; else if (d < -cam.ws / 2) off += cam.ws; }
      x += off; prevX = x;
      let dx = x - cam.wx; const dy = y - cam.wy;
      if (i === 0) { if (dx > cam.ws / 2) { off -= cam.ws; dx -= cam.ws; } else if (dx < -cam.ws / 2) { off += cam.ws; dx += cam.ws; } }
      const sx = cam.cx + dx, sy = cam.cy + dy;
      if (i === 0) p.moveTo(sx, sy); else p.lineTo(sx, sy);
    }
    p.closePath();
  }
  return p;
}

export function loadGeoJSON(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

export function screenPathFor(geom, project) {
  const p = new Path2D();
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  for (const poly of polys) for (const ring of poly) {
    ring.forEach(([lon, lat], i) => { const [x, y] = project(lon, lat); if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); });
    p.closePath();
  }
  return p;
}
