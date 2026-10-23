// Simulation tuning only. Art consumes kind and brain state, never these rules.
export const ENEMY_DEFINITIONS = Object.freeze({
  normal: { name: '赤旗剑盾兵', hp: 48, radius: 14, speed: 68, speedPerDepth: 3, damage: 10, windup: .4, recovery: .5, gold: 3 },
  elite: { name: '赤旗精锐', hp: 600, radius: 18, speed: 90, damage: 14, windup: .5, recovery: .65, gold: 35 },
  ranged: { name: '赤旗法师兵', hp: 75, radius: 16, speed: 85, damage: 12, windup: .6, recovery: .35, manaCost: 20, rechargeTime: 1.8, rechargeAmount: 60, gold: 5 },
  charger: { name: '赤旗突击兵', hp: 90, radius: 16, speed: 94, damage: 16, windup: .8, recovery: .9, chargeSpeed: 480, chargeRange: 320, chargeRadius: 22, chargeCooldown: 5, gold: 5 },
});

// Four frontliners, one caster and one charger per six reinforcements.
const SQUAD = ['normal', 'normal', 'ranged', 'normal', 'charger', 'normal'];
export const reinforcementKind = index => SQUAD[index % SQUAD.length];
