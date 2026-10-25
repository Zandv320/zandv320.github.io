import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MuzzleFlash } from './flash.js';
import { buildPoseBlendClip, smooth } from './inspect.js';

// Pistool (Beretta) met armen in handschoenen. Het model heeft één lange animatie;
// die knippen we op in losse clips (frames op 30 fps, volgens de maker):
// fire 0-11, reloadA 12-82, firelast 83-94, reloadB 95-175, hide 176-187, ready 187-233, ambient 234-264

const MODEL = 'models/pistol.glb';
const FPS = 30;
const RANGES = {
  fire: [0, 11], reloadA: [12, 82], firelast: [83, 94], reloadB: [95, 175],
  hide: [176, 187], ready: [187, 233],
  // stilstaan: de originele 'ambient' (234-264) pompt het wapen elke seconde ~2 cm heen en weer;
  // we houden één pose vast zonder te bewegen
  ambient: [239, 242],
};

// kanteling en verschuiving tijdens het inspecteren (radialen / meters in viewmodel-ruimte)
export const CANT = { pitch: 0.12, yaw: 0.12, roll: 0.5, x: 0.05, y: 0.035, z: -0.03 };

export const PISTOL_STATS = {
  magSize: 12,
  damage: 34,
  fireDelay: 0.16,        // minimale tijd tussen schoten (s)
  spread: 0.004,          // basisafwijking in radialen
  recoil: 0.022,          // camerakick omhoog per schot
  range: 120,
};

