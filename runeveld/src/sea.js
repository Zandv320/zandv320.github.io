/* Eldoria – the Grey Sea as the players see it (the rules are in rules/sea.js; the water itself is laid by
   saltmere.js): sea stacks with surf round their feet, green islets with sand and trees, and the wake every ship
   under sail leaves behind her (createWake). The Ember Isles are ember.js's. */
import * as THREE from "three";
import * as builders from "./builders.js";
import { ROCKS, ISLETS, HULL, isletReach } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { scene as worldScene } from "./world.js";

const surf = [];

/** Builds the Grey Sea (world.js calls this with its build context). */
export function buildSea({ scene, prop, pending, seededRandom }) {
  const random = seededRandom(7070);
  const rock = builders.material("stone", 2, 2, 0.62);
  /* ----- sea stacks: piles of dark rock standing out of the water ----- */
  for (const [x, z, radius] of ROCKS) {
    const stack = new THREE.Group();
    let y = WATER_Y - 1;
    let size = radius;
    for (let k = 0; k < 4; k++) {
      const piece = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rock);
      piece.position.set(
        (random() - 0.5) * size * 0.4,
        y + size * 0.6,
        (random() - 0.5) * size * 0.4,
      );
      piece.scale.y = 1.3;
      piece.rotation.set(random() * 3, random() * 3, random() * 3);
      stack.add(piece);
      y += size * 1.1;
      size *= 0.68;
    }
    stack.position.set(x, 0, z);
    scene.add(stack);
    addSurf(scene, x, z, radius * 1.05, radius * 1.45);
  }
  /* ----- islets: green land on a beach of sand, each in its own shape, a few trees ----- */
  const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xd8c08a, flatShading: true });
  const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x6a9a4a, flatShading: true });
  for (const islet of ISLETS) {
    const { x, z, radius } = islet;
    const reach = (angle) => isletReach(islet, angle);
    /* the beach, sloping down into the water, and the grass on it */
    const sand = new THREE.Mesh(coastSlab(reach, 1, 0.2, 1.3, 1), sandMaterial);
    sand.position.set(x, WATER_Y - 0.5, z);
    scene.add(sand);
    const grass = new THREE.Mesh(coastSlab(reach, 0.78, -0.2, 0.3, 0.5), grassMaterial);
    grass.position.set(x, WATER_Y + 1, z);
    scene.add(grass);
    for (let k = 0; k < Math.round(radius / 2); k++) {
      const angle = random() * Math.PI * 2;
      const distance = random() * reach(angle) * 0.6;
      pending.push(
        prop(
          random() < 0.6 ? "pine" : "tree",
          x + Math.sin(angle) * distance,
          z + Math.cos(angle) * distance,
          { shadow: 1.6, scale: 1.3 },
        ),
      );
    }
    addSurf(scene, x, z, 1.1, 2.2, reach);
  }
}

/* The wake's foam: small round bubbles, thick along both edges (the arms of the wake) and loose in the churned
   middle, with clear water between; u runs across the wake, v along it (a canvas texture, made once). */
