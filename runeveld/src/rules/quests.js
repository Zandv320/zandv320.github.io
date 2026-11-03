/* Eldoria – quest rules: the quests themselves and the pure checks on them.
   No DOM and no game state; a hero's progress is an object {[id]: {state: 'active'|'done', count}} that the
   server keeps just as well as the client.

   The main story runs through the sagas (SAGAS): Saga I, "The Crossed-Out Crown" (chapters 1 to 5), Saga II,
   "The Shattered Runes" (chapters 6 to 12), and Saga III, "The Long Winter" (from chapter 13). Its quests have `main: true` and come in order, each one opening the next
   (`after`). The chapters are in CHAPTERS. The other quests are side quests; the main story never needs them,
   although a level gate can make them a good way to grow.

   goal.type: 'kill'        defeat `count` monsters of type `monster`
              'item'        hand in `count` of `item` (taken from the bag on turn-in)
              'visit'       talk to `npc`
              'reach'       come within `r` of (x, z); `label` describes the place in the tracker
              'ritual'      wake the runes of a seal (`seal`) at (x, z) (seals.js); `label` as with 'reach'; or
                            anything else that happens once in a place (the Glacier Halls' door and mirrors),
                            with `verb` [to do, done] for the tracker
              'chase'       keep up with a fleeing `label` to the end of his route (maelis.js)
              'equip'       wear something in `slot`                   } checked against the hero's state
              'stat'        raise any stat once                        } (syncStateQuests in progression.js)
              'skill'       learn any skill                            }
              'buy'         buy `item` from a shop                     } counted as it happens
              'gather'      gather `count` of `item`                   } (recordQuestEvent), so what the
              'craft'       make `count` of `item`                     } hero did before accepting does
              'disenchant'  break down `count` items (enchanting)      } not count
              'refine'      refine an item `count` times               }
   A reward item can differ per class: {id, count, mage: id-for-mages}; `reward.rune` binds a rune (rules/runes.js). A quest can require a minimum level
   (`level`) and a preceding quest (`after`). Other fields:
     turnIn    the npc it is handed in to, when that is not the giver (a 'visit' quest ends at the npc visited)
     gives     items handed over when the quest is accepted (a tool, a badge)
     hint      how to do it, for the objective panel
     where     where the guide points: {monster} (the nearest one alive), {npc}, {station} (the nearest of that kind)
     ui        which panel the guide highlights: 'inventory' or 'character'
     tutorial  the guide card shown on accepting it (guide.js)
     final     the last quest of a saga (or of its chapters so far); `ending` names its guide card */

import { EMBER_LANDS } from "./ember.js";
import { forgePoint, GREAT_FORGE, FIRE_SEAL } from "./forge.js";
import { WATCHTOWER, SHRINE, FAIRY_RING, LOOKOUT } from "./landmarks.js";
import { TIDE_SEAL } from "./tidecrown.js";
import { PASS_FOOT, KARI_HOLLOW, LOST_BOW } from "./frostmarch.js";
import { FROZEN_DOORS, MIRRORS, FROST_SEAL } from "./glacier.js";

const BELLOWS_HALL = forgePoint(24, 18);

/* The sagas, with the first chapter of each. */
export const SAGAS = [
  { title: "Saga I", name: "The Crossed-Out Crown", firstChapter: 1 },
  { title: "Saga II", name: "The Shattered Runes", firstChapter: 6 },
  { title: "Saga III", name: "The Long Winter", firstChapter: 13 },
];

/** The saga a chapter belongs to. */
export const sagaOfChapter = (chapter) =>
  SAGAS.filter((saga) => saga.firstChapter <= chapter).pop() || SAGAS[0];

/** The chapter numbers of a saga, in order. */
export const chaptersOf = (saga) =>
  Object.keys(CHAPTERS)
    .map(Number)
    .filter((chapter) => sagaOfChapter(chapter) === saga);

/* The chapters of the main story, by number. */
export const CHAPTERS = {
  1: "A stranger in Runeveld",
  2: "Hands that work",
  3: "Teeth in the dark",
  4: "Whisperwood",
  5: "The Kingsroad",
  6: "The Seventh Seal",
  7: "The Northroad",
  8: "Saltmere",
  9: "Across the Grey Sea",
  10: "The Ember Isles",
  11: "The Forge of the First Flame",
  12: "The Grey Sea Rises",
  13: "Ice That Does Not Melt",
  14: "Rimeholt",
  15: "The White Waste",
  16: "The Glacier Halls",
  17: "The Heart in the Ice",
};

