/* ===================== Mounts =====================
   Riding animals from Quaternius' Ultimate Animated Animals (CC0, via Poly Pizza): horse, white horse, donkey, alpaca,
   deer and stag, plus the wolf and bull that already roam Velmora. Every hero starts with a brown horse; the
   Stablemaster in Silverbrook sells more, and a few rare ones drop from bosses. Riding is 60% faster than running.
   The rider sits on the animal's back bone (so it rises and falls with the gallop) using KayKit's Sit_Chair_Idle. */
const MOUNT_SPD=1.6;
const MOUNTS={
  horse:     {n:'Brown Horse',  m:'mount/M_Horse_A',    h:2.15,src:'Given to every adventurer'},
  donkey:    {n:'Sturdy Donkey',m:'mount/M_Donkey',     h:1.85,price:40, src:'Stablemaster Hob, Silverbrook'},
  alpaca:    {n:'Fluffy Alpaca',m:'mount/M_Alpaca',     h:2.0, price:90, src:'Stablemaster Hob, Silverbrook'},
  whitehorse:{n:'White Horse',  m:'mount/M_Horse_White',h:2.15,price:160,src:'Stablemaster Hob, Silverbrook'},
  deer:      {n:'Swift Deer',   m:'mount/M_Deer',       h:2.0, price:280,src:'Stablemaster Hob, Silverbrook'},
  stag:      {n:'Great Stag',   m:'mount/M_Stag',       h:2.45,drop:'grisk',chance:.25,src:'Rare drop: Grisk, Bandit Camp'},
  shadow:    {n:'Shadow Steed', m:'mount/M_Horse_A',    h:2.25,tint:{Main:0x2c2833,Main_Dark:0x16131c,Main_Light:0x4a4258,Hair:0x9a2a2a,Muzzle:0x101014},drop:'boss',chance:.15,src:'Rare drop: Kaal-Morath, the crypt'},
  direwolf:  {n:'Dire Wolf',    m:'Wolf',               h:1.95,tint:{Main:0x3a3a40,Main_Light:0x75757e},drop:'ignaroth',chance:.15,src:"Rare drop: Ignaroth, the Fire Cave"},
  warbull:   {n:'War Bull',     m:'Bull',               h:2.05,tint:{Main:0x5a3a2a,Main_Light:0x8a6a4a,Horns:0xf0e6d0,Muzzle:0x3a2a20,Hooves:0x2a2018},drop:'lavadrake',chance:.05,sy:.3,src:'Rare drop: Lava Drakes, Dragon Realm'},
  emberdrake:{n:'Ember Drake',  m:'mount/drake',fly:1,h:3.8,dk:'ember',price:1500,lvl:15,src:'Stablemaster Hob (level 15)'},
  frostdrake:{n:'Frost Drake',  m:'mount/drake',fly:1,h:3.8,dk:'frost',drop:'vyraxion',chance:.2,src:'Rare drop: Vyraxion, the Ash Queen'},
  shadowdrake:{n:'Shadow Drake',m:'mount/drake',fly:1,h:3.8,dk:'shadow',drop:'lavadrake',chance:.04,src:'Rare drop: Lava Drakes, Dragon Realm'},
  netherdrake:{n:'Nether Drake',m:'mount/drake',fly:1,h:3.8,dk:'nether',price:4000,lvl:20,src:'Stablemaster Hob (level 20)'},
  riftwing:  {n:'Riftwing',     m:'mount/cragle',fly:1,cr:1,h:3.6,drop:'vorthax',chance:.12,src:'Rare drop: Vorthax the Riftlord, the Void Citadel'},
  emberstag: {n:'Ember Stag',   m:'mount/M_Stag',       h:2.5, tint:{Material:0x7a2a14,'Material.003':0xe0702e,'Material.010':0xffb040},glow:{'Material.010':0xff8a20},drop:'vyraxion',chance:.25,src:'Rare drop: Vyraxion, the Ash Queen'}};
