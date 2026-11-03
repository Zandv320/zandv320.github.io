/* Eldoria – things that are thrown: a goblin's spear (a monster with `projectile: "spear"`, data.js) and the
   boulders Grumm the bridge troll hurls (boss_boulder, rules/bosses.js). Small 3D shapes on an arc; the blow is
   dealt when they land (the caller's onLand). */
import * as THREE from "three";
import { scene, shakeCamera } from "./world.js";
import { player } from "./game-state.js";
import { burst } from "./particles.js";
import { sfx } from "./audio.js";

/* the flights in the air: {mesh, x0, z0, x1, z1 (or `target` to follow), time, duration, arc, spin, onLand} */
const flights = [];

/* drawn after the night haze, like the warnings on the ground, so a missile is never lost in the dark */
const MISSILE_ORDER = 10001;

function spearMesh() {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x8a5a2e }),
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.28, 5).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc8ccd6 }),
  );
  tip.position.z = 0.78;
  group.add(shaft, tip);
  for (const mesh of group.children) {
    mesh.renderOrder = MISSILE_ORDER;
  }
  return group;
}

function boulderMesh(color) {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.55, 0),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  mesh.castShadow = true;
  return mesh;
}

/** A spear from (x0, z0) at `target` (anything with x and z); onLand() when it hits. */
export function throwSpear(x0, z0, target, onLand) {
  const mesh = spearMesh();
  scene.add(mesh);
  const duration = Math.max(0.25, Math.hypot(target.x - x0, target.z - z0) / 16);
  flights.push({ mesh, x0, z0, target, time: 0, duration, arc: 0.9, height: 1, onLand });
}

/** A boulder from (x0, z0), high through the air, down on (x1, z1) after `duration` seconds; `color` for a block of
    ice instead of stone. */
export function throwBoulder(x0, z0, x1, z1, duration, color = 0x8c8a86) {
  const mesh = boulderMesh(color);
  scene.add(mesh);
  flights.push({
    mesh,
    x0,
    z0,
    x1,
    z1,
    time: 0,
    duration,
    arc: 6,
    height: 2.2,
    spin: 7,
    onLand: null,
  });
}

function land(flight, x, z) {
  scene.remove(flight.mesh);
  if (flight.spin) {
    /* a boulder: dust and a thud (the warning on the ground has the flash) */
    burst(x, 0.3, z, { color: 0x9a948a, count: 18, speed: 4, size: 4, life: 0.6 });
    if (Math.hypot(x - player.x, z - player.z) < 16) {
      sfx.bossSlam();
      shakeCamera(0.18, 0.2);
    }
  }
  if (flight.onLand) {
    flight.onLand();
  }
}

/** Per frame: everything in the air moves along its arc, and lands. */
export function updateMissiles(dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const flight = flights[i];
    flight.time += dt;
    const progress = Math.min(1, flight.time / flight.duration);
    const x1 = flight.target ? flight.target.x : flight.x1;
    const z1 = flight.target ? flight.target.z : flight.z1;
    const x = flight.x0 + (x1 - flight.x0) * progress;
    const z = flight.z0 + (z1 - flight.z0) * progress;
    /* from the hand's height, up in an arc, and down to the ground (a spear to the chest) */
    const endHeight = flight.spin ? 0.4 : 0.8;
    const y =
      flight.height +
      (endHeight - flight.height) * progress +
      Math.sin(progress * Math.PI) * flight.arc;
    flight.mesh.position.set(x, y, z);
    if (flight.spin) {
      flight.mesh.rotation.x += flight.spin * dt;
      flight.mesh.rotation.z += flight.spin * 0.6 * dt;
    } else {
      /* the spear points where it flies: along the ground, and up or down with the arc */
      const slope = Math.cos(progress * Math.PI) * flight.arc * Math.PI;
      const distance = Math.hypot(x1 - flight.x0, z1 - flight.z0) || 1;
      flight.mesh.rotation.set(0, Math.atan2(x1 - flight.x0, z1 - flight.z0), 0);
      flight.mesh.rotateX(-Math.atan2(slope, distance));
    }
    if (progress >= 1) {
      flights.splice(i, 1);
      land(flight, x, z);
    }
  }
}
