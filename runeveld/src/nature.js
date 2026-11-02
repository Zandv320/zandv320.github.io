/* Eldoria – the life of the land itself:
   - grass and meadows: tufts of grass everywhere in the open, and in patches flowers (poppies, buttercups, bluebells,
     daisies), swaying in the wind (batching.js);
   - the forest floor of Whisperwood: ferns, and mushrooms here and there;
   - pollen and seeds floating in the sunlight over the fields.
   The plants are pixel art drawn here, one instanced batch per picture and area, so thousands of them cost a handful
   of draw calls. */
import * as THREE from "three";
import { createBillboardBatch } from "./batching.js";
import { glowPointsMaterial } from "./glow-points.js";
import { daylight } from "./daylight.js";
import { cameraState, tileType, inVillage } from "./world.js";
import {
  inFields,
  inForest,
  inVale,
  inCapital,
  inNorthroad,
  inCrypt,
  inForge,
  insideWorld,
  distanceToPath,
  KINGS_ROAD,
  NORTH_ROAD,
  FOREST_PATH,
  ALTAR_CLEARING,
  GORGE,
} from "./regions.js";

/* the plants are drawn at the game's 16 pixels to a unit */
const PPU = 16;
/* plants are batched per picture in areas this many units square */
const AREA = 64;

/* ---------------------------------------------------------------- pictures ------------------------------------ */

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, width, height };
}

/* a small seeded random, so every picture is the same each time */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const GRASS_GREENS = ["#2f5a2c", "#3f7a36", "#5b9a44", "#7fbd58"];

/* blades of grass leaning this way and that, dark at the foot and light at the tip; `heads` puts flowers on the
   tallest ones, in [petal, heart] colours */
function grassPicture(seed, { blades = 8, height = 9, heads = null, greens = GRASS_GREENS } = {}) {
  const random = seeded(seed);
  return canvasTexture(16, 14, (ctx) => {
    const tips = [];
    for (let k = 0; k < blades; k++) {
      const x0 = 2 + random() * 12;
      const tall = 3 + random() * height;
      const lean = (random() - 0.5) * 1.2;
      for (let y = 0; y < tall; y++) {
        const x = Math.round(x0 + lean * y * 0.45);
        const shade = Math.min(greens.length - 1, Math.floor((y / tall) * greens.length));
        ctx.fillStyle = greens[shade];
        ctx.fillRect(x, 13 - y, 1, 1);
      }
      tips.push([Math.round(x0 + lean * tall * 0.45), 13 - Math.floor(tall)]);
    }
    if (heads) {
      const [petal, heart] = heads;
      tips
        .sort((a, b) => a[1] - b[1])
        .slice(0, 4)
        .forEach(([x, y]) => {
          ctx.fillStyle = petal;
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
          ctx.fillStyle = heart;
          ctx.fillRect(x, y, 1, 1);
        });
    }
  });
}

/* a fern: fronds arching out from the middle, with leaflets */
function fernPicture(seed) {
  const random = seeded(seed);
  return canvasTexture(18, 14, (ctx) => {
    for (let k = 0; k < 5; k++) {
      const angle = -Math.PI / 2 + (k - 2) * 0.42 + (random() - 0.5) * 0.15;
      const length = 7 + random() * 4;
      for (let t = 0; t < length; t++) {
        const bend = (t / length) ** 2 * 3 * Math.sign(k - 2);
        const x = Math.round(9 + Math.cos(angle) * t + bend);
        const y = Math.round(13 + Math.sin(angle) * t + (t / length) ** 2 * 2);
        ctx.fillStyle = t < length * 0.4 ? "#2e5a2a" : "#4f8a3a";
        ctx.fillRect(x, y, 1, 1);
        if (t > 1 && t % 2 === 0) {
          ctx.fillStyle = "#6fae4c";
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
        }
      }
    }
  });
}

