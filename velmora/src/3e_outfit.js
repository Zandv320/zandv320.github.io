/* ===================== outfits and weapon models on player characters =====================
   KayKit Adventurers 2.0, KayKit Skeletons 1.1 and KayKit Fantasy Weapons Bits (CC0). All KayKit characters share the
   same Rig_Medium skeleton (identical bone names and rest pose), so body parts of one character can be bound to the
   bones of another: a Mage can wear the Knight's breastplate, a Warrior the Barbarian's bear hat, and so on.
   Every armour slot picks an outfit set; every weapon picks a model. Both follow from the item itself (its name, rarity
   and crafting tier), so every player sees the same thing without extra network data. Capes are no longer part of a
   chest outfit: they come from the cloak slot (3h_cloak.js). */
const P2=(m,...n)=>n.map(x=>[m,x]);
const OUTFITS={
  knight:{hoofd:P2('O_Knight','Knight_Helmet'),borst:P2('O_Knight','Knight_Body'),handen:P2('O_Knight','Knight_ArmLeft','Knight_ArmRight'),benen:P2('O_Knight','Knight_LegLeft','Knight_LegRight')},
  barbarian:{hoofd:P2('O_Barbarian','Barbarian_BearHat'),borst:P2('O_Barbarian','Barbarian_Body'),handen:P2('O_Barbarian','Barbarian_ArmLeft','Barbarian_ArmRight'),benen:P2('O_Barbarian','Barbarian_LegLeft','Barbarian_LegRight')},
  mage:{hoofd:P2('O_Mage','Mage_Hat'),borst:P2('O_Mage','Mage_Body'),handen:P2('O_Mage','Mage_ArmLeft','Mage_ArmRight'),benen:P2('O_Mage','Mage_LegLeft','Mage_LegRight')},
  rogue:{hoofd:P2('O_Rogue_Hooded','RogueHooded_Mask'),mask:1,borst:P2('O_Rogue','Rogue_Body'),handen:P2('O_Rogue','Rogue_ArmLeft','Rogue_ArmRight'),benen:P2('O_Rogue','Rogue_LegLeft','Rogue_LegRight')},
  hooded:{hoofd:P2('O_Rogue_Hooded','RogueHooded_Head','RogueHooded_Mask'),head:1,borst:P2('O_Rogue_Hooded','RogueHooded_Body'),handen:P2('O_Rogue_Hooded','RogueHooded_ArmLeft','RogueHooded_ArmRight'),benen:P2('O_Rogue_Hooded','RogueHooded_LegLeft','RogueHooded_LegRight')},
  ranger:{hoofd:P2('O_Rogue_Hooded','RogueHooded_Mask'),mask:1,borst:P2('O_Ranger','Ranger_Body','Ranger_Quiver'),handen:P2('O_Ranger','Ranger_ArmLeft','Ranger_ArmRight'),benen:P2('O_Ranger','Ranger_LegLeft','Ranger_LegRight')},
  bone:{hoofd:P2('O_Skeleton_Warrior','Skeleton_Warrior_Helmet'),borst:P2('O_Knight','Knight_Body'),handen:P2('O_Knight','Knight_ArmLeft','Knight_ArmRight'),benen:P2('O_Knight','Knight_LegLeft','Knight_LegRight')},
  bonemage:{hoofd:P2('O_Skeleton_Mage','Skeleton_Mage_Hat'),borst:P2('O_Mage','Mage_Body'),handen:P2('O_Mage','Mage_ArmLeft','Mage_ArmRight'),benen:P2('O_Mage','Mage_LegLeft','Mage_LegRight')},
  bonerogue:{hoofd:P2('O_Skeleton_Rogue','Skeleton_Rogue_Hood'),borst:P2('O_Rogue','Rogue_Body'),handen:P2('O_Rogue','Rogue_ArmLeft','Rogue_ArmRight'),benen:P2('O_Rogue','Rogue_LegLeft','Rogue_LegRight')}};
