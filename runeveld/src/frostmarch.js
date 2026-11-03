/* Eldoria – the Frostmarch as the players see it (the rules are in rules/frostmarch.js): snow over the whole shore,
   blue in its hollows and glittering on its rises, trodden grey along the ways; a beach of dark shingle under a
   dusting of snow; the bay before Rimeholt frozen hard, cracked and patched with snow, with the fishers' holes
   black in it. Rimeholt itself: timber houses under roofs of snow, the ones by the bay on stilts over the ice, a
   longhouse behind the fire, racks of drying fish, sledges, boats frozen in. The jetty at the ice's edge, the Gull's
   Promise alongside once a hero has brought her. Snowy pines thicken towards the ridge of rock that closes the shore
   off to the north; the pass through it lies under a drift. Out at sea the floes ride the swell, and snow falls
   over all of it. */
import * as THREE from "three";
import { addToCell } from "./culling.js";
import * as builders from "./builders.js";
import {
  FROSTMARCH,
  frostCoast,
  SHORE,
  ridgeZ,
  PASS,
  RIME_BAY,
  ICE_HOLES,
  ICE_HOLE_RADIUS,
  RIME_JETTY,
  RIME_BERTH,
  RIMEHOLT,
  RIME_FIRE,
  RIME_HOUSES,
  rimePathDistance,
  inIceHole,
  inFrostmarch,
  FLOES,
  RIDGE_DEPTH,
  PASS_CUT,
  WHITE_WASTE,
  glacierZ,
  GLACIER_DIG,
  SHELTER,
  UNBOUND_CAMP,
  CAMP_BRAZIERS,
  TROLL_HOLLOW,
  HRIMGAR_HOME,
  onStillwater,
  LOST_BOW,
  KARI_HOLLOW,
  WARM_FIRES,
  WARM_REACH,
  inWhiteWaste,
  warmthDistance,
} from "./rules/frostmarch.js";
import { whiteoutStrength } from "./rules/weather.js";
import * as UI from "./ui.js";
import { HULL } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { applyGroundFilter, addShadowCatcher, scene, cameraState } from "./world.js";
import { clickables, player } from "./game-state.js";
import { IS_PHONE } from "./sprites.js";

const state = {
  gull: null,
  surf: null,
  floes: null,
  snow: null,
};

/** Builds the Frostmarch (world.js calls this with its build context). */
export function buildFrostmarch({ prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(1717);
  prepareGround();
  buildCoast();
  buildBayIce();
  buildJetty(obstacles);
  buildVillage({ prop, place, pending, random, obstacles });
  buildRidge(random, obstacles);
  buildScenery({ prop, pending, random });
  buildWaste({ prop, place, pending, random, obstacles });
  buildFloes(random);
  buildSnowfall();
  buildOverlays();
}

/* ---------- the ground: snow, trodden ways, shingle, the bay's ice; painted pixel by pixel, sixteen to a unit ---------- */

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

const PX = 16;
const CELL = 4;
const CHUNK = 48;
const CHUNK_PIXELS = CHUNK * PX;
const CELLS = CHUNK_PIXELS / CELL;
const CELL_UNITS = CELL / PX;
/* painted chunk by chunk while a hero is this near, a few rows a frame; a chunk this far behind is let go again, so
   the long shore never holds all its pixels at once */
const PAINT_REACH = 130;
const FORGET_REACH = 190;
const PAINT_BUDGET = IS_PHONE ? 4 : 7;
const URGENT_BUDGET = IS_PHONE ? 20 : 30;
/* the painted part: the shore and the bay */
const PAINTED = { x0: WHITE_WASTE.west - 12, x1: WHITE_WASTE.east + 12, z0: -1868, z1: -1480 };

const SNOW_LIGHT = [247, 250, 253];
const SNOW_SHADOW = [206, 221, 238];
const PACKED = [
  [192, 201, 212],
  [176, 186, 199],
  [208, 214, 222],
  [150, 140, 128],
];
const SHINGLE = [
  [128, 136, 150],
  [150, 158, 170],
  [172, 178, 188],
  [108, 116, 130],
];
const ICE_LIGHT = [200, 228, 242];
const ICE_DARK = [150, 196, 222];

let painter = null;

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/* how far inside the bay's oval (x, z) lies, as a share: below 1 inside it */
const bayShare = (x, z) =>
  ((x - RIME_BAY.x) / RIME_BAY.rx) ** 2 + ((z - RIME_BAY.z) / RIME_BAY.rz) ** 2;

/* the land's outline (its coast plus `grow`), as a flat shape (y towards -z once laid) */
function landShape(grow) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 720; k++) {
    const angle = (k / 720) * Math.PI * 2;
    const r = frostCoast(angle) + grow;
    const point = [Math.sin(angle) * r, -Math.cos(angle) * r];
    if (k === 0) {
      shape.moveTo(...point);
    } else {
      shape.lineTo(...point);
    }
  }
  return shape;
}

function prepareGround() {
  const chunks = [];
  for (let z0 = PAINTED.z0; z0 < PAINTED.z1; z0 += CHUNK) {
    for (let x0 = PAINTED.x0; x0 < PAINTED.x1; x0 += CHUNK) {
      chunks.push({ x0, z0, mesh: null });
    }
  }
  painter = { chunks, job: null };
  addShadowCatcher(
    PAINTED.x1 - PAINTED.x0,
    PAINTED.z1 - PAINTED.z0,
    (PAINTED.x0 + PAINTED.x1) / 2,
    0.029,
    (PAINTED.z0 + PAINTED.z1) / 2,
  );
  /* under the chunks a plain floor of snow in the land's shape, so an unpainted chunk is no hole, and the land
     beyond the ridge is snow as far as the eye goes */
  const color = (rgb) =>
    new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(landShape(0)).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: color([232, 240, 247]) }),
  );
  floor.position.set(FROSTMARCH.x, 0.001, FROSTMARCH.z);
  scene.add(floor);
}

/* what lies at (x, z): null for open water, else {kind, ...} */
function groundAt(x, z) {
  if (bayShare(x, z) < 1) {
    if (inIceHole(x, z)) {
      return { kind: "hole" };
    }
    if (inIceHole(x, z, 0.35)) {
      return { kind: "rim" };
    }
    return { kind: "ice", edge: bayShare(x, z) > 0.86 };
  }
  if (onStillwater(x, z)) {
    return { kind: "ice", edge: !onStillwater(x, z, -2.2) };
  }
  const dx = x - FROSTMARCH.x;
  const dz = z - FROSTMARCH.z;
  const inland = frostCoast(Math.atan2(dx, dz)) - Math.hypot(dx, dz);
  if (inland < 0) {
    return null;
  }
  /* the foot of the glacier: old blue ice under a crust of snow */
  if (z < glacierZ(x) + 5 + noise(x * 0.3, z * 0.3) * 2) {
    return { kind: "glacier" };
  }
  /* where the trolls and the Unbound live, the snow is trampled grey */
  const ragged = noise(x * 0.25, z * 0.25) * 5;
  if (
    Math.hypot(x - TROLL_HOLLOW.x, z - TROLL_HOLLOW.z) < TROLL_HOLLOW.radius - 5 + ragged ||
    Math.hypot(x - UNBOUND_CAMP.x, z - UNBOUND_CAMP.z) < UNBOUND_CAMP.radius - 5 + ragged
  ) {
    return { kind: "trampled" };
  }
  const wobble = noise(x * 0.2, z * 0.2);
  if (inland < 1.3 + wobble * 1.6) {
    return { kind: "shingle" };
  }
  /* near the ways every pixel looks for itself, so their edges run ragged instead of in steps */
  return { kind: "snow", nearPath: rimePathDistance(x, z) < 2.4, nearRidge: z < ridgeZ(x) + 6 };
}

