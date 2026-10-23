// Prototype balance for this game; these values intentionally differ from MOBA items.
export const EQUIPMENT = [
  { id: 'bkb', name: '黑皇杖', icon: '♛', color: '#f3c76a', cd: 32, duration: 6, cost: 65, desc: '持续 6 秒：解除并免疫控制，受到的魔法伤害减少 80%。仍可移动和施法，物理伤害正常承受。' },
  { id: 'zhonya', name: '中亚沙漏', icon: '⌛', color: '#ead18d', cd: 35, duration: 3, cost: 60, desc: '凝滞 3 秒：免疫全部伤害和控制，无法移动、编织元素、施法或使用装备。世界和已有法术继续运行。' },
  { id: 'blink', name: '闪烁匕首', icon: '➶', color: '#b9a2ff', cd: 12, range: 280, cost: 45, desc: '向鼠标落点瞬间闪烁，最远 280 距离。近处落点不越过，地图边缘自动截断；使用后停止原移动指令。' },
  { id: 'shiva', name: '希瓦的守护', icon: '❄', color: '#8ddcff', cd: 24, radius: 230, cost: 60, desc: '释放冰霜新星，对周围 230 范围敌人造成 70 魔法伤害，并减速 50%，持续 4 秒。Boss 的减速效果减半。' },
  { id: 'mek', name: '梅肯斯姆', icon: '✚', color: '#9de2b3', cd: 28, radius: 230, cost: 50, desc: '立即恢复自身 45 生命，并恢复周围 230 范围熔炉精灵 35 生命，不超过生命上限。' },
  { id: 'bloodstone', name: '赤晶血石', icon: '♥', color: '#ef98aa', cost: 50, kind: 'passive', bonuses: {}, desc: '被动：法术与精灵有效伤害的 2.5% 恢复自身生命，过量伤害不吸血。' },
  { id: 'vital_seed', name: '复苏圣种', icon: '❧', color: '#b4db93', cost: 40, kind: 'passive', bonuses: { health: 40 }, desc: '被动：最大生命 +40，每秒恢复 1.5 生命。装备时恢复 40 生命；替换后失去生命上限与恢复效果。' },
  { id: 'arcane_crown', name: '奥术王冠', icon: '♛', color: '#d6b2f7', cost: 45, kind: 'passive', bonuses: { power: .2, recovery: .15 }, desc: '被动：基础法术伤害 +20%，法术冷却恢复速度 +15%。' },
  { id: 'wind_boots', name: '风行秘靴', icon: '➶', color: '#a0e1d2', cost: 35, kind: 'passive', bonuses: { speed: .2 }, desc: '被动：基础移动速度 +20%，金币吸取距离从 120 提高至 220。' },
].map(item => ({ kind: 'active', cd: 0, ...item }));
export const equipmentById = id => EQUIPMENT.find(item => item.id === id);
