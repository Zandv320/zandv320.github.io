/* Eldoria – the stage of the start screens: a ring of old standing stones on a crag high above a sea of clouds, far
   from the rest of the world (like the crypt and the forge, so nothing wanders through). In the middle a heartstone
   with a blazing rune and a crystal floating over it, a ring of runes turning on the paving round it, fire baskets
   either side of the hero (both giving off the particles of an enchantment, weapon-fx.js), pines and rocks along the
   edge.
   character-select.js puts the chosen hero in front of the heartstone and flies the camera in. */
import * as THREE from "three";
import * as builders from "./builders.js";
import { SMOOTH } from "./sprites.js";
import { addFxPlace } from "./weapon-fx.js";

/** The middle of the stone circle, in the world. */
export const LOGIN_ORIGIN = [-420, 500];
const [ORIGIN_X, ORIGIN_Z] = LOGIN_ORIGIN;

/** Where the chosen hero stands: before the heartstone, facing the camera. */
export const LOGIN_PODIUM = { x: ORIGIN_X, z: ORIGIN_Z + 1.1 };

/** The fire baskets beside the hero: the fire burns in the bowl, `y` up (main.js lights them, with the night's
    other fires). */
export const LOGIN_FIRES = [-2.7, 2.7].map((dx) => ({
  x: ORIGIN_X + dx,
  z: ORIGIN_Z + 0.4,
  y: 1.02,
  size: 0.9,
}));

const HEART = { x: ORIGIN_X, z: ORIGIN_Z - 1.2 };
const CRYSTAL_Y = 3.4;

/** Sparkles round the heartstone's crystal (main.js plays them). */
export const LOGIN_SPARKLES = [{ ...HEART, y: CRYSTAL_Y, size: 2.2, tint: 0xd6b4ff }];

/* what gives off an enchantment's particles (weapon-fx.js addFxPlace): flames from the fire baskets, arcane motes
   round the crystal and up the face of the heartstone */
const LOGIN_FX = [
  ...LOGIN_FIRES.map(({ x, z, y }) => ({
    element: "flame",
    x,
    y: y + 0.12,
    z,
    spread: 0.22,
    rate: 0.7,
  })),
  { element: "arcane", ...HEART, y: CRYSTAL_Y, spread: 0.25, rate: 0.8 },
  { element: "arcane", x: HEART.x, z: HEART.z + 0.5, y: 1.4, spread: 0.45, rate: 0.6 },
];

/** The heartstone's light, for the night haze. */
export const LOGIN_LIGHTS = [
  { ...HEART, y: 1.8, radius: 7, color: [190, 140, 255], strength: 0.85 },
];

/* the arcane colours of the heartstone */
const RUNE_DEEP = 0x7a3cff;
const RUNE_LIGHT = 0xd9b8ff;

/* how far the crag reaches from its middle, per direction: round, with bays and points */
const reach = (angle) =>
  9 +
  Math.sin(angle * 3 + 0.6) * 0.9 +
  Math.sin(angle * 7 + 2.1) * 0.45 +
  Math.cos(angle * 2) * 0.6;

/** The hour the start screens show: the sun just down, the sky still warm. */
export const LOGIN_HOUR = 19.4;

const CLOUD_Y = -5;
const ROCK_DEPTH = 9;

let stage = null;
let clouds = null;
let crystal = null;
/* the lights that pulse: the halos round the rune and the crystal, the ring on the paving, the beam */
let runeHalo = null;
let crystalHalo = null;
let runeRing = null;
let beam = null;

