/* ===================== omgevingsmodellen (Quaternius Nature / Medieval Village, CC0) =====================
   Bomen, rotsen, huizen, kramen, kisten en tonnen worden vervangen door low-poly modellen in dezelfde stijl als de karakters.
   De procedurele versies blijven bestaan als fallback (en worden verborgen zodra het model er is); colliders veranderen niet. */
const ENV_BASE=new URL('models/env/',location.href).href;
const envCache=new Map();let _envLoader=null;
function envLoader(){if(!_envLoader){_envLoader=new GLTFLoader();_envLoader.setMeshoptDecoder(MeshoptDecoder)}return _envLoader}
function loadEnv(name){let e=envCache.get(name);if(e)return e;
  e=new Promise(res=>{envLoader().load(ENV_BASE+name+'.glb',g=>res(g),undefined,err=>{console.warn('environment model failed',name,err);res(null)})});envCache.set(name,e);return e}
/* alle primitieven van een model samenvoegen tot één geometrie met vertexkleuren (voor InstancedMesh) */
function envMerged(g){const parts=[];g.scene.updateMatrixWorld(true);
  g.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();for(const k of['position','normal']){const a=geo.attributes[k];if(!a)continue;const f=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){f[i*3]=a.getX(i);f[i*3+1]=a.getY(i);f[i*3+2]=a.getZ(i)}geo.setAttribute(k,new THREE.BufferAttribute(f,3))}geo.applyMatrix4(o.matrixWorld);const vc=geo.attributes.color;for(const k of Object.keys(geo.attributes))if(k!=='position'&&k!=='normal'&&k!=='color')geo.deleteAttribute(k);
    /* vertexkleuren uit het model (bv. Kenney, ingebakken uit de colormap) behouden en met de materiaalkleur vermenigvuldigen */
    const n=geo.attributes.position.count,col=new Float32Array(n*3);const c=o.material.color||new THREE.Color(1,1,1);for(let i=0;i<n;i++){col[i*3]=c.r*(vc?vc.getX(i):1);col[i*3+1]=c.g*(vc?vc.getY(i):1);col[i*3+2]=c.b*(vc?vc.getZ(i):1)}geo.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(geo.index?geo.toNonIndexed():geo)});
  const m=BufferGeometryUtils.mergeGeometries(parts,false);if(!m.attributes.normal)m.computeVertexNormals();m.computeBoundingBox();const b=m.boundingBox;m.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);m.computeBoundingBox();return m}
const ENV_MAT=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP});
const ENV_IM=[],ENV_LOD=[];
/* instanced vegetatie met LOD: per variant twee InstancedMeshes (gedetailleerd dichtbij, vereenvoudigd veraf);
   updEnvLod() verdeelt de instanties elke ~0.3 s op afstand tot de camera. */
