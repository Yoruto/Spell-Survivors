import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, resolveSpell, distance } from '../src/game.js';
import { SPELLS } from '../src/config.js';
const make = () => { const g = new Game(() => .5); g.start(); g.chooseRoute('battle'); g.spawnTimer = 9999; return g; };
const select = (g, id) => { for (const e of id) g.input(e); };
const cast = (g, id, point = { x: 950, y: 500 }) => { select(g, id); return g.cast(point); };
const advance = (g, t) => { for (let i = 0; i < Math.round(t / .025); i++) g.tick(.025); };
const dummy = (g, pos = { x: 950, y: 500 }, boss = false) => { const e = g.spawnEnemy(boss ? 'boss' : 'normal', pos); e.hp = e.maxHp = 10000; e.speed = 0; e.attack = 999; e.phase = 999; return e; };
test('all 27 ordered queues resolve to exactly ten spells; FIFO keeps the last three', () => {
  const ids = new Set(); for (const a of 'QWE') for (const b of 'QWE') for (const c of 'QWE') ids.add(resolveSpell([a, b, c]).id);
  assert.equal(ids.size, 10); const g = make(); select(g, 'QQQW'); assert.deepEqual(g.queue, ['Q', 'Q', 'W']); assert.equal(resolveSpell(g.queue).id, 'QQW'); assert.equal(resolveSpell(['Q']), null);
});
test('all ten spells available at start, no global cooldown, queue preserved', () => {
  for (const s of SPELLS) { const g = make(); dummy(g); assert.equal(cast(g, s.id), true, s.id); assert.equal(g.cooldowns[s.id], s.cd); assert.equal(g.queue.length, 3); }
  const g = make(); assert.ok(cast(g, 'QEE')); assert.ok(cast(g, 'QWE')); assert.ok(cast(g, 'EEE')); assert.equal(cast(g, 'EEE'), false);
});
test('invalid unit target, out of range, incomplete queue and UI casts consume no cooldown', () => {
  const g = make(); assert.equal(g.cast({ x: 900, y: 500 }), false); assert.equal(cast(g, 'QQQ'), false); const e = dummy(g, { x: 1500, y: 500 }); assert.equal(g.cast(e), false); select(g, 'EEE'); assert.equal(g.cast({ x: 900, y: 500 }, false), false); assert.equal(g.cooldowns.EEE, 0); assert.equal(g.cooldowns.QQQ, 0);
});
test('move continues toward last click; cast does not stop movement; world boundaries clamp', () => {
  const g = make(); g.move({ x: 1000, y: 500 }); advance(g, .5); assert.ok(g.player.x > 900); cast(g, 'QEE'); advance(g, .5); assert.equal(g.player.x, 1000); assert.equal(g.player.target, null); g.move({ x: -900, y: 3000 }); assert.deepEqual(g.player.target, { x: 25, y: 975 });
});
test('cold snap triggers on damage at bounded interval without recursion; bosses do not stun', () => {
  const g = make(), e = dummy(g); cast(g, 'QQQ', e); g.damage(e, 10); assert.equal(e.hp, 9972); g.damage(e, 10); assert.equal(e.hp, 9962); assert.ok(e.stun > 0); advance(g, .6); g.damage(e, 10); assert.equal(e.hp, 9934);
  const boss = dummy(g, { x: 1000, y: 500 }, true); boss.snap = 6; g.damage(boss, 10); assert.equal(boss.hp, 9972); assert.equal(boss.stun, 0);
});
test('ghost persists through movement, elements and failed casts; existing spirits do not reveal', () => {
  const g = make(), e = dummy(g, { x: 930, y: 500 }); cast(g, 'QEE'); cast(g, 'QQW'); g.move({ x: 810, y: 500 }); select(g, 'QQQ'); assert.equal(g.cast({ x: 100, y: 100 }), false); advance(g, .5); assert.ok(g.player.ghost > 0); assert.ok(e.hp < e.maxHp); cast(g, 'QWE'); assert.equal(g.player.ghost, 0);
});
test('ghost is not invulnerability against preexisting projectiles or ground attacks', () => {
  const g = make(); cast(g, 'QQW'); g.enemyShots.push({ x: 800, y: 500, dx: 0, dy: 0, speed: 0, life: 1, r: 5, damage: 12 }); g.tick(.025); assert.equal(g.player.hp, 108);
});
test('ice wall is passable, deals repeated damage and combines slows by maximum; boss slow is halved', () => {
  const g = make(), e = dummy(g, { x: 910, y: 500 }), b = dummy(g, { x: 910, y: 530 }, true); cast(g, 'QQE'); cast(g, 'QQW'); g.move({ x: 1000, y: 500 }); advance(g, 1); assert.ok(e.hp < 9970); assert.equal(e.slow, .65); assert.equal(b.slow, .325); assert.ok(g.player.x > 950);
});
test('tornado grants air invulnerability then landing damage; boss takes damage but stays grounded', () => {
  const g = make(), e = dummy(g, { x: 900, y: 500 }), b = dummy(g, { x: 1000, y: 500 }, true); cast(g, 'QWW'); advance(g, .4); assert.ok(e.air > 0); assert.equal(g.damage(e, 999), 0); assert.equal(b.air, 0); assert.equal(b.hp, 9910); advance(g, 1.4); assert.equal(e.air, 0); assert.equal(e.hp, 9910);
});
test('sun strike divides total by all grounded hit targets, excludes airborne and dead units', () => {
  const g = make(), a = dummy(g), b = dummy(g, { x: 960, y: 510 }), boss = dummy(g, { x: 950, y: 520 }, true), air = dummy(g, { x: 940, y: 510 }); air.air = 2;
  cast(g, 'EEE'); advance(g, 1.05); assert.equal(a.hp, 9840); assert.equal(b.hp, 9840); assert.equal(boss.hp, 9840); assert.equal(air.hp, 10000);
});
test('EMP damages enemies without mana and drains mana from casters', () => {
  const g = make(), e = dummy(g), ranged = g.spawnEnemy('ranged', { x: 960, y: 500 }); ranged.hp = 1000; ranged.attack = 999; ranged.speed = 0; cast(g, 'WWW'); advance(g, 1.5); assert.equal(e.hp, 9875); assert.equal(ranged.hp, 875); assert.equal(ranged.mana, 40);
});
test('ordinary ground spells clamp range; Sun Strike has no range cap; trajectory snapshots mouse', () => {
  const g = make(); const point = { x: 1500, y: 500 }; cast(g, 'WWW', point); assert.equal(g.effects[0].x, 1320); cast(g, 'EEE', point); assert.equal(g.effects[1].x, 1500); cast(g, 'WEE', point); const f = g.effects[2]; point.x = 20; point.y = 20; g.move(point); advance(g, 1); assert.equal(f.dx, 1); assert.equal(f.dy, 0); assert.ok(f.x > 1300); advance(g, 4); assert.ok(!g.effects.includes(f));
});
test('alacrity boosts player cooldown progress only during buff and can separately target spirit', () => {
  const g = make(); cast(g, 'QEE'); cast(g, 'WWE', { x: 700, y: 500 }); advance(g, 1); assert.ok(Math.abs(g.cooldowns.QEE - 8.45) < .01); g.player.buff = 0; const before = g.cooldowns.QEE; advance(g, 1); assert.ok(Math.abs(g.cooldowns.QEE - (before - 1)) < .01);
  g.cooldowns.WWE = 0; cast(g, 'WWE', g.spirits[0]); assert.equal(g.spirits[0].buff, 7); assert.equal(g.player.buff, 0);
});
test('spirit capacity replaces oldest, shop upgrade to two, attacks trigger snap and armor cap', () => {
  const g = make(), e = dummy(g); cast(g, 'QEE'); const old = g.spirits[0]; g.cooldowns.QEE = 0; cast(g, 'QEE'); assert.equal(g.spirits.length, 1); assert.notEqual(g.spirits[0], old); g.state = 'shop'; g.shop.stock = ['spirit']; g.gold = 100; assert.ok(g.buy('spirit')); assert.equal(g.buy('spirit'), false); g.state = 'playing'; g.spawnTimer = 999; g.cooldowns.QEE = 0; cast(g, 'QEE'); assert.equal(g.spirits.length, 2); cast(g, 'QQQ', e); advance(g, 6); assert.equal(e.armor, 5); assert.ok(e.hp < 9600);
});
test('blast knocks back normals; boss position unchanged and disarm duration is halved', () => {
  const g = make(), a = dummy(g, { x: 900, y: 500 }), b = dummy(g, { x: 900, y: 510 }, true); cast(g, 'QWE'); advance(g, .1); assert.ok(a.x > 900); assert.equal(b.x, 900); assert.ok(a.disarm > b.disarm + 1); assert.equal(a.hp, 9920); assert.equal(b.hp, 9920);
});
test('meteor damage has per-target interval, refreshes a single burn and triggers snap', () => {
  const g = make(), e = dummy(g, { x: 910, y: 500 }); cast(g, 'QQQ', e); cast(g, 'WEE', e); advance(g, 1); assert.ok(e.hp < 9950); assert.ok(e.hp > 9800); assert.ok(e.burn > 0 && e.burn <= 3); assert.ok(e.snapNext > 0);
});
test('pause, shop and result block all combat inputs and freeze timers', () => {
  for (const state of ['menu', 'paused', 'shop', 'dead', 'victory']) { const g = make(); g.state = state; select(g, 'EEE'); g.move({ x: 900, y: 500 }); assert.equal(g.cast({ x: 900, y: 500 }), false); g.tick(.05); assert.equal(g.time, 0); assert.equal(g.queue.length, 0); assert.equal(g.player.target, null); }
});
test('shop rejects insufficient gold and absent items; leaving shop opens route choice', () => {
  const g = make(); g.pendingEnemies = 0; g.tick(.01); assert.equal(g.state, 'shop'); assert.equal(g.gold, 35);
  assert.equal(g.buy('spirit'), false); assert.equal(g.buy('health'), false);
  g.nextWave(); assert.equal(g.state, 'route'); assert.equal(g.run.completed, 1);
  assert.ok(g.chooseRoute('elite')); assert.equal(g.state, 'playing'); assert.ok(g.enemies.some(e => e.kind === 'elite'));
});

