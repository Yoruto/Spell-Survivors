import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { SPELLS, RELICS } from '../src/config.js';
import { EQUIPMENT } from '../src/equipment.js';
import { ATTRIBUTES, attributeCost } from '../src/attributes.js';
import { shopHTML } from '../src/progression-view.js';

const make = () => { const g = new Game(() => .5); g.start(); g.chooseRoute('event'); g.resolveEvent('gold'); g.gold = 9999; return g; };
const buy = (g, id) => { g.shop.open(g); g.shop.stock = [id]; assert.ok(g.buy(id)); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const stats = (g, id) => g.spellStats(SPELLS.find(s => s.id === id));

test('normal shops draw 3 distinct candidates from each pool and retain purchased card positions', () => {
  const g = make();
  for (let i = 0; i < 30; i++) {
    g.shop.open(g);
    for (const pool of [ATTRIBUTES, RELICS, EQUIPMENT]) assert.equal(g.shop.stock.filter(id => pool.some(item => item.id === id)).length, 3);
    assert.equal(new Set(g.shop.stock).size, 9); assert.ok(!g.shop.stock.includes(g.equipment));
  }
  const id = g.shop.stock.find(id => id.startsWith('attr_')), count = g.shop.stock.length;
  assert.ok(g.buy(id)); assert.equal(g.shop.stock.length, count - 1);
  assert.equal((shopHTML(g).match(/<article /g) || []).length, 9);
  const gold = g.gold; assert.equal(g.buy(id), false); assert.equal(g.gold, gold);
  g.refreshShop(); assert.deepEqual(g.shop.purchased, []);
});

test('attributes add against base values, escalate individually, persist across shops and reset on restart', () => {
  const g = make(), power = ATTRIBUTES[0];
  const start = g.gold; buy(g, 'attr_power'); buy(g, 'attr_power');
  near(g.player.power, 1.2); assert.equal(g.gold, start - 20 - 25); assert.equal(attributeCost(g, power), 30);
  buy(g, 'attr_speed'); buy(g, 'attr_speed'); near(g.player.speed, 220 * 1.16);
  g.player.hp = 60; buy(g, 'attr_health'); assert.equal(g.player.maxHp, 140); assert.equal(g.player.hp, 80);
  g.nextWave(); g.chooseRoute('event'); g.resolveEvent('gold'); near(g.player.power, 1.2); assert.equal(g.attributeLevels.attr_power, 2);
  g.start(); assert.deepEqual(g.attributeLevels, {}); assert.equal(g.player.power, 1); assert.equal(g.player.speed, 220); assert.equal(g.player.maxHp, 120);
});

test('cooldown cap is enforced without consuming gold and never changes equipment cooldown', () => {
  const g = make(); g.equipmentCooldowns.blink = 7;
  for (let i = 0; i < 8; i++) buy(g, 'attr_cooldown');
  near(stats(g, 'EEE').cooldown, 3); assert.equal(g.equipmentCooldowns.blink, 7);
  const gold = g.gold; g.shop.open(g); assert.ok(!g.shop.stock.includes('attr_cooldown'));
  g.shop.stock.push('attr_cooldown'); assert.equal(g.buy('attr_cooldown'), false); assert.equal(g.gold, gold);
  buy(g, 'tornado_gale'); near(stats(g, 'QWW').cooldown, 6 * .75 * .6);
});

test('range upgrades affect actual unit targeting and projectiles, area composes with relic shapes', () => {
  const g = make(); buy(g, 'attr_range'); buy(g, 'attr_area'); buy(g, 'wall_glacier'); buy(g, 'emp_vortex');
  near(stats(g, 'QQQ').range, 594); near(stats(g, 'QWW').range, 715);
  near(stats(g, 'QQE').halfLength, 231); near(stats(g, 'WWW').radius, 192.5);
  assert.equal(stats(g, 'EEE').range, undefined);
  g.nextWave(); g.chooseRoute('battle'); g.spawnTimer = 9999;
  const enemy = g.spawnEnemy('normal', { x: 1380, y: 500 });
  for (const key of 'QQQ') g.input(key); assert.ok(g.cast(enemy));
  for (const key of 'QWW') g.input(key); assert.ok(g.cast({ x: 1550, y: 500 })); near(g.shots[0].range, 715);
  for (const key of 'QQE') g.input(key); assert.ok(g.cast({ x: 1000, y: 500 }));
  const wall = g.effects.find(f => f.kind === 'QQE'); near(wall.x, 921); near(wall.halfLength, 231);
  g.cooldowns.QQQ = 0; enemy.x = 1410;
  for (const key of 'QQQ') g.input(key); assert.equal(g.cast(enemy), false); assert.equal(g.cooldowns.QQQ, 0);
});

test('switching gear removes old bonuses while keeping purchased growth and item cooldowns', () => {
  const g = make(); buy(g, 'attr_health'); buy(g, 'attr_power'); buy(g, 'attr_speed');
  buy(g, 'arcane_crown'); near(g.player.power, 1.3); near(g.player.recovery, 1.15);
  buy(g, 'vital_seed'); near(g.player.power, 1.1); assert.equal(g.player.recovery, 1); assert.equal(g.player.maxHp, 180);
  buy(g, 'wind_boots'); assert.equal(g.player.maxHp, 140); assert.ok(g.player.hp <= 140); near(g.player.speed, 220 * 1.28);
  g.equipmentCooldowns.bkb = 12; buy(g, 'bkb'); near(g.player.speed, 220 * 1.08); assert.equal(g.equipmentCooldowns.bkb, 12);
  assert.deepEqual(g.ownedEquipment, ['bkb']); assert.equal(g.equip('wind_boots'), false);
  g.player.bkb = 1; g.shop.stock.push('zhonya'); const gold = g.gold; assert.equal(g.buy('zhonya'), false); assert.equal(g.gold, gold);
});

test('passives cannot activate; replacing bloodstone stops healing and seed stops regen', () => {
  const g = make(); buy(g, 'bloodstone'); g.state = 'playing'; g.player.hp = 50;
  assert.equal(g.useEquipment(), false); assert.equal(g.equipmentCooldowns.bloodstone, 0);
  const e = g.spawnEnemy('normal', { x: 1000, y: 500 }); e.hp = 1000;
  g.damage(e, 100); near(g.player.hp, 52.5);
  g.state = 'shop'; buy(g, 'vital_seed'); g.player.hp = 50; g.state = 'playing'; g.spawnTimer = 9999;
  g.damage(e, 100); near(g.player.hp, 50); g.tick(.05); near(g.player.hp, 50.075);
  g.state = 'shop'; buy(g, 'bkb'); g.state = 'playing'; const hp = g.player.hp; g.tick(.05); near(g.player.hp, hp);
});

test('depleted relic pool shows remaining candidates without duplicates; training exposes all catalogs', () => {
  const g = make(); g.bought = RELICS.slice(1).map(item => item.id); g.shop.open(g);
  assert.equal(g.shop.stock.filter(id => RELICS.some(item => item.id === id)).length, 1);
  g.bought.push(RELICS[0].id); g.relics = [...g.bought]; g.shop.open(g);
  assert.match(shopHTML(g), /未拥有遗物已全部收集/); assert.ok(g.refreshShop());
  g.start(true); g.trainingShop();
  const pages = Array.from({ length: 4 }, (_, page) => shopHTML(g, page));
  const html = pages.join('');
  for (const page of pages) assert.ok((page.match(/<article /g) || []).length <= 9);
  assert.match(pages[0], /data-action="shop-prev" disabled/);
  assert.match(pages.at(-1), /data-action="shop-next" disabled/);
  for (const item of [...ATTRIBUTES, ...RELICS, ...EQUIPMENT]) assert.ok(html.includes(`data-buy="${item.id}"`));
  const gold = g.gold; assert.equal(g.refreshShop(), false); assert.equal(g.gold, gold);
});

test('damage growth scales real sun strike and cold snap proc without mutating base definitions', () => {
  const g = make(); buy(g, 'attr_power'); g.nextWave(); g.chooseRoute('battle'); g.spawnTimer = 9999;
  const e = g.spawnEnemy('normal', { x: 1000, y: 500 }); e.hp = e.maxHp = 2000; e.speed = 0; e.attack = 999;
  for (const key of 'QQQ') g.input(key); assert.ok(g.cast(e));
  g.damage(e, 10); near(e.hp, 2000 - 10 - 18 * 1.1);
  e.snap = 0;
  for (const key of 'EEE') g.input(key); assert.ok(g.cast(e));
  const hp = e.hp; for (let i = 0; i < 22; i++) g.tick(.05); near(e.hp, hp - 480 * 1.1);
  assert.equal(SPELLS.find(s => s.id === 'EEE').cd, 5);
});
