/* Eldoria – quest rules: the quests themselves and the pure checks on them.
   No DOM and no game state; a hero's progress is an object {[id]: {state: 'active'|'done', count}} that the
   server keeps just as well as the client.

   goal.type: 'kill'   defeat `count` monsters of type `monster`
              'item'   hand in `count` of `item` (taken from the bag on turn-in)
              'visit'  talk to `npc`
              'reach'  come within `r` of (x, z); `label` describes the place in the tracker
   A reward item can differ per class: {id, count, mage: id-for-mages}.
   A quest can require a minimum level (`level`) and a preceding quest (`after`). */
export const QUESTS = {
  mette_welcome: {
    giver: "Old Mette",
    title: "A warm welcome",
    level: 1,
    intro:
      "New face! Nobody wanders out past the fence before they know the village. Go say hello to Merchant Bram at the red stall, and tell him Mette sent you.",
    progressText: "Bram is at the red stall by the square. Red, like his nose.",
    completeText:
      "He was kind to you? Good. He was not always. Here, take these for the road, and stay close to the gates at first.",
    goal: { type: "visit", npc: "Merchant Bram" },
    reward: { exp: 20, zeny: 30, items: [{ id: "red_potion", count: 2 }] },
  },
  rolf_rabbits: {
    giver: "Guard Rolf",
    title: "Rabbit trouble",
    level: 1,
    after: "mette_welcome",
    intro:
      "You look like you can hold a sword. The rabbits north of the gate are eating everything that grows. Thin them out for me: five should do.",
    progressText:
      "Five rabbits. They are just outside the north gate. Hit them before they hop off.",
    completeText:
      "Five fewer rabbits. The farmers will sleep better. Here is your pay, and something for the scratches.",
    goal: { type: "kill", monster: "rabbit", count: 5 },
    reward: { exp: 60, zeny: 80, items: [{ id: "red_potion", count: 3 }] },
  },
  teun_lucky_feet: {
    giver: "Fisher Teun",
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
    title: "A real fox",
    level: 2,
    after: "rolf_rabbits",
    intro:
      "I saw a fox and nobody believes me! If you bring me a fox tail I can show everyone. Please? I have ten zeny.",
    progressText: "A fox tail! The foxes live west of the village. Do not tell mum.",
    completeText: "A REAL fox tail! Here, you can have my ten zeny. All of it.",
    goal: { type: "item", item: "fox_tail", count: 1 },
    reward: { exp: 40, zeny: 10, items: [] },
  },
  sven_foxes: {
    giver: "Guard Sven",
    title: "Foxes at the south gate",
    level: 3,
    after: "rolf_rabbits",
    intro:
      "Rolf sent you? Then you will do. Foxes have been circling the south fields at night. Six of them should learn to keep their distance.",
    progressText: "Six foxes, south and west of the village. Watch out, they bite back.",
    completeText: "Six foxes. Quiet shift tonight, then. I like quiet shifts. Here.",
    goal: { type: "kill", monster: "fox", count: 6 },
    reward: { exp: 220, zeny: 180, items: [{ id: "red_potion", count: 3 }] },
  },
  lise_fox_tails: {
    giver: "Baker Lise",
    title: "Fox tails",
    level: 3,
    after: "rolf_rabbits",
    intro:
      "Foxes got into my flour again. I want three of their tails for my door. Let the others see what happens.",
    progressText: "Three fox tails. The foxes are west of the fence, past the trees.",
    completeText:
      "Three tails for my door. Perfect. This cap was my brother's, he will not miss it. And the bread is on the house.",
    goal: { type: "item", item: "fox_tail", count: 3 },
    reward: { exp: 150, zeny: 200, items: [{ id: "leather_cap", count: 1 }] },
  },
  jorn_boars: {
    giver: "Farmer Jorn",
    title: "Boars in the beets",
    level: 5,
    after: "rolf_rabbits",
    intro:
      "Boars. Big ones, east of the village, and they have found my beets. I cannot pay much, but I pay. Three boars.",
    progressText: "Three boars, east past the fields. Do not let them charge you.",
    completeText: "Three boars gone. My beets thank you. So do I. Here.",
    goal: { type: "kill", monster: "boar", count: 3 },
    reward: { exp: 300, zeny: 350, items: [{ id: "red_potion", count: 5 }] },
  },
  ragnar_hides: {
    giver: "Smith Ragnar",
    title: "Hides for the forge",
    level: 6,
    after: "jorn_boars",
    intro:
      "Jorn says you handle boars. Good. I need four boar hides for the bellows. Bring them and I will make it worth your while.",
    progressText: "Four boar hides. The boars are east of the village.",
    completeText:
      "Four good hides. A deal is a deal: this has been waiting for someone who deserves it.",
    goal: { type: "item", item: "boar_hide", count: 4 },
    reward: { exp: 400, zeny: 300, items: [{ id: "iron_helm", count: 1, mage: "starry_hat" }] },
  },
  /* ---- Whisperwood, level 8 to 15 ---- */
  mette_altar: {
    giver: "Old Mette",
    title: "The old altar",
    level: 8,
    after: "mette_welcome",
    intro:
      "When I was a girl we left bread at the old altar in Whisperwood, north past the gate. Nobody goes there any more. Go and see if it still stands. Follow the path and do not stray.",
    progressText:
      "North through the gate, then follow the path through the trees. The altar is on the stone circle at the end.",
    completeText:
      "It still stands? Then the forest remembers us. Thank you, child. Here, for your trouble.",
    goal: { type: "reach", x: 0, z: -103, r: 5, label: "the old altar" },
    reward: { exp: 300, zeny: 200, items: [{ id: "red_potion", count: 3 }] },
  },
  rolf_wolves: {
    giver: "Guard Rolf",
    title: "Howling in the north",
    level: 8,
    after: "sven_foxes",
    intro:
      "You hear that at night? Wolves, in Whisperwood. They are getting bolder. Six of them, and the rest will think twice.",
    progressText:
      "Six grey wolves. They hunt between the trees off the path, north of the gate. Watch your back.",
    completeText: "Six wolves. The howling is quieter already. Good work, and well paid.",
    goal: { type: "kill", monster: "wolf", count: 6 },
    reward: { exp: 600, zeny: 500, items: [{ id: "red_potion", count: 5 }] },
  },
  lise_warm_coat: {
    giver: "Baker Lise",
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
    title: "The dire boar",
    level: 13,
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
  /* ---- Kingsvale and Aurelia, level 15 to 24 ---- */
  rolf_road_west: {
    giver: "Guard Rolf",
    title: "The road west",
    level: 15,
    after: "rolf_wolves",
    intro:
      "The Kingsroad runs west from our gate to Aurelia, the capital. Captain Aldric at the east gate of the city asked for anyone who can fight. Go and report to him. Mind the road: bandits.",
    progressText:
      "Through the west gate and follow the Kingsroad until you see the walls of Aurelia. Captain Aldric stands just inside the east gate.",
    completeText:
      "You found him? Good. Aldric is a hard man, but fair. You will learn a lot in the city.",
    goal: { type: "visit", npc: "Captain Aldric" },
    reward: { exp: 900, zeny: 400, items: [{ id: "red_potion", count: 4 }] },
  },
  aldric_bandits: {
    giver: "Captain Aldric",
    title: "Bandits on the Kingsroad",
    level: 15,
    after: "rolf_road_west",
    intro:
      "Rolf sent you? Then you can swing a blade. Bandits have taken the meadows around the city and rob every cart on the Kingsroad. Eight of them, and the rest will think about a new trade.",
    progressText:
      "Eight bandits. They roam the meadows of Kingsvale outside the walls, mostly along the road. They fight in groups; so should you.",
    completeText: "Eight. The merchants will drink to your name tonight. Here is the city's pay.",
    goal: { type: "kill", monster: "bandit", count: 8 },
    reward: { exp: 2200, zeny: 900, items: [{ id: "orange_potion", count: 3 }] },
  },
  wren_dark_pelts: {
    giver: "Apothecary Wren",
    title: "Dark pelts",
    level: 16,
    after: "rolf_road_west",
    intro:
      "The dire wolves of Kingsvale have a pelt that keeps a brew warm for days. Four of them, and I pay in potions. Good ones.",
    progressText:
      "Four dire wolf pelts. The dire wolves hunt the meadows south and west of the city, and they are bolder at night.",
    completeText: "Four pelts, and not a hair singed. You have a careful hand. Here, as promised.",
    goal: { type: "item", item: "dire_wolf_pelt", count: 4 },
    reward: { exp: 1800, zeny: 600, items: [{ id: "orange_potion", count: 5 }] },
  },
  aldric_brutes: {
    giver: "Captain Aldric",
    title: "The brutes",
    level: 18,
    after: "aldric_bandits",
    intro:
      "The bandits have muscle: brutes in stolen armor who do the real hurting. Five of them. Then we talk about their chief.",
    progressText: "Five bandit brutes. Big, slow, and they hit like a mule. Keep moving.",
    completeText: "Five brutes down. Now I know you can take their chief. Rest first.",
    goal: { type: "kill", monster: "bandit_brute", count: 5 },
    reward: { exp: 3500, zeny: 1400, items: [{ id: "orange_potion", count: 5 }] },
  },
  aldric_varek: {
    giver: "Captain Aldric",
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
    reward: { exp: 7000, zeny: 3000, items: [{ id: "orange_potion", count: 8 }] },
  },
  corvin_audience: {
    giver: "Steward Corvin",
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
      exp: 5000,
      zeny: 4000,
      items: [
        { id: "amulet_of_aurelia", count: 1 },
        { id: "orange_potion", count: 5 },
      ],
    },
  },
};

export const QUEST_ORDER = Object.keys(QUESTS);

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

/** Quest ids given by this npc, in quest order. */
export const questsFrom = (npcName) => QUEST_ORDER.filter((id) => QUESTS[id].giver === npcName);

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
  return count ? `Spoke to ${goal.npc}` : `Talk to ${goal.npc}`;
}
