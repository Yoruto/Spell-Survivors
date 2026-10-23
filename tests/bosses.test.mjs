import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { bossStatus } from '../src/bosses.js';
import { BossVFX } from '../src/boss-vfx.js';
import { Renderer } from '../src/renderer.js';
import { SpellVFX } from '../src/vfx.js';
import { ActorArt } from '../src/actors.js';

const advance = (g, seconds) => { for (let t = 0; t < seconds - 1e-7; t += .025) g.tick(Math.min(.025, seconds - t)); };
function scene(type = 'axe', equipment = 'blink', pos = { x: 800, y: 350 }) {
  const g = new Game(() => .5); g.start(false, equipment); g.chooseRoute('battle'); g.pendingEnemies = 0; g.spawnTimer = 999;
  const b = g.spawnEnemy('boss', pos, type); b.spawn = 0; b.attack = 999;
  for (const k of Object.keys(b.ai.cooldowns)) b.ai.cooldowns[k] = 999;
  return { g, b, p: g.player };
}
const cast = (g, id, point) => { for (const key of id) g.input(key); assert.ok(g.cast(point)); };
const zone = g => g.effects.find(f => f.kind === 'boss-zone');

test('two encounter identities and trial selection validate and reset all boss state', () => {
  const g = new Game(); g.start(true); assert.equal(g.trainingBoss('unknown'), false);
  assert.ok(g.trainingBoss('timber')); assert.equal(g.boss.maxHp, 4800); assert.equal(g.boss.mana, 0); assert.equal(g.trainingBoss(), false);
  g.damage(g.boss, 99999); g.tick(.025); assert.equal(g.boss, null); assert.ok(g.trainingBoss('axe')); assert.equal(g.boss.maxHp, 2400);
  g.start(); g.run.round = 2; g.beginEncounter('boss'); assert.equal(g.boss.bossType, 'timber'); assert.equal(g.boss.ai.rage, 0);
});

test('both bosses charge from zero, never ult below full, then spend exactly a full bar', () => {
  for (const type of ['axe', 'timber']) {
    const { g, b } = scene(type); b.speed = 0;
    advance(g, 19.9); assert.ok(b.mana < 100); assert.equal(b.ai.action, null);
    advance(g, .15); assert.equal(b.ai.action.kind, type === 'axe' ? 'cull' : 'saw'); assert.ok(b.mana < 1);
    assert.equal(zone(g).delay, type === 'axe' ? 1.2 : 1);
    advance(g, 1.3); assert.equal(b.ai.action, null); assert.ok(b.ai.recovery > 0);
  }
});

test('full mana waits for existing action and recovery; normal skills never spend it', () => {
  const { g, b } = scene(); b.ai.cooldowns.call = 0; b.mana = 85;
  g.tick(.025); assert.equal(b.ai.action.kind, 'call'); assert.ok(b.mana > 85);
  b.mana = 100; advance(g, .95); assert.equal(b.ai.action, null); assert.equal(b.mana, 100);
  advance(g, 1.25); assert.equal(b.ai.action.kind, 'cull'); assert.ok(b.mana < 1);
});

test('EMP drains boss charge and delays the next ultimate, including while in recovery', () => {
  const { g, b } = scene(); b.speed = 0; b.mana = 85;
  cast(g, 'WWW', { x: b.x, y: b.y }); advance(g, 1.5);
  assert.ok(b.mana > 30 && b.mana < 35); assert.equal(b.ai.action, null);
  advance(g, 12); assert.ok(b.mana < 100); assert.equal(b.ai.action, null);
});

test('call stays fixed, roots and taunts spirits; BKB blocks control and reduces only magic damage', () => {
  for (const immune of [false, true]) {
    const { g, b, p } = scene('axe', 'bkb', { x: 800, y: 500 }); b.ai.cooldowns.call = 0;
    cast(g, 'QEE', { x: 800, y: 500 });
    if (immune) g.useEquipment();
    g.tick(.025); const start = { x: b.x, y: b.y }; advance(g, .925);
    assert.equal(b.x, start.x); assert.equal(b.y, start.y); assert.equal(p.root > 0, !immune);
    assert.ok(Math.abs(p.hp - (immune ? 117.6 : 108)) < 1e-6);
    assert.ok(g.spirits[0].taunt > 0); assert.equal(g.spirits[0].tauntOwner, b.id);
    if (!immune) { assert.ok(g.useEquipment()); assert.equal(p.root, 0); }
  }
});

test('four rate-limited damage events trigger helix, with a separate warning for enraged second hit', () => {
  const { g, b, p } = scene('axe', 'blink', { x: 800, y: 500 });
  g.damage(b, 1); g.damage(b, 1); assert.equal(b.ai.rage, 1);
  for (let i = 0; i < 3; i++) { advance(g, .525); g.damage(b, 1); }
  assert.equal(b.ai.rage, 4); b.hp = b.maxHp / 2; g.tick(.025); advance(g, 1.25);
  assert.equal(b.ai.action.kind, 'helix'); const first = b.ai.action;
  advance(g, first.left + .025); assert.equal(b.ai.action.kind, 'helix'); assert.equal(b.ai.action.second, true);
  assert.equal(zone(g).radius, 130); const hp = p.hp;
  advance(g, .75); assert.equal(p.hp, hp - 24); assert.ok(b.ai.recovery > 0); assert.ok(b.ai.helixCd > 0);
});

