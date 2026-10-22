/* ===================== A living world: plants, wildlife and townsfolk =====================
   Everything here is ambient and local to each player (nothing goes over the network).
   Models (downloaded, see models/life/LICENSE.txt):
   - plants.glb: Quaternius' Stylized Nature MegaKit (CC0): ferns, grasses, flowers, clover, mushrooms, bushes
   - fox, cow, shiba, husky, rat, frog, fish: Quaternius (CC0); rabbit: Sherkiz (CC-BY 3.0)
   - critters.glb: sparrow, crow, gull, bluebird, butterflies, mallard: Poly by Google / Paul Spooner (CC-BY 3.0)
   - deer, stag, horses, donkey, alpaca: the mount models (Quaternius, CC0); townsfolk: the KayKit adventurers (CC0)
   Plants: generated per 10 m cell from the biome (meadow, forest, lake shore, Elvia), drawn instanced in a radius
   around the camera, swaying in the wind and growing out of the ground at the edge of that radius.
   Wildlife: rabbits, foxes, deer herds, wild horses, frogs, fish, ducks, rats in the dungeons, songbirds that peck
   around and fly off when you come close, gulls over the lake, butterflies over the flowers; cows, a donkey and
   alpacas on the pasture; dogs that follow their owners.
   Townsfolk: villagers and children in Silverbrook and WindStorm who walk between the stalls, wells, doors and the
   fountain (A* over a walk grid), shop, chat with each other, sit by the fountain, go in and out of houses and say
   something when you pass. Farmers work the fields; travellers walk the roads. */
const LW={init:false,ready:{},t:0,frame:0};
const _lwRaw=new Map();
function lwRaw(name){let p=_lwRaw.get(name);if(!p){p=new Promise(res=>gltfLoader().load(MODEL_BASE+'life/'+name+'.glb',g=>res(g),undefined,()=>res(null)));_lwRaw.set(name,p)}return p}
const lwQ=()=>GFX.q==='laag'?0:GFX.q==='middel'?1:2;
const lwR=()=>TD.on?46:[40,60,78][lwQ()]*(isTouch?.82:1);
/* geometry of a (sub)tree in its own space, positions/normals/uvs as floats, split per material */
function lwParts(root){const out=new Map();root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(o=>{if(!o.isMesh)return;const g=new THREE.BufferGeometry();const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    for(const k of['position','normal','uv','color']){const a=o.geometry.attributes[k];if(!a)continue;const n=Math.min(3,a.itemSize),f=new Float32Array(a.count*n);for(let i=0;i<a.count;i++){f[i*n]=a.getX(i);f[i*n+1]=a.getY(i);if(n>2)f[i*n+2]=a.getZ(i)}g.setAttribute(k,new THREE.BufferAttribute(f,n))}
    if(o.geometry.index)g.setIndex(o.geometry.index.clone());g.applyMatrix4(m);if(!g.attributes.normal)g.computeVertexNormals();
    const mats=Array.isArray(o.material)?o.material:[o.material];const mt=mats[0];let L=out.get(mt);if(!L)out.set(mt,L=[]);L.push(g)});
  const res=[];for(const[mt,L]of out){const allC=L.every(g=>g.attributes.color);if(!allC)for(const g of L)g.deleteAttribute('color');res.push({mat:mt,geo:L.length>1?BufferGeometryUtils.mergeGeometries(L.map(g=>g.index?g.toNonIndexed():g),false):L[0]})};return res}
