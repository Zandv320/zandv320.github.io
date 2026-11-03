/* Eldoria – Saltmere, the great harbour at the end of the Northroad (Saga II; the layout is in rules/saltmere.js).
   A walled city of cobbles between the gate in the south and the quay in the north: the Salty Gull and the sailors'
   guild in the west quarter, the harbour square with its market in the middle, the smithy, and in the east the old
   warehouses Maelis has taken. Beyond the quay the sea, below the land: three wooden piers with ships moored along
   them, and the stone mole out to the lighthouse. The sea moves and foams against the quay, ships and buoys ride
   it, gulls wheel over the harbour and sit on the bollards, and at night the lighthouse sweeps its beam over the
   water (updateSaltmere). Near the water you hear the waves and the gulls. */
import * as THREE from "three";
import * as builders from "./builders.js";
import { SALTMERE, PIERS, MOLE, LIGHTHOUSE, SALTY_GULL, WATER_Y } from "./rules/saltmere.js";
import { daylight } from "./daylight.js";
import { player, clickables } from "./game-state.js";
import { BERTH, HULL, ROCKS, ISLETS, EMBER_ISLES, isletReach } from "./rules/sea.js";
import { emberShore } from "./rules/ember.js";
import { TIDECROWN, tidecrownCoast } from "./rules/tidecrown.js";
import { FROSTMARCH, frostCoast, RIME_BAY, FLOES } from "./rules/frostmarch.js";
import { sfx } from "./audio.js";
import { IS_PHONE } from "./sprites.js";

/* the sea reaches this far: past the Grey Sea's edges (rules/sea.js), so it fills the view wherever a ship sails */
const SEA = { x0: -560, x1: 260, z1: SALTMERE.z0, z0: -1660 };
/* the quay wall goes down this far below the land */
const QUAY_DEPTH = 1.8;

/* everything riding the swell (ships, boats, buoys): {group, y, rotation, phase, roll} */
const ships = [];
let seaMaterial = null;
let lighthouseBeam = null;
let lighthouseLamp = null;
/* the Gull's Promise at her berth, and what a click on her catches */
let mooredGull = null;
/* the foam along the quay and around the mole, which breathes with the waves */
const foam = [];
/* the gulls: flying ones {group, wings, cx, cz, radius, height, speed, angle}, sitting ones {group, hopAt} */
const gulls = [];
const sittingGulls = [];
/* how long a sitting gull's hop takes */
const HOP_SECONDS = 0.35;
/* the next wave and gull cry the hero hears near the water */
let nextWave = 0;
let nextGull = 0;

