import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Volledige personages (Mixamo): laden, klonen, animaties op basis van beweging,
// een pistool in de rechterhand en onzichtbare "hitboxen" aan de botten.

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};
// versienummer achter de modellen: na een update haalt de browser zeker de nieuwe versie op
// (GitHub Pages laat bestanden 10 minuten in de cache staan)
export const ASSET_VERSION = 67;
export function loadGLTF(url) {
  if (!cache[url]) cache[url] = loader.loadAsync(`${url}?v=${ASSET_VERSION}`);
  return cache[url];
}

// natuurlijke loopsnelheid van elke clip (m/s), gemeten aan de wortelbeweging in Mixamo
const NATURAL = { walk: 2.6, run: 4.9, walkBack: 1.45, runBack: 3.4, strafeL: 2.2, strafeR: 2.5, crouchWalk: 1.3, crouchBack: 1.1, crouchL: 1.2, crouchR: 1.2 };
const CROUCH = { idle: 'crouchIdle', walk: 'crouchWalk', run: 'crouchWalk', walkBack: 'crouchBack', runBack: 'crouchBack', strafeL: 'crouchL', strafeR: 'crouchR' };

export function cloneCharacter(gltf) {
  const model = SkeletonUtils.clone(gltf.scene);
  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o; });
  return { model, bones };
}

// Animatiekeuze op basis van snelheid en richting (in de kijkrichting van het personage)
export class Locomotion {
  constructor(model, clips) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      this.actions[c.name] = a;
    }
    for (const n of ['hit', 'shoot', 'deathBack', 'deathFwd', 'jump']) {
      const a = this.actions[n];
      if (a) { a.setLoop(n === 'shoot' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true; }
    }
    this.current = null;
    this.locked = null;          // eenmalige animatie die voorrang heeft (geraakt, dood)
    this.play('idle', 0);
  }

  play(name, fade = 0.22, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = timeScale;
    if (this.current === next) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  // eenmalig: geraakt / dood; daarna (bij geraakt) terug naar beweging
  once(name, fade = 0.12, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    this.locked = { action: a, until: a.getClip().duration / timeScale - 0.15 };
    a.reset(); a.timeScale = timeScale; a.play();
    if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }

  // vx = naar rechts, vz = naar voren (m/s); airborne; extra: 'shoot' als hij stilstaat en schiet
  update(dt, vx, vz, { airborne = false, shooting = false, crouch = false } = {}) {
    if (this.locked) {
      this.locked.until -= dt;
      if (this.locked.until > 0 || this.locked.permanent) { this.mixer.update(dt); return; }
      this.locked = null;
    }
    const speed = Math.hypot(vx, vz);
    let name = 'idle', ts = 1;
    if (airborne && this.actions.jump) { name = 'jump'; }
    else if (speed > 0.4) {
      if (Math.abs(vz) >= Math.abs(vx) * 0.8) {
        if (vz > 0) { name = speed > 3.2 ? 'run' : 'walk'; }
        else { name = speed > 2.0 ? 'runBack' : 'walkBack'; }
      } else name = vx > 0 ? 'strafeR' : 'strafeL';
      ts = THREE.MathUtils.clamp(speed / NATURAL[name], 0.6, 1.7);
    } else if (shooting && this.actions.shoot) name = 'shoot';
    if (crouch && !airborne && this.actions[CROUCH[name]]) {
      name = CROUCH[name];
      ts = speed > 0.4 ? THREE.MathUtils.clamp(speed / NATURAL[name], 0.6, 1.6) : 1;
    }
    this.play(name, 0.25, ts);
    if (this.current) this.current.timeScale = ts;
    this.mixer.update(dt);
  }

  die(name) {
    const a = this.actions[name];
    this.locked = { action: a, until: 1e9, permanent: true };
    a.reset(); a.play();
    if (this.current && this.current !== a) this.current.crossFadeTo(a, 0.15, false);
    this.current = a;
  }

  reset() {
    this.locked = null;
    this.mixer.stopAllAction();
    this.current = null;
    this.play('idle', 0);
  }
}

