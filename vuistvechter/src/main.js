import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { buildLevel } from './level.js';
import { Player, P } from './player.js';
import { Viewmodel } from './viewmodel.js';
import { Fists } from './fists.js';
import { Pistol, PISTOL_STATS } from './pistol.js';
import { Effects } from './effects.js';

// ---------- Renderer ----------
const host = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f12);
scene.fog = new THREE.Fog(0x0d0f12, 25, 55);

// lichte omgevingsreflectie, vooral zichtbaar op metaal
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const BASE_FOV = 78, SPRINT_FOV = 86;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 120);
camera.rotation.order = 'YXZ';

const level = buildLevel(scene, renderer);
const player = new Player(level.spawn, level.colliders);
const input = new Input(renderer.domElement);
const audio = new Audio();
audio.volume = input.settings.volume;
const effects = new Effects(scene);

// ---------- Wapens ----------
const vm = new Viewmodel(renderer);
const fists = new Fists();
const pistol = new Pistol(audio);
vm.add(fists); vm.add(pistol);
const owned = [fists];          // volgorde = toets 1, 2, ...
let lastWeapon = fists;
fists.load().then(() => vm.set(fists)).catch(e => console.error('Vuisten laden mislukt', e));
pistol.load().catch(e => console.error('Pistool laden mislukt', e));

// pistool om op te pakken: alleen het wapen uit hetzelfde model, zonder armen
let pickup = null;
new GLTFLoader().loadAsync('models/pistol.glb').then(gltf => {
  const gun = gltf.scene.getObjectByName('pistol').clone(true);
  gun.position.set(0, 0, 0); gun.rotation.set(0, 0, 0); gun.scale.set(1, 1, 1);
  gun.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gun);
  const holder = new THREE.Group();
  const center = box.getCenter(new THREE.Vector3());
  gun.position.sub(center);
  holder.add(gun);
  const size = box.getSize(new THREE.Vector3());
  holder.scale.setScalar(0.3 / Math.max(size.x, size.y, size.z));    // ca. 30 cm lang, iets groter dan echt zodat je hem ziet
  holder.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const spin = new THREE.Group(); spin.add(holder);
  spin.position.copy(level.pickupSpot);
  scene.add(spin);
  // zacht lichtje zodat je hem ziet liggen
  const glow = new THREE.PointLight(0xffd28a, 1.2, 1.6, 2);
  glow.position.set(0, 0.25, 0); spin.add(glow);
  pickup = spin;
}).catch(() => {});

