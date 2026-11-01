/* Eldoria – the Ember Isles as the players see them (the rules are in rules/ember.js): grey ash with sand along the
   coast, rivers of lava glowing down to the sea, dead trees, rocks and bones, little lava mounds that steam, and over
   everything Mount Kharos in basalt, smoking, its crater aglow; Cinder Cove on the south coast with its jetty, the
   Gull's Promise lying alongside when a hero has brought her here, and the camp on the beach above. The ground,
   the basalt and the props come from schwarnhild's free volcano pack (tools/build_sprites.py, build_ember). */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  EMBER_ISLES,
  CINDER_COVE,
  COVE_JETTY,
  COVE_BERTH,
  CINDER_CAMP,
  MOUNT_KHAROS,
  LAVA_FLOWS,
  LAVA_POOLS,
  LAVA_WIDTH,
  emberShore,
  inEmberIsles,
  lavaDistance,
} from "./rules/ember.js";
import { HULL } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { addShadowCatcher, applyGroundFilter } from "./world.js";
import { distanceToPath } from "./regions.js";
import { clickables } from "./game-state.js";
import { loadTexture } from "./sprites.js";

/* the path the camp has trodden: from the jetty up the beach to the fire, and on towards the mountain */
const CAMP_PATH = [
  [COVE_JETTY.x, COVE_JETTY.north],
  [-163.5, -856],
  [-167, -861],
  [-171, -871],
  [-175, -883],
];

/* the mountain's shape: height, and the crater's mouth at the top */
const KHAROS_HEIGHT = 32;
const CRATER_RADIUS = 6;

const volcanoSmoke = [];
/* steam rising from cracks in the ash: {x, z, puffs} */
const steamVents = [];
let craterGlow = null;
/* the Gull's Promise at the jetty, and her swell */
let coveGull = null;

