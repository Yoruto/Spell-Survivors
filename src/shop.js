import { RELICS } from './config.js';
import { EQUIPMENT, equipmentById } from './equipment.js';
import { ATTRIBUTES, attributeById, attributeCost, attributeMaxed, rebuildGrowth } from './attributes.js';

export const SHOP_RULES = Object.freeze({ attributeSlots: 3, relicSlots: 3, equipmentSlots: 3, refreshBase: 10, refreshStep: 5 });
export class Shop {
  constructor(random = Math.random) { this.random = random; this.stock = null; this.purchased = []; this.refreshes = 0; }
  get refreshCost() { return SHOP_RULES.refreshBase + this.refreshes * SHOP_RULES.refreshStep; }
  sample(pool, count) {
    const items = [...pool];
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items.slice(0, count).map(item => item.id);
  }
  roll(game) {
    this.purchased = [];
    this.stock = [
      ...this.sample(ATTRIBUTES.filter(item => !attributeMaxed(game, item)), SHOP_RULES.attributeSlots),
      ...this.sample(RELICS.filter(r => !game.bought.includes(r.id)), SHOP_RULES.relicSlots),
      ...this.sample(EQUIPMENT.filter(e => game.equipment !== e.id), SHOP_RULES.equipmentSlots),
    ];
  }
  open(game) { this.refreshes = 0; this.roll(game); }
  refresh(game) {
    if (game.training || game.gold < this.refreshCost) return false;
    game.gold -= this.refreshCost; this.refreshes++; this.roll(game); return true;
  }
  available(game, id) { return !this.purchased.includes(id) && (game.training || this.stock?.includes(id)); }
  buy(game, id, free = false) {
    if (free || !this.available(game, id)) return false;
    const attribute = attributeById(id);
    const item = attribute || equipmentById(id) || RELICS.find(r => r.id === id);
    if (!item) return false;
    const cost = attribute ? attributeCost(game, item) : item.cost;
    if (game.gold < cost) return false;
    if (equipmentById(id)) {
      if (game.equipment === id || game.player.stasis > 0 || game.player.bkb > 0) return false;
      game.gold -= cost; game.equipment = id; game.ownedEquipment = [id];
      rebuildGrowth(game);
      if (item.bonuses?.health) game.player.hp = Math.min(game.player.maxHp, game.player.hp + item.bonuses.health);
    } else if (attribute) {
      if (attributeMaxed(game, item)) return false;
      game.gold -= cost; game.attributeLevels[id] = (game.attributeLevels[id] || 0) + 1;
      rebuildGrowth(game);
      if (id === 'attr_health') game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20);
    } else {
      if (game.bought.includes(id)) return false;
      game.gold -= item.cost; item.apply?.(game.player); game.bought.push(id); game.relics.push(id);
      game.modifiers.push(...(item.modifiers || []));
    }
    this.purchased.push(id);
    if (this.stock) this.stock = this.stock.filter(stockId => stockId !== id);
    return true;
  }
}
