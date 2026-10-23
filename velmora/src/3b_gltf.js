/* ===================== glTF modellen (skelet + animatieclips) =====================
   Spelers/NPC's/menselijke vijanden: KayKit Adventurers & Skeletons (CC0, Kay Lousberg).
   Dieren: Quaternius Animated Animals / Easy Enemies (CC0).
   De rig die hieruit komt is compatibel met animRig(): r.gltf=true → animGltf(). */
const GLTF_MODELS={paladijn:'Knight',krijger:'Knight',magier:'Mage',jager:'Rogue'};
const MODEL_BASE=new URL('models/',location.href).href;
const gltfCache=new Map();let _gl=null;function gltfLoader(){if(!_gl){_gl=new GLTFLoader();_gl.setMeshoptDecoder(MeshoptDecoder)}return _gl}
function loadGltf(name){
  let e=gltfCache.get(name);if(e)return e.p;e={p:null,data:null};
  e.p=new Promise(res=>{gltfLoader().load(MODEL_BASE+name+'.glb',g=>{prepGltf(g);e.data=g;res(g)},undefined,err=>{console.warn('model failed to load',name,err);res(null)})});
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
function tintedMap(src,skin,hair,srgb,eye){
  const key=src.uuid+'|'+skin+'|'+hair+'|'+(srgb?1:0)+'|'+eye;let t=tintCache.get(key);if(t)return t;
  const img=src.image;const W=img.width||1024,H=img.height||1024;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
  /* recolour an atlas cell, keeping its own light and shade (each pixel keeps its brightness relative to the cell) */
  const cell=W/8;const paint=(ix,col,iy=0)=>{if(col==null)return;const c=new THREE.Color(col);if(srgb)c.convertLinearToSRGB();const d=cx.getImageData(ix*cell,iy*cell,cell,cell);const p=d.data;let sum=0;for(let i=0;i<p.length;i+=4)sum+=p[i]*.3+p[i+1]*.59+p[i+2]*.11;const avg=sum/(p.length/4)||1;
    for(let i=0;i<p.length;i+=4){const l=(p[i]*.3+p[i+1]*.59+p[i+2]*.11)/avg;p[i]=Math.min(255,c.r*255*l);p[i+1]=Math.min(255,c.g*255*l);p[i+2]=Math.min(255,c.b*255*l)}cx.putImageData(d,ix*cell,iy*cell)};
  paint(0,skin);paint(1,hair);if(srgb){paint(0,skin,1);paint(1,hair,1)}if(eye!=null){paint(2,eye);paint(2,eye,1)}
  t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=src.flipY;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;tintCache.set(key,t);return t}
/* KayKit mensachtigen: standaard clipkaart */
const ATK_1H=['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Stab','1H_Melee_Attack_Chop'],ATK_2H=['2H_Melee_Attack_Chop','2H_Melee_Attack_Slice','2H_Melee_Attack_Spin'];
const CM_KAY={idle:'Idle',cidle:'Blocking',walk:'Walking_A',run:'Running_A',jumpS:'Jump_Start',jumpI:'Jump_Idle',land:'Jump_Land',cast:'Spellcasting',die:'Death_A',hit:'Hit_A',
  atk:{krijger:['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop'],paladijn:['1H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Slice_Horizontal'],bijl:ATK_2H,magier:['Spellcast_Shoot'],jager:['2H_Ranged_Shoot'],staf:['Spellcast_Shoot'],boog:['2H_Ranged_Shoot'],ak:['2H_Ranged_Shoot'],def:ATK_1H}};
/* generieke bouwer: model, hoogte, zichtbare props, eigen wapen, kleur-tints, clipkaart */
/* GLTFLoader geeft elk lichaamsdeel een eigen skelet (met eigen bottentextuur en eigen update per frame).
   Delen met dezelfde botten en bindhouding krijgen hier één gedeeld skelet: scheelt textures en rekenwerk, vooral op mobiel. */
function shareSkel(m){const L=[];m.traverse(x=>{if(!x.isSkinnedMesh)return;const sk=x.skeleton;
  const same=L.find(o=>o.bones.length===sk.bones.length&&o.bones.every((b,i)=>b===sk.bones[i])&&o.boneInverses.every((b,i)=>b.equals(sk.boneInverses[i])));
  if(same){if(same!==sk){x.bind(same,x.bindMatrix);sk.dispose()}}else L.push(sk)})}
function buildGltfRig(spec){
  const g=new THREE.Group();const r={g,gltf:true,h:spec.h,ph:Math.random()*6,wt:spec.wt,o:spec.o||{},cm:spec.cm||CM_KAY,st:{land:0,idle:0},cur:null,acts:{},ready:false,quad:spec.quad,spider:spec.spider};
  r.body=g;
  loadGltf(spec.model).then(src=>{
    if(!src){if(spec.fallback){r.fallback=spec.fallback();g.add(r.fallback.g)}return}
    const m=SkeletonUtils.clone(src.scene);const s=spec.h/src.userData.h;m.scale.setScalar(s);m.position.y=-src.userData.y0*s;g.add(m);r.m=m;r.s=s;
    const on=spec.props||[];m.traverse(x=>{if(x.isMesh&&!x.isSkinnedMesh)x.visible=on.includes(x.name)});shareSkel(m);
    /* materialen per exemplaar klonen waar nodig (tint / huid+haar) */
    if(spec.skin!=null||spec.hair!=null||spec.tint||spec.glow){const done=new Map();m.traverse(x=>{if(!x.isMesh)return;const sm=x.material;let nm=done.get(sm);
      if(!nm){nm=sm;if(spec.glow&&spec.glow[sm.name]!=null){nm=new THREE.MeshBasicMaterial({color:new THREE.Color(spec.glow[sm.name]).multiplyScalar(1.6)})}else if(spec.tint&&spec.tint[sm.name]!=null&&sm.color){nm=sm.clone();nm.color.set(spec.tint[sm.name])}
        else if((spec.skin!=null||spec.hair!=null)&&sm.map&&x.isSkinnedMesh){nm=sm.clone();nm.map=tintedMap(sm.map,spec.skin,spec.hair,spec.orc,spec.orc?0xffc81e:undefined)}done.set(sm,nm)}x.material=nm})}
    /* wapen: mesh uit het model (KayKit) of het eigen spelwapen in de handslot */
    const slotR=m.getObjectByName('handslotr'),slotL=m.getObjectByName('handslotl');
    if(spec.weaponMesh){const w=m.getObjectByName(spec.weaponMesh);if(w){w.visible=true;const rc=RCOL[spec.wr|0];if(rc){w.material=w.material.clone();w.material.emissive=new THREE.Color(rc);w.material.emissiveIntensity=.12+(spec.wr|0)*.08}r.weapon=w}}
    else if(spec.wt&&spec.wt!=='none'&&slotR&&!spec.noProcW){const w=weaponMesh(spec.wt,spec.wr||0);w.rotation.set(0,0,0);w.scale.setScalar(1/s);(spec.wt==='boog'&&slotL?slotL:slotR).add(w);r.weapon=w}
    if(spec.o&&spec.o.gear)dressGltf(r,m,spec.o);if(spec.orc)attachOrcBits(r,m,spec.o);
    if(spec.wmodel)attachWeaponModel(r,m,spec.wmodel,'handslotr',spec.wr|0).then(w=>{if(w)r.weapon=w});if(spec.smodel)attachWeaponModel(r,m,spec.smodel,'handslotl',0);
    if(spec.eye){m.traverse(x=>{if(x.isMesh&&x.material.isMeshBasicMaterial){x.material=x.material.clone();x.material.color.set(spec.eye)}})}
    /* NPCs and monsters never change clothes: their body parts become one mesh per material (fewer draw calls, also in the shadow map) */if(spec.o&&(spec.o.cls==='npc'||spec.o.cls==='mon'))mergeSkinned(m);
    r.mixer=new THREE.AnimationMixer(m);r.clips=src.clips;r.ready=true;
    r.g.traverse(x=>{if(x.isMesh)x.castShadow=true});if(spec.onReady)spec.onReady(r)});
  return r}
/* body parts that share a skeleton, a material and a place in the rig are merged into one skinned mesh. The merged
   geometry is cached per set of source parts, so every clone of the same model shares it. */
const _mergeCache=new Map(),_ID4=new THREE.Matrix4();
function mergeSkinned(m){const groups=new Map();m.traverse(x=>{if(x.isSkinnedMesh&&x.visible&&!x.userData.outfit&&!Array.isArray(x.material)){const k=x.material.uuid+'|'+x.parent.uuid;let L=groups.get(k);if(!L)groups.set(k,L=[]);L.push(x)}});
  for(const L of groups.values()){if(L.length<2)continue;const a=L[0];if(!L.every(x=>x.matrix.equals(a.matrix)&&x.bindMatrix.equals(a.bindMatrix)&&!!x.geometry.index===!!a.geometry.index))continue;
    /* one skeleton for all parts: the union of their bones (each part's skin lists its own subset) */
    /* parts may be bound with an offset (inverse bind = reference inverse × M for every bone): their vertices are moved by M */
    const bones=[],inv=[],idx=new Map(),fix=[];let ok=true;const _mi=new THREE.Matrix4(),_mm=new THREE.Matrix4();
    for(const x of L){const sk=x.skeleton;let M=null;sk.bones.forEach((b,i)=>{const k=idx.get(b);if(k==null){idx.set(b,bones.length);bones.push(b);inv.push(sk.boneInverses[i])}else{_mm.copy(_mi.copy(inv[k]).invert()).multiply(sk.boneInverses[i]);
        if(!M)M=_mm.clone();else{const e1=M.elements,e2=_mm.elements;for(let q=0;q<16;q++)if(Math.abs(e1[q]-e2[q])>1e-3){ok=false;break}}}});fix.push(M)}
    if(!ok)continue;
    const key=L.map(x=>x.geometry.uuid+':'+x.skeleton.bones.map(b=>b.name).join(',')).join('|');let geo=_mergeCache.get(key);
    if(geo===undefined){geo=null;try{const names=Object.keys(a.geometry.attributes).filter(n=>/^(position|normal|uv|skinIndex|skinWeight|color)$/.test(n));
        if(L.every(x=>names.every(n=>x.geometry.attributes[n]))){
          const parts=L.map(x=>{const g=new THREE.BufferGeometry(),src=x.geometry,map=x.skeleton.bones.map(b=>idx.get(b));for(const n of names){const at=src.attributes[n],sz=at.itemSize,c=at.count;const si=n==='skinIndex';const arr=si?new Uint16Array(c*sz):new Float32Array(c*sz);
              for(let i=0;i<c;i++){const v=[at.getX(i),sz>1?at.getY(i):0,sz>2?at.getZ(i):0,sz>3?at.getW(i):0];for(let q=0;q<sz;q++)arr[i*sz+q]=si?map[v[q]]:v[q]}g.setAttribute(n,new THREE.BufferAttribute(arr,sz))}
            if(src.index){const ix=new Uint32Array(src.index.count);for(let i=0;i<ix.length;i++)ix[i]=src.index.getX(i);g.setIndex(new THREE.BufferAttribute(ix,1))}const M=fix[L.indexOf(x)];if(M&&!M.equals(_ID4))g.applyMatrix4(M);return g});
          geo=BufferGeometryUtils.mergeGeometries(parts,false)||null;if(geo){geo.computeBoundingSphere();geo.computeBoundingBox()}}}catch(e){geo=null}_mergeCache.set(key,geo)}
    if(!geo)continue;const sm=new THREE.SkinnedMesh(geo,a.material);sm.name=a.name+'+';sm.castShadow=a.castShadow;sm.receiveShadow=a.receiveShadow;sm.frustumCulled=false;
    sm.position.copy(a.position);sm.quaternion.copy(a.quaternion);sm.scale.copy(a.scale);a.parent.add(sm);sm.bind(new THREE.Skeleton(bones,inv.map(q=>q.clone())),a.bindMatrix);for(const x of L)x.removeFromParent()}}
/* spelers */
function buildGltfChar(o){
  const R=RACES[o.race]||RACES.mens;const s0=o.scale||1;
  return buildGltfRig({model:playerModel(o),eye:R.undead?o.hair:undefined,...(R.orc?{skin:o.skin,hair:o.hair,orc:1}:{}),h:1.78*R.h*s0,props:playerProps(o),weaponMesh:o.wm?null:weaponProp(o),noProcW:!!o.wm,wt:o.wt,wr:o.wr,o,fallback:()=>buildHumanoidProc(o)})}
/* NPC's en wachters */
const NPC_GLTF={aldren:{m:'Knight',props:['Knight_Helmet','Knight_Cape','Badge_Shield'],w:'1H_Sword'},mirla:{m:'Mage',props:['Mage_Hat','Mage_Cape'],w:'2H_Staff'},wilma:{m:'Rogue',props:[]},anselm:{m:'Mage',props:['Mage_Cape'],w:'Spellbook_open'},
  bram:{m:'Barbarian',props:['Barbarian_Hat'],w:'Mug'},dorrik:{m:'Barbarian',props:['Barbarian_Hat'],w:'1H_Axe'},thorne:{m:'Knight',props:['Knight_Helmet','Round_Shield'],w:'1H_Sword'},vaelra:{m:'Rogue_Hooded',props:['Rogue_Cape'],w:'2H_Crossbow'},guard:{m:'Knight',props:['Knight_Helmet','Rectangle_Shield'],w:'1H_Sword'},hilde:{m:'Barbarian',props:[],w:null,act:'forge'},ysolde:{m:'Mage',props:['Mage_Hat','Mage_Cape'],w:'Spellbook_open'},
  corwin:{m:'Knight',props:['Knight_Helmet','Knight_Cape','Badge_Shield'],w:'1H_Sword'},liora:{m:'Rogue_Hooded',props:['Rogue_Cape'],w:'2H_Crossbow'},sabine:{m:'Mage',props:['Mage_Hat','Mage_Cape'],w:'2H_Staff'},aurelia:{m:'Mage',props:['Mage_Cape'],w:'Spellbook_open'},
  tomas:{m:'Barbarian',props:['Barbarian_Hat'],w:'Mug'},elinor:{m:'Rogue',props:[],w:null},gerrit:{m:'Barbarian',props:[],w:'Mug'},brannoc:{m:'Barbarian',props:['Barbarian_Hat'],w:'1H_Axe'},wren:{m:'Rogue',props:['Rogue_Cape'],w:null},mabel:{m:'Barbarian',props:[],w:'Mug'},hob:{m:'Barbarian',props:[],w:'Mug'},
  kaelen:{m:'Knight',props:['Knight_Helmet','Knight_Cape','Badge_Shield'],w:'1H_Sword'},nyra:{m:'Mage',props:['Mage_Hat','Mage_Cape'],w:'2H_Staff'},oswin:{m:'Barbarian',props:['Barbarian_Hat'],w:'1H_Axe'},tessa:{m:'Rogue',props:[],w:null},brom:{m:'Barbarian',props:[],w:'Mug'},lyra:{m:'Rogue_Hooded',props:['Rogue_Cape'],w:null},
  sela:{m:'Rogue_Hooded',props:['Rogue_Cape'],w:'2H_Crossbow'},fennick:{m:'Mage',props:['Mage_Cape'],w:'2H_Staff'},pell:{m:'Mage',props:[],w:'Spellbook_open'},ardyn:{m:'Knight',props:['Knight_Helmet','Knight_Cape','Round_Shield'],w:'1H_Sword'}};
function buildGltfNpc(id,look){const d=NPC_GLTF[id]||NPC_GLTF.guard;const h=look.dwarf?1.5:1.78;
  return buildGltfRig({model:d.m,h,props:d.props,weaponMesh:d.w,wt:look.wt,...(look.tusks?{skin:look.skin,hair:look.hair,orc:1}:{}),o:{cls:'npc'},fallback:()=>buildHumanoidProc({race:look.dwarf?'dwerg':'mens',...look})})}
/* monsters */
const CM_ANIMAL={idle:'Idle',cidle:'Idle',walk:'Walk',run:'Gallop',die:'Death',hit:'Idle_HitReact_Left',jumpS:'Gallop_Jump',jumpI:'Gallop_Jump',land:'Jump_ToIdle',atk:{def:['Attack']}};
const CM_SPIDER={idle:'Spider_Idle',cidle:'Spider_Idle',walk:'Spider_Walk',run:'Spider_Walk',die:'Spider_Death',hit:'Spider_Jump',atk:{def:['Spider_Attack']}};
const CM_SKEL={...CM_KAY,cidle:'Idle_Combat'};
/* Quaternius Monster Pack / Dinosaurs (CC0): draken, vleermuizen, raptors, lavadrakes */
const CM_DRAGON={idle:'Dragon_Flying',cidle:'Dragon_Flying',walk:'Dragon_Flying',run:'Dragon_Flying',die:'Dragon_Death',hit:'Dragon_Hit',atk:{def:['Dragon_Attack','Dragon_Attack2']}};
const CM_BAT={idle:'Bat_Flying',cidle:'Bat_Flying',walk:'Bat_Flying',run:'Bat_Flying',die:'Bat_Death',hit:'Bat_Hit',atk:{def:['Bat_Attack','Bat_Attack2']}};
const CM_RAPTOR={idle:'Velociraptor_Idle',cidle:'Velociraptor_Idle',walk:'Velociraptor_Walk',run:'Velociraptor_Run',die:'Velociraptor_Death',hit:null,jumpS:'Velociraptor_Jump',atk:{def:['Velociraptor_Attack']}};
const CM_MON={idle:'Idle',cidle:'Idle',walk:'Walk',run:'Run',die:'Death',hit:'HitReact',jumpS:'Jump',jumpI:'Jump_Idle',land:'Jump_Land',atk:{def:['Punch','Weapon']}};
const CM_TREX={idle:'TRex_Idle',cidle:'TRex_Idle',walk:'TRex_Walk',run:'TRex_Run',die:'TRex_Death',hit:null,atk:{def:['TRex_Attack']}};
/* Quaternius Ultimate Monsters (CC0): three rigs, three clip sets */
const CM_UFLY={idle:'Flying_Idle',cidle:'Flying_Idle',walk:'Fast_Flying',run:'Fast_Flying',die:'Death',hit:'HitReact',atk:{def:['Punch','Headbutt']}};
const CM_UBIP={idle:'Idle',cidle:'Idle',walk:'Walk',run:'Run',die:'Death',hit:'HitReact',atk:{def:['Punch','Weapon']}};
const CM_UBLOB={idle:'Idle',cidle:'Idle',walk:'Walk',run:'Walk',die:'Death',hit:'HitRecieve',atk:{def:['Bite_Front']}};
const MON_GLTF={
  ever:{m:'Bull',h:1.75,cm:{...CM_ANIMAL,atk:{def:['Attack_Headbutt','Attack_Kick']},land:'Jump_toIdle'},tint:{Main:0x8c5e3c,Main_Light:0xb48a64,Horns:0xf0e6d0,Muzzle:0x5a3e2c,Hooves:0x3a2a20},quad:1},
  wolf:{m:'Wolf',h:1.7,cm:CM_ANIMAL,tint:{Main:0x4e5664,Main_Light:0x8a919c},quad:1},
  spin:{m:'Spider',h:.8,cm:CM_SPIDER,tint:{Material:0x2a1e34,'Material.001':0xb02a2a},spider:1},
  rover:{m:'Rogue_Hooded',h:1.78,props:['Knife'],cm:{...CM_KAY,atk:{def:ATK_1H}},skin:0xc89070,hair:0x2a1a10},
  grisk:{m:'Barbarian',h:1.78,props:['Barbarian_Hat','2H_Axe'],cm:{...CM_KAY,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},skin:0xc89070,hair:0x6a2b1b},
  knekel:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'zwaard',wm:'XS_Skeleton_Blade',sm:'XS_Skeleton_Shield_Small_A',cm:{...CM_SKEL,atk:{def:ATK_1H}},eye:0x6ad8ff},
  kmagier:{m:'Skeleton_Mage',h:1.78,props:['Skeleton_Mage_Hat'],wt:'staf',wm:'XS_Skeleton_Staff',cm:{...CM_SKEL,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},eye:0xc06aff},
  boss:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'bijl',wr:3,wm:'XS_Skeleton_Axe',cm:{...CM_SKEL,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},eye:0x7aff5a},
  dienaar:{m:'Skeleton_Minion',h:1.78,props:[],wt:'zwaard',wm:'XS_Skeleton_Blade',sm:'XS_Skeleton_Shield_Small_B',cm:{...CM_SKEL,atk:{def:ATK_1H}},eye:0x6ad8ff},
  vuurimp:{drk:1,m:'Demon',h:1.35,props:['Trident'],cm:{...CM_MON,atk:{def:['Weapon']}},tint:{Atlas:0xffb890}},
  vonk:{drk:1,m:'Demon',h:.95,props:[],cm:CM_MON,tint:{Atlas:0xffe070}},
  /* the Woods of Elvia */
  elvwolf:{m:'Wolf',h:1.9,cm:CM_ANIMAL,tint:{Main:0x4a5a3c,Main_Light:0x8a9a72},quad:1},
  elvspider:{m:'Spider',h:.95,cm:CM_SPIDER,tint:{Material:0x1e3a2c,'Material.001':0x7aff5a},spider:1},
  elvbandit:{m:'Rogue_Hooded',h:1.78,props:['Knife','Rogue_Cape'],cm:{...CM_KAY,atk:{def:ATK_1H}},skin:0xc89070,hair:0x3a2a14},
  outlawking:{m:'Barbarian',h:1.82,props:['Barbarian_Hat','2H_Axe'],cm:{...CM_KAY,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},skin:0xb88060,hair:0x2a1a0a},
  fenraptor:{m:'Velociraptor',h:1.8,cm:CM_RAPTOR,tint:{Brown:0x46603a,Black:0x182014,LightBrown:0x8aa85a},quad:1},
  mossbrute:{m:'Orc',h:2.6,props:['Cylinder.008'],cm:CM_MON,tint:{Atlas:0x8aa86a}},
  elvwisp:{m:'Demon',h:1.15,props:[],cm:CM_MON,glow:{Atlas:0x7affd0}},
  elderstag:{m:'mount/M_Stag',h:2.6,cm:{...CM_ANIMAL,atk:{def:['Attack_Headbutt','Attack_Kick']},land:'Jump_toIdle'},tint:{Material:0xd8c8a8,'Material.003':0xf4ecd8},glow:{'Material.010':0xa8ff8a},quad:1},
  oakheart:{m:'Trex',h:5.2,cm:CM_TREX,tint:{Green:0x3a5a2a,Black:0x14180e,LightGreen:0x7a9a4a,Red:0x5aff4a,LightYellow:0xc8e08a},glow:{Red:0x5aff4a}},
  /* the Thornroot Hollow */
  thornspider:{m:'Spider',h:1.15,cm:CM_SPIDER,tint:{Material:0x26341a,'Material.001':0xb8ff4a},glow:{'Material.001':0x9aff3a},spider:1},
  blightseer:{m:'Mage',h:1.82,props:['Mage_Hat','Mage_Cape'],wt:'staf',cm:{...CM_KAY,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},skin:0x9a8aa8,hair:0xdce4c8,tint:{}},
  brambleguard:{m:'Orc',h:2.5,props:['Cylinder.008'],cm:CM_MON,tint:{Atlas:0x8a7050}},
  thornwarden:{m:'Orc',h:3.5,props:['Cylinder.008'],cm:CM_MON,tint:{Atlas:0x5a4630}},
  silkling:{m:'Spider',h:.62,cm:CM_SPIDER,tint:{Material:0x8aa86a,'Material.001':0xe8ff8a},spider:1},
  silkmother:{m:'Spider',h:4.6,cm:{...CM_SPIDER,hit:null},tint:{Material:0x161e10,'Material.001':0xc8ff5a},glow:{'Material.001':0xb0ff40},spider:1},
  lavagolem:{drk:1,m:'Orc',h:2.4,props:['Cylinder.008'],cm:CM_MON,tint:{Atlas:0xd08a6a}},
  ignaroth:{drk:1,m:'Demon',h:5.4,props:['Trident'],cm:{...CM_MON,hit:null},tint:{Atlas:0xd07a60}},
  raptor:{drk:1,m:'Velociraptor',h:1.7,cm:CM_RAPTOR,tint:{Brown:0x6a625a,Black:0x1a1614,LightBrown:0xa8643a},quad:1},
  vleer:{drk:1,m:'Bat',h:1.25,cm:CM_BAT,tint:{Main:0x4a1a12,Black:0x1a0806,Belly:0xff8a2a,Nose:0x5a1a10},glow:{Eyes:0xffb030}},
  welp:{drk:1,m:'Dragon',h:1.55,cm:CM_DRAGON,tint:{Main:0xc0441e,Wings:0x6a1a10,Belly:0xf0b860,Claws:0x2a1a14},glow:{Eyes:0xffd040}},
  broedling:{drk:1,m:'Dragon',h:1.2,cm:CM_DRAGON,tint:{Main:0xe8641e,Wings:0x8a2a10,Belly:0xffd080,Claws:0x2a1a14},glow:{Eyes:0xffe060}},
  drakonier:{drk:1,m:'Mage',h:1.82,props:['Mage_Hat','Mage_Cape'],wt:'staf',cm:{...CM_KAY,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},skin:0x9a3a24,hair:0x1a0a06,tint:{}},
  lavadrake:{drk:1,m:'Trex',h:4.4,cm:CM_TREX,tint:{Green:0x3a2420,Black:0x120c0a,LightGreen:0x7a4428,Red:0xff5a10,LightYellow:0xffa040},glow:{Red:0xff5a14}},
  /* the Nether Rift */
  riftwraith:{m:'rift/M_Ghost',h:1.7,cm:CM_UFLY,tint:{Ghost_Main:0x4a2a7a},glow:{Eye_White:0xc89aff}},
  voidimp:{m:'rift/M_DemonFly',h:1.35,cm:CM_UFLY,tint:{Demon_Main:0x6a2aa8,Black:0x1a0a2a},glow:{Eye_White:0x8affe8}},
  voidooze:{m:'rift/M_PinkBlob',h:1.25,cm:CM_UBLOB,tint:{Pink_Main:0x6a1a8a,Pink_Secondary:0x2a0a3a},glow:{Eye_White:0xd8a0ff}},
  grimshard:{m:'rift/M_SpikyBlob',h:1.35,cm:CM_UBLOB,tint:{Green_Main:0x3a1a5a},glow:{Eye_White:0xff6ad8}},
  shardgnasher:{m:'rift/M_SpikyBlob',h:1.2,cm:CM_UBLOB,tint:{Green_Main:0x6a9ad8},glow:{Eye_White:0xc8f4ff}},
  prismraptor:{m:'rift/M_Dino',h:1.7,cm:CM_UBIP,tint:{Dino_Main:0x7ab8f0,Dino_Secondary:0xd8f0ff,Dino_Teeth:0xffffff,Dino_Tongue:0x4a6ab8},glow:{Eye_White:0xaef8ff}},
  shardling:{m:'rift/M_Goleling',h:1.5,cm:CM_UFLY,tint:{Goleling_Main:0x5a8ad0,Goleling_Secondary:0xc8e8ff,Gold:0xe8f8ff},glow:{Eye_White:0x9af0ff}},
  crystalbehemoth:{m:'rift/M_YetiBiped',h:1.9,cm:CM_UBIP,tint:{Yeti_Main:0xa8c8f0,Yeti_Secondary:0x4a6aa8},glow:{Eye_White:0x9af0ff}},
  colossus:{m:'rift/M_YetiBiped',h:1.9,cm:CM_UBIP,tint:{Yeti_Main:0xd8ecff,Yeti_Secondary:0x7a9ad8},glow:{Eye_White:0xffffff}},
  voidspore:{m:'rift/M_Mushnub',h:1.45,cm:CM_UBLOB,tint:{MushroomKing_Main:0x5a2a7a,MushroomKing_Secondary:0xc8b8d8,Spikes:0x2ad8a8},glow:{Eye_White:0x7affd0}},
  mirelurker:{m:'rift/M_FishBiped',h:1.8,cm:CM_UBIP,tint:{Fish_Main:0x1a6a6a,Fish_Secondary:0x8ad8c8,Fish_Flaps:0x5a2a8a},glow:{Eye_White:0x9affe8}},
  netherray:{m:'rift/M_Squidle',h:1.6,cm:CM_UFLY,tint:{Squidle_Main:0x7a2a9a,Squidle_Secondary:0x2ab8c8,Squidle_Horn:0xe8d8ff},glow:{Eye_White:0xff8ae8}},
  hollowskull:{m:'rift/M_GhostSkull',h:1.7,cm:CM_UFLY,tint:{Ghost_Main:0x2a1a3a,Ghost_Secondary:0xe8dcc8}},
  vashk:{m:'rift/M_MushroomKing',h:1.9,cm:CM_UBIP,tint:{MushroomKing_Main:0x6a2a9a,MushroomKing_Secondary:0xd8c8e8,Orc_Main:0x5a7a6a},glow:{Eye_White:0x7affd0}},
  voidstalker:{m:'rift/M_AlienBiped',h:1.85,cm:CM_UBIP,tint:{Alien_Main:0x3a1a5a,Alien_Secondary:0x7a3aa8},glow:{Eye_White:0xff5ac8}},
  riftwalker:{m:'rift/M_BlueDemon',h:2,cm:CM_UBIP,tint:{BlueDemon_Main:0x2a3a8a,BlueDemon_Secondary:0x8ad8ff,Wood:0x3a2a4a},glow:{Eye_White:0xaef4ff}},
  voidassassin:{m:'rift/M_NinjaBiped',h:1.75,cm:CM_UBIP,tint:{Ninja_Main:0x1a1428,Ninja_Secondary:0x5a2a8a,Gold:0xb08aff},glow:{Eye_White:0xd8a0ff}},
  sentinel:{m:'rift/M_Tribal',h:1.8,cm:CM_UFLY,tint:{Tribal_Main:0x3a2a5a,Tribal_Secondary:0x8a5ad8,Tribal_Gold:0xe8c87a},glow:{Eye_White:0xffe08a}},
  morvane:{m:'Mage',h:1.82,props:['Mage_Hat','Mage_Cape'],wt:'staf',cm:{...CM_KAY,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},skin:0x8a7aa8,hair:0x1a1028,tint:{}},
  voiddrake:{m:'rift/M_Dragon',h:1.8,cm:CM_UFLY,tint:{Dragon_Main:0x2a1a4a,Dragon_Secondary:0x8a4ad8,Dragon_Horn:0xd8c8ff},glow:{Eye_White:0xb07aff}},
  voidhorror:{m:'rift/M_Hywirl',h:1.8,cm:CM_UFLY,tint:{Hywirl_Main:0x4a0a6a},glow:{Eye_White:0xff4ab0}},
  dreadlord:{m:'rift/M_DemonBiped',h:2.1,cm:CM_UBIP,tint:{Demon_Main:0x5a1424,Black:0x140a10},glow:{Eye_White:0xff6a3a}},
  xalthuun:{m:'rift/M_DragonEvolved',h:2.2,cm:{...CM_UFLY,hit:null},tint:{Dragon_Main:0x1a0a2a,Dragon_Secondary:0x7a2ad8,Dragon_Horn:0xe8d8ff},glow:{Eye_White:0xff3ab0}},
  voidchanter:{m:'Skeleton_Mage',h:1.78,props:['Skeleton_Mage_Hat'],wt:'staf',wm:'XS_Skeleton_Staff',cm:{...CM_SKEL,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},eye:0xff6ad8},
  sanctumknight:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'bijl',wr:3,wm:'XS_Skeleton_Axe',cm:{...CM_SKEL,cidle:'2H_Melee_Idle',atk:{def:ATK_2H}},eye:0xc08aff},
  korvax:{m:'rift/M_YetiBiped',h:1.9,cm:CM_UBIP,tint:{Yeti_Main:0x4a3a8a,Yeti_Secondary:0xd8b8ff},glow:{Eye_White:0xff6ad8}},
  ilvaya:{m:'Mage',h:1.82,props:['Mage_Hat','Mage_Cape'],wt:'staf',cm:{...CM_KAY,atk:{def:['Spellcast_Shoot']},cidle:'Spellcasting'},skin:0xd8c8f0,hair:0xf0e8ff,tint:{}},
  nyxathar:{m:'rift/M_DemonBiped',h:2.1,cm:CM_UBIP,tint:{Demon_Main:0x1e0e32,Black:0x8a3ae8},glow:{Eye_White:0xff3ab0}},
  citadelwarden:{m:'Skeleton_Warrior',h:1.78,props:['Skeleton_Warrior_Helmet'],wt:'zwaard',wm:'XS_Skeleton_Blade',sm:'XS_Skeleton_Shield_Small_A',cm:{...CM_SKEL,atk:{def:ATK_1H}},eye:0x7ad8ff},
  grakkus:{m:'rift/M_BlueDemon',h:2,cm:CM_UBIP,tint:{BlueDemon_Main:0x1a2a5a,BlueDemon_Secondary:0xc8e8ff,Wood:0x2a3a5a},glow:{Eye_White:0x7ad8ff}},
  sareth:{m:'rift/M_Ghost',h:1.7,cm:CM_UFLY,tint:{Ghost_Main:0xa898e8},glow:{Eye_White:0xff6ad8}},
  ghorzul:{m:'rift/M_PinkBlob',h:1.25,cm:CM_UBLOB,tint:{Pink_Main:0x3a0a5a,Pink_Secondary:0xd88aff},glow:{Eye_White:0xff4ab0}},
  vorthax:{m:'rift/M_Dragon',h:1.8,cm:CM_UFLY,tint:{Dragon_Main:0x0e1a34,Dragon_Secondary:0x5ab8ff,Dragon_Horn:0xe8f4ff},glow:{Eye_White:0x7ad8ff}},
  vyraxion:{drk:1,m:'Dragon',h:7.2,cm:{...CM_DRAGON,hit:null},tint:{Main:0x8e1c12,Wings:0x3a0c08,Belly:0xe8a840,Claws:0x161210},glow:{Eyes:0xffc030}}};
