/* Eldoria – game rules: item sets. Pieces that belong together give a bonus when worn together, more for more
   pieces. A piece can be one of several items (the sword or the staff of a set), so every class can complete it.
   Bonuses are worn like an item (rules/stats.js reads them through progression.derivedStatsOf), so the server
   counts them as well. Pure data and functions, shared by client and server. */
import { ITEMS } from "../data.js";

export const SETS = {
  ember_forged: {
    name: "Ember-Forged",
    pieces: [["cinder_blade", "ashwood_staff"], "ashen_cloak", "obsidian_ring"],
    bonuses: { 2: { atkPct: 0.05, matkPct: 0.05 }, 3: { hp: 120, def: 5 } },
  },
  wardens_hoard: {
    name: "The Warden's Hoard",
    pieces: [["firstflame_blade", "flamecaller_staff"], "wardens_heart", "molten_mantle"],
    bonuses: { 2: { atkPct: 0.08, matkPct: 0.08 }, 3: { hp: 200, bonus: { str: 3, int: 3 } } },
  },
  crimson_court: {
    name: "The Crimson Court",
    pieces: [["bloodfang_blade", "nightveil_staff"], "crimson_mantle", "counts_signet"],
    bonuses: { 2: { crit: 6 }, 3: { hp: 150, flee: 8 } },
  },
  saltmere_sailor: {
    name: "Saltmere Sailor",
    pieces: [
      ["saltmere_cutlass", "tidecaller_staff"],
      "sailcloth_cloak",
      "sea_boots",
      "harbor_charm",
    ],
    bonuses: { 2: { flee: 5 }, 4: { atkPct: 0.06, matkPct: 0.06, hp: 80 } },
  },
  gorge_keepers: {
    name: "Keepers of the Gorge",
    pieces: [
      ["skrags_cleaver", "humming_staff"],
      "trollhide_cloak",
      "grumms_toll",
      "bridgestone_pendant",
    ],
    bonuses: { 2: { def: 4 }, 4: { hp: 160, bonus: { vit: 3 } } },
  },
};

const options = (piece) => (Array.isArray(piece) ? piece : [piece]);

/** The key of the set an item belongs to, or null. */
export function setOf(id) {
  for (const [key, set] of Object.entries(SETS)) {
    if (set.pieces.some((piece) => options(piece).includes(id))) {
      return key;
    }
  }
  return null;
}

/** How many pieces of a set the hero wears. */
export function piecesWorn(hero, key) {
  const worn = new Set(Object.values(hero.equipment || {}).filter((id) => id && ITEMS[id]));
  return SETS[key].pieces.filter((piece) => options(piece).some((id) => worn.has(id))).length;
}

/** The set bonuses the hero has earned, as items for deriveStats. */
export function setItems(hero) {
  const items = [];
  for (const key of Object.keys(SETS)) {
    const count = piecesWorn(hero, key);
    for (const [needed, bonus] of Object.entries(SETS[key].bonuses)) {
      if (count >= +needed) {
        items.push(bonus);
      }
    }
  }
  return items;
}

/** A set bonus in words: "+5% ATK, +5% MATK". */
export function bonusText(bonus) {
  const parts = [];
  for (const [key, value] of Object.entries(bonus.bonus || {})) {
    parts.push(`+${value} ${key.toUpperCase()}`);
  }
  for (const [key, label] of [
    ["hp", "Max HP"],
    ["def", "DEF"],
    ["crit", "% crit"],
    ["flee", "FLEE"],
  ]) {
    if (bonus[key]) {
      parts.push(key === "crit" ? `+${bonus[key]}${label}` : `+${bonus[key]} ${label}`);
    }
  }
  for (const [key, label] of [
    ["atkPct", "ATK"],
    ["matkPct", "MATK"],
  ]) {
    if (bonus[key]) {
      parts.push(`+${Math.round(bonus[key] * 100)}% ${label}`);
    }
  }
  return parts.join(", ");
}
