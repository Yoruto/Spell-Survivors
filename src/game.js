import { WORLD, SPELLS, HERO } from './config.js';
import { EQUIPMENT, equipmentById } from './equipment.js';
import { distance, bounded, normalized } from './geometry.js';
import { executeSpell } from './spell-executor.js';
import { resolveSpellStats } from './spell-rules.js';
import { RunProgress, encounterPlan } from './run.js';
import { Shop } from './shop.js';
import { attributeModifiers, rebuildGrowth } from './attributes.js';
import { ENEMY_DEFINITIONS, reinforcementKind } from './enemy-definitions.js';
import { initEnemy, tickEnemy, interruptEnemy } from './enemy-ai.js';
import { BOSSES, initBoss, tickBoss, tickBossEffect, bossDamageMultiplier, onBossDamaged } from './bosses.js';
export { distance };
export const resolveSpell = queue => queue.length === 3 ? SPELLS.find(s => s.id === [...queue].sort((a, b) => 'QWE'.indexOf(a) - 'QWE'.indexOf(b)).join('')) : null;
export class Game {
  constructor(random = Math.random) { this.random = random; this.state = 'menu'; this.listeners = []; this.reset(); }
  reset() {
    const c = HERO;
    this.run = new RunProgress(); this.shop = new Shop(this.random); this.modifiers = []; this.boundPoint = bounded;
    this.player = { x: 800, y: 500, r: 17, hp: c.hp, maxHp: c.hp, speed: c.speed, power: c.power, color: c.color, recovery: 1, spiritCap: 1, ghost: 0, buff: 0, invulnerable: 0, target: null };
    this.character = c; this.queue = []; this.cooldowns = Object.fromEntries(SPELLS.map(s => [s.id, 0]));
    this.time = 0; this.waveTime = 0; this.wave = 1; this.kills = 0; this.gold = 0; this.totalGold = 0; this.castCount = 0; this.lastReward = 0; this.pendingEnemies = 0; this.encounterTotal = 0; this.encounterKills = 0;
    this.enemies = []; this.spirits = []; this.effects = []; this.shots = []; this.enemyShots = []; this.drops = []; this.texts = [];
    this.spawnTimer = 0.8; this.reinforcementsSpawned = 0; this.boss = null; this.bossSpawned = false; this.bought = []; this.feedback = '输入三个元素，再按 R 施放法术'; this.feedbackUntil = 5;
    this.lastVisible = { x: 800, y: 500 }; this.nextId = 1; this.result = null;
    this.relics = []; this.attributeLevels = {}; this.training = false;
    this.equipment = null; this.ownedEquipment = []; this.equipmentCooldowns = Object.fromEntries(EQUIPMENT.map(item => [item.id, 0]));
    Object.assign(this.player, { bkb: 0, stasis: 0, stun: 0, root: 0, silence: 0, slow: 0, slowTime: 0 });
    this.player.facing = 0; this.player.walk = 0; this.player.casting = 0; this.player.castColor = '#d9b7ff';
  }
  start(training = false, equipment = 'blink') { this.reset(); this.equipment = equipmentById(equipment)?.id || 'blink'; this.ownedEquipment = [this.equipment]; rebuildGrowth(this); this.player.hp = this.player.maxHp; this.training = training === true; if (this.training) this.gold = 9999; this.state = this.training ? 'playing' : 'route'; this.notify(); }
  trainingShop() { if (!this.training || this.state !== 'playing') return; this.shop.open(this); this.state = 'shop'; this.player.target = null; this.notify(); }
  trainingSquad() {
    if (!this.training || this.state !== 'playing' || this.enemies.length > 90) return false;
    for (const [i, kind] of ['normal', 'normal', 'ranged', 'charger'].entries()) {
      this.spawnEnemy(kind, bounded({ x: this.player.x + 260, y: this.player.y - 120 + i * 80 }));
    }
    this.message('赤旗小队 · 剑盾兵抬剑后挥砍，法师施法与回能，突击兵沿预警冲锋'); return true;
  }
  trainingBoss(type = 'axe') {
    if (!this.training || this.state !== 'playing' || this.boss?.hp > 0) return false;
    if (!BOSSES[type]) return false;
    this.enemies = []; this.enemyShots = [];
    this.spawnEnemy('boss', bounded({ x: this.player.x + 240, y: this.player.y - 80 }), type);
    this.message(`${this.boss.name}已召唤 · 满蓝释放大招，半血进入狂暴`); return true;
  }
  notify() { for (const cb of this.listeners) cb(this); }
  message(text) { this.feedback = text; this.feedbackUntil = this.time + 3; this.notify(); }
  input(element) { if (this.state !== 'playing' || this.player.stasis > 0 || this.player.stun > 0) return; this.queue.push(element); if (this.queue.length > 3) this.queue.shift(); this.notify(); }
  move(point) { if (this.state === 'playing' && this.player.stasis <= 0 && this.player.stun <= 0 && this.player.root <= 0) this.player.target = bounded(point); }
  equip(id) {
    if (this.state !== 'shop' || !this.ownedEquipment.includes(id) || this.player.stasis > 0 || this.player.bkb > 0) return false;
    if (id !== this.equipment) return false;
    this.notify(); return true;
  }
  control(target, kind, duration, strength = .25) {
    if (!['stun', 'root', 'silence', 'slow'].includes(kind) || target.hp <= 0 || target.stasis > 0 || target.bkb > 0) return false;
    if (kind === 'slow') { target.slowAmount = Math.max(target.slowAmount || 0, strength); target.slow = target.slowAmount; target.slowTime = Math.max(target.slowTime || 0, duration); }
    else { target[kind] = Math.max(target[kind] || 0, duration); if (kind !== 'silence') target.target = null; interruptEnemy(target, kind); }
    return true;
  }
  useEquipment(mouse, valid = true) {
    if (this.state !== 'playing' || this.player.stasis > 0) return false;
    const item = equipmentById(this.equipment), p = this.player;
    const fail = text => { this.message(text); return false; };
    if (!item) return fail('尚未装备主动装备');
    if (item.kind === 'passive') return fail(`${item.name} · 被动生效，无需使用`);
    if (this.equipmentCooldowns[item.id] > 0) return fail(`${item.name}还需 ${this.equipmentCooldowns[item.id].toFixed(1)} 秒`);
    // BKB can break control. Other items cannot be activated while stunned.
    if (p.stun > 0 && item.id !== 'bkb') return fail('眩晕期间无法使用此装备');
    if (item.id === 'blink') {
      if (p.root > 0) return fail('定身期间无法闪烁');
      if (!valid || !Number.isFinite(mouse?.x) || !Number.isFinite(mouse?.y)) return fail('闪烁匕首：请将鼠标移回战场');
      const d = distance(p, mouse);
      if (d < 1) return fail('闪烁匕首：请选择一个落点');
      const dir = normalized(p, mouse), point = bounded({ x: p.x + dir.x * Math.min(d, item.range), y: p.y + dir.y * Math.min(d, item.range) });
      if (distance(p, point) < 1) return fail('闪烁匕首：该方向已到地图边缘');
      this.effects.push({ kind: 'equipment-blink', x: p.x, y: p.y, tx: point.x, ty: point.y, age: 0, duration: .5, color: item.color });
      Object.assign(p, point); p.target = null; p.facing = Math.atan2(dir.y, dir.x);
    } else if (item.id === 'bkb') {
      p.bkb = item.duration; p.stun = p.root = p.silence = p.slow = p.slowTime = p.slowAmount = 0;
    } else if (item.id === 'zhonya') {
      p.stasis = item.duration; p.stasisPoseTime = this.time; p.target = null; p.casting = 0;
    } else if (item.id === 'shiva') {
      for (const e of this.enemies) if (e.hp > 0 && !e.air && distance(p, e) <= item.radius + e.r) {
        this.damage(e, 70, p.power, 'equipment'); this.control(e, 'slow', 4, .5);
      }
    } else if (item.id === 'mek') {
      if (p.hp >= p.maxHp && !this.spirits.some(a => a.hp > 0 && a.hp < a.maxHp && distance(p, a) <= item.radius)) return fail('附近单位生命已满');
      p.hp = Math.min(p.maxHp, p.hp + 45);
      for (const a of this.spirits) if (a.hp > 0 && distance(p, a) <= item.radius) a.hp = Math.min(a.maxHp, a.hp + 35);
    }
    this.equipmentCooldowns[item.id] = item.cd;
    this.effects.push({ kind: 'equipment-pulse', x: p.x, y: p.y, age: 0, duration: .65, radius: item.radius || 60, color: item.color });
    this.float(p, item.name, item.color); this.message(`已使用 · ${item.name}`); return true;
  }
  pause() { if (this.state === 'playing') this.state = 'paused'; else if (this.state === 'paused') this.state = 'playing'; this.notify(); }
  hasRelic(id) { return this.relics.includes(id); }
  buy(id, free = false) { const result = this.state === 'shop' && this.shop.buy(this, id, free); if (result) this.notify(); return !!result; }
  refreshShop() { const result = this.state === 'shop' && this.shop.refresh(this); if (result) this.notify(); return !!result; }
  nextWave() {
    if (this.state !== 'shop') return false;
    if (this.training) this.state = 'playing';
    else if (this.run.bossDue) { this.run.startBoss(); this.beginEncounter('boss'); }
    else this.state = 'route';
    this.notify(); return true;
  }
  chooseRoute(kind) {
    if (this.state !== 'route' || !this.run.select(kind)) return false;
    this.beginEncounter(kind); this.notify(); return true;
  }
  get remainingEnemies() { return this.pendingEnemies + this.enemies.filter(e => e.hp > 0).length; }
  beginEncounter(kind) {
    this.clearEncounter(); this.wave = this.run.difficulty; this.waveTime = 0; this.spawnTimer = 0; this.reinforcementsSpawned = 0;
    const plan = encounterPlan(kind, this.run.difficulty);
    this.pendingEnemies = plan.reinforcements; this.encounterTotal = plan.total; this.encounterKills = 0;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    this.state = kind === 'event' ? 'event' : 'playing';
    if (kind === 'boss') { this.bossSpawned = true; this.spawnEnemy('boss', bounded({ x: this.player.x, y: this.player.y - 260 })); }
    if (kind === 'elite') this.spawnEnemy('elite', bounded({ x: this.player.x + 260, y: this.player.y }));
  }
  clearEncounter() {
    this.enemies = []; this.effects = []; this.shots = []; this.enemyShots = []; this.drops = []; this.texts = []; this.spirits = [];
    this.boss = null; this.bossSpawned = false; this.player.target = null; this.pendingEnemies = 0;
    // Temporary combat states expire at the boundary; independent cooldowns persist.
    for (const key of ['ghost', 'buff', 'stun', 'root', 'silence', 'slow', 'slowAmount', 'slowTime', 'bkb', 'stasis', 'invulnerable', 'casting']) this.player[key] = 0;
  }
  resolveEvent(choice) {
    if (this.state !== 'event' || !['gold', 'heal'].includes(choice)) return false;
    if (choice === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    this.completeEncounter(choice === 'gold' ? 30 : 0); return true;
  }
  completeEncounter(bonusGold = 0) {
    if (!['playing', 'event'].includes(this.state)) return;
    if (this.state === 'playing' && (this.training || this.remainingEnemies > 0)) return;
    const reward = this.run.complete();
    if (reward === null) return;
    // Bank remaining loot before clearing the scene so rewards cannot be lost.
    for (const drop of this.drops) { this.gold += drop.value; this.totalGold += drop.value; }
    this.gold += reward + bonusGold; this.totalGold += reward + bonusGold; this.lastReward = reward + bonusGold;
    if (this.run.finished) { this.finish(true); return; }
    this.clearEncounter(); this.shop.open(this); this.state = 'shop'; this.notify();
  }
  spellStats(spell) { return resolveSpellStats(spell, this.relics, [...this.modifiers, ...attributeModifiers(this)]); }
  enemyAt(point) {
    return this.enemies.find(e => e.hp > 0 && !e.air && (distance(e, point) < e.r + 16 ||
      (Math.abs(point.x - e.x) < (e.boss ? 38 : 18) && point.y < e.y && point.y > e.y - (e.boss ? 74 : e.kind === 'ranged' ? 36 : 18))));
  }
  cast(mouse, valid = true) {
    if (this.state !== 'playing' || this.player.stasis > 0 || this.player.stun > 0 || this.player.silence > 0) return false;
    const s = resolveSpell(this.queue), p = this.player;
    const fail = text => { this.message(text); return false; };
    if (!s) return fail('需要三个元素：Q 冰 · W 雷 · E 火');
    if (this.cooldowns[s.id] > 0) return fail(`${s.name}还需 ${this.cooldowns[s.id].toFixed(1)} 秒`);
    if (!valid) return fail('请将鼠标移回战场');
    const target = this.enemyAt(mouse);
    if (s.id === 'QQQ' && (!target || distance(p, target) > this.spellStats(s).range)) return fail('急速冷却：请指向射程内的敌人');
    const origin = { x: p.x, y: p.y }, dir = normalized(origin, mouse);
    const stats = this.spellStats(s), range = stats.range;
    const d = Math.min(distance(origin, mouse), range || Infinity);
    const point = bounded({ x: origin.x + dir.x * d, y: origin.y + dir.y * d });
    const power = p.power * (p.buff > 0 ? (p.buffPower || 1.45) : 1);
    this.cooldowns[s.id] = stats.cooldown; this.castCount++;
    p.facing = Math.atan2(dir.y, dir.x); p.casting = .4; p.castColor = s.color;
    if (p.ghost > 0 && s.id !== 'QQW') { p.ghost = 0; this.float(p, '破隐', '#b7e8e4'); }
    for (let i = 0; i < stats.castCount; i++) executeSpell(this, { spell: s, origin, dir, point, target, mouse, power, stats });
    this.message(`已施放 · ${s.name}`); return true;
  }
  float(point, text, color = '#f6e9c6') { this.texts.push({ x: point.x, y: point.y - 25, text, color, life: 1.1 }); }
  damage(e, amount, power = 1, source = 'spell', snap = true) {
    if (e.hp <= 0 || e.air > 0) return 0;
    const n = amount * power * (1 + (e.armor || 0) * 0.05) * (e.ai ? bossDamageMultiplier(e) : 1);
    const dealt = Math.min(e.hp, n); e.hp -= n; e.flash = 0.12;
    if (e.ai) onBossDamaged(this, e, dealt);
    if (this.equipment === 'bloodstone' && source !== 'equipment') this.player.hp = Math.min(this.player.maxHp, this.player.hp + dealt * .025);
    this.effects.push({ kind: source === 'snap' ? 'frost-hit' : source === 'spirit' ? 'ember-hit' : 'hit', x: e.x, y: e.y, age: 0, duration: .3, radius: e.r, seed: e.id });
    this.float(e, Math.round(n).toString(), source === 'snap' ? '#9bdfff' : '#fff0c2');
    if (snap && e.snap > 0 && e.snapNext <= 0) {
      e.snapNext = e.snapInterval || .55; if (!e.boss) e.stun = Math.max(e.stun || 0, 0.18);
      this.damage(e, e.snapDamage || 18, e.snapPower ?? 1, 'snap', false);
    }
    return n;
  }
  spawnEnemy(kind = 'normal', position, bossType = this.run.round === 2 ? 'timber' : 'axe') {
    const p = this.player, a = this.random() * Math.PI * 2;
    let pos = position;
    if (!pos) {
      // Avoid spawning on top of a player standing against a map edge.
      for (let i = 0; i < 12; i++) {
        pos = bounded({ x: p.x + Math.cos(a + i * Math.PI / 6) * 530, y: p.y + Math.sin(a + i * Math.PI / 6) * 380 });
        if (distance(pos, p) >= 300) break;
      }
    }
    const boss = kind === 'boss', ranged = kind === 'ranged';
    const def = ENEMY_DEFINITIONS[kind] || ENEMY_DEFINITIONS.normal;
    const hp = boss ? BOSSES[bossType].hp : def.hp * (1 + (this.wave - 1) * 0.18);
    const e = { id: this.nextId++, ...pos, kind, boss, name: def.name, r: boss ? 45 : def.radius, hp, maxHp: hp, speed: boss ? 67 : def.speed + (def.speedPerDepth || 0) * this.wave, mana: ranged || boss ? 100 : null, snap: 0, snapNext: 0, air: 0, stun: 0, root: 0, silence: 0, disarm: 0, burn: 0, burnTick: 0, armor: 0, attack: 1, phase: 0, slow: 0 };
    this.enemies.push(e); if (boss) this.boss = e;
    if (boss) initBoss(e, bossType); else initEnemy(e);
    e.spawn = boss ? 1.5 : .5;
    return e;
  }
  hurt(target, amount, type = 'physical') {
    if (this.training && target === this.player) return;
    if (target.hp <= 0 || target.invulnerable > 0 || target.stasis > 0) return;
    if (target.bkb > 0 && type === 'magic') amount *= .2;
    target.hp = Math.max(0, target.hp - amount); target.invulnerable = target === this.player ? 0.55 : 0.15;
    this.float(target, `−${Math.round(amount * 10) / 10}`, '#ff8d9e');
    if (target === this.player && target.hp <= 0) this.finish(false);
  }
  finish(win) { if (this.state !== 'playing') return; this.result = { win, time: this.time, kills: this.kills, gold: this.totalGold, casts: this.castCount }; this.state = win ? 'victory' : 'dead'; this.notify(); }
  tick(dt) {
    if (this.state !== 'playing') return;
    dt = Math.min(dt, 0.05); this.time += dt; this.waveTime += dt;
    const p = this.player;
    for (const item of EQUIPMENT) this.equipmentCooldowns[item.id] = Math.max(0, this.equipmentCooldowns[item.id] - dt);
    for (const s of SPELLS) this.cooldowns[s.id] = Math.max(0, this.cooldowns[s.id] - dt * (p.recovery + (p.buff > 0 ? (p.buffRecovery || .55) : 0)));
    p.hp = Math.min(p.maxHp, p.hp + dt * ((this.equipment === 'vital_seed' ? 1.5 : 0) + (p.ghost > 0 && this.hasRelic('ghost_shroud') ? 3 : 0)));
    const frozen = p.stasis > 0;
    for (const key of ['ghost', 'buff', 'invulnerable', 'casting', 'bkb', 'stasis', 'stun', 'root', 'silence', 'slowTime']) p[key] = Math.max(0, p[key] - dt);
    if (p.slowTime <= 0) p.slow = p.slowAmount = 0;
    if (p.ghost <= 0) this.lastVisible = { x: p.x, y: p.y };
    if (p.target && !frozen && p.stun <= 0 && p.root <= 0) { const d = distance(p, p.target), v = normalized(p, p.target), step = p.speed * dt * (1 - p.slow) * (p.ghost > 0 ? this.hasRelic('ghost_shroud') ? 1.45 : 1.2 : 1); p.walk += dt * 10; if (!p.casting) p.facing = Math.atan2(v.y, v.x); if (d <= step) { p.x = p.target.x; p.y = p.target.y; p.target = null; } else { p.x += v.x * step; p.y += v.y * step; } }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < 95 && ((this.training && !this.boss) || this.pendingEnemies > 0)) {
      this.spawnEnemy(reinforcementKind(this.reinforcementsSpawned++));
      if (!this.training) this.pendingEnemies--;
      this.spawnTimer = Math.max(0.3, 1.25 - this.wave * 0.08);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0 || this.state !== 'playing') continue;
      e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
      if (e.slowTime <= 0) e.slowAmount = 0;
      e.slow = e.slowAmount || 0;
      for (const key of ['snap', 'snapNext', 'stun', 'root', 'silence', 'disarm', 'flash', 'attack', 'casting', 'spawn', 'swing']) e[key] = Math.max(0, (e[key] || 0) - dt);
      if (e.air > 0) { interruptEnemy(e, 'air'); e.air -= dt; if (e.air <= 0) { e.air = 0; this.damage(e, 90, e.airPower); } continue; }
      if (e.burn > 0) { e.burn -= dt; e.burnTick -= dt; if (e.burnTick <= 0) { this.damage(e, 8, e.burnPower); e.burnTick = 0.5; } }
      if (p.ghost > 0 && distance(e, p) < 150) e.slow = Math.max(e.slow, 0.45);
      for (const f of this.effects) if (f.kind === 'QQE' && this.inWall(e, f)) e.slow = Math.max(e.slow, f.slow || .65);
      if (e.boss) e.slow *= 0.5;
      if (e.hp <= 0) continue;
      if (e.boss) { tickBoss(this, e, dt); continue; }
      tickEnemy(this, e, dt);
    }
    for (const f of this.effects) { if (this.state !== 'playing') break; this.tickEffect(f, dt); }
    this.effects = this.effects.filter(f => f.age < f.duration);
    for (const s of this.shots) {
      const step = s.speed * dt; s.previous = s.traveled; s.traveled += step;
      if (!s.radial) { s.x += s.dx * step; s.y += s.dy * step; }
      for (const e of this.enemies) if (e.hp > 0 && !s.hit.has(e.id) && !e.air && (s.radial ? distance(s, e) >= s.previous - (s.ringWidth || 20) - e.r && distance(s, e) <= s.traveled + (s.ringWidth || 20) + e.r : distance(s, e) < s.r + e.r)) {
        s.hit.add(e.id);
        if (s.kind === 'QWW' && !e.boss) { e.air = 1.2; e.airPower = s.power; this.float(e, '浮空 · 无敌', '#b8c7ff'); }
        else {
          this.damage(e, s.kind === 'QWW' ? 90 : 80, s.power);
          if (s.kind === 'QWE') { e.disarm = e.boss ? 1.2 : 2.4; const push = s.radial ? normalized(s, e) : { x: s.dx, y: s.dy }; if (!e.boss) Object.assign(e, bounded({ x: e.x + push.x * 85, y: e.y + push.y * 85 })); }
          if (e.boss) this.float(e, '控制免疫', '#d9a0ff');
        }
      }
    }
    this.shots = this.shots.filter(s => s.traveled < s.range && s.x > 0 && s.y > 0 && s.x < WORLD.width && s.y < WORLD.height);
    for (const s of this.enemyShots) {
      s.x += s.dx * s.speed * dt; s.y += s.dy * s.speed * dt; s.life -= dt;
      const target = this.spirits.find(a => a.hp > 0 && distance(a, s) < a.r + s.r) || (distance(p, s) < p.r + s.r ? p : null);
      if (target) { this.hurt(target, s.damage, 'magic'); s.life = 0; }
    }
    this.enemyShots = this.enemyShots.filter(s => s.life > 0);
    for (const a of this.spirits) {
      a.life -= dt; a.attack -= dt; a.buff = Math.max(0, a.buff - dt); a.invulnerable = Math.max(0, (a.invulnerable || 0) - dt);
      a.taunt = Math.max(0, (a.taunt || 0) - dt);
      const forced = a.taunt > 0 ? this.enemies.find(e => e.id === a.tauntOwner && e.hp > 0) : null;
      const follow = forced || p;
      if (distance(a, follow) > (forced ? 80 : 65)) { const v = normalized(a, follow); a.x += v.x * 170 * dt; a.y += v.y * 170 * dt; }
      const target = forced || this.enemies.filter(e => e.hp > 0 && !e.air && distance(a, e) < 360).sort((x, y) => distance(a, x) - distance(a, y))[0];
      if (target && a.attack <= 0 && a.hp > 0) {
        const amount = a.buff > 0 ? (a.buffAttack || 32) : 22;
        target.armor = Math.min(5, target.armor + 1); this.damage(target, amount, p.power, 'spirit');
        if (this.hasRelic('spirit_cinder')) for (const other of this.enemies) if (other !== target && distance(other, target) < 70) this.damage(other, amount * .4, p.power, 'spirit');
        this.effects.push({ kind: 'beam', x: a.x, y: a.y, tx: target.x, ty: target.y, age: 0, duration: .24 }); a.attack = a.buff > 0 ? (a.buffInterval || .45) : .85;
      }
    }
    this.spirits = this.spirits.filter(a => a.hp > 0 && a.life > 0);
    for (const e of this.enemies.filter(e => e.hp <= 0)) {
      this.effects.push({ kind: 'death', x: e.x, y: e.y, age: 0, duration: e.boss ? 1.8 : .65, radius: e.r, seed: e.id, boss: e.boss, color: e.boss ? '#e9a075' : '#c99893' });
      this.kills++; this.encounterKills++; const value = e.boss ? 100 : ENEMY_DEFINITIONS[e.kind]?.gold || 3; this.drops.push({ x: e.x, y: e.y, value, health: this.random() < 0.1 });
      // Clear a hunger mark in the same frame that a kill is awarded.
      for (const f of this.effects) if (f.kind === 'boss-hunger') f.age = f.duration;
      if (e.boss && this.training) { this.boss = null; this.message('试炼领主已击败 · 可再次召唤'); }
    }
    if (this.state !== 'playing') return;
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.effects = this.effects.filter(f => !f.owner || (f.age < f.duration && this.enemies.some(e => e.id === f.owner)));
    if (!this.training && this.run.current && this.remainingEnemies === 0) { this.completeEncounter(); return; }
    for (const drop of this.drops) {
      if (distance(drop, p) < (this.equipment === 'wind_boots' ? 220 : 120)) { const v = normalized(drop, p); drop.x += v.x * 360 * dt; drop.y += v.y * 360 * dt; }
      if (distance(drop, p) < 22) { this.gold += drop.value; this.totalGold += drop.value; if (drop.health) p.hp = Math.min(p.maxHp, p.hp + 10); drop.taken = true; }
    }
    this.drops = this.drops.filter(d => !d.taken);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 25; } this.texts = this.texts.filter(t => t.life > 0);
  }
  inWall(e, f) { const x = e.x - f.x, y = e.y - f.y; return Math.abs(x * f.dx + y * f.dy) < (f.halfLength || 150) + e.r && Math.abs(x * -f.dy + y * f.dx) < 20 + e.r; }
  tickEffect(f, dt) {
    f.age += dt;
    if (tickBossEffect(this, f, dt)) return;
    if (f.kind === 'WWW' && f.vortex && !f.fired) {
      for (const e of this.enemies) if (e.hp > 0 && !e.boss && !e.air && distance(e, f) <= f.radius + e.r) {
        const dir = normalized(e, f), step = Math.min(distance(e, f), 180 * dt);
        Object.assign(e, bounded({ x: e.x + dir.x * step, y: e.y + dir.y * step }));
      }
    }
    if (f.kind === 'QQE') { f.tick -= dt; if (f.tick <= 0) { for (const e of this.enemies) if (this.inWall(e, f)) this.damage(e, 11, f.power); f.tick = 0.35; } }
    if (['WWW', 'EEE'].includes(f.kind) && f.age >= f.delay && !f.fired) {
      f.fired = true; const targets = this.enemies.filter(e => e.hp > 0 && !e.air && distance(e, f) < f.radius + e.r);
      for (const e of targets) { this.damage(e, f.kind === 'EEE' ? 480 / targets.length : 125, f.power); if (f.kind === 'WWW' && e.mana !== null) e.mana = Math.max(0, e.mana - 60); }
      if (f.kind === 'EEE' && targets.length) this.float(f, `阳炎 · ${targets.length} 目标均分`, '#ffd281');
    }
    if (f.kind === 'WEE' && f.age >= f.delay) {
      const step = dt * 155; f.x += f.dx * step; f.y += f.dy * step; f.traveled += step;
      if (f.x < 0 || f.y < 0 || f.x > WORLD.width || f.y > WORLD.height || f.traveled > 460) f.age = f.duration;
      for (const e of this.enemies) if (e.hp > 0 && !e.air && distance(e, f) < f.radius + e.r && (f.ticks.get(e.id) || 0) <= this.time) {
        this.damage(e, 29, f.power); e.burn = 3; e.burnPower = f.power; f.ticks.set(e.id, this.time + 0.35);
      }
    }
    if (f.kind === 'danger' && f.age >= f.delay && !f.fired) {
      f.fired = true; if (distance(this.player, f) < f.radius + this.player.r) this.hurt(this.player, 24, 'magic');
      for (const a of this.spirits) if (distance(a, f) < f.radius + a.r) this.hurt(a, 24, 'magic');
    }
  }
}
