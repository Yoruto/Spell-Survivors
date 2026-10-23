import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { SPELLS, RELICS } from '../src/config.js';
import { RunProgress } from '../src/run.js';
import { resolveSpellStats } from '../src/spell-rules.js';
import { shopHTML, routeHTML } from '../src/progression-view.js';

const make = () => { const g = new Game(() => .5); g.start(); return g; };
const cast = (g, id, point) => { for (const key of id) g.input(key); return g.cast(point); };
const grant = (g, ...ids) => {
  g.state = 'shop'; g.shop.stock = ids; g.gold = 9999;
  for (const id of ids) assert.ok(g.buy(id));
  g.state = 'route'; g.chooseRoute('battle'); g.spawnTimer = 9999;
};

test('each round has exactly five selections; completion cannot repeat; two bosses finish', () => {
  const run = new RunProgress();
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < 5; i++) {
      assert.ok(run.select(['battle', 'elite', 'event'][i % 3]));
      assert.equal(run.select('event'), false); assert.notEqual(run.complete(), null);
      assert.equal(run.complete(), null);
    }
    assert.ok(run.bossDue); assert.equal(run.select('battle'), false);
    assert.ok(run.startBoss()); assert.equal(run.startBoss(), false); assert.equal(run.complete(), 100);
    assert.equal(run.complete(), null);
  }
  assert.ok(run.finished); assert.equal(run.select('event'), false); assert.equal(run.history.length, 12);
});

test('route and event freeze combat, accept one reward and count exactly one node', () => {
  const g = make(); assert.equal(g.state, 'route'); g.tick(1); assert.equal(g.time, 0);
  assert.equal(cast(g, 'EEE', { x: 900, y: 500 }), false); assert.equal(g.chooseRoute('invalid'), false);
  assert.ok(g.chooseRoute('event')); g.tick(.05); assert.equal(g.time, 0);
  assert.equal(g.resolveEvent('invalid'), false); assert.ok(g.resolveEvent('gold'));
  assert.equal(g.gold, 30); assert.equal(g.run.completed, 1); assert.equal(g.resolveEvent('gold'), false);
  g.completeEncounter(); assert.equal(g.gold, 30); g.nextWave(); g.player.hp = 10;
  g.chooseRoute('event'); g.resolveEvent('heal'); assert.equal(g.player.hp, 80); assert.equal(g.run.completed, 2);
});

test('all-event path still leads through both bosses, first boss never ends run', () => {
  const g = make();
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < 5; i++) { g.chooseRoute('event'); g.resolveEvent('gold'); g.nextWave(); }
    assert.equal(g.run.current, 'boss'); assert.equal(g.boss.maxHp, 2400 * round);
    g.damage(g.boss, 99999); g.tick(.01);
    assert.equal(g.state, round === 1 ? 'shop' : 'victory');
    if (round === 1) { assert.equal(g.run.round, 2); assert.equal(g.run.completed, 0); g.nextWave(); }
  }
});

test('boundaries bank loot, clear temporary actors and keep persistent growth and cooldowns', () => {
  const g = make(); g.chooseRoute('elite'); assert.ok(g.enemies.some(e => e.kind === 'elite'));
  g.drops.push({ x: 0, y: 0, value: 7 }); g.player.bkb = 4; g.player.buff = 3;
  g.equipmentCooldowns.blink = 5; g.cooldowns.EEE = 3; cast(g, 'QEE', { x: 900, y: 500 });
  g.pendingEnemies = 0; for (const e of g.enemies) g.damage(e, 99999); g.tick(.01); assert.equal(g.gold, 107); assert.equal(g.totalGold, 107);
  assert.equal(g.enemies.length, 0); assert.equal(g.spirits.length, 0); assert.equal(g.player.bkb, 0);
  const cd = g.cooldowns.EEE; g.tick(.05); assert.equal(g.cooldowns.EEE, cd);
  g.nextWave(); g.chooseRoute('battle'); assert.equal(g.cooldowns.EEE, cd); assert.ok(g.equipmentCooldowns.blink > 4);
});

