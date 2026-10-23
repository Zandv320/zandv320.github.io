/* Laden van glTF-modellen, toon-materialen en normaliseren van maat/richting. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const draco=new DRACOLoader();draco.setDecoderPath('models/draco/');
const loader=new GLTFLoader();loader.setDRACOLoader(draco);
const cache=new Map();

/* Drie-staps verlooptextuur voor cel-shading. */
const gradient=(()=>{const d=new Uint8Array([70,70,150,150,255,255]);const t=new THREE.DataTexture(d,3,1,THREE.RedFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();

/* Zet alle materialen om naar MeshToonMaterial; kleur en textuur blijven, glans verdwijnt. */
export function maakToon(root,opt={}){
  root.traverse(o=>{
    if(!o.isMesh)return;
    if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals(); /* onbelichte (unlit) modellen hebben vaak geen normalen */
    const mats=Array.isArray(o.material)?o.material:[o.material];
    const nieuw=mats.map(m=>{
      if(!m)return m;
      if(m.userData.toon)return m;
      const t=new THREE.MeshToonMaterial({
        color:m.color?m.color.clone():new THREE.Color(0xffffff),
        map:m.map||null,
        emissive:m.emissive?m.emissive.clone():new THREE.Color(0),
        emissiveMap:m.emissiveMap||null,
        transparent:!!m.transparent,opacity:m.opacity??1,
        alphaTest:m.alphaTest||0,side:m.side??THREE.FrontSide,
        gradientMap:gradient,
      });
      if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;
      /* Sketchfab-modellen gebruiken soms alleen een emissive-textuur (onbelicht): dan als gewone kleurtextuur gebruiken */
      if(m.emissiveMap&&!m.map){t.map=m.emissiveMap;t.map.colorSpace=THREE.SRGBColorSpace;t.emissiveMap=null;t.emissive.set(0);t.color.set(0xffffff)}
      else if(m.emissiveMap&&t.emissive.getHex()===0){t.emissive.set(0x888888)}
      if(!m.map&&t.color.getHex()===0)t.color.set(0x8a8a8a);
      if(opt.helder){t.color.multiplyScalar(1.1)}
      t.userData.toon=true;t.userData.basisKleur=t.color.clone();
      return t;
    });
    o.material=Array.isArray(o.material)?nieuw:nieuw[0];
    o.castShadow=true;o.receiveShadow=true;
    if(o.isSkinnedMesh)o.frustumCulled=false;
  });
}

/* Begrenzend vak dat ook geskinde meshes correct meeneemt. */
export function bbox(root){
  root.updateMatrixWorld(true);
  const box=new THREE.Box3();
  root.traverse(m=>{
    if(!m.isMesh)return;let b;
    if(m.isSkinnedMesh){m.skeleton.update();m.computeBoundingBox();b=m.boundingBox.clone().applyMatrix4(m.matrixWorld)}
    else{if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();b=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)}
    if(isFinite(b.min.x)&&isFinite(b.max.x))box.union(b);
  });
  return box;
}

export function laad(pad){
  if(cache.has(pad))return cache.get(pad);
  const p=new Promise((res,rej)=>loader.load(pad,g=>{maakToon(g.scene);res(g)},undefined,rej));
  cache.set(pad,p);return p;
}

/* Maakt een genormaliseerde kopie: hoogte in meters, voeten op y=0, gecentreerd, gezicht naar +Z.
   Geeft {root, model, mixer, clips, straal} terug. */
export function instantie(gltf,hoogte,rot=0){
  const model=SkeletonUtils.clone(gltf.scene);
  model.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()}});
  const pivot=new THREE.Group();pivot.add(model);
  const box=bbox(model);
  const size=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
  const s=hoogte/Math.max(size.y,1e-6);
  model.position.set(-c.x*s,-box.min.y*s,-c.z*s);model.scale.setScalar(s);
  pivot.rotation.y=rot;
  const root=new THREE.Group();root.add(pivot);
  const mixer=gltf.animations.length?new THREE.AnimationMixer(model):null;
  const straal=Math.max(size.x,size.z)*s*0.5;
  return{root,model,pivot,mixer,clips:gltf.animations,straal,hoogte};
}

/* Statisch prop (natuur) – gedeelde geometrie, eigen transformatie. */
export function prop(gltf,schaal=1){
  const m=gltf.scene.clone(true);m.scale.setScalar(schaal);return m;
}