/* the colour of one pixel of the ground: [r, g, b] */
function pixelColor(ground, gx, gy) {
  const wx = gx / PX;
  const wz = gy / PX;
  const speck = hash(gx * 0.37, gy * 0.71);
  switch (ground.kind) {
    case "hole": {
      /* black water, a little lighter where it moves in the middle */
      const depth = noise(wx * 4, wz * 4);
      return depth > 0.7 ? [44, 74, 104] : [22, 40, 62];
    }
    case "glacier": {
      /* pale old ice, crevasses of deep blue running through it, snow lying in the hollows */
      if (noise(wx * 0.4, wz * 0.4) > 0.6) {
        return snowPixel(wx, wz, speck, 0.3);
      }
      const crevasse = Math.abs(noise(wx * 0.35 + 3, wz * 0.9) - 0.5);
      if (crevasse < 0.02) {
        return [70, 120, 170];
      }
      return mix([176, 214, 236], [222, 240, 250], noise(wx * 0.6, wz * 0.6) * 0.8 + speck * 0.2);
    }
    case "trampled": {
      /* snow trodden flat and grey, with grit, scraps and dark melt here and there */
      if (speck < 0.03) {
        return PACKED[3];
      }
      if (noise(wx * 0.5, wz * 0.5) > 0.68) {
        return [138, 136, 140];
      }
      return noise(wx * 1.2, wz * 1.2) > 0.45 ? PACKED[1] : PACKED[0];
    }
    case "rim":
      /* chipped ice, heaped round the hole */
      return speck < 0.5 ? [236, 245, 252] : [212, 230, 244];
    case "ice": {
      /* clear ice in slow patches of lighter and darker, cracks running through it, and snow blown over it */
      const drift = noise(wx * 0.14, wz * 0.14);
      if (drift > 0.66 && !ground.edge) {
        return snowPixel(wx, wz, speck, 0.6);
      }
      let color = mix(ICE_DARK, ICE_LIGHT, noise(wx * 0.3, wz * 0.3) * 0.7 + speck * 0.15);
      const crack = Math.abs(noise(wx * 0.55, wz * 0.55) - 0.5);
      if (crack < 0.012 || Math.abs(noise(wx * 1.3 + 7, wz * 1.3) - 0.5) < 0.008) {
        color = [118, 160, 192];
      } else if (crack < 0.03) {
        color = mix(color, [238, 246, 252], 0.6);
      }
      if (speck < 0.01) {
        color = [250, 252, 255];
      }
      return ground.edge ? mix(color, [236, 244, 250], 0.35) : color;
    }
    case "shingle": {
      /* pebbles three pixels across, each its own colour, darker at their edges; snow lies over most of them */
      if (noise(wx * 1.3, wz * 1.3) > 0.42) {
        return snowPixel(wx, wz, speck, 0.4);
      }
      const pebble = hash(Math.floor(gx / 3) * 1.3, Math.floor(gy / 3) * 0.7);
      const color = SHINGLE[Math.min(3, Math.floor(pebble * 4))];
      const isEdge = gx % 3 === 0 || gy % 3 === 0;
      return isEdge ? [color[0] * 0.8, color[1] * 0.8, color[2] * 0.82] : color;
    }
    default: {
      if (ground.nearPath) {
        const trodden = rimePathDistance(wx, wz);
        if (trodden < 0.8 + noise(wx * 1.1, wz * 1.1) * 0.5) {
          /* packed snow, grey-blue, with grit and the dents of boots in it */
          if (speck < 0.04) {
            return PACKED[3];
          }
          const boot = hash(Math.floor(wx * 2.5), Math.floor(wz * 2.5)) < 0.2;
          return boot ? PACKED[1] : noise(wx * 1.6, wz * 1.6) > 0.5 ? PACKED[0] : PACKED[2];
        }
      }
      return snowPixel(wx, wz, speck, ground.nearRidge ? 0.25 : 0);
    }
  }
}

/* snow: wind-shaped drifts, blue in their hollows, ribbed by the wind, and glittering here and there; `shade` darkens
   it towards blue (snow over ice, under the ridge) */
function snowPixel(wx, wz, speck, shade) {
  const drift = noise(wx * 0.1, wz * 0.1) * 0.55 + noise(wx * 0.45, wz * 0.45) * 0.3;
  const rib =
    Math.sin((wx * 0.8 + wz * 0.3 + noise(wx * 0.2, wz * 0.2) * 6) * 2.2) > 0.86 ? 0.12 : 0;
  const t = Math.min(1, Math.max(0, 1 - drift - rib + shade * 0.4));
  let color = mix(SNOW_LIGHT, SNOW_SHADOW, t * 0.8);
  if (speck < 0.005) {
    color = [255, 255, 255];
  } else if (speck < 0.011) {
    color = [184, 204, 228];
  }
  return color;
}

function paintGround() {
  if (!painter) {
    return;
  }
  /* let go of chunks the hero has left far behind */
  for (const chunk of painter.chunks) {
    if (chunk.mesh && chunkDistance(chunk) > FORGET_REACH) {
      chunk.mesh.parent.remove(chunk.mesh);
      chunk.mesh.material.map.dispose();
      chunk.mesh.material.dispose();
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
  }
  const started = performance.now();
  const underfoot = painter.chunks.some(
    (chunk) =>
      !chunk.mesh &&
      player.x >= chunk.x0 - 8 &&
      player.x < chunk.x0 + CHUNK + 8 &&
      player.z >= chunk.z0 - 8 &&
      player.z < chunk.z0 + CHUNK + 8,
  );
  const budget = underfoot ? URGENT_BUDGET : PAINT_BUDGET;
  while (performance.now() - started < budget) {
    if (!painter.job) {
      const chunk = painter.chunks
        .filter((candidate) => !candidate.mesh && chunkDistance(candidate) < PAINT_REACH)
        .sort((a, b) => chunkDistance(a) - chunkDistance(b))[0];
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

/* how far the hero is from a chunk's middle */
const chunkDistance = (chunk) =>
  Math.hypot(chunk.x0 + CHUNK / 2 - player.x, chunk.z0 + CHUNK / 2 - player.z);

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
  chunk.mesh = mesh;
}

/* ---------- the coast: the land's snowy flank down into the sea, and the surf along it ---------- */

function buildCoast() {
  /* a slab in the land's shape under the ground, its rounded edge showing only where the land meets the sea */
  const depth = 1.6;
  const bevel = 0.8;
  const geometry = new THREE.ExtrudeGeometry(landShape(0.3), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel * 0.4,
    bevelSize: bevel,
    bevelSegments: 2,
  }).rotateX(-Math.PI / 2);
  const flank = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: 0xdde8f0, flatShading: true }),
  );
  flank.position.set(FROSTMARCH.x, -depth - bevel * 0.4 - 0.02, FROSTMARCH.z);
  scene.add(flank);
  /* the surf: a band of foam along the south coast, finely enough to follow every cape (the sea's own surf ring
     has too few points for a coast this long) */
  const shape = new THREE.Shape();
  const arc = [];
  for (let k = 0; k <= 400; k++) {
    arc.push(-1.15 + (k / 400) * 2.3);
  }
  const at = (angle, grow) => {
    const r = frostCoast(angle) + grow;
    return [Math.sin(angle) * r, -Math.cos(angle) * r];
  };
  arc.forEach((angle, k) =>
    k ? shape.lineTo(...at(angle, 2.8)) : shape.moveTo(...at(angle, 2.8)),
  );
  for (let k = arc.length - 1; k >= 0; k--) {
    shape.lineTo(...at(arc[k], 1));
  }
  const surf = new THREE.Mesh(
    new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xf2f6f8,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  surf.position.set(FROSTMARCH.x, WATER_Y + 0.02, FROSTMARCH.z);
  scene.add(surf);
  state.surf = surf;
}

