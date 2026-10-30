/* Eldoria – game rules: what a hero does with the professions. Gathering, crafting, refining, enchanting,
   disenchanting and using consumables. Pure functions on the hero record; `rng` returns a number in [0, 1) so the
   server rolls the dice and tests can be deterministic. Every action returns a result object {ok, ...}; with
   ok: false it carries a `reason` for the player and the hero is unchanged. */
import { ITEMS, BAG_SIZE } from "../data.js";
import {
  PROFESSIONS,
  RESOURCES,
  RECIPES,
  GEMS,
  gemChance,
  professionLevel,
  grantProfessionExp,
  refineCost,
  disenchantDust,
} from "./professions.js";
import {
  ENCHANTMENTS,
  MAX_REFINE,
  isRefinable,
  isWeapon,
  modsOf,
  displayName,
} from "./item-mods.js";
import {
  addToBag,
  removeFromBag,
  bagCount,
  derivedStatsOf,
  setSlotMods,
  syncItemQuests,
  recordQuestEvent,
} from "./progression.js";

const fail = (reason) => ({ ok: false, reason });

/* ---- gathering ---- */

/** The best tool for a profession the hero carries and may use, as an item id, or null. */
export function bestTool(hero, profession) {
  const level = professionLevel(hero, profession);
  let best = null;
  for (const entry of hero.bag || []) {
    const item = ITEMS[entry.id];
    if (!item || item.tool !== profession || (item.toolLevel || 1) > level) {
      continue;
    }
    if (!best || item.toolSpeed > ITEMS[best].toolSpeed) {
      best = entry.id;
    }
  }
  return best;
}

/** Why the hero cannot gather this resource right now, or "" when they can. */
export function gatherProblem(hero, resourceId) {
  const resource = RESOURCES[resourceId];
  if (!resource) {
    return "Nothing to gather here.";
  }
  const profession = PROFESSIONS[resource.profession];
  if (professionLevel(hero, resource.profession) < resource.level) {
    return `Needs ${profession.name} level ${resource.level}.`;
  }
  if (!bestTool(hero, resource.profession)) {
    const toolNames = {
      mining: "a pickaxe",
      woodcutting: "a hatchet",
      herbalism: "a herb knife",
      fishing: "a fishing rod",
    };
    return `You need ${toolNames[resource.profession]}. Merchant Bram sells one.`;
  }
  if (!canFit(hero, resourceId, 2)) {
    return "Your bag is full.";
  }
  return "";
}

/** Seconds it takes this hero to gather the resource once (faster with a better tool and a higher level). */
export function gatherTime(hero, resourceId) {
  const resource = RESOURCES[resourceId];
  const tool = ITEMS[bestTool(hero, resource.profession)];
  const speed =
    (tool ? tool.toolSpeed : 1) * (1 + 0.01 * professionLevel(hero, resource.profession));
  return +(resource.time / speed).toFixed(2);
}

/**
 * Gather a resource once: the item (sometimes two), for miners now and then a gem, and profession exp.
 * @returns {{ok: true, item, count, gem, exp, profession, levelUps, level} | {ok: false, reason}}
 */
export function gather(hero, resourceId, rng = Math.random) {
  const problem = gatherProblem(hero, resourceId);
  if (problem) {
    return fail(problem);
  }
  const resource = RESOURCES[resourceId];
  const level = professionLevel(hero, resource.profession);
  const count = level >= resource.level + 20 && rng() < 0.25 ? 2 : 1;
  addToBag(hero, resourceId, count);
  let gem = null;
  if (resource.profession === "mining" && rng() < gemChance(resourceId)) {
    gem = GEMS[Math.floor(rng() * GEMS.length)];
    if (!addToBag(hero, gem, 1)) {
      gem = null;
    }
  }
  const levelUps = grantProfessionExp(hero, resource.profession, resource.exp);
  recordQuestEvent(hero, "gather", resourceId, count);
  syncItemQuests(hero);
  return {
    ok: true,
    item: resourceId,
    count,
    gem,
    exp: resource.exp,
    profession: resource.profession,
    levelUps,
    level: professionLevel(hero, resource.profession),
  };
}

/* ---- crafting ---- */

/* Is there room in the bag for `count` more of this item? */
function canFit(hero, id, count) {
  const item = ITEMS[id];
  const maxStack = item.stack || 1;
  let room = (BAG_SIZE - (hero.bag || []).length) * maxStack;
  for (const entry of hero.bag || []) {
    if (entry.id === id && !modsOf(entry)) {
      room += maxStack - entry.count;
    }
  }
  return room >= count;
}

