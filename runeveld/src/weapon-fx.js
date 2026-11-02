/* Eldoria – an enchanted weapon or shield shows its enchantment (rules/item-mods.js ENCHANTMENTS) on the hero who
   carries it:
   a glow that follows the outline of the blade or staff frame by frame, and particles that rise, drift, crackle
   or circle from the weapon itself. Not pixel art: soft light over the pixel sprites, so the enchantment reads at
   a glance.
     flame   the blade burns: a flickering orange halo licking upwards, flames and embers rising off it
     frost   a cold blue rime: a slow shimmer, snow sparkles and a breath of mist sinking from it
     storms  it crackles: a stuttering yellow-white glow, lightning arcs jumping along it and sparks spitting off
     arcane  violet light pulses along it, and motes of it circle the weapon
     radiance  (shields) a soft warm light round the shield's rim, a small cross of light in the middle of its face,
             and golden motes rising from it
   Refined armour (body armour or robe, helmet or hat, cloak: each by its own refine) shines too, richer the
   higher it is refined (refineGlow): from +4 a sheen
   now and then sweeps across it, from +7 more often and with glints on it, at +10 it has a golden rim and golden
   motes rise off it. refineFlash() is the moment of refining: a sweep of light down the hero, or grey shards.
   The glow is a second mesh on each weapon layer of the sprite (the front and the back half of the weapon), with
   the same geometry and texture, drawn additively after the night haze; the particles are one point cloud for all
   heroes. Where the particles start comes from the weapon's own pixels in the frame on show (Sprite2D.cell). */
import * as THREE from "three";
import { scene, camera, cameraState } from "./world.js";
import { rarityOf } from "./rules/rarity.js";
import { GLOW_SHAPE } from "./glow-points.js";

/* per enchantment: the part it lights, glow (halo) and core colours, the light it casts at night (daylight.js) */
const ELEMENTS = {
  flame: {
    part: "weapon",
    kind: 0,
    glow: 0xff6a14,
    core: 0xffd27a,
    light: [255, 140, 60],
    strength: 1.15,
  },
  frost: {
    part: "weapon",
    kind: 1,
    glow: 0x4cc4ff,
    core: 0xe4f8ff,
    light: [140, 210, 255],
    strength: 1,
  },
  storms: {
    part: "weapon",
    kind: 2,
    glow: 0xffd23a,
    core: 0xfffbe0,
    light: [255, 230, 140],
    strength: 1.1,
  },
  arcane: {
    part: "weapon",
    kind: 3,
    glow: 0xa45cff,
    core: 0xf2e0ff,
    light: [190, 130, 255],
    strength: 1.05,
  },
  /* refined armour: the tiers of refineGlow(); its part is the slot it is worn in, given along with it */
  refine1: { part: "body", kind: 5, glow: 0xffffff, core: 0xf2f6ff, light: null, strength: 1 },
  refine2: { part: "body", kind: 6, glow: 0xfff0c8, core: 0xffffff, light: null, strength: 1 },
  refine3: {
    part: "body",
    kind: 7,
    glow: 0xffc94a,
    core: 0xfff4d0,
    light: [255, 214, 120],
    strength: 1,
  },
  /* epic and legendary gear without an enchantment or refine of its own: a violet sheen, or a golden rim */
  epic: { part: "weapon", kind: 6, glow: 0xc99bff, core: 0xeedcff, light: null, strength: 0.9 },
  legendary: {
    part: "weapon",
    kind: 7,
    glow: 0xffb84d,
    core: 0xfff0d0,
    light: [255, 200, 120],
    strength: 0.9,
  },
  radiance: {
    part: "shield",
    kind: 4,
    glow: 0xffd98a,
    core: 0xfff8e6,
    light: [255, 238, 196],
    strength: 1,
  },
};

/* the layers of the sprite that make up each part */
const PARTS = {
  weapon: (layer) => !!layer.source?.userData?.isWeapon,
  shield: (layer) => !!layer.source?.userData?.isShield,
  /* refined gear, per equipment slot */
  body: (layer) => layer.source?.userData?.refineSlot === "body",
  head: (layer) => layer.source?.userData?.refineSlot === "head",
  cloak: (layer) => layer.source?.userData?.refineSlot === "cloak",
};

/** The equipment slots whose refine shows on the hero. */
export const REFINE_SLOTS = ["body", "head", "cloak"];

/** The shine of an epic or legendary item (its part is the slot it is worn in), or null. */
export const rarityGlow = (id) => {
  const grade = rarityOf(id);
  return grade === "epic" || grade === "legendary" ? grade : null;
};

/** The look of armour refined to `level`: none below +4, then three tiers (+4, +7, +10). */
export const refineGlow = (level) =>
  level >= 10 ? "refine3" : level >= 7 ? "refine2" : level >= 4 ? "refine1" : null;

