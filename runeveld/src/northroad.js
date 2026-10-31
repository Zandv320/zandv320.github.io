/* Eldoria – the Northroad (Saga II): the land along the road from Aurelia's north gate, with Fort Harrow across the
   road where the hills begin, the barley fields of its farmers, and the Halfway Inn with its little hamlet. The
   shape of the land, the road and the places are in regions.js; the ground map is drawn by world.js. */
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

/* the spot in front of the inn's door: where a hero who fell on the road wakes up */
export const INN_DOOR = [NORTHROAD.inn[0] + 5.2, NORTHROAD.inn[1]];

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

  /* where the road ends for now: the way to Greyfall Gorge is closed, a barrier and a warning */
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
    Math.hypot(x - innX - 6, z - innZ) > 20;
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
      if (inVale(jx, jz, -6)) {
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
      pending.push(prop(name, jx, jz, { radius: isClosed ? 0.7 : 0, shadow: 1.8, scale: 1.3 }));
    }
  }
}
