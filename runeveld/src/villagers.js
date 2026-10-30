/* Eldoria – villagers: ambient figures that stand around, walk about and now and then say something.
   They are built from the hero layers (body, outfit, head, optionally helm and sword) with other hair and clothing
   colours, so they can walk in all four directions and match the style exactly.
   Purely local and without effect on the game; the server will take this over later. */
import { SHEETS } from "./sheets.js";
import { Sprite2D } from "./sprites.js";
import * as UI from "./ui.js";
import { HAIR_SOURCE, HAIR_PALETTES, TUNIC_SOURCE, TUNIC_PALETTES, recolor } from "./appearance.js";

/* The villagers: looks, route (list of points; a single point = standing still) and lines.
   outfit: 'armor1' tunic (recolourable with tunicColor), 'armor2' leather vest, 'armor3' plate armor;
   headgear: 'cap' or 'helm'; weapon: 'sword1'..'sword3'. speed in units per second, pause [min, max] seconds at
   each route point, loop: walk the route in a circle instead of back and forth, facing: direction when standing,
   hammers: plays the attack animation now and then (recruits), work: a profession animation (sheets.js WORK:
   smith, fish, harvest, brew, cook, chop) played while standing at a route point, facing workFacing,
   shop: SHOPS key. */
const VILLAGERS = [
  {
    name: "Guard Rolf",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [1.8, -20.6],
      [1.8, -11],
    ],
    speed: 1.6,
    pause: [5, 10],
    lines: [
      "Stay inside the fence after dark.",
      "The boars have been bold lately.",
      "Move along, nothing to see here.",
    ],
  },
  {
    name: "Guard Sven",
    hair: "brown",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [-1.8, 20.6],
      [-1.8, 11],
    ],
    speed: 1.6,
    pause: [5, 10],
    lines: [
      "Quiet shift. I like quiet shifts.",
      "Foxes to the west, boars to the east.",
      "Rolf owes me a drink.",
    ],
  },
  {
    name: "Old Mette",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "grey",
    route: [
      [-2, 2],
      [2, 2],
      [2, -2],
      [-2, -2],
    ],
    speed: 0.9,
    pause: [6, 14],
    lines: [
      "My knees know when it will rain.",
      "Back in my day the well was deeper.",
      "You look thin. Eat something.",
    ],
  },
  {
    name: "Pim",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "red",
    scale: 0.8,
    route: [
      [0, 6.2],
      [4.6, 4.6],
      [6.4, 0],
      [4.6, -4.6],
      [0, -6.4],
      [-4.6, -4.6],
      [-6.4, 0],
      [-4.6, 4.6],
    ],
    speed: 3.2,
    pause: [0, 1.5],
    loop: true,
    lines: [
      "Catch me if you can!",
      "I saw a fox! A real one!",
      "Mum says I cannot go past the gate.",
    ],
  },
  {
    name: "Farmer Jorn",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "green",
    headgear: "cap",
    route: [
      [-14, -14.6],
      [-17.5, -13],
      [-17.5, -7],
      [-11, -5],
      [-9.5, -1],
      [-5, 0.5],
    ],
    speed: 1.4,
    pause: [3, 8],
    lines: [
      "Carrots do not plant themselves.",
      "Rabbits ate my lettuce again.",
      "Rain tomorrow, mark my words.",
    ],
  },
  {
    name: "Baker Lise",
    hair: "red",
    outfit: "armor1",
    tunicColor: "cream",
    route: [
      [10.6, -4.2],
      [2.4, -1.6],
    ],
    speed: 1.3,
    pause: [12, 25],
    lines: [
      "Fresh bread, still warm!",
      "Bram overcharges, you know.",
      "Two loaves for the guards, every morning.",
    ],
  },
  {
    name: "Fisher Teun",
    hair: "black",
    outfit: "armor1",
    tunicColor: "blue",
    headgear: "cap",
    route: [[3, 15.5]],
    facing: [1, 0],
    work: "fish",
    lines: [
      "Shh. You will scare the fish.",
      "Not a single bite all morning.",
      "The big one lives under the far rock.",
    ],
  },
  {
    name: "Smith Ragnar",
    hair: "black",
    outfit: "armor1",
    tunicColor: "grey",
    headgear: "cap",
    route: [[-7.8, 9.2]],
    facing: [-1, -1],
    work: "smith",
    lines: [
      "Bring me iron and I will make it sing.",
      "Mind the sparks.",
      "A dull blade is a dead swordsman.",
    ],
  },
  /* ---- Aurelia: gate watch, city watch, the court, the market, the square, the quarters and the temple ---- */
  {
    name: "Captain Aldric",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-101.5, 2.8]],
    facing: [1, 0],
    lines: [
      "State your business in Aurelia.",
      "Bandits on the road again. Every week.",
      "The King pays for results, not stories.",
    ],
  },
  {
    name: "Gate Guard Bo",
    hair: "brown",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-101.5, -2.8]],
    facing: [1, 0],
    lines: [
      "Welcome to the capital. No fighting inside the walls.",
      "Keep your purse close on market day.",
      "Long shift. Longer road.",
    ],
  },
  {
    name: "Guard Hal",
    hair: "blond",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [-134, -21.5],
      [-100.5, -21.5],
    ],
    speed: 1.6,
    pause: [4, 9],
    lines: [
      "All quiet on the north street.",
      "Somebody keeps stealing lanterns.",
      "I hear wolves at night, beyond the wall.",
    ],
  },
  {
    name: "Guard Ida",
    hair: "red",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [-134, 21.5],
      [-100.5, 21.5],
    ],
    speed: 1.6,
    pause: [4, 9],
    lines: [
      "The recruits are loud today.",
      "Stay off the training field unless you like bruises.",
      "Ser Roland walks the avenue again. Showing off.",
    ],
  },
  {
    name: "Guard Rik",
    hair: "brown",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [-135, -36],
      [-135, -6],
      [-131.5, 0],
      [-135, 6],
      [-135, 36],
    ],
    speed: 1.5,
    pause: [3, 8],
    lines: [
      "North gate to south gate, all day long.",
      "The fountain water is not for drinking.",
      "Move along.",
    ],
  },
  {
    name: "Royal Guard",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-153, 2.6]],
    facing: [1, 0],
    lines: ["Bow before His Majesty.", "Not one step closer.", "..."],
  },
  {
    name: "Royal Guard",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-153, -2.6]],
    facing: [1, 0],
    lines: ["The King sees all who come.", "Hands where I can see them.", "..."],
  },
  {
    name: "Castle Guard",
    hair: "brown",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-143.4, 4.8]],
    facing: [1, 0],
    lines: [
      "The castle is open to the brave and the invited.",
      "Mind the braziers.",
      "No horses past this gate.",
    ],
  },
  {
    name: "Castle Guard",
    hair: "silver",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-143.4, -4.8]],
    facing: [1, 0],
    lines: ["Thirty years at this gate.", "The Steward is in a mood today.", "Carry on."],
  },
  {
    name: "King Aldemar",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "red",
    route: [[-155.4, 0]],
    facing: [1, 0],
    lines: [
      "Eldoria endures.",
      "My father built this keep. I keep it.",
      "Every bandit on my road is an insult to my crown.",
    ],
  },
  {
    name: "Steward Corvin",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "blue",
    route: [
      [-150.5, -3],
      [-149.5, 3.2],
    ],
    speed: 0.9,
    pause: [6, 14],
    lines: [
      "The treasury does not fill itself.",
      "His Majesty will see you when His Majesty sees you.",
      "Taxes, ledgers, bandits. In that order.",
    ],
  },
  {
    name: "Lady Elara",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "cream",
    route: [
      [-148, -4.5],
      [-140, -9],
      [-131, -5],
      [-128, -15],
    ],
    speed: 1.1,
    pause: [5, 12],
    lines: [
      "The gardens by the temple are lovely this time of year.",
      "Have you heard the bard? Dreadful. I adore him.",
      "A lady does not hurry.",
    ],
  },
  {
    name: "Ser Roland",
    hair: "blond",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [
      [-105, -4.5],
      [-143, -4.5],
    ],
    speed: 1.5,
    pause: [4, 10],
    lines: [
      "I slew three brutes before breakfast.",
      "The King knights those who deserve it. Mostly.",
      "Stand aside, citizen.",
    ],
  },
  {
    name: "Apothecary Wren",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "green",
    headgear: "cap",
    route: [[-154, -34.3]],
    facing: [0, 1],
    shop: "apothecary",
    work: "brew",
    lines: [
      "Orange potions. My own recipe. Do not ask.",
      "Dire wolf pelt keeps a brew warm for days.",
      "Shake well. Or do not. It is your stomach.",
    ],
  },
  {
    name: "Armorer Gunnar",
    hair: "red",
    outfit: "armor2",
    headgear: "cap",
    route: [[-166, -34.3]],
    facing: [0, 1],
    shop: "armorer",
    work: "smith",
    lines: [
      "Royal steel. Costs what it costs.",
      "That dent? That is character.",
      "I armored the King's own guard.",
    ],
  },
  {
    name: "Jeweler Oswin",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "cream",
    route: [[-158, -20.2]],
    facing: [0, -1],
    shop: "jeweler",
    lines: [
      "Rings and chains, friend. Rings and chains.",
      "That stone? Dug up in the vale by a boar. True story.",
      "A ring for your lady, a chain for your luck.",
    ],
  },
  {
    name: "Grocer Hilde",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "cream",
    route: [[-160, -34.5]],
    facing: [0, 1],
    lines: [
      "Apples from the vale, fresh this morning!",
      "The bandits took my cart twice this month.",
      "Two for a zeny, three if you smile.",
    ],
  },
  {
    name: "Tailor Maud",
    hair: "black",
    outfit: "armor1",
    tunicColor: "blue",
    route: [[-167, -20.2]],
    facing: [0, -1],
    shop: "tailor",
    lines: [
      "Silk, wool, and no patience for haggling.",
      "Your hem is torn. I can see it from here.",
      "The Lady Elara orders a new gown every week.",
    ],
  },
  {
    name: "Spice Trader Yusuf",
    hair: "black",
    outfit: "armor1",
    tunicColor: "red",
    headgear: "cap",
    route: [[-153, -20.2]],
    facing: [0, -1],
    lines: [
      "Pepper from beyond the mountains!",
      "Smell that? That is money.",
      "The Kingsroad is the only road, and it is full of thieves.",
    ],
  },
  {
    name: "Innkeeper Rosa",
    hair: "red",
    outfit: "armor1",
    tunicColor: "cream",
    route: [[-162.7, -32.6]],
    facing: [0, 1],
    work: "cook",
    lines: [
      "Rooms upstairs, ale downstairs, no singing after midnight.",
      "The Gilded Boar: finest inn in Aurelia. The only one, too.",
      "Bandit talk makes the guests nervous. Keep it down.",
    ],
  },
  {
    name: "Townsman Piet",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "grey",
    headgear: "cap",
    route: [
      [-137, -14],
      [-137, -25],
      [-150, -25],
      [-160, -25],
    ],
    speed: 1.3,
    pause: [4, 12],
    lines: [
      "Market, then home. Market, then home.",
      "They say the King has not left the keep in a year.",
      "Fine weather for a walk.",
    ],
  },
  {
    name: "Bard Finn",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "green",
    route: [[-141, -3]],
    facing: [1, 0],
    lines: [
      "Oh the road ran west and the sky ran gold...",
      "A coin for a song? A song for a coin?",
      "Everyone is a critic in this city.",
    ],
  },
  {
    name: "Washerwoman Ana",
    hair: "black",
    outfit: "armor1",
    tunicColor: "blue",
    route: [
      [-133.5, 3.4],
      [-140.5, 4],
    ],
    speed: 1,
    pause: [8, 18],
    lines: [
      "Fountain water, finest in the kingdom.",
      "Mud. Everywhere. Always mud.",
      "The bard again. Saints preserve us.",
    ],
  },
  {
    name: "Old Gert",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "grey",
    route: [[-131, -8]],
    facing: [-1, 1],
    lines: [
      "I remember when this plaza was a cow field.",
      "The statue? That is old King Edric. Looked nothing like him.",
      "My knees. Do not ask.",
    ],
  },
  {
    name: "Nell",
    hair: "red",
    outfit: "armor1",
    tunicColor: "cream",
    scale: 0.8,
    route: [
      [-137, -6],
      [-132.8, -4.2],
      [-131, 0],
      [-132.8, 4.2],
      [-137, 6],
      [-141.2, 4.2],
      [-143, 0],
      [-141.2, -4.2],
    ],
    speed: 3,
    pause: [0, 1],
    loop: true,
    lines: ["Catch me, Ro!", "I am going to be a knight!", "The fountain splashed me!"],
  },
  {
    name: "Ro",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "green",
    scale: 0.78,
    route: [
      [-143, 0],
      [-141.2, -4.2],
      [-137, -6],
      [-132.8, -4.2],
      [-131, 0],
      [-132.8, 4.2],
      [-137, 6],
      [-141.2, 4.2],
    ],
    speed: 2.9,
    pause: [0, 1.2],
    loop: true,
    lines: [
      "Not fair, you started first!",
      "I want to be a wizard!",
      "Did you see the bandit they brought in?",
    ],
  },
  {
    name: "Beggar Tam",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "grey",
    route: [[-104, 4.2]],
    facing: [-1, 0],
    lines: [
      "A zeny for an old soldier?",
      "I fought at the river, you know. Nobody remembers.",
      "The guards are kind. The nobles are not.",
    ],
  },
  {
    name: "Courier Jesper",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "blue",
    headgear: "cap",
    route: [
      [-101, 1.6],
      [-126, 1.6],
      [-126, -19],
      [-104, -19],
    ],
    speed: 3.4,
    pause: [1, 3],
    lines: [
      "Letter for the Steward! Out of the way!",
      "Third run today. Third!",
      "Who put a lantern there?",
    ],
  },
  {
    name: "Goodwife Marta",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "red",
    route: [[-114.5, -6.2]],
    facing: [-1, 0],
    lines: [
      "The well is sweeter than the fountain, whatever Ana says.",
      "My boy joined the guard. I do not sleep.",
      "Fresh pie on the sill. Do not touch it.",
    ],
  },
  {
    name: "Carpenter Jos",
    hair: "black",
    outfit: "armor1",
    tunicColor: "green",
    headgear: "cap",
    route: [
      [-129, -16.5],
      [-118, -16.5],
    ],
    speed: 1.2,
    pause: [6, 12],
    work: "chop",
    lines: [
      "Measure twice, cut once, swear thrice.",
      "The inn roof again. Rosa, I swear.",
      "Oak from the vale, nothing better.",
    ],
  },
  {
    name: "Smith Brun",
    hair: "red",
    outfit: "armor2",
    headgear: "cap",
    route: [[-125.2, 14]],
    facing: [-1, -1],
    work: "smith",
    lines: [
      "Gunnar sells it. I make it.",
      "Hot. Everything here is hot.",
      "Bring me dire wolf fangs and I will make you a hilt.",
    ],
  },
  {
    name: "Recruit Dag",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "grey",
    headgear: "helm",
    weapon: "sword1",
    route: [[-127.2, 30.4]],
    facing: [0, -1],
    hammers: true,
    lines: [
      "Hya! Take that, hay!",
      "The sergeant says my footwork is a crime.",
      "One day I will guard the King.",
    ],
  },
  {
    name: "Sergeant Ulla",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-121, 27.6]],
    facing: [-1, 0],
    lines: [
      "FEET, Dag! Where are your FEET?",
      "Recruits. Every year softer.",
      "You want to train? Bring your own hay.",
    ],
  },
  {
    name: "Stablehand Ott",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "cream",
    headgear: "cap",
    route: [[-104, 15.2]],
    facing: [0, -1],
    lines: [
      "The horses know a bandit before I do.",
      "Hay, oats, and a lot of shoveling.",
      "Ser Roland's horse bites. Like its master.",
    ],
  },
  {
    name: "Guildmaster Hesper",
    hair: "silver",
    outfit: "armor2",
    headgear: "cap",
    route: [[-118.5, 14.2]],
    facing: [0, 1],
    lines: [
      "The Adventurers' Guild: contracts, coin, and no questions.",
      "Bandit insignias fetch a price. Ask around.",
      "Heroes come and go. The guild remains.",
    ],
  },
  {
    name: "Father Anselm",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "cream",
    route: [
      [-165.7, 37],
      [-156, 30],
      [-150, 22],
    ],
    speed: 0.9,
    pause: [8, 16],
    lines: [
      "Peace be upon the road.",
      "The temple is open to all. Even bandits, should they repent.",
      "Light the candles, mind the wax.",
    ],
  },
  {
    name: "Pilgrim Sanne",
    hair: "blond",
    outfit: "armor1",
    tunicColor: "blue",
    headgear: "cap",
    route: [[-147.5, 27.2]],
    facing: [-1, 0],
    lines: [
      "I walked from the eastern sea to see this temple.",
      "The pond is said to heal. My feet disagree.",
      "So many people. So much noise.",
    ],
  },
  /* outside the walls */
  {
    name: "Farmer Wendel",
    hair: "brown",
    outfit: "armor1",
    tunicColor: "green",
    headgear: "cap",
    route: [
      [-76, -6.5],
      [-66, -8.5],
      [-86, -8.5],
    ],
    speed: 1.3,
    pause: [5, 12],
    work: "harvest",
    workFacing: [0, -1],
    lines: [
      "Bandits camp north of my fields. They took my best cow. The COW.",
      "Beets, turnips, and a view of the castle.",
      "The windmill grinds slow, like Abe.",
    ],
  },
  {
    name: "Miller Abe",
    hair: "silver",
    outfit: "armor1",
    tunicColor: "cream",
    headgear: "cap",
    route: [[-75.5, 20.6]],
    facing: [-1, 0],
    lines: [
      "The wind does the work. I do the waiting.",
      "Flour for the whole city comes through here.",
      "Wendel talks too much.",
    ],
  },
];

