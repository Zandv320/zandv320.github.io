/* Eldoria – burning ash: a monster that `burns` (data.js; the magma slimes of the Ember Isles) leaves glowing
   patches where it crawls. They smoulder a few seconds and singe the hero who stands in them. Each client keeps
   its own patches (from the monsters as it sees them move), and only its own hero takes the damage. */
import * as THREE from "three";
import { scene } from "./world.js";
import { player, monsters, now } from "./game-state.js";
import { takeDamage } from "./player.js";
import { burst } from "./particles.js";

/* a patch every this many units crawled; how long it burns; how wide it is; how often it singes */
const STEP = 1.3;
const LIFE = 5;
const RADIUS = 0.95;
const TICK = 0.8;
/* at most this many at once (the oldest goes out first) */
const MOST = 48;

const patches = [];
/* where each burning monster last dropped a patch: monster id → [x, z] */
const lastDrop = new Map();
let nextSinge = 0;

const geometry = new THREE.CircleGeometry(RADIUS, 14).rotateX(-Math.PI / 2);

function dropPatch(x, z, spec) {
  if (patches.length >= MOST) {
    removePatch(0);
  }
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xff6a20,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.position.set(x, 0.045, z);
  /* over the night haze: the ash glows in the dark */
  mesh.renderOrder = 10003;
  scene.add(mesh);
  patches.push({ x, z, spec, mesh, born: now(), phase: Math.random() * 6 });
}

function removePatch(index) {
  const [patch] = patches.splice(index, 1);
  scene.remove(patch.mesh);
  patch.mesh.material.dispose();
}

/** Per frame: burning monsters drop their patches, the patches flicker and go out, the hero in one is singed. */
export function updateBurning() {
  const time = now();
  for (const monster of monsters.values()) {
    if (!monster.spec.burns || monster.isDead || !monster.sprite.group.visible) {
      lastDrop.delete(monster.id);
      continue;
    }
    const last = lastDrop.get(monster.id);
    if (!last) {
      lastDrop.set(monster.id, [monster.x, monster.z]);
    } else if (Math.hypot(monster.x - last[0], monster.z - last[1]) > STEP) {
      dropPatch(monster.x, monster.z, monster.spec);
      lastDrop.set(monster.id, [monster.x, monster.z]);
    }
  }
  let singedBy = null;
  for (let k = patches.length - 1; k >= 0; k--) {
    const patch = patches[k];
    const age = time - patch.born;
    if (age > LIFE) {
      removePatch(k);
      continue;
    }
    /* bright at first, then dying down, flickering all the while */
    const fade = 1 - age / LIFE;
    patch.mesh.material.opacity = (0.45 + 0.25 * Math.sin(time * 9 + patch.phase)) * fade;
    patch.mesh.scale.setScalar(0.8 + 0.2 * fade);
    if (Math.random() < 0.02) {
      burst(patch.x, 0.2, patch.z, { color: 0xffa040, count: 2, speed: 1.2, size: 2, life: 0.6 });
    }
    if (
      !player.isDead &&
      Math.hypot(player.x - patch.x, player.z - patch.z) < RADIUS * fade + 0.3
    ) {
      singedBy = patch.spec;
    }
  }
  if (singedBy && time >= nextSinge) {
    nextSinge = time + TICK;
    takeDamage(Math.round(singedBy.atk * 0.3), null, null);
  }
}
