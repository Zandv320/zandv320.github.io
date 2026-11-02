/* Eldoria – places worth walking to, and the air over the land:
   - the Old Watchtower, a ruin in the western fields: a roofless tower with a broken crown, a fallen wall, rubble;
   - the Wayside Shrine in Kingsvale: a statue in a ring of standing stones, with candles burning before it;
   - a fairy ring of glowing mushrooms in Whisperwood, with motes of light over it;
   - the Falls Lookout on the south rim of Greyfall Gorge, a wooden platform facing the waterfall, with a bench;
   - shafts of sunlight slanting between the trees of Whisperwood by day (with smooth sprites).
   Landmarks stand on spots kept free of everything else (the grass keeps clear of them too). */
import * as THREE from "three";
import * as builders from "./builders.js";
import { SMOOTH } from "./sprites.js";
import { addFxPlace } from "./weapon-fx.js";
import { daylight } from "./daylight.js";
import { cameraState } from "./world.js";
import { inForest } from "./regions.js";

import { WATCHTOWER, SHRINE, FAIRY_RING, LOOKOUT } from "./rules/landmarks.js";

/** The candles before the shrine and the lantern on the lookout: [x, z, y] (main.js lights them at night). */
export const LANDMARK_CANDLES = [-0.5, 0, 0.5].map((dx) => [SHRINE[0] + dx, SHRINE[1] + 1.3, 0.92]);
export const LANDMARK_LIGHTS = [
  { x: SHRINE[0], z: SHRINE[1] + 1, y: 1.2, radius: 4, color: [255, 210, 140], strength: 0.75 },
  {
    x: FAIRY_RING[0],
    z: FAIRY_RING[1],
    y: 0.5,
    radius: 3.5,
    color: [190, 140, 255],
    strength: 0.7,
  },
  {
    x: LOOKOUT[0] + 1.6,
    z: LOOKOUT[1] + 0.9,
    y: 1.1,
    radius: 4,
    color: [255, 210, 130],
    strength: 0.8,
  },
];

/* a rough stone, with the outline everything has */
function stone(size, random, material, edge) {
  const geometry = new THREE.DodecahedronGeometry(size, 0);
  geometry.scale(1, 0.6 + random() * 0.4, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edge));
  mesh.rotation.set(random() * 3, random() * 3, random() * 3);
  return mesh;
}

