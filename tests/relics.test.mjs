import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, distance } from '../src/game.js';
import { ATTRIBUTES } from '../src/attributes.js';
import { EQUIPMENT } from '../src/equipment.js';
import { RELICS } from '../src/config.js';
const make = (...ids) => { const g = new Game(() => .5); g.start(); g.chooseRoute('battle'); g.spawnTimer = 9999; g.state = 'shop'; g.shop.stock = [...RELICS, ...EQUIPMENT].map(r => r.id); g.gold = 9999; for (const id of ids) assert.ok(g.buy(id)); g.state = 'playing'; return g; };
const cast = (g, id, p = { x: 1000, y: 500 }) => { for (const key of id) g.input(key); assert.ok(g.cast(p)); };
const advance = (g, t) => { for (let i = 0; i < Math.round(t / .025); i++) g.tick(.025); };
const enemy = (g, x, y, boss = false) => { const e = g.spawnEnemy(boss ? 'boss' : 'normal', { x, y }); e.speed = 0; e.hp = e.maxHp = 10000; e.attack = e.phase = 999; return e; };
test('all twelve mechanism relics purchasable exactly once; reject forged or unaffordable transactions', () => {
  const g = make(); g.state = 'shop'; assert.equal(RELICS.length, 12); const before = g.gold;
  for (const r of RELICS) { assert.ok(g.buy(r.id)); assert.equal(g.buy(r.id), false); }
  assert.equal(g.gold, before - RELICS.reduce((n, r) => n + r.cost, 0)); assert.equal(g.relics.length, 12);
  g.start(); g.chooseRoute('battle'); g.state = 'shop'; assert.equal(g.buy('meteor_triad'), false); assert.equal(g.buy('not-a-relic'), false); assert.equal(g.relics.length, 0);
});
test('normal shops use gold only and reject free claims or absent stock', () => {
  const g = make(); g.pendingEnemies = 0; g.tick(.025);
  assert.equal(g.modifiers.length, 0); assert.equal(g.buy('meteor_triad', true), false);
  assert.equal(g.buy('power'), false); const id = g.shop.stock[0];
  const item = [...RELICS, ...EQUIPMENT, ...ATTRIBUTES].find(r => r.id === id); g.gold = 100;
  assert.ok(g.buy(id)); assert.equal(g.gold, 100 - item.cost); assert.equal(g.buy(id), false);
});

