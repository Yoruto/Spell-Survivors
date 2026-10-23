import { SPELL_TAGS } from './spell-rules.js';
// Prototype balance values; mechanism decisions live in docs/design/spell-system-v0.1.md.
export const WORLD = { width: 1600, height: 1000 };
export const SPELLS = [
  { id: 'QQQ', name: '急速冷却', en: 'COLD SNAP', icon: '❄', color: '#83dcff', cd: 6, type: '单位', range: 540, desc: '标记敌人 6 秒。后续伤害触发冰霜追加伤害与硬直。' },
  { id: 'QQW', name: '幽灵漫步', en: 'GHOST WALK', icon: '◈', color: '#a2e9e0', cd: 12, type: '自身', desc: '隐身 5 秒并减速身边敌人，成功施放其他法术破隐。' },
  { id: 'QQE', name: '寒冰之墙', en: 'ICE WALL', icon: '▥', color: '#78cfff', cd: 7, type: '方向', range: 250, desc: '前方生成可穿越冰墙，持续 6 秒，造成伤害和 65% 减速。' },
  { id: 'QWW', name: '强袭飓风', en: 'TORNADO', icon: '≋', color: '#b9beff', cd: 6, type: '方向', range: 650, desc: '龙卷风吹起敌人 1.2 秒，浮空无敌，落地造成伤害。' },
  { id: 'WWW', name: '电磁脉冲', en: 'E.M.P.', icon: 'ϟ', color: '#b49aff', cd: 7, type: '地面', range: 520, radius: 140, desc: '延迟 1.4 秒后爆炸，对所有敌人造成伤害并削减法力。' },
  { id: 'WWE', name: '灵动迅捷', en: 'ALACRITY', icon: '✧', color: '#e2bcff', cd: 11, type: '自身 / 召唤物', desc: '强化 7 秒。玩家法伤 +45%、冷却恢复 +55%；指向精灵则增强其攻击。' },
  { id: 'QWE', name: '超震声波', en: 'DEAFENING BLAST', icon: '◉', color: '#8be4d2', cd: 5, type: '方向', range: 650, desc: '宽幅声波造成伤害、击退并缴械 2.4 秒。' },
  { id: 'QEE', name: '熔炉精灵', en: 'FORGE SPIRIT', icon: '♜', color: '#ffbd79', cd: 10, type: '自身', desc: '召唤有生命的精灵持续 24 秒，自动攻击并叠加削甲，最多 5 层。' },
  { id: 'WEE', name: '混沌陨石', en: 'CHAOS METEOR', icon: '☄', color: '#ff9c72', cd: 8, type: '地面 + 方向', range: 500, radius: 65, desc: '延迟 0.7 秒落下后滚动，反复伤害并刷新灼烧。' },
  { id: 'EEE', name: '阳炎冲击', en: 'SUN STRIKE', icon: '☀', color: '#ffd57b', cd: 5, type: '地面', radius: 88, desc: '可见战场内落点延迟 1 秒爆发，480 总伤害由有效目标均分。' },
].map(spell => ({ ...spell, tags: SPELL_TAGS[spell.id] }));
export const HERO = { id: 'carl', name: '小卡尔', title: '元素的继承者', hp: 120, speed: 220, power: 1, color: '#d9b7ff', desc: '冰、雷、火在指尖环绕。年少的祈咒师，已经掌握十种元素咒语。' };
// Cross-version Invoker-inspired relics, adapted to this game's manual aim and boss rules.
export const RELICS = [
  { id: 'echo_weave', icon: '✧', name: '复唱符印', rarity: '通用', color: '#d6b2f7', cost: 65, desc: '范围技能额外施放一次，沿用同一落点和方向，只消耗一次冷却。不重复自身强化、单位标记与召唤。', modifiers: [{ tags: ['area'], extraCasts: 1 }] },
  { id: 'emp_vortex', spell: 'WWW', icon: 'ϟ', name: '引力魔晶', rarity: '魔晶', color: '#b49aff', cost: 45, desc: '电磁脉冲范围扩大 25%，蓄能期间持续牵引范围内普通敌人至中心。Boss 与浮空单位免疫牵引。' },
  { id: 'meteor_triad', spell: 'WEE', icon: '☄', name: '天坠神杖', rarity: '神杖', color: '#ff9c72', cost: 65, desc: '混沌陨石额外落下 2 颗，形成间隔 90 的三条平行滚动轨迹。每颗独立命中，灼烧只刷新。' },
  { id: 'blast_radial', spell: 'QWE', icon: '◎', name: '寰宇回响', rarity: '天赋', color: '#b4e8f4', cost: 60, desc: '超震声波变为以施法位置为中心向四周扩散的完整环形冲击。每个敌人每次施法只命中一次。' },
  { id: 'solar_cataclysm', spell: 'EEE', icon: '☀', name: '灾变星核', rarity: '神杖', color: '#ffd57b', cost: 65, desc: '阳炎冲击在鼠标落点两侧额外产生 2 道天火，间隔 105。每道各自均分 480 总伤害，落点在施法时锁定。' },
  { id: 'snap_frost', spell: 'QQQ', icon: '❄', name: '极寒碎片', rarity: '天赋', color: '#83dcff', cost: 40, desc: '急速冷却追加伤害由 18 提高到 36，触发间隔从 0.55 秒缩短至 0.35 秒。Boss 仍免疫硬直。' },
  { id: 'ghost_shroud', spell: 'QQW', icon: '◈', name: '幽魂披风', rarity: '天赋', color: '#a2e9e0', cost: 40, desc: '幽灵漫步延长至 8 秒，隐身时移速增益提高至 45%，每秒恢复 3 点生命。成功释放其他法术仍会破隐。' },
  { id: 'wall_glacier', spell: 'QQE', icon: '▥', name: '永冻棱晶', rarity: '天赋', color: '#78cfff', cost: 40, desc: '冰墙长度提高至 420，持续 9 秒，减速提高至 80%。依然可穿越，多重减速只取最高值。' },
  { id: 'tornado_gale', spell: 'QWW', icon: '≋', name: '风暴长笛', rarity: '天赋', color: '#b9beff', cost: 45, desc: '飓风射程提高 30%，宽度提高 20%，独立冷却缩短 25%。浮空与 Boss 抗性规则保持一致。' },
  { id: 'alacrity_surge', spell: 'WWE', icon: '✧', name: '灵动冠冕', rarity: '天赋', color: '#e2bcff', cost: 45, desc: '灵动迅捷持续 10 秒。玩家法伤 +65%、冷却恢复 +80%；精灵攻击 45、间隔 0.32 秒。' },
  { id: 'spirit', spell: 'QEE', icon: '♜', name: '双生炉心', rarity: '天赋', color: '#ffbd79', cost: 40, desc: '熔炉精灵同时存在上限由 1 提高至 2。满员重新召唤仍替换最早的精灵。', apply: p => { p.spiritCap = 2; } },
  { id: 'spirit_cinder', spell: 'QEE', icon: '♨', name: '熔火余烬', rarity: '魔晶', color: '#ffc18a', cost: 45, desc: '熔炉精灵攻击对目标周围 70 范围其他敌人造成 40% 溅射伤害，可触发急速冷却。' },
].map(r => ({ ...r, once: true, relic: true }));
export const spellRelics = (id, owned) => RELICS.filter(r => r.spell === id && owned.includes(r.id));