/* per class: which sets an armour piece can have, from plain to fancy */
const OUTFIT_CLS={paladijn:['knight','knight','bone'],krijger:['barbarian','knight','bone'],magier:['mage','hooded','bonemage'],jager:['rogue','ranger','hooded','bonerogue']};
/* weapon models per weapon type and class, roughly from plain to fancy */
const WMODELS={
  paladijn:{zwaard:['XW_hammer_A','XW_hammer_B','XW_hammer_A','XW_hammer_B','XW_hammer_C'],bijl:['XW_hammer_A','XW_hammer_B','XW_hammer_C','XW_hammer_A']},
  krijger:{zwaard:['XA_sword_1handed','XW_sword_B','XA_axe_1handed','XW_sword_E','XW_sword_C','XW_sword_D','XS_Skeleton_Blade'],bijl:['XA_axe_2handed','XW_axe_A','XW_hammer_C','XW_axe_B','XW_hammer_A','XA_sword_2handed','XW_hammer_B','XW_axe_C','XW_halberd','XS_Skeleton_Axe','XA_sword_2handed_color'],staf:['XA_sword_2handed'],boog:['XA_axe_2handed']},
  magier:{staf:['XA_staff','XW_staff_B','XS_Skeleton_Staff','XW_staff_A'],zwaard:['XA_wand','XW_wand_A'],bijl:['XA_staff'],boog:['XA_staff']},
  jager:{boog:['XA_bow_withString','XW_bow_A_withString','XA_crossbow_2handed','XW_bow_B_withString','XS_Skeleton_Crossbow'],zwaard:['XA_dagger','XW_dagger_A','XW_dagger_B'],staf:['XA_dagger'],bijl:['XA_dagger']}};
const SHIELD_M=['XA_shield_round','XA_shield_square','XA_shield_round_barbarian','XA_shield_badge','XW_shield_A','XA_shield_round_color','XA_shield_square_color','XA_shield_badge_color','XW_shield_B','XA_shield_spikes_color','XW_shield_C','XS_Skeleton_Shield_Large_A','XS_Skeleton_Shield_Large_B'];
const WMODEL_ALL=new Set([...Object.values(WMODELS).flatMap(o=>Object.values(o).flat()),...SHIELD_M,'XA_spellbook_open','XW_sword_A']);
/* crafted gear gets a fixed look per tier; loot picks from the class list by name and rarity */
const TIER_LOOK={Iron:'knight',Silversteel:'knight',Emberforged:'bone',Tanned:'rogue',Hardened:'ranger',Drakeskin:'hooded',Linen:'mage',Silken:'mage',Emberweave:'bonemage'};
function pickFrom(list,it,bias=0){const h=strHash(String(it.n||it.id||''));const r=Math.max(0,it.r|0);const span=Math.min(list.length,2+r*2+bias);return list[Math.min(list.length-1,(h%span)+Math.max(0,r-2))]}
function outfitFor(it,cls){if(!it)return null;if(it.vis&&it.vis.o&&OUTFITS[it.vis.o])return it.vis.o;const L=OUTFIT_CLS[cls]||OUTFIT_CLS.krijger;
  const pre=String(it.n||'').replace(/^Masterwork /,'').split(' ')[0];if(TIER_LOOK[pre]){const o=TIER_LOOK[pre];return L.includes(o)||cls===it.cls?o:L[0]}
  if((it.r|0)>=4)return L[Math.min(L.length-1,1+(strHash(String(it.n))%2))];return pickFrom(L,it)}
/* greatswords: the KayKit two-handed swords, the coloured one from rare upwards */
const GREATSWORDS=['XA_sword_2handed','XA_sword_2handed_color'];
function weaponFor(it,cls,wt){if(!it||!wt||wt==='none'||wt==='ak')return null;if(it.vis&&it.vis.w&&WMODEL_ALL.has(it.vis.w))return it.vis.w;if(it.gs)return GREATSWORDS[(it.r|0)>=2?1:0];const L=(WMODELS[cls]||WMODELS.krijger)[wt];if(!L)return null;
  if(/^(Versleten|Worn)/.test(it.n||''))return cls==='krijger'&&wt==='zwaard'?'XW_sword_A':L[0];const pre=String(it.n||'').replace(/^Masterwork /,'').split(' ')[0];const ti={Iron:0,Tanned:0,Linen:0,Silversteel:1,Hardened:1,Silken:1,Emberforged:2,Drakeskin:2,Emberweave:2}[pre];
  if(ti!=null)return L[Math.min(L.length-1,ti*2+((it.r|0)>=3?1:0))];return pickFrom(L,it,1)}
