import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Pistool (Beretta) met armen in handschoenen. Het model heeft één lange animatie;
// die knippen we op in losse clips (frames op 30 fps, volgens de maker):
// fire 0-11, reloadA 12-82, firelast 83-94, reloadB 95-175, hide 176-187, ready 187-233, ambient 234-264

const MODEL = 'models/pistol.glb';
const FPS = 30;
const RANGES = {
  fire: [0, 11], reloadA: [12, 82], firelast: [83, 94], reloadB: [95, 175],
  hide: [176, 187], ready: [187, 233], ambient: [234, 264],
};

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

    const slide = model.getObjectByName('slide');
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
    slide.add(this.muzzle);
    slide.worldToLocal(this.muzzle.position.copy(muzzleWorld));
    this.flash = makeFlash();
    this.muzzle.add(this.flash);
    this.ready = true;
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
    this.audio.play('shot', { gain: 0.75, jitter: 0.04 });
    this.flashTime = 0.05;
    this.flash.visible = true;
    this.flash.sprite.material.rotation = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.5;
    this.flash.scale.set(s, s, s);
    this.onFire?.();
  }

  reload() {
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

    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) this.flash.visible = false; }

    // klaar met een eenmalige animatie? terug naar stilstaan
    const a = this.currentAction;
    if (a && a !== this.actions.ambient && a.time >= a.getClip().duration - 0.001) {
      if (a === this.actions.firelast) { this.state = 'idle'; return; }  // slede blijft open tot herladen
      this.state = 'idle';
      this.play('ambient', 0.15);
    }
    if (this.state === 'fire' && this.cooldown <= 0 && a === this.actions.fire && a.time > 0.2) this.state = 'idle';
  }
}

// ster-vormige mondingsflits als sprite (additief)
function makeFlash() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,250,220,1)');
  grd.addColorStop(0.18, 'rgba(255,210,120,0.95)');
  grd.addColorStop(0.45, 'rgba(255,140,40,0.35)');
  grd.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,220,150,0.7)';
  for (let i = 0; i < 6; i++) {
    g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 3 + 0.3);
    g.beginPath(); g.moveTo(0, -5); g.lineTo(60, 0); g.lineTo(0, 5); g.fill(); g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.scale.set(0.09, 0.09, 0.09);
  s.renderOrder = 10;
  // in een groep, zodat we de groep kunnen schalen en aan/uit zetten
  const grp = new THREE.Group(); grp.add(s);
  grp.visible = false;
  grp.sprite = s;
  return grp;
}
