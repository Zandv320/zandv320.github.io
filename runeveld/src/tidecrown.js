/* Eldoria – Tidecrown as the players see it (the rules are in rules/tidecrown.js): a ring of salt-worn grass on a
   beach of sand, the Crownmere in the old crater in its middle, sunk below the land, grey-green and moving; the
   crown of dark rock teeth round the lake; the causeway out to the seal's islet with its altar and four tide
   stones; on the south coast the landing with its pier, the Gull's Promise alongside when a hero has brought her
   here, and a small camp above the beach. Pines and wind-bent trees, the wreck of a ship on the west beach, and
   bones round the lake.
   Here too the tide seal's ritual ('The tide seal', rules/quests.js goal 'ritual'): the stones wake, and Maelis
   comes over the water for the seal's heart. Only the hero at the altar sees him. */
import * as THREE from "three";
import { addToCell } from "./culling.js";
import * as builders from "./builders.js";
import {
  TIDECROWN,
  TIDECROWN_REACH,
  tidecrownCoast,
  CROWNMERE,
  LAKE_Y,
  SEAL_ISLET,
  CAUSEWAY,
  TIDE_SEAL,
  CROWN_TEETH,
  TIDE_PIER,
  TIDE_BERTH,
  TIDE_CAMP,
  TIDE_PATH,
  tidePathDistance,
  KEEPERS_HALL,
  WEST_RUIN,
} from "./rules/tidecrown.js";
import { QUESTS } from "./rules/quests.js";
import { HULL } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { SEA_VERTEX, SEA_FRAGMENT } from "./saltmere.js";
import { addSurf } from "./sea.js";
import { waterfall, foamPool, rock, pondLife, addCascade } from "./water-features.js";
import { addFxPlace } from "./weapon-fx.js";
import { maelisFigure } from "./maelis.js";
import {
  addShadowCatcher,
  applyGroundFilter,
  scene,
  camera,
  cameraState,
  shakeCamera,
} from "./world.js";
import { clickables, player, game, playEffect } from "./game-state.js";
import { loadTexture, IS_PHONE } from "./sprites.js";
import { groundRing } from "./skill-effects.js";
import { burst } from "./particles.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const TIDE_COLOR = 0x7fe0d4;
const MAELIS_COLOR = 0xb49cff;
/* how far a hero reaches to lay a hand on the altar */
const USE_DISTANCE = 2.8;

/* the lights of the island at night: the seal's glow (its strength rises when the stones wake) */
export const tidecrownLights = [];
const sealLight = {
  x: TIDE_SEAL[0],
  z: TIDE_SEAL[1],
  y: 1.2,
  radius: 6,
  color: [127, 224, 212],
  strength: 0.35,
};
tidecrownLights.push(sealLight);

const state = {
  lake: null,
  gull: null,
  seal: null /* {mesh, runes: [{x, z, face}]} */,
  isWaking: false,
  scene: null /* Maelis' visit: {figure, time, step} */,
};

/** Builds Tidecrown (world.js calls this with its build context). */
export function buildTidecrown({ prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(4242);
  pending.push(
    loadTexture("sprites/ground.png", { raw: true }).then((grass) => prepareGround(grass.image)),
  );
  const materials = {
    stone: builders.material("stone", 2, 2, 0.6),
    edge: new THREE.LineBasicMaterial({ color: 0x0c0f2a }),
  };
  buildCoast();
  buildLake(random, materials, obstacles);
  buildCrown(random, materials, obstacles);
  buildIslet(obstacles);
  buildRuins({ place, random });
  buildLanding({ prop, place, pending, obstacles });
  buildBeach({ random, materials, obstacles });
  buildScenery({ prop, place, pending, random, obstacles });
}

/* ---------- the ground: grass worn by salt, sand with shells along the coast, shingle round the lake, a path of
   trodden earth; painted pixel by pixel in the game's own sixteen to a unit ---------- */

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function pixelsOf(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return { data: ctx.getImageData(0, 0, image.width, image.height).data, width: image.width };
}

/* sixteen pixels a unit, like every other ground; a cell of four pixels decides what lies there */
const PX = 16;
const CELL = 4;
const CHUNK = 48;
const CHUNK_PIXELS = CHUNK * PX;
const CELLS = CHUNK_PIXELS / CELL;
const CELL_UNITS = CELL / PX;
/* painted chunk by chunk while a hero is this near, a few rows a frame */
const PAINT_REACH = 200;
const PAINT_BUDGET = IS_PHONE ? 4 : 7;
const URGENT_BUDGET = IS_PHONE ? 20 : 30;

/* the colours of what is not grass: sand (dry, light, wet), shingle, earth */
const SAND = [
  [218, 198, 148],
  [204, 182, 130],
  [230, 214, 170],
];
const SHINGLE = [
  [146, 150, 150],
  [112, 118, 124],
  [168, 160, 142],
  [92, 98, 106],
];
const EARTH = [
  [140, 108, 72],
  [118, 90, 60],
  [166, 134, 94],
  [98, 74, 50],
];

let painter = null;

/* the island's outline (its coast plus `grow`) with the lake cut out, as a flat shape (y towards -z once laid) */
function islandShape(grow, lakeGrow) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 180; k++) {
    const angle = (k / 180) * Math.PI * 2;
    const r = tidecrownCoast(angle) + grow;
    const point = [Math.sin(angle) * r, -Math.cos(angle) * r];
    if (k === 0) {
      shape.moveTo(...point);
    } else {
      shape.lineTo(...point);
    }
  }
  const lake = new THREE.Path();
  lake.absarc(
    CROWNMERE.x - TIDECROWN.x,
    -(CROWNMERE.z - TIDECROWN.z),
    CROWNMERE.radius + lakeGrow,
    0,
    Math.PI * 2,
    true,
  );
  shape.holes.push(lake);
  return shape;
}

function prepareGround(grassImage) {
  const grass = pixelsOf(grassImage);
  const x0 = TIDECROWN.x - TIDECROWN_REACH;
  const z0 = TIDECROWN.z - TIDECROWN_REACH;
  const count = Math.ceil((TIDECROWN_REACH * 2) / CHUNK);
  const chunks = [];
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      chunks.push({ x0: x0 + i * CHUNK, z0: z0 + j * CHUNK });
    }
  }
  painter = { grass, chunks, job: null };
  const size = TIDECROWN_REACH * 2;
  addShadowCatcher(size, size, TIDECROWN.x, 0.029, TIDECROWN.z);
  /* under the chunks a plain floor in the island's shape, so an unpainted chunk is no hole */
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(islandShape(0, 0), 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(110 / 255, 140 / 255, 96 / 255, THREE.SRGBColorSpace),
    }),
  );
  floor.position.set(TIDECROWN.x, 0.001, TIDECROWN.z);
  scene.add(floor);
}