export const QUESTS = {
  /* ---- Saga I, chapter 1: a stranger in Runeveld ---- */
  mette_welcome: {
    giver: "Old Mette",
    turnIn: "Merchant Bram",
    hint: "Merchant Bram stands at the red-and-white stall on the square. Tap him to talk.",
    chapter: 1,
    main: true,
    title: "A warm welcome",
    level: 1,
    intro:
      "New face! Nobody wanders out past the fence before they know the village. Go say hello to Merchant Bram at the red stall, and tell him Mette sent you.",
    progressText: "Bram is at the red stall by the square. Red, like his nose.",
    completeText:
      "Mette sent you? Then you are welcome. She was my first customer, back when I sold only turnips. Two potions, on the house.",
    goal: { type: "visit", npc: "Merchant Bram" },
    reward: { exp: 20, zeny: 30, items: [{ id: "red_potion", count: 2 }] },
  },
  main_bram_cap: {
    giver: "Merchant Bram",
    title: "Dressed for the road",
    main: true,
    chapter: 1,
    level: 1,
    after: "mette_welcome",
    intro:
      "Out there nobody cares how brave you are, only how thick your hat is. Take this leather cap, a gift on Mette's account. Put it on, let me see.",
    progressText: "Open your inventory, choose the leather cap and press Equip.",
    completeText:
      "There. Now you look like someone who comes back. Guard Rolf at the north gate always needs help; go and see him.",
    hint: "Open your inventory (the bag button, or I), tap the Leather cap and choose Equip.",
    ui: "inventory",
    tutorial: "gear",
    gives: [{ id: "leather_cap", count: 1 }],
    goal: { type: "equip", slot: "head", label: "Wear the leather cap" },
    reward: { exp: 25, zeny: 20, items: [] },
  },
  rolf_rabbits: {
    giver: "Guard Rolf",
    where: { monster: "rabbit" },
    hint: "Rabbits hop around outside the gates. Click one to select it and right-click to attack (on a phone: tap it twice). Your hero keeps fighting by itself. Your skills sit on the hotbar at the bottom; drink a red potion when your health runs low.",
    tutorial: "combat",
    chapter: 1,
    main: true,
    title: "Rabbit trouble",
    level: 1,
    after: "main_bram_cap",
    intro:
      "You look like you can hold a sword. The rabbits outside the fence are eating everything that grows. Thin them out for me: five should do.",
    progressText:
      "Five rabbits. They hop around just outside the fence. Hit them before they hop off.",
    completeText:
      "Five fewer rabbits. The farmers will sleep better. Here is your pay, and something for the scratches.",
    goal: { type: "kill", monster: "rabbit", count: 5 },
    reward: { exp: 60, zeny: 80, items: [{ id: "red_potion", count: 3 }] },
  },
  main_training: {
    giver: "Guard Rolf",
    title: "Stronger every day",
    main: true,
    chapter: 1,
    level: 1,
    after: "rolf_rabbits",
    intro:
      "Not bad for a first hunt. Every fight makes you stronger, but strength has to go somewhere. Spend a point on yourself: strength for the sword arm, vitality for a tougher hide, whatever suits you.",
    progressText: "Open your character sheet, go to Stats and raise a stat with the + button.",
    completeText:
      "Feel that? That is the difference between a farmhand and a fighter. Bram has been asking about you; go and see him.",
    hint: "Open the character sheet (C, or the hero button), choose Stats and press + next to a stat. Every level brings new points.",
    ui: "character",
    tutorial: "stats",
    goal: { type: "stat", label: "Raise a stat" },
    reward: { exp: 40, zeny: 60, items: [{ id: "red_potion", count: 2 }] },
  },
  teun_lucky_feet: {
    giver: "Fisher Teun",
    where: { monster: "rabbit" },
    title: "Lucky feet",
    level: 2,
    intro:
      "Shh. Not a bite all week. I need luck, and rabbits have it in their feet, everyone knows that. Bring me two rabbit feet.",
    progressText: "Two rabbit feet. Rabbits drop them sometimes, if you ask with a sword.",
    completeText:
      "Two feet. Now the fish will come. Probably. Here, I have no use for these potions anyway.",
    goal: { type: "item", item: "rabbit_foot", count: 2 },
    reward: { exp: 80, zeny: 60, items: [{ id: "red_potion", count: 2 }] },
  },
  pim_fox: {
    giver: "Pim",
    where: { monster: "fox" },
    title: "A real fox",
    level: 2,
    after: "rolf_rabbits",
    intro:
      "I saw a fox and nobody believes me! If you bring me a fox tail I can show everyone. Please? I have ten zeny.",
    progressText: "A fox tail! The foxes run out in the fields, past the rabbits. Do not tell mum.",
    completeText: "A REAL fox tail! Here, you can have my ten zeny. All of it.",
    goal: { type: "item", item: "fox_tail", count: 1 },
    reward: { exp: 40, zeny: 10, items: [] },
  },
  /* ---- chapter 2: hands that work (the professions) ---- */
  main_trade: {
    giver: "Merchant Bram",
    title: "A trade of your own",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_training",
    intro:
      "Rolf will make a soldier of you, but soldiers go hungry when the fighting stops. Learn a trade! Everyone here gathers and crafts something. Start with a pickaxe; I sell good ones.",
    progressText: "Ask me for my wares and buy a Copper pickaxe.",
    completeText:
      "Fine copper, that. Smith Ragnar at the forge west of the square will show you what to do with it.",
    hint: "Talk to Bram, choose 'Let me see your wares' and buy a Copper pickaxe (120 zeny). Tools stay in your bag; you never have to equip them.",
    where: { npc: "Merchant Bram" },
    tutorial: "life_skills",
    goal: { type: "buy", item: "copper_pickaxe" },
    reward: { exp: 30, zeny: 40, items: [] },
  },
  main_copper: {
    giver: "Smith Ragnar",
    title: "Copper for the forge",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_trade",
    intro:
      "Bram sent you with a pickaxe? Then use it. There are copper veins in the fields around the village: rocks with orange in them. Bring up three lumps of ore.",
    progressText:
      "Copper veins are rocks with orange specks, out in the fields. Tap one to mine it.",
    completeText: "Good ore. Now let us make something of it.",
    hint: "Tap a copper vein (a rock with orange specks) and stay put while your hero mines. A spent vein grows back after a while; the arrow points to the nearest one.",
    tutorial: "gathering",
    goal: { type: "gather", item: "copper_ore", count: 3 },
    reward: { exp: 50, zeny: 30, items: [] },
  },
  main_smelt: {
    giver: "Smith Ragnar",
    title: "Smelting",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_copper",
    intro:
      "Ore is pretty rock until it meets the fire. Use my forge, right here by the anvil, and smelt two copper bars.",
    progressText: "Tap the forge and press Make next to Copper bar.",
    completeText:
      "Two bars, and all your fingers left. You will make a smith yet. Keep the bars; enchanters want copper too.",
    hint: "Tap the forge beside the smithy and press Make next to Copper bar. Every craft trains Smithing; your progress is in the Crafts tab of the character sheet.",
    where: { station: "forge" },
    tutorial: "crafting",
    goal: { type: "craft", item: "copper_bar", count: 2 },
    reward: { exp: 60, zeny: 40, items: [] },
  },
  main_herbs: {
    giver: "Old Mette",
    title: "Sunleaf",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_smelt",
    intro:
      "A trade, Bram says? Then learn mine as well. Herbs heal more than swords ever did. Take my old herb knife and cut four sunleaf; it grows in the fields, a yellow flower on green leaves.",
    progressText: "Sunleaf grows in the fields around the village. Tap a plant to cut it.",
    completeText: "Fresh, and not bruised. You have gentle hands.",
    hint: "Sunleaf is a small plant with a yellow flower. Tap it to cut it with the herb knife Mette gave you.",
    gives: [{ id: "herb_knife", count: 1 }],
    goal: { type: "gather", item: "sunleaf", count: 4 },
    reward: { exp: 50, zeny: 20, items: [] },
  },
  main_brew: {
    giver: "Old Mette",
    title: "A simple brew",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_herbs",
    intro:
      "Now the fun part. My alchemy table stands by the house west of the square. Two sunleaf make two red potions. Brew them and keep them; you will need them.",
    progressText: "Tap the alchemy table and make Red potions.",
    completeText:
      "Your first brew, and it even smells right. Fisher Teun asked for you; something about patience.",
    hint: "Tap the alchemy table (flasks on a bench, west of the square) and press Make next to Red potion.",
    where: { station: "alchemy_table" },
    goal: { type: "craft", item: "red_potion", count: 2 },
    reward: { exp: 60, zeny: 30, items: [] },
  },
  main_fish: {
    giver: "Fisher Teun",
    title: "Patience",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_brew",
    intro:
      "Mette says you have a gentle hand. Fishing wants a patient one. Take my spare rod. Where the water ripples, the fish are; there is a pond just south of the square. Catch me two minnows.",
    progressText: "Tap the ripples on a pond and wait for a bite.",
    completeText:
      "Two minnows, and you did not even scare the rest off. Now for the second half of fishing: eating.",
    hint: "Walk to the edge of a pond and tap the ripples. Your hero casts and waits; when the float dips, you have a fish.",
    gives: [{ id: "fishing_rod", count: 1 }],
    goal: { type: "gather", item: "minnow", count: 2 },
    reward: { exp: 50, zeny: 30, items: [] },
  },
  main_cook: {
    giver: "Fisher Teun",
    title: "Supper",
    main: true,
    chapter: 2,
    level: 1,
    after: "main_fish",
    intro:
      "There is a campfire by the barns east of the square. Grill the minnows there. Food heals, it is cheap, and it beats starving in a forest.",
    progressText: "Tap the campfire and make Grilled minnow.",
    completeText:
      "Smells like home. Eat them when you are hurt: use them from your bag. Guard Sven at the south gate needs fighters, and you are one.",
    hint: "Tap the campfire east of the square and press Make next to Grilled minnow. Eat food from your inventory with Use.",
    where: { station: "campfire" },
    goal: { type: "craft", item: "cooked_minnow", count: 2 },
    reward: { exp: 60, zeny: 40, items: [] },
  },
  /* ---- chapter 3: teeth in the dark ---- */
  sven_foxes: {
    giver: "Guard Sven",
    where: { monster: "fox" },
    hint: "Foxes roam the fields a little further out than the rabbits. They bite back, so keep an eye on your health and use food or potions.",
    chapter: 3,
    main: true,
    title: "Foxes at the south gate",
    level: 3,
    after: "main_cook",
    intro:
      "Rolf sent you? Then you will do. Foxes have been circling the fields at night. Six of them should learn to keep their distance.",
    progressText: "Six foxes, out in the fields beyond the rabbits. Watch out, they bite back.",
    completeText: "Six foxes. Quiet shift tonight, then. I like quiet shifts. Here.",
    goal: { type: "kill", monster: "fox", count: 6 },
    reward: { exp: 220, zeny: 180, items: [{ id: "red_potion", count: 3 }] },
  },
  main_skill: {
    giver: "Guard Sven",
    title: "A trick or two",
    main: true,
    chapter: 3,
    level: 3,
    after: "sven_foxes",
    intro:
      "You fight like a farmer with a stick. Brave, but plain. Every fighter learns tricks as they grow: a heavy blow, a burst of flame. Learn one, then come back.",
    progressText: "Open your character sheet, go to Skills and learn a skill.",
    completeText:
      "Better. Now that you can fight properly: Farmer Jorn has trouble in his fields. Go and hear him out.",
    hint: "Skill points come with job levels. Open the character sheet, choose Skills, tap a skill and press Learn. Skills you learn appear on your hotbar.",
    ui: "character",
    tutorial: "skills",
    goal: { type: "skill", label: "Learn a skill" },
    reward: { exp: 120, zeny: 100, items: [{ id: "red_potion", count: 3 }] },
  },
  lise_fox_tails: {
    giver: "Baker Lise",
    where: { monster: "fox" },
    title: "Fox tails",
    level: 3,
    after: "rolf_rabbits",
    intro:
      "Foxes got into my flour again. I want three of their tails for my door. Let the others see what happens.",
    progressText: "Three fox tails. The foxes run in the fields, further out than the rabbits.",
    completeText:
      "Three tails for my door. Perfect. This cap was my brother's, he will not miss it. And the bread is on the house.",
    goal: { type: "item", item: "fox_tail", count: 3 },
    reward: { exp: 150, zeny: 200, items: [{ id: "leather_cap", count: 1 }] },
  },
  jorn_boars: {
    giver: "Farmer Jorn",
    where: { monster: "boar" },
    hint: "Boars live at the edge of the fields, furthest from the village. They charge hard: fight one at a time and use your skills.",
    chapter: 3,
    main: true,
    title: "Boars in the beets",
    level: 5,
    after: "main_skill",
    intro:
      "Boars. Big ones, out at the edge of the fields, and they have found my beets. I cannot pay much, but I pay. Three boars.",
    progressText: "Three boars, at the far edge of the fields. Do not let them charge you.",
    completeText: "Three boars gone. My beets thank you. So do I. Here.",
    goal: { type: "kill", monster: "boar", count: 3 },
    reward: { exp: 300, zeny: 350, items: [{ id: "red_potion", count: 5 }] },
  },
  main_crown: {
    giver: "Farmer Jorn",
    turnIn: "Guard Rolf",
    title: "The crossed-out crown",
    main: true,
    chapter: 3,
    level: 5,
    after: "jorn_boars",
    intro:
      "While you fought the boars I found this in the furrows: a tin badge, a crown crossed out. Bandits wear these on the roads far to the west. What is one doing on my farm? Take it to Guard Rolf.",
    progressText: "Show the badge to Guard Rolf at the north gate.",
    completeText:
      "A crossed-out crown. Varek's bandits, from Kingsvale, this far east... they are scouting us. The old ones always said the forest altar warns of trouble. Mette knows the old ways. Grow strong, then ask her.",
    hint: "Guard Rolf stands at the north gate. Talk to him.",
    gives: [{ id: "bandit_insignia", count: 1 }],
    goal: { type: "visit", npc: "Guard Rolf" },
    reward: { exp: 150, zeny: 120, items: [] },
  },
  ragnar_hides: {
    giver: "Smith Ragnar",
    where: { monster: "boar" },
    title: "Hides for the forge",
    level: 6,
    after: "jorn_boars",
    intro:
      "Jorn says you handle boars. Good. I need four boar hides for the bellows. Bring them and I will make it worth your while.",
    progressText: "Four boar hides. The boars roam the far edge of the fields.",
    completeText:
      "Four good hides. A deal is a deal: this has been waiting for someone who deserves it.",
    goal: { type: "item", item: "boar_hide", count: 4 },
    reward: { exp: 400, zeny: 300, items: [{ id: "iron_helm", count: 1, mage: "starry_hat" }] },
  },
  /* ---- chapter 4: Whisperwood, level 8 to 15 ---- */
  mette_altar: {
    giver: "Old Mette",
    hint: "Leave through the north gate and follow the path into Whisperwood. The old altar stands on a stone circle at the end of the path.",
    chapter: 4,
    main: true,
    title: "The old altar",
    level: 8,
    after: "main_crown",
    intro:
      "Rolf told me about the badge. When trouble came, in my mother's time, we went to the old altar in Whisperwood, north past the gate. Go and see if it still stands. Follow the path and do not stray; the forest is not the fields.",
    progressText:
      "North through the gate, then follow the path through the trees. The altar is on the stone circle at the end.",
    completeText:
      "It still stands? Then the forest remembers us. Thank you, child. Here, for your trouble.",
    goal: { type: "reach", x: 0, z: -103, r: 5, label: "the old altar" },
    reward: { exp: 300, zeny: 200, items: [{ id: "red_potion", count: 3 }] },
  },
  main_altar_dust: {
    giver: "Old Mette",
    title: "What the altar keeps",
    main: true,
    chapter: 4,
    level: 8,
    after: "mette_altar",
    intro:
      "The altar still hums, you say? Then the old enchanters' magic lives on. Enchanting starts with breaking: take something old you no longer need and break it down into arcane dust. You need no altar for it: the old magic goes with whoever has touched it. Here is a pinch to start you off.",
    progressText:
      "Open your inventory, press ✨ Enchant (or K), open the Disenchant tab and break down a piece of old gear.",
    completeText: "Dust, and a little glow in your fingers. Now let us put it to use.",
    hint: "Enchanting works anywhere: open your inventory and press ✨ Enchant (or K). Open Disenchant, pick an item you no longer need and confirm. You get arcane dust.",
    ui: "inventory",
    tutorial: "enchanting",
    gives: [{ id: "arcane_dust", count: 1 }],
    goal: { type: "disenchant", count: 1 },
    reward: { exp: 200, zeny: 100, items: [] },
  },
  main_sharpen: {
    giver: "Old Mette",
    title: "A keener edge",
    main: true,
    chapter: 4,
    level: 8,
    after: "main_altar_dust",
    intro:
      "Two pinches of dust and a copper bar make a Rune of Sharpness. With it an altar makes your weapon keener; the enchanters call it refining. Make the rune and refine your weapon once.",
    progressText:
      "At an altar: make a Rune of Sharpness in the Runes tab, then use it in the Refine tab.",
    completeText:
      "Feel the edge? +1 already. The best in Aurelia go to +10, though the runes crack more often the higher you go. Rolf has been asking for you: the wolves are back.",
    hint: "Runes tab: Rune of Sharpness (2 arcane dust and 1 copper bar). Then the Refine tab: choose your weapon and refine it to +1. Up to +4 never fails.",
    where: { station: "enchanting_altar" },
    goal: { type: "refine", count: 1 },
    reward: { exp: 250, zeny: 150, items: [] },
  },
  rolf_wolves: {
    giver: "Guard Rolf",
    where: { monster: "wolf" },
    hint: "Grey wolves hunt between the trees of Whisperwood, off the path. They are quick and often hunt together; fight near the path so you can pull back.",
    chapter: 4,
    main: true,
    title: "Howling in the north",
    level: 8,
    after: "main_sharpen",
    intro:
      "You hear that at night? Wolves, in Whisperwood. They are getting bolder. Six of them, and the rest will think twice.",
    progressText:
      "Six grey wolves. They hunt between the trees off the path, north of the gate. Watch your back.",
    completeText: "Six wolves. The howling is quieter already. Good work, and well paid.",
    goal: { type: "kill", monster: "wolf", count: 6 },
    reward: { exp: 800, zeny: 500, items: [{ id: "red_potion", count: 5 }] },
  },
  lise_warm_coat: {
    giver: "Baker Lise",
    where: { monster: "wolf" },
    title: "A warm coat",
    level: 9,
    after: "lise_fox_tails",
    intro:
      "Winter is coming and my coat is thin. Three wolf pelts from Whisperwood and I will have a warm one. I pay in bread and zeny.",
    progressText: "Three wolf pelts. The wolves live in Whisperwood, north of the village.",
    completeText: "Three pelts! Soft as anything. Here, and come by for bread whenever you like.",
    goal: { type: "item", item: "wolf_pelt", count: 3 },
    reward: { exp: 650, zeny: 450, items: [{ id: "red_potion", count: 4 }] },
  },
  ragnar_antlers: {
    giver: "Smith Ragnar",
    where: { monster: "stag" },
    title: "Antlers for the forge",
    level: 10,
    after: "ragnar_hides",
    intro:
      "Stag antler makes the best sword hilts. There are stags in Whisperwood. Two antlers. They will not give them up gladly.",
    progressText:
      "Two stag antlers. The stags graze deep in Whisperwood. They are peaceful until you are not.",
    completeText: "Two antlers. Now this is hilt material. Take this, I have no use for it.",
    goal: { type: "item", item: "stag_antler", count: 2 },
    reward: { exp: 800, zeny: 400, items: [{ id: "leather_vest", count: 1, mage: "silk_robe" }] },
  },
  rolf_dire_boar: {
    giver: "Guard Rolf",
    where: { monster: "dire_boar" },
    hint: "The dire boar lives on the stone circle around the old altar. It hits very hard: bring potions and food, and use your strongest skills.",
    chapter: 4,
    main: true,
    title: "The dire boar",
    level: 12,
    after: "rolf_wolves",
    intro:
      "Something big has made its den on the stone circle at the end of the forest path. A boar, they say, the size of a cart. Nobody goes near the altar any more. Deal with it and I will give you my own steel.",
    progressText:
      "The dire boar lives on the stone circle at the old altar, at the end of the path through Whisperwood. Bring potions.",
    completeText:
      "You killed it? By the gods. Here, as promised, the best I have. Carry it better than I did.",
    goal: { type: "kill", monster: "dire_boar", count: 1 },
    reward: {
      exp: 1500,
      zeny: 1200,
      items: [{ id: "steel_sword", count: 1, mage: "crystal_staff" }],
    },
  },
  /* ---- chapter 4, the end: the Sunken Crypt under the altar (rules/crypt.js), level 13 to 17 ---- */
  mette_runes: {
    giver: "Old Mette",
    hint: "Behind the old altar in Whisperwood, stairs now lead down into the dark. Tap them to go down.",
    chapter: 4,
    main: true,
    title: "The waking runes",
    level: 13,
    after: "rolf_dire_boar",
    intro:
      "The night your boar died, the runes on the old altar burned violet until dawn. And behind it, the ground has opened: stairs, going down. My grandmother said a count was buried under that forest, with everything he owned. Go and see what woke up. Take a torch.",
    progressText:
      "The stairs lie just behind the old altar at the end of the forest path. Go down and look around.",
    completeText:
      "A crypt. Of course there is a crypt. And it was not empty, was it? Sit, drink this, and then tell me everything.",
    goal: { type: "reach", x: 0, z: 537.5, r: 4, label: "the crypt under the altar" },
    reward: { exp: 1200, zeny: 400, items: [{ id: "orange_potion", count: 4 }] },
  },
  mette_count: {
    giver: "Old Mette",
    where: { monster: "crimson_count" },
    hint: "Count Vaelor waits in the Crimson Sanctum, the deepest room of the crypt. A lever in the ossuary opens the iron gate; the plaque in the chamber of runes tells you the order of the stones. Step out of the red circles.",
    chapter: 4,
    main: true,
    title: "The Crimson Count",
    level: 15,
    after: "mette_runes",
    intro:
      "Thralls, and a witch, and a sealed door with moons on it. It is him, then: Count Vaelor, the crimson count from my grandmother's stories. They say he walks again when the forest bleeds. Finish what the old village could not. Rest well first.",
    progressText:
      "The count waits behind the rune door. Pull the lever in the ossuary, wake the stones in the right order, and mind his blood runes.",
    completeText:
      "Dust, at last. You have done what three generations of this village only whispered about. Here: the old stories say he guarded this. Now it is yours.",
    goal: { type: "kill", monster: "crimson_count", count: 1 },
    reward: {
      exp: 3200,
      zeny: 1800,
      items: [{ id: "bloodfang_blade", count: 1, mage: "nightveil_staff" }],
    },
  },
  /* ---- chapter 5: the Kingsroad, Kingsvale and Aurelia, level 15 to 24 ---- */
  rolf_road_west: {
    giver: "Guard Rolf",
    turnIn: "Captain Aldric",
    hint: "Leave through the west gate and follow the Kingsroad to the walls of Aurelia. Captain Aldric stands just inside the east gate of the city.",
    tutorial: "travel",
    chapter: 5,
    main: true,
    title: "The road west",
    level: 15,
    after: "mette_count",
    intro:
      "The Kingsroad runs west from our gate to Aurelia, the capital. Captain Aldric at the east gate of the city asked for anyone who can fight. Go and report to him. Mind the road: bandits.",
    progressText:
      "Through the west gate and follow the Kingsroad until you see the walls of Aurelia. Captain Aldric stands just inside the east gate.",
    completeText:
      "Rolf sent you? He does not send just anyone. Welcome to Aurelia. Rest at the inn, see the market, and come back to me when you are ready to work.",
    goal: { type: "visit", npc: "Captain Aldric" },
    reward: { exp: 700, zeny: 400, items: [{ id: "red_potion", count: 4 }] },
  },
  aldric_bandits: {
    giver: "Captain Aldric",
    where: { monster: "bandit" },
    hint: "Bandits roam the meadows of Kingsvale outside the city walls, mostly along the roads. They come in groups: pull one at a time.",
    chapter: 5,
    main: true,
    title: "Bandits on the Kingsroad",
    level: 15,
    after: "rolf_road_west",
    intro:
      "So you are Rolf's fighter. Good, I need one. Bandits have taken the meadows around the city and rob every cart on the Kingsroad. Eight of them, and the rest will think about a new trade.",
    progressText:
      "Eight bandits. They roam the meadows of Kingsvale outside the walls, mostly along the road. They fight in groups; so should you.",
    completeText: "Eight. The merchants will drink to your name tonight. Here is the city's pay.",
    goal: { type: "kill", monster: "bandit", count: 8 },
    reward: { exp: 1500, zeny: 900, items: [{ id: "orange_potion", count: 3 }] },
  },
  wren_dark_pelts: {
    giver: "Apothecary Wren",
    where: { monster: "dire_wolf" },
    title: "Dark pelts",
    level: 16,
    after: "rolf_road_west",
    intro:
      "The dire wolves of Kingsvale have a pelt that keeps a brew warm for days. Four of them, and I pay in potions. Good ones.",
    progressText:
      "Four dire wolf pelts. The dire wolves roam the meadows of Kingsvale, and they are bolder at night.",
    completeText: "Four pelts, and not a hair singed. You have a careful hand. Here, as promised.",
    goal: { type: "item", item: "dire_wolf_pelt", count: 4 },
    reward: { exp: 1100, zeny: 600, items: [{ id: "orange_potion", count: 5 }] },
  },
  aldric_brutes: {
    giver: "Captain Aldric",
    where: { monster: "bandit_brute" },
    hint: "Brutes guard the bandits' paths through the meadows. They are slow but hit hard: keep moving and use your skills.",
    chapter: 5,
    main: true,
    title: "The brutes",
    level: 18,
    after: "aldric_bandits",
    intro:
      "The bandits have muscle: brutes in stolen armor who do the real hurting. Five of them. Then we talk about their chief.",
    progressText: "Five bandit brutes. Big, slow, and they hit like a mule. Keep moving.",
    completeText: "Five brutes down. Now I know you can take their chief. Rest first.",
    goal: { type: "kill", monster: "bandit_brute", count: 5 },
    reward: { exp: 2000, zeny: 1400, items: [{ id: "orange_potion", count: 5 }] },
  },
  aldric_varek: {
    giver: "Captain Aldric",
    where: { monster: "bandit_chief" },
    hint: "Varek's camp lies north-east of the city, among the tents between the north gate and the farm. Clear his guards first.",
    chapter: 5,
    main: true,
    title: "The bandit chief",
    level: 20,
    after: "aldric_brutes",
    intro:
      "Varek. He calls himself the Bandit Chief and wears a crossed-out crown. His camp is in the meadows north-east of the city: leave by the north gate and head towards the farm. Bring me his insignia and the King himself will hear of it.",
    progressText:
      "Varek's camp lies north-east of the city, among the tents between the north gate and the farm. He does not fight alone. Bring potions, and bring me his insignia.",
    completeText:
      "Varek is dead? Then Kingsvale is ours again. The Steward wants to see you in the castle. Go, before he changes his mind.",
    goal: { type: "kill", monster: "bandit_chief", count: 1 },
    reward: { exp: 2200, zeny: 3000, items: [{ id: "orange_potion", count: 8 }] },
  },
  corvin_audience: {
    giver: "Steward Corvin",
    final: true,
    hint: "Walk through the castle gate at the end of the main avenue and up to the keep. The King stands before its doors.",
    chapter: 5,
    main: true,
    title: "An audience with the King",
    level: 20,
    after: "aldric_varek",
    intro:
      "His Majesty has heard of the bandit chief's end. He wishes to see the one who did it. Walk up to the keep and present yourself. Bow. Do not touch anything.",
    progressText:
      "Walk through the castle gate at the end of the main avenue and up the steps of the keep. The King stands before the doors.",
    completeText:
      "The King was pleased. That does not happen often. The crown's gratitude, in coin, and you are welcome in Aurelia for as long as you live.",
    goal: { type: "reach", x: -153, z: 0, r: 4.5, label: "the King at the keep" },
    reward: {
      exp: 1200,
      zeny: 4000,
      items: [
        { id: "amulet_of_aurelia", count: 1 },
        { id: "orange_potion", count: 5 },
      ],
    },
  },

  /* ==== Saga II: The Shattered Runes ==== */
  /* ---- chapter 6: the seventh seal, Aurelia and the old altar, level 20 to 22 ---- */
  selwyn_summons: {
    giver: "Captain Aldric",
    turnIn: "Archmage Selwyn",
    hint: "Archmage Selwyn waits in the castle courtyard, beside the keep.",
    chapter: 6,
    main: true,
    title: "A summons from the tower",
    level: 20,
    after: "corvin_audience",
    intro:
      "Before you get comfortable: the court archmage has asked for you three times since the night the altar in Whisperwood burned violet. Selwyn does not ask three times for anyone. You will find him in the castle courtyard, by the keep.",
    progressText: "Archmage Selwyn waits in the castle courtyard, beside the keep.",
    completeText:
      "So you are the one who walked out of the crypt alive. Good. Sit. What I am about to tell you, the King has heard only half of.",
    goal: { type: "visit", npc: "Archmage Selwyn" },
    reward: { exp: 900, zeny: 300 },
  },
  selwyn_altar: {
    giver: "Archmage Selwyn",
    hint: "Go back to the old altar at the end of the Whisperwood path and tap it. The runes wake in the order of the moon, as the plaque in the crypt said.",
    chapter: 6,
    main: true,
    title: "What the altar remembers",
    level: 20,
    after: "selwyn_summons",
    intro:
      "That altar is no altar. It is a seal: the seventh of seven, set by the old mages to hold something they called the Hollow. When it cracked, your count woke. Go back, lay your hand on the stones and wake the runes in the order of the moon. If the seal still knows its makers, it will bind its rune to you.",
    progressText:
      "Tap the old altar at the end of the Whisperwood path. The runes wake in the order of the moon.",
    completeText:
      "You feel that? The cold behind your eyes, like moonlight on water. That is the Moon Rune, bound to you now. Call it when the blows come (Q) and it will take them for you.",
    goal: {
      type: "ritual",
      seal: "moon",
      x: 0,
      z: -103,
      r: 3,
      label: "the runes of the old altar",
    },
    reward: { exp: 1400, zeny: 500, rune: "moon" },
  },
  selwyn_chart: {
    giver: "Archmage Selwyn",
    where: { station: "enchanting_altar" },
    hint: "Arcane dust: break gear down at an enchanting altar, or take it from grave witches in the crypt.",
    chapter: 6,
    main: true,
    title: "The chart of seals",
    level: 21,
    after: "selwyn_altar",
    intro:
      "The old mages drew their seals on a sea chart, and the ink only shows under arcane light. Bring me five handfuls of arcane dust and I will make that light.",
    progressText:
      "Five arcane dust. An enchanting altar breaks gear down into it; the grave witches in the crypt carry it too.",
    completeText:
      "There. Seven marks. One here, under Whisperwood. One on an island of fire across the Grey Sea. The rest further still, in lands no chart of ours has a name for. And two of the marks are already pale. Cracking.",
    goal: { type: "item", item: "arcane_dust", count: 5 },
    reward: { exp: 1600, zeny: 600, items: [{ id: "orange_potion", count: 4 }] },
  },
  selwyn_papers: {
    giver: "Archmage Selwyn",
    turnIn: "Captain Aldric",
    hint: "Captain Aldric stands just inside the east gate of Aurelia.",
    chapter: 6,
    main: true,
    title: "Papers for the north",
    level: 22,
    after: "selwyn_chart",
    intro:
      "The island of fire first. No ship sails there from here: you need Saltmere, the great harbor at the end of the Northroad. Captain Aldric will write you papers for the road and a letter for the harbormaster. I will keep the chart safe until you are ready.",
    progressText:
      "Captain Aldric stands just inside the east gate. He will write your papers for the north.",
    completeText:
      "North, then. Papers for Fort Harrow, and a letter for Harbormaster Quill in Saltmere. The road is long and not kind. Watch the sky: travelers say the storms up there have teeth.",
    goal: { type: "visit", npc: "Captain Aldric" },
    reward: { exp: 1200, zeny: 800, items: [{ id: "travel_papers", count: 1 }] },
  },
  /* ---- chapter 7: the Northroad, from the north gate to the Halfway Inn, level 22 to 24 ---- */
  aldric_north_gate: {
    giver: "Captain Aldric",
    turnIn: "Sergeant Bren",
    hint: "Leave Aurelia by the north gate and follow the Northroad. Fort Harrow stands across the road; Sergeant Bren waits just inside its gate.",
    tutorial: "northroad",
    chapter: 7,
    main: true,
    title: "Through the north gate",
    level: 22,
    after: "selwyn_papers",
    intro:
      "The Northroad starts at our north gate and does not stop until the sea. First stop, Fort Harrow: it holds the road where the hills begin. Show Sergeant Bren your papers. He is a hard man, but a fair one.",
    progressText:
      "Out through the north gate and up the Northroad. Fort Harrow stands across the road; Sergeant Bren is just inside the gate.",
    completeText:
      "Papers from Aldric, and the seal of the archmage? Hm. Then you are either very important or very unlucky. Welcome to Harrow. We have a problem you could help with.",
    goal: { type: "visit", npc: "Sergeant Bren" },
    reward: { exp: 1800, zeny: 600 },
  },
  bren_highwaymen: {
    giver: "Sergeant Bren",
    where: { monster: "highwayman" },
    hint: "Highwaymen lie in wait along the road on both sides of Fort Harrow, mostly in the grey tunics. They come in twos and threes.",
    chapter: 7,
    main: true,
    title: "Toll of the Northroad",
    level: 22,
    after: "aldric_north_gate",
    intro:
      "Highwaymen. Since the storms began, every cart on the road loses half its load before it reaches me. My men cannot leave the gate. You can. Eight of them, and the rest will learn to farm.",
    progressText:
      "Eight highwaymen, in their grey tunics along the road on both sides of the fort. They hunt in small packs.",
    completeText:
      "Eight. The carters will kiss your boots, and so would I if I were not on duty. Here: the fort's own coin. The road north is yours.",
    goal: { type: "kill", monster: "highwayman", count: 8 },
    reward: { exp: 2400, zeny: 1200, items: [{ id: "orange_potion", count: 5 }] },
  },
  bren_inn: {
    giver: "Sergeant Bren",
    turnIn: "Innkeeper Hobb",
    hint: "Follow the Northroad north past the barley fields. The Halfway Inn stands on the west side of the road; Hobb keeps the door.",
    chapter: 7,
    main: true,
    title: "A bed for the night",
    level: 23,
    after: "bren_highwaymen",
    intro:
      "Halfway to Saltmere stands an inn, and Hobb keeps it. A roof, a fire, and the only stew between here and the sea. Sleep there: if the road knocks you down, you will wake up in one of Hobb's beds instead of a ditch.",
    progressText:
      "North past the barley fields. The Halfway Inn stands on the west side of the road; Hobb keeps the door.",
    completeText:
      "Bren sent you? Then you get the good bed. The one without the draught. If the road knocks you down from now on, you wake up here, with soup.",
    goal: { type: "visit", npc: "Innkeeper Hobb" },
    reward: { exp: 1600, zeny: 400, items: [{ id: "cooked_minnow", count: 5 }] },
  },
  hobb_storm_wolves: {
    giver: "Innkeeper Hobb",
    where: { monster: "storm_wolf" },
    hint: "Storm wolves roam the hills north of the inn. They hunt harder in a storm: fight them when the sky is clear.",
    chapter: 7,
    main: true,
    title: "Wolves in the storm",
    level: 24,
    after: "bren_inn",
    intro:
      "You hear them at night, when the thunder comes. Storm wolves: the fur crackles like the sky. They took two of my goats and the stablehand's nerve. Bring me six pelts and the road north is safe for travelers again.",
    progressText:
      "Six storm pelts. The wolves roam the hills north of the inn, and they hunt harder in a storm.",
    completeText:
      "Six. They really do crackle. The tanners in Saltmere will pay well for the rest of what you skin up there. Rest, eat, and when you are ready, the road goes on.",
    goal: { type: "item", item: "storm_pelt", count: 6 },
    reward: { exp: 2600, zeny: 1400, items: [{ id: "orange_potion", count: 5 }] },
  },
  hobb_pell: {
    giver: "Innkeeper Hobb",
    turnIn: "Hedge-wizard Pell",
    hint: "Follow the Northroad north from the inn. Pell's patched green tent stands on the west side of the road, with a view of the ruined tower across it.",
    chapter: 7,
    main: true,
    title: "The tower that hums",
    level: 24,
    after: "hobb_storm_wolves",
    intro:
      "There is a hedge-wizard camped up the road, Pell. Pays for his stew in remedies, mostly for warts. He came down last week white as milk, going on about the old tower at Northwatch humming like a hive. Goblins in it, too. Go and hear him out: you have the look of someone who deals with humming things.",
    progressText:
      "North from the inn along the road. Pell's green tent stands on the west side, across from the ruined tower.",
    completeText:
      "Hobb sent you? Good man, Hobb. Bad stew. Listen. Can you hear it? No? Then come closer to the ruin, and you will.",
    goal: { type: "visit", npc: "Hedge-wizard Pell" },
    reward: { exp: 900, zeny: 400 },
  },
  pell_tower: {
    giver: "Hedge-wizard Pell",
    where: { monster: "goblin_chief" },
    hint: "Northwatch is the ruined tower east of the road, across from Pell's camp. Skrag, the goblin chief, sits by the split runestone in the middle of the ruin.",
    chapter: 7,
    main: true,
    title: "The shiny stone",
    level: 24,
    after: "hobb_pell",
    intro:
      "That ruin was a watchtower of the old kings, and under it they set a runestone. Like your altar, I think: a seal, or a piece of one. It cracked when the storms began, and now it hums. The goblins found it. Their chief, Skrag, sits on it like a hen on an egg and chips bits off to wear. If he breaks it, I do not want to know what comes out. Take the shard from him.",
    progressText:
      "Skrag, the goblin chief, sits by the split runestone in the middle of Northwatch. He calls his goblins when he is hurt.",
    completeText:
      "The shard! It is warm, and it hums in my hand. A seal stone, cracking like the one in Whisperwood you told me of. Selwyn will want to hear about this; I will send a bird. Now, if you are going north: Carter Wil has been stuck at the gorge for a week. Something about a troll.",
    goal: { type: "kill", monster: "goblin_chief", count: 1 },
    reward: {
      exp: 2200,
      zeny: 1800,
      items: [{ id: "orange_potion", count: 5 }],
    },
  },
  pell_scavengers: {
    giver: "Hedge-wizard Pell",
    where: { monster: "goblin_scavenger" },
    hint: "The goblin scavengers keep watch around the ruin of Northwatch, east of the road. They throw spears: close in fast.",
    title: "Spears in the ruins",
    level: 24,
    after: "hobb_pell",
    intro:
      "Every time I go near the ruin, a spear comes flying. Little green ones with big arms. Ten of them fewer, and I might get close enough to take a proper look at that stone.",
    progressText:
      "Ten goblin scavengers around the ruin of Northwatch. They throw spears from a distance.",
    completeText:
      "Ten! Not a spear all afternoon. Here: a remedy for warts, and some coin. Mostly coin.",
    goal: { type: "kill", monster: "goblin_scavenger", count: 10 },
    reward: {
      exp: 1600,
      zeny: 1300,
      items: [{ id: "orange_potion", count: 3 }],
    },
  },
  wil_bridge: {
    giver: "Carter Wil",
    where: { monster: "grumm" },
    hint: "Carter Wil waits with his cart just south of Greyfall Gorge. Grumm the troll sits on the Old King's Bridge: when he smashes the planks, step off the red stretch.",
    chapter: 7,
    main: true,
    title: "The Old King's Bridge",
    level: 25,
    after: "pell_tower",
    intro:
      "A week. A week I have sat here with a cart full of barley for Saltmere. There is a troll on the bridge. Grumm, he calls himself, and he wants a toll: everything. He smashes the planks under anyone who argues. Get him off that bridge, and I will tell every tavern from here to the sea who did it.",
    progressText:
      "Grumm sits on the Old King's Bridge over Greyfall Gorge. When he raises his club, a stretch of the bridge turns red: step off it before the planks break. Low on health, he throws boulders.",
    completeText:
      "He is down? Gone into the gorge? Ha! Listen to that: no more roaring. The road to Saltmere is open again. I owe you a ride, a meal and a song, in that order.",
    goal: { type: "kill", monster: "grumm", count: 1 },
    reward: {
      exp: 3400,
      zeny: 2600,
      items: [{ id: "orange_potion", count: 8 }],
    },
  },
  /* ---- Saga II, chapter 8: Saltmere ---- */
  wil_saltmere: {
    giver: "Carter Wil",
    turnIn: "Harbormaster Quill",
    hint: "Follow the Northroad over the bridge to the gate of Saltmere. Harbormaster Quill keeps the office on the west side of the harbor square.",
    chapter: 8,
    main: true,
    title: "The harbormaster's seal",
    level: 26,
    after: "wil_bridge",
    intro:
      "Saltmere is half a day north of the bridge, and now the bridge is open again. You carry a letter for the harbormaster, do you not? Quill. Sharp as a hook, and twice as hard to get off. Give him Aldric's seal and he will find you a ship.",
    progressText:
      "Over the bridge and north to Saltmere. Quill's office is on the west side of the harbor square.",
    completeText:
      "A letter from Captain Aldric, with the archmage's seal beside it. Well. A ship south-west, past the edge of the charts? Nobody sails there. I will ask around, but not tonight. Get a room: the Salty Gull, behind the square.",
    goal: { type: "visit", npc: "Harbormaster Quill" },
    reward: { exp: 1800, zeny: 800 },
  },
  quill_gull: {
    giver: "Harbormaster Quill",
    turnIn: "Innkeeper Marla",
    hint: "The Salty Gull stands in the west quarter, north-west of the gate. Marla keeps the door.",
    chapter: 8,
    main: true,
    title: "A room at the Salty Gull",
    level: 26,
    after: "wil_saltmere",
    intro:
      "Marla at the Salty Gull keeps a room for my guests. Tell her Quill sent you, and do not touch the fish soup.",
    progressText: "The Salty Gull stands in the west quarter of Saltmere. Marla keeps the door.",
    completeText:
      "Quill's guest? Then you get the room over the kitchen: warm, and only a little fishy. If you fall anywhere near the city, they will carry you back here. Sleep well.",
    goal: { type: "visit", npc: "Innkeeper Marla" },
    reward: { exp: 1200, zeny: 300, items: [{ id: "cooked_pike", count: 3 }] },
  },
  marla_thief: {
    giver: "Innkeeper Marla",
    turnIn: "Harbormaster Quill",
    hint: "Maelis waits by the door of the Salty Gull. Stay close behind him: he runs on whenever you catch up, and leaves runes on the ground that hold you. If you lose him, he goes back to where he started.",
    chapter: 8,
    main: true,
    title: "Thief in the night",
    level: 26,
    after: "quill_gull",
    intro:
      "Wake up! A man in a black coat came down your stairs with your satchel under his arm. The archmage's chart! He is still in the street, laughing at the door, as if he wants you to follow. Go!",
    progressText:
      "Chase Maelis through the streets of Saltmere. Keep up with him; step out of the runes he leaves behind.",
    completeText:
      "Maelis the Unbound. I know the name: a mage who wants the old seals broken. And he has your chart, and a boat. Only one captain in this harbor would follow a man like that to the edge of the map: Mara Holt, on the Gull's Promise, by the east pier.",
    goal: { type: "chase", label: "Maelis" },
    reward: { exp: 2600, zeny: 1200, items: [{ id: "orange_potion", count: 5 }] },
  },
  mara_ship: {
    giver: "Captain Mara Holt",
    where: { monster: "rune_construct" },
    hint: "Rune constructs guard Maelis' old warehouses in the east quarter and the mole to the lighthouse. Their shards fall when they break.",
    chapter: 8,
    main: true,
    title: "A captain with nothing to lose",
    level: 26,
    after: "marla_thief",
    intro:
      "You want to follow Maelis? Good. He sank my last ship with one of his stone things, and I have been waiting for someone mad enough. The Gull's Promise is ready but for one thing: a compass that can follow magic. Bring me eight shards of his constructs and my navigator will tune it to his trail.",
    progressText:
      "Eight rune shards from the constructs in the old warehouses and on the mole, east of the square.",
    completeText:
      "Eight. Feel them hum: they all point the same way, out over the grey sea. That is where he is going. We sail as soon as the tide turns. Say your goodbyes to the land.",
    goal: { type: "item", item: "rune_shard", count: 8 },
    reward: { exp: 3200, zeny: 2000, items: [{ id: "orange_potion", count: 6 }] },
  },
  /* ---- Saga II, chapter 9: across the Grey Sea ---- */
  mara_sail: {
    giver: "Captain Mara Holt",
    hint: "Click the Gull's Promise at the east pier to take the helm, and sail north across the Grey Sea to the smoking Ember Isles. The sea chart (M) shows the way.",
    tutorial: "sailing",
    chapter: 9,
    main: true,
    title: "Sea legs",
    level: 27,
    after: "mara_ship",
    intro:
      "The compass is tuned, the ship is ready, and I have a broken leg and a bad temper. So you take her out. Sail north, all the way to the Ember Isles, and look at that coast: black rock, smoke, and somewhere a cove where Maelis put in. Then bring her back to me in one piece.",
    progressText:
      "Take the helm of the Gull's Promise and sail north to the reefs of the Ember Isles, then bring her back to Saltmere. The sea chart (M) shows the islands.",
    completeText:
      "You brought her back! Not a scratch. Well: one scratch. Black reefs and smoke, you say, and no safe cove. Then we need someone who knows that coast. Leave that to me. Rest your sea legs.",
    goal: { type: "reach", x: -170, z: -975, r: 20, label: "the reefs of the Ember Isles" },
    reward: { exp: 3600, zeny: 2400, items: [{ id: "grand_potion", count: 3 }] },
  },
  /* ---- Saga II, chapter 10: the Ember Isles ---- */
  mara_landfall: {
    giver: "Captain Mara Holt",
    turnIn: "Scholar Edda",
    hint: "Take the helm of the Gull's Promise at the east pier and sail north to the Ember Isles. Cinder Cove opens in the middle of their south coast: come in slowly, alongside the jetty on the east side of the cove, and she moors.",
    chapter: 10,
    main: true,
    title: "Landfall",
    level: 30,
    after: "mara_sail",
    intro:
      "A gull came in this morning with a letter on its leg. A scholar, Edda, put in at the Ember Isles a week ago with old Tamsin's fishing boat. She has found a cove on the south coast, Cinder Cove, with a way in between the reefs, and she has a jetty and a camp. And she says Maelis landed there before her. Take my ship, find her cove and moor at her jetty. Gently.",
    progressText:
      "Sail the Gull's Promise north to Cinder Cove, in the middle of the Ember Isles' south coast. Bring her in slowly beside the jetty, then find Scholar Edda in the camp.",
    completeText:
      "You came! And with the Gull's Promise, no less. Welcome to Cinder Cove: two tents, one fire, and more ash than I thought the world could hold. The fire seal is inside that mountain, I am sure of it, and Maelis went up there three days ago. Sleep by the fire tonight. If the isles knock you down, Tamsin and I will carry you back to it.",
    goal: { type: "visit", npc: "Scholar Edda" },
    reward: { exp: 4200, zeny: 2800, items: [{ id: "grand_potion", count: 4 }] },
  },
  edda_slag: {
    giver: "Scholar Edda",
    where: { monster: "magma_slime" },
    hint: "The Ash Flats lie south-west of the camp, along the road. The magma slimes leave burning ash where they crawl: do not stand in it.",
    chapter: 10,
    main: true,
    title: "Slag and cinders",
    level: 30,
    after: "mara_landfall",
    intro:
      "Before anyone goes near that mountain, I need to know how the old mages sealed it. They kept a watch on the west coast, the Fallen Watch. But the Ash Flats lie between us and it, and the slimes in them burn everything they touch. Clear a way through: eight of them.",
    progressText:
      "Eight magma slimes on the Ash Flats, south-west of the camp. Step out of the burning ash they leave behind.",
    completeText:
      "Eight! The road to the west is open, and Tamsin can stop pretending he was not afraid. Now: the Fallen Watch.",
    goal: { type: "kill", monster: "magma_slime", count: 8 },
    reward: { exp: 4800, zeny: 3000, items: [{ id: "grand_potion", count: 4 }] },
  },
  edda_watch: {
    giver: "Scholar Edda",
    hint: "Follow the road from the Ash Flats north to the ruins on the west coast. The standing stones there are carved.",
    chapter: 10,
    main: true,
    title: "The Fallen Watch",
    level: 30,
    after: "edda_slag",
    intro:
      "The old mages watched the mountain from a tower on the west coast. It fell long ago, but they carved their words in stone, and stone remembers. Go and read what the standing stones say, and come back and tell me every word.",
    progressText:
      "Find the ruins of the Fallen Watch on the west coast, north of the Ash Flats, and read the ring of standing stones.",
    completeText:
      "'The flame sleeps under the mountain. Its door opens to hearts of stone, given back to the stone.' Hearts of stone! The golems on the Obsidian Steps: their cores are the keys. Of course they are.",
    goal: {
      type: "reach",
      x: EMBER_LANDS.fallenWatch.center[0],
      z: EMBER_LANDS.fallenWatch.center[1] - 2,
      r: 7,
      label: "the standing stones of the Fallen Watch",
    },
    reward: { exp: 4200, zeny: 2600 },
  },
  edda_imps: {
    giver: "Scholar Edda",
    where: { monster: "fire_imp" },
    hint: "Scorchwood is the burnt forest south-east of the camp. The fire imps throw fire from a distance: close in on them fast.",
    chapter: 10,
    main: true,
    title: "Sparks in Scorchwood",
    level: 31,
    after: "edda_watch",
    intro:
      "The road to the Obsidian Steps runs through Scorchwood, and the imps there set fire to anything that walks under their trees. Maelis' tracks went that way too, three days ago, and nothing came back. Ten imps, and the road is ours.",
    progressText: "Ten fire imps in Scorchwood, the burnt forest south-east of the camp.",
    completeText:
      "The smoke over Scorchwood is thinning already. You smell of burnt hair, if you do not mind my saying so.",
    goal: { type: "kill", monster: "fire_imp", count: 10 },
    reward: { exp: 5400, zeny: 3200, items: [{ id: "grand_potion", count: 4 }] },
  },
  edda_cores: {
    giver: "Scholar Edda",
    where: { monster: "ash_golem" },
    hint: "The Obsidian Steps lie east of the mountain, beyond Scorchwood: cross the crusted lava where the road meets the river. The golems are slow and very hard.",
    chapter: 10,
    main: true,
    title: "Hearts of stone",
    level: 32,
    after: "edda_imps",
    intro:
      "Hearts of stone, given back to the stone. The ash golems on the Obsidian Steps each carry a core of living fire. Bring me four, and we will see whether the Gate of Kharos remembers its keys.",
    progressText:
      "Four golem cores from the ash golems on the Obsidian Steps, east of Mount Kharos.",
    completeText:
      "Four! They are still warm. Feel them pull, all towards the mountain's north side. That is where the gate must be.",
    goal: { type: "item", item: "golem_core", count: 4 },
    reward: { exp: 6200, zeny: 3800, items: [{ id: "grand_potion", count: 5 }] },
  },
  edda_gate: {
    giver: "Scholar Edda",
    hint: "The roads from the Fallen Watch and from the Obsidian Steps both lead round Mount Kharos to its north side. The gate is cut into the mountain's foot there.",
    chapter: 10,
    main: true,
    title: "The Gate of Kharos",
    level: 33,
    after: "edda_cores",
    intro:
      "Take the cores round the mountain to its north side, where the old mages cut their gate. Give them back to the stone, and let us see what it does. I will be right behind you. Well. Some way behind you.",
    progressText:
      "Go round Mount Kharos to the Gate of Kharos on its north side, and give the golem cores back to the stone.",
    completeText:
      "The runes drank the fire of the cores, and the door ground open a hand's breadth. Heat came out, and a sound like hammering, far below. The Forge of the First Flame is awake. And so, I think, is someone inside it.",
    goal: {
      type: "reach",
      x: EMBER_LANDS.gate.center[0],
      z: EMBER_LANDS.gate.center[1] - 1,
      r: 6,
      label: "the Gate of Kharos",
    },
    reward: { exp: 6000, zeny: 4000, items: [{ id: "grand_potion", count: 5 }] },
  },
  /* ---- chapter 11: the Forge of the First Flame, inside Mount Kharos, level 33 to 35 ---- */
  edda_forge: {
    giver: "Scholar Edda",
    turnIn: "Smith-Mage Orven",
    hint: "Walk to the Gate of Kharos on the mountain's north side and click the door to go in. Follow the Lava Run north to the passage before the sealed gate.",
    chapter: 11,
    main: true,
    title: "Into the mountain",
    level: 33,
    after: "edda_gate",
    intro:
      "Someone is hammering in there. Someone, or something. The old books speak of a smith-mage who would not leave his forge when the others sealed the mountain. That was three hundred years ago. Go in, and find out who keeps the fire.",
    progressText:
      "Go through the Gate of Kharos and follow the Lava Run north. Whoever is hammering is somewhere in the forge.",
    completeText:
      "A visitor. After three hundred years, a visitor, and they come with a sword in hand. Well. Sit, if you can stand the heat. I am Orven, and this was my forge.",
    goal: { type: "visit", npc: "Smith-Mage Orven" },
    reward: { exp: 3200, zeny: 1800 },
  },
  orven_bellows: {
    giver: "Smith-Mage Orven",
    where: { monster: "forge_imp" },
    hint: "The Hall of Bellows lies east of the Lava Run. Stand on each of its three stone plates for a moment. The imps there will not make it easy.",
    chapter: 11,
    main: true,
    title: "Breath for the forge",
    level: 33,
    after: "edda_forge",
    intro:
      "The First Forge went cold the night a boy in a grey cloak came through here. Pale, quick, with eyes like a frozen lake. He took something, and the imps came in behind him. The forge cannot burn without breath. East of the Lava Run stand the great bellows: three plates on the floor work them. Step on all three.",
    progressText:
      "In the Hall of Bellows, east of the Lava Run, stand on all three plates until the bellows heave.",
    completeText:
      "There! You hear her drawing breath? Now the forge itself. I am too old to lift the bar, and too dead, some days.",
    goal: {
      type: "ritual",
      seal: "bellows",
      x: BELLOWS_HALL[0],
      z: BELLOWS_HALL[1],
      r: 14,
      label: "the three bellows plates",
    },
    reward: { exp: 6800, zeny: 4200, items: [{ id: "grand_potion", count: 5 }] },
  },
  orven_forge: {
    giver: "Smith-Mage Orven",
    where: { monster: "forge_golem" },
    hint: "The First Forge stands against the north wall of the hall west of the Lava Run. Click the great hearth to light it. The golems that guard it are slow, but they hit hard.",
    chapter: 11,
    main: true,
    title: "The First Flame",
    level: 34,
    after: "orven_bellows",
    intro:
      "West of the Lava Run is the First Forge. Where the old mages forged the seals, and where the gate to the Heart of Kharos takes its fire from. Light her, and the gate will rise. The golems we made to tend her have forgotten who made them. Remind them.",
    progressText: "Light the great hearth of the First Forge, in the hall west of the Lava Run.",
    completeText:
      "The gate is open. Listen to her roar! I have not heard that sound in three hundred years. And now, the Heart. Be ready: something waits there that I am sorry I made.",
    goal: {
      type: "ritual",
      seal: "forge",
      x: GREAT_FORGE[0],
      z: GREAT_FORGE[1],
      r: 6,
      label: "the First Forge",
    },
    reward: { exp: 7600, zeny: 4800, items: [{ id: "grand_potion", count: 5 }] },
  },
  orven_warden: {
    giver: "Smith-Mage Orven",
    where: { monster: "ember_warden" },
    hint: "The Ember Warden waits in the Heart of Kharos, past the gate. Hide behind the pillars from its blast; step out of the burning circles; the slimes it calls burn too.",
    chapter: 11,
    main: true,
    title: "The Ember Warden",
    level: 35,
    after: "orven_forge",
    intro:
      "We made the Warden to guard the fire seal against anyone who would take it. It was the best thing we ever made. When the boy came, it let him pass, as if it knew him, and since then it has let nobody near. Its breath runs in a straight line: put stone between you and it.",
    progressText:
      "Defeat the Ember Warden in the Heart of Kharos. Hide behind the pillars from its blast.",
    completeText:
      "It is cold. After all this time. Thank you, and forgive me for asking it of you. Now the seal. Go and see what he left of it.",
    goal: { type: "kill", monster: "ember_warden", count: 1 },
    reward: { exp: 12000, zeny: 9000, items: [{ id: "grand_potion", count: 8 }] },
  },
  orven_seal: {
    giver: "Smith-Mage Orven",
    hint: "The fire seal stands at the north end of the Heart of Kharos: an altar between four stones carved with flames. Click the altar.",
    chapter: 11,
    main: true,
    title: "The fire seal",
    level: 35,
    after: "orven_warden",
    intro:
      "Lay your hand on the seal, at the far end of the Heart. If the fire in it still knows the hands that made it, it will bind its rune to you, as the moon did at your altar. And then we will know what the boy took.",
    progressText: "Click the altar of the fire seal at the north end of the Heart of Kharos.",
    completeText:
      "The Ember Rune, bound to you. Feel it? Breathe out (Q), and the First Flame breathes with you. But the seal is hollow. The heart of the fire is gone. He took it. Your Maelis took the First Flame.",
    goal: {
      type: "ritual",
      seal: "ember",
      x: FIRE_SEAL[0],
      z: FIRE_SEAL[1],
      r: 4,
      label: "the fire seal",
    },
    reward: {
      exp: 9000,
      zeny: 5000,
      rune: "ember",
      items: [{ id: "grand_potion", count: 5 }],
    },
  },
  orven_edda: {
    giver: "Smith-Mage Orven",
    turnIn: "Scholar Edda",
    hint: "Leave the forge by the stairs in the Gate Hall, and go back round the mountain to the camp in Cinder Cove.",
    chapter: 11,
    main: true,
    title: "What the boy took",
    level: 35,
    after: "orven_seal",
    intro:
      "Go back to your scholar. Tell her the moon seal and the fire seal hold, and that five more still stand somewhere in the world. Tell her what the boy carries. If he can steal fire from a seal, he is not stealing for himself.",
    progressText: "Go back to Scholar Edda in the camp at Cinder Cove.",
    completeText:
      "The First Flame. Gone with him. Then he was never fleeing from us: he was racing us, seal by seal. Two runes are yours, and five seals remain. Rest tonight. Tomorrow we find out where the third one lies.",
    goal: { type: "visit", npc: "Scholar Edda" },
    reward: { exp: 8000, zeny: 6000, items: [{ id: "obsidian_ring", count: 1 }] },
  },
  /* ---- Saga II, chapter 12: the Grey Sea rises (Tidecrown, rules/tidecrown.js) ---- */
  edda_rising: {
    giver: "Scholar Edda",
    hint: "Take the Gull's Promise from the jetty in Cinder Cove and sail north-east, to the island that was not there before. Moor in the golden circle by its pier on the south coast; someone waits in the camp above the beach.",
    chapter: 12,
    main: true,
    title: "An island out of the sea",
    level: 35,
    after: "orven_edda",
    intro:
      "Tamsin came back from his nets as white as a sail. North-east of here, where there was only water, there is an island. It rose the night we lost the First Flame, and the sea round it has not stopped boiling since. Maelis is racing us, seal by seal: if there is a seal on that island, he is on his way. Go. Go now.",
    progressText:
      "Sail the Gull's Promise to Tidecrown, north-east of the Ember Isles. Moor at its pier and find whoever waits in the camp.",
    completeText:
      "A living face! Forgive me for staring. I am Ondine. I kept the tide seal on this island before the sea took it, and I have kept it ever since, after a fashion. Welcome to Tidecrown.",
    goal: { type: "visit", npc: "Tide-Keeper Ondine" },
    reward: { exp: 6000, zeny: 3000, items: [{ id: "grand_potion", count: 3 }] },
  },
  ondine_drowned: {
    giver: "Tide-Keeper Ondine",
    where: { monster: "drowned_sailor" },
    hint: "The Drowned Sailors walk the ring of land between the coast and the crown of rocks round the lake.",
    chapter: 12,
    main: true,
    title: "The drowned crew",
    level: 35,
    after: "edda_rising",
    intro:
      "Every ship the Leviathan ever took: their crews never left it. They walk the shore now, between the coast and the crown, and they do not know they are dead. Lay eight of them to rest, and the way to the lake is open.",
    progressText: "Lay eight Drowned Sailors to rest on the ring of land round the Crownmere.",
    completeText:
      "Thank you. Some of them had names I still remember. I will say them tonight, to the lake.",
    goal: { type: "kill", monster: "drowned_sailor", count: 8 },
    reward: { exp: 8000, zeny: 4200, items: [{ id: "grand_potion", count: 3 }] },
  },
  ondine_oozes: {
    giver: "Tide-Keeper Ondine",
    where: { monster: "tide_ooze" },
    hint: "Tide Oozes creep about the ring of land. They spit brine from a distance: close in on them.",
    chapter: 12,
    main: true,
    title: "Brine and bile",
    level: 36,
    after: "ondine_drowned",
    intro:
      "The lake spits up oozes of brine when it is angry, and it has been very angry since the island rose. They spit salt that burns like fire. Six of them, and the Leviathan will have to come up for its supper itself.",
    progressText: "Destroy six Tide Oozes on Tidecrown.",
    completeText: "Good. Now it is hungry. Hungry things come up.",
    goal: { type: "kill", monster: "tide_ooze", count: 6 },
    reward: { exp: 8000, zeny: 4200, items: [{ id: "grand_potion", count: 3 }] },
  },
  ondine_leviathan: {
    giver: "Tide-Keeper Ondine",
    where: { monster: "grey_leviathan" },
    hint: "Walk up through the crown of rocks to the Crownmere's shore. The Leviathan comes up beside you and sinks again: strike while its head is up. Step out of the red lanes where its tentacles come down and the circles where geysers burst; from half health its waves roll over the shore, and a rock of the crown breaks them.",
    chapter: 12,
    main: true,
    title: "The Grey Leviathan",
    level: 36,
    after: "ondine_oozes",
    intro:
      "The tide seal's guardian. We made it gentle, once: it carried children across the lake on its back. Then the sea took the island, and it grew in the dark, and the boy's fire woke it angry. It will let nobody near the seal. I am sorry. Kill it.",
    progressText:
      "Defeat the Grey Leviathan in the Crownmere. Hit it while its head is up; hide behind the crown's rocks from its waves.",
    completeText: "It is gone. The lake is so still. Thank you, and forgive me for being glad.",
    goal: { type: "kill", monster: "grey_leviathan", count: 1 },
    reward: { exp: 14000, zeny: 10000, items: [{ id: "grand_potion", count: 8 }] },
  },
  ondine_seal: {
    giver: "Tide-Keeper Ondine",
    hint: "Walk out along the causeway from the south shore of the Crownmere to the islet in its middle, and click the altar of the tide seal.",
    chapter: 12,
    main: true,
    title: "The tide seal",
    level: 36,
    after: "ondine_leviathan",
    intro:
      "Walk the causeway to the islet and lay your hand on the altar. If the tide still knows the hands that made its seal, it will bind its rune to you. And then we will see what the boy wanted here.",
    progressText: "Walk out along the causeway and click the altar of the tide seal.",
    completeText:
      "Maelis. Standing on the water like a saint in a window, with the heart of my seal in his hand. No, do not explain: you could not have stopped him, and he knew it. But the seal knew you. The Tide Rune is yours: call it (Q), and the lake pulls with you.",
    goal: {
      type: "ritual",
      seal: "tide",
      x: TIDE_SEAL[0],
      z: TIDE_SEAL[1],
      r: 4,
      label: "the tide seal",
    },
    reward: {
      exp: 10000,
      zeny: 6000,
      rune: "tide",
      items: [{ id: "grand_potion", count: 5 }],
    },
  },
  ondine_selwyn: {
    giver: "Tide-Keeper Ondine",
    turnIn: "Archmage Selwyn",
    final: true,
    ending: "saga2_end",
    hint: "Sail back to Saltmere and take the Northroad south to Aurelia. Archmage Selwyn waits by the keep in the castle courtyard.",
    chapter: 12,
    main: true,
    title: "What the seals were fed",
    level: 36,
    after: "ondine_seal",
    intro:
      "He told you to ask your archmage what the old mages fed the seals. I can tell you what I fed mine: nothing. It was fed long before me. Go home, hero, and ask him. Then come back one day and tell an old ghost what he said.",
    progressText: "Go back to Archmage Selwyn in the castle courtyard of Aurelia.",
    completeText:
      "Fed them? ... Stand. You will not want to be sitting for this. The seals were never walls. They are mouths: each one feeds the Hollow a little of the land it sits in. Moonlight, fire, the tide. Just enough to keep it asleep. Maelis is not breaking our cage. He is starving what is inside it. And if he is right that it wakes anyway... The King must hear all of it. Tonight. You did well. Take this: the King meant you to have it the day you brought the Moon Rune home, and I kept forgetting.",
    goal: { type: "visit", npc: "Archmage Selwyn" },
    reward: { exp: 12000, zeny: 8000, items: [{ id: "runebearer_mantle", count: 1 }] },
  },
  /* ---- Saga III, chapter 13: ice that does not melt. Nothing changes in the lands the hero already knows (other
     heroes are elsewhere in the story): the north comes south only as a ship, her skipper and a shard of ice. ---- */
  selwyn_eyvind: {
    giver: "Archmage Selwyn",
    turnIn: "Skipper Eyvind",
    hint: "Take the Northroad north to Saltmere. The ship from the north lies white with frost between the west and the middle pier; her skipper waits on the west pier.",
    chapter: 13,
    main: true,
    title: "A ship from the north",
    level: 37,
    after: "ondine_selwyn",
    intro:
      "The King will call his council, and he wants you at it. But first, this came by gull from Harbormaster Quill: a ship has put in at Saltmere from the far north, from a place called Rimeholt. In the middle of summer there is rime on her rigging, and her skipper asks for the court mage. I cannot leave the King tonight. You go.",
    progressText: "Find Skipper Eyvind on the west pier of Saltmere, by the ship white with frost.",
    completeText:
      "The King's man? Good. Eyvind, of Rimeholt. We sailed nineteen days to get here, and the ice followed us the whole way. Look at her: frost on every rope, in summer. And look at my crew. Then you will understand why I did not wait for a better welcome.",
    goal: { type: "visit", npc: "Skipper Eyvind" },
    reward: { exp: 9000, zeny: 4000, items: [{ id: "grand_potion", count: 3 }] },
  },
  eyvind_crew: {
    giver: "Skipper Eyvind",
    where: { npc: "Chandler Bess" },
    hint: "Chandler Bess in Saltmere sells Pike stew, and Fisherman Tamsin in Cinder Cove too. A cook can make it from pike.",
    chapter: 13,
    main: true,
    title: "Frostbitten",
    level: 37,
    after: "selwyn_eyvind",
    intro:
      "My crew have had the cold in them since the floes. Not ordinary cold: it does not leave by the fire. Old Sigrun at home would say hot food first and questions after. Six pots of stew, as thick as you can find. Then I will show you what we pulled out of the ice.",
    progressText: "Bring Skipper Eyvind six Pike stews for his frozen crew.",
    completeText:
      "Listen to them: laughing, below decks. First time since the floes. You have a friend in Rimeholt now, southerner, whether Rimeholt likes it or not.",
    goal: { type: "item", item: "cooked_pike", count: 6 },
    reward: { exp: 10000, zeny: 4500, items: [{ id: "grand_potion", count: 3 }] },
  },
  eyvind_shard: {
    giver: "Skipper Eyvind",
    turnIn: "Archmage Selwyn",
    gives: [{ id: "everfrost_shard", count: 1 }],
    hint: "Take the Northroad south to Aurelia. Archmage Selwyn waits by the keep in the castle courtyard.",
    chapter: 13,
    main: true,
    title: "Ice that does not melt",
    level: 37,
    after: "eyvind_crew",
    intro:
      "This came up in our nets, three days out from home, where the floes were thickest. It burns your hand like a coal and it will not melt: not in the galley fire, not in the sun, not in my pocket. In Rimeholt they say the glacier is cracking, and things come out of the cracks. Take it to your court mage.",
    progressText:
      "Bring the Everfrost shard to Archmage Selwyn in the castle courtyard of Aurelia.",
    completeText:
      "Put it there. No, not on the chart! ... I held it in my brazier for an hour, and then I called up the Ember Rune in my mind and pressed it to the shard. Nothing. Fire that remembers the First Flame, and it does not even weep. This is not ice. It is a piece of a seal. The frost seal: one of the two marks on my chart that were pale before Maelis ever came. It is breaking, by itself. Come. The King must hear it from you.",
    goal: { type: "item", item: "everfrost_shard", count: 1 },
    reward: { exp: 10000, zeny: 5000, items: [{ id: "grand_potion", count: 3 }] },
  },
  selwyn_council: {
    giver: "Archmage Selwyn",
    turnIn: "King Aldemar",
    hint: "Walk up the steps of the keep in the castle courtyard. The King stands before its doors.",
    chapter: 13,
    main: true,
    title: "A seat at the table",
    level: 38,
    after: "eyvind_shard",
    intro:
      "The council sits now: the King, Captain Aldric, the Steward and I. They have heard me talk about mouths and seals all night and they are tired of me. They are not tired of you. Tell them what you saw on the lake, and what came south in Eyvind's nets.",
    progressText: "Speak to King Aldemar before the keep.",
    completeText:
      "So. The seals feed the thing beneath us, a stranger in black wants it starved, and now one seal breaks of its own accord. My father would have sent an army. I will send you. If the frost seal opens, its heart lies there for whoever reaches it first. Let that be us, for once.",
    goal: { type: "visit", npc: "King Aldemar" },
    reward: { exp: 11000, zeny: 6000, items: [{ id: "grand_potion", count: 4 }] },
  },
  aldemar_north: {
    giver: "King Aldemar",
    turnIn: "Captain Mara Holt",
    where: { monster: "rune_construct" },
    hint: "Rune constructs still guard Maelis' old warehouses in Saltmere's east quarter and the mole to the lighthouse. Their shards fall when they break. Bring them to Captain Mara Holt at the east pier.",
    chapter: 13,
    main: true,
    title: "North, before the ice cracks",
    level: 38,
    after: "selwyn_council",
    intro:
      "Captain Holt has sailed for my crown before, and she will sail for it again: north, to this Rimeholt, past the floes. Her ship needs a bow that the ice cannot crack. The runecarvers of Saltmere can ward the wood, if they have the stone to do it with. Maelis left plenty of that in his warehouses. Go.",
    progressText:
      "Six rune shards for the warding of the Gull's Promise, from the constructs in Saltmere's east warehouses and on the mole. Bring them to Captain Mara Holt.",
    completeText:
      "Six shards, and Ysolde has already been at my bow with her chisels. Runes all along the stem, glowing blue: she swears the ice will slide off like water off a gull. Eyvind will lead the way, he knows the floes. As soon as the charts are ready, we sail north. Further north than anyone from Saltmere has ever been. Ha!",
    goal: { type: "item", item: "rune_shard", count: 6 },
    reward: { exp: 12000, zeny: 7000, items: [{ id: "grand_potion", count: 5 }] },
  },
  /* ---- Saga III, chapter 14: Rimeholt (rules/frostmarch.js) ---- */
  mara_floes: {
    giver: "Captain Mara Holt",
    turnIn: "Elder Sigrun",
    tutorial: "frostmarch",
    hint: "Click the Gull's Promise at the east pier to take the helm. Sail north past the Ember Isles and Tidecrown until the floes: a wide lane runs straight north between them to the frozen bay of Rimeholt. Moor in the golden circle by the jetty, then find Elder Sigrun by the fire before the longhouse.",
    chapter: 14,
    main: true,
    title: "Through the floes",
    level: 38,
    after: "aldemar_north",
    intro:
      "Eyvind stays here to mend his ship, but his mate took their longboat home last night to tell them we are coming. Eyvind says the floes start where the charts stop, and that there is a lane through them, straight north, if you hold your nerve. So you take her. I will be in my cabin with my leg up, listening to the ice scrape my new runes. Moor at the jetty and find their elder. Sigrun. He says she does not smile.",
    progressText:
      "Sail the Gull's Promise north through the floes to Rimeholt, moor at the jetty, and speak to Elder Sigrun by the fire.",
    completeText:
      "The King of the south sends a hero, and Eyvind's mate came ahead to say his skipper vouches for you with his whole crew. Very well. You may sleep by our fire. Whether Rimeholt trusts you is another matter: that, you will have to earn. Sit. Get warm. And do not touch the fish on the racks.",
    goal: { type: "visit", npc: "Elder Sigrun" },
    reward: { exp: 13000, zeny: 6000, items: [{ id: "grand_potion", count: 4 }] },
  },
  sigrun_trust: {
    giver: "Elder Sigrun",
    where: { npc: "Ice-fisher Olav" },
    hint: "Click a hole in the ice of the bay to fish there; any rod will do. Rimefish bite at all of them but the two by the jetty.",
    chapter: 14,
    main: true,
    title: "Southerners",
    level: 39,
    after: "mara_floes",
    intro:
      "In Rimeholt nobody eats who does not fish. The holes in the bay are open, the rimefish are under them, and Olav will laugh at you, which is how he says hello. Five rimefish, for the pot. Then we will talk about why you are really here.",
    progressText: "Catch five rimefish through the holes in the ice of the bay.",
    completeText:
      "Five. Small ones, but five. Tove, put them on. ... Now. Eyvind says your king wants the glacier's heart before a man in black takes it. Brann has something to say about that, and about the wolves. Listen to him.",
    goal: { type: "gather", item: "rimefish", count: 5 },
    reward: { exp: 14000, zeny: 6500, items: [{ id: "grand_potion", count: 4 }] },
  },
  brann_wolves: {
    giver: "Hunter Brann",
    where: { monster: "frost_wolf" },
    hint: "The frost wolves roam the snowfields east of Rimeholt, between the shore and the ridge. Take the trodden way east out of the village.",
    chapter: 14,
    main: true,
    title: "The sledge-masters",
    level: 39,
    after: "sigrun_trust",
    intro:
      "Without dogs there are no sledges, and without sledges nobody gets to the glacier, not you, not me, not your man in black. The frost wolves have taken four of our dogs this month. They never came this far down before. Ten of them, east of the village, and our dogs sleep again.",
    progressText: "Defeat ten frost wolves on the snowfields east of Rimeholt.",
    completeText:
      "Ten. You fight like somebody who has never been cold, and you are learning. Keep the pelts, Ragna will make you something that does not look southern. Now, about my brother.",
    goal: { type: "kill", monster: "frost_wolf", count: 10 },
    reward: { exp: 16000, zeny: 7500, items: [{ id: "grand_potion", count: 5 }] },
  },
  sigrun_hunters: {
    giver: "Elder Sigrun",
    where: { npc: "Elder Sigrun" },
    hint: "Follow the trodden way north from the fire, up through the pines, to the pass in the ridge. Look for tracks at the foot of the drift.",
    chapter: 14,
    main: true,
    title: "The hunting party",
    level: 40,
    after: "brann_wolves",
    intro:
      "Brann's brother took six hunters through the pass to the White Waste, eleven days ago. They should have been back in five. Then the snow came down and closed the pass behind them. Go up to the drift. Tell me what the snow says.",
    progressText:
      "Follow the way north to the snowed pass and look at the tracks at the foot of the drift. Then go back to Elder Sigrun.",
    completeText:
      "Boots. Our hunters' boots, going in, and none coming out. And over them, newer, many more: long strides, and threads of purple caught on the rocks. Purple. Eyvind's mate told me what your man in black calls his people. The Unbound. They went through before the snow, and my hunters went after them. When the wind turns, we dig. And you come with us.",
    goal: {
      type: "reach",
      x: PASS_FOOT[0],
      z: PASS_FOOT[1],
      r: 6,
      label: "the tracks at the snowed pass",
    },
    reward: { exp: 18000, zeny: 9000, items: [{ id: "grand_potion", count: 6 }] },
  },
  /* ---- Saga III, chapter 15: the White Waste (rules/frostmarch.js) ---- */
  brann_pass: {
    giver: "Hunter Brann",
    turnIn: "Hunter Torvald",
    tutorial: "white_waste",
    where: { npc: "Hunter Torvald" },
    hint: "Take the trodden way north from Rimeholt's fire, up through the dug-out pass. Torvald's shelter lies just beyond it, under an overhang of rock. Keep near the fires: the cold gets into you out in the Waste.",
    chapter: 15,
    main: true,
    title: "Whiteout",
    level: 40,
    after: "sigrun_hunters",
    intro:
      "The wind turned in the night and we dug till our hands bled. The pass is open. Smoke on the other side: a fire, under the rocks where my brother always camps. Somebody is alive. Go, before the next whiteout comes down. When the snow blows sideways, find a fire and stay at it.",
    progressText: "Go through the pass and find Hunter Torvald at his shelter in the White Waste.",
    completeText:
      "Brann sent a southerner? Then things are worse in Rimeholt than here. Sit. Five of us came back to this fire. The sixth, Ulf, went after the purple cloaks alone when the snow closed the pass. He thought he could follow them to wherever they were going.",
    goal: { type: "visit", npc: "Hunter Torvald" },
    reward: { exp: 17000, zeny: 8000, items: [{ id: "grand_potion", count: 4 }] },
  },
  torvald_ulf: {
    giver: "Hunter Torvald",
    where: { npc: "Hunter Torvald" },
    hint: "Ulf's snow den lies north-east of Stillwater, the frozen lake in the middle of the Waste. Go past the lake, keep to the fires, and look for a half-buried tent.",
    chapter: 15,
    main: true,
    title: "The sixth hunter",
    level: 40,
    after: "brann_pass",
    intro:
      "Ulf dug in north-east of Stillwater, I am sure of it: that is where he always waits out a storm. Go and look. If he is there, bring him back. If he is not, read the snow for me.",
    progressText: "Find Ulf's snow den north-east of Stillwater, then go back to Hunter Torvald.",
    completeText:
      "Empty, and his spear left behind. Ulf would never leave his spear. Boots all round it: many, heavy, in a ring. They took him. Purple threads on the tent flap. ... The Unbound are camped up by the glacier, digging. If he is alive, he is there.",
    goal: { type: "reach", x: KARI_HOLLOW[0], z: KARI_HOLLOW[1], r: 4, label: "Ulf's snow den" },
    reward: { exp: 18000, zeny: 8500, items: [{ id: "grand_potion", count: 4 }] },
  },
  torvald_cultists: {
    giver: "Hunter Torvald",
    where: { monster: "unbound_cultist" },
    hint: "The Unbound camp lies north-east, past Stillwater, at the head of the trench they dig to the glacier. Their purple braziers burn warm: the cold cannot touch you beside them.",
    chapter: 15,
    main: true,
    title: "Purple in the snow",
    level: 41,
    after: "torvald_ulf",
    intro:
      "Hunters do not make war. But they took one of us. Eight of the purple cloaks, and the rest will think twice before they come down to the shore. Watch their hands: they throw something that burns cold.",
    progressText: "Defeat eight Unbound Cultists round their camp by the glacier.",
    completeText:
      "Eight. And you found this on one of them? A map. Their trench, the glacier, and a mark in the ice: a door. And here, west, by the rocks: the trolls' hollow, with a sum of gold written beside it. They are paying the trolls to keep the road. And Ulf's spear is marked on it, as a trophy. He is dead, then. ... Go on. I will tell Brann.",
    goal: { type: "kill", monster: "unbound_cultist", count: 8 },
    reward: { exp: 20000, zeny: 9500, items: [{ id: "grand_potion", count: 5 }] },
  },
  torvald_gold: {
    giver: "Hunter Torvald",
    where: { monster: "ice_troll" },
    hint: "The Troll Hollow lies west of the shelter: a ring of dark rock, open to the east. The trolls carry the Unbound's gold. In a whiteout they come out of the snow from further off.",
    chapter: 15,
    main: true,
    title: "Paid in gold",
    level: 41,
    after: "torvald_cultists",
    intro:
      "Trolls do not want gold. Trolls want meat, and to be left alone. If they guard a road for somebody, somebody frightened them first, and then paid them. Bring me their gold, six coins, and we will see whose face is on it.",
    progressText:
      "Bring Hunter Torvald six pieces of troll gold from the ice trolls of the Troll Hollow.",
    completeText:
      "No face. A crown, struck through. The same as on the bandits' badges in the south, Brann says. So it was him all along, your man in black, from the very first bandit on your road. ... Hrimgar, their chieftain, sits on the rest of it at the back of the hollow. As long as he lives, the trolls keep the road for the Unbound.",
    goal: { type: "item", item: "troll_gold", count: 6 },
    reward: { exp: 21000, zeny: 10000, items: [{ id: "grand_potion", count: 5 }] },
  },
  torvald_hrimgar: {
    giver: "Hunter Torvald",
    where: { monster: "hrimgar" },
    hint: "Hrimgar sits at the back of the Troll Hollow, on the Unbound's gold. Spikes of ice burst up where you stand: step out of the circles. Below half his health he tears blocks out of the ice and throws them, and he calls his trolls to him.",
    chapter: 15,
    main: true,
    title: "Hrimgar",
    level: 42,
    after: "torvald_gold",
    intro:
      "Hrimgar is old, and big, and he has never lost a fight. Every hunter in Rimeholt knows to walk around his hollow. You are not from Rimeholt. Go and end it, and the road to the glacier is ours before it is theirs.",
    progressText: "Defeat Hrimgar, chieftain of the ice trolls, at the back of the Troll Hollow.",
    completeText:
      "Hrimgar. Dead. ... I have lived my whole life afraid of that name. Here: the gold he sat on is yours, and the hollow is quiet. And now the road to the glacier is open, for us and for them. The Unbound have dug almost to their door in the ice. Whatever is behind it, you have to get there first.",
    goal: { type: "kill", monster: "hrimgar", count: 1 },
    reward: { exp: 26000, zeny: 14000, items: [{ id: "grand_potion", count: 8 }] },
  },
  /* ---- Saga III, chapter 16: the Glacier Halls (rules/glacier.js) ---- */
  torvald_glacier: {
    giver: "Hunter Torvald",
    turnIn: "Hunter Ulf",
    tutorial: "glacier_halls",
    hint: "Follow the Unbound's trench north from their camp to the glacier, and click the dig in the ice to go in.",
    chapter: 16,
    main: true,
    title: "Into the ice",
    level: 42,
    after: "torvald_hrimgar",
    intro:
      "The trolls are leaderless, the cultists are running back up their trench, and the hole they dug in the glacier stands open. Whatever they wanted in there, they have not reached it yet, or they would not still be digging. Go in. And if you find Ulf's body, bring me his knife. His mother will want it.",
    progressText:
      "Go into the Glacier Halls through the Unbound's dig at the head of their trench.",
    completeText:
      "Fire? No. A face. A Rimeholt face! ... I am Ulf. Yes, that Ulf. They dragged me in here to cut ice for them, and when they ran from your sword they left me tied to a crate. Give me a moment. I have not spoken to anyone who was not shouting in weeks.",
    goal: { type: "visit", npc: "Hunter Ulf" },
    reward: { exp: 22000, zeny: 10000, items: [{ id: "grand_potion", count: 5 }] },
  },
  ulf_doors: {
    giver: "Hunter Ulf",
    hint: "The door of ice stands across the passage north of the Ice Gate. Click the Ember Rune in the rune codex (U) to put it on Q, then face the door, close by, and call it.",
    chapter: 16,
    main: true,
    title: "Ice that remembers fire",
    level: 42,
    after: "torvald_glacier",
    intro:
      "The cultists hacked at that door for days. Axes, picks, their purple fire: nothing. Their leader said only the true fire would open it, the first fire, and that it had been stolen from them. You carry something warm, southerner. I can feel it from here. Try it on the door.",
    progressText: "Melt the door of ice north of the Ice Gate with the fire of your Ember Rune.",
    completeText:
      "It melted. Like butter on a stove. The cultists would weep to see it. Beyond is the Glass Hall: black ice over water, and things standing on it that are not statues.",
    goal: {
      type: "ritual",
      seal: "thaw",
      x: FROZEN_DOORS[0].x,
      z: FROZEN_DOORS[0].z + 1.5,
      label: "the door of ice",
      verb: ["Melt", "Melted"],
    },
    reward: { exp: 22000, zeny: 10000, items: [{ id: "grand_potion", count: 5 }] },
  },
  ulf_golems: {
    giver: "Hunter Ulf",
    where: { monster: "glacier_golem" },
    hint: "The Glacier Golems stand in the Glass Hall, north of the melted door. The Rime Oozes spit frost from a distance: close in on them.",
    chapter: 16,
    main: true,
    title: "The Glass Hall",
    level: 43,
    after: "ulf_doors",
    intro:
      "The golems woke up when the cultists started digging, and they have not gone back to sleep. They do not chase you out of the hall, but they will not let you through it either. Four of them. And mind the oozes: they spit.",
    progressText: "Destroy four Glacier Golems in the Glass Hall.",
    completeText:
      "The hall is quiet. I could hear the water under the ice just now, for the first time. West of it there is a room the cultists were afraid of. They called it the Hall of Faces.",
    goal: { type: "kill", monster: "glacier_golem", count: 4 },
    reward: { exp: 24000, zeny: 11000, items: [{ id: "grand_potion", count: 5 }] },
  },
  ulf_mirrors: {
    giver: "Hunter Ulf",
    hint: "The Mirror Hall lies west of the Glass Hall. Click the three mirrors of ice along its north wall, from the west one to the east one.",
    chapter: 16,
    main: true,
    title: "What the ice remembers",
    level: 43,
    after: "ulf_golems",
    intro:
      "Three mirrors of ice in there, taller than a man. The cultists' leader stood in front of them for hours, and came out white. He said the ice shows what it remembers. Go and look. Then tell me what an old hunter should be afraid of.",
    progressText: "Look into the three mirrors of the Mirror Hall, from west to east.",
    completeText:
      "A king who broke his own crown to put something to sleep. And one of his keepers walked north and knelt in the ice with her stone. ... The heart under the seal: that is her stone. That is what the man in black wants. And past the second door of ice, coiled round it, is the thing that keeps it.",
    goal: {
      type: "ritual",
      seal: "mirrors",
      x: MIRRORS[0][0],
      z: MIRRORS[0][1] + 1.5,
      label: "the three mirrors",
      verb: ["Look into", "Looked into"],
    },
    reward: { exp: 24000, zeny: 11000, items: [{ id: "grand_potion", count: 5 }] },
  },
  ulf_wyrm: {
    giver: "Hunter Ulf",
    where: { monster: "rime_wyrm" },
    hint: "Melt the second door of ice, at the north end of the Glass Hall, with your Ember Rune. The Rime Wyrm lies coiled before the frost seal. Step behind a pillar of ice when its breath comes; step out of the circles where icicles fall; below 40 % it burrows into the ice and breaks out beside you.",
    chapter: 16,
    main: true,
    title: "The Rime Wyrm",
    level: 44,
    after: "ulf_mirrors",
    intro:
      "The keeper's guardian. White, and long, and older than Rimeholt. When the cultists opened the first door it screamed, and three of them never came back. The man in black is coming for that heart, southerner. Be there first, and be the one still standing.",
    progressText:
      "Melt the second door of ice and defeat the Rime Wyrm in the Heart of the Glacier.",
    completeText:
      "It is dead? ... I felt it from here: the floor jumped, and every crystal in the Ice Gate went dark and came back. Then quiet. Go back to the seal when you are ready. The keeper's stone is still there, waiting for a hand. And I think the man in black heard that scream too.",
    goal: { type: "kill", monster: "rime_wyrm", count: 1 },
    reward: { exp: 30000, zeny: 16000, items: [{ id: "grand_potion", count: 8 }] },
  },
  /* ---- Saga III, chapter 17: the heart in the ice (rules/glacier.js) ---- */
  ulf_seal: {
    giver: "Hunter Ulf",
    hint: "Walk to the frost seal on its altar at the north end of the Heart of the Glacier, and click it.",
    chapter: 17,
    main: true,
    title: "The heart in the ice",
    level: 44,
    after: "ulf_wyrm",
    intro:
      "The keeper's stone is under that altar, and the seal is cracking, Selwyn's chart says so. Lay your hand on it. If the old seals know the hands that mend them, it will know yours. And southerner: whatever happens, do not let go.",
    progressText:
      "Wake the frost seal on its altar in the Heart of the Glacier, then go back to Hunter Ulf.",
    completeText:
      "I heard it, all the way out here: the ice breaking, and then a voice. A laugh. He is in there, isn't he? Behind the seal. He let the cultists dig, he let the Wyrm wait, and he let you open the last wall for him. Go, before he has his hand on that heart!",
    goal: {
      type: "ritual",
      seal: "frost",
      x: FROST_SEAL[0],
      z: FROST_SEAL[1] + 2,
      r: 4,
      label: "the frost seal",
    },
    reward: { exp: 26000, zeny: 12000, items: [{ id: "grand_potion", count: 6 }] },
  },
  ulf_maelis: {
    giver: "Hunter Ulf",
    where: { monster: "maelis" },
    hint: "Maelis waits in the Keeper's Vault, behind the broken wall at the back of the Heart. He steps through smoke behind you, lays runes under your feet (step out of the circles), and uses the hearts he stole: a lane of fire, and from 60 % a wave of the tide.",
    chapter: 17,
    main: true,
    title: "Maelis the Unbound",
    level: 45,
    after: "ulf_seal",
    intro:
      "The man in black. In the vault behind the seal, with his hand stretched out for the keeper's stone. You have chased him across the sea and back, southerner. This time he cannot sail away. Stop him.",
    progressText:
      "Defeat Maelis in the Keeper's Vault behind the frost seal, then go back to Hunter Ulf.",
    completeText:
      "He ran? Gone in his own smoke, bleeding, and without the stone! The first heart he never got. ... Feel that: the cold has gone soft. The seal knows you now, southerner. Its rune is yours. Now go home to Rimeholt. Sigrun will want to hear this from your own mouth, and so will every child in the village.",
    goal: { type: "kill", monster: "maelis", count: 1 },
    reward: {
      exp: 34000,
      zeny: 20000,
      rune: "frost",
      items: [{ id: "grand_potion", count: 8 }],
    },
  },
  sigrun_friend: {
    giver: "Hunter Ulf",
    turnIn: "Elder Sigrun",
    hint: "Go back through the dug-out pass to Rimeholt. Elder Sigrun waits by the fire before the longhouse.",
    chapter: 17,
    main: true,
    title: "A friend of Rimeholt",
    level: 45,
    after: "ulf_maelis",
    intro:
      "Torvald and I will bring the others home. Go ahead of us, and tell Sigrun her hunters are coming back, all six. All six! I will never tire of saying that.",
    progressText: "Go back to Elder Sigrun in Rimeholt.",
    completeText:
      "All six. ... Forgive an old woman. Come here. In Rimeholt we have a word for someone who brings our people home through the snow, and it is the same word as brother, and sister. You are that now. And a friend of Rimeholt does not walk: take one of Brann's sledge wolves. She has chosen you already, look at her.",
    goal: { type: "visit", npc: "Elder Sigrun" },
    reward: { exp: 18000, zeny: 10000, items: [{ id: "sledge_wolf", count: 1 }] },
  },
  sigrun_selwyn: {
    giver: "Elder Sigrun",
    turnIn: "Archmage Selwyn",
    final: true,
    ending: "saga3_end",
    hint: "Sail the Gull's Promise back to Saltmere and take the Northroad south to Aurelia. Archmage Selwyn waits by the keep in the castle courtyard.",
    chapter: 17,
    main: true,
    title: "The long winter ends",
    level: 45,
    after: "sigrun_friend",
    intro:
      "Your king and his mage must hear what you saw in the mirrors: a crown of seven stones, broken to put something to sleep. Go south, friend of Rimeholt, and tell them the north kept its stone. Then come back in summer. We have one, sometimes. For a day.",
    progressText: "Go back to Archmage Selwyn in the castle courtyard of Aurelia.",
    completeText:
      "The frost mark on my chart: look. It burned white last night and has been bright ever since. You did it. ... A crown of seven stones, and a king who broke it. Of course. Of course! The seals are not seven things, they are one. And the heart of it... no. Not yet. Look at this first: a letter from Pell, at Northwatch. His runestone has not stopped humming for three nights, and there are storms over the Northroad that do not move with the wind. The storm seal, hero. And this time Maelis knows the way.",
    goal: { type: "visit", npc: "Archmage Selwyn" },
    reward: { exp: 24000, zeny: 15000, items: [{ id: "grand_potion", count: 6 }] },
  },
  kari_bow: {
    giver: "Hunter Kari",
    hint: "Stillwater is the frozen lake in the middle of the Waste, north-east of the shelter. The bow lies out on its ice, a little east of the middle.",
    title: "Snowblind",
    level: 40,
    after: "brann_pass",
    intro:
      "When the whiteout came down on us I dropped my bow out on Stillwater, and I could not see my own hands to find it. It is still out there, under the snow. Will you look? I would go, but Torvald says I am not to leave this fire until I stop shaking.",
    progressText: "Find Kari's bow out on the ice of Stillwater, then bring it back to her.",
    completeText:
      "My bow! The string is frozen stiff, but it will thaw. Thank you, southerner. Here: hunters share what they have.",
    goal: {
      type: "reach",
      x: LOST_BOW[0],
      z: LOST_BOW[1],
      r: 2.5,
      label: "Kari's bow on Stillwater",
    },
    reward: { exp: 11000, zeny: 5000, items: [{ id: "grand_potion", count: 4 }] },
  },
  /* side quests in Rimeholt */
  ragna_pelts: {
    giver: "Furrier Ragna",
    where: { monster: "frost_wolf" },
    hint: "Frost wolves on the snowfields east of the village drop their pelts.",
    title: "Pelts for the cold",
    level: 39,
    after: "mara_floes",
    intro:
      "You came north in that? Bring me eight frost wolf pelts and I will make you a cloak that keeps the wind off the ice out. You will thank me on the glacier. Everybody does.",
    progressText: "Bring Furrier Ragna eight frost pelts.",
    completeText:
      "There. Wolf on the outside, sheep on the inside, and my stitches in between. Now you look like somebody who will live.",
    goal: { type: "item", item: "frost_pelt", count: 8 },
    reward: { exp: 9000, zeny: 2000, items: [{ id: "frostfur_cloak", count: 1 }] },
  },
  olav_slimes: {
    giver: "Ice-fisher Olav",
    where: { monster: "ice_slime" },
    hint: "The ice slimes creep over the shore west of Rimeholt. Take the trodden way west out of the village.",
    title: "Slime on the ice",
    level: 39,
    after: "mara_floes",
    intro:
      "Blue slimes, west along the shore. They creep out over the ice at night and freeze our holes shut from below. Eight of them, and I will teach you where the big rimefish sleep.",
    progressText: "Destroy eight ice slimes on the shore west of Rimeholt.",
    completeText:
      "Eight! The holes stay open now. Here: the big ones sleep under the jetty, where the ice is thin. Do not tell Tove.",
    goal: { type: "kill", monster: "ice_slime", count: 8 },
    reward: { exp: 12000, zeny: 5000, items: [{ id: "grand_potion", count: 4 }] },
  },
  tamsin_nets: {
    giver: "Fisherman Tamsin",
    where: { monster: "fire_imp" },
    hint: "The fire imps live in Scorchwood, south-east of the camp. Their horns drop when they fall.",
    title: "Nets in the fire",
    level: 30,
    after: "mara_landfall",
    intro:
      "The imps from that burnt wood came down to the beach last night and set fire to my nets. Laughing, they were. Bring me six of their horns: ground up and scattered on the sand, they keep the others away. So my grandmother said.",
    progressText: "Six imp horns from the fire imps of Scorchwood, south-east of the camp.",
    completeText:
      "Six! I will grind them tonight. If they come back, at least I will know my grandmother was wrong.",
    goal: { type: "item", item: "imp_horn", count: 6 },
    reward: { exp: 3600, zeny: 2400, items: [{ id: "grand_potion", count: 3 }] },
  },
  tobin_warehouses: {
    giver: "Warden Tobin",
    where: { monster: "rune_construct" },
    hint: "The rune constructs keep watch in the old warehouses east of the square and on the mole out to the lighthouse.",
    title: "Stone in the warehouses",
    level: 26,
    after: "marla_thief",
    intro:
      "Those stone things in the east warehouses: my watch cannot touch them, and the dockers will not go near. Ten of them broken, and Saltmere can unload its own ships again.",
    progressText: "Ten rune constructs in the old warehouses and on the mole.",
    completeText:
      "Ten! The dockers are already rolling barrels back in. The watch owes you, and so does the city.",
    goal: { type: "kill", monster: "rune_construct", count: 10 },
    reward: { exp: 2400, zeny: 1600, items: [{ id: "grand_potion", count: 2 }] },
  },
  netta_trout: {
    giver: "Fishwife Netta",
    hint: "Trout bite off the west quay and beside the middle pier. You need a fishing rod (fishing level 12).",
    title: "Fresh off the quay",
    level: 20,
    after: "wil_saltmere",
    intro:
      "My Hendrik is out with the boats, and the morning market wants trout. Five, fresh off the quay. You have the hands for a rod, I can tell.",
    progressText: "Five trout, caught off the west quay or beside the middle pier.",
    completeText: "Five, and still flapping! Here, for your trouble. And come back for soup.",
    goal: { type: "gather", item: "trout", count: 5 },
    reward: { exp: 1400, zeny: 700, items: [{ id: "cooked_pike", count: 3 }] },
  },
  tilda_boars: {
    giver: "Farmer Tilda",
    where: { monster: "ridge_boar" },
    hint: "Ridge boars root in the hills on both sides of the road north of the barley. They only fight back.",
    title: "Boars in the barley",
    level: 22,
    after: "aldric_north_gate",
    intro:
      "Grey boars, down from the ridge, every night in my barley. They do not even eat it: they just roll in it. Six of them, and I bake you a loaf you will remember.",
    progressText: "Six ridge boars. They root in the hills north of the barley fields.",
    completeText:
      "Six! My barley thanks you, and so do I. Here, still warm. And something for the road.",
    goal: { type: "kill", monster: "ridge_boar", count: 6 },
    reward: { exp: 2000, zeny: 900, items: [{ id: "cooked_minnow", count: 3 }] },
  },
  /* ---- side quests: the landmarks (rules/landmarks.js), one for every land ---- */
  sven_watchtower: {
    giver: "Guard Sven",
    title: "A light in the ruin",
    level: 5,
    hint: "Cross the fields to the west, past the last fence. The old tower stands alone among the trees.",
    intro:
      "See the old stones out west, past the farms? That was a watchtower once, when Runeveld still needed one. These last nights I have seen a light up there. Go and have a look for me. Carefully.",
    progressText:
      "West across the fields, past the last fence. The tower stands alone among the trees.",
    completeText:
      "Only rubble and crows? Then the light was some shepherd's fire, nothing more. Good. Here, for your boots.",
    goal: { type: "reach", x: WATCHTOWER[0], z: WATCHTOWER[1], r: 6, label: "the Old Watchtower" },
    reward: { exp: 260, zeny: 150, items: [{ id: "red_potion", count: 3 }] },
  },
  mette_fairy_ring: {
    giver: "Old Mette",
    title: "Where the fairies dance",
    level: 9,
    after: "mette_altar",
    hint: "In Whisperwood, west of the path a little before the old altar. Look for mushrooms that glow.",
    intro:
      "My grandmother swore there is a ring of mushrooms in Whisperwood that glows in the dark, west of the path before the altar. The fairies dance there, she said. I looked for it all my life and never found it. Will you look, with your young eyes?",
    progressText:
      "West of the forest path, a little before the old altar. A ring of mushrooms that glow.",
    completeText:
      "It is real? Glowing, in a ring... Oh, she would have laughed at me. Here, moonbloom. She always kept some, for luck.",
    goal: { type: "reach", x: FAIRY_RING[0], z: FAIRY_RING[1], r: 3, label: "the fairy ring" },
    reward: { exp: 500, zeny: 150, items: [{ id: "moonbloom", count: 3 }] },
  },
  abe_shrine: {
    giver: "Miller Abe",
    title: "A candle for the road",
    level: 16,
    hint: "South of the Kingsroad, east of the mill: a statue in a ring of standing stones.",
    intro:
      "On the road to Aurelia there is a shrine, in a ring of old stones a little south of the road. Travellers light a candle there for a safe journey. My legs will not carry me that far any more. Would you light one for me?",
    progressText: "South of the Kingsroad, east of my mill: a statue in a ring of standing stones.",
    completeText:
      "You lit it? Then the road will be kind to both of us. Take this, and do not argue with an old miller.",
    goal: { type: "reach", x: SHRINE[0], z: SHRINE[1], r: 4.5, label: "the Wayside Shrine" },
    reward: { exp: 900, zeny: 400, items: [{ id: "orange_potion", count: 3 }] },
  },
  wil_falls: {
    giver: "Carter Wil",
    title: "The roar in the gorge",
    level: 22,
    hint: "East of the Old King's Bridge, on the south rim of Greyfall Gorge: a wooden platform facing the falls.",
    intro:
      "Hear that roar, east of the bridge? A stream falls into the gorge there, all the way down. Somebody built a lookout on the rim to watch it. Go and see it. Then you will know why I take this road the long way round.",
    progressText:
      "East of the Old King's Bridge, on the south rim of the gorge: a wooden platform facing the falls.",
    completeText:
      "Something, is it not? The world is bigger than its monsters. Here, for the walk back.",
    goal: { type: "reach", x: LOOKOUT[0], z: LOOKOUT[1], r: 3.5, label: "the Falls Lookout" },
    reward: { exp: 1600, zeny: 500, items: [{ id: "grand_potion", count: 2 }] },
  },
};

