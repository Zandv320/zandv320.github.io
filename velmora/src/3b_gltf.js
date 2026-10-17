/* ===================== glTF modellen (skelet + animatieclips) =====================
   Spelers/NPC's/menselijke vijanden: KayKit Adventurers & Skeletons (CC0, Kay Lousberg).
   Dieren: Quaternius Animated Animals / Easy Enemies (CC0).
   De rig die hieruit komt is compatibel met animRig(): r.gltf=true → animGltf(). */
const GLTF_MODELS={krijger:'Knight',magier:'Mage',jager:'Rogue'};
const MODEL_BASE=new URL('models/',location.href).href;
const gltfCache=new Map();let _gl=null;function gltfLoader(){if(!_gl){_gl=new GLTFLoader();_gl.setMeshoptDecoder(MeshoptDecoder)}return _gl}
function loadGltf(name){
  let e=gltfCache.get(name);if(e)return e.p;e={p:null,data:null};
  e.p=new Promise(res=>{gltfLoader().load(MODEL_BASE+name+'.glb',g=>{prepGltf(g);e.data=g;res(g)},undefined,err=>{console.warn('model laden mislukt',name,err);res(null)})});
  gltfCache.set(name,e);return e.p}
function prepGltf(g){/* toon-materialen + hoogte van het lichaam (zonder props) */
  const props=[];const matMap=new Map();
  g.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.frustumCulled=false;
    const sm=o.material;let tm=matMap.get(sm);
    if(!tm){const em=sm.emissive&&(sm.emissive.r+sm.emissive.g+sm.emissive.b)>.5&&!sm.map;
      if(em)tm=new THREE.MeshBasicMaterial({color:sm.emissive.clone().multiplyScalar(1.6)});
      else{tm=new THREE.MeshToonMaterial({map:sm.map||null,gradientMap:RAMP,color:sm.map?0xffffff:sm.color.clone(),vertexColors:!!sm.vertexColors});if(sm.map){sm.map.colorSpace=THREE.SRGBColorSpace;sm.map.minFilter=THREE.LinearMipmapLinearFilter;sm.map.anisotropy=4}}
      tm.name=sm.name;matMap.set(sm,tm)}o.material=tm;
    if(!o.isSkinnedMesh){props.push(o.name);o.visible=false}});
  g.scene.updateMatrixWorld(true);const box=new THREE.Box3();g.scene.traverse(o=>{if(o.isSkinnedMesh)box.expandByObject(o)});
  g.userData.h=Math.max(.3,box.max.y-box.min.y);g.userData.y0=box.min.y;g.userData.props=props;
  g.clips={};for(const c of g.animations)g.clips[c.name.replace(/^.*\|/,'')]=c}
function preloadModels(){return Promise.all(Object.values(GLTF_MODELS).map(loadGltf))}
/* ---- (uit) huid- en haarkleur: de KayKit-atlas heeft een huidvak (0,0) en een haarvak (1,0) van 128px ---- */
const tintCache=new Map();
function tintedMap(src,skin,hair){
  const key=src.uuid+'|'+skin+'|'+hair;let t=tintCache.get(key);if(t)return t;
  const img=src.image;const W=img.width||1024,H=img.height||1024;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
  const cell=W/8;const paint=(ix,col)=>{if(col==null)return;const c=new THREE.Color(col);const d=cx.getImageData(ix*cell,0,cell,cell);const p=d.data;let sum=0;for(let i=0;i<p.length;i+=4)sum+=p[i]*.3+p[i+1]*.59+p[i+2]*.11;const avg=sum/(p.length/4)||1;
    for(let i=0;i<p.length;i+=4){const l=(p[i]*.3+p[i+1]*.59+p[i+2]*.11)/avg;p[i]=Math.min(255,c.r*255*l);p[i+1]=Math.min(255,c.g*255*l);p[i+2]=Math.min(255,c.b*255*l)}cx.putImageData(d,ix*cell,0)};
  paint(0,skin);paint(1,hair);
  t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=src.flipY;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;tintCache.set(key,t);return t}
/* welke losse onderdelen van het spelersmodel zichtbaar zijn, per klasse en uitrusting */
function gltfProps(o){const on=[];
  if(o.cls==='krijger'){if(o.eqHead)on.push('Knight_Helmet');on.push('Knight_Cape');on.push(['Round_Shield','Badge_Shield','Rectangle_Shield','Spike_Shield'][clamp(o.rar|0,0,3)])}
  if(o.cls==='magier'){if(o.eqHead)on.push('Mage_Hat');if(o.rar>=2)on.push('Mage_Cape');if(o.eqChest)on.push('Spellbook')}
  if(o.cls==='jager'){if(o.rar>=1)on.push('Rogue_Cape');if(o.eqChest)on.push('Knife_Offhand')}
  return on}
