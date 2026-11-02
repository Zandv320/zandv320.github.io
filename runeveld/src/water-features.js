/* Eldoria – running water and the life of the ponds:
   - a brook that rises among rocks north of Greyfall Gorge, runs to the rim and falls down the north cliff into a
     pool of foam on the gorge floor, from where it joins the river;
   - a cascade over a heap of rocks into the pond of Whisperwood;
   - water lilies and reeds on the ponds, and now and then a fish that leaps out of the water.
   The water is drawn on the GPU in the game's pixels (two-pixel blocks, a few flat shades), like the sea; with smooth
   sprites the falls also throw up spray and vapour (weapon-fx.js). */
import * as THREE from "three";
import * as builders from "./builders.js";
import { gorgeNorthRim, gorgeOpening, FALL_X, BROOK_SPRING, brookCourse } from "./rules/gorge.js";
import { FISHING_PONDS } from "./rules/gather-nodes.js";
import { GORGE_DEPTH, riverZ } from "./northroad.js";
import { addFxPlace } from "./weapon-fx.js";
import { burst } from "./particles.js";
import { cameraState } from "./world.js";

/* the pond the cascade in Whisperwood falls into */
const FOREST_POND = FISHING_PONDS[1];
const POND_WATER_Y = 0.3;

const WATER_NOISE = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  /* four flat shades of water, from the deep to the foam */
  vec3 waterShade(float light) {
    vec3 deep = vec3(0.13, 0.33, 0.58);
    vec3 middle = vec3(0.3, 0.58, 0.84);
    vec3 pale = vec3(0.66, 0.86, 0.97);
    vec3 foam = vec3(0.95, 0.98, 1.0);
    light = floor(clamp(light, 0.0, 1.0) * 4.0) / 4.0;
    return light < 0.3 ? deep : light < 0.55 ? middle : light < 0.8 ? pale : foam;
  }
`;

const RIBBON_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* falling water: lanes of streaks rushing down, foam where it pours over the lip and where it strikes */
const FALL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSize;
  varying vec2 vUv;
  ${WATER_NOISE}
  void main() {
    /* across and down the fall in units, in blocks of two of the game's pixels */
    vec2 p = floor(vec2(vUv.x * uSize.x, vUv.y * uSize.y) * 8.0) / 8.0;
    float lane = floor(p.x * 3.0);
    float speed = 5.0 * (0.75 + 0.5 * hash(vec2(lane, 7.0)));
    float y = p.y - uTime * speed;
    float n = noise(vec2(p.x * 2.6, y * 0.7)) * 0.6 + noise(vec2(p.x * 6.0, y * 1.8)) * 0.4;
    float lip = 1.0 - smoothstep(0.0, 0.1, vUv.y);
    float strike = smoothstep(0.8, 1.0, vUv.y) * (0.6 + 0.5 * noise(vec2(p.x * 4.0, uTime * 5.0)));
    float light = n * 0.85 + lip * 0.5 + strike;
    /* ragged sides */
    float side = min(vUv.x, 1.0 - vUv.x) * uSize.x;
    if (side < 0.15 + 0.25 * noise(vec2(y * 1.4, vUv.x * 9.0))) {
      discard;
    }
    gl_FragColor = vec4(waterShade(light), 1.0);
  }
`;

/* a brook: ripples drifting downstream, foam along the banks */
const STREAM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSize;
  uniform float uSpeed;
  varying vec2 vUv;
  ${WATER_NOISE}
  void main() {
    vec2 p = floor(vec2(vUv.x * uSize.x, vUv.y * uSize.y) * 8.0) / 8.0;
    float y = p.y - uTime * uSpeed;
    float n = noise(vec2(p.x * 1.8, y * 1.1)) * 0.55 + noise(vec2(p.x * 4.0 + 3.0, y * 2.6)) * 0.45;
    float bank = min(vUv.x, 1.0 - vUv.x) * uSize.x;
    float foam = 1.0 - smoothstep(0.0, 0.35, bank - 0.1 * noise(vec2(y * 2.0, vUv.x * 5.0)));
    if (bank < 0.04 + 0.12 * noise(vec2(p.y * 1.7, vUv.x * 13.0))) {
      discard;
    }
    gl_FragColor = vec4(waterShade(n * 0.75 + foam * 0.55), 1.0);
  }
