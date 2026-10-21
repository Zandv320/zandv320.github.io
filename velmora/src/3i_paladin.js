/* ===================== The Paladin: armour colours, tier sets, hammers and shields =====================
   The Paladin wears the KayKit Knight (Adventurers 2.0, CC0) and its plate, but in the colours of the Light. Every texture
   cell and every vertex colour of the knight's plate, cloth, gold and leather is repainted per set tier, keeping its own
   shading. The tier follows the chest piece:
     I   Initiate's Plate     silver steel, royal blue tabard, brass
     II  Crusader's Plate     bright silver, white tabard with blue, gold
     III Lightforged Plate    pale-gold plate, white tabard, bright gold, a soft glow
     IV  Dawnbringer Plate    radiant white-gold, glowing, motes of light rising around you (legendary chest)
   Hammers are the KayKit Fantasy Weapons hammers and maces, shields the KayKit shields; both get the same palette. */
const PAL_TIERS=[null,
  {cloth:0x2c4aa8,cloth2:0x1c2a62,metal:0xbcc4d0,gold:0xc8a050,leather:0x5a4030,emi:0},
  {cloth:0xeee8d6,cloth2:0x2c4aa8,metal:0xe2e8f2,gold:0xe8c060,leather:0x4a3626,emi:0},
  {cloth:0xf6f2e6,cloth2:0xd8a840,metal:0xeadcae,gold:0xffd060,leather:0x6a4a2a,emi:.08},
  {cloth:0xffffff,cloth2:0xffc850,metal:0xfff2d0,gold:0xffe27a,leather:0x8a6a3a,emi:.22}];
/* the set tier of a paladin: from the chest piece (rarity), a legendary chest is always IV */
function paladinTier(eq){const ch=eq&&eq.borst;if(!ch)return 1;const r=ch.r|0;return r>=4?4:r>=3?3:r>=2?2:1}
/* which part of the palette a colour belongs to (null: leave it alone) */
const _palH={};
function palClass(c){c.getHSL(_palH);const h=_palH.h,s=_palH.s,l=_palH.l;
  if(s<.16)return'metal';
  if((h<.035||h>.93)&&s>.3)return l<.42?'cloth2':'cloth';
  if(h>=.07&&h<=.17&&s>.35&&l>.42)return'gold';
  if(h>=.02&&h<.12&&l<=.5)return'leather';
  if(h>=.5&&h<=.75)return'cloth2';
  return null}
/* a repainted copy of a KayKit atlas (cached per texture and tier); skin, hair and eyes are left alone */
const _palTex=new Map();
function palMap(src,tier){const k=src.uuid+'|'+tier;let t=_palTex.get(k);if(t)return t;const T=PAL_TIERS[tier]||PAL_TIERS[1];
  const img=src.image;if(!img)return src;const W=img.width||1024,H=img.height||1024,cw=W/8,ch=H/8;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  const c=new THREE.Color();
  for(let cy=0;cy<8;cy++)for(let cx=0;cx<8;cx++){if(isFixed(cx,cy))continue;const d=g.getImageData(cx*cw,cy*ch,cw,ch),p=d.data;let r=0,gg=0,b=0,n=p.length/4;for(let i=0;i<p.length;i+=4){r+=p[i];gg+=p[i+1];b+=p[i+2]}
    c.setRGB(r/n/255,gg/n/255,b/n/255,THREE.SRGBColorSpace);const cl=palClass(c);if(!cl)continue;const to=new THREE.Color(T[cl]);const lum0=(r*.3+gg*.59+b*.11)/n||1;
    /* keep the cell's own light and shade; metal keeps its brightness steps (dark rivets stay dark) */const base=cl==='metal'?Math.min(1.25,Math.max(.35,lum0/170)):1;
    for(let i=0;i<p.length;i+=4){const l=Math.min(1.35,(p[i]*.3+p[i+1]*.59+p[i+2]*.11)/lum0)*base;p[i]=Math.min(255,to.r*255*l);p[i+1]=Math.min(255,to.g*255*l);p[i+2]=Math.min(255,to.b*255*l)}g.putImageData(d,cx*cw,cy*ch)}
  t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=src.flipY;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;_palTex.set(k,t);return t}
