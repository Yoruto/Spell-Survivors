import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, distance } from '../src/game.js';
import { ENEMY_DEFINITIONS } from '../src/enemy-definitions.js';
import { drawEnemyIntent } from '../src/enemy-intents.js';
import { ActorArt } from '../src/actors.js';
import { SpellVFX } from '../src/vfx.js';

const scene = () => { const g = new Game(() => .5); g.start(); g.chooseRoute('battle'); g.spawnTimer = 9999; return g; };
const advance = (g, seconds) => { for (let left = seconds; left > 1e-7; left -= .025) g.tick(Math.min(.025, left)); };
const enemy = (g, kind = 'normal', position = { x: 810, y: 500 }) => {
  const e = g.spawnEnemy(kind, position); e.spawn = 0; e.attack = 0; return e;
};
const cast = (g, id, point) => { for (const key of id) g.input(key); assert.ok(g.cast(point)); };

test('melee locks its direction, damages only after the windup and has recovery', () => {
  const g = scene(), e = enemy(g); g.tick(.025);
  assert.equal(g.player.hp, 120); assert.equal(e.brain.action.kind, 'melee'); assert.equal(e.swing, 0);
  advance(g, .375); assert.equal(g.player.hp, 120); g.tick(.025);
  assert.equal(g.player.hp, 110); assert.equal(e.brain.state, 'recover'); assert.equal(e.swing, .3);
  advance(g, .3); assert.equal(g.player.hp, 110);
});

test('sidestepping or moving behind the locked sword arc avoids damage', () => {
  for (const point of [{ x: 800, y: 700 }, { x: 830, y: 500 }]) {
    const g = scene(), e = enemy(g); g.tick(.025); const dir = { ...e.brain.action.dir };
    Object.assign(g.player, point); advance(g, .4);
    assert.equal(g.player.hp, 120); assert.equal(e.brain.state, 'recover'); assert.equal(e.facing, Math.atan2(dir.y, dir.x));
  }
});

test('stun, disarm and airborne interrupt prepared melee without delayed damage', () => {
  for (const control of ['stun', 'disarm', 'air']) {
    const g = scene(), e = enemy(g); g.tick(.025); e[control] = 1;
    if (control === 'air') e.airPower = 0;
    g.tick(.025); assert.equal(e.brain.action, null); advance(g, .6); assert.equal(g.player.hp, 120);
  }
});

test('spawn animation prevents immediate attacks and pause/shop freeze the windup', () => {
  const g = scene(), e = enemy(g); e.spawn = .5; g.tick(.025); assert.equal(e.brain.action, null);
  advance(g, .5); assert.equal(e.brain.state, 'windup');
  for (const state of ['paused', 'shop']) {
    g.state = state; const left = e.brain.action.left; advance(g, 1); assert.equal(e.brain.action.left, left);
  }
  g.state = 'playing'; advance(g, .4); assert.equal(g.player.hp, 110);
});

test('casters telegraph a locked projectile, spend mana on release and reposition after', () => {
  const g = scene(), e = enemy(g, 'ranged', { x: 1050, y: 500 }); g.tick(.025);
  assert.equal(e.brain.action.kind, 'bolt'); assert.equal(e.mana, 100); assert.equal(g.enemyShots.length, 0);
  g.player.y = 700; advance(g, .6);
  assert.equal(e.mana, 80); assert.equal(g.enemyShots.length, 1); assert.equal(g.enemyShots[0].dy, 0);
  assert.equal(g.enemyShots[0].damage, 12); const y = e.y; advance(g, .7);
  assert.notEqual(e.y, y); assert.equal(e.brain.state, 'reposition');
});

test('silence interrupts both casting and recharge; EMP can invalidate a prepared bolt', () => {
  for (const mana of [100, 0]) {
    const g = scene(), e = enemy(g, 'ranged', { x: 1000, y: 500 }); e.mana = mana;
    g.tick(.025); assert.ok(e.brain.action); assert.ok(g.control(e, 'silence', 2));
    assert.equal(e.brain.action, null); advance(g, 1.8);
    assert.equal(e.mana, mana); assert.equal(g.enemyShots.length, 0);
  }
  const g = scene(), e = enemy(g, 'ranged', { x: 1000, y: 500 }); e.mana = 20;
  g.tick(.025); g.effects.push({ kind: 'WWW', x: e.x, y: e.y, radius: 140, delay: 0, duration: 2, age: 0, power: 0 });
  g.tick(.025); assert.equal(e.mana, 0); advance(g, .6); assert.equal(g.enemyShots.length, 0);
});

