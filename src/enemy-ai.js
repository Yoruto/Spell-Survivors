import { ENEMY_DEFINITIONS } from './enemy-definitions.js';
import { bounded, distance, normalized, segmentDistance } from './geometry.js';

export function initEnemy(e) {
  // Kept separate from boss.ai: bosses own their own action and damage rules.
  e.brain = { state: 'approach', action: null, left: 0, side: e.id % 2 ? 1 : -1,
    retreats: 0, retreatCooldown: 0, chargeCooldown: 0 };
}
function rest(e, seconds) {
  Object.assign(e.brain, { state: 'recover', action: null, left: seconds }); e.casting = 0;
}
export function interruptEnemy(e, control) {
  const b = e.brain;
  if (!b) return;
  const kind = b.action?.kind;
  const blocks = control === 'stun' || control === 'air' ||
    (control === 'disarm' && ['melee', 'bolt', 'charge'].includes(kind)) ||
    (control === 'silence' && ['bolt', 'recharge'].includes(kind)) ||
    (control === 'root' && kind === 'charge') ||
    (control === 'displacement' && ['melee', 'charge'].includes(kind));
  if (!blocks || !b.action) return;
  if (kind === 'charge') b.chargeCooldown = 2;
  rest(e, .35); e.attack = Math.max(e.attack, .5);
}
function move(e, point, dt, speed = e.speed) {
  if (e.root > 0 || speed <= 0) return;
  const d = distance(e, point);
  if (d < 1) return;
  const dir = normalized(e, point), step = Math.min(d, speed * Math.max(0, 1 - e.slow) * dt);
  // Separation is included in the requested destination, not added as extra speed.
  const next = bounded({ x: e.x + dir.x * step, y: e.y + dir.y * step });
  const moved = distance(e, next); Object.assign(e, next);
  if (moved > 0) { e.facing = Math.atan2(dir.y, dir.x); e.walk = (e.walk || 0) + moved * .09; }
}
function approach(g, e, point, dt, spread = false) {
  const d = distance(e, point), dir = normalized(e, point);
  const offset = spread && d > 80 ? (e.id % 3 - 1) * Math.min(65, d * .25) : 0;
  const dest = { x: point.x - dir.y * offset, y: point.y + dir.x * offset };
  let sx = 0, sy = 0;
  for (const other of g.enemies) {
    if (other === e || other.hp <= 0 || other.air > 0) continue;
    const gap = distance(e, other), spacing = e.r + other.r + 8;
    if (gap < spacing) {
      const away = gap < .01 ? { x: 0, y: e.id < other.id ? -1 : 1 } : normalized(other, e);
      sx += away.x * (spacing - gap); sy += away.y * (spacing - gap);
    }
  }
  const scale = Math.min(1, 35 / (Math.hypot(sx, sy) || 1));
  move(e, { x: dest.x + sx * scale, y: dest.y + sy * scale }, dt);
}
function start(e, kind, duration, extra = {}) {
  e.brain.state = kind === 'recharge' ? 'recharge' : 'windup';
  e.brain.action = { kind, left: duration, duration, ...extra };
  e.casting = duration;
}
function melee(e, target, def) {
  const dir = normalized(e, target); e.facing = Math.atan2(dir.y, dir.x);
  start(e, 'melee', def.windup, { target, dir, origin: { x: e.x, y: e.y }, range: 52 });
}
function resolve(g, e, a, def) {
  if (a.kind === 'melee') {
    const t = a.target, dir = normalized(a.origin, t);
    if (t.hp > 0 && distance(a.origin, t) <= a.range + t.r && dir.x * a.dir.x + dir.y * a.dir.y >= Math.cos(.85)) g.hurt(t, def.damage, 'physical');
    e.swing = .3; e.attack = .9; rest(e, def.recovery);
  } else if (a.kind === 'bolt') {
    if (e.mana < def.manaCost) { rest(e, .35); return; }
    e.mana -= def.manaCost;
    g.enemyShots.push({ x: e.x, y: e.y, dx: a.dir.x, dy: a.dir.y, speed: 175, life: 4, r: 6, damage: def.damage, kind: 'bolt' });
    e.attack = 2.2; rest(e, def.recovery);
    e.brain.strafe = 0.8;
  } else if (a.kind === 'recharge') {
    e.mana = Math.min(100, e.mana + def.rechargeAmount); rest(e, .35);
  } else if (a.kind === 'charge') {
    e.brain.state = 'charge'; a.hit = new Set(); a.traveled = 0; e.casting = 0;
  }
}
function dash(g, e, a, dt, def) {
  const from = { x: e.x, y: e.y };
  const step = Math.min(a.length - a.traveled, def.chargeSpeed * Math.max(0, 1 - e.slow) * dt);
  const to = bounded({ x: e.x + a.dir.x * step, y: e.y + a.dir.y * step });
  Object.assign(e, to); a.traveled += step; e.walk = (e.walk || 0) + step * .09;
  for (const t of [g.player, ...g.spirits]) {
    if (g.state !== 'playing') break;
    if (t.hp > 0 && !a.hit.has(t) && segmentDistance(t, from, to) <= def.chargeRadius + t.r) {
      a.hit.add(t); g.hurt(t, def.damage, 'physical');
    }
  }
  if (a.traveled >= a.length || distance(from, to) < .01) {
    e.brain.chargeCooldown = def.chargeCooldown; rest(e, def.recovery);
  }
}