/* ---------- the bay: a sheet of ice over the water, its edge standing a little out of the sea ---------- */

function buildBayIce() {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, RIME_BAY.rx, RIME_BAY.rz, 0, Math.PI * 2, false, 0);
  const depth = 1.25;
  const sheet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.35,
      bevelSegments: 1,
      curveSegments: 72,
    }).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xcfe6f3, flatShading: true }),
  );
  sheet.position.set(RIME_BAY.x, -depth - 0.17, RIME_BAY.z);
  scene.add(sheet);
  /* the holes: a ring of chipped ice round each, a little proud of the sheet, and a fisher's stool and bucket by
     some */
  const chips = new THREE.MeshLambertMaterial({ color: 0xeef6fc, flatShading: true });
  for (const [x, z] of ICE_HOLES) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ICE_HOLE_RADIUS + 0.12, 0.14, 4, 14).rotateX(Math.PI / 2),
      chips,
    );
    ring.position.set(x, 0.03, z);
    ring.scale.y = 0.5;
    scene.add(ring);
  }
}

/* ---------- the jetty at the ice's edge, and the Gull's Promise beside it ---------- */

function buildJetty(obstacles) {
  const { x, halfWidth, north, south } = RIME_JETTY;
  const length = south - north + 1.5;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, 0.3, length),
    new THREE.MeshLambertMaterial({
      map: builders.texture("wood", halfWidth, length / 2),
      color: new THREE.Color(0.66, 0.72, 0.8),
    }),
  );
  deck.position.set(x, -0.13, (north + south) / 2 - 0.75);
  scene.add(deck);
  /* snow along the planks' edges */
  const snow = new THREE.MeshLambertMaterial({ color: 0xf2f7fb });
  for (const side of [-1, 1]) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, length - 0.6), snow);
    ridge.position.set(x + side * (halfWidth - 0.25), 0.05, (north + south) / 2 - 0.75);
    scene.add(ridge);
  }
  for (let z = north + 2.5; z <= south; z += 2.5) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 2.4, 6),
        builders.material("wood_dark", 0.4, 2.4),
      );
      post.position.set(x + side * (halfWidth + 0.05), -0.9, z);
      scene.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.12, 6), snow);
      cap.position.set(x + side * (halfWidth + 0.05), 0.35, z);
      scene.add(cap);
    }
  }
  /* the Gull's Promise alongside, when a hero has brought her here (sailing.js shows and hides her) */
  const gull = builders.ship({
    length: HULL.length,
    beam: HULL.beam,
    sail: "cloth_red",
    hullColor: 0x3e4a5a,
  });
  gull.position.set(RIME_BERTH.x, WATER_Y, RIME_BERTH.z);
  gull.rotation.y = RIME_BERTH.heading;
  scene.add(gull);
  const boardHit = new THREE.Mesh(
    new THREE.BoxGeometry(HULL.beam, 4, HULL.length).translate(0, 1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  boardHit.position.set(RIME_BERTH.x, 0, RIME_BERTH.z);
  boardHit.rotation.y = RIME_BERTH.heading;
  boardHit.userData.boardShip = "rimeholt";
  scene.add(boardHit);
  clickables.push(boardHit);
  gull.userData.boardHit = boardHit;
  state.gull = gull;
  obstacles.push({ x, z: south + 0.4, r: 0.3 });
}

/** The Gull's Promise at the jetty of Rimeholt: shown while she lies there (sailing.js). */
export function setRimeGullVisible(isVisible) {
  if (state.gull) {
    state.gull.visible = isVisible;
    state.gull.userData.boardHit.visible = isVisible;
  }
}

/* ---------- Rimeholt ---------- */

/* snow on a roof, in the game's pixels: drifts lying in layers down the slope, blue in their shadows, a glint here
   and there; two units square, repeated */
let roofSnowTexture = null;
function roofSnow() {
  if (!roofSnowTexture) {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const speck = hash(x * 0.37 + 11, y * 0.71);
        const layer = (y + Math.round(Math.sin(x * 0.4) * 1.5)) % 8;
        let color =
          layer === 7 ? SNOW_SHADOW : layer === 6 ? mix(SNOW_SHADOW, SNOW_LIGHT, 0.5) : SNOW_LIGHT;
        color = mix(color, SNOW_SHADOW, noise(x * 0.2, y * 0.2) * 0.25);
        if (speck < 0.02) {
          color = [255, 255, 255];
        } else if (speck < 0.05) {
          color = [214, 226, 240];
        }
        const k = (y * size + x) * 4;
        image.data.set([...color.map(Math.round), 255], k);
      }
    }
    ctx.putImageData(image, 0, 0);
    roofSnowTexture = new THREE.CanvasTexture(canvas);
    roofSnowTexture.colorSpace = THREE.SRGBColorSpace;
    roofSnowTexture.wrapS = roofSnowTexture.wrapT = THREE.RepeatWrapping;
    roofSnowTexture.magFilter = THREE.NearestFilter;
    roofSnowTexture.minFilter = THREE.NearestFilter;
  }
  return roofSnowTexture;
}