const MOUNT_SEAT={dy:-.16,fwd:.26};
function ensureMounts(){if(!P)return;if(!Array.isArray(P.mounts))P.mounts=[];P.mounts=P.mounts.filter(id=>MOUNTS[id]);if(!P.mounts.includes('horse'))P.mounts.unshift('horse');if(!P.mounts.includes(P.mountSel))P.mountSel=P.mounts[0]}
function learnMount(id,how){ensureMounts();if(!MOUNTS[id]||P.mounts.includes(id))return false;P.mounts.push(id);P.mountSel=id;
  banner('New mount: '+MOUNTS[id].n,how||'Press R to ride',2.4);log('You obtained a new mount: '+MOUNTS[id].n+'!','loot',true);sfx('quest');saveGame();if(!$('#pChar').hidden)refreshChar();return true}
function mountDropFor(type){for(const id in MOUNTS){const d=MOUNTS[id];if(d.drop===type&&!(P.mounts||[]).includes(id)&&Math.random()<d.chance)return id}return null}
function canRideHere(){return ME.pos.x<700}
/* ===================== Flying =====================
   Drakes fly in the open world and the Dragon Realm: Space (or the jump button) climbs, X or Ctrl (or the down button)
   descends, and letting go hovers. Not in dungeons and not over Silverbrook. In the air you are 50% faster again and fly
   over walls, trees and the lake; land by descending to the ground. */
const FLY_SPD=1.5,FLY_MAX=55;
function flyMount(){return !!(ME.mounted&&MOUNTS[ME.mounted]&&MOUNTS[ME.mounted].fly)}
function overTown(x,z){return x<700&&x>-1000&&Math.hypot(x,z)<TOWN.wall+6||inElv(x)&&Math.hypot(x-WS.x,z-WS.z)<WS.R+8}
function canFlyHere(x,z){return x<700&&!overTown(x,z)}
let _flyWarn=0;
/* called from the physics step instead of gravity while you sit on a flying mount; returns true when it handled the vertical */
function flyStep(h,gh){if(!flyMount())return false;const up=KEYS.has(' ')||S.upHeld,dn=KEYS.has('x')||KEYS.has('control')||S.dnHeld;
  const okHere=canFlyHere(ME.pos.x,ME.pos.z);
  if(!ME.air){if(up&&okHere&&!ME.dead){ME.air=true;ME.vy=6;ME.pos.y=gh+.05;dustFx(ME.pos.x,ME.pos.z,10);sfx('swing')}else{if(up&&!okHere&&performance.now()>_flyWarn){_flyWarn=performance.now()+3000;toast(overTown(ME.pos.x,ME.pos.z)?'You cannot fly over '+(inElv(ME.pos.x)?'WindStorm':'Silverbrook'):'You cannot fly here')}ME.pos.y=gh;return true}}
  let tv=up?9:dn?-11:0;if(!okHere){tv=-12;if(performance.now()>_flyWarn){_flyWarn=performance.now()+3000;toast('You cannot fly over '+(inElv(ME.pos.x)?'WindStorm':'Silverbrook'))}}
  ME.vy+=(tv-ME.vy)*Math.min(1,h*4);ME.pos.y+=ME.vy*h;
  const top=inRift(ME.pos.x)?150:Math.min(gh+FLY_MAX,inElv(ME.pos.x)?110:ME.pos.x<-1000?95:85);if(ME.pos.y>top){ME.pos.y=top;ME.vy=Math.min(ME.vy,0)}
  if(ME.pos.y<=gh){ME.pos.y=gh;if(ME.vy<-6)landFx();ME.vy=0;ME.air=false}return true}