/* what lies at (x, z): null for water, else {kind, ...} */
function groundAt(x, z) {
  const dx = x - TIDECROWN.x;
  const dz = z - TIDECROWN.z;
  const inland = tidecrownCoast(Math.atan2(dx, dz)) - Math.hypot(dx, dz);
  if (inland < 0) {
    return null;
  }
  const fromLake = Math.hypot(x - CROWNMERE.x, z - CROWNMERE.z) - CROWNMERE.radius;
  if (fromLake < 0) {
    return null;
  }
  const wobble = noise(x * 0.25, z * 0.25);
  if (inland < 3.5 + wobble * 3) {
    return {
      kind: "sand",
      wet: inland < 1.1 + wobble * 0.7,
      wrack: inland > 1.4 + wobble * 0.7 && inland < 2 + wobble * 0.8,
    };
  }
  if (fromLake < 1.4 + wobble * 1.4) {
    return { kind: "shingle" };
  }
  /* near the path every pixel looks for itself, so its edges run ragged instead of in steps */
  const nearPath = tidePathDistance(x, z) < 1.8;
  /* the grass: darker and wetter inside the crown, grey-green with salt near the beach, in patches */
  const patch = noise(x * 0.07, z * 0.07);
  const crown = Math.max(0, 1 - fromLake / 8);
  const salt = Math.max(0, 1 - (inland - 4) / 8);
  const r = 0.86 + patch * 0.12 - crown * 0.14 - salt * 0.06;
  const g = 0.94 + patch * 0.06 - crown * 0.08;
  const b = 0.86 + patch * 0.08 - crown * 0.02 + salt * 0.06;
  return {
    kind: "grass",
    tile: hash(Math.floor(x / 2), Math.floor(z / 2)) < 0.14 ? 2 : 0,
    r,
    g,
    b,
    nearPath,
  };
}

const pick = (colors, value) =>
  colors[Math.min(colors.length - 1, Math.floor(value * colors.length))];

/* the colour of one pixel of the ground: [r, g, b] */
function pixelColor(ground, gx, gy) {
  const wx = gx / PX;
  const wz = gy / PX;
  const speck = hash(gx * 0.37, gy * 0.71);
  switch (ground.kind) {
    case "sand": {
      /* smooth patches of lighter and darker sand, and a grain */
      const shade = noise(wx * 0.35, wz * 0.35) * 0.7 + speck * 0.3;
      const [a, b] = shade < 0.5 ? [SAND[1], SAND[0]] : [SAND[0], SAND[2]];
      const t = shade < 0.5 ? shade * 2 : shade * 2 - 1;
      let color = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      if (speck < 0.004) {
        color = [244, 236, 222];
      } else if (speck < 0.008) {
        color = [236, 170, 162];
      } else if (speck < 0.03) {
        color = [186, 164, 118];
      }
      if (ground.wrack && noise(wx * 2.2, wz * 2.2) > 0.55) {
        /* a line of dried seaweed where the high tide leaves it */
        color = speck < 0.5 ? [58, 84, 56] : [44, 62, 44];
      }
      return ground.wet ? [color[0] * 0.8, color[1] * 0.84, color[2] * 0.9] : color;
    }
    case "shingle": {
      /* pebbles three pixels across, each its own colour, darker at their edges */
      const pebble = hash(Math.floor(gx / 3) * 1.3, Math.floor(gy / 3) * 0.7);
      const color = pick(SHINGLE, pebble * 0.999);
      const isEdge = gx % 3 === 0 || gy % 3 === 0;
      return isEdge ? [color[0] * 0.78, color[1] * 0.78, color[2] * 0.8] : color;
    }
    case "earth": {
      if (speck < 0.05) {
        return EARTH[2];
      }
      if (speck < 0.1) {
        return EARTH[3];
      }
      return noise(wx * 1.4, wz * 1.4) > 0.5 ? EARTH[0] : EARTH[1];
    }
    default: {
      const { grass } = painter;
      const k = ((gy & 31) * grass.width + ground.tile * 32 + (gx & 31)) * 4;
      if (ground.nearPath) {
        const trodden = tidePathDistance(wx, wz);
        if (trodden < 0.7 + noise(wx * 1.1, wz * 1.1) * 0.45) {
          return pixelColor({ kind: "earth" }, gx, gy);
        }
        /* worn grass along its sides */
        if (trodden < 1.2 && noise(wx * 3, wz * 3) > 0.55) {
          return EARTH[1];
        }
      }
      return [grass.data[k] * ground.r, grass.data[k + 1] * ground.g, grass.data[k + 2] * ground.b];
    }
  }
}

function paintGround() {
  if (!painter) {
    return;
  }
  if (Math.hypot(player.x - TIDECROWN.x, player.z - TIDECROWN.z) > PAINT_REACH + TIDECROWN_REACH) {
    return;
  }
  const started = performance.now();
  const underfoot = painter.chunks.some(
    (chunk) =>
      !chunk.isPainted &&
      player.x >= chunk.x0 - 8 &&
      player.x < chunk.x0 + CHUNK + 8 &&
      player.z >= chunk.z0 - 8 &&
      player.z < chunk.z0 + CHUNK + 8,
  );
  const budget = underfoot ? URGENT_BUDGET : PAINT_BUDGET;
  while (performance.now() - started < budget) {
    if (!painter.job) {
      const chunk = painter.chunks
        .filter((candidate) => !candidate.isPainted)
        .sort(
          (a, b) =>
            Math.hypot(a.x0 - player.x, a.z0 - player.z) -
            Math.hypot(b.x0 - player.x, b.z0 - player.z),
        )[0];
      if (!chunk) {
        return;
      }
      painter.job = {
        chunk,
        pixels: new Uint8ClampedArray(CHUNK_PIXELS * CHUNK_PIXELS * 4),
        row: 0,
      };
    }
    const job = painter.job;
    paintRow(job, job.row);
    job.row++;
    if (job.row >= CELLS) {
      finishChunk(job);
      painter.job = null;
    }
  }
}

