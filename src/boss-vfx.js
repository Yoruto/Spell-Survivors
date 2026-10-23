import { TIMBER_ANCHORS } from './bosses.js';
const TAU = Math.PI * 2;

// Drawn in world coordinates. Telegraph geometry matches the combat hit areas.
export class BossVFX {
  constructor(renderer) { this.r = renderer; this.c = renderer.ctx; }
  blade(x, y, radius, time) {
    const c = this.c, r = this.r;
    c.save(); c.translate(x, y); c.rotate(time * 8);
    c.beginPath();
    for (let i = 0; i < 48; i++) {
      const a = i * TAU / 48, rad = radius * (i % 3 === 0 ? 1 : .8);
      if (!i) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath(); c.fillStyle = '#8e989c'; c.fill(); c.strokeStyle = '#f4d6a3'; c.lineWidth = 2; c.stroke();
    r.circle(0, 0, radius * .55, '#4c4441', '#e7a75e', 2); r.circle(0, 0, radius * .2, '#ffc777', '#ffe9ae', 2);
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; r.line(Math.cos(a) * radius * .24, Math.sin(a) * radius * .24, Math.cos(a) * radius * .5, Math.sin(a) * radius * .5, '#d6b485', 3); }
    c.restore();
  }
  anchors() {
    if (!this.r.game.enemies.some(e => e.bossType === 'timber' && e.hp > 0)) return;
    for (const a of TIMBER_ANCHORS) {
      this.r.circle(a.x, a.y, 20, '#332d27', '#9b825b', 3);
      this.r.circle(a.x, a.y, 10, '#5a6264', '#f3bf6c', 2);
      this.r.line(a.x - 8, a.y, a.x + 8, a.y, '#f0c58b', 3);
    }
  }
  line(a, b, radius, progress, label) {
    const c = this.c, r = this.r;
    c.save(); c.lineCap = 'round';
    r.line(a.x, a.y, b.x, b.y, '#ffad4e22', radius * 2);
    c.setLineDash([12, 9]); r.line(a.x, a.y, b.x, b.y, '#ffd397', 2); c.setLineDash([]);
    r.circle(b.x, b.y, 22, '#d99c4b33', '#ffd397', 2);
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffdc9e';
    c.fillText(label, a.x + (b.x - a.x) * .35, a.y + (b.y - a.y) * .35 - 20);
    r.circle(b.x, b.y, 8 + progress * 12, null, '#fff0c8', 2); c.restore();
  }
  effect(f) {
    if (!f.kind.startsWith('boss-')) return false;
    const c = this.c, r = this.r;
    c.save();
    if (f.kind === 'boss-zone') {
      const charge = Math.min(1, f.age / f.delay), active = f.age >= f.delay, color = f.style === 'timber' ? '#ffbf66' : '#ff796b';
      if (!active) {
        r.circle(f.x, f.y, f.radius, color + '1c', color, 2);
        r.circle(f.x, f.y, f.radius * charge, color + '16');
        c.beginPath(); c.arc(f.x, f.y, f.radius, -Math.PI / 2, -Math.PI / 2 + charge * TAU); c.lineWidth = 5; c.strokeStyle = '#ffe2b0'; c.stroke();
        c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe2b0'; c.fillText(f.label, f.x, f.y - f.radius - 10);
        if (f.style === 'timber') this.blade(f.x, f.y, 20, f.age);
        else { r.line(f.x - 16, f.y - 16, f.x + 16, f.y + 16, color, 3); r.line(f.x + 16, f.y - 16, f.x - 16, f.y + 16, color, 3); }
      } else {
        c.globalAlpha = Math.max(0, 1 - (f.age - f.delay) / .45);
        r.circle(f.x, f.y, f.radius, color + '38', color, 3);
        if (f.label.includes('旋')) { c.beginPath(); c.arc(f.x, f.y, f.radius * .8, f.age * 15, f.age * 15 + 5); c.strokeStyle = '#ffe4bb'; c.lineWidth = 7; c.stroke(); }
        else { r.line(f.x - f.radius * .7, f.y - 25, f.x + f.radius * .7, f.y + 25, '#fff0cb', 5); }
      }
    } else if (f.kind === 'boss-line') {
      if (f.age < f.delay) this.line(f, { x: f.tx, y: f.ty }, f.radius, f.age / f.delay, f.label);
      else {
        const owner = r.game.enemies.find(e => e.id === f.owner);
        if (owner?.ai.action?.kind === 'chain') r.line(owner.x, owner.y - 15, f.tx, f.ty, '#d1bd9b', 5);
      }
    } else if (f.kind === 'boss-saw') {
      if (['stay', 'warning'].includes(f.stage)) {
        r.circle(f.x, f.y, 100, '#e9a34b25', '#f9c778', 2);
        r.circle(f.x, f.y, 70 + Math.sin(r.game.time * 6) * 6, null, '#ffe1a266', 2);
      }
      if (f.stage === 'warning') this.line(f, f.returnPoint, 22, 1 - f.warning / .8, '飞轮回收');
      this.blade(f.x, f.y, f.stage === 'stay' ? 52 : 26, r.game.time);
    } else if (f.kind === 'boss-hunger') {
      r.circle(f.x, f.y, 28, '#da594322', '#ff9977', 2);
      for (let i = 0; i < 3; i++) r.diamond(f.x - 13 + i * 13, f.y - 65, 5, '#ff9b78');
    } else if (f.kind === 'boss-phase') {
      c.globalAlpha = Math.max(0, 1 - f.age / f.duration);
      r.circle(f.x, f.y, f.radius * f.age / f.duration, null, '#ffba75', 5);
    }
    c.restore(); return true;
  }
}
