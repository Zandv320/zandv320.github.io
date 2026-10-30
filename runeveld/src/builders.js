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
  return group;
}

/* ---------- vegetable garden: tilled soil with a low fence around it ---------- */
export function garden(w = 4, d = 3) {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMaterial("soil", w, d));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.025;
  group.add(soil);
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

/** A straight dirt path of `width` × `length`, centred on (x, z) and turned by `rotation` around the y axis. */
export function path(width, length, { x = 0, z = 0, rotation = 0 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    groundMaterial("path", width, length),
  );
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