/* the same for meshes coloured by vertex colours (KayKit weapons and shields): a repainted copy of the geometry */
const _palGeo=new Map();
function palGeo(geo,tier,wpn){const k=geo.uuid+'|'+tier+(wpn?'w':'');let g=_palGeo.get(k);if(g)return g;const C=geo.attributes.color;if(!C)return geo;const T=PAL_TIERS[tier]||PAL_TIERS[1];
  g=geo.clone();const A=g.attributes.color,arr=new Float32Array(A.count*A.itemSize),c=new THREE.Color();
  for(let i=0;i<A.count;i++){c.setRGB(A.getX(i),A.getY(i),A.getZ(i));let cl=palClass(c.clone().convertLinearToSRGB());/* on a weapon dark blue-grey is steel, not cloth */if(wpn&&cl==='cloth2')cl='metal';let out=c;if(cl){const lm=Math.max(.35,Math.min(1.3,(c.r*.3+c.g*.59+c.b*.11)/.5));out=new THREE.Color(T[cl]).convertSRGBToLinear().multiplyScalar(cl==='metal'?Math.max(.8,lm):1)}
    arr[i*A.itemSize]=out.r;arr[i*A.itemSize+1]=out.g;arr[i*A.itemSize+2]=out.b;if(A.itemSize===4)arr[i*4+3]=A.getW(i)}
  g.setAttribute('color',new THREE.BufferAttribute(arr,A.itemSize));_palGeo.set(k,g);return g}
/* is this mesh part of a piece that has its own look (helmet, shoulder pads, cloak)? */
function palOwnLook(x){for(let o=x;o;o=o.parent){const u=o.userData;if(u.helm||u.shoulder||u.cloak||u.eglow)return true}return false}
/* repaint the whole knight: body, outfits, weapons and shield */
function paladinize(r,m,o){if(!r.m||r.m!==m)return;const tier=clamp(o.pt|0||1,1,4);const T=PAL_TIERS[tier];
  /* an undead paladin keeps its own bones (the skeleton atlas is not a knight atlas): only the armour it wears is repainted */const undead=RACES[o.race]&&RACES[o.race].undead;
  m.traverse(x=>{if(!x.isMesh||x.userData.palDone||palOwnLook(x))return;if(undead&&!x.userData.outfit)return;const mt=x.material;if(!mt)return;
    if(mt.map&&mt.map.image){x.material=mt.clone();x.material.map=palMap(mt.map,tier);if(T.emi){x.material.emissiveMap=x.material.map;x.material.emissive=new THREE.Color(0xffffff);x.material.emissiveIntensity=T.emi}x.material.needsUpdate=true}
    else if(x.geometry&&x.geometry.attributes.color&&mt.vertexColors){x.geometry=palGeo(x.geometry,tier);if(T.emi){x.material=mt.clone();x.material.emissive=new THREE.Color(T.gold);x.material.emissiveIntensity=T.emi*.5}}
    x.userData.palDone=1});
  r._pal={tier,acc:0}}
/* weapons and shields are attached later than the outfit: they get the palette as they come in */
function palWeapon(r,w,o){if(!w||o.cls!=='paladijn')return;const tier=clamp(o.pt|0||1,1,4),T=PAL_TIERS[tier];w.traverse(x=>{if(!x.isMesh)return;if(x.geometry.attributes.color)x.geometry=palGeo(x.geometry,tier,!w.userData.wmodel||!/shield/i.test(w.userData.wmodel));
    /* parts coloured by their material instead of vertex colours (the spiked ball of the mace) */else{const c=x.material.color.clone().convertLinearToSRGB();const cl=palClass(c);if(cl){const to=new THREE.Color(T[cl]);if(cl==='metal')to.multiplyScalar(Math.max(.8,Math.min(1.1,(c.r+c.g+c.b)/1.6)));x.material.color.copy(to)}}if(T.emi){x.material.emissive=new THREE.Color(T.gold);x.material.emissiveIntensity=Math.max(x.material.emissiveIntensity||0,T.emi*.6)}x.userData.palDone=1})}
/* shields by rarity, from a plain round shield to the great crested shield */
const PAL_SHIELDS=['XA_shield_round','XA_shield_badge','XW_shield_A','XA_shield_badge_color','XW_shield_C'];
function palShieldFor(it){if(!it)return null;return PAL_SHIELDS[clamp(it.r|0,0,4)]}
function palWeaponTint(it){return 0}
/* per frame: the Dawnbringer set sheds motes of light */
const _palv=new THREE.Vector3();
function paladinFx(r,dt){const S=r&&r._pal;if(!S||S.tier<3||!r.g||typeof emitP!=='function')return;r.g.getWorldPosition(_palv);if(Math.abs(_palv.x-camTarget.x)+Math.abs(_palv.z-camTarget.z)>45)return;
  S.acc+=dt*(S.tier>=4?(GFX.q==='laag'?5:11):(GFX.q==='laag'?1.5:3.5));let n=Math.min(3,Math.floor(S.acc));S.acc-=n;
  for(let i=0;i<n;i++){const a=Math.random()*6.28,d=.35+Math.random()*.35;emitP({x:_palv.x+Math.cos(a)*d,y:_palv.y+.2+Math.random()*1.4,z:_palv.z+Math.sin(a)*d,vy:.6+Math.random()*.6,life:1+Math.random()*.6,size:.12,size1:.03,col:Math.random()<.6?0xffe08a:0xfff8e0,a:.95,a1:0,cell:FXC.glint})}}
