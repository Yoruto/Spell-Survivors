import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, distance } from '../src/game.js';
import { EQUIPMENT } from '../src/equipment.js';
import { Renderer } from '../src/renderer.js';
import { ActorArt } from '../src/actors.js';
import { SpellVFX } from '../src/vfx.js';
const make = id => { const g = new Game(() => .5); g.start(false, id); g.chooseRoute('battle'); g.spawnTimer = 9999; return g; };
const advance = (g, seconds) => { for (let i = 0; i < Math.round(seconds / .025); i++) g.tick(.025); };

test('one free starting item, validated choice and fresh reset for active and passive items', () => {
  for (const item of EQUIPMENT) {
    const g = make(item.id); assert.equal(g.equipment, item.id); assert.deepEqual(g.ownedEquipment, [item.id]); assert.equal(g.gold, 0);
    g.equipmentCooldowns[item.id] = 5; g.player.stasis = 2; g.start(); g.chooseRoute('battle');
    assert.equal(g.equipment, 'blink'); assert.deepEqual(g.ownedEquipment, ['blink']); assert.equal(g.equipmentCooldowns[item.id], 0); assert.equal(g.player.stasis, 0);
  }
  assert.equal(make('forged').equipment, 'blink');
});

test('BKB breaks and prevents every control, reduces only magic damage by 80 percent for six seconds', () => {
  const g = make('bkb'), p = g.player;
  for (const kind of ['stun', 'root', 'silence', 'slow']) assert.ok(g.control(p, kind, 10));
  assert.ok(g.useEquipment());
  for (const kind of ['stun', 'root', 'silence', 'slow']) { assert.equal(p[kind], 0); assert.equal(g.control(p, kind, 1), false); }
  g.hurt(p, 20, 'magic'); assert.equal(p.hp, 116);
  p.invulnerable = 0; g.hurt(p, 20, 'physical'); assert.equal(p.hp, 96);
  g.input('Q'); g.move({ x: 900, y: 500 }); advance(g, .1); assert.ok(p.x > 800); assert.deepEqual(g.queue, ['Q']);
  advance(g, 6); p.invulnerable = 0; g.hurt(p, 20, 'magic'); assert.equal(p.hp, 76); assert.ok(g.control(p, 'root', 1));
});

test('real enemy projectiles and boss ground spells use magic damage; melee stays physical', () => {
  const g = make('bkb'), p = g.player; g.useEquipment();
  g.enemyShots.push({ x: p.x, y: p.y, dx: 0, dy: 0, speed: 0, life: 2, r: 6, damage: 20 });
  g.tick(.025); assert.equal(p.hp, 116); p.invulnerable = 0;
  g.effects.push({ kind: 'danger', x: p.x, y: p.y, radius: 100, age: 0, delay: 0, duration: 1 });
  g.tick(.025); assert.ok(Math.abs(p.hp - 111.2) < 1e-9); p.invulnerable = 0;
  const e = g.spawnEnemy('normal', { x: p.x, y: p.y }); e.spawn = 0; e.attack = 0; advance(g, .425); assert.ok(Math.abs(p.hp - 101.2) < 1e-9);
});

test('Zhonya blocks all actions and damage for three seconds, while spells, enemies and cooldowns continue', () => {
  const g = make('zhonya'), p = g.player;
  for (const key of 'QEE') g.input(key); assert.ok(g.cast({ x: 900, y: 500 }));
  g.move({ x: 1200, y: 500 }); assert.ok(g.useEquipment()); const position = { x: p.x, y: p.y };
  g.input('W'); assert.deepEqual(g.queue, ['Q', 'E', 'E']); assert.equal(g.cast(position), false);
  g.move({ x: 1000, y: 500 }); assert.equal(p.target, null); assert.equal(g.useEquipment(), false);
  for (const type of ['physical', 'magic', 'pure']) g.hurt(p, 1000, type);
  assert.equal(p.hp, 120); assert.equal(g.control(p, 'stun', 5), false);
  const enemy = g.spawnEnemy('normal', { x: 1000, y: 500 }); const startX = enemy.x;
  advance(g, 2.975); assert.deepEqual({ x: p.x, y: p.y }, position); assert.ok(p.stasis > 0); assert.ok(enemy.x < startX); assert.ok(g.cooldowns.QEE < 10); assert.ok(g.spirits[0].life < 24);
  g.hurt(p, 1000); assert.equal(p.hp, 120); advance(g, .05); assert.equal(p.stasis, 0);
  g.input('W'); assert.equal(g.queue.at(-1), 'W'); g.move({ x: 1000, y: 500 }); advance(g, .1); assert.ok(p.x > position.x);
  p.invulnerable = 0; g.hurt(p, 10); assert.equal(p.hp, 110);
});

test('blink respects mouse target, max range, world edges and cancels old movement', () => {
  const g = make('blink'), p = g.player;
  g.move({ x: 200, y: 200 }); assert.ok(g.useEquipment({ x: 880, y: 560 })); assert.deepEqual({ x: p.x, y: p.y }, { x: 880, y: 560 }); assert.equal(p.target, null);
  assert.equal(g.useEquipment({ x: 1500, y: 900 }), false);
  g.equipmentCooldowns.blink = 0; const origin = { x: p.x, y: p.y }; assert.ok(g.useEquipment({ x: 1500, y: 900 })); assert.ok(Math.abs(distance(p, origin) - 280) < 1e-9);
  p.x = 1550; p.y = 950; g.equipmentCooldowns.blink = 0; assert.ok(g.useEquipment({ x: 5000, y: 5000 })); assert.ok(p.x <= 1575 && p.y <= 975);
});

