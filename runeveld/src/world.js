/* Eldoria – renderer, camera, ground, scenery and collisions.
   Scale: 1 world unit = 16 pixels of pixel art (PPU). A 32 px ground tile spans 2 units.
   The world is a square of -FIELD_SIZE..FIELD_SIZE; in the middle lies the village
   (-VILLAGE_HALF_SIZE..VILLAGE_HALF_SIZE) behind a palisade with a gate in the north and the south. Around it lie
   the fields and the forest where the monsters live. */
import * as THREE from "three";
import {
  loadTexture,
  makeTexture,
  Billboard,
  SHEET_SCALE,
  SMOOTH,
  PIXEL_SCALE,
  IS_PHONE,
  BLOB_SHADOW,
} from "./sprites.js";
import {
  createBillboardBatch,
  createShadowBatch,
  mergeStaticGroups,
  updateBatchUniforms,
} from "./batching.js";
import * as builders from "./builders.js";
import {
  FOREST,
  inForest,
  inFields,
  fieldEdge,
  insideWorld,
  VALE,
  inVale,
  inCapital,
  inCastle,
} from "./regions.js";
import { buildForest } from "./forest.js";
import { buildCapital } from "./capital.js";
import { buildProfessionSites } from "./profession-sites.js";

export { insideWorld };

export const FIELD_SIZE = 60; /* half the width of the world */
export const VILLAGE_HALF_SIZE = 22; /* half the width of the village */
export const SQUARE_RADIUS = 8; /* radius of the cobbled village square */
export const GATE_HALF_WIDTH = 2.8; /* half the width of the gates (on the road) */
export const PPU = 16;

export const canvas = document.getElementById("game");
/* Some phones refuse a "high-performance" context; then the default one. Without WebGL at all the loading screen
   says so (index.html shows uncaught errors there). */
function createRenderer() {
  for (const powerPreference of ["high-performance", "default"]) {
    try {
      return new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference });
    } catch (error) {
      console.warn("WebGL (" + powerPreference + ") failed:", error);
    }
  }
  throw new Error(
    "this browser cannot show 3D graphics (WebGL). Update it, turn on hardware acceleration or try another browser.",
  );
}
export const renderer = createRenderer();
/* pixel look: the scene is rendered at low resolution and scaled up without blurring (canvas image-rendering) */
renderer.setPixelRatio(PIXEL_SCALE > 1 ? 1 / PIXEL_SCALE : Math.min(devicePixelRatio, 2));
canvas.style.imageRendering = PIXEL_SCALE > 1 ? "pixelated" : "auto";
renderer.outputColorSpace = THREE.SRGBColorSpace;
/* hard, pixelated cast shadows from the 3D scenery (BasicShadowMap: no softening) */
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c9ee);
/* No fog: the orthographic camera sits at a fixed distance and the world ends in a row of trees.
   The lights are for the 3D models; sprites are unlit and unaffected. */
export const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x6a8a46, 2.2);
scene.add(hemiLight);
export const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(20, 40, 15);
scene.add(sun);
scene.add(sun.target);
sun.castShadow = true;
const shadowMapSize = IS_PHONE ? 2048 : 4096;
sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
sun.shadow.bias = -0.0005;
/* followSun() places the sun and sizes the shadow camera to the view */
Object.assign(sun.shadow.camera, { near: 1, far: 160 });

/* The shadow camera travels with the view (the world is too large for one shadow map), on whole units, otherwise
   the edges flicker. The shadow map is only redrawn when the view shifts, turns or zooms: everything that casts a
   shadow stands still (sprites have their own blob shadow).
   Coverage: a shadow lands on the ground at the same spot in the light's view as the thing that casts it, so the
   shadow camera has to cover exactly the ground in view, seen from the sun, plus a small margin. */
renderer.shadowMap.autoUpdate = false;
/* the direction of the sunlight (from the sun towards the ground) */
const SUN_OFFSET = new THREE.Vector3(20, 40, 16);
const SHADOW_MARGIN = 3;
const lightView = new THREE.Object3D();
const corner = new THREE.Vector3();
const cornerRay = new THREE.Raycaster();
const groundLevel = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let shadowKey = "";

/** Moves the shadow-casting sun along with the view centre (x, z); redraws the shadow map when the area changed. */
export function followSun(x, z) {
  x = Math.round(x);
  z = Math.round(z);
  sun.target.position.set(x, 0, z);
  sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
  /* the light's view, as the shadow camera will see it */
  lightView.position.copy(sun.position);
  lightView.lookAt(sun.target.position);
  lightView.updateMatrixWorld();
  const toLight = lightView.matrixWorld.clone().invert();
  /* the four corners of the screen on the ground, in the light's view */
  let halfWidth = 0;
  let halfHeight = 0;
  for (const [cx, cy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    cornerRay.setFromCamera({ x: cx, y: cy }, camera);
    if (!cornerRay.ray.intersectPlane(groundLevel, corner)) {
      continue;
    }
    corner.applyMatrix4(toLight);
    halfWidth = Math.max(halfWidth, Math.abs(corner.x));
    halfHeight = Math.max(halfHeight, Math.abs(corner.y));
  }
  halfWidth = Math.ceil(halfWidth + SHADOW_MARGIN);
  halfHeight = Math.ceil(halfHeight + SHADOW_MARGIN);
  const key = `${x}|${z}|${halfWidth}|${halfHeight}`;
  if (key === shadowKey) {
    return;
  }
  shadowKey = key;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -halfWidth;
  shadowCamera.right = halfWidth;
  shadowCamera.top = halfHeight;
  shadowCamera.bottom = -halfHeight;
  shadowCamera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
}

/**
 * Uploads every texture and compiles every shader the scene holds, hidden things included, while the loading
 * screen is still up. Otherwise that happens the first time each thing comes into view, and on a phone every
 * such upload or compile is a visible hitch (walking into the capital, the first night, a depleted node).
 */
export function warmUpGpu() {
  const hidden = [];
  const textures = new Set();
  scene.traverse((object) => {
    if (!object.visible) {
      hidden.push(object);
      object.visible = true;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material && material.map && material.map.isTexture) {
        textures.add(material.map);
      }
    }
  });
  for (const texture of textures) {
    renderer.initTexture(texture);
  }
  renderer.compile(scene, camera);
  for (const object of hidden) {
    object.visible = false;
  }
}

