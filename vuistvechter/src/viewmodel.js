import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Armen in beeld ("viewmodel"). Worden in een eigen scène met eigen camera getekend,
// over de wereld heen, zodat ze nooit door een muur steken en een eigen FOV hebben.

const MODEL = 'models/arms.glb';   // relatief aan de pagina
const PUNCH_SPEED = 1.75;   // jab-animaties sneller afspelen dan in het bestand

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.01, 10);
    this.camera.rotation.x = -0.04;
    this.scene.add(new THREE.HemisphereLight(0xf2efe9, 0x4a4038, 1.5));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
    key.position.set(0.6, 1.5, 0.8); this.scene.add(key);

    this.sway = new THREE.Group();   // traagheid + bob + landing
    this.scene.add(this.sway);
    this.ready = false;
    this.side = 0;                   // 0 = rechts, 1 = links (om en om)
    this.current = null;             // lopende stoot
    this.queued = false;
    this.hitstop = 0;
    this.swayRot = new THREE.Vector2();
    this.swayPos = new THREE.Vector2();
    this.onImpact = null;            // callback(side) op het moment dat de vuist het verst is
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material) { o.material.roughness = 0.75; o.material.metalness = 0; }
      }
    });
    // de "camera"-bot uit het model ligt op 1,743 m; die zetten we in de oorsprong
    const camBone = model.getObjectByName('camera');
    const cp = new THREE.Vector3();
    model.updateMatrixWorld(true);
    camBone.getWorldPosition(cp);
    model.position.set(-cp.x, -cp.y, -cp.z);
    model.rotation.y = Math.PI;          // model kijkt naar +z, three-camera naar -z
    this.sway.add(model);
    this.model = model;

    this.mixer = new THREE.AnimationMixer(model);
    const clip = n => gltf.animations.find(a => a.name === n);
    this.clips = { idle: clip('guard_idle'), draw: clip('guard_draw'), jabR: clip('jab.R'), jabL: clip('jab.L') };

    // moment van maximale reikwijdte per jab bepalen door de animatie af te tasten
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
    this.drawAction = this.mixer.clipAction(this.clips.draw);
    this.drawAction.setLoop(THREE.LoopOnce, 1);
    this.drawAction.clampWhenFinished = true;
    this.drawAction.play();
    this.ready = true;
  }

  // probeert een stoot te beginnen; anders wordt hij in de wachtrij gezet
  punch() {
    if (!this.ready) return;
    if (this.current) {
      // na het raakmoment mag de volgende stoot er al in (combo)
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
    if (!src.isRunning()) { src.reset().play(); }
    src.crossFadeTo(action, 0.06, false);
    this.current = { action, impact: this.impactT[key], fired: false, side: key === 'jabR' ? 'R' : 'L' };
    this.queued = false;
  }

  doHitstop(sec) { this.hitstop = sec; }

  get busy() { return !!this.current; }

  update(dt, s) {
    if (!this.ready) return;
    // hitstop: animatie heel even bijna stil zetten voor een gevoel van impact
    let mdt = dt;
    if (this.hitstop > 0) { this.hitstop -= dt; mdt = dt * 0.12; }
    this.mixer.update(mdt);

    // armen "trekken" bij het begin, daarna de dekking
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
    // aan het eind van de stoot terug naar de dekking (of de volgende stoot uit de wachtrij)
    if (c && c.action.time >= c.action.getClip().duration - 0.28) {
      this.current = null;
      if (this.queued) { this.queued = false; this.start(c.action); }
      else {
        this.idle.reset().play();
        c.action.crossFadeTo(this.idle, 0.16, false);
      }
    }

    // traagheid: armen lopen iets achter op de muis
    const k = 1 - Math.exp(-dt * 14);
    const tx = THREE.MathUtils.clamp(-s.mouseDX * 0.0009, -0.09, 0.09);
    const ty = THREE.MathUtils.clamp(-s.mouseDY * 0.0009, -0.07, 0.07);
    this.swayRot.x += (ty - this.swayRot.x) * k;
    this.swayRot.y += (tx - this.swayRot.y) * k;
    this.swayPos.x += (tx * 0.25 - this.swayPos.x) * k;
    this.swayPos.y += (ty * 0.25 - this.swayPos.y) * k;

    // loop-bob, sprint-houding en landing
    const amt = s.bobAmount;
    const bx = Math.sin(s.bobPhase) * 0.011 * amt;
    const by = -Math.abs(Math.cos(s.bobPhase)) * 0.013 * amt;
    const sprint = this.sprintLerp = (this.sprintLerp || 0) + ((s.sprint && !c ? 1 : 0) - (this.sprintLerp || 0)) * (1 - Math.exp(-dt * 8));
    this.sway.position.set(bx + this.swayPos.x - sprint * 0.02, by + this.swayPos.y + s.land * 0.5 - sprint * 0.05, sprint * 0.02);
    this.sway.rotation.set(this.swayRot.x - sprint * 0.16 + s.land * 0.4, this.swayRot.y, this.swayRot.y * 0.8 + bx * 2 + sprint * 0.08);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
