/* Eldoria – the village surroundings in pixel 3D, like Ragnarok Online: solid 3D shapes (boxes, roofs, cylinders)
   covered with tileable pixel textures in the palette of the sprites (sprites/tex/, made by tools/build_sprites.py),
   with a dark outline like the sprites have. Figures and plants stay flat sprites.
   Sizes are in world units; the textures have 16 px per unit, just like the sprites.
   Every builder returns a THREE.Group (or a ground mesh) facing +z; userData.mapKind tells the world map what it is. */
import * as THREE from "three";
import { SMOOTH } from "./sprites.js";

const PPU = 16;
const baseImages = new Map(); /* name → loaded image */
const textureVariants = new Map(); /* name|rx|ry → cloned texture with its own repeat */
const TEXTURE_NAMES = [
  "wall",
  "roof",
  "stone",
  "wood",
  "wood_dark",
  "cloth_red",
  "cloth_green",
  "glass",
  "water",
  "cobbles",
  "cobbles2",
  "path",
  "hay",
  "soil",
  "crypt_wall",
  "crypt_floor",
  "iron",
  "carpet",
];
const OUTLINE_COLOR = 0x0c0f2a;

/** Loads all textures from sprites/tex/; must finish before any builder runs. */
export function loadTextures() {
  return Promise.all(
    TEXTURE_NAMES.map(
      (name) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            baseImages.set(name, img);
            resolve();
          };
          img.onerror = () => reject(new Error("Texture missing: " + name));
          img.src = "sprites/tex/" + name + ".png";
        }),
    ),
  );
}

/* width and height of one tile in world units */
const tileWidth = (name) => baseImages.get(name).width / PPU;
const tileHeight = (name) => baseImages.get(name).height / PPU;

/** A texture that repeats rx × ry times; pixel-sharp (nearest) unless smooth mode is on. Cached per repeat. */
export function texture(name, rx = 1, ry = 1) {
  const key = `${name}|${rx.toFixed(3)}|${ry.toFixed(3)}`;
  if (textureVariants.has(key)) {
    return textureVariants.get(key);
  }
  const result = new THREE.Texture(baseImages.get(name));
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(rx, ry);
  result.magFilter = SMOOTH ? THREE.LinearFilter : THREE.NearestFilter;
  if (SMOOTH) {
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true;
    result.anisotropy = 4;
  } else {
    /* no mipmaps: no switching levels */
    result.minFilter = THREE.NearestFilter;
    result.generateMipmaps = false;
  }
  result.colorSpace = THREE.SRGBColorSpace;
  result.needsUpdate = true;
  textureVariants.set(key, result);
  return result;
}

/** Lit material for a surface of w × h units: the texture repeats at true size; `tint` darkens it a little. */
export const material = (name, w, h, tint = 1) =>
  new THREE.MeshLambertMaterial({
    map: texture(name, w / tileWidth(name), h / tileHeight(name)),
    color: new THREE.Color(tint, tint, tint),
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

const colorMaterial = (hex, tint = 1) =>
  new THREE.MeshLambertMaterial({
    color: new THREE.Color(hex).multiplyScalar(tint),
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR });

/* ground surfaces without polygon offset, otherwise they sink below the grass */
const groundMaterial = (name, w, h) =>
  new THREE.MeshLambertMaterial({ map: texture(name, w / tileWidth(name), h / tileHeight(name)) });

/* dark outline along sharp edges, like the outline of the sprites */
function outline(mesh, thresholdAngle = 35) {
  mesh.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thresholdAngle), outlineMaterial),
  );
  return mesh;
}

/* an outlined box standing on y = 0 */
function box(w, h, d, boxMaterial) {
  const mesh = outline(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMaterial));
  mesh.position.y = h / 2;
  return mesh;
}

/* A box where each face repeats the texture at true size. One material for all six faces (one draw call instead
   of six): the uvs are scaled per face and the shading tint per face lives in the vertex colours. */
