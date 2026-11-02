/* Eldoria – the small animals that make the land feel alive, round the camera only:
   - little flocks of sparrows (and crows near the farms) pecking in the grass by day, that scatter into the air when
     a hero comes close;
   - now and then a flock flying high over the land, its shadows sliding over the ground;
   - frogs on the rims of the ponds that croak, louder at night, and leap into the water when someone comes near.
   They are pixel-art sprites drawn here; nothing of this goes over the network, every player sees their own. */
import * as THREE from "three";
import { FISHING_PONDS } from "./rules/gather-nodes.js";
import { inFields, inVale, inNorthroad, inForest, inCrypt, inForge } from "./regions.js";
import { cameraState, inVillage, isFree } from "./world.js";
import { daylight } from "./daylight.js";
import { player, game } from "./game-state.js";
import { ripple } from "./water-features.js";

/* ---------------------------------------------------------------- pictures ------------------------------------ */

/* pixel art from rows of characters, in a sheet of `frames` side by side */
function sheet(frames, colors) {
  const width = frames[0][0].length;
  const height = frames[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = width * frames.length;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  frames.forEach((rows, frame) =>
    rows.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (colors[cell]) {
          ctx.fillStyle = colors[cell];
          ctx.fillRect(frame * width + x, y, 1, 1);
        }
      }),
    ),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, frames: frames.length, width, height };
}

/* a bird: standing, pecking, wings up, wings down */
const BIRD = [
  ["........", "....bb..", "...bhbk.", ".bbbbb..", "bbwwbb..", ".bbbb...", "..l.l...", "........"],
  ["........", "........", "....bb..", ".bbbhbk.", "bbwwbbb.", ".bbbb...", "..l.l...", "........"],
  ["w.....w.", "bw...wb.", ".bw.wb..", "..bhbk..", "..bbb...", "........", "........", "........"],
  ["........", "........", "..bhbk..", ".bbbbb..", "bw...wb.", "w.....w.", "........", "........"],
];
const SPARROW = { b: "#7a5a3a", h: "#5a3e26", k: "#1c140c", w: "#e8d8b8", l: "#d89a4a" };
const CROW = { b: "#2a2a34", h: "#1a1a22", k: "#d8b040", w: "#4a4a5a", l: "#3a3a40" };

/* a frog: sitting, throat puffed out (croaking), leaping */
const FROG = [
  [
    "..........",
    "..oo..oo..",
    ".oeggggeo.",
    ".gggggggg.",
    "gggGGGGggg",
    "gg.GGGG.gg",
    "g..g..g..g",
    "..........",
  ],
  [
    "..........",
    "..oo..oo..",
    ".oeggggeo.",
    ".gggggggg.",
    "gggWWWWggg",
    "gg.WWWW.gg",
    "g..g..g..g",
    "..........",
  ],
  [
    "..oo..oo..",
    ".oeggggeo.",
    ".gggggggg.",
    "..gGGGGg..",
    ".g.gggg.g.",
    "g...gg...g",
    "g........g",
    "..........",
  ],
];
const FROG_COLORS = { o: "#2a5a20", e: "#1a1a10", g: "#5fae3c", G: "#c8e070", W: "#e8f4c8" };

let birdSheets = null;
let frogSheet = null;