/** Why this recipe cannot be made `times` times now, or "". */
export function craftProblem(hero, recipeId, times = 1) {
  const recipe = RECIPES[recipeId];
  if (!recipe) {
    return "Unknown recipe.";
  }
  if (professionLevel(hero, recipe.profession) < recipe.level) {
    return `Needs ${PROFESSIONS[recipe.profession].name} level ${recipe.level}.`;
  }
  for (const [id, needed] of Object.entries(recipe.inputs)) {
    if (bagCount(hero, id) < needed * times) {
      return `Not enough ${ITEMS[id].name}.`;
    }
  }
  /* the inputs leave the bag first; an input slot that empties makes room */
  if (!canFit(hero, recipe.output, recipe.count * times) && (hero.bag || []).length >= BAG_SIZE) {
    return "Your bag is full.";
  }
  return "";
}

/** How many times the hero could make this recipe with what is in the bag. */
export function maxCraftable(hero, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) {
    return 0;
  }
  return Math.min(
    ...Object.entries(recipe.inputs).map(([id, needed]) => Math.floor(bagCount(hero, id) / needed)),
  );
}

/**
 * Make a recipe up to `times` times (stops early when the bag fills up).
 * @returns {{ok: true, item, made, exp, profession, levelUps, level} | {ok: false, reason}}
 */
export function craft(hero, recipeId, times = 1) {
  const runs = Math.max(1, Math.min(50, Math.floor(+times) || 1));
  const problem = craftProblem(hero, recipeId, 1);
  if (problem) {
    return fail(problem);
  }
  const recipe = RECIPES[recipeId];
  let made = 0;
  let exp = 0;
  for (let i = 0; i < runs && !craftProblem(hero, recipeId, 1); i++) {
    for (const [id, needed] of Object.entries(recipe.inputs)) {
      removeFromBag(hero, id, needed);
    }
    if (!addToBag(hero, recipe.output, recipe.count)) {
      /* should not happen after craftProblem; give the inputs back */
      for (const [id, needed] of Object.entries(recipe.inputs)) {
        addToBag(hero, id, needed);
      }
      break;
    }
    made += recipe.count;
    exp += recipe.exp;
  }
  if (!made) {
    return fail("Your bag is full.");
  }
  const levelUps = grantProfessionExp(hero, recipe.profession, exp);
  recordQuestEvent(hero, "craft", recipe.output, made);
  syncItemQuests(hero);
  return {
    ok: true,
    item: recipe.output,
    made,
    exp,
    profession: recipe.profession,
    levelUps,
    level: professionLevel(hero, recipe.profession),
  };
}

/* ---- enchanting ---- */

/**
 * The item a refine or enchant works on: `{slot}` for something worn, `{index}` for a bag entry.
 * Returns {id, mods, setMods(mods)} or null.
 */
export function resolveTarget(hero, target) {
  if (!target) {
    return null;
  }
  if (typeof target.slot === "string" && hero.equipment && hero.equipment[target.slot]) {
    const slot = target.slot;
    return {
      id: hero.equipment[slot],
      mods: modsOf(hero.equipmentMods && hero.equipmentMods[slot]) || {},
      setMods: (mods) => setSlotMods(hero, slot, mods),
    };
  }
  const index = Number.isInteger(target.index) ? target.index : -1;
  const entry = (hero.bag || [])[index];
  if (!entry || !ITEMS[entry.id] || !ITEMS[entry.id].slot || entry.count !== 1) {
    return null;
  }
  return {
    id: entry.id,
    mods: modsOf(entry) || {},
    setMods: (mods) => {
      delete entry.refine;
      delete entry.enchant;
      Object.assign(entry, modsOf(mods) || {});
    },
  };
}

const RUNE_FOR_SLOT = (item) => (isWeapon(item) ? "rune_of_sharpness" : "rune_of_warding");

/** What the next refine of a target costs and how likely it is, or {reason} when it cannot be refined. */
export function refineInfo(hero, target) {
  const resolved = resolveTarget(hero, target);
  const item = resolved && ITEMS[resolved.id];
  if (!item || !isRefinable(item)) {
    return { reason: "Only weapons and armor can be refined." };
  }
  const current = resolved.mods.refine || 0;
  if (current >= MAX_REFINE) {
    return { reason: "Already at +10." };
  }
  const cost = refineCost(current, professionLevel(hero, "enchanting"));
  return { ...cost, current, rune: RUNE_FOR_SLOT(item), id: resolved.id };
}

/**
 * Try to refine a weapon or armour piece one level. Costs runes and zeny either way; on a failure from +5 up the
 * item loses a level. Nothing is ever destroyed.
 * @returns {{ok: true, success, refine, name, exp, levelUps, level} | {ok: false, reason}}
 */
