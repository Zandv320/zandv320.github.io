/* Eldoria – the Northroad (Saga II): the land along the road from Aurelia's north gate, with Fort Harrow across the
   road where the hills begin, the barley fields of its farmers, the Halfway Inn with its little hamlet, the goblins'
   ruin of Northwatch, and the Old King's Bridge over Greyfall Gorge, whose planks fall when the troll smashes them
   (updateNorthroad keeps them in step with rules/gorge.js). The shape of the land, the road and the places are in
   regions.js and rules/gorge.js; the ground map (with the gorge) is drawn by world.js. */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  NORTHROAD,
  NORTH_ROAD,
  NORTH_FARMS,
  inNorthroad,
  northroadWidth,
  inVale,
  distanceToPath,
} from "./regions.js";
import {
  GORGE,
  BRIDGE,
  NORTHWATCH,
  inGorge,
  gorgeNorthRim,
  gorgeSouthRim,
  brokenPlanks,
} from "./rules/gorge.js";
import { player, playEffect } from "./game-state.js";

/* the spot in front of the inn's door: where a hero who fell on the road wakes up */
export const INN_DOOR = [NORTHROAD.inn[0] + 5.2, NORTHROAD.inn[1]];

/* Hedge-wizard Pell's camp west of the road, in sight of Northwatch; Carter Wil's cart south of the bridge */
export const PELL_CAMP = [-150, -201];
export const WIL_CART = [-130, -254.5];

/* the bridge's planks, in two halves across: {mesh, x, z, fall (0 standing .. 1 gone)} */
const planks = [];
/* the humming runestone's crack, which glows and pulses */
let humGlow = null;
let nextHumSpark = 0;

const inFarm = (x, z, margin = 0) =>
  NORTH_FARMS.some(
    ([x0, z0, x1, z1]) => x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin,
  );

/**
 * Builds the Northroad (world.js calls this with its build context).
 * @param {object} context {scene, prop, place, isFree, seededRandom, pending}
 */
