/* Runeveld – hoofdspel: speler, monsters, gevechten, levels, multiplayer, invoer. */
import * as THREE from 'three';
import {KLASSE,MAX_LVL,expVoor,VAARDIGHEDEN,DRANK_PRIJS,MONSTERS,SPAWNS,RESPAWN,ITEMS,STARTUITRUSTING} from './data.js';
import {BLADEN,laadBladen,heldLagen} from './bladen.js';
import {maakKarakter} from './karakter.js';
import {Sprite2D} from './sprites.js';
import {renderer,scene,camera,cam,updateCamera,bouwWereld,botsing,vrij,VELD,canvas,grondPunt,straal,updateBorden,obstakels} from './world.js';
import {maakNet} from './net.js';
import * as UI from './ui.js';

const $=UI.$;
const isTouch=matchMedia('(pointer:coarse)').matches;if(isTouch)document.body.classList.add('touch');
const SLEUTEL='runeveld.save.v1';
const R=(a,b)=>a+Math.random()*(b-a);
const nu=()=>performance.now()/1000;

/* ====================== toestand ====================== */
const P={naam:'',lvl:1,exp:0,hp:60,sp:14,zeny:0,dranken:5,x:0,z:4,dood:false,zit:false,uitr:{...STARTUITRUSTING},tas:[],
  sprite:null,label:null,bestemming:null,naarNpc:false,target:null,wacht:null,cd:{},volgendeSlag:0,bezigTot:0,seq:0,anim:'idle',regenT:0,respawnT:0};
const M=new Map();      /* monsters: id → monster */
const S=new Map();      /* andere spelers: peer-id → speler */
const klikbaar=[];      /* meshes waar je op kunt klikken */
let net=null,H=null,npc=null,gestart=false,K=null;
/* statistieken: basis per level plus wat je draagt */
const draagt=()=>Object.values(P.uitr).map(id=>id&&ITEMS[id]).filter(Boolean);
const som=k=>draagt().reduce((t,it)=>t+(it[k]||0),0);
const hpMax=()=>KLASSE.hpMax(P.lvl)+som('hp'),spMax=()=>KLASSE.spMax(P.lvl),atk=()=>KLASSE.atk(P.lvl)+som('atk'),def=()=>som('def');

/* ====================== opstarten ====================== */
async function init(){
  await laadBladen();await bouwWereld();maakNpc();
  $('#laden').classList.add('weg');
  const save=lees();if(save)$('#naam').value=save.naam;
  const go=()=>{const n=$('#naam').value.trim();if(n.length<2){$('#naam').focus();return}start(n,save&&save.naam===n?save:null)};
  $('#speel').onclick=go;$('#naam').onkeydown=e=>{if(e.key==='Enter')go()};
  if(!isTouch)$('#naam').focus();
  invoer();loop();
}
function start(naam,save){
  P.naam=naam;
  if(save){Object.assign(P,{lvl:save.lvl,exp:save.exp,zeny:save.zeny,dranken:save.dranken,x:save.x,z:save.z});
    if(save.uitr)P.uitr={hoofd:null,lichaam:null,wapen:null,...save.uitr};if(Array.isArray(save.tas))P.tas=save.tas.filter(id=>ITEMS[id]);
    for(const k in P.uitr)if(P.uitr[k]&&!ITEMS[P.uitr[k]])P.uitr[k]=null;
    P.hp=Math.min(save.hp,hpMax());P.sp=Math.min(save.sp,spMax())}
  else{P.hp=hpMax();P.sp=spMax()}
  P.sprite=new Sprite2D(BLADEN.held,{lagen:heldLagen(P.uitr)});scene.add(P.sprite.g);
  K=maakKarakter(P,{hpMax,spMax,atk,def,expMax:()=>expVoor(P.lvl),uitrusten,afdoen,gebruikDrank:()=>vaardigheid('drank'),koop,koopDrank});
  P.label=UI.maakLabel('speler',naam);
  $('#start').hidden=true;$('#hud').hidden=false;
  UI.sys(save?`Welkom terug, ${naam}!`:`Welkom in Runeveld, ${naam}! Klik op een konijn om aan te vallen. Koopman Bram bij de kraam verkoopt drankjes.`);
  gestart=true;startNet();
  setInterval(bewaar,5000);addEventListener('pagehide',bewaar);
}
function maakNpc(){
  const sprite=new Sprite2D(BLADEN.koopman);sprite.g.position.set(-5.4,0,-3.6);sprite.zetKijk(.3,1);scene.add(sprite.g);
  npc={sprite,label:UI.maakLabel('npc','Koopman Bram'),x:-5.4,z:-3.6};
  sprite.mesh.userData.npc=npc;klikbaar.push(sprite.mesh);obstakels.push({x:npc.x,z:npc.z,r:.4});
}
function lees(){try{const s=JSON.parse(localStorage.getItem(SLEUTEL));return s&&s.naam?s:null}catch(e){return null}}
function bewaar(){if(!gestart)return;try{localStorage.setItem(SLEUTEL,JSON.stringify({naam:P.naam,lvl:P.lvl,exp:P.exp,hp:P.hp,sp:P.sp,zeny:P.zeny,dranken:P.dranken,uitr:P.uitr,tas:P.tas,x:+P.x.toFixed(2),z:+P.z.toFixed(2)}))}catch(e){}}