test('EMP vortex pulls only grounded normals during charge; no pull after explosion or outside radius', () => {
  const g = make('emp_vortex'), a = enemy(g, 1130, 500), b = enemy(g, 1100, 540, true), air = enemy(g, 1110, 530), far = enemy(g, 1200, 500); air.air = 2;
  cast(g, 'WWW'); const f = g.effects[0]; assert.equal(f.radius, 175); advance(g, .5); assert.ok(a.x < 1050); assert.equal(b.x, 1100); assert.equal(air.x, 1110); assert.equal(far.x, 1200); advance(g, 1); const x = a.x; advance(g, .3); assert.equal(a.x, x); assert.equal(a.hp, 9875); assert.equal(b.hp, 9875);
});
test('triple meteors snapshot three parallel lanes, each damages and refreshes a single burn', () => {
  const g = make('meteor_triad'); const enemies = [410, 500, 590].map(y => enemy(g, 1000, y)); const mouse = { x: 1000, y: 500 }; cast(g, 'WEE', mouse);
  const meteors = g.effects.filter(f => f.kind === 'WEE'); assert.equal(meteors.length, 3); assert.deepEqual(meteors.map(f => f.y), [410, 500, 590]); assert.equal(new Set(meteors.map(f => f.ticks)).size, 3);
  mouse.x = 50; mouse.y = 50; g.move(mouse); advance(g, 1); for (const e of enemies) { assert.ok(e.hp < 10000); assert.ok(e.burn <= 3); } for (const f of meteors) { assert.equal(f.dx, 1); assert.equal(f.dy, 0); }
});
test('radial blast covers 360 degrees without duplicate damage, preserves boss immunity and disarm', () => {
  const g = make('blast_radial'), targets = Array.from({ length: 12 }, (_, i) => enemy(g, 800 + Math.cos(i * Math.PI / 6) * 170, 500 + Math.sin(i * Math.PI / 6) * 170));
  const boss = enemy(g, 1000, 500, true); cast(g, 'QWE'); assert.equal(g.shots.length, 1); advance(g, .6);
  for (const e of targets) { assert.equal(e.hp, 9920); assert.ok(distance(e, { x: 800, y: 500 }) > 230); assert.ok(e.disarm > 0); } assert.equal(boss.x, 1000); assert.equal(boss.hp, 9920); assert.ok(boss.disarm < targets[0].disarm);
  advance(g, 1); for (const e of targets) assert.equal(e.hp, 9920);
});
test('cataclysm creates fixed three sun strikes; each independently shares damage and skips air', () => {
  const g = make('solar_cataclysm'), a = enemy(g, 1000, 500), b = enemy(g, 1000, 500), air = enemy(g, 1000, 500); air.air = 2; cast(g, 'EEE');
  const strikes = g.effects.filter(f => f.kind === 'EEE'); assert.equal(strikes.length, 3); assert.deepEqual(strikes.map(f => f.y), [395, 500, 605]); advance(g, 1.05); assert.equal(a.hp, 9760); assert.equal(b.hp, 9760); assert.equal(air.hp, 10000);
});
test('cold snap relic boosts procs without recursion, interval is enforced', () => {
  const g = make('snap_frost'), e = enemy(g, 1000, 500); cast(g, 'QQQ', e); g.damage(e, 10); assert.equal(e.hp, 9954); g.damage(e, 10); assert.equal(e.hp, 9944); advance(g, .4); g.damage(e, 10); assert.equal(e.hp, 9898);
});
test('ghost relic heals and moves faster while hidden; successful cast still breaks invisibility', () => {
  const g = make('ghost_shroud'); g.player.hp = 60; cast(g, 'QQW'); assert.equal(g.player.ghost, 8); g.move({ x: 1300, y: 500 }); advance(g, 1); assert.ok(Math.abs(g.player.hp - 63) < .01); assert.ok(Math.abs(g.player.x - 1119) < .01); cast(g, 'QEE'); assert.equal(g.player.ghost, 0);
});
test('glacier relic expands actual hit region and stronger slow respects boss resistance', () => {
  const g = make('wall_glacier'), a = enemy(g, 910, 690), b = enemy(g, 910, 310, true); cast(g, 'QQE'); advance(g, .1); const wall = g.effects.find(f => f.kind === 'QQE'); assert.equal(wall.duration, 9); assert.equal(a.slow, .8); assert.equal(b.slow, .4); assert.ok(a.hp < 10000);
});
test('tornado relic changes range, width and independent cooldown without altering air immunity', () => {
  const g = make('tornado_gale'); cast(g, 'QWW'); assert.equal(g.cooldowns.QWW, 4.5); assert.equal(g.shots[0].range, 845); assert.equal(g.shots[0].r, 50.4); assert.equal(g.cooldowns.QWE, 0);
});
test('alacrity relic applies to actual selected beneficiary with enhanced stats', () => {
  const g = make('alacrity_surge'); cast(g, 'QEE'); cast(g, 'WWE', { x: 600, y: 500 }); assert.equal(g.player.buff, 10); assert.equal(g.player.buffPower, 1.65); advance(g, 1); assert.ok(Math.abs(g.cooldowns.QEE - 8.2) < .01);
  g.player.buff = 0; g.cooldowns.WWE = 0; cast(g, 'WWE', g.spirits[0]); assert.equal(g.player.buff, 0); assert.equal(g.spirits[0].buffAttack, 45); assert.equal(g.spirits[0].buffInterval, .32);
});
test('spirit splash procs cold snap but airborne nearby units are immune; armor remains bounded', () => {
  const g = make('spirit', 'spirit_cinder'), a = enemy(g, 930, 500), b = enemy(g, 970, 500), air = enemy(g, 970, 510); air.air = 2;
  cast(g, 'QQQ', b); cast(g, 'QEE'); advance(g, .1); assert.ok(a.hp < 10000); assert.equal(b.hp, 10000 - 22 * .4 - 18); assert.equal(air.hp, 10000); assert.equal(g.player.spiritCap, 2);
});
test('bloodstone uses effective damage, no overkill or air healing, does not exceed max health', () => {
  const g = make('bloodstone'), e = enemy(g, 1000, 500); e.hp = 20; g.player.hp = 50; g.damage(e, 1000); assert.equal(g.player.hp, 50.5); const air = enemy(g, 1100, 500); air.air = 2; g.damage(air, 100); assert.equal(g.player.hp, 50.5); g.player.hp = 119; air.air = 0; g.damage(air, 1000); assert.equal(g.player.hp, 120);
});
test('passive gear is exclusive, applies regen and pickup, and reset clears growth', () => {
  const g = make('vital_seed'); assert.equal(g.player.maxHp, 160);
  g.player.hp = 50; advance(g, 1); assert.ok(Math.abs(g.player.hp - 51.5) < .01);
  g.state = 'shop'; assert.ok(g.buy('arcane_crown')); assert.equal(g.player.maxHp, 120);
  assert.equal(g.player.power, 1.2); assert.equal(g.player.recovery, 1.15);
  assert.ok(g.buy('wind_boots')); assert.equal(g.player.power, 1); assert.equal(g.player.recovery, 1); assert.equal(g.player.speed, 264);
  g.state = 'playing'; g.drops.push({ x: 1000, y: 500, value: 3 }); const gold = g.gold, hp = g.player.hp;
  advance(g, 1); assert.equal(g.player.hp, hp); assert.equal(g.gold, gold + 3);
  g.start(); g.chooseRoute('battle'); assert.equal(g.player.maxHp, 120); assert.equal(g.player.speed, 220); assert.equal(g.relics.length, 0); assert.equal(g.player.recovery, 1); assert.equal(g.modifiers.length, 0);
});

test('training explicitly grants immunity and shop access, without progressing normal waves', () => {
  const g = new Game(); g.start(true); g.chooseRoute('battle'); assert.equal(g.gold, 9999); g.hurt(g.player, 1000); assert.equal(g.player.hp, 120); g.waveTime = 200; g.tick(.025); assert.equal(g.state, 'playing'); assert.equal(g.bossSpawned, false); g.trainingShop(); assert.ok(g.buy('meteor_triad')); g.nextWave(); assert.equal(g.wave, 1); assert.equal(g.state, 'playing'); g.start(); g.chooseRoute('battle'); assert.equal(g.training, false); g.hurt(g.player, 1000); assert.equal(g.state, 'dead');
});
