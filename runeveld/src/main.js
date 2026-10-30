/* Runeveld – hoofdspel: speler, monsters, gevechten, levels, multiplayer, invoer. */
import * as THREE from 'three';
import {KLASSEN,ADVANCEMENT,MAX_LVL,expVoor,MONSTERS,SPAWNS,RESPAWN,ITEMS,STARTUITRUSTING,STARTTAS,TAS_SLOTS,VERKOOPDEEL,WINKELS} from './data.js';
import {maakInventaris} from './inventaris.js';
import {maakAdmin} from './admin.js';
import {maakDorpelingen,updateDorpelingen,spreek,dorpelingen,groet,toonDorpelingen} from './dorpelingen.js';
import {maakQuests} from './quests.js';
import {maakDialoog} from './dialoog.js';
import {BOS,inBos,BOS_PLEK,afstandTotPad,VALE,inVale,inVeld,STAD,inStad,inKasteel,KASTEEL,KAMP,KONINGSWEG} from './gebied.js';
import {maakKaart} from './kaart.js';
import {maakDaglicht,daglicht,klokTekst,zetTijd,isNacht} from './daglicht.js';
import {maakFx} from './fx.js';
import {wek as wekGeluid,G,isAan as geluidAan,zetAan as zetGeluid} from './geluid.js';
import {basisStats,afgeleid,statKosten,statPuntenVoor,statPuntenBesteed,MAX_STAT} from './regels/stats.js';
import {ico} from './iconen.js';
import {SKILLS,SKILLS_VAN,MAX_JOB,MAX_JOB_TIER,jobExpVoor,JOB_EXP_DEEL,skillPuntenVoor,skillPuntenBesteed,kanLeren} from './regels/skills.js';
import {slag as regelSlag,spreuk,naVerdediging,raakKans,monsterGevecht} from './regels/gevecht.js';
import {BLADEN,laadBladen,laadLagenVoor,opLaagGeladen} from './bladen.js';
import {heldLagen,tekenHeld,herkleur,HAAR_BRON,HAAR} from './uiterlijk.js';
import {maakSelectie,PODIUM} from './selectie.js';
import {maakKarakter} from './karakter.js';
import {Sprite2D} from './sprites.js';
import {renderer,scene,camera,cam,updateCamera,zetZoom,ZOOMS,bouwWereld,botsing,vrij,VELD,DORP,PLEIN,inDorp,canvas,grondPunt,straal,updateBorden,obstakels,schud,borden,binnenWereld,zon,hemi,volgZon} from './world.js';
import {maakNet} from './net.js';
import * as UI from './ui.js';

const $=UI.$;
const isTouch=matchMedia('(pointer:coarse)').matches;if(isTouch)document.body.classList.add('touch');
const SLEUTEL='runeveld.save.v1';
const R=(a,b)=>a+Math.random()*(b-a);
const nu=()=>performance.now()/1000;

/* ====================== toestand ====================== */
const P={naam:'',lvl:1,exp:0,job:1,jobexp:0,stats:basisStats(),skills:{},hp:60,sp:14,zeny:0,x:0,z:4,dood:false,zit:false,uitr:{...STARTUITRUSTING},tas:STARTTAS.map(e=>({...e})),
  quests:{},haar:'standaard',klasse:'swordsman',slot:0,barriereTot:0,sprite:null,label:null,bestemming:null,naarNpc:false,target:null,wacht:null,cd:{},volgendeSlag:0,bezigTot:0,seq:0,anim:'idle',regenT:0,respawnT:0};
const M=new Map();      /* monsters: id → monster */
const S=new Map();      /* andere spelers: peer-id → speler */
const klikbaar=[];      /* meshes waar je op kunt klikken */
let stdPx=0,stdTilt=0;
let net=null,H=null,npc=null,gestart=false,K=null,I=null,ADM=null,Q=null,DL=null,KT=null,SEL=null,CH=null,DAG=null,FX=null;
/* schakelaars voor het admin-paneel (admin.js) */
const ADMIN={god:false,snelheid:1,bevroren:false,noclip:false,expMult:1,dropMult:1};
/* alles wat uit level, stats, uitrusting en skills volgt (regels/stats.js) */
const draagt=()=>Object.values(P.uitr).map(id=>id&&ITEMS[id]).filter(Boolean);
const klasse=()=>KLASSEN[P.klasse]||KLASSEN.swordsman;
const maxJob=()=>MAX_JOB_TIER[klasse().tier]||MAX_JOB;
const balk=()=>SKILLS_VAN[P.klasse]?SKILLS_VAN[P.klasse].balk:SKILLS_VAN.swordsman.balk;
const af=()=>afgeleid({lvl:P.lvl,stats:P.stats,items:draagt(),skills:P.skills,klasse:klasse()});
const hpMax=()=>af().hpMax,spMax=()=>af().spMax;
const vrijeStat=()=>statPuntenVoor(P.lvl)-statPuntenBesteed(P.stats),vrijeSkill=()=>(klasse().tier===2?skillPuntenVoor(MAX_JOB_TIER[1]):0)+skillPuntenVoor(P.job)-skillPuntenBesteed(P.skills);   /* na de advancement blijven de punten van de eerste klasse */

/* ====================== opstarten ====================== */
async function init(){
  await laadBladen();await bouwWereld();maakNpc();maakDorpelingen(scene,klikbaar);toonNpcs(false);
  FX=await maakFx({scene});
  /* dag en nacht: lantaarns en het altaar geven 's nachts licht */
  const lichten=borden.filter(b=>b.naam==='lantaarn').map(b=>({x:b.x,z:b.z,y:1.1,r:4.5,kleur:[255,210,130],sterkte:.85}));
  lichten.push({x:BOS_PLEK[0],z:BOS_PLEK[1],y:1.2,r:6.5,kleur:[170,120,255],sterkte:.7});
  /* vuren: het kampvuur van de bandieten en de vuurkorven bij de slotpoort; ze branden altijd */
  const vuren=[[KAMP[0],KAMP[1],1.7],[KASTEEL.x1+2.6,-5.2,1.1],[KASTEEL.x1+2.6,5.2,1.1]];
  for(const[x,z,g]of vuren){FX.speel('vuur',x,z,{grootte:g,voet:true,loop:true});lichten.push({x,z,y:.8,r:3.5*g,kleur:[255,160,80],sterkte:.9})}
  DAG=maakDaglicht({scene,camera,renderer,zon,hemi,lichten});
  $('#laden').classList.add('weg');
  addEventListener('pointerdown',wekGeluid,{capture:true});addEventListener('keydown',wekGeluid,{capture:true});
  CH=leesChars();
  SEL=maakSelectie({chars:()=>CH.lijst,bewaar:()=>schrijfChars(CH),start:i=>start(i),laatst:()=>CH.laatst,inDorp,scene,cam,camera});
  /* het selectiescherm kijkt ingezoomd naar het podium; bij Enter World gaat de camera terug naar de normale stand */
  stdPx=cam.px;stdTilt=cam.tilt;zetZoom(ZOOMS[Math.min(ZOOMS.length-1,ZOOMS.indexOf(stdPx)+2)]);cam.yaw=PODIUM.yaw;cam.tilt=THREE.MathUtils.degToRad(PODIUM.tilt);const d0=SEL.cameraDoel();cam.doel.set(d0[0],d0[1],d0[2]);
  invoer();loop();SEL.toon();
}
/* de wereld in met held nummer i uit de lijst; een held zonder level is nieuw */
async function start(i){
  const save=CH.lijst[i];P.slot=i;P.naam=save.naam;P.haar=save.haar||'standaard';P.klasse=KLASSEN[save.klasse]?save.klasse:'swordsman';P.uitr={...klasse().start};CH.laatst=i;schrijfChars(CH);
  bouwBalk();
  zetZoom(stdPx);cam.yaw=0;cam.tilt=stdTilt;toonNpcs(true);
  if(save.lvl){Object.assign(P,{lvl:save.lvl,exp:save.exp,zeny:save.zeny,x:save.x,z:save.z});
    if(save.uitr)P.uitr={hoofd:null,lichaam:null,wapen:null,...save.uitr};
    if(Array.isArray(save.tas)){P.tas=[];for(const e of save.tas){if(typeof e==='string')tasToevoegen(e,1,true);else if(e&&ITEMS[e.id])tasToevoegen(e.id,e.n|0,true)}}
    if(save.dranken>0)tasToevoegen('drank',save.dranken,true);   /* oude opslag: drankjes als los getal */
    if(save.quests&&typeof save.quests==='object')P.quests=save.quests;
    if(!binnenWereld(P.x,P.z,1)){P.x=0;P.z=4}
    for(const k in P.uitr)if(P.uitr[k]&&!ITEMS[P.uitr[k]])P.uitr[k]=null;
    if(save.stats)P.stats={...basisStats(),...save.stats};if(save.skills)P.skills=save.skills;
    P.job=Math.min(maxJob(),save.job||Math.min(maxJob(),save.lvl));P.jobexp=save.jobexp||0;
    P.hp=Math.min(save.hp,hpMax());P.sp=Math.min(save.sp,spMax())}
  else{P.hp=hpMax();P.sp=spMax()}
  await laadLagenVoor(P.uitr);   /* de kleding van deze held: pas nu laden */
  const naam=P.naam;P.sprite=new Sprite2D(BLADEN.held,{lagen:heldLagen(P.uitr,P.haar)});scene.add(P.sprite.g);
  opLaagGeladen(()=>{if(P.sprite)P.sprite.zetLagen(heldLagen(P.uitr,P.haar));for(const s of S.values())s.sprite.zetLagen(heldLagen(s.pres.u||{},s.pres.h))});
  K=maakKarakter(P,{af,klasse,maxJob,skillVolgorde:()=>(SKILLS_VAN[P.klasse]||SKILLS_VAN.swordsman).volgorde,expMax:()=>expVoor(P.lvl),vrijeStat,vrijeSkill,statOmhoog,skillOmhoog,uitrusten,afdoen,koop,openInventaris:()=>I.toon(),winkelDicht:()=>I.render(),questLijst:()=>Q?Q.lijst():[],questsKlaar:()=>Q?Q.klaarAantal():0});
  I=maakInventaris(P,{uitrusten,gebruik:id=>{if(id==='drank')vaardigheid('drank')},verkoop,weggooi,winkelOpen:()=>K.winkelOpen()});
  ADM=maakAdmin({P,M,S,cam,camera,scene,renderer,ADMIN,zetZoom,net:()=>net,isHost:()=>!!H,
    tasToevoegen,zetLevel,zetJob,respec,teleport,spawnMonster,doodMonster,doodAlles,herleefAlles,vernieuwUiterlijk,bewaar,
    herstel:()=>{P.hp=hpMax();P.sp=spMax();K.render()},exportSave:()=>JSON.stringify(CH.lijst[P.slot]),importSave:s=>{gestart=false;CH.lijst[P.slot]={...JSON.parse(s),naam:P.naam};schrijfChars(CH);location.reload()},
    resetSave:()=>{gestart=false;CH.lijst.splice(P.slot,1);CH.laatst=0;schrijfChars(CH);location.reload()},tijd:()=>24,zetTijd,af,obstakels,render:()=>{K.render();I.render()}});
  P.label=UI.maakLabel('speler',naam);
  Q=maakQuests(P,{tasAantal,tasVerwijderen,tasToevoegen,beloning:d=>beloning({...d,buit:null}),render:()=>{K.render();I.render()},fx:naam=>FX.speel(naam,P.x,P.z,{grootte:2.6,voet:true,volg:P,tint:0xffe6a0}),
    elkeNpc:f=>{f('Merchant Bram',npc.label);for(const n of dorpelingen())f(n.spec.naam,n.label)}});
  DL=maakDialoog(Q,{openWinkel,advancementOpties,advance,klasseNaam:id=>KLASSEN[id]});Q.vernieuw();
  KT=maakKaart({scene,borden,P,M,S,VELD,DORP,PLEIN,inDorp,npcs:()=>[npc,...dorpelingen().map(n=>({naam:n.spec.naam,x:n.x,z:n.z,label:n.label}))],
    loopNaar:(x,z)=>{if(P.dood||!binnenWereld(x,z))return false;DL.sluit();P.bestemming=[x,z];P.naarNpc=false;P.target=null;P.wacht=null;UI.doelkader(null);if(P.zit)zitten(false);ring(x,z,0xffffff,.5,.1,.35,.7);return true}});
  $('#start').hidden=true;$('#hud').hidden=false;
  UI.sys(save.lvl?`Welcome back, ${naam}!`:`Welcome to Eldoria, ${naam}! The village of Runeveld is safe; the monsters roam the fields beyond the gates. Merchant Bram at the stall sells potions and gear. Old Mette by the well is looking for you.`);
  if(P.klasse==='mage'&&!save.lvl)UI.sys('As a Mage you fight from a distance: click a monster and press 1 for Ember Bolt.');
  if(vrijeStat()>0||vrijeSkill()>0)UI.log(`<span class="lvl">You have ${vrijeStat()} stat points and ${vrijeSkill()} skill points to spend. Press C.</span>`);
  gestart=true;startNet();
  setInterval(bewaar,5000);addEventListener('pagehide',bewaar);
}
/* npc's en dorpelingen alleen in de echte wereld, niet op het selectiescherm */
function toonNpcs(aan){npc.sprite.g.visible=aan;npc.label.el.hidden=!aan;toonDorpelingen(aan)}
/* de drie skillknoppen op de balk horen bij de klasse */
function bouwBalk(){
  const b=$('#balk');b.querySelectorAll('.slot[data-skill]').forEach(s=>{if(s.dataset.skill!=='drank'&&s.dataset.skill!=='zit')s.remove()});
  const eerst=b.firstElementChild;
  const n=balk().length;b.classList.toggle('vol',n>6);document.body.classList.toggle('balk2',n>6);
  balk().forEach((id,i)=>{const sk=SKILLS[id],el=document.createElement('button');el.className='slot';el.dataset.skill=id;el.title=`${sk.naam}: ${sk.beschr}`;
    el.innerHTML=`<kbd>${i+1}</kbd><span class="ic">${ico(id,sk.icoon)}</span><span class="nm">${UI.esc(sk.naam.split(' ')[0])}</span><i class="cd"></i>`;
    el.addEventListener('click',()=>vaardigheid(id));b.insertBefore(el,eerst)});
}
function maakNpc(){
  const sprite=new Sprite2D(BLADEN.koopman);sprite.g.position.set(-7.4,0,-3.4);sprite.zetKijk(.3,1);scene.add(sprite.g);
  npc={sprite,label:UI.maakLabel('npc','Merchant Bram'),x:-7.4,z:-3.4};
  sprite.mesh.userData.npc=npc;klikbaar.push(sprite.mesh);obstakels.push({x:npc.x,z:npc.z,r:.4});
}
/* opslag: een lijst helden onder CHARS; de oude opslag met één held (SLEUTEL) wordt de eerste in de lijst */
const CHARS='runeveld.chars.v1';
function lees(){try{const s=JSON.parse(localStorage.getItem(SLEUTEL));return s&&s.naam?s:null}catch(e){return null}}
function leesChars(){
  try{const d=JSON.parse(localStorage.getItem(CHARS));if(d&&Array.isArray(d.lijst))return{lijst:d.lijst.filter(c=>c&&c.naam),laatst:d.laatst|0}}catch(e){}
  const oud=lees();const d={lijst:oud?[oud]:[],laatst:0};schrijfChars(d);return d;
}
function schrijfChars(d){try{localStorage.setItem(CHARS,JSON.stringify(d))}catch(e){}}
function bewaar(){if(!gestart)return;CH.lijst[P.slot]={naam:P.naam,haar:P.haar,klasse:P.klasse,lvl:P.lvl,exp:P.exp,job:P.job,jobexp:P.jobexp,stats:P.stats,skills:P.skills,hp:P.hp,sp:P.sp,zeny:P.zeny,uitr:P.uitr,tas:P.tas,quests:P.quests,x:+P.x.toFixed(2),z:+P.z.toFixed(2)};CH.laatst=P.slot;schrijfChars(CH)}

