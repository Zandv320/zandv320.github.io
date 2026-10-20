
/* ===================== game state ===================== */
let room=null;const REMOTES=new Map();let GROUP=null;/* {leader, members:[ids]} */
const myId=()=>room&&room.me?room.me():'local';
const isAuth=()=>!room||!room.connected()||room.isHost();
const netEmit=(t,d)=>{if(room&&room.connected())room.emit(t,d).catch(()=>{})};
const S={mode:'loading',t:0,sound:true};
const SAVE_KEY='velmora-save-v1';let SAVE={chars:[],last:0};
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s&&Array.isArray(s.chars))SAVE=s}catch(e){}/* verwijderde rassen (elf, grol) worden mens */for(const c of SAVE.chars)if(!RACES[c.race])c.race='mens'}
function writeSave(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE))}catch(e){}}
let P=null,ST={};
const ME={stun:0,root:0,lastPvp:null,g:null,rig:null,pos:new THREE.Vector3(),vy:0,air:false,ry:0,spd:0,atk:-1,atkRanged:false,cast:null,swing:0,gcd:0,cds:{},combat:0,buff:0,dead:false,target:null,auto:false,dash:null,spin:0,portalCd:0,lookKey:'',moved:0};

/* ---------- items ---------- */
function makeGear(slot,il,r,cls){
  il=Math.max(1,il);const rm=1+r*.3;let n,pow=0,sta=0,arm=0,it={id:uid(),kind:'gear',s:slot,r,il,req:Math.max(1,il-1),cls};
  const budget=(1.4+il*1.1)*rm*(slot==='borst'||slot==='benen'||slot==='wapen'?1.3:1);
  if(slot==='wapen'){const[bn,wt]=pick(WEAP[cls]);it.wt=wt;const avg=(3+il*2.2)*(1+r*.22);it.spd=CLASSES[cls].spd;it.min=Math.round(avg*.75);it.max=Math.round(avg*1.25);n=bn}
  else if(slot==='ring')n=pick(['Ring','Signet Ring','Band']);
  else{n=BASE[slot][cls];arm=Math.round(il*CLASSES[cls].armorK*ARM_SLOT[slot]*(1+r*.15))}
  const mt=pick(MAT[cls]);
  if(r>=1||slot==='ring'){const sf=pick(SUFFIX);pow=Math.round(budget*sf[1]);sta=Math.round(budget*sf[2]);if(!pow&&!sta)sta=1;n=(slot==='ring'?'':mt+' ')+n+' '+sf[0]}
  else{n=mt+' '+n.toLowerCase();n=n[0].toUpperCase()+n.slice(1);if(Math.random()<.5)sta=Math.max(1,Math.round(budget*.4))}
  if(r>=3){const ep={krijger:['Bonebreaker','Grave Axe of Morath','Crownsplitter'],magier:['Staff of Eternal Night','Whispering Skullstaff','Soulflame'],jager:['Shadowbow of Kaal-Morath','Bonestring','Gravewarden\'s Longbow']};if(slot==='wapen')n=pick(ep[cls]);else n='Crown Shard '+n.split(' ').slice(1).join(' ');pow=Math.round(pow*1.15+2);sta=Math.round(sta*1.15+2)}
  Object.assign(it,{n,pow,sta,arm});it.price=Math.round((il*1.6+2)*(1+r*1.3));return it}
function randSlot(){return pick(['wapen','hoofd','borst','handen','benen','voeten','ring','borst','benen'])}
const potion=(pt,q=1)=>({id:uid(),kind:'potion',pt,n:pt==='mana'?'Power Potion':'Healing Potion',q,price:1,r:0});
const matItem=(n,q=1)=>({id:uid(),kind:'mat',n,q,price:(MATS[n]||{}).price||1,r:(MATS[n]||{}).r||0});
const junkItem=(type,l)=>({id:uid(),kind:'junk',n:pick(JUNK[type]||['Junk']),q:1,price:Math.max(1,Math.round(l*.8)),r:-1});
function addItem(it){
  if(it.kind!=='gear'){const ex=P.inv.find(x=>x&&x.kind===it.kind&&x.n===it.n);if(ex){ex.q+=it.q;return true}}
  const i=P.inv.indexOf(null);if(i<0)return false;P.inv[i]=it;return true}
function countItem(pt){return P.inv.reduce((s,x)=>s+(x&&x.kind==='potion'&&x.pt===pt?x.q:0),0)}
function takePotion(pt){const i=P.inv.findIndex(x=>x&&x.kind==='potion'&&x.pt===pt);if(i<0)return false;if(--P.inv[i].q<=0)P.inv[i]=null;return true}
function newChar(name,race,cls,hair){const c={id:uid(),talents:{},pvp:false,honor:0,name,race,cls,hair,level:1,xp:0,gold:3,inv:Array(BAG).fill(null),life:{},energy:100,buffs:{},eq:{},quests:{},done:[],x:rand(-3,3),z:rand(4,8),ry:Math.PI,hp:-1,mp:-1,kills:0,created:Date.now()};
  const w=makeGear('wapen',1,0,cls);w.n={krijger:'Worn Sword',magier:'Apprentice Staff',jager:'Simple Bow'}[cls];w.wt=CLASSES[cls].wt;w.req=1;c.eq.wapen=w;c.eq.borst=makeGear('borst',1,0,cls);c.eq.borst.n={krijger:'Apprentice Shirt',magier:'Apprentice Robe',jager:'Apprentice Tunic'}[cls];
  c.inv[0]=potion('heal',3);c.inv[1]=potion('mana',2);return c}
function calcStats(){TMC=null;const C=CLASSES[P.cls],R=RACES[P.race];let pow=C.pow+C.powL*(P.level-1),sta=C.sta+C.staL*(P.level-1),arm=P.level*C.armorK*1.5;
  for(const s of SLOTS){const it=P.eq[s];if(!it)continue;pow+=it.pow||0;sta+=it.sta||0;arm+=it.arm||0}
  pow*=(R.pow||1)*(1+TM('powp'));const now=Date.now();P.buffs=P.buffs||{};let hpB=0,armB=0,dmgB=0;for(const k of['food','elixir']){const b=P.buffs[k];if(!b)continue;if(b.until<now){delete P.buffs[k];continue}const f=(MATS[b.n]||{})[k];if(!f)continue;pow*=1+(f.pow||0);hpB+=f.hp||0;armB+=f.arm||0;dmgB+=f.dmg||0}
  const w=P.eq.wapen;
  ST={pow:Math.round(pow),sta:Math.round(sta),arm:Math.round(arm*(1+armB+TM('armp'))),maxhp:Math.round((C.hp+C.hpL*(P.level-1)+sta*8)*(R.hp||1)*(1+hpB+TM('hpp'))),maxmp:C.res==='mana'?Math.round((90+P.level*16+pow*1.5)*(R.mp||1)*(1+TM('mpp'))):100,wmin:w?w.min:2,wmax:w?w.max:4,spd:w?w.spd:C.spd,crit:5+(P.cls==='jager'?5:0)+pow*.04+TM('crit'),dmgMul:(R.dmg||1)*(1+dmgB),res:C.res};
  if(P.hp<0||P.hp>ST.maxhp)P.hp=ST.maxhp;if(P.mp<0||P.mp>ST.maxmp)P.mp=ST.maxmp}
const hitDmg=(m,id='auto')=>(rand(ST.wmin,ST.wmax)+ST.pow*.45+P.level)*m*ST.dmgMul*(ME.buff>0?1.25:1)*(1+TM('wdmg')+TM(id+'.dmg')+tbuff('dmg'));

