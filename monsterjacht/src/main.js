/* Monsterjacht – hoofdspel: trainer, monsterbal, actiegevechten, vangen, team, opslag. */
import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {MONSTERS,TYPES,STARTERS,ZONES,SPECIAAL,MAX_DEX,stats,xpVoorLevel,effectiviteit} from './data.js';
import {laad,instantie,maakToon} from './assets.js';
import {Wereld,zoneOp,EILAND_R,rnd} from './world.js';

const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');

/* ---------- renderer / scene ---------- */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.5:2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=!touch;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const outline=new OutlineEffect(renderer,{defaultThickness:0.0035,defaultColor:[0.08,0.1,0.16],defaultAlpha:0.9});
const scene=new THREE.Scene();scene.background=new THREE.Color('#8fd3ff');scene.fog=new THREE.Fog('#a9e0ff',70,190);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.1,400);
scene.add(new THREE.HemisphereLight('#ffffff','#7fb86a',1.1));
const zon=new THREE.DirectionalLight('#fff4d6',2.0);zon.position.set(40,70,30);zon.castShadow=!touch;
zon.shadow.mapSize.set(2048,2048);zon.shadow.camera.left=zon.shadow.camera.bottom=-40;zon.shadow.camera.right=zon.shadow.camera.top=40;zon.shadow.camera.far=200;zon.shadow.bias=-0.0008;
scene.add(zon);scene.add(zon.target);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});

/* ---------- opslag ---------- */
const SLEUTEL='monsterjacht.save.v1';
let save=null;
function laadSave(){try{const s=JSON.parse(localStorage.getItem(SLEUTEL));if(s&&s.team&&s.team.length)return s}catch(e){}return null}
function bewaar(){if(!save)return;save.pos=[trainer.pos.x,trainer.pos.z];try{localStorage.setItem(SLEUTEL,JSON.stringify(save))}catch(e){}}
function nieuwLid(id,level){const st=stats(id,level);return{id,level,xp:0,hp:st.hp,gevangen:Date.now()}}

/* ---------- UI helpers ---------- */
const meldingen=[];
function meld(tekst,ms=2600){const d=document.createElement('div');d.className='msg';d.textContent=tekst;$('#melding').appendChild(d);setTimeout(()=>d.remove(),ms)}
function tpBadge(t){return`<span class="tp" style="background:${TYPES[t].kleur}">${t}</span>`}
function hint(html){$('#hint').innerHTML=html}
const labels=$('#labels');
function schadeLabel(pos,tekst,cls=''){const d=document.createElement('div');d.className='schade '+cls;d.textContent=tekst;labels.appendChild(d);const v=pos.clone();v.y+=1.4;v.project(camera);d.style.left=((v.x+1)/2*innerWidth)+'px';d.style.top=((1-v.y)/2*innerHeight)+'px';setTimeout(()=>d.remove(),1000)}

/* ---------- monsters ---------- */
const alleMonsters=[];
class Monster{
  constructor(id,level,eigen=false){
    this.id=id;this.soort=MONSTERS[id];this.level=level;this.eigen=eigen;
    this.st=stats(id,level);this.hp=this.st.hp;this.maxhp=this.st.hp;
    this.pos=new THREE.Vector3();this.yaw=0;this.vel=new THREE.Vector3();
    this.root=new THREE.Group();this.klaar=false;this.dood=false;this.t=Math.random()*10;
    this.anim={idle:null,walk:null,attack:null};this.mixer=null;
    this.aanvalT=0;this.cdSpeciaal=0;this.hitT=0;this.lunge=0;this.bewegend=0;this.dash=0;
    this.state='wander';this.doel=null;this.wanderT=0;this.agro=0;this.regenT=0;this.boos=0;
    this.label=document.createElement('div');this.label.className='lbl'+(eigen?' eigen':'');this.label.innerHTML='<div class="nm"></div><div class="bar"><i></i></div>';labels.appendChild(this.label);
    scene.add(this.root);alleMonsters.push(this);
    laad(this.soort.model).then(g=>{if(this.weg)return;const inst=instantie(g,this.soort.hoogte,this.soort.rot);this.inst=inst;this.root.add(inst.root);this.straal=Math.max(0.5,inst.straal);
      if(inst.mixer){this.mixer=inst.mixer;const c=inst.clips;const zoek=re=>c.find(k=>re.test(k.name));
        const idle=zoek(/idle/i)||c[0];this.anim.idle=this.mixer.clipAction(idle);
        const walk=zoek(/walk|run|swim|fly|move/i);if(walk&&walk!==idle)this.anim.walk=this.mixer.clipAction(walk);
        const att=zoek(/attack|bite|strike|punch|hit|fire|slam/i);if(att&&att!==idle&&att!==walk){this.anim.attack=this.mixer.clipAction(att);this.anim.attack.setLoop(THREE.LoopOnce);this.anim.attack.clampWhenFinished=true}
        this.anim.idle.play();this.mixer.setTime(Math.random()*2)}
      this.klaar=true});
  }
  get verzwakt(){return this.hp>0&&this.hp/this.maxhp<0.4}
  update(dt){
    this.t+=dt;if(this.mixer)this.mixer.update(dt*(this.dood?0:1));
    // procedurele animatie: stuiteren, zweven, uitvallen, omvallen
    const inst=this.inst;if(!inst)return;
    const sp=this.vel.length();this.bewegend=lerp(this.bewegend,Math.min(1,sp/3),dt*8);
    const zweef=this.soort.zweef?this.soort.zweef+Math.sin(this.t*2.2)*0.12:0;
    let bob=0,squash=1;
    if(!this.mixer||!this.anim.walk){const f=this.soort.zweef?3:9;bob=Math.abs(Math.sin(this.t*f))*0.22*this.bewegend;squash=1-Math.sin(this.t*f*2)*0.05*this.bewegend}
    else{const w=this.anim.walk,i=this.anim.idle;const bw=this.bewegend;w.enabled=true;i.enabled=true;w.setEffectiveWeight(bw);i.setEffectiveWeight(1-bw);if(bw>0.05&&!w.isRunning())w.play()}
    if(this.lunge>0){this.lunge=Math.max(0,this.lunge-dt*3.2)}
    const lungeZ=Math.sin(this.lunge*Math.PI)*0.9;
    inst.root.position.set(0,bob+zweef,0);inst.pivot.position.set(0,0,lungeZ);
    inst.root.scale.set(1/Math.sqrt(squash),squash,1/Math.sqrt(squash));
    if(this.hitT>0){this.hitT-=dt;const k=Math.sin(this.hitT*30)*0.12;inst.root.rotation.z=k;inst.root.rotation.x=-this.hitT*0.5;
      if(!this.gloeit){this.gloeit=true;this.zetGloed(0.6,0.1,0.1)}}
    else{inst.root.rotation.z=lerp(inst.root.rotation.z,0,dt*10);inst.root.rotation.x=lerp(inst.root.rotation.x,0,dt*10);
      if(this.gloeit){this.gloeit=false;this.zetGloed(0,0,0)}}
    if(this.dood){this.doodT=(this.doodT||0)+dt;inst.root.rotation.z=Math.min(Math.PI/2,this.doodT*3);inst.root.position.y=Math.max(-2,-Math.max(0,this.doodT-1.2)*0.8)+zweef*0.3;if(this.doodT>2.6)this.verwijder()}
    this.root.position.copy(this.pos);this.root.rotation.y=this.yaw;
  }
  zetGloed(r,g,b){this.inst.root.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive)o.material.emissive.setRGB(r,g,b)})}
  speelAanval(){if(this.anim.attack){this.anim.attack.reset().play()}this.lunge=1}
  raak(schade,bron,richting){
    if(this.dood)return;this.hp=Math.max(0,this.hp-schade);this.hitT=0.35;this.regenT=6;
    if(richting){this.vel.add(richting.clone().setY(0).normalize().multiplyScalar(4))}
    if(!this.eigen){this.state='chase';this.doel=bron;this.agro=14;this.boos=1}
    if(this.hp<=0){this.sterf()}
  }
  sterf(){this.dood=true;this.state='dead';this.vel.set(0,0,0);if(this.mixer)this.mixer.stopAllAction()}
  verwijder(){this.weg=true;scene.remove(this.root);this.label.remove();const i=alleMonsters.indexOf(this);if(i>=0)alleMonsters.splice(i,1)}
  updateLabel(){
    const l=this.label;if(!this.klaar||this.dood&&this.doodT>1){l.style.display='none';return}
    const v=this.pos.clone();v.y+=this.soort.hoogte+(this.soort.zweef||0)+0.5;v.project(camera);
    if(v.z>1||Math.abs(v.x)>1.2||Math.abs(v.y)>1.2){l.style.display='none';return}
    const d=camera.position.distanceTo(this.pos);if(d>38&&!this.eigen){l.style.display='none';return}
    l.style.display='';l.style.left=((v.x+1)/2*innerWidth)+'px';l.style.top=((1-v.y)/2*innerHeight)+'px';
    l.classList.toggle('verzwakt',!this.eigen&&this.verzwakt);
    l.firstChild.textContent=(this.eigen?'★ ':'')+this.soort.naam+' Lv'+this.level+(this.verzwakt&&!this.eigen?' – verzwakt!':'');
    l.lastChild.firstChild.style.width=(this.hp/this.maxhp*100)+'%';
  }
}