// pistool (uit het pistoolmodel) in de rechterhand, uitgelijnd in de richhouding
export async function attachPistol(model, bones, clipIdle) {
  const gltf = await loadGLTF('models/pistol.glb');
  const gun = gltf.scene.getObjectByName('pistol').clone(true);
  gun.position.set(0, 0, 0); gun.rotation.set(0, 0, 0); gun.scale.set(1, 1, 1);
  gun.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  // kogels/hulzen die in het model los zitten niet tonen
  for (const n of ['shell', 'shell_1', 'shell_1_2', 'bullet', 'bullet_2', 'bullet_2_2']) { const o = gun.getObjectByName(n); if (o) o.visible = false; }
  gun.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gun);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const inner = new THREE.Group();
  gun.position.sub(center);
  inner.add(gun);
  inner.scale.setScalar(0.21 / size.z);          // ca. 21 cm lang, loop langs +z

  // richhouding inladen om de hand te meten
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clipIdle).play(); mixer.update(0.3);
  model.updateMatrixWorld(true);
  const hand = bones.RightHand;
  const hq = new THREE.Quaternion(); hand.getWorldQuaternion(hq);
  const mq = new THREE.Quaternion(); model.getWorldQuaternion(mq);
  // gewenst: loop naar voren (+z van het model), bovenkant omhoog
  const holder = new THREE.Group();
  holder.quaternion.copy(hq.clone().invert().multiply(mq));
  // positie: in de handpalm, iets naar voren en omhoog
  const hp = new THREE.Vector3(); hand.getWorldPosition(hp);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(mq), up = new THREE.Vector3(0, 1, 0).applyQuaternion(mq);
  const target = hp.clone().addScaledVector(fwd, 0.06).addScaledVector(up, 0.045);
  hand.add(holder);
  holder.position.copy(hand.worldToLocal(target.clone()));
  const ws = new THREE.Vector3(); hand.getWorldScale(ws);
  holder.scale.setScalar(1 / ws.x);
  holder.add(inner);
  mixer.stopAllAction(); mixer.uncacheRoot(model);
  // vuurmond: voorkant van het pistool
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, size.y * 0.25 / size.z * 0.21, 0.11);
  holder.add(muzzle);
  return { holder, muzzle };
}

// onzichtbare hitboxen aan de botten; userData.part bepaalt de schade
const HITBOXES = [
  ['Head', 'head', 'sphere', [0.12], [0, 0.09, 0.02]],
  ['Spine2', 'torso', 'box', [0.38, 0.32, 0.24], [0, 0.05, 0]],
  ['Spine', 'torso', 'box', [0.34, 0.26, 0.22], [0, 0.06, 0]],
  ['Hips', 'torso', 'box', [0.36, 0.2, 0.24], [0, 0, 0]],
  ['LeftUpLeg', 'limb', 'box', [0.16, 0.44, 0.16], [0, 0.21, 0]],
  ['RightUpLeg', 'limb', 'box', [0.16, 0.44, 0.16], [0, 0.21, 0]],
  ['LeftLeg', 'limb', 'box', [0.13, 0.44, 0.13], [0, 0.22, 0]],
  ['RightLeg', 'limb', 'box', [0.13, 0.44, 0.13], [0, 0.22, 0]],
  ['LeftArm', 'limb', 'box', [0.11, 0.3, 0.11], [0, 0.14, 0]],
  ['RightArm', 'limb', 'box', [0.11, 0.3, 0.11], [0, 0.14, 0]],
  ['LeftForeArm', 'limb', 'box', [0.09, 0.28, 0.09], [0, 0.13, 0]],
  ['RightForeArm', 'limb', 'box', [0.09, 0.28, 0.09], [0, 0.13, 0]],
];
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
export function addHitboxes(model, bones, owner) {
  const list = [];
  model.updateMatrixWorld(true);
  const ws = new THREE.Vector3();
  for (const [bone, part, shape, dims, off] of HITBOXES) {
    const b = bones[bone];
    if (!b) continue;
    const geo = shape === 'sphere' ? new THREE.SphereGeometry(dims[0], 8, 6) : new THREE.BoxGeometry(...dims);
    const m = new THREE.Mesh(geo, hitMat);
    b.getWorldScale(ws);
    m.scale.setScalar(1 / ws.x);
    // botten van Mixamo wijzen met hun y-as langs het bot (naar het kind toe)
    // Mixamo-botten wijzen met hun lokale y-as naar het kind: halverwege het bot = +y
    m.position.set(off[0] / ws.x, off[1] / ws.x, off[2] / ws.x);
    m.userData = { part, owner };
    b.add(m);
    list.push(m);
  }
  return list;
}