export function refreshShadows() {
  renderer.shadowMap.needsUpdate = true;
}

/* Pixel camera: orthographic, looking down at an angle (like RO), with a fixed pixel scale: cameraState.px rendered
   pixels per world unit. At 16 every sprite pixel lands exactly on one rendered pixel. The camera snaps to the
   pixel grid (cameraState.right and cameraState.up are the screen axes), so nothing jitters while nothing moves. */
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
/* Zoom steps in rendered pixels per unit, the same in CSS pixels on every screen: 16, 24, 32, 48 and 64 CSS pixels
   per unit. The renderer draws `renderer.getPixelRatio()` rendered pixels per CSS pixel (a half in pixel mode on a
   desktop, the screen's own ratio on phones and in smooth mode), so a step is that many rendered pixels per unit.
   The sprites (16 px per unit, 32 in smooth mode) stay on whole pixels at every step. Phones start a step further
   out than desktops: 24 CSS pixels per unit shows enough of the world on a small screen. */
const cssToRendered = renderer.getPixelRatio();
export const ZOOM_LEVELS = [16, 24, 32, 48, 64].map((level) => level * cssToRendered);
export const cameraState = {
  yaw: 0,
  tilt: THREE.MathUtils.degToRad(50),
  px: ZOOM_LEVELS[IS_PHONE ? 1 : 2],
  target: new THREE.Vector3(0, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  distance: 60,
};
const scratchVector = new THREE.Vector3();

/** Shakes the camera with `strength` units, fading out over `duration` seconds. */
export function shakeCamera(strength = 0.25, duration = 0.22) {
  cameraState.shakeStrength = Math.max(cameraState.shakeStrength || 0, strength);
  cameraState.shakeTime = duration;
  cameraState.shakeDuration = duration;
}

export function updateCamera() {
  const { yaw, tilt, distance, target, px } = cameraState;
  const height = distance * Math.sin(tilt);
  const horizontal = distance * Math.cos(tilt);
  camera.position.set(
    target.x + Math.sin(yaw) * horizontal,
    target.y + height,
    target.z + Math.cos(yaw) * horizontal,
  );
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld();
  cameraState.right.setFromMatrixColumn(camera.matrixWorld, 0);
  cameraState.up.setFromMatrixColumn(camera.matrixWorld, 1);
  if (cameraState.shakeTime > 0) {
    const amount = cameraState.shakeStrength * (cameraState.shakeTime / cameraState.shakeDuration);
    camera.position
      .addScaledVector(cameraState.right, (Math.random() * 2 - 1) * amount)
      .addScaledVector(cameraState.up, (Math.random() * 2 - 1) * amount);
  } else {
    cameraState.shakeStrength = 0;
  }
  /* snap to whole rendered pixels along the screen axes */
  scratchVector.copy(camera.position);
  const alongRight = scratchVector.dot(cameraState.right);
  const alongUp = scratchVector.dot(cameraState.up);
  camera.position
    .addScaledVector(cameraState.right, Math.round(alongRight * px) / px - alongRight)
    .addScaledVector(cameraState.up, Math.round(alongUp * px) / px - alongUp);
  camera.updateMatrixWorld();
}

/** Puts a world position on the current camera's pixel grid (for sprites, so their pixels do not shift). */
export function snapToPixel(position) {
  const alongRight = position.dot(cameraState.right);
  const alongUp = position.dot(cameraState.up);
  const px = cameraState.px;
  return position
    .addScaledVector(cameraState.right, Math.round(alongRight * px) / px - alongRight)
    .addScaledVector(cameraState.up, Math.round(alongUp * px) / px - alongUp);
}

export function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  /* rendered pixels */
  const renderedWidth = Math.floor(width * renderer.getPixelRatio());
  const renderedHeight = Math.floor(height * renderer.getPixelRatio());
  camera.left = -renderedWidth / cameraState.px / 2;
  camera.right = renderedWidth / cameraState.px / 2;
  camera.top = renderedHeight / cameraState.px / 2;
  camera.bottom = -renderedHeight / cameraState.px / 2;
  camera.updateProjectionMatrix();
}

export function setZoom(px) {
  cameraState.px = px;
  resize();
}

addEventListener("resize", resize);
resize();

/* ---------- areas ---------- */
export const inVillage = (x, z) =>
  Math.abs(x) < VILLAGE_HALF_SIZE && Math.abs(z) < VILLAGE_HALF_SIZE;
export const onRoad = (x) => Math.abs(x) < 1.6;

/* ---------- collisions ---------- */
/* {x, z, r}: a circle; with `box` ({hw, hd, cos, sin}: half width and depth, turned like the object) it is a
   rectangle and r only the radius of the circle around it, for a quick check */
export const obstacles = [];

/* A grid over the obstacles, so a collision check only looks at the ones nearby instead of all ~2000. Obstacles are
   only ever added, so new ones are filed into the grid as they appear. Each is filed in every cell its circle
   (plus the widest figure, GRID_REACH) touches. */
const GRID_CELL = 8;
const GRID_REACH = 1.5;
const grid = new Map();
let filed = 0;
const NO_OBSTACLES = [];

