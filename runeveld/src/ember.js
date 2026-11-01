/* Eldoria – the Ember Isles as the players see them (the rules are in rules/ember.js): grey ash with sand along the
   coast, rivers of lava glowing down to the sea, dead trees, rocks and bones, little lava mounds that steam, and over
   everything Mount Kharos in basalt, smoking, its crater aglow; Cinder Cove on the south coast with its jetty, the
   Gull's Promise lying alongside when a hero has brought her here, and the camp on the beach above. The ground,
   the basalt and the props come from schwarnhild's free volcano pack (tools/build_sprites.py, build_ember). */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  EMBER_ISLES,
  EMBER_REACH,
  CINDER_COVE,
  COVE_JETTY,
  COVE_BERTH,
  CINDER_CAMP,
  MOUNT_KHAROS,
  LAVA_FLOWS,
  LAVA_POOLS,
  LAVA_WIDTH,
  LAVA_CROSSINGS,
  CROSSING_REACH,
  riverDistance,
  emberShore,
  inEmberIsles,
  lavaDistance,
  kharosRadius,
  outsideKharos,
  onEmberLand,
  inCamp,
  roadDistance,
  EMBER_LANDS,
} from "./rules/ember.js";
import { HULL } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { addShadowCatcher, applyGroundFilter, cameraState } from "./world.js";
import { clickables, player } from "./game-state.js";
import { loadTexture } from "./sprites.js";

/* the mountain's shape: height, and the crater's mouth at the top */
const KHAROS_HEIGHT = MOUNT_KHAROS.height;
const CRATER_RADIUS = MOUNT_KHAROS.craterRadius;

const volcanoSmoke = [];
/* steam rising from cracks in the ash: {x, z, puffs} */
const steamVents = [];
let craterGlow = null;
/* the mountain, which fades while the hero is behind it */
let mountain = null;
/* the surf all along the coast, breathing */
const surf = [];
/* the Gull's Promise at the jetty, and her swell */
let coveGull = null;

/** Builds the Ember Isles (world.js calls this with its build context). */
export function buildEmberIsles({ scene, prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(9090);
  /* the ground is painted from the volcano tiles (sprites/ember_ground.png), chunk by chunk as the hero comes near */
  pending.push(
    Promise.all([
      loadTexture("sprites/ember_ground.png", { raw: true }),
      loadTexture("sprites/ember_patches.png", { raw: true }),
    ]).then(([tiles, patches]) => prepareGround(scene, tiles.image, patches.image)),
  );
  buildLava(scene, random);
  buildSurf(scene);
  buildCoast(scene, random);
  buildKharos(scene, random);
  buildJetty(scene, random);
  buildCamp({ scene, prop, place, pending, obstacles });
  buildScenery({ scene, prop, place, pending, random });
  /* smoke and steam at their places from the start (they are moved only while a hero is in the world) */
  updateEmberIsles(0, 0);
}

/* ---------- the ground: grey ash and sand from the volcano tiles, painted pixel by pixel ---------- */

/* a small value noise of our own, the same every time */
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

/* the tiles in sprites/ember_ground.png, 32 px each, side by side (tools/build_sprites.py EMBER_TILES) */
const TILE = { ground: 0, specks: 1, pebbles: 2, sand: 3 };
/* sixteen pixels a unit, like every other ground (a 32 px tile spans 2 units); a cell is four pixels */
const PX = 16;
const CELL = 4;
const EMBER_GLOW = [
  [255, 154, 58],
  [232, 84, 30],
];

/* the pixels of an image, as an array of rgba */
function pixelsOf(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height).data;
}

/* The ground is painted in square chunks of this many units, each when the hero comes near (a few rows a frame,
   so nothing stutters); the isles are too wide to paint at once. */
const CHUNK = 40;
const CHUNK_PIXELS = CHUNK * PX;
const CELLS = CHUNK_PIXELS / CELL;
const CELL_UNITS = CELL / PX;
/* how near the hero (or their ship) a chunk is painted, and how long a frame may spend on it (ms) */
const PAINT_REACH = 240;
const PAINT_BUDGET = 5;

/* the painter: the tiles and the sand patches as pixels, the chunks of land still to paint, the one being painted */
let painter = null;

function prepareGround(scene, tilesImage, patchesImage) {
  const atlas = pixelsOf(tilesImage);
  /* the colour of pixel (gx, gy) of the ground in tile `tile`, the tiles repeating every 32 px */
  const tilePixel = (tile, gx, gy) => {
    const k = ((gy % 32) * tilesImage.width + tile * 32 + (gx % 32)) * 4;
    return [atlas[k], atlas[k + 1], atlas[k + 2]];
  };
  const [ashR, ashG, ashB] = tilePixel(TILE.ground, 0, 0);
  /* the chunks over land (or the beach): a chunk wholly out at sea is left out */
  const reach = EMBER_REACH;
  const x0 = Math.floor((EMBER_ISLES.x - reach) / CHUNK) * CHUNK;
  const z0 = Math.floor((EMBER_ISLES.z - reach) / CHUNK) * CHUNK;
  const chunks = [];
  for (let cz = z0; cz < EMBER_ISLES.z + reach; cz += CHUNK) {
    for (let cx = x0; cx < EMBER_ISLES.x + reach; cx += CHUNK) {
      let isLand = false;
      for (let u = 0; u <= 8 && !isLand; u++) {
        for (let v = 0; v <= 8 && !isLand; v++) {
          isLand = onEmberLand(cx + (u * CHUNK) / 8, cz + (v * CHUNK) / 8, -3);
        }
      }
      if (isLand) {
        chunks.push({ x0: cx, z0: cz });
      }
    }
  }
  /* the sand patches ringed with stones, laid where the ash is open: their spots over the whole isles */
  const isOpen = (x, z) =>
    onEmberLand(x, z, 7) &&
    lavaDistance(x, z) > 2.5 &&
    roadDistance(x, z) > 3 &&
    Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) > 11 &&
    outsideKharos(x, z) > 2;
  const span = 96 / PX;
  const patchSpots = [];
  for (let k = 0; k < 900; k++) {
    const x = EMBER_ISLES.x - reach + hash(k, 3.3) * reach * 2;
    const z = EMBER_ISLES.z - reach + hash(k, 8.1) * reach * 2;
    if ([0, 0.5, 1].every((u) => [0, 0.5, 1].every((v) => isOpen(x + u * span, z + v * span)))) {
      patchSpots.push({ x: Math.round(x * PX) / PX, z: Math.round(z * PX) / PX, which: k % 2 });
    }
  }
  painter = {
    scene,
    tilePixel,
    isAsh: (r, g, b) => r === ashR && g === ashG && b === ashB,
    patches: pixelsOf(patchesImage),
    patchesWidth: patchesImage.width,
    patchSpots,
    chunks,
    job: null,
  };
  const size = reach * 2;
  addShadowCatcher(size, size, EMBER_ISLES.x, 0.029, EMBER_ISLES.z);
  /* under the chunks a plain ash floor in the coast's shape, so a chunk not painted yet is never a hole */
  const shape = new THREE.Shape();
  for (let k = 0; k <= 360; k++) {
    const angle = (k / 360) * Math.PI * 2;
    const r = emberShore(angle);
    const point = [Math.sin(angle) * r, -Math.cos(angle) * r];
    if (k === 0) {
      shape.moveTo(...point);
    } else {
      shape.lineTo(...point);
    }
  }
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(91 / 255, 101 / 255, 108 / 255, THREE.SRGBColorSpace),
    }),
  );
  floor.position.set(EMBER_ISLES.x, 0.001, EMBER_ISLES.z);
  scene.add(floor);
}

