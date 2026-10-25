import * as THREE from 'three';
import { loadGLTF, cloneCharacter, Locomotion, attachPistol, addHitboxes } from './characters.js';
import { MuzzleFlash } from './flash.js';

// Andere spelers (multiplayer). Elk is een volledig personage met wapen, hitboxen en een naambordje.
// Posities komen ~20x per seconde binnen; we tekenen ze 100 ms "in het verleden" en vloeien
// tussen twee berichten in, zodat ze soepel bewegen ook als er pakketjes wat later komen.

const DELAY = 0.1;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class RemotePlayers {
  // ctx: { scene, camera, audio, effects, level }
  constructor(ctx) {
    this.ctx = ctx;
    this.map = new Map();
    this.ray = new THREE.Raycaster();
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  // speler ophalen of aanmaken (het model laadt op de achtergrond)
  get(id, name) {
    let p = this.map.get(id);
    if (p) { if (name) p.setName(name); return p; }
    p = new RemoteAvatar(this, id, name);
    this.map.set(id, p);
    p.init().catch(e => console.error('Speler laden mislukt', e));
    return p;
  }

  remove(id) {
    const p = this.map.get(id);
    if (!p) return;
    this.ctx.scene.remove(p.root);
    this.map.delete(id);
  }

  clear() { for (const id of [...this.map.keys()]) this.remove(id); }

  // hitboxen van levende spelers
  live() {
    const out = [];
    for (const p of this.map.values()) if (p.ready && !p.dead) out.push(...p.hitboxes);
    return out;
  }

  // geluid op een plek in de wereld: zachter op afstand, in stereo, doffer achter muren, met galm
  sound(name, at, { gain = 1, rate = 1, falloff = 0.3 } = {}) {
    const { camera, audio, level } = this.ctx;
    const d = at.distanceTo(camera.position);
    const right = _v.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pan = _v2.subVectors(at, camera.position).normalize().dot(right) * 0.85;
    this.ray.set(at, _v2.subVectors(camera.position, at).normalize()); this.ray.far = Math.max(0.01, d - 0.1);
    const blocked = this.ray.intersectObjects(level.hittables, false).length > 0;
    audio.play(name, { gain: gain / (1 + d * falloff) * (blocked ? 0.55 : 1), rate, pan,
      lowpass: (blocked ? 1400 : 11000) / (1 + d * 0.05), wet: Math.min(0.8, 0.12 + d * 0.025) });
  }

  tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const l = new THREE.Line(g, this.tracerMat.clone());
    this.ctx.scene.add(l);
    this.tracers.push({ l, t: 0.07 });
  }

  update(dt, now) {
    for (const p of this.map.values()) if (p.ready) p.update(dt, now);
    for (const t of this.tracers) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.07) * 0.8; }
    for (const t of this.tracers.filter(t => t.t <= 0)) { this.ctx.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); }
    this.tracers = this.tracers.filter(t => t.t > 0);
  }
}

class RemoteAvatar {
  constructor(mgr, id, name) {
    this.mgr = mgr; this.id = id; this.name = name || 'Speler';
    this.isRemote = true;
    this.ready = false;
    this.buf = [];             // [{t, p:Vector3, yaw, pitch, crouch, lean, weapon, air}]
    this.dead = false;
    this.root = new THREE.Group();
    mgr.ctx.scene.add(this.root);
    this.heading = 0; this.pitch = 0; this.crouch = false; this.lean = 0; this.weapon = 'p';
    this.recoil = 0; this.reloadT = 0; this.flinch = 0; this.flinchAxis = new THREE.Vector3(1, 0, 0);
    this.stepDist = 0; this.lastPos = new THREE.Vector3();
  }