export class Pistol {
  constructor(audio) {
    this.name = 'Pistool';
    this.fov = 56;
    this.audio = audio;
    this.root = new THREE.Group();
    this.ready = false;
    this.mag = PISTOL_STATS.magSize;
    this.reserve = 48;
    this.state = 'idle';     // idle | fire | reload | ready
    this.cooldown = 0;
    this.timers = [];
    this.onFire = null;      // callback() voor hitscan en effecten
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material.name === 'arms') o.material.envMapIntensity = 0.5;
        else o.material.envMapIntensity = 1.2;
      }
    });
    // camera van het viewmodel zit op (0.04, 0.2, -0.12) in modelruimte, kijkend naar +z
    model.rotation.y = Math.PI;
    model.position.set(0.04, -0.2, -0.12);
    this.root.add(model);
    this.model = model;
    // vuurmond: voorkant van de slede, opgezocht in rustpose
    this.mixer = new THREE.AnimationMixer(model);
    const full = gltf.animations[0];
    this.clips = {};
    for (const [k, [a, b]] of Object.entries(RANGES)) this.clips[k] = THREE.AnimationUtils.subclip(full, k, a, b, FPS);
    this.actions = {};
    for (const k of Object.keys(this.clips)) {
      const act = this.mixer.clipAction(this.clips[k]);
      if (k !== 'ambient') { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
      this.actions[k] = act;
      if (k === 'ambient') act.timeScale = 0;      // één vaste pose: helemaal stil
    }

    // vastgemaakt aan het frame (niet de slede, die schiet naar achter bij elk schot)
    const frame = model.getObjectByName('base');
    this.actions.ambient.play();
    this.mixer.update(0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model.getObjectByName('slide_beretta_0'), true);
    // vuurmond = midden van de voorkant van de slede (model kijkt naar +z, dus max z in modelruimte)
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const local = box.clone().applyMatrix4(inv);
    const muzzleModel = new THREE.Vector3((local.min.x + local.max.x) / 2, (local.min.y + local.max.y) / 2 + 0.006, local.max.z + 0.01);
    const muzzleWorld = muzzleModel.clone().applyMatrix4(model.matrixWorld);
    this.muzzle = new THREE.Object3D();
    frame.add(this.muzzle);
    frame.worldToLocal(this.muzzle.position.copy(muzzleWorld));
    // het model is in centimeters geschaald; de flits moet in meters, dus terugschalen
    const ws = new THREE.Vector3();
    this.muzzle.updateMatrixWorld(true);
    this.muzzle.getWorldScale(ws);
    this.muzzleScale = 1 / ws.x;
    // looprichting (model +z) uitgedrukt in de ruimte van het frame
    const fq = new THREE.Quaternion(); frame.getWorldQuaternion(fq);
    const mq = new THREE.Quaternion(); model.getWorldQuaternion(mq);
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(mq).applyQuaternion(fq.invert());
    this.flash = new MuzzleFlash(axis, this.muzzleScale);
    this.muzzle.add(this.flash.group);
    // lichtje bij de flits, zodat hand en wapen even oplichten
    // geen eigen lamp: elke extra lichtbron maakt álle pixels duurder; de flits gebruikt het
    // gedeelde flitslicht uit effects.js
    this.heat = 0;           // loopt op bij snel schieten; boven een drempel gaat de loop roken

    this.buildInspect(full);
    this.buildFirstPerson();
    this.ready = true;
  }

  // ---------- Richten ----------
  // Geweerframe (z = loop, y = boven) en de houding om over het vizier te richten.
  buildFirstPerson() {
    const model = this.model;
    this.actions.ambient.reset().play(); this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const rel = o => new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
    const base = model.getObjectByName('base');
    this.base = base;
    const baseRel = rel(base), baseInv = baseRel.clone().invert();
    // loop: van midden slede naar vuurmond; boven: van de greep naar de slede
    const slideBox = new THREE.Box3().setFromObject(model.getObjectByName('slide_beretta_0'), true).applyMatrix4(rootInv);
    const gunBox = new THREE.Box3().setFromObject(model.getObjectByName('pistol'), true).applyMatrix4(rootInv);
    // frame met greep (zonder losse hulzen/kogels) bepaalt waar "onder" is
    const frameBox = new THREE.Box3().setFromObject(model.getObjectByName('base_beretta_0'), true).applyMatrix4(rootInv);
    const muzzleRoot = new THREE.Vector3(); this.muzzle.getWorldPosition(muzzleRoot).applyMatrix4(rootInv);
    const slideC = slideBox.getCenter(new THREE.Vector3()), gunC = frameBox.getCenter(new THREE.Vector3());
    const zAxis = muzzleRoot.clone().sub(slideC).normalize();
    const yAxis = slideC.clone().sub(gunC); yAxis.addScaledVector(zAxis, -yAxis.dot(zAxis)).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    const gunRootQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    const baseRootQ = new THREE.Quaternion(); baseRel.decompose(new THREE.Vector3(), baseRootQ, new THREE.Vector3());
    this.gunOffQ = baseRootQ.clone().invert().multiply(gunRootQ);           // geweerframe t.o.v. 'base'
    this.gunCenter = gunC.clone().applyMatrix4(baseInv);                     // in 'base'-ruimte
    // lengte van het wapen in meters (langs de loop)
    const corners = [];
    for (const x of [gunBox.min.x, gunBox.max.x]) for (const y of [gunBox.min.y, gunBox.max.y]) for (const z of [gunBox.min.z, gunBox.max.z]) corners.push(new THREE.Vector3(x, y, z).dot(zAxis));
    this.gunLength = Math.max(...corners) - Math.min(...corners);

    // linkerhand van het model t.o.v. het geweerframe (in rust)
    this.handL = model.getObjectByName('L_wrist_03');
    this.handR = model.getObjectByName('R_wrist_028');
    const gf = this.gunFrame(new THREE.Vector3(), new THREE.Quaternion());
    const lp = new THREE.Vector3(), lq = new THREE.Quaternion();
    this.handL.getWorldPosition(lp); this.handL.getWorldQuaternion(lq);
    const gqi = gf.quat.clone().invert();
    this.leftRel = { pos: lp.sub(gf.pos).applyQuaternion(gqi), quat: gqi.clone().multiply(lq) };
    this.rightRel = { quat: gqi.clone().multiply(this.handR.getWorldQuaternion(new THREE.Quaternion())) };
    // de greep zelf opmeten: alle hoekpunten van het frame onder de slede en achteraan
    // (de trekkerbeugel zit voorin). Midden = waar de hand omheen sluit, as = richting van de greep.
    {
      const mesh = model.getObjectByName('base_beretta_0');
      const pos = mesh.geometry.attributes.position, gi = gunRootQ.clone().invert();
      const m = rel(mesh), v = new THREE.Vector3(), pts = [];
      const slideBottom = new THREE.Vector3().subVectors(slideBox.min, gunC).applyQuaternion(gi).y;
      let zMin = Infinity;
      const all = [];
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m).sub(gunC).applyQuaternion(gi);
        all.push(v.clone()); zMin = Math.min(zMin, v.z);
      }
      let yMin = Infinity; for (const p of all) yMin = Math.min(yMin, p.y);
      for (const p of all) if (p.y < slideBottom - 0.025 && p.y > yMin + 0.01 && p.z < zMin + 0.075) pts.push(p);
      const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); c.divideScalar(Math.max(1, pts.length));
      // hoofdrichting (eenvoudige PCA via machtsiteratie)
      let ax = new THREE.Vector3(0, -1, -0.2).normalize();
      for (let it = 0; it < 12; it++) {
        const n = new THREE.Vector3();
        for (const p of pts) { const d = p.clone().sub(c); n.addScaledVector(d, d.dot(ax)); }
        ax = n.normalize();
      }
      if (ax.y > 0) ax.negate();                       // van boven naar onder
      this.grip = { center: c, axis: ax, count: pts.length };   // in geweerframe (oorsprong = midden frame)
    }
    // knokkel van de middelvinger: daaromheen sluit de hand om de greep
    this.knuckleR = model.getObjectByName('R_middle1_037');
    this.knuckleL = model.getObjectByName('L_middle1_012');

    // richten: vizier (achterkant bovenop de slede) recht voor het oog, loop naar het kruisje
    let top = 0;
    for (const x of [slideBox.min.x, slideBox.max.x]) for (const y of [slideBox.min.y, slideBox.max.y]) for (const z of [slideBox.min.z, slideBox.max.z]) top = Math.max(top, new THREE.Vector3(x, y, z).sub(slideC).dot(yAxis));
    const sight = slideC.clone().addScaledVector(yAxis, top + 0.004);
    sight.addScaledVector(zAxis, -this.gunLength * 0.38);
    const tiltInv = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, 0, 0));
    const want = tiltInv.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    const q = want.multiply(gunRootQ.clone().invert());
    const target = new THREE.Vector3(0, 0, -0.36).applyQuaternion(tiltInv);
    this.adsPose = { quat: q, pos: target.sub(sight.clone().applyQuaternion(q)) };
  }

  // wereldpositie (midden van het wapen) en -oriëntatie van het geweerframe
  gunFrame(pos, quat) {
    this.base.updateWorldMatrix(true, false);
    this.base.getWorldQuaternion(quat).multiply(this.gunOffQ);
    pos.copy(this.gunCenter).applyMatrix4(this.base.matrixWorld);
    return { pos, quat };
  }

  // ---------- Inspecteren (J): slede een stukje naar achter om te zien of er een patroon in de kamer zit ----------
  buildInspect(full) {
    const model = this.model;
    const SLIDE_REST = model.getObjectByName('slide').position.z;    // vooraan (cm)
    const SLIDE_BACK = -1.217;                                       // helemaal open (uit de animatie)
    const PEEK = SLIDE_REST - 1.7;                                   // ~1,7 cm open: net genoeg om de kamer te zien
    const D = 2.1;
    this.inspectDur = D;
    // pose B = linkerhand over de slede (frame 145 uit de herlaadanimatie)
    const handOnSlide = (t) => smooth(t, 0.08, 0.42) * (1 - smooth(t, 1.62, 2.0));
    // slede: rustig naar achter trekken, even vasthouden, dan loslaten (veer duwt hem snel terug)
    this.slideAt = (t, locked) => {
      if (locked) return SLIDE_BACK;
      const pull = smooth(t, 0.42, 0.72) * 0.92 + smooth(t, 0.72, 1.3) * 0.08;
      const release = smooth(t, 1.42, 1.5);
      return SLIDE_REST + (PEEK - SLIDE_REST) * pull * (1 - release);
    };
    const make = locked => buildPoseBlendClip({
      source: full, tA: 240 / FPS, tB: 145 / FPS, duration: D, fps: FPS, name: locked ? 'inspectLocked' : 'inspect',
      weight: handOnSlide,
      useB: n => n.startsWith('L_') || n.startsWith('R_') || n === 'pistol' || n === 'Root',
      overrides: { 'slide.position': (t, v) => [v[0], v[1], this.slideAt(t, locked)] },
    });
    for (const locked of [false, true]) {
      const clip = make(locked);
      const act = this.mixer.clipAction(clip);
      act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true;
      this.actions[clip.name] = act; this.clips[clip.name] = clip;
    }
    // draaipunt voor het kantelen: de greep van het pistool
    model.updateMatrixWorld(true);
    this.pivot = new THREE.Vector3();
    model.getObjectByName('base').getWorldPosition(this.pivot);
    this.root.worldToLocal(this.pivot);
    this.chamber = ['shell', 'bullet_2_2'].map(n => model.getObjectByName(n)).filter(Boolean);
    this.inspectT = -1;
  }

  inspect() {
    if (!this.ready || this.state !== 'idle' || this.cooldown > 0) return;
    const locked = this.mag === 0;                  // slede staat al open na het laatste schot
    this.state = 'inspect';
    this.inspectT = 0;
    this.play(locked ? 'inspectLocked' : 'inspect', 0.2);
    // patroon in de kamer alleen als er nog munitie is
    for (const o of this.chamber) o.visible = this.mag > 0;
    if (!locked) {
      this.at(0.5, () => this.audio.play('slide', { gain: 0.32, rate: 1.3, jitter: 0.02 }));
      this.at(1.43, () => this.audio.play('slide', { gain: 0.55, rate: 1.05, jitter: 0.02 }));
    }
  }

  endInspect(fade = 0.12) {
    if (this.state !== 'inspect') return;
    this.clearTimers();
    for (const o of this.chamber) o.visible = true;
    this.inspectT = -1;
    this.state = 'idle';
    if (this.mag === 0) { this.play('firelast', fade); this.actions.firelast.time = this.clips.firelast.duration; }
    else this.play('ambient', fade);
  }

  // kantelen rond de greep: loop iets naar binnen, bovenkant naar links zodat je de uitwerppoort ziet
  applyCant(dt) {
    const r = this.root;
    if (this.inspectT < 0) { r.position.set(0, 0, 0); r.quaternion.identity(); return; }
    this.inspectT += dt;
    const t = this.inspectT;
    const c = smooth(t, 0.05, 0.55) * (1 - smooth(t, 1.55, 2.05));
    // kleine trilling van de handen tijdens het vasthouden
    const wob = Math.sin(t * 7.3) * 0.004 + Math.sin(t * 4.1 + 1) * 0.003;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(CANT.pitch * c + wob, CANT.yaw * c, CANT.roll * c + wob * 0.5, 'YXZ'));
    r.quaternion.copy(q);
    const rp = this.pivot.clone().applyQuaternion(q);
    r.position.copy(this.pivot).sub(rp).add(new THREE.Vector3(CANT.x * c, CANT.y * c, CANT.z * c));
  }

  play(name, fade = 0.05) {
    const next = this.actions[name];
    const prev = this.currentAction;
    next.reset().play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    this.currentAction = next;
    return next;
  }

  equip() {
    this.clearTimers();
    this.inspectT = -1;
    for (const o of this.chamber || []) o.visible = true;
    this.mixer.stopAllAction();
    this.currentAction = null;
    this.state = 'ready';
    this.play('ready', 0);
    this.audio.play('slide', { gain: 0.6 });
  }

  get busy() { return this.state === 'fire'; }
  get canSwitch() { return true; }

  primary(pressed) {
    if (!pressed) return;                          // halfautomaat: elke klik één schot
    if (this.state === 'inspect') this.endInspect(0.05);
    if (!this.ready || this.state === 'reload' || this.state === 'ready') return;
    if (this.cooldown > 0) return;
    if (this.mag <= 0) {
      this.audio.play('dry', { gain: 0.8 });
      this.cooldown = 0.25;
      if (this.reserve > 0) this.reload();
      return;
    }
    this.mag--;
    this.cooldown = PISTOL_STATS.fireDelay;
    this.state = 'fire';
    this.play(this.mag === 0 ? 'firelast' : 'fire', 0.02);
    this.audio.play('shot', { gain: 0.9, jitter: 0.03 });
    this.flashTime = 0.055;
    this.flash.fire();
    this.heat = Math.min(14, this.heat + 1);
    this.onFire?.();
  }

  reload() {
    if (this.state === 'inspect') this.endInspect(0.1);
    if (this.state === 'reload' || this.mag >= PISTOL_STATS.magSize || this.reserve <= 0) return;
    const empty = this.mag === 0;
    const clip = empty ? 'reloadB' : 'reloadA';
    this.state = 'reload';
    this.play(clip, 0.1);
    // geluiden ongeveer gelijk met de animatie
    this.at(0.3, () => this.audio.play('magout', { gain: 0.8 }));
    this.at(1.25, () => this.audio.play('magin', { gain: 0.9 }));
    if (empty) this.at(2.05, () => this.audio.play('slide', { gain: 0.8 }));
    this.at(this.clips[clip].duration - 0.05, () => {
      const need = PISTOL_STATS.magSize - this.mag;
      const take = Math.min(need, this.reserve);
      this.mag += take; this.reserve -= take;
    });
  }

  at(t, fn) { this.timers.push({ t, fn }); }
  clearTimers() { this.timers.length = 0; }

  update(dt) {
    this.mixer.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter(t => !t.done);

    this.flash.update(dt);
    if (this.flashTime > 0) {
      this.flashTime -= dt;
    }
    this.heat = Math.max(0, this.heat - dt * 0.9);
    this.applyCant(dt);
    if (this.state === 'inspect' && this.inspectT >= this.inspectDur) this.endInspect(0.15);

    // klaar met een eenmalige animatie? terug naar stilstaan
    const a = this.currentAction;
    if (this.state !== 'inspect' && a && a !== this.actions.ambient && a.time >= a.getClip().duration - 0.001) {
      if (a === this.actions.firelast) { this.state = 'idle'; return; }  // slede blijft open tot herladen
      this.state = 'idle';
      this.play('ambient', 0.15);
    }
    if (this.state === 'fire' && this.cooldown <= 0 && a === this.actions.fire && a.time > 0.2) this.state = 'idle';
  }
}