/* Paints on: picks the nearest chunk still to paint within reach of the hero, and paints rows of it until this
   frame's budget is spent; a finished chunk goes into the scene. */
function paintGround() {
  if (!painter) {
    return;
  }
  const started = performance.now();
  while (performance.now() - started < PAINT_BUDGET) {
    if (!painter.job) {
      let best = null;
      let bestDistance = PAINT_REACH;
      for (const chunk of painter.chunks) {
        const distance = Math.hypot(
          chunk.x0 + CHUNK / 2 - player.x,
          chunk.z0 + CHUNK / 2 - player.z,
        );
        if (!chunk.isPainted && distance < bestDistance) {
          best = chunk;
          bestDistance = distance;
        }
      }
      if (!best) {
        return;
      }
      painter.job = startChunk(best);
    }
    const job = painter.job;
    paintCellRow(job, job.row);
    job.row++;
    if (job.row >= CELLS) {
      finishChunk(job);
      painter.job = null;
    }
  }
}

/* a chunk to paint: its pixels, and the ash's lighter and darker patches at every cell corner (each pixel blends
   the four round it, so their edges run smooth) */
function startChunk(chunk) {
  const corners = CELLS + 1;
  const patchGrid = new Float32Array(corners * corners);
  for (let j = 0; j < corners; j++) {
    for (let i = 0; i < corners; i++) {
      const x = chunk.x0 + i * CELL_UNITS;
      const z = chunk.z0 + j * CELL_UNITS;
      patchGrid[j * corners + i] = noise(x * 0.07, z * 0.07) * 0.6 + noise(x * 0.3, z * 0.3) * 0.4;
    }
  }
  return {
    chunk,
    pixels: new Uint8ClampedArray(CHUNK_PIXELS * CHUNK_PIXELS * 4),
    patchGrid,
    row: 0,
  };
}

function paintCellRow(job, j) {
  const { chunk, pixels, patchGrid } = job;
  const { tilePixel, isAsh } = painter;
  const corners = CELLS + 1;
  const patchAt = (lx, ly) => {
    const fx = lx / CELL;
    const fy = ly / CELL;
    const i = Math.min(CELLS - 1, Math.floor(fx));
    const jj = Math.min(CELLS - 1, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - jj;
    const top = patchGrid[jj * corners + i] * (1 - tx) + patchGrid[jj * corners + i + 1] * tx;
    const bottom =
      patchGrid[(jj + 1) * corners + i] * (1 - tx) + patchGrid[(jj + 1) * corners + i + 1] * tx;
    return top * (1 - ty) + bottom * ty;
  };
  /* pixel numbers over the whole isles, so the tiles and the grain run on from chunk to chunk */
  const originX = Math.round(chunk.x0 * PX);
  const originY = Math.round(chunk.z0 * PX);
  for (let i = 0; i < CELLS; i++) {
    const x = chunk.x0 + (i + 0.5) * CELL_UNITS;
    const z = chunk.z0 + (j + 0.5) * CELL_UNITS;
    const dx = x - EMBER_ISLES.x;
    const dz = z - EMBER_ISLES.z;
    /* how far inland: along the bearing from the isles' middle */
    const cellInland = emberShore(Math.atan2(dx, dz)) - Math.hypot(dx, dz);
    if (cellInland < -0.3) {
      continue;
    }
    /* near an edge (a road, the camp, the lava, the mountain) every pixel looks for itself; elsewhere the cell's
       answer holds for all of it */
    const cellMountain = outsideKharos(x, z);
    const cellLava = lavaDistance(x, z);
    const cellRiver = riverDistance(x, z);
    const isNearPath =
      roadDistance(x, z) < 2.6 || Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) < 10.5;
    const isTroddenAt = (wx, wz) =>
      roadDistance(wx, wz) < 1.1 + noise(wx * 0.9, wz * 0.9) * 0.6 ||
      Math.hypot(wx - CINDER_CAMP.x, wz - CINDER_CAMP.z) < 6.5 + noise(wx * 0.3, wz * 0.3) * 2.5;
    const beachWidth = 3 + noise(x * 0.2, z * 0.2) * 3;
    /* along the shore every pixel looks for itself, so the coast runs smooth instead of in steps */
    const isShore = cellInland < beachWidth + 0.6;
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const lx = i * CELL + px;
        const ly = j * CELL + py;
        const gx = originX + lx;
        const gy = originY + ly;
        const wx = chunk.x0 + (lx + 0.5) / PX;
        const wz = chunk.z0 + (ly + 0.5) / PX;
        let inland = cellInland;
        if (isShore) {
          const pdx = wx - EMBER_ISLES.x;
          const pdz = wz - EMBER_ISLES.z;
          inland = emberShore(Math.atan2(pdx, pdz)) - Math.hypot(pdx, pdz);
          if (inland < 0) {
            continue;
          }
        }
        const fromLava = cellLava < 2.4 ? lavaDistance(wx, wz) : cellLava;
        const fromMountain = cellMountain < 7 ? outsideKharos(wx, wz) : cellMountain;
        const isTrodden = isNearPath && isTroddenAt(wx, wz);
        const grain = hash(gx * 0.37, gy * 0.71);
        /* the ground: the ash in broad patches a shade lighter or darker, with specks or pebbles strewn in here
           and there */
        const variant = hash(Math.floor(gx / 32) + 0.5, Math.floor(gy / 32) + 0.5);
        const groundTile =
          variant < 0.5 ? TILE.ground : variant < 0.85 ? TILE.specks : TILE.pebbles;
        let [r, g, b] = tilePixel(groundTile, ((gx % 32) + 32) % 32, ((gy % 32) + 32) % 32);
        const patch = patchAt(lx, ly);
        let shade = isAsh(r, g, b) ? (patch < 0.38 ? 0.88 : patch > 0.64 ? 1.08 : 1) : 1;
        if (inland < beachWidth && grain < (beachWidth - inland) / 1.4) {
          /* sand along the shore, wet and darker at the water, frayed where it meets the ash */
          [r, g, b] = tilePixel(TILE.sand, ((gx % 32) + 32) % 32, ((gy % 32) + 32) % 32);
          shade = inland < 0.6 ? 0.62 : 0.92;
        } else if (isTrodden && grain < 0.45) {
          /* the trodden roads and the camp: ash and sand worked together */
          [r, g, b] = tilePixel(TILE.sand, ((gx % 32) + 32) % 32, ((gy % 32) + 32) % 32);
          shade = 0.82;
        }
        const isCrust =
          cellRiver < 1.5 &&
          riverDistance(wx, wz) < 0.35 &&
          LAVA_CROSSINGS.some(
            (crossing) => Math.hypot(wx - crossing.x, wz - crossing.z) < CROSSING_REACH + 0.6,
          );
        if (isCrust) {
          /* a crossing: the lava crusted over, black basalt with a glow in its cracks */
          [r, g, b] = grain > 0.9 ? EMBER_GLOW[1] : grain > 0.45 ? [58, 52, 54] : [40, 36, 38];
          shade = 1;
        } else if (fromLava < 1.6) {
          /* scorched black beside the lava, with embers in it */
          shade *= 0.35 + (0.45 * Math.max(0, fromLava)) / 1.6;
          if (fromLava < 0.7 && grain > 0.93) {
            [r, g, b] = EMBER_GLOW[grain > 0.97 ? 0 : 1];
            shade = 1;
          }
        } else if (fromMountain < 6) {
          shade *= 0.72 + fromMountain * 0.045;
        }
        const k = (ly * CHUNK_PIXELS + lx) * 4;
        pixels[k] = r * shade;
        pixels[k + 1] = g * shade;
        pixels[k + 2] = b * shade;
        pixels[k + 3] = 255;
      }
    }
  }
}