/** Builds the crag, its stones and the clouds (world.js calls this with its build context). */
export function buildLoginScene({ scene, prop, pending, seededRandom }) {
  const random = seededRandom(4242);
  const group = new THREE.Group();
  group.position.set(ORIGIN_X, 0, ORIGIN_Z);
  scene.add(group);
  stage = group;
  LOGIN_FX.forEach(addFxPlace);

  /* ----- the crag: a column of dark rock down into the clouds, grass on top, old paving in the middle ----- */
  const rock = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline(1, 0), {
      depth: ROCK_DEPTH,
      bevelEnabled: false,
      curveSegments: 1,
    })
      .rotateX(-Math.PI / 2)
      .translate(0, -ROCK_DEPTH, 0),
    builders.material("basalt", 1, 1, 0.8),
  );
  group.add(rock);
  const grass = new THREE.Mesh(
    new THREE.ShapeGeometry(outline(1, -0.15)).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x5c8a4c }),
  );
  grass.position.y = 0.01;
  group.add(grass);
  const paving = builders.plaza(5.4, "cobbles2", 0.78);
  group.add(paving);

  /* ----- the ring of standing stones, open towards the camera ----- */
  for (let k = 0; k < 8; k++) {
    /* eight stones, none straight behind the heartstone */
    const angle = Math.PI * 0.32 + (k / 7) * Math.PI * 1.36;
    const isBroken = k === 2 || k === 5;
    const stone = builders.menhir(isBroken ? 1.1 : 2.2 + random() * 0.8);
    stone.position.set(Math.sin(angle) * 6.2, 0, Math.cos(angle) * 6.2);
    stone.rotation.y = angle + Math.PI;
    stone.rotation.z = (random() - 0.5) * 0.12;
    group.add(stone);
  }

  /* ----- the heartstone: a tall stone with a blazing rune, a beam of light up to a crystal turning over it ----- */
  const heart = builders.runeStone(heartGlyph());
  heart.scale.setScalar(1.7);
  heart.position.set(0, 0, HEART.z - ORIGIN_Z);
  const face = heart.userData.glyph;
  face.material = new THREE.MeshBasicMaterial({ map: face.material.map, transparent: true });
  face.scale.setScalar(1.25);
  group.add(heart);
  /* the halo of the rune, and of the crystal: soft light that always faces the camera, drawn after the haze (with
     smooth sprites only: the pixel art has the rune and the crystal alone) */
  runeHalo = halo(RUNE_DEEP, 2.6);
  runeHalo.position.set(0, 1.7, HEART.z - ORIGIN_Z + 0.6);
  runeHalo.visible = SMOOTH;
  group.add(runeHalo);
  crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36),
    new THREE.MeshBasicMaterial({ color: RUNE_LIGHT }),
  );
  crystal.scale.y = 1.7;
  crystal.position.set(0, CRYSTAL_Y, HEART.z - ORIGIN_Z);
  group.add(crystal);
  crystalHalo = halo(RUNE_DEEP, 2.2);
  crystalHalo.position.copy(crystal.position);
  crystalHalo.visible = SMOOTH;
  group.add(crystalHalo);
  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.2, CRYSTAL_Y - 2.3, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: RUNE_LIGHT,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beam.position.set(0, (CRYSTAL_Y + 2.3) / 2, HEART.z - ORIGIN_Z);
  beam.renderOrder = 10001;
  beam.visible = SMOOTH;
  group.add(beam);
  /* a ring of runes on the paving round the heartstone and the hero, turning slowly */
  runeRing = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: ringTexture(),
      color: 0xb98cff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  runeRing.position.set(0, 0.05, -0.15);
  runeRing.renderOrder = 10001;
  group.add(runeRing);

  /* ----- fire baskets beside the hero ----- */
  for (const { x, z } of LOGIN_FIRES) {
    const brazier = builders.brazier();
    brazier.position.set(x - ORIGIN_X, 0, z - ORIGIN_Z);
    group.add(brazier);
  }

  /* ----- pines, bushes and rocks along the sides; the back stays open, for the view over the clouds ----- */
  for (let k = 0; k < 22; k++) {
    const side = k % 2 ? 1 : -1;
    /* from beside the hero round to the back corner, never straight behind the heartstone */
    const angle = Math.PI + side * (Math.PI * 0.3 + random() * Math.PI * 0.42);
    const distance = reach(angle) - 0.6 - random() * 1.8;
    const x = ORIGIN_X + Math.sin(angle) * distance;
    const z = ORIGIN_Z + Math.cos(angle) * distance;
    const roll = random();
    const name = roll < 0.5 ? "pine" : roll < 0.65 ? "pine2" : roll < 0.82 ? "rock" : "bush";
    pending.push(prop(name, x, z, { shadow: name === "rock" ? 0.8 : 1.6, scale: 1.3 }));
  }

  /* ----- the sea of clouds ----- */
  clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: CLOUD_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
    }),
  );
  clouds.position.set(ORIGIN_X, CLOUD_Y, ORIGIN_Z - 80);
  scene.add(clouds);
}

/** Once a hero is in the world nobody sees the stage again: it stops being drawn. */
export function hideLoginScene() {
  if (stage) {
    stage.visible = false;
    clouds.visible = false;
  }
}

/** Per frame: the clouds drift, the crystal turns and bobs. */
export function updateLoginScene(dt, time) {
  if (clouds) {
    clouds.material.uniforms.uTime.value = time;
  }
  if (crystal) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    crystal.rotation.y = time * 0.8;
    crystal.position.y = CRYSTAL_Y + Math.sin(time * 1.6) * 0.12;
    crystalHalo.position.y = crystal.position.y;
    crystalHalo.material.opacity = 0.55 + 0.35 * pulse;
    runeHalo.material.opacity = 0.45 + 0.4 * pulse;
    runeHalo.scale.setScalar(2.6 * (0.92 + 0.12 * pulse));
    beam.material.opacity = 0.22 + 0.2 * pulse;
    runeRing.rotation.y = time * 0.12;
    runeRing.material.opacity = 0.55 + 0.3 * pulse;
  }
}