function flyingHigh(){return flyMount()&&ME.air&&ME.pos.y>groundH(ME.pos.x,ME.pos.z)+5}
/* in the air only the edge of the world stops you */
function collideAir(p){if(p.x<-5000){p.x=clamp(p.x,RIFT.x-RSZ/2+10,RIFT.x+RSZ/2-10);p.z=clamp(p.z,RIFT.z-RSZ/2+10,RIFT.z+RSZ/2-10);return}if(p.x<-2600){p.x=clamp(p.x,ELV.x-438,ELV.x+430);p.z=clamp(p.z,ELV.z-432,ELV.z+432);return}if(p.x<-1000){drkCollide(p,.5);return}p.x=clamp(p.x,-255,255);p.z=clamp(p.z,-262,255)}
function toggleMount(){if(!P||S.mode!=='play'||ME.dead)return;if(ME.mounted){dismount();return}ensureMounts();
  if(!canRideHere())return toast("You can't ride here");if(ME.combat>0)return toast("You can't mount while in combat");if(ME.cast||ACT.cur)return toast('You are still busy');
  ME.cast={a:{n:MOUNTS[P.mountSel].n,id:'mount',mount:true},t:0,dur:1.3,tg:null};$('#castbar').hidden=false}
function doMount(){if(ME.dead||!canRideHere())return;ME.mounted=P.mountSel;sfx('loot');dustFx(ME.pos.x,ME.pos.z,8);updMountBtn()}
function dismount(){if(!ME.mounted)return;if(flyMount()&&ME.air&&ME.vy>0)ME.vy=0;ME.mounted=null;dustFx(ME.pos.x,ME.pos.z,6);updMountBtn()}
function updMountBtn(){document.body.classList.toggle('flymount',flyMount());const b=$('#mountBtn');if(b)b.classList.toggle('on',!!ME.mounted);for(const t of document.querySelectorAll('.tb[data-role=mnt]'))t.classList.toggle('on',!!ME.mounted)}
/* mount rig for an entity (yourself or another player); places the rider on the animal's back and returns true while riding */
const _seat=new THREE.Vector3();
function riderFrame(ent,rig,id,x,y,z,ry,spd,air,dt){let M=ent._mnt;
  if(!id||!MOUNTS[id]){if(M){dropRider(ent)}riderTilt(rig,0,0);return false}
  if(!M||M.id!==id){if(M)dropRider(ent);const d=MOUNTS[id];
    if(d.dk){const D=dkBuild(id);scene.add(D.g);M=ent._mnt={id,dk:D,rig:D}}else if(d.cr){const D=crBuild(id);scene.add(D.g);M=ent._mnt={id,cr:D,rig:D}}else{const r=buildGltfRig({model:d.m,h:d.h,cm:d.cm==='drake'?CM_DRAGON:CM_ANIMAL,quad:1,o:{cls:'mon'},tint:d.tint,glow:d.glow});r.g.userData.dyn=1;scene.add(r.g);M=ent._mnt={id,rig:r,bone:null}}}
  if(M.dk||M.cr){const D=M.dk||M.cr,s=M.dk?dkFrame(D,x,y,z,ry,spd,air,dt):crFrame(D,x,y,z,ry,spd,air,dt);
    if(s){D.piv.getWorldQuaternion(_dkQ);_seatUp.set(0,1,0).applyQuaternion(_dkQ);_seatFw.set(0,0,1).applyQuaternion(_dkQ);rig.g.position.copy(s).addScaledVector(_seatUp,DK_SEAT.up).addScaledVector(_seatFw,DK_SEAT.fw)}else rig.g.position.set(x,y+2.6,z);
    riderTilt(rig,D.pitch,D.roll);return true}
  riderTilt(rig,0,0);
  const g=M.rig.g;g.position.set(x,y,z);g.rotation.y=ry;animRig(M.rig,{spd,air,atk:-1,dead:false},dt);
  const m=M.rig.m;if(m&&!M.bone){M.bone=m.getObjectByName('Torso2')||m.getObjectByName('Torso')||m.getObjectByName('Body');m.updateMatrixWorld(true)}
  if(M.bone){M.bone.getWorldPosition(_seat)}else _seat.set(x,y+MOUNTS[id].h*.55,z);
  const fw=MOUNTS[id].fwd??MOUNT_SEAT.fwd;rig.g.position.set(_seat.x+Math.sin(ry)*fw,_seat.y+MOUNT_SEAT.dy+(MOUNTS[id].sy||0),_seat.z+Math.cos(ry)*fw);rig.g.rotation.y=ry;return true}
