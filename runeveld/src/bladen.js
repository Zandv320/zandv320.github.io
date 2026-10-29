/* Runeveld – spritesheets (Craftpix-freebies, geknipt door tools/maak_sprites.py).
   Elk blad beschrijft waar in de afbeelding welke animatie staat:
     fw/fh      framegrootte in pixels
     schaal     wereld-eenheden per pixel (1/16: 16 px = 1 eenheid, zie world.js)
     voet       pixels tussen de onderkant van het frame en de voeten
     hoogte     hoogte van het figuur in pixels (voor naamlabels)
     richtingen rij-offset per kijkrichting; ontbreekt een richting, dan wordt de tegenovergestelde gespiegeld
     anims      rij (eerste rij van de animatie), n frames, fps, eens (speelt één keer), perRichting (false: één rij)
   De held bestaat uit lagen met dezelfde indeling: lijf, kleding, hoofd en wapen (zie heldLagen). */
import {laadTextuur,FACTOR} from './sprites.js';
import {ITEMS} from './data.js';

const HELD_RICHTINGEN={onder:0,links:1,rechts:2,boven:3};
const DIER_RICHTINGEN={onder:0,boven:1,links:2,rechts:3};

function dier(naam,{loop,aanval,schaal=1/16,hoogte=20}){return{url:`sprites/${naam}.png`,fw:32,fh:32,schaal,voet:4,hoogte,richtingen:DIER_RICHTINGEN,
  anims:{idle:{rij:0,n:4,fps:5},loop:{rij:4,n:loop,fps:10},aanval:{rij:8,n:aanval,fps:12,eens:true},pijn:{rij:12,n:4,fps:10,eens:true},dood:{rij:16,n:6,fps:8,eens:true}}}}

export const BLADEN={
  held:{fw:64,fh:64,schaal:1/16,voet:20,hoogte:26,richtingen:HELD_RICHTINGEN,
    lagen:{lijf:'sprites/held_lijf.png',hoofd:'sprites/held_hoofd.png',harnas1:'sprites/harnas1.png',harnas2:'sprites/harnas2.png',harnas3:'sprites/harnas3.png',
      wapen1:'sprites/wapen1.png',wapen2:'sprites/wapen2.png',wapen3:'sprites/wapen3.png',wapen1b:'sprites/wapen1b.png',wapen2b:'sprites/wapen2b.png',wapen3b:'sprites/wapen3b.png',hoofd1:'sprites/hoofd1.png',hoofd2:'sprites/hoofd2.png',gewaad1:'sprites/gewaad1.png',gewaad2:'sprites/gewaad2.png',gewaad3:'sprites/gewaad3.png',staf1:'sprites/staf1.png',staf1b:'sprites/staf1b.png',staf2:'sprites/staf2.png',staf2b:'sprites/staf2b.png',staf3:'sprites/staf3.png',staf3b:'sprites/staf3b.png',hoed1:'sprites/hoed1.png',hoed2:'sprites/hoed2.png',harnas4:'sprites/harnas4.png',harnas5:'sprites/harnas5.png',gewaad4:'sprites/gewaad4.png',gewaad5:'sprites/gewaad5.png'},
    anims:{idle:{rij:0,n:12,fps:8},loop:{rij:4,n:8,fps:13},aanval:{rij:8,n:8,fps:16,eens:true},pijn:{rij:12,n:5,fps:12,eens:true},dood:{rij:16,n:7,fps:9,eens:true}}},
  koopman:{url:'sprites/koopman.png',fw:32,fh:32,schaal:1/16,voet:2,hoogte:28,richtingen:{onder:0},anims:{idle:{rij:0,n:4,fps:5,perRichting:false}}},
  konijn:dier('konijn',{loop:5,aanval:6,hoogte:19}),
  vos:dier('vos',{loop:6,aanval:6,hoogte:20}),
  zwijn:dier('zwijn',{loop:6,aanval:5,schaal:1/14,hoogte:22}),
  /* bosdieren: het hert rent als 'aanval' (een stoot met het gewei), de wolf en het reuzenzwijn zijn groter */
  hert:dier('hert',{loop:6,aanval:6,schaal:1/15,hoogte:26}),
  wolf:dier('wolf',{loop:6,aanval:6,schaal:1/13,hoogte:22}),
  everzwijn:dier('everzwijn',{loop:6,aanval:5,schaal:1/11,hoogte:26}),
};

