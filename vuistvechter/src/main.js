import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { buildLevel } from './level.js';
import { Player, P } from './player.js';
import { Viewmodel } from './viewmodel.js';
import { Fists } from './fists.js';
import { Pistol, PISTOL_STATS, CANT } from './pistol.js';
import { Effects } from './effects.js';
import { FPBody } from './fpbody.js';
import { Enemies } from './enemy.js';
import { Post } from './post.js';

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

const BASE_FOV = 78, SPRINT_FOV = 84, ADS_FOV = 60;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 120);   // dichtbij-vlak klein: je eigen handen en wapen zitten vlak voor je
camera.rotation.order = 'YXZ';

const level = buildLevel(scene, renderer);
const post = new Post(renderer, scene, camera);
const player = new Player(level.spawn, level.colliders);
const input = new Input(renderer.domElement);
const audio = new Audio();
audio.volume = input.settings.volume;
const effects = new Effects(scene);

// ---------- Personages ----------
const body = new FPBody(scene);
body.load().catch(e => console.error('Lichaam laden mislukt', e));
const HEALTH = { MAX: 100, REGEN_DELAY: 4, REGEN: 15, RESPAWN: 3.5 };
let health = HEALTH.MAX, sinceHurt = 99, dead = false, deadT = 0, hurtFlash = 0, deaths = 0;
const enemies = new Enemies({
  scene, level, audio, effects, camera, player,
  get playerDead() { return dead; },
  get hostile() { return owned.includes(pistol); },   // pas vechten als je een wapen hebt
  get playerCrouch() { return crouch; },
  get playerLean() { return lean; },
  onPlayerHit: (dmg, from) => hurt(dmg, from),
  onKill: (e, part) => { updateScore(); killTimer = 0.35; },
});
enemies.load().catch(e => console.error('Vijanden laden mislukt', e));

// ---------- Wapens ----------
const vm = new Viewmodel(scene);
const fists = new Fists();
const pistol = new Pistol(audio);
vm.add(fists); vm.add(pistol);
const owned = [fists];          // volgorde = toets 1, 2, ...
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
  vm.switchTo(w);
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const overlay = $('overlay'), startBtn = $('start');
const sens = $('sens'), vol = $('vol');
const hitmarker = $('hitmarker'), speedo = $('speed');
const ammoEl = $('ammo'), ammoMag = $('ammo-mag'), ammoRes = $('ammo-res'), weaponEl = $('weapon');
const toastEl = $('toast'), crosshair = $('crosshair'), scoreEl = $('score');
const healthEl = $('health'), healthNum = $('health-num'), healthBar = $('health-bar');
const dmgEl = $('dmg'), hitdirEl = $('hitdir'), deadEl = $('dead');
function updateScore() {
  scoreEl.textContent = `Uitgeschakeld: ${enemies.kills}` + (level.targets.hits ? ` · Doelwitten: ${level.targets.hits}` : '');
}
const qualityEl = $('quality');
const applyQuality = () => {
  const q = input.settings.kwaliteit || 'hoog';
  qualityEl.value = q;
  renderer.setPixelRatio(q === 'laag' ? 1 : Math.min(devicePixelRatio, 2));
  level.setShadows(q !== 'laag');
  post.setQuality(q, host.clientWidth, host.clientHeight);
};
qualityEl.addEventListener('change', () => { input.settings.kwaliteit = qualityEl.value; input.save(); applyQuality(); resize(); });
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

let killTimer = 0, lowHpVignette = 0;
function showHit() { hitTimer = 0.16; }

// geraakt door een vijand
let hitdirAngle = 0, hitdirT = 0;
function hurt(dmg, from) {
  if (dead) return;
  health -= dmg; sinceHurt = 0;
  hurtFlash = Math.min(1, hurtFlash + 0.55);
  trauma = Math.min(1, trauma + 0.28);
  audio.hurt(0.5);
  // richting van de schutter t.o.v. de kijkrichting (0 = recht vooruit)
  const dx = from.x - camera.position.x, dz = from.z - camera.position.z;
  hitdirAngle = Math.atan2(dx, dz);   // wereldrichting; op het scherm t.o.v. de huidige kijkrichting
  hitdirT = 1.2;
  if (health <= 0) die();
}
function die() {
  health = 0; dead = true; deadT = 0; deaths++;
  deadEl.hidden = false;
  vm.sway.visible = false;
}
function respawn() {
  dead = false; health = HEALTH.MAX; sinceHurt = 99; hurtFlash = 0;
  player.pos.copy(level.spawn); player.prevPos.copy(level.spawn); player.vel.set(0, 0, 0);
  yaw = 0; pitch = 0;
  deadEl.hidden = true;
  vm.sway.visible = true;
  enemies.reset();
}

