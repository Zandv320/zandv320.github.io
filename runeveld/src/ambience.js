/* Eldoria – life in the world, around the camera only:
   - dust: a small pixel puff at the feet of a walking or running figure
   - fireflies: glowing specks over fields and forest at night (drawn after the night haze, so they glow)
   - leaves: falling leaves in Whisperwood
   - smoke: rising from the chimneys of houses and forges
   - glints: sunlight twinkling on ponds and fountains
   - butterflies: over fields and meadows by day
   - turning parts: the mill's sails
   Everything is a handful of reused point clouds (six draw calls at most), so it costs next to nothing. */
import * as THREE from "three";
import { inForest, inCapital } from "./regions.js";
import { inVillage } from "./world.js";

const DUST_POOL = 24;
const DUST_LIFE = 0.5; /* seconds */
const DUST_INTERVAL = 0.24; /* seconds between puffs of a moving figure */
const FIREFLIES = 36;
const LEAVES = 40;
const SMOKE_POOL = 40;
const SMOKE_LIFE = 3; /* seconds */
const SMOKE_INTERVAL = 0.75; /* seconds between puffs of one chimney */
const GLINTS = 40;
const BUTTERFLIES = 16;
/* the box around the camera target in which fireflies and leaves live (units) */
const AREA_X = 13;
const AREA_Z = 18;

/* A pixel-art puff, 8 × 8: a lighter core in a darker ring. */
function puffTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const ctx = canvas.getContext("2d");
  const rows = [
    "..oooo..",
    ".oOOOOo.",
    "oOOOOOOo",
    "oOOOOOOo",
    "oOOOOOOo",
    "oOOOOOOo",
    ".oOOOOo.",
    "..oooo..",
  ];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== ".") {
        ctx.fillStyle = cell === "O" ? "rgba(236, 222, 190, 0.9)" : "rgba(196, 176, 140, 0.75)";
        ctx.fillRect(x, y, 1, 1);
      }
    });
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Sets up the ambience in `scene`. `smokeSources` (chimney tops, Vector3), `waterSpots` ({x, y, z, r}) and
 * `spinners` ({object, speed}) come from world.js. Returns {update(dt, time, cameraState, renderer, movers, night)}.
 */