/* ====================== multiplayer ====================== */
function startNet(){
  net=maakNet();
  net.onHost(v=>{if(v)wordHost();else H=null});
  net.onSpelers((spelers,weg)=>{
    for(const id of weg)verwijderSpeler(id);
    for(const[id,p]of spelers){if(!p||!p.n)continue;let s=S.get(id);
      if(!s){s={sprite:new Sprite2D(BLADEN.held,{lagen:heldLagen(p.u||{},p.h)}),label:UI.maakLabel('ander',p.n),x:p.x||0,z:p.y||0,tx:0,tz:0,pres:p,seq:p.s,bezigTot:0,uKey:JSON.stringify([p.u||{},p.h])};scene.add(s.sprite.g);S.set(id,s);UI.sys(`${p.n} is online.`)}
      const uKey=JSON.stringify([p.u||{},p.h]);if(uKey!==s.uKey){s.uKey=uKey;s.sprite.zetLagen(heldLagen(p.u||{},p.h))}
      s.pres=p;s.tx=p.x||0;s.tz=p.y||0;s.label.naam.textContent=`${p.n} · Lv ${p.l||1}`}
    UI.online(net.verbonden(),net.aantal());
  });
  net.onVerbinding(v=>{UI.online(v,net.aantal());UI.sys(v?'Connected to the world.':'No connection: you are playing alone for now.')});
  net.aan('h',(d,f,isMe)=>{if(H)hostHit(d,f);
    if(!isMe){const m=M.get(d.id);if(m&&!m.dood){UI.getal(m.x,m.sprite.h*.8*m.schaal,m.z,camera,d.dmg,'');const s=S.get(f);klap(m,s?m.x-s.x:0,s?m.z-s.z:1,.25);if(!H)m.hp=Math.max(0,m.hp-d.dmg)}}});
  net.aan('ijs',(d,f)=>{const tot=nu()+(d.duur||1.5);for(const id of d.ids||[]){const m=M.get(id);if(m&&!m.dood)m.ijsTot=tot}});
  net.aan('k',(d,f)=>{if(f!==net.hostId())return;const m=M.get(d.id);if(m)sterfMonster(m);if(d.door===net.me){beloning(d);Q.opDood(d.id.split('#')[0])}});
  net.aan('ma',(d,f)=>{if(f!==net.hostId())return;const m=M.get(d.id);if(m&&!m.dood){m.sprite.speel('aanval',true);m.aanvalT=nu()+.5;const w=d.to===net.me?P:S.get(d.to);if(w)m.sprite.stoot(w.x-m.x,w.z-m.z,.22)}if(d.to===net.me&&m)neemSchade(d.dmg,m.spec,m)});
  net.aan('prov',(d,f)=>{if(!H)return;for(const m of M.values())if(!m.dood&&Math.hypot(m.x-d.x,m.z-d.z)<=d.straal)m.doel=f});
  net.aan('m',(d,f)=>{if(f!==net.hostId()||H)return;snapshot(d)});
  net.aan('c',(d,f,isMe)=>{const s=S.get(f);const naam=isMe?P.naam:(s&&s.pres.n)||'?';UI.chat(naam,d.t);const l=isMe?P.label:s&&s.label;if(l)UI.bubble(l,d.t)});
  UI.online(false,1);
  if(net.isHost())wordHost();   /* alleen in de wereld: meteen host */
}
function verwijderSpeler(id){const s=S.get(id);if(!s)return;s.sprite.verwijder();UI.verwijderLabel(s.label);S.delete(id);UI.sys(`${s.pres.n||'Someone'} left.`)}
let presT=0,lastPres='';
function stuurPresence(){
  const t=nu();if(t-presT<.12)return;
  const p={n:P.naam,h:P.haar,k:P.klasse,l:P.lvl,x:+P.x.toFixed(2),y:+P.z.toFixed(2),kx:+P.sprite.kijk.x.toFixed(2),ky:+P.sprite.kijk.y.toFixed(2),a:P.anim,s:P.seq,hp:Math.round(P.hp),hm:hpMax(),dd:P.dood,zt:P.zit,u:P.uitr};
  const key=JSON.stringify(p);if(key===lastPres)return;lastPres=key;presT=t;net.presence(p,true);
}