const blockMaterials = new Map();
function blockMaterial(name) {
  let result = blockMaterials.get(name);
  if (!result) {
    result = new THREE.MeshLambertMaterial({
      map: texture(name, 1, 1),
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    blockMaterials.set(name, result);
  }
  return result;
}

function block(w, h, d, name, tint = 1) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  const tw = tileWidth(name);
  const th = tileHeight(name);
  /* face order of BoxGeometry: +x −x +y −y +z −z */
  const faceSizes = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  const faceTints = [0.88, 0.88, 0.95, 1, 1, 0.92];
  const colors = [];
  for (let face = 0; face < 6; face++) {
    const [faceWidth, faceHeight] = faceSizes[face];
    const shade = tint * faceTints[face];
    for (let i = face * 4; i < face * 4 + 4; i++) {
      uv.setXY(i, (uv.getX(i) * faceWidth) / tw, (uv.getY(i) * faceHeight) / th);
      colors.push(shade, shade, shade);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = outline(new THREE.Mesh(geometry, blockMaterial(name)));
  mesh.position.y = h / 2;
  return mesh;
}

/* a double-sided sloped plane (roof side, awning) of width w and slope length `length` */
function slope(w, length, name, tint) {
  const plane = outline(
    new THREE.Mesh(new THREE.PlaneGeometry(w, length), material(name, w, length, tint)),
  );
  plane.material.side = THREE.DoubleSide;
  return plane;
}

/* the four corners of a rectangle, as unit signs */
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
/* the two sides of a gable roof: [sign, tint]; the back side is a little darker */
const ROOF_SIDES = [
  [1, 1],
  [-1, 0.85],
];

/* ---------- house: walls, plinth, door, windows, gable roof with overhang, gables, ridge beam and chimney ---------- */
export function house({
  w = 6,
  d = 5,
  h = 3,
  roofHeight = 2.2,
  wallTexture = "wall",
  windows = 2,
  chimney = true,
} = {}) {
  const group = new THREE.Group();
  group.add(block(w, h, d, wallTexture));
  group.add(block(w + 0.1, 0.5, d + 0.1, "stone"));
  /* door and windows on the front (+z) */
  const door = box(0.9, 1.7, 0.08, material("wood_dark", 0.9, 1.7));
  door.position.set(-w / 2 + 1.3, 0.85, d / 2 + 0.04);
  group.add(door);
  for (let i = 0; i < windows; i++) {
    const x = w / 2 - 1 - i * 1.6;
    const glass = box(0.8, 0.9, 0.08, material("glass", 0.8, 0.9));
    glass.position.set(x, 1.8, d / 2 + 0.04);
    group.add(glass);
  }
  for (const side of [1, -1]) {
    const glass = box(0.08, 0.9, 0.8, material("glass", 0.8, 0.9));
    glass.position.set(side * (w / 2 + 0.04), 1.8, 0);
    group.add(glass);
  }
  /* gable roof: ridge along x, slopes to the front and back */
  const overhang = 0.45;
  const span = d / 2 + overhang;
  const slopeLength = Math.hypot(span, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, span);
  for (const [sign, tint] of ROOF_SIDES) {
    const roofSide = slope(w + 2 * overhang, slopeLength, "roof", tint);
    roofSide.rotation.x = -Math.PI / 2 + sign * slopeAngle;
    roofSide.position.set(0, h + roofHeight / 2, (sign * span) / 2);
    group.add(roofSide);
  }
  /* closed gable ends, in the wall texture */
  const triangle = new THREE.Shape();
  triangle.moveTo(-d / 2, 0);
  triangle.lineTo(d / 2, 0);
  triangle.lineTo(0, roofHeight);
  triangle.closePath();
  const gableGeometry = new THREE.ShapeGeometry(triangle);
  const gableUv = gableGeometry.attributes.uv;
  for (let i = 0; i < gableUv.count; i++) {
    gableUv.setXY(
      i,
      gableUv.getX(i) / tileWidth(wallTexture),
      gableUv.getY(i) / tileHeight(wallTexture),
    );
  }
  for (const side of [1, -1]) {
    const gable = outline(
      new THREE.Mesh(
        gableGeometry,
        new THREE.MeshLambertMaterial({
          map: texture(wallTexture, 1, 1),
          color: new THREE.Color(0.9, 0.9, 0.9),
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      ),
    );
    gable.rotation.y = (side * Math.PI) / 2;
    gable.position.set((side * w) / 2, h, 0);
    group.add(gable);
  }
  /* ridge beam and roof edges */
  const ridge = box(w + 2 * overhang + 0.1, 0.18, 0.22, material("wood_dark", w, 0.2));
  ridge.position.y = h + roofHeight - 0.02;
  group.add(ridge);
  for (const side of [1, -1]) {
    const edge = box(w + 2 * overhang, 0.16, 0.12, material("wood_dark", w, 0.2));
    edge.position.set(0, h - 0.04, side * span);
    group.add(edge);
  }
  if (chimney) {
    const stack = block(0.7, roofHeight * 0.95, 0.7, "stone");
    stack.position.set(w / 2 - 1.1, h + roofHeight * 0.25, -d * 0.15);
    group.add(stack);
    /* where the smoke comes out (ambience.js) */
    group.userData.smoke = [new THREE.Vector3(w / 2 - 1.1, h + roofHeight * 0.725, -d * 0.15)];
  }
  group.userData.mapKind = "house";
  return group;
}

/* ---------- wooden fence: two posts and two rails per segment (length `length`, along x) ---------- */
export function fence(length = 2.6, h = 1.25) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const post = box(0.2, h, 0.2, material("wood_dark", 0.2, h));
    post.position.x = side * (length / 2 - 0.1);
    group.add(post);
  }
  for (const y of [h * 0.42, h * 0.8]) {
    const rail = box(length, 0.16, 0.1, material("wood", length, 0.16));
    rail.position.y = y;
    group.add(rail);
  }
  group.userData.mapKind = "fence";
  return group;
}

/* ---------- well: stone rim with water, two posts, a crossbeam and a small roof ---------- */
export function well() {
  const group = new THREE.Group();
  const rim = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1, 0.9, 12), material("stone", 6, 0.9)),
    40,
  );
  rim.position.y = 0.45;
  group.add(rim);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 12),
    groundMaterial("water", 1.6, 1.6),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.62;
  group.add(water);
  for (const side of [-1, 1]) {
    const post = box(0.18, 2.2, 0.18, material("wood_dark", 0.2, 2.2));
    post.position.set(side * 0.85, 0, 0);
    group.add(post);
  }
  const beam = box(1.9, 0.16, 0.16, material("wood", 1.9, 0.16));
  beam.position.y = 1.5;
  group.add(beam);
  const span = 0.9;
  const roofHeight = 0.6;
  const slopeLength = Math.hypot(span, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, span);
  for (const [sign, tint] of ROOF_SIDES) {
    const roofSide = slope(2.2, slopeLength, "roof", tint);
    roofSide.rotation.x = -Math.PI / 2 + sign * slopeAngle;
    roofSide.position.set(0, 2.2 + roofHeight / 2, (sign * span) / 2);
    group.add(roofSide);
  }
  group.userData.mapKind = "well";
  return group;
}

/* ---------- market stall: counter, four posts, a sloping cloth awning and some wares ---------- */
export function stall({ cloth = "cloth_red", w = 3.2, d = 1.6 } = {}) {
  const group = new THREE.Group();
  const counter = block(w, 0.95, d * 0.75, "wood");
  counter.position.z = d * 0.1;
  group.add(counter);
  const counterTop = box(w + 0.1, 0.1, d * 0.75 + 0.1, material("wood_dark", w, 0.1));
  counterTop.position.set(0, 0.95, d * 0.1);
  group.add(counterTop);
  for (const [x, z] of CORNERS) {
    const post = box(0.16, 2.4, 0.16, material("wood_dark", 0.16, 2.4));
    post.position.set(x * (w / 2 - 0.1), 0, z * (d / 2 - 0.1));
    group.add(post);
  }
  const awningLength = d + 0.6;
  const awningAngle = Math.atan2(0.5, awningLength);
  const awning = slope(w + 0.4, awningLength, cloth, 1);
  awning.rotation.x = -Math.PI / 2 + awningAngle;
  awning.position.set(0, 2.55, 0.1);
  group.add(awning);
  const valance = box(w + 0.4, 0.35, 0.05, material(cloth, w + 0.4, 0.35));
  valance.position.set(0, 2.15, d / 2 + 0.32);
  group.add(valance);
  const wares = [
    [-1, 0.3, "wood"],
    [0, 0.25, "wood_dark"],
    [1, 0.35, "stone"],
  ];
  for (const [x, wareHeight, name] of wares) {
    const crate = block(0.6, wareHeight, 0.5, name);
    crate.position.set(x * 0.95, 1, d * 0.1);
    group.add(crate);
  }
  group.userData.mapKind = "stall";
  return group;
}

/* ---------- barrel and chest ---------- */
export function barrel() {
  const group = new THREE.Group();
  const body = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 10), material("wood", 2.3, 0.95)),
    40,
  );
  body.position.y = 0.475;
  group.add(body);
  for (const y of [0.2, 0.75]) {
    const hoop = outline(
      new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.08, 10), colorMaterial(0x3d3333)),
      40,
    );
    hoop.position.y = y;
    group.add(hoop);
  }
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.36, 10), material("wood_dark", 0.72, 0.72));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 0.96;
  group.add(lid);
  group.userData.mapKind = "small";
  return group;
}

export function chest(w = 0.85) {
  const group = new THREE.Group();
  group.add(block(w, w * 0.85, w, "wood"));
  for (const [x, z] of CORNERS) {
    const corner = box(0.08, w * 0.85, 0.08, material("wood_dark", 0.1, w));
    corner.position.set((x * w) / 2, 0, (z * w) / 2);
    group.add(corner);
  }
  group.userData.mapKind = "small";
  return group;
}