const WM={krijger:{zwaard:'1H_Sword',bijl:'2H_Sword'},magier:{staf:'2H_Staff',zwaard:'1H_Wand'},jager:{boog:'2H_Crossbow',zwaard:'Knife'}};
/* KayKit mensachtigen: standaard clipkaart */
const ATK_1H=['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Stab','1H_Melee_Attack_Chop'],ATK_2H=['2H_Melee_Attack_Chop','2H_Melee_Attack_Slice','2H_Melee_Attack_Spin'];
const CM_KAY={idle:'Idle',cidle:'Blocking',walk:'Walking_A',run:'Running_A',jumpS:'Jump_Start',jumpI:'Jump_Idle',land:'Jump_Land',cast:'Spellcasting',die:'Death_A',hit:'Hit_A',
  atk:{krijger:['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop'],bijl:ATK_2H,magier:['Spellcast_Shoot'],jager:['2H_Ranged_Shoot'],staf:['Spellcast_Shoot'],boog:['2H_Ranged_Shoot'],def:ATK_1H}};
/* generieke bouwer: model, hoogte, zichtbare props, eigen wapen, kleur-tints, clipkaart */
function buildGltfRig(spec){
  const g=new THREE.Group();const r={g,gltf:true,h:spec.h,ph:Math.random()*6,wt:spec.wt,o:spec.o||{},cm:spec.cm||CM_KAY,st:{land:0,idle:0},cur:null,acts:{},ready:false,quad:spec.quad,spider:spec.spider};
  r.body=g;
  loadGltf(spec.model).then(src=>{
    if(!src){if(spec.fallback){r.fallback=spec.fallback();g.add(r.fallback.g)}return}
    const m=SkeletonUtils.clone(src.scene);const s=spec.h/src.userData.h;m.scale.setScalar(s);m.position.y=-src.userData.y0*s;g.add(m);r.m=m;r.s=s;
    const on=spec.props||[];m.traverse(x=>{if(x.isMesh&&!x.isSkinnedMesh)x.visible=on.includes(x.name)});
    /* materialen per exemplaar klonen waar nodig (tint / huid+haar) */
    if(spec.skin!=null||spec.hair!=null||spec.tint){const done=new Map();m.traverse(x=>{if(!x.isMesh)return;const sm=x.material;let nm=done.get(sm);
      if(!nm){nm=sm;if(spec.tint&&spec.tint[sm.name]!=null&&sm.color){nm=sm.clone();nm.color.set(spec.tint[sm.name])}
        else if((spec.skin!=null||spec.hair!=null)&&sm.map&&x.isSkinnedMesh){nm=sm.clone();nm.map=tintedMap(sm.map,spec.skin,spec.hair)}done.set(sm,nm)}x.material=nm})}
    /* wapen: mesh uit het model (KayKit) of het eigen spelwapen in de handslot */
    const slotR=m.getObjectByName('handslotr'),slotL=m.getObjectByName('handslotl');
    if(spec.weaponMesh){const w=m.getObjectByName(spec.weaponMesh);if(w){w.visible=true;const rc=RCOL[spec.wr|0];if(rc){w.material=w.material.clone();w.material.emissive=new THREE.Color(rc);w.material.emissiveIntensity=.12+(spec.wr|0)*.08}r.weapon=w}}
    else if(spec.wt&&spec.wt!=='none'&&slotR){const w=weaponMesh(spec.wt,spec.wr||0);w.rotation.set(0,0,0);w.scale.setScalar(1/s);(spec.wt==='boog'&&slotL?slotL:slotR).add(w);r.weapon=w}
    if(spec.eye){m.traverse(x=>{if(x.isMesh&&x.material.isMeshBasicMaterial){x.material=x.material.clone();x.material.color.set(spec.eye)}})}
    r.mixer=new THREE.AnimationMixer(m);r.clips=src.clips;r.ready=true;
    r.g.traverse(x=>{if(x.isMesh)x.castShadow=true});if(spec.onReady)spec.onReady(r)});
  return r}
/* spelers */
function buildGltfChar(o){
  const R=RACES[o.race]||RACES.mens;const s0=o.scale||1;const wn=(WM[o.cls]||{})[o.wt]||Object.values(WM[o.cls]||{})[0];
  return buildGltfRig({model:GLTF_MODELS[o.cls],h:1.78*R.h*s0,props:gltfProps(o),weaponMesh:wn,wt:o.wt,wr:o.wr,o,fallback:()=>buildHumanoidProc(o)})}