export const QUEST_ORDER = Object.keys(QUESTS);

/* The main story, in order. */
export const MAIN_QUESTS = QUEST_ORDER.filter((id) => QUESTS[id].main);

/** The npc a quest is handed in to. */
export const turnInNpc = (id) => QUESTS[id].turnIn || QUESTS[id].giver;

/* goal types that count events as they happen */
const EVENT_GOALS = new Set(["buy", "gather", "craft", "disenchant", "refine"]);

/**
 * Count something the hero did for every active quest waiting for it: `kind` is the goal type ('buy', 'gather',
 * 'craft', 'disenchant', 'refine'), `item` what it was about. Returns true when a quest moved on.
 */
export function recordQuestEvent(quests, kind, item, amount = 1) {
  if (!EVENT_GOALS.has(kind) || !quests) {
    return false;
  }
  let changed = false;
  for (const [id, progress] of Object.entries(quests)) {
    const goal = QUESTS[id] && QUESTS[id].goal;
    if (!goal || !progress || progress.state !== "active" || goal.type !== kind) {
      continue;
    }
    if (goal.item && goal.item !== item) {
      continue;
    }
    const target = goal.count || 1;
    if ((progress.count || 0) < target) {
      progress.count = Math.min(target, (progress.count || 0) + Math.max(1, amount));
      changed = true;
    }
  }
  return changed;
}