/* ---------- trainer ---------- */
const trainer={pos:new THREE.Vector3(0,0,10),yaw:0,vel:new THREE.Vector3(),root:new THREE.Group(),acties:{},huidige:null,gooiT:0,rennen:0};
scene.add(trainer.root);
function speelTrainer(naam,fade=0.15,once=false){const a=trainer.acties[naam];if(!a||trainer.huidige===naam)return;const prev=trainer.acties[trainer.huidige];a.reset();if(once){a.setLoop(THREE.LoopOnce);a.clampWhenFinished=true}a.fadeIn(fade).play();if(prev)prev.fadeOut(fade);trainer.huidige=naam}

/* ---------- spelstatus ---------- */
let modus='start';           // start | trainer | monster | vangen
let actief=null;              // Monster-instantie van het eigen monster dat buiten is
let actiefSlot=0;             // index in save.team
let bal=null;                 // vliegende monsterbal
const projectielen=[];
const cam={yaw:0,pitch:0.35,afstand:7};
const wereld=new Wereld(scene);
const toetsen={};let muisKnop=0;
const joy={x:0,y:0,actief:false};
let tijd=0,vangAnim=null;

/* ---------- invoer ---------- */
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;toetsen[e.code]=true;
  if(e.code==='Space'){e.preventDefault();actie()}
  if(e.code==='KeyK')speciaal();if(e.code==='KeyQ')terugroepen();if(e.code==='KeyE')genees();
  if(e.code==='KeyM'||e.code==='Tab'){e.preventDefault();toggleMenu()}
  if(/^Digit[1-6]$/.test(e.code))kiesSlot(+e.code[5]-1);
});
addEventListener('keyup',e=>{toetsen[e.code]=false});
canvas.addEventListener('mousedown',e=>{if(modus==='start')return;muisKnop=e.button;if(document.pointerLockElement!==canvas&&!touch){canvas.requestPointerLock()}
  if(e.button===0)actie();if(e.button===2)speciaal()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){cam.yaw-=e.movementX*0.0028;cam.pitch=clamp(cam.pitch+e.movementY*0.0022,-0.2,1.1)}});
addEventListener('wheel',e=>{cam.afstand=clamp(cam.afstand+e.deltaY*0.004,3.5,13)});
// touch: joystick links, camera rechts
const joyEl=$('#joy'),joyKnop=joyEl.querySelector('i');let joyId=null,camId=null,camLast=null;
addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(t.target.closest('.hud')&&!t.target.closest('#joy')&&!t.target.closest('#hint'))continue;if(t.clientX<innerWidth*0.45&&joyId===null){joyId=t.identifier;joy.actief=true;joy.cx=t.clientX;joy.cy=t.clientY}else if(camId===null){camId=t.identifier;camLast=[t.clientX,t.clientY]}}},{passive:true});
addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier===joyId){const dx=t.clientX-joy.cx,dy=t.clientY-joy.cy;const d=Math.hypot(dx,dy)||1;const k=Math.min(1,d/45);joy.x=dx/d*k;joy.y=dy/d*k;joyKnop.style.transform=`translate(${joy.x*34}px,${joy.y*34}px)`}
  if(t.identifier===camId&&camLast){cam.yaw-=(t.clientX-camLast[0])*0.006;cam.pitch=clamp(cam.pitch+(t.clientY-camLast[1])*0.004,-0.2,1.1);camLast=[t.clientX,t.clientY]}}},{passive:true});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId){joyId=null;joy.actief=false;joy.x=joy.y=0;joyKnop.style.transform=''}if(t.identifier===camId)camId=null}});