// alles wat een schot of stoot kan raken
const shootables = () => level.hittables.concat(enemies.live());
function hitEnemy(hit, dmg, dir) {
  const r = enemies.damage(hit.object, dmg, dir);
  if (!r) return false;
  const n = dir.clone().negate();
  effects.burst(hit.point, n, 0x6e1410, r.head ? 14 : 9);
  audio.play('hit', { gain: r.head ? 0.55 : 0.4, rate: r.head ? 1.45 : 1.2 });
  showHit();
  if (r.killed) killTimer = 0.35;
  return true;
}

// stoot: korte straal vanuit de camera
fists.onImpact = () => {
  ray.far = 1.7;
  ray.setFromCamera(center, camera);
  const hit = ray.intersectObjects(shootables(), false)[0];
  if (!hit) { audio.whoosh(0.22); trauma = Math.min(1, trauma + 0.08); return; }
  camera.getWorldDirection(tmpDir);
  if (hit.object.userData.owner) {
    hitEnemy(hit, 25, tmpDir);
    trauma = Math.min(1, trauma + 0.25);
    fists.doHitstop(0.08);
    return;
  } else if (hit.object.userData.bag) {
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
  const aim = vm.aimAmount;
  // vanuit de heup minder zuiver dan over het vizier; hurken helpt ook
  const base = PISTOL_STATS.spread * (1 - aim) * 3 + PISTOL_STATS.spread * 0.5 * aim;
  return (base + speed01 * 0.014 + (player.onGround ? 0 : 0.035) + bloom) * (crouch ? 0.75 : 1);
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

  const hit = ray.intersectObjects(shootables(), false)[0];
  if (hit) {
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : ray.ray.direction.clone().negate();
    if (hit.object.userData.owner) {
      hitEnemy(hit, PISTOL_STATS.damage, ray.ray.direction);
    } else if (hit.object.userData.bag) {
      level.bag.hit(ray.ray.direction.x, ray.ray.direction.z, 0.9);
      audio.play('hit', { gain: 0.35, rate: 1.1 });
      effects.burst(hit.point, n, 0x5a1612, 8);
      showHit();
    } else if (hit.object.userData.target) {
      if (level.targets.hit(hit.object.userData.target)) {
        audio.ping(0.28);
        updateScore();
      }
      effects.burst(hit.point, n, 0xd8d2c4, 10);
      showHit();
    } else {
      effects.hole(hit);
      effects.burst(hit.point, n, 0xb8b0a2, 10);
    }
  }
  // terugslag: camera schopt omhoog en komt grotendeels terug
  // de loop gaat omhoog en een beetje opzij; een deel blijft hangen (je moet terugtrekken)
  const steady = crouch ? 0.75 : 1;
  recoilVel += PISTOL_STATS.recoil * 60 * steady;
  pitch += PISTOL_STATS.recoil * 0.3 * steady;
  yaw += (Math.random() - 0.45) * 0.006 * steady;
  vmKick = 1;
  bloom = Math.min(0.03, bloom + 0.009);
  trauma = Math.min(1, trauma + 0.1);
  effects.muzzleLight(pistol.muzzle.getWorldPosition(new THREE.Vector3()));
};

// ---------- Rook uit de loop ----------
let smokeAcc = 0, lastHeatShots = 0;
const muzzleWorld = out => pistol.muzzle.getWorldPosition(out);
function updateSmoke(dt) {
  if (vm.current !== pistol || !pistol.ready) { lastHeatShots = pistol.heat; return; }
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  // elk schot: klein wolkje
  if (pistol.heat > lastHeatShots + 0.5) effects.puff(muzzleWorld(new THREE.Vector3()), 0.6, fwd);
  lastHeatShots = pistol.heat;
  // na snel achter elkaar schieten: dun sliertje uit de loop, dat snel weer stopt
  const over = pistol.heat - 4;
  if (over > 0) {
    smokeAcc += dt * Math.min(6, 1.5 + over * 1.2);
    while (smokeAcc >= 1) {
      smokeAcc -= 1;
      effects.puff(muzzleWorld(new THREE.Vector3()), Math.min(1, 0.4 + over / 6), null, true);
    }
  }
}

// ---------- Lus ----------
const DT = 1 / 120;
let acc = 0, last = performance.now();
let lastStep = 0;
let yaw = 0, pitch = 0;
const camPos = new THREE.Vector3(), _feet = new THREE.Vector3();
// houding
let crouch = false, lean = 0, stamina = 1, staminaWait = 0;
const wallRay = new THREE.Raycaster();

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  post.setSize(w, h);
}
addEventListener('resize', resize); resize(); applyQuality();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const active = input.locked && !dead;

  // kijken
  const mouse = input.takeMouse();
  const s = 0.0021 * input.settings.gevoeligheid * (camera.fov / BASE_FOV);   // bij richten (inzoomen) trager
  yaw -= mouse[0] * s;
  pitch = THREE.MathUtils.clamp(pitch - mouse[1] * s, -1.55, 1.55);

  // wapens kiezen
  if (active) {
    if (input.pressed('Digit1')) selectWeapon(owned[0]);
    if (input.pressed('Digit2')) selectWeapon(owned[1]);
    if (input.pressed('KeyC')) {
      if (!crouch) crouch = true;
      else if (player.canStand()) crouch = false;
    }
    if (input.wheel !== 0 && owned.length > 1) {
      const i = owned.indexOf(vm.pending || vm.current);
      selectWeapon(owned[(i + (input.wheel > 0 ? 1 : -1) + owned.length) % owned.length]);
    }
    if (input.pressed('KeyR') && vm.current === pistol && !vm.switching) pistol.reload();
    if (input.pressed('KeyJ') && vm.current && !vm.switching) vm.current.inspect?.();
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
    const aiming = input.aimDown && vm.current === pistol;
    const wantSprint = input.down('ShiftLeft', 'ShiftRight') && !aiming && stamina > 0.05;
    if (wantSprint && crouch && player.canStand()) crouch = false;     // sprinten = opstaan
    const wish = {
      forward: (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0),
      right: (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0),
      sprint: wantSprint && !crouch,
      jump: false,
      speed: crouch ? P.CROUCH_SPEED : aiming ? P.WALK * 0.55 : undefined,
    };
    if (crouch) wish.jump = false;
    // uithoudingsvermogen: ca. 6 s sprinten, daarna even op adem komen
    if (wish.sprint && wish.forward > 0 && player.horizontalSpeed() > P.WALK) { stamina = Math.max(0, stamina - dt / 6); staminaWait = 1.2; }
    else if ((staminaWait -= dt) <= 0) stamina = Math.min(1, stamina + dt / 4);
    player.height = crouch ? P.CROUCH_HEIGHT : P.HEIGHT;
    let jumpEdge = input.jumpPressed; input.jumpPressed = false;
    while (acc >= DT) {
      wish.jump = jumpEdge && !crouch; jumpEdge = false;
      player.step(DT, wish, yaw);
      acc -= DT;
    }
  } else input.jumpPressed = false;
  if (input.locked) {
    level.bag.update(dt);
    level.targets.update(dt);
    enemies.update(dt);
  }
  // gezondheid: na een paar seconden zonder treffer weer aanvullen
  sinceHurt += dt;
  if (!dead && sinceHurt > HEALTH.REGEN_DELAY && health < HEALTH.MAX) health = Math.min(HEALTH.MAX, health + HEALTH.REGEN * dt);
  if (dead && input.locked) { deadT += dt; if (deadT > HEALTH.RESPAWN) respawn(); }

  // oppakken
  const feet = player.pos;
  if (pickup && !owned.includes(pistol) && pistol.ready) {
    pickup.rotation.y += dt * 1.2;
    pickup.position.y = level.pickupSpot.y + 0.06 + Math.sin(now / 400) * 0.02;
    if (Math.hypot(feet.x - pickup.position.x, feet.z - pickup.position.z) < 1.1 && Math.abs(feet.y + 0.9 - pickup.position.y) < 1.3) {
      owned.push(pistol);
      scene.remove(pickup); pickup = null;
      selectWeapon(pistol);
      toast('Pistool opgepakt. Pas op: twee bewakers achterin de hal hebben je nu door. Herladen met R.', 4.5);
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
  const stride = crouch ? 1.3 : speed > P.WALK + 0.5 ? 2.4 : 1.9;
  if (player.onGround && player.distance - lastStep > stride) {
    lastStep = player.distance;
    audio.play('step', { gain: (crouch ? 1.1 : 2.2) * Math.min(1, speed / P.WALK), wet: 0.12 });
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
  // leunen (Q/E): romp kantelt, camera schuift opzij, maar niet door een muur
  const leanWant = active ? (input.down('KeyE') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0) : 0;
  lean += (leanWant - lean) * (1 - Math.exp(-dt * 9));
  _feet.set(camPos.x, camPos.y + player.stepSmooth, camPos.z);
  const eye = body.pose(dt, { feet: _feet, vel: player.vel, yaw, pitch, airborne: !player.onGround, crouch, lean });
  if (eye) camera.position.copy(eye);
  else camera.position.set(camPos.x, camPos.y + P.EYE + player.stepSmooth, camPos.z);
  camera.position.y += landDip;
  if (Math.abs(lean) > 0.01) {
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(Math.sign(lean));
    wallRay.set(camera.position, side); wallRay.far = 0.6;
    const wh = wallRay.intersectObjects(level.hittables, false)[0];
    const room = wh ? Math.max(0, wh.distance - 0.15) : 0.45;
    camera.position.addScaledVector(side, Math.min(0.3 * Math.abs(lean), room));
    camera.position.y -= 0.05 * Math.abs(lean);
  }
  // dood: camera zakt naar de grond en kantelt
  const fall = dead ? THREE.MathUtils.smoothstep(deadT, 0, 0.7) : 0;
  camera.position.y -= fall * (camera.position.y - camPos.y - 0.3);

  trauma = Math.max(0, trauma - dt * 1.6);
  const sh = trauma * trauma;
  const t = now / 1000;
  const n = o => Math.sin(t * 37 + o + shakeSeed) * 0.6 + Math.sin(t * 23.3 + o * 2.1) * 0.4;
  camera.rotation.set(
    pitch + recoil + sh * 0.035 * n(1),
    yaw + sh * 0.035 * n(7),
    sh * 0.05 * n(13) + Math.sin(phase / 2) * 0.003 * bobAmt + fall * 1.1 - lean * 0.2
  );
  const sprinting = input.down('ShiftLeft', 'ShiftRight') && speed > P.WALK + 0.3;
  const aimNow = active && input.aimDown && vm.current === pistol && !sprinting;
  const aimA = vm.aimAmount;
  const fovWant = (sprinting ? SPRINT_FOV : BASE_FOV) * (1 - aimA) + ADS_FOV * aimA;
  fov += (fovWant - fov) * (1 - Math.exp(-dt * 10));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);

  // muur vlak voor je? wapen terugtrekken
  wallRay.setFromCamera(center, camera); wallRay.far = 0.95;
  const wallHit = wallRay.intersectObjects(level.hittables, false)[0];
  const wall = vm.current === pistol && wallHit ? THREE.MathUtils.clamp((0.95 - wallHit.distance) / 0.55, 0, 1) : 0;

  vm.update(dt, {
    camera,
    mouseDX: mouse[0] * input.settings.gevoeligheid,
    mouseDY: mouse[1] * input.settings.gevoeligheid,
    bobPhase: phase / 2, bobAmount: bobAmt,
    sprint: sprinting, land: landDip, kick: vmKick * 0.02,
    aim: aimNow && wall < 0.3, wall, lean,
  });
  body.arms(vm.current, camera);
  body.finish(!dead);
  updateSmoke(dt);
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
  crosshair.style.opacity = (1 - aimA * 1.4).toFixed(2);     // over het vizier geen kruisje
  killTimer = Math.max(0, killTimer - dt);
  hitmarker.classList.toggle('kill', killTimer > 0);
  if (killTimer > 0) hitmarker.style.opacity = '1';
  const hp = Math.ceil(health);
  healthNum.textContent = hp;
  healthBar.style.transform = `scaleX(${(health / HEALTH.MAX).toFixed(3)})`;
  healthEl.classList.toggle('low', hp <= 35);
  hurtFlash = Math.max(0, hurtFlash - dt * 1.6);
  const lowHp = 1 - health / HEALTH.MAX;
  dmgEl.style.opacity = Math.min(1, hurtFlash * 0.9 + lowHp * lowHp * 0.7).toFixed(3);
  lowHpVignette = lowHp * lowHp * 0.4 + (1 - stamina) * 0.12;
  hitdirT = Math.max(0, hitdirT - dt);
  hitdirEl.style.opacity = Math.min(1, hitdirT * 1.5).toFixed(3);
  hitdirEl.style.transform = `translate(-50%, -50%) rotate(${(-(hitdirAngle - (yaw + Math.PI))).toFixed(3)}rad)`;
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.style.opacity = '0'; }

  input.endFrame();
  renderer.clear();
  post.render(dt, Math.min(0.35, lowHpVignette));
}
requestAnimationFrame(frame);

window.__vv = { scene, renderer, look: (y, p) => { yaw = y; pitch = p; }, enemies, body, get health() { return health; }, hurt, player, camera, vm, get crouch() { return crouch; }, setCrouch: c => { crouch = c; }, level, input, fists, pistol, owned, CANT, get pickup() { return pickup; } };
