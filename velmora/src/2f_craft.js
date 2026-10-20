/* ===================== Artisans' Yard, crafting stations and gathering nodes (downloaded models) =====================
   Kenney Survival / Food / Nature / Furniture kits, Quaternius Medieval Village / RPG Items / Cute Fish packs and
   KayKit RPG Tools Bits (all CC0). Sizes are given in metres; fit() scales each model to that size. */
async function buildCraftEnv(){if(window.__NOGLTF)return;const R=mulberry(7311);const jobs=[];needToolClips();
  /* model op maat: s = gewenste grootste afmeting (of hoogte met h:true) in meter */
  const put=(n,x,z,ry,s,o={})=>jobs.push(envPlace(n,x,z,ry,sz=>{const k=s/(o.h?sz[1]:Math.max(sz[0],sz[1],sz[2]));return[k,k,k]},o.par||scene,o.y||0).then(m=>{if(m&&o.tint)tintObj(m,new THREE.Color(o.tint));if(m&&o.noSh)noShadow(m);if(m&&o.col)addCol(x,z,o.col);return m}));
  const C=CRAFT,S=k=>STATIONS.find(s=>s.k===k&&Math.hypot(s.x-C.x,s.z-C.z)<C.r);
  /* ---------- het erf: kinderkopjes, hekken en lantaarns ---------- */
  for(let a=0;a<6.28;a+=.21){const r=C.r+2;if(Math.abs(angDiff(a,Math.atan2(14-C.z,-96-C.x)))<.5)continue;/* opening naar de weg */
    put('Fence',C.x+Math.cos(a)*r,C.z+Math.sin(a)*r,-a+Math.PI/2,3.4,{h:false})}
  for(const[dx,dz]of[[-4,9],[5,9],[-13,-2],[13,-1]]){put('KN_stump_roundDetailed',C.x+dx,C.z+dz,R()*6,.9,{noSh:1});put('KT_lantern',C.x+dx,C.z+dz,R()*6,.75,{y:.55})}
  /* ---------- smidse ---------- */
  {const s=S('forge');const bx=s.x,bz=s.z;put('Blacksmith',bx-3,bz-6,Math.PI*.15,9.5,{col:4});
    put('KS_workbench-anvil',bx,bz,.3,1.5,{col:.9});put('KT_anvil',bx+2.2,bz+.8,-.4,1.3,{col:.7});put('KS_campfire-pit',bx-2.4,bz+1.2,0,1.4,{col:.7});
    put('KT_grindstone',bx+3.4,bz-2.2,.9,1.4,{col:.8});put('KT_bucket_metal',bx+1.2,bz+2.4,0,.55);put('Q_Chest_Ingots',bx-1.6,bz-2.4,.5,1.1,{col:.6});put('KS_barrel',bx+3.6,bz+1.6,0,1.1,{col:.5});
    put('KT_tongs',bx+.2,bz+.55,1.2,.6,{y:1.5});put('KT_hammer',bx-.3,bz-.3,.3,.45,{y:1.5});
    const f=new THREE.Group();f.position.set(bx-2.4,groundH(bx-2.4,bz+1.2)+.3,bz+1.2);scene.add(f);addFlame(f,0,.15,0,1.8,0xff7a20);addFlame(f,.15,.1,.1,1.2,0xffb030);addLight(bx-2.4,f.position.y+1,bz+1.2,0xff7a30,30,14)}
  /* ---------- looierij ---------- */
  {const s=S('tannery');const bx=s.x,bz=s.z;for(const[dx,dz,ry]of[[-1.8,-1.6,.2],[1.6,-2,-.3]])put('KS_structure-canvas',bx+dx,bz+dz,ry,2.4,{col:.9});
    put('KS_workbench',bx+.4,bz+1,-.2,1.5,{col:.9});put('KT_knife',bx+.3,bz+1.1,1.4,.35,{y:1.48});put('Q_Bags',bx+2.6,bz+1.4,.6,1.2,{tint:'#b07444'});put('Q_Bag',bx-2.2,bz+1.2,.2,.9,{tint:'#9a7450'});put('KS_box',bx+2.8,bz-.4,.4,.9,{col:.5});put('KS_bucket',bx-1.2,bz+2.4,0,.6)}
  /* ---------- kleermakerij ---------- */
  {const s=S('loom');const bx=s.x,bz=s.z;put('KU_rugRectangle',bx,bz,.3,3.4,{noSh:1,y:.02});put('KU_table',bx,bz,.3+Math.PI/2,2.2,{col:1});
    put('KU_coatRackStanding',bx+2,bz-1.5,0,1.9,{col:.4});put('Q_Bag',bx+.1,bz-.3,.3,.7,{y:.86,tint:'#f0e6cc'});put('Q_Bag',bx-.3,bz+.4,1.1,.6,{y:.86,tint:'#e8e4ff'});put('KT_scissors',bx+.4,bz+.5,1.2,.32,{y:.9});
    put('Q_Bags',bx-1.8,bz+1.6,.4,1,{tint:'#d8c8f0'});put('Q_Parchment',bx+1.4,bz+1.4,.8,.7,{y:.1});put('KS_box',bx-2,bz-1.4,.2,.8)}
  /* ---------- zagerij ---------- */
  {const s=S('sawmill');const bx=s.x,bz=s.z;put('Q_Sawmill',bx-1,bz,Math.PI*.5,6.5,{col:2.6});put('KN_log_large',bx+3,bz+2.2,.4,2.6,{col:.6});put('KN_log_large',bx+3.4,bz+3.1,.5,2.4);
    put('KS_resource-planks',bx+3.2,bz-2,.2,1.6,{col:.5});put('KS_resource-wood',bx+1.4,bz+3.6,1.2,1.4)}
  /* ---------- kookvuur op het erf ---------- */
  {const s=STATIONS.find(s=>s.k==='fire'&&Math.hypot(s.x-C.x,s.z-C.z)<C.r);put('KS_campfire-stand',s.x,s.z,.2,1.9,{col:.8});put('KF_pot-stew',s.x,s.z,.2,.75,{y:.62});
    put('KN_log_large',s.x+1.8,s.z+.6,1.3,1.6);put('KN_log_large',s.x-1.7,s.z+.8,-1.2,1.6);const f=new THREE.Group();f.position.set(s.x,groundH(s.x,s.z)+.15,s.z);scene.add(f);addFlame(f,0,.2,0,1.4,0xff7a20);addLight(s.x,f.position.y+1,s.z,0xff8a30,24,12)}
  /* ---------- bestaande kookvuren en de ketel van Mirla ---------- */
  for(const s of STATIONS){if(Math.hypot(s.x-C.x,s.z-C.z)<C.r)continue;
    if(s.k==='fire'&&s.x!==CAMP.x){put('KS_campfire-stand',s.x,s.z,.6,1.9);put('KF_pot-stew',s.x,s.z,.6,.75,{y:.62});put('KS_campfire-pit',s.x,s.z,0,1.3,{noSh:1})}
    if(s.k==='cauldron'){put('Q_Cauldron',s.x,s.z,.6,1.3);put('KU_sideTable',s.x+1.2,s.z-1,.6+Math.PI/2,1.3);put('KS_bottle',s.x+1.1,s.z-.9,0,.3,{y:.86,tint:'#ff7a6a'});put('KS_bottle-large',s.x+1.35,s.z-1.25,0,.32,{y:.86,tint:'#7aa8ff'});
      put('KF_mortar-pestle',s.x+.9,s.z-1.3,0,.3,{y:.86});put('Q_Book1_Open',s.x+1.6,s.z-.7,.4,.5,{y:.88});
      const f=new THREE.Group();f.position.set(s.x,groundH(s.x,s.z)+.1,s.z);scene.add(f);addFlame(f,0,0,0,1,0x7aff6a)}}

  await Promise.all(jobs);hideProc('station');
  /* ---------- verzamelpunten ---------- */
  const NM={hout:it=>it==='Ashwood'?['KN_log_large',3.6,'#5a4c48']:['KN_log_large',3.6,null],
    erts:()=>[R()<.5?'KN_rock_largeA':'KN_rock_largeB',2.6,'#9a948a'],kruid:it=>({Sunleaf:['KN_flower_yellowA',.95,'#ffe866'],Moonbloom:['KN_flower_purpleA',.95,'#8ab8ff'],Bloodroot:['KN_flower_redA',1,'#ff5a5a'],Flax:['KN_plant_flatTall',1.1,'#d0f0a0'],Fireblossom:['KN_flower_redB',1,'#ffa040']}[it])};
  await Promise.all(NODES.map(async n=>{const spec=NM[n.type](n.item);if(!spec)return;const[mn,size,tint]=spec;const g=await loadEnv(mn);if(!g)return;
    const keep=[...n.g.children];const add=(name,s,t,x=0,y=0,z=0,ry=0)=>loadEnv(name).then(gg=>{if(!gg)return;const o=envClone(gg);const sz=o.userData.size;const k=s/Math.max(...sz);o.scale.setScalar(k);o.position.set(x,y,z);o.rotation.y=ry;if(t)tintObj(o,new THREE.Color(t));o.traverse(m=>{if(m.isMesh)m.userData.ent=n});n.g.add(o)});
    await add(mn,size,tint);
    if(n.type==='erts'){const OC={'Iron Ore':[0xb8642c,0x5a524c],'Silver Ore':[0xe2ecf6,0x6a6e76],'Emberstone':[0xff6a20,0x4a3a36]}[n.item]||[0xb8642c,0x5a524c];const k0=n.g.children.length;for(let i=0;i<3;i++)await add('Q_Mineral',.9+R()*.4,null,Math.cos(i*2.1)*.6,.35+R()*.25,Math.sin(i*2.1)*.5,R()*6);
      for(const o of n.g.children.slice(k0))o.traverse(m=>{if(!m.isMesh)return;m.material=m.material.clone();const c=m.material.color;const crystal=c.r>c.g*2;m.material.vertexColors=false;m.material.color.setHex(crystal?OC[0]:OC[1])});
      if(n.item==='Emberstone')n.g.traverse(m=>{if(m.isMesh&&m.material.color&&m.material.color.r>.8&&m.material.color.g<.6){m.material=m.material.clone();m.material.emissive=new THREE.Color(0xff4a10);m.material.emissiveIntensity=.6}})}
    if(n.type==='hout')await add('KN_stump_roundDetailed',.9,n.item==='Ashwood'?'#5a4c48':null,1.9,0,.2,R()*6);
    if(n.type==='kruid'){for(let i=0;i<2;i++)await add(mn,size*(.6+R()*.3),tint,Math.cos(i*3+1)*.35,0,Math.sin(i*3+1)*.35,R()*6);if(n.item==='Fireblossom')addFlame(n.g,0,.9,0,.5,0xff8a30)}
    for(const o of keep)o.visible=false}))}
