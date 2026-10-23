export const RUN_RULES = Object.freeze({ rounds: 2, nodesPerRound: 5 });
export const ROUTES = Object.freeze([
  { id: 'battle', name: '怪潮战', desc: '清理本关全部敌人，结算获得 35 金币。', reward: 35 },
  { id: 'elite', name: '精英战', desc: '清理精英及全部随从，结算获得 65 金币。', reward: 65 },
  { id: 'event', name: '事件', desc: '选择金币或治疗，随后进入商店。', reward: 0 },
]);

// Finite reinforcements; count scales with route depth, independent of elapsed time.
export function encounterPlan(kind, difficulty) {
  const reinforcements = ['battle', 'elite'].includes(kind) ? 12 + (difficulty - 1) * 2 : 0;
  return { reinforcements, total: reinforcements + (kind === 'elite' || kind === 'boss' ? 1 : 0) };
}

// No UI or combat dependencies. Only this object advances expedition progress.
export class RunProgress {
  constructor() { this.round = 1; this.completed = 0; this.current = null; this.history = []; this.finished = false; }
  get bossDue() { return this.completed === RUN_RULES.nodesPerRound && !this.current && !this.finished; }
  get difficulty() { return (this.round - 1) * RUN_RULES.nodesPerRound + this.completed + 1; }
  select(kind) {
    if (this.finished || this.current || this.bossDue || !ROUTES.some(r => r.id === kind)) return false;
    this.current = kind; return true;
  }
  startBoss() { if (!this.bossDue) return false; this.current = 'boss'; return true; }
  complete() {
    if (this.finished) return null;
    const kind = this.current;
    if (!kind) return null;
    this.history.push({ round: this.round, node: this.completed, kind }); this.current = null;
    if (kind === 'boss') {
      if (this.round === RUN_RULES.rounds) this.finished = true;
      else { this.round++; this.completed = 0; }
      return 100;
    }
    this.completed++;
    return ROUTES.find(r => r.id === kind).reward;
  }
}