/* ---------- bench: seat, backrest and four legs ---------- */
export function bench() {
  const group = new THREE.Group();
  const seat = box(1.7, 0.1, 0.5, material("wood", 1.7, 0.5));
  seat.position.y = 0.45;
  group.add(seat);
  const backrest = box(1.7, 0.45, 0.08, material("wood", 1.7, 0.45));
  backrest.position.set(0, 0.6, -0.22);
  group.add(backrest);
  for (const [x, z] of CORNERS) {
    const leg = box(0.1, 0.45, 0.1, material("wood_dark", 0.1, 0.45));
    leg.position.set(x * 0.75, 0, z * 0.18);
    group.add(leg);
  }
  group.userData.mapKind = "small";
  return group;
}

/* ---------- hay bale: a roll lying on its side ---------- */
export function hayBale() {
  const group = new THREE.Group();
  const roll = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10), material("hay", 3, 1.1)),
    40,
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.y = 0.5;
  group.add(roll);
  group.userData.mapKind = "hay";
  return group;
}

/* ---------- pond: water with a stone rim ---------- */
export function pond(r = 2.4) {
  const group = new THREE.Group();
  /* the water comes up to just below the stone rim, so it reads as a filled pond and not as a hole */
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r + 0.1, 24),
    groundMaterial("water", r * 2, r * 2),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.3;
  group.add(water);
  const rim = outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.5, r + 0.6, 0.4, 24, 1, true),
      material("stone", (r + 0.5) * 6, 0.4),
    ),
    40,
  );
  rim.position.y = 0.2;
  group.add(rim);
  const rimTop = new THREE.Mesh(
    new THREE.RingGeometry(r, r + 0.5, 24),
    groundMaterial("stone", r * 2, r * 2),
  );
  rimTop.rotation.x = -Math.PI / 2;
  rimTop.position.y = 0.405;
  group.add(rimTop);
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.4, 24, 1, true),
    material("stone", r * 6, 0.4),
  );
  innerWall.position.y = 0.2;
  innerWall.material.side = THREE.BackSide;
  group.add(innerWall);
  group.userData.mapKind = "pond";
  /* the water surface, for the glints on it (ambience.js) */
  group.userData.water = [{ x: 0, y: 0.3, z: 0, r }];
  return group;
}

/* ---------- vegetable garden: tilled soil with a low fence around it, optionally rows of grain ---------- */
export function garden(w = 4, d = 3, { crops = false } = {}) {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMaterial("soil", w, d));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.025;
  group.add(soil);
  if (crops) {
    /* rows along x, a sheaf of grain every 0.55 units, each a little taller or shorter */
    let seed = Math.round(w * 97 + d * 31);
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let z = -d / 2 + 0.55; z < d / 2 - 0.3; z += 0.75) {
      for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += 0.48) {
        const height = 0.5 + random() * 0.25;
        /* golden and without an outline: a field reads as one mass of grain, not as a grid of boxes */
        const sheaf = block(0.42, height, 0.4, "hay", 1.12 + random() * 0.14);
        sheaf.remove(sheaf.children[0]);
        sheaf.position.set(x, height / 2, z);
        group.add(sheaf);
      }
    }
  }
  const segmentsX = Math.max(2, Math.round(w / 1.3));
  const segmentsZ = Math.max(2, Math.round(d / 1.3));
  for (let i = 0; i < segmentsX; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / segmentsX;
    for (const z of [-d / 2, d / 2]) {
      const segment = fence(w / segmentsX, 0.7);
      segment.position.set(x, 0, z);
      group.add(segment);
    }
  }
  for (let i = 0; i < segmentsZ; i++) {
    const z = -d / 2 + ((i + 0.5) * d) / segmentsZ;
    for (const x of [-w / 2, w / 2]) {
      const segment = fence(d / segmentsZ, 0.7);
      segment.rotation.y = Math.PI / 2;
      segment.position.set(x, 0, z);
      group.add(segment);
    }
  }
  group.userData.mapKind = "garden";
  return group;
}

/* ---------- scarecrow: a post with a crossbar, a sack head with a hat and a coat ---------- */
export function scarecrow() {
  const group = new THREE.Group();
  group.add(box(0.14, 2, 0.14, material("wood_dark", 0.14, 2)));
  const arms = box(1.8, 0.12, 0.12, material("wood_dark", 1.8, 0.12));
  arms.position.y = 1.45;
  group.add(arms);
  const coat = block(0.75, 0.75, 0.4, "cloth_red", 0.85);
  coat.position.y = 1.2;
  group.add(coat);
  const head = block(0.45, 0.45, 0.42, "hay", 0.95);
  head.position.y = 1.85;
  group.add(head);
  const brim = block(0.8, 0.06, 0.7, "wood_dark", 0.9);
  brim.position.y = 2.1;
  group.add(brim);
  const crown = block(0.42, 0.3, 0.38, "wood_dark", 0.8);
  crown.position.y = 2.28;
  group.add(crown);
  group.userData.mapKind = "small";
  return group;
}

/* ---------- forest: an old altar of stacked stone and a standing stone ---------- */
export function altar() {
  const group = new THREE.Group();
  group.add(block(3.2, 0.35, 2.4, "stone", 0.86));
  const middle = block(2.3, 0.5, 1.6, "stone", 0.94);
  middle.position.y = 0.35 + 0.25;
  group.add(middle);
  const top = block(1.7, 0.3, 1.1, "stone", 1.04);
  top.position.y = 0.85 + 0.15;
  group.add(top);
  group.userData.mapKind = "altar";
  return group;
}

export function menhir(h = 2.2) {
  const group = new THREE.Group();
  group.add(block(0.8, h, 0.6, "stone", 0.84));
  const cap = block(0.6, 0.3, 0.45, "stone", 0.9);
  cap.position.y = h + 0.15;
  group.add(cap);
  group.userData.mapKind = "menhir";
  return group;
}

/* ---------- plaza and path as textures on the ground (no polygon offset, otherwise they sink below the grass) ---------- */

/** A round ground surface; the village cobbles count as a plaza on the map, any other texture as a clearing. */
export function plaza(radius, textureName = "cobbles", tint = 1) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    groundMaterial(textureName, radius * 2, radius * 2),
  );
  mesh.material.color.setScalar(tint);
  mesh.userData.mapKind = { kind: textureName === "cobbles" ? "plaza" : "clearing", r: radius };
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

/* ---------- dirt roads: a texture drawn per road width, in the palette of the sprites ----------
   One tile is the full width of the road (16 pixels per unit, like everything else) and ROAD_LENGTH units long,
   repeating along the road. Packed earth with a little colour variation, two wheel ruts on real roads, pebbles,
   grass in the middle strip, and ragged edges where the grass grows over (transparent pixels: the grass shows
   through), with a darker rim. Everything that varies along the road is periodic, so the tile repeats without a
   seam. */
const ROAD_H = 64;
const ROAD_LENGTH = ROAD_H / PPU;
const roadCanvases = new Map();

