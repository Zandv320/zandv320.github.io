/* Eldoria – game rules for a hero's progression: exp and levels, stat and skill points, bag and equipment,
   shops, potions, class advancement and quests.
   Pure functions on a hero record {name, hair, classId, level, exp, jobLevel, jobExp, stats, skills, hp, sp, zeny,
   equipment, equipmentMods, bag, quests, professions, buffs, x, z}; they change the record in place and return true
   when the action was allowed. Bag entries are {id, count}, plus refine/enchant for modified equipment
   (rules/item-mods.js); such entries never stack.
   The server runs exactly these rules on its own record, so the client cannot make anything up; the client runs
   the same rules for an immediate response. */
import {
  CLASSES,
  ADVANCEMENTS,
  ITEMS,
  expForLevel,
  MAX_LEVEL,
  BAG_SIZE,
  SELL_RATIO,
  STARTER_BAG,
  emptyEquipment,
} from "../data.js";
import {
  SKILLS,
  MAX_JOB_LEVEL_BY_TIER,
  jobExpForLevel,
  JOB_EXP_SHARE,
  skillPointsForJobLevel,
  skillPointsSpent,
  canLearn,
} from "./skills.js";
import {
  baseStats,
  statCost,
  statPointsForLevel,
  statPointsSpent,
  MAX_STAT,
  deriveStats,
  STATS,
} from "./stats.js";
import {
  QUESTS,
  questState,
  isQuestComplete,
  recordQuestEvent as recordQuestEventIn,
} from "./quests.js";
import { migrateHero } from "./legacy.js";
import { applyMods, modsOf, validModsFor, priceFactor } from "./item-mods.js";
import { sanitizeProfessions } from "./professions.js";

const MAGE_CLASSES = ["mage", "wizard", "sage"];

export const classOf = (hero) => CLASSES[hero.classId] || CLASSES.swordsman;

export const maxJobLevelOf = (hero) => MAX_JOB_LEVEL_BY_TIER[classOf(hero).tier] || 20;

export const freeStatPoints = (hero) =>
  statPointsForLevel(hero.level) - statPointsSpent(hero.stats);

/* After advancement the points of the first class (earned up to its max job level) stay available. */
export const freeSkillPoints = (hero) =>
  (classOf(hero).tier === 2 ? skillPointsForJobLevel(MAX_JOB_LEVEL_BY_TIER[1]) : 0) +
  skillPointsForJobLevel(hero.jobLevel) -
  skillPointsSpent(hero.skills);

/** The item definitions of everything the hero wears, with their refine and enchantment bonuses applied. */
export const equippedItems = (hero) =>
  Object.entries(hero.equipment || {})
    .filter(([, id]) => id && ITEMS[id])
    .map(([slot, id]) => applyMods(ITEMS[id], hero.equipmentMods && hero.equipmentMods[slot]));

/** The elixir buffs still running at `now` (ms since epoch), as {stat: {amount, until}}. */
export function activeBuffs(hero, now = Date.now()) {
  const active = {};
  for (const [stat, buff] of Object.entries(hero.buffs || {})) {
    if (buff && buff.until > now) {
      active[stat] = buff;
    }
  }
  return active;
}

/** The slot an item goes into: a ring goes into the first free ring slot (or ring1 when both are taken). */
export function slotFor(hero, item) {
  if (item.slot !== "ring") {
    return item.slot;
  }
  if (!hero.equipment.ring1) {
    return "ring1";
  }
  if (!hero.equipment.ring2) {
    return "ring2";
  }
  return "ring1";
}

/** Can the item with this id be worn in this equipment slot? */
export function fitsSlot(id, slot) {
  const item = ITEMS[id];
  if (!item) {
    return false;
  }
  return item.slot === slot || (item.slot === "ring" && (slot === "ring1" || slot === "ring2"));
}

