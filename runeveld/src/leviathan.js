/* Eldoria – the Grey Leviathan as the players see it (its moves are in rules/bosses.js, its lake in
   rules/tidecrown.js). A sea serpent in the game's own style: shapes outlined in dark ink and skins drawn as pixel
   art. A long neck rises out of the Crownmere in a living S-curve, scaled grey-green on the back, pale plates on
   the belly, a crest of webbed spines along it; a horned head with brow ridges, glowing slit eyes, a jaw full of
   teeth that gapes when it strikes, fanned frills that flutter and whiskers that trail; behind it two coils of
   its body arch out of the water, and further back the tail. Foam rings where it breaks the surface, water
   dripping from its jaw.
   LeviathanModel stands in for a Sprite2D, so the monster code (monsters.js) draws, targets and animates it like any
   other monster: play('idle'|'attack'|'hurt'|'death'), face, nudge, flashHit, tint, freeze. Its tentacles slam
   across the shore (tentacleStrike). */
import * as THREE from "three";
import { scene } from "./world.js";
import { burst } from "./particles.js";
import { LAKE_Y } from "./rules/tidecrown.js";

const WATER_Y = LAKE_Y;
/* how far under the water it goes when it dives */
const DIVE_DEPTH = 12;
/* how fast it rises and sinks, in units per second */
const RISE_SPEED = 9;
/* how much bigger than the model's own units it is drawn */
const SIZE = 1.15;
const INK = 0x0c0f2a;

/* ---------- skins: pixel art drawn once on canvases ---------- */