VILLAGERS.push({
  name: "Farmhand Tess",
  hair: "brown",
  outfit: "armor1",
  tunicColor: "green",
  headgear: "cap",
  route: [
    [29.6, -0.5],
    [35.4, -0.5],
  ],
  speed: 1.1,
  pause: [6, 12],
  work: "harvest",
  workFacing: [0, -1],
  lines: [
    "The grain is good this year. The crows think so too.",
    "Jorn says the scarecrow works. The crows disagree.",
    "Mind the rows, please. They were straight this morning.",
  ],
});

const randomBetween = (min, max) => min + Math.random() * (max - min);
const villagerList = [];

/**
 * Creates every villager, adds them to the scene and their meshes to `clickables`.
 * The villager is stored on the mesh as `userData.villager`.
 */
export function createVillagers(scene, clickables) {
  const heroLayers = SHEETS.hero.layers;
  for (const spec of VILLAGERS) {
    /* With a helm or cap only replace the exact hair colours, otherwise the iron gets recoloured too. */
    const head = recolor(
      spec.headgear || "hero_head",
      HAIR_SOURCE,
      HAIR_PALETTES[spec.hair],
      "hair-" + spec.hair,
      !!spec.headgear,
    );
    let outfit = null;
    if (spec.outfit === "armor1" && spec.tunicColor) {
      outfit = recolor(
        "armor1",
        TUNIC_SOURCE,
        TUNIC_PALETTES[spec.tunicColor],
        "tunic-" + spec.tunicColor,
      );
    } else if (spec.outfit) {
      outfit = heroLayers[spec.outfit];
    }
    /* Drawing order: weapon back, body, outfit, head, weapon front. */
    const layers = [
      spec.weapon && heroLayers[spec.weapon + "_back"],
      heroLayers.hero_body,
      outfit,
      head,
      spec.weapon && heroLayers[spec.weapon],
    ].filter(Boolean);
    const sprite = new Sprite2D(SHEETS.hero, { layers, shadow: 0.9 * (spec.scale || 1) });
    if (spec.scale) {
      sprite.group.scale.setScalar(spec.scale);
    }
    const [x, z] = spec.route[0];
    sprite.group.position.set(x, 0, z);
    if (spec.facing) {
      sprite.face(spec.facing[0], spec.facing[1]);
    }
    scene.add(sprite.group);
    const villager = {
      spec,
      sprite,
      label: UI.createLabel("npc", spec.name),
      x,
      z,
      routeIndex: 0,
      routeStep: 1,
      pause: randomBetween(1, 4),
      chatTimer: randomBetween(10, 60),
      busyUntil: 0,
      talkUntil: 0,
      hammerTimer: randomBetween(1, 3),
    };
    sprite.mesh.userData.villager = villager;
    clickables.push(sprite.mesh);
    villagerList.push(villager);
  }
  return villagerList;
}

