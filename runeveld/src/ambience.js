/* Eldoria – life in the world, around the camera only:
   - dust: a small pixel puff at the feet of a walking or running figure
   - fireflies: glowing specks over fields and forest at night (drawn after the night haze, so they glow)
   - leaves: falling leaves in Whisperwood
   Everything is a handful of reused objects (one pool of puffs, two point clouds), so it costs next to nothing. */
import * as THREE from "three";
import { inForest, inCapital } from "./regions.js";

const DUST_POOL = 24;
const DUST_LIFE = 0.5; /* seconds */
const DUST_INTERVAL = 0.24; /* seconds between puffs of a moving figure */
const FIREFLIES = 36;
const LEAVES = 40;
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

/** Sets up the ambience in `scene`; returns {update(dt, time, cameraState, renderer, movers, night)}. */
export function createAmbience(scene) {
  /* ---- dust ---- */
  const dustMaterial = new THREE.MeshBasicMaterial({
    map: puffTexture(),
    transparent: true,
    depthWrite: false,
  });
  const dustGeometry = new THREE.PlaneGeometry(1, 1);
  const puffs = Array.from({ length: DUST_POOL }, () => {
    const mesh = new THREE.Mesh(dustGeometry, dustMaterial.clone());
    mesh.rotation.order = "YXZ";
    mesh.visible = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    return { mesh, age: DUST_LIFE, size: 0.4, drift: 0 };
  });
  let nextPuff = 0;
  /* per figure: where it was last frame and when it may puff again */
  const tracks = new WeakMap();

  function puff(x, z, size) {
    const slot = puffs[nextPuff];
    nextPuff = (nextPuff + 1) % DUST_POOL;
    slot.age = 0;
    slot.size = size;
    slot.drift = Math.random() * 2 - 1;
    slot.mesh.position.set(x + (Math.random() - 0.5) * 0.2, 0.12, z + (Math.random() - 0.5) * 0.12);
    slot.mesh.visible = true;
  }

  function updateDust(dt, cameraState, movers) {
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
        puff(mover.x, mover.z, speed > 5 ? 0.75 : 0.6);
      }
    }
    for (const slot of puffs) {
      if (!slot.mesh.visible) {
        continue;
      }
      slot.age += dt;
      if (slot.age >= DUST_LIFE) {
        slot.mesh.visible = false;
        continue;
      }
      const t = slot.age / DUST_LIFE;
      const scale = slot.size * (0.6 + t * 0.8);
      slot.mesh.scale.set(scale, scale, 1);
      slot.mesh.position.y = 0.12 + t * 0.25;
      slot.mesh.position.x += slot.drift * dt * 0.15;
      slot.mesh.rotation.y = cameraState.yaw;
      slot.mesh.rotation.x = -cameraState.tilt;
      slot.mesh.material.opacity = 0.75 * (1 - t);
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

  /**
   * movers: figures ({x, z, sprite}) that leave dust; night: 0 (day) .. 1 (night).
   * Points are sized in sprite pixels: cameraState.px rendered pixels per unit, 16 sprite pixels per unit.
   */
  function update(dt, time, cameraState, renderer, movers, night) {
    const spritePixel = cameraState.px / 16 / renderer.getPixelRatio();
    fireflies.material.size = spritePixel * 2;
    leaves.material.size = spritePixel * 2.5;
    updateDust(dt, cameraState, movers);
    updateFireflies(dt, time, cameraState, night);
    updateLeaves(dt, time, cameraState);
  }

  return { update };
}
