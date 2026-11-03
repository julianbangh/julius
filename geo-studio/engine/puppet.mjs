// Geo Studio cutout puppet: a photo head (cut by scripts/cut_portrait.py) with a hinged jaw,
// on a drawn construction-paper body, slamming a big red button on a desk (seen head-on).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, createCanvas, loadImage, clamp, ease, lerp } from './core.mjs';

function silhouette(img, color = '#111') {
  const c = createCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function loadPuppet(name = 'trump') {
  const base = path.join(ROOT, 'assets/people', name);
  const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
  const head = await loadImage(fs.readFileSync(base + '_head.png'));
  const jaw = await loadImage(fs.readFileSync(base + '_jaw.png'));
  // full (closed-mouth) face for when the jaw is shut: no visible seam
  const [hx0, hy0, hw, hh] = meta.head, [jx0, jy0, jw, jh] = meta.jaw;
  const x0 = Math.min(hx0, jx0), y0 = Math.min(hy0, jy0), x1 = Math.max(hx0 + hw, jx0 + jw), y1 = Math.max(hy0 + hh, jy0 + jh);
  const full = createCanvas(x1 - x0, y1 - y0), fx = full.getContext('2d');
  fx.drawImage(head, hx0 - x0, hy0 - y0); fx.globalCompositeOperation = 'lighter'; fx.drawImage(jaw, jx0 - x0, jy0 - y0);
  return { meta, head, jaw, full, fullXY: [x0, y0], headS: silhouette(head), jawS: silhouette(jaw), fullS: silhouette(full) };
}

const SUIT = '#1c2b52', SUIT_D = '#121d3a', SHIRT = '#f4f4f0', TIE = '#d0202a', SKIN = '#f0b58c', SKIN_D = '#c98962';
const WOOD = '#8a5530', WOOD_D = '#5e3519', WOOD_L = '#b9784a';

function fist(ctx, x, y, r, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = SHIRT; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(-r * 0.75, r * 0.55, r * 1.5, r * 0.55, 8); ctx.fill(); ctx.stroke(); // cuff
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.42, -r * 0.75); ctx.lineTo(i * r * 0.42, -r * 0.2); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(-r * 0.78, r * 0.05, r * 0.32, r * 0.48, 0.4, 0, Math.PI * 2); ctx.fillStyle = SKIN; ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5; ctx.stroke(); // thumb
  ctx.restore();
}

function arm(ctx, sx, sy, hx, hy, bend = 1) {
  const mx = (sx + hx) / 2 + bend * (hy - sy) * 0.18, my = (sy + hy) / 2 - bend * (hx - sx) * 0.18 + 30;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0b1226'; ctx.lineWidth = 104;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
  ctx.strokeStyle = SUIT; ctx.lineWidth = 92;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
  ctx.restore();
}

/**
 * Draw the puppet. (x, y) = centre of the desk top on screen, s = scale (desk = 760*s wide).
 * st: { t, pop (0..1), slam (0..1), talk (0..1), anger (0..1), press (0..1 button depression) }
 */