/* ====================== multiplayer ====================== */
function startNet(){
  net=maakNet();
  net.onHost(v=>{if(v)wordHost();else H=null});
  net.onSpelers((spelers,weg)=>{
    for(const id of weg)verwijderSpeler(id);
    for(const[id,p]of spelers){if(!p||!p.n)continue;let s=S.get(id);
      if(!s){s={sprite:new Sprite2D(BLADEN.held,{lagen:heldLagen(p.u||{})}),label:UI.maakLabel('ander',p.n),x:p.x||0,z:p.y||0,tx:0,tz:0,pres:p,seq:p.s,bezigTot:0,uKey:JSON.stringify(p.u||{})};scene.add(s.sprite.g);S.set(id,s);UI.sys(`${p.n} is online.`)}
      const uKey=JSON.stringify(p.u||{});if(uKey!==s.uKey){s.uKey=uKey;s.sprite.zetLagen(heldLagen(p.u||{}))}
      s.pres=p;s.tx=p.x||0;s.tz=p.y||0;s.label.naam.textContent=`${p.n} · Lv ${p.l||1}`}
    UI.online(net.verbonden(),net.aantal());
  });
  net.onVerbinding(v=>{UI.online(v,net.aantal());UI.sys(v?'Verbonden met de wereld.':'Geen verbinding: je speelt even alleen.')});
  net.aan('h',(d,f,isMe)=>{if(H)hostHit(d,f);
    if(!isMe){const m=M.get(d.id);if(m&&!m.dood){UI.getal(m.x,m.sprite.h*.8,m.z,camera,d.dmg,'');m.sprite.raak();if(!H)m.hp=Math.max(0,m.hp-d.dmg)}}});
  net.aan('k',(d,f)=>{if(f!==net.hostId())return;const m=M.get(d.id);if(m)sterfMonster(m);if(d.door===net.me)beloning(d)});
  net.aan('ma',(d,f)=>{if(f!==net.hostId())return;const m=M.get(d.id);if(m&&!m.dood){m.sprite.speel('aanval',true);m.aanvalT=nu()+.5}if(d.to===net.me)neemSchade(d.dmg)});
  net.aan('m',(d,f)=>{if(f!==net.hostId()||H)return;snapshot(d)});
  net.aan('c',(d,f,isMe)=>{const s=S.get(f);const naam=isMe?P.naam:(s&&s.pres.n)||'?';UI.chat(naam,d.t);const l=isMe?P.label:s&&s.label;if(l)UI.bubble(l,d.t)});
  UI.online(false,1);
  if(net.isHost())wordHost();   /* alleen in de wereld: meteen host */
}
function verwijderSpeler(id){const s=S.get(id);if(!s)return;s.sprite.verwijder();UI.verwijderLabel(s.label);S.delete(id);UI.sys(`${s.pres.n||'Iemand'} is weg.`)}
let presT=0,lastPres='';
function stuurPresence(){
  const t=nu();if(t-presT<.12)return;
  const p={n:P.naam,l:P.lvl,x:+P.x.toFixed(2),y:+P.z.toFixed(2),kx:+P.sprite.kijk.x.toFixed(2),ky:+P.sprite.kijk.y.toFixed(2),a:P.anim,s:P.seq,hp:Math.round(P.hp),hm:hpMax(),dd:P.dood,zt:P.zit,u:P.uitr};
  const key=JSON.stringify(p);if(key===lastPres)return;lastPres=key;presT=t;net.presence(p,true);
}