function fileObstacles() {
  for (; filed < obstacles.length; filed++) {
    const obstacle = obstacles[filed];
    const reach = obstacle.r + GRID_REACH;
    for (
      let cx = Math.floor((obstacle.x - reach) / GRID_CELL);
      cx <= Math.floor((obstacle.x + reach) / GRID_CELL);
      cx++
    ) {
      for (
        let cz = Math.floor((obstacle.z - reach) / GRID_CELL);
        cz <= Math.floor((obstacle.z + reach) / GRID_CELL);
        cz++
      ) {
        const key = cx * 4096 + cz;
        let cell = grid.get(key);
        if (!cell) {
          cell = [];
          grid.set(key, cell);
        }
        cell.push(obstacle);
      }
    }
  }
}

/* the obstacles that a figure of radius r at (x, z) could touch */
function obstaclesNear(x, z, r) {
  if (r > GRID_REACH) {
    return obstacles;
  }
  fileObstacles();
  return grid.get(Math.floor(x / GRID_CELL) * 4096 + Math.floor(z / GRID_CELL)) || NO_OBSTACLES;
}

/* The point (x, z) relative to a box obstacle: in the box's own axes. */
function intoBox(obstacle, x, z) {
  const { cos, sin } = obstacle.box;
  const dx = x - obstacle.x;
  const dz = z - obstacle.z;
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}

/* back from the box's axes to the world */
function fromBox(obstacle, lx, lz) {
  const { cos, sin } = obstacle.box;
  return [obstacle.x + lx * cos + lz * sin, obstacle.z - lx * sin + lz * cos];
}

/* how far a circle of radius r at (x, z) overlaps a box: a push [px, pz] in world axes that moves it clear, or null */
function boxPush(obstacle, x, z, r) {
  const { hw, hd } = obstacle.box;
  const [lx, lz] = intoBox(obstacle, x, z);
  const nearestX = Math.max(-hw, Math.min(hw, lx));
  const nearestZ = Math.max(-hd, Math.min(hd, lz));
  const ox = lx - nearestX;
  const oz = lz - nearestZ;
  const distance = Math.hypot(ox, oz);
  if (distance >= r) {
    return null;
  }
  let targetX;
  let targetZ;
  if (distance > 1e-4) {
    /* outside the box, closer than r: out along the line from the nearest point */
    targetX = nearestX + (ox / distance) * r;
    targetZ = nearestZ + (oz / distance) * r;
  } else {
    /* inside the box: out through the nearest side */
    const toSide = [hw - lx, hw + lx, hd - lz, hd + lz];
    const side = toSide.indexOf(Math.min(...toSide));
    targetX = side === 0 ? hw + r : side === 1 ? -hw - r : lx;
    targetZ = side === 2 ? hd + r : side === 3 ? -hd - r : lz;
  }
  return fromBox(obstacle, targetX, targetZ);
}

/* Outside the world? Then back inside: in small steps towards the village, the forest centre or the vale centre,
   whichever is closest. */
function clampToWorld(x, z, margin = 1.2) {
  if (insideWorld(x, z, margin)) {
    return [x, z];
  }
  let best = null;
  let bestDistance = 1e9;
  const anchors = [
    [0, 0],
    [FOREST.cx, FOREST.cz],
    [VALE.cx, VALE.cz],
  ];
  for (const [anchorX, anchorZ] of anchors) {
    const dx = anchorX - x;
    const dz = anchorZ - z;
    const length = Math.hypot(dx, dz) || 1;
    for (let step = 0.3; step < 60; step += 0.3) {
      const px = x + (dx / length) * step;
      const pz = z + (dz / length) * step;
      if (insideWorld(px, pz, margin)) {
        if (step < bestDistance) {
          bestDistance = step;
          best = [px, pz];
        }
        break;
      }
    }
  }
  return best || [0, 4];
}

/** Moves a circle of radius r at (x, z) inside the world and out of every obstacle; returns the new [x, z]. */
export function resolveCollision(x, z, r = 0.35) {
  [x, z] = clampToWorld(x, z);
  for (const obstacle of obstaclesNear(x, z, r)) {
    const dx = x - obstacle.x;
    const dz = z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = obstacle.r + r;
    if (distance < minDistance && obstacle.box) {
      const pushed = boxPush(obstacle, x, z, r);
      if (pushed) {
        [x, z] = pushed;
      }
      continue;
    }
    if (distance < minDistance) {
      if (distance < 1e-4) {
        x += minDistance;
      } else {
        x = obstacle.x + (dx / distance) * minDistance;
        z = obstacle.z + (dz / distance) * minDistance;
      }
    }
  }
  return [x, z];
}

/** True when a circle of radius r at (x, z) lies inside the world and touches no obstacle. */
export function isFree(x, z, r = 0.5) {
  if (!insideWorld(x, z)) {
    return false;
  }
  for (const obstacle of obstaclesNear(x, z, r)) {
    if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + r) {
      if (!obstacle.box || boxPush(obstacle, x, z, r)) {
        return false;
      }
    }
  }
  return true;
}

/* ---------- mouse → ground point ---------- */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();
const groundHit = new THREE.Vector3();

/** The camera ray through screen point (clientX, clientY). */
export function screenRay(clientX, clientY) {
  pointerNdc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  return raycaster;
}

/** The point on the ground (y = 0) under screen point (clientX, clientY), or null. */
export function groundPoint(clientX, clientY) {
  screenRay(clientX, clientY);
  return raycaster.ray.intersectPlane(groundPlane, groundHit) ? groundHit.clone() : null;
}