if(touch){joyEl.style.left='24px';joyEl.style.bottom='24px'}

/* ---------- actieknoppen ---------- */
function bouwActies(){
  const a=$('#acties');a.innerHTML='';
  const mk=(id,tekst,sub,cls)=>{const b=document.createElement('button');b.className='knop '+cls;b.id=id;b.innerHTML=`<span>${tekst}</span><small>${sub}</small><div class="cd"></div>`;a.appendChild(b);return b};
  if(modus==='trainer'){mk('k-gooi','Gooi','bal · spatie','groot').onclick=actie;mk('k-genees','Rust','E','').onclick=genees}
  else if(modus==='monster'){mk('k-speciaal',SPECIAAL[actief.soort.type].naam,'K / rechts','rood').onclick=speciaal;mk('k-aanval','Aanval','klik · spatie','groot').onclick=actie;mk('k-terug','Terug','Q','').onclick=terugroepen}
}

/* ---------- acties ---------- */
function actie(){
  if(modus==='trainer')gooi();else if(modus==='monster')aanval();
}
function gooi(){
  if(bal||trainer.gooiT>0||vangAnim)return;const lid=save.team[actiefSlot];
  const richting=new THREE.Vector3(-Math.sin(cam.yaw),0,-Math.cos(cam.yaw));
  trainer.yaw=Math.atan2(richting.x,richting.z);speelTrainer('PandaAttack1',0.08,true);trainer.gooiT=0.9;
  setTimeout(()=>{if(modus!=='trainer')return;
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.22,20,16),new THREE.MeshToonMaterial({color:'#ff4a4a'}));
    const band=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.035,8,24),new THREE.MeshToonMaterial({color:'#222'}));band.rotation.x=Math.PI/2;m.add(band);
    const onder=new THREE.Mesh(new THREE.SphereGeometry(0.221,20,16,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.MeshToonMaterial({color:'#fff'}));m.add(onder);
    m.position.copy(trainer.pos).add(new THREE.Vector3(0,1.4,0)).add(richting.clone().multiplyScalar(0.6));scene.add(m);
    // doelwit: verzwakt monster in de kijkrichting? dan mikken we daarop
    const doel=dichtstbij(trainer.pos,12,w=>!w.eigen&&!w.dood&&hoekNaar(trainer.pos,w.pos,richting)<0.5);
    const v=richting.clone().multiplyScalar(9).setY(4.5);
    if(doel){const d=doel.pos.clone().sub(m.position);const afst=d.length();v.copy(d).normalize().multiplyScalar(Math.max(6,afst*1.1)).setY(afst*0.5+2)}
    bal={mesh:m,vel:v,leeft:0,lid,doelMonster:doel};
  },260);
}
function hoekNaar(van,naar,richting){const d=naar.clone().sub(van).setY(0).normalize();return Math.acos(clamp(d.dot(richting),-1,1))}
function dichtstbij(pos,maxd,filter){let best=null,bd=maxd;for(const m of alleMonsters){if(!filter(m))continue;const d=m.pos.distanceTo(pos);if(d<bd){bd=d;best=m}}return best}

