/* Runeveld – spelgegevens: klasse, voorwerpen, monsters, levels. */

/* De klasse; HP, SP, ATK en aanvalssnelheid volgen uit level, stats en uitrusting (regels/stats.js). */
export const KLASSE={
  naam:'Swordsman',
  snelheid:4.6,          /* eenheden per seconde */
  bereik:1.5,            /* aanvalsbereik */
};

export const MAX_LVL=30;
export const expVoor=l=>Math.round(40*Math.pow(l,1.55));

/* Voorwerpen. Uitrusting heeft een `slot` (hoofd, lichaam, wapen) en een `laag` (spritelaag van de held, bladen.js);
   verbruiksartikelen hebben `gebruik`. Alles stapelt tot `stapel` per inventory-slot. */
export const SLOTS=[['hoofd','Head'],['lichaam','Body'],['wapen','Weapon']];
export const TAS_SLOTS=20;
export const ITEMS={
  drank:{naam:'Red potion',gebruik:'heal',heal:45,cd:1,prijs:25,icoon:'🧪',stapel:99,beschr:'Restores 45 HP.'},
  leren_kap:{naam:'Leather cap',slot:'hoofd',laag:'hoofd1',def:1,prijs:60,icoon:'🧢',beschr:'A snug cap of worn leather.'},
  ijzeren_helm:{naam:'Iron helm',slot:'hoofd',laag:'hoofd2',def:4,hp:15,prijs:500,icoon:'⛑️',beschr:'Heavy, dented and reassuring.'},
  tuniek:{naam:'Tattered tunic',slot:'lichaam',laag:'harnas1',def:2,prijs:30,icoon:'👕',beschr:'Better than nothing. Just about.'},
  vest:{naam:'Leather vest',slot:'lichaam',laag:'harnas2',def:6,hp:25,prijs:350,icoon:'🦺',beschr:'Sturdy leather, stitched by someone who cared.'},
  harnas:{naam:'Steel armor',slot:'lichaam',laag:'harnas3',def:12,hp:70,prijs:1500,icoon:'🛡️',beschr:'Polished steel. Turns heads and blades.'},
  houtzwaard:{naam:'Wooden sword',slot:'wapen',laag:'wapen1',atk:4,prijs:25,icoon:'🪵',beschr:'A practice sword. The rabbits still mind it.'},
  ijzerzwaard:{naam:'Iron sword',slot:'wapen',laag:'wapen2',atk:11,prijs:400,icoon:'🗡️',beschr:'A proper blade with a proper edge.'},
  staalzwaard:{naam:'Steel sword',slot:'wapen',laag:'wapen3',atk:22,prijs:1800,icoon:'⚔️',beschr:'Forged for someone who means it.'},
  /* buit voor quests; verkoopbaar voor een paar zeny */
  konijnenpoot:{naam:'Rabbit foot',prijs:6,icoon:'🐾',stapel:99,beschr:'Lucky, allegedly. Not for the rabbit.'},
  vossenstaart:{naam:'Fox tail',prijs:14,icoon:'🦊',stapel:99,beschr:'Bushy and still a little warm.'},
  zwijnenhuid:{naam:'Boar hide',prijs:22,icoon:'🟫',stapel:99,beschr:'Thick, bristly and smelling of forest.'},
  wolfsvacht:{naam:'Wolf pelt',prijs:34,icoon:'🐺',stapel:99,beschr:'Grey, thick and warm. The wolf disagreed.'},
  gewei:{naam:'Stag antler',prijs:45,icoon:'🦌',stapel:99,beschr:'Heavy and branching. Good for hilts, says Ragnar.'},
  slagtand:{naam:'Dire tusk',prijs:140,icoon:'🦷',stapel:99,beschr:'As long as your forearm. Something to brag about.'},
};
export const STARTUITRUSTING={hoofd:null,lichaam:'tuniek',wapen:'houtzwaard'};
export const STARTTAS=[{id:'drank',n:5}];
/* wat Merchant Bram verkoopt; hij koopt alles terug voor de helft */
export const WINKEL=['drank','tuniek','houtzwaard','leren_kap','vest','ijzerzwaard','ijzeren_helm','harnas','staalzwaard'];
export const VERKOOPDEEL=.5;

/* De monsters volgen de dieren uit het Craftpix-pack "Hunt Animals": konijn, vos, everzwijn.
   `zone`: afstand tot het dorpsmidden waar ze leven (buiten de palissade); `buit`: kans per item dat het valt. */
export const MONSTERS={
  konijn:{naam:'Rabbit',lvl:1,hp:28,atk:4,exp:11,zeny:[2,7],snelheid:1.8,agressief:false,bereik:1.1,aggro:0,zone:[25,38],buit:{konijnenpoot:.45,drank:.1,tuniek:.02,leren_kap:.03}},
  vos:{naam:'Fox',lvl:3,hp:60,atk:8,exp:26,zeny:[6,14],snelheid:2.6,agressief:true,bereik:1.2,aggro:4.5,zone:[33,50],buit:{vossenstaart:.5,drank:.15,vest:.06,ijzerzwaard:.05,leren_kap:.05}},
  zwijn:{naam:'Boar',lvl:6,hp:140,atk:14,exp:62,zeny:[12,30],snelheid:2.2,agressief:true,bereik:1.4,aggro:5,zone:[44,57],buit:{zwijnenhuid:.55,drank:.25,vest:.1,ijzerzwaard:.08,harnas:.05,staalzwaard:.04,ijzeren_helm:.06}},
};
/* Hoeveel van elk monster er rondlopen. */
/* Whisperwood (gebied.js): `gebied:'bos'` spawnt in het bos buiten het pad, 'plek' op de open plek bij het altaar. */
export const BOS_MONSTERS={
  wolf:{naam:'Grey Wolf',lvl:9,hp:260,atk:24,exp:120,zeny:[20,45],snelheid:3.2,agressief:true,bereik:1.3,aggro:6,gebied:'bos',buit:{wolfsvacht:.5,drank:.25,vest:.08,ijzerzwaard:.08}},
  hert:{naam:'Stag',lvl:11,hp:380,atk:30,exp:170,zeny:[25,60],snelheid:3.4,agressief:false,bereik:1.4,aggro:0,gebied:'bos',buit:{gewei:.45,drank:.25,ijzeren_helm:.07,harnas:.05}},
  everzwijn:{naam:'Dire Boar',lvl:14,hp:900,atk:46,exp:520,zeny:[80,160],snelheid:2.4,agressief:true,bereik:1.6,aggro:7,gebied:'plek',respawn:[60,90],buit:{slagtand:.8,staalzwaard:.15,harnas:.15,drank:.5}},
};
Object.assign(MONSTERS,BOS_MONSTERS);
export const SPAWNS=[{soort:'konijn',n:14},{soort:'vos',n:8},{soort:'zwijn',n:4},{soort:'wolf',n:7},{soort:'hert',n:5},{soort:'everzwijn',n:1}];
export const RESPAWN=[9,15];   /* seconden, min en max */