function shieldFor(it){return it?pickFrom(SHIELD_M,it,2):null}
/* ---- binding parts of another KayKit character to this character's bones ---- */
const _outfitSrc=new Map();
function outfitSrc(name){let p=_outfitSrc.get(name);if(!p){p=loadGltf('outfit/'+name);_outfitSrc.set(name,p)}return p}
function partClone(m,src,name,rar,skCache,tint){const s=src.scene.getObjectByName(name);if(!s||!s.isMesh)return null;
  const mat=s.material.clone();if(tint&&mat.map)mat.map=tintedMap(mat.map,tint[0],null,true);if(rar>=3){mat.emissive=new THREE.Color(RCOL[rar]);mat.emissiveIntensity=.04+(rar-3)*.04}
  if(s.isSkinnedMesh){/* liefst het eigen skelet van het personage hergebruiken (zelfde rustpose): botindices omnummeren */
    const own=skCache.own||(skCache.own=(()=>{let k=null;m.traverse(x=>{if(!k&&x.isSkinnedMesh&&!x.userData.outfit)k=x.skeleton});return k})());
    if(own){const geo=remapSkin(s,own);if(geo){const o=new THREE.SkinnedMesh(geo,mat);o.name=s.name;o.bind(own,s.bindMatrix.clone());o.castShadow=true;o.frustumCulled=false;o.userData.outfit=1;const host=[...m.children].find(c=>c.children&&c.children.some(x=>x.isSkinnedMesh))||m;host.add(o);return o}}
    let sk=skCache.get(s.skeleton);if(!sk){const bones=s.skeleton.bones.map(b=>m.getObjectByName(b.name));if(bones.some(b=>!b))return null;sk=new THREE.Skeleton(bones,s.skeleton.boneInverses.map(x=>x.clone()));skCache.set(s.skeleton,sk)}
    const o=new THREE.SkinnedMesh(s.geometry,mat);o.name=s.name;o.bind(sk,s.bindMatrix.clone());o.castShadow=true;o.frustumCulled=false;o.userData.outfit=1;
    const host=[...m.children].find(c=>c.children&&c.children.some(x=>x.isSkinnedMesh))||m;host.add(o);return o}
  const bone=m.getObjectByName(s.parent.name);if(!bone)return null;const o=new THREE.Mesh(s.geometry,mat);o.name=s.name;o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.castShadow=true;o.userData.outfit=1;bone.add(o);return o}
const _remap=new Map();
function remapSkin(s,own){const key=s.geometry.uuid+'|'+own.bones.map(b=>b.name).join(',');if(_remap.has(key))return _remap.get(key);let res=null;
  const idx=new Map(own.bones.map((b,i)=>[b.name,i]));const map=s.skeleton.bones.map(b=>idx.has(b.name)?idx.get(b.name):-1);
  const ok=map.every((t,i)=>t>=0&&s.skeleton.boneInverses[i].equals(own.boneInverses[t])||t>=0&&s.skeleton.boneInverses[i].elements.every((v,j)=>Math.abs(v-own.boneInverses[t].elements[j])<1e-3));
  if(ok){const g=s.geometry.clone();const si=g.attributes.skinIndex;const arr=new Uint16Array(si.count*4);for(let i=0;i<si.count;i++)for(let k=0;k<4;k++)arr[i*4+k]=map[si.getComponent(i,k)];g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(arr,4));res=g}
  _remap.set(key,res);return res}
/* hair under a helmet: the KayKit atlas keeps hair in cell (1,0); those vertices are pulled in towards the middle of the
   skull so that no hair sticks out through a helmet or hat that was made for another head */
