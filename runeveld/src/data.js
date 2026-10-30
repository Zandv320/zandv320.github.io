/* Runeveld – spelgegevens: klasse, voorwerpen, monsters, levels. */

/* De klassen; HP, SP, ATK, MATK en aanvalssnelheid volgen uit level, stats en uitrusting (regels/stats.js).
   snelheid: eenheden per seconde; bereik: bereik van de gewone slag; hp/sp: factor op de maximale HP en SP. */
export const KLASSEN={
  swordsman:{naam:'Swordsman',icoon:'⚔️',tier:1,basis:'swordsman',snelheid:4.6,bereik:1.5,hp:1,sp:1,
    beschr:'Strong up close. Skills: Crushing Blow, Flame Sweep, War Cry.',start:{hoofd:null,lichaam:'tuniek',wapen:'houtzwaard'}},
  mage:{naam:'Mage',icoon:'🔮',tier:1,basis:'mage',snelheid:4.4,bereik:1.3,hp:.78,sp:1.7,
    beschr:'Fragile, but deadly from a distance. Skills: Ember Bolt, Frostburst, Mana Ward.',start:{hoofd:null,lichaam:'gewaad',wapen:'houtstaf'}},
  /* tweede klassen, te kiezen op job 20 bij een npc; job gaat terug naar 1 en loopt dan tot 50 */
  knight:{naam:'Knight',icoon:'🛡️',tier:2,basis:'swordsman',snelheid:4.7,bereik:1.5,hp:1.15,sp:1,gever:'Guard Rolf',uitrusting:'ridderharnas',
    beschr:'Heavy armor and heavier blows. Piercing Thrust, Whirlwind Sweep and Spiral Lance.'},
  crusader:{naam:'Crusader',icoon:'✝️',tier:2,basis:'swordsman',snelheid:4.5,bereik:1.5,hp:1.1,sp:1.3,gever:'Guard Rolf',uitrusting:'kruisharnas',
    beschr:'Blessed steel: Radiant Cross, Shield Rush and Mending Light.'},
  wizard:{naam:'Wizard',icoon:'⚡',tier:2,basis:'mage',snelheid:4.4,bereik:1.3,hp:.8,sp:2,gever:'Old Mette',uitrusting:'wizardgewaad',
    beschr:'Raw elemental power: Thunderclap, Blizzard and Starfall.'},
  sage:{naam:'Sage',icoon:'📗',tier:2,basis:'mage',snelheid:4.5,bereik:1.3,hp:.95,sp:1.8,gever:'Old Mette',uitrusting:'sagegewaad',
    beschr:'Scholar of magic: Stone Spires, Wellspring and Mending Light.'},
};
export const ADVANCEMENT={swordsman:['knight','crusader'],mage:['wizard','sage']};
export const KLASSE=KLASSEN.swordsman;

export const MAX_LVL=99;
/* exp voor het volgende level: tot 30 zoals voorheen, daarna steeds steiler */
export const expVoor=l=>Math.round(40*Math.pow(l,1.55)*(l<=30?1:1+Math.pow((l-30)/20,1.5)));

/* Voorwerpen. Uitrusting heeft een `slot` (hoofd, lichaam, wapen) en een `laag` (spritelaag van de held, bladen.js);
   `klasse` beperkt wie het kan dragen; verbruiksartikelen hebben `gebruik`. Alles stapelt tot `stapel` per inventory-slot. */
