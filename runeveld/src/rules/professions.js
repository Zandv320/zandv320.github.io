/* Eldoria – game rules: the professions. Four gathering professions (mining, woodcutting, herbalism, fishing) and
   four crafting professions (smithing, alchemy, cooking, enchanting), each with levels 1–50. This module holds the
   data and the level maths; the actions themselves are in rules/crafting.js. Gathering nodes are in
   rules/gather-nodes.js. A hero keeps `professions: {id: {level, exp}}`; a missing entry is level 1. */

export const MAX_PROFESSION_LEVEL = 50;

/** Exp needed to go from profession level `level` to the next. */
export const professionExpForLevel = (level) => Math.round(30 * Math.pow(level, 1.7));

/* `station`: the crafting station a crafting profession works at. */
export const PROFESSIONS = {
  mining: {
    name: "Mining",
    kind: "gathering",
    emoji: "⛏️",
    description: "Mine ore veins for ore and the odd gem. Needs a pickaxe.",
  },
  woodcutting: {
    name: "Woodcutting",
    kind: "gathering",
    emoji: "🪓",
    description: "Fell pine, oak, ash and elder trees for logs. Needs a hatchet.",
  },
  herbalism: {
    name: "Herbalism",
    kind: "gathering",
    emoji: "🌿",
    description: "Cut herbs for alchemy. Needs a herb knife.",
  },
  fishing: {
    name: "Fishing",
    kind: "gathering",
    emoji: "🎣",
    description: "Fish where the water ripples. Needs a fishing rod.",
  },
  smithing: {
    name: "Smithing",
    kind: "crafting",
    station: "forge",
    emoji: "⚒️",
    description: "Smelt ore into bars and forge weapons, armour and jewellery at a forge.",
  },
  alchemy: {
    name: "Alchemy",
    kind: "crafting",
    station: "alchemy_table",
    emoji: "⚗️",
    description: "Brew potions and elixirs from herbs at an alchemy table.",
  },
  cooking: {
    name: "Cooking",
    kind: "crafting",
    station: "campfire",
    emoji: "🍳",
    description: "Cook fish and meat into food that heals, at a campfire.",
  },
  enchanting: {
    name: "Enchanting",
    kind: "crafting",
    station: "enchanting_altar",
    emoji: "✨",
    description:
      "Make runes, refine equipment up to +10, enchant weapons with the elements and disenchant gear into dust, " +
      "at an enchanting altar.",
  },
};

export const PROFESSION_IDS = Object.keys(PROFESSIONS);

/** {level, exp} of a profession for this hero. */
export function professionOf(hero, id) {
  const entry = hero.professions && hero.professions[id];
  return { level: (entry && entry.level) || 1, exp: (entry && entry.exp) || 0 };
}

export const professionLevel = (hero, id) => professionOf(hero, id).level;

/** Add profession exp; returns the number of levels gained. */
export function grantProfessionExp(hero, id, exp) {
  if (!PROFESSIONS[id] || !(exp > 0)) {
    return 0;
  }
  if (!hero.professions) {
    hero.professions = {};
  }
  const entry = professionOf(hero, id);
  let ups = 0;
  entry.exp += Math.round(exp);
  while (entry.level < MAX_PROFESSION_LEVEL && entry.exp >= professionExpForLevel(entry.level)) {
    entry.exp -= professionExpForLevel(entry.level);
    entry.level++;
    ups++;
  }
  if (entry.level >= MAX_PROFESSION_LEVEL) {
    entry.exp = 0;
  }
  hero.professions[id] = entry;
  return ups;
}

/** Professions from outside, within bounds. */
export function sanitizeProfessions(source) {
  const result = {};
  for (const id of PROFESSION_IDS) {
    const entry = source && source[id];
    if (!entry) {
      continue;
    }
    const level = Math.max(1, Math.min(MAX_PROFESSION_LEVEL, Math.floor(+entry.level) || 1));
    const exp = Math.max(
      0,
      Math.min(professionExpForLevel(level) - 1, Math.floor(+entry.exp) || 0),
    );
    if (level > 1 || exp > 0) {
      result[id] = { level, exp: level >= MAX_PROFESSION_LEVEL ? 0 : exp };
    }
  }
  return result;
}

/* ---- gathering ---- */

/* What can be gathered: the item, the profession and level needed, exp, the base time in seconds and how long the
   node stays depleted. `node`: the sprite of a node of this resource (`stump`: its depleted look). */