/* running buffs count as an extra worn "item" with stat bonuses */
function buffItems(hero) {
  const bonus = {};
  for (const [stat, buff] of Object.entries(activeBuffs(hero))) {
    bonus[stat] = buff.amount;
  }
  return Object.keys(bonus).length ? [{ bonus }] : [];
}

export const derivedStatsOf = (hero) =>
  deriveStats({
    level: hero.level,
    stats: hero.stats,
    items: [...equippedItems(hero), ...buffItems(hero)],
    skills: hero.skills,
    heroClass: classOf(hero),
  });

/** The highest damage this hero can deal with one hit or spell (generously estimated): more is cheating. */
export function maxDamage(hero) {
  const derived = derivedStatsOf(hero);
  return Math.round(Math.max(derived.atk, derived.matk) * 7 * 1.6 + 50);
}

/* ---- bag ---- */

export const bagCount = (hero, id) =>
  (hero.bag || [])
    .filter((entry) => entry.id === id)
    .reduce((total, entry) => total + entry.count, 0);

const hasMods = (entry) => !!modsOf(entry);

/**
 * Add `count` of an item to the bag, filling existing stacks first. False when it does not fit.
 * With `mods` (refine/enchant) the item gets a slot of its own.
 */
export function addToBag(hero, id, count = 1, mods = null) {
  const item = ITEMS[id];
  if (!item || count <= 0) {
    return false;
  }
  if (!hero.bag) {
    hero.bag = [];
  }
  const validMods = validModsFor(id, mods);
  if (validMods) {
    if (hero.bag.length >= BAG_SIZE) {
      return false;
    }
    hero.bag.push({ id, count: 1, ...validMods });
    return true;
  }
  const maxStack = item.stack || 1;
  for (const entry of hero.bag) {
    if (entry.id !== id || entry.count >= maxStack || hasMods(entry)) {
      continue;
    }
    const added = Math.min(count, maxStack - entry.count);
    entry.count += added;
    count -= added;
    if (count <= 0) {
      return true;
    }
  }
  /* Whatever is left goes into new slots; items that already fit stay in the bag even if the rest does not. */
  while (count > 0) {
    if (hero.bag.length >= BAG_SIZE) {
      return false;
    }
    const added = Math.min(count, maxStack);
    hero.bag.push({ id, count: added });
    count -= added;
  }
  return true;
}

/**
 * Remove `count` of an item from the bag, taking from the last stacks first and from modified (refined or
 * enchanted) entries only when the plain ones run out. False when there are too few.
 */
export function removeFromBag(hero, id, count = 1) {
  if (bagCount(hero, id) < count) {
    return false;
  }
  for (const takeModified of [false, true]) {
    for (let i = hero.bag.length - 1; i >= 0 && count > 0; i--) {
      const entry = hero.bag[i];
      if (entry.id !== id || hasMods(entry) !== takeModified) {
        continue;
      }
      const removed = Math.min(count, entry.count);
      entry.count -= removed;
      count -= removed;
      if (entry.count <= 0) {
        hero.bag.splice(i, 1);
      }
    }
  }
  return true;
}

/**
 * Take one item with this id out of the bag: the entry at `index` when it holds that item, otherwise a plain one.
 * Returns its modifiers ({} when none), or null when the bag has no such item.
 */
export function takeFromBag(hero, id, index) {
  const bag = hero.bag || [];
  let at = Number.isInteger(index) && bag[index] && bag[index].id === id ? index : -1;
  if (at < 0) {
    at = bag.findLastIndex((entry) => entry.id === id && !hasMods(entry));
  }
  if (at < 0) {
    at = bag.findLastIndex((entry) => entry.id === id);
  }
  if (at < 0) {
    return null;
  }
  const entry = bag[at];
  const mods = modsOf(entry) || {};
  entry.count--;
  if (entry.count <= 0) {
    bag.splice(at, 1);
  }
  return mods;
}

/* ---- exp, zeny, levels ---- */

