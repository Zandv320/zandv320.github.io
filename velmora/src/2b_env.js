/* ===================== omgevingsmodellen (Quaternius Nature / Medieval Village, CC0) =====================
   Bomen, rotsen, huizen, kramen, kisten en tonnen worden vervangen door low-poly modellen in dezelfde stijl als de karakters.
   De procedurele versies blijven bestaan als fallback (en worden verborgen zodra het model er is); colliders veranderen niet. */
const ENV_BASE=new URL('models/env/',location.href).href;
const envCache=new Map();let _envLoader=null;
function envLoader(){if(!_envLoader){_envLoader=new GLTFLoader();_envLoader.setMeshoptDecoder(MeshoptDecoder)}return _envLoader}
function loadEnv(name){let e=envCache.get(name);if(e)return e;
  e=new Promise(res=>{envLoader().load(ENV_BASE+name+'.glb',g=>res(g),undefined,err=>{console.warn('omgevingsmodel mislukt',name,err);res(null)})});envCache.set(name,e);return e}
/* alle primitieven van een model samenvoegen tot één geometrie met vertexkleuren (voor InstancedMesh) */
function envMerged(g){const parts=[];g.scene.updateMatrixWorld(true);
  g.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();for(const k of['position','normal']){const a=geo.attributes[k];if(!a)continue;const f=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){f[i*3]=a.getX(i);f[i*3+1]=a.getY(i);f[i*3+2]=a.getZ(i)}geo.setAttribute(k,new THREE.BufferAttribute(f,3))}geo.applyMatrix4(o.matrixWorld);for(const k of Object.keys(geo.attributes))if(k!=='position'&&k!=='normal')geo.deleteAttribute(k);
    const n=geo.attributes.position.count,col=new Float32Array(n*3);const c=o.material.color||new THREE.Color(1,1,1);for(let i=0;i<n;i++){col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}geo.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(geo.index?geo.toNonIndexed():geo)});
  const m=BufferGeometryUtils.mergeGeometries(parts,false);if(!m.attributes.normal)m.computeVertexNormals();m.computeBoundingBox();const b=m.boundingBox;m.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);m.computeBoundingBox();return m}
const ENV_MAT=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP});
const ENV_IM=[],ENV_LOD=[];
/* instanced vegetatie met LOD: per variant twee InstancedMeshes (gedetailleerd dichtbij, vereenvoudigd veraf);
   updEnvLod() verdeelt de instanties elke ~0.3 s op afstand tot de camera. */
async function envInstances(names,list,groupOf,scaleOf,cast=true){
  const geos=await Promise.all(names.map(async n=>{const g=await loadEnv(n);return g?envMerged(g):null}));if(geos.some(g=>!g))return false;
  const lods=await Promise.all(names.map(async n=>{const g=await loadEnv(n+'_lod');return g?envMerged(g):null}));
  const buckets=names.map(()=>[]);list.forEach((t,i)=>buckets[groupOf(t,i)%names.length].push(t));
  buckets.forEach((b,vi)=>{if(!b.length)return;const geo=geos[vi];const bb=geo.boundingBox;const mats=new Float32Array(b.length*16),pos=new Float32Array(b.length*2);
    b.forEach((t,i)=>{const s=scaleOf(t,bb);_p.set(t[0],groundH(t[0],t[1])-.05,t[1]);_e.set(0,t[3],0);_q.setFromEuler(_e);_s.set(s[0],s[1],s[2]);_m.compose(_p,_q,_s);_m.toArray(mats,i*16);pos[i*2]=t[0];pos[i*2+1]=t[1]});
    const mk=(g)=>{const im=new THREE.InstancedMesh(g,ENV_MAT,b.length);im.castShadow=cast;im.receiveShadow=true;im.frustumCulled=false;im.count=0;scene.add(im);ENV_IM.push(im);return im};
    const imHi=mk(geo),imLo=lods[vi]?mk(lods[vi]):null;ENV_LOD.push({n:b.length,mats,pos,imHi,imLo})});return true}
function updEnvLod(cx,cz,R){const R2=R*R;const far=R*8;const F2=far*far;
  for(const L of ENV_LOD){const hi=L.imHi.instanceMatrix.array,lo=L.imLo&&L.imLo.instanceMatrix.array;let nh=0,nl=0;
    for(let i=0;i<L.n;i++){const dx=L.pos[i*2]-cx,dz=L.pos[i*2+1]-cz,d2=dx*dx+dz*dz;
      if(d2<R2||!lo){hi.set(L.mats.subarray(i*16,i*16+16),nh*16);nh++}else if(d2<F2){lo.set(L.mats.subarray(i*16,i*16+16),nl*16);nl++}}
    L.imHi.count=nh;L.imHi.instanceMatrix.needsUpdate=true;if(L.imLo){L.imLo.count=nl;L.imLo.instanceMatrix.needsUpdate=true}}}
/* losse objecten (huizen, kramen, kisten): gekloond model met toon-materialen; vensters gloeien 's nachts */
const envMatCache=new Map();
function envClone(g){const m=g.scene.clone(true);m.traverse(o=>{if(!o.isMesh)return;const sm=o.material;let tm=envMatCache.get(sm.uuid);
  if(!tm){const win=/window|glass|licht/i.test(sm.name);tm=new THREE.MeshToonMaterial({color:sm.color.clone(),gradientMap:RAMP,emissive:win?new THREE.Color(0xffb347):new THREE.Color(0),emissiveIntensity:win?.4:0});if(win)NIGHT_MATS.add(tm);envMatCache.set(sm.uuid,tm)}o.material=tm;o.castShadow=true;o.receiveShadow=true});
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
  for(const c of CRATES)jobs.push(envPlace(c.kind==='barrel'?'Barrel':'Crate',c.x,c.z,c.ry,sz=>{const k=(c.kind==='barrel'?1.1:c.s)/sz[1];return[k,k,k]}).then(o=>{if(o)c.m.visible=false}));
  await Promise.all(jobs)}