test('out-of-mana casters recharge in place, then can shoot again', () => {
  const g = scene(), e = enemy(g, 'ranged', { x: 1050, y: 500 }); e.mana = 0;
  g.tick(.025); assert.equal(e.brain.state, 'recharge'); advance(g, 1.775); assert.equal(e.mana, 0);
  g.tick(.025); assert.equal(e.mana, 60); assert.equal(e.x, 1050);
  advance(g, 1.1); assert.equal(e.mana, 40); assert.ok(g.enemyShots.length > 0);
});

test('casters retreat at most twice, and cleanup casters stop retreating and close distance', () => {
  const g = scene(), e = enemy(g, 'ranged', { x: 900, y: 500 }); e.attack = 999;
  for (let i = 0; i < 3; i++) {
    g.player.x = e.x - 50; g.player.y = e.y; e.brain.retreatCooldown = 0;
    g.tick(.025); if (i < 2) assert.equal(e.brain.state, 'retreat');
    advance(g, .7);
  }
  assert.equal(e.brain.retreats, 2);
  g.pendingEnemies = 0; g.player.x = 300; e.x = 800; const gap = distance(g.player, e);
  advance(g, .3); assert.ok(distance(g.player, e) < gap); assert.notEqual(e.brain.state, 'retreat');
});

test('charger locks a visible path, cannot turn mid-charge and leaves a recovery window', () => {
  const g = scene(), e = enemy(g, 'charger', { x: 1050, y: 500 }); g.tick(.025);
  assert.equal(e.brain.action.kind, 'charge'); assert.equal(e.brain.state, 'windup');
  const a = e.brain.action; assert.equal(a.dir.y, 0); assert.equal(a.origin.x, 1050);
  g.player.y = 700; advance(g, .8); assert.equal(e.brain.state, 'charge'); assert.equal(e.x, 1050);
  advance(g, .7); assert.equal(e.brain.state, 'recover'); assert.equal(e.y, 500); assert.equal(g.player.hp, 120);
  const x = e.x; advance(g, .4); assert.equal(e.x, x); assert.ok(e.brain.chargeCooldown > 4);
});

test('charge sweeps collisions once per target, including summons, and respects stasis', () => {
  for (const stasis of [0, 3]) {
    const g = scene(), e = enemy(g, 'charger', { x: 1050, y: 500 }); g.player.stasis = stasis;
    g.tick(.025); advance(g, .8);
    const spirit = { id: 500, x: 900, y: 500, r: 13, hp: 65, maxHp: 65 }; g.spirits.push(spirit);
    // Keep the target fixed to exercise swept collision independent of summon following.
    spirit.life = 24; spirit.attack = 999; spirit.buff = 0;
    advance(g, .7); assert.equal(g.player.hp, stasis ? 120 : 104); assert.equal(spirit.hp, 49);
    assert.equal(e.brain.state, 'recover');
  }
});

test('control cancels charge windup and movement; cold snap and blast use the same interrupts', () => {
  for (const control of ['root', 'stun', 'disarm', 'air']) {
    const g = scene(), e = enemy(g, 'charger', { x: 1050, y: 500 }); g.tick(.025);
    if (control === 'disarm' || control === 'air') e[control] = 1; else g.control(e, control, 1);
    if (control === 'air') e.airPower = 0;
    g.tick(.025); assert.equal(e.brain.action, null); advance(g, .8);
    if (control === 'disarm') assert.ok(1050 - e.x <= e.speed * .825); else assert.equal(e.x, 1050);
    assert.equal(g.player.hp, 120);
  }
  const g = scene(), e = enemy(g, 'charger', { x: 1050, y: 500 }); g.tick(.025); advance(g, .8);
  const x = e.x; g.control(e, 'root', 1); g.tick(.025); assert.equal(e.x, x); assert.equal(e.brain.state, 'recover');
  const h = scene(), m = enemy(h, 'normal'); h.tick(.025); cast(h, 'QQQ', m); h.damage(m, 1); h.tick(.025);
  assert.equal(m.brain.action, null);
  const j = scene(), c = enemy(j, 'charger', { x: 1000, y: 500 }); j.tick(.025); cast(j, 'QWE', c); advance(j, .4);
  assert.ok(c.disarm > 0); assert.equal(c.brain.action, null);
});