function paintRow({ chunk, pixels }, j) {
  const originX = Math.round(chunk.x0 * PX);
  const originY = Math.round(chunk.z0 * PX);
  for (let i = 0; i < CELLS; i++) {
    const ground = groundAt(chunk.x0 + (i + 0.5) * CELL_UNITS, chunk.z0 + (j + 0.5) * CELL_UNITS);
    if (!ground) {
      continue;
    }
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const lx = i * CELL + px;
        const ly = j * CELL + py;
        const [r, g, b] = pixelColor(ground, originX + lx, originY + ly);
        const k = (ly * CHUNK_PIXELS + lx) * 4;
        pixels[k] = r;
        pixels[k + 1] = g;
        pixels[k + 2] = b;
        pixels[k + 3] = 255;
      }
    }
  }
}

function finishChunk({ chunk, pixels }) {
  chunk.isPainted = true;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CHUNK_PIXELS;
  canvas.getContext("2d").putImageData(new ImageData(pixels, CHUNK_PIXELS, CHUNK_PIXELS), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  applyGroundFilter(texture);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK, CHUNK).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 }),
  );
  mesh.position.set(chunk.x0 + CHUNK / 2, 0.002, chunk.z0 + CHUNK / 2);
  scene.add(mesh);
  /* a chunk of ground stands still: into its cell (culling.js) */
  addToCell(mesh);
}

/* ---------- the coast: the land's sandy flank down into the sea, and the surf ---------- */

function buildCoast() {
  /* a slab in the island's shape under the ground, its rounded edge showing only where the land meets the sea;
     the lake's hole is wider, so the slab never reaches over the crater's wall */
  const depth = 1.6;
  const bevel = 0.8;
  const geometry = new THREE.ExtrudeGeometry(islandShape(0.3, 1.2), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel * 0.4,
    bevelSize: bevel,
    bevelSegments: 2,
    /* the lake's hole is an arc: enough segments to stay round */
    curveSegments: 48,
  }).rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: 0xcdb98a, flatShading: true }),
  );
  sand.position.set(TIDECROWN.x, -depth - bevel * 0.4 - 0.02, TIDECROWN.z);
  scene.add(sand);
  addSurf(scene, TIDECROWN.x, TIDECROWN.z, 1.2, 2.6, (angle) => tidecrownCoast(angle));
}

/* ---------- the Crownmere: sunk in the crater, boulders and reeds along its edge, lilies, fish ---------- */

/* the wave of the tide stones, in sixteen pixels */
function waveGlyph() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const rows = [
    "................",
    "................",
    "......oooo......",
    "....ooOOOOoo....",
    "...oOOooooOOo...",
    "..oOo......oOo..",
    "..oO..oooo..Oo..",
    "...o.oOOOOo.o...",
    ".....oOYYOo.....",
    "..o..oOYYOo..o..",
    ".oOo..oOOo..oOo.",
    ".oOOo..oo..oOOo.",
    "..oOOooooooOOo..",
    "...ooOOOOOOoo...",
    ".....oooooo.....",
    "................",
  ];
  const colors = { o: "#2a7f86", O: "#4fc8d0", Y: "#d8fff8" };
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (colors[cell]) {
        ctx.fillStyle = colors[cell];
        ctx.fillRect(x, y, 1, 1);
      }
    }),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* how shallow the lake is everywhere (for the sea's own shader): light along its shores, the islet and the
   causeway, dark in the deep between */
function lakeShallows() {
  const size = 48;
  const step = (CROWNMERE.radius * 2) / size;
  const data = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = CROWNMERE.x - CROWNMERE.radius + (i + 0.5) * step;
      const z = CROWNMERE.z - CROWNMERE.radius + (j + 0.5) * step;
      const shore = CROWNMERE.radius - Math.hypot(x - CROWNMERE.x, z - CROWNMERE.z);
      const islet = Math.hypot(x - SEAL_ISLET.x, z - SEAL_ISLET.z) - SEAL_ISLET.radius;
      const causeway =
        z > CAUSEWAY.north && z < CAUSEWAY.south
          ? Math.abs(x - CAUSEWAY.x) - CAUSEWAY.halfWidth
          : Infinity;
      const d = Math.max(0, Math.min(shore, islet, causeway));
      data[j * size + i] = Math.round(Math.exp(-d / 2.6) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/* the grey-green water of the Leviathan's lake (and of the rock pools on the beach): the sea's own shader */
function lakeMaterial() {
  const { x, z, radius } = CROWNMERE;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShore: { value: z + 110 },
      uShallowMap: { value: lakeShallows() },
      uShallowBounds: { value: new THREE.Vector4(x - radius, z - radius, radius * 2, radius * 2) },
      uShallow: { value: new THREE.Color(0x3f9a90) },
      uMiddle: { value: new THREE.Color(0x24646a) },
      uDeep: { value: new THREE.Color(0x184652) },
      uShadow: { value: new THREE.Color(0x0e2a36) },
      uLight: { value: new THREE.Color(0x9fe8dc) },
      uGlint: { value: new THREE.Color(0xf0fffb) },
    },
    vertexShader: SEA_VERTEX,
    fragmentShader: SEA_FRAGMENT,
  });
}

function buildLake(random, materials, obstacles) {
  const { x, z, radius } = CROWNMERE;
  /* the crater's wall from the land down into the water, seen from the inside */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius - 0.5, 2.2, 72, 1, true),
    builders.material("stone", radius * 2 * Math.PI, 2.2, 0.62),
  );
  wall.material.side = THREE.BackSide;
  wall.position.set(x, -1.1, z);
  scene.add(wall);
  state.lake = lakeMaterial();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius - 0.2, 72).rotateX(-Math.PI / 2),
    state.lake,
  );
  water.position.set(x, LAKE_Y, z);
  scene.add(water);
  /* boulders half in the water all round its edge, but where the causeway runs out */
  for (let k = 0; k < 34; k++) {
    const angle = (k / 34) * Math.PI * 2 + (random() - 0.5) * 0.12;
    if (Math.abs(Math.sin(angle) * radius) < 3 && Math.cos(angle) > 0) {
      continue;
    }
    const distance = radius - 0.3 - random() * 0.6;
    rock(
      scene,
      x + Math.sin(angle) * distance,
      LAKE_Y + 0.15,
      z + Math.cos(angle) * distance,
      0.45 + random() * 0.55,
      random,
      materials,
    );
  }
  /* reeds in clumps all round, lilies near the shore, and fish */
  pondLife(scene, x, z, radius, random, {
    y: LAKE_Y,
    lilyCount: 34,
    lilyReach: [0.62, 0.9],
    reedCount: 40,
    reedArc: Math.PI * 2,
    fishCount: 3,
    fishReach: [0.4, 0.85],
  });
  /* the causeway: a dyke of old stone, broken columns along its edges */
  const length = CAUSEWAY.south - CAUSEWAY.north;
  const dyke = new THREE.Mesh(
    new THREE.BoxGeometry(CAUSEWAY.halfWidth * 2, 2.2, length),
    builders.material("stone", CAUSEWAY.halfWidth * 2, 2.2, 0.66),
  );
  dyke.position.set(CAUSEWAY.x, -1.08, (CAUSEWAY.north + CAUSEWAY.south) / 2);
  scene.add(dyke);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(CAUSEWAY.halfWidth * 2, length).rotateX(-Math.PI / 2),
    builders.material("stone", CAUSEWAY.halfWidth * 2, length, 0.92),
  );
  top.position.set(CAUSEWAY.x, 0.025, (CAUSEWAY.north + CAUSEWAY.south) / 2);
  scene.add(top);
  for (let pz = CAUSEWAY.north + 2.5, k = 0; pz < CAUSEWAY.south - 3; pz += 3.4, k++) {
    const side = k % 2 ? 1 : -1;
    const height = 0.6 + hash(pz, side) * 1.6;
    const column = builders.outline(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, height, 8),
        builders.material("stone", 1.8, height, 0.8),
      ),
      40,
    );
    column.position.set(CAUSEWAY.x + side * (CAUSEWAY.halfWidth - 0.15), height / 2, pz);
    scene.add(column);
  }
}

