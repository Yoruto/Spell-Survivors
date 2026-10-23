// Telegraphs read the same locked geometry that the simulation resolves.
export function drawEnemyIntent(r, e) {
  if (e.hp <= 0 || e.air > 0) return;
  const b = e.brain, a = b?.action, c = r.ctx;
  if (!b) return;
  c.save();
  if (a?.kind === 'charge' && b.state === 'windup') {
    const { origin: p, end, dir, radius } = a, nx = -dir.y * radius, ny = dir.x * radius;
    c.beginPath(); c.moveTo(p.x + nx, p.y + ny); c.lineTo(end.x + nx, end.y + ny);
    c.lineTo(end.x - nx, end.y - ny); c.lineTo(p.x - nx, p.y - ny); c.closePath();
    c.fillStyle = '#f18b4428'; c.fill(); c.strokeStyle = '#ffb16bc9'; c.lineWidth = 2; c.stroke();
    c.setLineDash([8, 7]); r.line(p.x, p.y, end.x, end.y, '#ffd19a99', 2); c.setLineDash([]);
    const x = p.x + (end.x - p.x) * (1 - a.left / a.duration), y = p.y + (end.y - p.y) * (1 - a.left / a.duration);
    r.line(x - dir.x * 12 - nx * .4, y - dir.y * 12 - ny * .4, x, y, '#ffe1a8', 3);
    r.line(x - dir.x * 12 + nx * .4, y - dir.y * 12 + ny * .4, x, y, '#ffe1a8', 3);
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd19a'; c.fillText('蓄力突击', e.x, e.y - 52);
  } else if (a?.kind === 'melee') {
    const angle = Math.atan2(a.dir.y, a.dir.x), p = a.origin;
    c.beginPath(); c.moveTo(p.x, p.y); c.arc(p.x, p.y, a.range, angle - .85, angle + .85); c.closePath();
    c.fillStyle = '#edab5220'; c.fill(); c.strokeStyle = '#edbd7d99'; c.lineWidth = 1.5; c.stroke();
  } else if (a?.kind === 'bolt') {
    r.circle(e.x, e.y, 22 + 8 * (1 - a.left / a.duration), null, '#efaa9c99', 1.5);
    r.line(e.x, e.y, e.x + a.dir.x * 85, e.y + a.dir.y * 85, '#f4c0a377', 2);
  } else if (a?.kind === 'recharge') {
    r.circle(e.x, e.y, 25, '#ad90ed18', '#c3a7ff99', 1.5);
    c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d7c5ff'; c.fillText('回能', e.x, e.y - 50);
  } else if (b.state === 'charge') {
    r.line(e.x - a.dir.x * 35, e.y - a.dir.y * 35, e.x, e.y, '#ffc58bbb', 5);
  } else if (b.state === 'recover' && e.kind === 'charger') {
    c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d5cfac'; c.fillText('收招', e.x, e.y - 50);
  }
  c.restore();
}