  async init() {
    const gltf = await loadGLTF('models/enemy.glb');
    const { model, bones } = cloneCharacter(gltf);
    this.model = model; this.bones = bones;
    this.root.add(model);
    this.loco = new Locomotion(model, gltf.animations);
    const clip = n => gltf.animations.find(c => c.name === n);
    const gun = await attachPistol(model, bones, clip('idle'));
    this.holder = gun.holder; this.muzzle = gun.muzzle; this.magWell = gun.magWell; this.slideRear = gun.slideRear;
    // eigen kleur per speler (lichte tint over het hele uniform)
    const tint = new THREE.Color(TINTS[hash(this.id) % TINTS.length]);
    model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(tint); } });
    this.tint = tint;
    // stoten: bovenlijf-clips, over de loopanimatie heen gelegd
    this.punches = ['punchJab', 'punchCross'].map(n => clip(n)).filter(Boolean).map(c => upperBody(c, model));
    this.punchT = -1; this.punchSide = 0;
    this.prevWeapon = 'p'; this.switchT = 0;
    // armlengtes voor de herlaad-IK
    const wp = b => b.getWorldPosition(new THREE.Vector3());
    model.updateMatrixWorld(true);
    this.arm = { a: bones.LeftArm, f: bones.LeftForeArm, h: bones.LeftHand, l1: wp(bones.LeftArm).distanceTo(wp(bones.LeftForeArm)), l2: wp(bones.LeftForeArm).distanceTo(wp(bones.LeftHand)) };
    this.flash = new MuzzleFlash(new THREE.Vector3(0, 0, 1), 1, { length: 0.2, width: 0.12 });
    this.muzzle.add(this.flash.group);
    this.hitboxes = addHitboxes(model, bones, this);
    // bokshouding voor de armen als iemand zijn vuisten vasthoudt
    const mixer = new THREE.AnimationMixer(model);
    const box = clip('boxIdle');
    this.guard = [];
    if (box) {
      mixer.clipAction(box).play(); mixer.setTime(0.5);
      for (const side of ['Left', 'Right']) for (const part of ['Shoulder', 'Arm', 'ForeArm', 'Hand']) {
        const b = bones[side + part]; if (b) this.guard.push([b, b.quaternion.clone()]);
      }
      model.traverse(o => { if (o.isBone && /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(o.name)) this.guard.push([o, o.quaternion.clone()]); });
      mixer.stopAllAction(); mixer.uncacheRoot(model);
    }
    this.loco.reset();
    // naambordje
    this.label = makeLabel(this.name, this.tint);
    this.label.position.y = 2.05;
    this.root.add(this.label);
    this.ready = true;
  }

  setName(n) {
    if (n === this.name) return;
    this.name = n;
    if (this.label) { this.root.remove(this.label); this.label = makeLabel(n, this.tint); this.label.position.y = 2.05; this.root.add(this.label); }
  }

  // nieuwe toestand van het netwerk
  push(s, now) {
    this.buf.push({ t: now, p: new THREE.Vector3(s.p[0], s.p[1], s.p[2]), yaw: s.y, pitch: s.x, crouch: !!s.c, lean: s.l || 0, weapon: s.w || 'p', air: !!s.a });
    if (this.buf.length > 30) this.buf.shift();
    if (this.buf.length === 1) this.lastPos.copy(this.buf[0].p);
  }

  // effect van een schot van deze speler
  shot(to, surface) {
    if (!this.ready) return;
    const from = this.muzzle.getWorldPosition(new THREE.Vector3());
    this.flash.fire();
    this.recoil = 0.35;
    this.mgr.ctx.effects.muzzleLight(from, 3);
    this.mgr.sound('shot', from, { gain: 2.2, rate: 0.96 });
    const end = to ? new THREE.Vector3(...to) : from.clone().addScaledVector(new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)), 40);
    this.mgr.tracer(from, end);
    if (to && surface) {
      // kogelgat/stof op de plek waar het schot insloeg
      this.mgr.ray.set(from, end.clone().sub(from).normalize()); this.mgr.ray.far = from.distanceTo(end) + 0.1;
      const hit = this.mgr.ray.intersectObjects(this.mgr.ctx.level.hittables, false)[0];
      if (hit) {
        const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        if (!hit.object.userData.bag && !hit.object.userData.target) this.mgr.ctx.effects.hole(hit);
        this.mgr.ctx.effects.burst(hit.point, n, 0xb8b0a2, 8);
      }
    }
    // langs je oor?
    const cam = this.mgr.ctx.camera.position;
    const dir = end.clone().sub(from).normalize();
    const c = new THREE.Vector3(); new THREE.Ray(from, dir).closestPointToPoint(cam, c);
    if (c.distanceTo(cam) < 1.2 && c.distanceTo(from) < end.distanceTo(from)) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mgr.ctx.camera.quaternion);
      this.mgr.ctx.audio.whiz(THREE.MathUtils.clamp(c.sub(cam).dot(right) * 1.5, -1, 1), 0.3);
    }
  }

  punch() {
    this.punchT = 0; this.punchSide = 1 - this.punchSide;
    this.mgr.sound('hit', this.root.position.clone().setY(this.root.position.y + 1.4), { gain: 0.5, rate: 0.8 });
  }
  reload() {
    this.reloadT = RELOAD;
    const at = () => this.root.position.clone().setY(this.root.position.y + 1.3);
    this.mgr.sound('magout', at(), { gain: 1.4 });
    setTimeout(() => this.ready && this.mgr.sound('magin', at(), { gain: 1.5 }), 900);
    setTimeout(() => this.ready && this.mgr.sound('slide', at(), { gain: 1.4 }), 1250);
  }

  // geraakt: bloedwolkje op de borst (iedereen ziet het)
  bleed(dir, effects) {
    const p = this.bones.Spine2.getWorldPosition(new THREE.Vector3());
    const n = dir ? new THREE.Vector3(-dir[0], -dir[1], -dir[2]) : new THREE.Vector3(0, 0, 1);
    effects.burst(p, n, 0x6e1410, 10);
    this.mgr.sound('hit', p, { gain: 0.8, rate: 1.2 });
  }

  hurt(dir) {
    if (dir) this.flinchAxis.set(dir[2], 0, -dir[0]).normalize();
    this.flinch = 1;
  }

  die(dirFront) {
    if (this.dead) return;
    this.dead = true;
    this.loco.die(dirFront ? 'deathBack' : 'deathFwd');
    this.label.visible = false;
    setTimeout(() => this.mgr.sound('land', this.root.position, { gain: 1.2, rate: 0.7 }), 650);
  }

  revive() {
    this.dead = false;
    this.loco.reset();
    this.label.visible = true;
    this.buf.length = 0;
  }

  update(dt, now) {
    this.flash.update(dt);
    // tussen twee berichten in vloeien, 100 ms achter de werkelijkheid
    const t = now - DELAY;
    const b = this.buf;
    if (!b.length) return;
    let a = b[0], c = b[b.length - 1], k = 1;
    for (let i = b.length - 1; i > 0; i--) if (b[i - 1].t <= t) { a = b[i - 1]; c = b[i]; k = THREE.MathUtils.clamp((t - a.t) / Math.max(1e-3, c.t - a.t), 0, 1.15); break; }
    if (b[0].t > t) { a = c = b[0]; k = 0; }
    const pos = _v.copy(a.p).lerp(c.p, k);
    this.heading = angleLerp(a.yaw, c.yaw, k) + Math.PI;
    this.pitch = a.pitch + (c.pitch - a.pitch) * k;
    this.crouch = c.crouch; this.lean = c.lean; this.weapon = c.weapon;

    // snelheid voor de animatie uit de verplaatsing
    const vx = (pos.x - this.lastPos.x) / Math.max(dt, 1e-3), vz = (pos.z - this.lastPos.z) / Math.max(dt, 1e-3);
    const moved = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z);
    this.lastPos.copy(pos);
    this.root.position.copy(pos);
    this.root.rotation.y = this.heading;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.loco.update(dt, vx * -fz + vz * fx, vx * fx + vz * fz, { airborne: c.air, crouch: this.crouch });
    if (this.dead) return;

    // voetstappen
    if (!c.air) {
      this.stepDist += moved;
      const stride = this.crouch ? 0.8 : Math.hypot(vx, vz) > 4.2 ? 1.6 : 1.15;
      if (this.stepDist > stride) { this.stepDist = 0; this.mgr.sound('step', pos.clone(), { gain: this.crouch ? 0.9 : 2, falloff: 0.35 }); }
    }

    // vuisten: armen in bokshouding, geen pistool
    if (this.weapon === 'f') for (const [bn, q] of this.guard) bn.quaternion.copy(q);

    this.root.updateMatrixWorld(true);
    const right = _v2.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    const fwd = new THREE.Vector3(fx, 0, fz);
    // stoot: bovenlijfclip eroverheen (in 0,55 s: aanloop, stoot, terug)
    if (this.punchT >= 0 && this.weapon === 'f' && this.punches.length) {
      this.punchT += dt;
      const pc = this.punches[this.punchSide % this.punches.length];
      const w = THREE.MathUtils.smoothstep(this.punchT, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(this.punchT, 0.42, 0.6));
      pc.apply(pc.impact - 0.18 + this.punchT * 0.9, w);
      if (this.punchT > 0.6) this.punchT = -1;
    }
    // wapen wisselen: armen even omlaag, halverwege wisselt het wapen
    if (this.weapon !== this.prevWeapon) { this.switchT = 0.5; this.prevWeapon = this.weapon; }
    this.switchT = Math.max(0, this.switchT - dt);
    const sw = this.switchT > 0 ? Math.sin((0.5 - this.switchT) / 0.5 * Math.PI) : 0;
    this.holder.visible = this.weapon === 'p' && !(this.switchT > 0.25 && this.weapon === 'p');
    // bovenlijf volgt de kijkrichting
    this.reloadT = Math.max(0, this.reloadT - dt);
    const p = THREE.MathUtils.clamp(this.pitch, -0.9, 0.9);
    for (const [n, w] of [['Spine', 0.2], ['Spine1', 0.35], ['Spine2', 0.45]]) rot(this.bones[n], right, p * w);
    for (const [n, w] of [['Spine', 0.3], ['Spine1', 0.35], ['Spine2', 0.35]]) rot(this.bones[n], fwd, -this.lean * 0.32 * w);
    if (sw > 0) { rot(this.bones.RightArm, right, -0.9 * sw); rot(this.bones.LeftArm, right, -0.7 * sw); }
    if (this.reloadT > 0 && this.weapon === 'p') this.animateReload(RELOAD - this.reloadT, right, fwd);
    if (this.flinch > 0.01) {
      for (const [n, w] of [['Spine1', 0.4], ['Spine2', 0.5]]) rot(this.bones[n], this.flinchAxis, -0.4 * this.flinch * w);
      this.flinch *= Math.exp(-dt * 7);
    }
    this.recoil *= Math.exp(-dt * 14);
    if (this.recoil > 0.01) { rot(this.bones.RightHand, right, this.recoil * 0.6); rot(this.bones.RightForeArm, right, this.recoil * 0.4); }
  }
}