export const RESOURCES = {
  copper_ore: { profession: "mining", level: 1, exp: 12, time: 3, respawn: 25, node: "ore_copper" },
  iron_ore: { profession: "mining", level: 10, exp: 25, time: 3.5, respawn: 35, node: "ore_iron" },
  silver_ore: {
    profession: "mining",
    level: 20,
    exp: 45,
    time: 4,
    respawn: 45,
    node: "ore_silver",
  },
  gold_ore: { profession: "mining", level: 30, exp: 70, time: 4.5, respawn: 60, node: "ore_gold" },
  arcane_crystal: {
    profession: "mining",
    level: 40,
    exp: 110,
    time: 5,
    respawn: 90,
    node: "ore_arcane",
  },
  pine_log: { profession: "woodcutting", level: 1, exp: 10, time: 3, respawn: 20, node: "pine" },
  oak_log: { profession: "woodcutting", level: 10, exp: 22, time: 3.5, respawn: 30, node: "tree" },
  ash_log: { profession: "woodcutting", level: 20, exp: 40, time: 4, respawn: 40, node: "tree2" },
  elder_log: { profession: "woodcutting", level: 35, exp: 80, time: 5, respawn: 70, node: "pine2" },
  sunleaf: {
    profession: "herbalism",
    level: 1,
    exp: 10,
    time: 2.5,
    respawn: 20,
    node: "herb_sunleaf",
  },
  wolfsbane: {
    profession: "herbalism",
    level: 10,
    exp: 22,
    time: 3,
    respawn: 30,
    node: "herb_wolfsbane",
  },
  moonbloom: {
    profession: "herbalism",
    level: 20,
    exp: 40,
    time: 3,
    respawn: 40,
    node: "herb_moonbloom",
  },
  embermoss: {
    profession: "herbalism",
    level: 30,
    exp: 60,
    time: 3.5,
    respawn: 50,
    node: "herb_embermoss",
  },
  starpetal: {
    profession: "herbalism",
    level: 40,
    exp: 95,
    time: 4,
    respawn: 75,
    node: "herb_starpetal",
  },
  minnow: { profession: "fishing", level: 1, exp: 10, time: 4, respawn: 15, node: "ripples" },
  trout: { profession: "fishing", level: 12, exp: 28, time: 4.5, respawn: 20, node: "ripples" },
  pike: { profession: "fishing", level: 22, exp: 48, time: 5, respawn: 25, node: "ripples" },
  golden_carp: {
    profession: "fishing",
    level: 38,
    exp: 100,
    time: 6,
    respawn: 45,
    node: "ripples",
  },
};

/* The look of a depleted node, per gathering profession. */
export const DEPLETED_SPRITE = {
  mining: "ore_depleted",
  woodcutting: "tree_stump",
  herbalism: "herb_picked",
  fishing: null,
};

/* Gems that mining can turn up; gold veins and arcane crystals give them twice as often. */
export const GEMS = ["ruby", "sapphire", "emerald", "topaz"];
export const gemChance = (resourceId) =>
  resourceId === "gold_ore" || resourceId === "arcane_crystal" ? 0.12 : 0.06;

/* How close (world units) a hero must stand to a node or station to use it. */
export const USE_DISTANCE = 4;

/* ---- crafting stations ---- */

export const STATIONS = {
  forge: { name: "Forge", profession: "smithing", emoji: "⚒️" },
  alchemy_table: { name: "Alchemy table", profession: "alchemy", emoji: "⚗️" },
  campfire: { name: "Campfire", profession: "cooking", emoji: "🔥" },
  enchanting_altar: { name: "Enchanting altar", profession: "enchanting", emoji: "✨" },
};

/* Where the stations stand: two of each, one in Runeveld (or the Whisperwood) and one in Aurelia. */
export const STATION_PLACES = [
  { id: "forge_runeveld", kind: "forge", x: -8.3, z: 6.5 },
  { id: "forge_aurelia", kind: "forge", x: -121.4, z: 17.2 },
  { id: "alchemy_runeveld", kind: "alchemy_table", x: -16, z: -6 },
  { id: "alchemy_aurelia", kind: "alchemy_table", x: -146, z: -32.5 },
  { id: "campfire_runeveld", kind: "campfire", x: 18.8, z: -4 },
  { id: "campfire_aurelia", kind: "campfire", x: -144.5, z: -25 },
  /* the old altar in the Whisperwood clearing (forest.js) doubles as an enchanting altar */
  { id: "altar_whisperwood", kind: "enchanting_altar", x: 0, z: -103, existing: true },
  { id: "altar_aurelia", kind: "enchanting_altar", x: -155, z: 22.5 },
];

/** The station of this kind the hero stands next to, or null. */
export function stationNear(kind, x, z) {
  return (
    STATION_PLACES.find(
      (place) => place.kind === kind && Math.hypot(place.x - x, place.z - z) <= USE_DISTANCE + 1,
    ) || null
  );
}

/* ---- recipes ---- */

/* Recipe exp: 8 + 2.5 per level, half again for equipment. */
const recipeExp = (level, isGear) => Math.round((8 + 2.5 * level) * (isGear ? 1.5 : 1));