/** Builds the Ember Isles (world.js calls this with its build context). */
export function buildEmberIsles({ scene, prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(9090);
  /* the ground is painted from the volcano tiles (sprites/ember_ground.png) once they are loaded */
  pending.push(
    Promise.all([
      loadTexture("sprites/ember_ground.png", { raw: true }),
      loadTexture("sprites/ember_patches.png", { raw: true }),
    ]).then(([tiles, patches]) => buildGround(scene, tiles.image, patches.image)),
  );
  buildLava(scene);
  buildCoast(scene, random);
  buildKharos(scene, random);
  buildJetty(scene, random);
  buildCamp({ scene, prop, place, pending, obstacles });
  buildScenery({ scene, prop, pending, random });
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

function buildGround(scene, tilesImage, patchesImage) {
  const atlas = pixelsOf(tilesImage);
  /* the colour of pixel (gx, gy) of the ground in tile `tile`, the tiles repeating every 32 px */
  const tilePixel = (tile, gx, gy) => {
    const k = ((gy % 32) * tilesImage.width + tile * 32 + (gx % 32)) * 4;
    return [atlas[k], atlas[k + 1], atlas[k + 2]];
  };
  /* the plain ash of the tiles: specks and pebbles are whatever differs from it */
  const [ashR, ashG, ashB] = tilePixel(TILE.ground, 0, 0);
  const isAsh = (r, g, b) => r === ashR && g === ashG && b === ashB;
  const reach = EMBER_ISLES.radius * 1.15;
  const x0 = Math.floor(EMBER_ISLES.x - reach);
  const z0 = Math.floor(EMBER_ISLES.z - reach);
  const size = Math.ceil(reach * 2);
  const canvas = document.createElement("canvas");
  canvas.width = size * PX;
  canvas.height = size * PX;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(canvas.width, canvas.height);
  const pixels = image.data;
  const cells = canvas.width / CELL;
  const cellUnits = CELL / PX;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const x = x0 + (i + 0.5) * cellUnits;
      const z = z0 + (j + 0.5) * cellUnits;
      const dx = x - EMBER_ISLES.x;
      const dz = z - EMBER_ISLES.z;
      /* how far inland: along the bearing from the isles' middle */
      const inland = emberShore(Math.atan2(dx, dz)) - Math.hypot(dx, dz);
      if (inland < 0) {
        continue;
      }
      const fromMountain = Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z) - MOUNT_KHAROS.radius;
      const fromLava = lavaDistance(x, z);
      const isTrodden =
        distanceToPath(x, z, CAMP_PATH) < 1.1 + noise(x * 0.9, z * 0.9) * 0.6 ||
        Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) < 6.5 + noise(x * 0.3, z * 0.3) * 2.5;
      const beachWidth = 3 + noise(x * 0.2, z * 0.2) * 3;
      for (let py = 0; py < CELL; py++) {
        for (let px = 0; px < CELL; px++) {
          const gx = i * CELL + px;
          const gy = j * CELL + py;
          const grain = hash(gx * 0.37, gy * 0.71);
          /* the ground: the ash in broad patches a shade lighter or darker, with specks or pebbles strewn in
             here and there */
          const variant = hash(Math.floor(gx / 32) + 0.5, Math.floor(gy / 32) + 0.5);
          const groundTile =
            variant < 0.5 ? TILE.ground : variant < 0.85 ? TILE.specks : TILE.pebbles;
          let [r, g, b] = tilePixel(groundTile, gx, gy);
          const patch = noise(x * 0.07, z * 0.07) * 0.6 + noise(x * 0.3, z * 0.3) * 0.4;
          let shade = isAsh(r, g, b) ? (patch < 0.38 ? 0.88 : patch > 0.64 ? 1.08 : 1) : 1;
          if (inland < 0.12) {
            /* the dark lip of the low cliff */
            [r, g, b] = [30, 27, 29];
          } else if (inland < beachWidth && grain < (beachWidth - inland) / 1.4) {
            /* sand along the shore, wet and darker at the water, frayed where it meets the ash */
            [r, g, b] = tilePixel(TILE.sand, gx, gy);
            shade = inland < 0.6 ? 0.62 : 0.92;
          } else if (isTrodden) {
            /* the camp's trodden ground: ash and sand worked together */
            if (grain < 0.45) {
              [r, g, b] = tilePixel(TILE.sand, gx, gy);
              shade = 0.82;
            }
          }
          if (fromLava < 1.6) {
            /* scorched black beside the lava, with embers in it */
            shade *= 0.35 + (0.45 * Math.max(0, fromLava)) / 1.6;
            if (fromLava < 0.7 && grain > 0.93) {
              [r, g, b] = EMBER_GLOW[grain > 0.97 ? 0 : 1];
              shade = 1;
            }
          } else if (fromMountain < 6) {
            shade *= 0.72 + fromMountain * 0.045;
          }
          const k = (gy * canvas.width + gx) * 4;
          pixels[k] = r * shade;
          pixels[k + 1] = g * shade;
          pixels[k + 2] = b * shade;
          pixels[k + 3] = 255;
        }
      }
    }
  }
  /* patches of sand ringed with stones, laid where the ash is open */
  const patches = pixelsOf(patchesImage);
  const PATCH = 96;
  const patchCount = patchesImage.width / PATCH;
  const isOpen = (x, z) => {
    const dx = x - EMBER_ISLES.x;
    const dz = z - EMBER_ISLES.z;
    return (
      emberShore(Math.atan2(dx, dz)) - Math.hypot(dx, dz) > 7 &&
      lavaDistance(x, z) > 2.5 &&
      distanceToPath(x, z, CAMP_PATH) > 3 &&
      Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) > 11 &&
      Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z) > MOUNT_KHAROS.radius + 2
    );
  };
  for (let k = 0; k < 160; k++) {
    const left = Math.floor(hash(k, 3.3) * (canvas.width - PATCH));
    const top = Math.floor(hash(k, 8.1) * (canvas.height - PATCH));
    const span = PATCH / PX;
    const wx = x0 + left / PX;
    const wz = z0 + top / PX;
    if (![0, 0.5, 1].every((u) => [0, 0.5, 1].every((v) => isOpen(wx + u * span, wz + v * span)))) {
      continue;
    }
    const which = k % patchCount;
    for (let py = 0; py < PATCH; py++) {
      for (let px = 0; px < PATCH; px++) {
        const from = (py * patchesImage.width + which * PATCH + px) * 4;
        if (patches[from + 3] === 0 || isAsh(patches[from], patches[from + 1], patches[from + 2])) {
          continue;
        }
        const to = ((top + py) * canvas.width + left + px) * 4;
        pixels[to] = patches[from];
        pixels[to + 1] = patches[from + 1];
        pixels[to + 2] = patches[from + 2];
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  applyGroundFilter(texture);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(x0 + size / 2, 0.004, z0 + size / 2);
  scene.add(ground);
  addShadowCatcher(size, size, x0 + size / 2, 0.029, z0 + size / 2);
}

/* ---------- lava: rivers and pools that glow by day and night ---------- */

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

/* A flat shape over all the lava (rivers as strips with round joints, pools as discs), `grow` wider than the lava
   itself, at height y; its uvs follow the world, so one tileable texture runs on without seams. */
function lavaShape(grow, y) {
  const positions = [];
  const disc = (cx, cz, radius) => {
    const SEGMENTS = 20;
    for (let k = 0; k < SEGMENTS; k++) {
      const a = (k / SEGMENTS) * Math.PI * 2;
      const b = ((k + 1) / SEGMENTS) * Math.PI * 2;
      positions.push(
        cx,
        y,
        cz,
        cx + Math.sin(b) * radius,
        y,
        cz + Math.cos(b) * radius,
        cx + Math.sin(a) * radius,
        y,
        cz + Math.cos(a) * radius,
      );
    }
  };
  const width = LAVA_WIDTH + grow;
  for (const flow of LAVA_FLOWS) {
    for (let k = 0; k < flow.length - 1; k++) {
      const [ax, az] = flow[k];
      const [bx, bz] = flow[k + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const sideX = (-(bz - az) / length) * width;
      const sideZ = ((bx - ax) / length) * width;
      const quad = [
        [ax + sideX, az + sideZ],
        [ax - sideX, az - sideZ],
        [bx + sideX, bz + sideZ],
        [bx - sideX, bz - sideZ],
      ];
      for (const index of [0, 2, 1, 1, 2, 3]) {
        positions.push(quad[index][0], y, quad[index][1]);
      }
      disc(ax, az, width);
    }
    disc(...flow[flow.length - 1], width);
  }
  for (const pool of LAVA_POOLS) {
    disc(pool.x, pool.z, pool.r + grow);
  }
  const uvs = [];
  for (let k = 0; k < positions.length; k += 3) {
    uvs.push(positions[k] / 4, -positions[k + 2] / 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

let lavaMaterial = null;

function buildLava(scene) {
  /* a bright rim round the lava, then the lava over it; both drawn over the night haze, so they glow in the dark
     (and above the shadow catcher, which is drawn before them) */
  const rim = new THREE.Mesh(
    lavaShape(0.22, 0.034),
    new THREE.MeshBasicMaterial({ color: 0xffc04a, side: THREE.DoubleSide, transparent: true }),
  );
  rim.renderOrder = 10001;
  scene.add(rim);
  lavaMaterial = new THREE.MeshBasicMaterial({
    map: lavaTexture(),
    side: THREE.DoubleSide,
    transparent: true,
  });
  const lava = new THREE.Mesh(lavaShape(0, 0.038), lavaMaterial);
  lava.renderOrder = 10002;
  scene.add(lava);
}

/* ---------- the coast: low cliffs of basalt down to the water, with boulders in the surf ---------- */

function buildCoast(scene, random) {
  const SEGMENTS = 360;
  const positions = [];
  const colors = [];
  const uvs = [];
  const top = new THREE.Color();
  const foot = new THREE.Color();
  const depth = -(WATER_Y - 0.6);
  let along = 0;
  for (let k = 0; k < SEGMENTS; k++) {
    const a = (k / SEGMENTS) * Math.PI * 2;
    const b = ((k + 1) / SEGMENTS) * Math.PI * 2;
    const ra = emberShore(a);
    const rb = emberShore(b);
    const point = (angle, radius, y) => [
      EMBER_ISLES.x + Math.sin(angle) * radius,
      y,
      EMBER_ISLES.z + Math.cos(angle) * radius,
    ];
    const quad = [
      point(a, ra, 0),
      point(a, ra + 0.35, WATER_Y - 0.6),
      point(b, rb, 0),
      point(b, rb + 0.35, WATER_Y - 0.6),
    ];
    const step = Math.hypot(quad[2][0] - quad[0][0], quad[2][2] - quad[0][2]);
    const quadUvs = [
      [along / 2, 0],
      [along / 2, depth / 2],
      [(along + step) / 2, 0],
      [(along + step) / 2, depth / 2],
    ];
    along += step;
    const tint = 0.8 + random() * 0.25;
    top.setRGB(tint, tint, tint, THREE.SRGBColorSpace);
    foot.setRGB(0.45, 0.43, 0.45, THREE.SRGBColorSpace);
    for (const index of [0, 1, 2, 2, 1, 3]) {
      positions.push(...quad[index]);
      uvs.push(...quadUvs[index]);
      const color = index === 0 || index === 2 ? top : foot;
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const cliff = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      map: builders.texture("basalt", 1, 1),
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
  );
  scene.add(cliff);
  /* boulders: along the coast in the surf, but not in the cove's mouth where the ship comes in */
  const boulder = builders.material("basalt", 2, 2, 0.8);
  for (let k = 0; k < 240; k++) {
    const angle = random() * Math.PI * 2;
    const distance = emberShore(angle) + 0.4 + random() * 2.2;
    const x = EMBER_ISLES.x + Math.sin(angle) * distance;
    const z = EMBER_ISLES.z + Math.cos(angle) * distance;
    if (Math.hypot(x - CINDER_COVE.x, z - CINDER_COVE.z) < CINDER_COVE.radius + 4) {
      continue;
    }
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35 + random() * random() * 1.1, 0),
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

/* ---------- Mount Kharos: a wide black cone, ash grey towards the top, with a glowing crater ---------- */

function buildKharos(scene, random) {
  const SIDES = 56;
  const RINGS = 16;
  const positions = [];
  const colors = [];
  const uvs = [];
  /* the basalt runs round the mountain a whole number of times, so it meets itself without a seam */
  const around = Math.round((Math.PI * MOUNT_KHAROS.radius) / 1) / SIDES;
  const slope = Math.hypot(MOUNT_KHAROS.radius - CRATER_RADIUS, KHAROS_HEIGHT) / 2;
  const ringUv = (side, ring) => [side * around, (ring / RINGS) * slope];
  const ringPoint = (side, ring) => {
    const angle = (side / SIDES) * Math.PI * 2;
    const t = ring / RINGS;
    /* a wavy foot, and gullies that run down the slopes */
    const wave =
      1 +
      (0.06 * Math.sin(angle * 5 + 0.7) + 0.04 * Math.sin(angle * 13 + ring * 0.4)) * (1 - t * 0.6);
    const radius = (MOUNT_KHAROS.radius * Math.pow(1 - t, 1.25) + CRATER_RADIUS * t) * wave;
    const y = -0.4 + KHAROS_HEIGHT * t;
    return [
      MOUNT_KHAROS.x + Math.sin(angle) * radius,
      y,
      MOUNT_KHAROS.z + Math.cos(angle) * radius,
    ];
  };
  const colorAt = (ring) => {
    const t = ring / RINGS;
    /* the basalt as it is at the foot, greyer with ash towards the top */
    const ash = Math.max(0, (t - 0.45) / 0.55);
    const tint = 0.85 + random() * 0.2;
    const color = new THREE.Color().setRGB(
      (0.8 + ash * 0.5) * tint,
      (0.78 + ash * 0.5) * tint,
      (0.8 + ash * 0.48) * tint,
      THREE.SRGBColorSpace,
    );
    return [color.r, color.g, color.b];
  };
  for (let ring = 0; ring < RINGS; ring++) {
    const lower = colorAt(ring);
    const upper = colorAt(ring + 1);
    for (let side = 0; side < SIDES; side++) {
      const quad = [
        ringPoint(side, ring),
        ringPoint(side + 1, ring),
        ringPoint(side, ring + 1),
        ringPoint(side + 1, ring + 1),
      ];
      const quadUvs = [
        ringUv(side, ring),
        ringUv(side + 1, ring),
        ringUv(side, ring + 1),
        ringUv(side + 1, ring + 1),
      ];
      for (const index of [0, 1, 2, 1, 3, 2]) {
        positions.push(...quad[index]);
        uvs.push(...quadUvs[index]);
        colors.push(...(index < 2 ? lower : upper));
      }
    }
  }
  /* the crater: its inner wall down to a glowing floor */
  const rimY = -0.4 + KHAROS_HEIGHT;
  const rim = new THREE.Color().setRGB(1.1, 1, 1, THREE.SRGBColorSpace);
  const floor = new THREE.Color().setRGB(1.6, 0.6, 0.3, THREE.SRGBColorSpace);
  const rimColor = [rim.r, rim.g, rim.b];
  const floorColor = [floor.r, floor.g, floor.b];
  for (let side = 0; side < SIDES; side++) {
    const a = (side / SIDES) * Math.PI * 2;
    const b = ((side + 1) / SIDES) * Math.PI * 2;
    const at = (angle, radius, y) => [
      MOUNT_KHAROS.x + Math.sin(angle) * radius,
      y,
      MOUNT_KHAROS.z + Math.cos(angle) * radius,
    ];
    const quad = [
      at(a, CRATER_RADIUS, rimY),
      at(b, CRATER_RADIUS, rimY),
      at(a, CRATER_RADIUS * 0.6, rimY - 3),
      at(b, CRATER_RADIUS * 0.6, rimY - 3),
    ];
    for (const index of [0, 1, 2, 2, 1, 3]) {
      positions.push(...quad[index]);
      uvs.push((index % 2 ? side + 1 : side) * around, index < 2 ? 0 : 1.5);
      colors.push(...(index < 2 ? rimColor : floorColor));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const mountain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      map: builders.texture("basalt", 1, 1),
      vertexColors: true,
      flatShading: true,
    }),
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
  place(builders.campfire(), -166, -862, { radius: 0.9 });
  /* Edda's tent with her books before it, and the fisherman's */
  place(builders.tent(3.4, 3.4, "cloth_red"), -173.5, -868.5, { rotation: 0.5, radius: 1.8 });
  place(builders.tent(3, 3.2, "cloth_green"), -159.5, -868, { rotation: -0.4, radius: 1.7 });
  place(builders.writingDesk(), -170.6, -865.2, { rotation: 0.5, radius: 0.9 });
  /* stores from the boat */
  pending.push(prop("crypt_crates", -162.4, -857.2, { radius: 0.7, scale: 0.9 }));
  pending.push(prop("woodpile", -169.5, -858.5, { radius: 0.7 }));
  for (const [x, z] of [
    [-157.6, -862.4],
    [-157, -861.2],
    [-158.4, -861],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  place(builders.chest(), -161.2, -866.2, { rotation: -0.4, radius: 0.5 });
  place(builders.netRack(2.6), -177.6, -861.6, { rotation: 1.2 });
  place(builders.flag(2.8, "cloth_red"), -163.2, -853.4, { radius: 0.2 });
  lantern(COVE_JETTY.x + 1.6, COVE_JETTY.north + 0.5);
  lantern(-171.4, -861.6);
  lantern(-162.8, -869.8);
  /* the fishing boat, drawn up on the beach west of the cove */
  const boat = builders.rowingBoat(4.6, 1.8);
  boat.position.set(-180.5, 0.05, -853.5);
  boat.rotation.set(0.04, 1.1, 0.12);
  scene.add(boat);
  obstacles.push({ x: -180.5, z: -853.5, r: 1.6 });
}

/* ---------- the burnt land: dead trees and bushes, rocks, bones, and little lava mounds that steam ---------- */

/* what stands about on the isles, from the volcano pack: [sprite, how many, scale, collision radius, shadow] */
const SCENERY = [
  [["ember_tree1", "ember_tree2"], 24, 0.75, 0.45, 1.6],
  [["ember_bush1", "ember_bush2"], 46, 0.65, 0, 0.9],
  [["ember_rock1", "ember_rock2", "ember_rock3"], 40, 0.7, 0.3, 0.6],
  [["ember_rock4", "ember_boulder"], 22, 0.75, 0.7, 1.2],
  [["ember_ram_skull", "ember_skull", "ember_ribs"], 14, 0.6, 0, 0.5],
  [["ember_stump"], 9, 0.65, 0.3, 0.6],
];
const MOUNDS = ["ember_mound1", "ember_mound2", "ember_mound3", "ember_mound4"];

function buildScenery({ scene, prop, pending, random }) {
  const reach = EMBER_ISLES.radius * 1.15;
  const taken = [];
  /* a free spot on the isles: on the land, off the camp, the path and the lava, and not on top of anything else */
  const freeSpot = (room, isNearMountain) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = EMBER_ISLES.x + (random() * 2 - 1) * reach;
      const z = EMBER_ISLES.z + (random() * 2 - 1) * reach;
      const fromMountain = Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z) - MOUNT_KHAROS.radius;
      const isFree =
        inEmberIsles(x, z, 1.5) &&
        Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) > CINDER_CAMP.radius + 2 &&
        distanceToPath(x, z, CAMP_PATH) > 2.5 &&
        lavaDistance(x, z) > 1.2 &&
        (!isNearMountain || fromMountain < 20) &&
        taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + room + 0.6);
      if (isFree) {
        taken.push([x, z, room]);
        return [x, z];
      }
    }
    return null;
  };
  /* the sign by the path, pointing up to the mountain */
  taken.push([-173.6, -876.2, 0.4]);
  pending.push(prop("ember_sign", -173.6, -876.2, { radius: 0.3, scale: 0.55, shadow: 0.6 }));
  /* the lava mounds first, at the mountain's foot: each smokes */
  for (let k = 0; k < 12; k++) {
    const spot = freeSpot(1.6, true);
    if (!spot) {
      continue;
    }
    const [x, z] = spot;
    pending.push(prop(MOUNDS[k % MOUNDS.length], x, z, { radius: 1.1, scale: 0.7, shadow: 1.8 }));
    addVent(scene, x, z + 0.1, random);
  }
  for (const [names, count, scale, radius, shadow] of SCENERY) {
    for (let k = 0; k < count; k++) {
      const spot = freeSpot(Math.max(radius, 0.5), false);
      if (spot) {
        pending.push(prop(names[k % names.length], spot[0], spot[1], { radius, scale, shadow }));
      }
    }
  }
}

/* a thread of steam rising from a lava mound */
function addVent(scene, x, z, random) {
  const vent = { x, z, puffs: [] };
  for (let p = 0; p < 4; p++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 6),
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
  craterGlow.material.color.setRGB(1, 0.42 + 0.1 * Math.sin(time * 2.3), 0.15);
  /* the lava creeps, and breathes a little brighter and darker */
  lavaMaterial.map.offset.set((time * 0.012) % 1, (time * 0.02) % 1);
  const glow = 0.88 + 0.12 * Math.sin(time * 1.7);
  lavaMaterial.color.setRGB(glow, glow, glow);
  for (const vent of steamVents) {
    for (const puff of vent.puffs) {
      const t = (time * 0.18 + puff.userData.phase) % 1;
      puff.position.set(vent.x + t * 1.2, 0.9 + t * 4, vent.z);
      puff.scale.setScalar(0.5 + t * 1.6);
      puff.material.opacity = 0.4 * (1 - t);
    }
  }
  if (coveGull.visible) {
    const wave = time * 1.1 + 3.7;
    coveGull.position.y = WATER_Y + Math.sin(wave) * 0.07;
    coveGull.rotation.set(Math.sin(wave * 0.8) * 0.02, COVE_BERTH.heading, Math.sin(wave) * 0.03);
  }
}