test('failed blink and full-health heal never consume cooldown', () => {
  const g = make('blink');
  for (const [point, valid] of [[undefined, true], [{ x: NaN, y: 500 }, true], [g.player, true], [{ x: 900, y: 500 }, false]]) {
    assert.equal(g.useEquipment(point, valid), false); assert.equal(g.equipmentCooldowns.blink, 0);
  }
  g.control(g.player, 'root', 5); assert.equal(g.useEquipment({ x: 900, y: 500 }), false);
  const heal = make('mek'); assert.equal(heal.useEquipment(), false); assert.equal(heal.equipmentCooldowns.mek, 0);
});

test('shop validates purchases and single-slot swaps, retaining independent cooldowns and rejecting free purchases', () => {
  const g = make('blink'); g.useEquipment({ x: 900, y: 500 }); const cooldown = g.equipmentCooldowns.blink;
  assert.equal(g.equip('bkb'), false); assert.equal(g.buy('bkb'), false);
  g.state = 'shop'; g.shop.stock = EQUIPMENT.map(e => e.id); g.gold = 64;  assert.equal(g.buy('bkb'), false); assert.equal(g.equip('bkb'), false);
  g.gold = 100; assert.equal(g.buy('bkb', true), false); assert.ok(g.buy('bkb')); assert.equal(g.gold, 35); assert.equal(g.equipment, 'bkb'); assert.equal(g.modifiers.length, 0);
  assert.equal(g.buy('bkb'), false); assert.equal(g.equip('blink'), false); assert.deepEqual(g.ownedEquipment, ['bkb']); assert.equal(g.equipmentCooldowns.blink, cooldown);
  g.player.bkb = 1; assert.equal(g.equip('bkb'), false); assert.equal(g.buy('mek'), false);
});

test('equipment cooldowns freeze outside combat and ignore spell recovery upgrades', () => {
  const g = make('bkb'); g.useEquipment(); g.player.recovery = 10; advance(g, 1); assert.ok(Math.abs(g.equipmentCooldowns.bkb - 31) < 1e-8);
  for (const state of ['paused', 'shop', 'menu', 'dead', 'victory']) {
    g.state = state; const cd = g.equipmentCooldowns.bkb, active = g.player.bkb;
    g.tick(.05); assert.equal(g.equipmentCooldowns.bkb, cd); assert.equal(g.player.bkb, active); assert.equal(g.useEquipment(), false);
  }
});

test('Shiva damages grounded nearby enemies, slows for four seconds and respects boss resistance', () => {
  const g = make('shiva');
  const normal = g.spawnEnemy('normal', { x: 950, y: 500 }), boss = g.spawnEnemy('boss', { x: 1000, y: 500 }), air = g.spawnEnemy('normal', { x: 900, y: 500 }), far = g.spawnEnemy('normal', { x: 1300, y: 500 });
  normal.hp = 500; air.air = 5; const hp = boss.hp; assert.ok(g.useEquipment());
  assert.equal(normal.hp, 430); assert.equal(boss.hp, hp - 70); assert.equal(air.hp, air.maxHp); assert.equal(far.hp, far.maxHp);
  g.tick(.025); assert.equal(normal.slow, .5); assert.equal(boss.slow, .25); advance(g, 4); assert.equal(normal.slow, 0);
});

test('Mek heals player and nearby living spirits with caps and no revival', () => {
  const g = make('mek'); g.player.hp = 100;
  g.spirits = [{ x: 820, y: 500, hp: 30, maxHp: 65 }, { x: 1300, y: 500, hp: 10, maxHp: 65 }, { x: 820, y: 500, hp: 0, maxHp: 65 }];
  assert.ok(g.useEquipment()); assert.equal(g.player.hp, 120); assert.deepEqual(g.spirits.map(a => a.hp), [65, 10, 0]);
  g.equipmentCooldowns.mek = 0; g.spirits[0].hp = 60; assert.ok(g.useEquipment()); assert.equal(g.spirits[0].hp, 65);
  const live = make('mek'); for (const key of 'QEE') live.input(key); live.cast({ x: 900, y: 500 });
  live.spirits[0].hp = 50; assert.ok(live.useEquipment()); assert.equal(live.spirits[0].hp, 65);
});

test('equipment effects, protective auras, frozen hero pose and blink preview render finite coordinates', () => {
  let draws = 0;
  const check = (...args) => { draws++; for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value)); };
  const gradient = { addColorStop: check };
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : String(key).startsWith('create') ? (...args) => { check(...args); return gradient; } : check });
  for (const item of EQUIPMENT.filter(item => item.kind === 'active')) {
    const g = make(item.id); g.player.hp = 80; assert.ok(g.useEquipment({ x: 1000, y: 500 }));
    const r = Object.assign(Object.create(Renderer.prototype), { ctx, game: g, mouse: { x: 5000, y: 5000 } });
    r.vfx = new SpellVFX(r); r.art = new ActorArt(r);
    for (const age of [0, .2, .49]) { for (const f of g.effects) r.effect({ ...f, age }); r.hero(g.player); }
    g.equipmentCooldowns[item.id] = 0; r.aim();
  }
  assert.ok(draws > 100);
});