export function createAmbience(scene, { smokeSources = [], waterSpots = [], spinners = [] } = {}) {
  const puffMap = puffTexture();

  /* A pool of puffs drawn as one point cloud: points always face the screen, like the billboards, and the whole
     pool is a single draw call. Every puff has its own size (units) and opacity. */
  function puffCloud(count, color, renderOrder) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: puffMap },
        color: { value: new THREE.Color(color) },
        pixelsPerUnit: { value: 16 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        uniform float pixelsPerUnit;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_PointSize = alpha > 0.0 ? size * pixelsPerUnit : 0.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(texel.rgb * color, texel.a * vAlpha);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = renderOrder;
    scene.add(points);
    const slots = Array.from({ length: count }, () => ({
      x: 0,
      y: 0,
      z: 0,
      size: 0,
      alpha: 0,
      age: 1e9,
      drift: 0,
      base: 0,
    }));
    let next = 0;
    return {
      points,
      slots,
      /** The next slot of the pool (the oldest puff makes way). */
      take() {
        const slot = slots[next];
        next = (next + 1) % count;
        slot.age = 0;
        return slot;
      },
      /** Writes the slots to the GPU; `pixelsPerUnit`: rendered pixels per world unit. */
      flush(pixelsPerUnit) {
        material.uniforms.pixelsPerUnit.value = pixelsPerUnit;
        const position = geometry.attributes.position;
        slots.forEach((slot, i) => {
          position.setXYZ(i, slot.x, slot.y, slot.z);
          geometry.attributes.size.setX(i, slot.size);
          geometry.attributes.alpha.setX(i, slot.alpha);
        });
        position.needsUpdate = true;
        geometry.attributes.size.needsUpdate = true;
        geometry.attributes.alpha.needsUpdate = true;
      },
    };
  }

  /* ---- dust ---- */
  const dust = puffCloud(DUST_POOL, 0xffffff, 1);
  /* per figure: where it was last frame and when it may puff again */
  const tracks = new WeakMap();

  function updateDust(dt, movers) {
    for (const mover of movers) {
      if (!mover || !mover.sprite) {
        continue;
      }
      let track = tracks.get(mover);
      if (!track) {
        track = { x: mover.x, z: mover.z, wait: 0 };
        tracks.set(mover, track);
      }
      const speed = Math.hypot(mover.x - track.x, mover.z - track.z) / Math.max(dt, 1e-3);
      track.x = mover.x;
      track.z = mover.z;
      track.wait -= dt;
      /* walking: about 3 units a second; a jump (teleport, respawn) is no step */
      if (speed > 1.5 && speed < 20 && track.wait <= 0) {
        track.wait = DUST_INTERVAL;
        const slot = dust.take();
        slot.x = mover.x + (Math.random() - 0.5) * 0.2;
        slot.z = mover.z + (Math.random() - 0.5) * 0.12;
        slot.base = speed > 5 ? 0.75 : 0.6;
        slot.drift = Math.random() * 2 - 1;
      }
    }
    for (const slot of dust.slots) {
      slot.age += dt;
      if (slot.age >= DUST_LIFE) {
        slot.alpha = 0;
        continue;
      }
      const t = slot.age / DUST_LIFE;
      slot.size = slot.base * (0.6 + t * 0.8);
      slot.y = 0.12 + t * 0.25;
      slot.x += slot.drift * dt * 0.15;
      slot.alpha = 0.75 * (1 - t);
    }
  }

  /* ---- chimney smoke: grey puffs that rise, grow, drift with the wind and fade ---- */
  const smoke = puffCloud(SMOKE_POOL, 0xb4b4c2, 2);
  /* each chimney starts at another moment, so they do not puff in step */
  const chimneys = smokeSources.map((point) => ({ point, wait: Math.random() * SMOKE_INTERVAL }));

  function updateSmoke(dt, cameraState) {
    const target = cameraState.target;
    for (const chimney of chimneys) {
      const { point } = chimney;
      if (Math.abs(point.x - target.x) > AREA_X + 4 || Math.abs(point.z - target.z) > AREA_Z + 8) {
        continue;
      }
      chimney.wait -= dt;
      if (chimney.wait > 0) {
        continue;
      }
      chimney.wait = SMOKE_INTERVAL * (0.8 + Math.random() * 0.4);
      const slot = smoke.take();
      slot.x = point.x;
      slot.y = point.y;
      slot.z = point.z;
    }
    for (const slot of smoke.slots) {
      slot.age += dt;
      if (slot.age >= SMOKE_LIFE) {
        slot.alpha = 0;
        continue;
      }
      const t = slot.age / SMOKE_LIFE;
      slot.size = 0.6 + t * 1.3;
      slot.y += dt * 0.75;
      /* the wind blows a little to the east */
      slot.x += dt * 0.35;
      slot.alpha = 0.85 * Math.min(1, t * 6) * (1 - t);
    }
  }

  /* ---- fireflies and leaves: point clouds that wrap around the camera target ---- */
  function pointCloud(count, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    return points;
  }

  const fireflies = pointCloud(
    FIREFLIES,
    new THREE.PointsMaterial({
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  /* after the night haze (renderOrder 10000 in daylight.js): they light up instead of being dimmed */
  fireflies.renderOrder = 10001;
  const fireflyData = Array.from({ length: FIREFLIES }, () => ({
    x: (Math.random() * 2 - 1) * AREA_X,
    z: (Math.random() * 2 - 1) * AREA_Z,
    y: 0.4 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 0.8,
  }));

  const leaves = pointCloud(
    LEAVES,
    new THREE.PointsMaterial({ vertexColors: true, sizeAttenuation: false, transparent: true }),
  );
  /* warm colours: green leaves would vanish against the foliage */
  const LEAF_COLORS = [
    [0.95, 0.78, 0.3],
    [0.88, 0.5, 0.18],
    [0.74, 0.82, 0.32],
  ].map((rgb) => new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace));
  const leafData = Array.from({ length: LEAVES }, () => ({
    x: (Math.random() * 2 - 1) * AREA_X,
    z: (Math.random() * 2 - 1) * AREA_Z,
    y: Math.random() * 7,
    phase: Math.random() * Math.PI * 2,
    fall: 0.5 + Math.random() * 0.5,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
  }));

  /* glints on the water: white specks that light up and fade at random spots on the surface */
  const glints = pointCloud(
    GLINTS,
    new THREE.PointsMaterial({
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const glintData = Array.from({ length: GLINTS }, () => ({ age: 1, life: 1, x: 0, y: 0, z: 0 }));

  /* butterflies: little fluttering specks in white, yellow and pale blue */
  const butterflies = pointCloud(
    BUTTERFLIES,
    new THREE.PointsMaterial({ vertexColors: true, sizeAttenuation: false, transparent: true }),
  );
  const BUTTERFLY_COLORS = [
    [1, 1, 0.95],
    [1, 0.88, 0.35],
    [0.7, 0.85, 1],
  ].map((rgb) => new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace));
  const butterflyData = Array.from({ length: BUTTERFLIES }, () => ({
    x: (Math.random() * 2 - 1) * AREA_X,
    z: (Math.random() * 2 - 1) * AREA_Z,
    y: 0.4 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.6,
    color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
  }));

  /* keeps an offset inside the box around the target, so the cloud travels along with the camera */
  const wrap = (value, half) => ((((value + half) % (half * 2)) + half * 2) % (half * 2)) - half;

  function updateFireflies(dt, time, cameraState, night) {
    const target = cameraState.target;
    const strength = Math.max(0, Math.min(1, (night - 0.3) / 0.4));
    fireflies.visible = strength > 0 && !inCapital(target.x, target.z);
    if (!fireflies.visible) {
      return;
    }
    const position = fireflies.geometry.attributes.position;
    const color = fireflies.geometry.attributes.color;
    fireflyData.forEach((fly, i) => {
      const t = time * fly.speed + fly.phase;
      const x = target.x + wrap(fly.x + Math.sin(t * 0.7) * 0.8 - target.x, AREA_X);
      const z = target.z + wrap(fly.z + Math.cos(t * 0.5) * 0.8 - target.z, AREA_Z);
      position.setXYZ(i, x, fly.y + Math.sin(t * 1.3) * 0.25, z);
      /* a slow pulse: mostly dark, now and then a glow */
      const glow = Math.pow(Math.max(0, Math.sin(t * 1.7)), 3) * strength;
      color.setXYZ(i, 0.85 * glow, 1.0 * glow, 0.35 * glow);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  function updateLeaves(dt, time, cameraState) {
    const target = cameraState.target;
    leaves.visible = inForest(target.x, target.z);
    if (!leaves.visible) {
      return;
    }
    const position = leaves.geometry.attributes.position;
    const color = leaves.geometry.attributes.color;
    leafData.forEach((leaf, i) => {
      leaf.y -= leaf.fall * dt;
      if (leaf.y < 0.05) {
        leaf.y = 6 + Math.random() * 2;
        leaf.x = target.x + (Math.random() * 2 - 1) * AREA_X;
        leaf.z = target.z + (Math.random() * 2 - 1) * AREA_Z;
      }
      const sway = Math.sin(time * 1.6 + leaf.phase) * 0.5;
      const x = target.x + wrap(leaf.x + sway - target.x, AREA_X);
      const z = target.z + wrap(leaf.z - target.z, AREA_Z);
      position.setXYZ(i, x, leaf.y, z);
      color.setXYZ(i, leaf.color.r, leaf.color.g, leaf.color.b);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  function updateGlints(dt, cameraState, night) {
    const target = cameraState.target;
    const nearby = waterSpots.filter(
      (spot) =>
        Math.abs(spot.x - target.x) < AREA_X + spot.r &&
        Math.abs(spot.z - target.z) < AREA_Z + spot.r,
    );
    /* sunlight: none at night */
    const strength = 1 - night;
    glints.visible = nearby.length > 0 && strength > 0.05;
    if (!glints.visible) {
      return;
    }
    const position = glints.geometry.attributes.position;
    const color = glints.geometry.attributes.color;
    glintData.forEach((glint, i) => {
      glint.age += dt;
      if (glint.age >= glint.life) {
        /* a new spot on one of the nearby surfaces, more on larger ones */
        const spot = nearby[Math.floor(Math.random() * nearby.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * spot.r * 0.85;
        glint.x = spot.x + Math.cos(angle) * distance;
        glint.z = spot.z + Math.sin(angle) * distance;
        glint.y = spot.y + 0.03;
        glint.age = 0;
        glint.life = 0.5 + Math.random() * 1.1;
      }
      position.setXYZ(i, glint.x, glint.y, glint.z);
      const brightness = Math.sin((glint.age / glint.life) * Math.PI) * 0.9 * strength;
      color.setXYZ(i, brightness, brightness, brightness);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  function updateButterflies(dt, time, cameraState, night) {
    const target = cameraState.target;
    butterflies.visible =
      night < 0.3 &&
      !inForest(target.x, target.z) &&
      !inCapital(target.x, target.z) &&
      !inVillage(target.x, target.z);
    if (!butterflies.visible) {
      return;
    }
    const position = butterflies.geometry.attributes.position;
    const color = butterflies.geometry.attributes.color;
    butterflyData.forEach((fly, i) => {
      const t = time * fly.speed + fly.phase;
      const x = target.x + wrap(fly.x + Math.sin(t * 0.6) * 2.2 - target.x, AREA_X);
      const z = target.z + wrap(fly.z + Math.sin(t * 0.43 + 1) * 1.6 - target.z, AREA_Z);
      position.setXYZ(i, x, fly.y + Math.abs(Math.sin(t * 2.3)) * 0.3, z);
      /* the wings: bright when open, darker when folded */
      const flap = 0.55 + 0.45 * Math.abs(Math.sin(time * 14 + fly.phase * 5));
      color.setXYZ(i, fly.color.r * flap, fly.color.g * flap, fly.color.b * flap);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  /**
   * movers: figures ({x, z, sprite}) that leave dust; night: 0 (day) .. 1 (night).
   * Points are sized in sprite pixels: cameraState.px rendered pixels per unit, 16 sprite pixels per unit.
   */
  function update(dt, time, cameraState, renderer, movers, night) {
    const spritePixel = cameraState.px / 16 / renderer.getPixelRatio();
    fireflies.material.size = spritePixel * 2;
    leaves.material.size = spritePixel * 2.5;
    glints.material.size = spritePixel * 1.5;
    butterflies.material.size = spritePixel * 2;
    updateDust(dt, movers);
    updateSmoke(dt, cameraState);
    dust.flush(cameraState.px);
    smoke.flush(cameraState.px);
    updateFireflies(dt, time, cameraState, night);
    updateLeaves(dt, time, cameraState);
    updateGlints(dt, cameraState, night);
    updateButterflies(dt, time, cameraState, night);
    for (const spinner of spinners) {
      spinner.object.rotation.z += spinner.speed * dt;
    }
  }

  return { update };
}