/* ---------- ground: tile map ---------- */
const TILE = 32;
const UNITS_PER_TILE = 2; /* 32 px over 2 units = 16 px per unit, just like the sprites */
/* the ground map covers the field and the forest above it */
const GROUND_X0 = -FIELD_SIZE - 10;
const GROUND_X1 = FIELD_SIZE + 10;
const GROUND_Z0 = FOREST.z0;
const GROUND_Z1 = FIELD_SIZE + 10;
const GROUND_TILES_X = Math.round((GROUND_X1 - GROUND_X0) / UNITS_PER_TILE);
const GROUND_TILES_Z = Math.round((GROUND_Z1 - GROUND_Z0) / UNITS_PER_TILE);

/** World coordinates → 'grass', 'cobbles' or 'path'. */
export function tileType(x, z) {
  if (Math.hypot(x, z) < SQUARE_RADIUS) {
    return "cobbles";
  }
  if (onRoad(x, z)) {
    return "path";
  }
  return "grass";
}

/* a small deterministic random generator (LCG), so the scenery is the same for everybody */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* filtering for a ground canvas texture: soft with mipmaps in smooth mode, crisp otherwise */
function applyGroundFilter(texture) {
  texture.magFilter = SMOOTH ? THREE.LinearFilter : THREE.NearestFilter;
  if (SMOOTH) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
  } else {
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
}

/* a transparent plane that only shows the cast shadows of buildings and fences, in the outline colour */
function addShadowCatcher(width, depth, x, y, z) {
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.ShadowMaterial({ color: 0x1a1540, opacity: 0.38 }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.set(x, y, z);
  catcher.receiveShadow = true;
  catcher.renderOrder = 1;
  scene.add(catcher);
}

/* picks one of the three grass tiles: mostly plain, sometimes a variant */
function grassTileIndex(random) {
  if (random() < 0.12) {
    return 2;
  }
  return random() < 0.3 ? 1 : 0;
}

function buildGround(atlas, decor) {
  const random = seededRandom(12345);
  const groundCanvas = document.createElement("canvas");
  groundCanvas.width = GROUND_TILES_X * TILE;
  groundCanvas.height = GROUND_TILES_Z * TILE;
  const ctx = groundCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  /* world → canvas pixels */
  const toCanvasX = (worldX) => ((worldX - GROUND_X0) / UNITS_PER_TILE) * TILE;
  const toCanvasZ = (worldZ) => ((worldZ - GROUND_Z0) / UNITS_PER_TILE) * TILE;
  for (let j = 0; j < GROUND_TILES_Z; j++) {
    for (let i = 0; i < GROUND_TILES_X; i++) {
      /* plaza and path are 3D surfaces with kit textures (builders.js) */
      const tileIndex = grassTileIndex(random);
      ctx.drawImage(atlas, tileIndex * TILE, 0, TILE, TILE, i * TILE, j * TILE, TILE, TILE);
    }
  }
  /* The forest: darker, cooler grass; outside the world (behind the tree line) darker still. Per quarter tile, so
     the wavy edges can be followed; the trees on top hide the staircase. */
  const cellPixels = TILE / 4;
  const cellUnits = UNITS_PER_TILE / 4;
  for (let j = 0; j < GROUND_TILES_Z * 4; j++) {
    for (let i = 0; i < GROUND_TILES_X * 4; i++) {
      const x = (i + 0.5) * cellUnits + GROUND_X0;
      const z = (j + 0.5) * cellUnits + GROUND_Z0;
      if (inForest(x, z) && !inFields(x, z)) {
        ctx.fillStyle = "rgba(22,44,38,.34)";
      } else if (!inForest(x, z, -2.5) && !inFields(x, z, -2.5) && !inVale(x, z, -2.5)) {
        ctx.fillStyle = "rgba(10,28,20,.5)";
      } else {
        continue;
      }
      ctx.fillRect(i * cellPixels, j * cellPixels, cellPixels, cellPixels);
    }
  }
  /* some flowers and pebbles in the grass, sparse, and thinner inside the village; only pebbles in the forest */
  for (let k = 0; k < 380; k++) {
    const x = GROUND_X0 + random() * (GROUND_X1 - GROUND_X0);
    const z = GROUND_Z0 + random() * (GROUND_Z1 - GROUND_Z0);
    if (inFields(x, z)) {
      if (tileType(x, z) !== "grass" || (inVillage(x, z) && random() < 0.7)) {
        continue;
      }
    } else if (!inForest(x, z)) {
      continue;
    }
    const img = inForest(x, z)
      ? decor.rock2
      : [decor.flowers, decor.flowers2, decor.rock2, decor.flowers][Math.floor(random() * 4)];
    ctx.drawImage(
      img,
      Math.round(toCanvasX(x) - img.width / 2),
      Math.round(toCanvasZ(z) - img.height / 2),
    );
  }
  const texture = makeTexture(groundCanvas, false);
  applyGroundFilter(texture);
  const width = GROUND_X1 - GROUND_X0;
  const depth = GROUND_Z1 - GROUND_Z0;
  const centerX = (GROUND_X0 + GROUND_X1) / 2;
  const centerZ = (GROUND_Z0 + GROUND_Z1) / 2;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centerX, 0, centerZ);
  scene.add(mesh);
  addShadowCatcher(width, depth, centerX, 0.03, centerZ);
  /* the wide surroundings outside the world */
  buildValeGround(atlas, decor);
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshBasicMaterial({ color: 0x4f7f2a }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.01;
  scene.add(outside);
}

/* The ground of Kingsvale: a tile map of its own (one huge map for everything would need too much texture memory).
   Where it overlaps the field it stays transparent; the meadows are slightly warmer in colour, the city gets
   trodden earth. */
function buildValeGround(atlas, decor) {
  const random = seededRandom(31337);
  const valeX0 = VALE.x0 - 8;
  const valeX1 = -60;
  const valeZ0 = VALE.z0 - 6;
  const valeZ1 = VALE.z1 + 6;
  const tilesX = Math.round((valeX1 - valeX0) / UNITS_PER_TILE);
  const tilesZ = Math.round((valeZ1 - valeZ0) / UNITS_PER_TILE);
  const valeCanvas = document.createElement("canvas");
  valeCanvas.width = tilesX * TILE;
  valeCanvas.height = tilesZ * TILE;
  const ctx = valeCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const toCanvasX = (worldX) => ((worldX - valeX0) / UNITS_PER_TILE) * TILE;
  const toCanvasZ = (worldZ) => ((worldZ - valeZ0) / UNITS_PER_TILE) * TILE;
  /* the field's own ground already lies there */
  const coveredByField = (x, z) => inFields(x, z, -1) && x > -70;
  for (let j = 0; j < tilesZ; j++) {
    for (let i = 0; i < tilesX; i++) {
      const x = (i + 0.5) * UNITS_PER_TILE + valeX0;
      const z = (j + 0.5) * UNITS_PER_TILE + valeZ0;
      if (coveredByField(x, z)) {
        continue;
      }
      const tileIndex = grassTileIndex(random);
      ctx.drawImage(atlas, tileIndex * TILE, 0, TILE, TILE, i * TILE, j * TILE, TILE, TILE);
    }
  }
  const cellPixels = TILE / 4;
  const cellUnits = UNITS_PER_TILE / 4;
  for (let j = 0; j < tilesZ * 4; j++) {
    for (let i = 0; i < tilesX * 4; i++) {
      const x = (i + 0.5) * cellUnits + valeX0;
      const z = (j + 0.5) * cellUnits + valeZ0;
      if (coveredByField(x, z)) {
        continue;
      }
      if (inCapital(x, z, 0.7)) {
        ctx.fillStyle = inCastle(x, z) ? "rgba(120,110,100,.5)" : "rgba(150,122,80,.42)";
      } else if (inVale(x, z)) {
        ctx.fillStyle = "rgba(140,120,30,.1)";
      } else if (!inVale(x, z, -2.5) && !inFields(x, z, -2.5)) {
        ctx.fillStyle = "rgba(10,28,20,.5)";
      } else {
        continue;
      }
      ctx.fillRect(i * cellPixels, j * cellPixels, cellPixels, cellPixels);
    }
  }
  for (let k = 0; k < 420; k++) {
    const x = valeX0 + random() * (valeX1 - valeX0);
    const z = valeZ0 + random() * (valeZ1 - valeZ0);
    if (!inVale(x, z) || inFields(x, z) || inCapital(x, z, -1)) {
      continue;
    }
    const img = [decor.flowers, decor.flowers2, decor.rock2, decor.flowers][
      Math.floor(random() * 4)
    ];
    ctx.drawImage(
      img,
      Math.round(toCanvasX(x) - img.width / 2),
      Math.round(toCanvasZ(z) - img.height / 2),
    );
  }
  const texture = makeTexture(valeCanvas, false);
  applyGroundFilter(texture);
  const width = valeX1 - valeX0;
  const depth = valeZ1 - valeZ0;
  const centerX = (valeX0 + valeX1) / 2;
  const centerZ = (valeZ0 + valeZ1) / 2;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centerX, 0.006, centerZ);
  scene.add(mesh);
  addShadowCatcher(width, depth, centerX, 0.031, centerZ);
}

