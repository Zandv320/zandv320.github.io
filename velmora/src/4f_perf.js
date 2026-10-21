/* ===================== Prestaties: statische batching, zone-lagen en afstand =====================
   1. Static batching: alles wat stilstaat (huizen, muren, kramen, arena, kampen, kerkers…) wordt na het laden per
      vak van 48 m en per materiaal samengevoegd tot één mesh. Duizenden draw calls worden er zo enkele tientallen.
      Materialen blijven gedeeld, dus nachtverlichting in ramen e.d. werkt gewoon door.
   2. Zone-lagen: de bovenwereld staat op laag 1, de kerkers op laag 2. Camera en zonneschaduw zien alleen de laag
      waar je bent, zodat in een kerker de hele buitenwereld (bomen, gras, huizen) niet meer getekend wordt en andersom.
   3. Afstand: samengevoegde vakken en verzamelpunten ver weg worden niet getekend.
   Wat beweegt of later verandert (vlammen, vaandels, wolken, molen, portalen, lava, de arenakist, alles van een
   speler, monster of NPC) blijft los. Nieuwe statische dingen hoeven niets te doen: ze worden vanzelf meegenomen;
   iets dat later moet bewegen markeer je met userData.dyn=1. */
const PERF={cells:[],L_OVER:1,L_DUN:2,inDun:null,t:0,stats:null};
const BATCH_CELL=48;
function perfExcluded(){const s=new Set([sky,moon,water,terrain,clouds,arenaChest.g,window.__mill,window.__rune,window.__cportal,window.__dportal,window.__vportal,...flames,...flags,...(D2.lava||[]),...(D4.lava||[])]);s.delete(undefined);s.delete(null);return s}
/* geometrie in wereldcoördinaten met vaste attributen (positie, normaal, uv [, kleur]) en index */
/* effen kleurmaterialen (geen textuur, geen gloed, niet doorzichtig) worden vertexkleuren op één gedeeld materiaal,
   zodat bv. alle onderdelen van een huismodel samen één draw call worden */
const PLAIN_MATS=new Map();
function isPlain(m){return m.isMeshToonMaterial&&!m.map&&!m.bumpMap&&!m.transparent&&m.opacity===1&&!m.alphaTest&&(m.emissiveIntensity===0||m.emissive.getHex()===0)&&!NIGHT_MATS.has(m)}
function plainMat(m){const k=m.side+'|'+(m.flatShading?1:0)+'|'+(m.fog?1:0);let p=PLAIN_MATS.get(k);if(!p){p=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP,side:m.side,fog:m.fog});p.flatShading=m.flatShading;PLAIN_MATS.set(k,p)}return p}
function bakeGeo(o,vc,tint,mtx=o.matrixWorld){const src=o.geometry,n=src.attributes.position.count;let s=src;
  if(!s.attributes.normal){s=s.clone();s.computeVertexNormals()}
  const f32=(a,sz,def=0)=>{const f=new Float32Array(n*sz);if(a){for(let i=0;i<n;i++){f[i*sz]=a.getX(i);if(sz>1)f[i*sz+1]=a.getY(i);if(sz>2)f[i*sz+2]=a.getZ(i)}}else if(def)f.fill(def);return new THREE.BufferAttribute(f,sz)};
  const g=new THREE.BufferGeometry();g.setAttribute('position',f32(s.attributes.position,3));g.setAttribute('normal',f32(s.attributes.normal,3));g.setAttribute('uv',f32(s.attributes.uv,2));
  if(vc||tint){const c=f32(o.material.vertexColors?s.attributes.color:null,3,1);if(tint){const a=c.array,col=o.material.color;for(let i=0;i<a.length;i+=3){a[i]*=col.r;a[i+1]*=col.g;a[i+2]*=col.b}}g.setAttribute('color',c)}
  let idx;if(s.index){idx=new Uint32Array(s.index.count);for(let i=0;i<idx.length;i++)idx[i]=s.index.getX(i)}else{idx=new Uint32Array(n);for(let i=0;i<n;i++)idx[i]=i}
  if(mtx.determinant()<0)for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t}
  g.setIndex(new THREE.BufferAttribute(idx,1));g.applyMatrix4(mtx);return g}
