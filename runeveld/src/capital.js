/* Eldoria – Kingsvale and Aurelia: the meadow plain west of the field with the capital. A walled city with three
   gates, a main avenue to the castle, a square with a fountain and a statue, four quarters (market, temple,
   residential, barracks) and outside the walls farms, a mill, a lake and the bandit camp in the north. */
import * as builders from "./builders.js";
import {
  VALE,
  CAPITAL,
  CASTLE,
  KINGS_ROAD,
  BANDIT_CAMP,
  inVale,
  inFields,
  inCapital,
  valeEdge,
  distanceToPath,
} from "./regions.js";

/**
 * Builds the capital and its surroundings. context (from world.js): {scene, prop(name, x, z, options),
 * place(group, x, z, options), isFree(x, z, r), seededRandom(seed), pending (load promises), obstacles}.
 */
export function buildCapital({ scene, prop, place, isFree, seededRandom, pending, obstacles }) {
  const random = seededRandom(9001);
  const { x0, x1, z0, z1, cx } = CAPITAL;
  const lantern = (x, z) => pending.push(prop("lantern", x, z, { radius: 0.25 }));
  const treeOptions = { radius: 0.55, shadow: 1.8, scale: 1.3 };
  const bushOptions = { shadow: 1, scale: 1.3 };
  const rockOptions = { radius: 0.6, shadow: 1.4, scale: 1.2 };

  function addObstacle(x, z, r) {
    obstacles.push({ x, z, r });
  }

  /* A wall along x from `start` to `end` at z = `fixed` (or along z when `alongZ`), with gaps where `isGap(middle)`
     is true; collision circles per segment. */
  function wallLine(start, end, fixed, alongZ, isGap) {
    const SEGMENT = 6;
    for (let t = start; t < end - 0.01; t += SEGMENT) {
      const length = Math.min(SEGMENT, end - t);
      const middle = t + length / 2;
      if (isGap && isGap(middle)) {
        continue;
      }
      const x = alongZ ? fixed : middle;
      const z = alongZ ? middle : fixed;
      place(builders.wall(length), x, z, { rotation: alongZ ? Math.PI / 2 : 0 });
      for (let s = -length / 2 + 0.7; s < length / 2; s += 1.4) {
        addObstacle(alongZ ? x : middle + s, alongZ ? middle + s : z, 1);
      }
    }
  }
  const inNorthSouthGate = (middle) => Math.abs(middle - cx) < 5;
  const inEastGate = (middle) => Math.abs(middle) < 5;

  /* ----- the city wall: four sides, corner towers, intermediate towers and three gatehouses ----- */
  wallLine(x0, x1, z0, false, inNorthSouthGate);
  wallLine(x0, x1, z1, false, inNorthSouthGate);
  wallLine(z0, z1, x0, true, null);
  wallLine(z0, z1, x1, true, inEastGate);
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]) {
    place(builders.tower(2.4, 7), x, z, { radius: 2.6 });
  }
  const wallTowers = [
    [x0 + 26, z0],
    [x0 + 52, z0],
    [x0 + 26, z1],
    [x0 + 52, z1],
    [x0, -20],
    [x0, 20],
    [x1, -22],
    [x1, 22],
  ];
  for (const [x, z] of wallTowers) {
    place(builders.tower(1.8, 6), x, z, { radius: 2 });
  }
  place(builders.gatehouse(), cx, z0, { rotation: 0 });
  place(builders.gatehouse(), cx, z1, { rotation: 0 });
  place(builders.gatehouse({ w: 10, h: 6 }), x1, 0, { rotation: Math.PI / 2 });
  for (const [x, z] of [
    [cx - 3.5, z0],
    [cx + 3.5, z0],
    [cx - 3.5, z1],
    [cx + 3.5, z1],
    [x1, -4],
    [x1, 4],
  ]) {
    addObstacle(x, z, 1.6);
  }

  /* ----- streets: the main avenue from the east gate to the castle, the cross avenue between the north and south
     gates, side streets ----- */
  scene.add(
    builders.street(5, x1 - CASTLE.x1 + 4, {
      x: (x1 + CASTLE.x1) / 2 + 2,
      z: 0,
      rotation: Math.PI / 2,
    }),
  );
  scene.add(builders.street(4, z1 - z0 + 6, { x: cx, z: 0 }));
  scene.add(builders.street(3, 34, { x: -117, z: -20, rotation: Math.PI / 2 }));
  scene.add(builders.street(3, 34, { x: -117, z: 20, rotation: Math.PI / 2 }));
  scene.add(builders.street(3, 30, { x: -158, z: -25 }));
  scene.add(builders.street(3, 20, { x: -152, z: 28 }));
  /* roads outside the gates: the King's Road to the village and short stretches to the north and south */
  const [[roadX0], [roadX1]] = KINGS_ROAD;
  scene.add(
    builders.path(3.4, Math.abs(roadX1 - roadX0) + 2, {
      x: (roadX0 + roadX1) / 2,
      z: 0,
      rotation: Math.PI / 2,
    }),
  );
  scene.add(builders.path(3, 18, { x: cx, z: z0 - 9 }));
  scene.add(builders.path(3, 16, { x: cx, z: z1 + 8 }));

  /* ----- the square: fountain, statue, benches, lanterns, flowers ----- */
  const square = builders.squarePlaza(22, 22);
  square.position.set(cx, 0.02, 0);
  scene.add(square);
  place(builders.fountain(2.6), cx, 0, { radius: 3.4 });
  place(builders.statue(), cx, -7.5, { radius: 1.5, rotation: Math.PI });
  for (const [dx, dz] of [
    [-7, -7],
    [7, -7],
    [7, 7],
    [-7, 7],
  ]) {
    place(builders.bench(), cx + dx, dz, { radius: 0.8, rotation: Math.atan2(-dx, -dz) });
  }
  for (const [dx, dz] of [
    [-9.5, -9.5],
    [9.5, -9.5],
    [9.5, 9.5],
    [-9.5, 9.5],
    [-5, -2],
    [5, 2],
  ]) {
    lantern(cx + dx, dz);
  }
  for (const [dx, dz] of [
    [-8, 0],
    [8, 0],
    [0, 8],
    [-4, 5],
    [4, -5],
  ]) {
    pending.push(prop("flowers", cx + dx, dz, { scale: 1.6 }));
  }
  /* lanterns along the main avenue and the cross avenue */
  for (let x = x1 - 6; x > CASTLE.x1 + 2; x -= 8) {
    for (const z of [-3.4, 3.4]) {
      if (Math.abs(x - cx) > 11) {
        lantern(x, z);
      }
    }
  }
  for (let z = z0 + 6; z < z1 - 2; z += 9) {
    for (const x of [cx - 3, cx + 3]) {
      if (Math.abs(z) > 11) {
        lantern(x, z);
      }
    }
  }

  /* ----- the castle: an inner wall with towers, the castle gate to the main avenue, the keep and a courtyard ----- */
  const castle = CASTLE;
  wallLine(castle.x0, castle.x1, castle.z0, false, null);
  wallLine(castle.x0, castle.x1, castle.z1, false, null);
  wallLine(castle.z0, castle.z1, castle.x0, true, null);
  wallLine(castle.z0, castle.z1, castle.x1, true, (middle) => Math.abs(middle) < 5);
  for (const [x, z] of [
    [castle.x0, castle.z0],
    [castle.x1, castle.z0],
    [castle.x1, castle.z1],
    [castle.x0, castle.z1],
  ]) {
    place(builders.tower(2, 8), x, z, { radius: 2.2 });
  }
  place(builders.gatehouse({ w: 10, h: 6 }), castle.x1, 0, { rotation: Math.PI / 2 });
  for (const z of [-4, 4]) {
    addObstacle(castle.x1, z, 1.6);
  }
  place(builders.keep(), castle.cx - 2, 0, { rotation: Math.PI / 2 });
  /* the keep's footprint as a grid of collision circles */
  for (let z = -8; z <= 8; z += 2) {
    for (let x = castle.cx - 8; x <= castle.cx + 4; x += 2) {
      addObstacle(x, z, 1.3);
    }
  }
  const courtyard = builders.squarePlaza(
    castle.x1 - castle.x0 - 3,
    castle.z1 - castle.z0 - 3,
    "cobbles2",
  );
  courtyard.position.set(castle.cx, 0.02, 0);
  scene.add(courtyard);
  scene.add(
    builders.street(5, castle.x1 - (castle.cx + 4) + 2, {
      x: (castle.x1 + castle.cx + 4) / 2,
      z: 0,
      rotation: Math.PI / 2,
    }),
  );
  for (const [x, z] of [
    [castle.cx + 6, -6],
    [castle.cx + 6, 6],
    [castle.x1 - 3, -6],
    [castle.x1 - 3, 6],
  ]) {
    lantern(x, z);
  }
  for (const [x, z] of [
    [castle.cx + 8, -12],
    [castle.cx + 8, 12],
    [castle.cx - 4, -13],
    [castle.cx - 4, 13],
  ]) {
    place(builders.flag(3), x, z, { radius: 0.2 });
  }
  place(builders.pond(1.6), castle.cx + 8, -11, { radius: 2.3 });
  place(builders.pond(1.6), castle.cx + 8, 11, { radius: 2.3 });
  for (const [x, z] of [
    [castle.cx + 4, -13],
    [castle.cx + 4, 13],
    [castle.cx - 8, -13],
    [castle.cx - 8, 13],
  ]) {
    pending.push(prop("tree2", x, z, { radius: 0.55, shadow: 1.8, scale: 1.2 }));
  }

  /* ----- northwest: the market, the inn, the apothecary and the tailor ----- */
  const market = builders.squarePlaza(18, 13);
  market.position.set(-160, 0.02, -27);
  scene.add(market);
  const stalls = [
    [-166, -32, "cloth_red", 0.15],
    [-160, -32.5, "cloth_green", 0],
    [-154, -32, "cloth_red", -0.15],
    [-167, -22, "cloth_green", Math.PI - 0.2],
    [-153, -22, "cloth_red", Math.PI + 0.2],
  ];
  for (const [x, z, cloth, rotation] of stalls) {
    place(builders.stall({ cloth, w: 3 }), x, z, { radius: 1.7, rotation });
  }
  for (const [x, z] of [
    [-169.5, -27],
    [-150.5, -27],
    [-160, -27],
  ]) {
    lantern(x, z);
  }
  place(builders.barrel(), -169.5, -33.6, { radius: 0.45 });
  place(builders.barrel(), -150.4, -33.4, { radius: 0.45 });
  place(builders.chest(), -168.8, -20.6, { radius: 0.5, rotation: 0.4 });
  place(builders.chest(0.7), -151, -20.4, { radius: 0.45, rotation: -0.5 });
  pending.push(prop("cart", -171.5, -23.5, { radius: 1.2, shadow: 2.6 }));
  /* the inn: front towards the market */
  place(
    builders.house({ w: 8, d: 5.5, h: 3.4, roofHeight: 2.6, wallTexture: "wall", windows: 3 }),
    -160,
    -36.6,
    { radius: 4.4 },
  );
  /* the apothecary */
  place(
    builders.house({ w: 5.5, d: 4.5, h: 2.8, roofHeight: 2, wallTexture: "stone", windows: 2 }),
    -148.5,
    -37,
    { radius: 3.2 },
  );
  /* the tailor */
  place(builders.house({ w: 5.5, d: 4.5, wallTexture: "wood", windows: 2 }), -172, -37, {
    radius: 3.2,
  });
  /* the money changer, front towards the avenue */
  place(
    builders.house({ w: 6, d: 5, h: 2.8, roofHeight: 2.2, wallTexture: "wall", windows: 2 }),
    -170.5,
    -13.5,
    { radius: 3.6, rotation: Math.PI / 2 },
  );
  place(builders.hayBale(), -173, -20.6, { radius: 0.7, rotation: 0.3 });
  place(builders.hayBale(), -171.6, -19.8, { radius: 0.7, rotation: -0.4 });

  /* ----- southwest: the temple, a garden with a pond and benches ----- */
  place(builders.church(), -163, 30, { radius: 5.6 });
  place(builders.pond(2.2), -150, 26, { radius: 2.9 });
  for (const [x, z, rotation] of [
    [-153, 21, 0.6],
    [-147, 30, -0.8],
    [-156, 36, 1.6],
  ]) {
    place(builders.bench(), x, z, { radius: 0.8, rotation });
  }
  for (const [x, z] of [
    [-146, 21],
    [-154, 37.5],
  ]) {
    lantern(x, z);
  }
  for (const [x, z] of [
    [-172, 22],
    [-172, 37],
    [-147, 37.5],
    [-156, 19],
  ]) {
    pending.push(prop("tree", x, z, treeOptions));
  }
  for (const [x, z] of [
    [-147.5, 24],
    [-152.5, 31.5],
    [-170, 30],
    [-156, 22.5],
  ]) {
    pending.push(prop("flowers", x, z, { scale: 1.6 }));
  }
  for (const [x, z] of [
    [-171, 26],
    [-150, 34.5],
  ]) {
    pending.push(prop("bush", x, z, bushOptions));
  }

  /* ----- northeast: the residential quarter, two rows of houses along the street at z = -20 ----- */
  const houses = [
    [{ w: 6, d: 5, wallTexture: "wall" }, -129, -30, 0],
    [{ w: 6.5, d: 5, h: 3.2, roofHeight: 2.4, wallTexture: "wood", windows: 2 }, -118, -30.5, 0],
    [{ w: 5.5, d: 4.5, wallTexture: "stone", windows: 1 }, -107.5, -30, 0],
    [{ w: 6, d: 5, wallTexture: "wall", windows: 2 }, -129, -10.5, Math.PI],
    [{ w: 5.5, d: 4.5, wallTexture: "wood" }, -118.5, -10, Math.PI],
    [
      { w: 6.5, d: 5, h: 3.2, roofHeight: 2.4, wallTexture: "wall", windows: 3 },
      -107.5,
      -10.5,
      Math.PI,
    ],
  ];
  for (const [options, x, z, rotation] of houses) {
    place(builders.house(options), x, z, {
      radius: Math.max(options.w, options.d) / 2 + 0.4,
      rotation,
    });
    /* a short cobbled path from the door (left on the front wall) to the street */
    const doorX = x + (rotation ? 1 : -1) * (-options.w / 2 + 1.3);
    const frontSign = rotation ? -1 : 1;
    scene.add(builders.street(1.4, 3.2, { x: doorX, z: z + frontSign * (options.d / 2 + 1.6) }));
  }
  for (const [x, z] of [
    [-134, -20],
    [-101.5, -20],
    [-112.5, -16.5],
    [-123.5, -23.5],
  ]) {
    lantern(x, z);
  }
  place(builders.garden(4, 3), -102, -36.5, { radius: 2.2 });
  place(builders.garden(3.5, 3), -134, -36, { radius: 2 });
  for (const [x, z] of [
    [-113, -37],
    [-124, -36.5],
    [-103, -14],
    [-134, -5],
  ]) {
    pending.push(prop("tree2", x, z, treeOptions));
  }
  for (const [x, z] of [
    [-125, -14.5],
    [-111, -26],
    [-132, -26.5],
    [-104, -25.5],
  ]) {
    pending.push(prop("bush", x, z, bushOptions));
  }
  place(builders.well(), -117, -4.5, { radius: 1.1 });

  /* ----- southeast: the barracks, the training ground, the forge, the stables and the guild ----- */
  /* barracks, front towards the street */
  place(
    builders.house({ w: 11, d: 5.5, h: 3.2, roofHeight: 2.2, wallTexture: "stone", windows: 4 }),
    -108,
    32,
    { radius: 5.7, rotation: Math.PI },
  );
  /* forge */
  place(
    builders.house({ w: 6, d: 5, h: 2.8, roofHeight: 2, wallTexture: "stone", windows: 1 }),
    -129,
    10.5,
    { radius: 3.5 },
  );
  /* the guild */
  place(
    builders.house({ w: 7.5, d: 5, h: 3.2, roofHeight: 2.4, wallTexture: "wall", windows: 3 }),
    -116,
    10.5,
    { radius: 4.2 },
  );
  /* the stables */
  place(
    builders.house({
      w: 6.5,
      d: 5,
      h: 2.6,
      roofHeight: 2,
      wallTexture: "wood",
      windows: 1,
      chimney: false,
    }),
    -104,
    10.5,
    { radius: 3.7 },
  );
  pending.push(
    prop("anvil", -125, 15.2, { radius: 0.5, shadow: 1 }),
    prop("woodpile", -133.5, 13.6, { radius: 0.6, shadow: 1.2 }),
  );
  place(builders.hayBale(), -101.5, 15.2, { radius: 0.7, rotation: 0.5 });
  place(builders.hayBale(), -100.5, 16.6, { radius: 0.7, rotation: -0.3 });
  pending.push(prop("cart", -108, 16, { radius: 1.2, shadow: 2.6 }));
  /* the training ground: a fence around it, hay bales as targets */
  for (const x of [-131, -128.4, -125.8, -123.2]) {
    place(builders.fence(2.6), x, 24.5, { radius: 1.1 });
  }
  for (const z of [27, 29.6, 32.2, 34.8]) {
    place(builders.fence(2.6), -132.3, z, { radius: 1.1, rotation: Math.PI / 2 });
  }
  for (const [x, z] of [
    [-129, 30],
    [-124, 33],
    [-126, 27.5],
  ]) {
    place(builders.hayBale(), x, z, { radius: 0.7, rotation: random() * 3 });
  }
  place(builders.chest(), -121, 35, { radius: 0.5 });
  place(builders.barrel(), -120, 33.6, { radius: 0.45 });
  for (const [x, z] of [
    [-134, 20],
    [-101.5, 20],
    [-113, 24],
    [-123, 16.5],
  ]) {
    lantern(x, z);
  }
  for (const [x, z] of [
    [-102, 37],
    [-113.5, 37.5],
    [-134, 37],
    [-101, 4],
  ]) {
    pending.push(prop("tree", x, z, treeOptions));
  }

  /* signs at the gates */
  pending.push(
    prop("sign", x1 + 3.4, -3.2, { radius: 0.4 }),
    prop("sign", cx + 3.2, z0 - 3.2, { radius: 0.4 }),
    prop("sign", cx - 3.2, z1 + 3.2, { radius: 0.4 }),
  );
  for (const [x, z] of [
    [x1 + 2.6, 3.2],
    [x1 + 2.6, -3.2],
    [cx + 3, z0 - 2.6],
    [cx - 3, z0 - 2.6],
    [cx + 3, z1 + 2.6],
    [cx - 3, z1 + 2.6],
  ]) {
    lantern(x, z);
  }

  /* ----- outside the walls: farm, mill, lake, bandit camp, and the meadows with trees and rocks ----- */
  /* a farm on the King's Road */
  place(
    builders.house({ w: 6.5, d: 5, h: 2.8, roofHeight: 2.2, wallTexture: "wood", windows: 2 }),
    -76,
    -11,
    { radius: 3.7 },
  );
  place(builders.garden(7, 4.5), -66, -12, { radius: 4 });
  place(builders.garden(7, 4.5), -86, -11.5, { radius: 4 });
  for (const [x, z] of [
    [-71, -5.6],
    [-69.5, -4.6],
    [-80.6, -5.2],
  ]) {
    place(builders.hayBale(), x, z, { radius: 0.7, rotation: random() * 3 });
  }
  for (const x of [-88, -85.4, -82.8, -80.2, -77.6, -75, -72.4, -69.8, -67.2, -64.6]) {
    place(builders.fence(2.6), x, -16.5, { radius: 1.1 });
  }
  pending.push(
    prop("cart", -72.5, -7.4, { radius: 1.2, shadow: 2.6 }),
    prop("lantern", -73.8, -7.4, { radius: 0.25 }),
  );

  /* the mill: a tall tower with four sails (flags with a stretched cloth) */
  const mill = builders.tower(2.2, 7, { hasRoof: true });
  place(mill, -78, 18, { radius: 2.6 });
  for (let i = 0; i < 4; i++) {
    const sail = builders.flag(0.1, "cloth_green");
    const sailCloth = sail.children[1];
    sailCloth.scale.set(4.6, 1.3, 1);
    sailCloth.position.set(2.6, 0, 0);
    sail.rotation.z = (i * Math.PI) / 2;
    sail.position.set(0, 7.2, 2.5);
    mill.add(sail);
  }
  place(builders.hayBale(), -74.5, 21, { radius: 0.7 });
  place(builders.chest(), -81.5, 21.6, { radius: 0.5, rotation: 0.6 });

  /* the lake in the south, with reed beds of bushes */
  place(builders.pond(7), -118, 54, { radius: 7.7 });
  for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
    const x = -118 + Math.cos(angle) * 8.6;
    const z = 54 + Math.sin(angle) * 8.6;
    if (inVale(x, z, 2) && random() < 0.7) {
      pending.push(prop("bush", x, z, bushOptions));
    }
  }

  /* the bandit camp: tents around a fire pit, loot and a ring of rocks and bales */
  const [campX, campZ] = BANDIT_CAMP;
  for (const [dx, dz, rotation] of [
    [-5, -3, Math.PI / 2 + 0.3],
    [5, -3.5, -Math.PI / 2 + 0.2],
    [0, 5.5, Math.PI + 0.1],
  ]) {
    const cloth = dx < 0 ? "cloth_green" : "cloth_red";
    place(builders.tent(3.2, 3.4, cloth), campX + dx, campZ + dz, { radius: 2, rotation });
  }
  place(builders.chest(), campX + 3, campZ + 3, { radius: 0.5, rotation: 0.5 });
  place(builders.chest(0.7), campX - 3.4, campZ + 2.6, { radius: 0.45 });
  place(builders.barrel(), campX + 4, campZ + 1.4, { radius: 0.45 });
  place(builders.hayBale(), campX - 6, campZ + 3, { radius: 0.7, rotation: 0.4 });
  for (const [dx, dz] of [
    [-8, -7],
    [8, -7],
    [9, 2],
    [-9, 3],
    [0, -9],
    [6, 8],
    [-6, 8],
  ]) {
    pending.push(prop("rock", campX + dx, campZ + dz, { radius: 0.6, shadow: 1.4, scale: 1.3 }));
  }
  pending.push(
    prop("woodpile", campX - 2, campZ - 1.8, { radius: 0.5 }),
    prop("sign", campX + 1.6, campZ + 9.2, { radius: 0.4 }),
  );

  /* meadows: loose trees, bushes, flowers and rocks; not in the city, not on the roads, not near the camp, the
     lake or the farm */
  const isOpenMeadow = (x, z, margin) =>
    inVale(x, z, margin) &&
    !inFields(x, z) &&
    !inCapital(x, z, -3) &&
    distanceToPath(x, z, KINGS_ROAD) > 3 &&
    Math.abs(x - cx) > 4 &&
    Math.hypot(x - campX, z - campZ) > 11 &&
    Math.hypot(x + 118, z - 54) > 10 &&
    !(x > -92 && x < -60 && z > -19 && z < 24);
  const meadowPlants = ["tree", "tree", "tree2", "tree2", "pine", "bush", "bush"];
  const randomValePoint = () => [
    VALE.x0 + random() * (VALE.x1 - VALE.x0),
    VALE.z0 + random() * (VALE.z1 - VALE.z0),
  ];
  for (let k = 0; k < 420; k++) {
    const [x, z] = randomValePoint();
    if (!isOpenMeadow(x, z, 2.5) || !isFree(x, z, 2)) {
      continue;
    }
    const name = meadowPlants[Math.floor(random() * meadowPlants.length)];
    pending.push(prop(name, x, z, name === "bush" ? bushOptions : treeOptions));
  }
  for (let k = 0; k < 40; k++) {
    const [x, z] = randomValePoint();
    if (!isOpenMeadow(x, z, 2) || !isFree(x, z, 1.5)) {
      continue;
    }
    pending.push(prop("rock", x, z, rockOptions));
  }
  for (let k = 0; k < 70; k++) {
    const [x, z] = randomValePoint();
    if (!isOpenMeadow(x, z, 2) || !isFree(x, z, 1)) {
      continue;
    }
    pending.push(prop(random() < 0.5 ? "flowers" : "flowers2", x, z, { scale: 1.6 }));
  }

  /* The edge of the plain: a dense tree row on the wavy edge (collision) and loose rows outside it; nothing where
     the field overlaps. */
  const borderRows = [
    /* [offset from the edge, closed row, chance] */
    [-1.2, true, 1],
    [1.8, false, 1],
    [4.6, false, 0.85],
    [7.4, false, 0.7],
    [10.4, false, 0.5],
  ];
  for (let theta = 0; theta < Math.PI * 2; theta += 2.3 / 70) {
    const edge = valeEdge(theta);
    for (const [offset, isClosed, chance] of borderRows) {
      const factor = edge + offset / VALE.rz + (isClosed ? 0 : (random() - 0.5) * 0.05);
      const x =
        VALE.cx + Math.sin(theta) * VALE.rx * factor + (isClosed ? 0 : (random() - 0.5) * 1.2);
      const z = VALE.cz + Math.cos(theta) * VALE.rz * factor;
      if (inFields(x, z) || random() > chance) {
        continue;
      }
      let name;
      if (random() < 0.55) {
        name = "tree";
      } else {
        name = random() < 0.5 ? "tree2" : "pine";
      }
      pending.push(prop(name, x, z, { radius: isClosed ? 0.7 : 0, shadow: 1.8, scale: 1.3 }));
    }
  }
}