export function buildNorthroad({ scene, prop, place, isFree, seededRandom, pending }) {
  const random = seededRandom(2207);
  const [fortX, fortZ] = NORTHROAD.fort;
  const [innX, innZ] = NORTHROAD.inn;
  const treeOptions = { radius: 0.55, shadow: 1.8, scale: 1.3 };
  const rockOptions = { radius: 0.6, shadow: 1.4, scale: 1.2 };
  const lantern = (x, z) => pending.push(prop("lantern", x, z, { radius: 0.25 }));

  /* ----- the road, segment by segment, overlapping a little so the bends are closed ----- */
  for (let i = 0; i < NORTH_ROAD.length - 1; i++) {
    const [ax, az] = NORTH_ROAD[i];
    const [bx, bz] = NORTH_ROAD[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    scene.add(
      builders.path(3.4, Math.hypot(dx, dz) + 1.6, {
        x: (ax + bx) / 2,
        z: (az + bz) / 2,
        rotation: Math.atan2(dx, dz),
      }),
    );
  }

  /* ----- Fort Harrow: a gatehouse over the road and a wall from edge to edge of the land ----- */
  place(builders.gatehouse({ w: 10, h: 6 }), fortX, fortZ);
  for (const side of [-1, 1]) {
    let x = fortX + side * (5 + 3);
    while (inNorthroad(x - side * 3, fortZ, -6)) {
      place(builders.wall(6, 3.8, 1.4), x, fortZ);
      x += side * 6;
    }
    place(builders.tower(2, 6.5), x - side * 3, fortZ, { radius: 2.2 });
    place(builders.tower(1.6, 6), fortX + side * 7.5, fortZ, { radius: 1.8 });
  }
  /* inside the wall, on the north side: the guardhouse, a fire, supplies */
  place(
    builders.house({ w: 6, d: 4.5, h: 2.8, wallTexture: "stone", windows: 1 }),
    fortX + 11,
    fortZ - 8,
    {
      rotation: -Math.PI / 2,
    },
  );
  place(builders.campfire(), fortX - 7, fortZ - 7);
  place(builders.flag(3, "cloth_red"), fortX + 4, fortZ - 6);
  for (const [x, z] of [
    [fortX - 4.5, fortZ - 3.2],
    [fortX + 4.5, fortZ - 3.2],
    [fortX - 4.5, fortZ + 3.2],
    [fortX + 4.5, fortZ + 3.2],
  ]) {
    lantern(x, z);
  }
  place(builders.barrel(), fortX + 7.5, fortZ - 3.5, { radius: 0.45 });
  place(builders.barrel(), fortX + 8.4, fortZ - 4.4, { radius: 0.45 });
  place(builders.chest(), fortX - 9, fortZ - 3.8, { radius: 0.5 });
  pending.push(prop("sign", fortX - 3.2, fortZ + 4.8, { radius: 0.3 }));

  /* ----- the barley fields: hay, a scarecrow, a fence along the road side ----- */
  for (const [x0, z0, x1, z1] of NORTH_FARMS) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    place(builders.scarecrow(), cx, cz, { radius: 0.4 });
    for (let k = 0; k < 4; k++) {
      place(
        builders.hayBale(),
        x0 + 2 + random() * (x1 - x0 - 4),
        z0 + 2 + random() * (z1 - z0 - 4),
        {
          rotation: random() * Math.PI,
          radius: 0.6,
        },
      );
    }
    const roadSide = Math.abs(x0 - NORTH_ROAD[4][0]) < Math.abs(x1 - NORTH_ROAD[4][0]) ? x0 : x1;
    for (let z = z0 + 1.3; z < z1 - 1; z += 2.6) {
      place(builders.fence(), roadSide, z, { rotation: Math.PI / 2 });
    }
  }

  /* ----- the Halfway Inn and its hamlet, on the west side of the road ----- */
  place(builders.house({ w: 9, d: 7, h: 3.4, roofHeight: 2.6, windows: 3 }), innX, innZ, {
    rotation: Math.PI / 2,
  });
  place(builders.house({ w: 6, d: 5, h: 3 }), innX - 3, innZ - 11, { rotation: Math.PI / 2 });
  place(builders.house({ w: 5.5, d: 4.5, h: 2.8, windows: 1 }), innX - 2, innZ + 11, {
    rotation: Math.PI / 2,
  });
  /* the stable across the road, with hay */
  place(builders.tent(4, 4.4, "cloth_green"), innX + 19, innZ - 4, { rotation: -Math.PI / 2 });
  place(builders.hayBale(), innX + 20, innZ + 0.6, { radius: 0.6 });
  place(builders.hayBale(), innX + 21.2, innZ + 1.4, { rotation: 1, radius: 0.6 });
  place(builders.well(), innX + 6, innZ + 13, { radius: 1.3 });
  place(builders.campfire(), innX + 8, innZ - 9);
  place(builders.bench(), innX + 7.5, innZ - 3.2, { rotation: Math.PI / 2 });
  place(builders.bench(), innX + 7.5, innZ + 3.2, { rotation: Math.PI / 2 });
  place(builders.barrel(), innX + 5.3, innZ + 4.2, { radius: 0.45 });
  pending.push(prop("sign", innX + 6, innZ - 1.6, { radius: 0.3 }));
  for (const [x, z] of [
    [innX + 6.5, innZ + 2],
    [innX + 9, innZ - 10],
    [innX + 9, innZ + 9],
    [innX + 3, innZ - 15],
  ]) {
    lantern(x, z);
  }

  buildNorthwatch({ scene, prop, place, pending, random });
  buildPellCamp({ prop, place, pending });
  buildBridge({ scene, prop, place, pending, random });

  /* where the road ends for now: Saltmere's gate is shut, a barrier and a warning */
  const [endX, endZ] = NORTH_ROAD[NORTH_ROAD.length - 1];
  place(builders.fence(4), endX, endZ + 2.2, { radius: 0 });
  pending.push(prop("sign", endX + 3, endZ + 3, { radius: 0.3 }));

  /* ----- the land: trees and rocks in the hills, a dense tree row along the edge ----- */
  const isOpen = (x, z, margin = 0) =>
    inNorthroad(x, z, 3 + margin) &&
    !inVale(x, z, -4) &&
    distanceToPath(x, z, NORTH_ROAD) > 4.5 + margin &&
    !inFarm(x, z, 2) &&
    Math.hypot(x - fortX, z - fortZ) > 13 &&
    Math.hypot(x - innX - 6, z - innZ) > 20 &&
    Math.hypot(x - NORTHWATCH.x, z - NORTHWATCH.z) > NORTHWATCH.radius + 2 &&
    Math.hypot(x - PELL_CAMP[0], z - PELL_CAMP[1]) > 7 &&
    Math.hypot(x - WIL_CART[0], z - WIL_CART[1]) > 5 &&
    (z > GORGE.south + 3 || z < GORGE.north - 3);
  for (let k = 0; k < 170; k++) {
    const x = NORTHROAD.x0 + random() * (NORTHROAD.x1 - NORTHROAD.x0);
    const z = NORTHROAD.z0 + random() * (NORTHROAD.z1 - 20 - NORTHROAD.z0);
    if (!isOpen(x, z, 1) || !isFree(x, z, 1.4)) {
      continue;
    }
    /* further north the hills grow pines and rocks */
    const isHighland = z < -150;
    const roll = random();
    if (roll < (isHighland ? 0.35 : 0.2)) {
      pending.push(prop(random() < 0.5 ? "rock" : "rock2", x, z, rockOptions));
    } else if (roll < 0.35) {
      pending.push(prop("bush", x, z, { shadow: 1, scale: 1.3 }));
    } else {
      const names = isHighland ? ["pine", "pine2", "tree"] : ["tree", "tree2", "pine"];
      pending.push(prop(names[Math.floor(random() * names.length)], x, z, treeOptions));
    }
  }
  for (let k = 0; k < 60; k++) {
    const x = NORTHROAD.x0 + random() * (NORTHROAD.x1 - NORTHROAD.x0);
    const z = NORTHROAD.z0 + random() * (NORTHROAD.z1 - 20 - NORTHROAD.z0);
    if (isOpen(x, z) && isFree(x, z, 1)) {
      pending.push(prop(random() < 0.5 ? "flowers" : "flowers2", x, z, { scale: 1.6 }));
    }
  }
  /* the edge: a closed row just inside it (collision), loose rows outside; not where Kingsvale takes over */
  for (let x = NORTHROAD.x0; x < NORTHROAD.x1; x += 1.7) {
    for (let z = NORTHROAD.z0; z < NORTHROAD.z1 - 4; z += 1.7) {
      const jx = x + (random() - 0.5) * 0.8;
      const jz = z + (random() - 0.5) * 0.8;
      if (inVale(jx, jz, -6) || (jz < GORGE.south + 2 && jz > GORGE.north - 2)) {
        continue;
      }
      const outside = distanceToPath(jx, jz, NORTH_ROAD) - northroadWidth(jz);
      const isClosed = outside > -1.6 && outside < -0.3;
      const isLoose = outside > 0.6 && outside < 9 && random() < 0.55 - outside * 0.05;
      if (!isClosed && !isLoose) {
        continue;
      }
      const name =
        jz < -150 ? (random() < 0.6 ? "pine" : "pine2") : random() < 0.5 ? "tree" : "pine";
      /* where the band meets the gorge, the trees stand back from the edge */
      if (inGorge(jx, jz)) {
        continue;
      }
      pending.push(prop(name, jx, jz, { radius: isClosed ? 0.7 : 0, shadow: 1.8, scale: 1.3 }));
    }
  }
}

