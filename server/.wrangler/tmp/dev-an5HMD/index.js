var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
import { DurableObject as DurableObject3 } from "cloudflare:workers";

// ../runeveld/src/data.js
var CLASSES = {
  swordsman: {
    name: "Swordsman",
    icon: "\u2694\uFE0F",
    tier: 1,
    base: "swordsman",
    speed: 4.6,
    range: 1.5,
    hpFactor: 1,
    spFactor: 1,
    description: "Strong up close. Skills: Crushing Blow, Flame Sweep, War Cry.",
    starterEquipment: { head: null, body: "tattered_tunic", weapon: "wooden_sword" }
  },
  mage: {
    name: "Mage",
    icon: "\u{1F52E}",
    tier: 1,
    base: "mage",
    speed: 4.4,
    range: 1.3,
    hpFactor: 0.78,
    spFactor: 1.7,
    description: "Fragile, but deadly from a distance. Skills: Ember Bolt, Frostburst, Mana Ward.",
    starterEquipment: { head: null, body: "apprentice_robe", weapon: "wooden_staff" }
  },
  /* Second classes, chosen at an npc on job level 20; the job level resets to 1 and then runs to 50. */
  knight: {
    name: "Knight",
    icon: "\u{1F6E1}\uFE0F",
    tier: 2,
    base: "swordsman",
    speed: 4.7,
    range: 1.5,
    hpFactor: 1.15,
    spFactor: 1,
    mentor: "Guard Rolf",
    grantedArmor: "knight_plate",
    description: "Heavy armor and heavier blows. Piercing Thrust, Whirlwind Sweep and Spiral Lance."
  },
  crusader: {
    name: "Crusader",
    icon: "\u271D\uFE0F",
    tier: 2,
    base: "swordsman",
    speed: 4.5,
    range: 1.5,
    hpFactor: 1.1,
    spFactor: 1.3,
    mentor: "Guard Rolf",
    grantedArmor: "crusader_plate",
    description: "Blessed steel: Radiant Cross, Shield Rush and Mending Light."
  },
  wizard: {
    name: "Wizard",
    icon: "\u26A1",
    tier: 2,
    base: "mage",
    speed: 4.4,
    range: 1.3,
    hpFactor: 0.8,
    spFactor: 2,
    mentor: "Old Mette",
    grantedArmor: "wizard_robe",
    description: "Raw elemental power: Thunderclap, Blizzard and Starfall."
  },
  sage: {
    name: "Sage",
    icon: "\u{1F4D7}",
    tier: 2,
    base: "mage",
    speed: 4.5,
    range: 1.3,
    hpFactor: 0.95,
    spFactor: 1.8,
    mentor: "Old Mette",
    grantedArmor: "sage_robe",
    description: "Scholar of magic: Stone Spires, Wellspring and Mending Light."
  }
};
var ADVANCEMENTS = { swordsman: ["knight", "crusader"], mage: ["wizard", "sage"] };
var MAX_LEVEL = 99;
var expForLevel = /* @__PURE__ */ __name((level) => Math.round(40 * Math.pow(level, 1.55) * (level <= 30 ? 1 : 1 + Math.pow((level - 30) / 20, 1.5))), "expForLevel");
var emptyEquipment = /* @__PURE__ */ __name(() => ({
  head: null,
  body: null,
  cloak: null,
  weapon: null,
  necklace: null,
  ring1: null,
  ring2: null,
  belt: null,
  pants: null,
  boots: null
}), "emptyEquipment");
var BAG_SIZE = 20;
var ITEMS = {
  red_potion: {
    name: "Red potion",
    use: "heal",
    heal: 45,
    cooldown: 1,
    price: 25,
    icon: "\u{1F9EA}",
    stack: 99,
    description: "Restores 45 HP."
  },
  leather_cap: {
    name: "Leather cap",
    slot: "head",
    layer: "cap",
    def: 1,
    price: 60,
    icon: "\u{1F9E2}",
    description: "A snug cap of worn leather."
  },
  iron_helm: {
    name: "Iron helm",
    slot: "head",
    layer: "helm",
    def: 4,
    hp: 15,
    price: 500,
    icon: "\u26D1\uFE0F",
    forClass: "swordsman",
    description: "Heavy, dented and reassuring."
  },
  pointed_hat: {
    name: "Pointed hat",
    slot: "head",
    layer: "hat1",
    def: 1,
    sp: 8,
    price: 60,
    icon: "\u{1F3A9}",
    forClass: "mage",
    description: "Blue felt, slightly bent. Every mage starts here."
  },
  starry_hat: {
    name: "Starry hat",
    slot: "head",
    layer: "hat2",
    def: 3,
    sp: 25,
    matk: 6,
    price: 500,
    icon: "\u{1F31F}",
    forClass: "mage",
    description: "Purple, with a gold band. It hums faintly at night."
  },
  tattered_tunic: {
    name: "Tattered tunic",
    slot: "body",
    layer: "armor1",
    def: 2,
    price: 30,
    icon: "\u{1F455}",
    description: "Better than nothing. Just about."
  },
  leather_vest: {
    name: "Leather vest",
    slot: "body",
    layer: "armor2",
    def: 6,
    hp: 25,
    price: 350,
    icon: "\u{1F9BA}",
    forClass: "swordsman",
    description: "Sturdy leather, stitched by someone who cared."
  },
  steel_armor: {
    name: "Steel armor",
    slot: "body",
    layer: "armor3",
    def: 12,
    hp: 70,
    price: 1500,
    icon: "\u{1F6E1}\uFE0F",
    forClass: "swordsman",
    description: "Polished steel. Turns heads and blades."
  },
  apprentice_robe: {
    name: "Apprentice robe",
    slot: "body",
    layer: "robe1",
    def: 1,
    sp: 10,
    price: 30,
    icon: "\u{1F94B}",
    forClass: "mage",
    description: "Blue wool, a little scorched at the sleeves."
  },
  silk_robe: {
    name: "Silk robe",
    slot: "body",
    layer: "robe2",
    def: 4,
    sp: 30,
    matk: 5,
    price: 350,
    icon: "\u{1F458}",
    forClass: "mage",
    description: "Red silk that whispers when you walk."
  },
  archmage_robe: {
    name: "Archmage robe",
    slot: "body",
    layer: "robe3",
    def: 8,
    sp: 70,
    matk: 12,
    price: 1500,
    icon: "\u{1F9D9}",
    forClass: "mage",
    description: "Deep purple, stitched with runes that glow under moonlight."
  },
  /* Class armor of the second classes, granted on advancement. */
  knight_plate: {
    name: "Knight plate",
    slot: "body",
    layer: "armor4",
    def: 16,
    hp: 120,
    price: 3e3,
    icon: "\u{1F6E1}\uFE0F",
    forClass: "knight",
    description: "Blued steel, forged for the road beyond the forest."
  },
  crusader_plate: {
    name: "Crusader plate",
    slot: "body",
    layer: "armor5",
    def: 14,
    hp: 90,
    sp: 25,
    price: 3e3,
    icon: "\u271D\uFE0F",
    forClass: "crusader",
    description: "Silver with gold trim. It catches the light even at night."
  },
  wizard_robe: {
    name: "Wizard robe",
    slot: "body",
    layer: "robe4",
    def: 9,
    sp: 110,
    matk: 22,
    price: 3e3,
    icon: "\u26A1",
    forClass: "wizard",
    description: "Midnight blue, humming with static."
  },
  sage_robe: {
    name: "Sage robe",
    slot: "body",
    layer: "robe5",
    def: 10,
    sp: 120,
    matk: 16,
    hp: 40,
    price: 3e3,
    icon: "\u{1F4D7}",
    forClass: "sage",
    description: "Forest green, pockets full of notes."
  },
  wooden_sword: {
    name: "Wooden sword",
    slot: "weapon",
    layer: "sword1",
    atk: 4,
    price: 25,
    icon: "\u{1FAB5}",
    forClass: "swordsman",
    description: "A practice sword. The rabbits still mind it."
  },
  iron_sword: {
    name: "Iron sword",
    slot: "weapon",
    layer: "sword2",
    atk: 11,
    price: 400,
    icon: "\u{1F5E1}\uFE0F",
    forClass: "swordsman",
    description: "A proper blade with a proper edge."
  },
  steel_sword: {
    name: "Steel sword",
    slot: "weapon",
    layer: "sword3",
    atk: 22,
    price: 1800,
    icon: "\u2694\uFE0F",
    forClass: "swordsman",
    description: "Forged for someone who means it."
  },
  wooden_staff: {
    name: "Wooden staff",
    slot: "weapon",
    layer: "staff1",
    atk: 2,
    matk: 8,
    price: 25,
    icon: "\u{1FA84}",
    forClass: "mage",
    description: "A hazel branch with a green pebble on top. It works, mostly."
  },
  oak_staff: {
    name: "Oak staff",
    slot: "weapon",
    layer: "staff2",
    atk: 4,
    matk: 18,
    price: 400,
    icon: "\u{1F52E}",
    forClass: "mage",
    description: "Dark oak with a sapphire that stays cold."
  },
  crystal_staff: {
    name: "Crystal staff",
    slot: "weapon",
    layer: "staff3",
    atk: 6,
    matk: 32,
    price: 1800,
    icon: "\u{1F48E}",
    forClass: "mage",
    description: "Silvered wood and a violet crystal. Handle with respect."
  },
  /* Loot for quests; sells for a few zeny. */
  rabbit_foot: {
    name: "Rabbit foot",
    price: 6,
    icon: "\u{1F43E}",
    stack: 99,
    description: "Lucky, allegedly. Not for the rabbit."
  },
  fox_tail: {
    name: "Fox tail",
    price: 14,
    icon: "\u{1F98A}",
    stack: 99,
    description: "Bushy and still a little warm."
  },
  boar_hide: {
    name: "Boar hide",
    price: 22,
    icon: "\u{1F7EB}",
    stack: 99,
    description: "Thick, bristly and smelling of forest."
  },
  wolf_pelt: {
    name: "Wolf pelt",
    price: 34,
    icon: "\u{1F43A}",
    stack: 99,
    description: "Grey, thick and warm. The wolf disagreed."
  },
  stag_antler: {
    name: "Stag antler",
    price: 45,
    icon: "\u{1F98C}",
    stack: 99,
    description: "Heavy and branching. Good for hilts, says Ragnar."
  },
  dire_tusk: {
    name: "Dire tusk",
    price: 140,
    icon: "\u{1F9B7}",
    stack: 99,
    description: "As long as your forearm. Something to brag about."
  },
  /* Cloaks (visible on the hero), rings, necklaces, belts, pants and boots. */
  travelers_cloak: {
    name: "Traveler's cloak",
    slot: "cloak",
    layer: "cloak1",
    def: 2,
    price: 150,
    icon: "\u{1F9E5}",
    description: "Rust-brown wool, patched twice. Keeps the rain off."
  },
  wool_cloak: {
    name: "Wool cloak",
    slot: "cloak",
    layer: "cloak2",
    def: 4,
    hp: 25,
    price: 600,
    icon: "\u{1F9E5}",
    description: "Thick blue wool from the Kingsvale flocks."
  },
  shadow_cloak: {
    name: "Shadow cloak",
    slot: "cloak",
    layer: "cloak3",
    def: 6,
    flee: 8,
    price: 2e3,
    icon: "\u{1F9E5}",
    description: "Bandit-made. Dyed so dark it drinks the lantern light."
  },
  royal_cloak: {
    name: "Royal cloak",
    slot: "cloak",
    layer: "cloak4",
    def: 10,
    hp: 60,
    bonus: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    price: 6e3,
    icon: "\u{1F9E5}",
    description: "Crimson with a golden hem. Worn by the champions of Aurelia."
  },
  copper_ring: {
    name: "Copper ring",
    slot: "ring",
    hp: 20,
    price: 300,
    icon: "\u{1F48D}",
    description: "A plain band. Warm to the touch."
  },
  ring_of_might: {
    name: "Ring of Might",
    slot: "ring",
    bonus: { str: 3 },
    price: 900,
    icon: "\u{1F48D}",
    description: "A heavy silver band set with a red stone."
  },
  ring_of_wisdom: {
    name: "Ring of Wisdom",
    slot: "ring",
    bonus: { int: 3 },
    price: 900,
    icon: "\u{1F48D}",
    description: "A silver band set with a blue stone that hums faintly."
  },
  ring_of_agility: {
    name: "Ring of Agility",
    slot: "ring",
    bonus: { agi: 3 },
    flee: 5,
    price: 900,
    icon: "\u{1F48D}",
    description: "A thin band set with a green stone. Light as air."
  },
  royal_signet: {
    name: "Royal signet",
    slot: "ring",
    bonus: { str: 2, agi: 2, vit: 2, int: 2, dex: 2, luk: 2 },
    price: 4e3,
    icon: "\u{1F48D}",
    description: "The crossed-out crown of the bandit chief, turned back the right way up."
  },
  leather_cord: {
    name: "Leather cord",
    slot: "necklace",
    hp: 30,
    price: 200,
    icon: "\u{1F4FF}",
    description: "A cord with a boar tusk on it. Farmers swear by it."
  },
  silver_necklace: {
    name: "Silver necklace",
    slot: "necklace",
    sp: 40,
    matk: 4,
    price: 1200,
    icon: "\u{1F4FF}",
    description: "Fine silver links from the Aurelia market."
  },
  wolf_fang_necklace: {
    name: "Wolf-fang necklace",
    slot: "necklace",
    atk: 6,
    crit: 3,
    price: 1500,
    icon: "\u{1F4FF}",
    description: "Six fangs of a dire wolf on a strip of hide."
  },
  amulet_of_aurelia: {
    name: "Amulet of Aurelia",
    slot: "necklace",
    hp: 80,
    sp: 80,
    price: 4500,
    icon: "\u{1F4FF}",
    description: "The crown's thanks, in gold and sapphire."
  },
  leather_belt: {
    name: "Leather belt",
    slot: "belt",
    def: 1,
    hp: 10,
    price: 120,
    icon: "\u{1FAA2}",
    description: "Holds your pants up and your potions close."
  },
  buckled_belt: {
    name: "Buckled belt",
    slot: "belt",
    def: 3,
    hp: 30,
    price: 700,
    icon: "\u{1FAA2}",
    description: "A broad belt with a brass buckle."
  },
  knights_belt: {
    name: "Knight's belt",
    slot: "belt",
    def: 5,
    atk: 4,
    price: 2500,
    icon: "\u{1FAA2}",
    description: "Studded with steel. Made for a sword and a scabbard."
  },
  linen_pants: {
    name: "Linen pants",
    slot: "pants",
    def: 1,
    price: 80,
    icon: "\u{1F456}",
    description: "Simple and comfortable."
  },
  leather_pants: {
    name: "Leather pants",
    slot: "pants",
    def: 4,
    price: 500,
    icon: "\u{1F456}",
    description: "Stiff at first, then yours for life."
  },
  scaled_pants: {
    name: "Scaled pants",
    slot: "pants",
    def: 8,
    hp: 30,
    price: 2200,
    icon: "\u{1F456}",
    description: "Overlapping steel scales on thick leather."
  },
  cloth_shoes: {
    name: "Cloth shoes",
    slot: "boots",
    def: 1,
    price: 80,
    icon: "\u{1F45F}",
    description: "Better than bare feet. Barely."
  },
  leather_boots: {
    name: "Leather boots",
    slot: "boots",
    def: 3,
    flee: 3,
    price: 450,
    icon: "\u{1F97E}",
    description: "Good soles for the Kingsroad."
  },
  iron_boots: {
    name: "Iron boots",
    slot: "boots",
    def: 6,
    hp: 20,
    price: 1800,
    icon: "\u{1F97E}",
    description: "Heavy, loud, and nothing gets through them."
  },
  /* Kingsvale */
  orange_potion: {
    name: "Orange potion",
    use: "heal",
    heal: 160,
    cooldown: 1,
    price: 120,
    icon: "\u{1F9EA}",
    stack: 99,
    description: "Brewed in Aurelia. Restores 160 HP."
  },
  dire_wolf_pelt: {
    name: "Dire wolf pelt",
    price: 70,
    icon: "\u{1F43A}",
    stack: 99,
    description: "Thick, dark and still a little warm."
  },
  bandit_insignia: {
    name: "Bandit insignia",
    price: 45,
    icon: "\u{1F3F4}",
    stack: 99,
    description: "A tin badge with a crossed-out crown. The bandits of Kingsvale wear them."
  }
};
var STARTER_BAG = [{ id: "red_potion", count: 5 }];
var SELL_RATIO = 0.5;
var MONSTERS = {
  rabbit: {
    name: "Rabbit",
    level: 1,
    hp: 28,
    atk: 4,
    exp: 11,
    zeny: [2, 7],
    speed: 1.8,
    aggressive: false,
    range: 1.1,
    aggroRange: 0,
    zone: [25, 38],
    loot: {
      rabbit_foot: 0.45,
      red_potion: 0.1,
      tattered_tunic: 0.02,
      leather_cap: 0.03,
      leather_cord: 0.03
    }
  },
  fox: {
    name: "Fox",
    level: 3,
    hp: 60,
    atk: 8,
    exp: 26,
    zeny: [6, 14],
    speed: 2.6,
    aggressive: true,
    range: 1.2,
    aggroRange: 4.5,
    zone: [33, 50],
    loot: {
      fox_tail: 0.5,
      red_potion: 0.15,
      leather_vest: 0.06,
      iron_sword: 0.05,
      leather_cap: 0.05,
      pointed_hat: 0.03,
      linen_pants: 0.04,
      cloth_shoes: 0.04
    }
  },
  boar: {
    name: "Boar",
    level: 6,
    hp: 140,
    atk: 14,
    exp: 62,
    zeny: [12, 30],
    speed: 2.2,
    aggressive: true,
    range: 1.4,
    aggroRange: 5,
    zone: [44, 57],
    loot: {
      boar_hide: 0.55,
      red_potion: 0.25,
      leather_vest: 0.1,
      iron_sword: 0.08,
      oak_staff: 0.05,
      steel_armor: 0.05,
      steel_sword: 0.04,
      iron_helm: 0.06,
      leather_belt: 0.06
    }
  }
};
var FOREST_MONSTERS = {
  wolf: {
    name: "Grey Wolf",
    level: 9,
    hp: 260,
    atk: 24,
    exp: 120,
    zeny: [20, 45],
    speed: 3.2,
    aggressive: true,
    range: 1.3,
    aggroRange: 6,
    area: "forest",
    night: { aggroFactor: 1.7, speedFactor: 1.15 },
    loot: {
      wolf_pelt: 0.5,
      red_potion: 0.25,
      leather_vest: 0.08,
      iron_sword: 0.08,
      silk_robe: 0.05,
      leather_boots: 0.05
    }
  },
  stag: {
    name: "Stag",
    level: 11,
    hp: 380,
    atk: 30,
    exp: 170,
    zeny: [25, 60],
    speed: 3.4,
    aggressive: false,
    range: 1.4,
    aggroRange: 0,
    area: "forest",
    loot: {
      stag_antler: 0.45,
      red_potion: 0.25,
      iron_helm: 0.07,
      steel_armor: 0.05,
      starry_hat: 0.05,
      leather_pants: 0.05
    }
  },
  dire_boar: {
    name: "Dire Boar",
    level: 14,
    hp: 900,
    atk: 46,
    exp: 520,
    zeny: [80, 160],
    speed: 2.4,
    aggressive: true,
    range: 1.6,
    aggroRange: 7,
    area: "altar",
    respawn: [60, 90],
    loot: {
      dire_tusk: 0.8,
      steel_sword: 0.12,
      crystal_staff: 0.12,
      steel_armor: 0.1,
      archmage_robe: 0.1,
      red_potion: 0.5
    }
  }
};
Object.assign(MONSTERS, FOREST_MONSTERS);
var VALE_MONSTERS = {
  bandit: {
    name: "Bandit",
    level: 16,
    hp: 1050,
    atk: 54,
    exp: 650,
    zeny: [60, 140],
    speed: 3,
    aggressive: true,
    range: 1.4,
    aggroRange: 6.5,
    area: "vale",
    humanoid: { outfit: "armor2", headgear: "cap", weapon: "sword1", hair: "black" },
    loot: {
      bandit_insignia: 0.5,
      red_potion: 0.3,
      orange_potion: 0.08,
      iron_sword: 0.06,
      leather_vest: 0.06,
      silk_robe: 0.04,
      travelers_cloak: 0.05,
      copper_ring: 0.04
    }
  },
  dire_wolf: {
    name: "Dire Wolf",
    level: 17,
    hp: 1350,
    atk: 60,
    exp: 760,
    zeny: [50, 120],
    speed: 3.5,
    aggressive: true,
    range: 1.4,
    aggroRange: 7,
    area: "vale",
    sheet: "wolf",
    scale: 1.25,
    tint: 10128056,
    night: { aggroFactor: 1.6, speedFactor: 1.15 },
    loot: {
      dire_wolf_pelt: 0.55,
      red_potion: 0.3,
      orange_potion: 0.08,
      iron_helm: 0.05,
      starry_hat: 0.05,
      wolf_fang_necklace: 0.06
    }
  },
  bandit_brute: {
    name: "Bandit Brute",
    level: 19,
    hp: 1950,
    atk: 72,
    exp: 1150,
    zeny: [100, 220],
    speed: 2.7,
    aggressive: true,
    range: 1.5,
    aggroRange: 6.5,
    area: "vale",
    humanoid: { outfit: "armor2", headgear: "helm", weapon: "sword2", hair: "red", scale: 1.15 },
    loot: {
      bandit_insignia: 0.7,
      orange_potion: 0.15,
      steel_sword: 0.05,
      steel_armor: 0.05,
      crystal_staff: 0.04,
      archmage_robe: 0.04,
      shadow_cloak: 0.04,
      buckled_belt: 0.05
    }
  },
  bandit_chief: {
    name: "Bandit Chief Varek",
    level: 22,
    hp: 6500,
    atk: 96,
    exp: 4500,
    zeny: [400, 800],
    speed: 3,
    aggressive: true,
    range: 1.6,
    aggroRange: 8,
    area: "camp",
    respawn: [90, 150],
    humanoid: { outfit: "armor2", headgear: "helm", weapon: "sword2", hair: "blond", scale: 1.3 },
    loot: {
      bandit_insignia: 1,
      royal_signet: 0.5,
      shadow_cloak: 0.3,
      royal_cloak: 0.25,
      orange_potion: 0.6,
      steel_sword: 0.15,
      crystal_staff: 0.15,
      steel_armor: 0.12,
      archmage_robe: 0.12,
      iron_helm: 0.1,
      starry_hat: 0.1
    }
  }
};
Object.assign(MONSTERS, VALE_MONSTERS);
var SPAWNS = [
  { monster: "rabbit", count: 14 },
  { monster: "fox", count: 8 },
  { monster: "boar", count: 4 },
  { monster: "wolf", count: 7 },
  { monster: "stag", count: 5 },
  { monster: "dire_boar", count: 1 },
  { monster: "bandit", count: 10 },
  { monster: "dire_wolf", count: 7 },
  { monster: "bandit_brute", count: 6 },
  { monster: "bandit_chief", count: 1 }
];
var RESPAWN_SECONDS = [9, 15];