/** Builds the landmarks and the light shafts (world.js calls this with its build context). */
export function buildLandmarks({ scene, prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(5151);
  const rockMaterial = builders.material("stone", 2, 2, 0.7);
  const edge = new THREE.LineBasicMaterial({ color: 0x0c0f2a });
  const rubble = (x, z, count, spread) => {
    for (let k = 0; k < count; k++) {
      const rock = stone(0.25 + random() * 0.35, random, rockMaterial, edge);
      rock.position.set(x + (random() - 0.5) * spread, 0.1, z + (random() - 0.5) * spread);
      scene.add(rock);
    }
  };

  /* ----- the Old Watchtower: roofless, its crown broken, a wall fallen beside it ----- */
  {
    const [x, z] = WATCHTOWER;
    place(builders.tower(2.2, 5.5, { hasRoof: false }), x, z, { radius: 2.5 });
    /* what is left of the battlements: blocks of different heights round the top */
    for (let k = 0; k < 9; k++) {
      if (k % 3 === 2) {
        continue;
      }
      const angle = (k / 9) * Math.PI * 2;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5 + random() * 0.7, 0.6),
        builders.material("stone", 0.8, 1, 0.9),
      );
      block.position.set(
        x + Math.cos(angle) * 2,
        5.7 + block.geometry.parameters.height / 2,
        z + Math.sin(angle) * 2,
      );
      block.rotation.y = -angle;
      scene.add(block);
    }
    const fallen = builders.wall(4.5, 1.6, 1);
    place(fallen, x + 4.4, z + 1.2, { rotation: 0.5 });
    obstacles.push({ x: x + 4.4, z: z + 1.2, r: 1.6 }, { x: x + 3.2, z: z + 0.6, r: 1 });
    rubble(x + 1.5, z + 3, 7, 3);
    rubble(x - 2.6, z + 1.8, 4, 2);
    for (const [dx, dz] of [
      [-3.2, 3.4],
      [2.8, 4.2],
      [-1, 4.6],
    ]) {
      pending.push(prop(random() < 0.5 ? "flowers" : "flowers2", x + dx, z + dz, { scale: 1.6 }));
    }
    pending.push(prop("bush", x - 3.4, z - 1.8, { shadow: 1, scale: 1.3 }));
  }

  /* ----- the Wayside Shrine: a statue in a ring of standing stones, open to the road ----- */
  {
    const [x, z] = SHRINE;
    const yard = builders.plaza(3.8, "cobbles2", 0.9);
    yard.position.x = x;
    yard.position.z = z;
    scene.add(yard);
    place(builders.statue(), x, z, { radius: 1.3 });
    for (let k = 0; k < 7; k++) {
      /* the opening faces south, the way most come from */
      const angle = Math.PI * 0.62 + (k / 6) * Math.PI * 1.76;
      const stoneX = x + Math.sin(angle) * 3.4;
      const stoneZ = z + Math.cos(angle) * 3.4;
      place(builders.menhir(1.6 + random() * 0.8), stoneX, stoneZ, {
        rotation: angle,
        radius: 0.5,
      });
    }
    /* the offerings: a low stone with candles, flowers round it */
    const offering = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 0.6),
      builders.material("stone", 1.8, 0.6, 0.85),
    );
    offering.position.set(x, 0.25, z + 1.3);
    scene.add(offering);
    for (const [cx, cz] of LANDMARK_CANDLES) {
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.22, 6),
        new THREE.MeshLambertMaterial({ color: 0xf4ead0 }),
      );
      candle.position.set(cx, 0.61, cz);
      scene.add(candle);
    }
    for (const [dx, dz] of [
      [-1.6, 2],
      [1.7, 1.8],
    ]) {
      pending.push(prop("flowers", x + dx, z + dz, { scale: 1.4 }));
    }
  }

  /* ----- the fairy ring in Whisperwood: mushrooms that glow, in a circle ----- */
  {
    const [x, z] = FAIRY_RING;
    const caps = [mushroom("#b06cff", "#e4c8ff"), mushroom("#6c9cff", "#c8dcff")];
    for (let k = 0; k < 11; k++) {
      const angle = (k / 11) * Math.PI * 2;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: caps[k % 2], transparent: true, alphaTest: 0.5 }),
      );
      const size = 0.42 + random() * 0.18;
      sprite.scale.set(size, size, 1);
      sprite.center.set(0.5, 0);
      sprite.position.set(x + Math.cos(angle) * 1.9, 0, z + Math.sin(angle) * 1.6);
      /* over the night haze: they glow in the dark */
      sprite.renderOrder = 10001;
      scene.add(sprite);
    }
    addFxPlace({ element: "arcane", x, y: 0.5, z, spread: 1.4, rate: 0.3 });
  }

  /* ----- the Falls Lookout: a platform of planks on the south rim, facing the waterfall ----- */
  {
    const [x, z] = LOOKOUT;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.2, 2.6),
      builders.material("wood", 4, 2.6, 0.95),
    );
    deck.position.set(x, 0.1, z);
    scene.add(deck);
    for (const [dx, dz] of [
      [-1.8, -1.1],
      [1.8, -1.1],
      [-1.8, 1.1],
      [1.8, 1.1],
    ]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.1, 0.2),
        builders.material("wood_dark", 0.2, 1.1),
      );
      post.position.set(x + dx, 0.55, z + dz);
      scene.add(post);
    }
    /* the railing along the front (towards the gorge) and the sides */
    place(builders.fence(4, 1), x, z - 1.2, { rotation: 0 });
    place(builders.fence(2.4, 1), x - 2, z, { rotation: Math.PI / 2 });
    place(builders.fence(2.4, 1), x + 2, z, { rotation: Math.PI / 2 });
    for (let dx = -1.8; dx <= 1.8; dx += 0.9) {
      obstacles.push({ x: x + dx, z: z - 1.5, r: 0.45 });
    }
    place(builders.bench(), x - 0.6, z + 0.6, { rotation: Math.PI });
    pending.push(prop("lantern", x + 1.6, z + 0.9, { radius: 0.25 }));
  }

  if (SMOOTH) {
    buildLightShafts(scene, random);
  }
}

/* a glowing mushroom, 8 × 8 pixels: [cap, light of the cap] */
function mushroom(cap, light) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const ctx = canvas.getContext("2d");
  const rows = [
    "..cccc..",
    ".cclccc.",
    "cclwcwcc",
    "cccccccc",
    "..ssss..",
    "...ss...",
    "...ss...",
    "..ssss..",
  ];
  const colors = { c: cap, l: light, w: "#ffffff", s: "#e8e0f4" };
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (colors[cell]) {
        ctx.fillStyle = colors[cell];
        ctx.fillRect(x, y, 1, 1);
      }
    }),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ---------------------------------------------------------------- light shafts in the forest ----------------- */

const shafts = [];

function buildLightShafts(scene, random) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const along = ctx.createLinearGradient(0, 0, 0, 128);
  along.addColorStop(0, "rgba(255,248,214,0.9)");
  along.addColorStop(1, "rgba(255,248,214,0)");
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, 32, 128);
  /* soft at the sides */
  ctx.globalCompositeOperation = "destination-in";
  const across = ctx.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, "rgba(0,0,0,0)");
  across.addColorStop(0.5, "rgba(0,0,0,1)");
  across.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, 32, 128);
  const texture = new THREE.CanvasTexture(canvas);
  for (let k = 0; k < 14; k++) {
    const x = -36 + random() * 72;
    const z = -122 + random() * 62;
    if (!inForest(x, z, 3)) {
      continue;
    }
    const width = 1.2 + random() * 1.6;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 8).translate(0, 4, 0),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, 0, z);
    mesh.renderOrder = 10001;
    scene.add(mesh);
    shafts.push({ mesh, phase: random() * 6, strength: 0.2 + random() * 0.14 });
  }
}

/* ---------------------------------------------------------------- every frame -------------------------------- */

/** Per frame: the light shafts turn to the camera and breathe. */
export function updateLandmarks(dt, time) {
  const light = daylight();
  for (const shaft of shafts) {
    shaft.mesh.rotation.set(0, cameraState.yaw, 0.35);
    shaft.mesh.material.opacity =
      light * shaft.strength * (0.75 + 0.25 * Math.sin(time * 0.6 + shaft.phase));
  }
}
