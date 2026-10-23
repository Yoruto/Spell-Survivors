import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { HERO } from '../src/config.js';
import { ActorArt } from '../src/actors.js';
import { SpellVFX } from '../src/vfx.js';

test('every new run uses only Carl and resets movement/cast poses and relics', () => {
  const g=new Game();g.start(); g.chooseRoute('battle');assert.equal(HERO.id,'carl');assert.equal(g.character.name,'小卡尔');assert.equal(g.player.maxHp,120);
  g.move({x:1000,y:500});g.input('Q');g.input('E');g.input('E');g.cast({x:1000,y:500});g.tick(.025);assert.ok(g.player.casting>0);assert.ok(g.player.walk>0);
  g.start(); g.chooseRoute('battle');assert.equal(g.character.id,'carl');assert.equal(g.player.casting,0);assert.equal(g.player.walk,0);assert.equal(g.player.target,null);assert.equal(g.spirits.length,0);
  g.start('warden'); g.chooseRoute('battle');assert.equal(g.character.id,'carl');assert.equal(g.training,false);assert.equal(g.gold,0);
});
test('trial boss can be summoned once, killed without finishing trial, then summoned again', () => {
  const g=new Game();g.start(); g.chooseRoute('battle');assert.equal(g.trainingBoss(),false);g.start(true); g.chooseRoute('battle');assert.ok(g.trainingBoss());assert.equal(g.enemies.filter(e=>e.boss).length,1);assert.equal(g.trainingBoss(),false);
  g.damage(g.boss,99999);g.tick(.025);assert.equal(g.boss,null);assert.equal(g.state,'playing');assert.equal(g.result,null);assert.ok(g.trainingBoss());g.pause();assert.equal(g.trainingBoss(),false);g.start(); g.chooseRoute('battle');assert.equal(g.boss,null);assert.equal(g.enemies.length,0);
});
test('cosmetic cast and boss windup clocks freeze while paused; invalid spell does not animate', () => {
  const g=new Game();g.start(true); g.chooseRoute('battle');g.input('Q');g.input('Q');g.input('Q');assert.equal(g.cast({x:100,y:100}),false);assert.equal(g.player.casting,0);
  for(const key of 'QEE')g.input(key);assert.ok(g.cast({x:900,y:500}));g.trainingBoss();g.tick(.025);const pose=g.player.casting,windup=g.boss.casting;assert.ok(windup>0);g.pause();g.tick(.05);assert.equal(g.player.casting,pose);assert.equal(g.boss.casting,windup);
});
test('unit targeting accepts visible mage hood and commander head, airborne unit remains invalid', () => {
  const g=new Game();g.start(); g.chooseRoute('battle');const priest=g.spawnEnemy('ranged',{x:900,y:500}),boss=g.spawnEnemy('boss',{x:1100,y:500});
  assert.equal(g.enemyAt({x:900,y:467}),priest);assert.equal(g.enemyAt({x:1100,y:435}),boss);priest.air=1;assert.equal(g.enemyAt({x:900,y:467}),undefined);
});
test('actor models and foreground effects render all facings, action poses and boss phases with finite coordinates', () => {
  let operations=0;const check=(...args)=>{operations++;for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x));};
  const gradient={addColorStop:check},ctx=new Proxy({globalAlpha:1},{get(target,key){if(key in target)return target[key];if(String(key).startsWith('create'))return (...args)=>{check(...args);return gradient;};return check;}});
  const g=new Game(),r={ctx,game:g,circle:check,line:check,diamond:check};r.vfx=new SpellVFX(r);const art=new ActorArt(r);
  for(const facing of[0,Math.PI])for(const casting of[0,.2,.4])for(const ghost of[0,5]){Object.assign(g.player,{facing,casting,ghost,target:{x:900,y:500},walk:1});art.hero(g.player);}
  for(const kind of['normal','elite','ranged','charger','boss'])for(const hp of[2400,800])for(const casting of[0,.5,1.1])for(const facing of[0,Math.PI])for(const swing of[0,.15,.3]){const e={kind,boss:kind==='boss',id:3,hp,maxHp:2400,casting,spawn:1,mana:80,facing,walk:1,swing};art.enemy(e);}
  for(const kind of['bolt','axe'])art.enemyProjectile({kind,x:800,y:500,r:6,dx:1,dy:0});art.heroBeacon(g.player);
  for(const kind of['WEE','EEE','death','danger'])for(const age of[0,.8,1.2,1.6]){const f={kind,pattern:'axe',facing:1,x:800,y:500,age,delay:.7,duration:2,radius:65,fired:age>.7,dx:1,dy:0,traveled:100,color:'#cb88ea',seed:4};r.vfx.foreground(f);r.vfx.effect(f);}
  assert.ok(operations>1000);
});
test('sword swing is tied to committed melee attacks and freezes on pause', () => {
  const g=new Game();g.start(); g.chooseRoute('battle');g.spawnTimer=999;const e=g.spawnEnemy('normal',{x:810,y:500});e.spawn=0;e.attack=0;e.speed=0;g.tick(.025);for(let i=0;i<16;i++)g.tick(.025);assert.equal(g.player.hp,110);assert.equal(e.swing,.3);
  g.pause();g.tick(.05);assert.equal(e.swing,.3);g.pause();e.swing=0;e.attack=0;e.disarm=2;g.tick(.025);assert.equal(e.swing,0);assert.equal(g.player.hp,110);
});
test('commander ultimate uses a locked ground telegraph while disarmed; mage bolts retain their values', () => {
  const g=new Game();g.start(true);g.spawnTimer=999;g.trainingBoss();g.boss.spawn=0;g.boss.mana=100;g.boss.disarm=3;g.tick(.025);
  assert.equal(g.enemyShots.length,0);
  const danger=g.effects.find(f=>f.kind==='boss-zone');assert.equal(danger.label,'淘汰之刃');assert.equal(danger.delay,1.2);assert.equal(danger.radius,100);
  const mage=g.spawnEnemy('ranged',{x:1000,y:500});mage.spawn=0;mage.attack=0;for(let i=0;i<25;i++)g.tick(.025);const bolt=g.enemyShots.find(s=>s.kind==='bolt');assert.ok(bolt);assert.equal(bolt.speed,175);assert.equal(bolt.damage,12);assert.equal(mage.mana,80);
});
