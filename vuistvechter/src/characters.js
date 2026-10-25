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
export const ASSET_VERSION = 75;
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
// Pistool in de rechterhand. De greep van het wapen wordt opgemeten (hoekpunten van het frame
// onder de slede, achteraan) en precies in het "gat" van de gekromde vingers gezet, met de
// knokkels rechts-voor de greep zoals bij een echte grip. (Vroeger: midden van de bounding box,
// maar daar telden losse hulzen en kogels in mee, waardoor het pistool naast de hand zweefde.)
export async function attachPistol(model, bones, clipIdle) {
  const gltf = await loadGLTF('models/pistol.glb');
  const gun = gltf.scene.getObjectByName('pistol').clone(true);
  gun.position.set(0, 0, 0); gun.rotation.set(0, 0, 0); gun.scale.set(1, 1, 1);
  gun.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  for (const n of ['shell', 'shell_1', 'shell_1_2', 'bullet', 'bullet_2', 'bullet_2_2']) { const o = gun.getObjectByName(n); if (o) o.visible = false; }
  gun.updateMatrixWorld(true);
  const g = measureGun(gun);

  // richthouding inladen om de hand te meten
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clipIdle).play(); mixer.update(0.3);
  model.updateMatrixWorld(true);
  const hand = bones.RightHand;
  const hp = hand.getWorldPosition(new THREE.Vector3()), hqi = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const loc = b => b.getWorldPosition(new THREE.Vector3()).sub(hp).applyQuaternion(hqi);
  const c = new THREE.Vector3(); let n = 0;
  for (const f of ['Middle', 'Ring', 'Pinky']) for (let i = 1; i <= 3; i++) { const b = bones[`RightHand${f}${i}`]; if (b) { c.add(loc(b)); n++; } }
  c.divideScalar(Math.max(1, n));
  // wijsvinger: tweede kootje hoort op de trekker te liggen
  const index = bones.RightHandIndex2 ? loc(bones.RightHandIndex2).lerp(loc(bones.RightHandIndex3 || bones.RightHandIndex2), 0.3) : null;
  mixer.stopAllAction(); mixer.uncacheRoot(model);

  // richting: in de richthouding wijst de loop recht naar voren (+z van het model) en de bovenkant
  // omhoog; de greep valt dan vanzelf schuin door de hand zoals bij een echte pistoolgreep
  const mqHand = hqi.clone().multiply(model.getWorldQuaternion(new THREE.Quaternion()));
  const fwdH = new THREE.Vector3(0, 0, 1).applyQuaternion(mqHand), upH = new THREE.Vector3(0, 1, 0).applyQuaternion(mqHand);
  const R = new THREE.Quaternion().setFromRotationMatrix(basis(fwdH, upH).multiply(basis(g.fwd, g.up).invert()));
  const k = g.scale;                                         // naar ware grootte (slede 20 cm)
  const t = c.clone().sub(g.gripCenter.clone().multiplyScalar(k).applyQuaternion(R));
  // wapen langs zijn eigen as omhoog/omlaag schuiven tot de trekker bij de wijsvinger zit
  if (index && g.trigger) {
    const trig = g.trigger.clone().multiplyScalar(k).applyQuaternion(R).add(t);
    const upH = g.up.clone().applyQuaternion(R);
    const dy = THREE.MathUtils.clamp(index.clone().sub(trig).dot(upH), -0.03, 0.03);
    t.addScaledVector(upH, dy);
  }

  const holder = new THREE.Group();                          // in de hand, in meters
  const ws = new THREE.Vector3(); hand.getWorldScale(ws);
  holder.scale.setScalar(1 / ws.x);
  hand.add(holder);
  const inner = new THREE.Group();
  inner.quaternion.copy(R); inner.position.copy(t); inner.scale.setScalar(k);
  inner.add(gun);
  holder.add(inner);
  // vuurmond: lokale +z = looprichting, schaal 1 (meters)
  const muzzle = new THREE.Object3D();
  muzzle.position.copy(g.muzzle.clone().multiplyScalar(k).applyQuaternion(R).add(t));
  muzzle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), g.fwd.clone().applyQuaternion(R));
  holder.add(muzzle);
  // punten voor herladen: onderkant greep (magazijn) en achterkant slede (doorladen)
  const point = v => { const o = new THREE.Object3D(); o.position.copy(v.clone().multiplyScalar(k).applyQuaternion(R).add(t)); holder.add(o); return o; };
  return { holder, muzzle, magWell: point(g.gripBottom), slideRear: point(g.slideRear) };
}