test('invisibility prevents new target acquisition but preserves previously locked projectiles', () => {
  const g = scene(), e = enemy(g, 'ranged', { x: 1050, y: 500 }); g.player.ghost = 5;
  advance(g, 1); assert.equal(e.brain.action, null); assert.equal(g.enemyShots.length, 0);
  g.player.ghost = 0; g.tick(.025); assert.equal(e.brain.action.kind, 'bolt'); g.player.ghost = 5;
  advance(g, .6); assert.equal(g.enemyShots.length, 1);
});

test('pulling a prepared charger cancels its old path rather than launching from a new origin', () => {
  const g = scene(), e = enemy(g, 'charger', { x: 1050, y: 500 }); g.tick(.025);
  const origin = { ...e.brain.action.origin }; e.y += 10; g.tick(.025);
  assert.equal(e.brain.action, null); assert.equal(e.brain.state, 'recover'); assert.ok(e.brain.chargeCooldown > 1.9);
  advance(g, .3); assert.equal(e.x, origin.x); assert.equal(g.player.hp, 120);
});

test('melee approach separates overlapping enemies and all kinds remain bounded at edges', () => {
  const g = scene(), a = enemy(g, 'normal', { x: 1000, y: 500 }), b = enemy(g, 'normal', { x: 1000, y: 500 });
  a.attack = b.attack = 999; advance(g, .5); assert.ok(distance(a, b) > 1);
  const h = scene(); h.training = true; h.player.x = 25; h.player.y = 25;
  for (const [i, kind] of Object.keys(ENEMY_DEFINITIONS).entries()) enemy(h, kind, { x: 40 + i * 50, y: 40 });
  for (let i = 0; i < 1200; i++) {
    h.tick(.025);
    for (const e of h.enemies) { assert.ok(e.x >= 25 && e.x <= 1575); assert.ok(e.y >= 25 && e.y <= 975); assert.ok(Number.isFinite(e.facing || 0)); }
  }
});

test('finite reinforcements include all three roles, and training can summon a capped squad', () => {
  const g = scene(); g.player.hp = g.player.maxHp = 100000; const kinds = new Set();
  for (let i = 0; i < 12; i++) { g.spawnTimer = 0; g.tick(.01); kinds.add(g.enemies.at(-1).kind); }
  assert.deepEqual([...kinds].sort(), ['charger', 'normal', 'ranged']); assert.equal(g.pendingEnemies, 0);
  assert.equal(g.trainingSquad(), false); g.start(true); g.spawnTimer = 9999;
  assert.ok(g.trainingSquad()); assert.equal(g.enemies.length, 4); assert.equal(g.pendingEnemies, 0);
  while (g.enemies.length <= 90) assert.ok(g.trainingSquad()); assert.equal(g.trainingSquad(), false);
  g.start(); assert.equal(g.enemies.length, 0); assert.equal(g.reinforcementsSpawned, 0);
});

test('all enemy telegraphs and art use finite coordinates without mutating simulation', () => {
  let operations = 0;
  const check = (...args) => { operations++; for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n)); };
  const gradient = { addColorStop: check }, ctx = new Proxy({ globalAlpha: 1 }, { get: (obj, key) => key in obj ? obj[key] : String(key).startsWith('create') ? (...args) => { check(...args); return gradient; } : check });
  const g = scene(), r = { ctx, game: g, circle: check, line: check, diamond: check }; r.vfx = new SpellVFX(r); const art = new ActorArt(r);
  for (const kind of Object.keys(ENEMY_DEFINITIONS)) {
    const e = enemy(g, kind, { x: kind === 'normal' || kind === 'elite' ? 810 : 1050, y: 500 });
    g.tick(.025);
    for (const phase of ['windup', 'charge', 'recover', 'recharge']) {
      if (phase === 'recharge') { e.brain.action = { kind: 'recharge', duration: 1.8, left: 1 }; e.brain.state = phase; }
      else if (phase === 'charge' && e.brain.action?.kind === 'charge') e.brain.state = phase;
      const snapshot = JSON.stringify(e); drawEnemyIntent(r, e); ctx.save(); art.enemy(e); ctx.restore(); assert.equal(JSON.stringify(e), snapshot);
    }
    e.hp = 0;
  }
  assert.ok(operations > 500);
});