/* ----- Northwatch: the broken watchtower, its fallen walls, the goblins' camp in the ruin, and in the middle the
   runestone that hums ----- */
function buildNorthwatch({ scene, prop, place, pending, random }) {
  const { x, z } = NORTHWATCH;
  /* the tower: only the lower half still stands, and a heap of its stones lies beside it */
  place(builders.tower(2.6, 3.4, { hasRoof: false }), x + 5.5, z - 6.5, {
    radius: 2.8,
  });
  for (const [dx, dz, length, rotation] of [
    [-7.5, -5, 5, 0.5],
    [-8.5, 4.5, 4, -0.7],
    [6.5, 5.5, 4.5, 0.9],
    [1, -9.5, 4, 0.15],
  ]) {
    place(builders.wall(length, 1.6 + random() * 1.2, 1.1), x + dx, z + dz, {
      rotation,
      radius: 0,
    });
  }
  pending.push(prop("crypt_ruin", x - 4, z - 9, { radius: 1.4, shadow: 2, scale: 0.9 }));
  pending.push(prop("crypt_arch", x + 9, z - 1, { radius: 0.8, shadow: 2, scale: 0.9 }));
  /* the goblins' things: hide tents, a fire, plunder from the road */
  place(builders.tent(3, 3, "cloth_red"), x - 3.5, z + 8.5, {
    rotation: 0.3,
    radius: 1.8,
  });
  place(builders.tent(2.6, 2.8, "cloth_red"), x + 3.5, z + 9, {
    rotation: -0.4,
    radius: 1.6,
  });
  place(builders.campfire(), x - 1, z + 4.5);
  place(builders.barrel(), x + 2.2, z + 5.6, { radius: 0.45 });
  place(builders.chest(), x - 4.5, z + 3.8, { rotation: 0.4, radius: 0.5 });
  pending.push(prop("crypt_crates", x + 6.5, z + 1.8, { radius: 0.7, scale: 0.9 }));
  pending.push(prop("crypt_bones", x - 6.5, z + 1, { scale: 0.8 }));
  pending.push(prop("crypt_skulls", x + 1.5, z - 4.8, { scale: 0.6 }));
  for (let k = 0; k < 12; k++) {
    const angle = random() * Math.PI * 2;
    const distance = 4 + random() * 7;
    pending.push(
      prop(
        random() < 0.5 ? "rock" : "rock2",
        x + Math.cos(angle) * distance,
        z + Math.sin(angle) * distance,
        {
          scale: 1 + random() * 0.4,
        },
      ),
    );
  }
  place(builders.flag(2.6, "cloth_red"), x - 9.5, z - 1.5);
  /* the runestone: split down the middle, with light in the crack */
  const stone = new THREE.Group();
  const left = builders.menhir(2.3);
  left.position.x = -0.32;
  left.rotation.z = 0.08;
  const right = builders.menhir(1.7);
  right.position.x = 0.36;
  right.rotation.z = -0.12;
  stone.add(left, right);
  place(stone, x, z, { radius: 0.9 });
  humGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 1.9),
    new THREE.MeshBasicMaterial({
      color: 0xb98cff,
      transparent: true,
      depthWrite: false,
    }),
  );
  humGlow.position.set(x + 0.02, 1.05, z + 0.33);
  /* drawn after the night haze, so it glows in the dark */
  humGlow.renderOrder = 10001;
  scene.add(humGlow);
}