export const SLOTS=[['hoofd','Head'],['lichaam','Body'],['wapen','Weapon']];
export const TAS_SLOTS=20;
export const ITEMS={
  drank:{naam:'Red potion',gebruik:'heal',heal:45,cd:1,prijs:25,icoon:'🧪',stapel:99,beschr:'Restores 45 HP.'},
  leren_kap:{naam:'Leather cap',slot:'hoofd',laag:'hoofd1',def:1,prijs:60,icoon:'🧢',beschr:'A snug cap of worn leather.'},
  ijzeren_helm:{naam:'Iron helm',slot:'hoofd',laag:'hoofd2',def:4,hp:15,prijs:500,icoon:'⛑️',klasse:'swordsman',beschr:'Heavy, dented and reassuring.'},
  punthoed:{naam:'Pointed hat',slot:'hoofd',laag:'hoed1',def:1,sp:8,prijs:60,icoon:'🎩',klasse:'mage',beschr:'Blue felt, slightly bent. Every mage starts here.'},
  sterrenhoed:{naam:'Starry hat',slot:'hoofd',laag:'hoed2',def:3,sp:25,matk:6,prijs:500,icoon:'🌟',klasse:'mage',beschr:'Purple, with a gold band. It hums faintly at night.'},
  tuniek:{naam:'Tattered tunic',slot:'lichaam',laag:'harnas1',def:2,prijs:30,icoon:'👕',beschr:'Better than nothing. Just about.'},
  vest:{naam:'Leather vest',slot:'lichaam',laag:'harnas2',def:6,hp:25,prijs:350,icoon:'🦺',klasse:'swordsman',beschr:'Sturdy leather, stitched by someone who cared.'},
  harnas:{naam:'Steel armor',slot:'lichaam',laag:'harnas3',def:12,hp:70,prijs:1500,icoon:'🛡️',klasse:'swordsman',beschr:'Polished steel. Turns heads and blades.'},
  gewaad:{naam:'Apprentice robe',slot:'lichaam',laag:'gewaad1',def:1,sp:10,prijs:30,icoon:'🥋',klasse:'mage',beschr:'Blue wool, a little scorched at the sleeves.'},
  zijden_gewaad:{naam:'Silk robe',slot:'lichaam',laag:'gewaad2',def:4,sp:30,matk:5,prijs:350,icoon:'👘',klasse:'mage',beschr:'Red silk that whispers when you walk.'},
  magiergewaad:{naam:'Archmage robe',slot:'lichaam',laag:'gewaad3',def:8,sp:70,matk:12,prijs:1500,icoon:'🧙',klasse:'mage',beschr:'Deep purple, stitched with runes that glow under moonlight.'},
  /* klassewapenrusting van de tweede klassen, gekregen bij de advancement */
  ridderharnas:{naam:'Knight plate',slot:'lichaam',laag:'harnas4',def:16,hp:120,prijs:3000,icoon:'🛡️',klasse:'knight',beschr:'Blued steel, forged for the road beyond the forest.'},
  kruisharnas:{naam:'Crusader plate',slot:'lichaam',laag:'harnas5',def:14,hp:90,sp:25,prijs:3000,icoon:'✝️',klasse:'crusader',beschr:'Silver with gold trim. It catches the light even at night.'},
  wizardgewaad:{naam:'Wizard robe',slot:'lichaam',laag:'gewaad4',def:9,sp:110,matk:22,prijs:3000,icoon:'⚡',klasse:'wizard',beschr:'Midnight blue, humming with static.'},
  sagegewaad:{naam:'Sage robe',slot:'lichaam',laag:'gewaad5',def:10,sp:120,matk:16,hp:40,prijs:3000,icoon:'📗',klasse:'sage',beschr:'Forest green, pockets full of notes.'},
  houtzwaard:{naam:'Wooden sword',slot:'wapen',laag:'wapen1',atk:4,prijs:25,icoon:'🪵',klasse:'swordsman',beschr:'A practice sword. The rabbits still mind it.'},
  ijzerzwaard:{naam:'Iron sword',slot:'wapen',laag:'wapen2',atk:11,prijs:400,icoon:'🗡️',klasse:'swordsman',beschr:'A proper blade with a proper edge.'},
  staalzwaard:{naam:'Steel sword',slot:'wapen',laag:'wapen3',atk:22,prijs:1800,icoon:'⚔️',klasse:'swordsman',beschr:'Forged for someone who means it.'},
  houtstaf:{naam:'Wooden staff',slot:'wapen',laag:'staf1',atk:2,matk:8,prijs:25,icoon:'🪄',klasse:'mage',beschr:'A hazel branch with a green pebble on top. It works, mostly.'},
  eikenstaf:{naam:'Oak staff',slot:'wapen',laag:'staf2',atk:4,matk:18,prijs:400,icoon:'🔮',klasse:'mage',beschr:'Dark oak with a sapphire that stays cold.'},
  kristalstaf:{naam:'Crystal staff',slot:'wapen',laag:'staf3',atk:6,matk:32,prijs:1800,icoon:'💎',klasse:'mage',beschr:'Silvered wood and a violet crystal. Handle with respect.'},
  /* buit voor quests; verkoopbaar voor een paar zeny */
  konijnenpoot:{naam:'Rabbit foot',prijs:6,icoon:'🐾',stapel:99,beschr:'Lucky, allegedly. Not for the rabbit.'},
  vossenstaart:{naam:'Fox tail',prijs:14,icoon:'🦊',stapel:99,beschr:'Bushy and still a little warm.'},
  zwijnenhuid:{naam:'Boar hide',prijs:22,icoon:'🟫',stapel:99,beschr:'Thick, bristly and smelling of forest.'},
  wolfsvacht:{naam:'Wolf pelt',prijs:34,icoon:'🐺',stapel:99,beschr:'Grey, thick and warm. The wolf disagreed.'},
  gewei:{naam:'Stag antler',prijs:45,icoon:'🦌',stapel:99,beschr:'Heavy and branching. Good for hilts, says Ragnar.'},
  slagtand:{naam:'Dire tusk',prijs:140,icoon:'🦷',stapel:99,beschr:'As long as your forearm. Something to brag about.'},
  /* Kingsvale */
  grote_drank:{naam:'Orange potion',gebruik:'heal',heal:160,cd:1,prijs:120,icoon:'🧪',stapel:99,beschr:'Brewed in Aurelia. Restores 160 HP.'},
  donkere_vacht:{naam:'Dire wolf pelt',prijs:70,icoon:'🐺',stapel:99,beschr:'Thick, dark and still a little warm.'},
  bandietenzegel:{naam:'Bandit insignia',prijs:45,icoon:'🏴',stapel:99,beschr:'A tin badge with a crossed-out crown. The bandits of Kingsvale wear them.'},
};
export const STARTUITRUSTING=KLASSEN.swordsman.start;
export const STARTTAS=[{id:'drank',n:5}];
/* wat Merchant Bram verkoopt; hij koopt alles terug voor de helft */
export const WINKEL=['drank','tuniek','leren_kap','houtzwaard','houtstaf','gewaad','punthoed','vest','ijzerzwaard','zijden_gewaad','eikenstaf','ijzeren_helm','sterrenhoed','harnas','staalzwaard','magiergewaad','kristalstaf'];
/* alle winkels: Bram in Runeveld en de kooplieden op de markt van Aurelia */
export const WINKELS={
  bram:{naam:'Merchant Bram',tekst:'"Welcome to Runeveld, adventurer. A potion for the road, or something sturdier to wear?"',items:WINKEL},
  apotheek:{naam:'Apothecary Wren',tekst:'"Potions, tinctures and no questions. The orange ones are my own recipe."',items:['drank','grote_drank']},
  wapensmid:{naam:'Armorer Gunnar',tekst:'"Steel from the royal forges. It costs what it costs."',items:['vest','ijzerzwaard','ijzeren_helm','harnas','staalzwaard','zijden_gewaad','eikenstaf','sterrenhoed','magiergewaad','kristalstaf']},
};
export const VERKOOPDEEL=.5;

