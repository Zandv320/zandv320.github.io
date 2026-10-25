import * as THREE from 'three';
import { loadGLTF, cloneCharacter, Locomotion } from './characters.js';

// Echte first person: je hele personage staat in de wereld en de camera zit in zijn hoofd.
// - Benen en romp spelen de loop-, ren-, hurk- en springanimaties af.
// - De romp buigt mee als je omhoog of omlaag kijkt, en kantelt bij leunen (Q/E).
// - Het hoofd wordt weggevouwen (anders kijk je tegen de binnenkant van je hoofd aan);
//   een onzichtbare kopie mét hoofd werpt de schaduw.
// - De armen worden met inverse kinematica (IK) naar het wapen gestuurd: de rechterhand pakt de
//   greep, de linkerhand volgt de handbewegingen van het wapenmodel (herladen, inspecteren, stoten).

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// buiging van de romp bij omhoog/omlaag kijken, verdeeld over de wervels (de nek doet de rest)
const BEND = [['Spine', 0.12], ['Spine1', 0.16], ['Spine2', 0.2], ['Neck', 0.25]];
const LEAN = [['Spine', 0.25], ['Spine1', 0.3], ['Spine2', 0.3]];

export class FPBody {
  constructor(scene) {
    this.scene = scene;
    this.ready = false;
    this.root = new THREE.Group();
    this.shadowRoot = new THREE.Group();
    scene.add(this.root, this.shadowRoot);
    this.eye = new THREE.Vector3();
    this.eyeOff = null;              // oog t.o.v. de voeten in lichaamsruimte (gedempt)
  }

  async load() {
    const gltf = await loadGLTF('models/player.glb');
    const clip = n => gltf.animations.find(c => c.name === n);

    const { model, bones } = cloneCharacter(gltf);
    model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    model.traverse(o => { if (o.isSkinnedMesh) removeHead(o); });
    this.root.add(model);
    this.model = model; this.bones = bones;
    this.loco = new Locomotion(model, gltf.animations);

    // schaduw: volledige kopie met hoofd, tekent zelf niets
    const sh = cloneCharacter(gltf);
    const hide = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    sh.model.traverse(o => { if (o.isMesh) { o.material = hide; o.castShadow = true; o.receiveShadow = false; } });
    this.shadowRoot.add(sh.model);
    this.boneList = []; model.traverse(o => { if (o.isBone) this.boneList.push(o); });
    this.shadowBones = []; sh.model.traverse(o => { if (o.isBone) this.shadowBones.push(o); });

    // ---- kalibratie: hoe houdt dit personage een pistool vast, en hoe een vuist? ----
    const mixer = new THREE.AnimationMixer(model);
    const sample = (name, t) => {
      mixer.stopAllAction(); const a = mixer.clipAction(clip(name)); a.reset().play(); mixer.setTime(t);
      this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.updateMatrixWorld(true);
    };
    const wp = b => b.getWorldPosition(new THREE.Vector3()), wq = b => b.getWorldQuaternion(new THREE.Quaternion());

    // pistool: in de richthouding wijst de loop naar voren (+z van het model), bovenkant omhoog;
    // midden van het wapen ligt ~6 cm voor en 4,5 cm boven de rechterpols (zoals bij de vijanden)
    sample('idle', 0.3);
    const rp = wp(bones.RightHand), rq = wq(bones.RightHand), lp = wp(bones.LeftHand), lq = wq(bones.LeftHand);
    const C = rp.clone().add(new THREE.Vector3(0, 0.045, 0.06));
    this.pistolGrip = {
      R: { pos: rp.clone().sub(C), quat: rq.clone() },
      L: { pos: lp.clone().sub(C), quat: lq.clone() },
      length: 0.21,
    };
    this.pistolFingers = this.snapFingers();

    // vuisten: handoriëntatie in de bokshouding, in "cameraruimte" (camera kijkt naar -z, model naar +z)
    sample('boxIdle', 0.5);
    const toCam = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI).invert();
    this.boxQ = { R: toCam.clone().multiply(wq(bones.RightHand)), L: toCam.clone().multiply(wq(bones.LeftHand)) };
    this.fistFingers = this.snapFingers();
    // pistoolgreep: vuist om de greep, maar de rechterwijsvinger blijft gestrekt langs de trekker
    const pf = new Map(this.pistolFingers.map(([b, q]) => [b, q]));
    this.gripFingers = this.fistFingers.map(([b, q]) => [b, b.name.includes('RightHandIndex') ? pf.get(b) : q]);
    mixer.stopAllAction(); mixer.uncacheRoot(model);

