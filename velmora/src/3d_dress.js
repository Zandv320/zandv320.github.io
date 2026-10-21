/* ===================== uitrusting op glTF-spelers =====================
   Alles wat een speler draagt wordt bepaald door ÉÉN tabel: GEAR_VIS (uitrusting) en WEAPON_VIS (wapens).
   Een uitrustingsstuk is zichtbaar zolang het is uitgerust en verdwijnt fysiek zodra je het uittrekt.

   Hoe het werkt (zonder eigen 3D te maken, alleen met de bestaande KayKit-assets):
   - "props": losse onderdelen die al in het model zitten (helm, hoed, cape, schilden, zwaarden …) worden aan/uit gezet
     en krijgen de kleur van het item mee (plus een lichte gloed naar zeldzaamheid).
   - "cells": de KayKit-textuur is een atlas van 8×8 effen kleurvakken; per lichaamsdeel (Body/Arm/Leg/Head) krijgt het
     model een eigen kopie van die atlas waarin de kledingvakken de itemkleur krijgen. Zonder item worden die vakken
     huidkleur, zodat een speler zonder uitrusting alleen een onderbroek (de riem) aanheeft.
   - "model": voor de jager wisselt het hele model naar Rogue_Hooded zodra er een hoofdstuk op zit.

   NIEUW ITEM TOEVOEGEN
   1. Spelregels: zet de naam in BASE/WEAP (1_core.js) zoals de bestaande items; de kleur volgt uit gearCol (klasse-palet + naam).
   2. Uiterlijk: niets nodig — het slot bepaalt via GEAR_VIS wat er zichtbaar wordt. Wil je een item een eigen uiterlijk geven,
      zet dan op het item een `vis`-object, bijvoorbeeld:
        it.vis={prop:'Spike_Shield'}            // ander onderdeel uit het model tonen (naam uit de .glb)
        it.vis={c:0xff2200}                     // vaste kleur in plaats van de paletkleur
        it.vis={glb:'models/extra/Bijl.glb',scale:1,rot:[0,0,0]}   // eigen .glb in de handslot (nieuwe wapens!)
      Het `vis`-object wordt met het item opgeslagen en via het netwerk meegestuurd, dus iedereen ziet hetzelfde.
   3. Nieuw wapentype (bijv. 'speer'): voeg een regel toe aan WEAPON_VIS met per klasse het onderdeel of een glb. */
const GEAR_VIS={
  krijger:{hoofd:{props:['Knight_Helmet']},borst:{props:['Knight_Cape'],cells:'Body'},handen:{cells:'Arm'},benen:{cells:'Leg'},voeten:{cells:'Boot'}},
  magier:{hoofd:{props:['Mage_Hat']},borst:{props:['Mage_Cape'],cells:'Body',extra:{Spellbook:1}},handen:{cells:'Arm'},benen:{cells:'Leg'},voeten:{cells:'Boot'}},
  paladijn:{hoofd:{props:['Knight_Helmet']},borst:{props:['Knight_Cape'],cells:'Body'},handen:{cells:'Arm'},benen:{cells:'Leg'},voeten:{cells:'Boot'}},
  jager:{hoofd:{model:'Rogue_Hooded',cells:'Hood'},borst:{props:['Rogue_Cape'],cells:'Body',extra:{Knife_Offhand:1}},handen:{cells:'Arm'},benen:{cells:'Leg'},voeten:{cells:'Boot'}}};
/* wapentype → onderdeel in het model per klasse; shield: welk schild erbij hoort (per zeldzaamheid, krijger) */
const WEAPON_VIS={
  zwaard:{krijger:'1H_Sword',paladijn:'1H_Sword',magier:'1H_Wand',jager:'Knife',shield:true},
  bijl:{krijger:'2H_Sword',paladijn:'2H_Sword',shield:false},
  staf:{magier:'2H_Staff',krijger:'2H_Sword',jager:'Knife'},
  boog:{jager:'2H_Crossbow'}};