/* ---------- the crown: clusters of basalt columns round the lake, moss on their tops; on the north side the
   tallest of them, with a fall of water down into the lake ---------- */

const BASALT = new THREE.MeshLambertMaterial({ color: 0x59606e, flatShading: true });
const BASALT_LIGHT = new THREE.MeshLambertMaterial({ color: 0x737a88, flatShading: true });
const MOSS = new THREE.MeshLambertMaterial({ color: 0x55804a, flatShading: true });

/* a cluster of six-sided columns round (0, 0), `radius` wide, the tallest `height` */
function basaltCluster(radius, height, random) {
  const group = new THREE.Group();
  const count = 4 + Math.floor(random() * 3);
  for (let k = 0; k < count; k++) {
    const isMiddle = k === 0;
    const angle = (k / count) * Math.PI * 2 + random();
    const distance = isMiddle ? 0 : radius * (0.45 + random() * 0.3);
    const r = radius * (isMiddle ? 0.42 : 0.26 + random() * 0.12);
    const h = height * (isMiddle ? 1 : 0.35 + random() * 0.5);
    const column = builders.outline(
      new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.08, h, 6),
        k % 3 === 1 ? BASALT_LIGHT : BASALT,
      ),
      30,
    );
    column.position.set(Math.sin(angle) * distance, h / 2, Math.cos(angle) * distance);
    column.rotation.y = random() * Math.PI;
    group.add(column);
    /* moss on the lower tops */
    if (h < height * 0.8 || random() < 0.4) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r, 0.12, 6), MOSS);
      cap.position.set(column.position.x, h + 0.04, column.position.z);
      cap.rotation.y = column.rotation.y;
      group.add(cap);
    }
  }
  return group;
}

function buildCrown(random, materials, obstacles) {
  for (const tooth of CROWN_TEETH) {
    const isFalls = tooth.z < CROWNMERE.z && Math.abs(tooth.x - CROWNMERE.x) < 0.01;
    const cluster = basaltCluster(
      tooth.radius * (isFalls ? 2.2 : 1.5),
      isFalls ? 7.5 : tooth.height,
      random,
    );
    cluster.position.set(tooth.x, 0, tooth.z);
    cluster.userData.mapKind = "rock";
    scene.add(cluster);
    obstacles.push({ x: tooth.x, z: tooth.z, r: tooth.radius * (isFalls ? 1.6 : 1.1) });
    if (isFalls) {
      /* the falls: from a notch high in the columns down to the lake, a pool of foam where they land */
      const lipZ = tooth.z + tooth.radius * 1.2;
      const footZ = CROWNMERE.z - CROWNMERE.radius + 1.6;
      waterfall(scene, [tooth.x, 6.4, lipZ], [tooth.x + 0.2, LAKE_Y, footZ], 2.2);
      foamPool(scene, tooth.x + 0.2, LAKE_Y + 0.03, footZ + 0.8, 1.9);
      addFxPlace({
        element: "spray",
        x: tooth.x + 0.2,
        y: LAKE_Y + 0.3,
        z: footZ + 0.6,
        spread: 1,
        rate: 1.2,
      });
      addCascade(tooth.x + 0.2, LAKE_Y + 0.1, footZ + 0.6);
      for (const [dx, dz, size] of [
        [-1.6, 0.6, 0.8],
        [1.7, 0.4, 0.9],
        [-2.2, 1.8, 0.6],
        [2.3, 1.6, 0.7],
      ]) {
        rock(scene, tooth.x + dx, LAKE_Y + 0.2, footZ + dz, size, random, materials);
      }
    }
  }
}

/* ---------- the islet: paved, a low ring of posts, braziers with blue fire, the altar and its four stones ---------- */

/* where the blue fires burn on the islet (lit once the effects are loaded, updateTidecrown) */
const ISLET_FIRES = [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.2, -Math.PI * 0.2].map((angle) => [
  SEAL_ISLET.x + Math.sin(angle) * (SEAL_ISLET.radius - 0.9),
  SEAL_ISLET.z + Math.cos(angle) * (SEAL_ISLET.radius - 0.9),
]);