function roadImage(w) {
  if (roadCanvases.has(w)) {
    return roadCanvases.get(w);
  }
  const roadCanvas = document.createElement("canvas");
  roadCanvases.set(w, roadCanvas);
  roadCanvas.width = w;
  roadCanvas.height = ROAD_H;
  const ctx = roadCanvas.getContext("2d");
  /* footpaths (to a door) are narrow: no ruts, less of everything */
  const isRoad = w >= 38;
  let seed = 4021 + w;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const dot = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(((x % w) + w) % w, ((y % ROAD_H) + ROAD_H) % ROAD_H, 1, 1);
  };
  /* packed earth, with patches of lighter and darker soil */
  ctx.fillStyle = "#dc9462";
  ctx.fillRect(0, 0, w, ROAD_H);
  for (let i = 0; i < Math.round((26 * w) / 48); i++) {
    const cx = random() * w;
    const cy = random() * ROAD_H;
    const color = random() < 0.5 ? "#e7a36d" : "#cf8656";
    const r = 1.5 + random() * 3;
    for (let y = -r; y <= r; y++) {
      for (let x = -r * 1.4; x <= r * 1.4; x++) {
        if ((x / 1.4) ** 2 + y * y <= r * r && random() < 0.85) {
          dot(Math.round(cx + x), Math.round(cy + y), color);
        }
      }
    }
  }
  /* two wheel ruts, a little wavy */
  for (let y = 0; isRoad && y < ROAD_H; y++) {
    const sway = Math.round(Math.sin((y / ROAD_H) * Math.PI * 4) * 0.6);
    for (const center of [w * 0.3, w * 0.7]) {
      const x = Math.round(center) + sway;
      dot(x, y, "#c07a4e");
      if (random() < 0.7) {
        dot(x + 1, y, "#c98252");
      }
    }
  }
  /* pebbles */
  for (let i = 0; i < Math.round((40 * w) / 48); i++) {
    const x = Math.floor(random() * w);
    const y = Math.floor(random() * ROAD_H);
    dot(x, y, random() < 0.5 ? "#f2c08a" : "#a8694a");
    if (random() < 0.3) {
      dot(x + 1, y, "#b5754f");
    }
  }
  /* grass in the middle strip, between the ruts */
  for (let i = 0; isRoad && i < 18; i++) {
    const x = Math.round(w / 2 + (random() - 0.5) * w * 0.18);
    const y = Math.floor(random() * ROAD_H);
    dot(x, y, "#a6b04f");
    if (random() < 0.6) {
      dot(x, y - 1, "#8c9a3f");
    }
  }
  /* ragged edges: the grass reaches 1–5 pixels into the road, with a darker rim just inside */
  const reach = isRoad ? 1 : 0.6;
  const depth = (y, phase) =>
    reach *
    (2.6 +
      1.3 * Math.sin((y / ROAD_H) * Math.PI * 2 * 3 + phase) +
      0.9 * Math.sin((y / ROAD_H) * Math.PI * 2 * 7 + phase * 2));
  for (let y = 0; y < ROAD_H; y++) {
    const left = Math.max(1, Math.round(depth(y, 0.7)));
    const right = Math.max(1, Math.round(depth(y, 2.9)));
    ctx.clearRect(0, y, left, 1);
    ctx.clearRect(w - right, y, right, 1);
    dot(left, y, "#b5754f");
    dot(w - right - 1, y, "#b5754f");
  }
  return roadCanvas;
}

const roadTextures = new Map();
function roadMaterial(width, length) {
  const pixels = Math.max(16, Math.round(width * PPU));
  const repeat = length / ROAD_LENGTH;
  const key = pixels + "|" + repeat.toFixed(3);
  let map = roadTextures.get(key);
  if (!map) {
    map = new THREE.CanvasTexture(roadImage(pixels));
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, repeat);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    roadTextures.set(key, map);
  }
  /* alphaTest: the ragged edge is cut out pixel-sharp, the grass under it shows */
  return new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 });
}

/** A straight dirt road of `width` × `length`, centred on (x, z) and turned by `rotation` around the y axis. */
export function path(width, length, { x = 0, z = 0, rotation = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMaterial(width, length));
  mesh.userData.mapKind = { kind: "path", w: width, l: length };
  mesh.rotation.order = "YXZ";
  mesh.rotation.y = rotation;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.015, z);
  return mesh;
}

/* ====================== Aurelia: city walls, towers, gates, the castle and city life ====================== */

/* Battlements along a length (along x), at height y, on both sides of a wall of `thickness`.
   As one instanced mesh: dozens of merlons per wall cost a single draw call instead of seven per merlon. */
const merlonGeometry = new THREE.BoxGeometry(0.7, 0.6, 0.3);
function battlements(group, length, y, thickness) {
  const positions = [];
  for (let x = -length / 2 + 0.45; x < length / 2 - 0.2; x += 1.3) {
    positions.push(x);
  }
  const merlons = new THREE.InstancedMesh(
    merlonGeometry,
    material("stone", 0.7, 0.6, 0.9),
    positions.length * 2,
  );
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const x of positions) {
    for (const side of [-1, 1]) {
      matrix.makeTranslation(x, y + 0.3, side * (thickness / 2 - 0.15));
      merlons.setMatrixAt(index++, matrix);
    }
  }
  merlons.instanceMatrix.needsUpdate = true;
  group.add(merlons);
}

/* ---------- city wall: a stone segment (length along x) with a plinth and battlements ---------- */
export function wall(length = 6, h = 4, thickness = 1.4) {
  const group = new THREE.Group();
  group.add(block(length, h, thickness, "stone", 0.96));
  group.add(block(length, 0.5, thickness + 0.3, "stone", 0.85));
  battlements(group, length, h, thickness);
  group.userData.mapKind = "wall";
  return group;
}

/* ---------- round tower with a conical roof, or open with battlements ---------- */
export function tower(r = 2, h = 7, { hasRoof = true } = {}) {
  const group = new THREE.Group();
  const body = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), material("stone", r * 6.5, h)),
    40,
  );
  body.position.y = h / 2;
  group.add(body);
  const rim = outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.18, r * 1.08, 0.6, 12),
      material("stone", r * 7, 0.6),
    ),
    40,
  );
  rim.position.y = h + 0.3;
  group.add(rim);
  if (hasRoof) {
    const cone = outline(
      new THREE.Mesh(
        new THREE.ConeGeometry(r * 1.3, r * 1.7, 12),
        material("roof", r * 8, r * 1.7, 0.95),
      ),
      30,
    );
    cone.position.y = h + 0.6 + r * 0.85;
    group.add(cone);
  } else {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const merlon = block(0.6, 0.55, 0.35, "stone", 0.9);
      merlon.position.set(Math.cos(angle) * r * 1.05, h + 0.6, Math.sin(angle) * r * 1.05);
      merlon.rotation.y = -angle;
      group.add(merlon);
    }
  }
  for (const y of [h * 0.45, h * 0.75]) {
    const windowPane = box(0.3, 0.7, 0.1, material("wood_dark", 0.3, 0.7));
    windowPane.position.set(0, y, r + 0.02);
    group.add(windowPane);
  }
  group.userData.mapKind = "tower";
  group.userData.top = hasRoof ? h + 0.6 + r * 1.7 : h + 0.6;
  return group;
}

