/* Eldoria – the Grey Sea as the players see it (the rules are in rules/sea.js; the water itself is laid by
   saltmere.js): sea stacks with surf round their feet, green islets with sand and trees, the Ember Isles under their
   smoking mountain with its glowing crater; whitecaps that come and go on the water around the camera (fixed in the
   world, so a ship under way sees them slide past), and the wake every ship under sail leaves (createWake). */
import * as THREE from "three";
import * as builders from "./builders.js";
import { ROCKS, ISLETS, EMBER_ISLES, HULL, isOpenWater } from "./rules/sea.js";
import { WATER_Y, SALTMERE } from "./rules/saltmere.js";
import { scene as worldScene, cameraState } from "./world.js";

/* whitecaps: this many, in a square of this size around the camera, each living this long */
const WHITECAPS = 420;
const WHITECAP_FIELD = 90;
const WHITECAP_LIFE = [2.5, 5];

const volcanoSmoke = [];
/* steam rising from cracks along the Ember Isles' coast: {x, z, puffs} */
const steamVents = [];
const surf = [];
let craterGlow = null;
/* the whitecaps' instanced mesh and each one's {x, z, angle, size, age, life} */
let whitecapMesh = null;
const whitecaps = [];
const matrix = new THREE.Matrix4();
const rotation = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const spot = new THREE.Vector3();
const size = new THREE.Vector3();

/** Builds the Grey Sea (world.js calls this with its build context). */
export function buildSea({ scene, prop, pending, seededRandom }) {
  const random = seededRandom(7070);
  const rock = builders.material("stone", 2, 2, 0.62);
  /* ----- sea stacks: piles of dark rock standing out of the water ----- */
  for (const [x, z, radius] of ROCKS) {
    const stack = new THREE.Group();
    let y = WATER_Y - 1;
    let size = radius;
    for (let k = 0; k < 4; k++) {
      const piece = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rock);
      piece.position.set(
        (random() - 0.5) * size * 0.4,
        y + size * 0.6,
        (random() - 0.5) * size * 0.4,
      );
      piece.scale.y = 1.3;
      piece.rotation.set(random() * 3, random() * 3, random() * 3);
      stack.add(piece);
      y += size * 1.1;
      size *= 0.68;
    }
    stack.position.set(x, 0, z);
    scene.add(stack);
    addSurf(scene, x, z, radius * 1.05, radius * 1.45);
  }
  /* ----- islets: a mound of green on a ring of sand, a few trees ----- */
  for (const { x, z, radius } of ISLETS) {
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 1.2, 1.4, 24).translate(0, WATER_Y + 0.4, 0),
      new THREE.MeshLambertMaterial({ color: 0xd8c08a }),
    );
    sand.position.set(x, 0, z);
    scene.add(sand);
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.92, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x6a9a4a, flatShading: true }),
    );
    mound.scale.y = 0.18;
    mound.position.set(x, WATER_Y + 1.05, z);
    scene.add(mound);
    for (let k = 0; k < Math.round(radius / 2.5); k++) {
      const angle = random() * Math.PI * 2;
      const distance = random() * radius * 0.6;
      pending.push(
        prop(
          random() < 0.6 ? "pine" : "tree",
          x + Math.cos(angle) * distance,
          z + Math.sin(angle) * distance,
          { shadow: 1.6, scale: 1.3 },
        ),
      );
    }
    addSurf(scene, x, z, radius + 1.1, radius + 2.2);
  }
  /* ----- the Ember Isles: black rock, and over them Mount Kharos smoking, its crater glowing ----- */
  const basalt = new THREE.MeshLambertMaterial({ color: 0x3a3436, flatShading: true });
  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(EMBER_ISLES.radius, EMBER_ISLES.radius + 6, 1.2, 28, 2).translate(
      0,
      WATER_Y + 0.2,
      0,
    ),
    basalt,
  );
  const landPositions = land.geometry.attributes.position;
  for (let k = 0; k < landPositions.count; k++) {
    const x = landPositions.getX(k);
    const z = landPositions.getZ(k);
    const angle = Math.atan2(x, z);
    const wobble = 1 + 0.08 * Math.sin(angle * 5 + 1) + 0.05 * Math.sin(angle * 11);
    landPositions.setX(k, x * wobble);
    landPositions.setZ(k, z * wobble);
  }
  land.geometry.computeVertexNormals();
  land.position.set(EMBER_ISLES.x, 0, EMBER_ISLES.z);
  scene.add(land);
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(42, 34, 18, 4, true), basalt);
  mountain.position.set(EMBER_ISLES.x - 10, WATER_Y + 3 + 17, EMBER_ISLES.z - 18);
  scene.add(mountain);
  craterGlow = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
  );
  craterGlow.position.set(EMBER_ISLES.x - 10, WATER_Y + 3 + 33.4, EMBER_ISLES.z - 18);
  /* drawn over the night haze: the glow is seen from far off */
  craterGlow.renderOrder = 10001;
  scene.add(craterGlow);
  for (let k = 0; k < 8; k++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(3 + random() * 2, 8, 6),
      new THREE.MeshLambertMaterial({
        color: 0x6a6466,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    puff.userData.phase = k / 8;
    scene.add(puff);
    volcanoSmoke.push(puff);
  }
  /* their coast: a beach of grey ash, black boulders along it, and steam rising from cracks */
  const ash = new THREE.Mesh(
    new THREE.RingGeometry(EMBER_ISLES.radius - 4, EMBER_ISLES.radius + 5, 48).rotateX(
      -Math.PI / 2,
    ),
    new THREE.MeshLambertMaterial({ color: 0x6a6462 }),
  );
  ash.position.set(EMBER_ISLES.x, WATER_Y + 0.82, EMBER_ISLES.z);
  scene.add(ash);
  const boulder = new THREE.MeshLambertMaterial({ color: 0x24201f, flatShading: true });
  for (let k = 0; k < 70; k++) {
    const angle = random() * Math.PI * 2;
    const distance = EMBER_ISLES.radius + 1 + random() * 3;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + random() * 1.6, 0), boulder);
    stone.position.set(
      EMBER_ISLES.x + Math.sin(angle) * distance,
      WATER_Y + 0.7 + random() * 0.7,
      EMBER_ISLES.z + Math.cos(angle) * distance,
    );
    stone.rotation.set(random() * 3, random() * 3, random() * 3);
    scene.add(stone);
  }
  for (let k = 0; k < 9; k++) {
    const angle = Math.PI * (0.75 + random() * 0.5) + (random() - 0.5);
    const distance = EMBER_ISLES.radius - 6 - random() * 10;
    const vent = {
      x: EMBER_ISLES.x + Math.sin(angle) * distance,
      z: EMBER_ISLES.z + Math.cos(angle) * distance,
      puffs: [],
    };
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshLambertMaterial({
          color: 0xd8d4d0,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      puff.userData.phase = p / 4 + random() * 0.1;
      scene.add(puff);
      vent.puffs.push(puff);
    }
    steamVents.push(vent);
  }
  addSurf(scene, EMBER_ISLES.x, EMBER_ISLES.z, EMBER_ISLES.radius + 5, EMBER_ISLES.radius + 8);
  buildWhitecaps(scene);
}

