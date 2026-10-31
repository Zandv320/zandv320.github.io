/* Eldoria – quest rules: the quests themselves and the pure checks on them.
   No DOM and no game state; a hero's progress is an object {[id]: {state: 'active'|'done', count}} that the
   server keeps just as well as the client.

   Saga I, "The Crossed-Out Crown", is the main story: the quests with `main: true`, in order, each one opening the
   next (`after`). The chapters are in CHAPTERS. The other quests are side quests; the main story never needs them,
   although a level gate can make them a good way to grow.

   goal.type: 'kill'        defeat `count` monsters of type `monster`
              'item'        hand in `count` of `item` (taken from the bag on turn-in)
              'visit'       talk to `npc`
              'reach'       come within `r` of (x, z); `label` describes the place in the tracker
              'equip'       wear something in `slot`                   } checked against the hero's state
              'stat'        raise any stat once                        } (syncStateQuests in progression.js)
              'skill'       learn any skill                            }
              'buy'         buy `item` from a shop                     } counted as it happens
              'gather'      gather `count` of `item`                   } (recordQuestEvent), so what the
              'craft'       make `count` of `item`                     } hero did before accepting does
              'disenchant'  break down `count` items at an altar       } not count
              'refine'      refine an item `count` times               }
   A reward item can differ per class: {id, count, mage: id-for-mages}. A quest can require a minimum level
   (`level`) and a preceding quest (`after`). Other fields:
     turnIn    the npc it is handed in to, when that is not the giver (a 'visit' quest ends at the npc visited)
     gives     items handed over when the quest is accepted (a tool, a badge)
     hint      how to do it, for the objective panel
     where     where the guide points: {monster} (the nearest one alive), {npc}, {station} (the nearest of that kind)
     ui        which panel the guide highlights: 'inventory' or 'character'
     tutorial  the guide card shown on accepting it (guide.js)
     final     the last quest of the saga */

export const SAGA = { title: "Saga I", name: "The Crossed-Out Crown" };

/* The chapters of Saga I, by number. */
export const CHAPTERS = {
  1: "A stranger in Runeveld",
  2: "Hands that work",
  3: "Teeth in the dark",
  4: "Whisperwood",
  5: "The Kingsroad",
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
      "The altar still hums, you say? Then the old enchanters' magic lives on. Enchanting starts with breaking: take something old you no longer need and break it down at an altar into arcane dust. Here is a pinch to start you off.",
    progressText:
      "At an enchanting altar, open the Disenchant tab and break down a piece of old gear.",
    completeText: "Dust, and a little glow in your fingers. Now let us put it to use.",
    hint: "Tap the old altar in Whisperwood (or the one by the temple in Aurelia), open Disenchant, pick an item you no longer need and confirm. You get arcane dust.",
    where: { station: "enchanting_altar" },
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