/* models that come with a low-detail version (name_lod) */
const ENV_LODS=new Set(["BirchTree_Dead_1", "BirchTree_Dead_2", "BushBerries_1", "Bush_1", "Bush_2", "C_Wheat_4", "CommonTree_1", "CommonTree_2", "CommonTree_3", "CommonTree_Dead_1", "CommonTree_Dead_2", "CommonTree_Dead_3", "CommonTree_Dead_4", "CommonTree_Dead_5", "K_grave", "K_gravestone-bevel", "K_gravestone-broken", "K_gravestone-cross", "K_gravestone-cross-large", "K_gravestone-decorative", "K_gravestone-round", "K_gravestone-wide", "N_Wheat", "PineTree_1", "PineTree_2", "PineTree_3", "Rock_1", "Rock_2", "Rock_3", "Rock_4", "Rock_5", "Rock_6", "Rock_7", "Rock_Moss_1", "Rock_Moss_2", "Rock_Moss_3", "Tree_Lava_1", "Tree_Lava_2", "Tree_Lava_3", "Willow_Dead_3"]);
async function envInstances(names,list,groupOf,scaleOf,cast=true,tint=null){
  const tg=g=>{if(g&&tint){const c=g.attributes.color.array;for(let i=0;i<c.length;i+=3){c[i]*=tint.r;c[i+1]*=tint.g;c[i+2]*=tint.b}}return g};
  const geos=await Promise.all(names.map(async n=>{const g=await loadEnv(n);return g?tg(envMerged(g)):null}));if(geos.some(g=>!g))return false;
  const lods=await Promise.all(names.map(async n=>{if(!ENV_LODS.has(n))return null;const g=await loadEnv(n+'_lod');return g?tg(envMerged(g)):null}));
  const buckets=names.map(()=>[]);list.forEach((t,i)=>buckets[groupOf(t,i)%names.length].push(t));
  buckets.forEach((b,vi)=>{if(!b.length)return;const geo=geos[vi];const bb=geo.boundingBox;const mats=new Float32Array(b.length*16),pos=new Float32Array(b.length*2);
    b.forEach((t,i)=>{const s=scaleOf(t,bb);_p.set(t[0],groundH(t[0],t[1])-.05,t[1]);_e.set(0,t[3],0);_q.setFromEuler(_e);_s.set(s[0],s[1],s[2]);_m.compose(_p,_q,_s);_m.toArray(mats,i*16);pos[i*2]=t[0];pos[i*2+1]=t[1]});
    const mk=(g,c=cast)=>{const im=new THREE.InstancedMesh(g,ENV_MAT,b.length);im.userData.wx=b[0][0];im.castShadow=c;im.receiveShadow=true;im.frustumCulled=false;im.count=0;scene.add(im);ENV_IM.push(im);return im};
    /* near trees cast shadows, far ones don't (they are outside the shadow map anyway): same picture, much less shadow work */
    const imHi=mk(geo,false),imHiN=cast?mk(geo,true):null,imLo=lods[vi]?mk(lods[vi],false):null;ENV_LOD.push({n:b.length,mats,pos,imHi,imHiN,imLo})});return true}
/* (px,pz) camerapositie en (fx,fz) kijkrichting: wat ruim achter de camera staat wordt niet getekend */
/* radius around the camera target in which trees and rocks cast shadows (the shadow map covers about ±42 m) */
let ENV_SH_R=64;
function updEnvLod(cx,cz,R,px=cx,pz=cz,fx=0,fz=0,cap=1e9){const R2=R*R;const far=Math.min(R*8,scene.fog.far+40,cap);const F2=far*far;const back=fx||fz;
  const SR=tdIsOn()?48:ENV_SH_R,S2=SR*SR;for(const L of ENV_LOD){const hi=L.imHi.instanceMatrix.array,hn=L.imHiN&&L.imHiN.instanceMatrix.array,lo=L.imLo&&L.imLo.instanceMatrix.array;let nh=0,nl=0,nn=0;
    for(let i=0;i<L.n;i++){const X=L.pos[i*2],Z=L.pos[i*2+1];if(back&&(X-px)*fx+(Z-pz)*fz<-28)continue;const dx=X-cx,dz=Z-cz,d2=dx*dx+dz*dz;
      if(hn&&d2<S2&&d2<R2){hn.set(L.mats.subarray(i*16,i*16+16),nn*16);nn++}else if(d2<R2||!lo){hi.set(L.mats.subarray(i*16,i*16+16),nh*16);nh++}else if(d2<F2){lo.set(L.mats.subarray(i*16,i*16+16),nl*16);nl++}}
    imUpload(L.imHi,nh);if(hn)imUpload(L.imHiN,nn);if(L.imLo)imUpload(L.imLo,nl)}}
function imUpload(im,n){const a=im.instanceMatrix;const ch=im.count!==n||n>0;im.count=n;if(!ch)return;a.clearUpdateRanges();if(n>0)a.addUpdateRange(0,n*16);a.needsUpdate=true}
/* losse objecten (huizen, kramen, kisten): gekloond model met toon-materialen; vensters gloeien 's nachts */
const envMatCache=new Map();
function envClone(g){const m=g.scene.clone(true);m.traverse(o=>{if(!o.isMesh)return;if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();const sm=o.material;let tm=envMatCache.get(sm.uuid);
  if(!tm){const win=/window|glass|licht/i.test(sm.name);tm=new THREE.MeshToonMaterial({color:sm.color.clone(),vertexColors:!!o.geometry.attributes.color,gradientMap:RAMP,emissive:win?new THREE.Color(0xffb347):new THREE.Color(0),emissiveIntensity:win?.4:0});if(win)NIGHT_MATS.add(tm);envMatCache.set(sm.uuid,tm)}o.material=tm;o.castShadow=true;o.receiveShadow=true});
  m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m);const w=new THREE.Group();m.position.set(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);w.add(m);w.userData.size=[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z];return w}