/* ====================== monsters ====================== */
function zorgMonster(id){
  let m=M.get(id);if(m)return m;
  const soort=id.split('#')[0],spec=MONSTERS[soort];if(!spec)return null;
  /* bandieten zijn mensen uit de lagen van de held; dieren kunnen een ander blad lenen, groter zijn en een kleur krijgen */
  let lagen=null;if(spec.mens){const T=BLADEN.held.lagen,h=spec.mens;const hoofd=herkleur(h.hoofd||'hoofd',HAAR_BRON,HAAR[h.haar],'haar-'+h.haar,!!h.hoofd);lagen=[h.wapen&&T[h.wapen+'b'],T.lijf,T[h.kleding],hoofd,h.wapen&&T[h.wapen]].filter(Boolean)}
  const schaal=spec.schaal||(spec.mens&&spec.mens.schaal)||1;
  const sprite=new Sprite2D(spec.mens?BLADEN.held:BLADEN[spec.blad||soort],{schaduw:1.1*schaal,lagen});if(schaal!==1)sprite.g.scale.setScalar(schaal);if(spec.tint)sprite.tint(spec.tint);scene.add(sprite.g);
  m={id,spec,sprite,schaal,label:UI.maakLabel('monster',spec.naam),x:0,z:0,tx:0,tz:0,kx:0,kz:1,st:0,hp:spec.hp,hpm:spec.hp,dood:false,hideT:0,aanvalT:0,
     doel:null,cd:0,wt:null,wtT:R(0,3),rt:0,nieuw:true};
  sprite.mesh.userData.m=m;klikbaar.push(sprite.mesh);M.set(id,m);return m;
}
/* een plek in de zone van dit monster: buiten de palissade, op een vrije plek, niet op het pad bij de poorten */
function spawnPunt(spec){
  if(spec.gebied==='kamp'){const[px,pz]=KAMP;for(let i=0;i<80;i++){const a=R(0,Math.PI*2),d=R(2,6),x=px+Math.cos(a)*d,z=pz+Math.sin(a)*d;if(vrij(x,z,.8))return[x,z]}return[px,pz-7]}
  if(spec.gebied==='vale'){for(let i=0;i<160;i++){const x=R(VALE.x0+6,VALE.x1-6),z=R(VALE.z0+6,VALE.z1-6);
      if(!inVale(x,z,3)||inVeld(x,z)||inStad(x,z,-9)||Math.abs(x-STAD.cx)<5&&Math.abs(z)<STAD.z1+10||Math.hypot(x-KAMP[0],z-KAMP[1])<12||!vrij(x,z,.8)||Math.hypot(x-P.x,z-P.z)<6)continue;return[x,z]}return[VALE.cx,VALE.z1-12]}
  if(spec.gebied==='plek'){const[px,pz]=BOS_PLEK;for(let i=0;i<80;i++){const a=R(0,Math.PI*2),d=R(2.6,5.4),x=px+Math.cos(a)*d,z=pz+Math.sin(a)*d;if(vrij(x,z,.8))return[x,z]}return[px,pz-4]}
  if(spec.gebied==='bos'){for(let i=0;i<120;i++){const x=R(BOS.x0+4,BOS.x1-4),z=R(BOS.z0+4,BOS.z1-6);
      if(afstandTotPad(x,z)<3||Math.hypot(x-BOS_PLEK[0],z-BOS_PLEK[1])<10||!vrij(x,z,.8)||Math.hypot(x-P.x,z-P.z)<4)continue;return[x,z]}return[BOS.x0+8,BOS.z1-12]}
  const[min,max]=spec.zone;
  for(let i=0;i<80;i++){const x=R(-max,max),z=R(-max,max),r=Math.max(Math.abs(x),Math.abs(z));
    if(r<min||r>max||inDorp(x,z)||Math.abs(x)<4||!vrij(x,z,.8)||Math.hypot(x-P.x,z-P.z)<4)continue;
    return[x,z]}
  return[max,max];
}
/* mag dit monster hier zwerven? bosdieren blijven in het bos, het reuzenzwijn bij het altaar */
function thuis(spec,x,z){
  if(spec.gebied==='plek')return Math.hypot(x-BOS_PLEK[0],z-BOS_PLEK[1])<8;
  if(spec.gebied==='bos')return inBos(x,z);
  if(spec.gebied==='kamp')return Math.hypot(x-KAMP[0],z-KAMP[1])<9;
  if(spec.gebied==='vale')return inVale(x,z,2)&&!inVeld(x,z)&&!inStad(x,z,-4);
  return !inDorp(x,z)&&Math.abs(x)>=3;
}
/* het gebied waarin een monster een speler blijft achtervolgen */
function jachtgebied(spec,x,z){
  if(spec.gebied==='plek'||spec.gebied==='bos')return inBos(x,z);
  if(spec.gebied==='kamp'||spec.gebied==='vale')return inVale(x,z)&&!inStad(x,z,-3);
  return true;
}
/* veilige plekken: binnen de palissade van Runeveld en binnen de muren van Aurelia */
const veilig=(x,z)=>inDorp(x,z)||inStad(x,z);
function sterfMonster(m){
  if(m.dood)return;m.dood=true;m.hp=0;m.st=3;m.doel=null;const rs=m.spec.respawn||RESPAWN;m.rt=R(rs[0],rs[1]);
  m.sprite.speel('dood',true);m.hideT=nu()+1.6;if(Math.hypot(m.x-P.x,m.z-P.z)<14)G.monsterDood();if(FX)FX.speel('rook',m.x,m.z,{grootte:1.6,voet:true,vertraging:.9});
  if(P.target===m){P.target=null;P.wacht=null;UI.doelkader(null)}
}
function herleefMonster(m,[x,z]){
  m.dood=false;m.hp=m.hpm;m.x=m.tx=x;m.z=m.tz=z;m.doel=null;m.st=0;m.hideT=0;
  m.sprite.g.visible=true;m.label.el.hidden=false;m.sprite.speel('idle',true);
}
function wordHost(){
  H={snapT:0};
  if(M.size===0){for(const s of SPAWNS)for(let i=0;i<s.n;i++){const m=zorgMonster(s.soort+'#'+i);const[x,z]=spawnPunt(m.spec);m.x=m.tx=x;m.z=m.tz=z;m.nieuw=false}}
  else for(const m of M.values()){m.x=m.tx;m.z=m.tz;m.doel=null;if(m.dood&&m.rt<=0){const rs=m.spec.respawn||RESPAWN;m.rt=R(rs[0],rs[1])}}
}
function hostHit(d,f){
  const m=M.get(d.id);if(!m||m.dood)return;
  m.hp=Math.max(0,m.hp-d.dmg);if(!m.doel)m.doel=f;
  if(m.hp<=0){const sp=m.spec;let buit=null;   /* het k-bericht roept meteen sterfMonster aan, dat de dood en de respawntimer regelt */for(const[id,kans]of Object.entries(sp.buit||{}))if(Math.random()<kans*ADMIN.dropMult){buit=id;break}
    net.stuur('k',{id:m.id,door:f,exp:sp.exp,zeny:Math.round(R(sp.zeny[0],sp.zeny[1])),buit})}
}
function hostTick(dt){
  const spelers=[{id:net.me,x:P.x,z:P.z,dood:P.dood}];
  for(const[id,s]of S)spelers.push({id,x:s.x,z:s.z,dood:!!s.pres.dd});
  for(const m of M.values()){
    const sp=m.spec;
    if(m.dood){m.rt-=dt;if(m.rt<=0)herleefMonster(m,spawnPunt(m.spec));continue}
    if(ADMIN.bevroren||nu()<(m.ijsTot||0)){m.st=0;m.tx=m.x;m.tz=m.z;continue}
    let doel=m.doel?spelers.find(s=>s.id===m.doel):null;
    if(doel&&(doel.dood||veilig(doel.x,doel.z)||Math.hypot(doel.x-m.x,doel.z-m.z)>13||!jachtgebied(sp,doel.x,doel.z))){doel=null;m.doel=null}
    const nachtF=isNacht()&&sp.nacht?sp.nacht:null;
    if(!doel&&sp.agressief){let best=null,bd=sp.aggro*(nachtF?nachtF.aggro:1);for(const s of spelers){if(s.dood||veilig(s.x,s.z))continue;const d=Math.hypot(s.x-m.x,s.z-m.z);if(d<bd){bd=d;best=s}}if(best){doel=best;m.doel=best.id}}
    m.cd=Math.max(0,m.cd-dt);
    if(doel){
      const dx=doel.x-m.x,dz=doel.z-m.z,d=Math.hypot(dx,dz)||1e-4;m.kx=dx/d;m.kz=dz/d;
      if(d>sp.bereik){const s=sp.snelheid*(nachtF?nachtF.snelheid:1)*dt;[m.x,m.z]=botsing(m.x+dx/d*s,m.z+dz/d*s,.3);m.st=1}
      else{m.st=0;if(m.cd<=0){m.cd=1.6;net.stuur('ma',{id:m.id,to:doel.id,dmg:Math.round(sp.atk*R(.85,1.15))})}}
    }else{
      m.wtT-=dt;
      if(m.wtT<=0){if(m.wt){m.wt=null;m.wtT=R(1.5,4)}else{const wx=m.x+R(-4,4),wz=m.z+R(-4,4);m.wt=thuis(sp,wx,wz)?[wx,wz]:null;m.wtT=R(2,5)}}
      if(m.wt){const dx=m.wt[0]-m.x,dz=m.wt[1]-m.z,d=Math.hypot(dx,dz);
        if(d<.2){m.wt=null;m.wtT=R(1.5,4);m.st=0}
        else{m.kx=dx/d;m.kz=dz/d;const s=sp.snelheid*.55*dt;const[nx,nz]=botsing(m.x+dx/d*s,m.z+dz/d*s,.3);
          if(Math.hypot(nx-m.x,nz-m.z)<s*.3){m.wt=null;m.wtT=1}m.x=nx;m.z=nz;m.st=1}}
      else m.st=0;
    }
    m.tx=m.x;m.tz=m.z;
  }
  H.snapT-=dt;
  if(H.snapT<=0){H.snapT=.2;net.stuur('m',{l:[...M.values()].map(m=>[m.id,+m.x.toFixed(2),+m.z.toFixed(2),+m.kx.toFixed(2),+m.kz.toFixed(2),m.dood?3:m.st,Math.round(m.hp)])})}
}
function snapshot(d){
  for(const[id,x,z,kx,kz,st,hp]of d.l){const m=zorgMonster(id);if(!m)continue;
    m.tx=x;m.tz=z;m.kx=kx;m.kz=kz;
    if(m.nieuw){m.nieuw=false;m.x=x;m.z=z;if(st===3){m.dood=true;m.sprite.g.visible=false;m.label.el.hidden=true}}
    if(st===3&&!m.dood)sterfMonster(m);else if(st!==3&&m.dood)herleefMonster(m,[x,z]);
    if(!m.dood)m.hp=hp;m.st=st;}
}
function updateMonsters(dt){
  const t=nu();
  for(const m of M.values()){
    if(m.dood){if(m.hideT&&t>m.hideT){m.sprite.g.visible=false;m.label.el.hidden=true;m.hideT=0}
      if(m.sprite.g.visible){m.sprite.update(dt,cam);UI.plaatsLabel(m.label,m.x,m.sprite.h*m.schaal+.1,m.z,camera)}continue}
    if(!H){const k=1-Math.exp(-10*dt);m.x+=(m.tx-m.x)*k;m.z+=(m.tz-m.z)*k}
    m.sprite.g.position.set(m.x,0,m.z);m.sprite.zetKijk(m.kx,m.kz);
    if(t>=m.aanvalT)m.sprite.speel(m.st===1?'loop':'idle');
    const ijs=t<(m.ijsTot||0);if(ijs!==!!m.ijsTint){m.ijsTint=ijs;for(const L of m.sprite.lagen)L.mesh.material.color.set(ijs?0x9ad8ff:0xffffff)}
    m.sprite.update(dt,cam);
    UI.plaatsLabel(m.label,m.x,m.sprite.h*m.schaal+.1,m.z,camera);UI.labelHp(m.label,m.hp,m.hpm,m.hp<m.hpm||P.target===m);
  }
  if(P.target)UI.doelkader(P.target);
}

/* ====================== speler ====================== */
const keys=new Set();
const chatActief=()=>document.activeElement===$('#chattekst');
function zetAnim(naam){if(P.anim===naam)return;P.anim=naam;P.sprite.speel(naam)}
function speelEens(naam,duur){P.anim=naam;P.seq++;P.sprite.speel(naam,true);P.bezigTot=nu()+duur}
function zitten(aan){if(P.dood||P.zit===aan)return;P.zit=aan;if(aan){P.bestemming=null;P.target=null;UI.doelkader(null);zetAnim('zit')}else zetAnim('idle')}