/* ---------- flag: a pole with a cloth (children[1] is the cloth, the mill reuses it as a sail) ---------- */
export function flag(h = 2.4, cloth = "cloth_red") {
  const group = new THREE.Group();
  const pole = box(0.12, h, 0.12, material("wood_dark", 0.12, h));
  group.add(pole);
  const banner = box(1.3, 0.75, 0.05, material(cloth, 1.3, 0.75));
  banner.position.set(0.7, h - 0.45, 0);
  group.add(banner);
  const knob = outline(
    new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), colorMaterial(0xe6bb63)),
    50,
  );
  knob.position.y = h + 0.1;
  group.add(knob);
  return group;
}

/* ---------- gatehouse: two side blocks, a span with battlements, a raised portcullis and flags; the passage runs along z ---------- */
export function gatehouse({ w = 9, h = 5.5, d = 3.2, opening = 3.6 } = {}) {
  const group = new THREE.Group();
  const sideWidth = (w - opening) / 2;
  for (const side of [-1, 1]) {
    const sideBlock = block(sideWidth, h, d, "stone", 0.96);
    sideBlock.position.x = side * (opening / 2 + sideWidth / 2);
    group.add(sideBlock);
    const plinth = block(sideWidth, 0.5, d + 0.3, "stone", 0.85);
    plinth.position.x = side * (opening / 2 + sideWidth / 2);
    group.add(plinth);
  }
  const span = block(w, h * 0.42, d, "stone", 0.92);
  span.position.y = h * 0.58;
  group.add(span);
  battlements(group, w, h, d);
  const portcullis = box(opening, 1.1, 0.1, material("wood_dark", opening, 1.1));
  portcullis.position.set(0, h * 0.58 - 0.4, d / 2 + 0.05);
  group.add(portcullis);
  for (const x of [-opening / 2 - 0.4, opening / 2 + 0.4]) {
    const frame = box(0.25, h * 0.5, 0.25, material("wood_dark", 0.25, h * 0.5));
    frame.position.set(x, h * 0.1, d / 2 + 0.15);
    group.add(frame);
  }
  for (const side of [-1, 1]) {
    const banner = flag(2.2);
    banner.position.set(side * (w / 2 - 0.8), h + 0.3, 0);
    group.add(banner);
  }
  group.userData.mapKind = "gatehouse";
  /* only the two side blocks are solid: the passage between them stays open (world.js place) */
  group.userData.solids = [-1, 1].map((side) => ({
    x: side * (opening / 2 + sideWidth / 2),
    z: 0,
    w: sideWidth,
    d: d + 0.3,
  }));
  return group;
}

/* ---------- the castle keep: four corner towers, a central tower, battlements, gate, stairs and banners ---------- */
export function keep({ w = 16, d = 12, h = 8 } = {}) {
  const group = new THREE.Group();
  group.add(block(w, h, d, "stone", 0.98));
  group.add(block(w + 0.6, 1, d + 0.6, "stone", 0.85));
  battlements(group, w, h, d);
  for (const side of [-1, 1]) {
    const sideBattlements = new THREE.Group();
    sideBattlements.rotation.y = Math.PI / 2;
    sideBattlements.position.x = side * (w / 2);
    battlements(sideBattlements, d, h, 0.3);
    group.add(sideBattlements);
  }
  for (const [x, z] of CORNERS) {
    const cornerTower = tower(2.2, 11);
    cornerTower.position.set(x * (w / 2), 0, z * (d / 2));
    group.add(cornerTower);
    const banner = flag(2.2);
    banner.position.set(x * (w / 2), 11 + 0.6 + 2.2 * 1.7 - 0.2, z * (d / 2));
    group.add(banner);
  }
  const centralTower = tower(3, 15);
  centralTower.position.set(0, 0, -1.5);
  group.add(centralTower);
  const topFlag = flag(3, "cloth_red");
  topFlag.position.set(0, 15 + 0.6 + 3 * 1.7 - 0.2, -1.5);
  group.add(topFlag);
  /* the gate with a stone arch, windows and banners on the front */
  const door = box(2.8, 3.6, 0.12, material("wood_dark", 2.8, 3.6));
  door.position.set(0, 1.8, d / 2 + 0.06);
  group.add(door);
  const arch = block(3.6, 0.5, 0.9, "stone", 0.9);
  arch.position.set(0, 3.6, d / 2 + 0.3);
  group.add(arch);
  for (const x of [-5.5, -3, 3, 5.5]) {
    const windowPane = box(0.8, 1.3, 0.08, material("glass", 0.8, 1.3));
    windowPane.position.set(x, 5.2, d / 2 + 0.04);
    group.add(windowPane);
  }
  for (const x of [-5.5, 5.5]) {
    const banner = box(1.1, 2.6, 0.06, material("cloth_red", 1.1, 2.6));
    banner.position.set(x, 2.4, d / 2 + 0.05);
    group.add(banner);
  }
  /* a wide staircase up to the gate */
  for (let i = 0; i < 3; i++) {
    const step = block(6 - i * 0.8, 0.32, 1.1, "stone", 0.92);
    step.position.set(0, i * 0.32, d / 2 + 1.6 - i * 0.55);
    group.add(step);
  }
  group.userData.mapKind = "keep";
  /* solid: the body and the corner towers; the stairs up to the gate can be climbed */
  group.userData.solids = [
    { x: 0, z: 0, w, d },
    ...CORNERS.map(([x, z]) => ({ x: x * (w / 2), z: z * (d / 2), w: 4.4, d: 4.4 })),
  ];
  return group;
}

/* ---------- fountain: a basin with water, a column and an upper bowl ---------- */
export function fountain(r = 2.6) {
  const group = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    groundMaterial("water", r * 2, r * 2),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  group.add(water);
  const rim = outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.5, r + 0.6, 0.6, 24, 1, true),
      material("stone", (r + 0.5) * 6, 0.6),
    ),
    40,
  );
  rim.position.y = 0.3;
  group.add(rim);
  const rimTop = new THREE.Mesh(
    new THREE.RingGeometry(r, r + 0.5, 24),
    groundMaterial("stone", r * 2, r * 2),
  );
  rimTop.rotation.x = -Math.PI / 2;
  rimTop.position.y = 0.605;
  group.add(rimTop);
  const column = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 2.2, 10), material("stone", 3, 2.2)),
    40,
  );
  column.position.y = 1.1;
  group.add(column);
  const bowl = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.7, 0.4, 14), material("stone", 7, 0.4)),
    40,
  );
  bowl.position.y = 2.4;
  group.add(bowl);
  const bowlWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 14),
    groundMaterial("water", 2, 2),
  );
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.y = 2.61;
  group.add(bowlWater);
  const spire = outline(
    new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), material("stone", 2, 0.9)),
    40,
  );
  spire.position.y = 3.05;
  group.add(spire);
  group.userData.mapKind = "fountain";
  group.userData.water = [{ x: 0, y: 0.42, z: 0, r: r - 0.2 }];
  return group;
}

