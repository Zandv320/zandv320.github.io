/* Eldoria – Tidecrown as the players see it (the rules are in rules/tidecrown.js): a ring of salt-worn grass on a
   beach of sand, the Crownmere in the old crater in its middle, sunk below the land, grey-green and moving; the
   crown of dark rock teeth round the lake; the causeway out to the seal's islet with its altar and four tide
   stones; on the south coast the landing with its pier, the Gull's Promise alongside when a hero has brought her
   here, and a small camp above the beach. Pines and wind-bent trees, the wreck of a ship on the west beach, and
   bones round the lake.
   Here too the tide seal's ritual ('The tide seal', rules/quests.js goal 'ritual'): the stones wake, and Maelis
   comes over the water for the seal's heart. Only the hero at the altar sees him. */
import * as THREE from "three";
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
} from "./rules/tidecrown.js";
import { QUESTS } from "./rules/quests.js";
import { HULL } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { SEA_VERTEX, SEA_FRAGMENT } from "./saltmere.js";
import { coastSlab, addSurf } from "./sea.js";
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
    Promise.all([
      loadTexture("sprites/ground.png", { raw: true }),
      loadTexture("sprites/ember_ground.png", { raw: true }),
    ]).then(([grass, ember]) => prepareGround(grass.image, ember.image)),
  );
  buildCoast();
  buildLake(obstacles);
  buildCrown(random, obstacles);
  buildLanding({ prop, place, pending, obstacles });
  buildScenery({ prop, place, pending, random, obstacles });
}

/* ---------- the ground: grass worn by salt, sand along the coast, pebbles round the lake, a path ---------- */

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

/* the path from the pier past the camp up to the causeway */
const PATH = [
  [TIDE_PIER.x, TIDE_PIER.north + 1],
  [TIDE_CAMP.x - 1, TIDE_CAMP.z + 3],
  [TIDE_CAMP.x - 3, TIDE_CAMP.z - 10],
  [CAUSEWAY.x + 1, CAUSEWAY.south + 4],
  [CAUSEWAY.x, CAUSEWAY.south],
];
function pathDistance(x, z) {
  let best = Infinity;
  for (let k = 0; k < PATH.length - 1; k++) {
    const [ax, az] = PATH[k];
    const [bx, bz] = PATH[k + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

let painter = null;

function prepareGround(grassImage, emberImage) {
  const grass = pixelsOf(grassImage);
  const ember = pixelsOf(emberImage);
  /* the colour of pixel (gx, gy) of a 32 px tile of an atlas, the tiles repeating */
  const tilePixel = (atlas, tile, gx, gy) => {
    const k = ((gy & 31) * atlas.width + tile * 32 + (gx & 31)) * 4;
    return [atlas.data[k], atlas.data[k + 1], atlas.data[k + 2]];
  };
  const x0 = TIDECROWN.x - TIDECROWN_REACH;
  const z0 = TIDECROWN.z - TIDECROWN_REACH;
  const count = Math.ceil((TIDECROWN_REACH * 2) / CHUNK);
  const chunks = [];
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      chunks.push({ x0: x0 + i * CHUNK, z0: z0 + j * CHUNK });
    }
  }
  painter = { grass, ember, tilePixel, chunks, job: null };
  const size = TIDECROWN_REACH * 2;
  addShadowCatcher(size, size, TIDECROWN.x, 0.029, TIDECROWN.z);
  /* under the chunks a plain floor in the coast's shape with the lake cut out, so an unpainted chunk is no hole */
  const shape = new THREE.Shape();
  for (let k = 0; k <= 180; k++) {
    const angle = (k / 180) * Math.PI * 2;
    const r = tidecrownCoast(angle);
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
    CROWNMERE.radius,
    0,
    Math.PI * 2,
    true,
  );
  shape.holes.push(lake);
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(96 / 255, 132 / 255, 92 / 255, THREE.SRGBColorSpace),
    }),
  );
  floor.position.set(TIDECROWN.x, 0.001, TIDECROWN.z);
  scene.add(floor);
}

/* what lies at (x, z): null for water, else [atlas, tile, r, g, b] (a tint, multiplied in) */
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
  const { grass, ember } = painter;
  const wobble = noise(x * 0.25, z * 0.25);
  if (inland < 3.5 + wobble * 3) {
    /* wet sand at the water's edge, dry above it */
    const wet = inland < 1.1 + wobble * 0.6 ? 0.8 : 1;
    return [ember, 3, wet, wet, wet * 1.04];
  }
  if (fromLake < 1.6 + wobble * 1.6) {
    return [ember, 2, 0.86, 0.94, 0.98];
  }
  if (pathDistance(x, z) < 1 + noise(x * 0.9, z * 0.9) * 0.5) {
    return [grass, 5, 0.9, 0.92, 0.92];
  }
  /* inside the crown the grass is darker, wet with spray; elsewhere grey-green with salt */
  const tile = hash(Math.floor(x / 2), Math.floor(z / 2)) < 0.12 ? 2 : 0;
  const isCrown = fromLake < 7 + wobble * 2;
  const patch = noise(x * 0.08, z * 0.08);
  return isCrown
    ? [grass, tile, 0.7, 0.82, 0.84]
    : [grass, tile, 0.84 + patch * 0.08, 0.93, 0.86 + patch * 0.06];
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
  const { tilePixel } = painter;
  const originX = Math.round(chunk.x0 * PX);
  const originY = Math.round(chunk.z0 * PX);
  for (let i = 0; i < CELLS; i++) {
    const ground = groundAt(chunk.x0 + (i + 0.5) * CELL_UNITS, chunk.z0 + (j + 0.5) * CELL_UNITS);
    if (!ground) {
      continue;
    }
    const [atlas, tile, tr, tg, tb] = ground;
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const lx = i * CELL + px;
        const ly = j * CELL + py;
        const [r, g, b] = tilePixel(atlas, tile, originX + lx, originY + ly);
        const k = (ly * CHUNK_PIXELS + lx) * 4;
        pixels[k] = r * tr;
        pixels[k + 1] = g * tg;
        pixels[k + 2] = b * tb;
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
}