/* ====================== monsters ====================== */
function zorgMonster(id){
  let m=M.get(id);if(m)return m;
  const soort=id.split('#')[0],spec=MONSTERS[soort];if(!spec)return null;
  const sprite=new Sprite2D(BLADEN[soort],{schaduw:1.1});scene.add(sprite.g);
  m={id,spec,sprite,label:UI.maakLabel('monster',spec.naam),x:0,z:0,tx:0,tz:0,kx:0,kz:1,st:0,hp:spec.hp,hpm:spec.hp,dood:false,hideT:0,aanvalT:0,
     doel:null,cd:0,wt:null,wtT:R(0,3),rt:0,nieuw:true};
  sprite.mesh.userData.m=m;klikbaar.push(sprite.mesh);M.set(id,m);return m;
}
function spawnPunt(){
  for(let i=0;i<60;i++){const x=R(-VELD+2,VELD-2),z=R(-VELD+2,VELD-2);
    if(Math.hypot(x,z)>9.5&&vrij(x,z,.8)&&Math.hypot(x-P.x,z-P.z)>4)return[x,z]}
  return[R(-VELD+2,VELD-2),VELD-3];
}
function sterfMonster(m){
  if(m.dood)return;m.dood=true;m.hp=0;m.st=3;m.doel=null;m.rt=R(RESPAWN[0],RESPAWN[1]);
  m.sprite.speel('dood',true);m.hideT=nu()+1.6;
  if(P.target===m){P.target=null;P.wacht=null;UI.doelkader(null)}
}
function herleefMonster(m,[x,z]){
  m.dood=false;m.hp=m.hpm;m.x=m.tx=x;m.z=m.tz=z;m.doel=null;m.st=0;m.hideT=0;
  m.sprite.g.visible=true;m.label.el.hidden=false;m.sprite.speel('idle',true);
}
function wordHost(){
  H={snapT:0};
  if(M.size===0){for(const s of SPAWNS)for(let i=0;i<s.n;i++){const m=zorgMonster(s.soort+'#'+i);const[x,z]=spawnPunt();m.x=m.tx=x;m.z=m.tz=z;m.nieuw=false}}
  else for(const m of M.values()){m.x=m.tx;m.z=m.tz;m.doel=null;if(m.dood&&m.rt<=0)m.rt=R(RESPAWN[0],RESPAWN[1])}
}
function hostHit(d,f){
  const m=M.get(d.id);if(!m||m.dood)return;
  m.hp=Math.max(0,m.hp-d.dmg);if(!m.doel)m.doel=f;
  if(m.hp<=0){const sp=m.spec;m.dood=true;let buit=null;for(const[id,kans]of Object.entries(sp.buit||{}))if(Math.random()<kans){buit=id;break}
    net.stuur('k',{id:m.id,door:f,exp:sp.exp,zeny:Math.round(R(sp.zeny[0],sp.zeny[1])),drank:Math.random()<sp.drank,buit})}
}
function hostTick(dt){
  const spelers=[{id:net.me,x:P.x,z:P.z,dood:P.dood}];
  for(const[id,s]of S)spelers.push({id,x:s.x,z:s.z,dood:!!s.pres.dd});
  for(const m of M.values()){
    const sp=m.spec;
    if(m.dood){m.rt-=dt;if(m.rt<=0)herleefMonster(m,spawnPunt());continue}
    let doel=m.doel?spelers.find(s=>s.id===m.doel):null;
    if(doel&&(doel.dood||Math.hypot(doel.x-m.x,doel.z-m.z)>13)){doel=null;m.doel=null}
    if(!doel&&sp.agressief){let best=null,bd=sp.aggro;for(const s of spelers){if(s.dood)continue;const d=Math.hypot(s.x-m.x,s.z-m.z);if(d<bd){bd=d;best=s}}if(best){doel=best;m.doel=best.id}}
    m.cd=Math.max(0,m.cd-dt);
    if(doel){
      const dx=doel.x-m.x,dz=doel.z-m.z,d=Math.hypot(dx,dz)||1e-4;m.kx=dx/d;m.kz=dz/d;
      if(d>sp.bereik){const s=sp.snelheid*dt;[m.x,m.z]=botsing(m.x+dx/d*s,m.z+dz/d*s,.3);m.st=1}
      else{m.st=0;if(m.cd<=0){m.cd=1.6;net.stuur('ma',{id:m.id,to:doel.id,dmg:Math.round(sp.atk*R(.85,1.15))})}}
    }else{
      m.wtT-=dt;
      if(m.wtT<=0){if(m.wt){m.wt=null;m.wtT=R(1.5,4)}else{m.wt=[m.x+R(-4,4),m.z+R(-4,4)];m.wtT=R(2,5)}}
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
      if(m.sprite.g.visible){m.sprite.update(dt,cam);UI.plaatsLabel(m.label,m.x,m.sprite.h+.1,m.z,camera)}continue}
    if(!H){const k=1-Math.exp(-10*dt);m.x+=(m.tx-m.x)*k;m.z+=(m.tz-m.z)*k}
    m.sprite.g.position.set(m.x,0,m.z);m.sprite.zetKijk(m.kx,m.kz);
    if(t>=m.aanvalT)m.sprite.speel(m.st===1?'loop':'idle');
    m.sprite.update(dt,cam);
    UI.plaatsLabel(m.label,m.x,m.sprite.h+.1,m.z,camera);UI.labelHp(m.label,m.hp,m.hpm,m.hp<m.hpm||P.target===m);
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
      if(d>KLASSE.bereik){dx=ddx/d;dz=ddz/d}
      else{P.sprite.zetKijk(ddx,ddz);
        if(P.wacht){const w=P.wacht;P.wacht=null;vaardigheid(w)}
        else if(!bezig&&t>=P.volgendeSlag)slag(m)}}
  }else if(P.bestemming){
    const ddx=P.bestemming[0]-P.x,ddz=P.bestemming[1]-P.z,d=Math.hypot(ddx,ddz);
    if(d<.15){P.bestemming=null;if(P.naarNpc){P.naarNpc=false;openWinkel()}}else{dx=ddx/d;dz=ddz/d}
  }
  if((dx||dz)&&!bezig){
    if(P.zit)zitten(false);
    const s=KLASSE.snelheid*dt;const[nx,nz]=botsing(P.x+dx*s,P.z+dz*s);
    if(P.bestemming&&Math.hypot(nx-P.x,nz-P.z)<s*.2){P.bestemming=null;if(P.naarNpc){P.naarNpc=false;openWinkel()}}
    P.x=nx;P.z=nz;P.sprite.zetKijk(dx,dz);zetAnim('loop');
  }else if(!bezig)zetAnim(P.zit?'zit':'idle');
  P.sprite.g.position.set(P.x,0,P.z);P.sprite.update(dt,cam);
  UI.plaatsLabel(P.label,P.x,P.sprite.h+.15,P.z,camera);
  P.regenT+=dt;
  if(P.regenT>=1){P.regenT-=1;const f=P.zit?4:1;P.hp=Math.min(hpMax(),P.hp+(1+P.lvl*.3)*f);P.sp=Math.min(spMax(),P.sp+(1+P.lvl*.2)*f)}
}
function slag(m){
  P.volgendeSlag=nu()+KLASSE.aanvalTijd;speelEens('aanval',.45);
  const dmg=Math.round(atk()*R(.9,1.1));setTimeout(()=>{if(!m.dood)raak(m,dmg,'')},220);
}
function raak(m,dmg,soort){
  UI.getal(m.x,m.sprite.h*.8,m.z,camera,dmg,soort?'skill':'eigen');m.sprite.raak();
  if(!H)m.hp=Math.max(0,m.hp-dmg);
  net.stuur('h',{id:m.id,dmg});
}
function vaardigheid(id){
  if(P.dood||!gestart)return;const t=nu();
  if(id==='zit'){zitten(!P.zit);return}
  const V=VAARDIGHEDEN[id];if(!V||(P.cd[id]||0)>t)return;
  if(id==='drank'){
    if(P.dranken<=0){UI.sys('Je hebt geen drankjes meer. Koopman Bram bij de kraam verkoopt ze.');return}
    if(P.hp>=hpMax())return;
    P.dranken--;P.hp=Math.min(hpMax(),P.hp+V.heal);P.cd.drank=t+V.cd;UI.getal(P.x,P.sprite.h,P.z,camera,'+'+V.heal,'heal');K.render();return;
  }
  if(P.sp<V.sp){UI.sys('Niet genoeg SP.');return}
  if(id==='beuk'){
    if(!P.target||P.target.dood){UI.sys('Kies eerst een doelwit: klik op een monster.');return}
    const m=P.target;if(Math.hypot(m.x-P.x,m.z-P.z)>KLASSE.bereik){P.wacht='beuk';return}
    P.sp-=V.sp;P.cd.beuk=t+V.cd;if(P.zit)zitten(false);
    P.volgendeSlag=t+KLASSE.aanvalTijd;speelEens('aanval',.5);P.sprite.zetKijk(m.x-P.x,m.z-P.z);
    const dmg=Math.round(atk()*V.mult*R(.9,1.1));setTimeout(()=>{if(!m.dood)raak(m,dmg,'beuk')},220);
  }
  if(id==='vuurkring'){
    P.sp-=V.sp;P.cd.vuurkring=t+V.cd;if(P.zit)zitten(false);speelEens('aanval',.6);
    ring(P.x,P.z,0xff8c42,.4,V.straal,.45,.9);
    setTimeout(()=>{let n=0;for(const m of M.values()){if(m.dood||!m.sprite.g.visible)continue;
      if(Math.hypot(m.x-P.x,m.z-P.z)<=V.straal){raak(m,Math.round(atk()*V.mult*R(.9,1.1)),'vuurkring');n++}}
      if(!n)UI.sys('Vuurkring raakte niets.')},200);
  }
}
function neemSchade(dmg){
  if(P.dood)return;dmg=Math.max(1,Math.round(dmg*100/(100+def()*5)));P.hp-=dmg;UI.getal(P.x,P.sprite.h,P.z,camera,dmg,'pijn');P.sprite.raak();
  if(nu()>=P.bezigTot)speelEens('pijn',.25);
  if(P.hp<=0)sterf();
}
function sterf(){
  P.hp=0;P.dood=true;P.target=null;P.wacht=null;P.bestemming=null;P.zit=false;UI.doelkader(null);
  speelEens('dood',999);P.respawnT=nu()+5;
  UI.melding('Je bent verslagen','Over 5 seconden sta je weer bij de put.');UI.sys('Je bent verslagen.');
}
function herleef(){
  P.dood=false;P.hp=hpMax();P.sp=spMax();P.x=0;P.z=4;P.bezigTot=0;P.anim='';zetAnim('idle');
  ring(P.x,P.z,0x7cf5a0,.3,1.8,.6,.8);
}
function beloning(d){
  P.exp+=d.exp;P.zeny+=d.zeny;
  UI.getal(P.x,P.sprite.h+.4,P.z,camera,'+'+d.exp+' exp','exp');
  if(d.drank){P.dranken++;UI.sys('Je vond een Rode drank!')}
  if(d.buit&&ITEMS[d.buit]){P.tas.push(d.buit);UI.log('<span class="lvl">Je vond: '+ITEMS[d.buit].icoon+' '+UI.esc(ITEMS[d.buit].naam)+'! Druk op C om het aan te doen.</span>');K.render()}
  let up=false;
  while(P.lvl<MAX_LVL&&P.exp>=expVoor(P.lvl)){P.exp-=expVoor(P.lvl);P.lvl++;up=true}
  if(up){P.hp=hpMax();P.sp=spMax();UI.melding('LEVEL UP!','Je bent nu level '+P.lvl);UI.log('<span class="lvl">Je bent nu level '+P.lvl+'!</span>');ring(P.x,P.z,0xffc857,.3,2.6,.8,1)}
  K.render();
}
function openWinkel(){K.winkelToon();npc.sprite.zetKijk(P.x-npc.x,P.z-npc.z)}