/* ---------- entities ---------- */
const MONS=[],MONMAP=new Map(),NPCOBJ=[];
const monHp=(t,l)=>Math.round((40+l*28)*(t.boss?7:t.elite?4:1)*(t.add?.5:1)*(t.hpM||1));
const monDmg=(t,l)=>(4+l*3.2)*(t.boss?.75:t.elite?1.4:1)*(t.add?.55:1);
const monXp=(t,l)=>{const d=l-P.level;if(d<=-9)return 0;const base=(l*10+35)*(t.boss?10:t.elite?2.5:1)*(t.xpM||1);return Math.round(base*(d>=0?1+.12*d:Math.max(.15,1+.12*d)))};
function genSpawns(){const r=mulberry(4242),L=[];let n=0;
  const area=(type,count,cx,cz,rad,ok)=>{for(let i=0,tr=0;i<count&&tr<800;tr++){const a=r()*6.28,d=Math.sqrt(r())*rad,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(ok&&!ok(x,z))continue;const t=MON[type];L.push({id:'m'+(n++),type,lvl:t.lv[0]+Math.floor(r()*(t.lv[1]-t.lv[0]+1)),x,z});i++}};
  area('ever',9,6,128,34,(x,z)=>pathDist(x,z)>2&&z>96);
  area('wolf',13,-4,-108,42,(x,z)=>pathDist(x,z)>5&&z<-64&&Math.hypot(x,z)>TOWN.wall+14);
  area('spin',11,-100,-196,38,(x,z)=>z<-152&&pathDist(x,z)>4&&Math.hypot(x-CRYPT.x,z-CRYPT.z)>45);
  area('rover',9,CAMP.x,CAMP.z,19,(x,z)=>Math.hypot(x-CAMP.x,z-CAMP.z)>4);
  L.push({id:'m'+(n++),type:'grisk',lvl:8,x:CAMP.x+3,z:CAMP.z+4});
  for(const s of[...DSPAWN,...D2.spawns,...D3.spawns]){const t=MON[s.t],lv=s.lv||t.lv;L.push({id:'m'+(n++),type:s.t,lvl:lv[0]+Math.floor(r()*(lv[1]-lv[0]+1)),x:s.x,z:s.z})}
  /* Drakenrijk */
  const dk=(x,z)=>!drkLava(x,z)&&riverDist(x,z)[0]>4&&Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)>40&&Math.hypot(x-VOLC.x,z-VOLC.z)>VOLC.r*.7;
  area('raptor',12,DRK.x-95,DRK.z-95,36,dk);area('vleer',10,DRK.x+5,DRK.z-128,34,dk);area('welp',12,DRK.x+5,DRK.z+122,38,dk);area('drakonier',9,DRK.x+118,DRK.z,40,dk);
  for(const[u,v]of[[58,-52],[56,54],[-12,-74]]){const x=DRK.x+u,z=DRK.z+v;L.push({id:'m'+(n++),type:'lavadrake',lvl:17+Math.floor(r()*2),x,z})}
  /* the Woods of Elvia */
  const ev=(x,z)=>Math.hypot(x-WS.x,z-WS.z)>WS.R+30&&!ELV_LAKES.some(l=>Math.hypot(x-l.x,z-l.z)<l.r*1.15)&&elvRiver(x,z)[0]>8&&elvPathDist(x,z)>6&&Math.hypot(x-ELV_EXIT.x,z-ELV_EXIT.z)>50&&Math.max(Math.abs(x-ELV.x),Math.abs(z-ELV.z))<410;
  const hi=(x,z)=>(z-ELV.z)<elvCliff(x-ELV.x)-14,lo=(x,z)=>(z-ELV.z)>elvCliff(x-ELV.x)+10;
  area('elvwolf',16,ELV.x-300,ELV.z-10,95,(x,z)=>ev(x,z)&&lo(x,z));area('elvspider',14,ELV.x+320,ELV.z+130,75,(x,z)=>ev(x,z)&&lo(x,z));
  area('elvbandit',9,ELV_CAMP.x,ELV_CAMP.z,16,(x,z)=>Math.hypot(x-ELV_CAMP.x,z-ELV_CAMP.z)>4);L.push({id:'m'+(n++),type:'outlawking',lvl:23,x:ELV_CAMP.x+2,z:ELV_CAMP.z-3});
  area('fenraptor',12,ELV.x+320,ELV.z-40,60,(x,z)=>ev(x,z)&&lo(x,z));area('mossbrute',11,ELV.x+70,ELV.z-310,90,(x,z)=>ev(x,z)&&hi(x,z));
  area('elvwisp',11,ELV.x-100,ELV.z-100,78,(x,z)=>ev(x,z)&&lo(x,z)&&Math.hypot(x-ELV_LAKES[0].x,z-ELV_LAKES[0].z)>50);
  area('elderstag',4,ELV.x-140,ELV.z+170,60,(x,z)=>ev(x,z));L.push({id:'m'+(n++),type:'oakheart',lvl:25,x:ELV.x-210,z:ELV.z-320});
  return L}
function makeMon(sp){const t=MON[sp.type];const m={kind:'mon',id:sp.id,type:sp.type,t,lvl:sp.lvl,sx:sp.x,sz:sp.z,x:sp.x,z:sp.z,y:groundH(sp.x,sp.z),ry:Math.random()*6.28,nx:sp.x,nz:sp.z,nry:0,mhp:monHp(t,sp.lvl),hp:1,tgt:null,threat:{},atkT:1,ac:0,mv:0,slow:0,stun:0,root:0,dead:false,deadT:0,taps:new Set(),wan:{x:sp.x,z:sp.z,t:rand(1,8)},evade:false,atk:-1,loot:null,add:!!t.add,predUntil:0,bt:{stomp:9,bolt:5,sum:0,enr:0},sent:null};
  m.hp=m.mhp;m.nry=m.ry;m.lodk=MONS.length%3;m.rig=buildMonster(sp.type,sp.lvl);m.rig.g.position.set(m.x,m.y,m.z);m.rig.g.userData.ent=m;scene.add(m.rig.g);m.size=(t.size||1);MONS.push(m);MONMAP.set(m.id,m);return m}
function removeMon(m){scene.remove(m.rig.g);const i=MONS.indexOf(m);if(i>=0)MONS.splice(i,1);MONMAP.delete(m.id);if(ME.target===m)setTarget(null);if(m.plate)m.plate.remove();if(m.spark){scene.remove(m.spark);m.spark=null}}
for(const sp of genSpawns())makeMon(sp);
for(const n of NPCS){const o={race:n.look.dwarf?'dwerg':'mens',...n.look};const rig=window.__NOGLTF?buildHumanoid(o):buildGltfNpc(n.id,n.look);const y=groundH(n.x,n.z);rig.g.position.set(n.x,y,n.z);rig.g.rotation.y=n.ry;scene.add(rig.g);const e={kind:'npc',...n,y,rig,def:n};rig.g.userData.ent=e;NPCOBJ.push(e);addCol(n.x,n.z,.6)}
/* town guards (ambient) */
const WS_GUARD_SPOTS=WS_GATES.flatMap(g=>[-1,1].map(sd=>{const a=g+sd*.075,r=WS.R-7;return[WS.x+Math.cos(a)*r,WS.z+Math.sin(a)*r,Math.atan2(Math.cos(g),Math.sin(g))-Math.PI]}));
const GUARDS=[];for(const[x,z,a]of[...WS_GUARD_SPOTS,...TOWN_GATES.flatMap((g,i)=>(i%2?[1]:[-1,1]).map(sd=>{const a=g+sd*.112,r=TOWN.wall-5.5;return[Math.cos(a)*r,Math.sin(a)*r,Math.atan2(Math.cos(g),Math.sin(g))-Math.PI]})).filter(([x,z])=>pathDist(x,z)>4.6)]){const gl={race:'mens',skin:0xd9a98a,hair:0x3b2414,chest:0x3f5a9a,pants:0x2a2a30,cape:0x2a4a9a,wt:'zwaard',helm:1,pads:0x8a9098,shield:1};const rig=window.__NOGLTF?buildHumanoid(gl):buildGltfNpc('guard',gl);rig.g.position.set(x,groundH(x,z),z);rig.g.rotation.y=a+Math.PI;scene.add(rig.g);GUARDS.push(rig);addCol(x,z,.6)}