/* a slope of snow, `w` by `length` units; the back slope of a roof is a little darker, like every other roof */
function snowSlope(w, length, tint) {
  const map = roofSnow().clone();
  map.needsUpdate = true;
  map.repeat.set(w / 2, length / 2);
  return new THREE.MeshLambertMaterial({
    map,
    color: new THREE.Color(tint, tint, tint),
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}
const ICICLE = new THREE.MeshLambertMaterial({ color: 0xcfe9ff, emissive: 0x1a3550 });

/* a timber house under a roof of snow, with icicles along its eaves; on stilts, raised over the ice */
function rimeHouse({ w, d, stilts, longhouse }, random) {
  const h = longhouse ? 3 : 2.5;
  const roofHeight = longhouse ? 2.8 : 2;
  const house = builders.house({
    w,
    d,
    h,
    roofHeight,
    wallTexture: "wood",
    windows: longhouse ? 3 : 1,
  });
  /* the roof's two slopes: snow (builders.house makes them as the only planes, the front one first) */
  let slopes = 0;
  house.traverse((part) => {
    if (part.isMesh && part.geometry.type === "PlaneGeometry") {
      const { width, height } = part.geometry.parameters;
      part.material = snowSlope(width, height, slopes++ === 0 ? 1 : 0.86);
    }
  });
  const span = d / 2 + 0.45;
  const icicles = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.06, 1, 5).rotateX(Math.PI).translate(0, -0.5, 0),
    ICICLE,
    Math.ceil(w * 2.4) * 2,
  );
  const spot = new THREE.Object3D();
  let count = 0;
  for (const side of [-1, 1]) {
    for (let k = 0; k < Math.ceil(w * 2.4); k++) {
      spot.position.set(
        -w / 2 - 0.3 + (k + 0.5) * ((w + 0.6) / Math.ceil(w * 2.4)),
        h - 0.1,
        side * span,
      );
      spot.scale.set(1, 0.15 + random() * 0.45, 1);
      spot.updateMatrix();
      icicles.setMatrixAt(count++, spot.matrix);
    }
  }
  house.add(icicles);
  if (!stilts) {
    return house;
  }
  /* raised on posts over the ice, with steps up to the door */
  const group = new THREE.Group();
  const lift = 1.1;
  house.position.y = lift;
  group.add(house);
  const wood = builders.material("wood_dark", 0.3, lift);
  for (const sx of [-1, 0, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, lift + 0.3, 6), wood);
      post.position.set(sx * (w / 2 - 0.2), (lift + 0.3) / 2 - 0.3, sz * (d / 2 - 0.2));
      group.add(post);
    }
  }
  const steps = new THREE.MeshLambertMaterial({ map: builders.texture("wood", 0.5, 0.5) });
  for (let k = 0; k < 3; k++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.38), steps);
    step.position.set(-w / 2 + 1.3, (k + 1) * (lift / 3.2), d / 2 + 0.95 - k * 0.36);
    group.add(step);
  }
  return group;
}

/* a rack of fish hung up to dry in the frost */
function fishRack(random) {
  const group = new THREE.Group();
  const wood = builders.material("wood_dark", 0.2, 1.8);
  for (const x of [-1.2, 1.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14).translate(0, 0.95, 0), wood);
    post.position.x = x;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.12), wood);
  bar.position.y = 1.8;
  group.add(bar);
  const fish = new THREE.MeshLambertMaterial({ color: 0x8a9aa6 });
  for (let k = 0; k < 7; k++) {
    const one = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.62, 4).rotateX(Math.PI), fish);
    one.position.set(-1 + k * 0.33, 1.42 - random() * 0.06, 0);
    group.add(one);
  }
  return group;
}

/* a sledge, its runners curled up in front */
function sledge() {
  const group = new THREE.Group();
  const wood = builders.material("wood", 1, 1);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 2.2), wood);
  bed.position.y = 0.42;
  group.add(bed);
  const dark = builders.material("wood_dark", 0.2, 2);
  for (const x of [-0.45, 0.45]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.4), dark);
    runner.position.set(x, 0.06, 0);
    group.add(runner);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 8, Math.PI), dark);
    curl.rotation.y = Math.PI / 2;
    curl.position.set(x, 0.28, -1.2);
    group.add(curl);
    for (const z of [-0.7, 0, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.07), dark);
      leg.position.set(x, 0.24, z);
      group.add(leg);
    }
  }
  const load = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.4, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  load.position.set(0, 0.68, 0.3);
  group.add(load);
  return group;
}

/* hides stretched on a frame outside the furrier's hut */
function hideFrame() {
  const group = new THREE.Group();
  const wood = builders.material("wood_dark", 0.2, 2);
  for (const x of [-0.9, 0.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 0.12).translate(0, 1, 0), wood);
    post.position.x = x;
    group.add(post);
  }
  const hide = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d8, side: THREE.DoubleSide }),
  );
  hide.position.y = 1.15;
  group.add(hide);
  return group;
}

function buildVillage({ prop, place, pending, random, obstacles }) {
  for (const spec of RIME_HOUSES) {
    place(rimeHouse(spec, random), spec.x, spec.z, { rotation: spec.rotation });
  }
  /* the fire before the longhouse (main.js lights it), benches round it, the drying racks and the sledges */
  const [fx, fz] = RIME_FIRE;
  place(builders.campfire(), fx, fz, { radius: 0.9 });
  place(builders.bench(), fx - 2.6, fz + 0.4, { rotation: Math.PI / 2 });
  place(builders.bench(), fx + 2.6, fz + 0.4, { rotation: -Math.PI / 2 });
  place(fishRack(random), -150, -1524, { rotation: 0.1 });
  place(fishRack(random), -128, -1525, { rotation: -0.15 });
  place(fishRack(random), -170, -1522, { rotation: 0.4 });
  place(sledge(), -133, -1514, { rotation: 0.6, radius: 0.9 });
  place(sledge(), -152, -1529, { rotation: -0.3, radius: 0.9 });
  place(hideFrame(), -97, -1519, { rotation: -0.5 });
  place(hideFrame(), -104.5, -1519.5, { rotation: -0.3 });
  place(builders.barrel(), -107, -1527, { radius: 0.45 });
  place(builders.barrel(), -133, -1532, { radius: 0.45 });
  place(builders.barrel(), -132.2, -1531.2, { radius: 0.45 });
  place(builders.netRack(2.4), -176, -1517, { rotation: 0.5 });
  place(builders.flag(2.8, "cloth_red"), -145, -1527, { radius: 0.2 });
  /* boats pulled up on the ice for the winter, frozen in where they lie */
  for (const [bx, bz, turn] of [
    [-174, -1509, 1.1],
    [-108, -1507, -1.3],
    [-160, -1500, 0.4],
  ]) {
    const boat = builders.rowingBoat(3.6, 1.5);
    boat.position.set(bx, 0.02, bz);
    boat.rotation.set(0.03, turn, 0.06);
    scene.add(boat);
    obstacles.push({ x: bx, z: bz, r: 1.3 });
  }
  /* lanterns on posts along the way from the jetty, and at the ends of the village */
  for (const [lx, lz] of [
    [RIME_JETTY.x - 1.6, RIME_JETTY.north + 0.5],
    [-128.5, -1510],
    [-134, -1517],
    [-163, -1527],
    [-117, -1528],
    [-145, -1543],
  ]) {
    pending.push(prop("lantern", lx, lz, { radius: 0.25 }));
  }
  /* a fisher's stool and bucket by two of the holes */
  for (const [hx, hz] of [ICE_HOLES[1], ICE_HOLES[3]]) {
    place(builders.barrel(), hx + 1.4, hz - 0.6, { radius: 0.4 });
  }
}

/* ---------- the ridge to the north, the cliffs at the shore's ends, and the drift in the pass ---------- */

const ROCK = new THREE.MeshLambertMaterial({ color: 0x6e7888, flatShading: true });
const ROCK_SNOW = new THREE.MeshLambertMaterial({ color: 0xf0f5fa, flatShading: true });

/* boulders along a line, as two instanced meshes (rock, and the snow on top) per stretch, so the stretches go into
   their cells (culling.js) */
function boulders(points, random, rockMaterial = ROCK, capMaterial = ROCK_SNOW) {
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const cap = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rock, rockMaterial, points.length);
  const caps = new THREE.InstancedMesh(cap, capMaterial, points.length);
  const spot = new THREE.Object3D();
  points.forEach(([x, z, size, height], k) => {
    spot.position.set(x, height * 0.35, z);
    spot.rotation.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
    spot.scale.set(size, height, size * (0.8 + random() * 0.4));
    spot.updateMatrix();
    rocks.setMatrixAt(k, spot.matrix);
    spot.position.y = height * 0.35 + height * 0.62;
    spot.scale.set(size * 0.82, height * 0.34, size * 0.7);
    spot.updateMatrix();
    caps.setMatrixAt(k, spot.matrix);
  });
  rocks.computeBoundingSphere();
  caps.computeBoundingSphere();
  scene.add(rocks, caps);
}