/* ---------- the coast: the land's sandy flank down into the sea, and the surf ---------- */

function buildCoast() {
  const reach = (angle) => tidecrownCoast(angle);
  const sand = new THREE.Mesh(
    coastSlab(reach, 1, 0.3, 1.5, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xcdb98a, flatShading: true }),
  );
  sand.position.set(TIDECROWN.x, WATER_Y - 0.62, TIDECROWN.z);
  scene.add(sand);
  addSurf(scene, TIDECROWN.x, TIDECROWN.z, 1.2, 2.6, reach);
}

/* ---------- the Crownmere: sunk in the crater, its islet and the causeway out to it ---------- */

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

function buildLake(obstacles) {
  const { x, z, radius } = CROWNMERE;
  /* the crater's wall from the land down into the water, seen from the inside */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius - 0.4, 2, 72, 1, true),
    builders.material("basalt", radius * 2 * Math.PI, 2, 0.8),
  );
  wall.material.side = THREE.BackSide;
  wall.position.set(x, -1, z);
  scene.add(wall);
  /* the water: the sea's own shader, in the grey-greens of the Leviathan's lake */
  const material = new THREE.ShaderMaterial({
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
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72).rotateX(-Math.PI / 2),
    material,
  );
  water.position.set(x, LAKE_Y, z);
  scene.add(water);
  state.lake = material;
  /* the islet: a drum of old stone rising out of the water, paved on top */
  const islet = new THREE.Mesh(
    new THREE.CylinderGeometry(SEAL_ISLET.radius, SEAL_ISLET.radius + 0.5, 2, 32),
    builders.material("stone", SEAL_ISLET.radius * 2 * Math.PI, 2, 0.7),
  );
  islet.position.set(SEAL_ISLET.x, -0.98, SEAL_ISLET.z);
  scene.add(islet);
  const paving = builders.plaza(SEAL_ISLET.radius - 0.05, "cobbles2", 0.85);
  paving.position.set(SEAL_ISLET.x, 0.02, SEAL_ISLET.z);
  scene.add(paving);
  /* the causeway: a dyke of the same stone, a little lower at the edges */
  const length = CAUSEWAY.south - CAUSEWAY.north;
  const dyke = new THREE.Mesh(
    new THREE.BoxGeometry(CAUSEWAY.halfWidth * 2, 2, length),
    builders.material("stone", CAUSEWAY.halfWidth * 2, 2, 0.72),
  );
  dyke.position.set(CAUSEWAY.x, -0.98, (CAUSEWAY.north + CAUSEWAY.south) / 2);
  scene.add(dyke);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(CAUSEWAY.halfWidth * 2, length).rotateX(-Math.PI / 2),
    builders.material("cobbles2", CAUSEWAY.halfWidth * 2, length, 0.82),
  );
  top.position.set(CAUSEWAY.x, 0.025, (CAUSEWAY.north + CAUSEWAY.south) / 2);
  scene.add(top);
  /* broken posts along both edges */
  for (let pz = CAUSEWAY.north + 2; pz < CAUSEWAY.south - 2; pz += 3.2) {
    for (const side of [-1, 1]) {
      const height = 0.5 + hash(pz, side) * 0.7;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, height, 0.32),
        builders.material("stone", 0.32, height, 0.66),
      );
      post.position.set(CAUSEWAY.x + side * (CAUSEWAY.halfWidth - 0.1), height / 2, pz);
      post.rotation.z = (hash(side, pz) - 0.5) * 0.3;
      scene.add(post);
    }
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

/* ---------- the crown: teeth of dark rock round the lake ---------- */