/* the whitecaps: thin flat crescents of foam on the water */
function buildWhitecaps(scene) {
  const crest = new THREE.Shape();
  crest.moveTo(-0.6, 0);
  crest.quadraticCurveTo(0, 0.28, 0.6, 0);
  crest.quadraticCurveTo(0, 0.12, -0.6, 0);
  whitecapMesh = new THREE.InstancedMesh(
    new THREE.ShapeGeometry(crest).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xf4f8fa,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    WHITECAPS,
  );
  whitecapMesh.frustumCulled = false;
  scene.add(whitecapMesh);
  for (let k = 0; k < WHITECAPS; k++) {
    whitecaps.push({ x: 0, z: 0, angle: 0, size: 1, age: 0, life: 0 });
  }
}

/* a whitecap born somewhere around the camera, at its own age */
function placeWhitecap(cap, centerX, centerZ) {
  cap.x = centerX + (Math.random() - 0.5) * WHITECAP_FIELD;
  cap.z = centerZ + (Math.random() - 0.5) * WHITECAP_FIELD;
  /* the waves run mostly one way, from the north-west */
  cap.angle = 0.6 + (Math.random() - 0.5) * 0.7;
  cap.size = 0.7 + Math.random() * 1.1;
  cap.life = WHITECAP_LIFE[0] + Math.random() * (WHITECAP_LIFE[1] - WHITECAP_LIFE[0]);
  cap.age = 0;
  cap.isWater = cap.z < SALTMERE.z0 - 0.8 && isOpenWater(cap.x, cap.z, 0.8);
}

