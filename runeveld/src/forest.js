/* Eldoria – Whisperwood: the dark forest north of the field. A winding path from the north gate, a woodcutter's
   hut halfway and a clearing with an old altar and standing stones. Dense pines all around. */
import * as builders from "./builders.js";
import {
  FOREST,
  FOREST_PATH,
  ALTAR_CLEARING,
  distanceToPath,
  inForest,
  inFields,
  forestEdge,
} from "./regions.js";

/**
 * Builds the forest. context (from world.js): {scene, prop(name, x, z, options), place(group, x, z, options),
 * isFree(x, z, r), seededRandom(seed), pending (list of load promises), obstacles}.
 */
export function buildForest({ scene, prop, place, isFree, seededRandom, pending }) {
  const random = seededRandom(4242);
  const [clearingX, clearingZ] = ALTAR_CLEARING;
  const treeOptions = { radius: 0.55, shadow: 1.8, scale: 1.3 };
  const rockOptions = { radius: 0.6, shadow: 1.4, scale: 1.2 };

  /* the path, segment by segment, overlapping a little so the bends are closed */
  for (let i = 0; i < FOREST_PATH.length - 1; i++) {
    const [ax, az] = FOREST_PATH[i];
    const [bx, bz] = FOREST_PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    scene.add(
      builders.path(2.6, Math.hypot(dx, dz) + 1.4, {
        x: (ax + bx) / 2,
        z: (az + bz) / 2,
        rotation: Math.atan2(dx, dz),
      }),
    );
  }

  /* the clearing: an old stone floor, the altar in the middle, standing stones around it */
  const clearing = builders.plaza(6.5, "stone", 0.9);
  clearing.position.set(clearingX, 0.02, clearingZ);
  scene.add(clearing);
  place(builders.altar(), clearingX, clearingZ, { radius: 1.9 });
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI * 0.15 + (i * Math.PI * 2) / 5;
    const x = clearingX + Math.cos(angle) * 5.2;
    const z = clearingZ + Math.sin(angle) * 5.2;
    place(builders.menhir(1.8 + random() * 0.8), x, z, { rotation: angle, radius: 0.6 });
  }

  /* the woodcutter's hut along the path, with its front towards the path (east) */
  place(
    builders.house({ w: 4.6, d: 4, h: 2.3, roofHeight: 1.7, wallTexture: "wood", windows: 1 }),
    -16,
    -84,
    { rotation: Math.PI / 2, radius: 3 },
  );
  pending.push(
    prop("woodpile", -16.6, -80.6, { radius: 0.5 }),
    prop("barrel", -13.2, -82.2, { radius: 0.4 }),
    prop("chest", -13.3, -86, { radius: 0.4 }),
    prop("lantern", -12.9, -84.2, { radius: 0.25 }),
  );

  /* the entrance: a sign and lanterns by the field's tree line */
  pending.push(
    prop("sign", 2.8, -61.6, { radius: 0.4 }),
    prop("lantern", -2.8, -61.6, { radius: 0.25 }),
    prop("lantern", 2.8, -64.4, { radius: 0.25 }),
  );

  /* dense pines: a grid with some randomness, not on the path, the clearing or near the hut */
  const forestTrees = ["pine", "pine", "pine", "pine2", "pine2", "tree", "tree2"];
  const isOpenGround = (x, z) =>
    distanceToPath(x, z) > 2.6 &&
    Math.hypot(x - clearingX, z - clearingZ) > 8.2 &&
    !(x > -19.5 && x < -11 && z > -88.5 && z < -79.5) &&
    !(Math.abs(x) < 3.4 && z > -64);
  for (let z = FOREST.z0; z < FOREST.z1; z += 2.7) {
    for (let x = FOREST.x0; x < FOREST.x1; x += 2.7) {
      if (random() < 0.22) {
        continue;
      }
      const jitteredX = x + (random() - 0.5) * 1.8;
      const jitteredZ = z + (random() - 0.5) * 1.8;
      if (
        !inForest(jitteredX, jitteredZ, 2) ||
        !isOpenGround(jitteredX, jitteredZ) ||
        !isFree(jitteredX, jitteredZ, 1.4)
      ) {
        continue;
      }
      const name = forestTrees[Math.floor(random() * forestTrees.length)];
      pending.push(prop(name, jitteredX, jitteredZ, treeOptions));
    }
  }

  /* The edge of the forest: a dense row of pines on the wavy edge (collision) and loose rows outside it; nothing
     where the field overlaps. */
  const borderRows = [
    /* [offset from the edge, closed row, chance] */
    [-1.2, true, 1],
    [1.8, false, 1],
    [4.6, false, 0.85],
    [7.4, false, 0.7],
    [10.4, false, 0.5],
  ];
  for (let theta = 0; theta < Math.PI * 2; theta += 2.3 / 30) {
    const edge = forestEdge(theta);
    for (const [offset, isClosed, chance] of borderRows) {
      const factor = edge + offset / FOREST.rz + (isClosed ? 0 : (random() - 0.5) * 0.05);
      const x = Math.sin(theta) * FOREST.rx * factor + (isClosed ? 0 : (random() - 0.5) * 1.2);
      const z = FOREST.cz + Math.cos(theta) * FOREST.rz * factor;
      if (inFields(x, z) || random() > chance) {
        continue;
      }
      const name = random() < 0.75 ? "pine" : "pine2";
      pending.push(prop(name, x, z, { radius: isClosed ? 0.6 : 0, shadow: 1.8, scale: 1.3 }));
    }
  }

  /* bushes and rocks in the open patches */
  for (let k = 0; k < 60; k++) {
    const x = FOREST.x0 + 3 + random() * (FOREST.x1 - FOREST.x0 - 6);
    const z = FOREST.z0 + 3 + random() * (FOREST.z1 - FOREST.z0 - 5);
    if (!inForest(x, z, 2) || !isOpenGround(x, z) || !isFree(x, z, 1.1)) {
      continue;
    }
    if (random() < 0.55) {
      pending.push(prop("bush", x, z, { shadow: 1, scale: 1.3 }));
    } else {
      pending.push(prop("rock", x, z, rockOptions));
    }
  }

  /* a few rocks at the edge of the clearing and along the path */
  const extraRocks = [
    [clearingX + 7.6, clearingZ + 1.5],
    [clearingX - 7.4, clearingZ - 2.2],
    [clearingX + 3, clearingZ - 7.8],
    [-6.2, -72.5],
    [-13, -93.4],
    [3.6, -95.2],
  ];
  for (const [x, z] of extraRocks) {
    pending.push(prop("rock", x, z, rockOptions));
  }
}