/**
 * Saves from before the main story existed (or from before a step was added): every main quest before the one
 * the hero has reached counts as done, without rewards, so nobody is sent back to the first chapter. Returns true
 * when anything changed.
 */
export function catchUpMainStory(quests) {
  if (!quests) {
    return false;
  }
  let reached = -1;
  MAIN_QUESTS.forEach((id, index) => {
    if (quests[id]) {
      reached = index;
    }
  });
  let changed = false;
  for (let index = 0; index < reached; index++) {
    const id = MAIN_QUESTS[index];
    if (!quests[id] || quests[id].state !== "done") {
      quests[id] = { state: "done", count: QUESTS[id].goal.count || 1 };
      changed = true;
    }
  }
  return changed;
}

/**
 * Where the hero stands in the main story: the first main quest that is not done, with its state, or null when
 * the saga is finished.
 */
export function mainStoryStep(quests, level) {
  for (const id of MAIN_QUESTS) {
    const state = questState(id, quests, level);
    if (state !== "done") {
      return { id, state, quest: QUESTS[id] };
    }
  }
  return null;
}

/**
 * State of a quest for a hero: 'available' (can be accepted), 'locked' (requirements not met), 'active',
 * 'ready' (can be turned in) or 'done'.
 * @param {string} id quest id
 * @param {object} quests the hero's quest progress
 * @param {number} level the hero's base level
 */
