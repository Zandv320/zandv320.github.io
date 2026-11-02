/* Eldoria – game rules: the level a hero needs to put on a piece of equipment. An item can name it (`level` in
   data.js); class armour, given at the class advancement, needs none; otherwise it is the lowest of the ways to
   come by it: the quest that gives it, the weakest monster that drops it (two levels below), or what its price
   says, for what the shops sell. What a hero already wears stays on. Pure data, shared by client and server. */
import { ITEMS, MONSTERS, SHOPS, CLASSES } from "../data.js";
import { QUESTS } from "./quests.js";

/* the level that goes with a price, for shop wares */
const priceLevel = (price) =>
  price < 100
    ? 1
    : price < 500
      ? 8
      : price < 1500
        ? 15
        : price < 3000
          ? 22
          : price < 5000
            ? 28
            : 32;

const levels = {};
const lowest = (id, level) => {
  levels[id] = Math.min(levels[id] ?? Infinity, Math.max(1, level));
};
for (const quest of Object.values(QUESTS)) {
  for (const reward of quest.reward?.items || []) {
    for (const id of [reward.id, reward.mage].filter(Boolean)) {
      lowest(id, quest.level || 1);
    }
  }
}
for (const monster of Object.values(MONSTERS)) {
  for (const id of Object.keys(monster.loot || {})) {
    lowest(id, monster.level - 2);
  }
}
for (const shop of Object.values(SHOPS)) {
  for (const id of shop.items) {
    if (ITEMS[id]) {
      lowest(id, priceLevel(ITEMS[id].price || 0));
    }
  }
}
const classArmor = new Set(Object.values(CLASSES).map((heroClass) => heroClass.grantedArmor));

/** The level needed to put this item on (1 for anything without a requirement). */
export function itemLevel(id) {
  const item = ITEMS[id];
  if (!item || !item.slot || classArmor.has(id)) {
    return 1;
  }
  if (item.level) {
    return item.level;
  }
  return levels[id] ?? priceLevel(item.price || 0);
}

/** Is the hero high enough to put it on? */
export const isLevelFor = (hero, id) => (hero.level || 1) >= itemLevel(id);