export function tickEnemy(g, e, dt) {
  const b = e.brain, def = ENEMY_DEFINITIONS[e.kind];
  if (!b || !def || e.hp <= 0) return;
  if (b.state === 'windup' && b.action?.origin && distance(e, b.action.origin) > 1) interruptEnemy(e, 'displacement');
  for (const key of ['retreatCooldown', 'chargeCooldown']) b[key] = Math.max(0, b[key] - dt);
  for (const control of ['stun', 'air', 'disarm', 'silence', 'root']) if (e[control] > 0) interruptEnemy(e, control);
  if (e.stun > 0 || e.air > 0 || e.spawn > 0) return;
  if (b.state === 'charge') { dash(g, e, b.action, dt, def); return; }
  if (b.action) {
    b.action.left = Math.max(0, b.action.left - dt); e.casting = b.action.left;
    if (b.action.left <= 1e-9) resolve(g, e, b.action, def);
    return;
  }
  const ally = g.spirits.find(a => a.hp > 0 && distance(a, e) < 105);
  const target = ally || (g.player.ghost <= 0 ? g.player : null);
  const point = target || g.lastVisible, d = distance(e, point);
  const cleanup = !g.training && g.pendingEnemies === 0 && g.remainingEnemies <= 3;
  if (b.state === 'recover') {
    b.left = Math.max(0, b.left - dt);
    if (b.left <= 1e-9) b.state = 'approach';
    return;
  }
  if (e.kind === 'ranged') {
    if (e.mana < def.manaCost && e.silence <= 0) { start(e, 'recharge', def.rechargeTime); return; }
    if (cleanup && b.state === 'retreat') { b.state = 'approach'; b.left = 0; }
    if (b.state === 'retreat') {
      b.left -= dt;
      const away = normalized(point, e); move(e, { x: e.x + away.x * 80, y: e.y + away.y * 80 }, dt);
      if (b.left <= 0) b.state = 'approach'; return;
    }
    if (target && d < 140 && !cleanup && b.retreats < 2 && b.retreatCooldown <= 0 && e.root <= 0) {
      b.retreats++; b.retreatCooldown = 4; b.state = 'retreat'; b.left = .65; return;
    }
    if (b.strafe > 0 && !cleanup && d >= 140 && d <= 350) {
      b.state = 'reposition'; b.strafe -= dt;
      const dir = normalized(e, point);
      move(e, { x: e.x - dir.y * b.side * 80, y: e.y + dir.x * b.side * 80 }, dt); return;
    }
    b.strafe = 0; b.state = 'approach';
    if (target && d <= 450 && e.attack <= 0 && e.disarm <= 0 && e.silence <= 0 && e.mana >= def.manaCost) {
      const dir = normalized(e, target); e.facing = Math.atan2(dir.y, dir.x);
      start(e, 'bolt', def.windup, { dir }); return;
    }
    if (d > (cleanup ? 150 : 240)) approach(g, e, point, dt);
    return;
  }
  if (target && e.kind === 'charger' && d >= 100 && d <= 370 && b.chargeCooldown <= 0 && e.disarm <= 0 && e.root <= 0 && e.attack <= 0) {
    const dir = normalized(e, target), length = Math.min(def.chargeRange, d + 70);
    const origin = { x: e.x, y: e.y }, end = bounded({ x: e.x + dir.x * length, y: e.y + dir.y * length });
    const actualDir = normalized(origin, end); e.facing = Math.atan2(actualDir.y, actualDir.x);
    start(e, 'charge', def.windup, { dir: actualDir, origin, end, length: distance(origin, end), radius: def.chargeRadius }); return;
  }
  if (target && d <= e.r + target.r + 8 && e.attack <= 0 && e.disarm <= 0) { melee(e, target, def); return; }
  if (d > e.r + (target?.r || 17)) approach(g, e, point, dt, true);
}