function buildCrown(random, obstacles) {
  const rock = builders.material("basalt", 2, 2, 0.7);
  for (const tooth of CROWN_TEETH) {
    const group = new THREE.Group();
    let y = -0.4;
    let size = tooth.radius * 1.1;
    const pieces = Math.max(3, Math.round(tooth.height / 1.4));
    for (let k = 0; k < pieces; k++) {
      const piece = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rock);
      piece.position.set(
        (random() - 0.5) * size * 0.3,
        y + size * 0.7,
        (random() - 0.5) * size * 0.3,
      );
      piece.scale.y = 1.4;
      piece.rotation.set(random() * 3, random() * 3, random() * 3);
      piece.castShadow = true;
      group.add(piece);
      y += size * 1.15;
      size *= 0.78;
    }
    /* leaning a little out from the lake, like the points of a crown */
    const outX = tooth.x - CROWNMERE.x;
    const outZ = tooth.z - CROWNMERE.z;
    const length = Math.hypot(outX, outZ) || 1;
    group.rotation.set((outZ / length) * 0.14, 0, (-outX / length) * 0.14);
    group.position.set(tooth.x, 0, tooth.z);
    group.userData.mapKind = "rock";
    scene.add(group);
    obstacles.push({ x: tooth.x, z: tooth.z, r: tooth.radius });
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
  /* the camp: a tent, a fire (main.js lights it), what was brought ashore */
  const inCamp = (dx, dz) => [TIDE_CAMP.x + dx, TIDE_CAMP.z + dz];
  place(builders.campfire(), ...inCamp(0, 0), { radius: 0.9 });
  place(builders.tent(3, 3.2, "cloth_green"), ...inCamp(-4.6, -2.6), {
    rotation: 0.4,
    radius: 1.7,
  });
  pending.push(prop("crypt_crates", ...inCamp(3.6, -3), { radius: 0.7, scale: 0.9 }));
  place(builders.barrel(), ...inCamp(4.4, -1.6), { radius: 0.45 });
  pending.push(prop("lantern", ...inCamp(-2, 3), { radius: 0.25 }));
  pending.push(prop("lantern", x - 1.6, north + 0.5, { radius: 0.25 }));
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

/* ---------- what stands about: pines and wind-bent trees, rocks, a wreck, bones by the lake ---------- */

function buildScenery({ prop, place, pending, random, obstacles }) {
  /* a spot on the ring of land, `inner` to `outer` of the way from the crown to the coast, clear of the path,
     the camp and what stands there already */
  const taken = [];
  const spotOnRing = (inner, outer, room) => {
    for (let tries = 0; tries < 40; tries++) {
      const angle = random() * Math.PI * 2;
      const crown = CROWNMERE.radius + 6;
      const coast = tidecrownCoast(angle) - 4;
      const distance = crown + (coast - crown) * (inner + random() * (outer - inner));
      const x = TIDECROWN.x + Math.sin(angle) * distance;
      const z = TIDECROWN.z + Math.cos(angle) * distance;
      const isClear =
        pathDistance(x, z) > 2.5 &&
        Math.hypot(x - TIDE_CAMP.x, z - TIDE_CAMP.z) > TIDE_CAMP.radius + 2 &&
        taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room);
      if (isClear) {
        taken.push([x, z, room]);
        return [x, z];
      }
    }
    return null;
  };
  const scatter = (
    names,
    count,
    inner,
    outer,
    { radius = 0, shadow = 0.8, scale = 0.65, room = 1 },
  ) => {
    for (let k = 0; k < count; k++) {
      const spot = spotOnRing(inner, outer, room);
      if (spot) {
        pending.push(prop(names[k % names.length], ...spot, { radius, shadow, scale }));
      }
    }
  };
  scatter(["pine", "pine2"], 46, 0.15, 0.85, { radius: 0.45, shadow: 1.6, scale: 1.1, room: 2.2 });
  scatter(["tree", "tree2"], 14, 0.2, 0.7, { radius: 0.45, shadow: 1.6, scale: 1, room: 2.4 });
  scatter(["bush", "grass_tuft"], 70, 0, 1, { shadow: 0.7, room: 0.8 });
  scatter(["rock", "rock2"], 40, 0, 1, { radius: 0.3, shadow: 0.6, room: 1 });
  scatter(["ember_rock4", "ember_boulder"], 10, 0.1, 0.9, {
    radius: 0.7,
    shadow: 1.2,
    scale: 0.75,
    room: 2,
  });
  /* bones of what the Leviathan took, on the shore inside the crown */
  for (let k = 0; k < 9; k++) {
    const angle = 0.5 + (k / 9) * Math.PI * 1.9 + random() * 0.2;
    const distance = CROWNMERE.radius + 1.6 + random() * 2;
    const bx = CROWNMERE.x + Math.sin(angle) * distance;
    const bz = CROWNMERE.z + Math.cos(angle) * distance;
    pending.push(
      prop(["ember_ribs", "ember_skull", "ember_ram_skull"][k % 3], bx, bz, {
        shadow: 0.5,
        scale: 0.6,
      }),
    );
  }
  /* the wreck of a ship on the west beach, heeled over and half sunk in the sand */
  const angle = -Math.PI / 2 - 0.35;
  const distance = tidecrownCoast(angle) - 3;
  const wreckX = TIDECROWN.x + Math.sin(angle) * distance;
  const wreckZ = TIDECROWN.z + Math.cos(angle) * distance;
  const wreck = builders.ship({ length: 13, beam: 4.4, sail: "cloth_green", hullColor: 0x4a4038 });
  wreck.position.set(wreckX, -1.3, wreckZ);
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