// ../runeveld/src/regions.js
var FOREST = {
  x0: -44,
  x1: 44,
  z0: -126,
  z1: -56,
  name: "Whisperwood",
  cx: 0,
  cz: -88,
  rx: 34,
  rz: 27
};
function waviness(angle, phaseA, phaseB, phaseC) {
  return 0.5 * Math.sin(3 * angle + phaseA) + 0.3 * Math.sin(5 * angle + phaseB) + 0.2 * Math.sin(8 * angle + phaseC);
}
__name(waviness, "waviness");
function bump(angle, centerAngle) {
  return Math.pow((1 + Math.cos(angle - centerAngle)) / 2, 3);
}
__name(bump, "bump");
var northFieldWaviness = waviness(Math.PI, 1.3, 2.9, 0.4);
function fieldEdge(angle) {
  return 55 + 6 * waviness(angle, 1.3, 2.9, 0.4) + (7 - 6 * northFieldWaviness) * bump(angle, Math.PI);
}
__name(fieldEdge, "fieldEdge");
function inFields(x, z, margin = 0) {
  return Math.hypot(x, z) < fieldEdge(Math.atan2(x, z)) - margin;
}
__name(inFields, "inFields");
var southForestWaviness = waviness(Math.PI, 0.7, 2.1, 3.3);
function forestEdge(angle) {
  return 1 + 0.14 * waviness(angle, 0.7, 2.1, 3.3) + (0.08 - 0.14 * southForestWaviness) * bump(angle, Math.PI);
}
__name(forestEdge, "forestEdge");
function inForest(x, z, margin = 0) {
  const dx = x / FOREST.rx;
  const dz = (z - FOREST.cz) / FOREST.rz;
  return Math.hypot(dx, dz) < forestEdge(Math.atan2(dx, dz)) - margin / FOREST.rz;
}
__name(inForest, "inForest");
var VALE = {
  name: "Kingsvale",
  cx: -130,
  cz: 0,
  rx: 80,
  rz: 60,
  x0: -218,
  x1: -44,
  z0: -66,
  z1: 66
};
var eastValeWaviness = waviness(Math.PI / 2, 2.2, 0.9, 4.1);
function valeEdge(angle) {
  return 1 + 0.11 * waviness(angle, 2.2, 0.9, 4.1) + (0.07 - 0.11 * eastValeWaviness) * bump(angle, Math.PI / 2);
}
__name(valeEdge, "valeEdge");
function inVale(x, z, margin = 0) {
  const dx = (x - VALE.cx) / VALE.rx;
  const dz = (z - VALE.cz) / VALE.rz;
  return Math.hypot(dx, dz) < valeEdge(Math.atan2(dx, dz)) - margin / VALE.rz;
}
__name(inVale, "inVale");
var CAPITAL = { name: "Aurelia", x0: -176, x1: -98, z0: -40, z1: 40, cx: -137, cz: 0 };
function inCapital(x, z, margin = 0) {
  return x > CAPITAL.x0 + margin && x < CAPITAL.x1 - margin && z > CAPITAL.z0 + margin && z < CAPITAL.z1 - margin;
}
__name(inCapital, "inCapital");
var BANDIT_CAMP = [-82, -44];
function insideWorld(x, z, margin = 1.5) {
  return inFields(x, z, margin) || inForest(x, z, margin) || inVale(x, z, margin);
}
__name(insideWorld, "insideWorld");
var FOREST_PATH = [
  [0, -59],
  [0, -70],
  [-9, -80],
  [-10, -90],
  [-3, -98],
  [0, -101]
];
var ALTAR_CLEARING = [0, -103];
function distanceToPath(x, z, path = FOREST_PATH) {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}
__name(distanceToPath, "distanceToPath");