function buildIslet(obstacles) {
  const islet = new THREE.Mesh(
    new THREE.CylinderGeometry(SEAL_ISLET.radius, SEAL_ISLET.radius + 0.5, 2.2, 32),
    builders.material("stone", SEAL_ISLET.radius * 2 * Math.PI, 2.2, 0.66),
  );
  islet.position.set(SEAL_ISLET.x, -1.08, SEAL_ISLET.z);
  scene.add(islet);
  const paving = builders.plaza(SEAL_ISLET.radius - 0.05, "stone", 0.95);
  paving.position.set(SEAL_ISLET.x, 0.02, SEAL_ISLET.z);
  scene.add(paving);
  /* a ring of low posts round the edge, open to the causeway */
  for (let k = 0; k < 14; k++) {
    const angle = (k / 14) * Math.PI * 2;
    if (Math.cos(angle) > 0.85) {
      continue;
    }
    const height = 0.5 + hash(k, 3) * 0.4;
    const post = builders.block(0.32, height, 0.32, "stone", 0.86);
    post.position.set(
      SEAL_ISLET.x + Math.sin(angle) * (SEAL_ISLET.radius - 0.2),
      height / 2,
      SEAL_ISLET.z + Math.cos(angle) * (SEAL_ISLET.radius - 0.2),
    );
    scene.add(post);
  }
  for (const [fx, fz] of ISLET_FIRES) {
    const brazier = builders.brazier();
    /* its coals burn blue-green, like the seal */
    brazier.traverse((object) => {
      if (object.isMesh && object.material.isMeshBasicMaterial) {
        object.material = object.material.clone();
        object.material.color.set(TIDE_COLOR);
      }
    });
    brazier.position.set(fx, 0.02, fz);
    addFxPlace({ element: "mana", x: fx, y: 1.2, z: fz, spread: 0.2, rate: 0.7 });
    scene.add(brazier);
    obstacles.push({ x: fx, z: fz, r: 0.4 });
    tidecrownLights.push({
      x: fx,
      z: fz,
      y: 1.3,
      radius: 4,
      color: [127, 224, 212],
      strength: 0.8,
    });
  }
  /* the altar of the tide seal, and its four stones on the diagonals */
  const altar = builders.altar();
  altar.position.set(TIDE_SEAL[0], 0.02, TIDE_SEAL[1]);
  scene.add(altar);
  obstacles.push({ x: TIDE_SEAL[0], z: TIDE_SEAL[1], r: 1.4 });
  const glyph = waveGlyph();
  const runes = [];
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const rx = TIDE_SEAL[0] + Math.cos(angle) * 2.6;
    const rz = TIDE_SEAL[1] + Math.sin(angle) * 2.2;
    const stone = builders.runeStone(glyph);
    stone.position.set(rx, 0.02, rz);
    stone.rotation.y = Math.atan2(TIDE_SEAL[0] - rx, TIDE_SEAL[1] - rz) + Math.PI;
    scene.add(stone);
    obstacles.push({ x: rx, z: rz, r: 0.5 });
    stone.userData.glyph.material.color.set(0x6a9a9c);
    runes.push({ x: rx, z: rz, face: stone.userData.glyph });
  }
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.6, 2.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.set(TIDE_SEAL[0], 0.8, TIDE_SEAL[1]);
  scene.add(mesh);
  const object = { kind: "tide_seal", x: TIDE_SEAL[0], z: TIDE_SEAL[1], mesh };
  mesh.userData.tidecrownObject = object;
  state.seal = { mesh, runes, object };
}

/** The clickable meshes of Tidecrown: the tide seal's altar. */
export const tidecrownClickables = () => (state.seal ? [state.seal.mesh] : []);

/* ---------- the ruins of the keepers: the gate where the causeway leaves the shore, their hall, a watch post ---------- */

/* an outlined stone block on the ground, as its own group (so `place` keeps it standing on y = 0) */
function stoneBlock(w, h, d, tint = 0.84) {
  const group = new THREE.Group();
  group.add(builders.block(w, h, d, "stone", tint));
  return group;
}

/* a column: whole, or broken off at `height`; `lying` for one that fell */
function column(height, lying = false) {
  const group = new THREE.Group();
  const shaft = builders.outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.38, height, 8),
      builders.material("stone", 2.2, height, 0.86),
    ),
    40,
  );
  if (lying) {
    shaft.rotation.z = Math.PI / 2;
    shaft.position.y = 0.36;
  } else {
    shaft.position.y = height / 2 + 0.2;
    const base = builders.block(0.95, 0.2, 0.95, "stone", 0.8);
    group.add(base);
  }
  group.add(shaft);
  return group;
}

function buildRuins({ place, random }) {
  /* the gate: two pillars where the causeway meets the shore, the lintel broken, half of it on the ground */
  const gateZ = CROWNMERE.z + CROWNMERE.radius + 4.6;
  for (const side of [-1, 1]) {
    const pillar = stoneBlock(1.1, 4.2, 1.1, 0.8);
    const cap = builders.block(1.45, 0.35, 1.45, "stone", 0.9);
    cap.position.y = 4.2 + 0.17;
    pillar.add(cap);
    place(pillar, CAUSEWAY.x + side * 2.7, gateZ, { radius: 0.8 });
  }
  const lintel = builders.block(3.6, 0.6, 1, "stone", 0.88);
  lintel.position.set(CAUSEWAY.x - 1.5, 4.55 + 0.3, gateZ);
  lintel.rotation.z = -0.06;
  scene.add(lintel);
  const fallen = stoneBlock(3, 0.6, 1, 0.78);
  place(fallen, CAUSEWAY.x + 4.6, gateZ + 2.2, { rotation: 0.5 });

  /* the keepers' hall: a floor of flagstones, walls broken to different heights, two rows of columns (some
     fallen), and at its far end the statue of a keeper */
  const hall = KEEPERS_HALL;
  const floor = builders.squarePlaza(hall.w + 1, hall.d + 1, "crypt_floor");
  floor.position.set(hall.x, 0.015, hall.z);
  scene.add(floor);
  const wall = (x, z, w, d) => {
    const height = 0.6 + random() * 1.8;
    place(stoneBlock(w, height, d, 0.76 + random() * 0.12), hall.x + x, hall.z + z);
  };
  const halfW = hall.w / 2;
  const halfD = hall.d / 2;
  /* the long walls in pieces, the south wall with its doorway */
  for (let k = 0; k < 4; k++) {
    const x = -halfW + 1.25 + k * 2.5;
    if (random() < 0.8) {
      wall(x, -halfD, 2.3, 0.6);
    }
    if (Math.abs(x) > 1.5 && random() < 0.8) {
      wall(x, halfD, 2.3, 0.6);
    }
  }
  for (const side of [-1, 1]) {
    wall(side * halfW, -1.2, 0.6, 2.2);
    if (random() < 0.7) {
      wall(side * halfW, 1.4, 0.6, 2);
    }
  }
  for (const [x, z, height, lying] of [
    [-2.6, -1, 3.2, false],
    [2.6, -1, 2.1, false],
    [-2.6, 1.6, 1.2, false],
    [2.4, 1.8, 3.2, true],
  ]) {
    place(column(height, lying), hall.x + x, hall.z + z, {
      rotation: lying ? 0.4 : 0,
      radius: lying ? 0 : 0.45,
    });
  }
  const keeper = builders.statue();
  place(keeper, hall.x, hall.z - halfD + 1.4, { radius: 1 });

  /* the watch post on the west side: a broken tower's stump and a few stones */
  const post = WEST_RUIN;
  const stump = new THREE.Group();
  const ring = builders.outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 2.6, 12, 1, true),
      builders.material("stone", 14, 2.6, 0.8),
    ),
    40,
  );
  ring.material.side = THREE.DoubleSide;
  ring.position.y = 1.3;
  stump.add(ring);
  place(stump, post.x, post.z, { radius: 2.4 });
  for (const [dx, dz, w, rot] of [
    [3.4, 1.2, 1.2, 0.3],
    [-2.8, 3, 0.9, 1.1],
    [1.5, -3.4, 1, 2],
  ]) {
    place(stoneBlock(w, 0.6, w * 0.7, 0.8), post.x + dx, post.z + dz, { rotation: rot });
  }
}

