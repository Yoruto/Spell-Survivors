import { WORLD } from './config.js';
import { bounded, distance, normalized } from './geometry.js';

export const BOSSES = {
  axe: { name: '斧王 · 赤斧统帅', hp: 2400, color: '#ef816b' },
  timber: { name: '伐木机 · 锯齿暴君', hp: 4800, color: '#f3bd66' },
};
export const TIMBER_ANCHORS = [
  [65, 65], [800, 65], [1535, 65], [1535, 500],
  [1535, 935], [800, 935], [65, 935], [65, 500],
].map(([x, y]) => ({ x, y }));
const labels = { call: '狂战士之吼', helix: '反击螺旋', hunger: '战斗饥渴', cull: '淘汰之刃', jump: '跳斩', spin: '死亡旋风', chain: '伐木锯链', saw: '锯齿飞轮' };
const targets = g => [g.player, ...g.spirits].filter(t => t.hp > 0);
const ownerAlive = (g, f) => g.enemies.some(e => e.id === f.owner && e.hp > 0);
export const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
export function initBoss(e, type) {
  e.bossType = type; e.name = BOSSES[type].name;
  e.mana = 0; e.maxMana = 100; e.manaRegen = 5;
  e.ai = { cooldowns: { call: 1, hunger: 2, cull: 5, jump: 3, spin: 2, chain: 5, saw: 1 }, action: null, recovery: 0,
    enraged: false, rage: 0, rageAt: -Infinity, helixReady: false, helixCd: 0,
    armor: 0, armorAt: -Infinity, armorHold: 0, overheat: 0, forceCall: false };
}
// Damage callbacks are rate-limited by simulation time, including snap recursion and DoTs.
export function bossDamageMultiplier(e) {
  if (e.bossType !== 'timber') return 1;
  return e.ai.overheat > 0 ? 1.2 : 1 - e.ai.armor * .04;
}
export function onBossDamaged(g, e, amount) {
  const ai = e.ai;
  if (!ai || e.hp <= 0 || amount <= 0) return;
  const f = g.effects.find(f => f.kind === 'boss-hunger' && f.owner === e.id && f.age < f.duration);
  if (f) { f.remainingDamage -= amount; if (f.remainingDamage <= 0) f.age = f.duration; }
  if (e.bossType === 'axe') {
    if (ai.helixCd > 0 || ai.helixReady || g.time - ai.rageAt < .5) return;
    ai.rageAt = g.time; ai.rage = Math.min(4, ai.rage + 1);
    if (ai.rage === 4) ai.helixReady = true;
  } else if (ai.overheat <= 0 && ai.armor < 5 && g.time - ai.armorAt >= 1) {
    ai.armorAt = g.time; ai.armor++;
    if (ai.armor === 5) ai.armorHold = 4;
  }
}
function effect(g, e, f) { const out = { owner: e.id, age: 0, ...f }; g.effects.push(out); return out; }
function zone(g, e, point, radius, delay, label, style = 'axe') {
  return effect(g, e, { kind: 'boss-zone', ...point, radius, delay, duration: delay + .45, label, style });
}
function hitCircle(g, e, point, radius, damage, type, control) {
  for (const t of targets(g)) if (distance(t, point) <= radius + t.r) {
    g.hurt(t, damage, type);
    if (control) g.control(t, ...control);
  }
}
function start(g, e, kind, delay, extra = {}) {
  e.ai.action = { kind, left: delay, delay, ...extra }; e.casting = delay; e.skillName = labels[kind];
}
function rest(e, seconds = 1.2) { e.ai.action = null; e.ai.recovery = seconds; e.casting = 0; e.skillName = '反打窗口'; }
function aimPoint(g) { return g.player.ghost > 0 ? g.lastVisible : g.player; }
function chainPoint(g, e) {
  const p = aimPoint(g);
  return TIMBER_ANCHORS.filter(a => distance(e, a) > 180)
    .sort((a, b) => segmentDistance(p, e, a) - segmentDistance(p, e, b))[0];
}
function beginChain(g, e, second = false) {
  const point = chainPoint(g, e), from = { x: e.x, y: e.y };
  start(g, e, 'chain', 1, { point: { ...point }, from, second, hit: new Set(), moving: false });
  effect(g, e, { kind: 'boss-line', ...from, tx: point.x, ty: point.y, radius: 35, delay: 1, duration: 1 + distance(from, point) / 1100 + .1, label: second ? '锯链 · 第二段' : labels.chain });
}
function beginCall(g, e) {
  e.ai.forceCall = false; e.ai.cooldowns.call = 10;
  start(g, e, 'call', .9, { point: { x: e.x, y: e.y } }); zone(g, e, e.ai.action.point, 150, .9, labels.call);
}
function beginHelix(g, e, second = false) {
  if (!second) { e.ai.rage = 0; e.ai.helixReady = false; e.ai.helixCd = 5; }
  start(g, e, 'helix', second ? .7 : .8, { point: { x: e.x, y: e.y }, second });
  zone(g, e, e.ai.action.point, 130, second ? .7 : .8, second ? '螺旋 · 第二击' : labels.helix);
}
function resolveAction(g, e, a) {
  const ai = e.ai, p = g.player;
  switch (a.kind) {
    case 'call':
      hitCircle(g, e, a.point, 150, 12, 'magic', ['root', .6]);
      for (const s of g.spirits) if (s.hp > 0 && distance(s, a.point) <= 150 + s.r) { s.tauntOwner = e.id; s.taunt = 2; }
      rest(e); break;
    case 'helix':
      hitCircle(g, e, a.point, 130, 24, 'physical'); e.swing = .3;
      if (ai.enraged && !a.second) beginHelix(g, e, true); else rest(e);
      break;
    case 'hunger':
      effect(g, e, { kind: 'boss-hunger', x: p.x, y: p.y, duration: 6, tick: 1, remainingDamage: 180, kills: g.kills });
      g.float(p, '战斗饥渴 · 击杀或造成180伤害解除', '#ff9a88'); rest(e); break;
    case 'cull':
      for (const t of targets(g)) if (distance(t, a.point) <= 100 + t.r) g.hurt(t, t.hp / t.maxHp < .3 ? 48 : 32, 'physical');
      e.swing = .3; rest(e, 1.5); break;
    case 'jump':
      Object.assign(e, a.point); e.ai.forceCall = true; rest(e, .25); break;
    case 'spin':
      hitCircle(g, e, a.point, 145, 26, 'physical', ['slow', 1.5, .2]); e.swing = .3; rest(e); break;
    case 'saw':
      effect(g, e, { kind: 'boss-saw', x: e.x, y: e.y, from: { x: e.x, y: e.y }, point: a.point,
        stage: 'out', travel: 0, stay: 4, duration: 12, radius: 100, tick: .6, hit: new Set(), second: a.second });
      if (ai.enraged && !a.second) ai.pendingSawSecond = true;
      rest(e); break;
  }
}
export function tickBoss(g, e, dt) {
  const ai = e.ai;
  if (!ai || e.hp <= 0) return;
  if (e.spawn <= 0) e.mana = Math.min(e.maxMana, e.mana + dt * e.manaRegen);
  for (const key of Object.keys(ai.cooldowns)) ai.cooldowns[key] = Math.max(0, ai.cooldowns[key] - dt);
  ai.helixCd = Math.max(0, ai.helixCd - dt);
  if (ai.overheat > 0) ai.overheat = Math.max(0, ai.overheat - dt);
  if (ai.armorHold > 0) {
    ai.armorHold -= dt;
    if (ai.armorHold <= 0) {
      ai.armor = 0; ai.overheat = 3; ai.armorAt = g.time;
      if (ai.action?.kind === 'saw') e.mana = e.maxMana;
      ai.action = null; ai.nextChain = false; ai.pendingSawSecond = false; ai.recovery = 3; e.casting = 0;
      g.effects = g.effects.filter(f => f.owner !== e.id || f.kind === 'boss-saw');
      for (const f of g.effects) if (f.owner === e.id && f.kind === 'boss-saw') f.age = f.duration;
      g.float(e, '过热！受到伤害 +20%', '#a6edff');
    }
  }
  if (!ai.enraged && e.hp <= e.maxHp * .5) {
    ai.enraged = true; ai.recovery = Math.max(ai.recovery, 1.2);
    g.float(e, e.bossType === 'axe' ? '狂暴 · 双重螺旋' : '超载 · 双飞轮 / 连环锯链', '#ffb580');
    effect(g, e, { kind: 'boss-phase', x: e.x, y: e.y, radius: 160, duration: 1.2 });
  }
  // phase remains an explicit initial idle timer, useful for scripted encounters.
  e.phase = Math.max(0, e.phase - dt);
  if (e.spawn > 0) { e.casting = e.spawn; e.skillName = '入场'; return; }
  const a = ai.action;
  if (a) {
    a.left -= dt; e.casting = Math.max(0, a.left);
    if (a.kind === 'chain' && a.left <= 0) {
      const from = { x: e.x, y: e.y }, step = Math.min(distance(e, a.point), 1100 * dt), dir = normalized(e, a.point);
      e.x += dir.x * step; e.y += dir.y * step; a.moving = true; e.skillName = '锯链冲刺';
      for (const t of targets(g)) if (!a.hit.has(t) && segmentDistance(t, from, e) <= 35 + t.r) { a.hit.add(t); g.hurt(t, 24, 'physical'); }
      if (distance(e, a.point) < 1) {
        if (ai.enraged && !a.second) { rest(e, .8); ai.nextChain = true; }
        else rest(e);
      }
    } else if (a.left <= 0) resolveAction(g, e, a);
    return;
  }
  ai.recovery = Math.max(0, ai.recovery - dt);
  if (ai.recovery > 0 || ai.overheat > 0 || e.phase > 0) return;
  // A full bar reserves the next action for the ultimate. Ordinary moves never consume mana.
  if (e.mana >= e.maxMana) {
    e.mana = 0;
    if (e.bossType === 'axe') {
      const point = aimPoint(g), pos = { x: point.x, y: point.y };
      start(g, e, 'cull', 1.2, { point: pos }); zone(g, e, pos, 100, 1.2, labels.cull);
    } else {
      // Retire older blades so even accelerated charge rates cannot cover the arena.
      for (const f of g.effects) if (f.owner === e.id && f.kind === 'boss-saw') f.age = f.duration;
      const point = aimPoint(g), pos = bounded({ x: point.x, y: point.y });
      start(g, e, 'saw', 1, { point: pos, second: false }); zone(g, e, pos, 100, 1, labels.saw, 'timber');
    }
    return;
  }
  if (e.bossType === 'timber' && ai.pendingSawSecond) {
    const first = g.effects.find(f => f.owner === e.id && f.kind === 'boss-saw' && f.age < f.duration);
    if (first?.stage === 'out') return;
    ai.pendingSawSecond = false;
    if (first?.stage === 'stay') {
      const point = aimPoint(g), pos = bounded({ x: point.x + (point.x < WORLD.width / 2 ? 140 : -140), y: point.y });
      first.second = true;
      start(g, e, 'saw', 1, { point: pos, second: true }); zone(g, e, pos, 100, 1, labels.saw, 'timber'); return;
    }
  }
  if (ai.nextChain) { ai.nextChain = false; beginChain(g, e, true); return; }
  const point = aimPoint(g), d = distance(e, point), cd = ai.cooldowns;
  e.skillName = '追击';
  if (e.bossType === 'axe') {
    if (ai.forceCall) { beginCall(g, e); return; }
    if (ai.helixReady) { beginHelix(g, e); return; }
    if (cd.call <= 0 && d < 240) { beginCall(g, e); return; }
    if (ai.enraged && cd.jump <= 0 && d > 220) {
      const dir = normalized(e, point), jump = bounded({ x: e.x + dir.x * Math.min(d, 360), y: e.y + dir.y * Math.min(d, 360) });
      cd.jump = 12; start(g, e, 'jump', 1, { point: jump }); zone(g, e, jump, 65, 1, labels.jump); return;
    }
    if (cd.hunger <= 0 && pVisible(g) && d <= 700) {
      cd.hunger = 14; start(g, e, 'hunger', .7); return;
    }
  } else {
    if (cd.spin <= 0 && d <= 240) {
      cd.spin = 6; const pos = { x: e.x, y: e.y };
      start(g, e, 'spin', .9, { point: pos }); zone(g, e, pos, 145, .9, labels.spin, 'timber'); return;
    }
    if (cd.chain <= 0) { cd.chain = 8; beginChain(g, e); return; }
  }
  const hunger = g.effects.some(f => f.kind === 'boss-hunger' && f.owner === e.id && f.age < f.duration);
  if (d > 55 && e.stun <= 0) {
    const dir = normalized(e, point), step = Math.min(d - 55, e.speed * (hunger ? 1.2 : 1) * (1 - e.slow) * dt);
    Object.assign(e, bounded({ x: e.x + dir.x * step, y: e.y + dir.y * step })); e.walk = (e.walk || 0) + dt * 6;
  }
  e.facing = Math.atan2(point.y - e.y, point.x - e.x);
  const target = g.spirits.find(s => s.hp > 0 && distance(e, s) <= e.r + s.r) || (pVisible(g) ? g.player : null);
  if (target && distance(e, target) < e.r + target.r + 3 && e.attack <= 0 && e.disarm <= 0 && e.stun <= 0) {
    g.hurt(target, 20, 'physical'); e.attack = .9; e.swing = .3;
  }
}
function pVisible(g) { return g.player.ghost <= 0 && g.player.stasis <= 0; }
export function tickBossEffect(g, f, dt) {
  if (!f.kind.startsWith('boss-')) return false;
  if (!ownerAlive(g, f)) { f.age = f.duration; return true; }
  if (f.kind === 'boss-hunger') {
    if (g.kills > f.kills || f.remainingDamage <= 0) { f.age = f.duration; return true; }
    f.x = g.player.x; f.y = g.player.y; f.tick -= dt;
    if (f.tick <= 0 && f.age <= f.duration) { f.tick += 1; g.hurt(g.player, 3, 'magic'); }
  }
  if (f.kind !== 'boss-saw' || f.age >= f.duration) return true;
  if (f.stage === 'stay') {
    f.stay -= dt; f.tick -= dt;
    if (f.tick <= 0) {
      f.tick += .6;
      hitCircle(g, null, f, 100, 6, 'magic', ['slow', .8, .25]);
    }
    if (f.stay <= 0) {
      const e = g.enemies.find(e => e.id === f.owner);
      f.stage = 'warning'; f.returnPoint = { x: e.x, y: e.y }; f.warning = .8;
    }
  } else if (f.stage === 'warning') {
    f.warning -= dt;
    if (f.warning <= 0) { f.stage = 'back'; f.from = { x: f.x, y: f.y }; f.travel = 0; f.hit = new Set(); }
  } else {
    const point = f.stage === 'out' ? f.point : f.returnPoint, before = { x: f.x, y: f.y }, dir = normalized(f, point);
    const step = Math.min(distance(f, point), 600 * dt); f.x += dir.x * step; f.y += dir.y * step;
    // The blade travels as a narrow projectile; its stationary field is the large circle.
    for (const t of targets(g)) if (!f.hit.has(t) && segmentDistance(t, before, f) <= 22 + t.r) { f.hit.add(t); g.hurt(t, 16, 'physical'); }
    if (distance(f, point) < 1) {
      if (f.stage === 'out') { f.stage = 'stay'; f.tick = .6; } else f.age = f.duration;
    }
  }
  return true;
}
export function bossStatus(e) {
  const a = e.ai;
  if (!a) return '';
  const state = a.action ? `${e.skillName} ${Math.max(0, a.action.left).toFixed(1)}s` : a.overheat > 0 ? `过热易伤 ${a.overheat.toFixed(1)}s` : a.recovery > 0 ? '反打窗口' : e.skillName || '入场';
  return `${a.enraged ? '狂暴 · ' : ''}${state} · ${e.bossType === 'axe' ? `怒气 ${a.rage}/4` : `装甲 ${a.armor}/5`} · 法力 ${Math.floor(e.mana)}`;
}