/* a mushroom with a spotted cap: [cap, light of the cap] */
function mushroomPicture([cap, light]) {
  return canvasTexture(8, 8, (ctx) => {
    const rows = [
      "..cccc..",
      ".cclccc.",
      "ccwccwcc",
      "cccccccc",
      "..ssss..",
      "...ss...",
      "...ss...",
      "..ssss..",
    ];
    const colors = { c: cap, l: light, w: "#fff4e8", s: "#efe2c8" };
    rows.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (colors[cell]) {
          ctx.fillStyle = colors[cell];
          ctx.fillRect(x, y, 1, 1);
        }
      }),
    );
  });
}

/* ---------------------------------------------------------------- planting ------------------------------------ */

/* groups: picture → area → positions */
const beds = new Map();

function plant(picture, x, z) {
  if (!beds.has(picture)) {
    beds.set(picture, new Map());
  }
  const areas = beds.get(picture);
  const area = `${Math.floor(x / AREA)},${Math.floor(z / AREA)}`;
  if (!areas.has(area)) {
    areas.set(area, []);
  }
  areas.get(area).push({ x, z });
}

/* meadow flowers grow in patches: a slow wave over the land, high where they bloom */
const bloom = (x, z) =>
  Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.13 + 0.4) + 0.5 * Math.sin(x * 0.27 + z * 0.19);

/* open grass: not on a road, a square, in a town or in a building */
function isOpenGrass(x, z, isFree) {
  if (inFields(x, z, 1)) {
    if (tileType(x, z) !== "grass" || Math.abs(x) < 2.6) {
      return false;
    }
    if (inVillage(x, z) && Math.abs(z) < 2.4) {
      return false;
    }
  } else if (inVale(x, z, 2)) {
    if (inCapital(x, z, -3) || distanceToPath(x, z, KINGS_ROAD) < 3.2) {
      return false;
    }
  } else if (inNorthroad(x, z, 1)) {
    if (distanceToPath(x, z, NORTH_ROAD) < 3 || (z < GORGE.south + 3 && z > GORGE.north - 3)) {
      return false;
    }
  } else {
    return false;
  }
  return isFree(x, z, 0.6);
}

/** Plants the grass, the meadows and the forest floor (world.js calls this with its build context). */
export function buildNature({ scene, isFree, seededRandom }) {
  const random = seededRandom(9090);
  const grasses = [1, 2, 3].map((seed) => grassPicture(seed));
  const flowers = [
    grassPicture(11, { blades: 7, heads: ["#e8402c", "#2a1410"] }),
    grassPicture(12, { blades: 7, heads: ["#ffd23a", "#c87a10"] }),
    grassPicture(13, { blades: 7, heads: ["#6f8cff", "#e0e8ff"] }),
    grassPicture(14, { blades: 7, heads: ["#fbf6ee", "#ffd23a"] }),
  ];
  const ferns = [21, 22].map((seed) => fernPicture(seed));
  const mushrooms = [
    mushroomPicture(["#c8302c", "#ff6a4a"]),
    mushroomPicture(["#a86a3a", "#d89a5a"]),
  ];

  /* the open land: the fields, Kingsvale and the Northroad */
  const open = [
    [-60, -60, 60, 60, 2600],
    [-210, -80, -50, 80, 3400],
    [-196, -330, -86, -38, 3000],
  ];
  for (const [x0, z0, x1, z1, tries] of open) {
    for (let k = 0; k < tries; k++) {
      const x = x0 + random() * (x1 - x0);
      const z = z0 + random() * (z1 - z0);
      if (!isOpenGrass(x, z, isFree)) {
        continue;
      }
      const isVillage = inVillage(x, z);
      if (isVillage && random() < 0.75) {
        continue;
      }
      const flowering = !isVillage && bloom(x, z) > 0.55 && random() < 0.7;
      if (flowering) {
        /* each patch mostly one kind */
        const kind = Math.abs(Math.floor(bloom(x * 0.3, z * 0.3) * 7)) % flowers.length;
        plant(random() < 0.8 ? flowers[kind] : flowers[(kind + 1) % flowers.length], x, z);
      } else {
        plant(grasses[Math.floor(random() * grasses.length)], x, z);
      }
    }
  }

  /* Whisperwood's floor: ferns, grass in the lighter spots, mushrooms */
  const [ax, az] = ALTAR_CLEARING;
  for (let k = 0; k < 1300; k++) {
    const x = -44 + random() * 88;
    const z = -126 + random() * 70;
    if (!inForest(x, z, 1) || distanceToPath(x, z, FOREST_PATH) < 2.2) {
      continue;
    }
    if (Math.hypot(x - ax, z - az) < 7 || !isFree(x, z, 0.6)) {
      continue;
    }
    const roll = random();
    if (roll < 0.55) {
      plant(ferns[Math.floor(random() * ferns.length)], x, z);
    } else if (roll < 0.62) {
      plant(mushrooms[Math.floor(random() * mushrooms.length)], x, z);
    } else {
      plant(grasses[Math.floor(random() * grasses.length)], x, z);
    }
  }

  for (const [picture, areas] of beds) {
    const width = picture.width / PPU;
    const height = picture.height / PPU;
    const geometry = new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0);
    /* small plants bend more for their size than a tree does */
    const sway = mushrooms.includes(picture) ? 0 : 9;
    for (const positions of areas.values()) {
      scene.add(createBillboardBatch(picture.texture, geometry, positions, cameraState.yaw, sway));
    }
  }
  beds.clear();
  buildSky(scene);
}

