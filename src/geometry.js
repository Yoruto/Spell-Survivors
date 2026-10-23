import { WORLD } from './config.js';
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const normalized = (a, b) => { const d = distance(a, b); return d < .01 ? { x: 0, y: -1 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
export const bounded = p => ({ x: clamp(p.x, 25, WORLD.width - 25), y: clamp(p.y, 25, WORLD.height - 25) });
export const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