export function drawPuppet(ctx, P, x, y, s, st = {}) {
  const { t = 0, pop = 1, slam = 0, talk = 0, press = 0 } = st;
  if (pop <= 0) return;
  const k = ease.outBack(clamp(pop), 2.2);
  ctx.save();
  ctx.translate(x, y + (1 - k) * 240 * s);
  ctx.scale(s * k, s * k);
  const bob = Math.sin(t * 4.2) * 6 + (slam > 0.6 && slam < 0.9 ? 14 : 0);
  // ---- body (behind desk)
  ctx.save(); ctx.translate(0, bob * 0.5);
  ctx.fillStyle = SUIT; ctx.strokeStyle = '#0b1226'; ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-300, 40); ctx.lineTo(-290, -330); ctx.quadraticCurveTo(-280, -420, -170, -440); ctx.lineTo(170, -440);
  ctx.quadraticCurveTo(280, -420, 290, -330); ctx.lineTo(300, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
  // shirt V + tie
  ctx.fillStyle = SHIRT; ctx.beginPath(); ctx.moveTo(-95, -445); ctx.lineTo(95, -445); ctx.lineTo(0, -170); ctx.closePath(); ctx.fill();
  ctx.fillStyle = SUIT_D; ctx.beginPath(); ctx.moveTo(-95, -445); ctx.lineTo(-30, -250); ctx.lineTo(-140, -330); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(95, -445); ctx.lineTo(30, -250); ctx.lineTo(140, -330); ctx.closePath(); ctx.fill();
  ctx.fillStyle = TIE; ctx.strokeStyle = '#7a0d12'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-26, -440); ctx.lineTo(26, -440); ctx.lineTo(16, -400); ctx.lineTo(-16, -400); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-16, -400); ctx.lineTo(16, -400); ctx.lineTo(34, -120); ctx.lineTo(0, -80); ctx.lineTo(-34, -120); ctx.closePath(); ctx.fill(); ctx.stroke();
  // flag pin
  ctx.fillStyle = '#c8102e'; ctx.fillRect(170, -360, 30, 20); ctx.fillStyle = '#0a3161'; ctx.fillRect(170, -360, 12, 10);
  ctx.restore();

  // ---- head + jaw
  const m = P.meta, hk = 0.49;
  const chin = m.chin, [hx0, hy0, hw, hh] = m.head, [jx0, jy0, jw, jh] = m.jaw;
  const jawDrop = Math.max(0, talk - 0.18) * 40 + (slam > 0.55 && slam < 0.95 ? 26 : 0);
  ctx.save();
  ctx.translate(0, -400 + bob);
  ctx.rotate(Math.sin(t * 2.3) * 0.035 + (slam > 0.6 && slam < 0.9 ? 0.06 : 0));
  ctx.scale(hk, hk);
  ctx.translate(-chin[0], -chin[1]);
  // mouth interior
  if (jawDrop > 1) {
    const mp = m.mouth.slice(1, -1);
    const dd = jawDrop / hk;
    ctx.fillStyle = '#2a0606';
    ctx.beginPath(); mp.forEach(([px, py], i) => (i ? ctx.lineTo(px, py - 4) : ctx.moveTo(px, py - 4)));
    for (let i = mp.length - 1; i >= 0; i--) { const k = Math.sin((i / (mp.length - 1)) * Math.PI); ctx.lineTo(mp[i][0], mp[i][1] + dd * (0.55 + 0.45 * k) + 6); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(m.mouthCenter[0], m.mouthCenter[1] + jawDrop / hk * 0.75, 120, 26, 0, 0, Math.PI * 2); ctx.fill();
  }
  const o = 6; // outline thickness (image px)
  const offs = [[o, 0], [-o, 0], [0, o], [0, -o], [o * 0.7, o * 0.7], [-o * 0.7, o * 0.7], [o * 0.7, -o * 0.7], [-o * 0.7, -o * 0.7]];
  if (jawDrop < 4) {
    const [fx0, fy0] = P.fullXY;
    for (const [dx, dy] of offs) ctx.drawImage(P.fullS, fx0 + dx, fy0 + dy);
    ctx.drawImage(P.full, fx0, fy0);
  } else {
    for (const [dx, dy] of offs) { if (dy <= 0) ctx.drawImage(P.headS, hx0 + dx, hy0 + dy); if (dy >= 0) ctx.drawImage(P.jawS, jx0 + dx, jy0 + jawDrop / hk + dy); }
    ctx.drawImage(P.head, hx0, hy0);
    ctx.drawImage(P.jaw, jx0, jy0 + jawDrop / hk);
  }
  ctx.restore();

  // ---- desk
  ctx.save();
  const g = ctx.createLinearGradient(0, -10, 0, 300);
  g.addColorStop(0, WOOD_L); g.addColorStop(0.12, WOOD); g.addColorStop(1, WOOD_D);
  ctx.fillStyle = g; ctx.strokeStyle = '#2b170a'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(-400, -24, 800, 330, [16, 16, 6, 6]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-392, 14, 784, 10);
  ctx.strokeStyle = 'rgba(255,220,180,0.25)'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-380, 60 + i * 50); ctx.bezierCurveTo(-150, 50 + i * 50 + 12, 150, 70 + i * 50 - 12, 380, 60 + i * 50); ctx.stroke(); }
  // presidential-style seal-free plaque
  ctx.fillStyle = '#d4af37'; ctx.strokeStyle = '#6b5310'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-110, 130, 220, 56, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3b2a05'; ctx.font = '34px Anton'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('THE BUTTON', 0, 159);
  ctx.restore();

  // ---- button (on desk, left of centre)
  const bx = -150, by = -22;
  ctx.save();
  ctx.fillStyle = '#222'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(bx - 120, by - 46, 240, 52, 12); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(bx - 114, by - 40, 228, 40, 8); ctx.clip();
  for (let i = -6; i < 10; i++) { ctx.fillStyle = i % 2 ? '#111' : '#f5c400'; ctx.beginPath(); ctx.moveTo(bx - 120 + i * 30, by); ctx.lineTo(bx - 100 + i * 30, by - 46); ctx.lineTo(bx - 85 + i * 30, by - 46); ctx.lineTo(bx - 105 + i * 30, by); ctx.fill(); }
  ctx.restore();
  const dh = 90 * (1 - 0.6 * press);
  const dg = ctx.createRadialGradient(bx - 30, by - 46 - dh * 0.7, 10, bx, by - 46 - dh * 0.3, 120);
  dg.addColorStop(0, '#ff8a8a'); dg.addColorStop(0.35, '#e8141c'); dg.addColorStop(1, '#7a0004');
  ctx.fillStyle = dg; ctx.strokeStyle = '#3a0002'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(bx, by - 46, 92, dh, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(bx - 36, by - 46 - dh * 0.6, 22, 12, -0.5, 0, Math.PI * 2); ctx.fill();
  if (press > 0.5) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(bx, by - 60, 0, bx, by - 60, 260); gg.addColorStop(0, `rgba(255,60,40,${0.6 * press})`); gg.addColorStop(1, 'rgba(255,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(bx - 260, by - 320, 520, 520); }
  ctx.restore();

  // ---- arms (in front of body, behind/over desk)
  // left arm (screen right) resting on desk
  arm(ctx, 250, -360 + bob * 0.5, 210, -40, -1);
  fist(ctx, 200, -40, 58, 0.2);
  // right arm (screen left) does the slam
  let hxp, hyp;
  if (slam < 0.55) { const q = ease.inOutCubic(slam / 0.55); hxp = lerp(-240, -230, q); hyp = lerp(-60, -760, q); }
  else if (slam < 0.68) { const q = ease.inCubic((slam - 0.55) / 0.13); hxp = lerp(-230, bx, q); hyp = lerp(-760, by - 150, q); }
  else { const q = ease.outQuad((slam - 0.68) / 0.32); hxp = bx; hyp = lerp(by - 150, by - 150 - 40 * q, q * 0.4); }
  arm(ctx, -250, -360 + bob * 0.5, hxp, hyp, 1);
  fist(ctx, hxp, hyp, 66, slam > 0.55 ? 0 : -0.3);
  ctx.restore();
}