/* ---------- scenery ---------- */
/* Every billboard in the world as {name, x, z, scale} (the world map and the night lights read them). */
export const billboards = [];
/* The ones that change (gathering nodes): real Billboard objects, updated every frame. */
const dynamicBillboards = [];
/* The static ones, drawn in batches once the world is built: {texture, width, height, x, z, shadow}. */
const staticBillboards = [];
/* The pixel-3D builds, merged into a few meshes once the world is built. */
const placedGroups = [];
/* Life in the scenery for ambience.js: chimney tops (world points that smoke), water surfaces ({x, y, z, r}) and
   parts that turn ({object, speed} in radians per second around their z axis, like mill sails). */
export const smokeSources = [];
export const waterSpots = [];
export const spinners = [];

/* Billboards (trees, bushes, small objects): village objects (32 px kit) at scale .65, trees and rocks (16 px kit)
   at 1.3; then they match the 24 px hero. Static ones (the default) are drawn in batches (batching.js) and resolve
   to a plain record; `dynamic: true` gives a Billboard of its own that can be hidden, moved or clicked. */
async function prop(name, x, z, { radius = 0, shadow = 0, scale = 0.65, dynamic = false } = {}) {
  const texture = await loadTexture("sprites/" + name + ".png");
  if (!texture) {
    throw new Error("Sprite missing: " + name);
  }
  const width = (texture.image.width / SHEET_SCALE / PPU) * scale;
  const height = (texture.image.height / SHEET_SCALE / PPU) * scale;
  if (radius > 0) {
    obstacles.push({ x, z, r: radius });
  }
  if (!dynamic) {
    const record = { name, x, z, scale };
    billboards.push(record);
    staticBillboards.push({ texture, width, height, x, z, shadow });
    return record;
  }
  const billboard = new Billboard(texture, width, height, { shadow });
  billboard.group.position.set(x, 0, z);
  scene.add(billboard.group);
  billboards.push(billboard);
  dynamicBillboards.push(billboard);
  billboard.name = name;
  billboard.x = x;
  billboard.z = z;
  billboard.scale = scale;
  return billboard;
}

/* Places a pixel-3D build (builders.js): buildings, stalls, well, fences, barrels. `rotation`: turn around the
   y axis; the front faces +z. A radius > 0 adds a collision circle. */