/* ---------- statue: a pedestal with a (simplified) stone knight ---------- */
export function statue() {
  const group = new THREE.Group();
  group.add(block(2, 1.3, 2, "stone", 0.9));
  const pedestalTop = block(1.4, 0.4, 1.4, "stone", 0.95);
  pedestalTop.position.y = 1.3;
  group.add(pedestalTop);
  const body = block(0.8, 1.6, 0.55, "stone", 0.82);
  body.position.y = 1.7;
  group.add(body);
  const head = outline(
    new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), material("stone", 2, 1, 0.85)),
    50,
  );
  head.position.y = 3.6;
  group.add(head);
  const sword = block(0.14, 2, 0.14, "stone", 0.75);
  sword.position.set(0.55, 2.3, 0.2);
  group.add(sword);
  const shield = block(0.5, 0.9, 0.12, "stone", 0.8);
  shield.position.set(-0.55, 2.2, 0.2);
  group.add(shield);
  group.userData.mapKind = "statue";
  return group;
}

/* ---------- church: a tall nave with a square tower and a spire ---------- */
export function church() {
  const group = house({
    w: 8,
    d: 11,
    h: 4.2,
    roofHeight: 3.2,
    wallTexture: "stone",
    windows: 3,
    chimney: false,
  });
  /* the bell tower stands on the back-left corner of the nave */
  const towerX = -8 / 2 + 1.6;
  const towerZ = -11 / 2 + 1.6;
  const belfry = block(3.2, 10, 3.2, "stone", 0.96);
  belfry.position.set(towerX, 0, towerZ);
  group.add(belfry);
  const spire = outline(
    new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.2, 4), material("roof", 8, 3.2, 0.95)),
    30,
  );
  spire.rotation.y = Math.PI / 4;
  spire.position.set(towerX, 11.6, towerZ);
  group.add(spire);
  for (const y of [5, 7.5]) {
    const windowPane = box(0.6, 1.1, 0.1, material("glass", 0.6, 1.1));
    windowPane.position.set(towerX, y, towerZ + 1.62);
    group.add(windowPane);
  }
  const cross = new THREE.Group();
  cross.add(block(0.12, 1, 0.12, "stone", 0.8));
  const crossBar = block(0.6, 0.12, 0.12, "stone", 0.8);
  crossBar.position.y = 0.7;
  cross.add(crossBar);
  cross.position.set(towerX, 13.2, towerZ);
  group.add(cross);
  group.userData.mapKind = "church";
  return group;
}

/* ---------- tent for the bandit camp: two sloping cloths on a ridge pole ---------- */
export function tent(w = 3, d = 3.2, cloth = "cloth_green") {
  const group = new THREE.Group();
  const roofHeight = 1.7;
  const span = w / 2;
  const slopeLength = Math.hypot(span, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, span);
  for (const [sign, tint] of ROOF_SIDES) {
    const side = slope(d, slopeLength, cloth, tint);
    side.rotation.order = "YXZ";
    side.rotation.y = Math.PI / 2;
    side.rotation.x = -Math.PI / 2 + sign * slopeAngle;
    side.position.set((sign * span) / 2, roofHeight / 2, 0);
    group.add(side);
  }
  const ridge = box(0.12, 0.12, d + 0.3, material("wood_dark", 0.2, d));
  ridge.position.y = roofHeight;
  group.add(ridge);
  for (const side of [-1, 1]) {
    const pole = box(0.14, roofHeight, 0.14, material("wood_dark", 0.14, roofHeight));
    pole.position.z = side * (d / 2);
    group.add(pole);
  }
  group.userData.mapKind = "tent";
  return group;
}

/* ---------- street: cobbles on the ground, like path() but with the city cobbles ---------- */
export function street(width, length, { x = 0, z = 0, rotation = 0 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    groundMaterial("cobbles2", width, length),
  );
  mesh.userData.mapKind = { kind: "street", w: width, l: length };
  mesh.rotation.order = "YXZ";
  mesh.rotation.y = rotation;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.018, z);
  return mesh;
}

/* ---------- square city plaza (counts as street on the map) ---------- */
export function squarePlaza(w, d, textureName = "cobbles2") {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMaterial(textureName, w, d));
  mesh.userData.mapKind = { kind: "street", w, l: d };
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

/* ---------- crafting stations (rules/professions.js); the fire and glow effects are added by stations.js ---------- */

/* an unlit material for things that glow (coals, potions, runes) */
const glowMaterial = (hex) => new THREE.MeshBasicMaterial({ color: hex });

/** Forge: a stone hearth with glowing coals, a hood and a chimney, a water trough beside it. */
export function forge() {
  const group = new THREE.Group();
  const hearth = block(1.8, 0.9, 1.3, "stone", 0.9);
  group.add(hearth);
  const coals = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), glowMaterial(0xff7a2a));
  coals.rotation.x = -Math.PI / 2;
  coals.position.set(0, 0.91, 0.1);
  group.add(coals);
  for (const x of [-0.75, 0.75]) {
    const pillar = block(0.3, 1.4, 0.3, "stone", 0.82);
    pillar.position.set(x, 0.9, -0.45);
    group.add(pillar);
  }
  const hood = block(1.8, 0.45, 0.9, "stone", 0.78);
  hood.position.set(0, 2.3, -0.3);
  group.add(hood);
  const chimney = block(0.7, 1.4, 0.6, "stone", 0.86);
  chimney.position.set(0, 2.75, -0.45);
  group.add(chimney);
  group.userData.smoke = [new THREE.Vector3(0, 3.45, -0.45)];
  const trough = block(0.9, 0.45, 0.5, "wood_dark");
  trough.position.set(1.45, 0, 0.25);
  group.add(trough);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.36),
    groundMaterial("water", 0.75, 0.36),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(1.45, 0.43, 0.25);
  group.add(water);
  group.userData.mapKind = "station";
  return group;
}

