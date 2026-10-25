import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { smooth } from './inspect.js';

// Vuisten: armenmodel met jabs, links en rechts om en om.
// Krijgen handschoenen en mouwen zodat ze bij de armen van het pistool passen.

const MODEL = 'models/arms.glb';
const GLOVES = 'textures/arms_gloves.jpg';
const PUNCH_SPEED = 1.75;

export class Fists {
  constructor() {
    this.name = 'Vuisten';
    this.reach = 0.04;
    this.fov = 66;
    this.root = new THREE.Group();
    this.ready = false;
    this.side = 0;
    this.current = null;
    this.queued = false;
    this.hitstop = 0;
    this.onImpact = null;        // callback(side)
  }

  async load() {
    const [gltf, gloves] = await Promise.all([
      new GLTFLoader().loadAsync(MODEL),
      new THREE.TextureLoader().loadAsync(GLOVES),
    ]);
    gloves.colorSpace = THREE.SRGBColorSpace;
    gloves.flipY = false;                       // glTF-UV's
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material.map = gloves;
        o.material.roughness = 0.62;
        o.material.metalness = 0;
        o.material.needsUpdate = true;
      }
    });
    const camBone = model.getObjectByName('camera');
    const cp = new THREE.Vector3();
    model.updateMatrixWorld(true);
    camBone.getWorldPosition(cp);
    model.position.set(-cp.x, -cp.y, -cp.z);
    model.rotation.y = Math.PI;
    this.root.add(model);
    this.model = model;
    // naar ware grootte schalen rond het oog (hand ~9,5 cm van pols tot knokkel)
    {
      model.updateMatrixWorld(true);
      const w = model.getObjectByName('handR').getWorldPosition(new THREE.Vector3());
      const kn = model.getObjectByName('f_middle01R').getWorldPosition(new THREE.Vector3());
      const k = 0.095 / w.distanceTo(kn);
      model.scale.multiplyScalar(k); model.position.multiplyScalar(k);
      this.realScale = k;
    }

    this.mixer = new THREE.AnimationMixer(model);
    const clip = n => gltf.animations.find(a => a.name === n);
    this.clips = { idle: clip('guard_idle'), draw: clip('guard_draw'), jabR: clip('jab.R'), jabL: clip('jab.L') };

    // moment van maximale reikwijdte per jab bepalen
    this.impactT = {};
    for (const [key, bone] of [['jabR', 'handR'], ['jabL', 'handL']]) {
      const c = this.clips[key];
      const a = this.mixer.clipAction(c); a.play();
      const hand = model.getObjectByName(bone);
      let best = -1, bestT = c.duration * 0.5;
      const v = new THREE.Vector3();
      for (let i = 0; i <= 60; i++) {
        const t = c.duration * i / 60;
        this.mixer.setTime(t);
        model.updateMatrixWorld(true);
        hand.getWorldPosition(v); model.worldToLocal(v);
        if (v.z > best) { best = v.z; bestT = t; }
      }
      a.stop();
      this.impactT[key] = bestT;
    }
    this.mixer.setTime(0);
    this.idle = this.mixer.clipAction(this.clips.idle);
    // echte first person: de armen van dit model zijn alleen nog een "regisseur" voor de handen
    // van je eigen lichaam; zelf worden ze niet getekend
    model.traverse(o => { if (o.isMesh) o.visible = false; });
    this.handR = model.getObjectByName('handR');
    this.handL = model.getObjectByName('handL');
    this.knuckleR = model.getObjectByName('f_middle01R');
    this.knuckleL = model.getObjectByName('f_middle01L');
    // handoriëntatie in de bewakingshouding, t.o.v. de wapenwortel (voor de kalibratie)
    this.idle.reset().play(); this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const rq = new THREE.Quaternion(); this.root.getWorldQuaternion(rq); rq.invert();
    this.guardQ = {
      R: rq.clone().multiply(this.handR.getWorldQuaternion(new THREE.Quaternion())),
      L: rq.clone().multiply(this.handL.getWorldQuaternion(new THREE.Quaternion())),
    };
    this.idle.stop();
    this.ready = true;
  }

  equip() {
    this.current = null; this.queued = false; this.inspectT = -1;
    this.mixer.stopAllAction();
    this.drawAction = this.mixer.clipAction(this.clips.draw);
    this.drawAction.reset().setLoop(THREE.LoopOnce, 1);
    this.drawAction.clampWhenFinished = true;
    this.drawAction.play();
  }

  get busy() { return !!this.current; }

  // inspecteren (J): handen omdraaien en de handschoenen bekijken
  inspect() {
    if (!this.ready || this.current || this.inspectT >= 0) return;
    this.inspectT = 0;
  }

  applyInspect(dt) {
    const r = this.root;
    if (!(this.inspectT >= 0)) { r.position.set(0, 0, 0); r.quaternion.identity(); return; }
    this.inspectT += dt;
    const t = this.inspectT;
    const c = smooth(t, 0, 0.45) * (1 - smooth(t, 1.5, 1.95));
    const turn = smooth(t, 0.55, 1.1) * (1 - smooth(t, 1.4, 1.8));  // halverwege nog even verder draaien
    const wob = Math.sin(t * 6.1) * 0.006;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35 * c + wob, 0.12 * turn, -0.5 * c - 0.35 * turn, 'YXZ'));
    const pivot = new THREE.Vector3(0, -0.16, -0.32);
    r.quaternion.copy(q);
    r.position.copy(pivot).sub(pivot.clone().applyQuaternion(q)).add(new THREE.Vector3(0, 0.05 * c, 0.04 * c));
    if (t > 2) this.inspectT = -1;
  }
  get canSwitch() { return true; }

  // primaire actie = stoten
  primary(pressed) {
    this.inspectT = -1;
    if (!pressed && this.busy) return;   // ingedrukt houden: pas na afloop opnieuw
    if (this.current) {
      const c = this.current;
      if (c.action.time >= c.impact + 0.08) this.start(c.action);
      else this.queued = true;
      return;
    }
    this.start();
  }

  start(from = null) {
    const key = this.side === 0 ? 'jabR' : 'jabL';
    this.side = 1 - this.side;
    const action = this.mixer.clipAction(this.clips[key]);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.timeScale = PUNCH_SPEED;
    action.play();
    if (this.drawAction) { this.drawAction.stop(); this.drawAction = null; }
    const src = from || this.idle;
    if (!src.isRunning()) src.reset().play();
    src.crossFadeTo(action, 0.06, false);
    this.current = { action, impact: this.impactT[key], fired: false, side: key === 'jabR' ? 'R' : 'L' };
    this.queued = false;
  }

  doHitstop(sec) { this.hitstop = sec; }

  update(dt) {
    let mdt = dt;
    if (this.hitstop > 0) { this.hitstop -= dt; mdt = dt * 0.12; }
    this.mixer.update(mdt);
    this.applyInspect(dt);

    const d = this.drawAction;
    if (d && d.time >= this.clips.draw.duration - 0.2) {
      this.idle.reset().play();
      d.crossFadeTo(this.idle, 0.2, false);
      this.drawAction = null;
    }
    const c = this.current;
    if (c && !c.fired && c.action.time >= c.impact) {
      c.fired = true;
      this.onImpact?.(c.side);
    }
    if (c && c.action.time >= c.action.getClip().duration - 0.28) {
      this.current = null;
      if (this.queued) { this.queued = false; this.start(c.action); }
      else { this.idle.reset().play(); c.action.crossFadeTo(this.idle, 0.16, false); }
    }
  }
}
