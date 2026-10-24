import * as THREE from 'three';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { buildLevel } from './level.js';
import { Player, P } from './player.js';
import { Viewmodel } from './viewmodel.js';

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

const BASE_FOV = 78, SPRINT_FOV = 86;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 120);
camera.rotation.order = 'YXZ';

const level = buildLevel(scene, renderer);
const player = new Player(level.spawn, level.colliders);
const input = new Input(renderer.domElement);
const audio = new Audio();
audio.volume = input.settings.volume;
const vm = new Viewmodel();
vm.load().catch(err => console.error('Armen laden mislukt', err));

let yaw = 0, pitch = 0;

// ---------- UI ----------
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const sens = document.getElementById('sens');
const vol = document.getElementById('vol');
const sensOut = document.getElementById('sens-out');
const volOut = document.getElementById('vol-out');
const hitmarker = document.getElementById('hitmarker');
const speedo = document.getElementById('speed');
sens.value = input.settings.gevoeligheid;
vol.value = input.settings.volume;
const showSettings = () => {
  sensOut.textContent = Number(sens.value).toFixed(2) + '×';
  volOut.textContent = Math.round(vol.value * 100) + '%';
};
showSettings();
sens.addEventListener('input', () => { input.settings.gevoeligheid = Number(sens.value); input.save(); showSettings(); });
vol.addEventListener('input', () => { input.settings.volume = Number(vol.value); audio.setVolume(input.settings.volume); input.save(); showSettings(); });
for (const el of [sens, vol]) el.addEventListener('click', e => e.stopPropagation());
document.querySelector('.settings').addEventListener('click', e => e.stopPropagation());

const go = () => { audio.start(); input.lock(); };
overlay.addEventListener('click', go);
startBtn.addEventListener('click', e => { e.stopPropagation(); go(); });
input.onLockChange = locked => {
  overlay.hidden = locked;
  startBtn.textContent = 'Verder spelen';
};

// ---------- Effecten ----------
let trauma = 0;              // camera-schok 0..1
let landDip = 0, landVel = 0; // veer voor de landing
let fov = BASE_FOV;
let hitTimer = 0;
const shakeSeed = Math.random() * 100;

const ray = new THREE.Raycaster();
ray.far = 1.7;
const center = new THREE.Vector2(0, 0);

vm.onImpact = side => {
  ray.setFromCamera(center, camera);
  const hit = ray.intersectObjects(level.hittables, false)[0];
  if (!hit) { audio.whoosh(0.22); trauma = Math.min(1, trauma + 0.08); return; }
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  if (hit.object.userData.bag) {
    level.bag.hit(dir.x, dir.z, 2.6);
    audio.play('hit', { gain: 0.9 });
    trauma = Math.min(1, trauma + 0.32);
    vm.doHitstop(0.07);
  } else {
    audio.play('hit', { gain: 0.45, rate: 0.75 });
    trauma = Math.min(1, trauma + 0.42);
    vm.doHitstop(0.09);
  }
  hitTimer = 0.16;
};

// ---------- Lus ----------
const DT = 1 / 120;
let acc = 0, last = performance.now();
let lastStep = 0;
let mouseFrame = [0, 0];
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
  mouseFrame = input.takeMouse();
  const s = 0.0021 * input.settings.gevoeligheid;
  yaw -= mouseFrame[0] * s;
  pitch = THREE.MathUtils.clamp(pitch - mouseFrame[1] * s, -1.55, 1.55);

  // stoten (ingedrukt houden = blijven stoten)
  if (active && (input.punchPressed || (input.mouseDown && !vm.busy))) vm.punch();
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
  } else {
    input.jumpPressed = false;
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

  // voetstappen gekoppeld aan afgelegde afstand
  const speed = player.horizontalSpeed();
  const stride = speed > P.WALK + 0.5 ? 2.5 : 2.0;
  if (player.onGround && player.distance - lastStep > stride) {
    lastStep = player.distance;
    audio.play('step', { gain: 2.2 * Math.min(1, speed / P.WALK) });
  }
  if (!player.onGround) lastStep = player.distance - stride * 0.5;

  // veer voor de landing
  landVel += (-landDip * 120 - landVel * 14) * dt;
  landDip += landVel * dt;

  // camera
  const alpha = active ? acc / DT : 1;
  player.lerpPos(alpha, camPos);
  const bobAmt = player.onGround ? Math.min(1, speed / P.WALK) : 0;
  const phase = (player.distance / stride) * Math.PI * 2;
  camera.position.set(camPos.x, camPos.y + P.EYE + player.stepSmooth + landDip + Math.abs(Math.sin(phase / 2)) * 0.035 * bobAmt - 0.017 * bobAmt, camPos.z);

  trauma = Math.max(0, trauma - dt * 1.6);
  const sh = trauma * trauma;
  const t = now / 1000;
  const n = (o) => Math.sin(t * 37 + o + shakeSeed) * 0.6 + Math.sin(t * 23.3 + o * 2.1) * 0.4;
  camera.rotation.set(
    pitch + sh * 0.035 * n(1),
    yaw + sh * 0.035 * n(7),
    sh * 0.05 * n(13) + Math.sin(phase / 2) * 0.004 * bobAmt
  );
  const wantFov = (input.down('ShiftLeft', 'ShiftRight') && speed > P.WALK + 0.3) ? SPRINT_FOV : BASE_FOV;
  fov += (wantFov - fov) * (1 - Math.exp(-dt * 6));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  vm.update(dt, {
    mouseDX: mouseFrame[0] * input.settings.gevoeligheid,
    mouseDY: mouseFrame[1] * input.settings.gevoeligheid,
    bobPhase: phase / 2, bobAmount: bobAmt,
    sprint: wantFov === SPRINT_FOV, land: landDip,
  });

  // HUD
  hitTimer = Math.max(0, hitTimer - dt);
  hitmarker.style.opacity = hitTimer > 0 ? String(hitTimer / 0.16) : '0';
  speedo.textContent = speed.toFixed(1) + ' m/s';

  renderer.clear();
  renderer.render(scene, camera);
  vm.render(renderer);
}
requestAnimationFrame(frame);

// voor testen vanaf de console
window.__vv = { player, camera, vm, level, input };
