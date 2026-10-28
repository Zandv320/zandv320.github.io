/* Runeveld – spelgegevens: klasse, vaardigheden, monsters, levels. */

export const KLASSE={
  naam:'Zwaardvechter',
  snelheid:4.6,          /* eenheden per seconde */
  bereik:1.5,            /* aanvalsbereik */
  aanvalTijd:.9,         /* seconden tussen gewone slagen */
  hpMax:l=>60+l*14,
  spMax:l=>14+l*5,
  atk:l=>7+l*2.2,
};

export const MAX_LVL=30;
export const expVoor=l=>Math.round(40*Math.pow(l,1.55));

export const VAARDIGHEDEN={
  beuk:{naam:'Beuk',sp:7,cd:1.6,mult:2.3},
  vuurkring:{naam:'Vuurkring',sp:14,cd:6,mult:1.5,straal:3},
  drank:{naam:'Rode drank',cd:1,heal:45},
};
export const DRANK_PRIJS=25;

/* De monsters volgen de dieren uit het Craftpix-pack "Hunt Animals": konijn, vos, everzwijn. */
export const MONSTERS={
  konijn:{naam:'Konijn',lvl:1,hp:28,atk:4,exp:11,zeny:[2,7],snelheid:1.8,agressief:false,bereik:1.1,aggro:0,drank:.1},
  vos:{naam:'Vos',lvl:3,hp:60,atk:8,exp:26,zeny:[6,14],snelheid:2.6,agressief:true,bereik:1.2,aggro:4.5,drank:.15},
  zwijn:{naam:'Everzwijn',lvl:6,hp:140,atk:14,exp:62,zeny:[12,30],snelheid:2.2,agressief:true,bereik:1.4,aggro:5,drank:.25},
};
/* Hoeveel van elk monster er rondlopen; ze spawnen in het veld buiten het plein. */
export const SPAWNS=[{soort:'konijn',n:8},{soort:'vos',n:4},{soort:'zwijn',n:2}];
export const RESPAWN=[9,15];   /* seconden, min en max */