/* ====================== uitrusting ====================== */
function vernieuwUiterlijk(){P.sprite.zetLagen(heldLagen(P.uitr));P.hp=Math.min(P.hp,hpMax())}
function uitrusten(id){
  const it=ITEMS[id],i=P.tas.indexOf(id);if(!it||i<0)return;
  P.tas.splice(i,1);const oud=P.uitr[it.slot];if(oud)P.tas.push(oud);P.uitr[it.slot]=id;
  vernieuwUiterlijk();UI.sys(`Je doet ${it.naam} aan.`);
}
function afdoen(slot){
  const id=P.uitr[slot];if(!id)return;P.uitr[slot]=null;P.tas.push(id);
  vernieuwUiterlijk();UI.sys(slot==='lichaam'?`Je doet ${ITEMS[id].naam} uit. Brr, wel een beetje kil zo.`:`Je doet ${ITEMS[id].naam} af.`);
}
function koop(id){
  const it=ITEMS[id];if(!it)return;
  if(P.zeny<it.prijs){UI.sys('Niet genoeg zeny. Versla monsters om zeny te verdienen.');return}
  P.zeny-=it.prijs;P.tas.push(id);UI.sys(`Je kocht ${it.naam}. Druk op C om het aan te doen.`);
}
function koopDrank(){if(P.zeny<DRANK_PRIJS){UI.sys('Niet genoeg zeny. Versla monsters om zeny te verdienen.');return}P.zeny-=DRANK_PRIJS;P.dranken++;UI.sys('Je kocht een Rode drank.')}