function buildGltfMon(type,lvl,sc){const d=MON_GLTF[type];if(!d)return null;
  return buildGltfRig({model:d.m,h:d.h*sc,props:d.props,wt:d.wt,wr:d.wr,noProcW:!!d.wm,wmodel:d.wm,smodel:d.sm,cm:d.cm,quad:d.quad,spider:d.spider,tint:d.tint,glow:d.glow,skin:d.skin,hair:d.hair,o:{cls:'mon'},fallback:()=>buildMonsterProc(type,lvl)})}
/* ---- animatie-statemachine ---- */
function gAct(r,name,once){if(!name)return null;let a=r.acts[name];if(a)return a;const c=r.clips[name]||(TOOL_CLIPS&&TOOL_CLIPS[name]);if(!c)return null;a=r.mixer.clipAction(c);if(once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}r.acts[name]=a;return a}
function gLoop(r,name,fade=.18){if(r.cur===name)return r.acts[name];const a=gAct(r,name,false);if(!a)return null;const prev=r.cur&&r.acts[r.cur];a.enabled=true;a.setEffectiveWeight(1);a.paused=false;if(prev&&prev!==a){a.reset();prev.crossFadeTo(a,fade,false);a.play()}else{a.reset().fadeIn(fade).play()}r.cur=name;return a}
/* ---- ambachtsanimaties: KayKit Character Animations (Rig_Medium, CC0). Zelfde botnamen als de KayKit-avonturiers, dus alleen
   de rotaties (en de heup-hoogte) worden overgenomen. Wordt pas geladen bij de eerste ambachtsactie. ---- */