/* ----- Hedge-wizard Pell's camp: a patched tent, a fire and a table full of jars ----- */
function buildPellCamp({ prop, place, pending }) {
  const [x, z] = PELL_CAMP;
  place(builders.tent(2.8, 3, "cloth_green"), x - 2.5, z - 2, {
    rotation: 0.25,
    radius: 1.6,
  });
  place(builders.campfire(), x + 1.2, z + 1.4);
  /* only Pell's own jars: not a brewing station on the map */
  const table = builders.alchemyTable();
  table.userData.mapKind = null;
  place(table, x - 2.6, z + 2.2, { rotation: Math.PI / 2, radius: 0.8 });
  place(builders.bench(), x + 2.8, z + 2, { rotation: Math.PI / 2 });
  pending.push(prop("lantern", x + 0.4, z - 1.6, { radius: 0.25 }));
  pending.push(prop("woodpile", x - 4.6, z + 0.2, { radius: 0.5 }));
}

/* ----- the Old King's Bridge: stone piers on both rims, a deck of planks in two halves across, posts and a rail;
   rocks along the rims of the gorge ----- */
function buildBridge({ scene, prop, place, pending, random }) {
  const { x: bridgeX, halfWidth } = BRIDGE;
  for (const z of [GORGE.south + 1.3, GORGE.north - 1.3]) {
    for (const side of [-1, 1]) {
      place(builders.tower(0.75, 1.9, { hasRoof: false }), bridgeX + side * (halfWidth + 0.9), z, {
        radius: 0.9,
      });
    }
  }
  /* the planks lie across, half the deck wide each; slightly different shades, a few skew */
  const plankDepth = 0.9;
  for (let z = BRIDGE.south - plankDepth / 2; z > BRIDGE.north; z -= plankDepth) {
    for (const side of [-1, 1]) {
      const tint = 0.78 + random() * 0.22;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(halfWidth - 0.04, 0.12, plankDepth - 0.08),
        new THREE.MeshLambertMaterial({
          map: builders.texture("wood", halfWidth / 2, 0.5),
          /* old, weathered boards: the red of the wood gone grey-brown */
          color: new THREE.Color(tint * 0.74, tint * 0.88, tint * 0.95),
          transparent: true,
        }),
      );
      const plankX = bridgeX + (side * halfWidth) / 2;
      mesh.position.set(plankX, -0.03, z);
      mesh.rotation.y = (random() - 0.5) * 0.04;
      mesh.receiveShadow = true;
      scene.add(mesh);
      planks.push({ mesh, x: plankX, z, y: -0.03, fall: 0 });
    }
  }
  /* the stringers along both edges of the deck */
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, BRIDGE.south - BRIDGE.north),
      new THREE.MeshLambertMaterial({ map: builders.texture("wood_dark", 0.4, 6) }),
    );
    beam.position.set(bridgeX + side * (halfWidth + 0.1), 0.02, (BRIDGE.south + BRIDGE.north) / 2);
    scene.add(beam);
  }
  /* posts along both sides with a rope rail, over the drop only */
  const railLength = BRIDGE.south - BRIDGE.north;
  for (const side of [-1, 1]) {
    const railX = bridgeX + side * (halfWidth + 0.12);
    for (let z = BRIDGE.south; z >= BRIDGE.north - 0.01; z -= railLength / 6) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 1.1, 0.22),
        new THREE.MeshLambertMaterial({
          map: builders.texture("wood_dark", 0.3, 1),
        }),
      );
      post.position.set(railX, 0.5, z);
      post.castShadow = true;
      scene.add(post);
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, railLength),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    rail.position.set(railX, 0.92, (BRIDGE.south + BRIDGE.north) / 2);
    scene.add(rail);
  }
  /* the rims: loose rocks along both edges, away from the bridge */
  for (let rimX = NORTHROAD.x0; rimX < NORTHROAD.x1; rimX += 1.8 + random() * 1.4) {
    if (Math.abs(rimX - bridgeX) < halfWidth + 2.5) {
      continue;
    }
    for (const [z, scale] of [
      [gorgeSouthRim(rimX) + 0.9, 1.2],
      [gorgeNorthRim(rimX) - 0.6, 1],
    ]) {
      if (inNorthroad(rimX, z, 0.5) && random() < 0.7) {
        pending.push(
          prop(random() < 0.5 ? "rock" : "rock2", rimX, z, {
            scale: scale + random() * 0.5,
          }),
        );
      }
    }
  }
  /* Carter Wil's cart, stuck on the south side with its load */
  const [cartX, cartZ] = WIL_CART;
  pending.push(prop("cart", cartX, cartZ, { radius: 1.2, shadow: 2.2, scale: 0.9 }));
  place(builders.barrel(), cartX + 2, cartZ + 1.2, { radius: 0.45 });
  place(builders.hayBale(), cartX - 2.1, cartZ + 1, {
    rotation: 0.4,
    radius: 0.6,
  });
}