/* ---------------------------------------------------------------- the sky over the land ---------------------- */

let pollen = null;
const POLLEN = 26;
const pollenData = [];

function buildSky(scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POLLEN * 3), 3));
  pollen = new THREE.Points(
    geometry,
    glowPointsMaterial({ color: 0xfff0b8, size: 3, opacity: 0.6 }),
  );
  pollen.frustumCulled = false;
  pollen.renderOrder = 10001;
  scene.add(pollen);
  for (let k = 0; k < POLLEN; k++) {
    pollenData.push({
      x: (Math.random() - 0.5) * 30,
      y: 0.4 + Math.random() * 2.2,
      z: (Math.random() - 0.5) * 36,
      phase: Math.random() * 6,
    });
  }
}

/* the pollen belongs to the open land under the sky */
function isUnderSky(x, z) {
  if (inCrypt(x, z) || inForge(x, z) || !insideWorld(x, z, -8)) {
    return false;
  }
  /* not over the drop of Greyfall Gorge, where it would hang in the air */
  return !(
    x > GORGE.west - 10 &&
    x < GORGE.east + 10 &&
    z < GORGE.south + 16 &&
    z > GORGE.north - 16
  );
}

/** Per frame: the pollen floats round the camera by day. */
export function updateNature(dt, time) {
  if (!pollen) {
    return;
  }
  const { x, z } = cameraState.target;
  const light = daylight();
  const isOpen = isUnderSky(x, z);

  pollen.visible = isOpen && light > 0.5 && !inForest(x, z);
  if (!pollen.visible) {
    return;
  }
  const position = pollen.geometry.attributes.position;
  pollenData.forEach((mote, k) => {
    mote.x += dt * (0.35 + 0.15 * Math.sin(time * 0.5 + mote.phase));
    mote.y += Math.sin(time * 1.3 + mote.phase) * dt * 0.15;
    /* wrap round the camera, so there are always some in view */
    if (mote.x > 15) {
      mote.x -= 30;
    }
    position.setXYZ(k, x + mote.x, mote.y, z + mote.z + Math.sin(time * 0.7 + mote.phase) * 0.4);
  });
  position.needsUpdate = true;
  pollen.material.size = (cameraState.px / 16) * 0.9;
}