let TOOL_CLIPS=null,_toolClipsP=null;
function needToolClips(){if(!_toolClipsP)_toolClipsP=Promise.all(['anim_tools','anim_mount'].map(f=>new Promise(res=>gltfLoader().load(MODEL_BASE+f+'.glb',g=>res(g),undefined,()=>res(null))))).then(gs=>{const C={};for(const g of gs)if(g)for(const c of g.animations){c.tracks=c.tracks.filter(t=>/\.quaternion$/.test(t.name)||/^hips\.position$/.test(t.name));C[c.name.replace(/^.*\|/,'')]=c}TOOL_CLIPS=C;return C});return _toolClipsP}
/* activiteit → [clip, gereedschapsmodel, schaal in modeleenheden, rotatie] */
const ACT_ANIM={mine:['Pickaxing','KT_pickaxe',1],chop:['Chopping','KT_axe',1],herb:['PickUp',null],skin:['Working_B','KT_knife',1],saw:['Sawing','KT_saw',1],
  forge:['Hammering','KT_hammer',1],tan:['Working_A','KT_knife',1],sew:['Working_C','KT_scissors',.9],cook:['Working_B',null],brew:['Working_C',null],grind:['Working_A',null],
  fishcast:['Fishing_Cast','Q_FishingRod_Lvl1',.3],fishidle:['Fishing_Idle','Q_FishingRod_Lvl1',.3],fishbite:['Fishing_Struggling','Q_FishingRod_Lvl1',.3],fishcatch:['Fishing_Catch','Q_FishingRod_Lvl1',.3]};