const SHIELDS=['Round_Shield','Badge_Shield','Rectangle_Shield','Spike_Shield'];
const UNDIES=0xe9e4d8;
/* beschrijving van een item zoals het in de look terechtkomt (klein, want gaat over het netwerk) */
function gearDesc(it,cls){if(!it)return null;const v=it.vis||{};return{c:v.c!=null?v.c:gearCol(it,cls),r:it.r|0,p:v.prop||null,g:v.glb||null,s:v.scale||1,ro:v.rot||null}}
/* ---- atlasvakken ---- */
const CELL_SKIN=(cx,cy)=>cx===0&&cy<=1,CELL_HAIR=(cx,cy)=>cx===1&&cy<=1,CELL_EYES=(cx,cy)=>cx===2&&cy<=1;
const isFixed=(cx,cy)=>CELL_SKIN(cx,cy)||CELL_HAIR(cx,cy)||CELL_EYES(cx,cy);
const lightC=(c)=>new THREE.Color(c).lerp(new THREE.Color(1,1,1),.22).getHex();
function dressMapping(kind,G,skin){const col=(d)=>d?lightC(d.c):skin;
  return(cx,cy)=>{if(isFixed(cx,cy))return null;
    if(kind==='Body'){const belt=(cx===5||cx===6)&&cy<=1;if(belt)return G.borst?lightC(G.borst.c):UNDIES;return col(G.borst)}
    if(kind==='Arm'){const glove=cx===4||cx===5||(cx===7&&cy>=4);return glove?col(G.handen):col(G.borst)}
    if(kind==='Leg'){const boot=cx===7&&cy>=2;return boot?col(G.voeten):col(G.benen)}
    if(kind==='Head')return G.hoofd?lightC(G.hoofd.c):null;/* alleen de kap van Rogue_Hooded */
    return null}}
const dressCache=new Map();
function atlasSkin(src){const k=src.uuid+'|skin';let c=dressCache.get(k);if(c)return c;const img=src.image;const cv=document.createElement('canvas');cv.width=cv.height=8;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,img.width/8,img.height/8,0,0,8,8);const d=g.getImageData(0,0,8,8).data;let r=0,gg=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2]}const n=d.length/4;c=new THREE.Color(r/n/255,gg/n/255,b/n/255).getHex();dressCache.set(k,c);return c}
function dressedMap(src,mapping,key){const k=src.uuid+'|'+key;let t=dressCache.get(k);if(t)return t;
  const img=src.image;const W=img.width||1024,H=img.height||1024,cw=W/8,ch=H/8;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  for(let cy=0;cy<8;cy++)for(let cx=0;cx<8;cx++){const col=mapping(cx,cy);if(col==null)continue;const c=new THREE.Color(col);const d=g.getImageData(cx*cw,cy*ch,cw,ch);const p=d.data;let sum=0;for(let i=0;i<p.length;i+=4)sum+=p[i]*.3+p[i+1]*.59+p[i+2]*.11;const avg=sum/(p.length/4)||1;
    for(let i=0;i<p.length;i+=4){const l=Math.min(1.35,(p[i]*.3+p[i+1]*.59+p[i+2]*.11)/avg);p[i]=Math.min(255,c.r*255*l);p[i+1]=Math.min(255,c.g*255*l);p[i+2]=Math.min(255,c.b*255*l)}g.putImageData(d,cx*cw,cy*ch)}
  t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=src.flipY;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;dressCache.set(k,t);return t}