function updateSpeler(dt){
  const t=nu();
  if(P.dood){if(t>P.respawnT)herleef();P.sprite.update(dt,cam);UI.plaatsLabel(P.label,P.x,P.sprite.h+.15,P.z,camera);return}
  const bezig=t<P.bezigTot;
  let mx=0,mz=0;
  if(!chatActief()){
    if(keys.has('KeyW')||keys.has('ArrowUp'))mz-=1;if(keys.has('KeyS')||keys.has('ArrowDown'))mz+=1;
    if(keys.has('KeyA')||keys.has('ArrowLeft'))mx-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))mx+=1;
    if(keys.has('KeyQ'))cam.yaw+=dt*1.8;if(keys.has('KeyE'))cam.yaw-=dt*1.8;
  }
  let dx=0,dz=0;
  if(mx||mz){
    const sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);dx=mz*sy+mx*cy;dz=mz*cy-mx*sy;const l=Math.hypot(dx,dz);dx/=l;dz/=l;
    P.bestemming=null;P.naarNpc=false;if(P.target){P.target=null;P.wacht=null;UI.doelkader(null)}
  }else if(P.target){
    const m=P.target;
    if(m.dood||!m.sprite.g.visible){P.target=null;P.wacht=null;UI.doelkader(null)}
    else{const ddx=m.x-P.x,ddz=m.z-P.z,d=Math.hypot(ddx,ddz);
      const ber=P.wacht&&SKILLS[P.wacht]&&SKILLS[P.wacht].bereik?SKILLS[P.wacht].bereik:klasse().bereik;
      if(d>ber){dx=ddx/d;dz=ddz/d}
      else{P.sprite.zetKijk(ddx,ddz);
        if(P.wacht){const w=P.wacht;P.wacht=null;vaardigheid(w)}
        else if(!bezig&&t>=P.volgendeSlag)slag(m)}}
  }else if(P.bestemming){
    const ddx=P.bestemming[0]-P.x,ddz=P.bestemming[1]-P.z,d=Math.hypot(ddx,ddz);
    if(d<.15){P.bestemming=null;if(P.naarNpc){const f=P.naarNpc;P.naarNpc=false;f()}}else{dx=ddx/d;dz=ddz/d}
  }
  if((dx||dz)&&!bezig){
    if(P.zit)zitten(false);if(DL.isOpen())DL.sluit();
    const s=klasse().snelheid*ADMIN.snelheid*dt;const[nx,nz]=ADMIN.noclip?[Math.max(-VELD+1,Math.min(VELD-1,P.x+dx*s)),Math.max(-VELD+1,Math.min(VELD-1,P.z+dz*s))]:botsing(P.x+dx*s,P.z+dz*s);
    if(P.bestemming&&Math.hypot(nx-P.x,nz-P.z)<s*.2){P.bestemming=null;if(P.naarNpc){const f=P.naarNpc;P.naarNpc=false;f()}}
    P.x=nx;P.z=nz;P.sprite.zetKijk(dx,dz);zetAnim('loop');
  }else if(t>=P.bezigTot)zetAnim(P.zit?'zit':'idle');   /* opnieuw kijken: een slag in dit frame zet bezigTot */
  P.sprite.g.position.set(P.x,0,P.z);P.sprite.update(dt,cam);
  UI.plaatsLabel(P.label,P.x,P.sprite.h+.15,P.z,camera);
  P.regenT+=dt;
  if(P.regenT>=1){P.regenT-=1;const a=af(),f=P.zit?4:1;P.hp=Math.min(a.hpMax,P.hp+a.hpRegen*f);P.sp=Math.min(a.spMax,P.sp+a.spRegen*f)}
}
function slag(m){
  const a=af(),q=nu()<(P.quickenTot||0)?P.quickenF:1;P.volgendeSlag=nu()+a.aanvalTijd*q;speelEens('aanval',Math.min(.45,a.aanvalTijd*q*.8));P.sprite.stoot(m.x-P.x,m.z-P.z,.18);G.zwaai();
  const r=regelSlag(a,monsterGevecht(m.spec));setTimeout(()=>{if(!m.dood)raak(m,r,'')},220);
}
/* een klap op een monster: witte flits, squash en een duw van de aanvaller af */
function klap(m,dx,dz,kracht){
  m.sprite.raak();m.sprite.stoot(dx,dz,kracht);
  if(H&&!m.dood){const l=Math.hypot(dx,dz)||1,nx=m.x+dx/l*kracht*.6,nz=m.z+dz/l*kracht*.6;if(vrij(nx,nz,.4)&&!veilig(nx,nz)){m.x=m.tx=nx;m.z=m.tz=nz}}
}
/* r: uitkomst van regels/gevecht.js slag(); soort: '' voor een gewone slag, anders de skill */
function raak(m,r,soort){
  if(r.mis){UI.getal(m.x,m.sprite.h*.8,m.z,camera,'Miss','mis');G.mis();return}
  UI.getal(m.x,m.sprite.h*.8,m.z,camera,r.crit?r.dmg+'!':r.dmg,r.crit?'crit':soort?'skill':'eigen');
  klap(m,m.x-P.x,m.z-P.z,soort==='rolstoot'?1.2:r.crit?.45:.28);G.raak(r.crit);if(r.crit&&!soort)FX.speel('flits',m.x,m.z,{grootte:1.4,y:.6,tint:0xffe6a0});
  if(r.magie&&P.skills.manaspiegel>0){P.sp=Math.min(spMax(),P.sp+r.dmg*SKILLS.manaspiegel.deel(P.skills.manaspiegel))}if(r.crit)schud(.22,.2);else if(soort)schud(.1,.15);
  if(!H)m.hp=Math.max(0,m.hp-r.dmg);
  net.stuur('h',{id:m.id,dmg:r.dmg});
}
function vaardigheid(id){
  if(P.dood||!gestart)return;const t=nu();
  if(id==='zit'){zitten(!P.zit);return}
  if((P.cd[id]||0)>t)return;
  if(id==='drank'){const V=ITEMS.drank;
    if(tasAantal('drank')<=0){UI.sys('You are out of potions. Merchant Bram at the stall sells them.');return}
    if(P.hp>=hpMax())return;
    tasVerwijderen('drank');G.drank();FX.speel('sprankel',P.x,P.z,{grootte:2,voet:true,volg:P});P.hp=Math.min(hpMax(),P.hp+V.heal);P.cd.drank=t+V.cd;UI.getal(P.x,P.sprite.h,P.z,camera,'+'+V.heal,'heal');K.render();I.render();return;
  }
  const sk=SKILLS[id],l=P.skills[id]||0;if(!sk||sk.passief)return;
  if(l<=0){UI.sys(`You have not learned ${sk.naam} yet. Spend your skill points with C.`);return}
  const a=af(),pas=(id2,fn)=>{const k=SKILLS[id2],n=P.skills[id2]||0;return k&&n>0&&k[fn]?k[fn](n):0};
  const sp=Math.max(0,Math.round(sk.sp(l)*(1-pas('spreukfocus','korting'))));
  if(P.sp<sp){UI.sys('Not enough SP.');return}
  if(id==='beuk'){
    if(!P.target||P.target.dood){UI.sys('Pick a target first: click a monster.');return}
    const m=P.target;if(Math.hypot(m.x-P.x,m.z-P.z)>klasse().bereik){P.wacht='beuk';return}
    P.sp-=sp;P.cd.beuk=t+sk.cd;if(P.zit)zitten(false);
    P.volgendeSlag=t+a.aanvalTijd;speelEens('aanval',.5);P.sprite.zetKijk(m.x-P.x,m.z-P.z);P.sprite.stoot(m.x-P.x,m.z-P.z,.25);G.skill();
    const r=regelSlag({...a,mult:sk.mult(l)},monsterGevecht(m.spec));const stun=!r.mis&&Math.random()<pas('doodslag','kans')?.8:0;
    setTimeout(()=>{if(!m.dood){raak(m,r,'beuk');FX.speel('zwaai',m.x,m.z,{grootte:2.6,y:.8,spiegel:m.x<P.x});FX.speel('golf',m.x,m.z,{grootte:2.2,y:.08,tint:0xdfe6f5,vertraging:.06});if(stun){m.ijsTot=nu()+stun;net.stuur('ijs',{ids:[m.id],duur:stun});FX.speel('vonk',m.x,m.z,{grootte:1.6,y:.8});UI.getal(m.x,m.sprite.h+.3,m.z,camera,'Stun!','mis')}}},220);
  }
  if(id==='vuurkring'){
    P.sp-=sp;P.cd.vuurkring=t+sk.cd;if(P.zit)zitten(false);speelEens('aanval',.6);
    ring(P.x,P.z,0xff8c42,.4,sk.straal,.45,.9);G.skill();schud(.15,.2);FX.speel('vuurkring',P.x,P.z,{grootte:sk.straal*2.3,y:.1});FX.speel('golf',P.x,P.z,{grootte:sk.straal*2.4,y:.08,tint:0xffb060});vuurtjes(P.x,P.z,1.9,4,1.1,'vuurzuil',2.4);FX.speel('zwaai',P.x,P.z,{grootte:3.2,y:1,tint:0xffc080,volg:P});
    setTimeout(()=>{let n=0;for(const m of M.values()){if(m.dood||!m.sprite.g.visible)continue;
      if(Math.hypot(m.x-P.x,m.z-P.z)<=sk.straal){raak(m,regelSlag({...a,hit:999,mult:sk.mult(l)*a.skillBonus},monsterGevecht(m.spec)),'vuurkring');n++}}
      if(!n)UI.sys(sk.naam+' hit nothing.')},200);
  }
  if(id==='vuurpijl'){
    if(!P.target||P.target.dood){UI.sys('Pick a target first: click a monster.');return}
    const m=P.target;if(Math.hypot(m.x-P.x,m.z-P.z)>sk.bereik){P.wacht='vuurpijl';return}
    P.sp-=sp;P.cd.vuurpijl=t+sk.cd;if(P.zit)zitten(false);
    P.volgendeSlag=t+Math.max(a.aanvalTijd,.6);speelEens('aanval',.45);P.sprite.zetKijk(m.x-P.x,m.z-P.z);G.skill();
    const r=spreuk({matk:a.matk,mult:sk.mult(l)});
    projectiel(P.x,P.z,m,0xff8c42,()=>{if(!m.dood){raak(m,r,'vuurpijl');FX.speel('explosie',m.x,m.z,{grootte:2.2,voet:true,y:-.1})}});
  }
  if(id==='vorstnova'){
    P.sp-=sp;P.cd.vorstnova=t+sk.cd;if(P.zit)zitten(false);speelEens('aanval',.6);
    ring(P.x,P.z,0x9ad8ff,.4,sk.straal,.5,.9);G.skill();schud(.12,.2);cirkel(0x9ad8ff,.6);FX.speel('vorstgrond',P.x,P.z,{grootte:sk.straal*2.6,y:.06});scherven(P.x,P.z,sk.straal*.72,5,1.7);even(FX.speel('sneeuw',P.x,P.z,{grootte:sk.straal*2.2,y:1.4,loop:true}),.8);
    setTimeout(()=>{let n=0;const ids=[];for(const m of M.values()){if(m.dood||!m.sprite.g.visible)continue;
      if(Math.hypot(m.x-P.x,m.z-P.z)<=sk.straal){raak(m,spreuk({matk:a.matk,mult:sk.mult(l)}),'vorstnova');m.ijsTot=nu()+sk.bevries(l);ids.push(m.id);n++}}
      if(ids.length)net.stuur('ijs',{ids,duur:sk.bevries(l)});
      if(!n)UI.sys(sk.naam+' hit nothing.')},200);
  }
  if(id==='barriere'){
    P.sp-=sp;P.cd.barriere=t+sk.cd;P.barriereTot=t+sk.duur(l);P.barriereDeel=sk.deel(l);aura(0xd8c0ff);cirkel(0xd8c0ff,.8);FX.speel('knal',P.x,P.z,{grootte:2.4,y:1,tint:0xd8c0ff,volg:P});
    ring(P.x,P.z,0x8ad0ff,.3,1.6,.6,.9);G.skill();UI.sys(`${sk.naam}: ${Math.round(sk.deel(l)*100)}% of damage is taken from your SP for ${sk.duur(l)}s.`);
  }
  /* ---- tweede klassen ---- */
  const doelSlag=(soort,fn)=>{  /* een slag op het doel binnen bereik; fn maakt de uitkomst */
    if(!P.target||P.target.dood){UI.sys('Pick a target first: click a monster.');return false}
    const m=P.target,ber=sk.bereik||klasse().bereik;if(Math.hypot(m.x-P.x,m.z-P.z)>ber){P.wacht=id;return false}
    P.sp-=sp;P.cd[id]=t+sk.cd;if(P.zit)zitten(false);P.volgendeSlag=t+a.aanvalTijd;speelEens('aanval',.5);P.sprite.zetKijk(m.x-P.x,m.z-P.z);G.skill();return m};
  if(id==='doorboor'){const m=doelSlag();if(!m)return;P.sprite.stoot(m.x-P.x,m.z-P.z,.5);FX.speel('boor',P.x+(m.x-P.x)*.55,P.z+(m.z-P.z)*.55,{grootte:1.3,y:.9,hoek:schermHoek(P.x,P.z,m.x,m.z)});
    const r=regelSlag({...a,hit:999,mult:sk.mult(l)},monsterGevecht(m.spec));setTimeout(()=>{if(!m.dood){raak(m,r,'doorboor');FX.speel('golf',m.x,m.z,{grootte:2.4,y:.08,tint:0xdfe6f5});FX.speel('flits',m.x,m.z,{grootte:2,y:.7})}},200)}
  if(id==='heiligkruis'){const m=doelSlag();if(!m)return;P.sprite.stoot(m.x-P.x,m.z-P.z,.25);ring(m.x,m.z,0xfff2b0,.2,1.2,.35,.9);
    const r=regelSlag({...a,atk:a.atk+a.matk*.5,mult:sk.mult(l)},monsterGevecht(m.spec));setTimeout(()=>{if(!m.dood){raak(m,r,'heiligkruis');FX.speel('heilig',m.x,m.z,{grootte:3.2,y:.9,volg:m});FX.speel('sprankel',m.x,m.z,{grootte:2,voet:true,tint:0xfff4c0,vertraging:.1})}},200)}
  if(id==='schildstoot'){const m=doelSlag();if(!m)return;
    /* stormloop: naar het doel toe springen */
    const dx=m.x-P.x,dz=m.z-P.z,d=Math.hypot(dx,dz)||1;FX.speel('rook',P.x,P.z,{grootte:1.8,voet:true});if(d>1.2){[P.x,P.z]=botsing(m.x-dx/d*1,m.z-dz/d*1)}P.sprite.stoot(dx,dz,.5);schud(.15,.15);
    const r=regelSlag({...a,hit:999,mult:sk.mult(l)},monsterGevecht(m.spec));setTimeout(()=>{if(!m.dood){raak(m,r,'schildstoot');m.ijsTot=nu()+sk.bevries(l);net.stuur('ijs',{ids:[m.id],duur:sk.bevries(l)});FX.speel('vonk',m.x,m.z,{grootte:1.8,y:.6});FX.speel('golf',m.x,m.z,{grootte:2.8,y:.08,tint:0xfff0b0});FX.speel('heilig',m.x,m.z,{grootte:2,y:.8,vertraging:.05})}},150)}
  if(id==='rolstoot'){
    P.sp-=sp;P.cd.rolstoot=t+sk.cd;if(P.zit)zitten(false);speelEens('aanval',.6);ring(P.x,P.z,0xffd27a,.4,sk.straal,.4,.9);G.skill();schud(.2,.2);even(FX.speel('wervel',P.x,P.z,{grootte:sk.straal*2.1,y:.9,loop:true,volg:P}),.7);FX.speel('golf',P.x,P.z,{grootte:sk.straal*2.4,y:.08,tint:0xffd27a,vertraging:.15});
    setTimeout(()=>{let n=0;for(const m of M.values()){if(m.dood||!m.sprite.g.visible)continue;if(Math.hypot(m.x-P.x,m.z-P.z)<=sk.straal){raak(m,regelSlag({...a,hit:999,mult:sk.mult(l)},monsterGevecht(m.spec)),'rolstoot');FX.speel('spat',m.x,m.z,{grootte:1.5,y:.6,tint:0xffd27a});n++}}if(!n)UI.sys(sk.naam+' hit nothing.')},180);
  }
  if(id==='volharden'){P.sp-=sp;P.cd.volharden=t+sk.cd;P.endureTot=t+sk.duur(l);P.endureDef=sk.def(l);ring(P.x,P.z,0xd9b25a,.3,1.5,.5,.9);if(P.endureFx)P.endureFx.stop();P.endureFx=FX.speel('schild',P.x,P.z,{grootte:2.9,y:.05,voet:true,tint:0xffd27a,loop:true,volg:P,additief:true});FX.speel('golf',P.x,P.z,{grootte:3,y:.08,tint:0xffd27a});G.skill();UI.sys(`${sk.naam}: DEF +${sk.def(l)}, nothing moves you for ${sk.duur(l)}s.`)}
  if(id==='genezing'){if(P.hp>=hpMax()){UI.sys('You are at full health.');return}P.sp-=sp;P.cd.genezing=t+sk.cd;const h=Math.round(hpMax()*sk.deel(l));P.hp=Math.min(hpMax(),P.hp+h);
    ring(P.x,P.z,0x7cf5a0,.3,1.6,.6,.9);UI.getal(P.x,P.sprite.h,P.z,camera,'+'+h,'heal');G.drank();K.render();FX.speel('groenkring',P.x,P.z,{grootte:3.6,y:.2});even(FX.speel('lichtstralen',P.x,P.z,{grootte:3.6,voet:true,loop:true,volg:P,additief:true}),1.3);FX.speel('harten',P.x,P.z,{grootte:2.2,y:1.3,volg:P,tint:0xffe0a0,vertraging:.15})}
  if(id==='manabron'){if(P.sp>=spMax()){UI.sys('Your SP is full.');return}P.cd.manabron=t+sk.cd;const h=Math.round(spMax()*sk.deel(l));P.sp=Math.min(spMax(),P.sp+h);
    ring(P.x,P.z,0x8ad0ff,.3,1.6,.6,.9);UI.getal(P.x,P.sprite.h,P.z,camera,'+'+h+' SP','mis');G.drank();K.render();cirkel(0x8fe0a0,1);FX.speel('splash',P.x,P.z,{grootte:3,voet:true,tint:0x7fb8ff,volg:P});even(FX.speel('bladeren',P.x,P.z,{grootte:2.8,y:.6,loop:true,volg:P}),1.1);FX.speel('sprankel',P.x,P.z,{grootte:2.2,voet:true,volg:P,tint:0x9fd0ff,vertraging:.1})}
  if(id==='bliksem'){const m=doelSlag();if(!m)return;
    const r=spreuk({matk:a.matk,mult:sk.mult(l)});
    cirkel(0xbfe8ff,.5);FX.speel('bliksem',m.x,m.z,{grootte:5,voet:true,volg:m});P.sprite.stoot(P.x-m.x,P.z-m.z,.12);
    setTimeout(()=>{if(!m.dood){raak(m,r,'bliksem');FX.speel('vonk',m.x,m.z,{grootte:2,y:.4});FX.speel('golf',m.x,m.z,{grootte:2.6,y:.08,tint:0xbfe8ff});schud(.14,.18)}},300)}
  if(id==='aardspies'){const m=doelSlag();if(!m)return;
    const r=spreuk({matk:a.matk,mult:sk.mult(l)});
    cirkel(0xc9a06a,.5);FX.speel('aarde',m.x,m.z,{grootte:2.8,voet:true,volg:m});FX.speel('spiesen',m.x,m.z,{grootte:2.6,voet:true,volg:m,vertraging:.08});FX.speel('wortels',m.x,m.z,{grootte:2.2,voet:true,volg:m,vertraging:.15});P.sprite.stoot(P.x-m.x,P.z-m.z,.12);
    setTimeout(()=>{if(!m.dood){raak(m,r,'aardspies');schud(.1,.15)}},350)}
  if(id==='stormvlaag'){
    P.sp-=sp;P.cd.stormvlaag=t+sk.cd;if(P.zit)zitten(false);speelEens('aanval',.7);
    ring(P.x,P.z,0xbfe8ff,.4,sk.straal,.7,.9);ring(P.x,P.z,0xffffff,.2,sk.straal*.6,.5,.6);G.skill();schud(.2,.3);cirkel(0xbfe8ff,1);FX.speel('vorstgrond',P.x,P.z,{grootte:sk.straal*2.5,y:.06});scherven(P.x,P.z,sk.straal*.8,8,2.1);scherven(P.x,P.z,sk.straal*.4,4,1.6);even(FX.speel('sneeuw',P.x,P.z,{grootte:sk.straal*2.6,y:2,loop:true}),1.6);FX.speel('golf',P.x,P.z,{grootte:sk.straal*2.4,y:.08,tint:0xdff4ff});
    setTimeout(()=>{let n=0;const ids=[];for(const m of M.values()){if(m.dood||!m.sprite.g.visible)continue;
      if(Math.hypot(m.x-P.x,m.z-P.z)<=sk.straal){raak(m,spreuk({matk:a.matk,mult:sk.mult(l)}),'stormvlaag');FX.speel('spat',m.x,m.z,{grootte:1.5,y:.5,tint:0xdff4ff});m.ijsTot=nu()+sk.bevries(l);ids.push(m.id);n++}}
      if(ids.length)net.stuur('ijs',{ids,duur:sk.bevries(l)});if(!n)UI.sys(sk.naam+' hit nothing.')},250);
  }
  if(id==='energiemantel'){P.sp-=sp;P.cd.energiemantel=t+sk.cd;P.barriereTot=t+sk.duur(l);P.barriereDeel=sk.deel(l);aura(0xa8dcff);ring(P.x,P.z,0x5fb0ff,.3,1.8,.7,.9);cirkel(0x8ad0ff,.8);FX.speel('golf',P.x,P.z,{grootte:3,y:.08,tint:0x8ad0ff});G.skill();UI.sys(`${sk.naam}: ${Math.round(sk.deel(l)*100)}% of damage is taken from your SP for ${sk.duur(l)}s.`)}
  if(id==='wapenversnelling'){P.sp-=sp;P.cd.wapenversnelling=t+sk.cd;P.quickenTot=t+sk.duur(l);P.quickenF=sk.factor(l);ring(P.x,P.z,0xffd27a,.3,1.6,.5,.9);FX.speel('sprankel',P.x,P.z,{grootte:2.2,voet:true,volg:P,tint:0xfff0b0});even(FX.speel('wervel',P.x,P.z,{grootte:2.6,y:.9,loop:true,volg:P,additief:true,tint:0xfff0b0}),.9);G.skill();UI.sys(`${sk.naam}: ${Math.round((1-sk.factor(l))*100)}% faster attacks for ${sk.duur(l)}s.`)}
  if(id==='ijsbout'){const m=doelSlag();if(!m)return;const r=spreuk({matk:a.matk,mult:sk.mult(l)});
    projectiel(P.x,P.z,m,0x9ad8ff,()=>{if(!m.dood){raak(m,r,'ijsbout');m.ijsTot=nu()+sk.bevries(l);net.stuur('ijs',{ids:[m.id],duur:sk.bevries(l)});FX.speel('ijsscherven',m.x,m.z,{grootte:2,voet:true});FX.speel('spat',m.x,m.z,{grootte:1.4,y:.7,tint:0xe0f8ff})}},'ijsbol',1.5);P.sprite.stoot(P.x-m.x,P.z-m.z,.12)}
  if(id==='zielsslag'){const m=doelSlag();if(!m)return;const n=sk.bouten(l);
    for(let k=0;k<n;k++)setTimeout(()=>{if(m.dood||P.dood)return;const r=spreuk({matk:a.matk,mult:sk.mult(l)});projectiel(P.x,P.z,m,0xd8c8ff,()=>{if(!m.dood){raak(m,r,'zielsslag');FX.speel('sprankel',m.x,m.z,{grootte:1.6,voet:true,tint:0xd8c8ff})}},'geest',1.5)},k*170)}
  if(id==='spiraal'){const m=doelSlag();if(!m)return;P.sprite.stoot(m.x-P.x,m.z-P.z,.3);const hk=schermHoek(P.x,P.z,m.x,m.z);
    for(let k=0;k<sk.slagen;k++)setTimeout(()=>{if(m.dood)return;const r=regelSlag({...a,hit:999,mult:sk.mult(l)},monsterGevecht(m.spec));raak(m,r,'spiraal');FX.speel('boor',P.x+(m.x-P.x)*.55,P.z+(m.z-P.z)*.55,{grootte:1.2,y:.9,hoek:hk+(k-1)*.3});FX.speel('zwaai',m.x,m.z,{grootte:2,y:.8,spiegel:k%2===1});if(k===sk.slagen-1)FX.speel('golf',m.x,m.z,{grootte:2.6,y:.08,tint:0xdfe6f5})},150+k*160)}
  if(id==='meteoor'){const m=doelSlag();if(!m)return;const tx=m.x,tz=m.z;cirkel(0xffb060,.7);
    FX.speel('komeet',tx-2.5,tz-4,{grootte:3.2,y:5,spiegel:false,loop:true}).stop();
    const kom=FX.speel('komeet',tx-3,tz,{grootte:3.4,y:6,loop:true});effecten.push({t:0,duur:.55,vlucht:{x0:tx-3,z0:tz,doel:{x:tx,z:tz},e:kom,fn:()=>{}}});
    setTimeout(()=>{FX.speel('paddenstoel',tx,tz,{grootte:sk.straal*3,voet:true,y:-.1});FX.speel('vuurkring',tx,tz,{grootte:sk.straal*2.2,y:.2,vertraging:.08});vuurtjes(tx,tz,1.8,4,2.2);schud(.35,.35);G.raak(true);
      for(const mm of M.values()){if(mm.dood||!mm.sprite.g.visible)continue;if(Math.hypot(mm.x-tx,mm.z-tz)<=sk.straal)raak(mm,spreuk({matk:a.matk,mult:sk.mult(l)}),'meteoor')}},600)}
  if(id==='provocatie'){
    P.sp-=sp;P.cd.provocatie=t+sk.cd;if(P.zit)zitten(false);speelEens('pijn',.3);
    const straal=sk.straal(l);ring(P.x,P.z,0xff4d4d,.3,straal,.5,.7);FX.speel('golf',P.x,P.z,{grootte:sk.straal(l)*2.2,y:.08,tint:0xff6060});FX.speel('golf',P.x,P.z,{grootte:sk.straal(l)*1.4,y:.08,tint:0xff9090,vertraging:.12});FX.speel('knal',P.x,P.z,{grootte:2.4,y:1.6,tint:0xff6060,volg:P});
    let n=0;for(const m of M.values())if(!m.dood&&m.sprite.g.visible&&Math.hypot(m.x-P.x,m.z-P.z)<=straal)n++;
    net.stuur('prov',{x:+P.x.toFixed(2),z:+P.z.toFixed(2),straal});
    UI.sys(n?`You provoke ${n} monster${n===1?'':'s'}.`:'There is nobody to provoke.');
  }
}
/* stat- en skillpunten verdelen */
function statOmhoog(k){const n=P.stats[k]||1,kost=statKosten(n);if(n>=MAX_STAT||vrijeStat()<kost)return;P.stats[k]=n+1;P.hp=Math.min(P.hp,hpMax())}
function skillOmhoog(id){if(vrijeSkill()<=0||!kanLeren(P.skills,id))return;P.skills[id]=(P.skills[id]||0)+1;UI.sys(`${SKILLS[id].naam} is now level ${P.skills[id]}.`)}
function neemSchade(dmg,spec,van){
  if(P.dood||ADMIN.god)return;const a=af();
  if(spec&&Math.random()>raakKans(monsterGevecht(spec).hit,a.flee)){UI.getal(P.x,P.sprite.h,P.z,camera,'Miss','mis');G.mis();return}
  dmg=naVerdediging(dmg,a.def+(nu()<(P.endureTot||0)?P.endureDef||0:0));
  if(nu()<P.barriereTot&&P.sp>0){const deel=Math.min(Math.floor(P.sp),Math.round(dmg*(P.barriereDeel||.3)));if(deel>0){P.sp-=deel;dmg-=deel;UI.getal(P.x,P.sprite.h+.3,P.z,camera,'-'+deel+' SP','mis')}}
  P.hp-=dmg;UI.getal(P.x,P.sprite.h,P.z,camera,dmg,'pijn');P.sprite.raak();
  if(van&&!van.dood&&P.skills.heiligeschild>0){const terug=Math.round(dmg*SKILLS.heiligeschild.deel(P.skills.heiligeschild));if(terug>0){raak(van,{mis:false,dmg:terug,crit:false},'heiligeschild');FX.speel('heilig',van.x,van.z,{grootte:1.5,y:.8});FX.speel('flits',van.x,van.z,{grootte:1.2,y:.6,tint:0xfff0a0})}}
  const endure=nu()<(P.endureTot||0);
  if(!endure){if(van)P.sprite.stoot(P.x-van.x,P.z-van.z,.22);schud(Math.min(.35,.08+dmg/hpMax()*.8),.2)}UI.pijnFlits();G.pijn();
  if(nu()>=P.bezigTot)speelEens('pijn',.25);
  if(P.hp<=0)sterf();
}
function sterf(){
  P.hp=0;P.dood=true;P.target=null;P.wacht=null;P.bestemming=null;P.zit=false;UI.doelkader(null);
  speelEens('dood',999);P.respawnT=nu()+5;G.dood();schud(.4,.4);UI.laagHp(false);
  UI.melding('You were defeated','You will be back at the well in 5 seconds.');UI.sys('You were defeated.');
}
function herleef(){
  P.dood=false;P.hp=hpMax();P.sp=spMax();P.x=0;P.z=4;P.bezigTot=0;P.anim='';zetAnim('idle');
  ring(P.x,P.z,0x7cf5a0,.3,1.8,.6,.8);
}
function beloning(d){
  d={...d,exp:Math.round(d.exp*ADMIN.expMult)};P.exp+=d.exp;P.zeny+=d.zeny;
  UI.getal(P.x,P.sprite.h+.4,P.z,camera,'+'+d.exp+' exp','exp');
  if(d.buit&&ITEMS[d.buit]){const it=ITEMS[d.buit];
    G.buit();if(tasToevoegen(d.buit))UI.log('<span class="lvl">You found: '+ico(d.buit,it.icoon,'klein')+' '+UI.esc(it.naam)+'!'+(it.slot?' Open your inventory (I) to equip it.':'')+'</span>');
    else UI.sys(`Your bag is full, the ${it.naam.toLowerCase()} was left behind.`);I.render()}
  let up=false,jobUp=false;
  while(P.lvl<MAX_LVL&&P.exp>=expVoor(P.lvl)){P.exp-=expVoor(P.lvl);P.lvl++;up=true}
  if(P.job<maxJob()){P.jobexp+=Math.round(d.exp*JOB_EXP_DEEL);while(P.job<maxJob()&&P.jobexp>=jobExpVoor(P.job)){P.jobexp-=jobExpVoor(P.job);P.job++;jobUp=true}}
  if(up){G.levelUp();FX.speel('flits',P.x,P.z,{grootte:3.4,y:.9,tint:0xffd27a});FX.speel('sprankel',P.x,P.z,{grootte:2.6,voet:true,volg:P,tint:0xffe6a0});P.hp=hpMax();P.sp=spMax();UI.melding('LEVEL UP!',`You are now level ${P.lvl}. You have ${vrijeStat()} stat points to spend (C).`);UI.log('<span class="lvl">You are now level '+P.lvl+'! Spend your stat points with C.</span>');ring(P.x,P.z,0xffc857,.3,2.6,.8,1)}
  if(jobUp){if(!up)G.levelUp();UI.log(`<span class="lvl">Job level ${P.job}! You have ${vrijeSkill()} skill point${vrijeSkill()===1?'':'s'} to spend (C).</span>`);if(!up)ring(P.x,P.z,0x8ad0ff,.3,2.2,.7,.9);
    if(klasse().tier===1&&P.job>=maxJob()){const opties=ADVANCEMENT[P.klasse]||[];UI.melding('JOB MASTERED',`Speak to ${KLASSEN[opties[0]].gever} to choose your path.`);UI.log(`<span class="lvl">You have mastered the ${klasse().naam} path. Speak to ${UI.esc(KLASSEN[opties[0]].gever)} to advance to ${opties.map(o=>KLASSEN[o].naam).join(' or ')}.</span>`)}}
  K.render();
}
function openWinkel(n){const w=WINKELS[(n&&typeof n.winkel==='string')?n.winkel:'bram']||WINKELS.bram;K.winkelToon(w);if(n&&n.sprite)n.sprite.zetKijk(P.x-n.x,P.z-n.z)}
/* een aura die de held volgt zolang de barrière duurt */
function aura(tint){if(P.auraFx)P.auraFx.stop();P.auraFx=FX.speel('schild',P.x,P.z,{grootte:2.9,y:.05,voet:true,tint,loop:true,volg:P,additief:true})}
/* class advancement: op het maximale joblevel van een eerste klasse kiest de speler bij de npc zijn tweede klasse */
function advancementOpties(npcNaam){
  if(klasse().tier!==1||P.job<maxJob())return null;
  const o=(ADVANCEMENT[P.klasse]||[]).filter(id=>KLASSEN[id].gever===npcNaam);return o.length?o:null;
}
function advance(id){
  const k=KLASSEN[id];if(!k||!(ADVANCEMENT[P.klasse]||[]).includes(id)||P.job<maxJob())return false;
  P.klasse=id;P.job=1;P.jobexp=0;P.hp=hpMax();P.sp=spMax();
  if(k.uitrusting&&!tasToevoegen(k.uitrusting,1))UI.sys(`Your bag is full; come back for your ${ITEMS[k.uitrusting].naam.toLowerCase()}.`);
  bouwBalk();UI.melding(k.naam.toUpperCase(),`You are now a ${k.naam}. New skills await on the Skills tab.`);G.levelUp();ring(P.x,P.z,0xffc857,.3,3,1,1);FX.speel('flits',P.x,P.z,{grootte:4,y:1,tint:0xffd27a});FX.speel('ring',P.x,P.z,{grootte:3.6,y:.2,tint:0xffd27a});
  UI.log(`<span class="lvl">You have become a ${k.naam}! Your job level starts again at 1 and now goes up to ${maxJob()}. Your ${UI.esc(ITEMS[k.uitrusting].naam)} is in your bag.</span>`);
  K.render();I.render();bewaar();return true;
}
/* een gesprek met een npc op (x,z): meteen als we dichtbij staan, anders eerst erheen lopen */
function gesprek(n,x,z,bij){
  const open=()=>{if(bij)bij();DL.open(n)};
  if(Math.hypot(x-P.x,z-P.z)<2.6)open();
  else{const dx=P.x-x,dz=P.z-z,l=Math.hypot(dx,dz)||1;P.bestemming=[x+dx/l*1.6,z+dz/l*1.6];P.naarNpc=open;P.target=null;P.wacht=null;UI.doelkader(null);if(P.zit)zitten(false)}
}
const BRAM_GROET='Welcome to Runeveld, adventurer. A potion for the road, or something sturdier to wear?';