const _toolSrc=new Map();
function toolClone(name){let p=_toolSrc.get(name);if(!p){p=loadEnv(name);_toolSrc.set(name,p)}return p.then(g=>{if(!g)return null;const m=g.scene.clone(true);m.traverse(o=>{if(o.isMesh){if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();o.material=new THREE.MeshToonMaterial({color:o.material.color.clone(),vertexColors:!!o.geometry.attributes.color,gradientMap:RAMP});o.castShadow=true}});return m})}
/* gereedschap in de rechterhand; wapens in beide handen tijdelijk verbergen */
function setTool(r,key){const want=key&&ACT_ANIM[key]?ACT_ANIM[key][1]:null;if(r.toolKey===key)return;r.toolKey=key;const sameTool=r.toolName===want&&r.tool;r.toolName=want;const m=r.m;if(!m)return;if(sameTool)return;
  const sr=m.getObjectByName('handslotr'),sl=m.getObjectByName('handslotl');
  if(r.tool){r.tool.parent&&r.tool.parent.remove(r.tool);r.tool=null}
  if(r.hidW){for(const o of r.hidW)o.visible=true;r.hidW=null}
  if(!want&&!key)return;
  r.hidW=[];for(const s of[sr,sl])if(s)for(const c of s.children)if(c.visible){c.visible=false;r.hidW.push(c)}
  if(want&&sr){const sc=ACT_ANIM[key][2]||1;toolClone(want).then(t=>{if(!t||r.toolName!==want)return;t.scale.setScalar(sc);r.tool=t;sr.add(t)})}}
