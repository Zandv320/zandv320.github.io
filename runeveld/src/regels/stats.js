/* Runeveld – spelregels: stats en afgeleide waarden.
   Pure functies zonder browser- of netwerkcode, zodat een server later dezelfde regels kan draaien. */
import {SKILLS} from './skills.js';

export const STATS=[
  ['str','STR','Strength: more attack power'],
  ['agi','AGI','Agility: dodge and attack faster'],
  ['vit','VIT','Vitality: more HP, defense and HP recovery'],
  ['int','INT','Intelligence: more SP, SP recovery, magic attack and a stronger Magnum Break'],
  ['dex','DEX','Dexterity: hit chance and some attack power'],
  ['luk','LUK','Luck: chance of critical hits'],
];
export const MAX_STAT=99;
export const basisStats=()=>({str:1,agi:1,vit:1,int:1,dex:1,luk:1});

/* kosten in statpunten om een stat van n naar n+1 te brengen (zoals in RO: elke 10 punten een punt duurder) */
export const statKosten=n=>Math.floor((n-1)/10)+2;
/* statpunten die een speler in totaal heeft verdiend op dit basislevel */
export function statPuntenVoor(lvl){let p=10;for(let l=2;l<=lvl;l++)p+=3+Math.floor(l/5);return p}
/* statpunten die al zijn uitgegeven aan deze stats */
export function statPuntenBesteed(stats){let p=0;for(const[k]of STATS)for(let n=1;n<(stats[k]||1);n++)p+=statKosten(n);return p}

/* Alles wat uit level, stats, uitrusting en passieve skills volgt.
   items: lijst met gedragen voorwerpen ({atk,def,hp}); skills: {id: level} */
export function afgeleid({lvl,stats,items=[],skills={},klasse={hp:1,sp:1}}){
  const s={...basisStats(),...stats};
  const som=k=>items.reduce((t,it)=>t+(it[k]||0),0);
  const pas=(id,fn)=>{const sk=SKILLS[id];const l=skills[id]||0;return sk&&l>0&&sk[fn]?sk[fn](l):0};
  const hpMax=Math.round((50+lvl*12+s.vit*6)*(1+s.vit/100)*(klasse.hp||1))+som('hp');
  const spMax=Math.round((10+lvl*3+s.int*4)*(klasse.sp||1))+som('sp');
  const atk=Math.round(3+lvl*1.5+s.str*1.2+s.dex*.3+som('atk')+pas('zwaardbeheersing','atk'));
  const matk=Math.round(4+lvl*1.2+s.int*2+s.dex*.2+som('matk')+pas('stafbeheersing','matk'));
  const def=Math.round(som('def')+s.vit*.4);
  return{
    hpMax,spMax,atk,matk,def,
    hit:20+lvl+s.dex,                           /* raakkans tegen het ontwijken van het doel */
    flee:lvl+s.agi,                             /* ontwijken */
    crit:Math.min(50,s.luk*.3),                 /* kans op kritieke treffer, in procenten */
    aanvalTijd:Math.max(.4,.9-s.agi*.006),      /* seconden tussen gewone slagen */
    hpRegen:(1+lvl*.3+s.vit*.2)*(1+pas('hpherstel','regen')),   /* per seconde, staand */
    spRegen:(1+lvl*.2+s.int*.3)*(1+pas('meditatie','regen')),
    skillBonus:1+s.int/100,                     /* extra schade van Vuurkring */
  };
}