function landBal(){
  const p=bal.mesh.position.clone();p.y=0;scene.remove(bal.mesh);const b=bal;bal=null;
  // bal landt bij een wild monster -> vangpoging
  const doel=dichtstbij(p,2.4,w=>!w.eigen&&!w.dood&&w.klaar);
  if(doel){startVangen(doel,p,b.mesh);return}
  // anders: eigen monster komt eruit
  const lid=b.lid;if(lid.hp<=0){meld(`${MONSTERS[lid.id].naam} is uitgeput en moet eerst rusten.`);return}
  laatLos(lid,p);
}
function laatLos(lid,p){
  actief=new Monster(lid.id,lid.level,true);actief.hp=lid.hp;actief.pos.copy(p);wereld.corrigeer(actief.pos,0.6);actief.yaw=trainer.yaw;actief.lid=lid;
  flits(p,TYPES[actief.soort.type].kleur);modus='monster';bouwActies();
  hint(`Je bestuurt <b>${actief.soort.naam}</b>. <kbd>klik</kbd> aanval · <kbd>K</kbd> ${SPECIAAL[actief.soort.type].naam} · <kbd>Shift</kbd> sprint · <kbd>Q</kbd> terug in de bal`);
  meld(`${actief.soort.naam}, jij bent!`);
}
function terugroepen(){
  if(modus!=='monster'||!actief)return;const m=actief;m.lid.hp=m.hp;
  flits(m.pos,'#fff');m.verwijder();actief=null;modus='trainer';bouwActies();
  hint(`<kbd>spatie</kbd>/<kbd>klik</kbd> gooi je bal: op een verzwakt monster om te vangen, op de grond om je monster los te laten · <kbd>1–6</kbd> kies een monster`);
  bewaar();
}
function aanval(){
  if(!actief||actief.aanvalT>0||actief.dood)return;actief.aanvalT=0.55;actief.speelAanval();
  setTimeout(()=>{if(!actief)return;const richting=new THREE.Vector3(Math.sin(actief.yaw),0,Math.cos(actief.yaw));
    let geraakt=0;for(const w of alleMonsters){if(w.eigen||w.dood||!w.klaar)continue;const d=w.pos.distanceTo(actief.pos);
      if(d<actief.straal+w.straal+1.3&&hoekNaar(actief.pos,w.pos,richting)<1.2){doeSchade(actief,w,1.0,actief.soort.type);geraakt++}}
    if(!geraakt)schadeLabel(actief.pos.clone().add(richting),'mis','zwak')},180);
}
function speciaal(){
  if(modus!=='monster'||!actief||actief.cdSpeciaal>0||actief.dood)return;const sp=SPECIAAL[actief.soort.type];actief.cdSpeciaal=sp.cooldown;actief.speelAanval();
  const richting=new THREE.Vector3(Math.sin(actief.yaw),0,Math.cos(actief.yaw));
  const doel=dichtstbij(actief.pos,sp.bereik,w=>!w.eigen&&!w.dood&&hoekNaar(actief.pos,w.pos,richting)<0.9);
  if(sp.projectiel){const r=doel?doel.pos.clone().sub(actief.pos).setY(0).normalize():richting;schiet(actief,r,sp)}
  else if(sp.gebied){schok(actief.pos,sp.bereik,TYPES[actief.soort.type].kleur);for(const w of alleMonsters){if(w.eigen||w.dood)continue;if(w.pos.distanceTo(actief.pos)<sp.bereik)doeSchade(actief,w,sp.kracht,actief.soort.type)}}
  else{actief.lunge=1;setTimeout(()=>{if(!actief)return;for(const w of alleMonsters){if(w.eigen||w.dood)continue;if(w.pos.distanceTo(actief.pos)<actief.straal+w.straal+1.6&&hoekNaar(actief.pos,w.pos,richting)<1.3)doeSchade(actief,w,sp.kracht,actief.soort.type)}},150)}
}
function schiet(van,richting,sp){
  const kleur=TYPES[van.soort.type].kleur;const m=new THREE.Mesh(new THREE.SphereGeometry(0.28,12,10),new THREE.MeshToonMaterial({color:kleur,emissive:kleur,emissiveIntensity:0.6}));
  m.position.copy(van.pos).add(new THREE.Vector3(0,van.soort.hoogte*0.6+(van.soort.zweef||0),0)).add(richting.clone().multiplyScalar(van.straal+0.3));scene.add(m);
  projectielen.push({mesh:m,vel:richting.clone().multiplyScalar(14),van,sp,leeft:0,bereik:sp.bereik});
}
function doeSchade(van,naar,kracht,type){
  const eff=effectiviteit(type,naar.soort.type);
  const basis=van.st.atk*kracht*(0.85+Math.random()*0.3)*14/(14+naar.st.def);
  const schade=Math.max(1,Math.round(basis*eff));
  const richting=naar.pos.clone().sub(van.pos);naar.raak(schade,van,richting);
  schadeLabel(naar.pos,(eff>1.2?'super! ':'')+schade,eff>1.2?'eff':eff<0.8?'zwak':'');
  if(naar.dood&&van.eigen)versla(naar);
  if(naar.eigen&&naar.dood)eigenKO();
}
function versla(w){
  const xp=Math.round(12*w.level*(w.soort.legendarisch?4:1));const lid=actief.lid;lid.xp+=xp;meld(`${w.soort.naam} verslagen! +${xp} XP`);
  save.dex[w.id]=save.dex[w.id]||'gezien';levelCheck(lid,actief);bewaar();
}
function levelCheck(lid,m){
  while(lid.xp>=xpVoorLevel(lid.level)&&lid.level<50){lid.xp-=xpVoorLevel(lid.level);lid.level++;const st=stats(lid.id,lid.level);const oud=m?m.maxhp:stats(lid.id,lid.level-1).hp;const extra=st.hp-oud;lid.hp=Math.min(st.hp,(m?m.hp:lid.hp)+extra);
    if(m){m.level=lid.level;m.st=st;m.maxhp=st.hp;m.hp=lid.hp}meld(`${MONSTERS[lid.id].naam} is nu level ${lid.level}!`);
    const ev=MONSTERS[lid.id].evolutie;if(ev&&lid.level>=ev.level){evolueer(lid,m,ev.naar)}}
  updateTeam();
}
function evolueer(lid,m,naar){
  const oudNaam=MONSTERS[lid.id].naam;const oudMax=stats(lid.id,lid.level).hp;const ratio=Math.max(0.1,lid.hp/oudMax);lid.id=naar;const st=stats(naar,lid.level);lid.hp=Math.min(st.hp,Math.round(st.hp*ratio));
  save.dex[naar]='gevangen';meld(`Wauw! ${oudNaam} evolueert tot ${MONSTERS[naar].naam}!`,4000);
  if(m&&actief===m){const p=m.pos.clone(),yaw=m.yaw;m.verwijder();actief=new Monster(naar,lid.level,true);actief.hp=lid.hp;actief.pos.copy(p);actief.yaw=yaw;actief.lid=lid;flits(p,'#ffd62b');bouwActies()}
}
function eigenKO(){
  meld(`${actief.soort.naam} is uitgeput!`,3000);actief.lid.hp=0;const m=actief;setTimeout(()=>{if(actief===m){m.verwijder();actief=null;modus='trainer';bouwActies();hint('Je monster is uitgeput. Kies een ander (<kbd>1–6</kbd>) of rust uit bij het kamp (<kbd>E</kbd>).')}
    if(save.team.every(l=>l.hp<=0)){meld('Al je monsters zijn uitgeput… je rent terug naar het kamp.',4000);trainer.pos.set(0,0,8);for(const l of save.team){l.hp=stats(l.id,l.level).hp}}
    updateTeam();bewaar()},1400);
}
function genees(){
  if(modus!=='trainer')return;if(trainer.pos.distanceTo(new THREE.Vector3(0,0,-2))>6){meld('Rusten kan alleen bij de grote boom in het kamp.');return}
  for(const l of save.team)l.hp=stats(l.id,l.level).hp;flits(trainer.pos,'#9bffb0');meld('Je team is helemaal uitgerust!');updateTeam();bewaar();
}
function kiesSlot(i){if(!save||!save.team[i])return;if(modus==='monster'){terugroepen()}actiefSlot=i;updateTeam();meld(`${MONSTERS[save.team[i].id].naam} staat klaar.`)}