/* ====================== tas en uitrusting ====================== */
/* de tas is een lijst stapels [{id,n}] met hoogstens TAS_SLOTS stapels */
function tasAantal(id){return P.tas.filter(e=>e.id===id).reduce((t,e)=>t+e.n,0)}
function tasToevoegen(id,n=1,stil=false){
  const it=ITEMS[id];if(!it||n<=0)return false;const max=it.stapel||1;
  for(const e of P.tas){if(e.id!==id||e.n>=max)continue;const k=Math.min(n,max-e.n);e.n+=k;n-=k;if(n<=0)return true}
  while(n>0){if(P.tas.length>=TAS_SLOTS){if(!stil)UI.sys('Your bag is full.');return false}const k=Math.min(n,max);P.tas.push({id,n:k});n-=k}
  return true;
}
function tasVerwijderen(id,n=1){
  if(tasAantal(id)<n)return false;
  for(let i=P.tas.length-1;i>=0&&n>0;i--){const e=P.tas[i];if(e.id!==id)continue;const k=Math.min(n,e.n);e.n-=k;n-=k;if(e.n<=0)P.tas.splice(i,1)}
  return true;
}
function vernieuwUiterlijk(){P.sprite.zetLagen(heldLagen(P.uitr,P.haar));P.hp=Math.min(P.hp,hpMax());K.render();I.render()}
function uitrusten(id){
  const it=ITEMS[id];if(!it||!it.slot)return;
  if(it.klasse&&it.klasse!==P.klasse&&it.klasse!==klasse().basis){UI.sys(`Only a ${KLASSEN[it.klasse].naam} can use the ${it.naam.toLowerCase()}.`);return}
  if(!tasVerwijderen(id))return;
  const oud=P.uitr[it.slot];P.uitr[it.slot]=id;if(oud)tasToevoegen(oud,1,true);
  vernieuwUiterlijk();UI.sys(`You equip the ${it.naam.toLowerCase()}.`);
}
function afdoen(slot){
  const id=P.uitr[slot];if(!id)return;
  if(!tasToevoegen(id))return;P.uitr[slot]=null;
  vernieuwUiterlijk();UI.sys(slot==='lichaam'?`You take off the ${ITEMS[id].naam.toLowerCase()}. Brr, a bit chilly like this.`:`You take off the ${ITEMS[id].naam.toLowerCase()}.`);
}
function koop(id){
  const it=ITEMS[id];if(!it)return;
  if(P.zeny<it.prijs){UI.sys('Not enough zeny. Defeat monsters to earn zeny.');return}
  if(!tasToevoegen(id))return;P.zeny-=it.prijs;UI.sys(`You bought a ${it.naam.toLowerCase()}.`);I.render();
}
function verkoop(id){
  const it=ITEMS[id];if(!it||!K.winkelOpen()||!tasVerwijderen(id))return;
  const z=Math.floor(it.prijs*VERKOOPDEEL);P.zeny+=z;UI.sys(`You sold a ${it.naam.toLowerCase()} for ${z} zeny.`);K.winkelRender();K.render();
}
function weggooi(id){const it=ITEMS[id];if(!it||!tasVerwijderen(id))return;UI.sys(`You drop the ${it.naam.toLowerCase()}.`)}

