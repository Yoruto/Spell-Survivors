import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { encounterPlan } from '../src/run.js';

const make = (kind = 'battle') => {
  const g = new Game(() => .5); g.start(); g.chooseRoute(kind); g.player.hp = g.player.maxHp = 100000;
  return g;
};

test('elapsed time never clears a combat node while an enemy is alive', () => {
  const g = make(); g.pendingEnemies = 0;
  const enemy = g.spawnEnemy('normal', { x: 1200, y: 500 }); enemy.speed = 0;
  g.waveTime = 1000; g.tick(.05); assert.equal(g.state, 'playing'); assert.equal(g.run.completed, 0);
  g.completeEncounter(); assert.equal(g.state, 'playing');
  g.damage(enemy, 99999); g.tick(.05);
  assert.equal(g.state, 'shop'); assert.equal(g.run.completed, 1); assert.equal(g.kills, 1);
  assert.equal(g.gold, 38); assert.ok(g.waveTime > 1000);
  const gold = g.gold; g.tick(.05); assert.equal(g.gold, gold);
});

test('temporary empty field waits for finite reinforcements and clears without a timer minimum', () => {
  const g = make(); const total = encounterPlan('battle', 1).total;
  assert.equal(g.remainingEnemies, total);
  g.spawnTimer = 10; g.tick(.05); assert.equal(g.state, 'playing');
  for (let i = 0; i < total; i++) {
    g.spawnTimer = 0; g.tick(.01); assert.equal(g.enemies.length, 1);
    g.damage(g.enemies[0], 99999); g.tick(.01);
    assert.equal(g.state, i === total - 1 ? 'shop' : 'playing');
  }
  assert.equal(g.kills, total); assert.equal(g.encounterKills, total);
  assert.equal(g.pendingEnemies, 0); assert.equal(g.remainingEnemies, 0); assert.ok(g.waveTime < 1);
});

test('elite kill alone cannot clear the remaining regular enemies', () => {
  const g = make('elite'); const elite = g.enemies[0]; g.spawnTimer = 9999;
  assert.equal(elite.kind, 'elite'); g.damage(elite, 99999); g.tick(.01);
  assert.equal(g.state, 'playing'); assert.equal(g.remainingEnemies, g.pendingEnemies);
  g.pendingEnemies = 0;
  const survivor = g.spawnEnemy('ranged', { x: 1200, y: 500 }); survivor.speed = 0;
  g.tick(.01); assert.equal(g.state, 'playing');
  g.damage(survivor, 99999); g.tick(.01); assert.equal(g.state, 'shop'); assert.equal(g.run.completed, 1);
});

test('Boss death waits for every other enemy, then advances the round exactly once', () => {
  const g = make(); g.run.completed = 5; g.run.current = null; g.state = 'shop'; g.nextWave();
  const minion = g.spawnEnemy('normal', { x: 1200, y: 500 }); minion.speed = 0;
  g.damage(g.boss, 99999); g.tick(.01);
  assert.equal(g.state, 'playing'); assert.equal(g.run.round, 1); assert.equal(g.remainingEnemies, 1);
  g.damage(minion, 99999); g.tick(.01);
  assert.equal(g.state, 'shop'); assert.equal(g.run.round, 2); assert.equal(g.run.history.length, 1);
  assert.equal(g.kills, 2); assert.equal(g.gold, 203);
});

test('pausing freezes reinforcements; player death cannot award a completed node', () => {
  const g = make(); const pending = g.pendingEnemies; g.pause(); g.tick(.05);
  assert.equal(g.pendingEnemies, pending); assert.equal(g.waveTime, 0); g.pause();
  g.pendingEnemies = 0; g.hurt(g.player, 999999); g.tick(.05);
  assert.equal(g.state, 'dead'); assert.equal(g.run.completed, 0); assert.equal(g.gold, 0);
});
