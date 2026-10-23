// Machine tags are stable identifiers; localized targeting labels are presentation.
export const SPELL_TAGS = Object.freeze({
  QQQ: ['ice', 'unit', 'debuff'], QQW: ['ice', 'lightning', 'self', 'buff'],
  QQE: ['ice', 'fire', 'area', 'control', 'duration'],
  QWW: ['ice', 'lightning', 'projectile', 'area', 'control'],
  WWW: ['lightning', 'area', 'ground', 'delayed'],
  WWE: ['lightning', 'fire', 'buff', 'ally'],
  QWE: ['ice', 'lightning', 'fire', 'area', 'projectile', 'control'],
  QEE: ['ice', 'fire', 'summon'], WEE: ['lightning', 'fire', 'area', 'ground', 'duration', 'delayed'],
  EEE: ['fire', 'area', 'ground', 'delayed'],
});

// Match by spell and/or all listed tags. Add bonuses, then multiply factors.
// Repeat casts only for area damage spells: buffs and summons have separate rules.
export function resolveSpellStats(spell, relics = [], modifiers = []) {
  const tags = SPELL_TAGS[spell.id] || [];
  const matching = modifiers.filter(m => (!m.spell || m.spell === spell.id) && (m.tags || []).every(t => tags.includes(t)));
  const factor = stat => (1 + matching.reduce((sum, m) => sum + (m[`${stat}Add`] || 0), 0)) * matching.reduce((product, m) => product * (m[`${stat}Multiplier`] ?? 1), 1);
  const areaScale = Math.max(.1, Math.min(5, factor('area')));
  let radius = spell.radius || (spell.id === 'QWE' ? 65 : spell.id === 'QWW' ? 42 : 0);
  let range = spell.range;
  let cooldown = spell.cd;
  let halfLength = 150;
  if (spell.id === 'WWW' && relics.includes('emp_vortex')) radius = 175;
  if (spell.id === 'QQE' && relics.includes('wall_glacier')) halfLength = 210;
  if (spell.id === 'QWW' && relics.includes('tornado_gale')) { radius = 50.4; range *= 1.3; cooldown *= .75; }
  if (range !== undefined) range *= factor('range');
  return {
    tags, range, areaScale, radius: radius * areaScale, halfLength: halfLength * areaScale, wallOffset: 110 * factor('range'),
    cooldown: Math.max(.1, cooldown * factor('cooldown')),
    castCount: tags.includes('area') ? Math.max(1, Math.min(8, 1 + Math.floor(matching.reduce((sum, m) => sum + (m.extraCasts || 0), 0)))) : 1,
  };
}