// src/simulation.js
var VILLAGE_HALF_SIZE = 22;
var DAY_MINUTES = 24;
var STATE_IDLE = 0;
var STATE_WALK = 1;
var STATE_DEAD = 3;
var ATTACK_COOLDOWN = 1.6;
var MAX_CHASE_DISTANCE = 13;
var MIN_SPAWN_DISTANCE_TO_PLAYER = 6;
var WANDER_SPEED_FACTOR = 0.55;
var MAX_HIT_DAMAGE = 99999;
var MAX_FREEZE_SECONDS = 10;
var DEFAULT_FREEZE_SECONDS = 1.5;
var MAX_PROVOKE_RADIUS = 12;
var DEFAULT_PROVOKE_RADIUS = 5;
var MAX_KNOCKBACK_FORCE = 2;
var KNOCKBACK_SCALE = 0.6;
var randomBetween = /* @__PURE__ */ __name((min, max) => min + Math.random() * (max - min), "randomBetween");
var inVillage = /* @__PURE__ */ __name((x, z) => Math.abs(x) < VILLAGE_HALF_SIZE && Math.abs(z) < VILLAGE_HALF_SIZE, "inVillage");
var isSafe = /* @__PURE__ */ __name((x, z) => inVillage(x, z) || inCapital(x, z), "isSafe");
var nowSeconds = /* @__PURE__ */ __name(() => Date.now() / 1e3, "nowSeconds");
function gameHour() {
  const minuteOfDay = Date.now() / 1e3 / 60 % DAY_MINUTES;
  return minuteOfDay / DAY_MINUTES * 24;
}
__name(gameHour, "gameHour");
function isNight() {
  const hour = gameHour();
  return hour < 6 || hour > 20;
}
__name(isNight, "isNight");
function createSimulation(emit) {
  const monsters = /* @__PURE__ */ new Map();
  let obstacles = [];
  function isFree(x, z, radius = 0.5) {
    if (!insideWorld(x, z)) {
      return false;
    }
    for (const obstacle of obstacles) {
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + radius) {
        return false;
      }
    }
    return true;
  }
  __name(isFree, "isFree");
  function resolveCollision(x, z, radius = 0.3) {
    if (!insideWorld(x, z, 1.2)) {
      return null;
    }
    for (const obstacle of obstacles) {
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = obstacle.r + radius;
      if (distance >= minDistance) {
        continue;
      }
      if (distance < 1e-4) {
        x += minDistance;
      } else {
        x = obstacle.x + dx / distance * minDistance;
        z = obstacle.z + dz / distance * minDistance;
      }
    }
    return [x, z];
  }
  __name(resolveCollision, "resolveCollision");
  function pointAround([centerX, centerZ], minDistance, maxDistance, tries) {
    for (let i = 0; i < tries; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(minDistance, maxDistance);
      const x = centerX + Math.cos(angle) * distance;
      const z = centerZ + Math.sin(angle) * distance;
      if (isFree(x, z, 0.8)) {
        return [x, z];
      }
    }
    return null;
  }
  __name(pointAround, "pointAround");
  function spawnPoint(spec, players) {
    const isAwayFromPlayers = /* @__PURE__ */ __name((x, z) => players.every(
      (player) => Math.hypot(x - player.x, z - player.z) > MIN_SPAWN_DISTANCE_TO_PLAYER
    ), "isAwayFromPlayers");
    if (spec.area === "camp") {
      const point = pointAround(BANDIT_CAMP, 2, 6, 80);
      return point || [BANDIT_CAMP[0], BANDIT_CAMP[1] - 7];
    }
    if (spec.area === "vale") {
      for (let i = 0; i < 160; i++) {
        const x = randomBetween(VALE.x0 + 6, VALE.x1 - 6);
        const z = randomBetween(VALE.z0 + 6, VALE.z1 - 6);
        const onKingsRoad = Math.abs(x - CAPITAL.cx) < 5 && Math.abs(z) < CAPITAL.z1 + 10;
        const nearCamp = Math.hypot(x - BANDIT_CAMP[0], z - BANDIT_CAMP[1]) < 12;
        if (!inVale(x, z, 3) || inFields(x, z) || inCapital(x, z, -9) || onKingsRoad || nearCamp || !isFree(x, z, 0.8) || !isAwayFromPlayers(x, z)) {
          continue;
        }
        return [x, z];
      }
      return [VALE.cx, VALE.z1 - 12];
    }
    if (spec.area === "altar") {
      const point = pointAround(ALTAR_CLEARING, 2.6, 5.4, 80);
      return point || [ALTAR_CLEARING[0], ALTAR_CLEARING[1] - 4];
    }
    if (spec.area === "forest") {
      for (let i = 0; i < 120; i++) {
        const x = randomBetween(FOREST.x0 + 4, FOREST.x1 - 4);
        const z = randomBetween(FOREST.z0 + 4, FOREST.z1 - 6);
        const nearAltar = Math.hypot(x - ALTAR_CLEARING[0], z - ALTAR_CLEARING[1]) < 10;
        if (distanceToPath(x, z) < 3 || nearAltar || !isFree(x, z, 0.8) || !isAwayFromPlayers(x, z)) {
          continue;
        }
        return [x, z];
      }
      return [FOREST.x0 + 8, FOREST.z1 - 12];
    }
    const [minRing, maxRing] = spec.zone;
    for (let i = 0; i < 80; i++) {
      const x = randomBetween(-maxRing, maxRing);
      const z = randomBetween(-maxRing, maxRing);
      const ring = Math.max(Math.abs(x), Math.abs(z));
      if (ring < minRing || ring > maxRing || inVillage(x, z) || Math.abs(x) < 4 || !isFree(x, z, 0.8) || !isAwayFromPlayers(x, z)) {
        continue;
      }
      return [x, z];
    }
    return [maxRing, maxRing];
  }
  __name(spawnPoint, "spawnPoint");
  function isHome(spec, x, z) {
    if (spec.area === "altar") {
      return Math.hypot(x - ALTAR_CLEARING[0], z - ALTAR_CLEARING[1]) < 8;
    }
    if (spec.area === "forest") {
      return inForest(x, z);
    }
    if (spec.area === "camp") {
      return Math.hypot(x - BANDIT_CAMP[0], z - BANDIT_CAMP[1]) < 9;
    }
    if (spec.area === "vale") {
      return inVale(x, z, 2) && !inFields(x, z) && !inCapital(x, z, -4);
    }
    return !inVillage(x, z) && Math.abs(x) >= 3;
  }
  __name(isHome, "isHome");
  function isHuntingGround(spec, x, z) {
    if (spec.area === "altar" || spec.area === "forest") {
      return inForest(x, z);
    }
    if (spec.area === "camp" || spec.area === "vale") {
      return inVale(x, z) && !inCapital(x, z, -3);
    }
    return true;
  }
  __name(isHuntingGround, "isHuntingGround");
  function spawn(players) {
    if (monsters.size) {
      return;
    }
    for (const entry of SPAWNS) {
      const spec = MONSTERS[entry.monster];
      for (let i = 0; i < entry.count; i++) {
        const id = entry.monster + "#" + i;
        const [x, z] = spawnPoint(spec, players);
        monsters.set(id, {
          id,
          spec,
          x,
          z,
          faceX: 0,
          faceZ: 1,
          state: STATE_IDLE,
          hp: spec.hp,
          isDead: false,
          respawnTimer: 0,
          targetId: null,
          cooldown: 0,
          wanderTarget: null,
          wanderTimer: randomBetween(0, 3),
          frozenUntil: 0
        });
      }
    }
  }
  __name(spawn, "spawn");
  function die(monster, killerId) {
    const spec = monster.spec;
    monster.isDead = true;
    monster.hp = 0;
    monster.state = STATE_DEAD;
    monster.targetId = null;
    const [minRespawn, maxRespawn] = spec.respawn || RESPAWN_SECONDS;
    monster.respawnTimer = randomBetween(minRespawn, maxRespawn);
    let loot = null;
    for (const [itemId, chance] of Object.entries(spec.loot || {})) {
      if (Math.random() < chance) {
        loot = itemId;
        break;
      }
    }
    emit("kill", {
      id: monster.id,
      killer: killerId,
      exp: spec.exp,
      zeny: Math.round(randomBetween(spec.zeny[0], spec.zeny[1])),
      loot,
      x: +monster.x.toFixed(1),
      z: +monster.z.toFixed(1)
    });
  }
  __name(die, "die");
  function respawnIfReady(monster, dt, players) {
    monster.respawnTimer -= dt;
    if (monster.respawnTimer > 0) {
      return;
    }
    const [x, z] = spawnPoint(monster.spec, players);
    monster.isDead = false;
    monster.hp = monster.spec.hp;
    monster.x = x;
    monster.z = z;
    monster.targetId = null;
    monster.state = STATE_IDLE;
  }
  __name(respawnIfReady, "respawnIfReady");
  function findTarget(monster, players, nightFactors) {
    const spec = monster.spec;
    let target = monster.targetId ? players.find((player) => player.id === monster.targetId) : null;
    if (target && (target.isDead || isSafe(target.x, target.z) || Math.hypot(target.x - monster.x, target.z - monster.z) > MAX_CHASE_DISTANCE || !isHuntingGround(spec, target.x, target.z))) {
      target = null;
      monster.targetId = null;
    }
    if (!target && spec.aggressive) {
      let closestDistance = spec.aggroRange * (nightFactors ? nightFactors.aggroFactor : 1);
      for (const player of players) {
        if (player.isDead || isSafe(player.x, player.z)) {
          continue;
        }
        const distance = Math.hypot(player.x - monster.x, player.z - monster.z);
        if (distance < closestDistance) {
          closestDistance = distance;
          target = player;
        }
      }
      if (target) {
        monster.targetId = target.id;
      }
    }
    return target;
  }
  __name(findTarget, "findTarget");
  function chase(monster, target, dt, nightFactors) {
    const spec = monster.spec;
    const dx = target.x - monster.x;
    const dz = target.z - monster.z;
    const distance = Math.hypot(dx, dz) || 1e-4;
    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;
    if (distance > spec.range) {
      const step = spec.speed * (nightFactors ? nightFactors.speedFactor : 1) * dt;
      const position = resolveCollision(
        monster.x + dx / distance * step,
        monster.z + dz / distance * step
      );
      if (position) {
        monster.x = position[0];
        monster.z = position[1];
      }
      monster.state = STATE_WALK;
      return;
    }
    monster.state = STATE_IDLE;
    if (monster.cooldown <= 0) {
      monster.cooldown = ATTACK_COOLDOWN;
      emit("monster_attack", {
        id: monster.id,
        target: target.id,
        damage: Math.round(spec.atk * randomBetween(0.85, 1.15))
      });
    }
  }
  __name(chase, "chase");
  function wander(monster, dt) {
    const spec = monster.spec;
    monster.wanderTimer -= dt;
    if (monster.wanderTimer <= 0) {
      if (monster.wanderTarget) {
        monster.wanderTarget = null;
        monster.wanderTimer = randomBetween(1.5, 4);
      } else {
        const wanderX = monster.x + randomBetween(-4, 4);
        const wanderZ = monster.z + randomBetween(-4, 4);
        monster.wanderTarget = isHome(spec, wanderX, wanderZ) ? [wanderX, wanderZ] : null;
        monster.wanderTimer = randomBetween(2, 5);
      }
    }
    if (!monster.wanderTarget) {
      monster.state = STATE_IDLE;
      return;
    }
    const dx = monster.wanderTarget[0] - monster.x;
    const dz = monster.wanderTarget[1] - monster.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2) {
      monster.wanderTarget = null;
      monster.wanderTimer = randomBetween(1.5, 4);
      monster.state = STATE_IDLE;
      return;
    }
    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;
    const step = spec.speed * WANDER_SPEED_FACTOR * dt;
    const position = resolveCollision(
      monster.x + dx / distance * step,
      monster.z + dz / distance * step
    );
    if (!position || Math.hypot(position[0] - monster.x, position[1] - monster.z) < step * 0.3) {
      monster.wanderTarget = null;
      monster.wanderTimer = 1;
    } else {
      monster.x = position[0];
      monster.z = position[1];
    }
    monster.state = STATE_WALK;
  }
  __name(wander, "wander");
  function tick(dt, players) {
    for (const monster of monsters.values()) {
      if (monster.isDead) {
        respawnIfReady(monster, dt, players);
        continue;
      }
      if (nowSeconds() < monster.frozenUntil) {
        monster.state = STATE_IDLE;
        continue;
      }
      const nightFactors = isNight() && monster.spec.night ? monster.spec.night : null;
      const target = findTarget(monster, players, nightFactors);
      monster.cooldown = Math.max(0, monster.cooldown - dt);
      if (target) {
        chase(monster, target, dt, nightFactors);
      } else {
        wander(monster, dt);
      }
    }
  }
  __name(tick, "tick");
  function setObstacles(list) {
    obstacles = list.filter(
      (obstacle) => Array.isArray(obstacle) && obstacle.length === 3 && obstacle.every(Number.isFinite)
    ).map(([x, z, r]) => ({ x, z, r }));
  }
  __name(setObstacles, "setObstacles");
  function hasObstacles() {
    return obstacles.length > 0;
  }
  __name(hasObstacles, "hasObstacles");
  function hit(id, damage, attackerId) {
    const monster = monsters.get(id);
    if (!monster || monster.isDead || !Number.isFinite(damage)) {
      return;
    }
    const appliedDamage = Math.max(0, Math.min(damage, MAX_HIT_DAMAGE));
    monster.hp = Math.max(0, monster.hp - appliedDamage);
    if (!monster.targetId) {
      monster.targetId = attackerId;
    }
    if (monster.hp <= 0) {
      die(monster, attackerId);
    }
  }
  __name(hit, "hit");
  function freeze(ids, duration) {
    const seconds = Math.min(MAX_FREEZE_SECONDS, Math.max(0, duration || DEFAULT_FREEZE_SECONDS));
    const until = nowSeconds() + seconds;
    for (const id of ids || []) {
      const monster = monsters.get(id);
      if (monster && !monster.isDead) {
        monster.frozenUntil = until;
      }
    }
  }
  __name(freeze, "freeze");
  function provoke(x, z, radius, attackerId) {
    const reach = Math.min(MAX_PROVOKE_RADIUS, radius || DEFAULT_PROVOKE_RADIUS);
    for (const monster of monsters.values()) {
      if (!monster.isDead && Math.hypot(monster.x - x, monster.z - z) <= reach) {
        monster.targetId = attackerId;
      }
    }
  }
  __name(provoke, "provoke");
  function knockback(id, dx, dz, force) {
    const monster = monsters.get(id);
    if (!monster || monster.isDead) {
      return;
    }
    const length = Math.hypot(dx, dz) || 1;
    const distance = Math.min(MAX_KNOCKBACK_FORCE, force || 0) * KNOCKBACK_SCALE;
    const nextX = monster.x + dx / length * distance;
    const nextZ = monster.z + dz / length * distance;
    if (isFree(nextX, nextZ, 0.4) && !isSafe(nextX, nextZ)) {
      monster.x = nextX;
      monster.z = nextZ;
    }
  }
  __name(knockback, "knockback");
  function snapshot() {
    const list = [...monsters.values()].map((monster) => [
      monster.id,
      +monster.x.toFixed(2),
      +monster.z.toFixed(2),
      +monster.faceX.toFixed(2),
      +monster.faceZ.toFixed(2),
      monster.isDead ? STATE_DEAD : monster.state,
      Math.round(monster.hp)
    ]);
    return { list };
  }
  __name(snapshot, "snapshot");
  return {
    monsters,
    setObstacles,
    hasObstacles,
    spawn,
    tick,
    hit,
    freeze,
    provoke,
    knockback,
    snapshot
  };
}
__name(createSimulation, "createSimulation");

// src/hero-store.js
import { DurableObject } from "cloudflare:workers";