// Herladen (er is geen Mixamo-herlaadanimatie voor een pistool, dus met de hand gedaan):
// pistool kantelt naar binnen, linkerhand gaat naar de riem (nieuw magazijn), duwt het magazijn
// onderin de greep en trekt daarna de slede naar achteren.
RemoteAvatar.prototype.animateReload = function (t, right, fwd) {
  const s = THREE.MathUtils.smoothstep;
  const tilt = s(t, 0, 0.25) * (1 - s(t, 1.3, 1.6));
  rot(this.bones.RightHand, fwd, -0.55 * tilt);
  rot(this.bones.RightForeArm, right, 0.25 * tilt);
  this.root.updateMatrixWorld(true);
  const belt = this.bones.Hips.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.12).addScaledVector(right, -0.16);
  belt.y += 0.05;
  const mag = this.magWell.getWorldPosition(new THREE.Vector3()); mag.y -= 0.06;
  const rack = this.slideRear.getWorldPosition(new THREE.Vector3());
  let target, w;
  if (t < 0.55) { target = belt; w = s(t, 0.15, 0.45); }
  else if (t < 1.0) { target = belt.clone().lerp(mag, s(t, 0.55, 0.85)); w = 1; }
  else if (t < 1.35) { target = mag.clone().lerp(rack, s(t, 1.0, 1.15)); w = 1; if (t > 1.2) target.addScaledVector(fwd, -0.06 * s(t, 1.2, 1.3)); }
  else { target = rack; w = 1 - s(t, 1.35, 1.6); }
  if (w > 0.01) twoBone(this.arm, target, w, right.clone().negate());
};

