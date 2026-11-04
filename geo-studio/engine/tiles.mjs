// Geo Studio satellite imagery: layered XYZ / ArcGIS-export sources with disk + memory caches.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadImage, createCanvas } from './core.mjs';
import { TILE, worldSize } from './geo.mjs';

const ORIGIN = 20037508.342789244;
function tileBBox3857(z, x, y) {
  const span = (2 * ORIGIN) / 2 ** z;
  return [-ORIGIN + x * span, ORIGIN - (y + 1) * span, -ORIGIN + (x + 1) * span, ORIGIN - y * span];
}
const arcExport = (base, kind, px = 256, fmt = 'jpg') => (z, x, y) => {
  const b = tileBBox3857(z, x, y).map((v) => v.toFixed(3)).join(',');
  const op = kind === 'image' ? 'exportImage' : 'export';
  const f = fmt === 'png' ? 'png32&transparent=true' : fmt;
  return `${base}/${op}?bbox=${b}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=${f}&f=image`;
};

/** Public / openly licensed imagery only. */
export const SOURCES = {
  bluemarble: {
    url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`,
    maxZ: 8, credit: 'NASA Blue Marble',
  },
  blackmarble: {
    url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`,
    maxZ: 8, credit: 'NASA Black Marble',
  },
  s2: {
    url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
    maxZ: 15, minZ: 3, credit: 'Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)',
  },
  usgs: {
    url: (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`,
    maxZ: 16, minZ: 6, credit: 'USGS The National Map',
  },
  naip: {
    url: arcExport('https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer', 'image', 1024),
    res: 4, maxZ: 16, minZ: 10, credit: 'USGS NAIP',
  },
  terrain: {
    url: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    maxZ: 9, credit: 'Elevation: AWS Terrain Tiles (SRTM, GEBCO, ETOPO1)',
  },
  nys: {
    url: arcExport('https://orthos.its.ny.gov/arcgis/rest/services/wms/Latest/MapServer', 'map', 1024, 'png'),
    res: 4, maxZ: 17, minZ: 10, credit: 'NYS ITS Geospatial Services orthoimagery',
    bounds: [-79.8, 40.49, -71.8, 45.02],
  },
};

const CACHE = path.join(ROOT, '.cache/tiles');
const mem = new Map(); // key -> Image | null (miss)
const pending = new Map();
const MEM_MAX = 3000;

function key(src, z, x, y) { return `${src}/${z}/${x}/${y}`; }
function file(src, z, x, y) { return path.join(CACHE, src, String(z), String(x), `${y}.img`); }

async function fetchTile(src, z, x, y) {
  const f = file(src, z, x, y);
  if (fs.existsSync(f)) return fs.statSync(f).size > 0 ? fs.readFileSync(f) : null;
  if (fs.existsSync(f + '.miss')) return null;
  const s = SOURCES[src];
  const url = s.url(z, x, y);
  let buf = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'GeoStudio/1.0 (video renderer)' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404 || res.status === 400) break;
      if (!res.ok) { await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); continue; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image')) break;
      buf = Buffer.from(await res.arrayBuffer());
      break;
    } catch { await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); }
  }
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (buf && buf.length > 200) { fs.writeFileSync(f, buf); return buf; }
  fs.writeFileSync(f + '.miss', '');
  return null;
}

async function getTile(src, z, x, y) {
  const k = key(src, z, x, y);
  if (mem.has(k)) { const v = mem.get(k); mem.delete(k); mem.set(k, v); return v; }
  if (pending.has(k)) return pending.get(k);
  const pr = (async () => {
    let img = null;
    try { const buf = await fetchTile(src, z, x, y); if (buf) img = await loadImage(buf); } catch { img = null; }
    mem.set(k, img); pending.delete(k);
    if (mem.size > MEM_MAX) { const first = mem.keys().next().value; mem.delete(first); }
    return img;
  })();
  pending.set(k, pr);
  return pr;
}

let inflight = 0; const queue = [];
function limited(fn) {
  return new Promise((resolve) => {
    const run = async () => { inflight++; try { resolve(await fn()); } finally { inflight--; if (queue.length) queue.shift()(); } };
    if (inflight < 16) run(); else queue.push(run);
  });
}

/**
 * Draw one imagery layer. The ctx transform must map "local world px at zoom `zoom`,
 * relative to (wx, wy)" to the destination. `view` is the local-px rect to cover: [x0,y0,x1,y1].
 * Returns true if every tile at the chosen level was present.
 */
export async function drawLayer(ctx, srcName, zoom, wx, wy, view, { alpha = 1, detail = 0.35, maxTiles = 260, lod = 0, comp = null, smooth = true } = {}) {
  const s = SOURCES[srcName];
  const res = s.res || 1;
  let zi = Math.min(s.maxZ, Math.max(s.minZ ?? 0, Math.ceil(zoom + lod - Math.log2(res) - detail)));
  if (zoom + lod - Math.log2(res) < (s.minZ ?? 0) - 1.5) return false;
  let scale = 2 ** (zoom - zi);
  let ts = TILE * scale;
  const n = 2 ** zi;
  let tx0 = Math.floor((wx + view[0]) / ts), tx1 = Math.floor((wx + view[2]) / ts);
  let ty0 = Math.max(0, Math.floor((wy + view[1]) / ts)), ty1 = Math.min(n - 1, Math.floor((wy + view[3]) / ts));
  while ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > maxTiles && zi > 0) {
    zi--; scale = 2 ** (zoom - zi); ts = TILE * scale;
    tx0 = Math.floor((wx + view[0]) / ts); tx1 = Math.floor((wx + view[2]) / ts);
    ty0 = Math.max(0, Math.floor((wy + view[1]) / ts)); ty1 = Math.min(2 ** zi - 1, Math.floor((wy + view[3]) / ts));
  }
  const nn = 2 ** zi;
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const x = ((tx % nn) + nn) % nn;
    if (s.bounds) {
      const lon0 = (x / nn) * 360 - 180, lon1 = ((x + 1) / nn) * 360 - 180;
      const latOf = (yy) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / nn)));
      const la1 = latOf(ty), la0 = latOf(ty + 1);
      if (lon1 < s.bounds[0] || lon0 > s.bounds[2] || la1 < s.bounds[1] || la0 > s.bounds[3]) continue;
    }
    jobs.push(limited(() => getTile(srcName, zi, x, ty)).then((img) => ({ img, tx, ty, x })));
  }
  const tiles = await Promise.all(jobs);
  let complete = tiles.length > 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (comp) ctx.globalCompositeOperation = comp;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  for (const t of tiles) {
    const dx = t.tx * ts - wx, dy = t.ty * ts - wy;
    if (t.img) { ctx.drawImage(t.img, dx - 0.35, dy - 0.35, ts + 0.7, ts + 0.7); continue; }
    complete = false;
    // fall back to an ancestor tile
    for (let up = 1; up <= 5 && zi - up >= (s.minZ ?? 0); up++) {
      const pz = zi - up, f = 2 ** up;
      const px = Math.floor(t.x / f), py = Math.floor(t.ty / f);
      const k = key(srcName, pz, px, py);
      let img = mem.get(k);
      if (img === undefined) img = await getTile(srcName, pz, px, py);
      if (img) {
        const sub = img.width / f;
        ctx.drawImage(img, (t.x % f) * sub, (t.ty % f) * sub, sub, sub, dx - 0.35, dy - 0.35, ts + 0.7, ts + 0.7);
        break;
      }
    }
  }
  ctx.restore();
  return complete;
}

/** Draw a stack of layers (low-res first) for a flat camera. */
export async function drawImagery(ctx, cam, layers = ['bluemarble'], opts = {}) {
  ctx.save();
  if (cam.rot) {
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    ctx.setTransform(c, s, -s, c, cam.cx, cam.cy);
  } else ctx.setTransform(1, 0, 0, 1, cam.cx, cam.cy);
  const r = Math.hypot(cam.w, cam.h) / 2 + 4;
  const view = cam.rot ? [-r, -r, r, r] : [-cam.cx - 2, -cam.cy - 2, cam.w - cam.cx + 2, cam.h - cam.cy + 2];
  for (const L of layers) {
    const name = typeof L === 'string' ? L : L.src;
    const o = typeof L === 'string' ? {} : L;
    await drawLayer(ctx, name, cam.zoom, cam.wx, cam.wy, view, { ...opts, ...o });
  }
  ctx.restore();
}

export function credits(layers) {
  return [...new Set(layers.map((l) => SOURCES[typeof l === 'string' ? l : l.src].credit))].join(' · ');
}

// ---------- equirectangular textures for the globe ----------
export async function equirectTexture(layer = 'BlueMarble_ShadedRelief_Bathymetry', date = '2004-08-01', ext = 'jpeg', level = 3) {
  const cols = { 2: 5, 3: 10, 4: 20 }[level], rows = { 2: 3, 3: 5, 4: 10 }[level];
  const tile = 512;
  const out = path.join(ROOT, `.cache/tex/${layer}_${level}.png`);
  if (fs.existsSync(out)) return loadImage(fs.readFileSync(out));
  const cv = createCanvas(cols * tile, rows * tile);
  const cx = cv.getContext('2d');
  const jobs = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer}/default/${date}/500m/${level}/${y}/${x}.${ext}`;
    jobs.push(limited(async () => {
      for (let a = 0; a < 3; a++) {
        try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return { x, y, img: await loadImage(Buffer.from(await r.arrayBuffer())) }; } catch {}
      }
      return { x, y, img: null };
    }));
  }
  for (const t of await Promise.all(jobs)) if (t.img) cx.drawImage(t.img, t.x * tile, t.y * tile);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  return cv;
}