export function refine(hero, target, rng = Math.random) {
  const info = refineInfo(hero, target);
  if (info.reason) {
    return fail(info.reason);
  }
  if (professionLevel(hero, "enchanting") < info.level) {
    return fail(`Refining to +${info.target} needs Enchanting level ${info.level}.`);
  }
  if (bagCount(hero, info.rune) < info.runes) {
    return fail(`Needs ${info.runes} × ${ITEMS[info.rune].name}.`);
  }
  if (hero.zeny < info.zeny) {
    return fail(`Needs ${info.zeny} zeny.`);
  }
  const resolved = resolveTarget(hero, target);
  removeFromBag(hero, info.rune, info.runes);
  hero.zeny -= info.zeny;
  const success = rng() < info.chance;
  let newRefine = info.current;
  if (success) {
    newRefine = info.target;
  } else if (info.dropsOnFailure) {
    newRefine = info.current - 1;
  }
  resolved.setMods({ ...resolved.mods, refine: newRefine });
  const exp = (success ? 15 : 5) * info.target;
  const levelUps = grantProfessionExp(hero, "enchanting", exp);
  recordQuestEvent(hero, "refine", resolved.id);
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  return {
    ok: true,
    success,
    refine: newRefine,
    name: displayName(resolved.id, { ...resolved.mods, refine: newRefine }),
    exp,
    profession: "enchanting",
    levelUps,
    level: professionLevel(hero, "enchanting"),
  };
}

/**
 * Enchant a weapon with an elemental rune; replaces any enchantment it had. Always succeeds.
 * @returns {{ok: true, enchant, name, exp, levelUps, level} | {ok: false, reason}}
 */
export function enchant(hero, target, runeId) {
  const resolved = resolveTarget(hero, target);
  const item = resolved && ITEMS[resolved.id];
  if (!item || !isWeapon(item)) {
    return fail("Only weapons can be enchanted.");
  }
  const element = ITEMS[runeId] && ITEMS[runeId].rune;
  const enchantment = ENCHANTMENTS[element];
  if (!enchantment) {
    return fail("That is not an enchanting rune.");
  }
  if (professionLevel(hero, "enchanting") < enchantment.level) {
    return fail(`Needs Enchanting level ${enchantment.level}.`);
  }
  if (!removeFromBag(hero, runeId, 1)) {
    return fail(`Needs a ${ITEMS[runeId].name}.`);
  }
  const mods = { ...resolved.mods, enchant: element };
  resolved.setMods(mods);
  const exp = 30;
  const levelUps = grantProfessionExp(hero, "enchanting", exp);
  return {
    ok: true,
    enchant: element,
    name: displayName(resolved.id, mods),
    exp,
    profession: "enchanting",
    levelUps,
    level: professionLevel(hero, "enchanting"),
  };
}

/**
 * Break an equipment item from the bag down into arcane dust.
 * @returns {{ok: true, item, dust, exp, levelUps, level} | {ok: false, reason}}
 */
export function disenchant(hero, index) {
  const entry = (hero.bag || [])[index];
  const item = entry && ITEMS[entry.id];
  if (!item || !item.slot) {
    return fail("Only equipment can be disenchanted.");
  }
  const mods = modsOf(entry) || {};
  const dust = disenchantDust(item.price, mods.refine);
  const name = displayName(entry.id, mods);
  hero.bag.splice(index, 1);
  if (!addToBag(hero, "arcane_dust", dust)) {
    /* no room for the dust: put the item back where it was */
    hero.bag.splice(index, 0, entry);
    return fail("Your bag is full.");
  }
  const exp = Math.round(10 + (item.price || 0) / 40);
  const levelUps = grantProfessionExp(hero, "enchanting", exp);
  recordQuestEvent(hero, "disenchant", entry.id);
  return {
    ok: true,
    item: entry.id,
    name,
    dust,
    exp,
    profession: "enchanting",
    levelUps,
    level: professionLevel(hero, "enchanting"),
  };
}

/* ---- consumables ---- */

/**
 * Use a consumable: food and potions heal, mana potions restore SP, elixirs raise a stat for a while.
 * `now` is the time in ms since the epoch (for elixirs).
 * @returns {{ok: true, item, use, amount} | {ok: false, reason}}
 */
export function useItem(hero, id, now = Date.now()) {
  const item = ITEMS[id];
  if (!item || !item.use) {
    return fail("That cannot be used.");
  }
  if (!bagCount(hero, id)) {
    return fail(`You have no ${item.name}.`);
  }
  const derived = derivedStatsOf(hero);
  let amount = 0;
  if (item.use === "heal") {
    if (hero.hp >= derived.hpMax) {
      return fail("You are already at full health.");
    }
    amount = Math.min(item.heal, derived.hpMax - hero.hp);
    hero.hp += amount;
  } else if (item.use === "mana") {
    if (hero.sp >= derived.spMax) {
      return fail("Your SP is already full.");
    }
    amount = Math.min(item.mana, derived.spMax - hero.sp);
    hero.sp += amount;
  } else if (item.use === "buff") {
    if (!hero.buffs) {
      hero.buffs = {};
    }
    for (const [stat, value] of Object.entries(item.buff)) {
      hero.buffs[stat] = { amount: value, until: now + item.duration * 1000 };
      amount = value;
    }
  } else {
    return fail("That cannot be used.");
  }
  removeFromBag(hero, id, 1);
  return { ok: true, item: id, use: item.use, amount };
}