function spriteOf(art, size) {
  const texture = art.texture.clone();
  texture.repeat.set(1 / art.frames, 1);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.5 }),
  );
  sprite.scale.set(size * (art.width / art.height), size, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

function showFrame(sprite, art, frame, mirror = false) {
  const map = sprite.material.map;
  map.repeat.x = (mirror ? -1 : 1) / art.frames;
  map.offset.x = (frame + (mirror ? 1 : 0)) / art.frames;
}

/* a soft dark spot on the ground under something in the air */
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const shadowGeometry = new THREE.CircleGeometry(0.16, 10).rotateX(-Math.PI / 2);

/* ---------------------------------------------------------------- birds on the ground ------------------------ */

const FLOCKS = 3;
const flocks = [];
let scene = null;

/* open grass for a flock to land on, near the camera */
function landingSpot() {
  const { x: cx, z: cz } = cameraState.target;
  for (let tries = 0; tries < 12; tries++) {
    const x = cx + (Math.random() - 0.5) * 34;
    const z = cz + (Math.random() - 0.5) * 30;
    const isOpen =
      (inFields(x, z, 3) && !inVillage(x, z)) || inVale(x, z, 3) || inNorthroad(x, z, 2);
    if (
      isOpen &&
      !inForest(x, z) &&
      isFree(x, z, 1.5) &&
      Math.hypot(x - player.x, z - player.z) > 8
    ) {
      return [x, z];
    }
  }
  return null;
}

function newFlock() {
  const spot = landingSpot();
  if (!spot) {
    return null;
  }
  const [x, z] = spot;
  const isCrow = Math.random() < 0.25;
  const art = isCrow ? birdSheets.crow : birdSheets.sparrow;
  const birds = [];
  const count = 3 + Math.floor(Math.random() * 4);
  for (let k = 0; k < count; k++) {
    const sprite = spriteOf(art, isCrow ? 0.55 : 0.42);
    const bird = {
      sprite,
      art,
      x: x + (Math.random() - 0.5) * 2.4,
      z: z + (Math.random() - 0.5) * 1.8,
      y: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      mirror: Math.random() < 0.5,
      next: Math.random() * 2,
      peck: 0,
      shadow: new THREE.Mesh(shadowGeometry, shadowMaterial),
    };
    sprite.position.set(bird.x, 0, bird.z);
    bird.shadow.position.set(bird.x, 0.03, bird.z);
    scene.add(sprite, bird.shadow);
    birds.push(bird);
  }
  return { birds, flying: false, age: 0 };
}

function removeFlock(flock) {
  for (const bird of flock.birds) {
    scene.remove(bird.sprite, bird.shadow);
    bird.sprite.material.map.dispose();
    bird.sprite.material.dispose();
  }
}

/* someone close: every bird of the flock takes off, away from them */
function scatter(flock, fromX, fromZ) {
  flock.flying = true;
  for (const bird of flock.birds) {
    const dx = bird.x - fromX;
    const dz = bird.z - fromZ;
    const distance = Math.hypot(dx, dz) || 1;
    const speed = 4 + Math.random() * 2;
    bird.vx = (dx / distance) * speed + (Math.random() - 0.5);
    bird.vz = (dz / distance) * speed * 0.6 - 1.5;
    bird.vy = 2.5 + Math.random() * 1.5;
    bird.mirror = bird.vx < 0;
  }
}

function updateFlock(flock, dt, time) {
  flock.age += dt;
  if (!flock.flying) {
    /* a hero (this one or another) coming close scatters them */
    const near = [player, ...(game.peers ? [...game.peers.values()] : [])].find(
      (someone) =>
        someone &&
        Number.isFinite(someone.x) &&
        flock.birds.some((bird) => Math.hypot(bird.x - someone.x, bird.z - someone.z) < 4),
    );
    if (near) {
      scatter(flock, near.x, near.z);
    }
  }
  for (const bird of flock.birds) {
    if (flock.flying) {
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      bird.z += bird.vz * dt;
      bird.vy += 0.6 * dt;
      showFrame(
        bird.sprite,
        bird.art,
        2 + (Math.floor(time * 14 + bird.next * 7) % 2),
        bird.mirror,
      );
    } else {
      /* hop about and peck */
      bird.next -= dt;
      if (bird.next <= 0) {
        bird.next = 0.5 + Math.random() * 2.2;
        if (Math.random() < 0.4) {
          bird.mirror = !bird.mirror;
          bird.x += (bird.mirror ? -1 : 1) * 0.25;
        } else {
          bird.peck = 0.25;
        }
      }
      bird.peck -= dt;
      showFrame(bird.sprite, bird.art, bird.peck > 0 ? 1 : 0, bird.mirror);
    }
    bird.sprite.position.set(bird.x, bird.y, bird.z);
    bird.shadow.position.set(bird.x, 0.03, bird.z);
    bird.shadow.material.opacity = 0.18;
  }
}

/* ---------------------------------------------------------------- flocks in the sky -------------------------- */

let skyFlock = null;
let nextSkyFlock = 8;

function newSkyFlock() {
  const { x: cx, z: cz } = cameraState.target;
  const side = Math.random() < 0.5 ? -1 : 1;
  const heading = new THREE.Vector2(-side, (Math.random() - 0.5) * 0.6).normalize();
  const birds = [];
  /* a loose V */
  for (let k = 0; k < 7; k++) {
    const row = Math.ceil(k / 2);
    const wing = k % 2 ? 1 : -1;
    const sprite = spriteOf(birdSheets.crow, 0.5);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    scene.add(sprite, shadow);
    birds.push({
      sprite,
      shadow,
      dx: -heading.x * row * 0.9 + -heading.y * wing * row * 0.8,
      dz: -heading.y * row * 0.9 + heading.x * wing * row * 0.8,
      phase: Math.random() * 6,
    });
  }
  return { birds, x: cx + side * 26, z: cz + (Math.random() - 0.5) * 16, heading, age: 0 };
}

function updateSkyFlock(dt, time) {
  const flock = skyFlock;
  flock.age += dt;
  flock.x += flock.heading.x * 5 * dt;
  flock.z += flock.heading.y * 5 * dt;
  for (const bird of flock.birds) {
    const x = flock.x + bird.dx;
    const z = flock.z + bird.dz;
    const y = 9 + Math.sin(time * 1.2 + bird.phase) * 0.3;
    bird.sprite.position.set(x, y, z);
    showFrame(
      bird.sprite,
      birdSheets.crow,
      2 + (Math.floor(time * 6 + bird.phase) % 2),
      flock.heading.x < 0,
    );
    /* the shadow lies where the sun would cast it, a little off */
    bird.shadow.position.set(x + 1.5, 0.03, z + 2.5);
  }
  if (flock.age > 14) {
    for (const bird of flock.birds) {
      scene.remove(bird.sprite, bird.shadow);
      bird.sprite.material.map.dispose();
      bird.sprite.material.dispose();
    }
    skyFlock = null;
  }
}

/* ---------------------------------------------------------------- frogs -------------------------------------- */

const frogs = [];
const RIM_Y = 0.405;

function placeFrogs() {
  FISHING_PONDS.forEach(([px, pz, r], pond) => {
    for (let k = 0; k < 2; k++) {
      const angle = (pond * 2.1 + k * 2.6 + 0.4) % (Math.PI * 2);
      const sprite = spriteOf(frogSheet, 0.32);
      const rimX = px + Math.cos(angle) * (r + 0.25);
      const rimZ = pz + Math.sin(angle) * (r + 0.25);
      sprite.position.set(rimX, RIM_Y, rimZ);
      scene.add(sprite);
      frogs.push({
        sprite,
        rimX,
        rimZ,
        poolX: px + Math.cos(angle) * r * 0.5,
        poolZ: pz + Math.sin(angle) * r * 0.5,
        state: "sit",
        t: 0,
        next: 1 + Math.random() * 4,
        mirror: Math.cos(angle) > 0,
      });
    }
  });
}

function updateFrog(frog, dt, night) {
  frog.t += dt;
  if (frog.state === "sit") {
    if (Math.hypot(player.x - frog.rimX, player.z - frog.rimZ) < 2.4) {
      frog.state = "leap";
      frog.t = 0;
    } else {
      /* a croak now and then, more often at night */
      frog.next -= dt * (night ? 2.5 : 1);
      const isCroaking = frog.next < 0.4;
      if (frog.next <= 0) {
        frog.next = 2 + Math.random() * 5;
      }
      showFrame(frog.sprite, frogSheet, isCroaking ? 1 : 0, frog.mirror);
    }
  } else if (frog.state === "leap") {
    const t = Math.min(1, frog.t / 0.45);
    frog.sprite.position.set(
      frog.rimX + (frog.poolX - frog.rimX) * t,
      RIM_Y + Math.sin(Math.PI * t) * 0.6 - t * 0.1,
      frog.rimZ + (frog.poolZ - frog.rimZ) * t,
    );
    showFrame(frog.sprite, frogSheet, 2, frog.mirror);
    if (t >= 1) {
      frog.sprite.visible = false;
      frog.state = "under";
      frog.t = 0;
      ripple(scene, frog.poolX, frog.poolZ);
    }
  } else if (frog.t > 8 && Math.hypot(player.x - frog.rimX, player.z - frog.rimZ) > 4) {
    /* back on the rim once nobody is near */
    frog.state = "sit";
    frog.sprite.visible = true;
    frog.sprite.position.set(frog.rimX, RIM_Y, frog.rimZ);
  }
}

/* ---------------------------------------------------------------- every frame -------------------------------- */

/** Sets up the animals in `world` (call once the world is built). */
export function createWildlife(world) {
  scene = world;
  birdSheets = { sparrow: sheet(BIRD, SPARROW), crow: sheet(BIRD, CROW) };
  frogSheet = sheet(FROG, FROG_COLORS);
  placeFrogs();
}

/** Per frame, once the hero is in the world. */
export function updateWildlife(dt, time) {
  if (!scene) {
    return;
  }
  const light = daylight();
  /* the birds keep to the day */
  for (let k = flocks.length - 1; k >= 0; k--) {
    const flock = flocks[k];
    updateFlock(flock, dt, time);
    const { x, z } = cameraState.target;
    const bird = flock.birds[0];
    const isGone = flock.flying
      ? flock.age > 30 || bird.y > 14
      : Math.hypot(bird.x - x, bird.z - z) > 40;
    if (isGone || (light < 0.2 && !flock.flying)) {
      removeFlock(flock);
      flocks.splice(k, 1);
    }
  }
  if (flocks.length < FLOCKS && light > 0.3 && Math.random() < dt * 0.4) {
    const flock = newFlock();
    if (flock) {
      flocks.push(flock);
    }
  }
  if (skyFlock) {
    updateSkyFlock(dt, time);
  } else if (
    light > 0.3 &&
    !inCrypt(cameraState.target.x, cameraState.target.z) &&
    !inForge(cameraState.target.x, cameraState.target.z)
  ) {
    nextSkyFlock -= dt;
    if (nextSkyFlock <= 0) {
      nextSkyFlock = 25 + Math.random() * 30;
      skyFlock = newSkyFlock();
    }
  }
  const night = light < 0.3;
  for (const frog of frogs) {
    updateFrog(frog, dt, night);
  }
}