/* The villagers are not there on the select screen, only in the real world. */
let isVisible = true;

export function showVillagers(visible) {
  isVisible = visible;
  for (const villager of villagerList) {
    villager.sprite.group.visible = visible;
    villager.label.el.hidden = !visible;
  }
}

/* Moves a villager along its route; returns true while it is walking. */
function walkRoute(villager, dt) {
  const spec = villager.spec;
  if (villager.pause > 0) {
    villager.pause -= dt;
    return false;
  }
  const target = spec.route[villager.routeIndex];
  const dx = target[0] - villager.x;
  const dz = target[1] - villager.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.12) {
    /* Arrived: wait, then head for the next point (round for a loop, back and forth otherwise). */
    villager.pause = randomBetween(spec.pause[0], spec.pause[1]);
    if (spec.loop) {
      villager.routeIndex = (villager.routeIndex + 1) % spec.route.length;
    } else {
      const next = villager.routeIndex + villager.routeStep;
      if (next < 0 || next >= spec.route.length) {
        villager.routeStep = -villager.routeStep;
      }
      villager.routeIndex += villager.routeStep;
    }
    if (spec.facing) {
      villager.sprite.face(spec.facing[0], spec.facing[1]);
    }
    return false;
  }
  const stepLength = spec.speed * dt;
  villager.x += (dx / distance) * stepLength;
  villager.z += (dz / distance) * stepLength;
  villager.sprite.face(dx, dz);
  return true;
}