const _seatUp=new THREE.Vector3(),_seatFw=new THREE.Vector3();const DK_SEAT={up:.05,fw:0};
/* the rider leans with a flying drake */
function riderTilt(rig,px,rz){const r=rig.g.rotation;if(r.order!=='YXZ')r.order='YXZ';r.x=px;r.z=rz}
function dropRider(ent){const M=ent._mnt;if(M){if(M.dk)dkDrop(M.dk);else if(M.cr)crDrop(M.cr);else scene.remove(M.rig.g);ent._mnt=null}}
/* the stablemaster's animals idling in front of the stable */
function stablePets(dt){if(window.__NOGLTF||Math.hypot(camTarget.x-STABLE.x,camTarget.z-STABLE.z)>90)return;
  for(const p of STABLE_PETS){if(!p.rig){const d=MOUNTS[p.id],x=STABLE.x+p.dx,z=STABLE.z+p.dz;p.rig=buildGltfRig({model:d.m,h:d.h,cm:CM_ANIMAL,quad:1,o:{cls:'mon'},tint:d.tint,glow:d.glow});p.rig.g.position.set(x,groundH(x,z),z);p.rig.g.rotation.y=p.ry;scene.add(p.rig.g)}
    animRig(p.rig,{spd:0,air:0,atk:-1,dead:false},dt)}}
/* horse-head icon for the ride button (drawn here, generic) */
const MOUNT_SVG='<svg viewBox="0 0 64 64" width="60%" height="60%" aria-hidden="true"><path d="M18 56c2-9 5-15 9-19-6 1-11-1-14-5l9-13c3-4 8-7 13-7l3-6 3 7c7 3 11 10 11 18 0 9-3 17-6 25H18z" fill="#fff3d6" stroke="#3a2412" stroke-width="3" stroke-linejoin="round"/><circle cx="36" cy="22" r="2.6" fill="#3a2412"/><path d="M40 12c5 5 9 12 9 20" stroke="#3a2412" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
/* ===================== Sheathing =====================
   Z puts the weapons on the back (and they always go there while riding). Each hand slot gets a "virtual hand slot"
   on the chest bone; the weapon objects are moved there unchanged, so every weapon model fits without its own setup.
   Positions are in the chest bone's space (y up the spine, +z forward); per weapon type where the shapes differ. */
/* where things go, in the chest bone's space (x = the hero's left, y up, z forward): D = direction from grip to tip,
   C = where the middle of the item sits. The item's own longest axis is laid along D and its thinnest axis against the
   back, so any downloaded weapon model fits without a setup of its own. */
const SHEATH={main:{D:[.5,-.87,0],C:[0,.3,-.56]},staff:{D:[-.45,.89,0],C:[0,.3,-.52]},bow:{D:[-.5,-.87,0],C:[0,.32,-.52]},
  long:{D:[-.3,.95,0],C:[.14,.26,-.5]},flat:{D:[0,1,0],C:[0,.12,-.48]},shieldGap:.08};
const _shM=new THREE.Matrix4(),_shB=new THREE.Box3();
function shBox(w){if(w.userData.shBox)return w.userData.shBox;w.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(w.matrixWorld).invert();const b=new THREE.Box3();
  w.traverse(o=>{if(o.isMesh&&o.geometry){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();_shB.copy(o.geometry.boundingBox).applyMatrix4(_shM.multiplyMatrices(inv,o.matrixWorld));b.union(_shB)}});
  if(b.isEmpty())return null;return w.userData.shBox={sz:b.getSize(new THREE.Vector3()).toArray(),c:b.getCenter(new THREE.Vector3()).toArray()}}