/** Alchemy table: a workbench with flasks in three colours, a mortar and a little rack. */
export function alchemyTable() {
  const group = new THREE.Group();
  const top = box(1.9, 0.12, 0.9, material("wood", 1.9, 0.9));
  top.position.y = 0.9;
  group.add(top);
  for (const [x, z] of CORNERS) {
    const leg = box(0.12, 0.9, 0.12, material("wood_dark", 0.12, 0.9));
    leg.position.set(x * 0.85, 0, z * 0.35);
    group.add(leg);
  }
  const flasks = [
    [-0.6, 0.1, 0xe0413a, 0.34],
    [-0.3, -0.15, 0x3a7be0, 0.26],
    [0.05, 0.12, 0x5ccf4a, 0.3],
  ];
  for (const [x, z, color, h] of flasks) {
    const flask = outline(
      new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, h, 8), glowMaterial(color)),
      40,
    );
    flask.position.set(x, 1.02 + h / 2, z);
    group.add(flask);
  }
  const mortar = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.16, 8), material("stone", 0.6, 0.2)),
    40,
  );
  mortar.position.set(0.5, 1.04, 0.05);
  group.add(mortar);
  const rack = box(1.6, 0.08, 0.25, material("wood_dark", 1.6, 0.25));
  rack.position.set(0, 1.55, -0.35);
  group.add(rack);
  for (const x of [-0.7, 0.7]) {
    const post = box(0.08, 0.7, 0.08, material("wood_dark", 0.08, 0.7));
    post.position.set(x, 0.95, -0.38);
    group.add(post);
  }
  for (const [x, color] of [
    [-0.45, 0xb04ad8],
    [-0.1, 0xf0c23a],
    [0.3, 0x3ad8c8],
  ]) {
    const jar = box(0.18, 0.24, 0.18, glowMaterial(color));
    jar.position.set(x, 1.63, -0.35);
    group.add(jar);
  }
  group.userData.mapKind = "station";
  return group;
}

/** Campfire: a ring of stones, crossed logs, a spit on two forked sticks and a log to sit on. */
export function campfire() {
  const group = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const stone = block(0.32, 0.22, 0.28, "stone", 0.8 + (i % 3) * 0.08);
    stone.position.set(Math.sin(angle) * 0.7, 0, Math.cos(angle) * 0.7);
    stone.rotation.y = angle;
    group.add(stone);
  }
  for (const angle of [0.4, -0.4, Math.PI / 2]) {
    const log = outline(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6),
        material("wood_dark", 0.6, 0.9),
      ),
      40,
    );
    log.rotation.set(Math.PI / 2 - 0.25, angle, 0);
    log.position.y = 0.15;
    group.add(log);
  }
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), glowMaterial(0xff8a2a));
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 0.05;
  group.add(embers);
  for (const x of [-0.75, 0.75]) {
    const stick = box(0.07, 1, 0.07, material("wood_dark", 0.07, 1));
    stick.position.set(x, 0, 0);
    group.add(stick);
  }
  const spit = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 5), material("wood", 0.2, 1.7)),
    40,
  );
  spit.rotation.z = Math.PI / 2;
  spit.position.y = 0.95;
  group.add(spit);
  const seat = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), material("wood", 1.2, 1.3)),
    40,
  );
  seat.rotation.z = Math.PI / 2;
  seat.position.set(0, 0.2, 1.3);
  group.add(seat);
  group.userData.mapKind = "station";
  return group;
}

/** Enchanting altar: a stepped stone base with a violet crystal on top and four rune stones around it. */
export function enchantingAltar() {
  const group = altar();
  const crystal = outline(
    new THREE.Mesh(new THREE.OctahedronGeometry(0.32), glowMaterial(0xb07cff)),
    20,
  );
  crystal.scale.y = 1.6;
  crystal.position.y = 1.65;
  group.add(crystal);
  for (const [x, z] of CORNERS) {
    const runeStone = block(0.36, 0.7, 0.3, "stone", 0.86);
    runeStone.position.set(x * 1.9, 0, z * 1.5);
    group.add(runeStone);
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), glowMaterial(0x9ad8ff));
    glyph.position.set(x * 1.9, 0.4, z * 1.5 + 0.151);
    group.add(glyph);
  }
  group.userData.mapKind = "station";
  return group;
}

/* ---------- the Sunken Crypt (crypt.js): walls, floor, pillars, braziers, tombs, gates, levers, rune stones ---------- */

/** A crypt wall of w × h × d: dark bricks on the sides, the top almost black (you look onto the thick wall). Every
    wall has a material of its own, so crypt.js can fade the ones in front of the hero. */
export function cryptWall(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  const tw = tileWidth("crypt_wall");
  const th = tileHeight("crypt_wall");
  /* face order of BoxGeometry: +x −x +y −y +z −z */
  const faceSizes = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  const faceTints = [0.8, 0.8, 0.32, 0.3, 1, 0.75];
  const colors = [];
  for (let face = 0; face < 6; face++) {
    const [faceWidth, faceHeight] = faceSizes[face];
    for (let i = face * 4; i < face * 4 + 4; i++) {
      uv.setXY(i, (uv.getX(i) * faceWidth) / tw, (uv.getY(i) * faceHeight) / th);
      colors.push(faceTints[face], faceTints[face], faceTints[face]);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const wallMaterial = new THREE.MeshLambertMaterial({
    map: texture("crypt_wall", 1, 1),
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = outline(new THREE.Mesh(geometry, wallMaterial));
  mesh.position.y = h / 2;
  mesh.userData.mapKind = "crypt_wall";
  return mesh;
}

/** The crypt floor: cracked slabs over w × d units, centred on the group's origin. */
export function cryptFloor(w, d, textureName = "crypt_floor") {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMaterial(textureName, w, d));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.userData.mapKind = "crypt_floor";
  return mesh;
}

/** A pillar of dark bricks on a stone foot, with a stone capital. */
export function cryptPillar(h = 2.4) {
  const group = new THREE.Group();
  group.add(block(1, 0.3, 1, "stone", 0.62));
  const shaft = block(0.72, h - 0.55, 0.72, "crypt_wall", 0.95);
  shaft.position.y += 0.3;
  group.add(shaft);
  const capital = block(0.95, 0.25, 0.95, "stone", 0.66);
  capital.position.y += h - 0.25;
  group.add(capital);
  group.userData.mapKind = "crypt_pillar";
  return group;
}

/** A brazier: an iron bowl of glowing coals on a stone pedestal (crypt.js puts the fire in it). */
export function brazier() {
  const group = new THREE.Group();
  group.add(block(0.62, 0.15, 0.62, "stone", 0.6));
  const pedestal = block(0.42, 0.62, 0.42, "stone", 0.7);
  pedestal.position.y += 0.15;
  group.add(pedestal);
  const bowl = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.28, 0.3, 8), material("iron", 1.6, 0.3)),
    40,
  );
  bowl.position.y = 0.92;
  group.add(bowl);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), glowMaterial(0xff7a2a));
  coals.rotation.x = -Math.PI / 2;
  coals.position.y = 1.06;
  group.add(coals);
  group.userData.mapKind = "brazier";
  return group;
}

/** A torch in an iron bracket on a wall, facing +z (crypt.js puts the flame on it). */
export function wallTorch() {
  const group = new THREE.Group();
  const plate = box(0.22, 0.34, 0.06, material("iron", 0.22, 0.34));
  plate.position.set(0, 1.25, 0.03);
  group.add(plate);
  const stick = outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.035, 0.55, 5),
      material("wood_dark", 0.2, 0.55),
    ),
    40,
  );
  stick.rotation.x = 0.5;
  stick.position.set(0, 1.5, 0.18);
  group.add(stick);
  return group;
}

