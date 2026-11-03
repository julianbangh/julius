// Geo Studio cartoon weapon illustrations (flat vector, thick outlines). drawWeapon(ctx, kind, x, y, w)
const OL = '#0d0f14';
function body(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function shine(ctx, x, y, w, h) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function capsule(ctx, x0, x1, r, fill, nose = 'round', tail = 'flat') {
  ctx.beginPath(); ctx.moveTo(x0, -r);
  ctx.lineTo(x1 - (nose === 'round' ? r : 0), -r);
  if (nose === 'round') ctx.arc(x1 - r, 0, r, -Math.PI / 2, Math.PI / 2); else if (nose === 'cone') ctx.lineTo(x1 + r * 1.6, 0), ctx.lineTo(x1, r); else ctx.lineTo(x1, r);
  ctx.lineTo(x0, r); if (tail === 'round') ctx.arc(x0, 0, r, Math.PI / 2, -Math.PI / 2); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
}
function fins(ctx, x, r, len, fill) { body(ctx, [[x, -r * 0.7], [x - len, -r * 1.9], [x - len * 1.15, -r * 1.9], [x - len * 0.7, -r * 0.5]], fill); body(ctx, [[x, r * 0.7], [x - len, r * 1.9], [x - len * 1.15, r * 1.9], [x - len * 0.7, r * 0.5]], fill); }
export function drawWeapon(ctx, kind, x, y, w, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); const k = w / 400; ctx.scale(k, k);
  ctx.lineWidth = 9; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 0;
  if (kind === 'grenade') {
    ctx.fillStyle = '#4d6b2f'; ctx.beginPath(); ctx.ellipse(0, 20, 95, 120, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-90, 20 + i * 42); ctx.lineTo(90, 20 + i * 42); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 38, -95); ctx.lineTo(i * 38, 135); ctx.stroke(); }
    ctx.strokeStyle = OL; ctx.lineWidth = 9;
    body(ctx, [[-40, -95], [40, -95], [40, -135], [-40, -135]], '#8a8f96');
    body(ctx, [[30, -130], [130, -110], [125, 40], [105, 40], [108, -95], [30, -110]], '#a9aeb5');
    ctx.beginPath(); ctx.arc(-70, -140, 34, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = '#c9a23a'; ctx.stroke();
    shine(ctx, -35, -30, 22, 40);
  } else if (kind === 'mk84') {
    fins(ctx, -150, 46, 70, '#5c6a3a'); capsule(ctx, -170, 170, 56, '#6b7a42', 'cone'); ctx.fillStyle = '#e2c341'; ctx.fillRect(110, -56, 18, 112); ctx.strokeRect(110, -56, 18, 112); shine(ctx, 0, -28, 110, 10);
  } else if (kind === 'moab') {
    capsule(ctx, -190, 175, 62, '#7d8450', 'round'); ctx.fillStyle = '#6a7044';
    for (const sy of [-1, 1]) { ctx.save(); ctx.translate(-170, sy * 95); ctx.fillRect(-30, -28, 60, 56); ctx.strokeRect(-30, -28, 60, 56); ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 15, -28); ctx.lineTo(i * 15, 28); ctx.moveTo(-30, i * 14); ctx.lineTo(30, i * 14); ctx.stroke(); } ctx.restore(); }
    ctx.fillStyle = '#e2c341'; ctx.fillRect(60, -62, 16, 124); ctx.strokeRect(60, -62, 16, 124); shine(ctx, 0, -32, 130, 10);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px MontBlack'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GBU-43', -40, 10);
  } else if (kind === 'davy') {
    ctx.fillStyle = '#5b6b3a'; ctx.fillRect(-190, -16, 170, 32); ctx.strokeRect(-190, -16, 170, 32);
    body(ctx, [[-60, -16], [-100, -60], [-110, -60], [-90, -16]], '#4a5830'); body(ctx, [[-60, 16], [-100, 60], [-110, 60], [-90, 16]], '#4a5830');
    ctx.fillStyle = '#6e7f45'; ctx.beginPath(); ctx.ellipse(70, 0, 110, 72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2c341'; ctx.beginPath(); ctx.ellipse(70, 0, 16, 72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); shine(ctx, 50, -30, 50, 12);
  } else if (kind === 'littleboy') {
    fins(ctx, -150, 52, 40, '#3f4b3a'); ctx.fillStyle = '#3f4b3a'; ctx.fillRect(-200, -70, 60, 140); ctx.strokeRect(-200, -70, 60, 140);
    capsule(ctx, -150, 190, 60, '#4a5a44', 'round'); ctx.lineWidth = 5; for (const x of [-60, 40, 120]) { ctx.beginPath(); ctx.moveTo(x, -60); ctx.lineTo(x, 60); ctx.stroke(); } shine(ctx, 20, -30, 120, 10);
  } else if (kind === 'w88') {
    body(ctx, [[-120, -70], [-120, 70], [190, 6], [196, 0], [190, -6]], '#262a33'); ctx.fillStyle = '#3c4150'; ctx.fillRect(-150, -60, 30, 120); ctx.strokeRect(-150, -60, 30, 120); shine(ctx, 20, -22, 90, 7);
  } else if (kind === 'b83') {
    fins(ctx, -140, 40, 60, '#c9ced6'); capsule(ctx, -170, 180, 44, '#e4e7ec', 'round'); ctx.fillStyle = '#d9b43a'; ctx.fillRect(20, -44, 14, 88); ctx.strokeRect(20, -44, 14, 88); shine(ctx, 20, -20, 120, 8);
  } else if (kind === 'bravo') {
    capsule(ctx, -170, 150, 80, '#a8b0bb', 'flat', 'round'); ctx.lineWidth = 6; for (const x of [-100, -30, 40, 110]) { ctx.beginPath(); ctx.moveTo(x, -80); ctx.lineTo(x, 80); ctx.stroke(); }
    ctx.strokeStyle = '#1d2430'; ctx.lineWidth = 8; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(150, -40 + i * 26); ctx.bezierCurveTo(200, -40 + i * 26, 190, 90 + i * 10, 230, 110 + i * 12); ctx.stroke(); }
    ctx.strokeStyle = OL; shine(ctx, -10, -40, 120, 12);
  } else if (kind === 'tsar') {
    fins(ctx, -150, 70, 70, '#5a6236'); ctx.fillStyle = '#5a6236'; ctx.fillRect(-210, -84, 60, 168); ctx.strokeRect(-210, -84, 60, 168);
    capsule(ctx, -160, 200, 98, '#6e7640', 'round'); ctx.lineWidth = 6; for (const x of [-80, 0, 80]) { ctx.beginPath(); ctx.moveTo(x, -98); ctx.lineTo(x, 98); ctx.stroke(); } shine(ctx, 20, -50, 140, 14);
  }
  ctx.restore();
}