/* ====================== effecten ====================== */
const effecten=[];
const ringGeo=new THREE.RingGeometry(.82,1,40);
function ring(x,z,kleur,r0,r1,duur,opac=1){
  const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:kleur,transparent:true,opacity:opac,depthWrite:false,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.position.set(x,.04,z);scene.add(m);effecten.push({m,t:0,duur,r0,r1,opac});
}
function updateEffecten(dt){
  for(let i=effecten.length-1;i>=0;i--){const e=effecten[i];e.t+=dt;const p=Math.min(1,e.t/e.duur);const r=e.r0+(e.r1-e.r0)*(1-Math.pow(1-p,2));
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
    if(u.npc){if(Math.hypot(npc.x-P.x,npc.z-P.z)<2.6)openWinkel();else{const dx=P.x-npc.x,dz=P.z-npc.z,d=Math.hypot(dx,dz)||1;P.bestemming=[npc.x+dx/d*1.6,npc.z+dz/d*1.6];P.naarNpc=true;P.target=null;UI.doelkader(null)}return}
  }
  const p=grondPunt(cx,cy);if(!p)return;
  P.bestemming=[p.x,p.z];P.naarNpc=false;P.target=null;P.wacht=null;UI.doelkader(null);if(P.zit)zitten(false);
  ring(p.x,p.z,0xffffff,.5,.1,.35,.7);
}
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
    if(pointers.size===2){const a=[...pointers.values()];const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch)cam.afstand=THREE.MathUtils.clamp(cam.afstand*pinch/d,10,32);pinch=d;return}
    if(!ptr)return;
    if(ptr.rot){cam.yaw-=(e.clientX-ptr.x)*.006;ptr.x=e.clientX;ptr.y=e.clientY;return}
    if(Math.hypot(e.clientX-ptr.x,e.clientY-ptr.y)>10)ptr.bewoog=true;
    if(ptr.bewoog&&gestart&&!P.dood){const p=grondPunt(e.clientX,e.clientY);if(p){P.bestemming=[p.x,p.z];P.naarNpc=false;P.target=null;P.wacht=null;UI.doelkader(null)}}
  });
  const einde=e=>{pointers.delete(e.pointerId);if(!ptr)return;const was=ptr;ptr=null;if(was.rot)return;if(!was.bewoog&&gestart)klik(e.clientX,e.clientY)};
  canvas.addEventListener('pointerup',einde);canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);ptr=null});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{cam.afstand=THREE.MathUtils.clamp(cam.afstand+e.deltaY*.015,10,32)},{passive:true});
  addEventListener('keydown',e=>{
    if(chatActief()){if(e.key==='Escape')$('#chattekst').blur();return}
    if(!gestart)return;
    if(e.key==='Enter'){e.preventDefault();$('#chattekst').focus();return}
    if(e.code==='Digit1')vaardigheid('beuk');else if(e.code==='Digit2')vaardigheid('vuurkring');else if(e.code==='Digit3')vaardigheid('drank');
    else if(e.code==='KeyX')vaardigheid('zit');else if(e.code==='KeyC')K.toggle();
    else if(e.key==='Escape'){if(K.isOpen()||K.winkelOpen()){K.sluit();K.winkelSluit()}else{P.target=null;P.wacht=null;UI.doelkader(null)}}
    keys.add(e.code);
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('.slot').forEach(b=>b.addEventListener('click',()=>vaardigheid(b.dataset.skill)));
  $('#chatin').addEventListener('submit',e=>{e.preventDefault();const inp=$('#chattekst');const t=inp.value.trim();inp.value='';inp.blur();if(t&&net)net.stuur('c',{t:t.slice(0,120)})});
  $('#k-knop').onclick=()=>{if(K)K.toggle()};
  $('#m-chat').onclick=()=>$('#chattekst').focus();
  $('#m-zoomin').onclick=()=>{cam.afstand=Math.max(10,cam.afstand-3)};$('#m-zoomuit').onclick=()=>{cam.afstand=Math.min(32,cam.afstand+3)};
}

/* ====================== hoofdlus ====================== */
const _doel=new THREE.Vector3();
let last=nu();
function loop(){
  requestAnimationFrame(loop);
  const t=nu(),dt=Math.min(.05,t-last);last=t;
  stap(dt);
}
function stap(dt){
  const t=nu();
  if(gestart){
    updateSpeler(dt);if(H)hostTick(dt);updateMonsters(dt);updateAnderen(dt);stuurPresence();
    UI.hud(P,hpMax(),spMax(),expVoor(P.lvl));
    for(const id of['beuk','vuurkring','drank'])UI.cooldown(id,((P.cd[id]||0)-t)/VAARDIGHEDEN[id].cd);
    UI.slotStatus('zit',false,P.zit);UI.slotStatus('drank',P.dranken<=0,false);
    doelRing.visible=!!P.target;if(P.target){doelRing.position.set(P.target.x,.03,P.target.z);doelRing.rotation.z+=dt*1.5}
    K.tick(dt);
  }
  npc.sprite.update(dt,cam);UI.plaatsLabel(npc.label,npc.x,npc.sprite.h+.1,npc.z,camera);
  updateEffecten(dt);
  _doel.set(P.x,0,P.z);cam.doel.lerp(_doel,1-Math.exp(-8*dt));
  updateCamera();updateBorden();renderer.render(scene,camera);
}

window.RV={P,M,S,cam,net:()=>net,H:()=>H,stap,vaardigheid,uitrusten,afdoen,koop,K:()=>K};
init().catch(e=>{console.error(e);$('#laden').textContent='Laden mislukt: '+e.message});