/**
 * Give exp and zeny; part of the exp also counts as job exp. A base level up fully restores HP and SP.
 * @returns {{ups: number, jobUps: number}} the number of base and job levels gained
 */
export function grantReward(hero, { exp = 0, zeny = 0 }) {
  hero.exp += exp;
  hero.zeny += zeny;
  let ups = 0;
  let jobUps = 0;
  while (hero.level < MAX_LEVEL && hero.exp >= expForLevel(hero.level)) {
    hero.exp -= expForLevel(hero.level);
    hero.level++;
    ups++;
  }
  const maxJobLevel = maxJobLevelOf(hero);
  if (hero.jobLevel < maxJobLevel) {
    hero.jobExp += Math.round(exp * JOB_EXP_SHARE);
    while (hero.jobLevel < maxJobLevel && hero.jobExp >= jobExpForLevel(hero.jobLevel)) {
      hero.jobExp -= jobExpForLevel(hero.jobLevel);
      hero.jobLevel++;
      jobUps++;
    }
  }
  if (ups) {
    const derived = derivedStatsOf(hero);
    hero.hp = derived.hpMax;
    hero.sp = derived.spMax;
  }
  return { ups, jobUps };
}

export function raiseStat(hero, key) {
  if (!STATS.some(([statKey]) => statKey === key)) {
    return false;
  }
  const value = hero.stats[key] || 1;
  const cost = statCost(value);
  if (value >= MAX_STAT || freeStatPoints(hero) < cost) {
    return false;
  }
  hero.stats[key] = value + 1;
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  syncStateQuests(hero);
  return true;
}

export function raiseSkill(hero, id) {
  if (freeSkillPoints(hero) <= 0 || !canLearn(hero.skills, id)) {
    return false;
  }
  hero.skills[id] = (hero.skills[id] || 0) + 1;
  syncStateQuests(hero);
  return true;
}

/** Advance to a second class: needs the max job level of the first class. Grants the class armor. */
export function advanceClass(hero, classId) {
  const newClass = CLASSES[classId];
  if (!newClass) {
    return false;
  }
  if (!(ADVANCEMENTS[hero.classId] || []).includes(classId)) {
    return false;
  }
  if (hero.jobLevel < maxJobLevelOf(hero)) {
    return false;
  }
  hero.classId = classId;
  hero.jobLevel = 1;
  hero.jobExp = 0;
  const derived = derivedStatsOf(hero);
  hero.hp = derived.hpMax;
  hero.sp = derived.spMax;
  if (newClass.grantedArmor) {
    addToBag(hero, newClass.grantedArmor, 1);
  }
  return true;
}

/* ---- equipment, shops, potions ---- */

/**
 * Wear an item from the bag (the entry at `index` when given, so a refined copy can be chosen); whatever was in
 * that slot goes back into the bag, with its modifiers.
 */
export function equip(hero, id, index) {
  const item = ITEMS[id];
  if (!item || !item.slot) {
    return false;
  }
  /* class items fit their own class and the second classes built on it */
  if (item.forClass && item.forClass !== hero.classId && item.forClass !== classOf(hero).base) {
    return false;
  }
  const mods = takeFromBag(hero, id, index);
  if (!mods) {
    return false;
  }
  if (!hero.equipmentMods) {
    hero.equipmentMods = {};
  }
  const slot = slotFor(hero, item);
  const previous = hero.equipment[slot];
  const previousMods = hero.equipmentMods[slot];
  hero.equipment[slot] = id;
  setSlotMods(hero, slot, mods);
  if (previous) {
    addToBag(hero, previous, 1, previousMods);
  }
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  syncStateQuests(hero);
  return true;
}

/* store the modifiers of what is worn in a slot, or clear them */
export function setSlotMods(hero, slot, mods) {
  if (!hero.equipmentMods) {
    hero.equipmentMods = {};
  }
  const valid = validModsFor(hero.equipment[slot], mods);
  if (valid) {
    hero.equipmentMods[slot] = valid;
  } else {
    delete hero.equipmentMods[slot];
  }
}