/* ---------- the landing: pier, the Gull's Promise alongside, and the camp ---------- */

function buildLanding({ prop, place, pending, obstacles }) {
  const { x, halfWidth, north, south } = TIDE_PIER;
  const length = south - north + 1.5;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, 0.3, length),
    new THREE.MeshLambertMaterial({
      map: builders.texture("wood", halfWidth, length / 2),
      color: new THREE.Color(0.7, 0.72, 0.7),
    }),
  );
  deck.position.set(x, -0.13, (north + south) / 2 - 0.75);
  scene.add(deck);
  for (let z = north + 1.5; z <= south; z += 2.5) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 2.4, 6),
        builders.material("wood_dark", 0.4, 2.4),
      );
      post.position.set(x + side * (halfWidth + 0.05), -0.9, z);
      scene.add(post);
    }
  }
  /* the Gull's Promise alongside, when a hero has brought her here (sailing.js shows and hides her) */
  const gull = builders.ship({
    length: HULL.length,
    beam: HULL.beam,
    sail: "cloth_red",
    hullColor: 0x3e4a5a,
  });
  gull.position.set(TIDE_BERTH.x, WATER_Y, TIDE_BERTH.z);
  gull.rotation.y = TIDE_BERTH.heading;
  scene.add(gull);
  const boardHit = new THREE.Mesh(
    new THREE.BoxGeometry(HULL.beam, 4, HULL.length).translate(0, 1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  boardHit.position.set(TIDE_BERTH.x, 0, TIDE_BERTH.z);
  boardHit.rotation.y = TIDE_BERTH.heading;
  boardHit.userData.boardShip = "tidecrown";
  scene.add(boardHit);
  clickables.push(boardHit);
  gull.userData.boardHit = boardHit;
  state.gull = gull;
  /* the camp: a tent, a fire (main.js lights it), what was brought ashore, a line of lanterns up the path */
  const inCamp = (dx, dz) => [TIDE_CAMP.x + dx, TIDE_CAMP.z + dz];
  place(builders.campfire(), ...inCamp(0, 0), { radius: 0.9 });
  place(builders.tent(3, 3.2, "cloth_green"), ...inCamp(-4.6, -2.6), {
    rotation: 0.4,
    radius: 1.7,
  });
  place(builders.writingDesk(), ...inCamp(-2.4, 1.2), { rotation: -0.3, radius: 0.8 });
  pending.push(prop("crypt_crates", ...inCamp(3.6, -3), { radius: 0.7, scale: 0.9 }));
  place(builders.barrel(), ...inCamp(4.4, -1.6), { radius: 0.45 });
  place(builders.barrel(), ...inCamp(4.9, -0.6), { radius: 0.45 });
  place(builders.netRack(2.4), ...inCamp(5.6, 2.6), { rotation: -0.6 });
  place(builders.flag(2.6, "cloth_green"), ...inCamp(1.8, 4.6), { radius: 0.2 });
  pending.push(prop("lantern", x - 1.6, north + 0.5, { radius: 0.25 }));
  for (const [px, pz] of TIDE_PATH.slice(1, -1)) {
    pending.push(prop("lantern", px + 1.6, pz, { radius: 0.25 }));
  }
  const boat = builders.rowingBoat(3.6, 1.5);
  const [boatX, boatZ] = inCamp(7.5, 5.5);
  boat.position.set(boatX, 0.05, boatZ);
  boat.rotation.set(0.05, -0.7, 0.1);
  scene.add(boat);
  obstacles.push({ x: boatX, z: boatZ, r: 1.3 });
}

/** The Gull's Promise at the pier on Tidecrown: shown while she lies there (sailing.js). */
export function setTideGullVisible(isVisible) {
  if (state.gull) {
    state.gull.visible = isVisible;
    state.gull.userData.boardHit.visible = isVisible;
  }
}

/* ---------- the beach: driftwood, rock pools, wrecked boats and the wreck of a ship ---------- */

/* a spot on the beach along this bearing, `inland` units up from the water */
function onBeach(angle, inland) {
  const distance = tidecrownCoast(angle) - inland;
  return [TIDECROWN.x + Math.sin(angle) * distance, TIDECROWN.z + Math.cos(angle) * distance];
}

const DRIFTWOOD = new THREE.MeshLambertMaterial({ color: 0x9a8a74, flatShading: true });

function buildBeach({ random, materials, obstacles }) {
  /* driftwood, bleached grey, lying where the tide left it (not by the landing) */
  for (let k = 0; k < 16; k++) {
    const angle = random() * Math.PI * 2;
    if (Math.abs(angle - Math.PI * 2) < 0.5 || angle < 0.5) {
      continue;
    }
    const [x, z] = onBeach(angle, 1.8 + random() * 2);
    const length = 1.4 + random() * 2.2;
    const log = builders.outline(
      new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, length, 6), DRIFTWOOD),
      40,
    );
    log.rotation.set(0, 0, Math.PI / 2);
    const holder = new THREE.Group();
    holder.add(log);
    if (random() < 0.5) {
      const branch = builders.outline(
        new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 5), DRIFTWOOD),
        40,
      );
      branch.position.set(length * 0.2, 0.35, 0);
      branch.rotation.z = -0.7;
      holder.add(branch);
    }
    holder.position.set(x, 0.18, z);
    holder.rotation.y = random() * Math.PI;
    scene.add(holder);
  }
  /* rock pools on the east and north beaches: a ring of stones round a little of the lake's water */
  for (const angle of [1.2, 1.9, 2.7, 3.6, -1.6]) {
    const [x, z] = onBeach(angle, 3.2);
    const radius = 1 + hash(angle, 1) * 0.6;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20).rotateX(-Math.PI / 2),
      state.lake,
    );
    pool.position.set(x, 0.012, z);
    scene.add(pool);
    for (let k = 0; k < 7; k++) {
      const around = (k / 7) * Math.PI * 2 + random() * 0.4;
      rock(
        scene,
        x + Math.sin(around) * (radius + 0.15),
        0.08,
        z + Math.cos(around) * (radius + 0.15),
        0.28 + random() * 0.25,
        random,
        materials,
      );
    }
    obstacles.push({ x, z, r: radius + 0.2 });
  }
  /* rowing boats the sea threw up, one on its side */
  for (const [angle, roll] of [
    [2.3, 1.2],
    [-0.9, 0.2],
  ]) {
    const [x, z] = onBeach(angle, 2.6);
    const boat = builders.rowingBoat(3.2, 1.3);
    boat.position.set(x, roll > 1 ? 0.3 : 0.05, z);
    boat.rotation.set(0.05, angle + 1.2, roll);
    scene.add(boat);
    obstacles.push({ x, z, r: 1.2 });
  }
  /* the wreck of a ship on the west beach, heeled over and half sunk in the sand */
  const [wreckX, wreckZ] = onBeach(-Math.PI / 2 - 0.35, 3);
  const wreck = builders.ship({ length: 13, beam: 4.4, sail: "cloth_green", hullColor: 0x4a4038 });
  wreck.position.set(wreckX, -1.75, wreckZ);
  wreck.rotation.set(0.12, 0.9, 0.55);
  /* the sails rotted away long ago */
  for (const sail of wreck.userData.sails || []) {
    sail.visible = false;
  }
  scene.add(wreck);
  obstacles.push({ x: wreckX, z: wreckZ, r: 3.2 });
  obstacles.push({ x: wreckX + 3.2, z: wreckZ - 2.6, r: 2 });
  obstacles.push({ x: wreckX - 3.2, z: wreckZ + 2.6, r: 2 });
}