/* NPC's en wachters */
const NPC_GLTF={aldren:{m:'Knight',props:['Knight_Helmet','Knight_Cape','Badge_Shield'],w:'1H_Sword'},mirla:{m:'Mage',props:['Mage_Hat','Mage_Cape'],w:'2H_Staff'},wilma:{m:'Rogue',props:[]},anselm:{m:'Mage',props:['Mage_Cape'],w:'Spellbook_open'},
  bram:{m:'Barbarian',props:['Barbarian_Hat'],w:'Mug'},dorrik:{m:'Barbarian',props:['Barbarian_Hat'],w:'1H_Axe'},thorne:{m:'Knight',props:['Knight_Helmet','Round_Shield'],w:'1H_Sword'},guard:{m:'Knight',props:['Knight_Helmet','Rectangle_Shield'],w:'1H_Sword'}};
function buildGltfNpc(id,look){const d=NPC_GLTF[id]||NPC_GLTF.guard;const h=look.dwarf?1.5:1.78;
  return buildGltfRig({model:d.m,h,props:d.props,weaponMesh:d.w,wt:look.wt,o:{cls:'npc'},fallback:()=>buildHumanoidProc({race:look.dwarf?'dwerg':'mens',...look})})}
/* monsters */
const CM_ANIMAL={idle:'Idle',cidle:'Idle',walk:'Walk',run:'Gallop',die:'Death',hit:'Idle_HitReact_Left',jumpS:'Gallop_Jump',jumpI:'Gallop_Jump',land:'Jump_ToIdle',atk:{def:['Attack']}};
const CM_SPIDER={idle:'Spider_Idle',cidle:'Spider_Idle',walk:'Spider_Walk',run:'Spider_Walk',die:'Spider_Death',hit:'Spider_Jump',atk:{def:['Spider_Attack']}};
const CM_SKEL={...CM_KAY,cidle:'Idle_Combat'};
const MON_GLTF={
  ever:{m:'Bull',h:1.75,cm:{...CM_ANIMAL,atk:{def:['Attack_Headbutt','Attack_Kick']},land:'Jump_toIdle'},tint:{Main:0x5a3e2a,Main_Light:0x8a6a4a,Horns:0xf0e6d0,Muzzle:0x3a2a20,Hooves:0x2a2018},quad:1},
  wolf:{m:'Wolf',h:1.7,cm:CM_ANIMAL,tint:{Main:0x4e5664,Main_Light:0x8a919c},quad:1},
  spin:{m:'Spider',h:.8,cm:CM_SPIDER,tint:{Material:0x2a1e34,'Material.001':0xb02a2a},spider:1},
  rover:{m:'Rogue_Hooded',h:1.78,props:['Knife'],cm:{...CM_KAY,atk:{def:ATK_1H}},skin:0xc89070,hair:0x2a1a10},
  grisk:{m:'Barbarian',h:1.78,props:['Barbarian_Hat','2H_Axe'],cm:{...CM_KAY,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},skin:0xc89070,hair:0x6a2b1b},
  knekel:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'zwaard',cm:{...CM_SKEL,atk:{def:ATK_1H}},eye:0x6ad8ff},
  kmagier:{m:'Skeleton_Mage',h:1.78,props:['Skeleton_Mage_Hat'],wt:'staf',cm:{...CM_SKEL,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},eye:0xc06aff},
  boss:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'bijl',wr:3,cm:{...CM_SKEL,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},eye:0x7aff5a},
  dienaar:{m:'Skeleton_Minion',h:1.78,props:[],wt:'zwaard',cm:{...CM_SKEL,atk:{def:ATK_1H}},eye:0x6ad8ff}};
function buildGltfMon(type,lvl,sc){const d=MON_GLTF[type];if(!d)return null;
  return buildGltfRig({model:d.m,h:d.h*sc,props:d.props,wt:d.wt,wr:d.wr,cm:d.cm,quad:d.quad,spider:d.spider,o:{cls:'mon'},fallback:()=>buildMonsterProc(type,lvl)})}
