/* Eldoria – the bag and the equipment of the player: stacking items, equipping and taking off, buying,
   selling and dropping. The shared rules (rules/progression.js) change the player record straight away; every
   change is also sent to the server as a hero action, which applies the same rules to the saved hero.
   Bag entries are {id, count}; refined or enchanted equipment also carries refine/enchant and never stacks, so
   actions on such an item name its bag index. */
import { CLASSES, ITEMS } from "./data.js";
import * as progression from "./rules/progression.js";
import { displayName, modsOf } from "./rules/item-mods.js";
import { heroLayers } from "./appearance.js";
import * as UI from "./ui.js";
import { player, game, heroClass, hpMax } from "./game-state.js";

/* "iron sword", or "+3 Iron sword of Frost" for a modified one */
const nameOf = (id, mods) => (modsOf(mods) ? displayName(id, mods) : ITEMS[id].name.toLowerCase());

/** How many of this item are in the bag. */
export const bagCount = (id) => progression.bagCount(player, id);

/**
 * Adds `count` of an item: first onto existing stacks, then into new stacks. Returns false (and says so unless
 * `silent`) when the bag is full; what fitted stays in the bag. `mods`: refine/enchant of an equipment item.
 */
export function addToBag(id, count = 1, silent = false, mods = null) {
  const added = progression.addToBag(player, id, count, mods);
  if (!added && ITEMS[id] && !silent) {
    UI.systemMessage("Your bag is full.");
  }
  return added;
}

/** Removes `count` of an item, from the last stacks first. False (and nothing removed) when there are too few. */
export const removeFromBag = (id, count = 1) => progression.removeFromBag(player, id, count);

/** Redraws the hero with the current equipment and hair, and the panels that show it. */
export function refreshAppearance() {
  player.sprite.setLayers(heroLayers(player.equipment, player.hair));
  player.hp = Math.min(player.hp, hpMax());
  game.characterSheet.render();
  game.inventory.render();
}

/* the bag index of an item with this id, preferring `index` when it holds that item */
function indexOf(id, index) {
  if (Number.isInteger(index) && player.bag[index] && player.bag[index].id === id) {
    return index;
  }
  return player.bag.findIndex((entry) => entry.id === id);
}

/** Wear an item from the bag; `index` picks the bag entry (a refined copy, say). */
export function equip(id, index) {
  const item = ITEMS[id];
  if (!item || !item.slot) {
    return;
  }
  if (item.forClass && item.forClass !== player.classId && item.forClass !== heroClass().base) {
    UI.systemMessage(
      `Only a ${CLASSES[item.forClass].name} can use the ${item.name.toLowerCase()}.`,
    );
    return;
  }
  const at = indexOf(id, index);
  const name = nameOf(id, player.bag[at]);
  if (!progression.equip(player, id, at)) {
    return;
  }
  refreshAppearance();
  UI.systemMessage(`You equip the ${name}.`);
  game.network.heroAction("equip", { id, index: at });
}

export function unequip(slot) {
  const id = player.equipment[slot];
  if (!id) {
    return;
  }
  const name = nameOf(id, player.equipmentMods[slot]);
  if (!progression.unequip(player, slot)) {
    UI.systemMessage("Your bag is full.");
    return;
  }
  game.network.heroAction("unequip", { slot });
  refreshAppearance();
  UI.systemMessage(
    slot === "body"
      ? `You take off the ${name}. Brr, a bit chilly like this.`
      : `You take off the ${name}.`,
  );
}

export function buy(id) {
  const item = ITEMS[id];
  if (!item) {
    return;
  }
  if (player.zeny < item.price) {
    UI.systemMessage("Not enough zeny. Defeat monsters to earn zeny.");
    return;
  }
  /* the shared rule also counts the purchase for a quest that asks for it */
  if (!progression.buy(player, id)) {
    UI.systemMessage("Your bag is full.");
    return;
  }
  UI.systemMessage(`You bought a ${item.name.toLowerCase()}.`);
  game.inventory.render();
  if (game.questLog) {
    game.questLog.refresh();
  }
  game.network.heroAction("buy", { id });
}

/** Sells one item; only while a shop is open. */
export function sell(id, index) {
  if (!ITEMS[id] || !game.characterSheet.isShopOpen()) {
    return;
  }
  const at = indexOf(id, index);
  const entry = player.bag[at];
  const name = nameOf(id, entry);
  const zeny = progression.sellPrice(id, entry);
  if (!progression.sell(player, id, at)) {
    return;
  }
  UI.systemMessage(`You sold a ${name} for ${zeny} zeny.`);
  game.characterSheet.renderShop();
  game.characterSheet.render();
  game.network.heroAction("sell", { id, index: at });
}

/** Sorts the bag (equipment, usables, materials), here and on the server. */
export function sortBag() {
  if (progression.sortBag(player)) {
    game.inventory.render();
    game.network.heroAction("sort_bag", {});
  }
}

export function drop(id, index) {
  if (!ITEMS[id]) {
    return;
  }
  const at = indexOf(id, index);
  const name = nameOf(id, player.bag[at]);
  if (!progression.drop(player, id, at)) {
    return;
  }
  UI.systemMessage(`You drop the ${name}.`);
  game.network.heroAction("drop", { id, index: at });
}