test('hunger expires, is removed by damage including within rage gate, or by a kill', () => {
  for (const method of ['damage', 'kill', 'expire']) {
    const { g, b, p } = scene(); b.ai.cooldowns.hunger = 0;
    advance(g, .75); assert.ok(g.effects.some(f => f.kind === 'boss-hunger'));
    if (method === 'damage') { g.damage(b, 1); g.damage(b, 179); g.tick(.025); }
    else if (method === 'kill') { const e = g.spawnEnemy('normal', { x: 1500, y: 900 }); g.damage(e, 999); g.tick(.025); }
    else { advance(g, 6.1); assert.ok(p.hp <= 105); }
    assert.ok(!g.effects.some(f => f.kind === 'boss-hunger' && f.age < f.duration));
  }
});

test('cull snapshots its location, leaves a punish window, respects stasis and low-health bonus', () => {
  for (const mode of ['dodge', 'stasis', 'normal', 'low']) {
    const { g, b, p } = scene('axe', 'zhonya'); b.mana = 100;
    if (mode === 'low') p.hp = 35;
    g.tick(.025); assert.equal(zone(g).x, 800); assert.equal(zone(g).y, 500);
    if (mode === 'dodge') g.move({ x: 1100, y: 500 });
    if (mode === 'stasis') g.useEquipment();
    advance(g, 1.25); assert.equal(p.hp, mode === 'normal' ? 88 : mode === 'low' ? 0 : 120);
    assert.ok(b.ai.recovery > 1.3);
  }
});

test('jump locks a bounded destination, then gives call its full windup before the hit', () => {
  const { g, b } = scene('axe', 'blink', { x: 1200, y: 500 }); b.hp = 1200; b.ai.cooldowns.jump = 0;
  advance(g, 1.3); assert.equal(b.ai.action.kind, 'jump'); const dest = { ...b.ai.action.point };
  g.move({ x: 500, y: 500 }); advance(g, 1.05); assert.equal(b.x, dest.x); assert.equal(b.y, dest.y);
  for (let i = 0; i < 20 && b.ai.action?.kind !== 'call'; i++) g.tick(.025);
  assert.equal(b.ai.action.kind, 'call'); assert.ok(b.ai.action.left >= .875); assert.equal(b.ai.action.delay, .9);
});

test('timber spin is telegraphed, physical and applies slow through the common control API', () => {
  for (const immune of [false, true]) {
    const { g, b, p } = scene('timber', 'bkb', { x: 800, y: 500 }); b.ai.cooldowns.spin = 0;
    if (immune) g.useEquipment(); g.tick(.025); assert.equal(b.ai.action.kind, 'spin'); assert.equal(zone(g).radius, 145);
    advance(g, .95); assert.equal(p.hp, 94); assert.equal(p.slow, immune ? 0 : .2);
  }
});

test('chain sweeps the entire path once, can be sidestepped and warns each of two enraged legs', () => {
  for (const dodge of [false, true]) {
    const { g, b, p } = scene('timber', 'blink', { x: 400, y: 500 }); b.ai.cooldowns.chain = 0;
    g.tick(.025); assert.equal(b.ai.action.kind, 'chain'); assert.equal(b.ai.action.point.y, 500);
    if (dodge) g.move({ x: 800, y: 800 });
    advance(g, 2.2); assert.equal(p.hp, dodge ? 120 : 96); assert.equal(b.x, 1535);
  }
  const { g, b } = scene('timber', 'blink', { x: 400, y: 500 }); b.hp = 2400; b.ai.cooldowns.chain = 0;
  advance(g, 1.3); assert.equal(b.ai.action.kind, 'chain');
  advance(g, 2.2); assert.equal(b.ai.action, null); assert.ok(b.ai.nextChain);
  for (let i = 0; i < 40 && b.ai.action?.kind !== 'chain'; i++) g.tick(.025);
  assert.equal(b.ai.action.kind, 'chain'); assert.equal(b.ai.action.second, true); assert.ok(b.ai.action.left >= .975);
});

test('reactive armor caps hit frequency and damage reduction, then enters three seconds of vulnerability', () => {
  const { g, b } = scene('timber'); b.speed = 0;
  g.damage(b, 10); g.damage(b, 10); assert.equal(b.ai.armor, 1);
  assert.equal(g.damage(b, 100), 96);
  for (let i = 0; i < 4; i++) { advance(g, 1.025); g.damage(b, 1); }
  assert.equal(b.ai.armor, 5); assert.equal(g.damage(b, 100), 80);
  b.mana = 100; g.tick(.025); assert.equal(b.ai.action.kind, 'saw');
  advance(g, 4); assert.ok(b.ai.overheat > 2.9); assert.equal(b.ai.armor, 0);
  assert.equal(g.damage(b, 100), 120); assert.equal(b.ai.action, null);
  assert.ok(!g.effects.some(f => f.kind === 'boss-saw'));
  advance(g, 3.1); assert.equal(b.ai.overheat, 0); assert.equal(g.damage(b, 100), 100);
});

