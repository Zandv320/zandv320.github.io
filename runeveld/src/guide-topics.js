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
      "<b>Crafting:</b> smithing at a forge, alchemy at an alchemy table and cooking at a campfire; the stations are marked on the map. Enchanting you can do anywhere.",
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
      "Enchant <b>anywhere</b>: <b>✨ Enchant</b> in your inventory (or <kbd>K</kbd>) opens it where you stand. It has four tabs. <b>Disenchant</b> breaks old gear into arcane dust. <b>Runes</b> turns dust and materials into runes.",
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
  northroad: {
    title: "The Northroad",
    icons: ["ui_map", "storm_pelt"],
    body: [
      "The <b>Northroad</b> runs from Aurelia's north gate past Fort Harrow to the Halfway Inn and on towards the sea. It suits levels 22 to 26.",
      "Watch the sky: now and then a <b>storm</b> rolls over the hills. Then it rains, the light goes grey, and the storm wolves hunt harder and faster.",
      "Once you have slept at the <b>Halfway Inn</b>, you wake up there when the road knocks you down.",
    ],
  },
  sailing: {
    title: "Sailing",
    icons: ["ui_map"],
    body: [
      "Click the <b>Gull's Promise</b> at the east pier of Saltmere to go aboard and <b>take the helm</b>.",
      "Steer with the walking keys, or <b>click the water</b> to sail there. She comes round slowly and gathers way; mind the rocks and the islets.",
      "The <b>sea chart</b> (<kbd>M</kbd>, or the ⚓ on the map) shows the Grey Sea: Saltmere, the islets, the rocks and the Ember Isles. At the helm, <b>click the chart</b> to set your course.",
      "Bring her back <b>slowly</b> to her berth by the east pier and she moors by herself. The hero comes ashore on the pier.",
    ],
  },
  riding: {
    title: "Riding",
    icons: ["ui_map"],
    body: [
      "You have a <b>mount</b> in your mount slot. Press <kbd>H</kbd> (or the slot on the hotbar) to call it and ride: you go a good deal faster.",
      "You get off by yourself for a fight, a skill, a seat or a crafting station, and nobody rides down into the crypt or the forge. Press <kbd>H</kbd> again to get off.",
      "Stablemaster Hilde at the stables in Aurelia's southeast quarter sells riding foxes.",
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
  saga2_end: {
    title: "Saga II complete",
    icons: ["runebearer_mantle", "ui_quests"],
    body: [
      "The Grey Leviathan is still, and the seals of moon, fire and tide know your hand. But Maelis carries the hearts of fire and tide, and Selwyn's answer changes everything: the seals were never walls. They feed the Hollow, to keep it asleep. That is the end of <b>Saga II: The Shattered Runes</b>.",
      "Three runes are bound to you: open the <b>rune overview</b> (<kbd>U</kbd>) to see what they give. Four seals are still out there, in lands no chart of ours has a name for.",
      "The story goes on at once in <b>Saga III: The Long Winter</b>. Selwyn has news from Saltmere: a ship has come in from the far north.",
    ],
  },
  frostmarch: {
    title: "The Frostmarch",
    icons: ["ui_map", "ui_quests"],
    body: [
      "North of the Ember Isles and Tidecrown the sea fills with <b>floes</b>. Steer between them: a wide lane runs straight north to <b>Rimeholt</b>, on the frozen bay of the Frostmarch's coast.",
      "Rimeholt is safe: no monster comes near its fire, and if you fall on the shore you wake beside it. You can walk out on the bay's ice, and <b>fish through the holes</b> in it with any rod.",
      "Furrier Ragna sells furs against the cold. The <b>frost wolves</b> hunt the snowfields east of the village; <b>ice slimes</b> creep over the shore to the west.",
    ],
  },
  white_waste: {
    title: "The White Waste",
    icons: ["ui_map", "ui_quests"],
    body: [
      "Beyond the pass lies the <b>White Waste</b>, and it is <b>cold</b>. Away from a fire the cold creeps into you: frost gathers at the edges of your sight, and when it is bad you walk slower. A fur cloak keeps half of it out.",
      "<b>Fires</b> warm you: Torvald's shelter just past the pass, the hunters' two watch-fires, even the Unbound's braziers. If you fall in the Waste you wake at the shelter.",
      "Now and then a <b>whiteout</b> comes down: the snow blows sideways, you can barely see, the cold bites twice as hard, and the ice trolls come out of the snow from further off.",
    ],
  },
  glacier_halls: {
    title: "The Glacier Halls",
    icons: ["ui_map", "ui_quests"],
    body: [
      "The keepers of the frost seal cut halls out of the glacier. Some passages are shut by <b>doors of ice</b>: put your <b>Ember Rune</b> on <kbd>Q</kbd> (click it in the rune codex, <kbd>U</kbd>), stand facing the door, close by, and call it. Fire is the one thing their ice remembers how to fear.",
      "In the <b>Mirror Hall</b> three mirrors show what the ice remembers. Look into them from west to east.",
      "The <b>Rime Wyrm</b> breathes ice down a lane: a pillar of ice stops it. Icicles fall where circles show on the ground, and when it is badly hurt it burrows into the ice and breaks out beside you.",
    ],
  },
  saga3_end: {
    title: "Saga III complete",
    icons: ["crossed_crown_pendant", "ui_quests"],
    body: [
      "Maelis fled the Keeper's Vault without the frost seal's heart, and the frost seal knows your hand. Rimeholt calls you family, and a sledge wolf runs at your side. That is the end of <b>Saga III: The Long Winter</b>.",
      "The <b>Frost Rune</b> is bound to you: open the rune codex (<kbd>U</kbd>) and click a rune to choose which one is on <kbd>Q</kbd>. Your sledge wolf goes in the mount slot (<kbd>H</kbd> to ride).",
      "Storms that do not move with the wind hang over the Northroad, and Pell's runestone will not stop humming. The storm seal is where <b>Saga IV</b> will begin.",
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
  "riding",
  "northroad",
  "sailing",
  "frostmarch",
  "white_waste",
  "glacier_halls",
];