const _tuck=new Map();
function tuckHair(x){const g0=x.userData.hairGeo0||x.geometry;x.userData.hairGeo0=g0;let g=_tuck.get(g0.uuid);
  if(!g){g=g0.clone();const P=g.attributes.position,U=g.attributes.uv;if(P&&U){
      g.computeBoundingBox();const b=g.boundingBox,c=new THREE.Vector3();b.getCenter(c);const hy=b.max.y-b.min.y;c.y=b.min.y+hy*.42;
      const eyeY=b.min.y+hy*.55;const v=new THREE.Vector3();
      for(let i=0;i<P.count;i++){const u=U.getX(i),w=U.getY(i);if(!(u>=.125&&u<.25&&w<.125))continue;v.fromBufferAttribute(P,i);if(v.y<eyeY)continue;
        const t=Math.min(1,(v.y-eyeY)/(hy*.25));const k=1-.2*t;v.sub(c).multiplyScalar(k).add(c);P.setXYZ(i,v.x,v.y,v.z)}
      P.needsUpdate=true}_tuck.set(g0.uuid,g)}
  x.geometry=g}
/* ---- orcs: a human KayKit body with green skin, plus tusks and a gold earring cut from the Quaternius Orc (CC0) ----
   Positions are in the space of the KayKit 'head' bone (same for every KayKit character). */
const ORC_BITS=[['ORC_Tusks',[0,.13,.43],1.95,-.18,0],['ORC_Earring',[.53,.32,.0],1.6,0,.3]];
const _orcSrc=new Map();function orcPart(n){let p=_orcSrc.get(n);if(!p){p=new Promise(res=>gltfLoader().load(MODEL_BASE+'orc/'+n+'.glb',g=>res(g),undefined,()=>res(null)));_orcSrc.set(n,p)}return p}
async function attachOrcBits(r,m,o){const head=m.getObjectByName('head');if(!head||head.userData.orcBits)return;head.userData.orcBits=1;const mask=o&&o.outfits&&OUTFITS[o.outfits.hoofd]&&OUTFITS[o.outfits.hoofd].mask;
  for(const[n,p,s,rx,ry]of ORC_BITS){if(mask&&n==='ORC_Tusks')continue;const g=await orcPart(n);if(!g||!r.m)continue;const b=g.scene.clone(true);
    b.traverse(x=>{if(x.isMesh){x.material=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP});x.castShadow=true;x.userData.orc=1}});b.position.set(...p);b.scale.setScalar(s);b.rotation.set(rx,ry,0);head.add(b)}}
/* which own meshes a slot replaces (matched on the end of the mesh name) */
const SLOT_HIDE={borst:/_Body$|_Cape$|_Cloak$/,handen:/Arm(Left|Right)$/,benen:/Leg(Left|Right)$/};
async function applyOutfit(r,m,o){const G=o.gear||{};const sets=o.outfits||{};const tasks=[];const skCache=new Map();
  for(const slot of['hoofd','borst','handen','benen']){const key=sets[slot];const O=key&&OUTFITS[key];if(!O)continue;const rar=G[slot]?G[slot].r|0:0;
    tasks.push((async()=>{let n=0;for(const[mn,pn]of O[slot]){const src=await outfitSrc(mn);if(!src||!r.m)continue;if(partClone(m,src,pn,rar,skCache,RACES[o.race]&&RACES[o.race].orc?[o.skin,o.hair]:null))n++}
      if(!n)return;
      /* eigen onderdelen verbergen */
      m.traverse(x=>{if(!x.isMesh||x.userData.outfit)return;if(slot==='hoofd'){if(!x.isSkinnedMesh&&/Helmet|Hat|Hood/i.test(x.name))x.visible=false;if(O.head&&/_Head$|_Skull$|_Jaw$|_Eyes$/.test(x.name))x.visible=false;else if(!O.mask&&x.isSkinnedMesh&&/_Head$/.test(x.name))tuckHair(x)}else if(SLOT_HIDE[slot].test(x.name))x.visible=false})})())}
  await Promise.all(tasks)}
