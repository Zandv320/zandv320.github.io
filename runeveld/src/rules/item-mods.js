/* Eldoria – game rules: item modifiers. An equipment item can be refined (+1 to +10) and a weapon can carry one
   elemental enchantment. Modifiers live on the bag entry ({id, count: 1, refine, enchant}) or, while worn, in
   hero.equipmentMods[slot]. Pure functions, shared by client and server. */
import { ITEMS } from "../data.js";

export const MAX_REFINE = 10;

/* Slots whose items can be refined; jewellery cannot. */
export const REFINABLE_SLOTS = ["weapon", "head", "body", "cloak", "belt", "pants", "boots"];

/* Weapon enchantments: the rune that applies them, the enchanting level needed, and what they add to the weapon. */
export const ENCHANTMENTS = {
  flame: {
    name: "Flames",
    rune: "rune_of_flame",
    level: 10,
    atkPct: 0.1,
    matkPct: 0.1,
    effect: "+10% damage, fire sparks on every hit",
  },
  frost: {
    name: "Frost",
    rune: "rune_of_frost",
    level: 15,
    freezeChance: 0.12,
    effect: "12% chance to freeze the target for 1.5 s",
  },
  storms: {
    name: "Storms",
    rune: "rune_of_storms",
    level: 20,
    crit: 8,
    effect: "+8% critical chance, crackling sparks",
  },
  arcane: {
    name: "the Arcane",
    rune: "rune_of_the_arcane",
    level: 30,
    matkPct: 0.15,
    effect: "+15% magic attack",
  },
};

export const isRefinable = (item) => !!item && REFINABLE_SLOTS.includes(item.slot);
export const isWeapon = (item) => !!item && item.slot === "weapon";

/* Staves get magic attack from refining, other weapons attack. */
const isStaff = (item) => (item.matk || 0) > (item.atk || 0);

/** The modifiers of a bag entry or equipmentMods value, normalised; null when it has none. */
export function modsOf(source) {
  if (!source) {
    return null;
  }
  const refine = Math.max(0, Math.min(MAX_REFINE, Math.floor(+source.refine || 0)));
  const enchant = ENCHANTMENTS[source.enchant] ? source.enchant : null;
  if (!refine && !enchant) {
    return null;
  }
  const mods = {};
  if (refine) {
    mods.refine = refine;
  }
  if (enchant) {
    mods.enchant = enchant;
  }
  return mods;
}

/** Only the modifiers this item can actually carry (refine for refinable items, enchant for weapons). */
export function validModsFor(id, source) {
  const item = ITEMS[id];
  const mods = modsOf(source);
  if (!item || !mods) {
    return null;
  }
  if (!isRefinable(item)) {
    delete mods.refine;
  }
  if (!isWeapon(item)) {
    delete mods.enchant;
  }
  return mods.refine || mods.enchant ? mods : null;
}

/** The bonus one refine level adds to this item. */
export function refineBonus(item) {
  if (isWeapon(item)) {
    return isStaff(item) ? { matk: 4 } : { atk: 3 };
  }
  return item.slot === "body" ? { def: 1, hp: 5 } : { def: 1 };
}

/** A copy of the item definition with its refine and enchantment bonuses added. */
export function applyMods(item, source) {
  const mods = modsOf(source);
  if (!item || !mods) {
    return item;
  }
  const result = { ...item };
  if (mods.refine && isRefinable(item)) {
    for (const [field, perLevel] of Object.entries(refineBonus(item))) {
      result[field] = (result[field] || 0) + perLevel * mods.refine;
    }
  }
  const enchantment = mods.enchant && isWeapon(item) ? ENCHANTMENTS[mods.enchant] : null;
  if (enchantment) {
    for (const field of ["atkPct", "matkPct", "freezeChance", "crit"]) {
      if (enchantment[field]) {
        result[field] = (result[field] || 0) + enchantment[field];
      }
    }
  }
  return result;
}

/** "+7 Steel sword of Flames" */
export function displayName(id, source) {
  const item = ITEMS[id];
  if (!item) {
    return id;
  }
  const mods = modsOf(source);
  let name = item.name;
  if (mods && mods.refine) {
    name = "+" + mods.refine + " " + name;
  }
  if (mods && mods.enchant) {
    name += " of " + ENCHANTMENTS[mods.enchant].name;
  }
  return name;
}

/** Shops pay 20% more per refine level. */
export const priceFactor = (source) => 1 + 0.2 * ((modsOf(source) || {}).refine || 0);