export function unequip(hero, slot) {
  const id = hero.equipment[slot];
  if (!id) {
    return false;
  }
  if (!addToBag(hero, id, 1, hero.equipmentMods && hero.equipmentMods[slot])) {
    return false;
  }
  hero.equipment[slot] = null;
  setSlotMods(hero, slot, null);
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  return true;
}

export function buy(hero, id) {
  const item = ITEMS[id];
  if (!item || !item.price || hero.zeny < item.price) {
    return false;
  }
  if (!addToBag(hero, id)) {
    return false;
  }
  hero.zeny -= item.price;
  recordQuestEvent(hero, "buy", id);
  return true;
}

/** What a shop pays for one of this item (refined items fetch more). */
export const sellPrice = (id, mods) =>
  ITEMS[id] ? Math.floor(ITEMS[id].price * SELL_RATIO * priceFactor(mods)) : 0;

export function sell(hero, id, index) {
  if (!ITEMS[id]) {
    return false;
  }
  const mods = takeFromBag(hero, id, index);
  if (!mods) {
    return false;
  }
  hero.zeny += sellPrice(id, mods);
  return true;
}

export function drop(hero, id, index) {
  return !!ITEMS[id] && !!takeFromBag(hero, id, index);
}

/** Drink a healing potion from the bag; not allowed at full HP. */
export function drinkPotion(hero, id) {
  const item = ITEMS[id];
  if (!item || item.use !== "heal") {
    return false;
  }
  const derived = derivedStatsOf(hero);
  if (hero.hp >= derived.hpMax) {
    return false;
  }
  if (!removeFromBag(hero, id)) {
    return false;
  }
  hero.hp = Math.min(derived.hpMax, hero.hp + item.heal);
  return true;
}

/* ---- quests ---- */

export function acceptQuest(hero, id) {
  if (!hero.quests) {
    hero.quests = {};
  }
  if (questState(id, hero.quests, hero.level) !== "available") {
    return false;
  }
  hero.quests[id] = { state: "active", count: 0 };
  /* what the giver hands over (a tool, a badge) */
  for (const given of QUESTS[id].gives || []) {
    addToBag(hero, given.id, given.count || 1);
  }
  const goal = QUESTS[id].goal;
  /* items already in the bag count straight away, and so does a state goal already met */
  if (goal.type === "item") {
    hero.quests[id].count = Math.min(goal.count, bagCount(hero, goal.item));
  }
  syncStateQuests(hero);
  return true;
}

/** Count something the hero did (bought, gathered, crafted, disenchanted, refined) for the quests waiting for it. */
export const recordQuestEvent = (hero, kind, item, amount = 1) =>
  recordQuestEventIn(hero.quests, kind, item, amount);

/* is the hero's state what this goal asks for? */
function meetsStateGoal(hero, goal) {
  if (goal.type === "equip") {
    return !!(hero.equipment && hero.equipment[goal.slot]);
  }
  if (goal.type === "stat") {
    return statPointsSpent(hero.stats || {}) > 0;
  }
  if (goal.type === "skill") {
    return skillPointsSpent(hero.skills || {}) > 0;
  }
  return false;
}

/** Bring the quests that ask for a state (wear something, raise a stat, learn a skill) in line with the hero. */
export function syncStateQuests(hero) {
  let changed = false;
  for (const [id, progress] of Object.entries(hero.quests || {})) {
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (!goal || progress.state !== "active" || !["equip", "stat", "skill"].includes(goal.type)) {
      continue;
    }
    const count = meetsStateGoal(hero, goal) ? 1 : 0;
    if (count > (progress.count || 0)) {
      progress.count = count;
      changed = true;
    }
  }
  return changed;
}