function buildRidge(random, obstacles) {
  /* the ridge: a wall of boulders, tallest in the middle of each stretch; the pass stays open (its drift is apart) */
  let stretch = [];
  for (let x = SHORE.west - 20; x <= SHORE.east + 20; x += 2.6) {
    if (Math.abs(x - PASS.x) < PASS.halfWidth + 1.5) {
      continue;
    }
    for (const row of [0, 1, 2]) {
      const z = ridgeZ(x) - 1.2 - row * 3.2 + (random() - 0.5) * 1.5;
      const size = 2 + random() * 1.8 + row * 0.6;
      stretch.push([x + (random() - 0.5) * 1.6, z, size, size * (1 + random() * 0.7 + row * 0.25)]);
    }
    if (stretch.length >= 54) {
      boulders(stretch, random);
      stretch = [];
    }
  }
  /* the cliffs at the shore's west and east ends, from the ridge down to the sea */
  for (const edge of [SHORE.west, SHORE.east]) {
    const outward = edge === SHORE.west ? -1 : 1;
    for (let z = ridgeZ(edge); z < -1500; z += 2.8) {
      const dx = edge - FROSTMARCH.x;
      const dz = z - FROSTMARCH.z;
      if (Math.hypot(dx, dz) > frostCoast(Math.atan2(dx, dz)) + 1) {
        break;
      }
      for (const row of [0, 1]) {
        const size = 2.2 + random() * 1.6;
        stretch.push([edge + outward * (1 + row * 3), z + (random() - 0.5), size, size * 1.4]);
      }
      if (stretch.length >= 54) {
        boulders(stretch, random);
        stretch = [];
      }
    }
  }
  if (stretch.length) {
    boulders(stretch, random);
  }
  /* the pass: a drift of snow from wall to wall, too deep to wade, with a marker pole stuck in it */
  /* a heap of mounds, the highest in the middle, blown up against the rocks on both sides */
  const driftMaterial = new THREE.MeshLambertMaterial({ color: 0xf0f6fb, flatShading: true });
  const drift = new THREE.Group();
  for (const [dx, dz, rx, height, rz] of [
    [0, -2.5, 4.5, 4.2, 4],
    [-4, -1, 3.6, 3.2, 3.4],
    [4.2, -1.4, 3.8, 3.4, 3.2],
    [-1.5, 1.2, 3.2, 2.2, 2.6],
    [2.4, 1.6, 2.6, 1.8, 2.2],
    [-6.5, -3, 3, 3.6, 3],
    [6.8, -3.2, 3, 3.8, 3],
  ]) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), driftMaterial);
    mound.scale.set(rx, height, rz);
    mound.position.set(PASS.x + dx, -height * 0.25, PASS.z - 2 + dz);
    mound.rotation.y = dx;
    drift.add(mound);
  }
  scene.add(drift);
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.4, 0.12).translate(0, 1.2, 0),
    builders.material("wood_dark", 0.2, 2.4),
  );
  pole.position.set(PASS.x + 1.4, 1.2, PASS.z + 1.6);
  pole.rotation.z = 0.18;
  scene.add(pole);
  const rag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.35),
    new THREE.MeshLambertMaterial({ color: 0xb03030, side: THREE.DoubleSide }),
  );
  rag.position.set(PASS.x + 1.95, 3.35, PASS.z + 1.6);
  scene.add(rag);
  /* the drift stops a hero until Rimeholt has dug it out for them (updatePass) */
  const driftObstacle = { x: PASS.x, z: PASS.z - 1, r: PASS.halfWidth + 1 };
  obstacles.push(driftObstacle);
  /* and dug out: banks of snow thrown up along both walls, shovels left standing in them */
  const cut = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), driftMaterial);
      bank.scale.set(1.6, 1.6 + (k % 2) * 0.5, 2.6);
      bank.position.set(
        PASS.x + side * (PASS_CUT.halfWidth + 0.6),
        -0.3,
        PASS_CUT.south - 2 - k * ((PASS_CUT.south - PASS_CUT.north - 3) / 3),
      );
      cut.add(bank);
    }
  }
  const shaft = builders.material("wood_dark", 0.1, 1.6);
  for (const [dx, dz, lean] of [
    [-PASS_CUT.halfWidth + 0.4, -3, 0.3],
    [PASS_CUT.halfWidth - 0.5, -7, -0.25],
  ]) {
    const shovel = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 1.5, 0.07).translate(0, 0.75, 0),
      shaft,
    );
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.04).translate(0, -0.12, 0),
      builders.material("iron", 0.3, 0.4),
    );
    shovel.add(handle, blade);
    shovel.position.set(PASS.x + dx, 0.3, PASS.z + dz);
    shovel.rotation.z = lean;
    cut.add(shovel);
  }
  cut.visible = false;
  scene.add(cut);
  state.pass = { drift, cut, obstacle: driftObstacle, isOpen: false };
}

/** The pass for this hero: open once they have read the hunters' tracks and Rimeholt has dug it out. */
function updatePass() {
  const isOpen = player.quests?.sigrun_hunters?.state === "done";
  const pass = state.pass;
  if (pass && pass.isOpen !== isOpen) {
    pass.isOpen = isOpen;
    pass.drift.visible = !isOpen;
    pass.cut.visible = isOpen;
    pass.obstacle.isOpen = isOpen;
  }
}

/* ---------- pines, rocks and bushes in the snow ---------- */

function buildScenery({ prop, pending, random }) {
  const taken = [];
  const isClear = (x, z, room) =>
    inFrostmarch(x, z, 1.5) &&
    rimePathDistance(x, z) > 2.6 &&
    Math.hypot(x - RIMEHOLT.x, z - RIMEHOLT.z) > RIMEHOLT.radius - 4 &&
    bayShare(x, z) > 1.3 &&
    taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room);
  const put = (name, x, z, options, room) => {
    if (!isClear(x, z, room)) {
      return false;
    }
    taken.push([x, z, room]);
    pending.push(prop(name, x, z, options));
    return true;
  };
  /* groves of pines towards the ridge, thinning out towards the sea */
  for (let grove = 0; grove < 16; grove++) {
    const cx = SHORE.west + 10 + random() * (SHORE.east - SHORE.west - 20);
    const cz = ridgeZ(cx) + 8 + random() * 50;
    for (let k = 0; k < 16; k++) {
      const around = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * 9;
      put(
        random() < 0.6 ? "pine_snow" : "pine2_snow",
        cx + Math.sin(around) * distance,
        cz + Math.cos(around) * distance,
        { radius: 0.45, shadow: 1.6, scale: 1 + random() * 0.35 },
        1.8,
      );
    }
  }
  /* a dark wall of pines along the back of the ridge, the edge of the White Waste; the pass stays open */
  for (let x = SHORE.west - 30; x < SHORE.east + 30; x += 3.2) {
    if (Math.abs(x - PASS.x) < PASS.halfWidth + 3) {
      continue;
    }
    for (const row of [0, 1]) {
      const z = ridgeZ(x) - RIDGE_DEPTH + 2 - row * 3 - random() * 2;
      pending.push(
        prop(random() < 0.6 ? "pine_snow" : "pine2_snow", x + random() * 2, z, {
          radius: 0.45,
          shadow: 1.4,
          scale: 1.1 + random() * 0.4,
        }),
      );
    }
  }
  /* single pines, rocks and bushes over the open snow */
  for (let k = 0; k < 160; k++) {
    const x = SHORE.west + random() * (SHORE.east - SHORE.west);
    const z = ridgeZ(x) + 4 + random() * 130;
    const roll = random();
    if (roll < 0.35) {
      put(
        random() < 0.5 ? "pine_snow" : "pine2_snow",
        x,
        z,
        { radius: 0.45, shadow: 1.6, scale: 1 },
        2.4,
      );
    } else if (roll < 0.7) {
      put(random() < 0.5 ? "rock_snow" : "rock2_snow", x, z, { radius: 0.3, shadow: 0.6 }, 1);
    } else {
      put("bush_snow", x, z, { shadow: 0.7, scale: 0.6 + random() * 0.2 }, 1);
    }
  }
}