export function updateVillagers(dt, cameraState, camera, player) {
  if (!isVisible) {
    return;
  }
  const time = performance.now() / 1000;
  for (const villager of villagerList) {
    const spec = villager.spec;
    const sprite = villager.sprite;
    let isWalking = false;
    if (spec.route.length > 1 && time >= villager.busyUntil) {
      isWalking = walkRoute(villager, dt);
    }
    /* At work while standing (not while someone is talking to them) */
    if (spec.work && !isWalking && time >= villager.busyUntil && time >= villager.talkUntil) {
      if (spec.workFacing && sprite.animName !== spec.work) {
        sprite.face(spec.workFacing[0], spec.workFacing[1]);
      }
      sprite.play(spec.work);
      villager.busyUntil = time + 0.2;
    }
    /* Recruits swing now and then (the attack animation). */
    if (spec.hammers) {
      villager.hammerTimer -= dt;
      if (villager.hammerTimer <= 0) {
        villager.hammerTimer = randomBetween(2.5, 5);
        sprite.play("attack", true);
        villager.busyUntil = time + sprite.duration("attack");
      }
    }
    if (time >= villager.busyUntil) {
      sprite.play(isWalking ? "walk" : "idle");
    }
    sprite.group.position.set(villager.x, 0, villager.z);
    sprite.update(dt, cameraState);
    UI.positionLabel(
      villager.label,
      villager.x,
      sprite.height * (spec.scale || 1) + 0.1,
      villager.z,
      camera,
    );
    /* A line now and then. */
    villager.chatTimer -= dt;
    if (villager.chatTimer <= 0) {
      villager.chatTimer = randomBetween(15, 45);
      UI.speechBubble(villager.label, spec.lines[Math.floor(Math.random() * spec.lines.length)]);
    }
  }
}

/* Spoken to: face the player and stand still for a while; the conversation itself goes through dialogue.js. */
export function faceSpeaker(villager, player, seconds = 4) {
  villager.sprite.face(player.x - villager.x, player.z - villager.z);
  villager.pause = Math.max(villager.pause, seconds);
  villager.talkUntil = performance.now() / 1000 + seconds;
  villager.chatTimer = Math.max(villager.chatTimer, seconds + randomBetween(10, 30));
}

export const villagers = () => villagerList;

/* The greeting in a conversation: the first line. */
export const greetingOf = (villager) => villager.spec.lines[0];