async function envPlace(name,x,z,ry,fit,par=scene,yOff=0){const g=await loadEnv(name);if(!g)return null;const o=envClone(g);const sz=o.userData.size;
  const s=fit(sz);o.scale.set(s[0],s[1],s[2]);o.position.set(x,groundH(x,z)+yOff,z);o.rotation.y=ry;par.add(o);return o}
/* ---- toepassen op de wereld ---- */
async function buildEnv(){
  if(window.__NOGLTF)return;
  const hide=(lists)=>{for(const r of VEG_IM)if(lists.includes(r.list))r.im.visible=false};
  /* bomen en rotsen: zelfde posities en colliders als de procedurele versie */
  const jobs=[];
  jobs.push(envInstances(['PineTree_1','PineTree_2','PineTree_3'],pineT,(t,i)=>i,(t,bb)=>{const k=9.2*t[2]/(bb.max.y-bb.min.y);return[k,k,k]}).then(ok=>ok&&hide([pineT])));
  jobs.push(envInstances(['CommonTree_1','CommonTree_2','CommonTree_3'],oakT,(t,i)=>i,(t,bb)=>{const k=7.4*t[2]/(bb.max.y-bb.min.y);return[k,k,k]}).then(ok=>ok&&hide([oakT])));
  jobs.push(envInstances(['CommonTree_Dead_1','CommonTree_Dead_2'],deadT,(t,i)=>i,(t,bb)=>{const k=5.2*t[2]/(bb.max.y-bb.min.y);return[k,k,k]}).then(ok=>ok&&hide([deadT])));
  jobs.push(envInstances(['Rock_1','Rock_2','Rock_3','Rock_4','Rock_5','Rock_Moss_1','Rock_Moss_2','Rock_Moss_3'],rockT,(t,i)=>Math.floor(t[2]*37+i),(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=2*t[2]/w;return[k,k*.8,k]}).then(ok=>ok&&hide([rockT])));
  /* struiken erbij langs bosranden en het meer */
  const bushT=[];{const r=mulberry(4242);for(let i=0;i<900&&bushT.length<260;i++){const x=-240+r()*480,z=-250+r()*490;if(okSpot(x,z,4)&&(inForest(x,z)?r()<.5:r()<.25))bushT.push([x,z,.7+r()*.8,r()*6.28])}}
  jobs.push(envInstances(['Bush_1','Bush_2','BushBerries_1'],bushT,(t,i)=>i,(t,bb)=>{const k=1.3*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},false));
  /* huizen: model over de voetafdruk van het procedurele huis, dat verborgen wordt */
  const HN=['House_1','House_2','Inn','House_3','House_4','Blacksmith'];
  HOUSES.forEach((h,i)=>{if(h.g.userData.keep)return;jobs.push(envPlace(HN[i%HN.length],h.x,h.z,h.rot?Math.PI/2:0,sz=>{const fw=h.w+1.2,fd=h.d+1.2;const hh=h.h+Math.max(h.w,h.d)*.42+1.6;return[fw/sz[0],hh/sz[1],fd/sz[2]]},h.par).then(o=>{if(o){h.g.visible=false;h.model=o}}))});
  /* kramen, kisten en tonnen */
  for(const s of STALLS)jobs.push(envPlace(s.i%2?'MarketStand_2':'MarketStand_1',s.x,s.z,s.rot,sz=>{const k=3.6/Math.max(sz[0],sz[2]);return[k,k,k]}).then(o=>{if(o)s.g.visible=false}));
  for(const c of CRATES)jobs.push(envPlace(c.kind==='barrel'?'Barrel':'Crate',c.x,c.z,c.ry,sz=>{const k=(c.kind==='barrel'?1.1:c.s)/sz[1];return[k,k,k]}).then(o=>{if(o){c.m.visible=false;o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color.multiply(new THREE.Color(1.7,1.5,1.3))}})}}));
  await Promise.all(jobs)}
