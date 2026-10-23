import test from 'node:test';
import assert from 'node:assert/strict';
import { SpellVFX } from '../src/vfx.js';
test('all spell render phases, particles and buff auras execute with finite drawing coordinates', () => {
  let operations = 0;
  const check = (...args) => { operations++; for (const x of args) if (typeof x === 'number') assert.ok(Number.isFinite(x), `non-finite Canvas coordinate ${x}`); };
  const gradient = { addColorStop: check }, ctx = new Proxy({ globalAlpha: 1 }, { get(target, key) { if (key in target) return target[key]; if (String(key).startsWith('create')) return (...args) => { check(...args); return gradient; }; return check; } });
  const r = { ctx, game: { time: 2.5 }, circle: check, line: check, diamond: check }, v = new SpellVFX(r);
  for (const kind of ['WWW', 'EEE', 'WEE', 'QQE', 'danger', 'beam', 'hit', 'frost-hit', 'ember-hit']) for (const age of [0, .2, .7, 1.01, 1.5, 2]) {
    v.effect({ kind, x: 800, y: 500, tx: 900, ty: 550, age, delay: kind === 'WEE' ? .7 : 1, duration: 3, radius: 100, fired: age >= 1, vortex: true, dx: 1, dy: 0, halfLength: 210, traveled: age * 155, seed: 4, id: 1 });
  }
  for (const kind of ['QWW', 'QWE']) for (const radial of [false, true]) for (const traveled of [0, 100, 650]) v.projectile({ kind, radial, x: 800, y: 500, dx: 1, dy: 0, traveled });
  v.aura({ x: 800, y: 500, ghost: 5, buff: 7 }); v.spirit({ id: 5, x: 800, y: 500, hp: 50, maxHp: 65, buff: 7 }); assert.ok(operations > 1000);
});