test('shop stock, refresh prices, funds, unique purchases and reset are enforced', () => {
  const g = make(); g.chooseRoute('event'); g.resolveEvent('gold');
  assert.equal(g.shop.stock.length, 9); assert.equal(new Set(g.shop.stock).size, 9);
  assert.equal(g.shop.refreshCost, 10); assert.ok(g.refreshShop()); assert.equal(g.gold, 20); assert.equal(g.shop.refreshCost, 15);
  g.gold = 14; const stock = [...g.shop.stock]; assert.equal(g.refreshShop(), false); assert.deepEqual(g.shop.stock, stock);
  g.gold = 100; const id = g.shop.stock.find(id => RELICS.some(r => r.id === id));
  assert.ok(g.buy(id)); assert.equal(g.buy(id), false); assert.equal(g.shop.stock.includes(id), false);
  assert.equal(g.buy('power'), false); assert.equal(g.buy('echo_weave', true), false);
  g.nextWave(); assert.equal(g.refreshShop(), false); g.chooseRoute('event'); g.resolveEvent('gold'); assert.equal(g.shop.refreshCost, 10);
  assert.equal(g.shop.stock.includes(id), false); g.start(); assert.equal(g.modifiers.length, 0); assert.equal(g.lastReward, 0);
});

test('tag modifiers match all tags, stack without mutating base, exclude buffs and summons', () => {
  const s = SPELLS.find(s => s.id === 'WWW'), base = s.radius;
  const stats = resolveSpellStats(s, ['emp_vortex'], [{ tags: ['area'], areaAdd: .25 }, { tags: ['fire'], areaAdd: 10 }, { tags: ['area', 'ground'], extraCasts: 1 }]);
  assert.equal(stats.radius, 218.75); assert.equal(stats.castCount, 2); assert.equal(s.radius, base);
  for (const id of ['QQQ', 'QQW', 'WWE', 'QEE']) assert.equal(resolveSpellStats(SPELLS.find(s => s.id === id), [], [{ extraCasts: 5 }]).castCount, 1);
});

test('area boost changes real hit radius; multicast consumes one cooldown and deals independent damage', () => {
  const g = make(); grant(g, 'attr_area', 'echo_weave');
  const e = g.spawnEnemy('normal', { x: 1095, y: 500 }); e.hp = e.maxHp = 1000; e.speed = 0; e.attack = 999;
  assert.ok(cast(g, 'EEE', { x: 1000, y: 500 })); assert.equal(g.castCount, 1); assert.equal(g.cooldowns.EEE, 5);
  assert.equal(g.effects.filter(f => f.kind === 'EEE').length, 2); assert.ok(Math.abs(g.effects[0].radius - 96.8) < 1e-9);
  for (let i = 0; i < 22; i++) g.tick(.05); assert.equal(e.hp, 40);
});

test('shape relic and multicast compose as six independent meteors; summons stay single', () => {
  const g = make(); grant(g, 'meteor_triad', 'echo_weave', 'attr_area');
  cast(g, 'WEE', { x: 1000, y: 500 }); const meteors = g.effects.filter(f => f.kind === 'WEE');
  assert.equal(meteors.length, 6); assert.equal(new Set(meteors.map(m => m.ticks)).size, 6); assert.equal(meteors[0].radius, 71.5);
  cast(g, 'QEE', { x: 1000, y: 500 }); assert.equal(g.spirits.length, 1);
});

test('presentation shows three categories, purchased cards and one equipment slot', () => {
  const g = make(); assert.match(routeHTML(g), /事件/); g.chooseRoute('event'); g.resolveEvent('gold');
  g.shop.stock = ['attr_area', 'meteor_triad', 'bkb'];
  const html = shopHTML(g);
  for (const category of ['attributes', 'relics', 'equipment']) assert.match(html, new RegExp(`data-category="${category}"`));
  assert.match(html, /范围扩张/); assert.match(html, /天坠神杖/); assert.match(html, /替换：闪烁匕首/);
  assert.doesNotMatch(html, /data-equip|data-buy="blink"|data-shop-tab/);
  g.gold = 100; g.buy('attr_area'); assert.match(shopHTML(g), /data-buy="attr_area" disabled>已购买/);
});
