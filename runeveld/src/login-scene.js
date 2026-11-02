/* Eldoria – the stage of the start screens: a ring of old standing stones on a crag high above a sea of clouds, far
   from the rest of the world (like the crypt and the forge, so nothing wanders through). In the middle a heartstone
   with a rune that glows and a crystal floating over it; fire baskets either side of the hero, two banners behind,
   pines and rocks along the edge, and far off the peaks of other mountains standing out of the clouds.
   character-select.js puts the chosen hero in front of the heartstone and flies the camera in. */
import * as THREE from "three";
import * as builders from "./builders.js";

/** The middle of the stone circle, in the world. */
export const LOGIN_ORIGIN = [-420, 500];
const [ORIGIN_X, ORIGIN_Z] = LOGIN_ORIGIN;

/** Where the chosen hero stands: before the heartstone, facing the camera. */
export const LOGIN_PODIUM = { x: ORIGIN_X, z: ORIGIN_Z + 1.1 };

/** The fire baskets beside the hero (main.js lights them, with the night's other fires). */
export const LOGIN_FIRES = [-2.7, 2.7].map((dx) => [ORIGIN_X + dx, ORIGIN_Z + 0.4, 0.9]);

/** Sparkles round the heartstone's crystal (main.js plays them). */
export const LOGIN_SPARKLES = [
  { x: ORIGIN_X, z: ORIGIN_Z - 1.2, y: 3.2, size: 1.8, tint: 0x9ad8ff },
];

/** The heartstone's light, for the night haze. */
export const LOGIN_LIGHTS = [
  { x: ORIGIN_X, z: ORIGIN_Z - 1.2, y: 1.6, radius: 6, color: [120, 210, 255], strength: 0.75 },
];

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

/** Builds the crag, its stones and the clouds (world.js calls this with its build context). */
export function buildLoginScene({ scene, prop, pending, seededRandom }) {
  const random = seededRandom(4242);
  const group = new THREE.Group();
  group.position.set(ORIGIN_X, 0, ORIGIN_Z);
  scene.add(group);
  stage = group;

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

  /* ----- the heartstone: a tall stone with a glowing rune, and a crystal turning over it ----- */
  const heart = builders.runeStone(heartGlyph());
  heart.scale.setScalar(1.6);
  heart.position.set(0, 0, -1.2);
  heart.userData.glyph.material.color.set(0xbfe9ff);
  group.add(heart);
  crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34),
    new THREE.MeshBasicMaterial({ color: 0x8fdcff }),
  );
  crystal.scale.y = 1.7;
  crystal.position.set(0, 3.2, -1.2);
  group.add(crystal);

  /* ----- fire baskets beside the hero, banners behind ----- */
  for (const [x, z] of LOGIN_FIRES) {
    const brazier = builders.brazier();
    brazier.position.set(x - ORIGIN_X, 0, z - ORIGIN_Z);
    group.add(brazier);
  }
  for (const side of [-1, 1]) {
    const banner = builders.flag(3.4, "cloth_red");
    banner.position.set(side * 3.6, 0, -3.4);
    banner.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(banner);
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

  /* ----- other peaks, standing out of the clouds beside and behind the crag: [x, z, radius, top] ----- */
  const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xe8ecf6, flatShading: true });
  for (const [x, z, radius, top] of [
    [-7.5, -14, 4.5, 0.8],
    [8.5, -16, 5, 0.2],
    [0.5, -24, 7, -2.4],
    [-24, -9, 5, 2.5],
    [-31, -16, 7, 1.5],
    [29, -6, 5, 3],
    [36, -15, 7, 1.5],
  ]) {
    const base = CLOUD_Y - 4;
    const height = top - base;
    const mountain = new THREE.Group();
    mountain.position.set(x, base, z);
    mountain.rotation.y = random() * Math.PI;
    mountain.scale.set(0.75 + random() * 0.5, 1, 0.75 + random() * 0.5);
    /* the rock in the game's pixels: the basalt texture round the cone and up its slope */
    const slope = Math.hypot(radius, height);
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 7).translate(0, height / 2, 0),
      builders.material("basalt", Math.PI * 2 * radius, slope, 0.9),
    );
    mountain.add(edged(peak));
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.17, height * 0.17, 7).translate(
        0,
        height * 0.915 + 0.03,
        0,
      ),
      snowMaterial,
    );
    mountain.add(edged(snow));
    group.add(mountain);
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
    crystal.rotation.y = time * 0.8;
    crystal.position.y = 3.2 + Math.sin(time * 1.6) * 0.12;
  }
}

/* the dark outline along a mesh's sharp edges, like everything builders.js makes */
function edged(mesh) {
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 30),
      new THREE.LineBasicMaterial({ color: 0x0c0f2a }),
    ),
  );
  return mesh;
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
  const colors = { o: "#3a8fd0", Y: "#8fdcff", W: "#ffffff" };
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
