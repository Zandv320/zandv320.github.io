/* Eldoria – game rules: job levels, the skills and the skill trees of every class.
   Pure data and functions without browser or network code. */

/* First classes reach job level 20; second classes go up to 50. */
export const MAX_JOB_LEVEL = 20;
export const MAX_JOB_LEVEL_BY_TIER = { 1: 20, 2: 50 };

/** Job exp needed to go from `jobLevel` to the next one. */
export const jobExpForLevel = (jobLevel) => Math.round(30 * Math.pow(jobLevel, 1.5));

/* Share of the base exp that also counts as job exp. */
export const JOB_EXP_SHARE = 0.6;

/* Every skill. Effects that scale with the skill level are functions of that level; `text(level)` is the short
   summary shown in the skill tree. `requires` maps prerequisite skill ids to the level needed. */
export const SKILLS = {
  /* ---- swordsman ---- */
  crushing_blow: {
    name: "Crushing Blow",
    icon: "⚔️",
    maxLevel: 10,
    requires: {},
    description: "A heavy two-handed blow on your target. The bread and butter of every swordsman.",
    spCost: (l) => 3 + Math.round(l * 0.6),
    mult: (l) => 1.4 + 0.3 * l,
    cooldown: 1,
    text: (l) => `${Math.round((1.4 + 0.3 * l) * 100)}% damage · ${3 + Math.round(l * 0.6)} SP`,
  },
  flame_sweep: {
    name: "Flame Sweep",
    icon: "🔥",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description:
      "A sweeping strike that bursts into a ring of fire around you. INT makes it stronger.",
    spCost: (l) => 10 + l * 2,
    mult: (l) => 1.1 + 0.2 * l,
    radius: 3,
    cooldown: 5,
    text: (l) => `${Math.round((1.1 + 0.2 * l) * 100)}% damage in a ring · ${10 + l * 2} SP`,
  },
  blade_mastery: {
    name: "Blade Mastery",
    icon: "🗡️",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: years of drills. You hit harder with any sword.",
    atk: (l) => 5 * l,
    text: (l) => `ATK +${5 * l}`,
  },
  second_wind: {
    name: "Second Wind",
    icon: "❤️",
    maxLevel: 10,
    requires: {},
    passive: true,
    description:
      "Passive: you catch your breath faster and recover HP quicker, especially while sitting.",
    regen: (l) => 0.25 * l,
    text: (l) => `+${Math.round(25 * l)}% HP recovery`,
  },
  war_cry: {
    name: "War Cry",
    icon: "😤",
    maxLevel: 5,
    requires: { crushing_blow: 3 },
    description:
      "A roar that draws every monster nearby to you. Gather a group, then sweep them with fire.",
    spCost: () => 6,
    radius: (l) => 5 + l,
    cooldown: 8,
    text: (l) => `range ${5 + l} · 6 SP`,
  },
  quickening: {
    name: "Quickening",
    icon: "⏩",
    maxLevel: 5,
    requires: { blade_mastery: 3 },
    description: "Your sword arm moves faster for a while: more attacks per second.",
    spCost: () => 10,
    duration: (l) => 20 + 5 * l,
    factor: (l) => 1 - 0.05 * l,
    cooldown: 35,
    text: (l) => `${Math.round(5 * l)}% faster attacks for ${20 + 5 * l}s · 10 SP`,
  },
  stoneskin: {
    name: "Stoneskin",
    icon: "🪨",
    maxLevel: 5,
    requires: { second_wind: 2 },
    passive: true,
    description: "Passive: your skin hardens like rock. Extra DEF.",
    def: (l) => 3 * l,
    text: (l) => `DEF +${3 * l}`,
  },
  stunning_strike: {
    name: "Stunning Strike",
    icon: "💥",
    maxLevel: 5,
    requires: { flame_sweep: 3 },
    passive: true,
    description: "Passive: Crushing Blow has a chance to stun the target for a moment.",
    chance: (l) => 0.06 * l,
    text: (l) => `${Math.round(6 * l)}% stun chance on Crushing Blow`,
  },
  /* ---- mage ---- */
  ember_bolt: {
    name: "Ember Bolt",
    icon: "🔥",
    maxLevel: 10,
    requires: {},
    description: "Hurls a bolt of fire at your target from a distance. Never misses.",
    spCost: (l) => 6 + l,
    mult: (l) => 1.1 + 0.2 * l,
    range: 7,
    cooldown: 1.1,
    text: (l) => `${Math.round((1.1 + 0.2 * l) * 100)}% MATK · range 7 · ${6 + l} SP`,
  },
  frostburst: {
    name: "Frostburst",
    icon: "❄️",
    maxLevel: 10,
    requires: { ember_bolt: 3 },
    description:
      "A burst of frost around you: damages every monster nearby and freezes them in place for a moment.",
    spCost: (l) => 14 + l * 2,
    mult: (l) => 0.9 + 0.15 * l,
    radius: 3.5,
    freeze: (l) => 1.5 + 0.2 * l,
    cooldown: 7,
    text: (l) =>
      `${Math.round((0.9 + 0.15 * l) * 100)}% MATK in a ring · freeze ${(1.5 + 0.2 * l).toFixed(1)}s · ${14 + l * 2} SP`,
  },
  mana_ward: {
    name: "Mana Ward",
    icon: "🛡️",
    maxLevel: 5,
    requires: { ember_bolt: 1 },
    description: "A shimmering ward that lets your SP absorb part of every blow for a while.",
    spCost: () => 15,
    duration: (l) => 15 + l * 3,
    share: (l) => 0.3 + 0.05 * l,
    cooldown: 25,
    text: (l) =>
      `absorbs ${Math.round((0.3 + 0.05 * l) * 100)}% of damage with SP for ${15 + l * 3}s · 15 SP`,
  },
  ice_shard: {
    name: "Ice Shard",
    icon: "🧊",
    maxLevel: 10,
    requires: { ember_bolt: 3 },
    description: "A shard of ice that chills the target: damage and a short freeze.",
    spCost: (l) => 8 + l,
    mult: (l) => 1.1 + 0.2 * l,
    range: 7,
    freeze: (l) => 0.5 + 0.1 * l,
    cooldown: 1.4,
    text: (l) =>
      `${Math.round((1.1 + 0.2 * l) * 100)}% MATK · freeze ${(0.5 + 0.1 * l).toFixed(1)}s · ${8 + l} SP`,
  },
  spirit_volley: {
    name: "Spirit Volley",
    icon: "👻",
    maxLevel: 10,
    requires: { inner_calm: 2 },
    description: "Spirit bolts fly at your target one after another. More bolts as you level it.",
    spCost: (l) => 12 + l * 2,
    mult: (l) => 0.55 + 0.07 * l,
    bolts: (l) => 2 + Math.floor(l / 4),
    range: 7,
    cooldown: 2.5,
    text: (l) =>
      `${2 + Math.floor(l / 4)} bolts of ${Math.round((0.55 + 0.07 * l) * 100)}% MATK · range 7 · ${12 + l * 2} SP`,
  },
  clear_mind: {
    name: "Clear Mind",
    icon: "🎯",
    maxLevel: 5,
    requires: { arcane_mastery: 3 },
    passive: true,
    description: "Passive: a calm mind casts cheaper. Your spells cost less SP.",
    discount: (l) => 0.04 * l,
    text: (l) => `spells cost ${Math.round(4 * l)}% less SP`,
  },
  arcane_mastery: {
    name: "Arcane Mastery",
    icon: "🪄",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: your spells hit harder with any staff.",
    matk: (l) => 6 * l,
    text: (l) => `MATK +${6 * l}`,
  },
  inner_calm: {
    name: "Inner Calm",
    icon: "🧘",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: you recover SP faster, especially while sitting.",
    regen: (l) => 0.25 * l,
    text: (l) => `+${Math.round(25 * l)}% SP recovery`,
  },
  /* ---- knight ---- */
  piercing_thrust: {
    name: "Piercing Thrust",
    icon: "🗡️",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description: "A lunging thrust that goes straight through any armor. Never misses.",
    spCost: (l) => 8 + l,
    mult: (l) => 1.5 + 0.3 * l,
    cooldown: 1.5,
    text: (l) => `${Math.round((1.5 + 0.3 * l) * 100)}% damage · never misses · ${8 + l} SP`,
  },
  whirlwind_sweep: {
    name: "Whirlwind Sweep",
    icon: "🎳",
    maxLevel: 10,
    requires: { piercing_thrust: 3 },
    description: "A spinning blow that hits every monster around you and sends them flying.",
    spCost: (l) => 14 + l * 2,
    mult: (l) => 1.2 + 0.2 * l,
    radius: 2.6,
    cooldown: 6,
    text: (l) =>
      `${Math.round((1.2 + 0.2 * l) * 100)}% damage in a ring · knockback · ${14 + l * 2} SP`,
  },
  iron_resolve: {
    name: "Iron Resolve",
    icon: "🧱",
    maxLevel: 5,
    requires: {},
    description: "For a while nothing moves you: no knockback, and extra DEF.",
    spCost: () => 12,
    duration: (l) => 20 + 4 * l,
    def: (l) => 5 * l,
    cooldown: 30,
    text: (l) => `DEF +${5 * l}, no knockback for ${20 + 4 * l}s · 12 SP`,
  },
  spiral_lance: {
    name: "Spiral Lance",
    icon: "🌀",
    maxLevel: 5,
    requires: { whirlwind_sweep: 3 },
    description: "Three spinning thrusts in a row on one target.",
    spCost: (l) => 14 + l * 2,
    mult: (l) => 0.8 + 0.15 * l,
    hits: 3,
    cooldown: 5,
    text: (l) => `3 hits of ${Math.round((0.8 + 0.15 * l) * 100)}% damage · ${14 + l * 2} SP`,
  },
  /* ---- crusader ---- */
  radiant_cross: {
    name: "Radiant Cross",
    icon: "✝️",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description: "A cross-shaped strike of blessed steel. Your INT adds to it.",
    spCost: (l) => 9 + l,
    mult: (l) => 1.4 + 0.3 * l,
    cooldown: 1.6,
    text: (l) => `${Math.round((1.4 + 0.3 * l) * 100)}% damage (+INT) · ${9 + l} SP`,
  },
  shield_rush: {
    name: "Shield Rush",
    icon: "🛡️",
    maxLevel: 5,
    requires: { radiant_cross: 3 },
    description: "Rush at your target behind your shield and stun it for a moment.",
    spCost: () => 12,
    mult: (l) => 1 + 0.2 * l,
    range: 4,
    freeze: (l) => 1.5 + 0.3 * l,
    cooldown: 8,
    text: (l) =>
      `${Math.round((1 + 0.2 * l) * 100)}% damage · stun ${(1.5 + 0.3 * l).toFixed(1)}s · 12 SP`,
  },
  mending_light: {
    name: "Mending Light",
    icon: "💚",
    maxLevel: 10,
    requires: {},
    description: "A prayer of light that mends your wounds.",
    spCost: (l) => 10 + l * 2,
    share: (l) => 0.12 + 0.03 * l,
    cooldown: 8,
    text: (l) => `heals ${Math.round((0.12 + 0.03 * l) * 100)}% of your HP · ${10 + l * 2} SP`,
  },
  aegis_of_light: {
    name: "Aegis of Light",
    icon: "🔆",
    maxLevel: 5,
    requires: { mending_light: 3 },
    passive: true,
    description: "Passive: a shield of light returns part of every blow to the attacker.",
    share: (l) => 0.06 * l,
    text: (l) => `reflects ${Math.round(6 * l)}% of damage taken`,
  },
  /* ---- wizard ---- */
  thunderclap: {
    name: "Thunderclap",
    icon: "⚡",
    maxLevel: 10,
    requires: { ember_bolt: 5 },
    description: "Calls a bolt of lightning down on a single target from afar.",
    spCost: (l) => 12 + l * 2,
    mult: (l) => 2 + 0.35 * l,
    range: 8,
    cooldown: 2.5,
    text: (l) => `${Math.round((2 + 0.35 * l) * 100)}% MATK · range 8 · ${12 + l * 2} SP`,
  },
  blizzard: {
    name: "Blizzard",
    icon: "🌪️",
    maxLevel: 10,
    requires: { frostburst: 3 },
    description:
      "A howling blizzard around you: heavy damage and a long freeze on everything nearby.",
    spCost: (l) => 24 + l * 3,
    mult: (l) => 1.4 + 0.25 * l,
    radius: 5,
    freeze: (l) => 2 + 0.3 * l,
    cooldown: 12,
    text: (l) =>
      `${Math.round((1.4 + 0.25 * l) * 100)}% MATK in a wide ring · freeze ${(2 + 0.3 * l).toFixed(1)}s · ${24 + l * 3} SP`,
  },
  mana_shell: {
    name: "Mana Shell",
    icon: "🔵",
    maxLevel: 5,
    requires: { mana_ward: 1 },
    description: "A shell of pure energy: your SP absorbs most of every blow.",
    spCost: () => 20,
    duration: (l) => 25 + l * 5,
    share: (l) => 0.5 + 0.05 * l,
    cooldown: 40,
    text: (l) =>
      `absorbs ${Math.round((0.5 + 0.05 * l) * 100)}% of damage with SP for ${25 + l * 5}s · 20 SP`,
  },
  starfall: {
    name: "Starfall",
    icon: "☄️",
    maxLevel: 5,
    requires: { blizzard: 3 },
    description: "Pulls a burning star down on your target. Everything around the impact burns.",
    spCost: (l) => 30 + l * 4,
    mult: (l) => 2.4 + 0.4 * l,
    radius: 3,
    range: 8,
    cooldown: 14,
    text: (l) =>
      `${Math.round((2.4 + 0.4 * l) * 100)}% MATK in a ring of 3 around the target · ${30 + l * 4} SP`,
  },
  /* ---- sage ---- */
  stone_spires: {
    name: "Stone Spires",
    icon: "🪨",
    maxLevel: 10,
    requires: { ember_bolt: 5 },
    description: "Spires of stone burst from the ground under your target.",
    spCost: (l) => 10 + l * 2,
    mult: (l) => 1.8 + 0.3 * l,
    range: 7,
    cooldown: 1.8,
    text: (l) => `${Math.round((1.8 + 0.3 * l) * 100)}% MATK · range 7 · ${10 + l * 2} SP`,
  },
  mana_echo: {
    name: "Mana Echo",
    icon: "🪞",
    maxLevel: 5,
    requires: { stone_spires: 3 },
    passive: true,
    description: "Passive: an echo of every spell flows back to you as SP.",
    share: (l) => 0.015 * l,
    text: (l) => `${(1.5 * l).toFixed(1)}% of spell damage returns as SP`,
  },
  wellspring: {
    name: "Wellspring",
    icon: "💧",
    maxLevel: 5,
    requires: { inner_calm: 1 },
    description: "Draw on the land itself to refill part of your SP.",
    spCost: () => 0,
    share: (l) => 0.1 + 0.04 * l,
    cooldown: 20,
    text: (l) => `restores ${Math.round((0.1 + 0.04 * l) * 100)}% of your SP · free`,
  },
};