function place(group, x, z, { rotation = 0, radius = 0 } = {}) {
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(group);
  placedGroups.push(group);
  addSolids(group, x, z, rotation);
  if (group.userData.smoke || group.userData.water) {
    group.updateMatrixWorld(true);
    for (const point of group.userData.smoke || []) {
      smokeSources.push(group.localToWorld(point.clone()));
    }
    for (const spot of group.userData.water || []) {
      const center = group.localToWorld(new THREE.Vector3(spot.x, spot.y, spot.z));
      waterSpots.push({ x: center.x, y: center.y, z: center.z, r: spot.r });
    }
  }
  if (radius > 0) {
    obstacles.push({ x, z, r: radius });
  }
  return group;
}

/* Buildings and objects are solid: a box obstacle for the footprint of each build (or for each part it lists in
   userData.solids, such as the two sides of a gatehouse). Flat things (lower than SOLID_HEIGHT) stay walkable. */
const SOLID_HEIGHT = 0.3;
const localBox = new THREE.Box3();
function addSolids(group, x, z, rotation) {
  let solids = group.userData.solids;
  if (!solids) {
    /* the footprint of the build in its own axes: measured unturned at the origin */
    group.position.set(0, 0, 0);
    group.rotation.y = 0;
    group.updateMatrixWorld(true);
    localBox.setFromObject(group);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    group.updateMatrixWorld(true);
    if (localBox.isEmpty() || localBox.max.y < SOLID_HEIGHT) {
      return;
    }
    solids = [
      {
        x: (localBox.min.x + localBox.max.x) / 2,
        z: (localBox.min.z + localBox.max.z) / 2,
        w: localBox.max.x - localBox.min.x,
        d: localBox.max.z - localBox.min.z,
      },
    ];
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  for (const solid of solids) {
    const hw = solid.w / 2;
    const hd = solid.d / 2;
    obstacles.push({
      x: x + solid.x * cos + solid.z * sin,
      z: z - solid.x * sin + solid.z * cos,
      r: Math.hypot(hw, hd),
      box: { hw, hd, cos, sin },
    });
  }
}

/* The static billboards in batches: one InstancedMesh per picture and size, one for all their blob shadows. */
function buildBillboardBatches() {
  const groups = new Map();
  const shadows = [];
  for (const item of staticBillboards) {
    const key = `${item.texture.uuid}|${item.width.toFixed(4)}|${item.height.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, { ...item, positions: [] });
    }
    groups.get(key).positions.push({ x: item.x, z: item.z });
    if (item.shadow > 0) {
      shadows.push({ x: item.x, z: item.z, diameter: item.shadow });
    }
  }
  for (const group of groups.values()) {
    const geometry = new THREE.PlaneGeometry(group.width, group.height);
    geometry.translate(0, group.height / 2, 0);
    scene.add(createBillboardBatch(group.texture, geometry, group.positions, cameraState.yaw));
  }
  if (shadows.length) {
    scene.add(
      createShadowBatch(BLOB_SHADOW.geometry, BLOB_SHADOW.material, shadows, BLOB_SHADOW.y),
    );
  }
  staticBillboards.length = 0;
}

/** Builds the whole world: ground, village, fields, forest and the capital. Resolves when every sprite is loaded. */
export async function buildWorld() {
  const [atlas, flowers, flowers2, rock2] = await Promise.all(
    ["ground", "flowers", "flowers2", "rock2"].map((name) =>
      loadTexture("sprites/" + name + ".png", { raw: true }),
    ),
  );
  if (!atlas || !flowers || !flowers2 || !rock2) {
    throw new Error("Ground sprites missing");
  }
  buildGround(atlas.image, {
    flowers: flowers.image,
    flowers2: flowers2.image,
    rock2: rock2.image,
  });
  await builders.loadTextures();
  /* promises of every prop being loaded */
  const pending = [];
  const lantern = (x, z) => pending.push(prop("lantern", x, z, { radius: 0.25 }));
  const treeOptions = { radius: 0.55, shadow: 1.8, scale: 1.3 };
  const bushOptions = { shadow: 1, scale: 1.3 };

  /* ----- the village: a square with the well, a crossing of roads, houses along the roads, and life around it ----- */
  scene.add(builders.plaza(SQUARE_RADIUS));
  /* the through road north-south, through both gates */
  scene.add(builders.path(3.2, FIELD_SIZE * 2));
  /* the village road east-west */
  scene.add(builders.path(2.6, VILLAGE_HALF_SIZE * 2 - 2, { rotation: Math.PI / 2 }));
  place(builders.well(), 0, 0, { radius: 1.1 });

  /* the square: stalls, benches, lanterns, wares */
  /* the stalls stand on the edge of the square, clear of the house fronts behind them */
  place(builders.stall({ cloth: "cloth_red" }), -7.6, -5, { radius: 1.7, rotation: 0.25 });
  place(builders.stall({ cloth: "cloth_green", w: 2.8 }), 7.8, -5, {
    radius: 1.6,
    rotation: -0.25,
  });
  place(builders.barrel(), -5.6, -8.6, { radius: 0.45 });
  place(builders.barrel(), -4.6, -8.9, { radius: 0.45 });
  place(builders.chest(), -11.4, -5.9, { radius: 0.5, rotation: 0.3 });
  place(builders.chest(0.7), 11.2, -5.9, { radius: 0.45, rotation: 0.5 });
  place(builders.barrel(), 12.4, -5.8, { radius: 0.45 });
  /* four benches on the diagonals around the well, all facing the well */
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    place(builders.bench(), Math.sin(angle) * 4.6, Math.cos(angle) * 4.6, {
      radius: 0.8,
      rotation: angle + Math.PI,
    });
  }
  for (const [x, z] of [
    [-6.5, 6.5],
    [6.5, 6.5],
    [6.5, -6.5],
    [-6.5, -6.5],
  ]) {
    lantern(x * 1.3, z * 1.3);
  }

  /* houses along the east-west road, each with a little path from the door to the road */
  const houses = [
    /* half-timbered house */
    [{ w: 6, d: 5, wallTexture: "wall" }, -13, -10, 0],
    /* tavern */
    [{ w: 7.5, d: 5.5, h: 3.4, roofHeight: 2.6, wallTexture: "wall", windows: 3 }, 13, -10, 0],
    /* wooden house */
    [{ w: 6.5, d: 5, wallTexture: "wood", windows: 2 }, 13.5, 10.5, Math.PI],
    /* smithy */
    [{ w: 6, d: 5, h: 2.8, roofHeight: 2, wallTexture: "stone", windows: 1 }, -13.5, 10.5, Math.PI],
  ];
  for (const [options, x, z, rotation] of houses) {
    place(builders.house(options), x, z, {
      radius: Math.max(options.w, options.d) / 2 + 0.4,
      rotation,
    });
    /* the door sits on the left of the front wall */
    const doorX = x + (rotation ? 1 : -1) * (-options.w / 2 + 1.3);
    const doorZ = z + ((rotation ? -1 : 1) * options.d) / 2;
    scene.add(
      builders.path(1.6, Math.abs(doorZ) - 1.3, {
        x: doorX,
        z: (doorZ + (rotation ? -1.3 : 1.3)) / 2,
      }),
    );
  }
  /* the forge next to the smithy: anvil, woodpile, chest */
  pending.push(
    prop("anvil", -9.2, 8.2, { radius: 0.5, shadow: 1 }),
    prop("woodpile", -16.5, 6.4, { radius: 0.6, shadow: 1.2 }),
  );
  place(builders.chest(), -9.1, 10.6, { radius: 0.5, rotation: 0.4 });
  /* behind the tavern: barrels and hay */
  place(builders.barrel(), 17.6, -12.4, { radius: 0.45 });
  place(builders.barrel(), 18.4, -11.6, { radius: 0.45 });
  place(builders.hayBale(), 18.1, -6.1, { radius: 0.7, rotation: 0.4 });
  place(builders.hayBale(), 18.6, -8.4, { radius: 0.7, rotation: -0.2 });
  /* vegetable gardens and a pond */
  place(builders.garden(4.5, 3), -14, -17.5, { radius: 2.4 });
  place(builders.garden(4, 3), 14, 17.6, { radius: 2.2 });
  place(builders.pond(2.4), 6.5, 15.5, { radius: 3.1 });
  for (const [x, z] of [
    [3.6, 13.2],
    [9.8, 13.6],
    [4.2, 18.2],
  ]) {
    pending.push(prop("rock", x, z, { radius: 0.5, shadow: 1.2, scale: 1.1 }));
  }
  pending.push(prop("bush", 9.6, 17.8, bushOptions), prop("flowers", 3.2, 16.4, { scale: 1.6 }));
  pending.push(prop("cart", -7.6, -14.8, { radius: 1.2, shadow: 2.6 }));
  /* signs at the gates and by the square */
  pending.push(
    prop("sign", 2.4, 9.2, { radius: 0.4 }),
    prop("sign", 3.4, -VILLAGE_HALF_SIZE + 2.6, { radius: 0.4 }),
    prop("sign", -3.4, VILLAGE_HALF_SIZE - 2.6, { radius: 0.4 }),
  );
  lantern(-VILLAGE_HALF_SIZE + 1.2, 3.2);
  lantern(-VILLAGE_HALF_SIZE + 1.2, -3.2);
  pending.push(prop("sign", -VILLAGE_HALF_SIZE + 2.6, 3.4, { radius: 0.4 }));
  lantern(3.2, -VILLAGE_HALF_SIZE + 1.2);
  lantern(-3.2, -VILLAGE_HALF_SIZE + 1.2);
  lantern(3.2, VILLAGE_HALF_SIZE - 1.2);
  lantern(-3.2, VILLAGE_HALF_SIZE - 1.2);

  /* planting: trees in the corners, bushes by the houses, flowers around the square */
  const villageTrees = [
    ["tree", -19, -19],
    ["pine", -16, -20],
    ["tree2", -19.5, -4],
    ["tree", 19, -19],
    ["pine2", 20, -15],
    ["tree2", 19.5, 4],
    ["tree", -19, 18.5],
    ["pine", -20, 14],
    ["tree2", 19.5, 19],
    ["pine", -6, 19.5],
    ["tree", 10, -19.5],
  ];
  for (const [name, x, z] of villageTrees) {
    pending.push(prop(name, x, z, treeOptions));
  }
  const villageBushes = [
    [-9.6, -11.6],
    [-16.6, -12],
    [9.4, -13],
    [17, -13.8],
    [10, 13.2],
    [17.4, 12.6],
    [-17.2, 12.8],
    [-10, 13.4],
    [-5, -10.6],
    [5.4, -10.8],
    [-10.4, 3],
    [10.6, 3],
  ];
  for (const [x, z] of villageBushes) {
    pending.push(prop("bush", x, z, bushOptions));
  }
  const villageFlowers = [
    [-9, 0],
    [9, 0],
    [-4, 9.6],
    [4, 9.6],
    [-9.4, -3.4],
    [9.4, 3.4],
    [-15.6, -6.2],
    [15.8, 6],
  ];
  for (const [x, z] of villageFlowers) {
    pending.push(prop("flowers", x, z, { scale: 1.6 }));
  }

  /* palisade around the village, with gates on the road in the north and south and an opening for the village
     road in the west; the east side is closed */
  const FENCE_STEP = 2.6;
  for (let i = -VILLAGE_HALF_SIZE + FENCE_STEP / 2; i < VILLAGE_HALF_SIZE; i += FENCE_STEP) {
    const inGate = Math.abs(i) <= GATE_HALF_WIDTH;
    if (!inGate) {
      place(builders.fence(FENCE_STEP), i, -VILLAGE_HALF_SIZE, { radius: 1.2 });
      place(builders.fence(FENCE_STEP), i, VILLAGE_HALF_SIZE, { radius: 1.2 });
      place(builders.fence(FENCE_STEP), -VILLAGE_HALF_SIZE, i, {
        radius: 1.2,
        rotation: Math.PI / 2,
      });
    }
    place(builders.fence(FENCE_STEP), VILLAGE_HALF_SIZE, i, { radius: 1.2, rotation: Math.PI / 2 });
  }

  /* ----- the farmland east of the village: two plots of grain, a scarecrow, hay; placed before the trees, which
     then grow around it ----- */
  place(builders.garden(8, 4.5, { crops: true }), 32.5, -3.6, { radius: 4.4 });
  place(builders.garden(8, 4.5, { crops: true }), 32.5, 2.6, { radius: 4.4 });
  place(builders.scarecrow(), 38.2, -0.5, { radius: 0.5, rotation: -0.4 });
  place(builders.hayBale(), 27.4, -7.2, { radius: 0.7, rotation: 0.3 });
  place(builders.hayBale(), 26.6, -5.9, { radius: 0.7, rotation: -0.5 });

  /* lanterns along the roads out of the village, so the way to the forest and to Aurelia is lit at night */
  for (const [index, x] of [-31, -44, -57, -70, -86].entries()) {
    lantern(x, index % 2 ? -2.5 : 2.5);
  }
  for (const [index, z] of [-31, -43, -54, 31, 44].entries()) {
    lantern(index % 2 ? -2.6 : 2.6, z);
  }

  /* ----- outside the village: fields and forest ----- */
  const random = seededRandom(777);
  const outsideVillage = (x, z, margin) =>
    Math.abs(x) > VILLAGE_HALF_SIZE + margin || Math.abs(z) > VILLAGE_HALF_SIZE + margin;
  const fieldPlants = ["tree", "tree", "tree2", "pine", "pine", "pine2", "bush"];
  let placed = 0;
  let attempts = 0;
  while (placed < 170 && attempts++ < 4000) {
    const x = random() * 2 * (FIELD_SIZE - 2) - (FIELD_SIZE - 2);
    const z = random() * 2 * (FIELD_SIZE - 2) - (FIELD_SIZE - 2);
    /* not in the village, not on the roads */
    if (
      !outsideVillage(x, z, 2.5) ||
      Math.abs(x) < 3.5 ||
      (x < -VILLAGE_HALF_SIZE && Math.abs(z) < 3.2)
    ) {
      continue;
    }
    /* denser forest towards the edge of the world */
    const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
    if (edgeDistance < FIELD_SIZE - 10 && random() < 0.45) {
      continue;
    }
    if (!isFree(x, z, 2.2)) {
      continue;
    }
    const name = fieldPlants[Math.floor(random() * fieldPlants.length)];
    pending.push(prop(name, x, z, name === "bush" ? bushOptions : treeOptions));
    placed++;
  }
  for (let k = 0; k < 28; k++) {
    const x = random() * 2 * (FIELD_SIZE - 3) - (FIELD_SIZE - 3);
    const z = random() * 2 * (FIELD_SIZE - 3) - (FIELD_SIZE - 3);
    if (
      !outsideVillage(x, z, 2) ||
      Math.abs(x) < 3 ||
      (x < -VILLAGE_HALF_SIZE && Math.abs(z) < 3) ||
      !isFree(x, z, 1.5)
    ) {
      continue;
    }
    pending.push(prop("rock", x, z, { radius: 0.6, shadow: 1.4, scale: 1.2 }));
  }

  /* A tree border along the wavy edge of the field: the inner row closes it off (collision), outside it three more
     loose rows so the world fades into forest. Nothing stands where the forest or the vale overlaps the field. */
  const borderRows = [
    /* [offset from the edge, closed row, chance] */
    [-1.3, true, 1],
    [1.6, false, 1],
    [4.4, false, 0.85],
    [7.4, false, 0.7],
    [10.4, false, 0.5],
  ];
  for (let theta = 0; theta < Math.PI * 2; theta += 2.3 / 60) {
    const edge = fieldEdge(theta);
    for (const [offset, isClosed, chance] of borderRows) {
      const distance = edge + offset + (isClosed ? 0 : (random() - 0.5) * 1.6);
      const x = Math.sin(theta) * distance + (isClosed ? 0 : (random() - 0.5) * 1.2);
      const z = Math.cos(theta) * distance;
      if (inForest(x, z) || inVale(x, z) || random() > chance) {
        continue;
      }
      let name;
      if (random() < 0.6) {
        name = "pine";
      } else {
        name = random() < 0.5 ? "tree" : "tree2";
      }
      pending.push(prop(name, x, z, { radius: isClosed ? 0.7 : 0, shadow: 1.8, scale: 1.3 }));
    }
  }

  const context = { scene, prop, place, isFree, seededRandom, pending, obstacles, spinners };
  buildForest(context);
  buildCapital(context);
  buildProfessionSites(context);
  await Promise.all(pending);
  /* draw the static scenery in bulk (batching.js): the same picture, far fewer draw calls */
  buildBillboardBatches();
  mergeStaticGroups(scene, placedGroups);
  placedGroups.length = 0;
  renderer.shadowMap.needsUpdate = true;
}

export function updateBillboards() {
  updateBatchUniforms(cameraState);
  for (const billboard of dynamicBillboards) {
    billboard.update(cameraState);
  }
}