function updateWhitecaps(dt) {
  const centerX = cameraState.target.x;
  const centerZ = cameraState.target.z;
  /* only where the camera looks over the sea */
  const isNearSea = centerZ < SALTMERE.z0 + WHITECAP_FIELD / 2;
  whitecapMesh.visible = isNearSea;
  if (!isNearSea) {
    return;
  }
  for (let k = 0; k < whitecaps.length; k++) {
    const cap = whitecaps[k];
    cap.age += dt;
    const isOutside =
      Math.abs(cap.x - centerX) > WHITECAP_FIELD / 2 ||
      Math.abs(cap.z - centerZ) > WHITECAP_FIELD / 2;
    if (cap.age >= cap.life || isOutside) {
      placeWhitecap(cap, centerX, centerZ);
      /* a fresh one starts somewhere along its life, so they do not all blink in step */
      cap.age = isOutside ? 0 : Math.random() * 0.5;
    }
    /* it swells, curls and fades */
    const t = cap.age / cap.life;
    const grow = cap.isWater ? Math.sin(t * Math.PI) : 0;
    rotation.setFromAxisAngle(up, cap.angle);
    spot.set(cap.x + t * 0.8, WATER_Y + 0.025, cap.z + t * 0.5);
    size.set(cap.size * (0.6 + 0.4 * grow), 1, grow * cap.size);
    matrix.compose(spot, rotation, size);
    whitecapMesh.setMatrixAt(k, matrix);
  }
  whitecapMesh.instanceMatrix.needsUpdate = true;
}