/* The skill trees: per class, the skills on a grid of three branches (x 0..2) and rows (y). The lines in the
   character sheet follow the prerequisites (`requires`). A second class takes over the tree of its first class
   and builds on below it. */
const SWORDSMAN_TREE = {
  crushing_blow: [0, 0],
  blade_mastery: [1, 0],
  second_wind: [2, 0],
  flame_sweep: [0, 1],
  quickening: [1, 1],
  war_cry: [2, 1],
  stunning_strike: [0, 2],
  stoneskin: [2, 2],
};
const MAGE_TREE = {
  ember_bolt: [0, 0],
  arcane_mastery: [1, 0],
  inner_calm: [2, 0],
  frostburst: [0, 1],
  clear_mind: [1, 1],
  spirit_volley: [2, 1],
  ice_shard: [0, 2],
  mana_ward: [1, 2],
};
export const SKILL_TREES = {
  swordsman: SWORDSMAN_TREE,
  mage: MAGE_TREE,
  knight: {
    ...SWORDSMAN_TREE,
    piercing_thrust: [0, 3],
    iron_resolve: [2, 3],
    whirlwind_sweep: [0, 4],
    spiral_lance: [1, 4],
  },
  crusader: {
    ...SWORDSMAN_TREE,
    radiant_cross: [0, 3],
    mending_light: [2, 3],
    shield_rush: [0, 4],
    aegis_of_light: [2, 4],
  },
  wizard: {
    ...MAGE_TREE,
    thunderclap: [0, 3],
    mana_shell: [1, 3],
    blizzard: [0, 4],
    starfall: [2, 4],
  },
  sage: {
    ...MAGE_TREE,
    stone_spires: [0, 3],
    mending_light: [2, 3],
    mana_echo: [0, 4],
    wellspring: [1, 4],
  },
};