function canvasTexture(width, height, draw, { repeat = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

const hex = (r, g, b) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const BACK = [38, 62, 64];
const FLANK = [74, 108, 102];
const SHEEN = [118, 156, 146];
const BELLY = [196, 202, 168];
const BELLY_LINE = [146, 150, 118];

/* The skin round the body: x runs along it (repeating), y round it, the back at the top and bottom edges and the
   belly in the middle. Overlapping scales on back and flanks, each with a dark rim below and a light edge above;
   pale plates across the belly; a row of light spots along the spine. */
function skinTexture() {
  const width = 32;
  const height = 64;
  return canvasTexture(
    width,
    height,
    (ctx) => {
      for (let y = 0; y < height; y++) {
        /* 0 on the spine, 1 in the middle of the belly */
        const round = 1 - Math.abs(y / height - 0.5) * 2;
        for (let x = 0; x < width; x++) {
          let color;
          if (round > 0.72) {
            /* the belly plates: lines across the body every four pixels */
            color = x % 4 === 0 ? BELLY_LINE : mix(BELLY, [214, 218, 186], (x % 4) / 6);
          } else {
            /* scales in rows of six pixels round the body, each row shifted half a scale */
            const row = Math.floor(y / 6);
            const sx = (x + (row % 2) * 3) % 6;
            const sy = y % 6;
            const base = mix(BACK, FLANK, Math.min(1, round / 0.55));
            const dx = sx - 2.5;
            const inScale = dx * dx * 0.5 + (sy - 1) * (sy - 1) * 0.6;
            if (sy === 5 || inScale > 5.5) {
              color = mix(base, [16, 26, 30], 0.55);
            } else if (sy === 0 && sx > 0 && sx < 5) {
              color = mix(base, SHEEN, 0.7);
            } else {
              color = mix(base, SHEEN, 0.18 - sy * 0.03);
            }
            if (round < 0.08 && x % 8 === 3) {
              color = [150, 190, 170];
            }
          }
          ctx.fillStyle = hex(...color);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
}

/* A web of skin between spines, for the crest and the frills: x runs along it, y from its root (bottom) to its edge
   (top). Spines every few pixels, the web between them see-through at the tips and cut in curves. */
function webTexture(spineEvery = 6) {
  const width = 48;
  const height = 24;
  return canvasTexture(
    width,
    height,
    (ctx) => {
      for (let x = 0; x < width; x++) {
        const phase = (x % spineEvery) / spineEvery;
        /* the web dips between two spines */
        const edge = height * (0.25 + 0.75 * Math.abs(Math.cos(phase * Math.PI)));
        for (let y = 0; y < height; y++) {
          const fromRoot = height - 1 - y;
          if (fromRoot > edge) {
            continue;
          }
          let color;
          if (x % spineEvery === 0) {
            color = fromRoot > edge - 2 ? [230, 236, 214] : [34, 60, 66];
          } else if (fromRoot > edge - 1.5) {
            color = [24, 40, 46];
          } else {
            color = mix([62, 138, 132], [140, 214, 196], fromRoot / height);
          }
          ctx.fillStyle = hex(...color);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
}

/* the head's skin: small scales all over, darker on top (a tile that repeats both ways) */
function headTexture() {
  return canvasTexture(
    16,
    16,
    (ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const row = Math.floor(y / 4);
          const sx = (x + (row % 2) * 2) % 4;
          const sy = y % 4;
          let color = mix(BACK, FLANK, 0.55);
          if (sy === 3 || (sx === 0 && sy > 0)) {
            color = mix(color, [16, 26, 30], 0.5);
          } else if (sy === 0) {
            color = mix(color, SHEEN, 0.55);
          }
          ctx.fillStyle = hex(...color);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
}

let skins = null;
function textures() {
  skins ??= {
    skin: skinTexture(),
    head: headTexture(),
    crest: webTexture(6),
    frill: webTexture(4),
  };
  return skins;
}

/* ---------- a tube along a moving curve, rebuilt each frame in place ---------- */

const RIGHT = new THREE.Vector3(1, 0, 0);

/**
 * A tube whose shape follows a curve that changes: `segments` rings of `radial` points, its radius from r0 at the
 * start to r1 at the end (`profile(t)` shapes it in between). Round each ring 0 is the back and half way round the
 * belly, so the skin's belly lies underneath. update(curve, grow) moves its points; `grow` thickens it (for the ink
 * outline drawn as a slightly larger tube turned inside out).
 */
class Tube {
  constructor(segments, radial, r0, r1, material, { lengthPerRepeat = 1.6, profile = null } = {}) {
    this.segments = segments;
    this.radial = radial;
    this.r0 = r0;
    this.r1 = r1;
    this.profile = profile;
    this.lengthPerRepeat = lengthPerRepeat;
    const count = (segments + 1) * radial;
    this.positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < radial; j++) {
        uvs[(i * radial + j) * 2 + 1] = j / (radial - 1);
        if (i > 0 && j < radial - 1) {
          const a = (i - 1) * radial + j;
          const b = a + 1;
          const c = i * radial + j;
          const d = c + 1;
          /* wound so the faces look outwards */
          indices.push(a, b, c, b, d, c);
        }
      }
    }
    this.uvs = uvs;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.point = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.binormal = new THREE.Vector3();
  }

  radiusAt(t) {
    const r = this.r0 + (this.r1 - this.r0) * t;
    return this.profile ? r * this.profile(t) : r;
  }

  /** The frame at t along the curve: point, tangent, the back's direction (normal) and the side (binormal). */
  frameAt(curve, t) {
    curve.getPointAt(t, this.point);
    curve.getTangentAt(t, this.tangent);
    this.normal.crossVectors(RIGHT, this.tangent).normalize();
    this.binormal.crossVectors(this.tangent, this.normal).normalize();
    return this;
  }

  update(curve, grow = 0) {
    const { segments, radial, positions, uvs } = this;
    const length = curve.getLength();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      this.frameAt(curve, t);
      const r = this.radiusAt(t) + grow;
      for (let j = 0; j < radial; j++) {
        const angle = (j / (radial - 1)) * Math.PI * 2;
        const k = (i * radial + j) * 3;
        const cos = Math.cos(angle) * r;
        const sin = Math.sin(angle) * r;
        positions[k] = this.point.x + this.normal.x * cos + this.binormal.x * sin;
        positions[k + 1] = this.point.y + this.normal.y * cos + this.binormal.y * sin;
        positions[k + 2] = this.point.z + this.normal.z * cos + this.binormal.z * sin;
        uvs[(i * radial + j) * 2] = (t * length) / this.lengthPerRepeat;
      }
    }
    const geometry = this.mesh.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
}

/* A strip of web standing up along a curve's back (the crest): from t0 to t1, `height(t)` tall, leaning back. */
class Crest {
  constructor(tube, t0, t1, steps, height, material, lengthPerRepeat = 1.4) {
    this.tube = tube;
    this.t0 = t0;
    this.t1 = t1;
    this.steps = steps;
    this.height = height;
    this.lengthPerRepeat = lengthPerRepeat;
    this.positions = new Float32Array((steps + 1) * 2 * 3);
    const uvs = new Float32Array((steps + 1) * 2 * 2);
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 3] = 1;
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    this.uvs = uvs;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  update(curve, flutter = 0) {
    const { tube, steps, positions, uvs } = this;
    const length = curve.getLength();
    for (let i = 0; i <= steps; i++) {
      const t = this.t0 + ((this.t1 - this.t0) * i) / steps;
      tube.frameAt(curve, t);
      const root = tube.radiusAt(t) * 0.82;
      const h = this.height(t);
      const { point, normal, tangent } = tube;
      const sway = Math.sin(flutter + i * 0.7) * 0.06 * h;
      for (const [k, reach] of [
        [0, root],
        [1, root + h],
      ]) {
        const lean = k ? -0.35 * h : 0;
        const o = (i * 2 + k) * 3;
        positions[o] = point.x + normal.x * reach + tangent.x * lean + sway;
        positions[o + 1] = point.y + normal.y * reach + tangent.y * lean;
        positions[o + 2] = point.z + normal.z * reach + tangent.z * lean;
      }
      uvs[i * 4] = uvs[i * 4 + 2] = (t * length) / this.lengthPerRepeat;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.uv.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }
}

/* ---------- the head ---------- */

/* an outline in ink along the hard edges of a static mesh */
function inked(mesh, threshold = 30) {
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, threshold),
      new THREE.LineBasicMaterial({ color: INK }),
    ),
  );
  return mesh;
}

/* a box reshaped: the front (−z) narrowed and lowered by `taper`, the corners pulled in so it reads rounded */
function shapedBox(w, h, d, { taper = 0.4, drop = 0.1, round = 0.18 } = {}) {
  const geometry = new THREE.BoxGeometry(w, h, d, 3, 2, 5);
  const position = geometry.attributes.position;
  for (let k = 0; k < position.count; k++) {
    let x = position.getX(k);
    let y = position.getY(k);
    const z = position.getZ(k);
    const front = Math.max(0, -z / (d / 2));
    x *= 1 - front * taper;
    y = y * (1 - front * taper * 0.6) - front * drop;
    /* the corners: in a little where both x and y are at their edge */
    const corner = (Math.abs(x) / (w / 2)) * (Math.abs(y) / (h / 2));
    x *= 1 - corner * round;
    y *= 1 - corner * round;
    position.setXYZ(k, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* An egg of a shape `w` wide, `h` high and `d` long, narrowed and lowered towards its front (−z) by `taper` and
   `drop`, its underside flattened by `flat`: rounded, but in facets like the rest of the world. */
function shapedEgg(w, h, d, { taper = 0.45, drop = 0.15, flat = 0.4 } = {}) {
  const geometry = new THREE.SphereGeometry(1, 14, 10);
  const position = geometry.attributes.position;
  for (let k = 0; k < position.count; k++) {
    let x = position.getX(k) * (w / 2);
    let y = position.getY(k) * (h / 2);
    const z = position.getZ(k) * (d / 2);
    const front = Math.max(0, -z / (d / 2));
    x *= 1 - front * taper;
    if (y < 0) {
      y *= 1 - flat;
    }
    y = y * (1 - front * taper * 0.5) - front * front * drop;
    position.setXYZ(k, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* the ink outline of a rounded mesh: a copy a little larger, seen from inside */
const inkMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
function inkHull(mesh, grow = 0.05) {
  const hull = new THREE.Mesh(mesh.geometry, inkMaterial);
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  hull.scale.set(1 + (grow / size.x) * 2, 1 + (grow / size.y) * 2, 1 + (grow / size.z) * 2);
  mesh.add(hull);
  return mesh;
}

/* a horn: a cone bent back along a curve */
function hornGeometry(length, radius) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, length * 0.55, length * 0.35),
    new THREE.Vector3(0, length * 0.45, length),
  );
  const geometry = new THREE.TubeGeometry(curve, 8, radius, 6, false);
  /* taper it: thick at the root, a point at the tip */
  const position = geometry.attributes.position;
  const point = new THREE.Vector3();
  for (let k = 0; k < position.count; k++) {
    const ring = Math.floor(k / 7);
    const t = ring / 8;
    curve.getPoint(t, point);
    position.setXYZ(
      k,
      point.x + (position.getX(k) - point.x) * (1 - t * 0.92),
      point.y + (position.getY(k) - point.y) * (1 - t * 0.92),
      point.z + (position.getZ(k) - point.z) * (1 - t * 0.92),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* a fan of web on spines (a frill), spread from its root at the origin out to `reach`, opening over `spread` */
function fanGeometry(reach, spread, rays = 6) {
  const positions = [0, 0, 0];
  const uvs = [0.5, 0];
  const indices = [];
  for (let k = 0; k <= rays * 2; k++) {
    const angle = -spread / 2 + (spread * k) / (rays * 2);
    const r = k % 2 === 0 ? reach : reach * 0.78;
    positions.push(Math.sin(angle) * r, Math.cos(angle) * r, 0);
    uvs.push(k / (rays * 2), 1);
    if (k > 0) {
      indices.push(0, k, k + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------- the tentacles' tubes: rebuilt every frame as they rise and slam ---------- */

/* A tube along `curve` that narrows from radius r0 at its start to r1 at its end (THREE.TubeGeometry keeps one
   radius); `radial` sides, `segments` rings along it. */
function taperedTube(curve, segments, radial, r0, r1) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point);
    const radius = r0 + (r1 - r0) * t;
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * Math.PI * 2;
      const cos = Math.cos(angle) * radius;
      const sin = Math.sin(angle) * radius;
      positions.push(
        point.x + normal.x * cos + binormal.x * sin,
        point.y + normal.y * cos + binormal.y * sin,
        point.z + normal.z * cos + binormal.z * sin,
      );
    }
    if (i > 0) {
      for (let j = 0; j < radial; j++) {
        const a = (i - 1) * radial + j;
        const b = (i - 1) * radial + ((j + 1) % radial);
        const c = i * radial + j;
        const d = i * radial + ((j + 1) % radial);
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------- the serpent ---------- */

const lambert = (options) => new THREE.MeshLambertMaterial(options);
const glow = (color) => new THREE.MeshBasicMaterial({ color });

/* the neck's control points at rest, from under the water behind (+z) up and over to the head (−z) */
const NECK_REST = [
  [0, -4.2, 7.6],
  [0, -0.8, 6.6],
  [0, 2.8, 5],
  [0, 5.4, 2.8],
  [0, 6.7, 0.5],
  [0, 6.5, -1.3],
];

/** The sea serpent's neck, head and coils, behaving like a monster's sprite (see the top of this file). */
export class LeviathanModel {
  constructor() {
    const { skin, head, crest, frill } = textures();
    this.group = new THREE.Group();
    /* everything that rises and sinks with it */
    this.body = new THREE.Group();
    this.body.scale.setScalar(SIZE);
    this.group.add(this.body);

    const skinMaterial = lambert({ map: skin });
    const headSkin = lambert({ map: head });
    head.repeat.set(3, 3);
    const belly = lambert({ color: 0xc4caa8 });
    const bone = lambert({ color: 0xdcd2b4 });
    const webMaterial = (map) =>
      lambert({
        map,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      });
    const crestMaterial = webMaterial(crest);
    const frillMaterial = webMaterial(frill);
    this.materials = [skinMaterial, headSkin, belly, bone, crestMaterial, frillMaterial];
    const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

    /* the neck, its ink outline (a slightly larger tube seen from inside) and its crest */
    const thicker = (t) => 1 + 0.14 * Math.sin(t * Math.PI) - 0.1 * t * t;
    this.neck = new Tube(56, 14, 1.3, 0.66, skinMaterial, {
      profile: thicker,
      lengthPerRepeat: 2.8,
    });
    this.neckInk = new Tube(56, 14, 1.3, 0.66, ink, { profile: thicker });
    this.neckCrest = new Crest(
      this.neck,
      0.1,
      0.9,
      40,
      (t) => 1 * (1 - t * 0.5) * Math.min(1, (t - 0.1) / 0.08),
      crestMaterial,
      5,
    );
    this.body.add(this.neck.mesh, this.neckInk.mesh, this.neckCrest.mesh);
    this.neckPoints = NECK_REST.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.neckCurve = new THREE.CatmullRomCurve3(this.neckPoints);

    /* two coils arching out of the water behind it, and the tail */
    this.coils = [
      { x: -4.6, z: 10.4, span: 2.6, rise: 2, r: 0.95, phase: 0 },
      { x: 3.4, z: 15, span: 2.1, rise: 1.5, r: 0.8, phase: 1.7 },
    ].map((coil) => {
      const points = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
      const tube = new Tube(24, 12, coil.r, coil.r, skinMaterial, { lengthPerRepeat: 3 });
      const outline = new Tube(24, 12, coil.r, coil.r, ink);
      const ridge = new Crest(tube, 0.18, 0.82, 16, () => 0.75, crestMaterial, 4);
      this.body.add(tube.mesh, outline.mesh, ridge.mesh);
      return { ...coil, points, curve: new THREE.CatmullRomCurve3(points), tube, outline, ridge };
    });
    this.tailPoints = [0, 1, 2, 3].map(() => new THREE.Vector3());
    this.tailCurve = new THREE.CatmullRomCurve3(this.tailPoints);
    this.tail = new Tube(20, 10, 0.62, 0.08, skinMaterial, { lengthPerRepeat: 3 });
    this.tailInk = new Tube(20, 10, 0.62, 0.08, ink);
    this.tailFin = new THREE.Mesh(fanGeometry(1.6, 1.3, 5), frillMaterial);
    this.body.add(this.tail.mesh, this.tailInk.mesh, this.tailFin);

    this.head = this.buildHead({ headSkin, belly, bone, frillMaterial });
    this.body.add(this.head);

    /* foam where it breaks the surface: round the neck, both ends of each coil and the tail */
    this.foam = [];
    const foamMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0fbf8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 1.25, 20).rotateX(-Math.PI / 2),
        foamMaterial.clone(),
      );
      ring.renderOrder = 2;
      this.group.add(ring);
      this.foam.push(ring);
    }

    /* what a click catches: the head and the top of the neck (unseen, but there) */
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 3.4, 5).translate(0, 0, -1.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.head.add(this.mesh);

    this.height = 7.6 * SIZE;
    this.tintColor = 0xffffff;
    this.facing = new THREE.Vector2(0, 1);
    this.anim = "idle";
    this.animTime = 0;
    this.time = Math.random() * 10;
    this.flash = 0;
    this.freezeTime = 0;
    this.flinch = 0;
    this.nudgeVector = new THREE.Vector2();
    this.dripIn = 0.5;
    /* how far it has sunk: DIVE_DEPTH under the water, 0 up; it starts under */
    this.depth = DIVE_DEPTH;
    this.isUnder = true;
    this.body.position.y = -DIVE_DEPTH * SIZE;
    this.basis = new THREE.Matrix4();
    this.jawTip = new THREE.Vector3();
  }

  /* the head, built facing −z with its top up: a wedge of a skull wide at the jaw muscles and narrow at the snout,
     brows, horns, glowing eyes, the jaw with teeth and tongue, frills and whiskers */
  buildHead({ headSkin, belly, bone, frillMaterial }) {
    const head = new THREE.Group();
    const skull = inkHull(
      new THREE.Mesh(shapedEgg(1.8, 1.2, 2.7, { taper: 0.55, drop: 0.25, flat: 0.55 }), headSkin),
    );
    skull.position.set(0, 0.08, -1.05);
    head.add(skull);
    /* the jaw muscles bulging behind the eyes */
    for (const side of [-1, 1]) {
      const cheek = inkHull(
        new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8).scale(0.75, 0.85, 1.1), headSkin),
      );
      cheek.position.set(side * 0.68, -0.02, 0.05);
      head.add(cheek);
    }
    /* the inside of the mouth, dark, seen when the jaw drops */
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.06, 2.1).translate(0, -0.42, -1.1),
      lambert({ color: 0x4a1622 }),
    );
    head.add(mouth);
    /* heavy ridges over the eyes, and a row of knobs down the middle of the skull */
    for (const side of [-1, 1]) {
      const brow = inked(
        new THREE.Mesh(shapedBox(0.42, 0.24, 0.9, { taper: 0.55, drop: -0.05 }), headSkin),
      );
      brow.position.set(side * 0.5, 0.62, -0.72);
      brow.rotation.set(0.18, side * 0.2, side * -0.3);
      head.add(brow);
    }
    for (let k = 0; k < 4; k++) {
      const knob = inked(new THREE.Mesh(new THREE.ConeGeometry(0.12 - k * 0.015, 0.34, 5), bone));
      knob.position.set(0, 0.66 - k * 0.04, -0.6 + k * 0.38);
      knob.rotation.x = 0.6;
      head.add(knob);
    }
    /* swept-back horns, and smaller ones below them */
    for (const side of [-1, 1]) {
      const horn = inked(new THREE.Mesh(hornGeometry(1.7, 0.17), bone));
      horn.position.set(side * 0.45, 0.55, -0.1);
      horn.rotation.set(0.1, side * 0.35, side * -0.22);
      head.add(horn);
      const small = inked(new THREE.Mesh(hornGeometry(0.75, 0.09), bone));
      small.position.set(side * 0.82, 0.2, 0.15);
      small.rotation.set(-0.15, side * 1, side * -0.45);
      head.add(small);
    }
    /* eyes under the brows that glow, with the slit of a pupil; drawn over the night haze */
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 8).scale(0.7, 1, 1.3),
        glow(0xffd84a),
      );
      eye.position.set(side * 0.66, 0.36, -0.72);
      eye.renderOrder = 10001;
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.07), glow(0x1a0c06));
      pupil.position.set(side * 0.765, 0.36, -0.74);
      pupil.renderOrder = 10002;
      head.add(pupil);
    }
    /* nostrils, and the teeth of the upper jaw, the fangs longest */
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.16), glow(0x14202a));
      nostril.position.set(side * 0.17, 0.08, -2.2);
      head.add(nostril);
    }
    const tooth = new THREE.ConeGeometry(0.06, 0.26, 4);
    const fang = new THREE.ConeGeometry(0.09, 0.5, 4);
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        const upper = new THREE.Mesh(i === 1 ? fang : tooth, bone);
        upper.rotation.x = Math.PI;
        upper.position.set(side * (0.56 - i * 0.065), -0.47 - (i === 1 ? 0.1 : 0), -0.3 - i * 0.33);
        head.add(upper);
      }
    }
    /* the lower jaw on its hinge, with its own teeth and a tongue */
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.38, 0);
    head.add(this.jaw);
    const jaw = inkHull(
      new THREE.Mesh(shapedEgg(1.35, 0.5, 2.4, { taper: 0.5, drop: 0, flat: 0 }), belly),
    );
    jaw.position.set(0, -0.12, -1.05);
    this.jaw.add(jaw);
    const tongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 1.3).translate(0, 0.09, -1),
      lambert({ color: 0x9a3044 }),
    );
    this.jaw.add(tongue);
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const lower = new THREE.Mesh(i === 2 ? fang : tooth, bone);
        lower.position.set(side * (0.46 - i * 0.06), 0.15, -0.4 - i * 0.33);
        this.jaw.add(lower);
      }
    }
    /* the frills behind the jaw, fanned out on spines; they flutter (update) */
    this.frills = [];
    for (const side of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(side * 0.9, 0.1, 0.35);
      const fan = new THREE.Mesh(fanGeometry(1.3, 1.6, 6), frillMaterial);
      fan.rotation.set(0.5, side * 0.6, side * -1.2);
      holder.add(fan);
      head.add(holder);
      this.frills.push({ holder, side });
    }
    /* short whiskers from the snout, curling down and back */
    this.whiskers = [];
    for (const side of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.22, -0.35, 0.15),
        new THREE.Vector3(side * 0.3, -0.85, 0.55),
      );
      const whisker = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 8, 0.035, 5, false),
        lambert({ color: 0x9ab8a8 }),
      );
      whisker.position.set(side * 0.36, -0.2, -1.95);
      head.add(whisker);
      this.whiskers.push({ mesh: whisker, side });
    }
    return head;
  }

  /** Under the water (true) or up by the shore (false); it sinks or rises there. */
  submerge(isUnder) {
    if (isUnder !== this.isUnder && !isUnder) {
      /* it breaks the surface: a burst of spray */
      const at = this.group.position;
      burst(at.x, WATER_Y + 0.4, at.z, {
        color: 0xe8f2f6,
        count: 46,
        speed: 6.5,
        size: 5,
        life: 0.9,
      });
    }
    this.isUnder = isUnder;
  }

  tint(color) {
    this.tintColor = color;
    const tint = new THREE.Color(color);
    for (const material of this.materials) {
      material.userData.base = material.userData.base || material.color.clone();
      material.color.copy(material.userData.base).multiply(tint);
    }
  }

  get animName() {
    return this.anim;
  }

  /* a sprite's picture can arrive late; the serpent has none */
  setLayers() {}

  dispose() {}

  has(name) {
    return ["idle", "walk", "attack", "hurt", "death"].includes(name);
  }

  duration() {
    return 0.7;
  }

  play(name, restart = false) {
    if (name !== this.anim || restart) {
      this.anim = name;
      this.animTime = 0;
    }
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
      this.facing.set(dx, dz).normalize();
    }
  }

  flashHit() {
    this.flash = 1;
    this.flinch = 1;
  }

  nudge(dx, dz) {
    const length = Math.hypot(dx, dz) || 1;
    this.nudgeVector.set(dx / length, dz / length);
    this.flinch = Math.max(this.flinch, 0.6);
  }

  freeze(seconds) {
    this.freezeTime = Math.max(this.freezeTime, seconds);
  }

  update(dt) {
    if (this.freezeTime > 0) {
      this.freezeTime -= dt;
      dt = 0;
    }
    this.time += dt;
    this.animTime += dt;
    const time = this.time;
    /* the whole serpent turns to face whoever it hunts, slowly */
    const goal = Math.atan2(-this.facing.x, -this.facing.y);
    let turn = goal - this.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.group.rotation.y += turn * Math.min(1, dt * 4);
    /* rising or sinking; dead, it sinks for good */
    const isDead = this.anim === "death";
    const isDown = this.isUnder || isDead;
    const target = isDown ? DIVE_DEPTH : 0;
    this.depth +=
      Math.sign(target - this.depth) *
      Math.min(Math.abs(target - this.depth), RISE_SPEED * dt * (isDead ? 0.3 : 1));
    this.body.position.y = -this.depth * SIZE;
    this.group.visible = this.depth < DIVE_DEPTH - 0.1;
    if (!this.group.visible) {
      return;
    }

    /* the strike: back and up, then a lunge with the jaw wide; a flinch when hit; slumping when dead */
    let lunge = 0;
    let rear = 0;
    let jaw = 0.12 + Math.sin(time * 1.7) * 0.06;
    if (this.anim === "attack") {
      const t = Math.min(1, this.animTime / 0.7);
      rear = t < 0.35 ? Math.sin((t / 0.35) * Math.PI * 0.5) : Math.max(0, 1 - (t - 0.35) * 4);
      lunge = t < 0.35 ? 0 : Math.sin(((t - 0.35) / 0.65) * Math.PI);
      jaw = 0.12 + rear * 0.75 + lunge * 0.2;
    }
    if (isDead) {
      jaw = 0.8;
    }
    this.flinch = Math.max(0, this.flinch - dt * 3);
    const slump = isDead ? Math.min(1, this.animTime / 2.5) : 0;

    /* the neck: an S that sways and breathes */
    NECK_REST.forEach(([x, y, z], k) => {
      const share = k / (NECK_REST.length - 1);
      const point = this.neckPoints[k];
      point.set(
        x +
          Math.sin(time * 0.8 + k * 0.9) * 0.28 * k +
          this.nudgeVector.x * this.flinch * share * 0.8,
        y + Math.sin(time * 1.1 + k) * 0.08 * k - slump * share * share * 6,
        z + this.nudgeVector.y * this.flinch * share * 0.8,
      );
      if (k >= 3) {
        const reach = (k - 2) / 3;
        point.z += rear * 1.4 * reach - lunge * 3 * reach;
        point.y += rear * 0.9 * reach - lunge * 1.6 * reach;
      }
    });
    this.neck.update(this.neckCurve);
    this.neckInk.update(this.neckCurve, 0.07);
    this.neckCrest.update(this.neckCurve, time * 3);

    /* the head on the end of the neck: along its last stretch, the top of the skull to the neck's back */
    const end = this.neck.frameAt(this.neckCurve, 1);
    const forward = end.tangent.clone();
    const up = end.normal.clone();
    const zAxis = forward.clone().negate();
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    this.basis.makeBasis(xAxis, yAxis, zAxis);
    this.head.quaternion.setFromRotationMatrix(this.basis);
    /* nodding down a little towards the shore, more as it strikes */
    this.head.rotateX(0.35 + lunge * 0.35 - rear * 0.25 + Math.sin(time * 1.3) * 0.05);
    this.head.position.copy(end.point).addScaledVector(forward, 0.2);
    this.jaw.rotation.x = jaw;
    for (const { holder, side } of this.frills) {
      holder.rotation.z = side * (Math.sin(time * 4 + side) * 0.1 + rear * 0.25);
      holder.rotation.y = side * Math.sin(time * 2.3) * 0.08;
    }
    for (const { mesh, side } of this.whiskers) {
      mesh.rotation.set(Math.sin(time * 1.9 + side) * 0.15, 0, Math.sin(time * 1.4) * 0.12 * side);
    }

    /* the coils behind: arches out of the water, rolling slowly */
    const water = WATER_Y / SIZE;
    for (const coil of this.coils) {
      const bob = Math.sin(time * 0.7 + coil.phase) * 0.3 - slump * 2.5;
      const { x, z, span, rise } = coil;
      const lean = Math.sin(time * 0.5 + coil.phase) * 0.4;
      coil.points[0].set(x - span, water - 1.6, z + 0.6);
      coil.points[1].set(x - span * 0.6, water + rise * 0.6 + bob, z + 0.3 + lean);
      coil.points[2].set(x, water + rise + bob, z + lean);
      coil.points[3].set(x + span * 0.6, water + rise * 0.6 + bob, z - 0.3 + lean);
      coil.points[4].set(x + span, water - 1.6, z - 0.6);
      coil.tube.update(coil.curve);
      coil.outline.update(coil.curve, 0.07);
      coil.ridge.update(coil.curve, time * 2 + coil.phase);
    }
    /* the tail: up out of the water, flicking */
    const flick = Math.sin(time * 1.6) * 0.8;
    this.tailPoints[0].set(7.4, water - 1.4, 18);
    this.tailPoints[1].set(7.8, water + 0.8, 18.4);
    this.tailPoints[2].set(8.3 + flick * 0.5, water + 2.4 - slump * 2, 18.2);
    this.tailPoints[3].set(8.9 + flick, water + 2.9 - slump * 2, 17.5);
    this.tail.update(this.tailCurve);
    this.tailInk.update(this.tailCurve, 0.06);
    const tip = this.tail.frameAt(this.tailCurve, 1);
    this.tailFin.position.copy(tip.point);
    this.tailFin.rotation.set(0, Math.PI / 2 + flick * 0.3, -0.6 + flick * 0.4);

    /* foam rings where the body breaks the water, breathing; gone when it is under */
    const showFoam = this.depth < 1.5;
    const entries = [
      this.neckCurve.getPointAt(0.14),
      this.coils[0].points[0],
      this.coils[0].points[4],
      this.coils[1].points[0],
      this.coils[1].points[4],
      this.tailPoints[0],
    ];
    this.foam.forEach((ring, k) => {
      ring.visible = showFoam;
      const point = entries[k];
      ring.position.set(point.x * SIZE, WATER_Y + 0.04, point.z * SIZE);
      ring.scale.setScalar((k === 0 ? 1.6 : 1) * (1 + Math.sin(time * 2.4 + k) * 0.12));
      ring.material.opacity = 0.35 + Math.sin(time * 2 + k) * 0.15;
    });

    /* water running off its jaw */
    this.dripIn -= dt;
    if (this.dripIn <= 0 && this.depth < 1) {
      this.dripIn = 0.35 + Math.random() * 0.5;
      this.jawTip.set(0, -0.5, -2.4);
      this.head.localToWorld(this.jawTip);
      burst(this.jawTip.x, this.jawTip.y, this.jawTip.z, {
        color: 0xd8f0f4,
        count: 3,
        speed: 0.8,
        size: 1.6,
        life: 0.7,
      });
    }

    /* the white flash of a blow */
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 8);
    }
    for (const material of this.materials) {
      material.emissive.setScalar(this.flash * 0.7);
    }
  }
}

