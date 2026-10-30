/* Eldoria – the bag and the equipment of the player: stacking items, equipping and taking off, buying,
   selling and dropping. Every change is also sent to the server as a hero action, which applies the same rules
   to the saved hero. */
import { CLASSES, ITEMS, BAG_SIZE, SELL_RATIO } from "./data.js";
import { heroLayers } from "./appearance.js";
import * as UI from "./ui.js";
import { player, game, heroClass, hpMax } from "./game-state.js";

/* The bag is a list of stacks [{id, count}] with at most BAG_SIZE stacks. */

/** How many of this item are in the bag. */
export function bagCount(id) {
  return player.bag
    .filter((entry) => entry.id === id)
    .reduce((total, entry) => total + entry.count, 0);
}

/**
 * Adds `count` of an item: first onto existing stacks, then into new stacks. Returns false (and says so unless
 * `silent`) when the bag is full; what fitted stays in the bag.
 */
export function addToBag(id, count = 1, silent = false) {
  const item = ITEMS[id];
  if (!item || count <= 0) {
    return false;
  }
  const maxStack = item.stack || 1;
  for (const entry of player.bag) {
    if (entry.id !== id || entry.count >= maxStack) {
      continue;
    }
    const added = Math.min(count, maxStack - entry.count);
    entry.count += added;
    count -= added;
    if (count <= 0) {
      return true;
    }
  }
  while (count > 0) {
    if (player.bag.length >= BAG_SIZE) {
      if (!silent) {
        UI.systemMessage("Your bag is full.");
      }
      return false;
    }
    const added = Math.min(count, maxStack);
    player.bag.push({ id, count: added });
    count -= added;
  }
  return true;
}

/** Removes `count` of an item, from the last stacks first. False (and nothing removed) when there are too few. */
export function removeFromBag(id, count = 1) {
  if (bagCount(id) < count) {
    return false;
  }
  for (let i = player.bag.length - 1; i >= 0 && count > 0; i--) {
    const entry = player.bag[i];
    if (entry.id !== id) {
      continue;
    }
    const removed = Math.min(count, entry.count);
    entry.count -= removed;
    count -= removed;
    if (entry.count <= 0) {
      player.bag.splice(i, 1);
    }
  }
  return true;
}

/** Redraws the hero with the current equipment and hair, and the panels that show it. */
export function refreshAppearance() {
  player.sprite.setLayers(heroLayers(player.equipment, player.hair));
  player.hp = Math.min(player.hp, hpMax());
  game.characterSheet.render();
  game.inventory.render();
}

export function equip(id) {
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
  if (!removeFromBag(id)) {
    return;
  }
  /* a ring goes into the first free ring slot; with both taken it replaces the first */
  let slot = item.slot;
  if (item.slot === "ring") {
    slot = !player.equipment.ring1 ? "ring1" : !player.equipment.ring2 ? "ring2" : "ring1";
  }
  const previous = player.equipment[slot];
  player.equipment[slot] = id;
  if (previous) {
    addToBag(previous, 1, true);
  }
  refreshAppearance();
  UI.systemMessage(`You equip the ${item.name.toLowerCase()}.`);
  game.network.heroAction("equip", { id });
}

export function unequip(slot) {
  const id = player.equipment[slot];
  if (!id) {
    return;
  }
  if (!addToBag(id)) {
    return;
  }
  player.equipment[slot] = null;
  game.network.heroAction("unequip", { slot });
  refreshAppearance();
  const itemName = ITEMS[id].name.toLowerCase();
  UI.systemMessage(
    slot === "body"
      ? `You take off the ${itemName}. Brr, a bit chilly like this.`
      : `You take off the ${itemName}.`,
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
  if (!addToBag(id)) {
    return;
  }
  player.zeny -= item.price;
  UI.systemMessage(`You bought a ${item.name.toLowerCase()}.`);
  game.inventory.render();
  game.network.heroAction("buy", { id });
}

/** Sells one item; only while a shop is open. */
export function sell(id) {
  const item = ITEMS[id];
  if (!item || !game.characterSheet.isShopOpen() || !removeFromBag(id)) {
    return;
  }
  const zeny = Math.floor(item.price * SELL_RATIO);
  player.zeny += zeny;
  UI.systemMessage(`You sold a ${item.name.toLowerCase()} for ${zeny} zeny.`);
  game.characterSheet.renderShop();
  game.characterSheet.render();
  game.network.heroAction("sell", { id });
}

export function drop(id) {
  const item = ITEMS[id];
  if (!item || !removeFromBag(id)) {
    return;
  }
  UI.systemMessage(`You drop the ${item.name.toLowerCase()}.`);
  game.network.heroAction("drop", { id });
}