test('saw launches at full charge, leaves a persistent field and warns before its locked return', () => {
  const { g, b, p } = scene('timber'); b.mana = 100;
  g.tick(.025); const snapshot = { ...b.ai.action.point }; advance(g, 1.05);
  const f = g.effects.find(f => f.kind === 'boss-saw'); assert.ok(f); assert.deepEqual(f.point, snapshot);
  advance(g, .4); assert.equal(f.stage, 'stay'); assert.ok(p.hp < 120);
  p.invulnerable = 0; const hp = p.hp; advance(g, .65); assert.ok(p.hp < hp); assert.equal(p.slow, .25);
  advance(g, 3.4); assert.equal(f.stage, 'warning'); const point = { ...f.returnPoint };
  b.x += 100; advance(g, .85); assert.deepEqual(f.returnPoint, point); assert.equal(f.stage, 'back');
  advance(g, 2); assert.ok(!g.effects.includes(f));
});

test('enraged timber spends one full bar for two staggered blades, capped at two', () => {
  const { g, b } = scene('timber'); g.training = true; b.speed = 0; b.hp = 2400;
  advance(g, 1.3); b.mana = 100; advance(g, 4.5);
  assert.equal(g.effects.filter(f => f.kind === 'boss-saw').length, 2); assert.ok(b.mana < 25);
});

test('pause/shop freeze all AI and mana; boss death removes all owned hazards and reset clears taunts', () => {
  const { g, b } = scene('timber'); b.mana = 100; advance(g, 1.1);
  const mana = b.mana, age = g.effects.find(f => f.kind === 'boss-saw').age;
  for (const state of ['paused', 'shop']) { g.state = state; advance(g, 2); assert.equal(b.mana, mana); assert.equal(g.effects.find(f => f.kind === 'boss-saw').age, age); }
  g.state = 'playing'; g.damage(b, 99999); g.tick(.025); assert.ok(!g.effects.some(f => f.owner === b.id));
  g.start(true); assert.equal(g.boss, null); assert.equal(g.spirits.length, 0);
});

test('AI stays finite and within world bounds over extended normal and enraged cycles', () => {
  for (const type of ['axe', 'timber']) {
    const { g, b } = scene(type); g.training = true; b.hp = b.maxHp / 2;
    for (const k of Object.keys(b.ai.cooldowns)) b.ai.cooldowns[k] = 0;
    const actions = new Set();
    for (let i = 0; i < 6000; i++) {
      if (i % 160 === 0) g.move({ x: 100 + (i * 7) % 1400, y: 100 + (i * 3) % 800 });
      g.tick(.025); if (b.ai.action) actions.add(b.ai.action.kind);
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y)); assert.ok(b.x >= 25 && b.x <= 1575 && b.y >= 25 && b.y <= 975);
      assert.ok(b.mana >= 0 && b.mana <= 100);
      assert.ok(g.effects.filter(f => f.kind === 'boss-saw').length <= 2);
    }
    assert.ok(actions.has(type === 'axe' ? 'cull' : 'saw')); assert.ok(actions.has(type === 'axe' ? 'jump' : 'chain'));
    assert.match(bossStatus(b), /法力/);
  }
});

test('both models, all telegraph phases and flying/returning saws render finite coordinates', () => {
  let draws = 0;
  const check = (...args) => { draws++; for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n)); };
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : String(k).startsWith('create') ? (...args) => { check(...args); return { addColorStop: check }; } : check });
  for (const type of ['axe', 'timber']) {
    const { g, b } = scene(type); const r = Object.assign(Object.create(Renderer.prototype), { ctx, game: g });
    r.vfx = new SpellVFX(r); r.art = new ActorArt(r); r.bossVfx = new BossVFX(r);
    for (const rage of [false, true]) for (const hot of [0, 3]) { b.ai.enraged = rage; b.ai.overheat = hot; b.ai.armor = 5; r.enemy(b); }
    r.bossVfx.anchors();
    for (const kind of ['boss-zone', 'boss-line', 'boss-saw', 'boss-hunger', 'boss-phase']) for (const stage of ['out', 'stay', 'warning', 'back']) for (const age of [.1, 1.1]) {
      r.effect({ kind, stage, age, duration: 3, delay: 1, x: 800, y: 500, radius: 100, label: '旋风', style: 'timber', tx: 1200, ty: 500, owner: b.id, warning: .4, returnPoint: { x: 1200, y: 500 } });
    }
  }
  assert.ok(draws > 500);
});