function batchStatic(){const t0=performance.now();scene.updateMatrixWorld(true);const ex=perfExcluded();const groups=new Map();let found=0;
  const walk=(o)=>{if(ex.has(o)||!o.visible||(o.userData&&(o.userData.ent||o.userData.dyn||o.userData.wave)))return;
    if(o.isMesh&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&!o.material.isShaderMaterial&&o.renderOrder===0&&o.frustumCulled&&!o.morphTargetInfluences&&o.geometry.attributes.position){
      const p=o.getWorldPosition(_p);const dun=p.x>700;const cx=Math.floor(p.x/BATCH_CELL),cz=Math.floor(p.z/BATCH_CELL);const plain=isPlain(o.material);const vc=plain||!!o.material.vertexColors;const bm=plain?plainMat(o.material):o.material;
      const k=bm.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0)+'|'+cx+','+cz;let G=groups.get(k);if(!G)groups.set(k,G={mat:bm,plain,cast:o.castShadow,recv:o.receiveShadow,vc,dun,list:[]});G.list.push(o);found++}
    for(const c of[...o.children])walk(c)};
  for(const c of[...scene.children])walk(c);
  let made=0,merged=0;
  for(const G of groups.values()){if(G.list.length<2)continue;
    const geos=G.list.map(o=>bakeGeo(o,G.vc,G.plain));const m=BufferGeometryUtils.mergeGeometries(geos,false);if(!m)continue;m.computeBoundingSphere();m.computeBoundingBox();
    const bm=new THREE.Mesh(m,G.mat);bm.castShadow=G.cast;bm.receiveShadow=G.recv;bm.matrixAutoUpdate=false;bm.updateMatrix();bm.userData.batch=1;bm.layers.set(G.dun?PERF.L_DUN:PERF.L_OVER);scene.add(bm);
    PERF.cells.push({m:bm,x:m.boundingSphere.center.x,z:m.boundingSphere.center.z,r:m.boundingSphere.radius,dun:G.dun});
    for(const o of G.list){o.parent&&o.parent.remove(o)}made++;merged+=G.list.length}
  PERF.stats={found,merged,made,ms:Math.round(performance.now()-t0)};
  zoneLayers();return PERF.stats}
/* alle statische bovenwereld-objecten op laag 1, kerkers op laag 2; entiteiten, effecten, lucht en maan blijven op laag 0 */
function zoneLayers(){const keep=new Set([sky,moon]);const b=new THREE.Box3();
  for(const c of scene.children){if(keep.has(c)||c.isLight||c.isPoints||c.userData.fx||c.userData.ent||c.userData.batch||c===ME.g||(ME.rig&&c===ME.rig.g))continue;
    let ent=false;c.traverse(o=>{if(o.userData&&o.userData.ent)ent=true});if(ent)continue;
    let dun;if(c.userData.wx!=null)dun=c.userData.wx>700;else if(c.isInstancedMesh){const mm=new THREE.Matrix4();c.getMatrixAt(0,mm);_p.setFromMatrixPosition(mm);dun=_p.x>700}
    else{b.setFromObject(c);if(b.isEmpty())continue;dun=b.max.x>700}
    const L=dun?PERF.L_DUN:PERF.L_OVER;c.traverse(o=>o.layers.set(L))}
  PERF.inDun=null;setZoneLayer(camTarget.x>700)}
function setZoneLayer(inDun){if(PERF.inDun===inDun)return;PERF.inDun=inDun;
  /* de schaduwkaart en GTAO gebruiken dezelfde cameralagen */camera.layers.set(0);camera.layers.enable(inDun?PERF.L_DUN:PERF.L_OVER)}
/* per frame: zonelaag, en elke 0,4 s de vakken op afstand */
function updPerf(dt){const c=camTarget;setZoneLayer(c.x>700);PERF.t-=dt;if(PERF.t>0)return;PERF.t=.4;
  const R=Math.min((GFX.q==='laag'?170:GFX.q==='middel'?230:320)*(isTouch?.8:1),scene.fog.far+30);
  for(const L of PERF.cells){const d=Math.hypot(L.x-c.x,L.z-c.z)-L.r;L.m.visible=d<R}}
/* procedurele monsters (o.a. de Vuurgrot-wezens) bestaan uit tientallen losse onderdelen. Per bewegend lichaamsdeel
   (heup, arm, hoofd…) worden de stilstaande onderdelen samengevoegd; de gewrichten zelf blijven, dus animaties werken gewoon.
   Onderdelen waar de code naar verwijst (rig-velden, userData) blijven los. */
const RIG_GEO_CACHE=new Map();
function compactRig(r){if(!r||!r.g)return r;const refs=new Set();for(const k in r){const v=r[k];if(v&&v.isObject3D)refs.add(v);else if(Array.isArray(v))for(const x of v)if(x&&x.isObject3D)refs.add(x)}
  const fl=new Set(flames);r.g.updateMatrixWorld(true);const nodes=[];r.g.traverse(o=>nodes.push(o));
  for(const p of nodes){const groups=new Map();
    for(const o of p.children){if(!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||o.children.length||refs.has(o)||fl.has(o)||Object.keys(o.userData).length||Array.isArray(o.material)||o.material.isShaderMaterial||!o.visible||o.renderOrder)continue;
      const plain=isPlain(o.material);const bm=plain?plainMat(o.material):o.material;const k=bm.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0);let G=groups.get(k);if(!G)groups.set(k,G={mat:bm,plain,vc:plain||!!o.material.vertexColors,cast:o.castShadow,recv:o.receiveShadow,list:[]});G.list.push(o)}
    for(const G of groups.values()){if(G.list.length<2)continue;for(const o of G.list)o.updateMatrix();
      const m=BufferGeometryUtils.mergeGeometries(G.list.map(o=>bakeGeo(o,G.vc,G.plain,o.matrix)),false);if(!m)continue;m.computeBoundingSphere();
      const bm=new THREE.Mesh(m,G.mat);bm.castShadow=G.cast;bm.receiveShadow=G.recv;p.add(bm);for(const o of G.list)p.remove(o)}}
  return r}