/* ---------------------------------------------------------------- the glow ----------------------------------- */

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform sampler2D map;
  uniform mat3 uvTransform;
  uniform float uStep;
  uniform vec3 uGlow;
  uniform vec3 uCore;
  uniform float uTime;
  uniform float uKind;
  uniform float uStrength;
  uniform vec2 uCenter;
  uniform float uCross;
  varying vec2 vUv;

  /* the weapon's alpha at a point of the frame (0 to 1 across it); nothing outside the frame */
  float alphaAt(vec2 f) {
    if (f.x < 0.0 || f.x > 1.0 || f.y < 0.0 || f.y > 1.0) {
      return 0.0;
    }
    return texture2D(map, (uvTransform * vec3(f, 1.0)).xy).a;
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }

  void main() {
    vec2 q = vUv * vec2(22.0, 16.0);
    float n;
    vec2 base = vUv;
    if (uKind < 0.5) {
      /* flame: noise rising through it, and the halo pulled upwards like flames */
      n = noise(q + vec2(0.0, -uTime * 7.0)) * 0.7 + noise(q * 2.3 + vec2(0.0, -uTime * 11.0)) * 0.3;
      base.y -= uStep * (1.5 + 2.5 * n);
    } else if (uKind < 1.5) {
      /* frost: a slow shimmer running up the blade */
      n = 0.7 + 0.3 * sin(uTime * 2.2 + vUv.y * 26.0 + vUv.x * 9.0);
    } else if (uKind < 2.5) {
      /* storms: a stuttering crackle */
      float flick = step(0.35, hash(vec2(floor(uTime * 18.0), 3.1)));
      n = (0.35 + 0.9 * step(0.62, noise(q * 1.7 + uTime * 26.0))) * (0.55 + 0.45 * flick);
    } else if (uKind < 3.5) {
      /* arcane: waves of light pulsing along it */
      n = 0.55 + 0.45 * sin(uTime * 3.4 - (vUv.x + vUv.y) * 30.0);
    } else if (uKind < 4.5) {
      /* radiance: a slow, warm breathing */
      n = 0.75 + 0.25 * sin(uTime * 1.7);
    } else {
      /* refined armour: its own sheen below */
      n = 1.0;
    }
    float own = alphaAt(vUv);
    float halo = 0.0;
    for (int i = 0; i < 12; i++) {
      float angle = float(i) * 0.5235988;
      vec2 d = vec2(cos(angle), sin(angle)) * uStep;
      halo += alphaAt(base + d * 1.8) * 0.55 + alphaAt(base + d * 3.8) * 0.3 + alphaAt(base + d * 6.5) * 0.18;
    }
    halo = clamp(halo / 5.0, 0.0, 1.0);
    float edge = halo * (1.0 - own);
    vec3 color;
    if (uKind > 4.5) {
      /* refined armour: a band of light sweeping across it, top left to bottom right, every few seconds (more
         often from +7); at +10 a golden rim besides */
      float period = uKind < 5.5 ? 3.6 : 2.2;
      float phase = fract(uTime / period) * 2.4 - 0.4;
      float across = vUv.x * 0.6 + (1.0 - vUv.y);
      float band = exp(-pow((across - phase) * 9.0, 2.0));
      float sheen = uKind < 5.5 ? 0.35 : 0.45;
      color = uCore * own * band * sheen;
      if (uKind > 6.5) {
        color += uGlow * edge * (0.38 + 0.14 * sin(uTime * 2.0)) + uGlow * own * 0.05;
      }
    } else if (uKind > 3.5) {
      /* radiance: only a soft light round the rim of the shield, its face left as it is */
      color = uGlow * edge * (0.3 + 0.25 * n);
    } else {
      color = uGlow * edge * (0.45 + 0.75 * n) + uCore * own * (0.16 + 0.3 * n);
    }
    if (uCross > 0.5) {
      /* a small cross of light in the middle of the shield's face: thin, the upright longer than the bar, which
         sits a little high, growing and shrinking a little as it breathes */
      vec2 d = (vUv - uCenter) / uStep;
      float reach = 3.6 + 0.8 * sin(uTime * 1.3);
      float barY = d.y - 1.0;
      float upright = exp(-d.x * d.x * 2.0) * exp(-d.y * d.y / (reach * reach));
      float bar = exp(-barY * barY * 2.0) * exp(-d.x * d.x / (reach * reach * 0.5));
      float heart = exp(-dot(d, d) / 3.0);
      color += uCore * max(upright, bar) * own * (0.6 + 0.3 * n) + uCore * heart * 0.25 * n;
    }
    gl_FragColor = vec4(color * uStrength, 1.0);
  }