`;

/* foam where the fall strikes: rings of froth spreading out and breaking up */
const POOL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vUv;
  ${WATER_NOISE}
  void main() {
    vec2 p = floor((vUv - 0.5) * uRadius * 2.0 * 8.0) / 8.0;
    float r = length(p) / uRadius;
    if (r > 1.0) {
      discard;
    }
    float angle = atan(p.y, p.x);
    float rings = noise(vec2(angle * 3.0, r * 7.0 - uTime * 2.4));
    float froth = rings * (1.0 - r) * 1.8;
    if (froth < 0.45) {
      discard;
    }
    gl_FragColor = vec4(waterShade(0.55 + froth * 0.4), 1.0);
  }
`;

const animated = [];

function waterMaterial(fragmentShader, uniforms) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, ...uniforms },
    vertexShader: RIBBON_VERTEX,
    fragmentShader,
    side: THREE.DoubleSide,
  });
  animated.push(material);
  return material;
}

/* A ribbon of water along `points` ([x, y, z]), `widths` wide at each (across: horizontal, square to the way it
   runs); u runs across, v along it. */
function ribbon(points, widths) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let along = 0;
  points.forEach(([x, y, z], k) => {
    const [nx, , nz] = points[Math.min(points.length - 1, k + 1)];
    const [px, , pz] = points[Math.max(0, k - 1)];
    const dx = nx - px;
    const dz = nz - pz;
    const length = Math.hypot(dx, dz) || 1;
    /* across the way it runs, flat */
    const ax = -dz / length;
    const az = dx / length;
    const half = widths[k] / 2;
    if (k > 0) {
      const [lx, ly, lz] = points[k - 1];
      along += Math.hypot(x - lx, y - ly, z - lz);
    }
    positions.push(x - ax * half, y, z - az * half, x + ax * half, y, z + az * half);
    uvs.push(0, along, 1, along);
    if (k > 0) {
      const a = (k - 1) * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  });
  /* v from 0 to 1 over the whole length */
  for (let k = 1; k < uvs.length; k += 2) {
    uvs[k] /= along || 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return { geometry, length: along };
}

/* A sheet of falling water from a lip at `top` ([x, y, z]) to `bottom`, `width` wide at the top and widening a
   little as it falls, bulging out in +z (towards the camera) on the way down. */
function fallGeometry(top, bottom, width) {
  const points = [];
  const widths = [];
  const rows = 14;
  for (let k = 0; k <= rows; k++) {
    const t = k / rows;
    points.push([
      top[0] + (bottom[0] - top[0]) * t,
      top[1] + (bottom[1] - top[1]) * t * t * 0.6 + (bottom[1] - top[1]) * t * 0.4,
      top[2] + (bottom[2] - top[2]) * t + Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.35,
    ]);
    widths.push(width * (1 + t * 0.35));
  }
  /* a sheet hangs: u across in x, v down */
  const positions = [];
  const uvs = [];
  const indices = [];
  points.forEach(([x, y, z], k) => {
    const half = widths[k] / 2;
    positions.push(x - half, y, z, x + half, y, z);
    uvs.push(0, k / rows, 1, k / rows);
    if (k > 0) {
      const a = (k - 1) * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function waterfall(scene, top, bottom, width) {
  const height = top[1] - bottom[1];
  const mesh = new THREE.Mesh(
    fallGeometry(top, bottom, width),
    waterMaterial(FALL_FRAGMENT, { uSize: { value: new THREE.Vector2(width, height) } }),
  );
  scene.add(mesh);
  return mesh;
}

function stream(scene, points, widths, speed = 1.4) {
  const { geometry, length } = ribbon(points, widths);
  const width = Math.max(...widths);
  const mesh = new THREE.Mesh(
    geometry,
    waterMaterial(STREAM_FRAGMENT, {
      uSize: { value: new THREE.Vector2(width, length) },
      uSpeed: { value: speed },
    }),
  );
  scene.add(mesh);
  return mesh;
}

function foamPool(scene, x, y, z, radius) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    waterMaterial(POOL_FRAGMENT, { uRadius: { value: radius } }),
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
}

/* a rough stone: a few of them make the spring, the banks and the heap the cascade falls over */
function rock(scene, x, y, z, size, random, materials) {
  const geometry = new THREE.DodecahedronGeometry(size, 0);
  geometry.scale(1, 0.7 + random() * 0.4, 1);
  const mesh = new THREE.Mesh(geometry, materials.stone);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), materials.edge));
  mesh.position.set(x, y, z);
  mesh.rotation.set(random() * 3, random() * 3, random() * 3);
  scene.add(mesh);
}

/** Builds the falls, the brook and the life of the ponds (world.js calls this with its build context). */
export function buildWaterFeatures({ scene, prop, pending, seededRandom, obstacles }) {
  const random = seededRandom(6161);
  const materials = {
    stone: builders.material("stone", 2, 2, 0.6),
    edge: new THREE.LineBasicMaterial({ color: 0x0c0f2a }),
  };

  /* ----- the brook north of Greyfall Gorge: from a spring among rocks to the rim, then down the cliff ----- */
  const rimZ = gorgeNorthRim(FALL_X);
  const spring = BROOK_SPRING;
  const brook = brookCourse().map(([x, z]) => [x, 0.03, z]);
  stream(
    scene,
    brook,
    brook.map((_, k) => 1.2 + (k / 16) * 1.2),
  );
  for (let k = 0; k < 7; k++) {
    const angle = (k / 7) * Math.PI * 2;
    rock(
      scene,
      spring[0] + Math.cos(angle) * 1.4,
      0.2,
      spring[1] + Math.sin(angle) * 1.1,
      0.55,
      random,
      materials,
    );
  }
  obstacles.push({ x: spring[0], z: spring[1], r: 1.6 });
  for (let k = 2; k < 15; k += 3) {
    const [x, , z] = brook[k];
    const side = k % 2 ? 1 : -1;
    pending.push(prop("rock", x + side * (1.3 + random() * 0.4), z, { shadow: 0.8, scale: 0.9 }));
  }
  /* the fall down the north cliff, in front of the rock as it leans out at the foot */
  const footZ = rimZ + 1.5 * gorgeOpening(FALL_X) + 0.7;
  waterfall(scene, [FALL_X, 0.02, rimZ + 0.15], [FALL_X + 0.3, -GORGE_DEPTH + 0.05, footZ], 2.4);
  foamPool(scene, FALL_X + 0.3, -GORGE_DEPTH + 0.08, footZ + 0.6, 2);
  /* from the pool across the floor into the river */
  const riverEdge = riverZ(FALL_X + 1) - 1.4;
  stream(
    scene,
    [
      [FALL_X + 0.3, -GORGE_DEPTH + 0.06, footZ + 0.6],
      [FALL_X + 0.8, -GORGE_DEPTH + 0.06, (footZ + riverEdge) / 2],
      [FALL_X + 1, -GORGE_DEPTH + 0.06, riverEdge + 0.6],
    ],
    [2.2, 1.8, 2.2],
    2.2,
  );
  addFxPlace({
    element: "spray",
    x: FALL_X + 0.3,
    y: -GORGE_DEPTH + 0.3,
    z: footZ + 0.4,
    spread: 1,
    rate: 1.2,
  });

  /* ----- Whisperwood: a heap of rocks behind the pond, the water spilling over it into the pond ----- */
  const [pondX, pondZ, pondR] = FOREST_POND;
  const heapZ = pondZ - pondR - 1.6;
  for (const [dx, dy, dz, size] of [
    [0, 0.6, 0, 1.3],
    [-1.3, 0.4, 0.3, 0.9],
    [1.3, 0.45, 0.2, 1],
    [-0.4, 1.6, -0.3, 0.8],
    [0.6, 1.5, -0.2, 0.75],
    [0, 2.3, -0.5, 0.6],
  ]) {
    rock(scene, pondX + dx, dy, heapZ + dz, size, random, materials);
  }
  obstacles.push({ x: pondX, z: heapZ, r: 1.8 });
  waterfall(
    scene,
    [pondX, 2.55, heapZ + 0.1],
    [pondX + 0.1, POND_WATER_Y, pondZ - pondR + 0.7],
    1.1,
  );
  foamPool(scene, pondX + 0.1, POND_WATER_Y + 0.02, pondZ - pondR + 1.2, 1.1);
  addFxPlace({
    element: "spray",
    x: pondX + 0.1,
    y: POND_WATER_Y + 0.15,
    z: pondZ - pondR + 1.1,
    spread: 0.4,
    rate: 0.5,
  });
  cascades.push({ x: pondX + 0.1, y: POND_WATER_Y + 0.1, z: pondZ - pondR + 1.1, next: 0 });

  /* ----- the ponds: lilies, reeds, and fish ----- */
  for (const [x, z, r] of FISHING_PONDS) {
    pondLife(scene, x, z, r, random);
  }
}

/* ---------------------------------------------------------------- the life of the ponds -------------------------- */

/* a texture drawn as pixel art from rows of characters */
function pixelTexture(rows, colors) {
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (colors[cell]) {
        ctx.fillStyle = colors[cell];
        ctx.fillRect(x, y, 1, 1);
      }
    }),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const LILY_COLORS = {
  o: "#1f4a2a",
  g: "#3f8a44",
  l: "#6cbf5a",
  p: "#f4a6c8",
  w: "#fff4fa",
  y: "#ffe070",
};
const LILY = [
  "....oooo....",
  "..oogglgoo..",
  ".oggggllggo.",
  ".ogggg.gggo.",
  "oggggg..ggo.",
  "ogggggg.gggo",
  "oggglggggggo",
  ".oggggggggo.",
  ".oogggggggo.",
  "..oogggggoo.",
  "....oooo....",
  "............",
];
const LILY_FLOWER = [
  "....oooo....",
  "..oogglgoo..",
  ".ogggpwpggo.",
  ".oggpwywpgo.",
  "ogggpwwpggo.",
  "ogggppppgggo",
  "oggglggggggo",
  ".oggggggggo.",
  ".oogggggggo.",
  "..oogggggoo.",
  "....oooo....",
  "............",
];
const REEDS = [
  "..b.......b.....",
  ".bbb..b..bbb....",
  ".bbb.bbb.bbb..b.",
  ".bbb.bbb.bbb.bbb",
  ".bbb.bbb..g..bbb",
  "..g..bbb..g..bbb",
  "..g...g..g....g.",
  "..g...g..g...g..",
  ".g....g..g...g..",
  ".g...g...g...g..",
  ".g...g..g....g..",
  "g....g..g...g...",
  "g...g...g...g...",
  "g...g..g...g....",
  "d..d...d...d....",
  "d..d...d..d.....",
];
const REED_COLORS = { b: "#6b4424", g: "#5c9a46", d: "#3a6a34" };
const FISH = ["..oo.....", ".oooo..o.", "oywwoooo.", ".oooo..o.", "..oo....."];
const FISH_COLORS = { o: "#e07a3a", w: "#ffd8a8", y: "#20180e" };

