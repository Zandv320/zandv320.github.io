/* Runeveld – spelregels voor de voortgang van een held: exp en levels, stat- en skillpunten, tas en uitrusting,
   winkel, drankjes, class advancement en quests. Pure functies op een heldrecord c = {naam, klasse, lvl, exp, job, jobexp,
   stats, skills, hp, sp, zeny, uitr, tas, quests}; ze veranderen c en geven true als het mocht. De server draait precies
   deze regels op zijn eigen record, zodat de client niets kan verzinnen; de client doet hetzelfde voor de directe reactie. */
import {KLASSEN,ADVANCEMENT,ITEMS,expVoor,MAX_LVL,TAS_SLOTS,VERKOOPDEEL,MONSTERS,LEGE_UITR} from '../data.js';
import {SKILLS,MAX_JOB_TIER,jobExpVoor,JOB_EXP_DEEL,skillPuntenVoor,skillPuntenBesteed,kanLeren} from './skills.js';
import {basisStats,statKosten,statPuntenVoor,statPuntenBesteed,MAX_STAT,afgeleid,STATS} from './stats.js';
import {QUESTS,status,voltooid} from './quests.js';

export const klasseVan=c=>KLASSEN[c.klasse]||KLASSEN.swordsman;
export const maxJobVan=c=>MAX_JOB_TIER[klasseVan(c).tier]||20;
export const vrijeStat=c=>statPuntenVoor(c.lvl)-statPuntenBesteed(c.stats);
export const vrijeSkill=c=>(klasseVan(c).tier===2?skillPuntenVoor(MAX_JOB_TIER[1]):0)+skillPuntenVoor(c.job)-skillPuntenBesteed(c.skills);
export const draagt=c=>Object.values(c.uitr||{}).map(id=>id&&ITEMS[id]).filter(Boolean);
/* het slot waar dit voorwerp in gaat: een ring in de eerste vrije ringslot (of ring1) */
export const slotVoor=(c,it)=>it.slot==='ring'?(!c.uitr.ring1?'ring1':!c.uitr.ring2?'ring2':'ring1'):it.slot;
export const pastInSlot=(id,slot)=>!!ITEMS[id]&&(ITEMS[id].slot===slot||(ITEMS[id].slot==='ring'&&(slot==='ring1'||slot==='ring2')));
export const afgeleidVan=c=>afgeleid({lvl:c.lvl,stats:c.stats,items:draagt(c),skills:c.skills,klasse:klasseVan(c)});
/* de hoogste klap die deze held met één slag of spreuk kan uitdelen (ruim genomen): meer is bedrog */
export function maxSchade(c){const a=afgeleidVan(c);return Math.round(Math.max(a.atk,a.matk)*7*1.6+50)}

/* ---- tas ---- */
export const tasAantal=(c,id)=>(c.tas||[]).filter(e=>e.id===id).reduce((t,e)=>t+e.n,0);
export function tasToevoegen(c,id,n=1){
  const it=ITEMS[id];if(!it||n<=0)return false;const max=it.stapel||1;if(!c.tas)c.tas=[];
  for(const e of c.tas){if(e.id!==id||e.n>=max)continue;const k=Math.min(n,max-e.n);e.n+=k;n-=k;if(n<=0)return true}
  while(n>0){if(c.tas.length>=TAS_SLOTS)return false;const k=Math.min(n,max);c.tas.push({id,n:k});n-=k}
  return true;
}
export function tasVerwijderen(c,id,n=1){
  if(tasAantal(c,id)<n)return false;
  for(let i=c.tas.length-1;i>=0&&n>0;i--){const e=c.tas[i];if(e.id!==id)continue;const k=Math.min(n,e.n);e.n-=k;n-=k;if(e.n<=0)c.tas.splice(i,1)}
  return true;
}