// ../runeveld/src/rules/skills.js
var MAX_JOB_LEVEL_BY_TIER = { 1: 20, 2: 50 };
var jobExpForLevel = /* @__PURE__ */ __name((jobLevel) => Math.round(30 * Math.pow(jobLevel, 1.5)), "jobExpForLevel");
var JOB_EXP_SHARE = 0.6;
var SKILLS = {
  /* ---- swordsman ---- */
  crushing_blow: {
    name: "Crushing Blow",
    icon: "\u2694\uFE0F",
    maxLevel: 10,
    requires: {},
    description: "A heavy two-handed blow on your target. The bread and butter of every swordsman.",
    spCost: /* @__PURE__ */ __name((l) => 4 + l, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.2 + 0.25 * l, "mult"),
    cooldown: 1,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.2 + 0.25 * l) * 100)}% damage \xB7 ${4 + l} SP`, "text")
  },
  flame_sweep: {
    name: "Flame Sweep",
    icon: "\u{1F525}",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description: "A sweeping strike that bursts into a ring of fire around you. INT makes it stronger.",
    spCost: /* @__PURE__ */ __name((l) => 10 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.1 + 0.2 * l, "mult"),
    radius: 3,
    cooldown: 5,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.1 + 0.2 * l) * 100)}% damage in a ring \xB7 ${10 + l * 2} SP`, "text")
  },
  blade_mastery: {
    name: "Blade Mastery",
    icon: "\u{1F5E1}\uFE0F",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: years of drills. You hit harder with any sword.",
    atk: /* @__PURE__ */ __name((l) => 5 * l, "atk"),
    text: /* @__PURE__ */ __name((l) => `ATK +${5 * l}`, "text")
  },
  second_wind: {
    name: "Second Wind",
    icon: "\u2764\uFE0F",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: you catch your breath faster and recover HP quicker, especially while sitting.",
    regen: /* @__PURE__ */ __name((l) => 0.25 * l, "regen"),
    text: /* @__PURE__ */ __name((l) => `+${Math.round(25 * l)}% HP recovery`, "text")
  },
  war_cry: {
    name: "War Cry",
    icon: "\u{1F624}",
    maxLevel: 5,
    requires: { crushing_blow: 3 },
    description: "A roar that draws every monster nearby to you. Gather a group, then sweep them with fire.",
    spCost: /* @__PURE__ */ __name(() => 6, "spCost"),
    radius: /* @__PURE__ */ __name((l) => 5 + l, "radius"),
    cooldown: 8,
    text: /* @__PURE__ */ __name((l) => `range ${5 + l} \xB7 6 SP`, "text")
  },
  quickening: {
    name: "Quickening",
    icon: "\u23E9",
    maxLevel: 5,
    requires: { blade_mastery: 3 },
    description: "Your sword arm moves faster for a while: more attacks per second.",
    spCost: /* @__PURE__ */ __name(() => 10, "spCost"),
    duration: /* @__PURE__ */ __name((l) => 20 + 5 * l, "duration"),
    factor: /* @__PURE__ */ __name((l) => 1 - 0.05 * l, "factor"),
    cooldown: 35,
    text: /* @__PURE__ */ __name((l) => `${Math.round(5 * l)}% faster attacks for ${20 + 5 * l}s \xB7 10 SP`, "text")
  },
  stoneskin: {
    name: "Stoneskin",
    icon: "\u{1FAA8}",
    maxLevel: 5,
    requires: { second_wind: 2 },
    passive: true,
    description: "Passive: your skin hardens like rock. Extra DEF.",
    def: /* @__PURE__ */ __name((l) => 3 * l, "def"),
    text: /* @__PURE__ */ __name((l) => `DEF +${3 * l}`, "text")
  },
  stunning_strike: {
    name: "Stunning Strike",
    icon: "\u{1F4A5}",
    maxLevel: 5,
    requires: { flame_sweep: 3 },
    passive: true,
    description: "Passive: Crushing Blow has a chance to stun the target for a moment.",
    chance: /* @__PURE__ */ __name((l) => 0.06 * l, "chance"),
    text: /* @__PURE__ */ __name((l) => `${Math.round(6 * l)}% stun chance on Crushing Blow`, "text")
  },
  /* ---- mage ---- */
  ember_bolt: {
    name: "Ember Bolt",
    icon: "\u{1F525}",
    maxLevel: 10,
    requires: {},
    description: "Hurls a bolt of fire at your target from a distance. Never misses.",
    spCost: /* @__PURE__ */ __name((l) => 6 + l, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.3 + 0.25 * l, "mult"),
    range: 7,
    cooldown: 0.9,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.3 + 0.25 * l) * 100)}% MATK \xB7 range 7 \xB7 ${6 + l} SP`, "text")
  },
  frostburst: {
    name: "Frostburst",
    icon: "\u2744\uFE0F",
    maxLevel: 10,
    requires: { ember_bolt: 3 },
    description: "A burst of frost around you: damages every monster nearby and freezes them in place for a moment.",
    spCost: /* @__PURE__ */ __name((l) => 14 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 0.9 + 0.15 * l, "mult"),
    radius: 3.5,
    freeze: /* @__PURE__ */ __name((l) => 1.5 + 0.2 * l, "freeze"),
    cooldown: 7,
    text: /* @__PURE__ */ __name((l) => `${Math.round((0.9 + 0.15 * l) * 100)}% MATK in a ring \xB7 freeze ${(1.5 + 0.2 * l).toFixed(1)}s \xB7 ${14 + l * 2} SP`, "text")
  },
  mana_ward: {
    name: "Mana Ward",
    icon: "\u{1F6E1}\uFE0F",
    maxLevel: 5,
    requires: { ember_bolt: 1 },
    description: "A shimmering ward that lets your SP absorb part of every blow for a while.",
    spCost: /* @__PURE__ */ __name(() => 15, "spCost"),
    duration: /* @__PURE__ */ __name((l) => 15 + l * 3, "duration"),
    share: /* @__PURE__ */ __name((l) => 0.3 + 0.05 * l, "share"),
    cooldown: 25,
    text: /* @__PURE__ */ __name((l) => `absorbs ${Math.round((0.3 + 0.05 * l) * 100)}% of damage with SP for ${15 + l * 3}s \xB7 15 SP`, "text")
  },
  ice_shard: {
    name: "Ice Shard",
    icon: "\u{1F9CA}",
    maxLevel: 10,
    requires: { ember_bolt: 3 },
    description: "A shard of ice that chills the target: damage and a short freeze.",
    spCost: /* @__PURE__ */ __name((l) => 8 + l, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.1 + 0.2 * l, "mult"),
    range: 7,
    freeze: /* @__PURE__ */ __name((l) => 0.5 + 0.1 * l, "freeze"),
    cooldown: 1.4,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.1 + 0.2 * l) * 100)}% MATK \xB7 freeze ${(0.5 + 0.1 * l).toFixed(1)}s \xB7 ${8 + l} SP`, "text")
  },
  spirit_volley: {
    name: "Spirit Volley",
    icon: "\u{1F47B}",
    maxLevel: 10,
    requires: { inner_calm: 2 },
    description: "Spirit bolts fly at your target one after another. More bolts as you level it.",
    spCost: /* @__PURE__ */ __name((l) => 12 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 0.55 + 0.07 * l, "mult"),
    bolts: /* @__PURE__ */ __name((l) => 2 + Math.floor(l / 4), "bolts"),
    range: 7,
    cooldown: 2.5,
    text: /* @__PURE__ */ __name((l) => `${2 + Math.floor(l / 4)} bolts of ${Math.round((0.55 + 0.07 * l) * 100)}% MATK \xB7 range 7 \xB7 ${12 + l * 2} SP`, "text")
  },
  clear_mind: {
    name: "Clear Mind",
    icon: "\u{1F3AF}",
    maxLevel: 5,
    requires: { arcane_mastery: 3 },
    passive: true,
    description: "Passive: a calm mind casts cheaper. Your spells cost less SP.",
    discount: /* @__PURE__ */ __name((l) => 0.04 * l, "discount"),
    text: /* @__PURE__ */ __name((l) => `spells cost ${Math.round(4 * l)}% less SP`, "text")
  },
  arcane_mastery: {
    name: "Arcane Mastery",
    icon: "\u{1FA84}",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: your spells hit harder with any staff.",
    matk: /* @__PURE__ */ __name((l) => 6 * l, "matk"),
    text: /* @__PURE__ */ __name((l) => `MATK +${6 * l}`, "text")
  },
  inner_calm: {
    name: "Inner Calm",
    icon: "\u{1F9D8}",
    maxLevel: 10,
    requires: {},
    passive: true,
    description: "Passive: you recover SP faster, especially while sitting.",
    regen: /* @__PURE__ */ __name((l) => 0.25 * l, "regen"),
    text: /* @__PURE__ */ __name((l) => `+${Math.round(25 * l)}% SP recovery`, "text")
  },
  /* ---- knight ---- */
  piercing_thrust: {
    name: "Piercing Thrust",
    icon: "\u{1F5E1}\uFE0F",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description: "A lunging thrust that goes straight through any armor. Never misses.",
    spCost: /* @__PURE__ */ __name((l) => 8 + l, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.5 + 0.3 * l, "mult"),
    cooldown: 1.5,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.5 + 0.3 * l) * 100)}% damage \xB7 never misses \xB7 ${8 + l} SP`, "text")
  },
  whirlwind_sweep: {
    name: "Whirlwind Sweep",
    icon: "\u{1F3B3}",
    maxLevel: 10,
    requires: { piercing_thrust: 3 },
    description: "A spinning blow that hits every monster around you and sends them flying.",
    spCost: /* @__PURE__ */ __name((l) => 14 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.2 + 0.2 * l, "mult"),
    radius: 2.6,
    cooldown: 6,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.2 + 0.2 * l) * 100)}% damage in a ring \xB7 knockback \xB7 ${14 + l * 2} SP`, "text")
  },
  iron_resolve: {
    name: "Iron Resolve",
    icon: "\u{1F9F1}",
    maxLevel: 5,
    requires: {},
    description: "For a while nothing moves you: no knockback, and extra DEF.",
    spCost: /* @__PURE__ */ __name(() => 12, "spCost"),
    duration: /* @__PURE__ */ __name((l) => 20 + 4 * l, "duration"),
    def: /* @__PURE__ */ __name((l) => 5 * l, "def"),
    cooldown: 30,
    text: /* @__PURE__ */ __name((l) => `DEF +${5 * l}, no knockback for ${20 + 4 * l}s \xB7 12 SP`, "text")
  },
  spiral_lance: {
    name: "Spiral Lance",
    icon: "\u{1F300}",
    maxLevel: 5,
    requires: { whirlwind_sweep: 3 },
    description: "Three spinning thrusts in a row on one target.",
    spCost: /* @__PURE__ */ __name((l) => 14 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 0.8 + 0.15 * l, "mult"),
    hits: 3,
    cooldown: 5,
    text: /* @__PURE__ */ __name((l) => `3 hits of ${Math.round((0.8 + 0.15 * l) * 100)}% damage \xB7 ${14 + l * 2} SP`, "text")
  },
  /* ---- crusader ---- */
  radiant_cross: {
    name: "Radiant Cross",
    icon: "\u271D\uFE0F",
    maxLevel: 10,
    requires: { crushing_blow: 5 },
    description: "A cross-shaped strike of blessed steel. Your INT adds to it.",
    spCost: /* @__PURE__ */ __name((l) => 9 + l, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.4 + 0.3 * l, "mult"),
    cooldown: 1.6,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.4 + 0.3 * l) * 100)}% damage (+INT) \xB7 ${9 + l} SP`, "text")
  },
  shield_rush: {
    name: "Shield Rush",
    icon: "\u{1F6E1}\uFE0F",
    maxLevel: 5,
    requires: { radiant_cross: 3 },
    description: "Rush at your target behind your shield and stun it for a moment.",
    spCost: /* @__PURE__ */ __name(() => 12, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1 + 0.2 * l, "mult"),
    range: 4,
    freeze: /* @__PURE__ */ __name((l) => 1.5 + 0.3 * l, "freeze"),
    cooldown: 8,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1 + 0.2 * l) * 100)}% damage \xB7 stun ${(1.5 + 0.3 * l).toFixed(1)}s \xB7 12 SP`, "text")
  },
  mending_light: {
    name: "Mending Light",
    icon: "\u{1F49A}",
    maxLevel: 10,
    requires: {},
    description: "A prayer of light that mends your wounds.",
    spCost: /* @__PURE__ */ __name((l) => 10 + l * 2, "spCost"),
    share: /* @__PURE__ */ __name((l) => 0.12 + 0.03 * l, "share"),
    cooldown: 8,
    text: /* @__PURE__ */ __name((l) => `heals ${Math.round((0.12 + 0.03 * l) * 100)}% of your HP \xB7 ${10 + l * 2} SP`, "text")
  },
  aegis_of_light: {
    name: "Aegis of Light",
    icon: "\u{1F506}",
    maxLevel: 5,
    requires: { mending_light: 3 },
    passive: true,
    description: "Passive: a shield of light returns part of every blow to the attacker.",
    share: /* @__PURE__ */ __name((l) => 0.06 * l, "share"),
    text: /* @__PURE__ */ __name((l) => `reflects ${Math.round(6 * l)}% of damage taken`, "text")
  },
  /* ---- wizard ---- */
  thunderclap: {
    name: "Thunderclap",
    icon: "\u26A1",
    maxLevel: 10,
    requires: { ember_bolt: 5 },
    description: "Calls a bolt of lightning down on a single target from afar.",
    spCost: /* @__PURE__ */ __name((l) => 12 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 2 + 0.35 * l, "mult"),
    range: 8,
    cooldown: 2.5,
    text: /* @__PURE__ */ __name((l) => `${Math.round((2 + 0.35 * l) * 100)}% MATK \xB7 range 8 \xB7 ${12 + l * 2} SP`, "text")
  },
  blizzard: {
    name: "Blizzard",
    icon: "\u{1F32A}\uFE0F",
    maxLevel: 10,
    requires: { frostburst: 3 },
    description: "A howling blizzard around you: heavy damage and a long freeze on everything nearby.",
    spCost: /* @__PURE__ */ __name((l) => 24 + l * 3, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.4 + 0.25 * l, "mult"),
    radius: 5,
    freeze: /* @__PURE__ */ __name((l) => 2 + 0.3 * l, "freeze"),
    cooldown: 12,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.4 + 0.25 * l) * 100)}% MATK in a wide ring \xB7 freeze ${(2 + 0.3 * l).toFixed(1)}s \xB7 ${24 + l * 3} SP`, "text")
  },
  mana_shell: {
    name: "Mana Shell",
    icon: "\u{1F535}",
    maxLevel: 5,
    requires: { mana_ward: 1 },
    description: "A shell of pure energy: your SP absorbs most of every blow.",
    spCost: /* @__PURE__ */ __name(() => 20, "spCost"),
    duration: /* @__PURE__ */ __name((l) => 25 + l * 5, "duration"),
    share: /* @__PURE__ */ __name((l) => 0.5 + 0.05 * l, "share"),
    cooldown: 40,
    text: /* @__PURE__ */ __name((l) => `absorbs ${Math.round((0.5 + 0.05 * l) * 100)}% of damage with SP for ${25 + l * 5}s \xB7 20 SP`, "text")
  },
  starfall: {
    name: "Starfall",
    icon: "\u2604\uFE0F",
    maxLevel: 5,
    requires: { blizzard: 3 },
    description: "Pulls a burning star down on your target. Everything around the impact burns.",
    spCost: /* @__PURE__ */ __name((l) => 30 + l * 4, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 2.4 + 0.4 * l, "mult"),
    radius: 3,
    range: 8,
    cooldown: 14,
    text: /* @__PURE__ */ __name((l) => `${Math.round((2.4 + 0.4 * l) * 100)}% MATK in a ring of 3 around the target \xB7 ${30 + l * 4} SP`, "text")
  },
  /* ---- sage ---- */
  stone_spires: {
    name: "Stone Spires",
    icon: "\u{1FAA8}",
    maxLevel: 10,
    requires: { ember_bolt: 5 },
    description: "Spires of stone burst from the ground under your target.",
    spCost: /* @__PURE__ */ __name((l) => 10 + l * 2, "spCost"),
    mult: /* @__PURE__ */ __name((l) => 1.8 + 0.3 * l, "mult"),
    range: 7,
    cooldown: 1.8,
    text: /* @__PURE__ */ __name((l) => `${Math.round((1.8 + 0.3 * l) * 100)}% MATK \xB7 range 7 \xB7 ${10 + l * 2} SP`, "text")
  },
  mana_echo: {
    name: "Mana Echo",
    icon: "\u{1FA9E}",
    maxLevel: 5,
    requires: { stone_spires: 3 },
    passive: true,
    description: "Passive: an echo of every spell flows back to you as SP.",
    share: /* @__PURE__ */ __name((l) => 0.015 * l, "share"),
    text: /* @__PURE__ */ __name((l) => `${(1.5 * l).toFixed(1)}% of spell damage returns as SP`, "text")
  },
  wellspring: {
    name: "Wellspring",
    icon: "\u{1F4A7}",
    maxLevel: 5,
    requires: { inner_calm: 1 },
    description: "Draw on the land itself to refill part of your SP.",
    spCost: /* @__PURE__ */ __name(() => 0, "spCost"),
    share: /* @__PURE__ */ __name((l) => 0.1 + 0.04 * l, "share"),
    cooldown: 20,
    text: /* @__PURE__ */ __name((l) => `restores ${Math.round((0.1 + 0.04 * l) * 100)}% of your SP \xB7 free`, "text")
  }
};
var SWORDSMAN_TREE = {
  crushing_blow: [0, 0],
  blade_mastery: [1, 0],
  second_wind: [2, 0],
  flame_sweep: [0, 1],
  quickening: [1, 1],
  war_cry: [2, 1],
  stunning_strike: [0, 2],
  stoneskin: [2, 2]
};
var MAGE_TREE = {
  ember_bolt: [0, 0],
  arcane_mastery: [1, 0],
  inner_calm: [2, 0],
  frostburst: [0, 1],
  clear_mind: [1, 1],
  spirit_volley: [2, 1],
  ice_shard: [0, 2],
  mana_ward: [1, 2]
};
var SKILL_TREES = {
  swordsman: SWORDSMAN_TREE,
  mage: MAGE_TREE,
  knight: {
    ...SWORDSMAN_TREE,
    piercing_thrust: [0, 3],
    iron_resolve: [2, 3],
    whirlwind_sweep: [0, 4],
    spiral_lance: [1, 4]
  },
  crusader: {
    ...SWORDSMAN_TREE,
    radiant_cross: [0, 3],
    mending_light: [2, 3],
    shield_rush: [0, 4],
    aegis_of_light: [2, 4]
  },
  wizard: {
    ...MAGE_TREE,
    thunderclap: [0, 3],
    mana_shell: [1, 3],
    blizzard: [0, 4],
    starfall: [2, 4]
  },
  sage: {
    ...MAGE_TREE,
    stone_spires: [0, 3],
    mending_light: [2, 3],
    mana_echo: [0, 4],
    wellspring: [1, 4]
  }
};
function treeOrder(tree) {
  return Object.keys(tree).sort((a, b) => tree[a][1] - tree[b][1] || tree[a][0] - tree[b][0]);
}
__name(treeOrder, "treeOrder");
function hotbarSkills(tree) {
  return treeOrder(tree).filter((id) => !SKILLS[id].passive);
}
__name(hotbarSkills, "hotbarSkills");
var SKILLS_BY_CLASS = {};
for (const classId of Object.keys(SKILL_TREES)) {
  SKILLS_BY_CLASS[classId] = {
    order: treeOrder(SKILL_TREES[classId]),
    hotbar: hotbarSkills(SKILL_TREES[classId])
  };
}
var skillPointsForJobLevel = /* @__PURE__ */ __name((jobLevel) => Math.max(0, jobLevel - 1 + Math.floor(jobLevel / 2)), "skillPointsForJobLevel");
var skillPointsSpent = /* @__PURE__ */ __name((skills) => Object.values(skills).reduce((total, level) => total + (level || 0), 0), "skillPointsSpent");
function canLearn(skills, id) {
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
__name(canLearn, "canLearn");

// ../runeveld/src/rules/stats.js
var STATS = [
  ["str", "STR", "Strength: more attack power"],
  ["agi", "AGI", "Agility: dodge and attack faster"],
  ["vit", "VIT", "Vitality: more HP, defense and HP recovery"],
  ["int", "INT", "Intelligence: more SP, SP recovery, magic attack and a stronger Flame Sweep"],
  ["dex", "DEX", "Dexterity: hit chance and some attack power"],
  ["luk", "LUK", "Luck: chance of critical hits"]
];
var MAX_STAT = 99;
var baseStats = /* @__PURE__ */ __name(() => ({ str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }), "baseStats");
var statCost = /* @__PURE__ */ __name((value) => Math.floor((value - 1) / 10) + 2, "statCost");
function statPointsForLevel(level) {
  let points = 10;
  for (let l = 2; l <= level; l++) {
    points += 3 + Math.floor(l / 5);
  }
  return points;
}
__name(statPointsForLevel, "statPointsForLevel");
function statPointsSpent(stats) {
  let points = 0;
  for (const [key] of STATS) {
    for (let value = 1; value < (stats[key] || 1); value++) {
      points += statCost(value);
    }
  }
  return points;
}
__name(statPointsSpent, "statPointsSpent");
function deriveStats({
  level,
  stats,
  items = [],
  skills = {},
  heroClass = { hpFactor: 1, spFactor: 1 }
}) {
  const s = { ...baseStats(), ...stats };
  for (const item of items) {
    for (const key in item.bonus || {}) {
      s[key] = (s[key] || 1) + item.bonus[key];
    }
  }
  const itemSum = /* @__PURE__ */ __name((field) => items.reduce((total, item) => total + (item[field] || 0), 0), "itemSum");
  const passive = /* @__PURE__ */ __name((skillId, effect) => {
    const skill = SKILLS[skillId];
    const skillLevel = skills[skillId] || 0;
    return skill && skillLevel > 0 && skill[effect] ? skill[effect](skillLevel) : 0;
  }, "passive");
  const hpMax = Math.round((50 + level * 12 + s.vit * 6) * (1 + s.vit / 100) * (heroClass.hpFactor || 1)) + itemSum("hp");
  const spMax = Math.round((10 + level * 3 + s.int * 4) * (heroClass.spFactor || 1)) + itemSum("sp");
  const atk = Math.round(
    3 + level * 1.5 + s.str * 1.2 + s.dex * 0.3 + itemSum("atk") + passive("blade_mastery", "atk")
  );
  const matk = Math.round(
    4 + level * 1.2 + s.int * 2 + s.dex * 0.2 + itemSum("matk") + passive("arcane_mastery", "matk")
  );
  const def = Math.round(itemSum("def") + s.vit * 0.4 + passive("stoneskin", "def"));
  return {
    hpMax,
    spMax,
    atk,
    matk,
    def,
    /* hit chance against the target's flee */
    hit: 20 + level + s.dex + itemSum("hit"),
    flee: level + s.agi + itemSum("flee"),
    /* critical hit chance, in percent */
    crit: Math.min(50, s.luk * 0.3 + itemSum("crit")),
    /* seconds between basic attacks */
    attackInterval: Math.max(0.4, 0.9 - s.agi * 6e-3),
    /* per second, while standing */
    hpRegen: (1 + level * 0.3 + s.vit * 0.2) * (1 + passive("second_wind", "regen")),
    spRegen: (1 + level * 0.2 + s.int * 0.3) * (1 + passive("inner_calm", "regen")),
    /* extra damage of Flame Sweep */
    skillBonus: 1 + s.int / 100
  };
}
__name(deriveStats, "deriveStats");

// ../runeveld/src/rules/quests.js
var QUESTS = {
  mette_welcome: {
    giver: "Old Mette",
    title: "A warm welcome",
    level: 1,
    intro: "New face! Nobody wanders out past the fence before they know the village. Go say hello to Merchant Bram at the red stall, and tell him Mette sent you.",
    progressText: "Bram is at the red stall by the square. Red, like his nose.",
    completeText: "He was kind to you? Good. He was not always. Here, take these for the road, and stay close to the gates at first.",
    goal: { type: "visit", npc: "Merchant Bram" },
    reward: { exp: 20, zeny: 30, items: [{ id: "red_potion", count: 2 }] }
  },
  rolf_rabbits: {
    giver: "Guard Rolf",
    title: "Rabbit trouble",
    level: 1,
    after: "mette_welcome",
    intro: "You look like you can hold a sword. The rabbits north of the gate are eating everything that grows. Thin them out for me: five should do.",
    progressText: "Five rabbits. They are just outside the north gate. Hit them before they hop off.",
    completeText: "Five fewer rabbits. The farmers will sleep better. Here is your pay, and something for the scratches.",
    goal: { type: "kill", monster: "rabbit", count: 5 },
    reward: { exp: 60, zeny: 80, items: [{ id: "red_potion", count: 3 }] }
  },
  teun_lucky_feet: {
    giver: "Fisher Teun",
    title: "Lucky feet",
    level: 2,
    intro: "Shh. Not a bite all week. I need luck, and rabbits have it in their feet, everyone knows that. Bring me two rabbit feet.",
    progressText: "Two rabbit feet. Rabbits drop them sometimes, if you ask with a sword.",
    completeText: "Two feet. Now the fish will come. Probably. Here, I have no use for these potions anyway.",
    goal: { type: "item", item: "rabbit_foot", count: 2 },
    reward: { exp: 80, zeny: 60, items: [{ id: "red_potion", count: 2 }] }
  },
  pim_fox: {
    giver: "Pim",
    title: "A real fox",
    level: 2,
    after: "rolf_rabbits",
    intro: "I saw a fox and nobody believes me! If you bring me a fox tail I can show everyone. Please? I have ten zeny.",
    progressText: "A fox tail! The foxes live west of the village. Do not tell mum.",
    completeText: "A REAL fox tail! Here, you can have my ten zeny. All of it.",
    goal: { type: "item", item: "fox_tail", count: 1 },
    reward: { exp: 40, zeny: 10, items: [] }
  },
  sven_foxes: {
    giver: "Guard Sven",
    title: "Foxes at the south gate",
    level: 3,
    after: "rolf_rabbits",
    intro: "Rolf sent you? Then you will do. Foxes have been circling the south fields at night. Six of them should learn to keep their distance.",
    progressText: "Six foxes, south and west of the village. Watch out, they bite back.",
    completeText: "Six foxes. Quiet shift tonight, then. I like quiet shifts. Here.",
    goal: { type: "kill", monster: "fox", count: 6 },
    reward: { exp: 220, zeny: 180, items: [{ id: "red_potion", count: 3 }] }
  },
  lise_fox_tails: {
    giver: "Baker Lise",
    title: "Fox tails",
    level: 3,
    after: "rolf_rabbits",
    intro: "Foxes got into my flour again. I want three of their tails for my door. Let the others see what happens.",
    progressText: "Three fox tails. The foxes are west of the fence, past the trees.",
    completeText: "Three tails for my door. Perfect. This cap was my brother's, he will not miss it. And the bread is on the house.",
    goal: { type: "item", item: "fox_tail", count: 3 },
    reward: { exp: 150, zeny: 200, items: [{ id: "leather_cap", count: 1 }] }
  },
  jorn_boars: {
    giver: "Farmer Jorn",
    title: "Boars in the beets",
    level: 5,
    after: "rolf_rabbits",
    intro: "Boars. Big ones, east of the village, and they have found my beets. I cannot pay much, but I pay. Three boars.",
    progressText: "Three boars, east past the fields. Do not let them charge you.",
    completeText: "Three boars gone. My beets thank you. So do I. Here.",
    goal: { type: "kill", monster: "boar", count: 3 },
    reward: { exp: 300, zeny: 350, items: [{ id: "red_potion", count: 5 }] }
  },
  ragnar_hides: {
    giver: "Smith Ragnar",
    title: "Hides for the forge",
    level: 6,
    after: "jorn_boars",
    intro: "Jorn says you handle boars. Good. I need four boar hides for the bellows. Bring them and I will make it worth your while.",
    progressText: "Four boar hides. The boars are east of the village.",
    completeText: "Four good hides. A deal is a deal: this has been waiting for someone who deserves it.",
    goal: { type: "item", item: "boar_hide", count: 4 },
    reward: { exp: 400, zeny: 300, items: [{ id: "iron_helm", count: 1, mage: "starry_hat" }] }
  },
  /* ---- Whisperwood, level 8 to 15 ---- */
  mette_altar: {
    giver: "Old Mette",
    title: "The old altar",
    level: 8,
    after: "mette_welcome",
    intro: "When I was a girl we left bread at the old altar in Whisperwood, north past the gate. Nobody goes there any more. Go and see if it still stands. Follow the path and do not stray.",
    progressText: "North through the gate, then follow the path through the trees. The altar is on the stone circle at the end.",
    completeText: "It still stands? Then the forest remembers us. Thank you, child. Here, for your trouble.",
    goal: { type: "reach", x: 0, z: -103, r: 5, label: "the old altar" },
    reward: { exp: 300, zeny: 200, items: [{ id: "red_potion", count: 3 }] }
  },
  rolf_wolves: {
    giver: "Guard Rolf",
    title: "Howling in the north",
    level: 8,
    after: "sven_foxes",
    intro: "You hear that at night? Wolves, in Whisperwood. They are getting bolder. Six of them, and the rest will think twice.",
    progressText: "Six grey wolves. They hunt between the trees off the path, north of the gate. Watch your back.",
    completeText: "Six wolves. The howling is quieter already. Good work, and well paid.",
    goal: { type: "kill", monster: "wolf", count: 6 },
    reward: { exp: 600, zeny: 500, items: [{ id: "red_potion", count: 5 }] }
  },
  lise_warm_coat: {
    giver: "Baker Lise",
    title: "A warm coat",
    level: 9,
    after: "lise_fox_tails",
    intro: "Winter is coming and my coat is thin. Three wolf pelts from Whisperwood and I will have a warm one. I pay in bread and zeny.",
    progressText: "Three wolf pelts. The wolves live in Whisperwood, north of the village.",
    completeText: "Three pelts! Soft as anything. Here, and come by for bread whenever you like.",
    goal: { type: "item", item: "wolf_pelt", count: 3 },
    reward: { exp: 650, zeny: 450, items: [{ id: "red_potion", count: 4 }] }
  },
  ragnar_antlers: {
    giver: "Smith Ragnar",
    title: "Antlers for the forge",
    level: 10,
    after: "ragnar_hides",
    intro: "Stag antler makes the best sword hilts. There are stags in Whisperwood. Two antlers. They will not give them up gladly.",
    progressText: "Two stag antlers. The stags graze deep in Whisperwood. They are peaceful until you are not.",
    completeText: "Two antlers. Now this is hilt material. Take this, I have no use for it.",
    goal: { type: "item", item: "stag_antler", count: 2 },
    reward: { exp: 800, zeny: 400, items: [{ id: "leather_vest", count: 1, mage: "silk_robe" }] }
  },
  rolf_dire_boar: {
    giver: "Guard Rolf",
    title: "The dire boar",
    level: 13,
    after: "rolf_wolves",
    intro: "Something big has made its den on the stone circle at the end of the forest path. A boar, they say, the size of a cart. Nobody goes near the altar any more. Deal with it and I will give you my own steel.",
    progressText: "The dire boar lives on the stone circle at the old altar, at the end of the path through Whisperwood. Bring potions.",
    completeText: "You killed it? By the gods. Here, as promised, the best I have. Carry it better than I did.",
    goal: { type: "kill", monster: "dire_boar", count: 1 },
    reward: {
      exp: 1500,
      zeny: 1200,
      items: [{ id: "steel_sword", count: 1, mage: "crystal_staff" }]
    }
  },
  /* ---- Kingsvale and Aurelia, level 15 to 24 ---- */
  rolf_road_west: {
    giver: "Guard Rolf",
    title: "The road west",
    level: 15,
    after: "rolf_wolves",
    intro: "The Kingsroad runs west from our gate to Aurelia, the capital. Captain Aldric at the east gate of the city asked for anyone who can fight. Go and report to him. Mind the road: bandits.",
    progressText: "Through the west gate and follow the Kingsroad until you see the walls of Aurelia. Captain Aldric stands just inside the east gate.",
    completeText: "You found him? Good. Aldric is a hard man, but fair. You will learn a lot in the city.",
    goal: { type: "visit", npc: "Captain Aldric" },
    reward: { exp: 900, zeny: 400, items: [{ id: "red_potion", count: 4 }] }
  },
  aldric_bandits: {
    giver: "Captain Aldric",
    title: "Bandits on the Kingsroad",
    level: 15,
    after: "rolf_road_west",
    intro: "Rolf sent you? Then you can swing a blade. Bandits have taken the meadows around the city and rob every cart on the Kingsroad. Eight of them, and the rest will think about a new trade.",
    progressText: "Eight bandits. They roam the meadows of Kingsvale outside the walls, mostly along the road. They fight in groups; so should you.",
    completeText: "Eight. The merchants will drink to your name tonight. Here is the city's pay.",
    goal: { type: "kill", monster: "bandit", count: 8 },
    reward: { exp: 2200, zeny: 900, items: [{ id: "orange_potion", count: 3 }] }
  },
  wren_dark_pelts: {
    giver: "Apothecary Wren",
    title: "Dark pelts",
    level: 16,
    after: "rolf_road_west",
    intro: "The dire wolves of Kingsvale have a pelt that keeps a brew warm for days. Four of them, and I pay in potions. Good ones.",
    progressText: "Four dire wolf pelts. The dire wolves hunt the meadows south and west of the city, and they are bolder at night.",
    completeText: "Four pelts, and not a hair singed. You have a careful hand. Here, as promised.",
    goal: { type: "item", item: "dire_wolf_pelt", count: 4 },
    reward: { exp: 1800, zeny: 600, items: [{ id: "orange_potion", count: 5 }] }
  },
  aldric_brutes: {
    giver: "Captain Aldric",
    title: "The brutes",
    level: 18,
    after: "aldric_bandits",
    intro: "The bandits have muscle: brutes in stolen armor who do the real hurting. Five of them. Then we talk about their chief.",
    progressText: "Five bandit brutes. Big, slow, and they hit like a mule. Keep moving.",
    completeText: "Five brutes down. Now I know you can take their chief. Rest first.",
    goal: { type: "kill", monster: "bandit_brute", count: 5 },
    reward: { exp: 3500, zeny: 1400, items: [{ id: "orange_potion", count: 5 }] }
  },
  aldric_varek: {
    giver: "Captain Aldric",
    title: "The bandit chief",
    level: 20,
    after: "aldric_brutes",
    intro: "Varek. He calls himself the Bandit Chief and wears a crossed-out crown. His camp is in the meadows north-east of the city: leave by the north gate and head towards the farm. Bring me his insignia and the King himself will hear of it.",
    progressText: "Varek's camp lies north-east of the city, among the tents between the north gate and the farm. He does not fight alone. Bring potions, and bring me his insignia.",
    completeText: "Varek is dead? Then Kingsvale is ours again. The Steward wants to see you in the castle. Go, before he changes his mind.",
    goal: { type: "kill", monster: "bandit_chief", count: 1 },
    reward: { exp: 7e3, zeny: 3e3, items: [{ id: "orange_potion", count: 8 }] }
  },
  corvin_audience: {
    giver: "Steward Corvin",
    title: "An audience with the King",
    level: 20,
    after: "aldric_varek",
    intro: "His Majesty has heard of the bandit chief's end. He wishes to see the one who did it. Walk up to the keep and present yourself. Bow. Do not touch anything.",
    progressText: "Walk through the castle gate at the end of the main avenue and up the steps of the keep. The King stands before the doors.",
    completeText: "The King was pleased. That does not happen often. The crown's gratitude, in coin, and you are welcome in Aurelia for as long as you live.",
    goal: { type: "reach", x: -153, z: 0, r: 4.5, label: "the King at the keep" },
    reward: {
      exp: 5e3,
      zeny: 4e3,
      items: [
        { id: "amulet_of_aurelia", count: 1 },
        { id: "orange_potion", count: 5 }
      ]
    }
  }
};
var QUEST_ORDER = Object.keys(QUESTS);
function questState(id, quests, level) {
  const quest = QUESTS[id];
  const progress = quests[id];
  if (progress) {
    if (progress.state === "done") {
      return "done";
    }
    return isQuestComplete(id, progress) ? "ready" : "active";
  }
  if (level < quest.level || quest.after && quests[quest.after]?.state !== "done") {
    return "locked";
  }
  return "available";
}
__name(questState, "questState");
function isQuestComplete(id, progress) {
  const quest = QUESTS[id];
  return !!progress && progress.state !== "done" && (progress.count || 0) >= (quest.goal.count || 1);
}
__name(isQuestComplete, "isQuestComplete");

// ../runeveld/src/rules/legacy.js
var LEGACY_IDS = {
  /* hero record fields */
  heroFields: {
    naam: "name",
    haar: "hair",
    klasse: "classId",
    lvl: "level",
    job: "jobLevel",
    jobexp: "jobExp",
    uitr: "equipment",
    tas: "bag"
  },
  items: {
    drank: "red_potion",
    grote_drank: "orange_potion",
    leren_kap: "leather_cap",
    ijzeren_helm: "iron_helm",
    punthoed: "pointed_hat",
    sterrenhoed: "starry_hat",
    tuniek: "tattered_tunic",
    vest: "leather_vest",
    harnas: "steel_armor",
    gewaad: "apprentice_robe",
    zijden_gewaad: "silk_robe",
    magiergewaad: "archmage_robe",
    ridderharnas: "knight_plate",
    kruisharnas: "crusader_plate",
    wizardgewaad: "wizard_robe",
    sagegewaad: "sage_robe",
    houtzwaard: "wooden_sword",
    ijzerzwaard: "iron_sword",
    staalzwaard: "steel_sword",
    houtstaf: "wooden_staff",
    eikenstaf: "oak_staff",
    kristalstaf: "crystal_staff",
    konijnenpoot: "rabbit_foot",
    vossenstaart: "fox_tail",
    zwijnenhuid: "boar_hide",
    wolfsvacht: "wolf_pelt",
    gewei: "stag_antler",
    slagtand: "dire_tusk",
    donkere_vacht: "dire_wolf_pelt",
    bandietenzegel: "bandit_insignia",
    reismantel: "travelers_cloak",
    wolmantel: "wool_cloak",
    schaduwmantel: "shadow_cloak",
    koningsmantel: "royal_cloak",
    koperring: "copper_ring",
    krachtring: "ring_of_might",
    wijsheidsring: "ring_of_wisdom",
    behendigheidsring: "ring_of_agility",
    koningsring: "royal_signet",
    leren_koord: "leather_cord",
    zilveren_ketting: "silver_necklace",
    wolfstand_ketting: "wolf_fang_necklace",
    amulet_van_aurelia: "amulet_of_aurelia",
    leren_riem: "leather_belt",
    gespriem: "buckled_belt",
    ridderriem: "knights_belt",
    linnen_broek: "linen_pants",
    leren_broek: "leather_pants",
    geschubde_broek: "scaled_pants",
    stoffen_schoenen: "cloth_shoes",
    leren_laarzen: "leather_boots",
    ijzeren_laarzen: "iron_boots"
  },
  skills: {
    beuk: "crushing_blow",
    vuurkring: "flame_sweep",
    zwaardbeheersing: "blade_mastery",
    hpherstel: "second_wind",
    provocatie: "war_cry",
    wapenversnelling: "quickening",
    ijzerhuid: "stoneskin",
    doodslag: "stunning_strike",
    vuurpijl: "ember_bolt",
    vorstnova: "frostburst",
    barriere: "mana_ward",
    ijsbout: "ice_shard",
    zielsslag: "spirit_volley",
    spreukfocus: "clear_mind",
    stafbeheersing: "arcane_mastery",
    meditatie: "inner_calm",
    doorboor: "piercing_thrust",
    rolstoot: "whirlwind_sweep",
    volharden: "iron_resolve",
    spiraal: "spiral_lance",
    heiligkruis: "radiant_cross",
    schildstoot: "shield_rush",
    genezing: "mending_light",
    heiligeschild: "aegis_of_light",
    bliksem: "thunderclap",
    stormvlaag: "blizzard",
    energiemantel: "mana_shell",
    meteoor: "starfall",
    aardspies: "stone_spires",
    manaspiegel: "mana_echo",
    manabron: "wellspring"
  },
  quests: {
    mette_welkom: "mette_welcome",
    rolf_konijnen: "rolf_rabbits",
    teun_poten: "teun_lucky_feet",
    pim_vos: "pim_fox",
    sven_vossen: "sven_foxes",
    lise_staarten: "lise_fox_tails",
    jorn_zwijnen: "jorn_boars",
    ragnar_huiden: "ragnar_hides",
    mette_altaar: "mette_altar",
    rolf_wolven: "rolf_wolves",
    lise_vacht: "lise_warm_coat",
    ragnar_gewei: "ragnar_antlers",
    rolf_everzwijn: "rolf_dire_boar",
    rolf_westen: "rolf_road_west",
    aldric_bandieten: "aldric_bandits",
    wren_vachten: "wren_dark_pelts",
    aldric_bruten: "aldric_brutes",
    aldric_varek: "aldric_varek",
    corvin_audientie: "corvin_audience"
  },
  questStates: {
    nieuw: "available",
    gesloten: "locked",
    bezig: "active",
    klaar: "ready",
    gedaan: "done"
  },
  monsters: {
    konijn: "rabbit",
    vos: "fox",
    zwijn: "boar",
    wolf: "wolf",
    hert: "stag",
    everzwijn: "dire_boar",
    bandiet: "bandit",
    direwolf: "dire_wolf",
    bruut: "bandit_brute",
    hoofdman: "bandit_chief"
  },
  slots: {
    hoofd: "head",
    lichaam: "body",
    mantel: "cloak",
    wapen: "weapon",
    ketting: "necklace",
    ring1: "ring1",
    ring2: "ring2",
    riem: "belt",
    broek: "pants",
    laarzen: "boots"
  },
  hair: {
    standaard: "plum",
    bruin: "brown",
    blond: "blond",
    zwart: "black",
    rood: "red",
    grijs: "silver",
    blauw: "blue",
    groen: "green"
  },
  shops: {
    bram: "bram",
    apotheek: "apothecary",
    wapensmid: "armorer",
    kleermaker: "tailor",
    juwelier: "jeweler"
  }
};
function translate(table, id) {
  return Object.prototype.hasOwnProperty.call(table, id) ? table[id] : id;
}
__name(translate, "translate");
function migrateSkills(skills) {
  if (!skills || typeof skills !== "object") {
    return skills;
  }
  const result = {};
  for (const [id, level] of Object.entries(skills)) {
    const newId = translate(LEGACY_IDS.skills, id);
    if (!SKILLS[newId]) {
      continue;
    }
    result[newId] = newId in result ? Math.max(result[newId], level) : level;
  }
  return result;
}
__name(migrateSkills, "migrateSkills");
function migrateEquipment(equipment) {
  const result = emptyEquipment();
  if (!equipment || typeof equipment !== "object") {
    return result;
  }
  for (const [slot, id] of Object.entries(equipment)) {
    const newSlot = translate(LEGACY_IDS.slots, slot);
    if (!(newSlot in result) || !id) {
      continue;
    }
    const newId = translate(LEGACY_IDS.items, id);
    if (ITEMS[newId]) {
      result[newSlot] = newId;
    }
  }
  return result;
}
__name(migrateEquipment, "migrateEquipment");
function migrateBag(bag) {
  if (!Array.isArray(bag)) {
    return bag;
  }
  const result = [];
  for (const entry of bag) {
    if (!entry) {
      continue;
    }
    const newId = translate(LEGACY_IDS.items, entry.id);
    if (!ITEMS[newId]) {
      continue;
    }
    result.push({ id: newId, count: entry.count !== void 0 ? entry.count : entry.n });
  }
  return result;
}
__name(migrateBag, "migrateBag");
function migrateQuests(quests) {
  if (!quests || typeof quests !== "object") {
    return quests;
  }
  const result = {};
  for (const [id, progress] of Object.entries(quests)) {
    if (!progress || typeof progress !== "object") {
      continue;
    }
    const state = progress.state !== void 0 ? progress.state : progress.st;
    result[translate(LEGACY_IDS.quests, id)] = {
      state: translate(LEGACY_IDS.questStates, state),
      count: progress.count !== void 0 ? progress.count : progress.n
    };
  }
  return result;
}
__name(migrateQuests, "migrateQuests");
var RECORD_FIELDS = [
  "name",
  "hair",
  "classId",
  "level",
  "exp",
  "jobLevel",
  "jobExp",
  "stats",
  "skills",
  "hp",
  "sp",
  "zeny",
  "equipment",
  "bag",
  "quests",
  "x",
  "z"
];
var OLD_FIELD_NAMES = Object.fromEntries(
  Object.entries(LEGACY_IDS.heroFields).map(([oldName, newName]) => [newName, oldName])
);
var CONVERT_FIELD = {
  hair: /* @__PURE__ */ __name((hair) => typeof hair === "string" ? translate(LEGACY_IDS.hair, hair) : hair, "hair"),
  skills: migrateSkills,
  bag: migrateBag,
  quests: migrateQuests
};
function migrateHero(record) {
  if (!record || typeof record !== "object") {
    return record;
  }
  const hero = {};
  for (const key of RECORD_FIELDS) {
    const oldName = OLD_FIELD_NAMES[key];
    let value = record[key];
    if (value === void 0 && oldName) {
      value = record[oldName];
    }
    if (key === "equipment") {
      hero.equipment = migrateEquipment(value);
    } else if (value !== void 0) {
      hero[key] = CONVERT_FIELD[key] ? CONVERT_FIELD[key](value) : value;
    }
  }
  for (const [key, value] of Object.entries(record)) {
    const isOldField = Object.prototype.hasOwnProperty.call(LEGACY_IDS.heroFields, key);
    if (!isOldField && !(key in hero)) {
      hero[key] = value;
    }
  }
  return hero;
}
__name(migrateHero, "migrateHero");

// ../runeveld/src/rules/progression.js
var MAGE_CLASSES = ["mage", "wizard", "sage"];
var classOf = /* @__PURE__ */ __name((hero) => CLASSES[hero.classId] || CLASSES.swordsman, "classOf");
var maxJobLevelOf = /* @__PURE__ */ __name((hero) => MAX_JOB_LEVEL_BY_TIER[classOf(hero).tier] || 20, "maxJobLevelOf");
var freeStatPoints = /* @__PURE__ */ __name((hero) => statPointsForLevel(hero.level) - statPointsSpent(hero.stats), "freeStatPoints");
var freeSkillPoints = /* @__PURE__ */ __name((hero) => (classOf(hero).tier === 2 ? skillPointsForJobLevel(MAX_JOB_LEVEL_BY_TIER[1]) : 0) + skillPointsForJobLevel(hero.jobLevel) - skillPointsSpent(hero.skills), "freeSkillPoints");
var equippedItems = /* @__PURE__ */ __name((hero) => Object.values(hero.equipment || {}).map((id) => id && ITEMS[id]).filter(Boolean), "equippedItems");
function slotFor(hero, item) {
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
__name(slotFor, "slotFor");
function fitsSlot(id, slot) {
  const item = ITEMS[id];
  if (!item) {
    return false;
  }
  return item.slot === slot || item.slot === "ring" && (slot === "ring1" || slot === "ring2");
}
__name(fitsSlot, "fitsSlot");
var derivedStatsOf = /* @__PURE__ */ __name((hero) => deriveStats({
  level: hero.level,
  stats: hero.stats,
  items: equippedItems(hero),
  skills: hero.skills,
  heroClass: classOf(hero)
}), "derivedStatsOf");
function maxDamage(hero) {
  const derived = derivedStatsOf(hero);
  return Math.round(Math.max(derived.atk, derived.matk) * 7 * 1.6 + 50);
}
__name(maxDamage, "maxDamage");
var bagCount = /* @__PURE__ */ __name((hero, id) => (hero.bag || []).filter((entry) => entry.id === id).reduce((total, entry) => total + entry.count, 0), "bagCount");
function addToBag(hero, id, count = 1) {
  const item = ITEMS[id];
  if (!item || count <= 0) {
    return false;
  }
  const maxStack = item.stack || 1;
  if (!hero.bag) {
    hero.bag = [];
  }
  for (const entry of hero.bag) {
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
    if (hero.bag.length >= BAG_SIZE) {
      return false;
    }
    const added = Math.min(count, maxStack);
    hero.bag.push({ id, count: added });
    count -= added;
  }
  return true;
}
__name(addToBag, "addToBag");
function removeFromBag(hero, id, count = 1) {
  if (bagCount(hero, id) < count) {
    return false;
  }
  for (let i = hero.bag.length - 1; i >= 0 && count > 0; i--) {
    const entry = hero.bag[i];
    if (entry.id !== id) {
      continue;
    }
    const removed = Math.min(count, entry.count);
    entry.count -= removed;
    count -= removed;
    if (entry.count <= 0) {
      hero.bag.splice(i, 1);
    }
  }
  return true;
}
__name(removeFromBag, "removeFromBag");
function grantReward(hero, { exp = 0, zeny = 0 }) {
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
__name(grantReward, "grantReward");
function raiseStat(hero, key) {
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
  return true;
}
__name(raiseStat, "raiseStat");
function raiseSkill(hero, id) {
  if (freeSkillPoints(hero) <= 0 || !canLearn(hero.skills, id)) {
    return false;
  }
  hero.skills[id] = (hero.skills[id] || 0) + 1;
  return true;
}
__name(raiseSkill, "raiseSkill");
function advanceClass(hero, classId) {
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
__name(advanceClass, "advanceClass");
function equip(hero, id) {
  const item = ITEMS[id];
  if (!item || !item.slot) {
    return false;
  }
  if (item.forClass && item.forClass !== hero.classId && item.forClass !== classOf(hero).base) {
    return false;
  }
  if (!removeFromBag(hero, id)) {
    return false;
  }
  const slot = slotFor(hero, item);
  const previous = hero.equipment[slot];
  hero.equipment[slot] = id;
  if (previous) {
    addToBag(hero, previous, 1);
  }
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  return true;
}
__name(equip, "equip");
function unequip(hero, slot) {
  const id = hero.equipment[slot];
  if (!id) {
    return false;
  }
  if (!addToBag(hero, id)) {
    return false;
  }
  hero.equipment[slot] = null;
  hero.hp = Math.min(hero.hp, derivedStatsOf(hero).hpMax);
  return true;
}
__name(unequip, "unequip");
function buy(hero, id) {
  const item = ITEMS[id];
  if (!item || !item.price || hero.zeny < item.price) {
    return false;
  }
  if (!addToBag(hero, id)) {
    return false;
  }
  hero.zeny -= item.price;
  return true;
}
__name(buy, "buy");
function sell(hero, id) {
  const item = ITEMS[id];
  if (!item || !removeFromBag(hero, id)) {
    return false;
  }
  hero.zeny += Math.floor(item.price * SELL_RATIO);
  return true;
}
__name(sell, "sell");
function drop(hero, id) {
  return !!ITEMS[id] && removeFromBag(hero, id);
}
__name(drop, "drop");
function drinkPotion(hero, id) {
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
__name(drinkPotion, "drinkPotion");
function acceptQuest(hero, id) {
  if (!hero.quests) {
    hero.quests = {};
  }
  if (questState(id, hero.quests, hero.level) !== "available") {
    return false;
  }
  hero.quests[id] = { state: "active", count: 0 };
  const goal = QUESTS[id].goal;
  if (goal.type === "item") {
    hero.quests[id].count = Math.min(goal.count, bagCount(hero, goal.item));
  }
  return true;
}
__name(acceptQuest, "acceptQuest");
function markQuestProgress(hero, id) {
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
__name(markQuestProgress, "markQuestProgress");
function recordQuestKill(hero, monsterId) {
  let changed = false;
  for (const id in hero.quests || {}) {
    const progress = hero.quests[id];
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (progress && goal && progress.state === "active" && goal.type === "kill" && goal.monster === monsterId && progress.count < goal.count) {
      progress.count++;
      changed = true;
    }
  }
  return changed;
}
__name(recordQuestKill, "recordQuestKill");
function syncItemQuests(hero) {
  for (const id in hero.quests || {}) {
    const progress = hero.quests[id];
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (progress && goal && progress.state === "active" && goal.type === "item") {
      progress.count = Math.min(goal.count, bagCount(hero, goal.item));
    }
  }
}
__name(syncItemQuests, "syncItemQuests");
function turnInQuest(hero, id) {
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
__name(turnInQuest, "turnInQuest");
function newHero({ name, hair, classId }) {
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
    bag: STARTER_BAG.map((entry) => ({ ...entry })),
    quests: {},
    x: 0,
    z: 4
  };
  const derived = derivedStatsOf(hero);
  hero.hp = derived.hpMax;
  hero.sp = derived.spMax;
  return hero;
}
__name(newHero, "newHero");
function clampInt(value, min, max, fallback = min) {
  const rounded = Math.round(+value);
  return Number.isFinite(rounded) ? Math.max(min, Math.min(max, rounded)) : fallback;
}
__name(clampInt, "clampInt");
function sanitizeHero(input) {
  const source = migrateHero(input);
  const hero = {};
  hero.name = String(source.name || "").slice(0, 14).trim() || "Hero";
  hero.hair = typeof source.hair === "string" ? source.hair.slice(0, 16) : "plum";
  hero.classId = CLASSES[source.classId] ? source.classId : "swordsman";
  hero.level = clampInt(source.level, 1, MAX_LEVEL, 1);
  hero.exp = clampInt(source.exp, 0, expForLevel(hero.level) - 1, 0);
  hero.jobLevel = clampInt(source.jobLevel, 1, maxJobLevelOf(hero), 1);
  hero.jobExp = clampInt(source.jobExp, 0, jobExpForLevel(hero.jobLevel) - 1, 0);
  hero.stats = baseStats();
  for (const [key] of STATS) {
    hero.stats[key] = clampInt(source.stats && source.stats[key], 1, MAX_STAT, 1);
  }
  while (statPointsSpent(hero.stats) > statPointsForLevel(hero.level)) {
    const highest = STATS.map(([key]) => key).reduce(
      (a, b) => hero.stats[a] >= hero.stats[b] ? a : b
    );
    if (hero.stats[highest] <= 1) {
      break;
    }
    hero.stats[highest]--;
  }
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
    const highest = Object.keys(hero.skills).reduce(
      (a, b) => hero.skills[a] >= hero.skills[b] ? a : b
    );
    hero.skills[highest]--;
    if (!hero.skills[highest]) {
      delete hero.skills[highest];
    }
  }
  hero.zeny = clampInt(source.zeny, 0, 99999999, 0);
  hero.equipment = emptyEquipment();
  for (const slot in hero.equipment) {
    const id = source.equipment && source.equipment[slot];
    if (id && fitsSlot(id, slot)) {
      hero.equipment[slot] = id;
    }
  }
  hero.bag = [];
  for (const entry of Array.isArray(source.bag) ? source.bag : []) {
    if (!entry || !ITEMS[entry.id]) {
      continue;
    }
    addToBag(hero, entry.id, clampInt(entry.count, 1, ITEMS[entry.id].stack || 1, 1));
  }
  hero.quests = {};
  for (const [id, progress] of Object.entries(source.quests || {})) {
    if (QUESTS[id] && progress && (progress.state === "active" || progress.state === "done")) {
      hero.quests[id] = {
        state: progress.state,
        count: clampInt(progress.count, 0, QUESTS[id].goal.count || 1, 0)
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
__name(sanitizeHero, "sanitizeHero");

// src/hero-store.js
var MAX_HEROES = 6;
var STORAGE_PREFIX = "heroes:";
var LEGACY_STORAGE_PREFIX = "t:";
var LEGACY_WORLDS = ["v1", "lokaal"];
var DEFAULT_POTION = "red_potion";
var isValidToken = /* @__PURE__ */ __name((token) => typeof token === "string" && /^[a-z0-9]{20,48}$/.test(token), "isValidToken");
var isValidHeroName = /* @__PURE__ */ __name((name) => typeof name === "string" && name.length >= 1 && name.length <= 14, "isValidHeroName");
var storageKey = /* @__PURE__ */ __name((token) => STORAGE_PREFIX + token, "storageKey");
var isObject = /* @__PURE__ */ __name((value) => Boolean(value) && typeof value === "object", "isObject");
var levelOf = /* @__PURE__ */ __name((record) => +(record.level ?? record.lvl) || 0, "levelOf");
var expOf = /* @__PURE__ */ __name((record) => +record.exp || 0, "expOf");
function isFurtherThan(a, b) {
  if (levelOf(a) !== levelOf(b)) {
    return levelOf(a) > levelOf(b);
  }
  return expOf(a) > expOf(b);
}
__name(isFurtherThan, "isFurtherThan");
var HeroStore = class extends DurableObject {
  static {
    __name(this, "HeroStore");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.rosters = /* @__PURE__ */ new Map();
    this.pendingLoads = /* @__PURE__ */ new Map();
  }
  /** All heroes of an account: `{heroes, last}`. */
  async load(token) {
    return this.#getRoster(token);
  }
  /** One-time takeover of heroes from the browser's local storage, only while the account is still empty. */
  async importHeroes(token, list) {
    const roster = await this.#getRoster(token);
    if (roster.heroes.length) {
      return roster;
    }
    const sources = Array.isArray(list) ? list.slice(0, MAX_HEROES) : [];
    for (const source of sources) {
      const hero = this.#migrateOrNull(source);
      if (!hero || !isValidHeroName(hero.name) || this.#findHero(roster, hero.name)) {
        continue;
      }
      roster.heroes.push(sanitizeHero(hero));
    }
    await this.#persist(token, roster);
    return roster;
  }
  /** Creates a new level 1 hero from `{name, hair, classId}`. */
  async create(token, hero) {
    const roster = await this.#getRoster(token);
    if (roster.heroes.length >= MAX_HEROES || !isObject(hero) || !isValidHeroName(hero.name) || this.#findHero(roster, hero.name)) {
      return roster;
    }
    roster.heroes.push(
      newHero({ name: hero.name.trim(), hair: hero.hair, classId: hero.classId })
    );
    await this.#persist(token, roster);
    return roster;
  }
  async remove(token, name) {
    const roster = await this.#getRoster(token);
    const index = roster.heroes.findIndex((hero) => hero.name === name);
    if (index >= 0) {
      roster.heroes.splice(index, 1);
      roster.last = 0;
      await this.#persist(token, roster);
    }
    return roster;
  }
  /** Stores the volatile fields the client does keep itself (hp, sp, position); returns the hero or null. */
  async save(token, name, volatileFields) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero || !isObject(volatileFields)) {
      return null;
    }
    const derived = derivedStatsOf(hero);
    const hp = +volatileFields.hp;
    const sp = +volatileFields.sp;
    const x = +volatileFields.x;
    const z = +volatileFields.z;
    if (Number.isFinite(hp)) {
      hero.hp = Math.max(0, Math.min(derived.hpMax, Math.round(hp)));
    }
    if (Number.isFinite(sp)) {
      hero.sp = Math.max(0, Math.min(derived.spMax, Math.round(sp)));
    }
    if (Number.isFinite(x) && Number.isFinite(z)) {
      hero.x = +x.toFixed(2);
      hero.z = +z.toFixed(2);
    }
    roster.last = roster.heroes.indexOf(hero);
    await this.#persist(token, roster);
    return hero;
  }
  /**
   * A player action. Returns the hero record (also when nothing changed, so the client stays in sync), or null
   * when the hero does not exist.
   */
  async action(token, name, type, data) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero) {
      return null;
    }
    const payload = isObject(data) ? data : {};
    const id = typeof payload.id === "string" ? payload.id : "";
    let changed = false;
    switch (type) {
      case "stat":
        changed = raiseStat(hero, String(payload.stat));
        break;
      case "skill":
        changed = raiseSkill(hero, id);
        break;
      case "buy":
        changed = buy(hero, id);
        break;
      case "sell":
        changed = sell(hero, id);
        break;
      case "drop":
        changed = drop(hero, id);
        break;
      case "equip":
        changed = equip(hero, id);
        break;
      case "unequip":
        changed = unequip(hero, String(payload.slot));
        break;
      case "drink":
        changed = drinkPotion(hero, id || DEFAULT_POTION);
        break;
      case "advance":
        changed = advanceClass(hero, id);
        break;
      case "quest":
        changed = this.#questStep(hero, id, payload.step);
        break;
      case "respawn":
        this.#respawn(hero);
        changed = true;
        break;
    }
    if (changed) {
      await this.#persist(token, roster);
    }
    return hero;
  }
  /** A monster was killed: exp, zeny, loot and quest progress. Returns the hero or null. */
  async rewardKill(token, name, { monsterId, exp, zeny, loot }) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero) {
      return null;
    }
    grantReward(hero, { exp, zeny });
    if (loot && ITEMS[loot]) {
      addToBag(hero, loot, 1);
    }
    recordQuestKill(hero, monsterId);
    syncItemQuests(hero);
    await this.#persist(token, roster);
    return hero;
  }
  #questStep(hero, questId, step) {
    if (step === "accept") {
      return acceptQuest(hero, questId);
    }
    if (step === "turn_in") {
      return turnInQuest(hero, questId);
    }
    return markQuestProgress(hero, questId);
  }
  /* back in the village with half hp and sp */
  #respawn(hero) {
    const derived = derivedStatsOf(hero);
    hero.hp = Math.max(1, Math.round(derived.hpMax * 0.5));
    hero.sp = Math.round(derived.spMax * 0.5);
    hero.x = 0;
    hero.z = 4;
  }
  #findHero(roster, name) {
    return roster.heroes.find((hero) => hero.name === name) || null;
  }
  #migrateOrNull(record) {
    if (!isObject(record)) {
      return null;
    }
    try {
      return migrateHero(record);
    } catch {
      return null;
    }
  }
  async #persist(token, roster) {
    await this.ctx.storage.put(storageKey(token), { heroes: roster.heroes, last: roster.last });
  }
  /* the cached roster, or one read from storage; concurrent first loads share a single read */
  async #getRoster(token) {
    if (!isValidToken(token)) {
      throw new Error("invalid token");
    }
    const cached = this.rosters.get(token);
    if (cached) {
      return cached;
    }
    let pending = this.pendingLoads.get(token);
    if (!pending) {
      pending = this.#readRoster(token).finally(() => this.pendingLoads.delete(token));
      this.pendingLoads.set(token, pending);
    }
    return pending;
  }
  async #readRoster(token) {
    const stored = await this.ctx.storage.get(storageKey(token));
    let roster;
    if (stored) {
      const heroes = (Array.isArray(stored.heroes) ? stored.heroes : []).map((record) => this.#migrateOrNull(record)).filter(Boolean);
      roster = { heroes, last: +stored.last || 0 };
    } else {
      roster = await this.#importLegacyRoster(token);
      await this.#persist(token, roster);
    }
    this.rosters.set(token, roster);
    return roster;
  }
  /* first visit of a token: collect its heroes from the old worlds, keeping the further-along copy of each name */
  async #importLegacyRoster(token) {
    const recordsByName = /* @__PURE__ */ new Map();
    let lastPlayedName = null;
    for (const worldName of LEGACY_WORLDS) {
      const world = this.env.WORLD.get(this.env.WORLD.idFromName(worldName));
      const legacy = await world.legacyHeroes(token);
      const list = isObject(legacy) && Array.isArray(legacy.lijst) ? legacy.lijst : [];
      if (lastPlayedName === null && list.length) {
        const lastPlayed = list[legacy.laatst];
        lastPlayedName = isObject(lastPlayed) ? lastPlayed.naam ?? lastPlayed.name : null;
      }
      for (const record of list) {
        if (!isObject(record)) {
          continue;
        }
        const name = record.naam ?? record.name;
        if (!isValidHeroName(name)) {
          continue;
        }
        const existing = recordsByName.get(name);
        if (!existing || isFurtherThan(record, existing)) {
          recordsByName.set(name, record);
        }
      }
    }
    const heroes = [...recordsByName.values()].map((record) => this.#migrateOrNull(record)).filter(Boolean);
    const lastIndex = heroes.findIndex((hero) => hero.name === lastPlayedName);
    return { heroes, last: Math.max(0, lastIndex) };
  }
};

// src/accounts.js
import { DurableObject as DurableObject2 } from "cloudflare:workers";
var PBKDF2_ITERATIONS = 6e4;
var MAX_ATTEMPTS = 6;
var ATTEMPT_WINDOW_MS = 10 * 60 * 1e3;
var ACCOUNT_PREFIX = "acc:";
var TOKEN_PREFIX = "tok:";
var TOO_MANY_ATTEMPTS = "Too many attempts. Try again in ten minutes.";
var WRONG_PASSWORD = "Unknown username or wrong password.";
var WEAK_PASSWORD = "A password has at least 6 characters.";
var encoder = new TextEncoder();
var toHex = /* @__PURE__ */ __name((buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join(""), "toHex");
var randomHex = /* @__PURE__ */ __name((byteCount) => toHex(crypto.getRandomValues(new Uint8Array(byteCount))), "randomHex");
async function hashSecret(secret, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((pair) => parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}
__name(hashSecret, "hashSecret");
function isEqualConstantTime(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
__name(isEqualConstantTime, "isEqualConstantTime");
var isValidAccountName = /* @__PURE__ */ __name((name) => typeof name === "string" && /^[A-Za-z0-9_]{3,16}$/.test(name), "isValidAccountName");
var isValidPassword = /* @__PURE__ */ __name((password) => typeof password === "string" && password.length >= 6 && password.length <= 72, "isValidPassword");
var createRecoveryCode = /* @__PURE__ */ __name(() => randomHex(8).toUpperCase().match(/.{4}/g).join("-"), "createRecoveryCode");
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }), "json");
var accountName = /* @__PURE__ */ __name((account) => account.name ?? account.naam, "accountName");
var Accounts = class extends DurableObject2 {
  static {
    __name(this, "Accounts");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.attempts = /* @__PURE__ */ new Map();
  }
  #isLockedOut(key) {
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return false;
    }
    if (Date.now() - attempt.since > ATTEMPT_WINDOW_MS) {
      this.attempts.delete(key);
      return false;
    }
    return attempt.count >= MAX_ATTEMPTS;
  }
  #recordFailure(key) {
    const attempt = this.attempts.get(key);
    if (attempt && Date.now() - attempt.since <= ATTEMPT_WINDOW_MS) {
      attempt.count++;
    } else {
      this.attempts.set(key, { count: 1, since: Date.now() });
    }
  }
  async #isPasswordCorrect(account, password) {
    return Boolean(account) && isValidPassword(password) && isEqualConstantTime(await hashSecret(password, account.salt), account.hash);
  }
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "POST expected" }, 405);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "no JSON" }, 400);
    }
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "no JSON" }, 400);
    }
    const route = new URL(request.url).pathname.replace(/^\/account\//, "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const key = ACCOUNT_PREFIX + name.toLowerCase();
    if (route === "whoami") {
      return this.#whoami(body);
    }
    if (!isValidAccountName(name)) {
      return json({ ok: false, error: "A username has 3 to 16 letters, digits or underscores." });
    }
    if (route === "register") {
      return this.#register(body, name, key);
    }
    if (route === "login") {
      return this.#login(body, key);
    }
    if (route === "recover") {
      return this.#recover(body, key);
    }
    if (route === "delete") {
      return this.#deleteAccount(body, key);
    }
    return json({ ok: false, error: "unknown" }, 404);
  }
  async #whoami(body) {
    if (!isValidToken(body.token)) {
      return json({ ok: true, name: null });
    }
    const name = await this.ctx.storage.get(TOKEN_PREFIX + body.token);
    return json({ ok: true, name: name || null });
  }
  async #register(body, name, key) {
    if (!isValidPassword(body.password)) {
      return json({ ok: false, error: WEAK_PASSWORD });
    }
    if (!isValidToken(body.token)) {
      return json({ ok: false, error: "No hero token." });
    }
    if (await this.ctx.storage.get(key)) {
      return json({ ok: false, error: "That username is taken." });
    }
    if (await this.ctx.storage.get(TOKEN_PREFIX + body.token)) {
      return json({
        ok: false,
        error: "These heroes already belong to an account. Log out first."
      });
    }
    const salt = randomHex(16);
    const recoveryCode = createRecoveryCode();
    const codeSalt = randomHex(16);
    const account = {
      name,
      salt,
      hash: await hashSecret(body.password, salt),
      token: body.token,
      codeSalt,
      codeHash: await hashSecret(recoveryCode, codeSalt),
      created: Date.now()
    };
    await this.ctx.storage.put(key, account);
    await this.ctx.storage.put(TOKEN_PREFIX + body.token, name);
    return json({ ok: true, name, token: body.token, recoveryCode });
  }
  async #login(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    if (!await this.#isPasswordCorrect(account, body.password)) {
      this.#recordFailure(key);
      return json({ ok: false, error: WRONG_PASSWORD });
    }
    this.attempts.delete(key);
    return json({ ok: true, name: accountName(account), token: account.token });
  }
  /* a new password with the recovery code; the code is replaced by a fresh one */
  async #recover(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!account || !code || !isEqualConstantTime(await hashSecret(code, account.codeSalt), account.codeHash)) {
      this.#recordFailure(key);
      return json({ ok: false, error: "Unknown username or wrong recovery code." });
    }
    if (!isValidPassword(body.password)) {
      return json({ ok: false, error: WEAK_PASSWORD });
    }
    const recoveryCode = createRecoveryCode();
    account.salt = randomHex(16);
    account.hash = await hashSecret(body.password, account.salt);
    account.codeSalt = randomHex(16);
    account.codeHash = await hashSecret(recoveryCode, account.codeSalt);
    await this.ctx.storage.put(key, account);
    this.attempts.delete(key);
    return json({ ok: true, name: accountName(account), token: account.token, recoveryCode });
  }
  /* removes the account; the heroes stay with the token, which is then free for a new account */
  async #deleteAccount(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    if (!await this.#isPasswordCorrect(account, body.password)) {
      this.#recordFailure(key);
      return json({ ok: false, error: WRONG_PASSWORD });
    }
    await this.ctx.storage.delete(key);
    await this.ctx.storage.delete(TOKEN_PREFIX + account.token);
    return json({ ok: true, name: accountName(account), token: account.token });
  }
};

// src/index.js
var MAX_MESSAGE_SIZE = 16 * 1024;
var MAX_WORLD_MESSAGE_SIZE = 512 * 1024;
var MAX_OBSTACLES = 6e3;
var MAX_EVENT_TYPE_LENGTH = 16;
var TICK_MS = 200;
var MAX_TICK_SECONDS = 0.5;
var DEFAULT_MAX_DAMAGE = 400;
var MAX_PARTY_SIZE = 6;
var INVITE_LIFETIME_MS = 6e4;
var SHARE_DISTANCE = 40;
var PARTY_EXP_BONUS = 0.1;
var SERVER_ID = "server";
var DEFAULT_WORLD = "v1";
var OBSTACLES_KEY = "obstacles";
var LEGACY_OBSTACLES_KEY = "obst";
var PLAYER_ID_PATTERN = /^[a-z0-9-]{6,40}$/;
var HERO_MESSAGE_KINDS = /* @__PURE__ */ new Set([
  "load_heroes",
  "import_heroes",
  "create_hero",
  "delete_hero",
  "play_hero",
  "save_hero",
  "hero_action"
]);
var SERVER_ONLY_EVENTS = /* @__PURE__ */ new Set(["monsters", "monster_attack", "kill"]);
var isObject2 = /* @__PURE__ */ __name((value) => Boolean(value) && typeof value === "object", "isObject");
var json2 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
}), "json");
function trySend(ws, message) {
  try {
    ws.send(typeof message === "string" ? message : JSON.stringify(message));
  } catch {
  }
}
__name(trySend, "trySend");
var World = class extends DurableObject3 {
  static {
    __name(this, "World");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"kind":"ping"}', '{"kind":"pong"}')
    );
    this.simulation = createSimulation((type, data) => this.#onSimulationEvent(type, data));
    this.parties = /* @__PURE__ */ new Map();
    this.invites = /* @__PURE__ */ new Map();
    this.partyCounter = 0;
    this.version = env.VERSION && env.VERSION.id || "";
    this.loop = null;
    this.lastTick = 0;
    this.ctx.blockConcurrencyWhile(async () => {
      const obstacles = await this.ctx.storage.get(OBSTACLES_KEY) || await this.ctx.storage.get(LEGACY_OBSTACLES_KEY);
      if (obstacles) {
        this.simulation.setObstacles(obstacles);
      }
    });
  }
  /** RPC for HeroStore: the heroes this world kept for a token before HeroStore existed, or null. */
  async legacyHeroes(token) {
    if (!isValidToken(token)) {
      return null;
    }
    return await this.ctx.storage.get(LEGACY_STORAGE_PREFIX + token) ?? null;
  }
  #heroStore() {
    return this.env.HEROES.get(this.env.HEROES.idFromName("main"));
  }
  /* the players as the simulation sees them, from the presence everyone sends along */
  #simulationPlayers() {
    const players = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment || !attachment.id || !attachment.presence || !attachment.presence.name) {
        continue;
      }
      const presence = attachment.presence;
      players.push({
        id: attachment.id,
        x: +presence.x || 0,
        z: +presence.z || 0,
        isDead: Boolean(presence.dead)
      });
    }
    return players;
  }
  /* the simulation only runs while someone is here; afterwards the object can sleep */
  #startLoop() {
    if (this.loop || !this.simulation.hasObstacles()) {
      return;
    }
    this.simulation.spawn(this.#simulationPlayers());
    this.lastTick = Date.now();
    this.loop = setInterval(() => {
      const players = this.#simulationPlayers();
      if (!players.length) {
        clearInterval(this.loop);
        this.loop = null;
        return;
      }
      const now = Date.now();
      const dt = Math.min(MAX_TICK_SECONDS, (now - this.lastTick) / 1e3);
      this.lastTick = now;
      this.simulation.tick(dt, players);
      this.#broadcast(null, this.#serverEvent("monsters", this.simulation.snapshot()));
    }, TICK_MS);
  }
  #serverEvent(type, data) {
    return { kind: "event", from: SERVER_ID, type, data };
  }
  /* starts the loop if it can and gives a new player the monsters right away */
  #startLoopFor(ws) {
    this.#startLoop();
    if (this.loop) {
      trySend(ws, this.#serverEvent("monsters", this.simulation.snapshot()));
    }
  }
  #onSimulationEvent(type, data) {
    const payload = type === "kill" ? this.#withShares(data) : data;
    this.#broadcast(null, this.#serverEvent(type, payload));
    if (type === "kill") {
      this.#rewardKill(payload);
    }
  }
  async fetch(request) {
    const deployedVersion = request.headers.get("x-version");
    if (deployedVersion && this.version && deployedVersion !== this.version) {
      setTimeout(() => this.ctx.abort(), 50);
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return this.#status(request);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null, presence: null, connectedAt: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }
  #status(request) {
    const players = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment || !attachment.id) {
        continue;
      }
      const presence = attachment.presence || {};
      players.push({ id: attachment.id, name: presence.name, level: presence.level });
    }
    return json2({
      world: new URL(request.url).searchParams.get("world") || DEFAULT_WORLD,
      version: this.version,
      online: players.length,
      players
    });
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_WORLD_MESSAGE_SIZE) {
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isObject2(message)) {
      return;
    }
    const attachment = ws.deserializeAttachment() || {};
    if (message.kind === "hello") {
      this.#hello(ws, attachment, message);
      return;
    }
    if (!attachment.id) {
      return;
    }
    if (message.kind === "party") {
      this.#handleParty(ws, attachment, message);
      return;
    }
    if (HERO_MESSAGE_KINDS.has(message.kind)) {
      await this.#handleHeroMessage(ws, attachment, message);
      return;
    }
    if (message.kind === "world_obstacles") {
      this.#setWorldObstacles(ws, message);
      return;
    }
    if (raw.length > MAX_MESSAGE_SIZE) {
      return;
    }
    if (message.kind === "presence") {
      attachment.presence = isObject2(message.presence) ? message.presence : {};
      ws.serializeAttachment(attachment);
      this.#broadcast(ws, { kind: "presence", from: attachment.id, presence: attachment.presence });
      return;
    }
    if (message.kind === "event" && typeof message.type === "string" && message.type.length <= MAX_EVENT_TYPE_LENGTH) {
      this.#handleEvent(ws, attachment, message);
    }
  }
  #hello(ws, attachment, message) {
    if (typeof message.from !== "string" || !PLAYER_ID_PATTERN.test(message.from)) {
      return;
    }
    attachment.id = message.from;
    attachment.presence = isObject2(message.presence) ? message.presence : {};
    attachment.token = isValidToken(message.token) ? message.token : null;
    attachment.heroName = null;
    attachment.maxDamage = null;
    ws.serializeAttachment(attachment);
    const players = [];
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) {
        continue;
      }
      const otherAttachment = other.deserializeAttachment();
      if (otherAttachment && otherAttachment.id) {
        players.push({ from: otherAttachment.id, presence: otherAttachment.presence });
      }
    }
    trySend(ws, { kind: "welcome", players, time: Date.now() });
    this.#broadcast(ws, { kind: "presence", from: attachment.id, presence: attachment.presence });
    this.#startLoopFor(ws);
  }
  /* the world's collision circles, sent once per version of the world */
  #setWorldObstacles(ws, message) {
    if (!Array.isArray(message.obstacles) || message.obstacles.length > MAX_OBSTACLES) {
      return;
    }
    const isFirst = !this.simulation.hasObstacles();
    this.simulation.setObstacles(message.obstacles);
    this.ctx.storage.put(OBSTACLES_KEY, message.obstacles);
    if (isFirst) {
      this.#startLoopFor(ws);
    }
  }
  #handleEvent(ws, attachment, message) {
    if (SERVER_ONLY_EVENTS.has(message.type)) {
      return;
    }
    const data = isObject2(message.data) ? message.data : {};
    let outgoingData = message.data;
    if (message.type === "hit") {
      const cap = attachment.heroName ? attachment.maxDamage : DEFAULT_MAX_DAMAGE;
      const damage = Math.min(+data.damage || 0, cap ?? DEFAULT_MAX_DAMAGE);
      outgoingData = { ...data, damage };
      this.simulation.hit(String(data.id), damage, attachment.id);
      if (data.pushX !== void 0) {
        this.simulation.knockback(String(data.id), +data.pushX, +data.pushZ, +data.force);
      }
    } else if (message.type === "freeze") {
      const ids = Array.isArray(data.ids) ? data.ids.map(String) : [];
      this.simulation.freeze(ids, +data.duration);
    } else if (message.type === "provoke") {
      this.simulation.provoke(+data.x, +data.z, +data.radius, attachment.id);
      return;
    }
    const outgoing = JSON.stringify({
      kind: "event",
      from: attachment.id,
      type: message.type,
      data: outgoingData
    });
    if (typeof message.to === "string") {
      const recipient = this.#findSocket(message.to);
      if (recipient) {
        trySend(recipient.ws, outgoing);
      }
    } else {
      this.#broadcast(ws, outgoing);
    }
  }
  /* re-reads the attachment before writing, so a presence update made during an await is not lost */
  #updateAttachment(ws, changes) {
    try {
      const attachment = ws.deserializeAttachment() || {};
      ws.serializeAttachment({ ...attachment, ...changes });
    } catch {
    }
  }
  /* a fresh hero record came back: keep its damage cap, if this socket still plays that hero */
  #refreshMaxDamage(ws, hero) {
    try {
      const attachment = ws.deserializeAttachment();
      if (attachment && attachment.heroName === hero.name) {
        this.#updateAttachment(ws, { maxDamage: maxDamage(hero) });
      }
    } catch {
    }
  }
  /* heroes and actions of an account; the reply carries the request id so the client can match it */
  async #handleHeroMessage(ws, attachment, message) {
    const reply = /* @__PURE__ */ __name((payload) => trySend(ws, { ...payload, requestId: message.requestId }), "reply");
    const replyHeroes = /* @__PURE__ */ __name((roster) => reply({ kind: "heroes", heroes: roster.heroes, last: roster.last }), "replyHeroes");
    const token = attachment.token;
    if (!token) {
      reply({ kind: "error", error: "no_token" });
      return;
    }
    const store = this.#heroStore();
    try {
      switch (message.kind) {
        case "load_heroes":
          replyHeroes(await store.load(token));
          break;
        case "import_heroes":
          replyHeroes(await store.importHeroes(token, message.heroes));
          break;
        case "create_hero":
          replyHeroes(await store.create(token, message.hero));
          break;
        case "delete_hero":
          replyHeroes(await store.remove(token, String(message.name)));
          break;
        case "play_hero":
          await this.#playHero(ws, token, message.name, reply);
          break;
        case "save_hero":
          if (attachment.heroName) {
            await store.save(token, attachment.heroName, message.hero);
          } else {
            reply({ kind: "error", error: "no_hero" });
          }
          break;
        case "hero_action": {
          if (!attachment.heroName) {
            reply({ kind: "error", error: "no_hero" });
            return;
          }
          const hero = await store.action(
            token,
            attachment.heroName,
            String(message.type),
            message.data
          );
          if (hero) {
            this.#refreshMaxDamage(ws, hero);
            reply({ kind: "hero", hero });
          }
          break;
        }
      }
    } catch {
      reply({ kind: "error", error: "server_error" });
    }
  }
  async #playHero(ws, token, name, reply) {
    const roster = await this.#heroStore().load(token);
    const hero = isValidHeroName(name) ? roster.heroes.find((h) => h.name === name) : null;
    if (!hero) {
      reply({ kind: "error", error: "unknown_hero" });
      return;
    }
    this.#updateAttachment(ws, { heroName: hero.name, maxDamage: maxDamage(hero) });
    reply({ kind: "hero", hero });
  }
  /* ---- parties: invite, accept, leave, kick; members share exp (with a bonus) and zeny ---- */
  #findSocket(playerId) {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment && attachment.id === playerId) {
        return { ws, attachment };
      }
    }
    return null;
  }
  #partyOf(playerId) {
    for (const party of this.parties.values()) {
      if (party.members.includes(playerId)) {
        return party;
      }
    }
    return null;
  }
  #sendPartyState(party) {
    const members = party.members.map((id) => {
      const socket = this.#findSocket(id);
      const presence = socket && socket.attachment.presence || {};
      return {
        id,
        name: presence.name || "?",
        classId: presence.classId || "swordsman",
        level: presence.level || 1
      };
    });
    const message = JSON.stringify({
      kind: "party_state",
      party: { id: party.id, leader: party.leader, members }
    });
    for (const id of party.members) {
      const socket = this.#findSocket(id);
      if (socket) {
        trySend(socket.ws, message);
      }
    }
  }
  #leaveParty(playerId) {
    const party = this.#partyOf(playerId);
    if (!party) {
      return;
    }
    party.members = party.members.filter((id) => id !== playerId);
    const socket = this.#findSocket(playerId);
    if (socket) {
      trySend(socket.ws, { kind: "party_state", party: null });
    }
    if (!party.members.length) {
      this.parties.delete(party.id);
      return;
    }
    if (party.leader === playerId) {
      party.leader = party.members[0];
    }
    this.#sendPartyState(party);
  }
  #handleParty(ws, attachment, message) {
    const info = /* @__PURE__ */ __name((text) => trySend(ws, { kind: "party_info", text }), "info");
    switch (message.action) {
      case "invite":
        this.#invite(attachment, String(message.target), info);
        break;
      case "accept":
        this.#acceptInvite(attachment, info);
        break;
      case "decline":
        this.#declineInvite(attachment);
        break;
      case "leave":
        this.#leaveParty(attachment.id);
        break;
      case "kick":
        this.#kick(attachment, String(message.member));
        break;
    }
  }
  #invite(attachment, targetId, info) {
    const target = this.#findSocket(targetId);
    if (!target || target.attachment.id === attachment.id || !target.attachment.presence || !target.attachment.presence.name) {
      info("That player is not here.");
      return;
    }
    const targetName = target.attachment.presence.name;
    if (this.#partyOf(target.attachment.id)) {
      info(`${targetName} is already in a party.`);
      return;
    }
    let party = this.#partyOf(attachment.id);
    if (!party) {
      this.partyCounter++;
      party = { id: "p" + this.partyCounter, leader: attachment.id, members: [attachment.id] };
      this.parties.set(party.id, party);
      this.#sendPartyState(party);
    } else if (party.leader !== attachment.id) {
      info("Only the party leader can invite.");
      return;
    }
    if (party.members.length >= MAX_PARTY_SIZE) {
      info(`The party is full (${MAX_PARTY_SIZE}).`);
      return;
    }
    this.invites.set(target.attachment.id, {
      partyId: party.id,
      from: attachment.id,
      time: Date.now()
    });
    const inviterName = attachment.presence && attachment.presence.name || "?";
    trySend(target.ws, {
      kind: "party_invite",
      from: { id: attachment.id, name: inviterName },
      partyId: party.id
    });
    info(`You invited ${targetName} to your party.`);
  }
  #acceptInvite(attachment, info) {
    const invite = this.invites.get(attachment.id);
    if (!invite || Date.now() - invite.time > INVITE_LIFETIME_MS) {
      info("That invitation has expired.");
      return;
    }
    this.invites.delete(attachment.id);
    const party = this.parties.get(invite.partyId);
    if (!party || party.members.length >= MAX_PARTY_SIZE) {
      info("That party no longer exists.");
      return;
    }
    this.#leaveParty(attachment.id);
    party.members.push(attachment.id);
    this.#sendPartyState(party);
  }
  #declineInvite(attachment) {
    const invite = this.invites.get(attachment.id);
    this.invites.delete(attachment.id);
    if (!invite) {
      return;
    }
    const inviter = this.#findSocket(invite.from);
    if (inviter) {
      const name = attachment.presence && attachment.presence.name || "Someone";
      trySend(inviter.ws, { kind: "party_info", text: `${name} declined your invitation.` });
    }
  }
  #kick(attachment, memberId) {
    const party = this.#partyOf(attachment.id);
    if (!party || party.leader !== attachment.id) {
      return;
    }
    if (party.members.includes(memberId) && memberId !== attachment.id) {
      this.#leaveParty(memberId);
    }
  }
  /* each nearby party member's share of a kill's exp and zeny; together they earn 10% extra per extra member */
  #withShares(kill) {
    const shares = {};
    const party = this.#partyOf(kill.killer);
    if (!party) {
      shares[kill.killer] = { exp: kill.exp, zeny: kill.zeny };
      return { ...kill, shares };
    }
    const nearby = party.members.filter((id) => {
      const socket = this.#findSocket(id);
      const presence = socket && socket.attachment.presence;
      if (!presence || !presence.name || presence.dead) {
        return false;
      }
      const distance = Math.hypot((+presence.x || 0) - kill.x, (+presence.z || 0) - kill.z);
      return distance <= SHARE_DISTANCE;
    });
    if (!nearby.includes(kill.killer)) {
      nearby.push(kill.killer);
    }
    const count = nearby.length;
    const bonus = 1 + PARTY_EXP_BONUS * (count - 1);
    for (const id of nearby) {
      shares[id] = {
        exp: Math.round(kill.exp * bonus / count),
        zeny: Math.round(kill.zeny / count)
      };
    }
    return { ...kill, shares };
  }
  /* a monster died: everyone with a share gets exp and zeny on their record; the loot goes to the killer */
  async #rewardKill(kill) {
    const monsterId = String(kill.id).split("#")[0];
    for (const [playerId, share] of Object.entries(kill.shares || {})) {
      const socket = this.#findSocket(playerId);
      if (!socket || !socket.attachment.token || !socket.attachment.heroName) {
        continue;
      }
      try {
        const hero = await this.#heroStore().rewardKill(
          socket.attachment.token,
          socket.attachment.heroName,
          {
            monsterId,
            exp: share.exp,
            zeny: share.zeny,
            loot: playerId === kill.killer ? kill.loot : null
          }
        );
        if (hero) {
          this.#refreshMaxDamage(socket.ws, hero);
          socket.ws.send(JSON.stringify({ kind: "hero", hero }));
        }
      } catch {
      }
    }
  }
  webSocketClose(ws) {
    this.#disconnect(ws);
  }
  webSocketError(ws) {
    this.#disconnect(ws);
  }
  #disconnect(ws) {
    const attachment = ws.deserializeAttachment();
    try {
      ws.close(1e3, "bye");
    } catch {
    }
    if (attachment && attachment.id) {
      this.#leaveParty(attachment.id);
      this.invites.delete(attachment.id);
      this.#broadcast(ws, { kind: "left", from: attachment.id });
    }
  }
  /* sends to everyone except `sender` */
  #broadcast(sender, message) {
    const text = typeof message === "string" ? message : JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) {
        trySend(ws, text);
      }
    }
  }
};
var CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname.startsWith("/account/")) {
      const accounts = env.ACCOUNTS.get(env.ACCOUNTS.idFromName("main"));
      const response = await accounts.fetch(request);
      return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" }
      });
    }
    if (url.pathname === "/ws" || url.pathname === "/status") {
      const worldName = (url.searchParams.get("world") || DEFAULT_WORLD).slice(0, 32);
      const world = env.WORLD.get(env.WORLD.idFromName(worldName));
      const forwarded = new Request(request);
      forwarded.headers.set("x-version", env.VERSION && env.VERSION.id || "");
      return world.fetch(forwarded);
    }
    return new Response(
      "Eldoria: Chronicles of Magic \u2013 game server. Connect to /ws, status at /status.",
      { headers: { "content-type": "text/plain", "access-control-allow-origin": "*" } }
    );
  }
};

// ../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RMl06h/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RMl06h/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Accounts,
  HeroStore,
  World,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