/** A stone tomb: a plinth and a heavy lid, 1.2 wide and 2.2 long along z. */
export function sarcophagus() {
  const group = new THREE.Group();
  group.add(block(1.1, 0.65, 2.1, "stone", 0.62));
  const lid = block(1.25, 0.22, 2.25, "stone", 0.74);
  lid.position.y += 0.65;
  group.add(lid);
  const ridge = block(0.5, 0.12, 1.8, "stone", 0.8);
  ridge.position.y += 0.87;
  group.add(ridge);
  group.userData.mapKind = "crypt_tomb";
  return group;
}

/** An iron gate across a passage `width` wide (bars along x); userData.bars is the part that rises when it opens. */
export function ironGate(width, h = 2.4) {
  const group = new THREE.Group();
  const bars = new THREE.Group();
  const ironMaterial = material("iron", 0.12, h);
  const count = Math.round(width / 0.32);
  for (let i = 0; i <= count; i++) {
    const bar = box(0.1, h, 0.1, ironMaterial);
    bar.position.x = -width / 2 + (i / count) * width;
    bars.add(bar);
  }
  for (const y of [0.35, h - 0.45]) {
    const rail = box(width, 0.12, 0.14, material("iron", width, 0.12));
    rail.position.y = y;
    bars.add(rail);
  }
  group.add(bars);
  group.userData.bars = bars;
  group.userData.mapKind = "crypt_gate";
  return group;
}

/** A lever on a stone block; userData.handle tips over (rotation.x) when it is pulled. */
export function lever() {
  const group = new THREE.Group();
  group.add(block(0.7, 0.45, 0.5, "stone", 0.66));
  const handle = new THREE.Group();
  const rod = outline(
    new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), material("iron", 0.2, 0.8)),
    40,
  );
  rod.position.y = 0.4;
  handle.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), glowMaterial(0x8a2230));
  knob.position.y = 0.82;
  handle.add(knob);
  handle.position.y = 0.45;
  handle.rotation.x = -0.6;
  group.add(handle);
  group.userData.handle = handle;
  group.userData.mapKind = "lever";
  return group;
}

/** A rune stone with `glyph` (a texture) on its face towards +z; userData.glyph is that face, lit when touched. */
export function runeStone(glyph) {
  const group = new THREE.Group();
  group.add(block(0.95, 0.2, 0.75, "stone", 0.58));
  const stone = block(0.75, 1.3, 0.55, "stone", 0.72);
  stone.position.y += 0.2;
  group.add(stone);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ map: glyph, color: 0x9a8ab8, transparent: true }),
  );
  face.position.set(0, 1, 0.281);
  group.add(face);
  group.userData.glyph = face;
  group.userData.mapKind = "rune_stone";
  return group;
}

/** The stairs into the crypt at the altar: a low stone frame around steps that go down into the dark. */
export function cryptEntrance() {
  const group = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), glowMaterial(0x07060c));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.02;
  group.add(pit);
  for (let i = 0; i < 4; i++) {
    const step = block(1.8, 0.03, 0.42, "stone", 0.75 - i * 0.17);
    step.position.set(0, 0.02, 0.95 - i * 0.45);
    group.add(step);
  }
  for (const x of [-1.15, 1.15]) {
    const side = block(0.4, 0.55, 2.9, "stone", 0.8);
    side.position.x = x;
    group.add(side);
  }
  const back = block(2.7, 0.75, 0.4, "stone", 0.86);
  back.position.z = -1.35;
  group.add(back);
  group.userData.solids = [
    { x: -1.15, z: 0, w: 0.4, d: 2.9 },
    { x: 1.15, z: 0, w: 0.4, d: 2.9 },
    { x: 0, z: -1.35, w: 2.7, d: 0.4 },
  ];
  group.userData.mapKind = "crypt_entrance";
  return group;
}

/** Stairs going up out of the crypt, towards −z; the top step lies against the wall behind them. */
export function cryptStairsUp() {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const step = block(2.4, 0.18 * (i + 1), 0.4, "stone", 0.82 - i * 0.04);
    step.position.z = 0.8 - i * 0.4;
    group.add(step);
  }
  group.userData.solids = [];
  group.userData.mapKind = "crypt_stairs";
  return group;
}

/** A spike trap: an iron plate with holes; userData.spikes rises out of it (crypt.js moves it). */
export function spikeTrap(size = 1.8) {
  const group = new THREE.Group();
  const plate = box(size, 0.05, size, material("iron", size, size));
  group.add(plate);
  const spikes = new THREE.Group();
  const spikeMaterial = material("iron", 0.2, 0.5, 1.25);
  const rows = 4;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), spikeMaterial);
      spike.position.set(
        -size / 2 + ((i + 0.5) * size) / rows,
        0.25,
        -size / 2 + ((j + 0.5) * size) / rows,
      );
      spikes.add(spike);
    }
  }
  spikes.position.y = -0.5;
  group.add(spikes);
  group.userData.spikes = spikes;
  group.userData.solids = [];
  return group;
}

/** A pressure plate: a slab that sinks a little when stepped on (userData.plate). */
export function pressurePlate(size = 1.1) {
  const group = new THREE.Group();
  const plate = block(size, 0.08, size, "stone", 0.7);
  group.add(plate);
  group.userData.plate = plate;
  group.userData.solids = [];
  return group;
}

/** The Count's throne: dark stone with a high back and a red seat, facing +z. */
export function throne() {
  const group = new THREE.Group();
  group.add(block(2.2, 0.3, 1.8, "stone", 0.55));
  const seat = block(1.4, 0.55, 1.1, "crypt_wall", 0.9);
  seat.position.y += 0.3;
  group.add(seat);
  const cushion = block(1.1, 0.1, 0.9, "carpet", 1);
  cushion.position.y += 0.85;
  group.add(cushion);
  const back = block(1.5, 2.2, 0.35, "crypt_wall", 0.85);
  back.position.set(0, back.position.y + 0.3, -0.5);
  group.add(back);
  for (const x of [-0.85, 0.85]) {
    const post = block(0.3, 2.9, 0.4, "stone", 0.6);
    post.position.set(x, post.position.y, -0.5);
    group.add(post);
  }
  group.userData.mapKind = "throne";
  return group;
}

/** A wall section with a crack through it (the way into the vault); like cryptWall, plus dark zigzag lines. */
export function crackedWall(w, h, d) {
  const mesh = cryptWall(w, h, d);
  const points = [];
  const zigzag = [
    [-0.1, 0.5],
    [0.15, 0.25],
    [-0.05, 0.05],
    [0.2, -0.15],
    [0, -0.35],
    [0.18, -0.5],
  ];
  for (const side of [1, -1]) {
    for (let i = 0; i < zigzag.length - 1; i++) {
      const [ax, ay] = zigzag[i];
      const [bx, by] = zigzag[i + 1];
      points.push(
        new THREE.Vector3(ax * w, ay * h, (side * d) / 2 + side * 0.01),
        new THREE.Vector3(bx * w, by * h, (side * d) / 2 + side * 0.01),
      );
    }
  }
  mesh.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x08070c }),
    ),
  );
  return mesh;
}