/* De laagnamen van een held met deze uitrusting ({hoofd,lichaam,wapen}: item-ids of null), achterste eerst.
   Een hoofddeksel is een complete hoofdlaag (hoofd + deksel, haar eronder weggehaald) en vervangt 'hoofd'. */
export function heldLaagNamen(uitr){
  const w=uitr.wapen&&ITEMS[uitr.wapen],l=uitr.lichaam&&ITEMS[uitr.lichaam],h=uitr.hoofd&&ITEMS[uitr.hoofd];
  return[w&&w.laag+'b','lijf',l&&l.laag,h?h.laag:'hoofd',w&&w.laag].filter(Boolean);
}
/* De texturen van die lagen. Lagen die nog niet geladen zijn worden nu aangevraagd en ontbreken even;
   via opLaagGeladen() hoort het spel wanneer ze er zijn en zet het de sprites opnieuw. Zonder kleding staat de
   held in zijn onderbroek. */
export function heldLagen(uitr){
  const T=BLADEN.held.lagen;
  return heldLaagNamen(uitr).map(n=>{if(!T[n])laadLaag(n);return T[n]}).filter(Boolean);
}

/* Alleen de lagen die bij de start nodig zijn (lijf, hoofd, de dorpelingen) worden meteen geladen; de rest
   (harnassen, gewaden, staven, zwaarden, hoeden) pas als iemand ze draagt. Elke laag is in de gladde modus
   ruim 15 MB aan textuurgeheugen, en telefoons crashen als ze allemaal tegelijk geladen worden. */
const BASIS=['lijf','hoofd','harnas1','harnas2','hoofd1','hoofd2','wapen1','wapen1b','wapen2','wapen2b'];
const laagUrls={},laagBezig={},luisteraars=[];
export function opLaagGeladen(cb){luisteraars.push(cb)}
export function laadLaag(naam){
  const T=BLADEN.held.lagen;if(T[naam])return Promise.resolve(T[naam]);
  if(laagBezig[naam])return laagBezig[naam];
  const url=laagUrls[naam];if(!url)return Promise.resolve(null);
  return laagBezig[naam]=laadTextuur(url).then(t=>{if(!t)throw new Error('Sprite ontbreekt: '+url);T[naam]=t;delete laagBezig[naam];for(const cb of luisteraars)cb(naam);return t});
}
export const laadLagenVoor=uitr=>Promise.all(heldLaagNamen(uitr).map(laadLaag));

/* laadt de texturen van alle bladen (de held: alleen de basislagen) */
export async function laadBladen(){
  const laad=async url=>{const t=await laadTextuur(url);if(!t)throw new Error('Sprite ontbreekt: '+url);return t};
  await Promise.all(Object.values(BLADEN).map(async b=>{
    /* in de gladde modus zijn de sheets FACTOR keer groter: framegrootte mee schalen, wereldschaal terug */
    if(!b.geschaald){b.geschaald=true;b.fw*=FACTOR;b.fh*=FACTOR;b.voet=(b.voet||0)*FACTOR;b.hoogte=(b.hoogte||b.fh/FACTOR)*FACTOR;b.schaal/=FACTOR}
    if(b.url)b.tex=await laad(b.url);
    if(b.lagen&&typeof Object.values(b.lagen)[0]==='string'){Object.assign(laagUrls,b.lagen);const t={};b.lagen=t;
      await Promise.all(BASIS.map(async k=>{t[k]=await laad(laagUrls[k])}));b.tex=t.lijf}
  }));
  return BLADEN;
}