/* ---- welk model en welke props horen bij deze look ---- */
const UNDEAD_MODEL={paladijn:'Skeleton_Warrior',krijger:'Skeleton_Warrior',magier:'Skeleton_Mage',jager:'Skeleton_Minion'};
function playerModel(o){const cls=o.cls;if(RACES[o.race]&&RACES[o.race].undead)return UNDEAD_MODEL[cls]||'Skeleton_Warrior';if(o.outfits)return GLTF_MODELS[cls];for(const slot in GEAR_VIS[cls]||{}){const v=GEAR_VIS[cls][slot];if(v.model&&o.gear&&o.gear[slot])return v.model}return GLTF_MODELS[cls]}
function playerProps(o){const on=[];const V=GEAR_VIS[o.cls]||{};const G=o.gear||{};
  for(const slot in V){const d=G[slot];if(!d)continue;if(o.outfits&&o.outfits[slot])continue;const v=V[slot];if(d.p)on.push(d.p);else if(v.props)on.push(...v.props);if(v.extra&&!o.om)on.push(...Object.keys(v.extra))}
  const wv=o.wt&&WEAPON_VIS[o.wt];if(wv&&wv.shield&&(o.cls==='krijger'||o.cls==='paladijn')&&o.wt&&!o.sm)on.push(SHIELDS[clamp(o.wr|0,0,3)]);
  return on}
function weaponProp(o){if(o.wvis&&o.wvis.p)return o.wvis.p;const wv=o.wt&&WEAPON_VIS[o.wt];return wv?wv[o.cls]||null:null}
/* props en atlas kleuren; eigen glb-wapen inladen */
function dressGltf(r,m,o){const G=o.gear||{};const key=JSON.stringify(G);if(o.sp)attachShoulders(r,m,o);if(o.hl)attachHelm(r,m,o);if(o.ck!=null)attachCloak(r,m,o);if(o.outfits)applyOutfit(r,m,o).then(()=>{if(o.cls==='paladijn')paladinize(r,m,o)});if(o.wm||o.sm||o.om)applyWeapons(r,m,o);if(RACES[o.race]&&RACES[o.race].undead)return;/* skeletten: eigen textuur houden */
  m.traverse(x=>{if(!x.isSkinnedMesh||!x.material.map)return;const kind=/Arm/.test(x.name)?'Arm':/Leg/.test(x.name)?'Leg':/Head/.test(x.name)?'Head':/Body/.test(x.name)?'Body':null;if(!kind)return;
    if(kind==='Head'&&!/Hooded/.test(x.name))return;
    const skin=atlasSkin(x.material.map);const nm=x.material.clone();nm.map=dressedMap(x.material.map,dressMapping(kind,G,skin),kind+'|'+key);x.material=nm});
  const tintProp=(name,d)=>{const p=m.getObjectByName(name);if(!p||!d)return;p.material=p.material.clone();p.material.color.copy(new THREE.Color(d.c)).lerp(new THREE.Color(1,1,1),.5);const rc=RCOL[d.r];if(rc){p.material.emissive=new THREE.Color(rc);p.material.emissiveIntensity=.12+d.r*.06}};
  const V=GEAR_VIS[o.cls]||{};for(const slot in V){const d=G[slot];if(!d)continue;if(d.p)tintProp(d.p,d);else for(const pn of V[slot].props||[])tintProp(pn,d)}
  /* eigen wapenmodel (it.vis.glb) in de handslot */
  if(o.wvis&&o.wvis.g){const slot=m.getObjectByName(o.wt==='boog'?'handslotl':'handslotr');if(slot){gltfLoader().load(new URL(o.wvis.g,location.href).href,g=>{const w=g.scene;w.scale.setScalar((o.wvis.s||1)/r.s);if(o.wvis.ro)w.rotation.set(...o.wvis.ro);w.traverse(x=>{if(x.isMesh){x.castShadow=true;if(!x.material.isMeshToonMaterial)x.material=new THREE.MeshToonMaterial({map:x.material.map||null,color:x.material.map?0xffffff:x.material.color,gradientMap:RAMP})}});slot.add(w);if(r.weapon)r.weapon.visible=false;r.weapon=w},undefined,e=>console.warn('weapon model failed',o.wvis.g,e))}}}