/* Foam: white flecks and streaks with clear water between them, repeating (a canvas texture, made once). */
let foamTexture = null;
function foam() {
  if (!foamTexture) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    for (let k = 0; k < 140; k++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + Math.random() * 0.65})`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      /* along the trail (y) the flecks are drawn out into streaks */
      ctx.fillRect(
        Math.round(x),
        Math.round(y),
        1 + Math.floor(Math.random() * 3),
        2 + Math.floor(Math.random() * 6),
      );
    }
    foamTexture = new THREE.CanvasTexture(canvas);
    foamTexture.wrapS = foamTexture.wrapT = THREE.RepeatWrapping;
    foamTexture.magFilter = THREE.NearestFilter;
    foamTexture.minFilter = THREE.NearestFilter;
    foamTexture.generateMipmaps = false;
  }
  return foamTexture;
}

/**
 * The wake of a ship: a trail of foam behind the stern that widens and fades, and the bow wave, a V of foam from the
 * stem. update(x, z, heading, speed, dt) every frame the ship sails (heading: bow to (-sin, -cos)); hide() when she
 * is gone.
 */
export function createWake() {
  const POINTS = 40;
  const SAMPLE = 0.12;
  const trail = [];
  let sampleTimer = 0;
  const positions = new Float32Array(POINTS * 2 * 3);
  const colors = new Float32Array(POINTS * 2 * 4);
  const uvs = new Float32Array(POINTS * 2 * 2);
  /* how far the stern has come, so the foam's pattern stays where it fell on the water */
  let travelled = 0;
  let lastX = null;
  let lastZ = null;
  const indices = [];
  for (let i = 1; i < POINTS; i++) {
    const a = (i - 1) * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const foamMaterial = () =>
    new THREE.MeshBasicMaterial({
      map: foam(),
      color: 0xf2f6f8,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const trailMesh = new THREE.Mesh(geometry, foamMaterial());
  trailMesh.frustumCulled = false;
  worldScene.add(trailMesh);
  /* the bow wave, in the ship's own axes: from the stem back along both sides, spreading out */
  const bow = new THREE.BufferGeometry();
  const half = HULL.length / 2;
  const bowPositions = [];
  const bowColors = [];
  const bowIndices = [];
  for (const side of [-1, 1]) {
    const base = bowPositions.length / 3;
    bowPositions.push(
      side * 0.3,
      0,
      -half - 0.4,
      side * 1.0,
      0,
      -half - 0.6,
      side * (HULL.beam / 2 + 2.6),
      0,
      -half + 7,
      side * (HULL.beam / 2 + 0.3),
      0,
      -half + 7.5,
    );
    bowColors.push(1, 1, 1, 0.75, 1, 1, 1, 0.6, 1, 1, 1, 0, 1, 1, 1, 0);
    bowIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  bow.setAttribute("position", new THREE.Float32BufferAttribute(bowPositions, 3));
  bow.setAttribute("color", new THREE.Float32BufferAttribute(bowColors, 4));
  bow.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [0, 0, 0.3, 0, 2, 2.5, 0.4, 2.6, 0, 0, 0.3, 0, 2, 2.5, 0.4, 2.6],
      2,
    ),
  );
  bow.setIndex(bowIndices);
  const bowMesh = new THREE.Mesh(bow, foamMaterial());
  worldScene.add(bowMesh);

  return {
    update(x, z, heading, speed, dt) {
      const forwardX = -Math.sin(heading);
      const forwardZ = -Math.cos(heading);
      const way = Math.min(1, speed / 5);
      /* a new point of the trail at the stern, now and then; the oldest falls off */
      const sternX = x - forwardX * (half - 0.5);
      const sternZ = z - forwardZ * (half - 0.5);
      if (lastX !== null) {
        travelled += Math.hypot(sternX - lastX, sternZ - lastZ);
      }
      lastX = sternX;
      lastZ = sternZ;
      sampleTimer -= dt;
      if (sampleTimer <= 0) {
        sampleTimer = SAMPLE;
        trail.unshift({ x: sternX, z: sternZ, way, along: travelled });
        if (trail.length > POINTS) {
          trail.pop();
        }
      }
      for (let i = 0; i < POINTS; i++) {
        const point = trail[Math.min(i, trail.length - 1)];
        const next = trail[Math.min(i + 1, trail.length - 1)] || point;
        if (!point) {
          continue;
        }
        const age = i / POINTS;
        /* across the trail: square to its direction */
        let acrossX = -(next.z - point.z);
        let acrossZ = next.x - point.x;
        const length = Math.hypot(acrossX, acrossZ);
        if (length < 1e-4) {
          acrossX = forwardZ;
          acrossZ = -forwardX;
        } else {
          acrossX /= length;
          acrossZ /= length;
        }
        /* narrow under the stern, spreading out behind; it fades as it goes, and at the very end */
        const width = 1.2 + age * 3.6;
        const alpha = i >= trail.length ? 0 : Math.pow(1 - age, 1.4) * 0.85 * point.way;
        for (const [k, sign] of [
          [i * 2, -1],
          [i * 2 + 1, 1],
        ]) {
          positions[k * 3] = point.x + acrossX * width * sign;
          positions[k * 3 + 1] = WATER_Y + 0.03;
          positions[k * 3 + 2] = point.z + acrossZ * width * sign;
          colors[k * 4] = 1;
          colors[k * 4 + 1] = 1;
          colors[k * 4 + 2] = 1;
          colors[k * 4 + 3] = alpha;
          uvs[k * 2] = sign > 0 ? width * 0.5 : 0;
          uvs[k * 2 + 1] = point.along / 4;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.uv.needsUpdate = true;
      trailMesh.visible = true;
      bowMesh.visible = way > 0.05;
      bowMesh.material.opacity = way;
      bowMesh.position.set(x, WATER_Y + 0.04, z);
      bowMesh.rotation.y = heading;
    },
    hide() {
      trail.length = 0;
      lastX = null;
      trailMesh.visible = false;
      bowMesh.visible = false;
    },
  };
}

/* a ring of white foam round something standing in the sea */
function addSurf(scene, x, z, inner, outer) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xf2f6f8,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  ring.position.set(x, WATER_Y + 0.02, z);
  scene.add(ring);
  surf.push(ring);
}

/** Per frame: the surf breathes, the mountain smokes and its crater flickers. */
export function updateSea(dt, time) {
  if (!craterGlow) {
    return;
  }
  updateWhitecaps(dt);
  for (let k = 0; k < surf.length; k++) {
    surf[k].material.opacity = 0.2 + 0.14 * Math.sin(time * 1.2 + k);
  }
  for (const puff of volcanoSmoke) {
    const t = (time * 0.04 + puff.userData.phase) % 1;
    puff.position.set(
      EMBER_ISLES.x - 10 + t * 18,
      WATER_Y + 36 + t * 22,
      EMBER_ISLES.z - 18 + t * 6,
    );
    puff.scale.setScalar(1 + t * 2.5);
    puff.material.opacity = 0.5 * (1 - t);
  }
  craterGlow.material.color.setRGB(1, 0.42 + 0.1 * Math.sin(time * 2.3), 0.15);
  for (const vent of steamVents) {
    for (const puff of vent.puffs) {
      const t = (time * 0.18 + puff.userData.phase) % 1;
      puff.position.set(vent.x + t * 1.5, WATER_Y + 1.4 + t * 5, vent.z);
      puff.scale.setScalar(0.6 + t * 1.8);
      puff.material.opacity = 0.4 * (1 - t);
    }
  }
}