// twee-botten-IK (schouder, elleboog, pols) met een gewicht; elleboog naar buiten/onder
function twoBone(A, target, w, out) {
  const wp = b => b.getWorldPosition(new THREE.Vector3());
  const S = wp(A.a), E = wp(A.f), W = wp(A.h);
  const T = W.clone().lerp(target, w);
  const toT = T.clone().sub(S); let d = toT.length();
  const max = (A.l1 + A.l2) * 0.999; if (d > max) { toT.multiplyScalar(max / d); d = max; }
  const dir = toT.clone().normalize();
  const pole = out.clone().add(new THREE.Vector3(0, -1, 0)).normalize();
  const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const cosA = THREE.MathUtils.clamp((A.l1 * A.l1 + d * d - A.l2 * A.l2) / (2 * A.l1 * d), -1, 1);
  const elbow = S.clone().addScaledVector(dir, A.l1 * cosA).addScaledVector(perp, A.l1 * Math.sqrt(1 - cosA * cosA));
  aim(A.a, E.sub(S).normalize(), elbow.clone().sub(S).normalize());
  const E2 = wp(A.f), W2 = wp(A.h);
  aim(A.f, W2.sub(E2).normalize(), S.clone().add(toT).sub(E2).normalize());
}
function aim(bone, from, to) {
  const d = new THREE.Quaternion().setFromUnitVectors(from, to);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(pq.clone().invert().multiply(d).multiply(pq));
  bone.updateMatrixWorld(true);
}