// orthonormale basis (a, k, a×k) als rotatiematrix
function basis(a, k) {
  const z = new THREE.Vector3().crossVectors(a, k).normalize();
  return new THREE.Matrix4().makeBasis(a.clone().normalize(), k.clone().normalize(), z);
}

// wapen opmeten in zijn eigen ruimte: loop, boven, greep, vuurmond en schaal naar ware grootte
function measureGun(gun) {
  const verts = name => {
    const m = gun.getObjectByName(name), pos = m.geometry.attributes.position, out = [];
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    return out;
  };
  const mean = pts => pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(Math.max(1, pts.length));
  const pca = (pts, c, seed) => {
    let ax = seed.clone().normalize();
    for (let it = 0; it < 16; it++) { const n = new THREE.Vector3(); for (const p of pts) { const d = p.clone().sub(c); n.addScaledVector(d, d.dot(ax)); } ax = n.normalize(); }
    return ax;
  };
  const slide = verts('slide_beretta_0'), frame = verts('base_beretta_0');
  const trigger = gun.getObjectByName('trigger_beretta_0') ? mean(verts('trigger_beretta_0')) : null;
  const sc = mean(slide), fc = mean(frame);
  const box = new THREE.Box3().setFromPoints(slide), sz = box.getSize(new THREE.Vector3());
  const seed = sz.x >= sz.y && sz.x >= sz.z ? new THREE.Vector3(1, 0, 0) : sz.y >= sz.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  let fwd = pca(slide, sc, seed);
  const up = sc.clone().sub(fc); up.addScaledVector(fwd, -up.dot(fwd)).normalize();
  let lo = Infinity, hi = -Infinity;
  for (const p of slide) { const d = p.clone().sub(sc).dot(fwd); lo = Math.min(lo, d); hi = Math.max(hi, d); }
  const slideLen = hi - lo;
  // de greep zit achteraan: als de onderste framepunten gemiddeld vóór liggen, loop omdraaien
  let sMin = Infinity, sMax = -Infinity; for (const p of slide) { const y = p.clone().sub(sc).dot(up); sMin = Math.min(sMin, y); sMax = Math.max(sMax, y); }
  const below = frame.filter(p => p.clone().sub(sc).dot(up) < sMin - 0.1 * slideLen);
  if (mean(below).sub(sc).dot(fwd) > 0) { fwd.negate(); [lo, hi] = [-hi, -lo]; }
  const left = new THREE.Vector3().crossVectors(up, fwd).normalize();
  let fLo = Infinity, yMin = Infinity;
  for (const p of frame) { fLo = Math.min(fLo, p.clone().sub(sc).dot(fwd)); yMin = Math.min(yMin, p.clone().sub(sc).dot(up)); }
  const grip = frame.filter(p => { const d = p.clone().sub(sc); const y = d.dot(up); return y < sMin - 0.12 * slideLen && y > yMin + 0.05 * slideLen && d.dot(fwd) < fLo + 0.37 * slideLen; });
  const gripCenter = mean(grip.length ? grip : below);
  let gripAxis = pca(grip.length ? grip : below, gripCenter, up.clone().negate().addScaledVector(fwd, -0.2));
  if (gripAxis.dot(up) > 0) gripAxis.negate();
  const muzzle = sc.clone().addScaledVector(fwd, hi + 0.01 * slideLen);
  const slideRear = sc.clone().addScaledVector(fwd, lo + 0.08 * slideLen).addScaledVector(up, sMax);
  const gripBottom = gripCenter.clone().addScaledVector(gripAxis, 0.32 * slideLen);
  return { fwd, up, left, gripCenter, gripAxis, muzzle, slideRear, gripBottom, trigger, scale: 0.2 / slideLen };
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
