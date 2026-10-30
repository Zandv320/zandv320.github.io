/* Eldoria – villagers: ambient figures that stand around, walk about and now and then say something.
   They are built from the hero layers (body, outfit, head, optionally helm and sword) with other hair and clothing
   colours, so they can walk in all four directions and match the style exactly.
   Purely local and without effect on the game; the server will take this over later. */
import { SHEETS } from "./sheets.js";
import { Sprite2D } from "./sprites.js";
import * as UI from "./ui.js";
import { isNight } from "./daylight.js";
import { HAIR_SOURCE, HAIR_PALETTES, TUNIC_SOURCE, TUNIC_PALETTES, recolor } from "./appearance.js";

/* The villagers: looks, route (list of points; a single point = standing still) and lines.
   outfit: 'armor1' tunic (recolourable with tunicColor), 'armor2' leather vest, 'armor3' plate armor;
   headgear: 'cap' or 'helm'; weapon: 'sword1'..'sword3'. speed in units per second, pause [min, max] seconds at
   each route point, loop: walk the route in a circle instead of back and forth, facing: direction when standing,
   hammers: plays the attack animation now and then (recruits), work: a profession animation (sheets.js WORK:
   smith, fish, harvest, brew, cook, chop) played while standing at a route point, facing workFacing,
   shop: SHOPS key, night: extra lines after dark, after: {questId: lines} that join once the player has finished
   that quest, so the world talks about what the player did. */
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
    night: ["Long night. Keep your eyes on the tree line.", "Wolves are loud tonight."],
    after: {
      main_crown: ["Bandits this far east. I do not like it."],
      rolf_dire_boar: ["The altar is quiet again, thanks to you."],
      aldric_varek: ["Word came down the Kingsroad: Varek is dead. Was that you?"],
    },
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
      "Rabbits by the fence, foxes further out, boars at the edge.",
      "Rolf owes me a drink.",
    ],
    night: ["Night shift. My favorite. Nobody talks."],
    after: {
      sven_foxes: ["Quiet nights since the foxes learned their lesson."],
      corvin_audience: ["You met the King? Rolf will never stop talking about it."],
    },
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
    night: ["Off to bed with you. Nothing good walks after dark."],
    after: {
      mette_altar: ["The altar still stands. I sleep better now."],
      main_sharpen: ["Keep that edge clean, child."],
      corvin_audience: ["The King himself! Runeveld is proud of you."],
    },
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
    night: ["Mum says it is bedtime. I say it is fox time."],
    after: {
      pim_fox: ["Everyone believes me now! The tail proves it!"],
      rolf_dire_boar: ["Did you really fight a boar as big as a cart?"],
    },
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
    night: ["Boars dig at night. I hear them from my bed."],
    after: {
      jorn_boars: ["The beets are safe. The rabbits are another story."],
      main_crown: ["I still think about that badge in my furrows."],
    },
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
    night: ["The dough rises while the village sleeps."],
    after: {
      lise_fox_tails: ["The tails on my door work. Not one fox since."],
      lise_warm_coat: ["Warmest coat in Runeveld. Smells a bit of wolf."],
    },
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
    night: ["The big ones bite after dark. Supposedly."],
    after: {
      teun_lucky_feet: ["The rabbit feet worked! One bite. Well, a nibble."],
      main_cook: ["Still grilling your minnows? Good. Never go hungry."],
    },
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
    night: ["The forge stays warm all night. So do I."],
    after: {
      main_smelt: ["Your bars held up. Not bad for a first time."],
      ragnar_antlers: ["Those antler hilts sold the same week."],
    },
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
    night: ["Night is when the bandits move. So do we."],
    after: {
      aldric_bandits: ["The carts run again. The merchants send their thanks."],
      aldric_varek: ["Kingsvale breathes easier. So do I."],
    },
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
    night: ["Gates close at midnight. Mostly."],
    after: { aldric_varek: ["You are the one who took Varek? Go on through."] },
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
    night: ["There, hear that? Wolves, past the wall."],
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
    night: ["Even the recruits sleep. Finally."],
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
    night: ["Lanterns lit, streets quiet. Just how I like it."],
  },
  {
    name: "Royal Guard",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-153, 2.6]],
    facing: [1, 0],
    lines: [
      "Bow before His Majesty.",
      "Not one step closer.",
      "The King's word is law in these halls.",
    ],
  },
  {
    name: "Royal Guard",
    hair: "black",
    outfit: "armor2",
    headgear: "helm",
    weapon: "sword2",
    route: [[-153, -2.6]],
    facing: [1, 0],
    lines: [
      "The King sees all who come.",
      "Hands where I can see them.",
      "We stand. That is the whole job.",
    ],
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
    night: ["Even kings lie awake."],
    after: { corvin_audience: ["Ah, the one who broke the crossed-out crown."] },
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
    night: ["The ledgers do not sleep, so neither do I."],
    after: { corvin_audience: ["His Majesty spoke of you at supper. Twice."] },
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
    night: ["The stars are lovely from the temple steps."],
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
    night: ["A knight's vigil never ends. Or so I tell the ladies."],
    after: { aldric_varek: ["Varek? I was about to deal with him myself. Truly."] },
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
    night: ["Night herbs are stronger. Ask me why. Actually, do not."],
    after: { wren_dark_pelts: ["Those pelts work wonders. My brews stay warm for days."] },
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
    after: { aldric_bandits: ["My cart made it to market twice this week! Twice!"] },
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
    after: { aldric_bandits: ["The road is safer now. My prices are not."] },
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
    night: ["Last round! And I mean it this time."],
    after: {
      corvin_audience: [
        "A guest who has met the King! First round is on the house. Only the first.",
      ],
    },
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
    night: ["The night wants a song. The neighbors do not."],
    after: { aldric_varek: ["I am writing a song about you. Nothing rhymes with Varek."] },
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
    night: ["Washing by lantern light. Again."],
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
    night: ["At my age you sleep in the day and count stars at night."],
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
    night: ["Ro is scared of the dark. I am not. Much."],
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
    night: ["Nell, did you hear that?"],
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
    night: ["Cold one tonight. A zeny buys a blanket."],
    after: {
      aldric_varek: ["They say a newcomer took down Varek. Reminds me of me, at the river."],
    },
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
    night: ["My boy is on the wall tonight. I keep the lamp lit."],
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
      "Bring me a dire tusk one day. I want to see one up close.",
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
    night: ["The horses get restless at night. So do I."],
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
    after: { aldric_brutes: ["Five brutes. The guild noticed. So did the bandits."] },
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
    night: ["The candles burn for every traveler on the road."],
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
    night: ["I lock the barn at night now. Bandits."],
    after: { aldric_varek: ["Varek is gone? Then maybe I get my cow back."] },
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
    night: ["No wind, no flour. I might as well sleep."],
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
  night: ["Fireflies over the grain. Pretty, but they do not pay."],
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
      const lines = linesFor(spec, player);
      UI.speechBubble(villager.label, lines[Math.floor(Math.random() * lines.length)]);
    }
  }
}

/* What a villager may say now: the usual lines, the night lines after dark and the lines about quests the player
   has finished. Night and story lines count twice, so they are heard often enough to notice. */
function linesFor(spec, player) {
  const lines = [...spec.lines];
  if (spec.night && isNight()) {
    lines.push(...spec.night, ...spec.night);
  }
  const quests = (player && player.quests) || {};
  for (const [questId, storyLines] of Object.entries(spec.after || {})) {
    if (quests[questId] && quests[questId].state === "done") {
      lines.push(...storyLines, ...storyLines);
    }
  }
  return lines;
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