function animGltf(r,a,dt){
  if(r.fallback){animRig(r.fallback,a,dt);return}
  if(!r.ready)return;if(a.sheath||r.sheathed)syncSheath(r,!!a.sheath);const S=r.st,cm=r.cm;const mv=clamp(a.spd||0,0,1.6);S.amt=ease(S.amt||0,Math.min(mv,1),clamp(dt*8,0,1));const am=S.amt;
  const cls=r.o.cls,wt=(a.wt||r.wt)&&(a.wt||r.wt)!=='none'?(a.wt||r.wt):(r.o.awt||'zwaard');
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
  if(r.o.cls!=='mon'&&(a.act||r.toolName!==undefined)){if((a.act||null)!==(r.actKey||null)){r.actKey=a.act||null;setTool(r,a.act||null)}}
  let name;if(a.mounted&&TOOL_CLIPS&&TOOL_CLIPS.Sit_Chair_Idle)name='Sit_Chair_Idle';else if(a.act&&ACT_ANIM[a.act]&&TOOL_CLIPS&&!a.air&&am<.3)name=ACT_ANIM[a.act][0];else if(a.air&&cm.jumpI)name=(a.vy||0)>1&&cm.jumpS?cm.jumpS:cm.jumpI;else if(a.cast&&cm.cast)name=cm.cast;else if(am>.62)name=cm.run;else if(am>.05)name=cm.walk;else name=a.combat&&cm.cidle?cm.cidle:cm.idle;
  /* landen: korte landingsclip die daarna weer wegfadet (anders blijft de laatste pose hangen over de looplus) */
  if(a.mounted){S.prevAir=false}else if(S.prevAir&&!a.air){const l=gAct(r,cm.land,true);if(l){l.stop();l.reset();l.setEffectiveWeight(am>.3?.45:.9);l.play();S.landAct=l}S.land=am>.3?.12:.22}S.prevAir=!!a.air;
  if(S.land>0){S.land-=dt;if(S.land<=0&&S.landAct){S.landAct.fadeOut(.12);S.landAct=null}}
  if(a.air&&S.landAct){S.landAct.stop();S.landAct=null}
  const act=gLoop(r,name);
  if(act){if(name===cm.run)act.timeScale=clamp(mv/1.05,.7,1.6);else if(name===cm.walk)act.timeScale=clamp(am/.5,.6,1.5);else act.timeScale=1;
    if(!(a.atk>=0))act.setEffectiveWeight(ease(act.getEffectiveWeight(),1,clamp(dt*10,0,1)));
    /* voetstappen uit de loopcyclus */
    if((name===cm.walk||name===cm.run)&&a.onStep&&!a.air){const d=act.getClip().duration;const f=(act.time/d)%1;const si=Math.floor(f*2+.5);if(S.si!==undefined&&si!==S.si&&am>.25)a.onStep(si===1?-1:1);S.si=si}}
  S.idle=am<.05&&a.atk<0?S.idle+dt:0;
  r.mixer.update(dt);
  if(r.weapon)r.weapon.traverse(m=>{if(m.userData.orb){m.rotation.y+=dt*2;m.material.emissiveIntensity=a.cast?3.5+Math.sin(performance.now()*.012):2.6}})}
