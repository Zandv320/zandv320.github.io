/* Runeveld – spritesheets (Craftpix-freebies, geknipt door tools/maak_sprites.py).
   Elk blad beschrijft waar in de afbeelding welke animatie staat:
     fw/fh      framegrootte in pixels
     schaal     wereld-eenheden per pixel (1/16: 16 px = 1 eenheid, zie world.js)
     voet       pixels tussen de onderkant van het frame en de voeten
     hoogte     hoogte van het figuur in pixels (voor naamlabels)
     richtingen rij-offset per kijkrichting; ontbreekt een richting, dan wordt de tegenovergestelde gespiegeld
     anims      rij (eerste rij van de animatie), n frames, fps, eens (speelt één keer), perRichting (false: één rij) */
import {laadTextuur} from './sprites.js';

const HELD_RICHTINGEN={onder:0,links:1,rechts:2,boven:3};
const DIER_RICHTINGEN={onder:0,boven:1,links:2,rechts:3};

/* De zwaardvechter heeft drie uiterlijken: beginneling, vechter, held. */
function held(n){return{url:`sprites/zwaardvechter${n}.png`,fw:64,fh:64,schaal:1/16,voet:20,hoogte:26,richtingen:HELD_RICHTINGEN,
  anims:{idle:{rij:0,n:12,fps:8},loop:{rij:4,n:8,fps:13},aanval:{rij:8,n:8,fps:16,eens:true},pijn:{rij:12,n:5,fps:12,eens:true},dood:{rij:16,n:7,fps:9,eens:true}}}}
function dier(naam,{loop,aanval,schaal=1/16,hoogte=20}){return{url:`sprites/${naam}.png`,fw:32,fh:32,schaal,voet:4,hoogte,richtingen:DIER_RICHTINGEN,
  anims:{idle:{rij:0,n:4,fps:5},loop:{rij:4,n:loop,fps:10},aanval:{rij:8,n:aanval,fps:12,eens:true},pijn:{rij:12,n:4,fps:10,eens:true},dood:{rij:16,n:6,fps:8,eens:true}}}}

export const BLADEN={
  zwaardvechter1:held(1),zwaardvechter2:held(2),zwaardvechter3:held(3),
  koopman:{url:'sprites/koopman.png',fw:32,fh:32,schaal:1/16,voet:2,hoogte:28,richtingen:{onder:0},anims:{idle:{rij:0,n:4,fps:5,perRichting:false}}},
  konijn:dier('konijn',{loop:5,aanval:6,hoogte:19}),
  vos:dier('vos',{loop:6,aanval:6,hoogte:20}),
  zwijn:dier('zwijn',{loop:6,aanval:5,schaal:1/14,hoogte:22}),
};

/* welk uiterlijk hoort bij een level */
export function heldBlad(lvl){return BLADEN[lvl>=15?'zwaardvechter3':lvl>=6?'zwaardvechter2':'zwaardvechter1']}

/* laadt de texturen van alle bladen */
export async function laadBladen(){
  await Promise.all(Object.values(BLADEN).map(async b=>{b.tex=await laadTextuur(b.url);if(!b.tex)throw new Error('Sprite ontbreekt: '+b.url)}));
  return BLADEN;
}