const lilyTextures = [];
let reedTexture = null;
let fishTexture = null;
const ponds = [];
const reeds = [];
const lilies = [];
const cascades = [];
const ripples = [];
const ringGeometry = new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2);

function pondLife(scene, x, z, r, random) {
  if (!lilyTextures.length) {
    lilyTextures.push(pixelTexture(LILY, LILY_COLORS), pixelTexture(LILY_FLOWER, LILY_COLORS));
    reedTexture = pixelTexture(REEDS, REED_COLORS);
    fishTexture = pixelTexture(FISH, FISH_COLORS);
  }
  /* lilies on the water, a few in flower */
  for (let k = 0; k < 7; k++) {
    const angle = random() * Math.PI * 2;
    const distance = r * (0.25 + random() * 0.6);
    const size = 0.55 + random() * 0.3;
    const lily = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({
        map: lilyTextures[k % 3 === 0 ? 1 : 0],
        transparent: true,
        alphaTest: 0.5,
      }),
    );
    lily.position.set(
      x + Math.cos(angle) * distance,
      POND_WATER_Y + 0.01,
      z + Math.sin(angle) * distance,
    );
    lily.rotation.y = random() * Math.PI * 2;
    scene.add(lily);
    lilies.push({ mesh: lily, phase: random() * 6 });
  }
  /* reeds in clumps along the far edge, swaying */
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI + (random() - 0.5) * Math.PI * 1.3;
    const distance = r - 0.3;
    const reed = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: reedTexture, transparent: true, alphaTest: 0.5 }),
    );
    const size = 1.1 + random() * 0.4;
    reed.scale.set(size, size, 1);
    reed.center.set(0.5, 0);
    reed.position.set(x + Math.sin(angle) * distance, POND_WATER_Y, z + Math.cos(angle) * distance);
    scene.add(reed);
    reeds.push({ sprite: reed, phase: random() * 6 });
  }
  /* a fish that leaps now and then */
  const fish = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: fishTexture, transparent: true, alphaTest: 0.5 }),
  );
  fish.scale.set(0.6, 0.35, 1);
  fish.visible = false;
  scene.add(fish);
  ponds.push({ x, z, r, fish, leap: null, next: 3 + random() * 5 });
}