/* ---------- the floes out at sea ---------- */

/* a jagged slab of unit size, `depth` thick, standing on y = 0 */
function jaggedSlab(random, depth, corners) {
  const shape = new THREE.Shape();
  for (let k = 0; k < corners; k++) {
    const angle = (k / corners) * Math.PI * 2;
    const r = 0.8 + random() * 0.24;
    const point = [Math.cos(angle) * r, Math.sin(angle) * r];
    if (k === 0) {
      shape.moveTo(...point);
    } else {
      shape.lineTo(...point);
    }
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.25,
    bevelSize: 0.06,
    bevelSegments: 1,
  }).rotateX(-Math.PI / 2);
}

/* each floe: blue ice standing out of the water, a cap of snow on it a little smaller, so a rim of ice shows */
function buildFloes(random) {
  const layers = [
    { geometry: jaggedSlab(random, 0.7, 13), color: 0x9fcde6, grow: 1, y: WATER_Y - 0.25 },
    { geometry: jaggedSlab(random, 0.3, 11), color: 0xf1f6fa, grow: 0.84, y: WATER_Y + 0.4 },
  ];
  state.floes = layers.map(({ geometry, color, grow, y }) => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
      FLOES.length,
    );
    mesh.userData.base = [];
    const spot = new THREE.Object3D();
    FLOES.forEach((floe, k) => {
      spot.position.set(floe.x, y, floe.z);
      spot.rotation.set(0, floe.turn + (grow < 1 ? 0.4 : 0), 0);
      spot.scale.set(floe.radius * grow, 1, floe.radius * grow * (0.75 + random() * 0.2));
      spot.updateMatrix();
      mesh.setMatrixAt(k, spot.matrix);
      mesh.userData.base.push(spot.matrix.clone());
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  });
}

/* ---------- snow falling, round the camera, while it looks at the Frostmarch ---------- */

const FLAKES = IS_PHONE ? 500 : 1100;
const SNOW_BOX = { width: 56, height: 18 };

function buildSnowfall() {
  const positions = new Float32Array(FLAKES * 3);
  const drift = new Float32Array(FLAKES);
  for (let k = 0; k < FLAKES; k++) {
    positions[k * 3] = (Math.random() - 0.5) * SNOW_BOX.width;
    positions[k * 3 + 1] = Math.random() * SNOW_BOX.height;
    positions[k * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX.width;
    drift[k] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const flakes = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  flakes.frustumCulled = false;
  flakes.visible = false;
  scene.add(flakes);
  state.snow = { flakes, positions, drift };
}

/* is the camera looking at the Frostmarch (or the sea just off it)? */
const nearFrostmarch = () =>
  cameraState.target.z < -1440 && cameraState.target.x > SHORE.west - 120;

function updateSnowfall(dt, time) {
  const { flakes, positions, drift } = state.snow;
  flakes.visible = nearFrostmarch();
  if (!flakes.visible) {
    return;
  }
  const { x, z } = cameraState.target;
  flakes.position.set(x, 0, z);
  /* in a whiteout over the Waste the wind drives the snow almost flat */
  const wind = 1 + state.whiteout * 14;
  const fall = 1 + state.whiteout * 2.5;
  const half = SNOW_BOX.width / 2;
  for (let k = 0; k < FLAKES; k++) {
    const i = k * 3;
    positions[i] += (Math.sin(time * 0.7 + drift[k]) * 0.6 + 0.5) * wind * dt;
    positions[i + 1] -= (1.6 + (k % 5) * 0.25) * fall * dt;
    positions[i + 2] += Math.cos(time * 0.5 + drift[k]) * 0.3 * dt;
    if (positions[i + 1] < 0) {
      positions[i + 1] += SNOW_BOX.height;
    }
    if (positions[i] > half) {
      positions[i] -= SNOW_BOX.width;
    }
  }
  flakes.geometry.attributes.position.needsUpdate = true;
}

/* ---------- per frame ---------- */

const bob = new THREE.Matrix4();
const bobOffset = new THREE.Matrix4();

/** Per frame: the ground is painted near the hero, the surf breathes, the floes ride the swell, the snow falls. */
export function updateFrostmarch(dt, time) {
  if (!state.snow) {
    return;
  }
  const isNear = nearFrostmarch();
  if (isNear || painter.job) {
    paintGround();
  }
  updatePass();
  updateWeather(dt);
  updateSnowfall(dt, time);
  if (!isNear) {
    return;
  }
  state.surf.material.opacity = 0.22 + 0.1 * Math.sin(time * 0.9);
  for (const floes of state.floes) {
    floes.userData.base.forEach((base, k) => {
      bobOffset.makeTranslation(0, Math.sin(time * 1.1 + k * 1.7) * 0.06, 0);
      bob.multiplyMatrices(bobOffset, base);
      floes.setMatrixAt(k, bob);
    });
    floes.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- the White Waste: the shelter, the frozen lake, the Unbound's camp, the trolls' hollow, the glacier ---------- */

const ICE_CLIFF = new THREE.MeshLambertMaterial({ color: 0x9fcbe6, flatShading: true });
const ICE_CAP = new THREE.MeshLambertMaterial({ color: 0xeef6fb, flatShading: true });
const DARK_ROCK = new THREE.MeshLambertMaterial({ color: 0x545e6e, flatShading: true });

function buildWaste({ prop, place, pending, random, obstacles }) {
  buildGlacier(random);
  buildShelter({ prop, place, pending, random, obstacles });
  buildHollow({ prop, pending, random, obstacles });
  buildUnboundCamp({ prop, place, pending, random });
  /* the hunters' two old watch-fires (main.js lights them), a ring of stones round each */
  for (const [fx, fz] of WARM_FIRES.slice(1, 3)) {
    place(builders.campfire(), fx, fz, { radius: 0.9 });
    for (let k = 0; k < 5; k++) {
      const angle = (k / 5) * Math.PI * 2 + 0.4;
      pending.push(
        prop("rock_snow", fx + Math.sin(angle) * 2.4, fz + Math.cos(angle) * 2.4, {
          radius: 0.3,
          shadow: 0.5,
          scale: 0.45,
        }),
      );
    }
  }
  /* the bow lying out on the lake's ice, and the snow hollow the last hunter dug */
  const bow = new THREE.Group();
  const limb = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.05, 4, 12, Math.PI * 0.9).rotateX(-Math.PI / 2),
    builders.material("wood_dark", 0.2, 1.5),
  );
  const string = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.02, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xe8e2d0 }),
  );
  string.position.z = -0.08;
  bow.add(limb, string);
  bow.position.set(LOST_BOW[0], 0.06, LOST_BOW[1]);
  bow.rotation.y = 0.6;
  scene.add(bow);
  const [hx, hz] = KARI_HOLLOW;
  const den = builders.tent(2.4, 2.6, "cloth_green");
  den.scale.y = 0.55;
  place(den, hx, hz, { rotation: 0.9, radius: 1.2 });
  const heap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 6),
    new THREE.MeshLambertMaterial({ color: 0xf0f6fb, flatShading: true }),
  );
  heap.scale.set(2.6, 1.1, 2);
  heap.position.set(hx - 1.6, -0.2, hz - 1.4);
  scene.add(heap);
  buildWasteScenery({ prop, pending, random });
}