test('boss telegraph hits invisible player; boss spells still execute while disarmed', () => {
  const g = make(), b = g.spawnEnemy('boss', { x: 800, y: 250 }); b.spawn = 0; b.mana = 100; b.disarm = 10;
  g.tick(.025); cast(g, 'QQW'); advance(g, 1.25); assert.equal(g.player.hp, 88); assert.ok(b.ai.recovery > 0);
});
test('death, victory and restart restore complete fresh run state', () => {
  const g = make(); g.hurt(g.player, 999); assert.equal(g.state, 'dead'); assert.equal(g.result.win, false); g.start(); g.chooseRoute('battle'); assert.equal(g.player.hp, 120); assert.equal(g.enemies.length, 0); assert.deepEqual(g.queue, []); assert.equal(g.time, 0); g.run.round = 2; g.run.completed = 5; g.run.current = 'boss'; g.pendingEnemies = 0; g.bossSpawned = true; const b = g.spawnEnemy('boss'); b.hp = 0; g.tick(.025); assert.equal(g.state, 'victory'); assert.equal(g.result.win, true); g.start(); g.chooseRoute('battle'); assert.equal(g.player.hp, 120); assert.equal(g.result, null); assert.equal(g.boss, null); assert.equal(g.gold, 0); assert.equal(g.bought.length, 0);
});
test('seeded two-round run stays bounded through ten routes, both bosses and restart', () => {
  const g = make(); g.player.hp = g.player.maxHp = 100000;
  for (let round = 1; round <= 2; round++) {
    for (let node = 0; node < 5; node++) {
      if (g.state === 'route') g.chooseRoute('battle');
      g.spawnTimer = 0;
      for (let i = 0; i < 1001 && g.state === 'playing'; i++) {
        if (i % 40 === 0) cast(g, 'EEE', g.enemies[0] || { x: 800, y: 500 });
        for (const e of g.enemies) g.damage(e, 99999);
        g.tick(.05); assert.ok(Number.isFinite(g.player.x)); assert.ok(g.enemies.length <= 96);
      }
      assert.equal(g.state, 'shop'); g.nextWave();
    }
    assert.ok(g.bossSpawned); g.damage(g.boss, 99999); g.tick(.05);
    assert.equal(g.state, round === 2 ? 'victory' : 'shop');
    if (round === 1) g.nextWave();
  }
  assert.equal(g.run.history.length, 12); g.start(); assert.equal(g.state, 'route');
  assert.equal(g.enemies.length, 0); assert.equal(distance(g.player, { x: 800, y: 500 }), 0);
});
