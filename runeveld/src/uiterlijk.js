/* Runeveld – uiterlijk: herkleuren van haar en kleding op de heldlagen, de lagen van een held met haarkleur,
   en het tekenen van een held op een 2D-canvas (characterscherm, selectiescherm). */
import {BLADEN,heldLagen as basisLagen} from './bladen.js';
import {maakTex,GLAD} from './sprites.js';

/* kleurenpaletten, donker → licht; de bronkleuren zijn die van de sprites */
export const HAAR_BRON=[[33,26,28],[43,32,35],[59,44,51],[77,57,69],[104,79,90],[135,108,125]];
export const HAAR={
  bruin:[[40,24,12],[66,40,20],[96,60,30],[130,86,44],[165,116,66],[196,150,96]],
  blond:[[96,70,20],[140,104,32],[184,140,50],[214,172,78],[236,200,112],[250,226,150]],
  grijs:[[60,60,64],[92,92,98],[124,124,132],[160,160,168],[196,196,204],[226,226,232]],
  zwart:[[14,12,16],[24,20,24],[36,30,36],[50,42,50],[66,56,66],[88,76,88]],
  rood:[[70,22,14],[104,34,20],[140,48,26],[176,68,34],[206,96,52],[230,130,80]],
  blauw:[[22,34,70],[34,52,104],[52,80,146],[76,110,180],[110,146,210],[150,186,232]],
  groen:[[22,54,30],[36,82,44],[54,112,60],[80,144,82],[114,176,112],[156,206,150]],
};
/* de haarkleuren die een speler kan kiezen: 'standaard' is het paarsgrijze haar van de sprite zelf */
export const HAARKEUZE=[['standaard','Plum',[104,79,90]],['bruin','Brown',[130,86,44]],['blond','Blond',[214,172,78]],['zwart','Black',[50,42,50]],['rood','Red',[176,68,34]],['grijs','Silver',[160,160,168]],['blauw','Blue',[76,110,180]],['groen','Green',[80,144,82]]];
export const TUNIEK_BRON=[[45,49,43],[63,67,61],[94,97,90],[111,115,106],[134,139,124]];
export const TUNIEK={
  blauw:[[28,42,78],[42,62,110],[64,92,150],[84,116,176],[118,150,204]],
  rood:[[96,26,22],[132,38,32],[170,54,44],[196,78,62],[222,112,92]],
  groen:[[34,62,28],[50,90,40],[72,122,56],[96,150,74],[132,180,104]],
  creme:[[120,104,72],[160,140,100],[200,180,140],[222,206,168],[240,228,196]],
  grijs:[[52,52,56],[78,78,84],[108,108,116],[136,136,146],[168,168,178]],
};

const cache=new Map();
/* een heldlaag met vervangen kleuren: elke pixel die dicht bij een bronkleur ligt krijgt de doelkleur van dezelfde tint.
   `strak`: alleen exacte treffers (voor helmen, anders kleurt het ijzer mee) */
export function herkleur(laag,bron,doel,naam,strak=false){
  const k=laag+'|'+naam;if(cache.has(k))return cache.get(k);
  const img=BLADEN.held.lagen[laag].image;
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);
  const d=g.getImageData(0,0,c.width,c.height),p=d.data;
  for(let i=0;i<p.length;i+=4){if(p[i+3]===0)continue;
    let best=-1,bd=strak?3*3:48*48;
    for(let j=0;j<bron.length;j++){const b=bron[j],dd=(p[i]-b[0])**2+(p[i+1]-b[1])**2+(p[i+2]-b[2])**2;if(dd<bd){bd=dd;best=j}}
    if(best>=0){p[i]=doel[best][0];p[i+1]=doel[best][1];p[i+2]=doel[best][2]}}
  g.putImageData(d,0,0);
  const t=maakTex(c,GLAD);cache.set(k,t);return t;
}
/* de hoofdlaag (los haar, pet of helm) in een haarkleur */
export function haarLaag(laag,kleur){
  if(!kleur||kleur==='standaard'||!HAAR[kleur])return BLADEN.held.lagen[laag];
  return herkleur(laag,HAAR_BRON,HAAR[kleur],'haar-'+kleur,laag!=='hoofd');
}
/* de lagen van een held: uitrusting (bladen.js) met het haar in de gekozen kleur */
export function heldLagen(uitr,haar){
  const T=BLADEN.held.lagen,lagen=basisLagen(uitr||{});
  if(!haar||haar==='standaard')return lagen;
  return lagen.map(t=>{for(const l of['hoofd','hoofd1','hoofd2','hoed1','hoed2'])if(t===T[l])return haarLaag(l,haar);return t});
}
/* tekent de held op een canvas: alleen het stuk van het frame waar het figuur staat, zodat hij groot in beeld komt.
   t: tijd in seconden voor de animatie; richting: 'onder' (naar de kijker) enz. */
export function tekenHeld(ctx,lagen,t,{anim='idle',richting='onder'}={}){
  const cv=ctx.canvas,b=BLADEN.held,a=b.anims[anim]||b.anims.idle,f=Math.floor(t*a.fps)%a.n;
  const rij=a.rij+(b.richtingen[richting]??0);
  const k=b.fw/64;ctx.imageSmoothingEnabled=k>1;ctx.clearRect(0,0,cv.width,cv.height);
  for(const tex of lagen)ctx.drawImage(tex.image,f*b.fw+14*k,rij*b.fh+10*k,36*k,40*k,0,0,cv.width,cv.height);
}