/* the face of the glacier: a wall of blue ice blocks with snow on their tops, and the Unbound's dig into it */
function buildGlacier(random) {
  let stretch = [];
  for (let x = WHITE_WASTE.west - 30; x <= WHITE_WASTE.east + 30; x += 3.2) {
    if (Math.abs(x - GLACIER_DIG[0]) < 4.5) {
      continue;
    }
    for (const row of [0, 1, 2]) {
      const size = 3 + random() * 1.8;
      stretch.push([
        x + (random() - 0.5) * 2,
        glacierZ(x) - 0.5 - row * 4 + (random() - 0.5) * 1.5,
        size,
        size * (1.6 + random() * 0.8 + row * 0.5),
      ]);
    }
    if (stretch.length >= 54) {
      boulders(stretch, random, ICE_CLIFF, ICE_CAP);
      stretch = [];
    }
  }
  if (stretch.length) {
    boulders(stretch, random, ICE_CLIFF, ICE_CAP);
  }
  /* the dig: a black mouth cut into the ice, propped with timber */
  const [dx, dz] = GLACIER_DIG;
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 16, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x0c1626 }),
  );
  mouth.position.set(dx, 0.02, dz - 4.2);
  scene.add(mouth);
  const wood = builders.material("wood_dark", 0.3, 3);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3).translate(0, 1.5, 0), wood);
    post.position.set(dx + side * 2.5, 0, dz - 4);
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.32, 0.34), wood);
  beam.position.set(dx, 3, dz - 4);
  scene.add(beam);
}

/* Torvald's shelter: an overhang of rock to the north, a lean-to of hides, the fire (main.js lights it) */
function buildShelter({ prop, place, pending, random, obstacles }) {
  const { x, z } = SHELTER;
  const overhang = [];
  for (let k = 0; k < 7; k++) {
    const angle = Math.PI * (0.6 + (k / 6) * 0.8);
    const size = 2.4 + random() * 1.2;
    const [bx, bz] = [x + Math.sin(angle) * 8, z + Math.cos(angle) * 8];
    overhang.push([bx, bz, size, size * 1.5]);
    obstacles.push({ x: bx, z: bz, r: size * 0.85 });
  }
  boulders(overhang, random, DARK_ROCK);
  place(builders.tent(3.6, 3.2, "cloth_green"), x - 3.5, z - 3, { rotation: 0.3, radius: 1.8 });
  place(hideFrame(), x + 4, z - 3.5, { rotation: -0.4 });
  place(sledge(), x + 5.5, z + 1, { rotation: 1.2, radius: 0.9 });
  place(builders.barrel(), x - 5.6, z + 1, { radius: 0.45 });
  place(builders.bench(), x + 1, z + 3.6, { rotation: 0 });
  pending.push(prop("lantern", x - 2, z + 4.5, { radius: 0.25 }));
}

/* the trolls' hollow: a ring of dark rock open to the east, caves in its walls, bones and gold on its floor */
function buildHollow({ prop, pending, random, obstacles }) {
  const { x, z, radius, gap } = TROLL_HOLLOW;
  const ring = [];
  for (let k = 0; k < 64; k++) {
    const bearing = (k / 64) * Math.PI * 2;
    if (
      Math.abs(Math.atan2(Math.sin(bearing - Math.PI / 2), Math.cos(bearing - Math.PI / 2))) < gap
    ) {
      continue;
    }
    for (const row of [0, 1]) {
      const distance = radius + row * 3.5 + (random() - 0.5);
      const size = 2.2 + random() * 1.4 + row * 0.5;
      const bx = x + Math.sin(bearing) * distance;
      const bz = z + Math.cos(bearing) * distance;
      ring.push([bx, bz, size, size * (1.5 + random() * 0.6)]);
      if (row === 0) {
        obstacles.push({ x: bx, z: bz, r: size * 0.9 });
      }
    }
  }
  for (let start = 0; start < ring.length; start += 54) {
    boulders(ring.slice(start, start + 54), random, DARK_ROCK);
  }
  /* cave mouths in the inner wall, black, facing the middle */
  const dark = new THREE.MeshBasicMaterial({ color: 0x0b0f18, side: THREE.DoubleSide });
  for (const bearing of [Math.PI * 0.95, Math.PI * 1.35, Math.PI * 0.2]) {
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.9, 14, 0, Math.PI), dark);
    const distance = radius - 1.6;
    mouth.position.set(x + Math.sin(bearing) * distance, 0.02, z + Math.cos(bearing) * distance);
    mouth.rotation.y = bearing + Math.PI;
    scene.add(mouth);
  }
  /* what the trolls keep: bones, and the Unbound's gold in a heap behind their chieftain */
  for (let k = 0; k < 9; k++) {
    const angle = random() * Math.PI * 2;
    const distance = 4 + random() * (radius - 8);
    pending.push(
      prop(
        ["ember_ribs", "ember_skull", "ember_ram_skull"][k % 3],
        x + Math.sin(angle) * distance,
        z + Math.cos(angle) * distance,
        { shadow: 0.5, scale: 0.6 },
      ),
    );
  }
  const gold = new THREE.MeshLambertMaterial({ color: 0xe8c050, emissive: 0x3a2a00 });
  const [gx, gz] = HRIMGAR_HOME;
  for (let k = 0; k < 14; k++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 8), gold);
    coin.position.set(
      gx - 4 + (random() - 0.5) * 2.4,
      0.04 + (k % 4) * 0.05,
      gz + (random() - 0.5) * 2.4,
    );
    coin.rotation.set(random() * 0.6, 0, random() * 0.6);
    scene.add(coin);
  }
}

/* the Unbound's camp: purple tents round three braziers (main.js lights them, purple), crates, their banner, and the
   trench they dig north to the glacier */