function selectWeapon(w) {
  if (!w || !owned.includes(w) || w === vm.current) return;
  if (vm.switchTo(w)) { lastWeapon = vm.current; }
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const overlay = $('overlay'), startBtn = $('start');
const sens = $('sens'), vol = $('vol');
const hitmarker = $('hitmarker'), speedo = $('speed');
const ammoEl = $('ammo'), ammoMag = $('ammo-mag'), ammoRes = $('ammo-res'), weaponEl = $('weapon');
const toastEl = $('toast'), crosshair = $('crosshair'), scoreEl = $('score');
sens.value = input.settings.gevoeligheid;
vol.value = input.settings.volume;
const showSettings = () => {
  $('sens-out').textContent = Number(sens.value).toFixed(2) + '×';
  $('vol-out').textContent = Math.round(vol.value * 100) + '%';
};
showSettings();
sens.addEventListener('input', () => { input.settings.gevoeligheid = Number(sens.value); input.save(); showSettings(); });
vol.addEventListener('input', () => { input.settings.volume = Number(vol.value); audio.setVolume(input.settings.volume); input.save(); showSettings(); });
document.querySelector('.settings').addEventListener('click', e => e.stopPropagation());

const go = () => { audio.start(); input.lock(); };
overlay.addEventListener('click', go);
startBtn.addEventListener('click', e => { e.stopPropagation(); go(); });
input.onLockChange = locked => { overlay.hidden = locked; startBtn.textContent = 'Verder spelen'; };

let toastTimer = 0;
function toast(text, sec = 2.6) { toastEl.textContent = text; toastEl.style.opacity = '1'; toastTimer = sec; }

// ---------- Effecten ----------
let trauma = 0;
let landDip = 0, landVel = 0;
let fov = BASE_FOV;
let hitTimer = 0;
let recoil = 0, recoilVel = 0;   // visuele terugslag van de camera (rad)
let vmKick = 0;                  // terugslag van het wapen in beeld
let bloom = 0;                   // extra spreiding na schieten
const shakeSeed = Math.random() * 100;

const ray = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const tmpDir = new THREE.Vector3();

function showHit() { hitTimer = 0.16; }

// stoot: korte straal vanuit de camera
fists.onImpact = () => {
  ray.far = 1.7;
  ray.setFromCamera(center, camera);
  const hit = ray.intersectObjects(level.hittables, false)[0];
  if (!hit) { audio.whoosh(0.22); trauma = Math.min(1, trauma + 0.08); return; }
  camera.getWorldDirection(tmpDir);
  if (hit.object.userData.bag) {
    level.bag.hit(tmpDir.x, tmpDir.z, 2.6);
    audio.play('hit', { gain: 0.9 });
    trauma = Math.min(1, trauma + 0.32);
    fists.doHitstop(0.07);
  } else if (hit.object.userData.target) {
    if (level.targets.hit(hit.object.userData.target)) audio.ping(0.2);
    audio.play('hit', { gain: 0.5, rate: 1.2 });
    fists.doHitstop(0.06);
  } else {
    audio.play('hit', { gain: 0.45, rate: 0.75 });
    trauma = Math.min(1, trauma + 0.42);
    fists.doHitstop(0.09);
  }
  showHit();
};

// schot: hitscan met spreiding
function currentSpread() {
  const speed01 = Math.min(1, player.horizontalSpeed() / P.WALK);
  return PISTOL_STATS.spread + speed01 * 0.012 + (player.onGround ? 0 : 0.035) + bloom;
}
pistol.onFire = () => {
  const spread = currentSpread();
  ray.far = PISTOL_STATS.range;
  ray.setFromCamera(center, camera);
  // willekeurige afwijking binnen een kegel
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  ray.ray.direction.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();

  const hit = ray.intersectObjects(level.hittables, false)[0];
  if (hit) {
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : ray.ray.direction.clone().negate();
    if (hit.object.userData.bag) {
      level.bag.hit(ray.ray.direction.x, ray.ray.direction.z, 0.9);
      audio.play('hit', { gain: 0.35, rate: 1.1 });
      effects.burst(hit.point, n, 0x5a1612, 8);
      showHit();
    } else if (hit.object.userData.target) {
      if (level.targets.hit(hit.object.userData.target)) {
        audio.ping(0.28);
        scoreEl.textContent = 'Doelwitten geraakt: ' + level.targets.hits;
      }
      effects.burst(hit.point, n, 0xd8d2c4, 10);
      showHit();
    } else {
      effects.hole(hit);
      effects.burst(hit.point, n, 0xb8b0a2, 10);
    }
  }
  // terugslag: camera schopt omhoog en komt grotendeels terug
  recoilVel += PISTOL_STATS.recoil * 60;
  pitch += PISTOL_STATS.recoil * 0.25;
  vmKick = 1;
  bloom = Math.min(0.03, bloom + 0.009);
  trauma = Math.min(1, trauma + 0.12);
  camera.getWorldDirection(tmpDir);
  effects.muzzleLight(camera.position.clone().addScaledVector(tmpDir, 0.7));
};

// ---------- Lus ----------
const DT = 1 / 120;
let acc = 0, last = performance.now();
let lastStep = 0;
let yaw = 0, pitch = 0;
const camPos = new THREE.Vector3();

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vm.resize(w / h);
}
addEventListener('resize', resize); resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const active = input.locked;

  // kijken
  const mouse = input.takeMouse();
  const s = 0.0021 * input.settings.gevoeligheid;
  yaw -= mouse[0] * s;
  pitch = THREE.MathUtils.clamp(pitch - mouse[1] * s, -1.55, 1.55);

  // wapens kiezen
  if (active) {
    if (input.pressed('Digit1')) selectWeapon(owned[0]);
    if (input.pressed('Digit2')) selectWeapon(owned[1]);
    if (input.pressed('KeyQ')) selectWeapon(lastWeapon);
    if (input.wheel !== 0 && owned.length > 1) {
      const i = owned.indexOf(vm.pending || vm.current);
      selectWeapon(owned[(i + (input.wheel > 0 ? 1 : -1) + owned.length) % owned.length]);
    }
    if (input.pressed('KeyR') && vm.current === pistol && !vm.switching) pistol.reload();
    // vuren / stoten
    const w = vm.current;
    if (w && !vm.switching) {
      if (input.punchPressed) w.primary(true);
      else if (input.mouseDown) w.primary(false);
    }
  }
  input.punchPressed = false;

  // natuurkunde met vaste stap
  if (active) {
    acc += dt;
    const wish = {
      forward: (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0),
      right: (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0),
      sprint: input.down('ShiftLeft', 'ShiftRight'),
      jump: false,
    };
    let jumpEdge = input.jumpPressed; input.jumpPressed = false;
    while (acc >= DT) {
      wish.jump = jumpEdge; jumpEdge = false;
      player.step(DT, wish, yaw);
      acc -= DT;
    }
    level.bag.update(dt);
    level.targets.update(dt);
  } else input.jumpPressed = false;

  // oppakken
  const feet = player.pos;
  if (pickup && !owned.includes(pistol) && pistol.ready) {
    pickup.rotation.y += dt * 1.2;
    pickup.position.y = level.pickupSpot.y + 0.06 + Math.sin(now / 400) * 0.02;
    if (Math.hypot(feet.x - pickup.position.x, feet.z - pickup.position.z) < 1.1 && Math.abs(feet.y + 0.9 - pickup.position.y) < 1.3) {
      owned.push(pistol);
      scene.remove(pickup); pickup = null;
      selectWeapon(pistol);
      toast('Pistool opgepakt. Wisselen met 1 en 2, Q of het muiswiel. Herladen met R.', 4);
    }
  }
  const ammo = level.ammo;
  ammo.cooldown = Math.max(0, ammo.cooldown - dt);
  ammo.mesh.material.forEach?.(m => { m.opacity = ammo.cooldown > 0 ? 0.35 : 1; m.transparent = ammo.cooldown > 0; });
  if (owned.includes(pistol) && ammo.cooldown <= 0 && pistol.reserve < 96 &&
      Math.hypot(feet.x - ammo.pos.x, feet.z - ammo.pos.z) < 1.1) {
    const add = Math.min(36, 96 - pistol.reserve);
    pistol.reserve += add;
    ammo.cooldown = 8;
    audio.play('magin', { gain: 0.7 });
    toast(`+${add} kogels`, 1.6);
  }

  // gebeurtenissen van de speler
  for (const e of player.events) {
    if (e === 'jump') audio.play('jump', { gain: 0.35 });
    else if (e.startsWith('land:')) {
      const v = Number(e.slice(5));
      if (v > 2) {
        audio.play('land', { gain: Math.min(1, 0.3 + v * 0.07) });
        audio.play('step', { gain: 1.4 });
        landVel -= Math.min(0.6, v * 0.045);
        if (v > 9) trauma = Math.min(1, trauma + 0.15);
      }
    }
  }
  player.events.length = 0;

  // voetstappen
  const speed = player.horizontalSpeed();
  const stride = speed > P.WALK + 0.5 ? 2.5 : 2.0;
  if (player.onGround && player.distance - lastStep > stride) {
    lastStep = player.distance;
    audio.play('step', { gain: 2.2 * Math.min(1, speed / P.WALK) });
  }
  if (!player.onGround) lastStep = player.distance - stride * 0.5;

  // veren: landing en terugslag
  // in kleine stapjes, anders worden de veren instabiel bij een lage framerate
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(1 / 240, left);
    landVel += (-landDip * 120 - landVel * 14) * h;
    landDip += landVel * h;
    recoilVel += (-recoil * 260 - recoilVel * 26) * h;
    recoil += recoilVel * h;
  }
  vmKick *= Math.exp(-dt * 18);
  bloom = Math.max(0, bloom - dt * 0.05);

  // camera
  const alpha = active ? acc / DT : 1;
  player.lerpPos(alpha, camPos);
  const bobAmt = player.onGround ? Math.min(1, speed / P.WALK) : 0;
  const phase = (player.distance / stride) * Math.PI * 2;
  camera.position.set(camPos.x, camPos.y + P.EYE + player.stepSmooth + landDip + Math.abs(Math.sin(phase / 2)) * 0.035 * bobAmt - 0.017 * bobAmt, camPos.z);

  trauma = Math.max(0, trauma - dt * 1.6);
  const sh = trauma * trauma;
  const t = now / 1000;
  const n = o => Math.sin(t * 37 + o + shakeSeed) * 0.6 + Math.sin(t * 23.3 + o * 2.1) * 0.4;
  camera.rotation.set(
    pitch + recoil + sh * 0.035 * n(1),
    yaw + sh * 0.035 * n(7),
    sh * 0.05 * n(13) + Math.sin(phase / 2) * 0.004 * bobAmt
  );
  const sprinting = input.down('ShiftLeft', 'ShiftRight') && speed > P.WALK + 0.3;
  fov += ((sprinting ? SPRINT_FOV : BASE_FOV) - fov) * (1 - Math.exp(-dt * 6));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  vm.update(dt, {
    mouseDX: mouse[0] * input.settings.gevoeligheid,
    mouseDY: mouse[1] * input.settings.gevoeligheid,
    bobPhase: phase / 2, bobAmount: bobAmt,
    sprint: sprinting, land: landDip, kick: vmKick * 0.02,
  });
  effects.update(dt);

  // HUD
  hitTimer = Math.max(0, hitTimer - dt);
  hitmarker.style.opacity = hitTimer > 0 ? String(hitTimer / 0.16) : '0';
  speedo.textContent = speed.toFixed(1) + ' m/s';
  const shown = vm.pending || vm.current;
  weaponEl.textContent = shown ? shown.name : '';
  const gun = shown === pistol;
  ammoEl.hidden = !gun;
  if (gun) {
    ammoMag.textContent = pistol.mag;
    ammoRes.textContent = pistol.reserve;
    ammoEl.classList.toggle('low', pistol.mag <= 3);
    ammoEl.classList.toggle('reloading', pistol.state === 'reload');
  }
  const cs = gun ? 1 + currentSpread() * 45 : 1;
  crosshair.style.transform = `translate(-50%, -50%) scale(${cs.toFixed(3)})`;
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.style.opacity = '0'; }

  input.endFrame();
  renderer.clear();
  renderer.render(scene, camera);
  vm.render(renderer);
}
requestAnimationFrame(frame);

window.__vv = { player, camera, vm, level, input, fists, pistol, owned, get pickup() { return pickup; } };