/* The branch labels per class. */
export const TREE_BRANCHES = {
  swordsman: ["Offense", "Mastery", "Defense"],
  mage: ["Fire & Ice", "Focus", "Spirit"],
  knight: ["Offense", "Mastery", "Defense"],
  crusader: ["Offense", "Mastery", "Faith"],
  wizard: ["Elements", "Focus", "Spirit"],
  sage: ["Earth", "Focus", "Spirit"],
};

/* Skill ids in tree order: row by row, left to right. */
function treeOrder(tree) {
  return Object.keys(tree).sort((a, b) => tree[a][1] - tree[b][1] || tree[a][0] - tree[b][0]);
}

/* The active skills of a tree in tree order; passive skills do not go on the hotbar. */
function hotbarSkills(tree) {
  return treeOrder(tree).filter((id) => !SKILLS[id].passive);
}

/* Per class: `order` (for lists) and `hotbar` (the active skills). */
export const SKILLS_BY_CLASS = {};
for (const classId of Object.keys(SKILL_TREES)) {
  SKILLS_BY_CLASS[classId] = {
    order: treeOrder(SKILL_TREES[classId]),
    hotbar: hotbarSkills(SKILL_TREES[classId]),
  };
}

/**
 * Skill points a hero has earned in total at this job level: one per job level plus one extra every two levels.
 * At job 20 (first class) that is 29 points; job 50 of a second class adds another 74.
 */
export const skillPointsForJobLevel = (jobLevel) =>
  Math.max(0, jobLevel - 1 + Math.floor(jobLevel / 2));

export const skillPointsSpent = (skills) =>
  Object.values(skills).reduce((total, level) => total + (level || 0), 0);

/** May this skill go up one level, given the skills learned so far? */
export function canLearn(skills, id) {
  const skill = SKILLS[id];
  if (!skill) {
    return false;
  }
  if ((skills[id] || 0) >= skill.maxLevel) {
    return false;
  }
  for (const [requiredId, requiredLevel] of Object.entries(skill.requires)) {
    if ((skills[requiredId] || 0) < requiredLevel) {
      return false;
    }
  }
  return true;
}
