/* Eldoria – game rules: how rare a piece of equipment is. Five grades, from common to legendary; materials and
   consumables have none. An item can name its grade (`rarity` in data.js); otherwise the unique drops of the
   great bosses are epic (the Ember Warden's legendary), and the rest goes by its price. Pure data, shared by
   client and server. */
import { ITEMS } from "../data.js";

/** The grades, from low to high: name and colour (names, borders and loot beams in the UI). */
export const RARITIES = {
  common: { name: "Common", color: "#d6d2c4" },
  uncommon: { name: "Uncommon", color: "#6fd38a" },
  rare: { name: "Rare", color: "#6fb3ff" },
  epic: { name: "Epic", color: "#c99bff" },
  legendary: { name: "Legendary", color: "#ffb84d" },
};

export const RARITY_ORDER = Object.keys(RARITIES);

/* the Ember Warden's hoard, the end of Saga II so far */
const LEGENDARY = new Set([
  "firstflame_blade",
  "flamecaller_staff",
  "wardens_heart",
  "molten_mantle",
]);
/* what only a great boss carries (or a king gives), and the dawn aegis */
const EPIC = new Set([
  "skrags_cleaver",
  "humming_staff",
  "trollhide_cloak",
  "grumms_toll",
  "bridgestone_pendant",
  "bloodfang_blade",
  "nightveil_staff",
  "crimson_mantle",
  "counts_signet",
  "royal_cloak",
  "royal_signet",
  "amulet_of_aurelia",
  "dawn_aegis",
]);

/** The grade of an item (a RARITIES key), or null for anything that is not equipment. */
export function rarityOf(id) {
  const item = ITEMS[id];
  if (!item || !item.slot) {
    return null;
  }
  if (RARITIES[item.rarity]) {
    return item.rarity;
  }
  if (LEGENDARY.has(id)) {
    return "legendary";
  }
  if (EPIC.has(id)) {
    return "epic";
  }
  const price = item.price || 0;
  return price >= 1500 ? "rare" : price >= 300 ? "uncommon" : "common";
}

/** Is this item at least this rare? */
export const isAtLeast = (id, grade) =>
  RARITY_ORDER.indexOf(rarityOf(id)) >= RARITY_ORDER.indexOf(grade);