    // armlengtes (voor IK)
    this.armData = {};
    for (const side of ['Right', 'Left']) {
      const a = bones[side + 'Arm'], f = bones[side + 'ForeArm'], h = bones[side + 'Hand'];
      this.armData[side] = { arm: a, fore: f, hand: h, l1: wp(a).distanceTo(wp(f)), l2: wp(f).distanceTo(wp(h)),
        handLen: wp(h).distanceTo(wp(bones[side + 'HandMiddle1'])) };
    }
    this.loco.reset();
    this.ready = true;
  }

  snapFingers() {
    const out = [];
    for (const side of ['Right', 'Left']) for (const f of FINGERS) for (let i = 1; i <= 3; i++) {
      const b = this.bones[`${side}Hand${f}${i}`];
      if (b) out.push([b, b.quaternion.clone()]);
    }
    return out;
  }

  // stap 1: lichaam neerzetten en animeren; geeft de oogpositie (wereld) terug
  // o: { feet, vel, yaw, pitch, airborne, crouch, lean (-1..1), dt }
  pose(dt, o) {
    if (!this.ready) return null;
    const h = o.yaw + Math.PI;
    const fx = Math.sin(h), fz = Math.cos(h);
    const vz = o.vel.x * fx + o.vel.z * fz, vx = o.vel.x * -fz + o.vel.z * fx;
    this.root.position.copy(o.feet);
    this.root.rotation.set(0, h, 0);
    this.loco.update(dt, vx, vz, { airborne: o.airborne, crouch: o.crouch });
    this.root.updateMatrixWorld(true);

    // romp buigen naar de kijkrichting en kantelen bij leunen
    const right = _v1.set(-Math.cos(h), 0, Math.sin(h));
    const fwd = _v2.set(fx, 0, fz);
    const pitch = THREE.MathUtils.clamp(o.pitch, -1.2, 1.0);
    for (const [n, k] of BEND) rotateWorld(this.bones[n], right, pitch * k);
    for (const [n, k] of LEAN) rotateWorld(this.bones[n], fwd, -(o.lean || 0) * 0.32 * k);

    // oog: iets voor en boven het hoofdgewricht, in de kijkrichting
    const head = this.bones.Head;
    head.getWorldPosition(_v3);
    // ogen zitten ~10 cm voor en 8 cm boven het hoofdgewricht en draaien mee met het hoofd
    const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
    _v3.addScaledVector(fwd, 0.1 * cp - 0.08 * sp).y += 0.08 * cp + 0.1 * sp;
    // gedempt t.o.v. de voeten, zodat de camera niet elke stap meeschokt
    const lx = _v3.x - o.feet.x, ly = _v3.y - o.feet.y, lz = _v3.z - o.feet.z;
    const bx = lx * -fz + lz * fx, bz = lx * fx + lz * fz;      // lichaamsruimte
    if (!this.eyeOff) this.eyeOff = new THREE.Vector3(bx, ly, bz);
    const k = 1 - Math.exp(-dt * 9);
    this.eyeOff.x += (bx - this.eyeOff.x) * k; this.eyeOff.y += (ly - this.eyeOff.y) * k; this.eyeOff.z += (bz - this.eyeOff.z) * k;
    this.eye.set(
      o.feet.x + this.eyeOff.x * -fz + this.eyeOff.z * fx,
      o.feet.y + this.eyeOff.y,
      o.feet.z + this.eyeOff.x * fx + this.eyeOff.z * fz,
    );
    return this.eye;
  }

  // stap 2: armen naar het wapen (na het bijwerken van de wapens)
  arms(rig, camera) {
    if (!this.ready || !rig?.ready) return;
    const camQ = camera.getWorldQuaternion(new THREE.Quaternion());
    if (rig.gunFrame) {
      // beide handen volgen de handen van het wapenmodel. Positie: rond de middelste knokkel,
      // geschaald naar de (kleinere) hand van dit personage, zodat de handpalm om de greep sluit.
      // Oriëntatie: vaste correctie, bepaald uit hoe dit personage een pistool vasthoudt.
      if (!this.gripOff) {
        this.gripOff = {
          R: rig.rightRel.quat.clone().invert().multiply(this.pistolGrip.R.quat),
          L: rig.leftRel.quat.clone().invert().multiply(this.pistolGrip.L.quat),
        };
      }
      this.follow('Right', rig.handR, rig.knuckleR, this.gripOff.R, camQ, 1, null);
      this.follow('Left', rig.handL, rig.knuckleL, this.gripOff.L, camQ, -1, null);
      this.applyFingers(this.gripFingers);
    } else if (rig.handR) {
      // vuisten: handen waar het vuistenmodel ze heeft, met de oriëntatie van een echte bokshouding
      if (!this.fistOff) {
        this.fistOff = {
          R: rig.guardQ.R.clone().invert().multiply(this.boxQ.R),
          L: rig.guardQ.L.clone().invert().multiply(this.boxQ.L),
        };
      }
      // iets verder naar voren en omlaag dan de (lange) armen van het vuistenmodel
      this.follow('Right', rig.handR, rig.knuckleR, this.fistOff.R, camQ, 1, new THREE.Vector3(0.03, -0.05, -0.1));
      this.follow('Left', rig.handL, rig.knuckleL, this.fistOff.L, camQ, -1, new THREE.Vector3(-0.03, -0.05, -0.1));
      this.applyFingers(this.fistFingers);
    }
  }

  // hand van dit lichaam naar een hand van het wapenmodel
  follow(side, rigHand, rigKnuckle, offQ, camQ, sign, extra) {
    const w = rigHand.getWorldPosition(new THREE.Vector3());
    const k = rigKnuckle.getWorldPosition(new THREE.Vector3());
    const A = this.armData[side];
    const ratio = A.handLen / Math.max(0.01, w.distanceTo(k));
    const pos = k.clone().add(w.sub(k).multiplyScalar(ratio));
    if (extra) pos.add(extra.clone().applyQuaternion(camQ));
    const q = rigHand.getWorldQuaternion(new THREE.Quaternion()).multiply(offQ);
    this.solve(side, pos, q, camQ, sign);
  }

  applyFingers(list) { for (const [b, q] of list) b.quaternion.copy(q); }

  // twee-botten-IK: schouder-elleboog-pols naar doel; elleboog naar beneden en opzij
  solve(side, target, targetQ, camQ, sideSign) {
    const A = this.armData[side];
    const s = A.arm.getWorldPosition(new THREE.Vector3());
    const e = A.fore.getWorldPosition(new THREE.Vector3());
    const w = A.hand.getWorldPosition(new THREE.Vector3());
    const toT = target.clone().sub(s);
    let d = toT.length();
    const max = (A.l1 + A.l2) * 0.999;
    if (d > max) { toT.multiplyScalar(max / d); d = max; }
    const dir = toT.clone().normalize();
    // hint voor de elleboog: omlaag, naar buiten en iets naar achter (in cameraruimte)
    const pole = new THREE.Vector3(0.55 * sideSign, -1, 0.15).applyQuaternion(camQ);
    const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = THREE.MathUtils.clamp((A.l1 * A.l1 + d * d - A.l2 * A.l2) / (2 * A.l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = s.clone().addScaledVector(dir, A.l1 * cosA).addScaledVector(perp, A.l1 * sinA);
    const wrist = s.clone().add(toT);
    // bovenarm draaien: oude richting (s→e) naar nieuwe (s→elleboog)
    aimBone(A.arm, e.clone().sub(s).normalize(), elbow.clone().sub(s).normalize());
    A.arm.updateMatrixWorld(true);
    const e2 = A.fore.getWorldPosition(new THREE.Vector3());
    const w2 = A.hand.getWorldPosition(new THREE.Vector3());
    aimBone(A.fore, w2.sub(e2).normalize(), wrist.clone().sub(e2).normalize());
    A.fore.updateMatrixWorld(true);
    // hand: wereldoriëntatie overnemen, de draaiing om de onderarm half over de onderarm verdelen
    A.fore.getWorldQuaternion(_q3);
    const local = _q3.clone().invert().multiply(targetQ);
    // swing-twist om de lokale y-as (Mixamo: botten wijzen langs +y)
    const tw = new THREE.Quaternion(0, local.y, 0, local.w).normalize();
    const half = new THREE.Quaternion().slerp(tw, 0.5);
    A.fore.quaternion.multiply(half);
    A.fore.updateMatrixWorld(true);
    A.fore.getWorldQuaternion(_q3);
    A.hand.quaternion.copy(_q3.invert().multiply(targetQ));
    A.hand.updateMatrixWorld(true);
  }

  // stap 3: schaduwkopie gelijkzetten (met hoofd) en zichtbaarheid
  finish(visible = true) {
    if (!this.ready) return;
    this.shadowRoot.position.copy(this.root.position);
    this.shadowRoot.quaternion.copy(this.root.quaternion);
    for (let i = 0; i < this.boneList.length; i++) {
      const b = this.boneList[i], c = this.shadowBones[i];
      c.position.copy(b.position); c.quaternion.copy(b.quaternion); c.scale.copy(b.scale);
    }
    this.root.visible = visible;
    this.shadowRoot.visible = visible;
  }
}

// hoofd uit de zichtbare mesh halen: alle driehoeken die (deels) aan het hoofd hangen.
// (Het hoofdbot verkleinen trekt halve hoofdhoekpunten uit tot spijlen die je camera in prikken.)
function removeHead(mesh) {
  const g = mesh.geometry, idx = g.index, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const bones = mesh.skeleton.bones;
  const headIds = new Set(bones.map((b, i) => /Head(Top_End)?$/.test(b.name) ? i : -1).filter(i => i >= 0));
  const onHead = new Uint8Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (headIds.has(si.getComponent(v, k))) w += sw.getComponent(v, k);
    onHead[v] = w > 0.15 ? 1 : 0;
  }
  // in dezelfde mesh zit uitrusting op de schouders (een wapenstok) die recht in beeld steekt
  if ([...onHead].some(x => x)) {
    const pos = g.attributes.position, v3 = new THREE.Vector3();
    let top = mesh; while (top.parent) top = top.parent;
    top.updateMatrixWorld(true); mesh.skeleton.update();
    const spineIds = new Set(bones.map((b, i) => /Spine2|Neck|Shoulder/.test(b.name) ? i : -1).filter(i => i >= 0));
    for (let v = 0; v < pos.count; v++) {
      if (onHead[v]) continue;
      let best = 0, bi = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > best) { best = w; bi = si.getComponent(v, k); } }
      if (!spineIds.has(bi)) continue;
      v3.fromBufferAttribute(pos, v); mesh.applyBoneTransform(v, v3); v3.applyMatrix4(mesh.matrixWorld);
      if (v3.y > 1.3) onHead[v] = 1;
    }
  }
  const src = idx.array, keep = [];
  for (let t = 0; t < src.length; t += 3) if (!onHead[src[t]] && !onHead[src[t + 1]] && !onHead[src[t + 2]]) keep.push(src[t], src[t + 1], src[t + 2]);
  const ng = g.clone();
  ng.setIndex(keep);
  mesh.geometry = ng;
}

// bot zo draaien dat wereldrichting `from` op `to` komt
function aimBone(bone, from, to) {
  const d = _q1.setFromUnitVectors(from, to);
  bone.parent.getWorldQuaternion(_q2);
  // wereldrotatie d omzetten naar de ouderruimte: q_local' = P^-1 * d * P * q_local
  const pInv = _q2.clone().invert();
  bone.quaternion.premultiply(pInv.multiply(d).multiply(_q2));
}

// bot draaien om een as in wereldcoördinaten
function rotateWorld(bone, axisWorld, angle) {
  if (!bone || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_q2);
  const local = _v4.copy(axisWorld).applyQuaternion(_q2.invert()).normalize();
  bone.quaternion.premultiply(_q1.setFromAxisAngle(local, angle));
  bone.updateMatrixWorld(true);
}