function buildUnboundCamp({ prop, place, pending, random }) {
  const { x, z } = UNBOUND_CAMP;
  /* their cloth: a deep purple, plain (the game's cloths are striped) */
  const purple = new THREE.MeshLambertMaterial({
    color: 0x6a3f9c,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  for (const [dx, dz, turn] of [
    [-10, -2, 0.5],
    [9, -3, -0.4],
    [-6, 8, 2.6],
    [7, 9, -2.4],
  ]) {
    const tent = builders.tent(3.2, 3.4, "cloth_red");
    tent.traverse((part) => {
      if (part.isMesh && part.geometry.type === "PlaneGeometry") {
        part.material = purple;
      }
    });
    place(tent, x + dx, z + dz, { rotation: turn, radius: 1.8 });
  }
  for (const [bx, bz] of CAMP_BRAZIERS) {
    place(builders.brazier(), bx, bz, { radius: 0.4 });
  }
  const flag = builders.flag(3, "cloth_red");
  /* builders.flag: the pole, then the banner */
  flag.children[1].material = purple;
  place(flag, x + 1, z - 4, { radius: 0.2 });
  place(builders.writingDesk(), x + 3, z + 2, { rotation: 0.4, radius: 0.8 });
  for (const [dx, dz] of [
    [-3, -7],
    [4, -8],
    [12, 3],
  ]) {
    pending.push(prop("crypt_crates", x + dx, z + dz, { radius: 0.7, scale: 0.9 }));
  }
  place(sledge(), x - 12, z + 4, { rotation: 1.4, radius: 0.9 });
}

/* pines in groves, rocks and bushes over the Waste, clear of everything built there */
function buildWasteScenery({ prop, pending, random }) {
  const taken = [];
  const isClear = (x, z, room) =>
    inWhiteWaste(x, z, 2) &&
    z > glacierZ(x) + 10 &&
    rimePathDistance(x, z) > 2.8 &&
    !onStillwater(x, z, 3) &&
    Math.hypot(x - SHELTER.x, z - SHELTER.z) > SHELTER.radius + 4 &&
    Math.hypot(x - UNBOUND_CAMP.x, z - UNBOUND_CAMP.z) > UNBOUND_CAMP.radius + 4 &&
    Math.hypot(x - TROLL_HOLLOW.x, z - TROLL_HOLLOW.z) > TROLL_HOLLOW.radius + 7 &&
    Math.hypot(x - KARI_HOLLOW[0], z - KARI_HOLLOW[1]) > 6 &&
    WARM_FIRES.every(([fx, fz]) => Math.hypot(x - fx, z - fz) > 5) &&
    taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room);
  const put = (name, x, z, options, room) => {
    if (!isClear(x, z, room)) {
      return;
    }
    taken.push([x, z, room]);
    pending.push(prop(name, x, z, options));
  };
  for (let grove = 0; grove < 14; grove++) {
    const cx = WHITE_WASTE.west + 10 + random() * (WHITE_WASTE.east - WHITE_WASTE.west - 20);
    const cz = glacierZ(cx) + 16 + random() * 160;
    for (let k = 0; k < 14; k++) {
      const around = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * 8;
      put(
        random() < 0.6 ? "pine_snow" : "pine2_snow",
        cx + Math.sin(around) * distance,
        cz + Math.cos(around) * distance,
        { radius: 0.45, shadow: 1.6, scale: 1 + random() * 0.35 },
        1.8,
      );
    }
  }
  for (let k = 0; k < 150; k++) {
    const x = WHITE_WASTE.west + random() * (WHITE_WASTE.east - WHITE_WASTE.west);
    const z = glacierZ(x) + 8 + random() * 200;
    const roll = random();
    if (roll < 0.25) {
      put(
        random() < 0.5 ? "pine_snow" : "pine2_snow",
        x,
        z,
        { radius: 0.45, shadow: 1.6, scale: 1 },
        2.4,
      );
    } else if (roll < 0.75) {
      put(random() < 0.5 ? "rock_snow" : "rock2_snow", x, z, { radius: 0.3, shadow: 0.6 }, 1);
    } else {
      put("bush_snow", x, z, { shadow: 0.7, scale: 0.6 + random() * 0.2 }, 1);
    }
  }
}

/* ---------- the weather of the Waste: whiteouts, and the cold ---------- */

/* the cold: 0 (warm) .. 1 (frozen through). It creeps in away from a fire in the White Waste, twice as fast in a
   whiteout and half as fast in a cloak of fur; at a fire it goes out again */
const CHILL_SECONDS = 100;
const WARM_SECONDS = 6;
/* at its worst the cold slows a hero this much */
const COLD_SLOW = 0.25;
/* cloaks that keep the cold out */
const WARM_CLOAKS = ["frostfur_cloak", "rimehide_mantle", "fur_mantle", "trollhide_cloak"];

state.whiteout = 0;
state.cold = 0;
state.coldWarned = 0;

/* a white veil over the screen in a whiteout (clear round the hero), and frost creeping in from the screen's edges
   with the cold */
function buildOverlays() {
  const canvas = document.querySelector("canvas");
  const veil = document.createElement("div");
  veil.style.cssText =
    "position:fixed;inset:0;pointer-events:none;opacity:0;" +
    "background:radial-gradient(circle at 50% 50%, rgba(236,243,250,0) 14%, rgba(236,243,250,0.82) 52%, rgba(236,243,250,0.97) 85%)";
  const frost = document.createElement("div");
  frost.style.cssText =
    "position:fixed;inset:0;pointer-events:none;opacity:0;" +
    "box-shadow:inset 0 0 120px 40px rgba(170,215,245,0.85), inset 0 0 30px 6px rgba(255,255,255,0.9)";
  const parent = canvas && canvas.parentNode ? canvas.parentNode : document.body;
  const after = canvas ? canvas.nextSibling : null;
  parent.insertBefore(veil, after);
  parent.insertBefore(frost, after);
  state.veil = veil;
  state.frost = frost;
}

/** How much the cold slows the hero: a factor for their speed (1 when warm). */
export const coldFactor = () => 1 - COLD_SLOW * Math.max(0, (state.cold - 0.4) / 0.6);

function updateWeather(dt) {
  const inWaste = inWhiteWaste(player.x, player.z, -2);
  const target = inWhiteWaste(cameraState.target.x, cameraState.target.z, -6)
    ? whiteoutStrength()
    : 0;
  state.whiteout += (target - state.whiteout) * Math.min(1, dt * 0.8);
  state.veil.style.opacity = (state.whiteout * 0.9).toFixed(3);
  /* the cold */
  const isWarm = warmthDistance(player.x, player.z) < WARM_REACH;
  if (!inWaste || isWarm || player.isDead || player.ship) {
    state.cold = Math.max(0, state.cold - dt / (isWarm ? WARM_SECONDS : WARM_SECONDS * 3));
  } else {
    const isWrapped = WARM_CLOAKS.includes(player.equipment && player.equipment.cloak);
    const rate = (1 + state.whiteout) * (isWrapped ? 0.5 : 1);
    state.cold = Math.min(1, state.cold + (dt / CHILL_SECONDS) * rate);
  }
  state.frost.style.opacity = Math.max(0, (state.cold - 0.25) / 0.75).toFixed(3);
  /* a word when it starts to bite, and when it is bad */
  const level = state.cold >= 0.95 ? 2 : state.cold >= 0.45 ? 1 : 0;
  if (level > state.coldWarned) {
    UI.systemMessage(
      level === 2
        ? "You are frozen to the bone and can barely walk. Get to a fire!"
        : "The cold of the Waste is getting into you. A fire would help; so would a fur cloak.",
    );
  }
  if (level === 0 && state.coldWarned && isWarm) {
    UI.systemMessage("The fire's warmth comes back into your hands.");
  }
  state.coldWarned = level === 0 ? 0 : Math.max(state.coldWarned, level);
}