/* ---------- tentacles: one rises out of the lake while its lane glows, then slams across the shore ---------- */

const tentacles = [];
/* the same grey-green as the serpent, with pale suckers like its belly */
const tentacleMaterial = new THREE.MeshLambertMaterial({ color: 0x4f6e68, flatShading: true });
const suckerMaterial = new THREE.MeshLambertMaterial({ color: 0xc4caa8 });
const suckerGeometry = new THREE.SphereGeometry(0.12, 6, 4);

/** A tentacle for a 'tentacle' warning (boss_telegraph): up out of the water at (x0, z0), down across to (x1, z1). */
export function tentacleStrike(data) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), tentacleMaterial);
  scene.add(mesh);
  /* suckers along its underside, moved with it every frame */
  const suckers = [];
  for (let k = 0; k < 10; k++) {
    const sucker = new THREE.Mesh(suckerGeometry, suckerMaterial);
    scene.add(sucker);
    suckers.push(sucker);
  }
  tentacles.push({ data, mesh, suckers, time: 0 });
}

/* the tentacle's line at this moment: rising (0..1 of the warning), slamming (just after), pulling back */
function tentacleCurve({ x0, z0, x1, z1 }, rise, slam, back) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz) || 1;
  const outX = -dx / length;
  const outZ = -dz / length;
  /* from under the water behind its start, up high, and forward over the shore */
  const reach = slam * (1 - back);
  const height = 1 + rise * 5 * (1 - reach) - back * 6;
  /* the tip curls up over the end while it rises, and lies flat along the ground once it has come down */
  const tipX = x0 + dx * (0.2 + 0.8 * reach);
  const tipZ = z0 + dz * (0.2 + 0.8 * reach);
  const tipY = Math.max(0.15, height - 1.5 - reach * 2);
  const curl = 1 - reach;
  const alongX = dx / length;
  const alongZ = dz / length;
  const points = [
    new THREE.Vector3(x0 + outX * 2.5, WATER_Y - 2.5, z0 + outZ * 2.5),
    new THREE.Vector3(x0 + outX * 0.6, WATER_Y + rise * 3 - back * 3, z0 + outZ * 0.6),
    new THREE.Vector3(x0 + dx * 0.25 * (0.3 + reach), height, z0 + dz * 0.25 * (0.3 + reach)),
    new THREE.Vector3(tipX - alongX * curl, tipY + 0.4 * curl, tipZ - alongZ * curl),
    new THREE.Vector3(tipX, tipY + 1.1 * curl, tipZ),
    new THREE.Vector3(
      tipX - alongX * 0.7 * curl,
      tipY + 1.4 * curl + 0.1,
      tipZ - alongZ * 0.7 * curl,
    ),
  ];
  return new THREE.CatmullRomCurve3(points);
}