/** Progress the server cannot see for itself: an npc visited or a place reached. */
export function markQuestProgress(hero, id) {
  const progress = hero.quests && hero.quests[id];
  const quest = QUESTS[id];
  if (!progress || !quest || progress.state !== "active") {
    return false;
  }
  if ((quest.goal.type === "visit" || quest.goal.type === "reach") && !progress.count) {
    progress.count = 1;
    return true;
  }
  return false;
}

/** Count a kill of this monster type for every active kill quest; true when any quest moved on. */
export function recordQuestKill(hero, monsterId) {
  let changed = false;
  for (const id in hero.quests || {}) {
    const progress = hero.quests[id];
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (
      progress &&
      goal &&
      progress.state === "active" &&
      goal.type === "kill" &&
      goal.monster === monsterId &&
      progress.count < goal.count
    ) {
      progress.count++;
      changed = true;
    }
  }
  return changed;
}

/** Bring the count of every active item quest in line with what is in the bag. */
export function syncItemQuests(hero) {
  for (const id in hero.quests || {}) {
    const progress = hero.quests[id];
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (progress && goal && progress.state === "active" && goal.type === "item") {
      progress.count = Math.min(goal.count, bagCount(hero, goal.item));
    }
  }
}

/** Turn in a completed quest: hand over the items, get the reward. */
export function turnInQuest(hero, id) {
  const quest = QUESTS[id];
  const progress = hero.quests && hero.quests[id];
  if (!quest) {
    return false;
  }
  syncItemQuests(hero);
  if (!isQuestComplete(id, progress)) {
    return false;
  }
  if (quest.goal.type === "item" && !removeFromBag(hero, quest.goal.item, quest.goal.count)) {
    return false;
  }
  progress.state = "done";
  const reward = quest.reward;
  grantReward(hero, { exp: reward.exp, zeny: reward.zeny });
  const isMage = MAGE_CLASSES.includes(hero.classId);
  for (const rewardItem of reward.items || []) {
    const itemId = isMage && rewardItem.mage ? rewardItem.mage : rewardItem.id;
    addToBag(hero, itemId, rewardItem.count);
  }
  return true;
}

/* ---- a new record, and cleaning up a record that comes from outside ---- */

/** A fresh level 1 hero of a first class (anything else becomes a swordsman). */
export function newHero({ name, hair, classId }) {
  const validClassId = CLASSES[classId] && CLASSES[classId].tier === 1 ? classId : "swordsman";
  const hero = {
    name,
    hair: hair || "plum",
    classId: validClassId,
    level: 1,
    exp: 0,
    jobLevel: 1,
    jobExp: 0,
    stats: baseStats(),
    skills: {},
    zeny: 0,
    equipment: { ...emptyEquipment(), ...CLASSES[validClassId].starterEquipment },
    equipmentMods: {},
    bag: STARTER_BAG.map((entry) => ({ ...entry })),
    quests: {},
    professions: {},
    buffs: {},
    x: 0,
    z: 4,
  };
  const derived = derivedStatsOf(hero);
  hero.hp = derived.hpMax;
  hero.sp = derived.spMax;
  return hero;
}

/* A whole number clamped to [min, max]; `fallback` when the value is not a number. */
function clampInt(value, min, max, fallback = min) {
  const rounded = Math.round(+value);
  return Number.isFinite(rounded) ? Math.max(min, Math.min(max, rounded)) : fallback;
}

/**
 * Pull everything a hero brings from outside within the rules: valid ids, no more points than earned, no
 * impossible stacks. What does not fit is trimmed, not refused. Old (Dutch) records are migrated first.
 */
