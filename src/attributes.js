import { HERO } from './config.js';
import { equipmentById } from './equipment.js';

export const ATTRIBUTES = [
  { id: 'attr_power', name: '法术威能', icon: '✧', color: '#d6b2f7', cost: 20, step: .1, desc: '基础法术伤害 +10%。' },
  { id: 'attr_area', name: '范围扩张', icon: '◎', color: '#8be4d2', cost: 20, step: .1, desc: '技能作用范围 +10%：爆炸半径、投射物宽度与冰墙长度。' },
  { id: 'attr_range', name: '施法延伸', icon: '➶', color: '#b9beff', cost: 20, step: .1, desc: '有距离限制的法术施法距离 +10%，不改变全图天火。' },
  { id: 'attr_cooldown', name: '冷却缩减', icon: '◷', color: '#83dcff', cost: 25, step: .05, max: 8, desc: '法术冷却缩减 +5 个百分点，累计上限 40%。不影响装备。' },
  { id: 'attr_speed', name: '轻盈步伐', icon: '»', color: '#a0e1d2', cost: 15, step: .08, desc: '基础移动速度 +8%。' },
  { id: 'attr_health', name: '生命成长', icon: '♡', color: '#ef98aa', cost: 15, step: 20, desc: '最大生命 +20，同时恢复 20 生命。' },
];
export const attributeById = id => ATTRIBUTES.find(item => item.id === id);
export const attributeLevel = (game, id) => game.attributeLevels[id] || 0;
export const attributeCost = (game, item) => item.cost + attributeLevel(game, item.id) * 5;
export const attributeMaxed = (game, item) => attributeLevel(game, item.id) >= (item.max ?? Infinity);
export const attributeValue = (item, level) => item.id === 'attr_health' ? `+${level * item.step}` : `${item.id === 'attr_cooldown' ? '−' : '+'}${Math.round(level * item.step * 100)}%`;

// Rebuild from permanent purchases and the ONE current item; replaced passives leave no residue.
export function rebuildGrowth(game) {
  const p = game.player, levels = game.attributeLevels;
  const passive = equipmentById(game.equipment)?.bonuses || {};
  p.power = HERO.power * (1 + (levels.attr_power || 0) * .1 + (passive.power || 0));
  p.speed = HERO.speed * (1 + (levels.attr_speed || 0) * .08 + (passive.speed || 0));
  p.maxHp = HERO.hp + (levels.attr_health || 0) * 20 + (passive.health || 0);
  p.hp = Math.min(p.hp, p.maxHp);
  p.recovery = 1 + (passive.recovery || 0);
}
export function attributeModifiers(game) {
  const levels = game.attributeLevels;
  return [
    { tags: ['area'], areaAdd: (levels.attr_area || 0) * .1 },
    { rangeAdd: (levels.attr_range || 0) * .1 },
    { cooldownMultiplier: 1 - Math.min(.4, (levels.attr_cooldown || 0) * .05) },
  ];
}
