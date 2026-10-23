import { drawEnemyIntent } from './enemy-intents.js';
import { WORLD } from './config.js';
import { equipmentById } from './equipment.js';
import { SpellVFX } from './vfx.js';
import { ActorArt } from './actors.js';
import { BossVFX } from './boss-vfx.js';
import { resolveSpell, distance } from './game.js';
const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.vfx = new SpellVFX(this); this.art = new ActorArt(this);
    this.bossVfx = new BossVFX(this);
    this.width = 1; this.height = 1; this.camera = { x: 0, y: 0 }; this.mouse = { x: 800, y: 500 }; this.validMouse = false;
    this.decor = Array.from({ length: 160 }, (_, i) => { const seed = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; return { x: seed(i) * WORLD.width, y: seed(i + 333) * WORLD.height, r: 3 + seed(i + 99) * 12, variant: i % 4 }; });
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
  }
  resize() { const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); this.width = rect.width; this.height = rect.height; this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr); this.dpr = dpr; }
  point(clientX, clientY) { this.pointer = { x: clientX, y: clientY }; const r = this.canvas.getBoundingClientRect(); return { x: clientX - r.left + this.camera.x, y: clientY - r.top + this.camera.y }; }
  syncPointer() { if (this.pointer && this.validMouse) this.mouse = this.point(this.pointer.x, this.pointer.y); }
  circle(x, y, r, fill, stroke, width = 1) { const c = this.ctx; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
  line(x1, y1, x2, y2, color, width = 1) { const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
  diamond(x, y, r, color, stroke) { const c = this.ctx; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.65, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.65, y); c.closePath(); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
  render() {
    const c = this.ctx, g = this.game, p = g.player, w = this.width, h = this.height;
    this.camera.x = Math.max(0, Math.min(WORLD.width - w, p.x - w / 2)); this.camera.y = Math.max(0, Math.min(WORLD.height - h, p.y - h / 2));
    this.syncPointer();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, w, h); c.save(); c.translate(-this.camera.x, -this.camera.y);
    this.drawGround();
    this.bossVfx.anchors();
    for (const d of g.drops) { this.circle(d.x, d.y, 10, '#c4c67609'); this.diamond(d.x, d.y, d.health ? 7 : 5, d.health ? '#e28e85' : '#c3d68a', '#edf4c7'); }
    for (const f of g.effects) if (f.kind !== 'WEE') this.effect(f);
    if (p.target) { this.circle(p.target.x, p.target.y, 11, null, '#c9e4a277'); this.circle(p.target.x, p.target.y, 4, '#c9e4a266'); this.line(p.x, p.y, p.target.x, p.target.y, '#bcd79615'); }
    if (this.validMouse && g.state === 'playing') this.aim();
    for (const e of g.enemies) drawEnemyIntent(this, e);
    const actors = [...g.enemies.map(unit => ({unit,kind:'enemy'})), ...g.spirits.map(unit => ({unit,kind:'spirit'})), {unit:p,kind:'hero'}];
    for (const {unit,kind} of actors.sort((a,b) => a.unit.y-b.unit.y)) this[kind](unit);
    for (const f of g.effects) this.vfx.foreground(f);
    if (g.effects.some(f => (f.kind === 'WEE' || (f.kind === 'EEE' && f.fired)) && distance(f,p) < 85)) this.art.heroBeacon(p);
    for (const s of g.shots) this.projectile(s);
    for (const s of g.enemyShots) this.art.enemyProjectile(s);
    c.font = '600 12px "Space Grotesk",sans-serif'; c.textAlign = 'center';
    for (const t of g.texts) { c.globalAlpha = Math.min(1, t.life * 2); c.fillStyle = t.color; c.fillText(t.text, t.x, t.y); } c.globalAlpha = 1;
    c.restore();
    const vignette = c.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, Math.max(w, h) * .65); vignette.addColorStop(0, '#0000'); vignette.addColorStop(1, '#050e0c88'); c.fillStyle = vignette; c.fillRect(0, 0, w, h);
  }
  drawGround() {
    const c = this.ctx;
    c.fillStyle = '#1b2b23'; c.fillRect(0, 0, WORLD.width, WORLD.height);
    for (let y = 0; y < WORLD.height; y += 80) for (let x = 0; x < WORLD.width; x += 80) {
      c.fillStyle = ((x / 80 + y / 80) % 3 === 0) ? '#203027' : '#1c2b23'; c.fillRect(x + 2, y + 2, 76, 76);
      c.strokeStyle = '#3d4f3522'; c.lineWidth = 1; c.strokeRect(x + 5, y + 5, 70, 70);
      if ((x + y) % 240 === 0) this.line(x + 8, y + 12, x + 20, y + 19, '#48573b40');
    }
    // The ornamental summoning circle is passable ground.
    this.circle(800, 500, 225, '#91a56c05', '#869b5b25', 2); this.circle(800, 500, 210, null, '#869b5b18'); this.circle(800, 500, 165, null, '#869b5b1a');
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; const x = 800 + Math.cos(a) * 194, y = 500 + Math.sin(a) * 194; this.diamond(x, y, 6, '#91a56c30'); }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; this.line(800 + Math.cos(a) * 165, 500 + Math.sin(a) * 165, 800 + Math.cos(a + TAU / 3) * 165, 500 + Math.sin(a + TAU / 3) * 165, '#869b5b16'); }
    for (const d of this.decor) {
      if (d.variant === 0) { this.circle(d.x, d.y, d.r * 2, '#243c2944'); for (let i = 0; i < 3; i++) this.line(d.x + i * 4, d.y, d.x + i * 5 - 4, d.y - d.r, '#51644066'); }
      else if (d.variant === 1) { this.diamond(d.x, d.y, d.r, '#37423766', '#4d5e3a44'); }
      else { this.circle(d.x, d.y, d.r * .35, '#71805a33'); }
    }
    c.strokeStyle = '#617347'; c.lineWidth = 12; c.strokeRect(6, 6, WORLD.width - 12, WORLD.height - 12); c.strokeStyle = '#26351f'; c.lineWidth = 4; c.strokeRect(20, 20, WORLD.width - 40, WORLD.height - 40);
    for (const [x, y] of [[80, 80], [1520, 80], [80, 920], [1520, 920]]) {
      this.circle(x, y + 10, 30, '#07120d55'); c.fillStyle = '#3e4e3b'; c.fillRect(x - 16, y - 10, 32, 32); c.fillStyle = '#6a7550'; c.fillRect(x - 19, y - 20, 38, 14); this.circle(x, y - 27, 10, '#b2cf85'); this.circle(x, y - 27, 22, '#c3e39b15');
    }
  }
  hero(p) {
    this.art.hero(p);
    if (p.bkb > 0 || p.stasis > 0) {
      const c = this.ctx, stasis = p.stasis > 0;
      c.save();
      this.vfx.ellipse(p.x, p.y - 10, stasis ? 30 : 38, stasis ? 48 : 44, stasis ? '#edca6666' : '#eec45d16', '#ffe6a0cc', 2);
      this.circle(p.x, p.y + 17, stasis ? 34 : 42, '#e7be5815', '#f5cf8177', 2);
      c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe4a0';
      c.fillText(stasis ? '⌛ 凝滞' : '♛ 天神下凡', p.x, p.y - 65);
      c.restore();
    }
  }
  enemy(e) {
    const c = this.ctx, t = this.game.time; c.save(); c.translate(e.x, e.y);
    this.circle(0, e.r * .7, e.r * .9, '#06110f77');
    if (e.air) { c.translate(0, -25 - Math.sin(e.air * 8) * 8); this.circle(0, 0, e.r + 10, null, '#bacaff88'); }
    if (e.spawn > 0 && !e.boss) this.vfx.ellipse(0, 10, 22 + e.spawn * 20, 8 + e.spawn * 10, null, '#bd9ac577');
    this.art.enemy(e);
    if (e.snap > 0) { this.vfx.glow(0, 0, e.r + 20, '#86d3ff', .18); this.circle(0, 0, e.r + 6, null, '#8cd9ff77', 1); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * .4; this.diamond(Math.cos(a) * (e.r + 5), Math.sin(a) * (e.r + 5), 5, '#a3ddff88', '#cef5ffbb'); } }
    if (e.burn > 0) this.vfx.flames(0, e.r * .5, e.r, t + e.id, 5);
    if (e.disarm > 0) { c.font = '12px sans-serif'; c.fillStyle = '#cedabe'; c.textAlign = 'center'; c.fillText('×', 0, -e.r - 15); }
    if (!e.boss && e.hp < e.maxHp) { c.fillStyle = '#142018'; c.fillRect(-18, -e.r - 11, 36, 3); c.fillStyle = '#a5bd7c'; c.fillRect(-18, -e.r - 11, 36 * Math.max(0, e.hp / e.maxHp), 3); }
    c.restore();
  }
  spirit(a) { this.vfx.spirit(a); }
  effect(f) {
    if (f.kind.startsWith('boss-') && this.bossVfx.effect(f)) return;
    if (f.kind === 'equipment-pulse' || f.kind === 'equipment-blink') {
      const c = this.ctx, progress = Math.min(1, f.age / f.duration);
      c.save(); c.globalAlpha = 1 - progress;
      if (f.kind === 'equipment-blink') {
        this.circle(f.x, f.y, 20 + progress * 35, null, f.color, 3);
        this.circle(f.tx, f.ty, 35 - progress * 20, null, f.color, 3);
        c.setLineDash([5, 10]); this.line(f.x, f.y, f.tx, f.ty, f.color, 2);
      } else this.circle(f.x, f.y, f.radius * progress, null, f.color, 3);
      c.restore(); return;
    }
    this.vfx.effect(f);
  }
  projectile(s) { this.vfx.projectile(s); }
  aim() {
    const g = this.game, p = g.player, s = resolveSpell(g.queue), c = this.ctx, m = this.mouse;
    if (p.stasis > 0) return;
    if (g.equipment === 'blink' && g.equipmentCooldowns.blink <= 0) {
      const d = distance(p, m), ratio = d > 0 ? Math.min(d, equipmentById('blink').range) / d : 0;
      c.save(); c.setLineDash([3, 8]);
      const x = Math.max(25, Math.min(WORLD.width - 25, p.x + (m.x - p.x) * ratio)), y = Math.max(25, Math.min(WORLD.height - 25, p.y + (m.y - p.y) * ratio));
      this.line(p.x, p.y, x, y, '#b9a2ff35'); this.circle(x, y, 12, null, '#c4acff88'); c.restore();
    }
    this.circle(m.x, m.y, 5, null, '#d8e7c477'); if (!s) return;
    const stats = g.spellStats(s), d = distance(p, m), range = stats.range || d, ratio = d ? Math.min(d, range) / d : 0;
    const x = p.x + (m.x - p.x) * ratio, y = p.y + (m.y - p.y) * ratio;
    c.save(); c.setLineDash([4, 7]);
    if (s.id === 'QQQ') { this.circle(p.x, p.y, range, null, '#83dcff22'); const e = g.enemyAt(m); if (e) this.circle(e.x, e.y, e.r + 10, null, distance(e, p) <= range ? '#b3e7c7' : '#ff8292', 2); }
    else if (s.type.includes('地面')) {
      const offsets = s.id === 'WEE' && g.hasRelic('meteor_triad') ? [-90, 0, 90] : s.id === 'EEE' && g.hasRelic('solar_cataclysm') ? [-105, 0, 105] : [0];
      const dx = d > .01 ? (m.x - p.x) / d : 0, dy = d > .01 ? (m.y - p.y) / d : -1;
      for (const offset of offsets) {
        const px = Math.max(25, Math.min(WORLD.width - 25, x - dy * offset)), py = Math.max(25, Math.min(WORLD.height - 25, y + dx * offset));
        this.circle(px, py, stats.radius || 60, '#ffffff04', s.color + '88');
        if (s.id === 'WEE') this.line(px, py, px + dx * 150, py + dy * 150, '#ff9c7255');
      }
    }
    else if (s.id === 'QWE' && g.hasRelic('blast_radial')) this.circle(p.x, p.y, 150, null, s.color + '88');
    else if (s.id === 'QQE') {
      const dx = d > .01 ? (m.x - p.x) / d : 0, dy = d > .01 ? (m.y - p.y) / d : -1;
      const cx = p.x + dx * stats.wallOffset, cy = p.y + dy * stats.wallOffset;
      this.line(cx - dy * stats.halfLength, cy + dx * stats.halfLength, cx + dy * stats.halfLength, cy - dx * stats.halfLength, s.color + '88');
    }
    else if (s.type === '方向') { this.line(p.x, p.y, x, y, s.color + '66'); this.circle(x, y, stats.radius, null, s.color + '55'); }
    c.restore();
  }
}