/** Builds Saltmere (world.js calls this with its build context). */
export function buildSaltmere({ scene, prop, place, pending, seededRandom, obstacles }) {
  const random = seededRandom(5150);
  const { x0, x1, z0, z1 } = SALTMERE;
  const [gateX, gateZ] = SALTMERE.gate;
  const [squareX, squareZ] = SALTMERE.square;
  const lantern = (x, z) => pending.push(prop("lantern", x, z, { radius: 0.25 }));

  /* ----- the ground of the city: grey flagstones from wall to quay; cobbles on the main street from the gate, on
     the square and along the quay ----- */
  const city = builders.squarePlaza(x1 - x0, z1 - z0 + 0.6, "stone");
  city.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2 - 0.3);
  scene.add(city);
  const square = builders.squarePlaza(24, 14, "cobbles2");
  square.position.set(squareX, 0.022, squareZ);
  scene.add(square);
  scene.add(builders.street(4, gateZ - squareZ + 2, { x: gateX, z: (gateZ + squareZ) / 2 + 4 }));
  scene.add(builders.street(6, x1 - x0, { x: (x0 + x1) / 2, z: z0 + 4, rotation: Math.PI / 2 }));

  /* ----- the wall: along the south with the gate, down both sides to the sea ----- */
  const wallLine = (start, end, fixed, alongZ, isGap) => {
    for (let t = start; t < end - 0.01; t += 6) {
      const length = Math.min(6, end - t);
      const middle = t + length / 2;
      if (isGap && isGap(middle)) {
        continue;
      }
      place(builders.wall(length, 3.6, 1.2), alongZ ? fixed : middle, alongZ ? middle : fixed, {
        rotation: alongZ ? Math.PI / 2 : 0,
      });
    }
  };
  wallLine(x0, x1, z1, false, (middle) => Math.abs(middle - gateX) < 5);
  wallLine(z0, z1, x0, true, null);
  wallLine(z0, z1, x1, true, null);
  for (const [x, z] of [
    [x0, z1],
    [x1, z1],
    [x0, z0 + 1],
    /* the east corner stands back from the quay: the mole starts beside it */
    [x1, z0 + 7],
  ]) {
    place(builders.tower(2.2, 6.5), x, z, { radius: 2.4 });
  }
  place(builders.gatehouse({ w: 10, h: 6 }), gateX, gateZ);
  for (const side of [-1, 1]) {
    obstacles.push({ x: gateX + side * 3.6, z: gateZ, r: 1.6 });
    lantern(gateX + side * 3.2, gateZ - 2.4);
  }
  place(builders.flag(3.2, "cloth_green"), gateX + 6.5, gateZ - 2.5);

  /* ----- the west quarter: the sailors' guild, the Salty Gull, houses, the harbourmaster's office ----- */
  place(
    builders.house({ w: 10, d: 6, h: 4, roofHeight: 2.6, wallTexture: "stone", windows: 4 }),
    -176,
    -341,
    { rotation: Math.PI },
  );
  place(builders.flag(3, "cloth_red"), -169.5, -344.5);
  const [innX, innZ] = SALTY_GULL;
  place(builders.house({ w: 9, d: 7, h: 3.4, roofHeight: 2.6, windows: 3 }), innX, innZ, {
    rotation: Math.PI / 2,
  });
  pending.push(prop("sign", innX + 5, innZ - 2.2, { radius: 0.3 }));
  for (const [x, z] of [
    [innX + 5.2, innZ + 2.4],
    [innX + 5.4, innZ + 3.3],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  place(builders.bench(), innX + 6, innZ - 4.2, { rotation: Math.PI / 2 });
  for (const [x, z, w, d, rotation] of [
    [-185, -370, 5.5, 5, Math.PI / 2],
    [-171, -368, 6, 5, -Math.PI / 2],
    [-158, -344, 5.5, 4.5, 0],
    [-186, -353, 5, 5, Math.PI / 2],
  ]) {
    place(builders.house({ w, d, h: 3, windows: 2 }), x, z, { rotation });
  }
  /* the harbourmaster's office, of stone, with the port's flag */
  place(
    builders.house({ w: 7, d: 5.5, h: 3.4, wallTexture: "stone", windows: 2, chimney: false }),
    -164,
    -373,
    { rotation: Math.PI / 2 },
  );
  place(builders.flag(3.6, "cloth_green"), -160.5, -377);
  /* the runecarver's corner: an old enchanting altar under an awning (only to look at) */
  const altar = builders.enchantingAltar();
  altar.userData.mapKind = null;
  place(altar, -153, -351, { radius: 1.6 });
  place(builders.stall({ cloth: "cloth_green", w: 3 }), -158, -351.5, {
    rotation: Math.PI / 2,
    radius: 1.6,
  });

  /* ----- the square: a statue of the first harbourmaster, the market stalls, benches ----- */
  place(builders.statue(), squareX, squareZ + 1, { radius: 1.5, rotation: Math.PI });
  for (const [dx, dz, cloth, rotation] of [
    [6, -4.5, "cloth_red", 0],
    [-6, -4.5, "cloth_green", 0],
    [9, 2.5, "cloth_red", -Math.PI / 2],
  ]) {
    place(builders.stall({ cloth, w: 3 }), squareX + dx, squareZ + dz, { radius: 1.7, rotation });
  }
  for (const [dx, dz] of [
    [-8, 4],
    [8, -1],
  ]) {
    place(builders.bench(), squareX + dx, squareZ + dz, { radius: 0.8 });
  }
  for (const [dx, dz] of [
    [-11, -6],
    [11, -6],
    [-11, 6],
    [11, 6],
  ]) {
    lantern(squareX + dx, squareZ + dz);
  }
  for (let z = gateZ - 6; z > squareZ + 8; z -= 8) {
    lantern(gateX - 3, z);
    lantern(gateX + 3, z - 4);
  }

  /* ----- the smithy by the east street ----- */
  place(builders.house({ w: 6, d: 5, h: 3, windows: 1 }), -130, -341, { rotation: Math.PI });
  const forge = builders.forge();
  forge.userData.mapKind = null;
  place(forge, -134.5, -347, { rotation: Math.PI / 2 });
  pending.push(prop("anvil", -133, -349.6, { radius: 0.4 }));
  place(builders.house({ w: 5, d: 4.5, h: 3, windows: 1 }), -130, -357, {
    rotation: -Math.PI / 2,
  });

  /* ----- more of the town: houses along the main street and by the square, trees, flowers, banners, a well ----- */
  for (const [x, z, w, d, rotation, h] of [
    [-139, -341, 6, 5, Math.PI, 3.2],
    [-139, -352.5, 6, 5.5, -Math.PI / 2, 3.6],
    [-131.5, -371, 5, 4.5, -Math.PI / 2, 3],
    [-153, -341.5, 5, 4.5, Math.PI, 3.4],
  ]) {
    place(builders.house({ w, d, h, windows: 2, roofHeight: 2.3 }), x, z, { rotation });
  }
  for (const [x, z] of [
    [-186.5, -338],
    [-167.5, -337.5],
    [-156.5, -362],
    [-135.5, -374.2],
    [-188, -361],
  ]) {
    pending.push(prop("tree2", x, z, { radius: 0.55, shadow: 1.8, scale: 1.15 }));
  }
  for (const [x, z, name] of [
    [-149.6, -340.5, "flowers"],
    [-142.4, -346.5, "flowers2"],
    [-149.6, -357, "flowers2"],
    [-167.5, -349.5, "flowers"],
    [-160.2, -369.5, "flowers"],
    [-136.4, -356.5, "flowers2"],
    [-182.4, -341, "flowers2"],
  ]) {
    pending.push(prop(name, x, z, { scale: 1.3 }));
  }
  /* the city's banners along the main street, green and red */
  for (const [x, z, cloth] of [
    [-149.4, -344, "cloth_green"],
    [-142.6, -350, "cloth_red"],
    [-149.4, -356, "cloth_red"],
    [-142.6, -360, "cloth_green"],
  ]) {
    place(builders.flag(3.4, cloth), x, z, { radius: 0.2 });
  }
  place(builders.well(), -164.5, -342.5, { radius: 1.3 });
  /* washing hung out between the houses, crates and barrels at the back doors */
  for (const [ax, az, bx, bz] of [
    [-187, -346.2, -182, -346.2],
    [-165.5, -357, -165.5, -361.5],
    [-143.2, -337.2, -136.5, -337.2],
  ]) {
    scene.add(clothesline(ax, az, bx, bz, random));
    obstacles.push({ x: ax, z: az, r: 0.2 }, { x: bx, z: bz, r: 0.2 });
  }
  for (const [x, z] of [
    [-182.2, -357.8],
    [-168, -364.4],
    [-141.8, -356.6],
    [-134, -369],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  for (const [x, z] of [
    [-188.2, -366],
    [-155.4, -338.4],
  ]) {
    pending.push(prop("crypt_crates", x, z, { radius: 0.7, scale: 0.9 }));
  }

  /* ----- the old warehouses in the east quarter: long, of stone, with crates in the lanes ----- */
  for (const [x, z, w, d] of [
    [-111, -341, 14, 6],
    [-111, -357, 14, 7],
    [-113, -371, 12, 5],
  ]) {
    place(
      builders.house({
        w,
        d,
        h: 4.4,
        roofHeight: 2.4,
        wallTexture: "stone",
        windows: 3,
        chimney: false,
      }),
      x,
      z,
    );
  }
  for (const [x, z] of [
    [-118, -349.5],
    [-108.5, -347],
    [-119, -365],
    [-103.5, -363.5],
    [-116.5, -377],
  ]) {
    pending.push(prop("crypt_crates", x, z, { radius: 0.7, scale: 0.9 }));
  }
  for (const [x, z] of [
    [-110, -365.5],
    [-110.9, -366.4],
    [-104.4, -378],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }

  /* ----- the quay: bollards along the edge, nets, barrels and crates ----- */
  for (let x = x0 + 4; x < x1 - 2; x += 5.5) {
    const isPier = PIERS.some((pier) => Math.abs(x - pier.x) < pier.halfWidth + 0.8);
    if (!isPier && Math.abs(x - MOLE.x) > MOLE.halfWidth + 0.8) {
      place(bollard(), x, z0 + 0.6, { radius: 0.3 });
    }
  }
  for (const [x, z] of [
    [-186, -381],
    [-166, -379.5],
    [-158.5, -383],
    [-133, -381],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  for (const [x, z] of [
    [-180, -378.5],
    [-137, -378],
  ]) {
    pending.push(prop("crypt_crates", x, z, { radius: 0.7, scale: 0.9 }));
  }
  pending.push(prop("woodpile", -170, -379, { radius: 0.5 }));
  /* the harbour crane, swinging a crate out over the water, with cargo waiting beside it */
  place(builders.harborCrane(), -162, -384.4, { rotation: Math.PI });
  for (const [x, z] of [
    [-164.6, -382.4],
    [-159.4, -382.6],
  ]) {
    pending.push(prop("crypt_crates", x, z, { radius: 0.7, scale: 0.9 }));
  }
  for (const [x, z] of [
    [-165.8, -383.9],
    [-158.2, -384.1],
  ]) {
    place(builders.barrel(), x, z, { radius: 0.45 });
  }
  /* nets drying at the west end of the quay */
  place(builders.netRack(3), -187.4, -381.6, { rotation: Math.PI / 2 });
  place(builders.netRack(2.6), -183.8, -377.6);

  /* ----- the sea, the quay wall, the piers, the mole and the lighthouse, the ships ----- */
  buildSea(scene);
  for (const pier of PIERS) {
    buildPier(scene, pier, random);
  }
  buildMole(scene, place, obstacles, random);
  /* along the west pier a merchantman and Eyvind's ship from Rimeholt (Saga III), white with frost; between the
     piers fishing boats, by the east pier the Gull's Promise */
  moor(scene, builders.ship({ length: 15, beam: 4.8 }), -180, -396, 0.04);
  moor(scene, rimeShip(random), -166.5, -397, -0.03);
  moor(scene, builders.rowingBoat(4, 1.6), -148.6, -394, 0.1);
  moor(scene, builders.rowingBoat(3.6, 1.5), -155.4, -397, -0.12);
  moor(scene, builders.rowingBoat(3.4, 1.4), -148.4, -400, 0.05);
  mooredGull = builders.ship({
    length: HULL.length,
    beam: HULL.beam,
    sail: "cloth_red",
    hullColor: 0x3e4a5a,
  });
  moor(scene, mooredGull, BERTH.x, BERTH.z, BERTH.heading);
  /* a click on her: go aboard and take the helm (main.js), once Mara Holt will let you */
  const boardHit = new THREE.Mesh(
    new THREE.BoxGeometry(HULL.beam, 4, HULL.length).translate(0, 1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  boardHit.position.set(BERTH.x, 0, BERTH.z);
  boardHit.userData.boardShip = "saltmere";
  scene.add(boardHit);
  clickables.push(boardHit);
  mooredGull.userData.boardHit = boardHit;
  /* lanterns out on the piers and the mole */
  for (const [x, z] of [
    [-127, -393],
    [-174, -400.5],
    [-150.7, -403],
    [-172.6, -390],
    [-103.8, -392],
    [-108.2, -401],
  ]) {
    lantern(x, z);
  }
  /* buoys marking the way in */
  for (const [x, z] of [
    [-160, -413],
    [-137, -411],
    [-189, -405],
    [-115, -424],
    [-178, -418],
  ]) {
    moor(scene, buoy(), x, z, 0);
  }
  buildFoam(scene);
  buildGulls(scene);
}

/* A washing line between two posts from (ax, az) to (bx, bz), with shirts and sheets in a few colours on it. */
function clothesline(ax, az, bx, bz, random) {
  const group = new THREE.Group();
  for (const [x, z] of [
    [ax, az],
    [bx, bz],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 2.2, 5).translate(0, 1.1, 0),
      builders.material("wood_dark", 0.2, 2.2),
    );
    post.position.set(x, 0, z);
    group.add(post);
  }
  const length = Math.hypot(bx - ax, bz - az);
  const angle = Math.atan2(bx - ax, bz - az);
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, length, 3).rotateX(Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xd8d0b8 }),
  );
  line.position.set((ax + bx) / 2, 2.05, (az + bz) / 2);
  line.rotation.y = angle;
  group.add(line);
  const colors = [0xe8e2d0, 0x6a8ac0, 0xc05a4a, 0xe0c060, 0x7aa07a, 0xf0ece4];
  for (let t = 0.12; t < 0.9; t += 0.16 + random() * 0.06) {
    const width = 0.5 + random() * 0.4;
    const height = 0.5 + random() * 0.5;
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height).translate(0, -height / 2, 0),
      new THREE.MeshLambertMaterial({
        color: colors[Math.floor(random() * colors.length)],
        side: THREE.DoubleSide,
      }),
    );
    cloth.position.set(ax + (bx - ax) * t, 2.04, az + (bz - az) * t);
    /* the cloth hangs along the line, turned a little by the wind */
    cloth.rotation.set(0.15, angle + Math.PI / 2, 0);
    group.add(cloth);
  }
  return group;
}

/* a red buoy with a white band and a cone on top */
function buoy() {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xc23a2c });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.7, 10).translate(0, 0.15, 0),
    red,
  );
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.14, 10).translate(0, 0.32, 0),
    new THREE.MeshLambertMaterial({ color: 0xf0eadc }),
  );
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8).translate(0, 0.7, 0), red);
  group.add(body, band, top);
  return group;
}