/* ---------- what grows and lies about: groves of pines, single trees, bushes, rocks, standing stones ---------- */

function buildScenery({ prop, place, pending, random }) {
  /* a spot on the ring of land, `inner` to `outer` of the way from the crown to the dunes, clear of the path,
     the camp, the ruins and what stands there already */
  const taken = [];
  const isClear = (x, z, room) =>
    tidePathDistance(x, z) > 2.5 &&
    Math.hypot(x - TIDE_CAMP.x, z - TIDE_CAMP.z) > TIDE_CAMP.radius + 3 &&
    Math.hypot(x - KEEPERS_HALL.x, z - KEEPERS_HALL.z) > 8 &&
    Math.hypot(x - WEST_RUIN.x, z - WEST_RUIN.z) > 5 &&
    CROWN_TEETH.every((tooth) => Math.hypot(x - tooth.x, z - tooth.z) > tooth.radius + 2) &&
    taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room);
  const ringSpot = (angle, share) => {
    const crown = CROWNMERE.radius + 7;
    const dunes = tidecrownCoast(angle) - 6;
    const distance = crown + (dunes - crown) * share;
    return [TIDECROWN.x + Math.sin(angle) * distance, TIDECROWN.z + Math.cos(angle) * distance];
  };
  const put = (name, x, z, options, room) => {
    if (!isClear(x, z, room)) {
      return false;
    }
    taken.push([x, z, room]);
    pending.push(prop(name, x, z, options));
    return true;
  };
  /* groves of pines, thick in their middle and thinning out, with meadows between them */
  for (let grove = 0; grove < 7; grove++) {
    const angle = (grove / 7) * Math.PI * 2 + 0.35 + random() * 0.4;
    const [cx, cz] = ringSpot(angle, 0.35 + random() * 0.4);
    for (let k = 0; k < 14; k++) {
      const around = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * 7;
      const name = random() < 0.75 ? (random() < 0.5 ? "pine" : "pine2") : "tree2";
      put(
        name,
        cx + Math.sin(around) * distance,
        cz + Math.cos(around) * distance,
        { radius: 0.45, shadow: 1.6, scale: 1 + random() * 0.3 },
        1.7,
      );
    }
  }
  /* single trees and bushes over the meadows */
  for (let k = 0; k < 60; k++) {
    const [x, z] = ringSpot(random() * Math.PI * 2, random());
    if (k < 14) {
      put(random() < 0.5 ? "tree" : "tree2", x, z, { radius: 0.45, shadow: 1.6, scale: 1 }, 2.4);
    } else {
      put("bush", x, z, { shadow: 0.7, scale: 0.6 + random() * 0.2 }, 1);
    }
  }
  for (let k = 0; k < 34; k++) {
    const [x, z] = ringSpot(random() * Math.PI * 2, random() * 1.1);
    put(random() < 0.5 ? "rock" : "rock2", x, z, { radius: 0.3, shadow: 0.6 }, 0.8);
  }
  /* standing stones of the keepers, here and there, leaning */
  for (let k = 0; k < 6; k++) {
    const [x, z] = ringSpot((k / 6) * Math.PI * 2 + 0.9, 0.5 + random() * 0.3);
    if (isClear(x, z, 1.5)) {
      taken.push([x, z, 1.5]);
      const stone = builders.menhir(1.6 + random() * 1.2);
      place(stone, x, z, { rotation: random() * Math.PI, radius: 0.5 });
      stone.rotation.z = (random() - 0.5) * 0.25;
    }
  }
  /* bones of what the Leviathan took, on the shingle inside the crown */
  for (let k = 0; k < 7; k++) {
    const angle = 0.7 + (k / 7) * Math.PI * 1.7 + random() * 0.2;
    const distance = CROWNMERE.radius + 1.8 + random() * 1.5;
    pending.push(
      prop(
        ["ember_ribs", "ember_skull", "ember_ram_skull"][k % 3],
        CROWNMERE.x + Math.sin(angle) * distance,
        CROWNMERE.z + Math.cos(angle) * distance,
        { shadow: 0.5, scale: 0.6 },
      ),
    );
  }
}

/* ---------- the tide seal: the ritual, and Maelis ---------- */

/* Is the tide seal's ritual waiting for this hero? */
const isRitualWaiting = () =>
  Object.entries(player.quests || {}).some(([id, record]) => {
    const goal = QUESTS[id]?.goal;
    return (
      record.state === "active" && !record.count && goal?.type === "ritual" && goal.seal === "tide"
    );
  });

/** Clicked something of Tidecrown: walk to it, then use it. */
export function clickTidecrownObject(object) {
  const use = () => touchSeal();
  if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE) {
    use();
    return;
  }
  const dx = player.x - object.x;
  const dz = player.z - object.z;
  const length = Math.hypot(dx, dz) || 1;
  player.destination = [object.x + (dx / length) * 2.2, object.z + (dz / length) * 2.2];
  player.onArrive = () => {
    if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE + 0.6) {
      use();
    }
  };
  player.target = null;
}