export function questState(id, quests, level) {
  const quest = QUESTS[id];
  const progress = quests[id];
  if (progress) {
    if (progress.state === "done") {
      return "done";
    }
    return isQuestComplete(id, progress) ? "ready" : "active";
  }
  if (level < quest.level || (quest.after && quests[quest.after]?.state !== "done")) {
    return "locked";
  }
  return "available";
}

/** Has the goal of this (not yet turned in) quest been reached? */
export function isQuestComplete(id, progress) {
  const quest = QUESTS[id];
  return (
    !!progress && progress.state !== "done" && (progress.count || 0) >= (quest.goal.count || 1)
  );
}

/** Quest ids this npc gives or takes in, in quest order. */
export const questsFrom = (npcName) =>
  QUEST_ORDER.filter((id) => QUESTS[id].giver === npcName || turnInNpc(id) === npcName);

/**
 * Short progress text, e.g. "Rabbit 3/5" or "Fox tail 1/3".
 * monsterName and itemName turn an id into a display name.
 */
export function progressText(id, progress, monsterName, itemName) {
  const goal = QUESTS[id].goal;
  const count = Math.min(progress?.count || 0, goal.count || 1);
  if (goal.type === "kill") {
    return `${monsterName(goal.monster)} ${count}/${goal.count}`;
  }
  if (goal.type === "item") {
    return `${itemName(goal.item)} ${count}/${goal.count}`;
  }
  if (goal.type === "reach") {
    return count ? `Visited ${goal.label}` : `Go to ${goal.label}`;
  }
  if (goal.type === "ritual") {
    const [verb, done] = goal.verb || ["Wake", "Woke"];
    return count ? `${done} ${goal.label}` : `${verb} ${goal.label}`;
  }
  if (goal.type === "chase") {
    return count ? `Followed ${goal.label} to his boat` : `Chase ${goal.label}`;
  }
  if (goal.type === "gather") {
    return `${itemName(goal.item)} gathered ${count}/${goal.count}`;
  }
  if (goal.type === "craft") {
    return `${itemName(goal.item)} made ${count}/${goal.count}`;
  }
  if (goal.type === "buy") {
    return count ? `Bought a ${itemName(goal.item)}` : `Buy a ${itemName(goal.item)}`;
  }
  if (goal.type === "disenchant") {
    return `Items disenchanted ${count}/${goal.count || 1}`;
  }
  if (goal.type === "refine") {
    return `Items refined ${count}/${goal.count || 1}`;
  }
  if (goal.label) {
    return count ? `${goal.label}: done` : goal.label;
  }
  return count ? `Spoke to ${goal.npc}` : `Talk to ${goal.npc}`;
}
