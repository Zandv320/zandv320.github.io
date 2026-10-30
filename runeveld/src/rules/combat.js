/* Eldoria – game rules: hitting, missing, damage and defense.
   Pure functions; `rng` returns a number in [0, 1), so the server can test deterministically.
   Results are `{miss, damage, crit}`, plus `magic: true` for spells. */

/** Chance to hit, as in RO: 80% plus the difference between hit and flee (clamped to 15%–100%). */
export function hitChance(hit, flee) {
  return Math.max(0.15, Math.min(1, 0.8 + (hit - flee) / 100));
}

/** A melee hit: misses, hits or crits. `mult` is a skill multiplier (1 = basic attack). */
export function meleeHit({ atk, hit, crit = 0, mult = 1 }, { flee }, rng = Math.random) {
  if (rng() > hitChance(hit, flee)) {
    return { miss: true, damage: 0, crit: false };
  }
  const isCrit = rng() * 100 < crit;
  const damage = Math.max(1, Math.round(atk * mult * (isCrit ? 1.5 : 1) * (0.9 + rng() * 0.2)));
  return { miss: false, damage, crit: isCrit };
}

/** A spell: never misses and never crits. `mult` is the skill multiplier. */
export function spellHit({ matk, mult = 1 }, rng = Math.random) {
  const damage = Math.max(1, Math.round(matk * mult * (0.9 + rng() * 0.2)));
  return { miss: false, damage, crit: false, magic: true };
}

/** Damage left after defense. */
export function applyDefense(damage, def) {
  return Math.max(1, Math.round((damage * 100) / (100 + def * 5)));
}

/** A monster's hit and flee follow from its level. */
export function monsterCombatStats(spec) {
  return { hit: 15 + spec.level * 3, flee: 2 + spec.level * 2 };
}