/* [output, profession, level, inputs, count made, is equipment] */
const RECIPE_TABLE = [
  ["copper_bar", "smithing", 1, { copper_ore: 1 }],
  ["iron_bar", "smithing", 10, { iron_ore: 2 }],
  ["silver_bar", "smithing", 20, { silver_ore: 2 }],
  ["gold_bar", "smithing", 30, { gold_ore: 2 }],
  ["copper_ring", "smithing", 4, { copper_bar: 2 }, 1, true],
  ["iron_sword", "smithing", 12, { iron_bar: 3, pine_log: 1 }, 1, true],
  ["iron_helm", "smithing", 14, { iron_bar: 3 }, 1, true],
  ["oak_staff", "smithing", 16, { oak_log: 3, copper_bar: 1 }, 1, true],
  ["iron_boots", "smithing", 18, { iron_bar: 3 }, 1, true],
  ["scaled_pants", "smithing", 22, { iron_bar: 4, silver_bar: 1 }, 1, true],
  ["silver_necklace", "smithing", 24, { silver_bar: 2, sapphire: 1 }, 1, true],
  ["steel_sword", "smithing", 26, { iron_bar: 4, silver_bar: 2, oak_log: 1 }, 1, true],
  ["steel_armor", "smithing", 28, { iron_bar: 6, silver_bar: 2 }, 1, true],
  ["ring_of_might", "smithing", 32, { gold_bar: 1, ruby: 1 }, 1, true],
  ["ring_of_wisdom", "smithing", 32, { gold_bar: 1, sapphire: 1 }, 1, true],
  ["ring_of_agility", "smithing", 32, { gold_bar: 1, emerald: 1 }, 1, true],
  ["knights_belt", "smithing", 34, { iron_bar: 3, silver_bar: 2 }, 1, true],
  ["crystal_staff", "smithing", 42, { elder_log: 2, gold_bar: 2, arcane_crystal: 1 }, 1, true],
  ["knight_plate", "smithing", 45, { iron_bar: 8, silver_bar: 4, gold_bar: 2 }, 1, true],
  [
    "royal_signet",
    "smithing",
    48,
    { gold_bar: 3, ruby: 1, sapphire: 1, emerald: 1, topaz: 1 },
    1,
    true,
  ],
  ["red_potion", "alchemy", 1, { sunleaf: 2 }, 2],
  ["mana_potion", "alchemy", 8, { wolfsbane: 2 }, 2],
  ["orange_potion", "alchemy", 15, { moonbloom: 2, sunleaf: 1 }, 2],
  ["elixir_of_might", "alchemy", 22, { embermoss: 1, wolfsbane: 2 }],
  ["elixir_of_wisdom", "alchemy", 26, { embermoss: 1, moonbloom: 2 }],
  ["elixir_of_swiftness", "alchemy", 30, { embermoss: 1, sunleaf: 3 }],
  ["grand_potion", "alchemy", 38, { starpetal: 1, moonbloom: 2 }, 2],
  ["cooked_minnow", "cooking", 1, { minnow: 1 }],
  ["roast_meat", "cooking", 5, { raw_meat: 1 }],
  ["cooked_trout", "cooking", 12, { trout: 1 }],
  ["cooked_pike", "cooking", 22, { pike: 1 }],
  ["golden_feast", "cooking", 38, { golden_carp: 1, sunleaf: 1 }],
  ["rune_of_sharpness", "enchanting", 1, { arcane_dust: 2, copper_bar: 1 }],
  ["rune_of_warding", "enchanting", 1, { arcane_dust: 2, copper_bar: 1 }],
  ["rune_of_flame", "enchanting", 10, { arcane_dust: 3, ruby: 1 }],
  ["rune_of_frost", "enchanting", 15, { arcane_dust: 3, sapphire: 1 }],
  ["rune_of_storms", "enchanting", 20, { arcane_dust: 3, topaz: 1 }],
  ["rune_of_the_arcane", "enchanting", 30, { arcane_dust: 4, arcane_crystal: 1 }],
];

/* Recipes by output id: {output, profession, level, inputs, count, exp}. */
export const RECIPES = Object.fromEntries(
  RECIPE_TABLE.map(([output, profession, level, inputs, count = 1, isGear = false]) => [
    output,
    { output, profession, level, inputs, count, exp: recipeExp(level, isGear) },
  ]),
);

/* ---- enchanting: refining ---- */

/* Success chance per target refine level (+1 … +10), before the enchanting level bonus. */
const REFINE_BASE_CHANCE = [1, 1, 1, 1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2];

/** What it takes to refine from +current to +current+1: enchanting level, runes, zeny and the chance. */
export function refineCost(current, enchantingLevel) {
  const target = current + 1;
  return {
    target,
    level: Math.max(1, 4 * target - 4),
    runes: target <= 4 ? 1 : target <= 7 ? 2 : 3,
    zeny: 100 * target,
    chance: Math.min(
      1,
      (REFINE_BASE_CHANCE[target - 1] ?? 0) + Math.min(0.15, 0.004 * enchantingLevel),
    ),
    /* from +5 a failure costs a level */
    dropsOnFailure: current >= 5,
  };
}

/** Arcane dust from disenchanting an item worth `price` refined to +refine. */
export const disenchantDust = (price, refine = 0) =>
  1 + Math.min(7, Math.floor((price || 0) / 300)) + (refine || 0);