/* white foam where the waves meet the quay, the mole and its head */
function buildFoam(scene) {
  const material = () =>
    new THREE.MeshBasicMaterial({
      color: 0xf2f6f8,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
  const strip = (width, depth, x, z, rotation = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material());
    mesh.rotation.set(-Math.PI / 2, 0, rotation);
    mesh.position.set(x, WATER_Y + 0.02, z);
    scene.add(mesh);
    foam.push(mesh);
  };
  /* along the quay, broken where the piers stand */
  let start = SALTMERE.x0 - 40;
  const gaps = [...PIERS.map((pier) => [pier.x, pier.halfWidth]), [MOLE.x, MOLE.halfWidth]].sort(
    (a, b) => a[0] - b[0],
  );
  for (const [gapX, half] of [...gaps, [SALTMERE.x1 + 40, 0]]) {
    const end = gapX - half - 0.2;
    if (end > start) {
      strip(end - start, 0.55, (start + end) / 2, SALTMERE.z0 - 0.3);
    }
    start = gapX + half + 0.2;
  }
  const moleLength = SALTMERE.z0 - MOLE.end;
  for (const side of [-1, 1]) {
    strip(0.55, moleLength, MOLE.x + side * (MOLE.halfWidth + 0.3), (SALTMERE.z0 + MOLE.end) / 2);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(MOLE.headRadius + 0.38, MOLE.headRadius + 1, 40).rotateX(-Math.PI / 2),
    material(),
  );
  ring.position.set(MOLE.head[0], WATER_Y + 0.02, MOLE.head[1]);
  scene.add(ring);
  foam.push(ring);
}

/* a gull: a white body with grey wings that flap (wings[0], wings[1]) */
function gullMesh() {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f4f0 });
  const grey = new THREE.MeshLambertMaterial({ color: 0x9aa2ac, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.5), white);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.14), white);
  head.position.set(0, 0.06, -0.3);
  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.04, 0.1),
    new THREE.MeshLambertMaterial({ color: 0xe8b040 }),
  );
  beak.position.set(0, 0.05, -0.41);
  group.add(body, head, beak);
  const wings = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.12);
    shape.lineTo(side * 0.55, 0.05);
    shape.lineTo(side * 0.5, 0.16);
    shape.lineTo(0, 0.14);
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2), grey);
    wing.position.y = 0.04;
    group.add(wing);
    wings.push(wing);
  }
  group.userData.wings = wings;
  return group;
}