/* weapon and off-hand models into the hand slots */
const _wSrc=new Map();
function wModel(name){let p=_wSrc.get(name);if(!p){p=new Promise(res=>gltfLoader().load(MODEL_BASE+'wpn/'+name+'.glb',g=>res(g),undefined,()=>res(null)));_wSrc.set(name,p)}return p}
async function attachWeaponModel(r,m,name,slotName,rar){if(!name)return null;const g=await wModel(name);if(!g||!r.m)return null;const slot=m.getObjectByName(slotName);if(!slot)return null;
  const w=g.scene.clone(true);w.traverse(x=>{if(x.isMesh){x.castShadow=true;const mt=new THREE.MeshToonMaterial({color:x.material.color.clone(),vertexColors:!!x.geometry.attributes.color,gradientMap:RAMP});if(rar>=2){mt.emissive=new THREE.Color(RCOL[rar]);mt.emissiveIntensity=.04+(rar-2)*.07}x.material=mt}});
  /* some models come with the blade on the wrong side for the hand: turn them so the cutting edge faces down/forward */if(WFLIP.has(name))w.rotation.y+=Math.PI;/* per-model hold corrections */{const t=(window.__WR&&window.__WR[name])||WROT[name];if(t){w.rotation.x+=t[0];w.rotation.y+=t[1];w.rotation.z+=t[2]}}
  w.userData.wmodel=name;slot.add(w);return w}
/* crossbows sit in the right hand turned a quarter (as the KayKit Rogue holds its own crossbow); the plain bow is modelled flat */
const WROT={XA_crossbow_2handed:[0,1.5708,0],XS_Skeleton_Crossbow:[0,1.5708,0],XA_bow_withString:[0,-1.5708,0]};
const WFLIP=new Set(['XA_axe_1handed','XW_axe_C','XW_halberd']);
async function applyWeapons(r,m,o){if(!o.wm&&!o.sm&&!o.om)return;
  /* de oude wapenprops uit het basismodel uit */for(const s of[m.getObjectByName('handslotr'),m.getObjectByName('handslotl'),...(r.shH?[r.shH]:[])]){if(s)for(const c of s.children)if(!c.userData.wmodel&&c!==r.tool)c.visible=false}
  const xb=/crossbow/i.test(o.wm||'');const main=o.wt==='boog'&&!xb?'handslotl':'handslotr',off=o.wt==='boog'&&!xb?'handslotr':'handslotl';
  const w=await attachWeaponModel(r,m,o.wm,main,o.wr|0);if(w){r.weapon=w;if(o.wsc)w.scale.multiplyScalar(clamp(+o.wsc||1,.5,2));if(o.cls==='paladijn')palWeapon(r,w,o)}
  if(o.sm){const s=await attachWeaponModel(r,m,o.sm,off,o.wr|0);if(s&&o.cls==='paladijn')palWeapon(r,s,o);
    /* a weapon in the off hand: the left hand slot is mirrored, turn the weapon round so the blade points the same way as the main hand's */if(s&&!/shield/i.test(o.sm)){s.rotation.y+=Math.PI;r.oweapon=s}}if(o.om)await attachWeaponModel(r,m,o.om,off,0)}
/* the part of a look that describes outfits and weapon models (small, goes over the network) */
function outfitLook(p,cls){const eq=p.eq||{};const out={};for(const s of['hoofd','borst','handen','benen']){if(s==='hoofd'&&helmTier(eq.hoofd))continue;const k=outfitFor(eq[s],cls);if(k)out[s]=k}
  const w=eq.wapen,wt=w?w.wt:null;const res={outfits:out,wm:weaponFor(w,cls,wt),sm:null,om:null};
  /* the off hand comes from the off-hand slot (shield, second weapon, tome); a two-hander leaves it empty */if(!isTwoHand(w))offhandLook(eq,cls,res);
  if(cls==='paladijn'){res.wsc=wt==='bijl'&&!(w&&w.gs)?1.35:1.1;res.wtn=palWeaponTint(w)}return res}