/* De monsters volgen de dieren uit het Craftpix-pack "Hunt Animals": konijn, vos, everzwijn.
   `zone`: afstand tot het dorpsmidden waar ze leven (buiten de palissade); `buit`: kans per item dat het valt. */
export const MONSTERS={
  konijn:{naam:'Rabbit',lvl:1,hp:28,atk:4,exp:11,zeny:[2,7],snelheid:1.8,agressief:false,bereik:1.1,aggro:0,zone:[25,38],buit:{konijnenpoot:.45,drank:.1,tuniek:.02,leren_kap:.03}},
  vos:{naam:'Fox',lvl:3,hp:60,atk:8,exp:26,zeny:[6,14],snelheid:2.6,agressief:true,bereik:1.2,aggro:4.5,zone:[33,50],buit:{vossenstaart:.5,drank:.15,vest:.06,ijzerzwaard:.05,leren_kap:.05,punthoed:.03}},
  zwijn:{naam:'Boar',lvl:6,hp:140,atk:14,exp:62,zeny:[12,30],snelheid:2.2,agressief:true,bereik:1.4,aggro:5,zone:[44,57],buit:{zwijnenhuid:.55,drank:.25,vest:.1,ijzerzwaard:.08,eikenstaf:.05,harnas:.05,staalzwaard:.04,ijzeren_helm:.06}},
};
/* Hoeveel van elk monster er rondlopen. */
/* Whisperwood (gebied.js): `gebied:'bos'` spawnt in het bos buiten het pad, 'plek' op de open plek bij het altaar. */
export const BOS_MONSTERS={
  wolf:{naam:'Grey Wolf',lvl:9,hp:260,atk:24,exp:120,zeny:[20,45],snelheid:3.2,agressief:true,bereik:1.3,aggro:6,gebied:'bos',nacht:{aggro:1.7,snelheid:1.15},buit:{wolfsvacht:.5,drank:.25,vest:.08,ijzerzwaard:.08,zijden_gewaad:.05}},
  hert:{naam:'Stag',lvl:11,hp:380,atk:30,exp:170,zeny:[25,60],snelheid:3.4,agressief:false,bereik:1.4,aggro:0,gebied:'bos',buit:{gewei:.45,drank:.25,ijzeren_helm:.07,harnas:.05,sterrenhoed:.05}},
  everzwijn:{naam:'Dire Boar',lvl:14,hp:900,atk:46,exp:520,zeny:[80,160],snelheid:2.4,agressief:true,bereik:1.6,aggro:7,gebied:'plek',respawn:[60,90],buit:{slagtand:.8,staalzwaard:.12,kristalstaf:.12,harnas:.1,magiergewaad:.1,drank:.5}},
};
Object.assign(MONSTERS,BOS_MONSTERS);
/* Kingsvale (gebied.js): `gebied:'vale'` zwerft over de weiden buiten de stad, 'kamp' blijft bij het bandietenkamp.
   Bandieten zijn mensen: opgebouwd uit de lagen van de held (`mens`), net als de dorpelingen. `blad` hergebruikt een dierensheet, `tint` kleurt hem. */