/* ---------- vangen ---------- */
function startVangen(doel,p,mesh){
  modus='vangen';doel.state='stun';doel.vel.set(0,0,0);
  const m=mesh;scene.add(m);m.position.copy(doel.pos).setY(0.4);
  const hpf=doel.hp/doel.maxhp;let kans=doel.soort.vang*(1-hpf*0.9)*(doel.verzwakt?1.6:1)*(1-Math.min(0.5,(doel.level-5)*0.012));kans=clamp(kans,0.03,0.95);
  const gelukt=Math.random()<kans;const schudden=gelukt?3:1+Math.floor(Math.random()*2);
  vangAnim={doel,m,t:0,schudden,gelukt,fase:0};
  doel.inst&&doel.inst.root.scale.set(0.01,0.01,0.01);
  hint(doel.verzwakt?'Vangen…':'Dat monster is nog sterk… vangen lukt makkelijker als het verzwakt is.');
}
function updateVangen(dt){
  const v=vangAnim;v.t+=dt;const m=v.m;
  if(v.t<2.4){const s=Math.sin(v.t*10)*(v.t<2.2?0.25:0);m.rotation.z=s;m.position.y=0.4+Math.abs(Math.sin(v.t*6))*0.15*(v.t<0.5?1:0)}
  else if(v.fase===0){v.fase=1;const d=v.doel;scene.remove(m);
    if(v.gelukt){meld(`Gefeliciteerd! Je hebt ${d.soort.naam} gevangen!`,4000);flits(d.pos,'#ffd62b');save.dex[d.id]='gevangen';
      const lid=nieuwLid(d.id,d.level);lid.hp=Math.max(1,d.hp);if(save.team.length<6){save.team.push(lid)}else{save.box.push(lid);meld('Je team is vol, het monster gaat naar de opslag.',3500)}
      d.verwijder();updateTeam();bewaar()}
    else{meld(`Oh nee! ${d.soort.naam} brak uit de bal!`,3000);if(d.inst)d.inst.root.scale.set(1,1,1);d.state='chase';d.doel=null;d.agro=10;d.boos=1}
    vangAnim=null;modus='trainer';bouwActies();hint(`<kbd>spatie</kbd>/<kbd>klik</kbd> gooi je bal · <kbd>1–6</kbd> kies een monster`);
  }
}