/* ====================== admin-acties ====================== */
function zetLevel(l){P.lvl=Math.max(1,Math.min(MAX_LVL,l|0));P.exp=0;P.hp=hpMax();P.sp=spMax();K.render()}
function zetJob(j){P.job=Math.max(1,Math.min(maxJob(),j|0));P.jobexp=0;K.render()}
function respec(){P.stats=basisStats();P.skills={};P.hp=Math.min(P.hp,hpMax());K.render();UI.sys('Stats and skills reset.')}
function teleport(x,z){P.x=Math.max(-VELD+1,Math.min(VELD-1,x));P.z=Math.max(-VELD+1,Math.min(VELD-1,z));P.bestemming=null;P.target=null;UI.doelkader(null);cam.doel.set(P.x,0,P.z)}
function spawnMonster(soort,x,z){
  if(!H||!MONSTERS[soort])return false;
  let n=0;while(M.has(soort+'#'+n))n++;
  const m=zorgMonster(soort+'#'+n);m.x=m.tx=x;m.z=m.tz=z;m.nieuw=false;return true;
}
function doodMonster(m){if(m.dood)return;raak(m,{mis:false,dmg:m.hp+1,crit:false},'admin')}
function doodAlles(){for(const m of M.values())if(!m.dood&&m.sprite.g.visible)doodMonster(m)}
function herleefAlles(){if(!H)return;for(const m of M.values())if(m.dood)m.rt=0}