/* ---- tier pieces: helmets, shoulder pads and cloaks of the Light (data for 3g_helm.js, 3f_shoulder.js, 3h_cloak.js) ---- */
const PAL_HALO=(n,y,r,s,col,emi,ei)=>Array.from({length:n},(_,k)=>{const a=k/n*6.28;return{f:'env/Q_Crystal5',n:null,crystal:[Math.cos(a)*r,y,Math.sin(a)*r,s],col,emi,ei,orbit:1}});

HL_DEF.paladijn=[
  [{f:'Knight',n:'Knight_Helmet'}],
  [{f:'outfit/O_Knight',n:'Knight_Helmet'},{f:'outfit/O_Knight',n:'Knight_HelmetVisor'},{f:'env/Q_Crystal5',n:null,crystal:[0,1.2,0,.16],col:0xffe9a0,emi:0xffc040,ei:.9,spin:1}],
  [{f:'outfit/O_Knight',n:'Knight_Helmet',emi:0x4a3000,ei:.18},{f:'outfit/O_Knight',n:'Knight_HelmetVisor'},...PAL_HALO(6,1.3,.42,.09,0xffefb0,0xffc040,1.3)],
  [{f:'outfit/O_Knight',n:'Knight_Helmet',emi:0x6a4a00,ei:.28,glow:0xffe070,gi:.22},{f:'outfit/O_Knight',n:'Knight_HelmetVisor',emi:0x6a4a00,ei:.3},
    {f:'env/Q_Crystal5',n:null,crystal:[0,1.56,0,.17],col:0xfff4c0,emi:0xffd050,ei:1.6,spin:1},...PAL_HALO(8,1.34,.47,.1,0xfff4c0,0xffd050,1.6)]];
HL_ITEMS.paladijn=['Initiate\'s Helm','Crusader\'s Greathelm','Lightforged Helm','Crown of the Dawn'];
HL_LEG.paladijn={mods:{heal:.10,mpp:.08},leg:'Legendary: your heals restore 10% more and you have 8% more mana. A halo of light circles your brow.'};
SP_DEF.paladijn=[
  [{f:'Knight',n:'Round_Shield',keep:()=>true,s:[.46,.36,.46]}],
  [{f:'Knight',n:'Badge_Shield',keep:()=>true,s:[.52,.44,.52]},{f:'outfit/O_Knight',n:'Knight_HelmetVisor',keep:(x,y,z)=>y>.38,s:[.42,.3,.42],p:[0,.05,0]}],
  [{f:'Knight',n:'Badge_Shield',keep:()=>true,s:[.58,.5,.58],emi:0x5a4000,ei:.2},{f:'Knight',n:'Round_Shield',keep:()=>true,s:[.42,.3,.42],p:[0,.06,0]},
    {f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.08,.12,.08],p:[0,.3,0],col:0xffe9a0,emi:0xffc040,ei:1.2,spin:1}],
  [{f:'Knight',n:'Badge_Shield',keep:()=>true,s:[.66,.56,.66],emi:0x6a4a00,ei:.28,glow:0xffe070},{f:'Knight',n:'Round_Shield',keep:()=>true,s:[.46,.34,.46],p:[0,.07,0],emi:0x5a3a00,ei:.28},
    {f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.1,.15,.1],p:[0,.38,0],col:0xfff4c0,emi:0xffd050,ei:1.5,spin:1},
    {f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.06,.09,.06],p:[.06,.3,.17],col:0xfff4c0,emi:0xffd050,ei:1.5,spin:1},{f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.06,.09,.06],p:[.06,.3,-.17],col:0xfff4c0,emi:0xffd050,ei:1.5,spin:1}]];
SP_FX.paladijn='holy';
SP_ITEMS.paladijn=['Initiate\'s Spaulders','Crusader\'s Pauldrons','Lightforged Pauldrons','Pauldrons of the Dawn'];
SP_LEG.paladijn={mods:{dr:.04,heal:.08},leg:'Legendary: you take 4% less damage and your heals restore 8% more. Three motes of dawn circle your shoulders.'};
CLOAK_CLS.paladijn=[4,3];CK_LEG_COL.paladijn=[0xf0ead8,0xffd050];CK_FX.paladijn='holy';
CK_LEG.paladijn={n:'Mantle of the Dawn',mods:{heal:.06},leg:'Legendary: your heals restore 6% more. Light trails behind you.'};
const CK_PAL_C={paladijn:[0xe8e2cc,0x3456a8,0xd8b860,0xf4f4f4,0x2c3a7a,0xc8d0e0]};