/** Per frame: the tentacles rise, slam and sink away. */
export function updateTentacles(dt) {
  for (let i = tentacles.length - 1; i >= 0; i--) {
    const tentacle = tentacles[i];
    tentacle.time += dt;
    const windup = tentacle.data.duration;
    const t = tentacle.time;
    const rise = Math.min(1, t / windup);
    const slam = t < windup ? 0 : Math.min(1, (t - windup) / 0.15);
    const back = t < windup + 0.6 ? 0 : Math.min(1, (t - windup - 0.6) / 0.8);
    tentacle.mesh.geometry.dispose();
    const curve = tentacleCurve(tentacle.data, rise, slam, back);
    const thickness = 1 - back * 0.4;
    tentacle.mesh.geometry = taperedTube(curve, 24, 7, 0.62 * thickness, 0.07);
    tentacle.suckers.forEach((sucker, k) => {
      const t = 0.3 + (k / tentacle.suckers.length) * 0.62;
      curve.getPointAt(t, sucker.position);
      sucker.position.y -= (0.62 + (0.07 - 0.62) * t) * thickness * 0.85;
      sucker.scale.setScalar(1.2 - t);
    });
    if (slam >= 1 && !tentacle.hasSlammed) {
      tentacle.hasSlammed = true;
      const { x0, z0, x1, z1 } = tentacle.data;
      burst((x0 + x1) / 2, 0.4, (z0 + z1) / 2, { color: 0xd8e8ee, count: 26, speed: 5, size: 4 });
    }
    if (back >= 1) {
      scene.remove(tentacle.mesh, ...tentacle.suckers);
      tentacle.mesh.geometry.dispose();
      tentacles.splice(i, 1);
    }
  }
}
