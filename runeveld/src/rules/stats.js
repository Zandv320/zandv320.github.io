/* Eldoria – game rules: stats and derived values.
   Pure functions without browser or network code, so the server runs the same rules. */
import { SKILLS } from "./skills.js";

/* [key, label, description] per stat. */
export const STATS = [
  ["str", "STR", "Strength: more attack power"],
  ["agi", "AGI", "Agility: dodge and attack faster"],
  ["vit", "VIT", "Vitality: more HP, defense and HP recovery"],
  ["int", "INT", "Intelligence: more SP, SP recovery, magic attack and a stronger Flame Sweep"],
  ["dex", "DEX", "Dexterity: hit chance and some attack power"],
  ["luk", "LUK", "Luck: chance of critical hits"],
];

export const MAX_STAT = 99;

export const baseStats = () => ({ str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 });

/** Stat points it costs to raise a stat from `value` to `value + 1` (as in RO: one more every 10 points). */
export const statCost = (value) => Math.floor((value - 1) / 10) + 2;

/** Stat points a hero has earned in total at this base level. */
export function statPointsForLevel(level) {
  let points = 10;
  for (let l = 2; l <= level; l++) {
    points += 3 + Math.floor(l / 5);
  }
  return points;
}

/** Stat points already spent on these stats. */
export function statPointsSpent(stats) {
  let points = 0;
  for (const [key] of STATS) {
    for (let value = 1; value < (stats[key] || 1); value++) {
      points += statCost(value);
    }
  }
  return points;
}

/**
 * Everything that follows from level, stats, equipment and passive skills.
 * items: list of worn items ({atk, def, hp, bonus, ...}; enchanted weapons also carry atkPct, matkPct and
 * freezeChance); skills: {id: level}; heroClass: entry of CLASSES.
 */
export function deriveStats({
  level,
  stats,
  items = [],
  skills = {},
  heroClass = { hpFactor: 1, spFactor: 1 },
}) {
  const s = { ...baseStats(), ...stats };
  /* rings, necklaces and cloaks can add to the base stats */
  for (const item of items) {
    for (const key in item.bonus || {}) {
      s[key] = (s[key] || 1) + item.bonus[key];
    }
  }
  const itemSum = (field) => items.reduce((total, item) => total + (item[field] || 0), 0);
  /* value of a passive skill's effect function at the hero's skill level, 0 when not learned */
  const passive = (skillId, effect) => {
    const skill = SKILLS[skillId];
    const skillLevel = skills[skillId] || 0;
    return skill && skillLevel > 0 && skill[effect] ? skill[effect](skillLevel) : 0;
  };

  const hpMax =
    Math.round((50 + level * 12 + s.vit * 6) * (1 + s.vit / 100) * (heroClass.hpFactor || 1)) +
    itemSum("hp");
  const spMax =
    Math.round((10 + level * 3 + s.int * 4) * (heroClass.spFactor || 1)) + itemSum("sp");
  const atk = Math.round(
    (3 +
      level * 1.5 +
      s.str * 1.2 +
      s.dex * 0.3 +
      itemSum("atk") +
      passive("blade_mastery", "atk")) *
      (1 + itemSum("atkPct")),
  );
  const matk = Math.round(
    (4 +
      level * 1.2 +
      s.int * 2 +
      s.dex * 0.2 +
      itemSum("matk") +
      passive("arcane_mastery", "matk")) *
      (1 + itemSum("matkPct")),
  );
  const def = Math.round(itemSum("def") + s.vit * 0.4 + passive("stoneskin", "def"));

  return {
    hpMax,
    spMax,
    atk,
    matk,
    def,
    /* hit chance against the target's flee */
    hit: 20 + level + s.dex + itemSum("hit"),
    flee: level + s.agi + itemSum("flee"),
    /* critical hit chance, in percent */
    crit: Math.min(50, s.luk * 0.3 + itemSum("crit")),
    /* seconds between basic attacks */
    attackInterval: Math.max(0.4, 0.9 - s.agi * 0.006),
    /* per second, while standing */
    hpRegen: (1 + level * 0.3 + s.vit * 0.2) * (1 + passive("second_wind", "regen")),
    spRegen: (1 + level * 0.2 + s.int * 0.2) * (1 + passive("inner_calm", "regen")),
    /* chance that a hit freezes the target (frost enchantment) */
    freezeChance: itemSum("freezeChance"),
    /* extra damage of Flame Sweep */
    skillBonus: 1 + s.int / 100,
  };
}