/* ---------- fx ---------- */
const FX=[],PROJ=[];
const fxGeo={ring:new THREE.RingGeometry(.85,1,48).rotateX(-Math.PI/2),disc:new THREE.CircleGeometry(1,40).rotateX(-Math.PI/2),orb:new THREE.IcosahedronGeometry(.28,1),arrow:new THREE.CylinderGeometry(.03,.03,1,4).rotateX(Math.PI/2),beam:new THREE.CylinderGeometry(1,1,30,16,1,true)};
function addMat(c,o=.9){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})}
function ringFx(x,z,r,c,dur=.5,y){const m=new THREE.Mesh(fxGeo.ring,addMat(c));m.position.set(x,(y??groundH(x,z))+.15,z);scene.add(m);FX.push({m,t:0,dur,up:(f)=>{m.scale.setScalar(r*(.2+.8*f));m.material.opacity=.95*(1-f)}})}
function discFx(x,z,r,c,dur=.6){const m=new THREE.Mesh(fxGeo.disc,addMat(c,.5));m.position.set(x,groundH(x,z)+.12,z);m.scale.setScalar(r);scene.add(m);FX.push({m,t:0,dur,up:f=>{m.material.opacity=.55*(1-f)}})}
function beamFx(x,z,c,dur=1.2,r=1.2){const m=new THREE.Mesh(fxGeo.beam,addMat(c,.5));m.position.set(x,groundH(x,z)+15,z);scene.add(m);FX.push({m,t:0,dur,up:f=>{m.scale.set(r*(1-f*.6),1,r*(1-f*.6));m.material.opacity=.6*(1-f)}})}
function burst(x,y,z,c,n=18,sp=5,dur=.8,sz=.25){const g=new THREE.BufferGeometry(),p=new Float32Array(n*3),v=[];for(let i=0;i<n;i++){p[i*3]=x;p[i*3+1]=y;p[i*3+2]=z;v.push([rand(-1,1)*sp,rand(.2,1.4)*sp,rand(-1,1)*sp])}g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:c,size:sz,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(m);
  FX.push({m,t:0,dur,up:(f,dt)=>{for(let i=0;i<n;i++){v[i][1]-=9*dt;p[i*3]+=v[i][0]*dt;p[i*3+1]+=v[i][1]*dt;p[i*3+2]+=v[i][2]*dt}g.attributes.position.needsUpdate=true;m.material.opacity=1-f}})}
function teleFx(x,z,r,dur){const m=new THREE.Mesh(fxGeo.disc,new THREE.MeshBasicMaterial({color:0xff2020,transparent:true,opacity:.2,depthWrite:false}));const rr=new THREE.Mesh(fxGeo.ring,addMat(0xff4040));m.position.set(x,groundH(x,z)+.1,z);rr.position.copy(m.position);rr.scale.setScalar(r);scene.add(m,rr);
  FX.push({m,t:0,dur,up:f=>{m.scale.setScalar(r*f);m.material.opacity=.15+f*.3;if(f>=1)scene.remove(rr)},end:()=>{scene.remove(rr);burst(x,groundH(x,z)+.5,z,0xa05aff,40,8,.9,.4);ringFx(x,z,r,0xa05aff,.5);sfx('boom')}})}
function updFx(dt){for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t+=dt;const k=Math.min(1,f.t/f.dur);f.up(k,dt);if(k>=1){scene.remove(f.m);if(f.m.geometry&&f.m.isPoints)f.m.geometry.dispose();if(f.m.material)f.m.material.dispose();if(f.end)f.end();FX.splice(i,1)}}}
const PCOL={kogel:0xffe9a0,fire:0xff8a20,frost:0x9ae0ff,arcane:0xc08aff,shadow:0x9a3aff,arrow:0xf0e0b0,meteor:0xff6010,holy:0xffe08a};
function entPos(e,out){if(!e)return null;if(e==='me'){out.set(ME.pos.x,ME.pos.y+1.2,ME.pos.z);return out}if(e.kind==='mon'){out.set(e.x,e.y+(e.rig.h||1.5)*.6,e.z);return out}if(e.kind==='pl'){out.set(e.x,e.y+1.2,e.z);return out}if(Array.isArray(e)){out.set(e[0],e[1],e[2]);return out}return null}
function proj(type,from,tgt,speed,onHit){let m;const arc=type==='arrow';if(type==='arrow'){m=new THREE.Mesh(fxGeo.arrow,new THREE.MeshBasicMaterial({color:0xf0e0b0}))}else{m=new THREE.Mesh(fxGeo.orb,addMat(PCOL[type]||0xffffff,1));if(type==='meteor')m.scale.setScalar(3.2);else if(type==='shadow')m.scale.setScalar(1.4);else if(type==='kogel')m.scale.setScalar(.38)}
  m.position.copy(from);scene.add(m);PROJ.push({m,type,tgt,speed,onHit,t:0,tv:new THREE.Vector3(),arc,from:from.clone(),f:0,last:from.clone()})}
function updProj(dt){for(let i=PROJ.length-1;i>=0;i--){const p=PROJ[i];p.t+=dt;const tp=entPos(p.tgt,p.tv);if(!tp||p.t>4){scene.remove(p.m);PROJ.splice(i,1);continue}
  if(p.arc){const total=p.from.distanceTo(tp);const T=Math.max(.12,total/p.speed);p.f=Math.min(1,p.f+dt/T);const f=p.f;const hgt=Math.min(6,total*.11);p.last.copy(p.m.position);p.m.position.lerpVectors(p.from,tp,f);p.m.position.y+=4*hgt*f*(1-f);
    const dirv=p.m.position.clone().sub(p.last);if(dirv.lengthSq()>1e-6)p.m.lookAt(p.m.position.clone().add(dirv));
    projTrail('arrow',p.m.position,dt);if(f>=1){scene.remove(p.m);PROJ.splice(i,1);projImpact('arrow',p.m.position.x,p.m.position.y,p.m.position.z);if(p.onHit)p.onHit();continue}continue}
  const d=tp.clone().sub(p.m.position),L=d.length(),st=p.speed*dt;
  if(L<=st+.2){scene.remove(p.m);PROJ.splice(i,1);projImpact(p.type,tp.x,tp.y,tp.z);if(p.onHit)p.onHit();continue}
  d.multiplyScalar(1/L);p.m.position.addScaledVector(d,st);if(p.type==='arrow')p.m.lookAt(tp);projTrail(p.type,p.m.position,dt)}}