export function sanitizeHero(input) {
  const source = migrateHero(input);
  const hero = {};
  hero.name =
    String(source.name || "")
      .slice(0, 14)
      .trim() || "Hero";
  hero.hair = typeof source.hair === "string" ? source.hair.slice(0, 16) : "plum";
  hero.classId = CLASSES[source.classId] ? source.classId : "swordsman";
  hero.level = clampInt(source.level, 1, MAX_LEVEL, 1);
  hero.exp = clampInt(source.exp, 0, expForLevel(hero.level) - 1, 0);
  hero.jobLevel = clampInt(source.jobLevel, 1, maxJobLevelOf(hero), 1);
  hero.jobExp = clampInt(source.jobExp, 0, jobExpForLevel(hero.jobLevel) - 1, 0);

  /* stats: clamp each, then take points back from the highest stat until the spending fits the level */
  hero.stats = baseStats();
  for (const [key] of STATS) {
    hero.stats[key] = clampInt(source.stats && source.stats[key], 1, MAX_STAT, 1);
  }
  while (statPointsSpent(hero.stats) > statPointsForLevel(hero.level)) {
    const highest = STATS.map(([key]) => key).reduce((a, b) =>
      hero.stats[a] >= hero.stats[b] ? a : b,
    );
    if (hero.stats[highest] <= 1) {
      break;
    }
    hero.stats[highest]--;
  }

  /* skills: known ids only, then take levels back from the highest skill until the points fit */
  hero.skills = {};
  for (const [id, skillLevel] of Object.entries(source.skills || {})) {
    if (SKILLS[id]) {
      hero.skills[id] = clampInt(skillLevel, 0, SKILLS[id].maxLevel, 0);
    }
  }
  for (const id in hero.skills) {
    if (!hero.skills[id]) {
      delete hero.skills[id];
    }
  }
  while (skillPointsSpent(hero.skills) > Math.max(0, freeSkillPoints({ ...hero, skills: {} }))) {
    const highest = Object.keys(hero.skills).reduce((a, b) =>
      hero.skills[a] >= hero.skills[b] ? a : b,
    );
    hero.skills[highest]--;
    if (!hero.skills[highest]) {
      delete hero.skills[highest];
    }
  }

  hero.zeny = clampInt(source.zeny, 0, 99999999, 0);

  hero.equipment = emptyEquipment();
  hero.equipmentMods = {};
  for (const slot in hero.equipment) {
    const id = source.equipment && source.equipment[slot];
    if (id && fitsSlot(id, slot)) {
      hero.equipment[slot] = id;
      setSlotMods(hero, slot, source.equipmentMods && source.equipmentMods[slot]);
    }
  }

  hero.bag = [];
  for (const entry of Array.isArray(source.bag) ? source.bag : []) {
    if (!entry || !ITEMS[entry.id]) {
      continue;
    }
    addToBag(hero, entry.id, clampInt(entry.count, 1, ITEMS[entry.id].stack || 1, 1), entry);
  }

  hero.professions = sanitizeProfessions(source.professions);
  hero.buffs = {};
  for (const [stat, buff] of Object.entries(source.buffs || {})) {
    if (STATS.some(([key]) => key === stat) && buff && Number.isFinite(+buff.until)) {
      hero.buffs[stat] = { amount: clampInt(buff.amount, 0, 20, 0), until: +buff.until };
    }
  }

  /* only active and done quests are stored; 'ready' follows from the count */
  hero.quests = {};
  for (const [id, progress] of Object.entries(source.quests || {})) {
    if (QUESTS[id] && progress && (progress.state === "active" || progress.state === "done")) {
      hero.quests[id] = {
        state: progress.state,
        count: clampInt(progress.count, 0, QUESTS[id].goal.count || 1, 0),
      };
    }
  }

  const derived = derivedStatsOf(hero);
  hero.hp = clampInt(source.hp, 1, derived.hpMax, derived.hpMax);
  hero.sp = clampInt(source.sp, 0, derived.spMax, derived.spMax);
  hero.x = Number.isFinite(+source.x) ? +(+source.x).toFixed(2) : 0;
  hero.z = Number.isFinite(+source.z) ? +(+source.z).toFixed(2) : 4;
  return hero;
}
