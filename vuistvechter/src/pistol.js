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
    this.flash = makeFlash();
    this.muzzle.add(this.flash);
    // lichtje bij de flits, zodat hand en wapen even oplichten
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2);
    this.root.add(this.flashLight);
    this.heat = 0;           // loopt op bij snel schieten; boven een drempel gaat de loop roken
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
    this.audio.play('shot', { gain: 0.9, jitter: 0.03 });
    this.flashTime = 0.055;
    this.flash.visible = true;
    this.flash.sprite.material.rotation = Math.random() * Math.PI;
    this.flash.core.material.rotation = Math.random() * Math.PI;
    const s = (0.85 + Math.random() * 0.45) * this.muzzleScale;
    this.flash.scale.set(s, s, s);
    this.muzzle.getWorldPosition(this.flashLight.position);
    this.root.worldToLocal(this.flashLight.position);
    this.flashLight.intensity = 1.4;
    this.heat = Math.min(14, this.heat + 1);
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

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flashLight.intensity = Math.max(0, this.flashTime / 0.055) * 1.4;
      if (this.flashTime <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
    }
    this.heat = Math.max(0, this.heat - dt * 0.45);

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

// mondingsflits: felle kern + stervormige uitbarsting, additief en altijd zichtbaar
function sprite(tex, size) {
  const m = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, size);
  s.renderOrder = 10;
  return s;
}
function makeFlash() {
  const star = document.createElement('canvas'); star.width = star.height = 256;
  let g = star.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 7; i++) {
    g.save(); g.rotate(i * Math.PI * 2 / 7 + Math.random() * 0.3);
    const len = 80 + Math.random() * 45;
    const grd = g.createLinearGradient(0, 0, len, 0);
    grd.addColorStop(0, 'rgba(255,235,170,1)'); grd.addColorStop(0.5, 'rgba(255,160,50,0.7)'); grd.addColorStop(1, 'rgba(255,90,10,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(len * 0.5, -6, len, 0); g.quadraticCurveTo(len * 0.5, 6, 0, 12); g.fill();
    g.restore();
  }
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 90);
  glow.addColorStop(0, 'rgba(255,200,110,0.9)'); glow.addColorStop(0.4, 'rgba(255,130,40,0.35)'); glow.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.fill();
  const core = document.createElement('canvas'); core.width = core.height = 64;
  g = core.getContext('2d');
  const cg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  cg.addColorStop(0, 'rgba(255,255,245,1)'); cg.addColorStop(0.35, 'rgba(255,240,190,0.9)'); cg.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = cg; g.fillRect(0, 0, 64, 64);
  const t1 = new THREE.CanvasTexture(star), t2 = new THREE.CanvasTexture(core);
  t1.colorSpace = t2.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  grp.sprite = sprite(t1, 0.16);
  grp.core = sprite(t2, 0.06);
  grp.add(grp.sprite, grp.core);
  grp.visible = false;
  return grp;
}