// bovenlijf-deel van een clip, los af te spelen over een andere animatie heen
function upperBody(clip, model) {
  const parts = [];
  for (const tr of clip.tracks) {
    const [name, prop] = tr.name.split('.');
    if (prop !== 'quaternion' || !/Spine|Neck|Head|Shoulder|Arm|Hand/.test(name)) continue;
    const bone = model.getObjectByName(name);
    if (bone) parts.push({ bone, it: tr.createInterpolant() });
  }
  // moment van de stoot: hand het verst naar voren (ruwe schatting: midden van de clip)
  const impact = clip.duration * 0.45;
  const q = new THREE.Quaternion();
  return {
    impact,
    apply(t, w) {
      const tt = THREE.MathUtils.clamp(t, 0, clip.duration);
      for (const p of parts) { q.fromArray(p.it.evaluate(tt)); p.bone.quaternion.slerp(q, w); }
    },
  };
}

const RELOAD = 1.6;
const TINTS = [0xffffff, 0xb9c9ff, 0xffc4b4, 0xc4f0b8, 0xf2e2a8, 0xe0c0ff];
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function rot(bone, axisWorld, angle) {
  if (!bone || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_q);
  const local = _v2.clone().copy(axisWorld).applyQuaternion(_q.invert()).normalize();
  bone.quaternion.premultiply(_q2.setFromAxisAngle(local, angle));
  bone.updateMatrixWorld(true);
}

function makeLabel(text, tint) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px Oswald, "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(13,15,18,0.55)';
  const w = Math.min(250, g.measureText(text).width + 24);
  g.fillRect(128 - w / 2, 12, w, 40);
  g.fillStyle = tint ? '#' + tint.getHexString() : '#e8e6e1'; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(0.8, 0.2, 1);
  return s;
}