/* is this plank in a stretch that has fallen? */
const isBroken = (plank) =>
  brokenPlanks().some(
    (hole) => plank.x > hole.x0 && plank.x < hole.x1 && plank.z > hole.z0 && plank.z < hole.z1,
  );

/**
 * Per frame: the bridge's planks follow rules/gorge.js (they tumble away when they break, and are back when the
 * bridge is mended), and the runestone at Northwatch pulses and gives off sparks while someone is near.
 */
export function updateNorthroad(dt, time) {
  for (const plank of planks) {
    const shouldFall = isBroken(plank);
    if (shouldFall && plank.fall < 1) {
      /* down into the gorge: as the camera looks north, that is down the screen, smaller and darker */
      plank.fall = Math.min(1, plank.fall + dt * 0.9);
      const fall = plank.fall;
      plank.mesh.position.set(plank.x, plank.y - fall * 0.2, plank.z + fall * fall * 3.5);
      plank.mesh.rotation.x = fall * 2.2;
      plank.mesh.scale.setScalar(1 - fall * 0.6);
      plank.mesh.material.opacity = 1 - fall;
      plank.mesh.visible = fall < 1;
    } else if (!shouldFall && plank.fall > 0) {
      plank.fall = 0;
      plank.mesh.position.set(plank.x, plank.y, plank.z);
      plank.mesh.rotation.x = 0;
      plank.mesh.scale.setScalar(1);
      plank.mesh.material.opacity = 1;
      plank.mesh.visible = true;
    }
  }
  if (humGlow) {
    humGlow.material.opacity = 0.55 + 0.35 * Math.sin(time * 3.1);
    const isNear = Math.hypot(player.x - NORTHWATCH.x, player.z - NORTHWATCH.z) < 18;
    if (isNear && time > nextHumSpark) {
      nextHumSpark = time + 0.9 + Math.random() * 0.8;
      playEffect("sparkle", NORTHWATCH.x + (Math.random() - 0.5) * 0.6, NORTHWATCH.z + 0.3, {
        size: 0.9,
        y: 0.6 + Math.random() * 1.4,
        tint: 0xc9a6ff,
      });
    }
  }
}