/* gulls wheeling over the harbour, and a few resting on the bollards and the pier posts */
function buildGulls(scene) {
  for (let k = 0; k < 10; k++) {
    const group = gullMesh();
    scene.add(group);
    gulls.push({
      group,
      cx: -185 + Math.random() * 90,
      cz: -418 + Math.random() * 26,
      radius: 5 + Math.random() * 10,
      height: 4.5 + Math.random() * 4,
      speed: (0.25 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1),
      angle: Math.random() * Math.PI * 2,
      flapPhase: Math.random() * 10,
    });
  }
  for (const [x, y, z] of [
    [-183.5, 0.78, SALTMERE.z0 + 0.6],
    [-139.5, 0.78, SALTMERE.z0 + 0.6],
    [-125.3, 0.3, -401.5],
    [-175.65, 0.3, -395.2],
  ]) {
    const group = gullMesh();
    group.position.set(x, y, z);
    for (const wing of group.userData.wings) {
      wing.rotation.z = 0;
      wing.scale.set(0.45, 1, 1);
    }
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);
    sittingGulls.push({ group, y, hopAt: Math.random() * 8 });
  }
}

/** The Gull's Promise at her berth shows only while nobody here sails her (sailing.js). */
export function setMooredGullVisible(isVisible) {
  if (mooredGull) {
    mooredGull.visible = isVisible;
    mooredGull.userData.boardHit.visible = isVisible;
  }
}

