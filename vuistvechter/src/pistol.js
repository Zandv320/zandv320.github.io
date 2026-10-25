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
  hide: [176, 187], ready: [187, 233], ambient: [234, 264],
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
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2);
    this.root.add(this.flashLight);
    this.heat = 0;           // loopt op bij snel schieten; boven een drempel gaat de loop roken

    this.buildInspect(full);
    this.ready = true;
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
    this.muzzle.getWorldPosition(this.flashLight.position);
    this.root.worldToLocal(this.flashLight.position);
    this.flashLight.intensity = 1.4;
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
      this.flashLight.intensity = Math.max(0, this.flashTime / 0.055) * 1.4;
      if (this.flashTime <= 0) this.flashLight.intensity = 0;
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

