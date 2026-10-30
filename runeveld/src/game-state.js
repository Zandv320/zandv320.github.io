/* Eldoria – shared state of the game loop: the player, the monsters and the other players, the UI panels and
   the network connection, plus everything that follows from the hero (class, derived stats, free points).
   The other game-loop modules (player.js, monsters.js, abilities.js, bag.js, skill-effects.js) and main.js all
   work on these objects. */
import { CLASSES, STARTER_BAG } from "./data.js";
import { baseStats, statPointsForLevel, statPointsSpent } from "./rules/stats.js";
import * as progression from "./rules/progression.js";
import {
  SKILLS_BY_CLASS,
  MAX_JOB_LEVEL,
  MAX_JOB_LEVEL_BY_TIER,
  skillPointsForJobLevel,
  skillPointsSpent,
} from "./rules/skills.js";

/** Game time in seconds. */
export const now = () => performance.now() / 1000;
/** A random number in [min, max). */
export const randomBetween = (min, max) => min + Math.random() * (max - min);

/* The player: the hero record fields (saved) plus runtime state. */
export const player = {
  name: "",
  hair: "plum",
  classId: "swordsman",
  level: 1,
  exp: 0,
  jobLevel: 1,
  jobExp: 0,
  stats: baseStats(),
  skills: {},
  hp: 60,
  sp: 14,
  zeny: 0,
  x: 0,
  z: 4,
  equipment: { ...CLASSES.swordsman.starterEquipment },
  /* refine and enchant of what is worn, per slot */
  equipmentMods: {},
  bag: STARTER_BAG.map((entry) => ({ ...entry })),
  quests: {},
  /* profession levels {id: {level, exp}} and running elixirs {stat: {amount, until}} */
  professions: {},
  buffs: {},
  /* runtime only */
  isDead: false,
  isSitting: false,
  heroIndex: 0 /* index of this hero in the hero list */,
  wardUntil: 0 /* Mana Ward / Mana Shell: SP absorbs damage until this time */,
  wardShare: 0,
  sprite: null,
  label: null,
  destination: null /* [x, z] to walk to */,
  onArrive: null /* called on reaching the destination (talking to an npc) */,
  target: null /* the monster being attacked */,
  queuedSkill: null /* a skill to use as soon as the target is in range */,
  cooldowns: {},
  nextAttackAt: 0,
  busyUntil: 0 /* attack or hurt animation playing */,
  seq: 0 /* counts one-shot animations, so other players replay them */,
  anim: "idle",
  /* a profession animation (mine, chop, smith, ...) that replaces idle while working; gathering.js sets it */
  workAnim: null,
  regenTimer: 0,
  respawnAt: 0,
};

/** Monsters: world id (`<monsterId>#<n>`) → monster. */
export const monsters = new Map();
/** Other players: peer id → peer. */
export const peers = new Map();
/** Meshes that react to a click (monsters, npcs, villagers, other players). */
export const clickables = [];

/* switches of the admin panel (admin.js) */
export const ADMIN = {
  god: false,
  speed: 1,
  frozen: false,
  noclip: false,
  expMultiplier: 1,
  dropMultiplier: 1,
};

/* Objects created during startup. `host` is set while this client simulates the monsters (no server). */
export const game = {
  isStarted: false,
  network: null,
  party: null,
  host: null,
  merchant: null,
  heroList: null,
  effects: null,
  daylight: null,
  characterSelect: null,
  characterSheet: null,
  inventory: null,
  adminPanel: null,
  questLog: null,
  dialogue: null,
  worldMap: null,
};

/** Plays a sprite effect (effects.js); returns its handle or null. */
export function playEffect(name, x, z, options) {
  return game.effects.play(name, x, z, options);
}

/* everything that follows from level, stats, equipment (with refine and enchantments), skills and elixirs */
export const equippedItems = () => progression.equippedItems(player);
export const heroClass = () => CLASSES[player.classId] || CLASSES.swordsman;
export const maxJobLevel = () => MAX_JOB_LEVEL_BY_TIER[heroClass().tier] || MAX_JOB_LEVEL;
/** The skill ids on the hotbar for the player's class. */
export const hotbarSkills = () =>
  SKILLS_BY_CLASS[player.classId]
    ? SKILLS_BY_CLASS[player.classId].hotbar
    : SKILLS_BY_CLASS.swordsman.hotbar;
export const derived = () => progression.derivedStatsOf(player);
export const hpMax = () => derived().hpMax;
export const spMax = () => derived().spMax;
export const freeStatPoints = () =>
  statPointsForLevel(player.level) - statPointsSpent(player.stats);
/* after the class advancement the points of the first class stay */
export const freeSkillPoints = () =>
  (heroClass().tier === 2 ? skillPointsForJobLevel(MAX_JOB_LEVEL_BY_TIER[1]) : 0) +
  skillPointsForJobLevel(player.jobLevel) -
  skillPointsSpent(player.skills);
/* other modules (party.js) read the maximum HP from the player object */
player.hpMax = hpMax;