/* what Maelis says, standing on the water north of the islet, the heart of the tide in his hand */
const MAELIS_LINES = [
  "So the guardian is dead. I wondered who would come. I hoped it would be you.",
  "You think I break the seals. Two were cracking long before I touched one. The Hollow is waking, and no wall of runes will hold it.",
  "When it wakes, it will take a hand that holds all seven hearts. Fire, tide... I would rather that hand be mine than nobody's.",
  "Go home to your archmage. Ask him what the old mages fed the seals. Then come and find me, if you still want to.",
];
/* seconds between his lines */
const LINE_SECONDS = 4.6;
/* where he stands: on the water, a little north of the islet */
const MAELIS_SPOT = [SEAL_ISLET.x, SEAL_ISLET.z - SEAL_ISLET.radius - 3];

function touchSeal() {
  if (state.isWaking || state.scene) {
    return;
  }
  if (!isRitualWaiting()) {
    UI.systemMessage(
      (player.runes || []).includes("tide")
        ? "The tide stones are cool under your hand. Far down, the seal breathes in and out."
        : "Four stones carved with waves stand round the altar. Water beads on them, though no spray reaches this far.",
    );
    return;
  }
  state.isWaking = true;
  player.destination = null;
  UI.systemMessage(
    "You lay your hand on the altar. Cold runs up your arm, and the tide stones stir.",
  );
  state.seal.runes.forEach((rune, k) => {
    setTimeout(
      () => {
        rune.face.material.color.set(0xffffff);
        groundRing(rune.x, rune.z, TIDE_COLOR, 0.2, 1.2, 0.7, 0.9);
        playEffect("splash", rune.x, rune.z, { size: 1.2, grounded: true, tint: TIDE_COLOR });
        burst(rune.x, 1, rune.z, { color: TIDE_COLOR, count: 12, speed: 3 });
        sfx.chime();
        UI.systemMessage(
          ["The first wave wakes.", "The second wakes.", "The third.", "The fourth."][k],
        );
      },
      600 + k * 700,
    );
  });
  setTimeout(
    () => {
      groundRing(TIDE_SEAL[0], TIDE_SEAL[1], TIDE_COLOR, 0.5, 7, 1.2, 0.9);
      playEffect("light_rays", TIDE_SEAL[0], TIDE_SEAL[1], {
        size: 4,
        grounded: true,
        tint: TIDE_COLOR,
      });
      sealLight.strength = 1;
      screenFlash("140, 230, 220");
      shakeCamera(0.15, 0.5);
      sfx.bossIntro();
      state.isWaking = false;
      startMaelis();
    },
    600 + 4 * 700 + 400,
  );
}

/* Maelis comes: a rune flares on the water, and there he stands */
function startMaelis() {
  const figure = maelisFigure();
  const [x, z] = MAELIS_SPOT;
  figure.sprite.group.position.set(x, LAKE_Y + 0.05, z);
  figure.sprite.face(player.x - x, player.z - z);
  figure.sprite.play("idle");
  playEffect("rune_circle", x, z, {
    size: 2.6,
    y: LAKE_Y + 0.08,
    grounded: true,
    tint: MAELIS_COLOR,
  });
  playEffect("smoke", x, z, { size: 1.8, grounded: true });
  groundRing(x, z, MAELIS_COLOR, LAKE_Y + 0.1, 3, 0.8, 0.9);
  sfx.skill();
  /* the heart of the tide, a light of its own over his hand */
  const heart = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xd8fff8 }),
  );
  heart.renderOrder = 10001;
  heart.position.set(x + 0.45, LAKE_Y + 1.6, z);
  scene.add(heart);
  state.scene = { figure, heart, time: 0, line: -1, x, z };
  UI.systemMessage("Someone is standing on the water beyond the islet.");
}

/* Per frame while he is here: he speaks, holds up the heart, and goes through a rune into the lake */
function updateMaelis(dt) {
  const visit = state.scene;
  visit.time += dt;
  const line = Math.floor((visit.time - 1.2) / LINE_SECONDS);
  if (line > visit.line && line < MAELIS_LINES.length) {
    visit.line = line;
    UI.speechBubble(visit.figure.label, MAELIS_LINES[line]);
  }
  const { sprite } = visit.figure;
  sprite.face(player.x - visit.x, player.z - visit.z);
  sprite.update(dt, cameraState);
  sprite.group.position.y = LAKE_Y + 0.05 + Math.sin(visit.time * 1.6) * 0.04;
  visit.heart.position.y = LAKE_Y + 1.6 + Math.sin(visit.time * 2.4) * 0.08;
  visit.heart.scale.setScalar(1 + Math.sin(visit.time * 5) * 0.12);
  UI.positionLabel(visit.figure.label, visit.x, sprite.height + 0.15, visit.z, camera);
  const leaveAt = 1.2 + MAELIS_LINES.length * LINE_SECONDS;
  if (visit.time >= leaveAt && !visit.isGone) {
    /* down through a rune into the lake, and gone */
    visit.isGone = true;
    playEffect("rune_circle", visit.x, visit.z, {
      size: 3.2,
      y: LAKE_Y + 0.08,
      grounded: true,
      tint: MAELIS_COLOR,
    });
    playEffect("splash", visit.x, visit.z, { size: 2.4, grounded: true, tint: TIDE_COLOR });
    burst(visit.x, LAKE_Y + 1, visit.z, { color: MAELIS_COLOR, count: 30, speed: 4 });
    screenFlash("180, 156, 255");
    sfx.bossIntro();
    scene.remove(sprite.group, visit.heart);
    visit.figure.label.el.remove();
    UI.announce("The Tide Seal", "The tide stones wake. But Maelis has the heart of the sea.");
    game.questLog.onRitual("tide");
    state.scene = null;
  }
}

/* ---------- every frame ---------- */

/** Per frame: the ground is painted on as a hero comes near, the lake moves, the seal glows, Maelis visits. */
export function updateTidecrown(dt, time) {
  paintGround();
  /* the blue fires on the islet, once the effects are there to burn */
  if (!state.firesLit && game.effects) {
    state.firesLit = true;
    for (const [x, z] of ISLET_FIRES) {
      playEffect("fire", x, z, {
        size: 0.8,
        y: 1.06,
        grounded: true,
        loop: true,
        tint: TIDE_COLOR,
      });
    }
  }
  if (state.lake) {
    state.lake.uniforms.uTime.value = time;
  }
  /* the seal's glow sinks back after the ritual */
  sealLight.strength +=
    (0.35 + Math.sin(time * 1.4) * 0.08 - sealLight.strength) * Math.min(1, dt * 0.6);
  if (state.scene) {
    updateMaelis(dt);
  }
}