/* wind sway and edge growth for the instanced plants */
const LW_U={uC:{value:new THREE.Vector3(0,0,60)}};
function lwWind(m,amp=.05,near=false){m.onBeforeCompile=sh=>{sh.uniforms.uT=WIND;sh.uniforms.uC=LW_U.uC;sh.vertexShader='uniform float uT;uniform vec3 uC;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 ipos=vec2(instanceMatrix[3].x,instanceMatrix[3].z);float pRR=${near?'uC.z*.52+4.':'uC.z'};transformed*=1.-smoothstep(pRR-7.,pRR,distance(ipos,uC.xy));
float wph=ipos.x*.35+ipos.y*.27;float wsw=(sin(uT*1.7+wph)+sin(uT*2.9+wph*1.7)*.5)*${amp.toFixed(3)}*max(position.y,0.);transformed.x+=wsw;transformed.z+=wsw*.4;
#endif`)};m.customProgramCacheKey=()=>'lwwind'+amp+near}
const _lwMats=new Map();
function lwToon(src,opts={}){const key=(src.map?src.map.uuid:src.uuid)+'|'+(opts.k||'');let m=_lwMats.get(key);if(m)return m;
  if(src.map){src.map.colorSpace=THREE.SRGBColorSpace;src.map.anisotropy=4;src.map.minFilter=THREE.LinearMipmapLinearFilter}
  m=new THREE.MeshToonMaterial({map:src.map||null,color:src.map?0xffffff:(src.color?src.color.clone():0xffffff),gradientMap:RAMP,alphaTest:src.map&&opts.cut!==false?.42:0,side:opts.side??THREE.DoubleSide,vertexColors:!!src.vertexColors&&opts.vc!==false});
  if(opts.tint)m.color.setRGB(...opts.tint);if(opts.wind!=null)lwWind(m,opts.wind,!!opts.near);_lwMats.set(key,m);return m}

/* ====================== plants ====================== */
const PL_DEF={GrassWispy_1:{h:[.55,.85],near:1},GrassWispy_2:{h:[.65,1]},Grass_1:{h:[.5,.75],near:1},Grass_2:{h:[.28,.42],near:1},TallGrass_1:{h:[.9,1.4]},
  FlowerGroup_1:{h:[.7,1]},FlowerGroup_2:{h:[.75,1.05]},FlowerSingle_1:{h:[.65,.9]},FlowerSingle_2:{h:[.65,.9]},Clover_1:{h:[.35,.5],near:1},Clover_2:{h:[.38,.55],near:1},
  Fern_1:{h:[.55,.9],sh:1},Plant_1:{h:[.4,.65]},Plant_2:{h:[.12,.2],near:1},PlantBig_1:{h:[.16,.26],near:1},PlantBig_2:{h:[1,1.5],sh:1},
  Mushroom_1:{h:[.2,.4],w:0,near:1},MushroomLaetiporus_1:{h:[.2,.32],w:0,near:1},Bush_1:{h:[.8,1.2],sh:1,w:.02},BushwithFlowers_1:{h:[.8,1.2],sh:1,w:.02}};
/* per biome: [plant, count per 10x10 m cell, tag]; 'fl' = flowers come in patches */
const PL_BIOME={
  meadow:[['GrassWispy_1',6],['GrassWispy_2',3],['Grass_1',3],['Grass_2',2],['TallGrass_1',.8],['FlowerGroup_1',1.2,'fl'],['FlowerGroup_2',1.2,'fl'],['FlowerSingle_1',1.4,'fl'],['FlowerSingle_2',1.4,'fl'],['Clover_1',.5],['Clover_2',.4],['Plant_1',.3],['Plant_2',.5],['BushwithFlowers_1',.1]],
  forest:[['Fern_1',2],['GrassWispy_1',1.2],['Clover_1',.7],['Clover_2',.5],['Mushroom_1',.7,'mu'],['MushroomLaetiporus_1',.15],['PlantBig_2',.2],['Plant_1',.35],['PlantBig_1',.35]],
  shore:[['TallGrass_1',2.2],['GrassWispy_2',1.4],['Plant_1',.6],['PlantBig_1',.5],['Clover_2',.4]],
  elvF:[['Fern_1',2.4],['Mushroom_1',.8,'mu'],['MushroomLaetiporus_1',.25],['PlantBig_2',.35],['Clover_1',.9],['GrassWispy_1',1.8],['FlowerSingle_1',.5,'fl'],['Bush_1',.05]],
  elvM:[['GrassWispy_1',4.5],['GrassWispy_2',2.5],['TallGrass_1',1.3],['FlowerGroup_1',1.4,'fl'],['FlowerGroup_2',1.4,'fl'],['FlowerSingle_1',1.4,'fl'],['FlowerSingle_2',1.4,'fl'],['Clover_1',.6],['BushwithFlowers_1',.18],['Plant_1',.45],['Bush_1',.05]]};
const PL={types:{},cells:new Map(),last:{x:1e9,z:1e9,R:0},acc:0};
/* which biome a spot is (or null: no plants there) */
function plBiome(x,z){
  if(x>700)return null;
  if(x<-2600){const u=x-ELV.x,v=z-ELV.z;if(Math.max(Math.abs(u),Math.abs(v))>426)return null;if(Math.hypot(x-WS.x,z-WS.z)<WS.R+12)return null;if(elvPathDist(x,z)<2.3)return null;
    for(const l of ELV_LAKES){const d=Math.hypot(x-l.x,z-l.z);if(d<l.r*1.02)return null;if(d<l.r*1.3&&groundH(x,z)<(l.wl??-1)+.12)return null;if(d<l.r*1.2)return'shore'}
    const[rd,wy,rw]=elvRiver(x,z);if(rd<rw+.9)return null;if(rd<rw+5){if(groundH(x,z)<wy+.12)return null;return'shore'}
    if(Math.hypot(x-ELV_EXIT.x,z-ELV_EXIT.z)<18||Math.hypot(x-ELV_CAMP.x,z-ELV_CAMP.z)<20||Math.hypot(x-HOLLOW.x,z-HOLLOW.z)<22)return null;
    return fbm(u*.01+3,v*.01+8)>.52?'elvF':'elvM'}
  if(x<-1000)return null;if(x<-252||x>252||z<-260||z>252)return null;
  const dl=Math.hypot(x-LAKE.x,z-LAKE.z);if(dl<LAKE.r*1.0)return null;if(dl<LAKE.r*1.3){if(groundH(x,z)<water.position.y+.12)return null;if(dl<LAKE.r*1.22)return pathDist(x,z)>2?'shore':null}
  if(!okSpot(x,z,2.4))return null;return inForest(x,z)?'forest':'meadow'}
/* not inside a tree trunk, rock or wall */
function plFree(x,z,r=.3){const cx=Math.floor(x/10),cz=Math.floor(z/10);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=CG.get((cx+a)+','+(cz+b));if(L)for(const c of L)if((x-c.x)**2+(z-c.z)**2<(c.r*.85+r)**2)return false}return true}
async function plInit(){const g=await lwRaw('plants');if(!g)return;const cap=[2500,4500,7000][lwQ()];
  for(const key in PL_DEF){const node=g.scene.getObjectByName(key);if(!node)continue;const parts=lwParts(node);if(!parts.length)continue;
    const box=new THREE.Box3();for(const p of parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    const d=PL_DEF[key],ims=[];for(const p of parts){p.geo.translate(-cx,-box.min.y,-cz);const vc=!!p.geo.attributes.color;const gr=/Grass/i.test(p.mat.name);const mat=lwToon(p.mat,{wind:d.w??.05,k:'pl'+(d.w??.05)+vc+gr+!!d.near,vc,near:!!d.near,tint:gr?[.78,1,.62]:null});
      const big=/Grass|Clover/.test(key);const im=new THREE.InstancedMesh(p.geo,mat,big?cap:Math.round(cap*.45));im.count=0;im.frustumCulled=false;im.castShadow=!!d.sh;im.receiveShadow=true;im.matrixAutoUpdate=false;scene.add(im);ims.push(im)}
    PL.types[key]={h:box.max.y-box.min.y,ims,n:0,near:!!d.near}}
  LW.ready.pl=1}
const _plM=new THREE.Matrix4(),_plQ=new THREE.Quaternion(),_plE=new THREE.Euler(),_plS=new THREE.Vector3(),_plP=new THREE.Vector3();
function plCell(cx,cz){const k=cx+','+cz;let c=PL.cells.get(k);if(c)return c;c={};PL.cells.set(k,c);
  const R=mulberry(strHash('pl'+k)),x0=cx*10,z0=cz*10;const bs=new Set();for(const[u,v]of[[5,5],[.5,.5],[9.5,.5],[.5,9.5],[9.5,9.5]]){const b=plBiome(x0+u,z0+v);if(b)bs.add(b)}
  const dens=[.5,.8,1][lwQ()];const L={};
  for(const b of bs)for(const[key,cnt,tag]of PL_BIOME[b]){const T=PL.types[key];if(!T)continue;let n=cnt*dens*(tag==='fl'?2.2:1);n=Math.floor(n)+(R()<n%1?1:0);
    for(let i=0;i<n;i++){const x=x0+R()*10,z=z0+R()*10;if(tag==='fl'&&fbm(x*.045+11,z*.045-7)<.5&&R()>.15)continue;if(tag==='mu'&&R()<.3)continue;
      if(plBiome(x,z)!==b||!plFree(x,z))continue;const d=PL_DEF[key];const h=d.h[0]+R()*(d.h[1]-d.h[0]),s=h/T.h;
      _plE.set((R()-.5)*.12,R()*6.283,(R()-.5)*.12);_plQ.setFromEuler(_plE);_plS.set(s*(.9+R()*.2),s,s*(.9+R()*.2));_plP.set(x,groundH(x,z)-.03,z);_plM.compose(_plP,_plQ,_plS);(L[key]||(L[key]=[])).push(..._plM.elements)}}
  for(const key in L)c[key]=new Float32Array(L[key]);return c}
function plUpdate(dt){if(!LW.ready.pl)return;const R=lwR(),cx=camTarget.x,cz=camTarget.z;LW_U.uC.value.set(cx,cz,R);PL.acc-=dt;
  if(PL.acc>0&&Math.hypot(cx-PL.last.x,cz-PL.last.z)<5&&R===PL.last.R)return;PL.acc=.6;PL.last={x:cx,z:cz,R};
  for(const k in PL.types)PL.types[k].n=0;const t0=performance.now();
  const i0=Math.floor((cx-R)/10),i1=Math.floor((cx+R)/10),j0=Math.floor((cz-R)/10),j1=Math.floor((cz+R)/10);const RN=R*.52+6;const list=[];
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const cd=Math.hypot(i*10+5-cx,j*10+5-cz);if(cd<=R+8)list.push([cd,i,j])}list.sort((a,b)=>a[0]-b[0]);
  /* new cells are generated nearest first, a few milliseconds per frame, so walking into new land never stutters */
  for(const[cd,i,j]of list){let c=PL.cells.get(i+','+j);if(!c){if(performance.now()-t0>3){PL.acc=0;PL.last.R=-1;continue}c=plCell(i,j)}const far=cd>RN;
    for(const k in c){const T=PL.types[k];if(far&&T.near)continue;const a=c[k],cnt=a.length/16;for(const im of T.ims){const room=im.instanceMatrix.count-T.n;if(room<=0)continue;im.instanceMatrix.array.set(cnt<=room?a:a.subarray(0,room*16),T.n*16)}T.n=Math.min(T.ims[0].instanceMatrix.count,T.n+cnt)}}
  for(const k in PL.types){const T=PL.types[k];for(const im of T.ims){im.count=T.n;im.instanceMatrix.needsUpdate=true}}}

/* ====================== animated wildlife ====================== */
const CR_T={
  fox:{f:'life/fox',h:.62,sp:[1.3,7.5],shy:12,c:{idle:['Idle','Idle_2'],sniff:['Idle_2_HeadLow','Eating'],walk:'Walk',run:'Gallop'}},
  rabbit:{f:'life/rabbit',h:.36,sp:[.8,4.5],shy:7,c:{idle:['Bunny_idle'],sniff:['Bunny_idle'],walk:'Bunny_walk',run:'Bunny_walk'},runTs:2.6,walkTs:1.2},
  deer:{f:'mount/M_Deer',h:1.55,sp:[1.2,9],shy:17,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow','Idle_2_HeadLow'],walk:'Walk',run:'Gallop'}},
  stag:{f:'mount/M_Stag',h:1.95,sp:[1.2,9],shy:17,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow','Idle_2_HeadLow'],walk:'Walk',run:'Gallop'}},
  horse:{f:'mount/M_Horse_White',h:1.8,sp:[1.3,10],shy:15,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow'],walk:'Walk',run:'Gallop'}},
  bhorse:{f:'mount/M_Horse_A',h:1.8,sp:[1.3,10],shy:15,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow'],walk:'Walk',run:'Gallop'}},
  cow:{f:'life/cow',h:1.45,sp:[.8,3.5],shy:0,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow'],walk:'Walk',run:'Gallop'}},
  donkey:{f:'mount/M_Donkey',h:1.45,sp:[.9,4],shy:0,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow'],walk:'Walk',run:'Gallop'}},
  alpaca:{f:'mount/M_Alpaca',h:1.6,sp:[.9,4],shy:0,c:{idle:['Idle','Idle_2'],sniff:['Eating','Idle_Headlow'],walk:'Walk',run:'Gallop'}},
  shiba:{f:'life/shiba',h:.55,sp:[1.4,6.5],shy:0,dog:1,c:{idle:['Idle','Idle_2'],sniff:['Idle_2_HeadLow','Eating'],walk:'Walk',run:'Gallop'}},
  husky:{f:'life/husky',h:.7,sp:[1.4,6.5],shy:0,dog:1,c:{idle:['Idle','Idle_2'],sniff:['Idle_2_HeadLow','Eating'],walk:'Walk',run:'Gallop'}},
  rat:{f:'life/rat',h:.12,sp:[.9,4.2],shy:5,c:{idle:['Rat_Idle'],sniff:['Rat_Idle'],walk:'Rat_Walk',run:'Rat_Run'}},
  frog:{f:'life/frog',h:.12,sp:[0,0],shy:3.5,frog:1,c:{idle:['Frog_Idle'],sniff:['Frog_Idle'],jump:'Frog_Jump'}},
  fish:{f:'life/fish',h:.16,sp:[.9,3],shy:0,fish:1,c:{idle:['Swim'],sniff:['Swim'],walk:'Swim',run:'Swim'}}};
const CR=[];
function crClip(c,want){const L=Array.isArray(want)?want:[want];for(const n of L){if(c.clips[n])return n}return null}
function crPlay(c,name,ts=1,fade=.25){if(!name)return;if(c.cur===name){const a=c.acts[name];if(a)a.timeScale=ts;return}let a=c.acts[name];if(!a){const cl=c.clips[name];if(!cl)return;a=c.acts[name]=c.mixer.clipAction(cl)}
  const prev=c.cur&&c.acts[c.cur];a.enabled=true;a.setEffectiveWeight(1);a.timeScale=ts;a.reset();if(prev){prev.crossFadeTo(a,fade,false)}a.play();c.cur=name}
function crOnce(c,name,ts=1){const cl=c.clips[name];if(!cl)return 0;let a=c.acts['1'+name];if(!a){a=c.acts['1'+name]=c.mixer.clipAction(cl);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=false}
  const prev=c.cur&&c.acts[c.cur];if(prev)prev.fadeOut(.1);a.reset().setEffectiveWeight(1).fadeIn(.08);a.timeScale=ts;a.play();c.cur='1'+name;return cl.duration/ts}
async function crSpawn(type,x,z,o={}){const T=CR_T[type];const src=await loadGltf(T.f);if(!src)return null;
  const g=new THREE.Group();const m=SkeletonUtils.clone(src.scene);const s=T.h*(o.size||1)/src.userData.h;m.scale.setScalar(s);m.position.y=-src.userData.y0*s;m.traverse(x=>{if(x.isMesh){x.castShadow=!T.fish&&T.h>.3;x.frustumCulled=false}});
  if(o.tint){const done=new Map();m.traverse(x=>{if(!x.isMesh||!x.material||o.tint[x.material.name]==null)return;let nm=done.get(x.material);if(!nm){nm=x.material.clone();nm.color.set(o.tint[x.material.name]);done.set(x.material,nm)}x.material=nm})}
  g.add(m);const c={type,T,g,m,mixer:new THREE.AnimationMixer(m),clips:src.clips,acts:{},cur:null,x,z,y:0,ry:o.ry??Math.random()*6.28,st:'idle',tm:Math.random()*3,home:{x,z},hr:o.hr||12,
    sp:0,tgt:null,adt:0,lod:Math.floor(Math.random()*3),fixed:!!o.fixed,herd:o.herd||null,follow:o.follow||null,area:o.area||null,water:o.water||null,depth:o.depth||0,jump:0,dead:false};
  c.y=T.fish?c.water.y-c.depth:groundH(x,z);g.position.set(x,c.y,z);g.rotation.y=c.ry;scene.add(g);crPlay(c,crClip(c,T.c.idle));CR.push(c);return c}
function crRemove(c){c.dead=true;scene.remove(c.g);c.mixer.stopAllAction();const i=CR.indexOf(c);if(i>=0)CR.splice(i,1)}
/* a random spot near (x,z) that passes the test */
function lwSpot(x,z,r0,r1,ok,tries=14){for(let i=0;i<tries;i++){const a=Math.random()*6.283,r=r0+Math.random()*(r1-r0);const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(ok(px,pz))return[px,pz]}return null}
const crLand=(x,z)=>{const b=plBiome(x,z);return b==='meadow'||b==='elvM'||b==='forest'||b==='elvF'};
function crMove(c,dt,tx,tz,sp){const dx=tx-c.x,dz=tz-c.z,d=Math.hypot(dx,dz);if(d<.05)return d;const k=Math.min(d,sp*dt)/d;const p={x:c.x+dx*k,z:c.z+dz*k};
  if(!c.T.fish){collide(p,c.T.h*.35+.15);if(c.area&&Math.hypot(p.x-c.area.x,p.z-c.area.z)>c.area.r){const a=Math.atan2(p.z-c.area.z,p.x-c.area.x);p.x=c.area.x+Math.cos(a)*c.area.r;p.z=c.area.z+Math.sin(a)*c.area.r}}
  const moved=Math.hypot(p.x-c.x,p.z-c.z);c.x=p.x;c.z=p.z;c.ry+=angDiff(c.ry,Math.atan2(dx,dz))*clamp(dt*(sp>3?7:4),0,1);c.sp=moved/Math.max(dt,1e-4);return d}
function crThink(c){const T=c.T;const r=Math.random();
  if(c.follow){return}
  if(c.herd&&c.herd.lead&&c.herd.lead!==c&&!c.herd.lead.dead&&r<.6){const L=c.herd.lead;const s=lwSpot(L.x,L.z,1.5,5,(x,z)=>c.T.fish||plBiome(x,z)!=null||!!c.area);if(s){c.st='walk';c.tgt=s;c.tm=12;return}}
  if(r<.45){const ok=T.fish?(x,z)=>Math.hypot(x-c.water.x,z-c.water.z)<c.water.r:c.area?(x,z)=>Math.hypot(x-c.area.x,z-c.area.z)<c.area.r:T.dog||c.type==='rat'?()=>true:crLand;
    const s=lwSpot(c.home.x,c.home.z,2,c.hr,ok);if(s){c.st='walk';c.tgt=s;c.tm=14;return}}
  if(r<.75&&T.c.sniff){c.st='sniff';c.tm=3+Math.random()*5;crPlay(c,crClip(c,T.c.sniff));return}
  c.st='idle';c.tm=2+Math.random()*4;crPlay(c,crClip(c,T.c.idle))}
function crUpdate(c,dt){const T=c.T,px=ME.pos.x,pz=ME.pos.z,pd=Math.hypot(px-c.x,pz-c.z);
  /* scared: run (or hop) away from the player; a galloping mount scares them sooner */
  const shy=T.shy*(ME.mounted?1.5:1)*(ME.combat>0?1.3:1);if(shy&&pd<shy&&!ME.dead&&c.st!=='flee'){c.st='flee';c.tm=2.5+Math.random()*2;if(c.herd)for(const o of c.herd.m)if(o!==c&&!o.dead&&o.st!=='flee'){o.st='flee';o.tm=c.tm+Math.random()}}
  if(T.frog){c.jump-=dt;if(c.jump>0){const sp=c.st==='flee'?3.2:1.6;crMove(c,dt,c.x+Math.sin(c.ry)*2,c.z+Math.cos(c.ry)*2,sp);c.yo=Math.sin(Math.PI*clamp(1-c.jump/c.jd,0,1))*.25}
    else{c.yo=0;c.tm-=dt;if(c.st==='flee'||c.tm<=0){if(c.st==='flee'){c.ry=Math.atan2(c.x-px,c.z-pz)+(Math.random()-.5);if(pd>shy*1.6)c.st='idle'}else{c.ry+=(Math.random()-.5)*2;c.tm=2+Math.random()*6}
      if(c.st==='flee'||Math.random()<.6){c.jd=crOnce(c,'Frog_Jump',1.4)||.6;c.jump=c.jd}}else if(!c.cur||c.cur.startsWith('1'))crPlay(c,'Frog_Idle')}
    c.y=groundH(c.x,c.z)+(c.yo||0);return}
  if(c.follow){/* dogs: trot after their owner, sniff around when the owner stands still */const o=c.follow;if(o.dead||o.gone){c.st='idle'}else{const d=Math.hypot(o.x-c.x,o.z-c.z);
      if(d>2.6){c.st='walk';const sp=d>6?T.sp[1]:T.sp[0]*1.4;crMove(c,dt,o.x-Math.sin(o.ry)*1.2,o.z-Math.cos(o.ry)*1.2,sp)}else{c.sp=0;c.tm-=dt;if(c.tm<=0){c.tm=3+Math.random()*4;crPlay(c,crClip(c,Math.random()<.5?T.c.sniff:T.c.idle))}c.st='idle'}}}
  else if(c.st==='flee'){c.tm-=dt;const a=Math.atan2(c.x-px,c.z-pz)+Math.sin(LW.t*1.3+c.home.x)*.5;crMove(c,dt,c.x+Math.sin(a)*4,c.z+Math.cos(a)*4,T.sp[1]);if(c.tm<=0&&pd>shy*1.25){c.home={x:c.x,z:c.z};crThink(c)}}
  else if(c.st==='walk'){c.tm-=dt;const d=crMove(c,dt,c.tgt[0],c.tgt[1],T.sp[0]);if(d<.4||c.tm<=0||(c.sp<.05&&c.tm<12.5))crThink(c)}
  else{c.sp=0;c.tm-=dt;if(c.tm<=0)crThink(c)}
  /* animation from the speed */
  if(!T.frog){const run=c.sp>T.sp[0]*1.6;if(c.sp>.15)crPlay(c,run?T.c.run:T.c.walk,run?(T.runTs||clamp(c.sp/T.sp[1],.6,1.4)):(T.walkTs||clamp(c.sp/T.sp[0],.6,1.5)));else if(c.cur===T.c.walk||c.cur===T.c.run)crPlay(c,crClip(c,c.st==='sniff'?T.c.sniff:T.c.idle))}
  c.y=T.fish?c.water.y-c.depth+Math.sin(LW.t*1.7+c.home.x)*.06:groundH(c.x,c.z)}
/* ---- who lives where ---- */
const CR_POP=[
  {t:'rabbit',n:[2,3,5],test:crLand,day:1},{t:'fox',n:[1,1,2],test:(x,z)=>{const b=plBiome(x,z);return b==='forest'||b==='elvF'||b==='meadow'}},
  {t:'deer',n:[1,1,1],herd:[2,4],lead:'stag',test:(x,z)=>{const b=plBiome(x,z);return b==='meadow'||b==='elvM'},day:1},
  {t:'frog',n:[2,3,5],test:(x,z)=>plBiome(x,z)==='shore'},{t:'rat',n:[3,4,6],dun:1}];
const CR_HOMES=[/* fixed residents: they are there whenever you are close */
  {t:'cow',x:76,z:128,r:13,n:3},{t:'donkey',x:70,z:140,r:10,n:1},{t:'alpaca',x:84,z:118,r:10,n:2},
  {t:'horse',x:190,z:170,r:26,n:3,wild:1},{t:'bhorse',x:186,z:160,r:26,n:2,wild:1},
  {t:'fish',lake:'main',n:5},{t:'fish',lake:0,n:4},{t:'fish',lake:1,n:3},{t:'fish',lake:2,n:3}];
const _crHome=new Map();
function lakeOf(L){if(L==='main')return{x:LAKE.x,z:LAKE.z,r:LAKE.r*.72,y:water.position.y};const l=ELV_LAKES[L];return l?{x:l.x,z:l.z,r:l.r*.7,y:l.wl!=null?l.wl:-1}:null}
let _crSpawnT=0;
function crPopulate(dt){_crSpawnT-=dt;if(_crSpawnT>0)return;_crSpawnT=1.5;const px=camTarget.x,pz=camTarget.z,q=lwQ(),R=lwR();
  /* despawn the far ones */for(const c of [...CR])if(!c.follow&&Math.hypot(c.x-px,c.z-pz)>R+30)crRemove(c);
  /* fixed homes */CR_HOMES.forEach((h,i)=>{const w=h.lake!=null?lakeOf(h.lake):null;const hx=w?w.x:h.x,hz=w?w.z:h.z;const near=Math.hypot(hx-px,hz-pz)<R+12;const have=_crHome.get(i)||[];const alive=have.filter(c=>!c.dead);
    if(near&&!alive.length&&!_crHome.has('p'+i)){_crHome.set('p'+i,1);const list=[];const n=Math.max(1,Math.round(h.n*[.6,.8,1][q]));Promise.all(Array.from({length:n},(_,k)=>{const a=k/n*6.28+Math.random(),r=Math.random()*(w?w.r*.8:h.r*.7);
      return crSpawn(h.t,hx+Math.cos(a)*r,hz+Math.sin(a)*r,w?{water:w,depth:.45+Math.random()*.7,hr:w.r,size:.8+Math.random()*.5}:{area:h.wild?null:{x:h.x,z:h.z,r:h.r},hr:h.r,fixed:1,size:.92+Math.random()*.16})})).then(L=>{const ok=L.filter(Boolean);if(h.wild&&ok.length){const H={m:ok,lead:ok[0]};for(const c of ok){c.herd=H;c.home={x:h.x,z:h.z}}}_crHome.set(i,ok);_crHome.delete('p'+i)})}
    if(!near&&alive.length){for(const c of alive)crRemove(c);_crHome.set(i,[])}});
  /* the roaming ones */const inDun=px>700,inElv2=px<-2600,inOver=px>-260&&px<260;const day=DAY.night<.55;
  for(const P of CR_POP){if(P.dun?!(inDun&&(px<1250||px>2200)):!(inElv2||inOver))continue;if(P.day&&!day&&P.t==='rabbit'&&Math.random()<.5)continue;
    const have=CR.filter(c=>c.pop===P&&!c.dead).length+(P.pend|0);const want=P.n[q];if(have>=want)continue;
    const near=P.dun?6:TD.on?34:R*.55,far=P.dun?20:R*.9;
    const s=lwSpot(px,pz,near,far,P.dun?(x,z)=>{const p={x,z};collide(p,.2);return Math.hypot(p.x-x,p.z-z)<.01&&isFinite(groundH(x,z))}:P.test,10);if(!s)continue;
    if(P.herd){const n=P.herd[0]+Math.floor(Math.random()*(P.herd[1]-P.herd[0]+1));P.pend=(P.pend|0)+1;const H={m:[],lead:null};
      Promise.all(Array.from({length:n},(_,k)=>crSpawn(k===0&&P.lead?P.lead:P.t,s[0]+(Math.random()-.5)*6,s[1]+(Math.random()-.5)*6,{hr:16}))).then(L=>{P.pend--;for(const c of L)if(c){c.pop=P;c.herd=H;H.m.push(c)}H.lead=H.m[0]})}
    else{P.pend=(P.pend|0)+1;crSpawn(P.t,s[0],s[1],{hr:P.dun?7:14,size:.9+Math.random()*.25}).then(c=>{P.pend--;if(c)c.pop=P})}}}
function crTick(dt){crPopulate(dt);const R=lwR(),cx=camTarget.x,cz=camTarget.z;
  for(const c of CR){const d=Math.hypot(c.x-cx,c.z-cz);const vis=d<R+6;c.g.visible=vis;
    if(d>R+20&&!c.follow)continue;crUpdate(c,dt);c.g.position.set(c.x,c.y,c.z);c.g.rotation.y=c.ry;
    c.adt+=dt;if(vis&&(d<22||(LW.frame+c.lod)%(d<45?2:3)===0)){c.mixer.update(c.adt);c.adt=0}}}

/* ====================== birds, butterflies and ducks (static models, moved and flapped here) ====================== */
const BD={ok:false,kinds:{},list:[],acc:0};
/* wing beat in the vertex shader: vertices away from the body (|x|) rotate up and down around the body axis */
function bdFlapMat(src,opts){const m=lwToon(src,{k:'flap'+opts.k+opts.vc,cut:!!opts.cut,side:THREE.DoubleSide,vc:opts.vc});const n=m.clone();n.onBeforeCompile=sh=>{sh.uniforms.uT=WIND;sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 wp0=vec3(instanceMatrix[3].x,instanceMatrix[3].y,instanceMatrix[3].z);
#else
vec3 wp0=vec3(modelMatrix[3].x,modelMatrix[3].y,modelMatrix[3].z);
#endif
float bfl=sin(uT*${opts.f.toFixed(2)}+wp0.x*1.7+wp0.z*1.3)*${opts.a.toFixed(2)}+${opts.o.toFixed(2)};float bax=abs(transformed.x);float bwk=smoothstep(${opts.b.toFixed(3)},${(opts.b*3).toFixed(3)},bax);float ban=bfl*bwk;
transformed.y+=bax*sin(ban);transformed.x*=mix(1.,cos(ban),bwk);`)};n.customProgramCacheKey=()=>'flap'+opts.k;return n}
async function bdInit(){const g=await lwRaw('critters');if(!g)return;
  /* each model to: forward +z, up +y, feet (or belly) at y=0, a set length */
  const prep=(name,ry,len,flap)=>{const node=g.scene.getObjectByName(name);if(!node)return null;const parts=lwParts(node);const box=new THREE.Box3();for(const p of parts){p.geo.rotateY(ry);p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}
    const sz=box.getSize(new THREE.Vector3());const s=len/Math.max(sz.x,sz.z);const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    for(const p of parts){p.geo.translate(-cx,-box.min.y,-cz);p.geo.scale(s,s,s)}return{parts:parts.map(p=>({geo:p.geo,mat:flap?bdFlapMat(p.mat,{...flap,vc:!!p.geo.attributes.color}):lwToon(p.mat,{k:'bd'+!!p.geo.attributes.color,cut:false,side:THREE.FrontSide,vc:!!p.geo.attributes.color})})),h:sz.y*s}};
  BD.kinds={sparrow:prep('sparrow',0,.36),bluebird:prep('bluebird',0,.34),crow:prep('crow',0,.62),mallard:prep('mallard',0,.7),
    gull:prep('gull',-Math.PI/2,.95,{k:'gull',f:7,a:.55,o:.1,b:.06}),butterfly:prep('butterfly',Math.PI,.22,{k:'bf',f:24,a:.9,o:.15,b:.012,cut:1}),bfblue:prep('butterfly_blue',Math.PI,.2,{k:'bfb',f:26,a:.9,o:.1,b:.01})};
  /* butterflies are instanced (many); the others are plain meshes */
  for(const k of['butterfly','bfblue']){const K=BD.kinds[k];if(!K)continue;K.ims=K.parts.map(p=>{const im=new THREE.InstancedMesh(p.geo,p.mat,60);im.count=0;im.frustumCulled=false;im.castShadow=false;scene.add(im);return im})}
  BD.ok=true}
function bdMesh(kind,tint){const K=BD.kinds[kind];const g=new THREE.Group();for(const p of K.parts){let mat=p.mat;if(tint){const o=mat;mat=o.clone();mat.onBeforeCompile=o.onBeforeCompile;mat.customProgramCacheKey=o.customProgramCacheKey;mat.color=new THREE.Color(tint)}const m=new THREE.Mesh(p.geo,mat);m.castShadow=kind!=='butterfly';g.add(m)}scene.add(g);return g}
const BF=[];/* butterflies: {x,y,z,ax,az,ph,k} */
function bdPopulate(){const px=camTarget.x,pz=camTarget.z,q=lwQ(),R=lwR(),day=DAY.night<.5;const inW=(px<260&&px>-260)||px<-2600;
  for(let i=BD.list.length-1;i>=0;i--){const b=BD.list[i];if(Math.hypot(b.x-px,b.z-pz)>R+40||b.gone){scene.remove(b.g);BD.list.splice(i,1)}}
  for(let i=BF.length-1;i>=0;i--){const b=BF[i];if(Math.hypot(b.ax-px,b.az-pz)>R+10||!day)BF.splice(i,1)}
  if(!inW)return;
  /* songbird flocks on the ground (by day) */const flocks=new Set(BD.list.filter(b=>b.flock).map(b=>b.flock));
  if(day&&flocks.size<[1,2,3][q]){const s=lwSpot(px,pz,TD.on?22:24,R*.8,(x,z)=>{const b=plBiome(x,z);return b==='meadow'||b==='elvM'||(Math.hypot(x,z)<TOWN.wall-6&&Math.hypot(x,z)>14)});
    if(s){const kind=Math.random()<.3?'crow':Math.random()<.5?'bluebird':'sparrow';const F={id:Math.random()};const n=kind==='crow'?2+Math.floor(Math.random()*3):3+Math.floor(Math.random()*4);
      for(let k=0;k<n;k++){const x=s[0]+(Math.random()-.5)*5,z=s[1]+(Math.random()-.5)*5;BD.list.push({k:kind,g:bdMesh(kind),x,z,y:groundH(x,z),ry:Math.random()*6.28,st:'peck',tm:Math.random()*2,flock:F,vy:0,vx:0,vz:0,hop:0})}}}
  /* gulls over the lakes, crows over the crypt, a flock passing over the fields */const fl=BD.list.filter(b=>b.fly).length;
  if(fl<[2,4,6][q]){const spots=[];const L0=Math.hypot(LAKE.x-px,LAKE.z-pz)<R+30;if(L0)spots.push({x:LAKE.x,z:LAKE.z,r:LAKE.r*.7,h:14,k:'gull'});
    for(const l of ELV_LAKES)if(Math.hypot(l.x-px,l.z-pz)<R+30)spots.push({x:l.x,z:l.z,r:l.r*.7,h:16,k:'gull'});
    if(Math.hypot(CRYPT.x-px,CRYPT.z-pz)<R+30)spots.push({x:CRYPT.x,z:CRYPT.z+10,r:20,h:18,k:'gull',tint:0x2a2a30});
    if(!spots.length&&day)spots.push({x:px+(Math.random()-.5)*60,z:pz+(Math.random()-.5)*60,r:40+Math.random()*30,h:22+Math.random()*10,k:'gull',tint:Math.random()<.5?0x6a5a48:null});
    const S=spots[Math.floor(Math.random()*spots.length)];if(S){const ph=Math.random()*6.28;BD.list.push({k:S.k,g:bdMesh(S.k,S.tint),fly:S,ph,dir:Math.random()<.5?1:-1,sp:.12+Math.random()*.08,x:S.x,z:S.z,y:S.h})}}
  /* ducks on the lakes */const du=BD.list.filter(b=>b.k==='mallard').length;
  if(du<[2,3,5][q]){const lakes=[{x:LAKE.x,z:LAKE.z,r:LAKE.r*.8,y:water.position.y},...ELV_LAKES.map((l,i)=>lakeOf(i))].filter(l=>l&&Math.hypot(l.x-px,l.z-pz)<R+20);const L=lakes[0];
    if(L){const a=Math.random()*6.28,r=Math.random()*L.r;const x=L.x+Math.cos(a)*r,z=L.z+Math.sin(a)*r;BD.list.push({k:'mallard',g:bdMesh('mallard'),duck:L,x,z,y:L.y,ry:Math.random()*6.28,tx:x,tz:z,tm:0})}}
  /* butterflies over meadows with flowers */if(day){const want=[10,20,34][q];let tries=0;while(BF.length<want&&tries++<40){const s=lwSpot(px,pz,4,R*.7,(x,z)=>{const b=plBiome(x,z);return(b==='meadow'||b==='elvM')&&fbm(x*.045+11,z*.045-7)>.45});
    if(!s)break;BF.push({ax:s[0],az:s[1],ph:Math.random()*100,k:Math.random()<.55?'butterfly':'bfblue',r:1.5+Math.random()*3,sp:.4+Math.random()*.5,h:.6+Math.random()*1.1})}}}
const _bfM=new THREE.Matrix4(),_bfQ=new THREE.Quaternion(),_bfE=new THREE.Euler(),_bfS=new THREE.Vector3(1,1,1),_bfP=new THREE.Vector3();
function bdTick(dt){if(!BD.ok)return;BD.acc-=dt;if(BD.acc<=0){BD.acc=1.2;bdPopulate()}const px=ME.pos.x,pz=ME.pos.z,t=LW.t;
  for(const b of BD.list){
    if(b.fly){/* circling (gulls, crows) */const S=b.fly;b.ph+=dt*b.sp*b.dir;const x=S.x+Math.cos(b.ph)*S.r,z=S.z+Math.sin(b.ph)*S.r*.8;const ry=Math.atan2(x-b.x,z-b.z);b.x=x;b.z=z;b.y=S.h+Math.sin(b.ph*2.3)*1.5;
      b.g.position.set(x,groundH(x,z)*.0+b.y+(S.x>-260&&S.x<260?0:groundH(S.x,S.z)),z);b.g.rotation.set(0,ry,-b.dir*.35);continue}
    if(b.duck){/* ducks: paddle to a new spot now and then, bob on the water, swim away from the shore you stand on */const L=b.duck;b.tm-=dt;const pd=Math.hypot(px-b.x,pz-b.z);
      if(b.tm<=0||pd<6){b.tm=4+Math.random()*8;let a=Math.random()*6.28,r=Math.random()*L.r;if(pd<6){a=Math.atan2(b.z-pz,b.x-px);r=Math.min(L.r,Math.hypot(b.x-L.x,b.z-L.z)+4)}b.tx=L.x+Math.cos(a)*r;b.tz=L.z+Math.sin(a)*r;if(Math.hypot(b.tx-L.x,b.tz-L.z)>L.r){b.tx=L.x+(b.tx-L.x)*.8;b.tz=L.z+(b.tz-L.z)*.8}}
      const dx=b.tx-b.x,dz=b.tz-b.z,d=Math.hypot(dx,dz);if(d>.2){const sp=(pd<6?1.6:.5)*dt;b.x+=dx/d*Math.min(d,sp);b.z+=dz/d*Math.min(d,sp);b.ry+=angDiff(b.ry,Math.atan2(dx,dz))*clamp(dt*2,0,1)}
      b.g.position.set(b.x,L.y-.08+Math.sin(t*2+b.x)*.025,b.z);b.g.rotation.set(Math.sin(t*1.7+b.z)*.05,b.ry,Math.sin(t*1.3+b.x)*.06);continue}
    /* songbirds: hop, peck, look around; take off when you come close */const pd=Math.hypot(px-b.x,pz-b.z);
    if(b.st!=='off'&&(pd<(ME.mounted?11:7)||(b.flock.off))){b.st='off';b.flock.off=1;const a=Math.atan2(b.z-pz,b.x-px)+(Math.random()-.5)*1.2;b.vx=Math.cos(a)*(4+Math.random()*3);b.vz=Math.sin(a)*(4+Math.random()*3);b.vy=3+Math.random()*2;b.ry=Math.atan2(b.vx,b.vz);b.tm=0;if(Math.random()<.3&&typeof sfx==='function'&&pd<12)sfx('swing')}
    if(b.st==='off'){b.tm+=dt;b.vy+=dt*1.2;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;const f=Math.sin(t*40+b.x)*.5+.5;b.g.scale.set(1+f*.5,1-f*.2,1);b.g.rotation.set(-.4,b.ry,0);if(b.tm>3.5){b.gone=1}}
    else{b.y=groundH(b.x,b.z);b.tm-=dt;if(b.hop>0){b.hop-=dt;const k=1-b.hop/.25;b.x+=Math.sin(b.ry)*dt*1.4;b.z+=Math.cos(b.ry)*dt*1.4;b.y+=Math.sin(Math.PI*k)*.08}
      if(b.tm<=0){const r=Math.random();if(r<.35){b.hop=.25;b.ry+=(Math.random()-.5)*1.6}else if(r<.7)b.st='peck';else b.st='look';b.tm=.4+Math.random()*1.2}
      const peck=b.st==='peck'?Math.max(0,Math.sin(t*14+b.x*3))*.55:0;b.g.rotation.set(peck,b.ry+(b.st==='look'?Math.sin(t*3+b.z)*.6:0),0)}
    b.g.position.set(b.x,b.y,b.z)}
  /* butterflies */const L={butterfly:[],bfblue:[]};
  for(const b of BF){b.ph+=dt*b.sp;const x=b.ax+Math.sin(b.ph*1.3)*b.r+Math.sin(b.ph*3.1)*.4,z=b.az+Math.cos(b.ph*.9)*b.r+Math.cos(b.ph*2.7)*.4;const y=groundH(x,z)+b.h+Math.sin(b.ph*5.3)*.25;
    const ry=Math.atan2(x-(b.x??x),z-(b.z??z));b.x=x;b.z=z;_bfE.set(.25,isFinite(ry)?ry:0,0);_bfQ.setFromEuler(_bfE);_bfP.set(x,y,z);_bfM.compose(_bfP,_bfQ,_bfS);L[b.k].push(_bfM.clone())}
  for(const k in L){const K=BD.kinds[k];if(!K||!K.ims)continue;for(const im of K.ims){const n=Math.min(L[k].length,im.instanceMatrix.count);for(let i=0;i<n;i++)im.setMatrixAt(i,L[k][i]);im.count=n;im.instanceMatrix.needsUpdate=true}}}

/* ====================== townsfolk ====================== */
const VL={list:[],grids:{},bub:[],acc:0};
const VL_LOOK={models:[['Barbarian',['Barbarian_Hat'],'Mug'],['Barbarian',[],null],['Rogue',[],null],['Rogue',['Rogue_Cape'],null],['Rogue_Hooded',['Rogue_Cape'],null],['Mage',['Mage_Cape'],'Spellbook'],['Mage',[],null],['Knight',['Knight_Cape'],null],['Knight',[],null],['Barbarian',['Barbarian_Cape'],null]],
  skin:[0xf0d2b8,0xe2b48e,0xd9a98a,0xc89070,0x9a6a4a,0x6e4a32],hair:[0x2a1a10,0x5a3a20,0x8a5a2a,0xc79a4b,0xb5541c,0xd8d8e8,0x1d1d1d,0x6a2b1b]};
const VL_LINES={sb:['Morning, traveller!','Fresh bread at the market today.','Have you seen the boars near the farm? Nasty brutes.','The Light keep you.','Mind the crypt after dark.','Lovely weather for it.','My cousin swears he saw a dragon over the hills.','Don\'t let Bram overcharge you.','They say the forest wolves are getting bolder.','Ah, an adventurer! Good luck out there.','The well water is the best in the realm.','Busy day, busy day…'],
  ws:['Welcome to WindStorm, stranger.','The winds are restless today.','Have you been to Silverfall Lake? Beautiful.','The Hollow… we don\'t talk about the Hollow.','Elves trade fine silk at the market.','Watch your step on the bridges.','The harbour fish are biting today.'],
  kid:['Race you to the fountain!','Catch me if you can!','I\'m going to be a hero too!','Is that a real sword?!','Tag, you\'re it!'],farm:['These fields won\'t harvest themselves.','Shoo, crows! Shoo!','Good soil this year.','Mind the cows, they\'re curious.'],
  road:['Long road ahead.','Safe travels, friend.','The inn at Silverbrook does a fine stew.']};
/* walk grid of a town: free cells (not in walls, houses, stalls), A* between them, then straightened */
function vlGrid(id,cx,cz,R,cell){let G=VL.grids[id];if(G)return G;const N=Math.ceil(R*2/cell);const free=new Uint8Array(N*N);const x0=cx-R,z0=cz-R;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=x0+(i+.5)*cell,z=z0+(j+.5)*cell;if(Math.hypot(x-cx,z-cz)>R-2)continue;const p={x,z};collide(p,.55);if(Math.hypot(p.x-x,p.z-z)<.02)free[j*N+i]=1}
  G=VL.grids[id]={N,cell,x0,z0,free,cx,cz,R};return G}
function vlCell(G,x,z){const i=Math.floor((x-G.x0)/G.cell),j=Math.floor((z-G.z0)/G.cell);return(i<0||j<0||i>=G.N||j>=G.N)?-1:j*G.N+i}
function vlNear(G,x,z){let k=vlCell(G,x,z);if(k>=0&&G.free[k])return k;for(let r=1;r<8;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const kk=vlCell(G,x+di*G.cell,z+dj*G.cell);if(kk>=0&&G.free[kk])return kk}return-1}
function vlLos(G,a,b){const N=G.N;let x0=a%N,y0=(a/N)|0;const x1=b%N,y1=(b/N)|0;const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx-dy;
  for(;;){if(!G.free[y0*N+x0])return false;if(x0===x1&&y0===y1)return true;const e2=2*e;if(e2>-dy){e-=dy;x0+=sx}if(e2<dx){e+=dx;y0+=sy}}}
function vlPath(G,x,z,tx,tz){const s=vlNear(G,x,z),t=vlNear(G,tx,tz);if(s<0||t<0)return null;const N=G.N;const g=new Float32Array(N*N).fill(1e9),from=new Int32Array(N*N).fill(-1);
  const heap=[];const push=(k,f)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return top};
  const tx_=t%N,ty_=(t/N)|0;const hh=k=>{const dx=Math.abs(k%N-tx_),dy=Math.abs(((k/N)|0)-ty_);return Math.max(dx,dy)+.414*Math.min(dx,dy)};g[s]=0;push(s,hh(s));let it=0;
  while(heap.length&&it++<40000){const[,k]=pop();if(k===t)break;const kx=k%N,ky=(k/N)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=kx+dx,ny=ky+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const nk=ny*N+nx;if(!G.free[nk])continue;
    if(dx&&dy&&(!G.free[ky*N+nx]||!G.free[ny*N+kx]))continue;const ng=g[k]+(dx&&dy?1.414:1);if(ng<g[nk]){g[nk]=ng;from[nk]=k;push(nk,ng+hh(nk))}}}
  if(from[t]<0&&s!==t)return null;const raw=[];for(let k=t;k>=0;k=from[k]){raw.push(k);if(k===s)break}raw.reverse();
  /* string pulling */const out=[];let a=0;while(a<raw.length-1){let b=raw.length-1;while(b>a+1&&!vlLos(G,raw[a],raw[b]))b--;out.push(raw[b]);a=b}
  return out.map(k=>[G.x0+(k%N+.5)*G.cell,G.z0+(((k/N)|0)+.5)*G.cell]).concat([[tx,tz]])}
/* the places villagers go to in a town */
function vlPois(id){if(id==='sb'){const L=[];for(const s of STALLS)L.push({x:s.x+Math.sin(s.rot)*2.6,z:s.z+Math.cos(s.rot)*2.6,k:'shop',face:s.rot+Math.PI});
    for(const b of TOWN_B){const dd=(b.q%2?b.w:b.d)/2+1.4,dir=[[0,1],[1,0],[0,-1],[-1,0]][b.q%4];if(/home|tavern|church|blacksmith/.test(b.m))L.push({x:b.x+dir[0]*dd,z:b.z+dir[1]*dd,k:'door',face:Math.atan2(-dir[0],-dir[1])});if(/well/.test(b.m))L.push({x:b.x+2.2,z:b.z,k:'well',face:-Math.PI/2})}
    for(let i=0;i<8;i++){const a=i/8*6.283;L.push({x:Math.cos(a)*7.5,z:Math.sin(a)*7.5,k:i%2?'sit':'chat',face:Math.atan2(-Math.cos(a),-Math.sin(a))})}
    for(const n of NPCOBJ)if(Math.hypot(n.x,n.z)<TOWN.wall-4)L.push({x:n.x+Math.sin(n.ry||0)*2.4,z:n.z+Math.cos(n.ry||0)*2.4,k:'talk',face:(n.ry||0)+Math.PI});
    for(const p of TOWN_P){if(Math.hypot(p.x,p.z)>TOWN.wall-3)continue;if(/stall-(red|green)/.test(p.m)){for(const sd of[1,-1])L.push({x:p.x+Math.sin(p.ry)*2.4*sd,z:p.z+Math.cos(p.ry)*2.4*sd,k:'shop',face:p.ry+(sd>0?Math.PI:0)})}else if(/bench/.test(p.m))L.push({x:p.x+Math.sin(p.ry)*.9,z:p.z+Math.cos(p.ry)*.9,k:'sit',face:p.ry})}
    for(let i=0;i<10;i++){const a=Math.random()*6.283,r=14+Math.random()*48;L.push({x:Math.cos(a)*r,z:Math.sin(a)*r,k:'stroll'})}return L}
  if(id==='ws'){const L=[];for(const p of WS_PROPS){if(/stall/.test(p.m))L.push({x:p.x-Math.sin(p.ry)*2.8,z:p.z-Math.cos(p.ry)*2.8,k:'shop',face:p.ry});if(/well/.test(p.m))L.push({x:p.x+2,z:p.z,k:'well'})}
    for(const b of WS_B){const dd=b.d/2+1.6;if(/home|tavern|church|market|blacksmith/.test(b.m))L.push({x:b.x+Math.sin(b.ry)*dd,z:b.z+Math.cos(b.ry)*dd,k:'door',face:b.ry+Math.PI})}
    for(let i=0;i<8;i++){const a=i/8*6.283;L.push({x:WS.x+Math.cos(a)*10,z:WS.z+Math.sin(a)*10,k:i%2?'sit':'chat',face:Math.atan2(-Math.cos(a),-Math.sin(a))})}
    for(const id2 in WS_NPC_SPOTS){const s=WS_NPC_SPOTS[id2];if(s.ry!=null)L.push({x:s.x+Math.sin(s.ry)*2.4,z:s.z+Math.cos(s.ry)*2.4,k:'talk',face:s.ry+Math.PI})}
    for(let i=0;i<12;i++){const a=Math.random()*6.283,r=WS.plaza+4+Math.random()*(WS.R-WS.plaza-20);L.push({x:WS.x+Math.cos(a)*r,z:WS.z+Math.sin(a)*r,k:'stroll'})}return L}
  return[]}
const VL_TOWNS=[{id:'sb',x:0,z:0,R:TOWN.wall-1,cell:1,n:[6,9,12],kids:[1,2,2],dogs:1,lines:'sb'},{id:'ws',x:WS.x,z:WS.z,R:WS.R-2,cell:1.5,n:[6,9,12],kids:[1,2,3],dogs:1,lines:'ws',dog:'husky'}];
const VL_FARM={x:FARM.x,z:FARM.z,n:3};
function vlBuild(look,x,z,kid){const L=VL_LOOK.models[look.m];const r=buildGltfRig({model:L[0],h:kid?1.12:look.dwarf?1.5:1.78*(.95+look.hs*.1),props:L[1],weaponMesh:kid?null:L[2],skin:VL_LOOK.skin[look.sk],hair:VL_LOOK.hair[look.hr],o:{cls:'npc'},fallback:()=>buildHumanoidProc({race:'mens',skin:VL_LOOK.skin[look.sk],hair:VL_LOOK.hair[look.hr],chest:0x7a6a5a,pants:0x4a3a2a})});
  r.g.position.set(x,groundH(x,z),z);scene.add(r.g);return r}
function vlSpawn(T,kid){const pois=T.pois;const p=pois[Math.floor(Math.random()*pois.length)];const look={m:Math.floor(Math.random()*VL_LOOK.models.length),sk:Math.floor(Math.random()*VL_LOOK.skin.length),hr:Math.floor(Math.random()*VL_LOOK.hair.length),hs:Math.random(),dwarf:!kid&&Math.random()<.12};
  const v={T,kid,look,x:p.x,z:p.z,ry:Math.random()*6.28,st:'idle',tm:Math.random()*3,path:null,pi:0,spd:0,pose:null,sayCd:5+Math.random()*10,gone:false,vis:1,lod:Math.floor(Math.random()*3),adt:0};
  v.r=vlBuild(look,v.x,v.z,kid);VL.list.push(v);return v}
function vlGo(v,poi){const G=v.T.grid;const path=G?vlPath(G,v.x,v.z,poi.x,poi.z):[[poi.x,poi.z]];if(!path||!path.length){v.st='idle';v.tm=2;return}v.path=path;v.pi=0;v.poi=poi;v.st='walk';v.pose=null;v.tm=60}
function vlThink(v){const T=v.T;if(v.kid){/* children run from place to place */const p=T.pois[Math.floor(Math.random()*T.pois.length)];vlGo(v,p);v.run=Math.random()<.7;return}
  const r=Math.random();if(r<.75){let p;for(let i=0;i<6;i++){p=T.pois[Math.floor(Math.random()*T.pois.length)];if(!VL.list.some(o=>o!==v&&o.poi===p&&o.st!=='walk')||p.k==='chat')break}vlGo(v,p);v.run=false}
  else{v.st='idle';v.tm=3+Math.random()*5;v.pose=null}}
/* what they do once they arrive */
function vlArrive(v){const p=v.poi;v.path=null;if(p.face!=null)v.ry=p.face;v.st='do';
  if(v.kid){v.tm=1+Math.random()*3;v.pose=Math.random()<.4?'Cheer':null;return}
  if(p.k==='shop'||p.k==='talk'||p.k==='well'){v.tm=4+Math.random()*7;v.pose=p.k==='well'?'PickUp':'Interact';return}
  if(p.k==='sit'){v.tm=10+Math.random()*18;v.pose='Sit_Floor_Idle';return}
  if(p.k==='door'&&Math.random()<.55){/* goes inside for a while */v.st='in';v.tm=8+Math.random()*25;v.r.g.visible=false;v.gone=true;return}
  if(p.k==='chat'){const o=VL.list.find(o=>o!==v&&o.T===v.T&&!o.kid&&o.st==='do'&&o.poi&&o.poi.k==='chat'&&Math.hypot(o.x-v.x,o.z-v.z)<9);
    if(o){v.ry=Math.atan2(o.x-v.x,o.z-v.z);o.ry=Math.atan2(v.x-o.x,v.z-o.z);v.chat=o;o.chat=v}v.tm=6+Math.random()*8;v.pose=null;return}
  v.tm=2+Math.random()*4;v.pose=null}
function vlSay(v,text){let b=VL.bub.find(b=>!b.v);if(!b){if(VL.bub.length>=5)return;const el=document.createElement('div');el.className='vbub';document.body.appendChild(el);b={el,v:null};VL.bub.push(b)}b.v=v;b.t=3.6;b.el.textContent=text;b.el.style.display='block'}
function vlUpdate(v,dt){const T=v.T;const pd=Math.hypot(ME.pos.x-v.x,ME.pos.z-v.z);v.sayCd-=dt;
  if(v.st==='in'){v.tm-=dt;if(v.tm<=0){v.gone=false;v.r.g.visible=true;v.st='idle';v.tm=.5}return}
  /* greet the player once in a while */if(pd<4.2&&v.sayCd<=0&&v.st!=='walk'&&!ME.dead){v.sayCd=25+Math.random()*30;const L=VL_LINES[v.kid?'kid':T.lines];vlSay(v,L[Math.floor(Math.random()*L.length)]);v.ry=Math.atan2(ME.pos.x-v.x,ME.pos.z-v.z);if(!v.pose&&v.st!=='walk'){v.wave=1.5}}
  if(v.st==='walk'){v.tm-=dt;const w=v.path[v.pi];const dx=w[0]-v.x,dz=w[1]-v.z,d=Math.hypot(dx,dz);const sp=(v.run?4.2:1.35)*(v.kid?1.1:1);
    if(d<.3){v.pi++;if(v.pi>=v.path.length){vlArrive(v)}}else{const k=Math.min(d,sp*dt)/d;let nx=v.x+dx*k,nz=v.z+dz*k;
      /* make way for the player and each other */const ax=nx-ME.pos.x,az=nz-ME.pos.z,ad=Math.hypot(ax,az);if(ad<.9&&ad>.01){nx+=ax/ad*(.9-ad)*.5;nz+=az/ad*(.9-ad)*.5}
      v.x=nx;v.z=nz;v.ry+=angDiff(v.ry,Math.atan2(dx,dz))*clamp(dt*8,0,1);v.spd=sp}
    if(v.tm<=0)vlThink(v)}
  else{v.spd=0;v.tm-=dt;if(v.chat&&v.chat.chat===v&&v.sayCd<=0&&pd<14&&Math.random()<dt*.15){v.sayCd=12+Math.random()*12;const L=VL_LINES[T.lines];vlSay(v,L[Math.floor(Math.random()*L.length)])}
    if(v.tm<=0){if(v.chat){v.chat.chat=null;v.chat=null}vlThink(v)}}}
function vlAnim(v,dt){const r=v.r;if(!r.ready&&!r.fallback)return;if(v.wave>0)v.wave-=dt;
  const pose=v.st==='do'?(v.wave>0?'Cheer':v.chat&&Math.sin(LW.t*.8+v.x)>.2?'Interact':v.pose):(v.wave>0&&v.st!=='walk'?'Cheer':null);
  if(pose&&r.ready&&r.clips&&r.clips[pose]){const a=gLoop(r,pose,.3);if(a)a.timeScale=1;r.mixer.update(dt);return}
  if(r.cur&&r.ready&&(r.cur==='Sit_Floor_Idle'||r.cur==='Interact'||r.cur==='Cheer'||r.cur==='PickUp')){r.cur=null;for(const k in r.acts)r.acts[k].fadeOut(.25)}
  animRig(r,{spd:v.spd/(v.run?4.2:2.4),atk:-1},dt)}
let _vlT=0;
function vlTick(dt){_vlT-=dt;const px=camTarget.x,pz=camTarget.z,q=lwQ(),R=lwR();
  if(_vlT<=0){_vlT=2;for(const T of VL_TOWNS){const near=Math.hypot(T.x-px,T.z-pz)<T.R+R;const mine=VL.list.filter(v=>v.T===T);
      if(near&&!mine.length){if(!T.grid)T.grid=vlGrid(T.id,T.x,T.z,T.R,T.cell);if(!T.pois)T.pois=vlPois(T.id).filter(p=>{const k=vlNear(T.grid,p.x,p.z);return k>=0});if(!T.pois.length)continue;
        const adults=[];for(let i=0;i<T.n[q];i++)adults.push(vlSpawn(T,false));for(let i=0;i<T.kids[q];i++)vlSpawn(T,true);
        for(let i=0;i<T.dogs;i++){const o=adults[i];if(o)crSpawn(T.dog||'shiba',o.x+1,o.z+1,{follow:o,size:.9+Math.random()*.2}).then(c=>{if(c)c.owner=T})}}
      if(!near&&mine.length){for(const v of mine){scene.remove(v.r.g);v.gone=true;v.dead=true}VL.list=VL.list.filter(v=>v.T!==T);for(const c of [...CR])if(c.follow&&c.follow.T===T)crRemove(c)}}
    /* farmers on the fields */const nearF=Math.hypot(VL_FARM.x-px,VL_FARM.z-pz)<60+R;const fm=VL.list.filter(v=>v.T===VL_FARM);
    if(nearF&&!fm.length){VL_FARM.lines='farm';VL_FARM.pois=[];for(let i=0;i<14;i++){const x=VL_FARM.x-40+Math.random()*80,z=VL_FARM.z-30+Math.random()*60;const p={x,z};collide(p,.5);VL_FARM.pois.push({x:p.x,z:p.z,k:Math.random()<.6?'well':'stroll'})}VL_FARM.grid=null;for(let i=0;i<VL_FARM.n;i++)vlSpawn(VL_FARM,false)}
    if(!nearF&&fm.length){for(const v of fm){scene.remove(v.r.g);v.dead=true}VL.list=VL.list.filter(v=>v.T!==VL_FARM)}}
  for(const v of VL.list){const d=Math.hypot(v.x-px,v.z-pz);vlUpdate(v,dt);const vis=!v.gone&&d<R+5;v.r.g.visible=vis;if(!vis)continue;
    v.r.g.position.set(v.x,groundH(v.x,v.z),v.z);v.r.g.rotation.y=v.ry;v.adt+=dt;if(d<20||(LW.frame+v.lod)%(d<40?2:3)===0){vlAnim(v,v.adt);v.adt=0}}
  /* speech bubbles above their heads */for(const b of VL.bub){if(!b.v)continue;b.t-=dt;if(b.t<=0||b.v.dead||b.v.gone){b.v=null;b.el.style.display='none';continue}
    _plP.set(b.v.x,groundH(b.v.x,b.v.z)+(b.v.kid?1.5:2.2),b.v.z).project(camera);if(_plP.z>1||Math.abs(_plP.x)>1.1||Math.abs(_plP.y)>1.1){b.el.style.display='none';continue}
    b.el.style.display='block';b.el.style.transform=`translate(${(_plP.x*.5+.5)*innerWidth}px,${(-_plP.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;b.el.style.opacity=Math.min(1,b.t*2)}}

/* ====================== the loop ====================== */
function lwUpdate(dt){if(S.mode!=='play')return;if(!LW.init){LW.init=true;plInit();bdInit()}LW.t+=dt;LW.frame++;
  const t0=performance.now();try{const P=LW.pm||(LW.pm=[0,0,0,0]);let a=performance.now(),b;plUpdate(dt);b=performance.now();P[0]=P[0]*.95+(b-a)*.05;a=b;crTick(dt);b=performance.now();P[1]=P[1]*.95+(b-a)*.05;a=b;bdTick(dt);b=performance.now();P[2]=P[2]*.95+(b-a)*.05;a=b;vlTick(dt);b=performance.now();P[3]=P[3]*.95+(b-a)*.05}catch(e){if(!LW.err){LW.err=1;console.warn('living world',e)}}LW.ms=(LW.ms||0)*.95+(performance.now()-t0)*.05}
