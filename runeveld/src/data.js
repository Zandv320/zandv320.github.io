/* Runeveld – spelgegevens: klasse, vaardigheden, uitrusting, monsters, levels. */

export const KLASSE={
  naam:'Zwaardvechter',
  snelheid:4.6,          /* eenheden per seconde */
  bereik:1.5,            /* aanvalsbereik */
  aanvalTijd:.9,         /* seconden tussen gewone slagen */
  hpMax:l=>60+l*14,
  spMax:l=>14+l*5,
  atk:l=>4+l*2,          /* met blote vuisten; het wapen komt erbij */
};

export const MAX_LVL=30;
export const expVoor=l=>Math.round(40*Math.pow(l,1.55));

export const VAARDIGHEDEN={
  beuk:{naam:'Beuk',sp:7,cd:1.6,mult:2.3},
  vuurkring:{naam:'Vuurkring',sp:14,cd:6,mult:1.5,straal:3},
  drank:{naam:'Rode drank',cd:1,heal:45},
};
export const DRANK_PRIJS=25;

/* Uitrusting. `laag` verwijst naar een spritelaag van de held (bladen.js); de slots zijn hoofd, lichaam en wapen.
   Zonder lichaamskleding loopt de held in zijn onderbroek. */
export const SLOTS=[['hoofd','Hoofd'],['lichaam','Lichaam'],['wapen','Wapen']];
export const ITEMS={
  tuniek:{naam:'Gescheurde tuniek',slot:'lichaam',laag:'harnas1',def:2,prijs:30,icoon:'👕'},
  vest:{naam:'Leren vest',slot:'lichaam',laag:'harnas2',def:6,hp:25,prijs:350,icoon:'🦺'},
  harnas:{naam:'Stalen harnas',slot:'lichaam',laag:'harnas3',def:12,hp:70,prijs:1500,icoon:'🛡️'},
  houtzwaard:{naam:'Houten zwaard',slot:'wapen',laag:'wapen1',atk:4,prijs:25,icoon:'🪵'},
  ijzerzwaard:{naam:'IJzeren zwaard',slot:'wapen',laag:'wapen2',atk:11,prijs:400,icoon:'🗡️'},
  staalzwaard:{naam:'Stalen zwaard',slot:'wapen',laag:'wapen3',atk:22,prijs:1800,icoon:'⚔️'},
};
export const STARTUITRUSTING={hoofd:null,lichaam:'tuniek',wapen:'houtzwaard'};
/* wat Koopman Bram verkoopt */
export const WINKEL=['tuniek','houtzwaard','vest','ijzerzwaard','harnas','staalzwaard'];

/* De monsters volgen de dieren uit het Craftpix-pack "Hunt Animals": konijn, vos, everzwijn.
   `buit`: kans per item dat het valt. */
export const MONSTERS={
  konijn:{naam:'Konijn',lvl:1,hp:28,atk:4,exp:11,zeny:[2,7],snelheid:1.8,agressief:false,bereik:1.1,aggro:0,drank:.1,buit:{tuniek:.02}},
  vos:{naam:'Vos',lvl:3,hp:60,atk:8,exp:26,zeny:[6,14],snelheid:2.6,agressief:true,bereik:1.2,aggro:4.5,drank:.15,buit:{vest:.06,ijzerzwaard:.05}},
  zwijn:{naam:'Everzwijn',lvl:6,hp:140,atk:14,exp:62,zeny:[12,30],snelheid:2.2,agressief:true,bereik:1.4,aggro:5,drank:.25,buit:{vest:.1,ijzerzwaard:.08,harnas:.05,staalzwaard:.04}},
};
/* Hoeveel van elk monster er rondlopen; ze spawnen in het veld buiten het plein. */
export const SPAWNS=[{soort:'konijn',n:8},{soort:'vos',n:4},{soort:'zwijn',n:2}];
export const RESPAWN=[9,15];   /* seconden, min en max */