/* Skipper Eyvind's ship from Rimeholt: a northern trader that sailed through the floes and kept their cold. Frost
   on every board and rope (its own copies of the materials, so no other ship turns white): the warm wood goes grey
   and blue. Snow lies on the decks and along the rails, and icicles hang under the rails and the stern. */
function rimeShip(random) {
  const length = 12;
  const beam = 4.2;
  const deckHeight = 1.3;
  const vessel = builders.ship({ length, beam, masts: 1, hullColor: 0x4a5866 });
  const rime = new THREE.Color(0xe4f1fa);
  /* the wood's own texture is warm: take out most of its red, then let a blue glow come through */
  const cold = new THREE.Color(0.55, 0.72, 1);
  vessel.traverse((part) => {
    const material = part.material;
    if (!material || !material.color || material.isMeshBasicMaterial) {
      return;
    }
    part.material = material.clone();
    if (part.isLineSegments || part.isLine) {
      part.material.color.lerp(rime, 0.7);
    } else {
      part.material.color.multiply(cold).lerp(rime, 0.18);
      if (part.material.emissive) {
        part.material.emissive.setHex(0x22384f);
      }
    }
  });
  /* snow in drifts on the main deck and the quarterdeck */
  const snow = new THREE.MeshLambertMaterial({ color: 0xf4f9ff });
  const drifts = [
    [0, deckHeight + 0.02, -length * 0.3, 1.6],
    [-beam * 0.25, deckHeight + 0.02, -length * 0.05, 1.2],
    [beam * 0.22, deckHeight + 0.02, length * 0.12, 1],
    [0.3, deckHeight + 1.18, length * 0.38, 1.1],
  ];
  for (const [x, y, z, size] of drifts) {
    const drift = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 4), snow);
    drift.scale.set(1, 0.07, 0.7 + random() * 0.3);
    drift.position.set(x, y, z);
    drift.rotation.y = random() * Math.PI;
    vessel.add(drift);
  }
  /* along the rails amidships a ridge of snow, and icicles under it, longest in the middle; more icicles hang from
     the edge of the quarterdeck over the stern windows (builders.ship: the quarterdeck ends at 0.49 of the length,
     1.1 above the deck, 0.74 of the beam wide) */
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.08, 1), snow, 2);
  const icicles = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.05, 1, 5).rotateX(Math.PI).translate(0, -0.5, 0),
    new THREE.MeshLambertMaterial({ color: 0xcfe9ff, emissive: 0x1a3550 }),
    52,
  );
  const place = new THREE.Object3D();
  let count = 0;
  const hang = (x, y, z, size) => {
    place.position.set(x, y, z);
    place.scale.set(1, size, 1);
    place.updateMatrix();
    icicles.setMatrixAt(count++, place.matrix);
  };
  for (const [index, side] of [-1, 1].entries()) {
    place.position.set(side * (beam / 2 - 0.06), deckHeight + 0.49, 0);
    place.scale.set(1, 1, length * 0.6);
    place.updateMatrix();
    ridges.setMatrixAt(index, place.matrix);
    for (let k = 0; k < 20; k++) {
      const t = k / 19;
      const z = (t - 0.5) * length * 0.6 + (random() - 0.5) * 0.2;
      hang(
        side * (beam / 2 + 0.03),
        deckHeight + 0.42,
        z,
        0.18 + (1 - Math.abs(t - 0.5) * 2) * 0.35 * (0.5 + random()),
      );
    }
  }
  const sternWidth = beam * 0.74;
  for (let k = 0; k < 12; k++) {
    const x = (k / 11 - 0.5) * sternWidth * 0.95;
    hang(x, deckHeight + 1.12, length * 0.49 + 0.12, 0.2 + random() * 0.35);
  }
  vessel.add(ridges, icicles);
  return vessel;
}

/* a stone post on the quay to tie ships to */
function bollard() {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.7, 8).translate(0, 0.35, 0),
    builders.material("stone", 1, 0.7, 0.7),
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8).translate(0, 0.72, 0),
    builders.material("stone", 1, 0.2, 0.6),
  );
  group.add(post, cap);
  return group;
}

/* Circles just inside a coast that reaches `reach(angle)` from (x, z), `count` of them all round, each `radius`
   wide: together they give the shallows the coast's own shape. */
function coastCircles(x, z, reach, count, radius) {
  return Array.from({ length: count }, (_, k) => {
    const angle = (k / count) * Math.PI * 2;
    const r = Math.min(radius, reach(angle) * 0.5);
    const distance = reach(angle) - r;
    return [x + Math.sin(angle) * distance, z + Math.cos(angle) * distance, r];
  });
}

/* everything standing in the sea that has shallows round it: [x, z, radius] (shallowMap) */
const SHALLOWS = [
  ...ROCKS,
  ...ISLETS.flatMap((islet) =>
    coastCircles(islet.x, islet.z, (angle) => isletReach(islet, angle), 16, islet.radius * 0.6),
  ),
  ...coastCircles(EMBER_ISLES.x, EMBER_ISLES.z, emberShore, 96, 14),
  ...coastCircles(TIDECROWN.x, TIDECROWN.z, tidecrownCoast, 48, 10),
  /* the Frostmarch: only its south coast faces the sea */
  ...coastCircles(FROSTMARCH.x, FROSTMARCH.z, frostCoast, 360, 12).filter(([, z]) => z > SEA.z0),
  /* the floes off it, and the frozen bay before Rimeholt, along its seaward edge */
  ...FLOES.map((floe) => [floe.x, floe.z, floe.radius * 0.7]),
  ...Array.from({ length: 15 }, (_, k) => {
    const t = (k / 14) * Math.PI;
    return [
      RIME_BAY.x + Math.cos(t) * RIME_BAY.rx * 0.85,
      RIME_BAY.z + Math.sin(t) * RIME_BAY.rz * 0.7,
      5,
    ];
  }),
];

