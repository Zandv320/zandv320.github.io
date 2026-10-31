/* Eldoria – the guide cards: short explanations of the game's systems. The main story shows one when a step
   introduces something new (QUESTS[id].tutorial); all of them can be read again from the Quests tab.
   `icons` are ids from the icon atlas shown along the top of the card; `body` is a list of paragraphs (HTML). */
export const GUIDE_TOPICS = {
  welcome: {
    title: "Welcome to Eldoria",
    icons: ["class_swordsman", "class_mage", "ui_map"],
    body: [
      "<b>Click the ground</b> to walk and <b>a person</b> to talk. <b>Click a monster</b> to select it and <b>right-click</b> it to attack. On a phone: tap a monster to select it, tap it again to attack.",
      "The <b>gold panel</b> on the left always shows your next step in the story, and the <b>gold arrow</b> points the way. People with a glowing <b>★</b> above their head have the next part of your story.",
      "Old Mette is waiting for you by the well.",
    ],
  },
  gear: {
    title: "Your bag and your gear",
    icons: ["ui_bag", "leather_cap", "wooden_sword"],
    body: [
      "Open your <b>inventory</b> with the bag button (or <kbd>I</kbd>). Tap an item to <b>equip</b>, <b>use</b> or <b>drop</b> it.",
      "What you wear is on the <b>Gear</b> tab of your character sheet (<kbd>C</kbd>); tap a slot to take it off. You have ten slots, from your head down to your boots.",
      "Better gear comes from monsters, shops, quests and, later, your own forge.",
    ],
  },
  combat: {
    title: "Fighting",
    icons: ["crushing_blow", "red_potion", "ui_sit"],
    body: [
      "Click a monster (or tap it) to select it, then right-click it (or tap it again) to attack. Your hero keeps fighting until it falls or you walk away; a skill on the selected monster starts the fight too.",
      "Swordsmen fight up close. Mages strike from a distance with bolts of magic, so keep monsters at arm's length.",
      "Your <b>skills</b> are on the hotbar at the bottom (<kbd>1</kbd>–<kbd>9</kbd>). They cost SP, the blue bar.",
      "Low on health? Drink a <b>red potion</b> (<kbd>R</kbd>) or eat food from your bag. <b>Sitting</b> (<kbd>X</kbd>) restores health and SP four times faster.",
      "If you fall, you wake up at the well with half your health. Nothing is lost.",
    ],
  },
  stats: {
    title: "Levels and stats",
    icons: ["ui_character", "blade_mastery"],
    body: [
      "Monsters and quests give <b>experience</b>. Every level brings <b>stat points</b>, every job level <b>skill points</b>.",
      "<b>STR</b> hits harder, <b>AGI</b> attacks faster and dodges, <b>VIT</b> gives health and defense, <b>INT</b> powers spells and SP, <b>DEX</b> makes you hit, <b>LUK</b> brings critical hits.",
      "Spend points on the <b>Stats</b> tab of your character sheet with the <b>+</b> buttons. Higher stats cost more points.",
    ],
  },
  skills: {
    title: "Skills",
    icons: ["crushing_blow", "flame_sweep", "ember_bolt"],
    body: [
      "Every <b>job level</b> brings skill points. Spend them on the <b>Skills</b> tab of your character sheet: tap a skill, read what it does and press <b>Learn</b>.",
      "Skills you can use land on your <b>hotbar</b>; passive skills work by themselves. Some skills need others first; the lines in the tree show which.",
      "At job level 50 your mentor lets you choose an advanced class.",
    ],
  },
  life_skills: {
    title: "Professions",
    icons: ["prof_mining", "prof_woodcutting", "prof_herbalism", "prof_fishing", "prof_smithing"],
    body: [
      "Next to fighting, every hero has eight professions, each with its own level from 1 to 50.",
      "<b>Gathering:</b> mining, woodcutting, herbalism and fishing. You need a tool for each (pickaxe, hatchet, herb knife, fishing rod); Merchant Bram sells them. Tools work from your bag.",
      "<b>Crafting:</b> smithing at a forge, alchemy at an alchemy table, cooking at a campfire and enchanting at an altar. The stations are marked on the map.",
      "Your progress is on the <b>Crafts</b> tab of your character sheet. Higher levels open better ore, herbs, fish and recipes.",
    ],
  },
  gathering: {
    title: "Gathering",
    icons: ["copper_pickaxe", "copper_ore", "sunleaf", "minnow"],
    body: [
      "Tap an <b>ore vein</b>, a <b>tree</b>, a <b>herb</b> or the <b>ripples</b> on water. Your hero walks there and gets to work; stay put until the bar is full.",
      "A spent vein, stump or picked plant grows back after a while. A grey name means your level is too low for now.",
      "A better tool works faster, and at a high level you sometimes get two at once. Miners now and then find a gem.",
    ],
  },
  crafting: {
    title: "Crafting",
    icons: ["prof_smithing", "prof_alchemy", "prof_cooking", "copper_bar"],
    body: [
      "Tap a <b>station</b> to open its workbench. Each recipe shows its ingredients: green when you have enough, red when not.",
      "Press <b>Make</b> for one, or <b>All</b> for as many as you can. Every craft trains the profession; recipes above your level show the level they need.",
      "Smithing makes bars and gear, alchemy potions and elixirs, cooking food that heals, enchanting runes.",
    ],
  },
  enchanting: {
    title: "Enchanting",
    icons: ["prof_enchanting", "arcane_dust", "rune_of_sharpness", "ench_flame"],
    body: [
      "An <b>enchanting altar</b> has four tabs. <b>Disenchant</b> breaks old gear into arcane dust. <b>Runes</b> turns dust and materials into runes.",
      "<b>Refine</b> uses runes to make a weapon or armor stronger, up to +10. Up to +4 never fails; from +5 a failure costs a level, but nothing is ever destroyed.",
      "<b>Enchant</b> gives a weapon an element: flame, frost, storms or arcane, each with its own effect in battle.",
    ],
  },
  travel: {
    title: "The wider world",
    icons: ["ui_map", "ui_quests"],
    body: [
      "Open the <b>map</b> with the map button (or <kbd>M</kbd>); tap a spot on it to walk there.",
      "The fields around Runeveld suit levels 1 to 8, Whisperwood to the north 8 to 15, and Kingsvale with the capital Aurelia to the west 15 to 24.",
      "Aurelia has shops for better gear, an inn, a temple with an enchanting altar, and many people with work for you.",
    ],
  },
  saga_end: {
    title: "Saga I complete",
    icons: ["amulet_of_aurelia", "ui_quests"],
    body: [
      "The crossed-out crown is broken and the King knows your name. That is the end of <b>Saga I: The Crossed-Out Crown</b>.",
      "The story goes on at once in <b>Saga II: The Shattered Runes</b>. Captain Aldric has a message for you: the court archmage wants to see you.",
    ],
  },
};

/* The order in which the guide book lists them. */
export const GUIDE_ORDER = [
  "welcome",
  "combat",
  "gear",
  "stats",
  "skills",
  "life_skills",
  "gathering",
  "crafting",
  "enchanting",
  "travel",
];