/* ---- exp, zeny, levels ---- */
export function beloon(c,{exp=0,zeny=0}){
  c.exp+=exp;c.zeny+=zeny;let ups=0,jobUps=0;
  while(c.lvl<MAX_LVL&&c.exp>=expVoor(c.lvl)){c.exp-=expVoor(c.lvl);c.lvl++;ups++}
  const mj=maxJobVan(c);
  if(c.job<mj){c.jobexp+=Math.round(exp*JOB_EXP_DEEL);while(c.job<mj&&c.jobexp>=jobExpVoor(c.job)){c.jobexp-=jobExpVoor(c.job);c.job++;jobUps++}}
  if(ups){const a=afgeleidVan(c);c.hp=a.hpMax;c.sp=a.spMax}
  return{ups,jobUps};
}
export function statOmhoog(c,k){
  if(!STATS.some(([s])=>s===k))return false;const n=c.stats[k]||1,kost=statKosten(n);if(n>=MAX_STAT||vrijeStat(c)<kost)return false;
  c.stats[k]=n+1;c.hp=Math.min(c.hp,afgeleidVan(c).hpMax);return true;
}
export function skillOmhoog(c,id){if(vrijeSkill(c)<=0||!kanLeren(c.skills,id))return false;c.skills[id]=(c.skills[id]||0)+1;return true}
export function advance(c,id){
  const k=KLASSEN[id];if(!k||!(ADVANCEMENT[c.klasse]||[]).includes(id)||c.job<maxJobVan(c))return false;
  c.klasse=id;c.job=1;c.jobexp=0;const a=afgeleidVan(c);c.hp=a.hpMax;c.sp=a.spMax;
  if(k.uitrusting)tasToevoegen(c,k.uitrusting,1);return true;
}

/* ---- uitrusting, winkel, drankjes ---- */
export function uitrusten(c,id){
  const it=ITEMS[id];if(!it||!it.slot)return false;
  if(it.klasse&&it.klasse!==c.klasse&&it.klasse!==klasseVan(c).basis)return false;
  if(!tasVerwijderen(c,id))return false;
  const slot=slotVoor(c,it);const oud=c.uitr[slot];c.uitr[slot]=id;if(oud)tasToevoegen(c,oud,1);
  c.hp=Math.min(c.hp,afgeleidVan(c).hpMax);return true;
}
export function afdoen(c,slot){const id=c.uitr[slot];if(!id)return false;if(!tasToevoegen(c,id))return false;c.uitr[slot]=null;c.hp=Math.min(c.hp,afgeleidVan(c).hpMax);return true}
export function koop(c,id){const it=ITEMS[id];if(!it||!it.prijs||c.zeny<it.prijs)return false;if(!tasToevoegen(c,id))return false;c.zeny-=it.prijs;return true}
export function verkoop(c,id){const it=ITEMS[id];if(!it||!tasVerwijderen(c,id))return false;c.zeny+=Math.floor(it.prijs*VERKOOPDEEL);return true}
export function weggooi(c,id){return !!ITEMS[id]&&tasVerwijderen(c,id)}
export function drink(c,id){const it=ITEMS[id];if(!it||it.gebruik!=='heal')return false;const a=afgeleidVan(c);if(c.hp>=a.hpMax)return false;if(!tasVerwijderen(c,id))return false;c.hp=Math.min(a.hpMax,c.hp+it.heal);return true}

/* ---- quests ---- */
export function questAccepteer(c,id){
  if(!c.quests)c.quests={};if(status(id,c.quests,c.lvl)!=='nieuw')return false;
  c.quests[id]={st:'bezig',n:0};const d=QUESTS[id].doel;if(d.soort==='item')c.quests[id].n=Math.min(d.n,tasAantal(c,d.item));return true;
}
/* voortgang die de server niet zelf kan zien: een npc bezocht of een plek bereikt */
export function questVoortgang(c,id){
  const s=c.quests&&c.quests[id],q=QUESTS[id];if(!s||!q||s.st!=='bezig')return false;
  if((q.doel.soort==='bezoek'||q.doel.soort==='plek')&&!s.n){s.n=1;return true}return false;
}
export function questOpDood(c,soort){let w=false;for(const id in c.quests||{}){const s=c.quests[id],d=QUESTS[id]&&QUESTS[id].doel;if(s&&d&&s.st==='bezig'&&d.soort==='dood'&&d.monster===soort&&s.n<d.n){s.n++;w=true}}return w}
export function questOpTas(c){for(const id in c.quests||{}){const s=c.quests[id],d=QUESTS[id]&&QUESTS[id].doel;if(s&&d&&s.st==='bezig'&&d.soort==='item')s.n=Math.min(d.n,tasAantal(c,d.item))}}
export function questLever(c,id){
  const q=QUESTS[id],s=c.quests&&c.quests[id];if(!q)return false;questOpTas(c);if(!voltooid(id,s))return false;
  if(q.doel.soort==='item'&&!tasVerwijderen(c,q.doel.item,q.doel.n))return false;
  s.st='gedaan';const b=q.beloning;beloon(c,{exp:b.exp,zeny:b.zeny});
  const mag=c.klasse==='mage'||c.klasse==='wizard'||c.klasse==='sage';
  for(const it of b.items||[])tasToevoegen(c,mag&&it.mage?it.mage:it.id,it.n);
  return true;
}