function shPlace(w,B,cfg,dz){const sz=B.sz,c=B.c;const ix=[0,1,2].sort((a,b)=>sz[b]-sz[a]);const L=ix[0],M=ix[1],T=ix[2];
  const d=new THREE.Vector3(...cfg.D).normalize(),n=new THREE.Vector3(0,0,-1);const col=[];col[L]=d.clone().multiplyScalar(c[L]<0?-1:1);col[T]=n.clone().multiplyScalar(c[T]<0?-1:1);col[M]=new THREE.Vector3().crossVectors(d,n);
  _shM.makeBasis(col[0],col[1],col[2]);if(_shM.determinant()<0){col[M].negate();_shM.makeBasis(col[0],col[1],col[2])}
  w.quaternion.setFromRotationMatrix(_shM);const off=new THREE.Vector3(...c).multiply(w.scale).applyQuaternion(w.quaternion);w.position.set(cfg.C[0]-off.x,cfg.C[1]-off.y,cfg.C[2]+dz-off.z)}
function syncSheath(r,want){const m=r.m;if(!m)return;
  if(want){const items=[];for(const sn of['handslotr','handslotl']){const s=m.getObjectByName(sn);if(s)for(const w of s.children)if(w.visible&&w!==r.tool)items.push([w,s])}
    if(items.length){if(!r.shH){const ch=m.getObjectByName('chest');if(!ch)return;r.shH=new THREE.Object3D();ch.add(r.shH)}
      const wt=(r.o&&r.o.wt)||r.wt,mainSlot=r.weapon&&r.weapon.parent&&/handslot/.test(r.weapon.parent.name)?r.weapon.parent.name:wt==='boog'?'handslotl':'handslotr';const done=[];
      for(const[w,s]of items){const B=shBox(w);if(!B)continue;w.userData.shSave={from:s,p:w.position.clone(),q:w.quaternion.clone()};
        const main=s.name===mainSlot,ln=B.sz.slice().sort((a,b)=>b-a);const role=main?(wt==='boog'?'bow':wt==='staf'?'staff':'main'):(ln[0]>ln[1]*1.8?'long':'flat');done.push([w,B,role])}
      const shield=done.some(x=>x[2]==='flat');for(const[w,B,role]of done){shPlace(w,B,SHEATH[role],role==='main'&&shield?-SHEATH.shieldGap:0);r.shH.add(w)}}}
  else if(r.sheathed&&r.shH){for(const w of[...r.shH.children]){const v=w.userData.shSave;if(v){w.position.copy(v.p);w.quaternion.copy(v.q);v.from.add(w)}else r.shH.remove(w)}}
  r.sheathed=want}
function toggleSheath(){if(!P||S.mode!=='play'||ME.dead)return;ME.sheathed=!ME.sheathed;sfx('swing');updSheathBtn();
  if(ME.mounted&&!ME.sheathed)toast('Your weapons stay on your back while riding')}
/* drawing happens by itself as soon as you fight or cast */
function autoDraw(){if(ME.sheathed&&((ME.auto&&isEnemy(ME.target))||ME.atk>=0||(ME.cast&&!ME.cast.a.mount))){ME.sheathed=false;updSheathBtn()}}
function updSheathBtn(){const on=!!ME.sheathed;const b=$('#sheathBtn');if(b)b.classList.toggle('on',on);for(const t of document.querySelectorAll('.tb[data-role=shth]'))t.classList.toggle('on',on)}
const SHEATH_SVG='<svg viewBox="0 0 64 64" width="60%" height="60%" aria-hidden="true"><path d="M44 8l12 12-26 26-8-4-4-8z" fill="#fff3d6" stroke="#3a2412" stroke-width="3" stroke-linejoin="round"/><path d="M14 36l14 14M10 46l8 8M18 42l-8 4 4 4" stroke="#3a2412" stroke-width="4" stroke-linecap="round" fill="none"/></svg>';