/* a ring spreading on the water where a fish broke the surface */
export function ripple(scene, x, z) {
  const mesh = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({
      color: 0xe8f6ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  mesh.position.set(x, POND_WATER_Y + 0.02, z);
  scene.add(mesh);
  ripples.push({ mesh, age: 0 });
}

const near = (x, z, range) =>
  Math.abs(x - cameraState.target.x) < range && Math.abs(z - cameraState.target.z) < range;

/** Per frame: the water flows, lilies bob, reeds sway, fish leap, ripples spread, the cascade splashes. */
export function updateWaterFeatures(dt, time, scene) {
  for (const material of animated) {
    material.uniforms.uTime.value = time;
  }
  for (const { mesh, phase } of lilies) {
    mesh.position.y = POND_WATER_Y + 0.01 + Math.sin(time * 1.3 + phase) * 0.008;
    mesh.rotation.y += Math.sin(time * 0.4 + phase) * dt * 0.05;
  }
  for (const { sprite, phase } of reeds) {
    sprite.material.rotation = Math.sin(time * 1.6 + phase) * 0.05;
  }
  for (const pond of ponds) {
    if (!near(pond.x, pond.z, 30)) {
      continue;
    }
    if (pond.leap) {
      const leap = pond.leap;
      leap.t += dt / 0.7;
      const t = Math.min(1, leap.t);
      pond.fish.position.set(
        leap.x0 + (leap.x1 - leap.x0) * t,
        POND_WATER_Y + Math.sin(Math.PI * t) * 0.9,
        leap.z0 + (leap.z1 - leap.z0) * t,
      );
      pond.fish.material.rotation = (0.5 - t) * 2 * (leap.x1 > leap.x0 ? 1 : -1);
      if (t >= 1) {
        pond.fish.visible = false;
        pond.leap = null;
        ripple(scene, leap.x1, leap.z1);
        burst(leap.x1, POND_WATER_Y + 0.1, leap.z1, {
          color: 0xd8f0ff,
          count: 6,
          speed: 1.4,
          size: 1.4,
        });
      }
      continue;
    }
    pond.next -= dt;
    if (pond.next <= 0) {
      pond.next = 4 + Math.random() * 7;
      const angle = Math.random() * Math.PI * 2;
      const distance = pond.r * 0.4 * Math.random();
      const x0 = pond.x + Math.cos(angle) * distance;
      const z0 = pond.z + Math.sin(angle) * distance;
      const way = Math.random() < 0.5 ? 1 : -1;
      pond.leap = { t: 0, x0, z0, x1: x0 + way * 1.2, z1: z0 + (Math.random() - 0.5) * 0.4 };
      pond.fish.material.map.repeat.x = way;
      pond.fish.material.map.offset.x = way < 0 ? 1 : 0;
      pond.fish.visible = true;
      ripple(scene, x0, z0);
    }
  }
  for (let k = ripples.length - 1; k >= 0; k--) {
    const entry = ripples[k];
    entry.age += dt;
    const t = entry.age / 0.9;
    entry.mesh.scale.setScalar(0.2 + t * 0.9);
    entry.mesh.material.opacity = 0.8 * (1 - t);
    if (t >= 1) {
      scene.remove(entry.mesh);
      entry.mesh.material.dispose();
      ripples.splice(k, 1);
    }
  }
  /* the cascade into the forest pond throws up a few droplets (pixel sparks without smooth sprites) */
  for (const cascade of cascades) {
    if (!near(cascade.x, cascade.z, 24) || time < cascade.next) {
      continue;
    }
    cascade.next = time + 0.25;
    burst(cascade.x, cascade.y, cascade.z, {
      color: 0xe4f4ff,
      count: 3,
      speed: 1.2,
      size: 1.4,
      life: 0.45,
    });
  }
}
