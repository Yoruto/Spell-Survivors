import { RELICS } from './config.js';
import { ATTRIBUTES, attributeCost, attributeLevel, attributeMaxed, attributeValue } from './attributes.js';
import { EQUIPMENT, equipmentById } from './equipment.js';
import { ROUTES, RUN_RULES } from './run.js';

// Read-only presentation: every action is validated again by the domain modules.
export function routeHTML(game) {
  return `<span class="eyebrow">CHOOSE YOUR PATH</span><h2>选择下一条路线</h2><p class="subtitle">第 ${game.run.round} / ${RUN_RULES.rounds} 轮 · 第 ${game.run.completed + 1} / ${RUN_RULES.nodesPerRound} 个节点<br>完成五个节点后挑战 Boss，事件也计入进度。</p><div class="route-options">${ROUTES.map(r => `<button class="secondary-button" data-route="${r.id}"><b>${r.name}</b><span>${r.desc}</span></button>`).join('')}</div>`;
}
export function eventHTML() {
  return `<span class="eyebrow">A QUIET SHRINE</span><h2>旅途中的祭坛</h2><p class="subtitle">祭坛留下两份馈赠，选择其中一份。</p><div class="route-options"><button class="secondary-button" data-event="gold">拾取钱袋 · +30 金币</button><button class="secondary-button" data-event="heal">饮用泉水 · 恢复 50 生命</button></div>`;
}
const CATEGORIES = [
  { id: 'attributes', title: '属性提升', note: '可重复成长 · 同类每次加价 5 金币', catalog: ATTRIBUTES },
  { id: 'relics', title: '遗物提升', note: '改变法术机制 · 本局每件限购一次', catalog: RELICS },
  { id: 'equipment', title: '装备提升', note: '主动 / 被动共用一个槽 · 购买即替换', catalog: EQUIPMENT },
];
export function shopHTML(game, requestedPage = 0) {
  const pageCount = game.training ? Math.max(...CATEGORIES.map(category => Math.ceil(category.catalog.length / 3))) : 1;
  const page = Math.max(0, Math.min(pageCount - 1, requestedPage));
  const locked = game.player.stasis > 0 || game.player.bkb > 0;
  const current = equipmentById(game.equipment);
  const sections = CATEGORIES.map(category => {
    const available = category.catalog.filter(item => game.training || game.shop.stock?.includes(item.id) || game.shop.purchased.includes(item.id));
    const items = game.training ? available.slice(page * 3, page * 3 + 3) : available;
    return `<section class="shop-section" aria-labelledby="shop-${category.id}" data-category="${category.id}">
      <header><h3 id="shop-${category.id}">${category.title}</h3><small>${category.note}</small></header>
      <div class="shop-options">${items.map(item => {
        const attribute = category.id === 'attributes', equipment = category.id === 'equipment';
        const purchased = game.shop.purchased.includes(item.id);
        const owned = equipment ? game.equipment === item.id : !attribute && game.relics.includes(item.id);
        const maxed = attribute && attributeMaxed(game, item);
        const cost = attribute ? attributeCost(game, item) : item.cost;
        const level = attribute ? attributeLevel(game, item.id) : 0;
        const type = attribute ? '永久属性' : equipment ? item.kind === 'passive' ? '被动装备' : `主动装备 · ${item.cd} 秒冷却` : item.rarity;
        const label = purchased ? '已购买' : owned ? equipment ? '已装备' : '已拥有' : maxed ? '已达上限' : `◇ ${cost} 金币${equipment ? ' · 替换' : '购买'}`;
        return `<article class="relic-card ${purchased || owned ? 'owned' : ''}" style="--relic:${item.color}">
          <div class="relic-card-top"><span class="relic-art">${item.icon}</span><div><small>${type}</small><h3>${item.name}</h3></div></div>
          <p title="${item.desc}">${item.desc}</p>
          ${attribute ? `<div class="shop-card-detail">已购买 ${level} 次 · ${attributeValue(item, level)}${!purchased && !maxed ? ` → ${attributeValue(item, level + 1)}` : ''}</div>` : equipment ? `<div class="shop-card-detail">${owned ? '当前装备' : `替换：${current?.name || '空槽'}`}</div>` : ''}
          <div class="relic-card-actions"><button data-buy="${item.id}" ${purchased || owned || maxed || game.gold < cost || (equipment && locked) ? 'disabled' : ''}>${label}</button></div>
        </article>`;
      }).join('') || `<p class="shop-empty">${game.training ? '本页无更多商品' : '未拥有遗物已全部收集。'}</p>`}</div></section>`;
  }).join('');
  return `<div class="shop-heading"><div><span class="eyebrow">TRAVELING MERCHANT</span><h2>旅途商店</h2></div><div class="shop-wallet">◇ ${game.gold}<small>金币</small></div></div>
    <p class="shop-intro">${game.training ? '试炼补给 · 展示全部商品 · 角色免伤' : `关卡完成 · 结算 +${game.lastReward || 0} 金币 · 三类各随机 3 项`}<br>可购买多项，购买后不补货。${locked ? '装备效果持续中，暂时无法换装。' : '装备单槽，购买新装备会移除旧装备。'}</p>
    <details class="growth-summary"><summary>属性总览 · 已提升 ${Object.values(game.attributeLevels).reduce((sum, n) => sum + n, 0)} 次 · 当前装备：${current?.name || '无'}</summary><div>${ATTRIBUTES.map(item => `<span>${item.name} ${attributeValue(item, attributeLevel(game, item.id))}</span>`).join('')}</div><p>实际法伤 ${Math.round(game.player.power * 100)}% · 移速 ${Math.round(game.player.speed)} · 最大生命 ${game.player.maxHp}（含当前装备）</p></details>
    <div class="shop-sections">${sections}</div>
    <div class="shop-footer"><span>遗物 ${game.relics.length} 件 · 装备 1 / 1</span>${game.training ? `<nav class="shop-pagination" aria-label="补给商品翻页"><button class="secondary-button" data-action="shop-prev" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${pageCount}</span><button class="secondary-button" data-action="shop-next" ${page === pageCount - 1 ? 'disabled' : ''}>下一页</button></nav>` : ''}<button class="secondary-button" data-action="refresh" ${game.gold < game.shop.refreshCost || game.training ? 'disabled' : ''}>刷新三类 · ${game.shop.refreshCost} 金币</button><button class="primary-button" data-action="next">${game.training ? '返回试炼' : game.run.bossDue ? '挑战本轮 Boss' : '选择路线'} →</button></div>`;
}
