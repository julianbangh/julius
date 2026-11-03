// Geo Studio terrain: real elevation/bathymetry (Terrarium tiles) for sea-level change maps.
import { W, H, createCanvas, clamp } from './core.mjs';
import { drawLayer } from './tiles.mjs';

const E = createCanvas(W, H), O = createCanvas(W, H);
let elev = null;

/**
 * Paint land exposed by a sea-level drop of `drop` metres (positive number) over the current frame.
 * Must be called after the satellite base map is drawn on ctx (used to tell ocean from land).
 */
export async function drawSeaDrop(ctx, cam, drop, { shore = '#f2e3b3', deep = '#b79d6a', shallow = '#6f8f4e', a = 1 } = {}) {
  if (drop <= 0.2 || a <= 0) return 0;
  const e = E.getContext('2d');
  e.setTransform(1, 0, 0, 1, 0, 0); e.clearRect(0, 0, W, H);
  e.setTransform(1, 0, 0, 1, cam.cx, cam.cy);
  await drawLayer(e, 'terrain', cam.zoom, cam.wx, cam.wy, [-cam.cx - 2, -cam.cy - 2, W - cam.cx + 2, H - cam.cy + 2], { smooth: false, detail: 0.6 });
  const ed = e.getImageData(0, 0, W, H).data;
  const base = ctx.getImageData(0, 0, W, H).data;
  if (!elev) elev = new Float32Array(W * H);
  for (let i = 0, j = 0; i < ed.length; i += 4, j++) elev[j] = ed[i + 3] ? ed[i] * 256 + ed[i + 1] + ed[i + 2] / 256 - 32768 : 9999;
  const o = O.getContext('2d');
  const img = o.createImageData(W, H), d = img.data;
  const sh = hex(shore), dp = hex(deep), sl = hex(shallow);
  let exposed = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x, v = elev[j];
    if (v >= 0 || v < -drop) continue;
    const i = j * 4;
    const R = base[i], G = base[i + 1], B = base[i + 2];
    if (!(B > R + 8 && B >= G - 6)) continue; // only where the map shows water
    exposed++;
    const f = clamp(-v / drop); // 0 = old coast, 1 = new shoreline
    let r, g, b;
    if (f > 0.9) { const k = (f - 0.9) / 0.1; r = dp[0] + (sh[0] - dp[0]) * k; g = dp[1] + (sh[1] - dp[1]) * k; b = dp[2] + (sh[2] - dp[2]) * k; }
    else { const k = f / 0.9; r = sl[0] + (dp[0] - sl[0]) * k; g = sl[1] + (dp[1] - sl[1]) * k; b = sl[2] + (dp[2] - sl[2]) * k; }
    const gx = elev[j + 1] - elev[j - 1], gy = elev[j + W] - elev[j - W];
    const shade = clamp(1 + (-gx - gy) * 0.012 * Math.min(1, 2 ** (cam.zoom - 5)), 0.65, 1.3);
    d[i] = r * shade; d[i + 1] = g * shade; d[i + 2] = b * shade; d[i + 3] = 255 * a;
  }
  o.putImageData(img, 0, 0);
  ctx.save(); ctx.drawImage(O, 0, 0); ctx.restore();
  return exposed;
}
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