/* the crag's outline, `scale` times its reach plus `grow`, as a shape (y towards -z once laid down) */
function outline(scale, grow) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 72; k++) {
    const angle = (k / 72) * Math.PI * 2;
    const r = reach(angle) * scale + grow;
    const x = Math.sin(angle) * r;
    const y = -Math.cos(angle) * r;
    if (k === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  return shape;
}

/* soft round light of `size` units, always facing the camera, added to what is behind it (over the night haze) */
function halo(color, size) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.setScalar(size);
  sprite.renderOrder = 10001;
  return sprite;
}

/* the ring of runes on the paving, in the game's pixels: two circles with runes between them, 96 × 96 */
function ringTexture() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const middle = size / 2;
  ctx.fillStyle = "#fff";
  /* the two circles, a pixel wide */
  for (let k = 0; k < 360; k++) {
    const angle = (k / 360) * Math.PI * 2;
    for (const radius of [45, 36, 33]) {
      ctx.fillRect(
        Math.round(middle + Math.cos(angle) * radius),
        Math.round(middle + Math.sin(angle) * radius),
        1,
        1,
      );
    }
  }
  /* runes between the outer circles: small marks of three to five pixels */
  const marks = [
    [
      [0, -2],
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
      [1, -1],
      [-1, 1],
    ],
    [
      [-1, -2],
      [-1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, -2],
      [-1, -1],
      [1, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [-1, -2],
      [1, -2],
      [0, -1],
      [0, 0],
      [-1, 1],
      [1, 1],
      [0, 2],
    ],
  ];
  for (let k = 0; k < 16; k++) {
    const angle = (k / 16) * Math.PI * 2;
    const x = Math.round(middle + Math.cos(angle) * 40.5);
    const y = Math.round(middle + Math.sin(angle) * 40.5);
    for (const [dx, dy] of marks[k % marks.length]) {
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
  /* a star of light lines inside */
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const b = ((k + 2) / 6) * Math.PI * 2;
    for (let t = 0; t <= 1; t += 1 / 60) {
      const x = Math.cos(a) * (1 - t) + Math.cos(b) * t;
      const y = Math.sin(a) * (1 - t) + Math.sin(b) * t;
      ctx.fillRect(Math.round(middle + x * 33), Math.round(middle + y * 33), 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return texture;
}

/* the rune on the heartstone: a star of four points in a ring, 16 × 16 pixels */
function heartGlyph() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const rows = [
    "................",
    ".......Y........",
    ".....ooYoo......",
    "....o..Y..o.....",
    "...o...Y...o....",
    "...o..YYY..o....",
    "..o..YYWYY..o...",
    ".YYYYYWWWYYYYY..",
    "..o..YYWYY..o...",
    "...o..YYY..o....",
    "...o...Y...o....",
    "....o..Y..o.....",
    ".....ooYoo......",
    ".......Y........",
    "................",
    "................",
  ];
  const colors = { o: "#8a4dff", Y: "#d9b8ff", W: "#ffffff" };
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

/* The clouds, drawn in the game's pixels: soft heaps in a few flat shades, lit pink and gold on top towards the
   sunset and deep blue in their hollows, drifting slowly. */
const CLOUD_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const CLOUD_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int k = 0; k < 5; k++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }
  void main() {
    /* whole game pixels: 16 to a unit, in blocks of two */
    vec2 p = floor(vWorld * 8.0) / 8.0;
    vec2 drift = vec2(uTime * 0.35, uTime * 0.12);
    float heap = fbm((p + drift) * 0.07);
    /* the light comes from the far side: a heap is lit on its far slope */
    float lit = heap - fbm((p + drift + vec2(0.0, 2.5)) * 0.07);
    float shade = clamp(heap * 1.35 - 0.25 + lit * 2.2, 0.0, 1.0);
    shade = floor(shade * 5.0) / 4.0;
    vec3 hollow = vec3(0.16, 0.18, 0.36);
    vec3 body = vec3(0.42, 0.42, 0.66);
    vec3 top = vec3(0.86, 0.68, 0.74);
    vec3 rim = vec3(1.0, 0.86, 0.66);
    vec3 color = shade < 0.5 ? mix(hollow, body, shade * 2.0) : mix(body, top, (shade - 0.5) * 2.0);
    color = mix(color, rim, step(0.99, shade) * 0.6);
    gl_FragColor = vec4(color, 1.0);
  }
`;