let foamTexture = null;
function foam() {
  if (!foamTexture) {
    const width = 64;
    const height = 128;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const bubble = (u, radius, alpha) => {
      const x = u * width;
      const y = Math.random() * height;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      /* drawn once more at the far end, so the pattern runs on without a seam */
      ctx.beginPath();
      ctx.arc(x, y + (y < height / 2 ? height : -height), radius, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let k = 0; k < 200; k++) {
      /* the arms: a loose band near each edge, densest a little in from it */
      const edge = 0.12 + Math.abs(gaussian()) * 0.12;
      bubble(
        Math.random() < 0.5 ? edge : 1 - edge,
        0.7 + Math.random() * 1.8,
        0.25 + Math.random() * 0.5,
      );
    }
    for (let k = 0; k < 160; k++) {
      /* the churned water in between, fainter */
      bubble(0.25 + Math.random() * 0.5, 0.6 + Math.random() * 1.4, 0.12 + Math.random() * 0.3);
    }
    foamTexture = new THREE.CanvasTexture(canvas);
    foamTexture.wrapT = THREE.RepeatWrapping;
    foamTexture.magFilter = THREE.NearestFilter;
    foamTexture.minFilter = THREE.NearestFilter;
    foamTexture.generateMipmaps = false;
  }
  return foamTexture;
}

/* a number around 0, mostly between -1 and 1 */
const gaussian = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.3;

/**
 * The wake of a ship, behind her only: a trail of foam from the stern that opens out into a V and fades, its
 * bubbles lying where they fell on the water. update(x, z, heading, speed, dt) every frame the ship sails (heading:
 * bow to (-sin, -cos)); hide() when she is gone.
 */
export function createWake() {
  const POINTS = 48;
  const SAMPLE = 0.1;
  const trail = [];
  let sampleTimer = 0;
  const positions = new Float32Array(POINTS * 2 * 3);
  const colors = new Float32Array(POINTS * 2 * 4);
  const uvs = new Float32Array(POINTS * 2 * 2);
  /* how far the stern has come, so the bubbles stay where they fell on the water */
  let travelled = 0;
  let lastX = null;
  let lastZ = null;
  const indices = [];
  for (let i = 1; i < POINTS; i++) {
    const a = (i - 1) * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const trailMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: foam(),
      color: 0xe8f2f6,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  trailMesh.frustumCulled = false;
  worldScene.add(trailMesh);
  const half = HULL.length / 2;

  return {
    update(x, z, heading, speed, dt) {
      const forwardX = -Math.sin(heading);
      const forwardZ = -Math.cos(heading);
      const way = Math.min(1, speed / 5);
      /* a new point of the trail just under the stern, now and then; the oldest falls off */
      const sternX = x - forwardX * (half - 1);
      const sternZ = z - forwardZ * (half - 1);
      if (lastX !== null) {
        travelled += Math.hypot(sternX - lastX, sternZ - lastZ);
      }
      lastX = sternX;
      lastZ = sternZ;
      sampleTimer -= dt;
      if (sampleTimer <= 0) {
        sampleTimer = SAMPLE;
        trail.unshift({ x: sternX, z: sternZ, way, along: travelled });
        if (trail.length > POINTS) {
          trail.pop();
        }
      }
      for (let i = 0; i < POINTS; i++) {
        const point = trail[Math.min(i, trail.length - 1)];
        const next = trail[Math.min(i + 1, trail.length - 1)] || point;
        if (!point) {
          continue;
        }
        const age = i / POINTS;
        /* across the trail: square to its direction */
        let acrossX = -(next.z - point.z);
        let acrossZ = next.x - point.x;
        const length = Math.hypot(acrossX, acrossZ);
        if (length < 1e-4) {
          acrossX = forwardZ;
          acrossZ = -forwardX;
        } else {
          acrossX /= length;
          acrossZ /= length;
        }
        /* as wide as the stern under it, opening out into a V behind; strongest just astern, then fading */
        const width = HULL.beam * 0.4 + age * 7;
        const fadeIn = Math.min(1, i / 2);
        const alpha = i >= trail.length ? 0 : fadeIn * Math.pow(1 - age, 1.6) * 0.75 * point.way;
        for (const [k, sign] of [
          [i * 2, -1],
          [i * 2 + 1, 1],
        ]) {
          positions[k * 3] = point.x + acrossX * width * sign;
          positions[k * 3 + 1] = WATER_Y + 0.03;
          positions[k * 3 + 2] = point.z + acrossZ * width * sign;
          colors[k * 4] = 1;
          colors[k * 4 + 1] = 1;
          colors[k * 4 + 2] = 1;
          colors[k * 4 + 3] = alpha;
          uvs[k * 2] = sign > 0 ? 1 : 0;
          uvs[k * 2 + 1] = point.along / 9;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.uv.needsUpdate = true;
      trailMesh.visible = true;
    },
    hide() {
      trail.length = 0;
      lastX = null;
      trailMesh.visible = false;
    },
  };
}

/* The outline of a coast that reaches `reach(angle)` from its middle, times `scale` plus `grow`, as a flat shape
   (in the xy plane, y towards -z once laid down). */
function coastShape(reach, scale, grow) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 64; k++) {
    const angle = (k / 64) * Math.PI * 2;
    const r = reach(angle) * scale + grow;
    if (k === 0) {
      shape.moveTo(Math.sin(angle) * r, -Math.cos(angle) * r);
    } else {
      shape.lineTo(Math.sin(angle) * r, -Math.cos(angle) * r);
    }
  }
  return shape;
}

/* a slab in a coast's shape, `depth` thick, its top edge rounded off over `bevel`; standing on y = 0 */
export function coastSlab(reach, scale, grow, depth, bevel) {
  return new THREE.ExtrudeGeometry(coastShape(reach, scale, grow), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel * 0.4,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  }).rotateX(-Math.PI / 2);
}

/* A ring of white foam round something standing in the sea, `inner` to `outer` from its middle, or from its coast
   when `reach(angle)` gives one. */
export function addSurf(scene, x, z, inner, outer, reach = null) {
  let geometry;
  if (reach) {
    const shape = coastShape(reach, 1, outer);
    shape.holes.push(coastShape(reach, 1, inner));
    geometry = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  } else {
    geometry = new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2);
  }
  const ring = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xf2f6f8,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  ring.position.set(x, WATER_Y + 0.02, z);
  scene.add(ring);
  surf.push(ring);
}

/** Per frame: the surf breathes. */
export function updateSea(dt, time) {
  for (let k = 0; k < surf.length; k++) {
    surf[k].material.opacity = 0.2 + 0.14 * Math.sin(time * 1.2 + k);
  }
}