/* the sand patches that fall on this chunk, then the chunk into the scene */
function finishChunk(job) {
  const { chunk, pixels } = job;
  const { patches, patchesWidth, isAsh, patchSpots } = painter;
  const PATCH = 96;
  for (const spot of patchSpots) {
    const left = Math.round((spot.x - chunk.x0) * PX);
    const top = Math.round((spot.z - chunk.z0) * PX);
    if (left >= CHUNK_PIXELS || top >= CHUNK_PIXELS || left + PATCH <= 0 || top + PATCH <= 0) {
      continue;
    }
    for (let py = Math.max(0, -top); py < Math.min(PATCH, CHUNK_PIXELS - top); py++) {
      for (let px = Math.max(0, -left); px < Math.min(PATCH, CHUNK_PIXELS - left); px++) {
        const from = (py * patchesWidth + spot.which * PATCH + px) * 4;
        if (patches[from + 3] === 0 || isAsh(patches[from], patches[from + 1], patches[from + 2])) {
          continue;
        }
        const to = ((top + py) * CHUNK_PIXELS + left + px) * 4;
        if (pixels[to + 3] === 0) {
          continue;
        }
        pixels[to] = patches[from];
        pixels[to + 1] = patches[from + 1];
        pixels[to + 2] = patches[from + 2];
      }
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = CHUNK_PIXELS;
  canvas.height = CHUNK_PIXELS;
  canvas.getContext("2d").putImageData(new ImageData(pixels, CHUNK_PIXELS, CHUNK_PIXELS), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  applyGroundFilter(texture);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK, CHUNK),
    new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(chunk.x0 + CHUNK / 2, 0.004, chunk.z0 + CHUNK / 2);
  painter.scene.add(ground);
  chunk.isPainted = true;
}

/* ---------- lava: from the crater down the mountain, across the land in rivers and pools, down the beaches into
   the sea; it glows by day and night ---------- */

/* Lava in pixel art, 64 px square (4 units) and tileable: plates of red-hot crust with bright cracks between them. */
function lavaTexture() {
  const SIZE = 64;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const seeds = [];
  for (let k = 0; k < 9; k++) {
    seeds.push([hash(k, 1.3) * SIZE, hash(k, 7.9) * SIZE]);
  }
  /* distances wrap round the edges, so the tile repeats without a seam */
  const wrapped = (a, b) => Math.min(Math.abs(a - b), SIZE - Math.abs(a - b));
  const colors = ["#8a2a18", "#b8381c", "#d84c20", "#f07a2c", "#ffb040", "#ffe070"];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let first = Infinity;
      let second = Infinity;
      for (const [sx, sy] of seeds) {
        const d = Math.hypot(wrapped(x + 0.5, sx), wrapped(y + 0.5, sy));
        if (d < first) {
          second = first;
          first = d;
        } else if (d < second) {
          second = d;
        }
      }
      const edge = second - first;
      const grain = hash(x * 0.37, y * 0.71);
      let index;
      if (edge < 1.2) {
        index = grain < 0.3 ? 5 : 4;
      } else if (edge < 2.6) {
        index = 3;
      } else {
        /* the plates: darker in their middle, with a speck now and then */
        index = first > 9 ? 0 : first > 6 ? 1 : 2;
        if (grain > 0.94) {
          index = 3;
        }
      }
      ctx.fillStyle = colors[index];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/* The rivers as they are drawn: each runs on until it reaches the coast, and there it falls into the sea. Returns
   the rivers' lines on land and, per mouth, where it pours over and which way. */
function riversToTheSea() {
  const lines = [];
  const mouths = [];
  for (const flow of LAVA_FLOWS) {
    const line = [flow[0]];
    for (let k = 0; k < flow.length - 1; k++) {
      const [ax, az] = flow[k];
      const [bx, bz] = flow[k + 1];
      const length = Math.hypot(bx - ax, bz - az);
      let mouth = null;
      for (let t = 0.2; t <= length; t += 0.2) {
        const x = ax + ((bx - ax) * t) / length;
        const z = az + ((bz - az) * t) / length;
        if (!onEmberLand(x, z, 0)) {
          mouth = { x, z, dirX: (bx - ax) / length, dirZ: (bz - az) / length };
          break;
        }
      }
      if (mouth) {
        line.push([mouth.x, mouth.z]);
        mouths.push(mouth);
        break;
      }
      line.push(flow[k + 1]);
    }
    lines.push(line);
  }
  return { lines, mouths };
}

/* The lava on the ground, drawn on the GPU in the game's pixels: each pixel finds how far it lies from the rivers
   and pools; inside it is molten (plates of crust drifting on it, bright cracks between them, a hot band along the
   banks), just outside a ragged rim of bright yellow. A pixel beyond the coast (looked up in a strip of the coast's
   reach per bearing) is never lava, nor one on the crust of a crossing. */
const LAVA_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const lavaFragment = (segments, pools, crossings) => /* glsl */ `
  uniform float uTime;
  uniform float uWidth;
  uniform float uReach;
  uniform vec2 uCenter;
  uniform sampler2D uShore;
  uniform vec4 uSegments[${segments}];
  uniform vec3 uPools[${pools}];
  uniform vec2 uCrossings[${crossings}];
  uniform vec3 uDark;
  uniform vec3 uRed;
  uniform vec3 uHot;
  uniform vec3 uBright;
  uniform vec3 uWhite;
  varying vec2 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float cellEdge(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float first = 8.0;
    float second = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = 0.5 + 0.35 * sin(t + 6.2831 * hash2(i + g));
        float d = length(g + o - f);
        if (d < first) {
          second = first;
          first = d;
        } else if (d < second) {
          second = d;
        }
      }
    }
    return second - first;
  }
  float segmentDistance(vec2 p, vec4 s) {
    vec2 a = s.xy;
    vec2 ab = s.zw - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - a - ab * t);
  }
  void main() {
    /* one game pixel is a sixteenth of a unit */
    vec2 p = (floor(vWorld * 16.0) + 0.5) / 16.0;
    vec2 rel = p - uCenter;
    float shore = texture2D(uShore, vec2(fract(atan(rel.x, rel.y) / 6.2831853), 0.5)).r;
    if (length(rel) > shore - 0.2) {
      discard;
    }
    float river = 1000.0;
    for (int k = 0; k < ${segments}; k++) {
      river = min(river, segmentDistance(p, uSegments[k]) - uWidth);
    }
    for (int k = 0; k < ${crossings}; k++) {
      if (length(p - uCrossings[k]) < uReach) {
        river = 1000.0;
      }
    }
    float d = river;
    for (int k = 0; k < ${pools}; k++) {
      d = min(d, length(p - uPools[k].xy) - uPools[k].z);
    }
    /* ragged banks */
    d += (noise(p * 1.7) - 0.5) * 0.45;
    if (d > 0.22) {
      discard;
    }
    float t = uTime;
    vec3 color;
    if (d > 0.0) {
      color = hash(p * 7.3) > 0.45 ? uBright : uHot;
    } else {
      float edge = cellEdge(p * 0.55 + vec2(t * 0.05, t * 0.035), t * 0.25);
      float glow = noise(p * 0.8 + t * 0.4);
      color = mix(uDark, uRed, smoothstep(0.2, 0.8, glow));
      if (edge < 0.05) {
        color = hash(p * 3.1 + floor(t * 3.0)) > 0.7 ? uWhite : uBright;
      } else if (edge < 0.13) {
        color = uHot;
      }
      if (d > -0.45) {
        color = mix(color, uHot, 0.7);
      }
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/* the coast's reach per bearing as a strip texture, for the lava shader */
function shoreTexture() {
  const SIZE = 512;
  const data = new Float32Array(SIZE);
  for (let k = 0; k < SIZE; k++) {
    data[k] = emberShore(((k + 0.5) / SIZE) * Math.PI * 2);
  }
  const texture = new THREE.DataTexture(data, SIZE, 1, THREE.RedFormat, THREE.FloatType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/* the lava that moves: the ground's shader, the streams down the mountain, the falls into the sea */
let lavaMaterial = null;
const lavaStreams = [];
/* the streams on the mountain and its crater's glow, which fade with it */
const mountainLava = [];
/* glowing sparks rising from the lava, and ash falling over the isles */
let embers = null;
let ash = null;
/* the lava's light at night (main.js gives every one a warm hole in the haze) */
export const emberLights = [];

function buildLava(scene, random) {
  const { lines, mouths } = riversToTheSea();
  const segments = [];
  for (const line of lines) {
    for (let k = 0; k < line.length - 1; k++) {
      segments.push(new THREE.Vector4(...line[k], ...line[k + 1]));
    }
  }
  lavaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWidth: { value: LAVA_WIDTH },
      uReach: { value: CROSSING_REACH },
      uCenter: { value: new THREE.Vector2(EMBER_ISLES.x, EMBER_ISLES.z) },
      uShore: { value: shoreTexture() },
      uSegments: { value: segments },
      uPools: { value: LAVA_POOLS.map((pool) => new THREE.Vector3(pool.x, pool.z, pool.r)) },
      uCrossings: {
        value: LAVA_CROSSINGS.map((crossing) => new THREE.Vector2(crossing.x, crossing.z)),
      },
      uDark: { value: new THREE.Color(0x7a2416) },
      uRed: { value: new THREE.Color(0xc23a1c) },
      uHot: { value: new THREE.Color(0xf07a2c) },
      uBright: { value: new THREE.Color(0xffc24a) },
      uWhite: { value: new THREE.Color(0xfff0a0) },
    },
    vertexShader: LAVA_VERTEX,
    fragmentShader: lavaFragment(segments.length, LAVA_POOLS.length, LAVA_CROSSINGS.length),
    transparent: true,
  });
  /* only over the lava: a strip along each river and a square round each pool, the shader does the rest */
  const cover = [];
  const pad = LAVA_WIDTH + 0.6;
  for (const segment of segments) {
    const length = Math.hypot(segment.z - segment.x, segment.w - segment.y);
    const plane = new THREE.PlaneGeometry(pad * 2, length + pad * 2).rotateX(-Math.PI / 2);
    plane.rotateY(Math.atan2(segment.z - segment.x, segment.w - segment.y));
    plane.translate((segment.x + segment.z) / 2, 0.038, (segment.y + segment.w) / 2);
    cover.push(plane);
  }
  for (const pool of LAVA_POOLS) {
    const size = (pool.r + 0.8) * 2;
    cover.push(
      new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(pool.x, 0.038, pool.z),
    );
  }
  for (const geometry of cover) {
    /* drawn over the night haze, so it glows in the dark */
    const mesh = new THREE.Mesh(geometry, lavaMaterial);
    mesh.renderOrder = 10002;
    scene.add(mesh);
  }
  buildStreams(scene, mouths);
  /* light: along the rivers, at the pools, at every fall */
  for (const line of lines) {
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, az] = line[k];
      const [bx, bz] = line[k + 1];
      const length = Math.hypot(bx - ax, bz - az);
      for (let t = 2; t < length; t += 7) {
        emberLights.push({
          x: ax + ((bx - ax) * t) / length,
          z: az + ((bz - az) * t) / length,
          y: 0.4,
          radius: 4.5,
          color: [255, 120, 50],
          strength: 0.7,
        });
      }
    }
  }
  for (const pool of LAVA_POOLS) {
    emberLights.push({
      x: pool.x,
      z: pool.z,
      y: 0.4,
      radius: pool.r + 4,
      color: [255, 120, 50],
      strength: 0.8,
    });
  }
  for (const mouth of mouths) {
    emberLights.push({
      x: mouth.x,
      z: mouth.z,
      y: 0.2,
      radius: 4,
      color: [255, 140, 70],
      strength: 0.7,
    });
    addVent(scene, mouth.x + mouth.dirX * 1.4, mouth.z + mouth.dirZ * 1.4, random, {
      size: 1.4,
      y: WATER_Y + 0.3,
      height: 6,
    });
  }
  embers = buildEmbers(scene, lines, random);
  ash = buildAsh(scene);
}

/* Lava as a strip that moves along its length: down the mountain's slopes from the crater, and down the
   beaches into the sea. `points` along the middle, `widths` at each point, `across` the direction across it there. */
function streamGeometry(points, widths, acrossAt) {
  const positions = [];
  const uvs = [];
  let along = 0;
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k];
    const b = points[k + 1];
    const step = a.distanceTo(b);
    const [ax, az] = acrossAt(k);
    const [bx, bz] = acrossAt(k + 1);
    const quad = [
      [a.x - ax * widths[k], a.y, a.z - az * widths[k], 0, along / 4],
      [a.x + ax * widths[k], a.y, a.z + az * widths[k], 0.5, along / 4],
      [b.x - bx * widths[k + 1], b.y, b.z - bz * widths[k + 1], 0, (along + step) / 4],
      [b.x + bx * widths[k + 1], b.y, b.z + bz * widths[k + 1], 0.5, (along + step) / 4],
    ];
    along += step;
    for (const index of [0, 2, 1, 1, 2, 3]) {
      positions.push(quad[index][0], quad[index][1], quad[index][2]);
      uvs.push(quad[index][3], quad[index][4]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

function buildStreams(scene, mouths) {
  const material = (isOnMountain) => {
    const map = lavaTexture();
    const result = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, transparent: true });
    lavaStreams.push(result);
    if (isOnMountain) {
      mountainLava.push(result);
    }
    return result;
  };
  /* down the mountain: from the crater's rim to where each river begins at its foot */
  for (const flow of LAVA_FLOWS) {
    const [startX, startZ] = flow[0];
    const bearing = Math.atan2(startX - MOUNT_KHAROS.x, startZ - MOUNT_KHAROS.z);
    const points = [];
    const widths = [];
    const angles = [];
    const STEPS = 40;
    for (let k = 0; k <= STEPS; k++) {
      const t = 0.97 * (1 - k / STEPS);
      const angle = bearing + 0.07 * Math.sin(t * 11) + 0.03 * Math.sin(t * 29);
      const radius = kharosRadius(angle, t) + 0.3;
      points.push(
        new THREE.Vector3(
          MOUNT_KHAROS.x + Math.sin(angle) * radius,
          -0.4 + KHAROS_HEIGHT * t + 0.25,
          MOUNT_KHAROS.z + Math.cos(angle) * radius,
        ),
      );
      widths.push(0.45 + (1 - t) * 0.9);
      angles.push(angle);
    }
    const across = (k) => [Math.cos(angles[k]), -Math.sin(angles[k])];
    const stream = new THREE.Mesh(streamGeometry(points, widths, across), material(true));
    stream.renderOrder = 10002;
    scene.add(stream);
  }
  /* down the beach into the sea, where each river ends */
  for (const mouth of mouths) {
    const width = LAVA_WIDTH * 0.85;
    const points = [];
    /* down the beach, just above the sand, into the water */
    for (let k = 0; k <= 4; k++) {
      const out = (k / 4) * BEACH_RUN * 0.6;
      const y = Math.max(WATER_Y - 0.05, 0.06 + (WATER_Y * out) / (BEACH_RUN * 0.55));
      points.push(new THREE.Vector3(mouth.x + mouth.dirX * out, y, mouth.z + mouth.dirZ * out));
    }
    const across = () => [-mouth.dirZ, mouth.dirX];
    const fall = new THREE.Mesh(
      streamGeometry(
        points,
        points.map(() => width),
        across,
      ),
      material(false),
    );
    fall.renderOrder = 10002;
    scene.add(fall);
  }
}

/* Sparks: points that rise glowing from the lava and go out. */
function buildEmbers(scene, lines, random) {
  const COUNT = 140;
  const sources = [];
  for (const line of lines) {
    for (let k = 0; k < line.length - 1; k++) {
      sources.push([line[k], line[k + 1]]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffa040,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 10003;
  scene.add(points);
  const sparks = Array.from({ length: COUNT }, () => ({
    age: random() * 3,
    life: 1,
    x: 0,
    z: 0,
    driftX: 0,
  }));
  /* a new spark somewhere over the lava: a river, a pool or the crater */
  const spawn = (spark) => {
    const pick = random();
    if (pick < 0.15) {
      const pool = LAVA_POOLS[Math.floor(random() * LAVA_POOLS.length)];
      const angle = random() * Math.PI * 2;
      spark.x = pool.x + Math.sin(angle) * pool.r * random();
      spark.z = pool.z + Math.cos(angle) * pool.r * random();
      spark.y = 0.1;
    } else if (pick < 0.3) {
      spark.x = MOUNT_KHAROS.x + (random() - 0.5) * CRATER_RADIUS;
      spark.z = MOUNT_KHAROS.z + (random() - 0.5) * CRATER_RADIUS;
      spark.y = KHAROS_HEIGHT - 2;
    } else {
      const [[ax, az], [bx, bz]] = sources[Math.floor(random() * sources.length)];
      const t = random();
      spark.x = ax + (bx - ax) * t + (random() - 0.5) * LAVA_WIDTH;
      spark.z = az + (bz - az) * t + (random() - 0.5) * LAVA_WIDTH;
      spark.y = 0.1;
    }
    spark.age = 0;
    spark.life = 1.5 + random() * 2;
    spark.driftX = (random() - 0.5) * 0.8;
  };
  for (const spark of sparks) {
    spawn(spark);
    spark.age = random() * spark.life;
  }
  return { points, sparks, spawn };
}

/* Ash: grey flakes drifting down round the hero while they are on or near the isles. */
function buildAsh(scene) {
  const COUNT = 220;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xb8b0ac,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;
  scene.add(points);
  const flakes = Array.from({ length: COUNT }, (_, k) => ({
    x: (hash(k, 1.1) - 0.5) * 60,
    y: hash(k, 2.2) * 12,
    z: (hash(k, 3.3) - 0.5) * 60,
    sway: hash(k, 4.4) * 6.28,
  }));
  return { points, flakes };
}

/* the surf: a band of foam all along the coast, in three pieces that breathe out of step */
function buildSurf(scene) {
  const PIECES = 3;
  const SEGMENTS = 120;
  for (let piece = 0; piece < PIECES; piece++) {
    const positions = [];
    for (let k = 0; k < SEGMENTS; k++) {
      const a = ((piece * SEGMENTS + k) / (PIECES * SEGMENTS)) * Math.PI * 2;
      const b = ((piece * SEGMENTS + k + 1) / (PIECES * SEGMENTS)) * Math.PI * 2;
      const at = (angle, out) => {
        const r = emberShore(angle) + out;
        return [
          EMBER_ISLES.x + Math.sin(angle) * r,
          WATER_Y + 0.03,
          EMBER_ISLES.z + Math.cos(angle) * r,
        ];
      };
      /* where the beach runs into the water, and a little beyond */
      const quad = [at(a, 1.2), at(a, 2.6), at(b, 1.2), at(b, 2.6)];
      for (const index of [0, 1, 2, 2, 1, 3]) {
        positions.push(...quad[index]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const band = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xf2f6f8,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(band);
    surf.push(band);
  }
}

/* ---------- the coast: the beach sloping down into the water, with boulders in the surf ---------- */

/* how far out from the shore the beach runs down to the bottom, and how deep */
const BEACH_RUN = 2.4;
const BEACH_FOOT = WATER_Y - 0.6;

function buildCoast(scene, random) {
  const SEGMENTS = 720;
  const positions = [];
  const colors = [];
  const DRY = new THREE.Color(0xa08662);
  const WET = new THREE.Color(0x6e5c46);
  const DEEP = new THREE.Color(0x3a3a3c);
  for (let k = 0; k < SEGMENTS; k++) {
    const a = (k / SEGMENTS) * Math.PI * 2;
    const b = ((k + 1) / SEGMENTS) * Math.PI * 2;
    const point = (angle, out, y) => {
      const r = emberShore(angle) + out;
      return [EMBER_ISLES.x + Math.sin(angle) * r, y, EMBER_ISLES.z + Math.cos(angle) * r];
    };
    /* three bands: dry sand at the top, wet sand at the waterline, dark below it */
    const rows = [
      [0, 0.002, DRY],
      [BEACH_RUN * 0.55, WATER_Y + 0.05, WET],
      [BEACH_RUN, BEACH_FOOT, DEEP],
    ];
    for (let row = 0; row < rows.length - 1; row++) {
      const [outA, yA, colorA] = rows[row];
      const [outB, yB, colorB] = rows[row + 1];
      const quad = [point(a, outA, yA), point(a, outB, yB), point(b, outA, yA), point(b, outB, yB)];
      const quadColors = [colorA, colorB, colorA, colorB];
      for (const index of [0, 1, 2, 2, 1, 3]) {
        positions.push(...quad[index]);
        colors.push(quadColors[index].r, quadColors[index].g, quadColors[index].b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const beach = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  scene.add(beach);
  /* boulders: along the coast in the surf, but not in the cove's mouth where the ship comes in */
  const boulder = builders.material("basalt", 1.2, 1.2, 1.25);
  for (let k = 0; k < 170; k++) {
    const angle = random() * Math.PI * 2;
    const distance = emberShore(angle) + 0.4 + random() * 2.2;
    const x = EMBER_ISLES.x + Math.sin(angle) * distance;
    const z = EMBER_ISLES.z + Math.cos(angle) * distance;
    if (Math.hypot(x - CINDER_COVE.x, z - CINDER_COVE.z) < CINDER_COVE.radius + 4) {
      continue;
    }
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 + random() * random() * 0.8, 0),
      boulder,
    );
    stone.position.set(x, WATER_Y + random() * 0.6, z);
    stone.rotation.set(random() * 3, random() * 3, random() * 3);
    scene.add(stone);
  }
  /* inside the cove only a few small ones, along its sides */
  for (let k = 0; k < 16; k++) {
    const angle = Math.PI * (0.35 + random() * 1.3);
    const x = CINDER_COVE.x + Math.sin(angle) * (CINDER_COVE.radius - 0.6);
    const z = CINDER_COVE.z + Math.cos(angle) * (CINDER_COVE.radius - 0.6);
    if (x > COVE_JETTY.x - 3) {
      continue;
    }
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + random() * 0.4, 0), boulder);
    stone.position.set(x, WATER_Y + random() * 0.3, z);
    stone.rotation.set(random() * 3, random() * 3, random() * 3);
    scene.add(stone);
  }
}

/* ---------- Mount Kharos: a rugged cone of basalt, ridges and gullies down its sides, grey with ash towards the
   top, scorched red where the lava runs down, with a glowing crater ---------- */

function buildKharos(scene, random) {
  const SIDES = 72;
  const RINGS = 18;
  const H = KHAROS_HEIGHT;
  /* the bearings of the lava streams, where the rock is scorched */
  const streamBearings = LAVA_FLOWS.map(([[x, z]]) =>
    Math.atan2(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z),
  );
  /* a point on the slope: the foot exactly as the rules have it, every point above it a little out of true */
  const slopePoint = (side, ring) => {
    const angle = (side / SIDES) * Math.PI * 2;
    const t = ring / RINGS;
    const rough = ring === 0 || ring === RINGS ? 0 : 1;
    const radius = kharosRadius(angle, t) * (1 + (hash(side % SIDES, ring) - 0.5) * 0.09 * rough);
    const y = -0.4 + H * t + (hash(ring, side % SIDES) - 0.5) * 0.9 * rough;
    return [
      MOUNT_KHAROS.x + Math.sin(angle) * radius,
      y,
      MOUNT_KHAROS.z + Math.cos(angle) * radius,
    ];
  };
  const ASH = new THREE.Color(0x857c78);
  const BASALT = new THREE.Color(0x3c3537);
  const DARK = new THREE.Color(0x231e20);
  const SCORCHED = new THREE.Color(0x5e2a1e);
  /* the colour of one facet: darker in the gullies and at the foot, ash grey towards the top, red near the lava */
  const facetColor = (side, ring) => {
    const angle = ((side + 0.5) / SIDES) * Math.PI * 2;
    const t = (ring + 0.5) / RINGS;
    const gully = Math.sin(angle * 13 + t * 6.4);
    const color = BASALT.clone().lerp(DARK, Math.max(0, -gully) * 0.55 + (1 - t) * 0.15);
    color.lerp(ASH, Math.pow(Math.max(0, (t - 0.45) / 0.55), 1.4) * 0.85);
    for (const bearing of streamBearings) {
      const off = Math.abs(Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing)));
      if (off < 0.16 && t < 0.97) {
        color.lerp(SCORCHED, 0.7 * (1 - off / 0.16));
      }
    }
    return color.multiplyScalar(0.88 + hash(side + 0.3, ring + 0.7) * 0.24);
  };
  const positions = [];
  const colors = [];
  const facet = (points, color) => {
    for (const point of points) {
      positions.push(...point);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (let ring = 0; ring < RINGS; ring++) {
    for (let side = 0; side < SIDES; side++) {
      const a = slopePoint(side, ring);
      const b = slopePoint(side + 1, ring);
      const c = slopePoint(side, ring + 1);
      const d = slopePoint(side + 1, ring + 1);
      const color = facetColor(side, ring);
      facet([a, b, c], color);
      facet([b, d, c], color.clone().multiplyScalar(0.94));
    }
  }
  /* the crater: its inner wall down to a glowing floor */
  const rimY = -0.4 + H;
  const RIM = new THREE.Color(0x6e6462);
  const INNER = new THREE.Color(0x6a2a1a);
  for (let side = 0; side < SIDES; side++) {
    const a = (side / SIDES) * Math.PI * 2;
    const b = ((side + 1) / SIDES) * Math.PI * 2;
    const at = (angle, radius, y) => [
      MOUNT_KHAROS.x + Math.sin(angle) * radius,
      y,
      MOUNT_KHAROS.z + Math.cos(angle) * radius,
    ];
    const rimA = at(a, kharosRadius(a, 1), rimY);
    const rimB = at(b, kharosRadius(b, 1), rimY);
    const innerA = at(a, CRATER_RADIUS * 0.6, rimY - 3);
    const innerB = at(b, CRATER_RADIUS * 0.6, rimY - 3);
    facet([rimA, rimB, innerA], RIM);
    facet([rimB, innerB, innerA], INNER);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  mountain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  mountain.castShadow = true;
  scene.add(mountain);
  craterGlow = new THREE.Mesh(
    new THREE.CircleGeometry(CRATER_RADIUS * 0.62, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true }),
  );
  craterGlow.position.set(MOUNT_KHAROS.x, rimY - 2.9, MOUNT_KHAROS.z);
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
}

/* ---------- the jetty: planks on posts from the beach out along the cove's east side ---------- */

function buildJetty(scene, random) {
  const { x, halfWidth, north, south } = COVE_JETTY;
  const length = south - north + 1.5;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, 0.3, length),
    new THREE.MeshLambertMaterial({
      map: builders.texture("wood", halfWidth, length / 2),
      color: new THREE.Color(0.66, 0.68, 0.7),
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
      post.position.set(x + side * (halfWidth + 0.05), -0.9 + random() * 0.15, z);
      scene.add(post);
    }
  }
  /* the Gull's Promise alongside, when a hero has brought her here (sailing.js shows and hides her) */
  coveGull = builders.ship({
    length: HULL.length,
    beam: HULL.beam,
    sail: "cloth_red",
    hullColor: 0x3e4a5a,
  });
  coveGull.position.set(COVE_BERTH.x, WATER_Y, COVE_BERTH.z);
  coveGull.rotation.y = COVE_BERTH.heading;
  scene.add(coveGull);
  /* a click on her: go aboard and take the helm (main.js) */
  const boardHit = new THREE.Mesh(
    new THREE.BoxGeometry(HULL.beam, 4, HULL.length).translate(0, 1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  boardHit.position.set(COVE_BERTH.x, 0, COVE_BERTH.z);
  boardHit.rotation.y = COVE_BERTH.heading;
  boardHit.userData.boardShip = "cinder_cove";
  scene.add(boardHit);
  clickables.push(boardHit);
  coveGull.userData.boardHit = boardHit;
}

/** The Gull's Promise at the jetty in Cinder Cove: shown while she lies there (sailing.js). */
export function setCoveGullVisible(isVisible) {
  if (coveGull) {
    coveGull.visible = isVisible;
    coveGull.userData.boardHit.visible = isVisible;
  }
}

/* ---------- the camp: two tents, a fire, the stores, and the fishing boat that brought Edda ---------- */

function buildCamp({ scene, prop, place, pending, obstacles }) {
  const lantern = (x, z) => pending.push(prop("lantern", x, z, { radius: 0.25 }));
  place(builders.campfire(), ...inCamp(2, 2), { radius: 0.9 });
  /* Edda's tent with her books before it, and the fisherman's */
  place(builders.tent(3.4, 3.4, "cloth_red"), ...inCamp(-5.5, -4.5), {
    rotation: 0.5,
    radius: 1.8,
  });
  place(builders.tent(3, 3.2, "cloth_green"), ...inCamp(8.5, -4), { rotation: -0.4, radius: 1.7 });
  place(builders.writingDesk(), ...inCamp(-2.6, -1.2), { rotation: 0.5, radius: 0.9 });
  /* stores from the boat */
  pending.push(prop("crypt_crates", ...inCamp(5.6, 6.8), { radius: 0.7, scale: 0.9 }));
  pending.push(prop("woodpile", ...inCamp(-1.5, 5.5), { radius: 0.7 }));
  for (const [x, z] of [inCamp(10.4, 1.6), inCamp(11, 2.8), inCamp(9.6, 3)]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  place(builders.chest(), ...inCamp(6.8, -2.2), { rotation: -0.4, radius: 0.5 });
  place(builders.netRack(2.6), ...inCamp(-9.6, 2.4), { rotation: 1.2 });
  place(builders.flag(2.8, "cloth_red"), ...inCamp(4.8, 10.6), { radius: 0.2 });
  lantern(COVE_JETTY.x + 1.6, COVE_JETTY.north + 0.5);
  lantern(...inCamp(-3.4, 2.4));
  lantern(...inCamp(5.2, -5.8));
  /* the fishing boat, drawn up on the beach west of the cove */
  const boat = builders.rowingBoat(4.6, 1.8);
  const [boatX, boatZ] = inCamp(-12.5, 10.5);
  boat.position.set(boatX, 0.05, boatZ);
  boat.rotation.set(0.04, 1.1, 0.12);
  scene.add(boat);
  obstacles.push({ x: boatX, z: boatZ, r: 1.6 });
}

/* ---------- the burnt land: dead trees and bushes, rocks, bones, and little lava mounds that steam ---------- */

/* what stands about on the isles, from the volcano pack: [sprite, how many, scale, collision radius, shadow] */
/* what stands about on the isles, from the volcano pack: [sprite, how many, scale, collision radius, shadow], all
   over the isles */
const SCENERY = [
  [["ember_tree1", "ember_tree2"], 50, 0.75, 0.45, 1.6],
  [["ember_bush1", "ember_bush2"], 130, 0.65, 0, 0.9],
  [["ember_rock1", "ember_rock2", "ember_rock3"], 120, 0.7, 0.3, 0.6],
  [["ember_rock4", "ember_boulder"], 50, 0.75, 0.7, 1.2],
  [["ember_ram_skull", "ember_skull", "ember_ribs"], 30, 0.6, 0, 0.5],
  [["ember_stump"], 24, 0.65, 0.3, 0.6],
];
/* and more of some in each land: Scorchwood's dead forest, the bones and mounds of the Ash Flats, the boulders of
   the Obsidian Steps */
const LAND_SCENERY = {
  scorchwood: [
    [["ember_tree1", "ember_tree2"], 110, 0.8, 0.45, 1.6],
    [["ember_stump"], 30, 0.65, 0.3, 0.6],
    [["ember_bush1", "ember_bush2"], 40, 0.65, 0, 0.9],
  ],
  ashFlats: [
    [["ember_ram_skull", "ember_skull", "ember_ribs"], 26, 0.6, 0, 0.5],
    [["ember_rock1", "ember_rock2", "ember_rock3"], 40, 0.7, 0.3, 0.6],
  ],
  obsidianSteps: [
    [["ember_rock4", "ember_boulder"], 70, 0.85, 0.8, 1.3],
    [["ember_rock1", "ember_rock2", "ember_rock3"], 50, 0.75, 0.3, 0.6],
  ],
};
const MOUNDS = ["ember_mound1", "ember_mound2", "ember_mound3", "ember_mound4"];

function buildScenery({ scene, prop, place, pending, random }) {
  const reach = EMBER_REACH;
  const taken = [];
  const isClear = (x, z, room) =>
    Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) > CINDER_CAMP.radius + 2 &&
    roadDistance(x, z) > 2.5 &&
    lavaDistance(x, z) > 1.2 &&
    taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room + 0.6);
  /* a free spot on the isles (or within a land, or at the mountain's foot): on the land, off the camp, the roads
     and the lava, and not on top of anything else */
  const freeSpot = (room, land = null, isNearMountain = false) => {
    for (let tries = 0; tries < 60; tries++) {
      let x;
      let z;
      if (land) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * land.radius;
        x = land.center[0] + Math.sin(angle) * distance;
        z = land.center[1] + Math.cos(angle) * distance;
      } else {
        x = EMBER_ISLES.x + (random() * 2 - 1) * reach;
        z = EMBER_ISLES.z + (random() * 2 - 1) * reach;
      }
      const isFree =
        inEmberIsles(x, z, 1.5) &&
        (!isNearMountain || outsideKharos(x, z) < 22) &&
        isClear(x, z, room);
      if (isFree) {
        taken.push([x, z, room]);
        return [x, z];
      }
    }
    return null;
  };
  const scatter = (list, land) => {
    for (const [names, count, scale, radius, shadow] of list) {
      for (let k = 0; k < count; k++) {
        const spot = freeSpot(Math.max(radius, 0.5), land);
        if (spot) {
          pending.push(prop(names[k % names.length], spot[0], spot[1], { radius, scale, shadow }));
        }
      }
    }
  };
  /* the sign where the roads leave the camp */
  const sign = inCamp(0, -13);
  taken.push([...sign, 0.4]);
  pending.push(prop("ember_sign", ...sign, { radius: 0.3, scale: 0.55, shadow: 0.6 }));
  buildGate({ scene, place, taken, random });
  buildRuins({ prop, place, pending, taken, random, isClear });
  /* rocks fallen from the mountain, heaped round its foot */
  const FALLEN = ["ember_boulder", "ember_rock4", "ember_rock1", "ember_rock2", "ember_rock3"];
  for (let k = 0; k < 160; k++) {
    const angle = random() * Math.PI * 2;
    const distance = kharosRadius(angle, 0) + 0.4 + random() * random() * 5;
    const x = MOUNT_KHAROS.x + Math.sin(angle) * distance;
    const z = MOUNT_KHAROS.z + Math.cos(angle) * distance;
    if (!onEmberLand(x, z, 2) || !isClear(x, z, 0.4)) {
      continue;
    }
    const name = FALLEN[k % FALLEN.length];
    const isBig = k % FALLEN.length < 2;
    taken.push([x, z, isBig ? 0.8 : 0.4]);
    pending.push(
      prop(name, x, z, { radius: isBig ? 0.7 : 0.3, scale: 0.7 + random() * 0.25, shadow: 1 }),
    );
  }
  /* the lava mounds, at the mountain's foot and out on the Ash Flats: each smokes */
  const mound = (spot, k) => {
    if (!spot) {
      return;
    }
    const [x, z] = spot;
    pending.push(prop(MOUNDS[k % MOUNDS.length], x, z, { radius: 1.1, scale: 0.7, shadow: 1.8 }));
    addVent(scene, x, z + 0.1, random);
  };
  for (let k = 0; k < 16; k++) {
    mound(freeSpot(1.6, null, true), k);
  }
  for (let k = 0; k < 10; k++) {
    mound(freeSpot(1.6, EMBER_LANDS.ashFlats), k);
  }
  for (const [key, list] of Object.entries(LAND_SCENERY)) {
    scatter(list, EMBER_LANDS[key]);
  }
  scatter(SCENERY, null);
}

/* The Gate of Kharos in the mountain's north foot, facing away from it, with fire baskets either side. */
function buildGate({ scene, place, taken, random }) {
  const [x, z] = EMBER_LANDS.gate.center;
  const bearing = Math.atan2(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z);
  /* set into the slope: its back against the mountain */
  const into = kharosRadius(bearing, 0) - 1.2;
  const gateX = MOUNT_KHAROS.x + Math.sin(bearing) * into;
  const gateZ = MOUNT_KHAROS.z + Math.cos(bearing) * into;
  place(builders.kharosGate(), gateX, gateZ, { rotation: bearing });
  taken.push([gateX, gateZ, 5]);
  for (const side of [-1, 1]) {
    const bx = gateX + Math.cos(bearing) * side * 5.6 + Math.sin(bearing) * 2.4;
    const bz = gateZ - Math.sin(bearing) * side * 5.6 + Math.cos(bearing) * 2.4;
    place(builders.brazier(), bx, bz, { radius: 0.5 });
    taken.push([bx, bz, 1]);
    emberLights.push({ x: bx, z: bz, y: 1.2, radius: 4, color: [255, 150, 70], strength: 0.85 });
    addVent(scene, bx, bz, random, { size: 0.35, y: 1.4, height: 2.5 });
  }
}

/* The Fallen Watch: what is left of the old mages' outpost, two broken towers, walls, standing stones in a ring
   and the rubble of their halls. */
function buildRuins({ prop, place, pending, taken, random, isClear }) {
  const [cx, cz] = EMBER_LANDS.fallenWatch.center;
  const near = (dx, dz) => [cx + dx, cz + dz];
  const stand = (group, [x, z], rotation, room) => {
    if (inEmberIsles(x, z, 1) && isClear(x, z, room)) {
      place(group, x, z, { rotation, radius: room });
      taken.push([x, z, room]);
    }
  };
  stand(builders.tower(1.9, 3.4, { hasRoof: false }), near(-9, 6), 0, 2.2);
  stand(builders.tower(1.6, 2.2, { hasRoof: false }), near(10, 5), 0.6, 1.9);
  for (const [dx, dz, turn] of [
    [-4, 9, 0],
    [3, 10, 0.1],
    [12, -1, Math.PI / 2],
    [-12, -1, Math.PI / 2 + 0.1],
  ]) {
    stand(builders.wall(4 + random() * 2, 1.4 + random() * 1.4, 1), near(dx, dz), turn, 1.5);
  }
  /* the ring of standing stones where the watch kept its fire */
  for (let k = 0; k < 7; k++) {
    const angle = (k / 7) * Math.PI * 2;
    stand(
      builders.menhir(1.6 + random() * 1.2),
      near(Math.sin(angle) * 6, Math.cos(angle) * 6 - 2),
      -angle,
      0.6,
    );
  }
  for (const [name, dx, dz, scale] of [
    ["crypt_ruin", -6, -8, 0.9],
    ["crypt_arch", 6, -9, 0.9],
    ["crypt_tombs", 0, 13, 0.8],
    ["crypt_bones", -14, 8, 0.8],
    ["crypt_skulls", 14, 10, 0.7],
  ]) {
    const [x, z] = near(dx, dz);
    if (inEmberIsles(x, z, 1) && isClear(x, z, 1)) {
      taken.push([x, z, 1]);
      pending.push(prop(name, x, z, { radius: 0.8, scale, shadow: 1.2 }));
    }
  }
}

/* a thread of steam rising from (x, z): `size` the puffs, from height `y`, rising `height` */
function addVent(scene, x, z, random, { size = 0.6, y = 0.9, height = 4 } = {}) {
  const vent = { x, z, y, height, puffs: [] };
  for (let p = 0; p < 4; p++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 6),
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

/* the sparks rise, drift and go out; a spent one starts again somewhere over the lava */
function updateSparks(dt) {
  const positions = embers.points.geometry.attributes.position;
  embers.sparks.forEach((spark, k) => {
    spark.age += dt;
    if (spark.age > spark.life) {
      embers.spawn(spark);
    }
    const share = spark.age / spark.life;
    positions.setXYZ(
      k,
      spark.x + spark.driftX * share,
      spark.y + share * 3.2,
      spark.z + Math.sin(spark.age * 3 + k) * 0.15,
    );
  });
  positions.needsUpdate = true;
  /* they flicker together, a little */
  embers.points.material.opacity = 0.75 + 0.2 * Math.sin(performance.now() * 0.013);
}

/* the ash falls slowly round the hero while they are anywhere near the isles, and nowhere else */
function updateAsh(dt, time) {
  const isNear = Math.hypot(player.x - EMBER_ISLES.x, player.z - EMBER_ISLES.z) < EMBER_REACH + 30;
  ash.points.visible = isNear;
  if (!isNear) {
    return;
  }
  const positions = ash.points.geometry.attributes.position;
  ash.flakes.forEach((flake, k) => {
    flake.y -= dt * 0.7;
    if (flake.y < 0) {
      flake.y += 12;
    }
    const x = flake.x + Math.sin(time * 0.6 + flake.sway) * 0.8 + time * 0.4;
    /* the flakes keep round the hero: wrapped into a 60-unit square about them */
    const wrap = (value, centre) => centre + ((((value - centre + 30) % 60) + 60) % 60) - 30;
    positions.setXYZ(k, wrap(x, player.x), flake.y, wrap(flake.z, player.z));
  });
  positions.needsUpdate = true;
}

/* How high Mount Kharos stands at (x, z): 0 off it. */
function kharosHeightAt(x, z) {
  const foot = MOUNT_KHAROS.radius;
  const r = Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z);
  if (r >= foot) {
    return 0;
  }
  /* the inverse of the slope's radius (radius × (1 − t)^1.25), near enough */
  return KHAROS_HEIGHT * (1 - Math.pow(Math.max(r - CRATER_RADIUS * 0.5, 0) / foot, 0.8));
}

/* Is the hero hidden behind the mountain? Walk from them towards the camera, rising as the line of sight does, and
   see whether the slope stands above that line anywhere. */
function isBehindMountain() {
  const { yaw, tilt } = cameraState;
  const rise = Math.tan(tilt);
  for (let s = 1; s < 70; s += 1.5) {
    const x = player.x + Math.sin(yaw) * s;
    const z = player.z + Math.cos(yaw) * s;
    if (kharosHeightAt(x, z) > s * rise + 0.6) {
      return true;
    }
  }
  return false;
}

/* the mountain turns see-through while the hero is behind it, and solid again when they come out */
function updateMountainFade(dt) {
  const goal = isBehindMountain() ? 0.3 : 1;
  const material = mountain.material;
  material.opacity += (goal - material.opacity) * Math.min(1, dt * 6);
  const isSolid = material.opacity > 0.98;
  if (isSolid) {
    material.opacity = 1;
  }
  for (const lava of [...mountainLava, craterGlow.material]) {
    lava.opacity = material.opacity;
  }
  if (material.transparent === isSolid) {
    material.transparent = !isSolid;
    material.depthWrite = isSolid;
    material.needsUpdate = true;
  }
}

/** Per frame: the mountain smokes, its crater flickers, the vents steam and the ship at the jetty rides the swell. */
export function updateEmberIsles(dt, time) {
  if (!craterGlow) {
    return;
  }
  for (const puff of volcanoSmoke) {
    const t = (time * 0.04 + puff.userData.phase) % 1;
    puff.position.set(MOUNT_KHAROS.x + t * 18, KHAROS_HEIGHT + 2 + t * 22, MOUNT_KHAROS.z + t * 6);
    puff.scale.setScalar(1 + t * 2.5);
    puff.material.opacity = 0.5 * (1 - t);
  }
  craterGlow.material.color.setRGB(
    1,
    0.36 + 0.08 * Math.sin(time * 2.3),
    0.1,
    THREE.SRGBColorSpace,
  );
  /* the lava creeps; the streams run down the mountain and down the beaches into the sea */
  lavaMaterial.uniforms.uTime.value = time;
  for (const stream of lavaStreams) {
    stream.map.offset.set(0, (-time * 0.25) % 1);
  }
  for (const vent of steamVents) {
    for (const puff of vent.puffs) {
      const t = (time * 0.18 + puff.userData.phase) % 1;
      puff.position.set(vent.x + t * 1.2, vent.y + t * vent.height, vent.z);
      puff.scale.setScalar(0.5 + t * 1.6);
      puff.material.opacity = 0.4 * (1 - t);
    }
  }
  paintGround();
  updateSparks(dt);
  updateMountainFade(dt);
  updateAsh(dt, time);
  for (let k = 0; k < surf.length; k++) {
    surf[k].material.opacity = 0.18 + 0.12 * Math.sin(time * 1.2 + k * 1.7);
  }
  if (coveGull.visible) {
    const wave = time * 1.1 + 3.7;
    coveGull.position.y = WATER_Y + Math.sin(wave) * 0.07;
    coveGull.rotation.set(Math.sin(wave * 0.8) * 0.02, COVE_BERTH.heading, Math.sin(wave) * 0.03);
  }
}
