/* Eldoria – sparks: glowing particles that burst from a hit, trail behind a bolt and spray from big spells.
   One pool of square pixel-sparks drawn as a single point cloud (one draw call), added on top of the scene and after
   the night haze, so they glow at night too. burst() and trail() can be called from anywhere; they do nothing until
   initParticles() has run. */
import * as THREE from "three";

const POOL = 480;
let cloud = null;
let slots = [];
let next = 0;

/** Sets up the pool in `scene`. */
export function initParticles(scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(POOL), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelsPerUnit: { value: 16 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      uniform float pixelsPerUnit;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_PointSize = size * pixelsPerUnit / 16.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        /* a square spark with a brighter core, like a pixel of light */
        vec2 offset = abs(gl_PointCoord - 0.5);
        float core = max(offset.x, offset.y) < 0.25 ? 1.0 : 0.55;
        gl_FragColor = vec4(vColor * core, 1.0);
        #include <colorspace_fragment>
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  /* after the night haze (renderOrder 10000 in daylight.js) */
  cloud.renderOrder = 10002;
  scene.add(cloud);
  slots = Array.from({ length: POOL }, () => ({
    life: 0,
    age: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    gravity: 0,
    size: 0,
    color: new THREE.Color(),
  }));
}

function spawn(x, y, z, color, { vx = 0, vy = 0, vz = 0, gravity = 0, life = 0.5, size = 2 }) {
  if (!cloud) {
    return;
  }
  const slot = slots[next];
  next = (next + 1) % POOL;
  Object.assign(slot, { x, y, z, vx, vy, vz, gravity, life, age: 0, size });
  slot.color.set(color);
}

/**
 * Sparks bursting from a point in every direction, upwards more than down.
 * color: hex; count; speed (units per second); size in sprite pixels; life in seconds.
 */
export function burst(
  x,
  y,
  z,
  { color = 0xfff0c4, count = 12, speed = 3.5, size = 2, life = 0.55 } = {},
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const flat = speed * (0.4 + Math.random() * 0.6);
    spawn(x, y, z, color, {
      vx: Math.cos(angle) * flat,
      vz: Math.sin(angle) * flat,
      vy: speed * (0.3 + Math.random() * 0.9),
      gravity: 7,
      life: life * (0.6 + Math.random() * 0.6),
      size: size * (0.7 + Math.random() * 0.6),
    });
  }
}

/** A ring of sparks spraying outwards over the ground, for spells that hit everything around. */
export function ringBurst(x, z, radius, { color = 0xfff0c4, count = 36, size = 2 } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    spawn(x + Math.cos(angle) * radius * 0.3, 0.25, z + Math.sin(angle) * radius * 0.3, color, {
      vx: Math.cos(angle) * radius * 2.2,
      vz: Math.sin(angle) * radius * 2.2,
      vy: 1.5 + Math.random() * 1.5,
      gravity: 5,
      life: 0.45 + Math.random() * 0.25,
      size: size * (0.8 + Math.random() * 0.5),
    });
  }
}

/** A few slow sparks left behind at a point: the trail of a flying bolt. */
export function trail(x, y, z, color) {
  for (let i = 0; i < 2; i++) {
    spawn(x + (Math.random() - 0.5) * 0.15, y + (Math.random() - 0.5) * 0.15, z, color, {
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.3 + Math.random() * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      life: 0.3 + Math.random() * 0.15,
      size: 1.6,
    });
  }
}

/** Moves and fades the sparks; `pixelsPerUnit` is cameraState.px. */
export function updateParticles(dt, pixelsPerUnit) {
  if (!cloud) {
    return;
  }
  const geometry = cloud.geometry;
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  const size = geometry.attributes.size;
  slots.forEach((slot, i) => {
    if (slot.age >= slot.life) {
      size.setX(i, 0);
      return;
    }
    slot.age += dt;
    slot.vy -= slot.gravity * dt;
    slot.x += slot.vx * dt;
    slot.y = Math.max(0.05, slot.y + slot.vy * dt);
    slot.z += slot.vz * dt;
    const fade = Math.max(0, 1 - slot.age / slot.life);
    position.setXYZ(i, slot.x, slot.y, slot.z);
    color.setXYZ(i, slot.color.r * fade, slot.color.g * fade, slot.color.b * fade);
    size.setX(i, slot.age >= slot.life ? 0 : slot.size);
  });
  position.needsUpdate = true;
  color.needsUpdate = true;
  size.needsUpdate = true;
  cloud.material.uniforms.pixelsPerUnit.value = pixelsPerUnit;
}