/* ====================== effecten ====================== */
const effecten=[];
/* n vuurtjes in een kring met straal r rond (x,z), die na duur seconden doven */
function vuurtjes(x,z,r,n,duur,naam='vuur',grootte=1.3){for(let k=0;k<n;k++){const h=k/n*Math.PI*2+Math.random();const v=FX.speel(naam,x+Math.cos(h)*r,z+Math.sin(h)*r,{grootte:grootte+Math.random()*.5,voet:true,loop:true,vertraging:.2+k*.07});if(v)setTimeout(()=>v.stop(),duur*1000+k*120)}}
/* ijsscherven in een kring (vorstspreuken) */
function scherven(x,z,r,n,grootte){for(let k=0;k<n;k++){const h=k/n*Math.PI*2+Math.random()*.6;FX.speel('ijsscherven',x+Math.cos(h)*r,z+Math.sin(h)*r,{grootte,voet:true,vertraging:.05+Math.random()*.2})}}
/* de toverkring onder de spreukwerper, `duur` seconden */
function cirkel(tint,duur){const c=FX.speel('runen',P.x,P.z,{grootte:3.4,y:.05,tint,loop:true,volg:P,additief:true});if(c)setTimeout(()=>c.stop(),duur*1000)}
/* een effect dat `duur` seconden blijft en dan stopt */
function even(e,duur){if(e)setTimeout(()=>e.stop(),duur*1000);return e}
/* de hoek op het scherm van (x0,z0) naar (x1,z1), voor gerichte effecten zoals de lans */
function schermHoek(x0,z0,x1,z1){const a=new THREE.Vector3(x0,.8,z0).project(camera),b=new THREE.Vector3(x1,.8,z1).project(camera);return Math.atan2((b.y-a.y)*innerHeight,(b.x-a.x)*innerWidth)}
const ringGeo=new THREE.RingGeometry(.82,1,40);
/* een projectiel: de komeet uit de effectsheets vliegt van de speler naar het monster, daarna fn() */
function projectiel(x0,z0,m,kleur,fn,naam='komeet',grootte=2.6){
  const e=FX.speel(naam,x0,z0,{grootte,y:.9,loop:true,spiegel:(m.x-x0)<0,tint:(naam==='komeet'&&kleur!==0xff8c42)?kleur:null});
  const duur=Math.max(.14,Math.hypot(m.x-x0,m.z-z0)/20);
  effecten.push({t:0,duur,vlucht:{x0,z0,doel:m,fn,e}});
}
function ring(x,z,kleur,r0,r1,duur,opac=1){
  const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:kleur,transparent:true,opacity:opac,depthWrite:false,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.position.set(x,.04,z);scene.add(m);effecten.push({m,t:0,duur,r0,r1,opac});
}
function updateEffecten(dt){
  for(let i=effecten.length-1;i>=0;i--){const e=effecten[i];e.t+=dt;const p=Math.min(1,e.t/e.duur);
    if(e.vlucht){const v=e.vlucht,tx=v.doel.x,tz=v.doel.z;if(v.e)v.e.g.position.set(v.x0+(tx-v.x0)*p,.9+Math.sin(p*Math.PI)*.4,v.z0+(tz-v.z0)*p);
      if(p>=1){if(v.e)v.e.stop();effecten.splice(i,1);v.fn()}continue}
    const r=e.r0+(e.r1-e.r0)*(1-Math.pow(1-p,2));
    e.m.scale.setScalar(Math.max(.01,r));e.m.material.opacity=e.opac*(1-p);
    if(p>=1){scene.remove(e.m);e.m.material.dispose();effecten.splice(i,1)}}
}
const doelRing=new THREE.Mesh(new THREE.RingGeometry(.5,.62,32),new THREE.MeshBasicMaterial({color:0xff6b6b,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));
doelRing.rotation.x=-Math.PI/2;doelRing.position.y=.03;doelRing.visible=false;scene.add(doelRing);

/* ====================== andere spelers ====================== */
function updateAnderen(dt){
  const t=nu();
  for(const s of S.values()){
    const k=1-Math.exp(-10*dt),bewoog=Math.hypot(s.tx-s.x,s.tz-s.z)>.04;
    if(bewoog)s.sprite.zetKijk(s.tx-s.x,s.tz-s.z);else s.sprite.zetKijk(s.pres.kx||0,s.pres.ky||1);
    s.x+=(s.tx-s.x)*k;s.z+=(s.tz-s.z)*k;s.sprite.g.position.set(s.x,0,s.z);
    const p=s.pres;
    if(p.s!==s.seq){s.seq=p.s;if(p.a==='aanval'||p.a==='pijn'){s.sprite.speel(p.a,true);s.bezigTot=t+.45}}
    if(t>=s.bezigTot){if(p.dd)s.sprite.speel('dood');else if(bewoog)s.sprite.speel('loop');else if(p.zt)s.sprite.speel('zit');else s.sprite.speel('idle')}
    s.sprite.update(dt,cam);
    UI.plaatsLabel(s.label,s.x,s.sprite.h+.15,s.z,camera);UI.labelHp(s.label,p.hp||0,p.hm||1,(p.hp||0)<(p.hm||1));
  }
}

/* ====================== invoer ====================== */
function klik(cx,cy){
  if(P.dood)return;
  const hits=straal(cx,cy).intersectObjects(klikbaar,false).filter(h=>h.object.visible&&h.object.parent.visible);
  if(hits.length){const u=hits[0].object.userData;
    if(u.m&&!u.m.dood){P.target=u.m;P.wacht=null;P.bestemming=null;P.naarNpc=false;UI.doelkader(u.m);if(P.zit)zitten(false);return}
    if(u.dorpeling){const n=u.dorpeling;gesprek({naam:n.spec.naam,groet:groet(n),sprite:n.sprite,winkel:n.spec.winkel,x:n.x,z:n.z},n.x,n.z,()=>spreek(n,P,8));return}
    if(u.npc){gesprek({naam:'Merchant Bram',groet:BRAM_GROET,sprite:npc.sprite,winkel:'bram',x:npc.x,z:npc.z},npc.x,npc.z,()=>npc.sprite.zetKijk(P.x-npc.x,P.z-npc.z));return}
  }
  const p=grondPunt(cx,cy);if(!p)return;
  DL.sluit();P.bestemming=[p.x,p.z];P.naarNpc=false;P.target=null;P.wacht=null;UI.doelkader(null);if(P.zit)zitten(false);
  ring(p.x,p.z,0xffffff,.5,.1,.35,.7);
}
/* zoomen in vaste stappen (pixels per eenheid), zodat de pixelschaal altijd heel blijft */
function zoom(richting){const i=ZOOMS.indexOf(cam.px);const j=Math.max(0,Math.min(ZOOMS.length-1,i+richting));if(j!==i)zetZoom(ZOOMS[j])}
function invoer(){
  const pointers=new Map();let ptr=null,pinch=0;
  canvas.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(pointers.size===2){ptr=null;const a=[...pointers.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);return}
    if(e.button===2){ptr={rot:true,x:e.clientX,y:e.clientY};return}
    if(e.button!==0)return;ptr={x:e.clientX,y:e.clientY,bewoog:false};
    if(chatActief())$('#chattekst').blur();
  });
  canvas.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(pointers.size===2){const a=[...pointers.values()];const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch&&Math.abs(d-pinch)>40){zoom(d>pinch?1:-1);pinch=d}return}
    if(!ptr)return;
    if(ptr.rot){cam.yaw-=(e.clientX-ptr.x)*.006;ptr.x=e.clientX;ptr.y=e.clientY;return}
    if(Math.hypot(e.clientX-ptr.x,e.clientY-ptr.y)>10)ptr.bewoog=true;
    if(ptr.bewoog&&gestart&&!P.dood){const p=grondPunt(e.clientX,e.clientY);if(p){P.bestemming=[p.x,p.z];P.naarNpc=false;P.target=null;P.wacht=null;UI.doelkader(null)}}
  });
  const einde=e=>{pointers.delete(e.pointerId);if(!ptr)return;const was=ptr;ptr=null;if(was.rot)return;if(!was.bewoog&&gestart)klik(e.clientX,e.clientY)};
  canvas.addEventListener('pointerup',einde);canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);ptr=null});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let wielT=0;canvas.addEventListener('wheel',e=>{const t=nu();if(t-wielT<.15)return;wielT=t;zoom(e.deltaY<0?1:-1)},{passive:true});
  addEventListener('keydown',e=>{
    if(chatActief()){if(e.key==='Escape')$('#chattekst').blur();return}
    if(!gestart)return;
    if(e.key==='Enter'){e.preventDefault();$('#chattekst').focus();return}
    const dg=/^Digit([1-9])$/.exec(e.code);if(dg){const id=balk()[+dg[1]-1];if(id)vaardigheid(id)}else if(e.code==='KeyR')vaardigheid('drank');
    else if(e.code==='KeyX')vaardigheid('zit');else if(e.code==='KeyC')K.toggle();else if(e.code==='KeyI')I.toggle();else if(e.code==='KeyJ'){if(K.isOpen())K.sluit();else K.toon('quests')}else if(e.code==='KeyM')KT.toggle();else if(e.code==='KeyA'&&e.ctrlKey&&e.shiftKey){e.preventDefault();ADM.toggle();return}
    else if(e.key==='Escape'){if(K.isOpen()||K.winkelOpen()||I.isOpen()||DL.isOpen()||KT.isOpen()){K.sluit();K.winkelSluit();I.sluit();DL.sluit();KT.sluit()}else{P.target=null;P.wacht=null;UI.doelkader(null)}}
    keys.add(e.code);
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('.slot[data-skill="drank"],.slot[data-skill="zit"]').forEach(b=>b.addEventListener('click',()=>vaardigheid(b.dataset.skill)));
  $('#chatin').addEventListener('submit',e=>{e.preventDefault();const inp=$('#chattekst');const t=inp.value.trim();inp.value='';inp.blur();if(t&&net)net.stuur('c',{t:t.slice(0,120)})});
  $('#k-knop').onclick=()=>{if(K)K.toggle()};$('#i-knop').onclick=()=>{if(I)I.toggle()};$('#a-knop').onclick=()=>{if(ADM)ADM.toggle()};
  $('#m-knop').onclick=()=>{if(KT)KT.toggle()};
  const gk=$('#g-knop');const zetGk=()=>{gk.innerHTML=ico('ui_geluid',geluidAan()?'🔊':'🔇');gk.classList.toggle('uit',!geluidAan())};zetGk();gk.onclick=()=>{zetGeluid(!geluidAan());zetGk();G.klik()};
  /* vaste iconen in de HTML (knoppen, drank, zit, zeny) */
  document.querySelectorAll('[data-ico]').forEach(e=>{e.innerHTML=ico(e.dataset.ico,e.dataset.emoji||'')});
  $('#m-chat').onclick=()=>{document.body.classList.add('chat-open');$('#chattekst').focus()};$('#chat-sluit').onclick=()=>{document.body.classList.remove('chat-open');$('#chattekst').blur()};
  $('#j-knop').onclick=()=>{if(!K)return;if(K.isOpen())K.sluit();else K.toon('quests')};
  $('#m-zoomin').onclick=()=>zoom(1);$('#m-zoomuit').onclick=()=>zoom(-1);
}

/* ====================== hoofdlus ====================== */
const _doel=new THREE.Vector3();
let last=nu();
function loop(){
  requestAnimationFrame(loop);
  const t=nu(),dt=Math.min(.05,t-last);last=t;
  stap(dt);
}
let tasT=0,zone=null,klokT=2,portretT=1;const portretCtx=$('#h-portret').getContext('2d');
function stap(dt){
  if(Q){tasT+=dt;if(tasT>=.5){tasT=0;Q.opTas();Q.opPlek(P.x,P.z)}}
  if(SEL&&!gestart)SEL.tick(dt);
  const t=nu();
  if(!gestart&&SEL&&SEL.isOpen()){const d=SEL.cameraDoel();_doel.set(d[0],d[1],d[2])}else _doel.set(P.x,0,P.z);
  cam.doel.lerp(_doel,1-Math.exp(-8*dt));if(cam.schudT>0)cam.schudT-=dt;updateCamera();volgZon(cam.doel.x,cam.doel.z);
  if(gestart){
    updateSpeler(dt);if(H)hostTick(dt);updateMonsters(dt);updateAnderen(dt);stuurPresence();
    UI.hud(P,hpMax(),spMax(),expVoor(P.lvl),tasAantal('drank'),klasse().naam,P.job<maxJob()?jobExpVoor(P.job):0);
    portretT+=dt;if(portretT>.25){portretT=0;tekenHeld(portretCtx,heldLagen(P.uitr,P.haar),t)}
    for(const id of balk()){UI.cooldown(id,((P.cd[id]||0)-t)/SKILLS[id].cd);UI.slotStatus(id,!(P.skills[id]>0),((id==='barriere'||id==='energiemantel')&&t<P.barriereTot)||(id==='volharden'&&t<(P.endureTot||0))||(id==='wapenversnelling'&&t<(P.quickenTot||0)))}
    UI.cooldown('drank',((P.cd.drank||0)-t)/ITEMS.drank.cd);
    UI.slotStatus('zit',false,P.zit);UI.slotStatus('drank',tasAantal('drank')<=0,false);
    doelRing.visible=!!P.target;if(P.target){doelRing.position.set(P.target.x,.03,P.target.z);doelRing.rotation.z+=dt*1.5;doelRing.scale.setScalar(1+.08*Math.sin(t*7))}
    UI.laagHp(!P.dood&&P.hp<hpMax()*.25);
    if(P.auraFx&&(t>=P.barriereTot||P.dood)){P.auraFx.stop();P.auraFx=null}
    if(P.endureFx&&(t>=(P.endureTot||0)||P.dood)){P.endureFx.stop();P.endureFx=null}
    /* naam van het gebied in beeld als je een ander gebied binnenloopt */
    const zn=inStad(P.x,P.z)?'stad':inBos(P.x,P.z)?'bos':(inVale(P.x,P.z)&&!inVeld(P.x,P.z))?'vale':'veld';
    const ZONES={bos:[BOS.naam,'The old forest. Stay on the path.'],veld:['Runeveld','Fields and village.'],vale:[VALE.naam,'Meadows along the Kingsroad. Bandits roam here.'],stad:[STAD.naam,'The capital of Eldoria. Safe within the walls.']};
    if(zone&&zn!==zone)UI.melding(ZONES[zn][0],ZONES[zn][1]);
    const zoneNaam=()=>zn==='stad'?(inKasteel(P.x,P.z)?'Aurelia Castle':STAD.naam):zn==='vale'?VALE.naam:zn==='bos'?BOS.naam:inDorp(P.x,P.z)?'Runeveld':'Runeveld fields';
    if(zn!==zone){zone=zn;$('#mm-zone').textContent=zoneNaam()}else if(tasT===0)$('#mm-zone').textContent=zoneNaam();
    K.tick(dt);ADM.tick(dt);KT.render();KT.renderMini();
  }
  if(gestart){npc.sprite.update(dt,cam);UI.plaatsLabel(npc.label,npc.x,npc.sprite.h+.1,npc.z,camera)}
  updateDorpelingen(dt,cam,camera,P);
  updateEffecten(dt);
  updateBorden();
  if(FX)FX.update(dt,cam);
  if(DAG)DAG.update(cam,gestart&&!P.dood?[{x:P.x,z:P.z,y:.8,r:4,kleur:[255,240,220],sterkte:.4}]:[]);
  klokT+=dt;if(klokT>1){klokT=0;$('#h-tijd').innerHTML=ico(daglicht()>.5?'ui_zon':'ui_maan',daglicht()>.5?'☀️':'🌙','klein')+' '+klokTekst()}
  renderer.render(scene,camera);
}

window.RV={P,M,S,cam,camera,renderer,scene,zon,ADMIN,net:()=>net,H:()=>H,stap,vaardigheid,uitrusten,afdoen,koop,verkoop,weggooi,tasToevoegen,tasAantal,statOmhoog,skillOmhoog,af,K:()=>K,I:()=>I,ADM:()=>ADM,Q:()=>Q,DL:()=>DL,KT:()=>KT,FX:()=>FX,gesprek,dorpelingen,advance,maxJob};
init().catch(e=>{console.error(e);$('#laden').textContent='Loading failed: '+e.message});