/* ---------- effecten ---------- */
const effecten=[];
function flits(p,kleur){const m=new THREE.Mesh(new THREE.SphereGeometry(0.6,16,12),new THREE.MeshBasicMaterial({color:kleur,transparent:true,opacity:0.9}));m.position.copy(p).setY(0.8);scene.add(m);effecten.push({m,t:0,soort:'flits'})}
function schok(p,r,kleur){const m=new THREE.Mesh(new THREE.RingGeometry(0.3,0.6,40),new THREE.MeshBasicMaterial({color:kleur,transparent:true,opacity:0.9,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.copy(p).setY(0.1);scene.add(m);effecten.push({m,t:0,soort:'schok',r})}
function updateEffecten(dt){for(let i=effecten.length-1;i>=0;i--){const e=effecten[i];e.t+=dt;if(e.soort==='flits'){e.m.scale.setScalar(1+e.t*6);e.m.material.opacity=0.9-e.t*2}else{e.m.scale.setScalar(1+e.t*e.r*3);e.m.material.opacity=0.9-e.t*2.2}if(e.m.material.opacity<=0){scene.remove(e.m);effecten.splice(i,1)}}}

/* ---------- wilde monsters ---------- */
function wildLevel(zone){const b={weide:[2,6],strand:[4,9],bos:[7,13],rots:[11,17],top:[16,24]}[zone]||[2,5];return b[0]+Math.floor(Math.random()*(b[1]-b[0]+1))}
function spawnWild(){
  const wild=alleMonsters.filter(m=>!m.eigen&&!m.dood);
  const spelerPos=modus==='monster'&&actief?actief.pos:trainer.pos;
  for(const patch of wereld.graspatches){
    const hier=wild.filter(m=>m.patch===patch).length;const d=Math.hypot(patch.x-spelerPos.x,patch.z-spelerPos.z);
    if(d>70||d<6)continue;const max=patch.zone==='top'?2:3;if(hier>=max)continue;if(Math.random()>0.004)continue;
    const soorten=ZONES[patch.zone].soorten;let id=soorten[Math.floor(Math.random()*soorten.length)];
    if(MONSTERS[id].legendarisch&&Math.random()>0.12)id=soorten[0];
    const m=new Monster(id,wildLevel(patch.zone));const a=Math.random()*6.28,r=Math.sqrt(Math.random())*patch.r;m.pos.set(patch.x+Math.sin(a)*r,0,patch.z+Math.cos(a)*r);m.yaw=Math.random()*6.28;m.patch=patch;
    save.dex[id]=save.dex[id]||'gezien';
  }
  // opruimen ver weg
  for(const m of wild){const d=m.pos.distanceTo(spelerPos);if(d>90)m.verwijder()}
}
function updateWild(m,dt){
  if(m.dood||m.state==='stun'){if(m.cover)m.vel.set(0,0,0);return}
  const speler=modus==='monster'&&actief?actief:null;
  const naarSpeler=speler?speler.pos.clone().sub(m.pos).setY(0):null;const dSpeler=naarSpeler?naarSpeler.length():1e9;
  if(m.regenT>0)m.regenT-=dt;else if(m.hp<m.maxhp)m.hp=Math.min(m.maxhp,m.hp+m.maxhp*0.02*dt);
  if(m.state==='chase'){m.agro-=dt;
    const doel=speler||(m.boos?{pos:trainer.pos}:null);
    if(!doel||m.agro<=0){m.state='wander';m.boos=0;m.vel.multiplyScalar(0.5)}
    else{const d=doel.pos.clone().sub(m.pos).setY(0);const afst=d.length();d.normalize();m.yaw=Math.atan2(d.x,d.z);
      const bereik=m.straal+(speler?speler.straal:0.6)+0.9;
      if(afst>bereik){m.vel.lerp(d.multiplyScalar(3.2*m.st.spd),dt*4)}
      else{m.vel.multiplyScalar(0.8);if(m.aanvalT<=0&&speler){m.aanvalT=1.3+Math.random()*0.6;m.speelAanval();setTimeout(()=>{if(m.dood||!actief||actief.dood)return;if(actief.pos.distanceTo(m.pos)<bereik+0.8){doeSchade(m,actief,1.0,m.soort.type)}},220)}
        else if(m.aanvalT<=0&&!speler){m.aanvalT=1.5;m.speelAanval();if(trainer.pos.distanceTo(m.pos)<bereik+0.6){trainer.vel.add(d.multiplyScalar(6));speelTrainer('Damage',0.05,true);setTimeout(()=>{trainer.huidige=null},500)}}}
      if(m.patch&&Math.hypot(m.pos.x-m.patch.x,m.pos.z-m.patch.z)>m.patch.r+16){m.state='wander';m.boos=0}}
  }else{ // rondlopen
    m.wanderT-=dt;if(m.wanderT<=0){m.wanderT=1.5+Math.random()*3;if(Math.random()<0.6&&m.patch){const a=Math.random()*6.28,r=Math.sqrt(Math.random())*m.patch.r;m.doelPos=new THREE.Vector3(m.patch.x+Math.sin(a)*r,0,m.patch.z+Math.cos(a)*r)}else m.doelPos=null}
    if(m.doelPos){const d=m.doelPos.clone().sub(m.pos).setY(0);if(d.length()<0.8)m.doelPos=null;else{d.normalize();m.yaw=lerpHoek(m.yaw,Math.atan2(d.x,d.z),dt*5);m.vel.lerp(d.multiplyScalar(1.3*m.st.spd),dt*3)}}
    else m.vel.multiplyScalar(1-dt*4);
    // schrikken van de trainer die te dichtbij komt -> kijkt
    if(dSpeler<4&&speler&&m.verzwakt){const d=m.pos.clone().sub(speler.pos).setY(0).normalize();m.vel.lerp(d.multiplyScalar(2.5),dt*3)}
  }
  m.aanvalT-=dt;
}
function lerpHoek(a,b,t){let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return a+d*Math.min(1,t)}

/* ---------- team-UI ---------- */
function updateTeam(){
  const el=$('#team');el.innerHTML='';save.team.forEach((l,i)=>{const s=MONSTERS[l.id],st=stats(l.id,l.level);const d=document.createElement('div');d.className='slot'+(i===actiefSlot?' actief':'')+(l.hp<=0?' ko':'');
    d.innerHTML=`<div><div class="nm">${i+1}. ${s.naam}</div><div class="lv">Lv ${l.level} ${tpBadge(s.type)}</div></div><div><div class="bar"><i style="width:${l.hp/st.hp*100}%"></i></div><div class="bar xp" style="margin-top:3px"><i style="width:${l.xp/xpVoorLevel(l.level)*100}%"></i></div></div>`;
    d.onclick=()=>kiesSlot(i);el.appendChild(d)});
  const n=Object.values(save.dex).filter(v=>v==='gevangen').length;$('#dex').textContent=`Monsterdex ${n}/${MAX_DEX}`;
}
function toggleMenu(){const m=$('#menu');if(m.classList.contains('weg')){vulMenu();m.classList.remove('weg');document.exitPointerLock&&document.exitPointerLock()}else m.classList.add('weg')}
function vulMenu(){
  const lijst=(arr,inTeam)=>arr.map((l,i)=>{const s=MONSTERS[l.id],st=stats(l.id,l.level);return`<div class="lid"><div class="nm">${s.naam} ${tpBadge(s.type)}</div><div class="st">Level ${l.level} · HP ${Math.round(l.hp)}/${st.hp} · Aanval ${st.atk} · Verdediging ${st.def}<br>XP ${l.xp}/${xpVoorLevel(l.level)}${s.evolutie?` · evolueert op lv ${s.evolutie.level}`:''}<br><i>${s.omschrijving}</i></div>${inTeam?(arr.length>1?`<button data-opslag="${i}">Naar opslag</button>`:''):`<button data-team="${i}">Naar team</button>`}</div>`}).join('');
  $('#teamlijst').innerHTML=lijst(save.team,true);$('#opslag').innerHTML=save.box.length?lijst(save.box,false):'<p class="sub">Nog leeg. Vang meer dan zes monsters en ze komen hier.</p>';
  $('#menu').querySelectorAll('[data-opslag]').forEach(b=>b.onclick=()=>{const i=+b.dataset.opslag;if(modus==='monster')terugroepen();save.box.push(save.team.splice(i,1)[0]);actiefSlot=0;updateTeam();bewaar();vulMenu()});
  $('#menu').querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{const i=+b.dataset.team;if(save.team.length>=6){meld('Je team is vol (6).');return}save.team.push(save.box.splice(i,1)[0]);updateTeam();bewaar();vulMenu()});
}
function vulDex(){
  const g=$('#dexgrid');g.innerHTML=Object.values(MONSTERS).sort((a,b)=>a.dex-b.dex).map(s=>{const st=save.dex[s.id];return`<div class="dexitem ${st?'':'onbekend'}"><div class="nm">#${String(s.dex).padStart(2,'0')} ${st?s.naam:'???'}</div>${st?tpBadge(s.type):''} <span style="font-size:11px">${st==='gevangen'?'✔ gevangen':st==='gezien'?'gezien':''}</span></div>`}).join('');
}
$('#dex').onclick=()=>{vulDex();$('#dexoverlay').classList.remove('weg');document.exitPointerLock&&document.exitPointerLock()};
$('#dexsluit').onclick=()=>$('#dexoverlay').classList.add('weg');
$('#menuknop').onclick=toggleMenu;$('#menusluit').onclick=toggleMenu;
$('#creditsknop').onclick=()=>{const c=$('#credits');c.style.display=c.style.display==='none'?'':'none';
  const makers={};for(const s of Object.values(MONSTERS)){(makers[s.maker]=makers[s.maker]||[]).push(s.naam)}
  $('#creditslijst').innerHTML='<p>Monsters: 3D-modellen van Sketchfab-makers, licentie CC BY 4.0, ongewijzigd behalve compressie: '+Object.entries(makers).map(([m,n])=>`<b>${m}</b> (${n.join(', ')})`).join('; ')+'.</p><p>Trainer: "Free Toon Panda Character – Detective" door MarkoJantti (CC BY 4.0). Eiland: Gobkit Nature Kit (CC0). Gebouwd met three.js.</p>'};
$('#resetknop').onclick=()=>{if(confirm('Alles wissen en opnieuw beginnen?')){localStorage.removeItem(SLEUTEL);location.reload()}};

/* ---------- startscherm ---------- */
const startPreviews=[];
function startScherm(){
  const bestaand=laadSave();
  if(bestaand){$('#verder').style.display='';$('#verderknop').onclick=()=>{save=bestaand;save.box=save.box||[];save.dex=save.dex||{};if(save.pos)trainer.pos.set(save.pos[0],0,save.pos[1]);begin()};$('#nieuwknop').onclick=()=>{$('#verder').style.display='none';$('#kies').style.display=''};$('#kies').style.display='none'}
  const el=$('#starters');el.innerHTML='';
  for(const id of STARTERS){const s=MONSTERS[id];const d=document.createElement('div');d.className='starter';d.innerHTML=`<div class="vis"><canvas width="300" height="300"></canvas></div><div class="nm">${s.naam}</div>${tpBadge(s.type)}<p>${s.omschrijving}</p>`;
    d.onclick=()=>{save={team:[nieuwLid(id,5)],box:[],dex:{[id]:'gevangen'}};begin()};el.appendChild(d);
    startPreviews.push({canvas:d.querySelector('canvas'),id})}
  startPreviews.forEach(p=>previewMonster(p));
}
async function previewMonster(p){
  const r=new THREE.WebGLRenderer({canvas:p.canvas,antialias:true,alpha:true});r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;
  const sc=new THREE.Scene();const c=new THREE.PerspectiveCamera(35,1,0.1,50);sc.add(new THREE.HemisphereLight('#fff','#888',1.4));const l=new THREE.DirectionalLight('#fff',1.6);l.position.set(2,4,3);sc.add(l);
  const g=await laad(MONSTERS[p.id].model);const inst=instantie(g,1,MONSTERS[p.id].rot);sc.add(inst.root);
  if(inst.mixer){inst.mixer.clipAction(inst.clips.find(k=>/idle/i.test(k.name))||inst.clips[0]).play()}
  c.position.set(0,0.75,2.6);c.lookAt(0,0.5,0);p.anim=t=>{inst.root.rotation.y=t*0.8;inst.mixer&&inst.mixer.update(1/60);r.render(sc,c)};
}

async function begin(){
  $('#start').classList.add('weg');modus='trainer';bouwActies();updateTeam();
  hint(`<kbd>WASD</kbd> lopen · <kbd>muis</kbd> camera · <kbd>spatie</kbd>/<kbd>klik</kbd> gooi je monsterbal · wilde monsters wonen in het hoge gras`);
  meld('Welkom op Monstereiland! Loop naar het hoge gras.',4000);
  if(location.search.includes('cover')){ /* alleen voor de omslagfoto: een groepje monsters rond het kamp */
    const ids=['rooddraakje','kwakkie','paddo','vlamdrak','spookie','blauwzap','octie','nami','vosje','dikspook','gloeidraak','sterslijm'];
    ids.forEach((id,i)=>{const m=new Monster(id,8);const a=-1.25+i*0.23;m.pos.set(Math.sin(a)*6,0,Math.cos(a)*6+4);m.yaw=Math.PI+a;m.state='stun';m.cover=true});
    cam.yaw=Math.PI;cam.pitch=0.22;cam.afstand=8;trainer.pos.set(0,0,6);trainer.yaw=Math.PI;$('.hud').style.display='none';$('#labels').style.display='none';}
  // vooraf laden van soorten in de weide
  for(const id of ZONES.weide.soorten.slice(0,5))laad(MONSTERS[id].model);
}

/* ---------- hoofdlus ---------- */
const klok=new THREE.Clock();
function lus(){
  requestAnimationFrame(lus);const dt=Math.min(0.05,klok.getDelta());tijd+=dt;
  if(modus==='start'){for(const p of startPreviews)p.anim&&p.anim(tijd);return}
  wereld.update(dt,tijd);
  // besturing: invoerrichting t.o.v. camera
  let ix=(toetsen.KeyD||toetsen.ArrowRight?1:0)-(toetsen.KeyA||toetsen.ArrowLeft?1:0),iz=(toetsen.KeyS||toetsen.ArrowDown?1:0)-(toetsen.KeyW||toetsen.ArrowUp?1:0);
  if(joy.actief){ix=joy.x;iz=joy.y}
  const menuOpen=!$('#menu').classList.contains('weg')||!$('#dexoverlay').classList.contains('weg');if(menuOpen){ix=iz=0}
  const fwd=new THREE.Vector3(-Math.sin(cam.yaw),0,-Math.cos(cam.yaw)),rechts=new THREE.Vector3(fwd.z,0,-fwd.x);
  const wens=new THREE.Vector3().addScaledVector(fwd,-iz).addScaledVector(rechts,ix);if(wens.length()>1)wens.normalize();
  const sprint=toetsen.ShiftLeft||toetsen.ShiftRight;

  // trainer
  const t=trainer;t.gooiT-=dt;
  if(modus==='trainer'||modus==='vangen'){const sp=sprint?7:4;t.vel.lerp(wens.clone().multiplyScalar(modus==='vangen'?0:sp),dt*10);
    if(wens.length()>0.1&&modus==='trainer'){t.yaw=lerpHoek(t.yaw,Math.atan2(wens.x,wens.z),dt*12)}
    if(t.gooiT<=0){if(wens.length()>0.1)speelTrainer(sprint?'PandaRun':'PandaWalk');else speelTrainer('PandaIdle1')}}
  else{t.vel.multiplyScalar(1-dt*6);if(t.huidige!=='PandaIdle1'&&t.gooiT<=0)speelTrainer('PandaIdle1')
    // trainer kijkt naar zijn monster
    if(actief){t.yaw=lerpHoek(t.yaw,Math.atan2(actief.pos.x-t.pos.x,actief.pos.z-t.pos.z),dt*4)}}
  t.pos.addScaledVector(t.vel,dt);wereld.corrigeer(t.pos,0.5);t.pos.y=wereld.hoogte(t.pos.x,t.pos.z);
  t.root.position.copy(t.pos);t.root.rotation.y=t.yaw;if(t.mixer)t.mixer.update(dt);

  // eigen monster
  if(modus==='monster'&&actief){const m=actief;if(!m.dood){const sp=(sprint?6.5:4.2)*m.st.spd;m.vel.lerp(wens.clone().multiplyScalar(sp),dt*9);
      if(wens.length()>0.1&&m.lunge<=0)m.yaw=lerpHoek(m.yaw,Math.atan2(wens.x,wens.z),dt*12);
      m.aanvalT-=dt;m.cdSpeciaal-=dt;
      const k=$('#k-speciaal');if(k)k.querySelector('.cd').style.height=(clamp(m.cdSpeciaal/SPECIAAL[m.soort.type].cooldown,0,1)*100)+'%';
      // te ver van de trainer? dan terug
      if(m.pos.distanceTo(t.pos)>28){meld('Te ver van je trainer! Je monster keert terug.');terugroepen()}}
    m.pos.addScaledVector(m.vel,dt);wereld.corrigeer(m.pos,m.straal*0.8);m.pos.y=wereld.hoogte(m.pos.x,m.pos.z)}
  if(actief&&actief.lid)actief.lid.hp=actief.hp;

  // wilde monsters
  spawnWild();
  for(const m of alleMonsters){if(!m.eigen)updateWild(m,dt);
    if(!m.eigen){m.pos.addScaledVector(m.vel,dt);m.vel.multiplyScalar(1-dt*2);wereld.corrigeer(m.pos,m.straal*0.8);m.pos.y=wereld.hoogte(m.pos.x,m.pos.z)}
    m.update(dt)}
  // monsters duwen elkaar
  for(let i=0;i<alleMonsters.length;i++)for(let j=i+1;j<alleMonsters.length;j++){const a=alleMonsters[i],b=alleMonsters[j];const d=a.pos.clone().sub(b.pos).setY(0);const L=d.length(),min=(a.straal||0.6)+(b.straal||0.6);if(L<min&&L>0.001){d.multiplyScalar((min-L)/L*0.5);a.pos.add(d);b.pos.sub(d)}}

  // bal
  if(bal){bal.leeft+=dt;bal.vel.y-=14*dt;bal.mesh.position.addScaledVector(bal.vel,dt);bal.mesh.rotation.x+=dt*12;
    if(bal.doelMonster&&!bal.doelMonster.dood&&bal.mesh.position.distanceTo(bal.doelMonster.pos.clone().setY(0.6))<1.2){landBal()}
    else if(bal.mesh.position.y<=0.2||bal.leeft>3)landBal()}
  // projectielen
  for(let i=projectielen.length-1;i>=0;i--){const p=projectielen[i];p.leeft+=dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.y+=dt*10;let klaar=p.leeft*14>p.bereik;
    for(const w of alleMonsters){if(w===p.van||w.dood||w.eigen===p.van.eigen)continue;if(w.pos.clone().setY(p.mesh.position.y).distanceTo(p.mesh.position)<w.straal+0.5){doeSchade(p.van,w,p.sp.kracht,p.van.soort.type);klaar=true;break}}
    if(klaar){flits(p.mesh.position,p.mesh.material.color.getStyle());scene.remove(p.mesh);projectielen.splice(i,1)}}
  if(vangAnim)updateVangen(dt);
  updateEffecten(dt);

  // camera
  const focus=(modus==='monster'&&actief)?actief.pos.clone().setY(actief.pos.y+actief.soort.hoogte*0.7):t.pos.clone().setY(t.pos.y+1.5);
  const off=new THREE.Vector3(Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch)).multiplyScalar(cam.afstand);
  const doelCam=focus.clone().add(off);doelCam.y=Math.max(doelCam.y,wereld.hoogte(doelCam.x,doelCam.z)+0.6);
  camera.position.lerp(doelCam,1-Math.pow(0.001,dt));camera.lookAt(focus);
  zon.position.copy(focus).add(new THREE.Vector3(30,60,20));zon.target.position.copy(focus);

  // labels en doelwit
  for(const m of alleMonsters)m.updateLabel();
  const spelerPos=modus==='monster'&&actief?actief.pos:t.pos;
  const doel=dichtstbij(spelerPos,14,w=>!w.eigen&&!w.dood&&w.klaar);const D=$('#doel');
  if(doel){D.style.display='';D.querySelector('.nm').innerHTML=`${doel.soort.naam} ${tpBadge(doel.soort.type)} <span style="font-size:12px;opacity:.7">Lv ${doel.level}</span>`;D.querySelector('.rest').textContent=`${Math.ceil(doel.hp)} / ${doel.maxhp} HP`;D.querySelector('.bar i').style.width=(doel.hp/doel.maxhp*100)+'%';D.querySelector('.zw').textContent=doel.verzwakt?'Verzwakt – gooi je bal!':doel.state==='chase'?'Boos!':''}else D.style.display='none';
  const zone=zoneOp(spelerPos.x,spelerPos.z);$('#zone').textContent=zone==='kamp'?'Kamp – rustplek':ZONES[zone].naam;
  if(Math.floor(tijd)%5===0&&dt>0&&Math.floor(tijd)!==Math.floor(tijd-dt))bewaar();

  outline.render(scene,camera);
}

/* ---------- laden ---------- */
async function init(){
  const balk=$('#laadbalk'),tekst=$('#laadtekst');
  tekst.textContent='Eiland opbouwen…';await wereld.bouw();balk.style.width='60%';
  tekst.textContent='Trainer inladen…';const g=await laad('models/trainer_panda.glb');const inst=instantie(g,1.75,Math.PI);trainer.root.add(inst.root);trainer.mixer=inst.mixer;
  for(const c of inst.clips){trainer.acties[c.name]=trainer.mixer.clipAction(c)}speelTrainer('PandaIdle1');
  balk.style.width='85%';tekst.textContent='Monsters wakker maken…';
  await Promise.all(STARTERS.map(id=>laad(MONSTERS[id].model)));balk.style.width='100%';
  $('#laden').remove();startScherm();lus();
}
init().catch(e=>{console.error(e);$('#laadtekst').textContent='Er ging iets mis bij het laden: '+e.message});