`;

function makeGlow(layer) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: layer.texture },
      uvTransform: { value: new THREE.Matrix3() },
      uStep: { value: 1 / 64 },
      uGlow: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uTime: { value: 0 },
      uKind: { value: 0 },
      uStrength: { value: 1 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uCross: { value: 0 },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(layer.mesh.geometry, material);
  /* just in front of the weapon it lights, over the night haze */
  mesh.position.z = 0.002;
  mesh.renderOrder = 10001;
  mesh.frustumCulled = false;
  layer.mesh.add(mesh);
  return mesh;
}

function removeGlow(layer) {
  const glow = layer.mesh.userData.weaponGlow;
  if (glow) {
    glow.removeFromParent();
    glow.material.dispose();
    delete layer.mesh.userData.weaponGlow;
  }
}

/* ---------------------------------------------------------------- the weapon's pixels ------------------------ */

/* per weapon texture: cell index → the weapon's pixels in it, as frame pixels [x0, y0, x1, y1, …] */
const pixelCache = new WeakMap();
let cellCanvas = null;

function weaponPixels(source, sprite) {
  const { row, column } = sprite.cell || { row: 0, column: 0 };
  let cells = pixelCache.get(source);
  if (!cells) {
    cells = new Map();
    pixelCache.set(source, cells);
  }
  const key = row * 64 + column;
  let pixels = cells.get(key);
  if (pixels) {
    return pixels;
  }
  const image = source.image;
  const size = Math.round(image.width / sprite.cols);
  cellCanvas = cellCanvas || document.createElement("canvas");
  cellCanvas.width = cellCanvas.height = size;
  const context = cellCanvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, size, size);
  context.drawImage(image, column * size, row * size, size, size, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  /* in pixels of the 64 px frame, whatever the sheet's own scale */
  const toFrame = 64 / size;
  const list = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 128) {
        list.push(x * toFrame, y * toFrame);
      }
    }
  }
  pixels = new Float32Array(list);
  cells.set(key, pixels);
  return pixels;
}

/* ---------------------------------------------------------------- the particles ------------------------------ */

const POOL = 1400;
let cloud = null;
const particles = [];
let nextParticle = 0;

function initCloud() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(POOL), 1));
  geometry.setAttribute("shape", new THREE.BufferAttribute(new Float32Array(POOL), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelsPerUnit: { value: 32 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float shape;
      attribute vec3 color;
      uniform float pixelsPerUnit;
      varying vec3 vColor;
      varying float vShape;
      void main() {
        vColor = color;
        vShape = shape;
        gl_PointSize = size * pixelsPerUnit;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vShape;
      ${GLOW_SHAPE}
      void main() {
        /* 0: a soft round glow; 1: a four-pointed sparkle with a bright heart */
        float light = glowShape(gl_PointCoord, vShape);
        if (light < 0.01) {
          discard;
        }
        gl_FragColor = vec4(vColor * light, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  cloud.renderOrder = 10002;
  scene.add(cloud);
  for (let i = 0; i < POOL; i++) {
    particles.push({
      age: 1,
      life: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size0: 0,
      size1: 0,
      shape: 0,
      kind: "",
      /* arcane motes circle this point */
      cx: 0,
      cz: 0,
      seed: 0,
    });
  }
}

function emit(fields) {
  const particle = particles[nextParticle];
  nextParticle = (nextParticle + 1) % POOL;
  Object.assign(
    particle,
    { age: 0, vx: 0, vy: 0, vz: 0, shape: 0, seed: Math.random() * 10 },
    fields,
  );
}

const random = (min, max) => min + Math.random() * (max - min);
const mixColor = (a, b, t, out) => out.copy(a).lerp(b, t);

const FLAME_HOT = new THREE.Color(0xfff2c0);
const FLAME_MID = new THREE.Color(0xff8a1e);
const FLAME_DEEP = new THREE.Color(0xb8240c);
const FROST_LIGHT = new THREE.Color(0xf4fdff);
const FROST_BLUE = new THREE.Color(0x58c8ff);
const STORM_WHITE = new THREE.Color(0xfffff0);
const STORM_GOLD = new THREE.Color(0xffc83a);
const ARCANE_LIGHT = new THREE.Color(0xfbeaff);
const ARCANE_VIOLET = new THREE.Color(0x9d4dff);
const RADIANT_WHITE = new THREE.Color(0xfffcf0);
const RADIANT_GOLD = new THREE.Color(0xffc860);
const GILDED_DEEP = new THREE.Color(0xd8901c);
const SHARD_GREY = new THREE.Color(0xd4dae6);
const HEAL_LIGHT = new THREE.Color(0xeaffd8);
const HEAL_GREEN = new THREE.Color(0x56e08a);
const MANA_LIGHT = new THREE.Color(0xe6f4ff);
const MANA_BLUE = new THREE.Color(0x3f8cff);
const RAGE_LIGHT = new THREE.Color(0xffe0d0);
const RAGE_RED = new THREE.Color(0xff3a3a);
const EARTH_LIGHT = new THREE.Color(0xf0dcb4);
const EARTH_BROWN = new THREE.Color(0x8a6236);
const scratch = new THREE.Color();

/* the colour and brightness of a particle at share t of its life */
function particleColor(particle, t) {
  switch (particle.kind) {
    case "flame":
      return t < 0.35
        ? mixColor(FLAME_HOT, FLAME_MID, t / 0.35, scratch)
        : mixColor(FLAME_MID, FLAME_DEEP, (t - 0.35) / 0.65, scratch).multiplyScalar(1 - t * 0.6);
    case "ember":
      return scratch.copy(FLAME_MID).lerp(FLAME_HOT, 0.4 + 0.4 * Math.sin(particle.seed + t * 20));
    case "snow":
    case "flurry":
      /* it twinkles as it falls */
      return mixColor(FROST_LIGHT, FROST_BLUE, t, scratch).multiplyScalar(
        0.55 + 0.45 * Math.abs(Math.sin(particle.seed + t * 14)),
      );
    case "mist":
      return scratch.copy(FROST_BLUE).multiplyScalar(0.22 * Math.sin(Math.PI * t));
    case "spark":
      return mixColor(STORM_WHITE, STORM_GOLD, t, scratch);
    case "bolt":
      return scratch.copy(STORM_WHITE).multiplyScalar(1 - t * 0.5);
    case "holy":
      return mixColor(RADIANT_WHITE, RADIANT_GOLD, t, scratch).multiplyScalar(
        Math.sin(Math.PI * t),
      );
    case "gilded":
      return mixColor(RADIANT_GOLD, GILDED_DEEP, t, scratch).multiplyScalar(Math.sin(Math.PI * t));
    case "sweep":
      return mixColor(RADIANT_WHITE, RADIANT_GOLD, t, scratch).multiplyScalar(1 - t * 0.7);
    case "shard":
      return scratch.copy(SHARD_GREY).multiplyScalar(1 - t);
    case "glint":
      return scratch.copy(RADIANT_WHITE).multiplyScalar(Math.sin(Math.PI * t) * 1.2);
    case "heal":
      return mixColor(HEAL_LIGHT, HEAL_GREEN, t, scratch).multiplyScalar(
        Math.sin(Math.PI * t) * 1.1,
      );
    case "mana":
      return mixColor(MANA_LIGHT, MANA_BLUE, t, scratch).multiplyScalar(
        Math.sin(Math.PI * t) * 1.1,
      );
    case "rage":
      return mixColor(RAGE_LIGHT, RAGE_RED, t, scratch).multiplyScalar(1 - t * 0.7);
    case "dust":
      return mixColor(EARTH_LIGHT, EARTH_BROWN, t, scratch).multiplyScalar(0.55 * (1 - t));
    case "mote":
      return mixColor(ARCANE_LIGHT, ARCANE_VIOLET, t, scratch).multiplyScalar(
        0.6 + 0.4 * Math.sin(particle.seed + t * 9),
      );
    default:
      return scratch.set(0xffffff);
  }
}

function updateCloud(dt) {
  const geometry = cloud.geometry;
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  const size = geometry.attributes.size;
  const shape = geometry.attributes.shape;
  for (let i = 0; i < POOL; i++) {
    const particle = particles[i];
    if (particle.age >= particle.life) {
      if (size.getX(i) !== 0) {
        size.setX(i, 0);
      }
      continue;
    }
    particle.age += dt;
    const t = Math.min(1, particle.age / particle.life);
    if (particle.kind === "mote" || particle.kind === "flurry") {
      /* arcane motes circle their weapon as they rise */
      const dx = particle.x - particle.cx;
      const dz = particle.z - particle.cz;
      const turn = dt * (particle.kind === "flurry" ? 2.2 : 3.2);
      particle.x = particle.cx + dx * Math.cos(turn) - dz * Math.sin(turn);
      particle.z = particle.cz + dx * Math.sin(turn) + dz * Math.cos(turn);
    } else if (particle.kind === "flame" || particle.kind === "ember") {
      /* flames sway as they rise */
      particle.vx += Math.sin(particle.seed + particle.age * 9) * dt * 1.2;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    if (particle.kind === "spark") {
      particle.vy -= 6 * dt;
    } else if (particle.kind === "shard" || particle.kind === "dust") {
      particle.vy -= (particle.kind === "dust" ? 4 : 9) * dt;
    }
    const tint = particleColor(particle, t);
    position.setXYZ(i, particle.x, particle.y, particle.z);
    color.setXYZ(i, tint.r, tint.g, tint.b);
    size.setX(i, particle.size0 + (particle.size1 - particle.size0) * t);
    shape.setX(i, particle.shape);
  }
  position.needsUpdate = true;
  color.needsUpdate = true;
  size.needsUpdate = true;
  shape.needsUpdate = true;
  cloud.material.uniforms.pixelsPerUnit.value = cameraState.px || 32;
}

/* ---------------------------------------------------------------- lightning ---------------------------------- */

const ARC_POINTS = 8;
const ARC_POOL = 24;
let arcs = null;

function initArcs() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(ARC_POOL * (ARC_POINTS - 1) * 2 * 3), 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xfff6c8,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  arcs = { mesh: new THREE.LineSegments(geometry, material), used: 0 };
  arcs.mesh.frustumCulled = false;
  arcs.mesh.renderOrder = 10003;
  scene.add(arcs.mesh);
}

/* a jagged bolt from a to b, into the next free stretch of the line buffer */
function drawArc(a, b) {
  if (arcs.used >= ARC_POOL) {
    return;
  }
  const position = arcs.mesh.geometry.attributes.position;
  const points = [];
  for (let k = 0; k < ARC_POINTS; k++) {
    const t = k / (ARC_POINTS - 1);
    const jitter = k === 0 || k === ARC_POINTS - 1 ? 0 : 0.16;
    points.push([
      a.x + (b.x - a.x) * t + random(-jitter, jitter),
      a.y + (b.y - a.y) * t + random(-jitter, jitter),
      a.z + (b.z - a.z) * t + random(-jitter, jitter),
    ]);
  }
  let index = arcs.used * (ARC_POINTS - 1) * 2;
  for (let k = 0; k < ARC_POINTS - 1; k++) {
    position.setXYZ(index++, ...points[k]);
    position.setXYZ(index++, ...points[k + 1]);
    /* a spark at every bend */
    if (Math.random() < 0.35) {
      emit({
        kind: "bolt",
        x: points[k][0],
        y: points[k][1],
        z: points[k][2],
        life: 0.08,
        size0: 0.16,
        size1: 0.05,
        shape: 0,
      });
    }
  }
  arcs.used++;
}

function finishArcs() {
  const position = arcs.mesh.geometry.attributes.position;
  arcs.mesh.geometry.setDrawRange(0, arcs.used * (ARC_POINTS - 1) * 2);
  position.needsUpdate = true;
}

/* ---------------------------------------------------------------- per hero ----------------------------------- */

const pointA = new THREE.Vector3();
const towardsCamera = new THREE.Vector3();

/* A random point of the weapon in the world. Sources: [{pixels, lift}], the front half of the weapon first; a
   point of the front half is lifted towards the camera, so the body (in the same plane) does not hide its
   particles, and one of the back half (the weapon held on the far side: facing left or away) is pushed behind
   the body, so the body hides them as it hides the weapon, until they rise clear of it. */
function weaponPoint(sprite, sources, target) {
  const source = sources.length > 1 && Math.random() < 0.3 ? sources[1] : sources[0];
  const k = Math.floor(Math.random() * (source.pixels.length / 2)) * 2;
  sprite.framePointToWorld(source.pixels[k], source.pixels[k + 1], target);
  return target.addScaledVector(towardsCamera, source.lift);
}

/* how many particles per second each element gives off, and how to make one at a point of the weapon */
const EMITTERS = {
  flame: [
    [
      60,
      (p) => ({
        kind: "flame",
        x: p.x,
        y: p.y,
        z: p.z,
        vx: random(-0.15, 0.15),
        vy: random(0.9, 1.6),
        vz: random(-0.1, 0.1),
        life: random(0.35, 0.7),
        size0: random(0.2, 0.32),
        size1: 0.04,
      }),
    ],
    [
      9,
      (p) => ({
        kind: "ember",
        x: p.x,
        y: p.y,
        z: p.z,
        vx: random(-0.3, 0.3),
        vy: random(1.1, 1.8),
        life: random(0.8, 1.3),
        size0: 0.09,
        size1: 0.03,
        shape: 1,
      }),
    ],
  ],
  frost: [
    [
      26,
      (p) => ({
        kind: "snow",
        x: p.x,
        y: p.y,
        z: p.z,
        vx: random(-0.22, 0.22),
        vy: random(-0.4, 0.05),
        vz: random(-0.15, 0.15),
        life: random(0.9, 1.5),
        size0: random(0.13, 0.2),
        size1: 0.04,
        shape: 1,
      }),
    ],
    [
      7,
      (p) => ({
        kind: "mist",
        x: p.x,
        y: p.y,
        z: p.z,
        vx: random(-0.1, 0.1),
        vy: random(-0.3, -0.1),
        life: random(1.2, 1.8),
        size0: 0.3,
        size1: 0.7,
      }),
    ],
  ],
  storms: [
    [
      34,
      (p) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = random(1.2, 3);
        return {
          kind: "spark",
          x: p.x,
          y: p.y,
          z: p.z,
          vx: Math.cos(angle) * speed,
          vy: random(0.5, 2.5),
          vz: Math.sin(angle) * speed,
          life: random(0.12, 0.3),
          size0: 0.11,
          size1: 0.03,
          shape: 1,
        };
      },
    ],
  ],
  refine1: [],
  refine2: [
    [
      3,
      (p) => ({
        kind: "glint",
        x: p.x,
        y: p.y,
        z: p.z,
        life: random(0.25, 0.4),
        size0: 0.16,
        size1: 0.04,
        shape: 1,
      }),
    ],
  ],
  refine3: [
    [
      9,
      (p) => ({
        kind: "gilded",
        x: p.x + random(-0.1, 0.1),
        y: p.y,
        z: p.z,
        vx: random(-0.05, 0.05),
        vy: random(0.3, 0.6),
        life: random(1, 1.6),
        size0: random(0.14, 0.2),
        size1: 0.03,
      }),
    ],
    [
      4,
      (p) => ({
        kind: "glint",
        x: p.x,
        y: p.y,
        z: p.z,
        life: random(0.25, 0.4),
        size0: 0.18,
        size1: 0.04,
        shape: 1,
      }),
    ],
  ],
  radiance: [
    [
      14,
      (p) => ({
        kind: "holy",
        x: p.x + random(-0.08, 0.08),
        y: p.y,
        z: p.z,
        vx: random(-0.05, 0.05),
        vy: random(0.35, 0.75),
        life: random(1, 1.7),
        size0: random(0.16, 0.24),
        size1: 0.04,
      }),
    ],
    [
      4,
      (p) => ({
        kind: "glint",
        x: p.x,
        y: p.y,
        z: p.z,
        life: random(0.3, 0.45),
        size0: 0.2,
        size1: 0.05,
        shape: 1,
      }),
    ],
  ],
  arcane: [
    [
      30,
      (p) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = random(0.15, 0.45);
        return {
          kind: "mote",
          x: p.x + Math.cos(angle) * radius,
          y: p.y,
          z: p.z + Math.sin(angle) * radius,
          cx: p.x,
          cz: p.z,
          vy: random(0.25, 0.6),
          life: random(0.9, 1.6),
          size0: random(0.1, 0.17),
          size1: 0.02,
          shape: Math.random() < 0.5 ? 1 : 0,
        };
      },
    ],
  ],
};
/* a fire in the world (a fire basket, a camp fire, a forge): small licks of flame over it and embers rising high */
EMITTERS.hearth = [
  [
    12,
    (p) => ({
      kind: "flame",
      x: p.x,
      y: p.y,
      z: p.z,
      vx: random(-0.12, 0.12),
      vy: random(0.8, 1.3),
      vz: random(-0.08, 0.08),
      life: random(0.3, 0.5),
      size0: random(0.14, 0.22),
      size1: 0.03,
    }),
  ],
  [
    6,
    (p) => ({
      kind: "ember",
      x: p.x,
      y: p.y + 0.2,
      z: p.z,
      vx: random(-0.35, 0.35),
      vy: random(1.2, 2.2),
      life: random(1, 1.8),
      size0: 0.08,
      size1: 0.02,
      shape: 1,
    }),
  ],
];
/* skills (skill-effects.js fxBurst, fxStream): healing light, mana, a war cry's fury, the earth of stone spells */
const rising = (
  kind,
  { speed = [0.4, 0.9], life = [0.9, 1.5], size = [0.14, 0.22], star = 0.4 } = {},
) => [
  18,
  (p) => ({
    kind,
    x: p.x,
    y: p.y,
    z: p.z,
    vx: random(-0.08, 0.08),
    vy: random(...speed),
    vz: random(-0.08, 0.08),
    life: random(...life),
    size0: random(...size),
    size1: 0.03,
    shape: Math.random() < star ? 1 : 0,
  }),
];
EMITTERS.heal = [rising("heal"), [4, EMITTERS.radiance[1][1]]];
EMITTERS.mana = [rising("mana")];
/* a snowstorm: flakes that whirl round the storm's middle as they fall, and some that only fall */
EMITTERS.flurry = [
  [
    30,
    (p) => ({
      kind: "flurry",
      x: p.x,
      y: p.y,
      z: p.z,
      vy: random(-1.1, -0.5),
      life: random(1, 1.8),
      size0: random(0.12, 0.2),
      size1: 0.05,
      shape: Math.random() < 0.5 ? 1 : 0,
    }),
  ],
  EMITTERS.frost[1],
];
EMITTERS.rage = [rising("rage", { speed: [0.6, 1.4], life: [0.4, 0.8], star: 0.2 })];
EMITTERS.dust = [
  [
    20,
    (p) => ({
      kind: "dust",
      x: p.x,
      y: p.y,
      z: p.z,
      vx: random(-0.5, 0.5),
      vy: random(0.8, 2),
      vz: random(-0.3, 0.3),
      life: random(0.5, 0.9),
      size0: random(0.18, 0.3),
      size1: 0.1,
    }),
  ],
];
/* epic gear glints, legendary gear sheds golden motes, like armour refined to +7 and +10 */
EMITTERS.epic = EMITTERS.refine2;
EMITTERS.legendary = EMITTERS.refine3;

/* sprite → part ("weapon", "shield") → {element, carry (particles owed), arcs: [{a, b, until}], light, seen} */
const auras = new Map();
let frameNumber = 0;

/* the middle of a part's pixels in the frame on show, as a point of the mesh's uv (for the shield's cross) */
function partCenter(sprite, pixels, target) {
  let x = 0;
  let y = 0;
  const count = pixels.length / 2;
  for (let k = 0; k < pixels.length; k += 2) {
    x += pixels[k];
    y += pixels[k + 1];
  }
  const u = (x / count + 0.5) / 64;
  return target.set(sprite.mirrored ? 1 - u : u, 1 - (y / count + 0.5) / 64);
}

function updateAura(sprite, element, dt, time, part = ELEMENTS[element].part) {
  const spec = ELEMENTS[element];
  const isPart = PARTS[part];
  let parts = auras.get(sprite);
  if (!parts) {
    parts = new Map();
    auras.set(sprite, parts);
  }
  let aura = parts.get(part);
  if (!aura) {
    aura = { carry: {}, arcs: [], light: null };
    parts.set(part, aura);
  }
  aura.seen = true;
  if (aura.element !== element) {
    aura.element = element;
    aura.carry = {};
  }
  const partLayers = sprite.layers.filter(isPart);
  const isShown = sprite.group.visible && partLayers.some((layer) => layer.mesh.visible);
  for (const layer of partLayers) {
    const glow =
      layer.mesh.userData.weaponGlow || (layer.mesh.userData.weaponGlow = makeGlow(layer));
    glow.userData.frame = frameNumber;
    const uniforms = glow.material.uniforms;
    if (uniforms.map.value !== layer.texture) {
      uniforms.map.value = layer.texture;
    }
    layer.texture.updateMatrix();
    uniforms.uvTransform.value.copy(layer.texture.matrix);
    uniforms.uStep.value = 1 / 64;
    uniforms.uGlow.value.set(spec.glow);
    uniforms.uCore.value.set(spec.core);
    uniforms.uKind.value = spec.kind;
    uniforms.uTime.value = time;
    /* breathing a little, so it lives even when the hero stands still */
    uniforms.uStrength.value = spec.strength * (0.88 + 0.12 * Math.sin(time * 2.4));
    /* the cross of light only on the face of the shield we see, not on the half behind the body */
    const pixels =
      spec.kind === 4 && !layer.source.userData.isBack && weaponPixels(layer.source, sprite);
    uniforms.uCross.value = pixels && pixels.length ? 1 : 0;
    if (uniforms.uCross.value) {
      partCenter(sprite, pixels, uniforms.uCenter.value);
    }
    glow.geometry = layer.mesh.geometry;
  }
  aura.light = isShown && spec.light ? aura.light || { y: 1, radius: 2.6, strength: 0.5 } : null;
  if (!isShown) {
    return;
  }
  /* the front half (drawn after the body) first */
  const sources = partLayers
    .filter((layer) => layer.mesh.visible)
    .map((layer) => ({
      pixels: weaponPixels(layer.source, sprite),
      lift: layer.source.userData.isBack ? -0.08 : 0.35,
    }))
    .filter((source) => source.pixels.length)
    .sort((a, b) => b.lift - a.lift);
  if (!sources.length) {
    return;
  }
  /* the light it casts, on the hero, flickering by element */
  if (aura.light) {
    aura.light.x = sprite.group.position.x;
    aura.light.z = sprite.group.position.z;
    aura.light.color = spec.light;
    aura.light.strength = lightStrength(element, time);
  }
  for (const [index, [rate, make]] of EMITTERS[element].entries()) {
    aura.carry[index] = (aura.carry[index] || 0) + rate * dt;
    while (aura.carry[index] >= 1) {
      aura.carry[index] -= 1;
      emit(make(weaponPoint(sprite, sources, pointA)));
    }
  }
  if (element === "storms") {
    /* a bolt or two along the weapon, each living a few hundredths of a second before it jumps elsewhere */
    aura.arcs = aura.arcs.filter((arc) => arc.until > time);
    while (aura.arcs.length < 2 && Math.random() < 0.6) {
      const a = weaponPoint(sprite, sources, new THREE.Vector3());
      const b = weaponPoint(sprite, sources, new THREE.Vector3());
      if (a.distanceTo(b) > 0.35) {
        aura.arcs.push({ a, b, until: time + random(0.05, 0.12) });
      } else {
        break;
      }
    }
    /* redrawn every frame between the same two points: the jag changes, the bolt stays put */
    for (const arc of aura.arcs) {
      drawArc(arc.a, arc.b);
    }
  }
}

/* how strongly an enchantment's light falls round the hero now: storms stutter, flames flicker, the rest breathe */
function lightStrength(element, time) {
  switch (element) {
    case "storms":
      return 0.35 + 0.35 * Math.random();
    case "flame":
      return 0.48 + 0.08 * Math.sin(time * 13) + 0.05 * Math.sin(time * 7.7);
    case "radiance":
    case "refine3":
    case "legendary":
      return 0.5 + 0.08 * Math.sin(time * 1.7);
    default:
      return 0.45;
  }
}

/* glows on layers no aura lit this frame (an enchantment gone, gear changed) go out */
function removeStaleGlows(sprite) {
  for (const layer of sprite.layers) {
    const glow = layer.mesh.userData.weaponGlow;
    if (glow && glow.userData.frame !== frameNumber) {
      removeGlow(layer);
    }
  }
}

/**
 * Per frame, after the sprites have been updated: `holders` lists every enchanted weapon and shield to show, as
 * {sprite, element, part} (element: an ENCHANTMENTS key or a refineGlow tier, or null for none; part: for a
 * refine tier, the slot of the gear that shines); a hero with several is in it several times.
 */
export function updateWeaponFx(dt, holders) {
  if (!cloud) {
    initCloud();
    initArcs();
  }
  const time = performance.now() / 1000;
  camera.getWorldDirection(towardsCamera).negate();
  arcs.used = 0;
  frameNumber++;
  for (const parts of auras.values()) {
    for (const aura of parts.values()) {
      aura.seen = false;
    }
  }
  for (const { sprite, element, part } of holders) {
    if (sprite && ELEMENTS[element]) {
      updateAura(sprite, element, dt, time, part);
    }
  }
  for (const [sprite, parts] of auras) {
    for (const [part, aura] of parts) {
      if (!aura.seen) {
        parts.delete(part);
      }
    }
    removeStaleGlows(sprite);
    if (!parts.size) {
      auras.delete(sprite);
    }
  }
  emitFromPlaces(dt);
  finishArcs();
  updateCloud(dt);
}

/* ---------------------------------------------------------------- places that glow too ---------------------- */

/* Fixed places in the world that give off an enchantment's particles without a sprite: fire baskets, camp fires and
   forges (flames and embers), altars and the heartstone (arcane motes). Only those near the camera do. */
const places = [];
const PLACE_RANGE = 26;
const placePoint = new THREE.Vector3();

/**
 * Lets a place give off an element's particles (an EMITTERS key), every frame while the camera is near it:
 * {element, x, y, z, spread, rate, active}; each particle comes from a random point within `spread` of (x, y, z),
 * `rate` times as many as from a weapon, and only while `active()` (when given) is true.
 */
export function addFxPlace(place) {
  places.push({ ...place, carry: null });
}

/**
 * A stream of an element's particles for a while, from a point or from something that moves (`follow`: anything with
 * x and z, the place's y and spread round it): for a spell's aura or the trail of a bolt. Ends after `seconds`.
 */
export function fxStream(
  element,
  { x = 0, y = 1, z = 0, follow = null, spread = 0.3, rate = 1, seconds = 1 },
) {
  places.push({
    element,
    x,
    y,
    z,
    follow,
    spread,
    rate,
    until: performance.now() / 1000 + seconds,
    carry: null,
  });
}

/**
 * A burst of `count` of an element's particles at once from (x, y, z), flung outwards at `speed` (units per
 * second) on top of their own motion: the impact of a spell.
 */
export function fxBurst(element, x, y, z, { count = 24, spread = 0.2, speed = 1.5 } = {}) {
  if (!cloud) {
    initCloud();
    initArcs();
  }
  const emitters = EMITTERS[element] || [];
  const total = emitters.reduce((sum, [rate]) => sum + rate, 0);
  if (!total) {
    return;
  }
  for (let k = 0; k < count; k++) {
    let pick = Math.random() * total;
    const [, make] = emitters.find(([rate]) => (pick -= rate) <= 0) || emitters[0];
    const angle = Math.random() * Math.PI * 2;
    const out = speed * random(0.4, 1);
    placePoint.set(
      x + Math.cos(angle) * spread * Math.random(),
      y + random(-spread, spread) * 0.5,
      z + Math.sin(angle) * spread * Math.random(),
    );
    const particle = make(placePoint);
    particle.vx = (particle.vx || 0) + Math.cos(angle) * out;
    particle.vz = (particle.vz || 0) + Math.sin(angle) * out;
    particle.vy = (particle.vy || 0) + random(0, out * 0.6);
    if (particle.kind === "mote") {
      /* motes circle where they started */
      particle.cx = particle.x;
      particle.cz = particle.z;
    }
    emit(particle);
  }
}

/* short flashes of light at night: {x, z, y, radius, color, strength, until, seconds} */
const flashes = [];

/** A flash of light at (x, z) that lights the night for `seconds`, fading out. */
export function flashLight(x, z, color, { radius = 5, strength = 1, seconds = 0.5, y = 1 } = {}) {
  const until = performance.now() / 1000 + seconds;
  flashes.push({ x, z, y, radius, color, strength, peak: strength, until, seconds });
}

function emitFromPlaces(dt) {
  const { x: cx, z: cz } = cameraState.target;
  const time = performance.now() / 1000;
  for (let k = places.length - 1; k >= 0; k--) {
    const place = places[k];
    if (place.until && time > place.until) {
      places.splice(k, 1);
      continue;
    }
    if (place.follow) {
      place.x = place.follow.x;
      place.z = place.follow.z;
    }
  }
  for (const place of places) {
    if (Math.abs(place.x - cx) > PLACE_RANGE || Math.abs(place.z - cz) > PLACE_RANGE) {
      continue;
    }
    if (place.active && !place.active()) {
      continue;
    }
    const emitters = EMITTERS[place.element] || [];
    if (!place.carry) {
      place.carry = emitters.map(() => 0);
    }
    emitters.forEach(([rate, make], k) => {
      place.carry[k] = Math.min(4, place.carry[k] + rate * (place.rate || 1) * dt);
      while (place.carry[k] >= 1) {
        place.carry[k] -= 1;
        const spread = place.spread || 0;
        placePoint.set(
          place.x + random(-spread, spread),
          place.y + random(-spread, spread) * 0.4,
          place.z + random(-spread, spread),
        );
        const particle = make(placePoint);
        if (particle.kind === "flurry") {
          /* a snowstorm's flakes whirl round its middle */
          particle.cx = place.x;
          particle.cz = place.z;
        }
        emit(particle);
      }
    });
  }
}

/** The light the enchanted weapons and shields cast (for daylight.js: a glow round the hero at night and
    underground). */
export const weaponLights = () => {
  const time = performance.now() / 1000;
  for (let k = flashes.length - 1; k >= 0; k--) {
    const flash = flashes[k];
    if (time > flash.until) {
      flashes.splice(k, 1);
    } else {
      flash.strength = flash.peak * ((flash.until - time) / flash.seconds);
    }
  }
  return [...auras.values()]
    .flatMap((parts) => [...parts.values()].map((aura) => aura.light))
    .filter(Boolean)
    .concat(flashes);
};

/**
 * The moment of a refine, on the hero who did it: on success a sweep of light runs down them from head to feet
 * and a ring of glints rises at their feet; on failure the runes crack into grey shards that fall away.
 */
export function refineFlash(sprite, isSuccess) {
  if (!cloud) {
    initCloud();
    initArcs();
  }
  camera.getWorldDirection(towardsCamera).negate();
  const { x, z } = sprite.group.position;
  const top = sprite.height * 1.05;
  /* in front of the hero, so the body does not hide it */
  const fx = x + towardsCamera.x * 0.4;
  const fz = z + towardsCamera.z * 0.4;
  if (isSuccess) {
    for (let k = 0; k < 46; k++) {
      const speed = random(2.4, 3);
      emit({
        kind: "sweep",
        x: fx + random(-0.5, 0.5),
        y: top + random(0, 0.15),
        z: fz,
        vy: -speed,
        life: top / speed,
        size0: random(0.16, 0.26),
        size1: 0.06,
      });
    }
    for (let k = 0; k < 24; k++) {
      const angle = (k / 24) * Math.PI * 2;
      emit({
        kind: "glint",
        x: x + Math.cos(angle) * 0.75,
        y: 0.1,
        z: z + Math.sin(angle) * 0.75,
        vy: random(0.6, 1.1),
        life: random(0.5, 0.8),
        size0: 0.2,
        size1: 0.05,
        shape: 1,
      });
    }
    return;
  }
  for (let k = 0; k < 36; k++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(0.8, 2);
    emit({
      kind: "shard",
      x: fx,
      y: sprite.height * 0.55,
      z: fz,
      vx: Math.cos(angle) * speed,
      vy: random(0.5, 2.2),
      vz: Math.sin(angle) * speed * 0.4,
      life: random(0.6, 1),
      size0: random(0.14, 0.22),
      size1: 0.05,
      shape: Math.random() < 0.5 ? 1 : 0,
    });
  }
}