/* The water of the sea, drawn on the GPU in the game's pixels: clear turquoise over the shallows along the quay and
   round every rock and island, deepening to a dark blue out at sea under slow cloudy shadows; over it all a net of
   light (the sun through the moving surface) that wanders and shifts, and here and there a white glint on it. */
export const SEA_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
export const SEA_FRAGMENT = /* glsl */ `
  ${IS_PHONE ? "#define SIMPLE" : ""}
  uniform float uTime;
  uniform float uShore;
  uniform sampler2D uShallowMap;
  uniform vec4 uShallowBounds;
  uniform vec3 uShallow;
  uniform vec3 uMiddle;
  uniform vec3 uDeep;
  uniform vec3 uShadow;
  uniform vec3 uLight;
  uniform vec3 uGlint;
  varying vec2 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  /* how far p lies from the edge between two cells of a moving cell pattern: 0 on the edge */
  float cellEdge(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float first = 8.0;
    float second = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = 0.5 + 0.4 * sin(t + 6.2831 * hash2(i + g));
        float d = length(g + o - f);
        if (d < first) {
          second = first;
          first = d;
        } else if (d < second) {
          second = d;
        }
      }
    }
    return second - first;
  }
  void main() {
    /* one game pixel is a sixteenth of a unit: the water is drawn in those */
    vec2 p = floor(vWorld * 16.0) / 16.0;
    float t = uTime;
    /* how shallow: along the quay, and round everything standing in the sea (worked out once, shallowMap) */
    float shallow = texture2D(uShallowMap, (p - uShallowBounds.xy) / uShallowBounds.zw).r;
    /* deeper the further out to sea, under slow shadows of cloud and depth */
    float far = clamp((uShore - p.y) / 240.0, 0.0, 1.0);
    vec3 color = mix(uMiddle, uDeep, far);
    #ifdef SIMPLE
    float cloud = noise(p * 0.035 + vec2(t * 0.004, t * 0.006));
    #else
    float cloud = noise(p * 0.025 + vec2(t * 0.004, t * 0.006)) * 0.6 + noise(p * 0.07 - vec2(t * 0.01, 0.0)) * 0.4;
    #endif
    color = mix(color, uShadow, smoothstep(0.38, 0.75, cloud) * 0.85);
    color = mix(color, uShallow, smoothstep(0.0, 1.0, shallow));
    /* the net of light, its threads wavering; everywhere on the water, but broken into short pieces that come
       and go, each with a soft glow round it */
    vec2 warp = vec2(noise(p * 0.5 + t * 0.15), noise(p * 0.5 + 5.2 - t * 0.12)) - 0.5;
    /* on a phone the threads waver less: two noises fewer for every pixel of the sea */
    #ifdef SIMPLE
    float edge = cellEdge(p * 0.55 + warp * 0.7, t * 0.7);
    #else
    vec2 wobble = vec2(noise(p * 1.8 - t * 0.3), noise(p * 1.8 + 2.9 + t * 0.25)) - 0.5;
    float edge = cellEdge(p * 0.55 + warp * 0.6 + wobble * 0.18, t * 0.7);
    #endif
    float pieces = smoothstep(0.48, 0.62, noise(p * 2.4 + vec2(t * 0.2, -t * 0.15)));
    float core = (1.0 - smoothstep(0.012, 0.035, edge)) * pieces;
    float glow = (1.0 - smoothstep(0.02, 0.09, edge)) * mix(0.15, 1.0, pieces);
    float strength = mix(0.55, 0.8, shallow) * (1.0 - cloud * 0.25);
    color = mix(color, uLight, glow * 0.3 * strength);
    color = mix(color, uLight, core * strength);
    /* bright where the sun catches a thread, coming and going */
    float sparkle = step(0.78, noise(p * 2.6 + vec2(t * 0.4, -t * 0.3))) * core;
    color = mix(color, uGlint, sparkle * mix(0.5, 0.85, shallow));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/* How shallow the sea is everywhere, worked out once on a grid of two units (the shader reads it, smoothly between
   the points): along the quay, and round everything standing in the sea, each only as far as its shallows reach. */
const SHALLOW_STEP = 2;
function shallowMap() {
  const columns = Math.ceil((SEA.x1 - SEA.x0) / SHALLOW_STEP);
  const rows = Math.ceil((SEA.z1 - SEA.z0) / SHALLOW_STEP);
  const values = new Float32Array(columns * rows);
  for (let j = 0; j < rows; j++) {
    const z = SEA.z0 + (j + 0.5) * SHALLOW_STEP;
    const quay = Math.exp(-(SEA.z1 - z) / 16);
    for (let i = 0; i < columns; i++) {
      values[j * columns + i] = quay;
    }
  }
  for (const [cx, cz, radius] of SHALLOWS) {
    const falloff = 5 + radius * 0.15;
    const reach = radius + falloff * 6;
    const i0 = Math.max(0, Math.floor((cx - reach - SEA.x0) / SHALLOW_STEP));
    const i1 = Math.min(columns - 1, Math.ceil((cx + reach - SEA.x0) / SHALLOW_STEP));
    const j0 = Math.max(0, Math.floor((cz - reach - SEA.z0) / SHALLOW_STEP));
    const j1 = Math.min(rows - 1, Math.ceil((cz + reach - SEA.z0) / SHALLOW_STEP));
    for (let j = j0; j <= j1; j++) {
      const z = SEA.z0 + (j + 0.5) * SHALLOW_STEP;
      for (let i = i0; i <= i1; i++) {
        const x = SEA.x0 + (i + 0.5) * SHALLOW_STEP;
        const d = Math.max(0, Math.hypot(x - cx, z - cz) - radius);
        const k = j * columns + i;
        values[k] = Math.max(values[k], Math.exp(-d / falloff));
      }
    }
  }
  const data = new Uint8Array(columns * rows);
  for (let k = 0; k < data.length; k++) {
    data[k] = Math.round(values[k] * 255);
  }
  const texture = new THREE.DataTexture(
    data,
    columns,
    rows,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/* The sea below the land, darker further out, its water moving; and the wall of the quay down to it. */
function buildSea(scene) {
  const width = SEA.x1 - SEA.x0;
  const depth = SEA.z1 - SEA.z0;
  seaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShore: { value: SEA.z1 },
      uShallowMap: { value: shallowMap() },
      uShallowBounds: {
        value: new THREE.Vector4(SEA.x0, SEA.z0, SEA.x1 - SEA.x0, SEA.z1 - SEA.z0),
      },
      uShallow: { value: new THREE.Color(0x2b9be0) },
      uMiddle: { value: new THREE.Color(0x1a5fae) },
      uDeep: { value: new THREE.Color(0x15408a) },
      uShadow: { value: new THREE.Color(0x0b2556) },
      uLight: { value: new THREE.Color(0x7fd2ff) },
      uGlint: { value: new THREE.Color(0xf4fbff) },
    },
    vertexShader: SEA_VERTEX,
    fragmentShader: SEA_FRAGMENT,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((SEA.x0 + SEA.x1) / 2, WATER_Y, (SEA.z0 + SEA.z1) / 2);
  scene.add(sea);
  /* the quay wall, along the whole shore */
  const wallWidth = 200;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallWidth, QUAY_DEPTH),
    builders.material("stone", wallWidth, QUAY_DEPTH, 0.75),
  );
  wall.material.side = THREE.DoubleSide;
  wall.position.set(-146, -QUAY_DEPTH / 2, SALTMERE.z0);
  scene.add(wall);
  /* a light edge of dressed stone along the top */
  const kerb = new THREE.Mesh(
    new THREE.BoxGeometry(wallWidth, 0.14, 0.5),
    builders.material("stone", wallWidth, 0.5, 1.05),
  );
  kerb.position.set(-146, 0.05, SALTMERE.z0 + 0.25);
  scene.add(kerb);
}

/* a wooden pier on posts, from the quay out over the water */
function buildPier(scene, pier, random) {
  const length = SALTMERE.z0 - pier.end;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(pier.halfWidth * 2, 0.3, length + 1),
    new THREE.MeshLambertMaterial({
      map: builders.texture("wood", pier.halfWidth, length / 2),
      color: new THREE.Color(0.78, 0.86, 0.9),
    }),
  );
  deck.position.set(pier.x, -0.13, (SALTMERE.z0 + pier.end) / 2 - 0.5);
  scene.add(deck);
  for (let z = SALTMERE.z0 - 1.5; z > pier.end; z -= 2.5) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 2.4, 6),
        builders.material("wood_dark", 0.4, 2.4),
      );
      post.position.set(pier.x + side * (pier.halfWidth + 0.05), -0.9 + random() * 0.15, z);
      scene.add(post);
    }
  }
}

/* the mole: a causeway of stone out to the lighthouse on its round head */
function buildMole(scene, place, obstacles, random) {
  const length = SALTMERE.z0 - MOLE.end;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(MOLE.halfWidth * 2, QUAY_DEPTH, length + 1),
    builders.material("stone", MOLE.halfWidth * 2, length, 0.85),
  );
  body.position.set(MOLE.x, -QUAY_DEPTH / 2 + 0.01, (SALTMERE.z0 + MOLE.end) / 2 - 0.5);
  scene.add(body);
  const [headX, headZ] = MOLE.head;
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(MOLE.headRadius, MOLE.headRadius + 0.4, QUAY_DEPTH, 24),
    builders.material("stone", MOLE.headRadius * 6, QUAY_DEPTH, 0.85),
  );
  head.position.set(headX, -QUAY_DEPTH / 2 + 0.01, headZ);
  scene.add(head);
  /* breakwater stones heaped along the mole and round its head, in the surf */
  const rock = builders.material("stone", 2, 2, 0.7);
  const addRock = (x, z) => {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + random() * 0.5, 0), rock);
    stone.position.set(x, WATER_Y + random() * 0.3, z);
    stone.rotation.set(random() * 3, random() * 3, random() * 3);
    scene.add(stone);
  };
  for (let z = SALTMERE.z0 - 3; z > MOLE.end; z -= 1.6) {
    addRock(MOLE.x + MOLE.halfWidth + 0.7 + random() * 0.4, z);
  }
  for (let k = 0; k < 18; k++) {
    const angle = -Math.PI * 0.15 + (k / 18) * Math.PI * 1.3;
    const r = MOLE.headRadius + 0.7 + random() * 0.4;
    addRock(headX + Math.cos(angle) * r, headZ - Math.sin(angle) * r);
  }
  /* the lighthouse is added as it is (not merged into the batches), so its glass stays see-through */
  const [lightX, lightZ] = LIGHTHOUSE;
  const tower = builders.lighthouse(10.5);
  tower.position.set(lightX, 0, lightZ);
  tower.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
    }
  });
  scene.add(tower);
  obstacles.push({ x: lightX, z: lightZ, r: 2.5 });
  /* the keeper's cottage at its foot */
  place(
    builders.house({ w: 3, d: 2.6, h: 2.1, roofHeight: 1.4, windows: 1 }),
    headX - 3.4,
    headZ + 0.6,
    {
      rotation: Math.PI / 2,
    },
  );
  /* the lamp in the lantern room, and its beam: drawn over the night haze */
  lighthouseLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0 }),
  );
  lighthouseLamp.position.set(lightX, tower.userData.lamp, lightZ);
  lighthouseLamp.renderOrder = 10001;
  scene.add(lighthouseLamp);
  lighthouseBeam = new THREE.Group();
  for (const side of [0, Math.PI]) {
    lighthouseBeam.add(beamFan(side));
  }
  lighthouseBeam.position.set(lightX, tower.userData.lamp, lightZ);
  scene.add(lighthouseBeam);
}

/* One arm of the lighthouse's beam: a flat fan from the lamp, wider and fainter further out (the alpha in the vertex
   colours), turned `angle` around the lamp. */
function beamFan(angle) {
  const length = 32;
  const steps = 8;
  const positions = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const along = (i / steps) * length;
    const half = 0.3 + (along / length) * 3.2;
    const alpha = 1 - i / steps;
    positions.push(along, 0, -half, along, 0, half);
    colors.push(1, 1, 1, alpha, 1, 1, 1, alpha);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const fan = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    }),
  );
  fan.rotation.y = angle;
  fan.renderOrder = 10002;
  return fan;
}

/* a vessel in the water, bow out to sea, a little askew; it rides the waves (updateSaltmere) */
function moor(scene, vessel, x, z, rotation) {
  vessel.position.set(x, WATER_Y, z);
  vessel.rotation.y = rotation;
  scene.add(vessel);
  ships.push({ group: vessel, y: WATER_Y, rotation, phase: x * 0.37 + z * 0.11 });
}

/** Per frame: the sea flows, the ships ride the swell, and after dark the lighthouse turns its beam. */
export function updateSaltmere(dt, time) {
  if (!seaMaterial) {
    return;
  }
  seaMaterial.uniforms.uTime.value = time;
  for (const ship of ships) {
    const wave = time * 1.1 + ship.phase;
    ship.group.position.y = ship.y + Math.sin(wave) * 0.07;
    ship.group.rotation.set(Math.sin(wave * 0.8) * 0.02, ship.rotation, Math.sin(wave) * 0.03);
  }
  const dark = 1 - daylight();
  lighthouseBeam.rotation.y = time * 0.6;
  for (const beam of lighthouseBeam.children) {
    beam.material.opacity = 0.35 * Math.max(0, dark - 0.2);
  }
  lighthouseLamp.material.color.setScalar(1).lerp(new THREE.Color(0xffd070), dark);
  for (let k = 0; k < foam.length; k++) {
    foam[k].material.opacity = 0.22 + 0.14 * Math.sin(time * 1.3 + k * 0.7);
  }
  for (const gull of gulls) {
    gull.angle += gull.speed * dt;
    const x = gull.cx + Math.cos(gull.angle) * gull.radius;
    const z = gull.cz + Math.sin(gull.angle) * gull.radius;
    const y = gull.height + Math.sin(time * 0.7 + gull.flapPhase) * 0.6;
    gull.group.position.set(x, y, z);
    /* the beak (its -z) along the circle, banking into the turn */
    const heading = Math.atan2(
      Math.sin(gull.angle) * gull.speed,
      -Math.cos(gull.angle) * gull.speed,
    );
    gull.group.rotation.set(0, heading, Math.sign(gull.speed) * 0.35);
    /* flapping now and then, gliding in between */
    const isFlapping = Math.sin(time * 0.5 + gull.flapPhase) > 0.2;
    const flap = isFlapping ? Math.sin(time * 9 + gull.flapPhase) * 0.6 : 0.08;
    gull.group.userData.wings[0].rotation.z = flap;
    gull.group.userData.wings[1].rotation.z = -flap;
  }
  for (const gull of sittingGulls) {
    /* a little hop and a turn now and then */
    gull.hopAt -= dt;
    if (gull.hopAt < 0) {
      gull.hopAt = 4 + Math.random() * 8;
      gull.hop = HOP_SECONDS;
      gull.group.rotation.y += (Math.random() - 0.5) * 2;
    }
    gull.hop = Math.max(0, (gull.hop || 0) - dt);
    gull.group.position.y = gull.y + Math.sin((gull.hop / HOP_SECONDS) * Math.PI) * 0.15;
  }
  /* the sound of the harbour, for a hero near the water */
  const nearWater = Math.abs(player.z - SALTMERE.z0) < 16 && player.x > SEA.x0 && player.x < SEA.x1;
  if (nearWater && time > nextWave) {
    nextWave = time + 3.5 + Math.random() * 3;
    sfx.wave();
  }
  if (nearWater && time > nextGull) {
    nextGull = time + 6 + Math.random() * 10;
    sfx.gull();
  }
}