/* ---- een nieuw record en het schoonmaken van een record dat van buiten komt ---- */
export function nieuwRecord({naam,haar,klasse}){
  const k=KLASSEN[klasse]&&KLASSEN[klasse].tier===1?klasse:'swordsman';const c={naam,haar:haar||'standaard',klasse:k,lvl:1,exp:0,job:1,jobexp:0,stats:basisStats(),skills:{},zeny:0,uitr:{...LEGE_UITR(),...KLASSEN[k].start},tas:[{id:'drank',n:5}],quests:{},x:0,z:4};
  const a=afgeleidVan(c);c.hp=a.hpMax;c.sp=a.spMax;return c;
}
const int=(v,lo,hi,d=lo)=>{v=Math.round(+v);return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):d};
/* alles wat een held van buiten meebrengt binnen de regels trekken: geldige ids, niet meer punten dan verdiend, geen
   onmogelijke stapels. Wat niet klopt wordt geknipt, niet geweigerd. */
export function schoon(bron){
  const c={};
  c.naam=String(bron.naam||'').slice(0,14).trim()||'Hero';c.haar=typeof bron.haar==='string'?bron.haar.slice(0,16):'standaard';
  c.klasse=KLASSEN[bron.klasse]?bron.klasse:'swordsman';
  c.lvl=int(bron.lvl,1,MAX_LVL,1);c.exp=int(bron.exp,0,expVoor(c.lvl)-1,0);
  c.job=int(bron.job,1,maxJobVan(c),1);c.jobexp=int(bron.jobexp,0,jobExpVoor(c.job)-1,0);
  c.stats=basisStats();for(const[k]of STATS)c.stats[k]=int(bron.stats&&bron.stats[k],1,MAX_STAT,1);
  while(statPuntenBesteed(c.stats)>statPuntenVoor(c.lvl)){const k=STATS.map(([s])=>s).reduce((a,b)=>c.stats[a]>=c.stats[b]?a:b);if(c.stats[k]<=1)break;c.stats[k]--}
  c.skills={};for(const[id,l]of Object.entries(bron.skills||{}))if(SKILLS[id])c.skills[id]=int(l,0,SKILLS[id].max,0);
  for(const id in c.skills)if(!c.skills[id])delete c.skills[id];
  while(skillPuntenBesteed(c.skills)>Math.max(0,vrijeSkill({...c,skills:{}}))){const id=Object.keys(c.skills).reduce((a,b)=>c.skills[a]>=c.skills[b]?a:b);c.skills[id]--;if(!c.skills[id])delete c.skills[id]}
  c.zeny=int(bron.zeny,0,99999999,0);
  c.uitr=LEGE_UITR();for(const slot in c.uitr){const id=bron.uitr&&bron.uitr[slot];if(id&&pastInSlot(id,slot))c.uitr[slot]=id}
  c.tas=[];for(const e of Array.isArray(bron.tas)?bron.tas:[]){if(!e||!ITEMS[e.id])continue;tasToevoegen(c,e.id,int(e.n,1,ITEMS[e.id].stapel||1,1))}
  c.quests={};for(const[id,s]of Object.entries(bron.quests||{}))if(QUESTS[id]&&s&&(s.st==='bezig'||s.st==='gedaan'))c.quests[id]={st:s.st,n:int(s.n,0,QUESTS[id].doel.n||1,0)};
  const a=afgeleidVan(c);c.hp=int(bron.hp,1,a.hpMax,a.hpMax);c.sp=int(bron.sp,0,a.spMax,a.spMax);
  c.x=Number.isFinite(+bron.x)?+(+bron.x).toFixed(2):0;c.z=Number.isFinite(+bron.z)?+(+bron.z).toFixed(2):4;
  return c;
}
/* de velden die de server bepaalt (de client mag ze niet zelf veranderen) */
export const KERN=['klasse','lvl','exp','job','jobexp','stats','skills','zeny','uitr','tas','quests'];
export const monsterBestaat=soort=>!!MONSTERS[soort];