export const VALE_MONSTERS={
  bandiet:{naam:'Bandit',lvl:16,hp:1050,atk:54,exp:650,zeny:[60,140],snelheid:3,agressief:true,bereik:1.4,aggro:6.5,gebied:'vale',mens:{kleding:'harnas2',hoofd:'hoofd1',wapen:'wapen1',haar:'zwart'},buit:{bandietenzegel:.5,drank:.3,grote_drank:.08,ijzerzwaard:.06,vest:.06,zijden_gewaad:.04}},
  direwolf:{naam:'Dire Wolf',lvl:17,hp:1350,atk:60,exp:760,zeny:[50,120],snelheid:3.5,agressief:true,bereik:1.4,aggro:7,gebied:'vale',blad:'wolf',schaal:1.25,tint:0x9a8ab8,nacht:{aggro:1.6,snelheid:1.15},buit:{donkere_vacht:.55,drank:.3,grote_drank:.08,ijzeren_helm:.05,sterrenhoed:.05}},
  bruut:{naam:'Bandit Brute',lvl:19,hp:1950,atk:72,exp:1150,zeny:[100,220],snelheid:2.7,agressief:true,bereik:1.5,aggro:6.5,gebied:'vale',mens:{kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',haar:'rood',schaal:1.15},buit:{bandietenzegel:.7,grote_drank:.15,staalzwaard:.05,harnas:.05,kristalstaf:.04,magiergewaad:.04}},
  hoofdman:{naam:'Bandit Chief Varek',lvl:22,hp:6500,atk:96,exp:4500,zeny:[400,800],snelheid:3,agressief:true,bereik:1.6,aggro:8,gebied:'kamp',respawn:[90,150],mens:{kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',haar:'blond',schaal:1.3},buit:{bandietenzegel:1,grote_drank:.6,staalzwaard:.15,kristalstaf:.15,harnas:.12,magiergewaad:.12,ijzeren_helm:.1,sterrenhoed:.1}},
};
Object.assign(MONSTERS,VALE_MONSTERS);
export const SPAWNS=[{soort:'konijn',n:14},{soort:'vos',n:8},{soort:'zwijn',n:4},{soort:'wolf',n:7},{soort:'hert',n:5},{soort:'everzwijn',n:1},{soort:'bandiet',n:10},{soort:'direwolf',n:7},{soort:'bruut',n:6},{soort:'hoofdman',n:1}];
export const RESPAWN=[9,15];   /* seconden, min en max */