const trailPts=(()=>{const n=300,g=new THREE.BufferGeometry(),p=new Float32Array(n*3).fill(-9999),life=new Float32Array(n),c=new Float32Array(n*3);g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));const m=new THREE.Points(g,new THREE.PointsMaterial({size:.35,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));m.frustumCulled=false;scene.add(m);return{n,g,p,life,c,i:0}})();
const _tc=new THREE.Color();
function trail(pos,col){const T=trailPts,i=T.i++%T.n;T.p[i*3]=pos.x+rand(-.1,.1);T.p[i*3+1]=pos.y+rand(-.1,.1);T.p[i*3+2]=pos.z+rand(-.1,.1);T.life[i]=.5;_tc.setHex(col);T.c[i*3]=_tc.r;T.c[i*3+1]=_tc.g;T.c[i*3+2]=_tc.b}
function updTrail(dt){const T=trailPts;for(let i=0;i<T.n;i++){if(T.life[i]<=0)continue;T.life[i]-=dt;T.p[i*3+1]+=dt*.6;const k=Math.max(0,T.life[i]/.5);T.c[i*3]*=.96;T.c[i*3+1]*=.96;T.c[i*3+2]*=.96;if(T.life[i]<=0)T.p[i*3+1]=-9999;void k}T.g.attributes.position.needsUpdate=true;T.g.attributes.color.needsUpdate=true}
/* floating combat text & nameplates live in HTML */
const platesEl=$('#plates');const FTXT=[];
function floatText(e,txt,cls){const el=document.createElement('div');el.className='ft '+cls;el.textContent=txt;platesEl.appendChild(el);const v=new THREE.Vector3();entPos(e,v)||v.copy(e);v.y+=.6;FTXT.push({el,v,t:0,ox:rand(-30,30)})}
const _v=new THREE.Vector3();
function updFloat(dt,W,H){for(let i=FTXT.length-1;i>=0;i--){const f=FTXT[i];f.t+=dt;if(f.t>1.15){f.el.remove();FTXT.splice(i,1);continue}_v.copy(f.v).project(camera);if(_v.z>1){f.el.style.opacity=0;continue}const x=(_v.x*.5+.5)*W+f.ox,y=(-_v.y*.5+.5)*H-f.t*60;f.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${f.t<.12?1+(.12-f.t)*5:1})`;f.el.style.opacity=f.t>.8?(1.15-f.t)/.35:1}}

/* ---------- audio (tiny synth) ---------- */
let AC=null;function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}return AC}
function tone(f,d,v=.05,type='sine',slide=0){if(!S.sound)return;const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),a.currentTime+d);g.gain.value=v;g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d)}
function sfx(k){if(k==='hit')tone(180,.12,.06,'square',.5);else if(k==='swing')tone(420,.08,.03,'triangle',.4);else if(k==='fire')tone(300,.35,.04,'sawtooth',.3);else if(k==='frost')tone(900,.4,.03,'sine',.5);else if(k==='lvl'){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.35,.06,'triangle'),i*110))}else if(k==='loot')tone(880,.12,.04,'sine',1.5);else if(k==='quest'){[392,523,659].forEach((f,i)=>setTimeout(()=>tone(f,.3,.05,'triangle'),i*120))}else if(k==='hurt')tone(140,.15,.06,'sawtooth',.6);else if(k==='boom')tone(90,.6,.09,'sawtooth',.3);else if(k==='bow')tone(600,.1,.03,'triangle',.5);else if(k==='chat')tone(700,.06,.025)}

/* ---------- player ---------- */
function rebuildMe(){const look=playerLook(P);ME.look=look;const key=JSON.stringify(look);if(key===ME.lookKey&&ME.rig)return;ME.lookKey=key;if(ME.rig)scene.remove(ME.rig.g);ME.rig=buildHumanoid(look);ME.rig.g.userData.ent='me';scene.add(ME.rig.g)}
function setTarget(e){ME.target=e;if(!e)ME.auto=false;updTargetFrame(true)}
const SAFE='Silverbrook';
function pvpHostile(r){return !!(r&&r.kind==='pl'&&P&&P.pvp&&r.pvp&&!r.dead&&!ME.dead&&!(GROUP&&GROUP.members.includes(r.id))&&zoneAt(ME.pos.x,ME.pos.z)!==SAFE&&zoneAt(r.x,r.z)!==SAFE)}
function isEnemy(e){return !!e&&(e.kind==='mon'?!e.dead:pvpHostile(e))}
function enemiesNear(x,z,rad){const L=[];for(const m of MONS)if(!m.dead&&Math.hypot(m.x-x,m.z-z)<rad+m.size*.5)L.push(m);for(const r of REMOTES.values())if(pvpHostile(r)&&Math.hypot(r.x-x,r.z-z)<rad+.5)L.push(r);return L}
function distTo(e){if(!e)return 1e9;if(e.kind==='mon')return Math.hypot(e.x-ME.pos.x,e.z-ME.pos.z);return Math.hypot(e.x-ME.pos.x,e.z-ME.pos.z)}
function nearestEnemy(maxD=40,exclude){let best=null,bd=maxD;for(const m of MONS){if(m.dead||m===exclude)continue;const d=Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z);if(d<bd){bd=d;best=m}}return best}
function cycleTarget(){const list=[...MONS.filter(m=>!m.dead),...[...REMOTES.values()].filter(pvpHostile)].filter(m=>Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z)<35).sort((a,b)=>Math.hypot(a.x-ME.pos.x,a.z-ME.pos.z)-Math.hypot(b.x-ME.pos.x,b.z-ME.pos.z));if(!list.length)return toast('No enemies nearby');const i=list.indexOf(ME.target);setTarget(list[(i+1)%list.length])}
const bar=()=>[...ABIL[P.cls],...talentSkills(),...COMMON_ABIL];
let toastT=0;function toast(t){const e=$('#toast');e.textContent=t;e.style.opacity=1;toastT=1.6}
function resName(){return{energie:'energy',mana:'mana',focus:'focus'}[ST.res]}
function useAbility(i){
  if(!P||ME.dead||S.mode!=='play')return;if(ME.mounted)dismount();if(ACT.cur){if(ACT.cur.k==='fish')endFish();ACT.cur=null;$('#castbar').hidden=true}if(ME.stun>0)return toast('You are stunned');const a=bar()[i];if(!a)return;
  if(P.level<a.lvl)return toast('You learn '+a.n+' at level '+a.lvl);
  if((ME.cds[a.id]||0)>0)return toast('That ability is not ready yet');
  if(ME.cast)return toast('You are still busy');
  if(!a.item&&ME.gcd>0)return;
  if(a.item&&!countItem(a.item))return toast('You have no '+a.n.toLowerCase()+'s left');
  if(abCost(a)>P.mp)return toast('Not enough '+resName());
  let tg=null;if(a.need){tg=isEnemy(ME.target)?ME.target:null;if(!tg){tg=nearestEnemy(a.range+2);if(tg)setTarget(tg)}if(!tg)return toast('You have no target');
    const d=distTo(tg)-tg.size*.6;if(d>a.range)return toast('Your target is too far away');if(a.min&&d<a.min)return toast('You are too close');
    if(a.cond==='exec'&&tg.hp/(tg.mhp||1)>.3)return toast('Only on enemies below 30% health');faceTo(tg.x,tg.z);ME.auto=true}
  if(a.cast){ME.cast={a,t:0,dur:abCast(a),tg};$('#castbar').hidden=false;return}
  execAbility(a,tg)}
function faceTo(x,z){ME.ry=Math.atan2(x-ME.pos.x,z-ME.pos.z)}
function startCd(a){const cd=abCd(a);if(cd)ME.cds[a.id]=cd;if(!a.item)ME.gcd=1;P.mp-=abCost(a);ME.combat=Math.max(ME.combat,a.item?0:5)}
const _f=new THREE.Vector3();
function myHand(){return _f.set(ME.pos.x+Math.sin(ME.ry)*.5,ME.pos.y+1.4,ME.pos.z+Math.cos(ME.ry)*.5).clone()}
function fxEmit(o){netEmit('fx',o)}
function execAbility(a,tg){if(a.mount){doMount();return}if(a.way){waystoneArrive(a.way);return}
  startCd(a);const id=a.id;
  if(id==='slag'){swingAnim(false);sfx('swing');setTimeout(()=>{if(!tg.dead){slamFx(tg.x,tg.y+(tg.rig&&tg.rig.h||1.5)*.55,tg.z,ME.ry);fxEmit({k:'sl',x:tg.x,y:tg.y+(tg.rig&&tg.rig.h||1.5)*.55,z:tg.z,r:ME.ry});dealDamage(tg,hitDmg(1.5,id));if(TM('slag.leech'))heal(ST.maxhp*TM('slag.leech'));sfx('hit');}},140);ME.swing=Math.max(ME.swing,.6)}
  else if(id==='storm'){const dx=tg.x-ME.pos.x,dz=tg.z-ME.pos.z,L=Math.hypot(dx,dz);ME.dash={x:tg.x-dx/L*1.6,z:tg.z-dz/L*1.6,t:Math.min(.45,L/40),t0:0,sx:ME.pos.x,sz:ME.pos.z,tg};sfx('swing')}
  else if(id==='werv'){ME.spin=.6;sfx('swing');whirlFx(ME.pos.x,ME.pos.y,ME.pos.z);fxEmit({k:'r',x:ME.pos.x,z:ME.pos.z,r:6,c:0xdde6ff});for(const m of enemiesNear(ME.pos.x,ME.pos.z,6))dealDamage(m,hitDmg(1.1,id))}
  else if(id==='kreet'){ME.buff=12;heal(ST.maxhp*(.25+TM('kreet.heal')));shoutFx(ME.pos.x,ME.pos.y,ME.pos.z);beamFx(ME.pos.x,ME.pos.z,0xffb030,.8,1);fxEmit({k:'r',x:ME.pos.x,z:ME.pos.z,r:5,c:0xffc040});sfx('quest')}
  else if(id==='vuur'){swingAnim(true);sfx('fire');proj('fire',myHand(),tg,26,()=>dealDamage(tg,hitDmg(1.7,id)));fxEmit({k:'p',t:'fire',f:myHand().toArray(),m:tg.id})}
  else if(id==='nova'){sfx('frost');novaFx(ME.pos.x,ME.pos.z);fxEmit({k:'r',x:ME.pos.x,z:ME.pos.z,r:9,c:0x9ae0ff});for(const m of enemiesNear(ME.pos.x,ME.pos.z,9))dealDamage(m,hitDmg(.45,id),{root:4+TM('nova.root')})}
  else if(id==='flits'){twirlFx(ME.pos.x,ME.pos.y+1,ME.pos.z,0xc08aff);const _b0=[ME.pos.x,ME.pos.y,ME.pos.z];const p={x:ME.pos.x+Math.sin(ME.ry)*13,z:ME.pos.z+Math.cos(ME.ry)*13};for(let k=0;k<6;k++)collide(p,.5);ME.pos.x=p.x;ME.pos.z=p.z;ME.pos.y=groundH(p.x,p.z);twirlFx(ME.pos.x,ME.pos.y+1,ME.pos.z,0xc08aff);blinkFx(_b0[0],_b0[1],_b0[2],ME.pos.x,ME.pos.y,ME.pos.z);fxEmit({k:'tw',x:ME.pos.x,z:ME.pos.z,fx:_b0[0],fz:_b0[2]});sfx('frost')}
  else if(id==='meteoor'){const from=new THREE.Vector3(tg.x-6,tg.y+26,tg.z-6);teleFx(tg.x,tg.z,6,.0001);meteorWarnFx(tg.x,tg.z);sfx('fire');const tx=tg.x,tz=tg.z;proj('meteor',from,[tx,groundH(tx,tz),tz],34,()=>{sfx('boom');ringFx(tx,tz,6,0xff7a30,.5);for(const m of enemiesNear(tx,tz,6))dealDamage(m,hitDmg(2.6,id))});fxEmit({k:'p',t:'meteor',f:from.toArray(),x:tx,z:tz})}
  else if(id==='schot'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,48,()=>dealDamage(tg,hitDmg(1.5,id)));fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
  else if(id==='multi'){swingAnim(true);sfx('bow');const L=[tg,...MONS.filter(m=>m!==tg&&!m.dead&&Math.hypot(m.x-tg.x,m.z-tg.z)<8).slice(0,4+TM('multi.targets'))];for(const m of L){proj('arrow',myHand(),m,46,()=>dealDamage(m,hitDmg(.95,id)));fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:m.id})}}
  else if(id==='sprong'){ME.dash={x:ME.pos.x-Math.sin(ME.ry)*11,z:ME.pos.z-Math.cos(ME.ry)*11,t:.5,t0:0,sx:ME.pos.x,sz:ME.pos.z,leap:1};ME.vy=7;ME.air=true;sfx('swing')}
  else if(id==='regen'){swingAnim(true);sfx('bow');const tx=tg.x,tz=tg.z;rainFx(tx,tz);fxEmit({k:'r',x:tx,z:tz,r:6,c:0xffd36a});for(let k=0;k<14;k++){const x=tx+rand(-5,5),z=tz+rand(-5,5);proj('arrow',new THREE.Vector3(x-2,groundH(x,z)+18,z-2),[x,groundH(x,z),z],40+rand(0,10),null)}setTimeout(()=>{for(const m of enemiesNear(tx,tz,6))dealDamage(m,hitDmg(2.3,id))},450)}
  else if(id==='drank'){takePotion('heal');heal(ST.maxhp*.45);healFx(ME.pos.x,ME.pos.y,ME.pos.z,0x70ff8a);refreshBag()}
  else if(id==='mdrank'){takePotion('mana');P.mp=Math.min(ST.maxmp,P.mp+ST.maxmp*.5);healFx(ME.pos.x,ME.pos.y,ME.pos.z,0x6aa8ff);refreshBag()}
  else if(id==='thuis'){beamFx(ME.pos.x,ME.pos.z,0x7cf0ff,1.2);twirlFx(ME.pos.x,ME.pos.y+1,ME.pos.z,0x7cf0ff);teleport(...hearthTarget());beamFx(ME.pos.x,ME.pos.z,0x7cf0ff,1.2);sfx('frost')}
  else execTalentSkill(a,tg);
  buildBar(true)}
function heal(n){n=Math.round(n);P.hp=Math.min(ST.maxhp,P.hp+n);floatText('me','+'+n,'heal')}
function teleport(x,z){ME.pos.set(x,groundH(x,z),z);PERF.t=0;ME.dash=null;ME.portalCd=2;if(ME.target&&ME.target.kind==='mon'&&Math.hypot(ME.target.x-x,ME.target.z-z)>60)setTarget(null);ME.combat=0;snapCam=true;updZone(true)}
function dealDamage(m,dmg,o={}){
  if(m&&m.kind==='pl'){if(!pvpHostile(m))return;const crit=Math.random()*100<ST.crit+tbuff('crit');if(crit)dmg*=2+TM('critdmg');if(m.hp/(m.mhp||1)<.35)dmg*=1+TM('exec');dmg=Math.max(1,Math.round(dmg));if(Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z)<5)hitFx(m.x,m.y+1.1,m.z,crit);floatText(m,dmg+(crit?'!':''),crit?'dmg crit':'dmg');ME.combat=6;ME.pvpT=performance.now();netEmit('pdmg',{to:m.id,d:dmg,l:P.level,r:o.root||0,s:o.stun||0});return}
  if(!m||m.dead||m.kind!=='mon')return;if(m.evade){floatText(m,'Dodged','miss');return}
  const crit=Math.random()*100<ST.crit+tbuff('crit');if(crit)dmg*=2+TM('critdmg');if(m.hp/(m.mhp||1)<.35)dmg*=1+TM('exec');dmg=Math.max(1,Math.round(dmg));
  {const hy=m.y+(m.rig.h||1.5)*.55;if(Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z)<5+(m.size||1))hitFx(m.x,hy,m.z,crit);else if(crit)emitP({x:m.x,y:hy+.3,z:m.z,life:.45,size:2,size1:3.2,col:0xffe080,a:1,a1:0,cell:FXC.crit,vrot:2,must:1})}
  floatText(m,dmg+(crit?'!':''),crit?'dmg crit':'dmg');ME.combat=6;m.hurtT=.3;if(!ME.target)setTarget(m);
  if(isAuth())authDamage(m,dmg,myId(),o);else{netEmit('dmg',{m:m.id,d:dmg,r:o.root||0,s:o.stun||0});m.hp=Math.max(1,m.hp-dmg);m.predUntil=performance.now()+450;if(o.root)m.root=o.root;if(o.stun)m.stun=o.stun}}
function authDamage(m,dmg,from,o={}){if(m.dead||m.evade)return;m.hp-=dmg;m.threat[from]=(m.threat[from]||0)+dmg;m.taps.add(from);if(!m.tgt){m.tgt=from;if(m.t.boss)bossEngage(m)}if(o.root)m.root=Math.max(m.root,o.root);if(o.stun)m.stun=Math.max(m.stun,o.stun);if(m.hp<=0)killMon(m)}
function killMon(m){const taps=[...m.taps];m.dead=true;m.hp=0;m.deadT=m.add?6:(m.t.respawn||28);m.tgt=null;m.threat={};m.taps.clear();
  if(m.t.boss){for(const a of MONS.filter(x=>x.add&&!x.dead&&Math.abs(x.x-m.x)<90))killMon(a);m.bt={stomp:9,bolt:5,sum:0,enr:0};if(m.t.dragon)dragonReset(m)}
  netEmit('mdie',{id:m.id,taps});onMonDeath(m,taps)}
function onMonDeath(m,taps){m.dead=true;m.hp=0;m.atk=-1;if(ME.target===m)ME.auto=false;
  const me=myId();let ok=taps.includes(me);if(!ok&&GROUP&&taps.some(t=>GROUP.members.includes(t))&&Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z)<90)ok=true;
  if(ok&&P&&S.mode==='play')reward(m);
  if(m.t.boss&&S.mode==='play'&&Math.abs(ME.pos.x-m.x)<80)banner(m.t.n.split(' ')[0]+' has been defeated!',m.type==='vyraxion'?'The Ash Queen has fallen — the Dragon Realm is free':m.type==='ignaroth'?'The fire dies out':'The crypt falls silent');if(m.t.dragon){m.flyH=0;clearPools()}}
function reward(m){
  const t=m.t;const xp=monXp(t,m.lvl);if(xp)gainXp(xp,m);P.kills++;
  for(const q of QUESTS){const st=P.quests[q.id];if(!st||st.n>=q.obj.n)continue;
    if(q.obj.kill&&q.obj.kill.includes(m.type)){st.n++;log(q.obj.lbl+': '+st.n+'/'+q.obj.n,'sys');if(st.n>=q.obj.n){log('Quest complete: '+q.n+' — return to '+npcName(q.giver),'sys');sfx('quest')}}
    if(q.obj.collect&&q.obj.collect.includes(m.type)&&Math.random()<q.obj.chance){st.n++;log(q.obj.item+' verzameld: '+st.n+'/'+q.obj.n,'loot');if(st.n>=q.obj.n){log('Quest complete: '+q.n+' — return to '+npcName(q.giver),'sys');sfx('quest')}}}
  const L={gold:Math.round(m.lvl*rand(.6,1.6)*(t.elite?4:1)*(t.boss?6:1)),items:[]};
  if(Math.random()<(t.boss?1:t.elite?1:.3)){const r=rollRarity(t);L.items.push(makeGear(randSlot(),m.lvl,r,P.cls))}
  if(t.dragon){L.items.length=0;L.items.push(makeLegendary(P.cls));L.items.push(makeGear(randSlot(),22,3,P.cls));L.items.push(potion('heal',3))}
  else if(t.boss){L.items.push(makeGear('wapen',11,3,P.cls));L.items.push(makeGear(randSlot(),11,2,P.cls))}
  {const sp=shoulderDrop(m.type);if(sp){L.items.push(sp);log('✦ '+t.n+' dropped <span style="color:'+rarCol(sp)+'">['+esc(sp.n)+']</span>!','loot',true)}}
  if(Math.random()<.45&&!t.add)L.items.push(junkItem(m.type,m.lvl));
  if((m.type==='ever'||m.type==='wolf')&&Math.random()<.55)L.items.push(matItem('Raw Meat',1));
  if(Math.random()<.12)L.items.push(potion(Math.random()<.6?'heal':'mana'));
  {const mid=mountDropFor(m.type);if(mid)setTimeout(()=>learnMount(mid,'A rare find! Press R to ride'),600)}
  m.loot=L;addSpark(m);refreshTracker();refreshNpcMarks()}
function rollRarity(t){const r=Math.random();if(t.boss)return r<.5?3:2;if(t.elite)return r<.15?3:r<.7?2:1;return r<.015?3:r<.09?2:r<.35?1:0}
function addSpark(m){if(m.spark)scene.remove(m.spark);const n=24,g=new THREE.BufferGeometry(),p=new Float32Array(n*3);g.setAttribute('position',new THREE.BufferAttribute(p,3));const s=new THREE.Points(g,new THREE.PointsMaterial({color:0xffd34d,size:.22,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));s.userData.n=n;s.position.set(m.x,m.y,m.z);scene.add(s);m.spark=s}
function lootMon(m){if(!m.loot)return;const L=m.loot;if(L.gold){P.gold+=L.gold;floatText(m,'+'+L.gold+' gold','gold');log('You receive '+L.gold+' gold.','loot')}
  const left=[];for(const it of L.items){if(addItem(it)){log('You receive: <span style="color:'+rarCol(it)+'">['+esc(it.n)+']</span>'+(it.q>1?' x'+it.q:''),'loot',true)}else left.push(it)}
  if(left.length){toast('Your bag is full');L.items=left;L.gold=0}else{m.loot=null;if(m.spark){scene.remove(m.spark);m.spark=null}if(SKIN[m.type]&&!m.skinned&&lifeOf('skinning').lv>=SKIN[m.type].lv)toast('Press F again to skin it')}sfx('loot');refreshBag();saveGame()}
const rarCol=it=>it.kind==='junk'?'#9d9d9d':RARITY[Math.max(0,it.r)].c;
function gainXp(n,src){if(P.level>=MAXLVL)return;n=Math.round(n*(RACES[P.race].xp||1));P.xp+=n;floatText(src||'me','+'+n+' XP','xp');
  while(P.level<MAXLVL&&P.xp>=xpNeed(P.level)){P.xp-=xpNeed(P.level);P.level++;calcStats();P.hp=ST.maxhp;P.mp=ST.maxmp;beamFx(ME.pos.x,ME.pos.z,0xffd34d,1.6,1.5);lvlFx(ME.pos.x,ME.pos.y,ME.pos.z);sfx('lvl');banner('Level '+P.level+'!','You have grown stronger');log('You have reached level '+P.level+'!','sys');
    const nw=ABIL[P.cls].find(a=>a.lvl===P.level);if(nw)log('New ability learned: '+nw.n,'sys');log('+1 talent point'+(isTouch?'':' (N)'),'sys');netEmit('fx',{k:'lvl',x:ME.pos.x,z:ME.pos.z});buildBar(true);refreshNpcMarks()}
  if(P.level>=MAXLVL)P.xp=0;saveGame()}
function takeHit(dmg,src){if(ME.dead||S.mode!=='play'||S.god)return;ME.hurtT=.35;if(src&&src.x!=null){const dx=ME.pos.x-src.x,dz=ME.pos.z-src.z,L=Math.hypot(dx,dz)||1;ME.kb={x:dx/L*2.2,z:dz/L*2.2}}if(src&&src.kind==='pl'){ME.lastPvp={by:src.id,t:performance.now()};if(!ME.target)setTarget(src)}if(Math.random()<TM('dodge')){floatText('me',P.cls==='krijger'?'Blocked':'Dodged','miss');sparks(ME.pos.x,ME.pos.y+1.1,ME.pos.z,0xe8f0ff,5,3,.3,.3);return}const lvl=src&&src.lvl||P.level;const red=ST.arm/(ST.arm+40+lvl*12);dmg=Math.max(1,Math.round(dmg*(1-red)*(1-Math.min(.75,TM('dr')+tbuff('dr')))*rand(.9,1.1)));P.hp-=dmg;ME.combat=6;floatText('me','-'+dmg,'hurt');sparks(ME.pos.x,ME.pos.y+1.1,ME.pos.z,0xff8070,7,4,.32,.35);emitP({x:ME.pos.x,y:ME.pos.y+1.1,z:ME.pos.z,life:.16,size:1.6,size1:2,col:0xff6a50,a:.8,a1:0,cell:FXC.arc,must:1});sfx('hurt');
  if(!ME.target&&src&&src.kind==='mon'){setTarget(src)}if(ME.target===src)ME.auto=true;
  if(P.hp<=0){P.hp=0;die()}}
function die(){if(ME.mounted)dismount();if(ME.lastPvp&&performance.now()-ME.lastPvp.t<12000){netEmit('pkill',{by:ME.lastPvp.by,n:P.name});const r=REMOTES.get(ME.lastPvp.by);log('You were defeated by '+esc(r?r.n:'another player')+'.','err',true);P.pvpDeaths=(P.pvpDeaths||0)+1}ME.lastPvp=null;ME.dead=true;ME.cast=null;$('#castbar').hidden=true;ME.auto=false;$('#death').hidden=false;log('You have died.','err');saveGame()}
function resurrect(){if(!ME.dead)return;ME.dead=false;ME.stun=ME.root=0;$('#death').hidden=true;calcStats();P.hp=Math.round(ST.maxhp*.6);P.mp=Math.round(ST.maxmp*.6);if(elvRespawn()){}else if(drakeRespawn()){}else if(ME.pos.x>1250)teleport(D2.entry.x,D2.entry.z);else if(ME.pos.x>700)teleport(DUN_ENTRY.x,DUN_ENTRY.z);else if(Math.hypot(ME.pos.x-CAVE.x,ME.pos.z-CAVE.z)<120)teleport(CAVE.x-6,CAVE.z+16);else teleport(rand(-3,3),rand(5,9));beamFx(ME.pos.x,ME.pos.z,0xfff0b0,1.2);setTarget(null)}

/* ---------- monster AI (runs on the lobby host, or locally when offline) ---------- */
function players(){const L=[];if(P&&S.mode==='play')L.push({id:myId(),x:ME.pos.x,z:ME.pos.z,dead:ME.dead,lvl:P.level,me:1});for(const r of REMOTES.values())if(r.inW)L.push({id:r.id,x:r.x,z:r.z,dead:r.dead,lvl:r.lvl});return L}
function hitPlayer(pid,dmg,m){if(pid===myId())takeHit(dmg,m);else netEmit('mhit',{to:pid,d:Math.round(dmg),m:m.id})}
function respawnMon(m){m.dead=false;m.skinned=false;m.hp=m.mhp=monHp(m.t,m.lvl);m.x=m.nx=m.sx;m.z=m.nz=m.sz;m.loot=null;if(m.spark){scene.remove(m.spark);m.spark=null}m.evade=false;m.tgt=null;m.threat={};m.root=m.stun=m.slow=0;m.rig.g.children[0].rotation.set(0,0,0);m.rig.body.position.y=0}
function bossEngage(m){if(m.t.dragon)dragonReset(m);const n=Math.max(1,players().filter(p=>!p.dead&&Math.hypot(p.x-m.x,p.z-m.z)<120).length);m.mhp=Math.round(monHp(m.t,m.lvl)*(1+.6*(n-1)));m.hp=m.mhp;m.bt={stomp:9,bolt:5,sum:0,enr:0};const L=bossLines(m);netEmit('bossmsg',{t:L.hi,b:m.type});bossSay(L.hi,m.type)}
function bossLines(m){if(m.type==='vyraxion')return VYR_LINES;return m.type==='ignaroth'?{hi:'Flesh melts, bones burn. Welcome to my fire!',tele:'The ground boils beneath your feet!',sum:'Sparks, devour them!',enr:'I AM THE MOUNTAIN! I AM THE FIRE!',add:'vonk',bolt:'fire'}:{hi:'Who dares disturb my rest? Your bones will be mine!',tele:'Kneel before the Bone King!',sum:'Rise, my servants!',enr:'Enough! Feel my true wrath!',add:'dienaar',bolt:'shadow'}}
function bossSay(t,type){const nm=type==='ignaroth'?'Ignaroth':type==='vyraxion'?'Vyraxion':'Kaal-Morath';log('<b style="color:'+(type==='ignaroth'?'#ffa060':type==='vyraxion'?'#ff6a30':'#d9a8ff')+'">'+nm+' shouts:</b> '+esc(t),'say',true);banner(t.length>40?nm:t,t.length>40?t:'',3)}
let addN=0;const PENDING=[];
function aiUpdate(m,dt,pl){
  if(m.dead){m.deadT-=dt;if(m.deadT<=0){if(m.add)removeMon(m);else respawnMon(m)}return}
  m.atk=m.atk>=0?m.atk+dt*2.2:-1;if(m.atk>1)m.atk=-1;
  if(m.stun>0){m.stun-=dt;m.mv=0;return}
  if(m.slow>0)m.slow-=dt;let spd=m.t.spd*(m.slow>0?.45:1);if(m.root>0){m.root-=dt;spd=0}
  const t=m.t,inD=m.sx>700;
  if(m.evade){const d=Math.hypot(m.sx-m.x,m.sz-m.z);if(d<1.2){m.evade=false;m.hp=m.mhp;m.mv=0}else{moveMon(m,m.sx,m.sz,t.spd*1.6,dt);m.mv=2}return}
  if(m.tgt){if(t.dragon&&dragonAI(m,dt,pl))return;let tp=pl.find(p=>p.id===m.tgt);const leash=t.boss?60:46;
    if(!tp||tp.dead||Math.hypot(tp.x-m.sx,tp.z-m.sz)>leash||(tp.x>700)!==inD){delete m.threat[m.tgt];let best=null,bv=0;for(const p of pl){const v=m.threat[p.id];if(v&&!p.dead&&(p.x>700)===inD&&Math.hypot(p.x-m.sx,p.z-m.sz)<leash&&v>bv){bv=v;best=p}}
      if(best){m.tgt=best.id;tp=best}else{m.tgt=null;m.threat={};m.taps.clear();m.evade=true;if(t.boss)bossReset(m);return}}
    else{let best=tp,bv=(m.threat[tp.id]||0)*1.1;for(const p of pl){const v=m.threat[p.id];if(v&&v>bv&&!p.dead&&(p.x>700)===inD){bv=v;best=p}}if(best!==tp){m.tgt=best.id;tp=best}}
    const d=Math.hypot(tp.x-m.x,tp.z-m.z),reach=t.ranged||1.3+m.size*.9;
    if(d>reach*.9){moveMon(m,tp.x,tp.z,spd,dt);m.mv=spd>0?2:0}else{m.mv=0;m.nry=m.ry=Math.atan2(tp.x-m.x,tp.z-m.z)}
    m.atkT-=dt;
    if(d<=reach&&m.atkT<=0){m.atkT=t.boss?2.2:2;m.ac=(m.ac+1)%100;m.atk=0;const dmg=monDmg(t,m.lvl)*(t.dmgM||1)*rand(.85,1.15)*(m.bt.enr?1.35:1);
      if(t.ranged){const from=new THREE.Vector3(m.x,m.y+1.8,m.z);const tgtE=tp.me?'me':REMOTES.get(tp.id);if(tgtE){const pt=t.proj||'shadow';proj(pt,from,tgtE,20,()=>hitPlayer(tp.id,dmg,m));netEmit('fx',{k:'p',t:pt,f:from.toArray(),p:tp.id})}}
      else{const id=tp.id;setTimeout(()=>{if(!m.dead)hitPlayer(id,dmg,m)},250)}}
    if(t.boss&&!t.dragon)bossAbilities(m,dt,pl)}
  else{
    if(t.aggro){for(const p of pl){if(p.dead||(p.x>700)!==inD)continue;const r=clamp(t.aggro+(m.lvl-p.lvl)*1.4,4,22);if(d2(p.x,p.z,m.x,m.z)<r*r){m.tgt=p.id;m.threat[p.id]=1;if(t.boss)bossEngage(m);break}}}
    if(!m.tgt){m.wan.t-=dt;if(m.wan.t<=0){m.wan.t=rand(4,10);const a=rand(0,6.28),r=rand(0,t.boss?0:7);m.wan.x=m.sx+Math.cos(a)*r;m.wan.z=m.sz+Math.sin(a)*r}
      if(Math.hypot(m.wan.x-m.x,m.wan.z-m.z)>.6){moveMon(m,m.wan.x,m.wan.z,t.spd*.32,dt);m.mv=.5}else m.mv=0}}}
function moveMon(m,tx,tz,spd,dt){const dx=tx-m.x,dz=tz-m.z,L=Math.hypot(dx,dz);if(L<.01||spd<=0){m.cs=lerp(m.cs||0,0,clamp(dt*8,0,1));return}m.cs=lerp(m.cs||0,spd,clamp(dt*5,0,1));const st=Math.min(L,m.cs*dt);m.x+=dx/L*st;m.z+=dz/L*st;if(m.sx>700){const p={x:m.x,z:m.z};dunOf(m.sx).collide(p,.5*m.size);m.x=p.x;m.z=p.z}m.ry=Math.atan2(dx,dz);m.nx=m.x;m.nz=m.z;m.nry=m.ry}
function dunOf(x){return x>1700?D3:x>1250?D2:x>700?{collide:dunCollide}:null}
function bossReset(m){if(m.t.dragon)dragonReset(m);for(const a of MONS.filter(x=>x.add&&Math.abs(x.x-m.x)<90))removeMon(a);m.bt={stomp:9,bolt:5,sum:0,enr:0};m.mhp=monHp(m.t,m.lvl)}
function bossAbilities(m,dt,pl){const B=m.bt;const L=bossLines(m);const alive=pl.filter(p=>!p.dead&&p.x>700&&Math.hypot(p.x-m.x,p.z-m.z)<40);if(!alive.length)return;
  B.stomp-=dt;B.bolt-=dt;
  if(B.stomp<=0){B.stomp=rand(11,14);const spots=m.type==='ignaroth'?[[m.x,m.z,6],...alive.map(p=>[p.x,p.z,4.5])]:[[m.x,m.z,7.5]];netEmit('bossmsg',{t:L.tele,b:m.type});bossSay(L.tele,m.type);for(const[x,z,r]of spots){teleFx(x,z,r,2);netEmit('fx',{k:'tele',x,z,r,d:2});PENDING.push({t:2,fn:()=>{for(const p of players())if(!p.dead&&Math.hypot(p.x-x,p.z-z)<r)hitPlayer(p.id,monDmg(m.t,m.lvl)*(m.type==='ignaroth'?1.8:2.4),m)}})}}
  if(B.bolt<=0){B.bolt=rand(7,9);const p=pick(alive);const from=new THREE.Vector3(m.x,m.y+4,m.z);const tgtE=p.me?'me':REMOTES.get(p.id);if(tgtE){proj(L.bolt,from,tgtE,18,()=>hitPlayer(p.id,monDmg(m.t,m.lvl)*1.5,m));netEmit('fx',{k:'p',t:L.bolt,f:from.toArray(),p:p.id})}}
  const f=m.hp/m.mhp;if((f<.66&&B.sum<1)||(f<.33&&B.sum<2)){B.sum++;netEmit('bossmsg',{t:L.sum,b:m.type});bossSay(L.sum,m.type);for(let i=0;i<2+B.sum-1;i++){const a=rand(0,6.28);const id='a'+(addN++)+'_'+Math.floor(Math.random()*1e4);const x=m.x+Math.cos(a)*7,z=m.z+Math.sin(a)*7;const ad=makeMon({id,type:L.add,lvl:MON[L.add].lv[0],x,z});const tp=pick(alive);ad.tgt=tp.id;ad.threat[tp.id]=5;burst(x,1,z,m.type==='ignaroth'?0xff7a30:0x7aff5a,30,4)}}
  if(f<.2&&!B.enr){B.enr=1;netEmit('bossmsg',{t:L.enr,b:m.type});bossSay(L.enr,m.type)}}

function setPvp(on){if(!P)return;if(on===!!P.pvp)return;if(ME.combat>0&&!on)return toast('You can\'t do that in combat');P.pvp=on;log(on?'⚔ PvP is on. Outside Silverbrook you can attack other players with PvP on, and they can attack you.':'PvP is off. Other players can no longer attack you.',on?'err':'sys');refreshPvpUi();saveGame(true);lastPres=''}
function refreshPvpUi(){const b=$('#bPvp');if(b)b.textContent='PvP: '+(P&&P.pvp?'on':'off');const t=$('#pPvp');if(t)t.hidden=!(P&&P.pvp);updTargetFrame(true)}