/* ---- animatie-statemachine ---- */
function gAct(r,name,once){if(!name)return null;let a=r.acts[name];if(a)return a;const c=r.clips[name];if(!c)return null;a=r.mixer.clipAction(c);if(once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}r.acts[name]=a;return a}
function gLoop(r,name,fade=.18){if(r.cur===name)return r.acts[name];const a=gAct(r,name,false);if(!a)return null;const prev=r.cur&&r.acts[r.cur];a.enabled=true;a.setEffectiveWeight(1);a.paused=false;if(prev&&prev!==a){a.reset();prev.crossFadeTo(a,fade,false);a.play()}else{a.reset().fadeIn(fade).play()}r.cur=name;return a}
function animGltf(r,a,dt){
  if(r.fallback){animRig(r.fallback,a,dt);return}
  if(!r.ready)return;const S=r.st,cm=r.cm;const mv=clamp(a.spd||0,0,1.6);S.amt=ease(S.amt||0,Math.min(mv,1),clamp(dt*8,0,1));const am=S.amt;
  const cls=r.o.cls,wt=a.wt||r.wt||'zwaard';
  /* --- doodgaan --- */
  if(a.dead){if(!S.dead){S.dead=true;const d=gAct(r,cm.die,true);if(d){for(const k in r.acts)if(r.acts[k]!==d)r.acts[k].fadeOut(.15);d.reset().fadeIn(.1).play()}r.cur=cm.die;S.atkAct=null}r.mixer.update(dt);return}
  if(S.dead){S.dead=false;const d=r.acts[cm.die];if(d)d.stop();r.cur=null}
  /* --- aanval: clip wordt gescrubd op a.atk (0..1) zodat hij precies in de aanvalstijd past --- */
  if(a.atk>=0){const list=(cls==='mon'||cls==='npc')?(cm.atk.def||Object.values(cm.atk)[0]):((wt!=='zwaard'&&cm.atk[wt])||cm.atk[cls]||cm.atk.def);const name=list[(a.combo||0)%list.length];
    const act=gAct(r,name,true);if(act){if(S.atkAct!==act){if(S.atkAct)S.atkAct.fadeOut(.08);act.reset();act.setEffectiveWeight(1);act.timeScale=1e-4;/* tijd wordt hieronder gescrubd */act.play();S.atkAct=act}
      const dur=act.getClip().duration;act.time=Math.min(dur-.001,a.atk*dur*.92);act.setEffectiveWeight(1)}
    if(r.cur&&r.acts[r.cur])r.acts[r.cur].setEffectiveWeight(.25);S.atkHold=.12}
  else if(S.atkAct){S.atkHold=(S.atkHold??0)-dt;if(S.atkHold<=0){S.atkAct.fadeOut(.15);S.atkAct=null}else S.atkAct.setEffectiveWeight(Math.max(0,S.atkHold/.12))}
  /* --- geraakt --- */
  if(a.hurt&&!S.hurtOn){S.hurtOn=true;const h=gAct(r,cm.hit,true);if(h&&a.atk<0){h.reset();h.setEffectiveWeight(.8);h.play()}}else if(!a.hurt)S.hurtOn=false;
  /* --- basislus --- */
  let name;if(a.air&&cm.jumpI)name=(a.vy||0)>1&&cm.jumpS?cm.jumpS:cm.jumpI;else if(a.cast&&cm.cast)name=cm.cast;else if(am>.62)name=cm.run;else if(am>.05)name=cm.walk;else name=a.combat&&cm.cidle?cm.cidle:cm.idle;
  if(S.prevAir&&!a.air){const l=gAct(r,cm.land,true);if(l){l.reset();l.setEffectiveWeight(.9);l.play()}S.land=.22}S.prevAir=!!a.air;S.land=Math.max(0,(S.land||0)-dt);
  const act=gLoop(r,name);
  if(act){if(name===cm.run)act.timeScale=clamp(mv/1.05,.7,1.6);else if(name===cm.walk)act.timeScale=clamp(am/.5,.6,1.5);else act.timeScale=1;
    if(!(a.atk>=0))act.setEffectiveWeight(ease(act.getEffectiveWeight(),1,clamp(dt*10,0,1)));
    /* voetstappen uit de loopcyclus */
    if((name===cm.walk||name===cm.run)&&a.onStep&&!a.air){const d=act.getClip().duration;const f=(act.time/d)%1;const si=Math.floor(f*2+.5);if(S.si!==undefined&&si!==S.si&&am>.25)a.onStep(si===1?-1:1);S.si=si}}
  S.idle=am<.05&&a.atk<0?S.idle+dt:0;
  r.mixer.update(dt);
  if(r.weapon)r.weapon.traverse(m=>{if(m.userData.orb){m.rotation.y+=dt*2;m.material.emissiveIntensity=a.cast?3.5+Math.sin(performance.now()*.012):2.6}})}
