import { distance } from './geometry.js';
// Only creates gameplay entities. Rendering consumes their geometry and timing.
export function executeSpell(game, context) {
  const { spell: s, origin, dir, point, target, mouse, power, stats } = context;
  const p = game.player, range = stats.range;
  const bounded = game.boundPoint;
  const effect = extra => game.effects.push({ id: game.nextId++, kind: s.id, x: point.x, y: point.y, age: 0, power, ...extra });
    switch (s.id) {
      case 'QQQ': target.snap = 6; target.snapNext = 0; target.snapDamage = game.hasRelic('snap_frost') ? 36 : 18; target.snapPower = power; target.snapInterval = game.hasRelic('snap_frost') ? .35 : .55; game.float(target, '急速冷却', s.color); break;
      case 'QQW': p.ghost = game.hasRelic('ghost_shroud') ? 8 : 5; break;
      case 'QQE': effect({ x: p.x + dir.x * stats.wallOffset, y: p.y + dir.y * stats.wallOffset, dx: -dir.y, dy: dir.x, halfLength: stats.halfLength, slow: game.hasRelic('wall_glacier') ? .8 : .65, duration: game.hasRelic('wall_glacier') ? 9 : 6, tick: 0 }); break;
      case 'QWW': case 'QWE': game.shots.push({ ...origin, kind: s.id, dx: dir.x, dy: dir.y, radial: s.id === 'QWE' && game.hasRelic('blast_radial'), previous: 0, traveled: 0, range, speed: 460, r: stats.radius, ringWidth: 20 * stats.areaScale, power, hit: new Set() }); break;
      case 'WWW': effect({ delay: 1.4, duration: 2.05, radius: stats.radius, vortex: game.hasRelic('emp_vortex'), fired: false }); break;
      case 'WWE': {
        const ally = game.spirits.find(a => a.hp > 0 && distance(a, mouse) < 34);
        const empowered = game.hasRelic('alacrity_surge');
        if (ally) { ally.buff = empowered ? 10 : 7; ally.buffAttack = empowered ? 45 : 32; ally.buffInterval = empowered ? .32 : .45; }
        else { p.buff = empowered ? 10 : 7; p.buffPower = empowered ? 1.65 : 1.45; p.buffRecovery = empowered ? .8 : .55; }
        game.float(ally || p, ally ? '精灵 · 攻击强化' : '自身 · 法术强化', s.color); break;
      }
      case 'QEE':
        if (game.spirits.length >= p.spiritCap) game.spirits.shift();
        game.spirits.push({ id: game.nextId++, x: p.x + 35, y: p.y + 25, r: 13, hp: 65, maxHp: 65, life: 24, attack: 0, buff: 0 }); break;
      case 'WEE':
        for (const offset of game.hasRelic('meteor_triad') ? [-90, 0, 90] : [0]) {
          const pos = bounded({ x: point.x - dir.y * offset, y: point.y + dir.x * offset });
          effect({ ...pos, delay: .7, duration: 3.7, dx: dir.x, dy: dir.y, traveled: 0, ticks: new Map(), radius: stats.radius });
        } break;
      case 'EEE':
        for (const offset of game.hasRelic('solar_cataclysm') ? [-105, 0, 105] : [0]) {
          const pos = bounded({ x: point.x - dir.y * offset, y: point.y + dir.x * offset });
          effect({ ...pos, delay: 1, duration: 1.85, radius: stats.radius, fired: false });
        } break;
    }
}