/* ---- Silverbrook: buildings, walls, gates, lanterns, trees and props on the spots laid out in 2_world.js ---- */
async function buildTown(){if(window.__NOGLTF)return;const jobs=[];const STONE=new THREE.Color(1.08,.96,.8);
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  for(const b of TOWN_B)jobs.push(put(b.m,b.x,b.z,b.q*Math.PI/2,b.s).then(o=>{if(!o)return;b.proc.visible=false;b.model=o;
    if(b.ch){o.updateMatrixWorld(true);const v=new THREE.Vector3(...b.ch);o.children[0].localToWorld(v);TOWN_SMOKE.push({x:v.x,y:v.y+.25,z:v.z})}}));
  /* wall ring as instanced meshes (one draw call per model) */
  jobs.push((async()=>{const seg=await instModel('H_wall_straight',TOWN_WALL.seg.map(t=>({...t,sx:3.86,sy:4.4,sz:3.4})));
    const tw=await instModel('H_tower_base_blue',TOWN_WALL.tow.map(t=>({...t,s:4.8})));
    const gt=await Promise.all(TOWN_WALL.gate.map(t=>put('H_tower_B_blue',t.x,t.z,t.ry,4.6)));
    for(const t of TOWN_WALL.gate){const a=t.g+t.sd*.105,R=TOWN.wall-3.2;jobs.push(put('T_banner-red',Math.cos(a)*R,Math.sin(a)*R,t.ry+Math.PI/2,3.4,4.6))}
    if(seg&&tw&&gt.every(Boolean))hideProc('twall')})());
  /* the stable and its hay */
  jobs.push(put('Stable',STABLE.x,STABLE.z,STABLE.ry,STABLE_S));
  for(const[dx,dz,r]of[[-7.6,-1.5,.4],[-8.3,.4,1.3],[7.8,-4.6,.9]])jobs.push(put('Hay',STABLE.x+dx,STABLE.z+dz,r,9));
  /* fountain on the square */
  jobs.push(put('T_fountain-round-detail',0,0,0,[5.2,4.2,5.2]).then(o=>{if(!o)return;tintObj(o,STONE);FOUNT_Y=1.2+.48*4.2+.25;hideProc('fountain')}));
  /* lanterns, trees, props */
  jobs.push(instModel('T_lantern',TOWN_L.map(l=>({x:l.x,y:groundH(l.x,l.z),z:l.z,ry:0,s:2.5})),{tint:STONE}));
  {const by={};for(const t of TOWN_T)(by[t.m]=by[t.m]||[]).push(t);for(const m in by){const H=m.startsWith('T_')?3.1:5.2;jobs.push(instModel(m,by[m].map(t=>({x:t.x,y:groundH(t.x,t.z),z:t.z,ry:t.ry,s:H*t.s}))))}}
  for(const p of TOWN_P)jobs.push(put(p.m,p.x,p.z,p.ry,p.s).then(o=>{if(o&&/hedge|bench|stall/.test(p.m)===false&&p.m.startsWith('T_'))tintObj(o,STONE)}));
  /* pond: lilies and reeds */
  {const R=mulberry(99);const L=[],W=[];for(let i=0;i<16;i++){const a=R()*6.28,r=Math.sqrt(R())*.8;L.push({x:POND.x+Math.cos(a)*r*POND.r*1.25,y:.66,z:POND.z+Math.sin(a)*r*POND.r,ry:R()*6,s:4+R()*2})}
    for(let i=0;i<12;i++){const a=R()*6.28;W.push({x:POND.x+Math.cos(a)*(POND.r*1.25+.6),y:groundH(POND.x+Math.cos(a)*(POND.r*1.25+.6),POND.z+Math.sin(a)*(POND.r+.6)),z:POND.z+Math.sin(a)*(POND.r+.6),ry:R()*6,s:6+R()*3})}
    jobs.push(instModel('H_waterlily_A',L.slice(0,8),{cast:false}),instModel('H_waterlily_B',L.slice(8),{cast:false}),instModel('H_waterplant_A',W,{cast:false}))}
  await Promise.all(jobs);for(let i=0;i<4;i++)await Promise.all(jobs.slice())}
