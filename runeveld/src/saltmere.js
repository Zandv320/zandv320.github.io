/* Eldoria – Saltmere, the great harbour at the end of the Northroad (Saga II; the layout is in rules/saltmere.js).
   A walled city of cobbles between the gate in the south and the quay in the north: the Salty Gull and the sailors'
   guild in the west quarter, the harbour square with its market in the middle, the smithy, and in the east the old
   warehouses Maelis has taken. Beyond the quay the sea, below the land: three wooden piers with ships moored along
   them, and the stone mole out to the lighthouse. The sea moves, the ships ride it, and at night the lighthouse
   sweeps its beam over the water (updateSaltmere). */
import * as THREE from "three";
import * as builders from "./builders.js";
import { SALTMERE, PIERS, MOLE, LIGHTHOUSE, SALTY_GULL, WATER_Y } from "./rules/saltmere.js";
import { daylight } from "./daylight.js";

/* the sea reaches this far, so it fills the view from anywhere in the city however the camera turns */
const SEA = { x0: -330, x1: 30, z1: SALTMERE.z0, z0: -580 };
/* the quay wall goes down this far below the land */
const QUAY_DEPTH = 1.8;

/* the ships riding at anchor: {group, phase, roll} */
const ships = [];
let seaTexture = null;
let lighthouseBeam = null;
let lighthouseLamp = null;

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
  place(builders.house({ w: 5, d: 4.5, h: 3, windows: 1 }), -128, -357, {
    rotation: -Math.PI / 2,
  });

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

  /* ----- the sea, the quay wall, the piers, the mole and the lighthouse, the ships ----- */
  buildSea(scene);
  for (const pier of PIERS) {
    buildPier(scene, pier, random);
  }
  buildMole(scene, place);
  /* along the west pier two merchantmen, between the piers fishing boats, by the east pier the Gull's Promise */
  moor(scene, builders.ship({ length: 15, beam: 4.8 }), -180, -396, 0.04);
  moor(scene, builders.ship({ length: 12, beam: 4.2, masts: 1 }), -166.5, -397, -0.03);
  moor(scene, builders.rowingBoat(4, 1.6), -148.6, -394, 0.1);
  moor(scene, builders.rowingBoat(3.6, 1.5), -155.4, -397, -0.12);
  moor(scene, builders.rowingBoat(3.4, 1.4), -148.4, -400, 0.05);
  moor(
    scene,
    builders.ship({ length: 16, beam: 5, sail: "cloth_red", hullColor: 0x3e4a5a }),
    -121,
    -397,
    0,
  );
  for (const [x, z] of [
    [-127, -393],
    [-174, -400.5],
  ]) {
    lantern(x, z);
  }
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

/* The sea below the land, darker further out, its water moving; and the wall of the quay down to it. */
function buildSea(scene) {
  const width = SEA.x1 - SEA.x0;
  const depth = SEA.z1 - SEA.z0;
  const geometry = new THREE.PlaneGeometry(width, depth, 1, 12);
  const colors = [];
  const positions = geometry.attributes.position;
  for (let k = 0; k < positions.count; k++) {
    /* the plane's y is -z once it lies flat: the far edge is darker */
    const far = (positions.getY(k) + depth / 2) / depth;
    const light = 1 - far * 0.45;
    colors.push(light, light, light);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  /* a texture of its own (builders caches one per repeat), so only the sea moves */
  seaTexture = builders.texture("water", width / 2.003, depth / 2);
  const sea = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ map: seaTexture, color: 0x8fb4c8, vertexColors: true }),
  );
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
function buildMole(scene, place) {
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
  const [lightX, lightZ] = LIGHTHOUSE;
  place(builders.tower(1.6, 11), lightX, lightZ, { radius: 2 });
  /* the lamp at the top, and its beam: drawn over the night haze */
  lighthouseLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true }),
  );
  lighthouseLamp.position.set(lightX, 10.2, lightZ + 1.65);
  lighthouseLamp.renderOrder = 10001;
  scene.add(lighthouseLamp);
  lighthouseBeam = new THREE.Group();
  for (const side of [0, Math.PI]) {
    lighthouseBeam.add(beamFan(side));
  }
  lighthouseBeam.position.set(lightX, 10.2, lightZ);
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
  if (!seaTexture) {
    return;
  }
  seaTexture.offset.set((time * 0.02) % 1, (time * 0.035) % 1);
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
}
