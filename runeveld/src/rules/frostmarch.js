/* Eldoria – game rules: the Frostmarch, the frozen north beyond the Grey Sea (Saga III, "The Long Winter"). A great
   round land whose south coast faces the sea; on that coast, round a bay frozen hard, lies Rimeholt, a fishing
   village on stilts. The Gull's Promise moors at a jetty on the edge of the ice. West and east of the village the
   snowfields of the shore; to the north a ridge of rock and snow closes the shore off from the White Waste inland,
   with a single pass, snowed shut for now. Out at sea, before the coast, the floes drift: ice that a ship must
   steer between.
   The land is star-shaped round its middle (far inland): along every bearing it reaches from there to the coast.
   Pure data and geometry, no browser: the server runs it too. */
import { nearEmberLand } from "./ember.js";

export const FROSTMARCH = { name: "The Frostmarch", x: -140, z: -1830, radius: 312 };

/** The coast's distance from the land's middle along this bearing (atan2(dx, dz)): long, gentle capes. */
export function frostCoast(angle) {
  return (
    FROSTMARCH.radius *
    (1 +
      0.025 * Math.sin(angle * 3 + 0.5) +
      0.015 * Math.sin(angle * 7 + 1.9) +
      0.008 * Math.sin(angle * 13 + 0.3))
  );
}

/* the shore a hero can walk: between these two cliffs, and south of the ridge */
export const SHORE = { west: -300, east: 20 };
/** Where the ridge runs along the north of the shore (z), at this x. */
export const ridgeZ = (x) => -1640 + 6 * Math.sin(x * 0.05) + 4 * Math.sin(x * 0.013 + 1);
/* the pass through the ridge north of Rimeholt, snowed shut (the White Waste lies beyond) */
export const PASS = { x: -140, z: ridgeZ(-140), halfWidth: 5 };
/* what a hero follows the hunters' tracks to: the foot of the drift in the pass */
export const PASS_FOOT = [PASS.x, PASS.z + 9];

/* the frozen bay in front of Rimeholt: an oval of ice across the coast, half over the sea */
export const RIME_BAY = { x: -140, z: -1508, rx: 38, rz: 13 };
/* the holes the fishers keep open in the ice: [x, z] (the fishing spots in rules/gather-nodes.js) */
export const ICE_HOLES = [
  [-156, -1503],
  [-147, -1499],
  [-135, -1502],
  [-121, -1505],
  [-162, -1508],
  [-128, -1498],
];
export const ICE_HOLE_RADIUS = 1.1;

/* the jetty from the ice's edge out over open water, and the Gull's Promise's berth beside it */
export const RIME_JETTY = { x: -124, halfWidth: 1.4, north: -1498, south: -1481 };
/* she lies off the jetty's far end, bow to the open sea in the south (heading 0 is bow to -z) */
export const RIME_BERTH = { name: "Rimeholt", x: RIME_JETTY.x - 6, z: -1480, heading: Math.PI };
export const RIME_LANDING = [RIME_JETTY.x - 0.5, -1483];

/* the village: no monster comes this near its fire */
export const RIMEHOLT = { name: "Rimeholt", x: -140, z: -1522, radius: 30 };
/* the fire in front of Sigrun's longhouse, where a hero who falls on the shore wakes up */
export const RIME_FIRE = [-140, -1524];
export const RIME_WAKE = [RIME_FIRE[0] + 2, RIME_FIRE[1] + 1.5];

/* the houses: [x, z, width, depth, rotation, stilts]; houses on stilts stand out on the ice of the bay */
export const RIME_HOUSES = [
  /* Elder Sigrun's longhouse, behind the fire */
  { x: -140, z: -1533, w: 11, d: 6, rotation: 0, stilts: false, longhouse: true },
  { x: -160, z: -1532, w: 5.5, d: 4.5, rotation: 0.18, stilts: false },
  { x: -120, z: -1533, w: 5.5, d: 4.5, rotation: -0.16, stilts: false },
  /* the furrier's hut at the east end, with hides stretched outside */
  { x: -101, z: -1524, w: 5, d: 4, rotation: -0.45, stilts: false, furrier: true },
  /* on stilts along the bay */
  { x: -167, z: -1513, w: 6, d: 4.5, rotation: 0.3, stilts: true },
  { x: -155, z: -1517, w: 5, d: 4, rotation: 0.12, stilts: true },
  { x: -112, z: -1514, w: 6, d: 4.5, rotation: -0.32, stilts: true },
];

/* the trodden ways through the snow: from the jetty up to the fire, on to the pass; west and east along the shore */
export const RIME_PATHS = [
  [
    [RIME_JETTY.x, RIME_JETTY.north],
    [-130, -1509],
    [-136, -1518],
    [RIME_FIRE[0], RIME_FIRE[1] + 2],
  ],
  [
    [RIME_FIRE[0], RIME_FIRE[1] - 2],
    [-146, -1545],
    [-138, -1575],
    [-143, -1605],
    [PASS_FOOT[0], PASS_FOOT[1]],
  ],
  [
    [RIME_FIRE[0] + 4, RIME_FIRE[1]],
    [-112, -1526],
    [-90, -1535],
    [-60, -1548],
    [-25, -1556],
  ],
  [
    [RIME_FIRE[0] - 4, RIME_FIRE[1]],
    [-170, -1527],
    [-200, -1538],
    [-235, -1550],
    [-268, -1566],
  ],
];

/** How far (x, z) lies from the nearest trodden way. */
export function rimePathDistance(x, z) {
  let best = Infinity;
  for (const path of RIME_PATHS) {
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, az] = path[k];
      const [bx, bz] = path[k + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
  }
  return best;
}

/** Is (x, z) land of the Frostmarch inside its coast, at least `margin` from the sea? */
export function onFrostLand(x, z, margin = 0) {
  const dx = x - FROSTMARCH.x;
  const dz = z - FROSTMARCH.z;
  return Math.hypot(dx, dz) < frostCoast(Math.atan2(dx, dz)) - margin;
}

/** How far inside the bay's oval (x, z) lies, as a share: below 1 inside it. */
const bayShare = (x, z, grow = 0) =>
  ((x - RIME_BAY.x) / (RIME_BAY.rx + grow)) ** 2 + ((z - RIME_BAY.z) / (RIME_BAY.rz + grow)) ** 2;

/** Is (x, z) in one of the fishing holes in the ice (with `grow` added round it)? */
export const inIceHole = (x, z, grow = 0) =>
  ICE_HOLES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < ICE_HOLE_RADIUS + grow);

/** Is (x, z) on the ice of the bay, at least `margin` from its edge and clear of the holes? */
export const onBayIce = (x, z, margin = 0) =>
  bayShare(x, z, -margin) < 1 && !inIceHole(x, z, margin * 0.5);

/** Is (x, z) on the jetty's planks, at least `margin` from their edge? */
export const onRimeJetty = (x, z, margin = 0) =>
  Math.abs(x - RIME_JETTY.x) < RIME_JETTY.halfWidth - margin &&
  z > RIME_JETTY.north - 2 &&
  z < RIME_JETTY.south - margin;

/** Can a hero walk at (x, z) on the Frostmarch: the shore between the cliffs and the ridge, the bay's ice, the
    jetty? (Houses, rocks and trees are obstacles of their own, frostmarch.js.) */
export function inFrostmarch(x, z, margin = 0) {
  if (onRimeJetty(x, z, margin * 0.5) || onBayIce(x, z, margin * 0.5)) {
    return true;
  }
  if (x < SHORE.west + margin || x > SHORE.east - margin || z < ridgeZ(x) + margin) {
    return false;
  }
  return onFrostLand(x, z, 1.2 + margin);
}

/** Is (x, z) in Rimeholt, where no monster comes (the village and its jetty)? */
export const inRimeholt = (x, z) =>
  Math.hypot(x - RIMEHOLT.x, z - RIMEHOLT.z) < RIMEHOLT.radius || onRimeJetty(x, z, -1);

/* ---------- the floes: ice drifting off the coast, which a ship steers between ---------- */

const hash = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/* the band of sea where they drift, between the Ember Isles' north coast and the Frostmarch, and how many */
const FLOE_BAND = { x0: -420, x1: 120, z0: -1496, z1: -1330 };
/** The floes: {x, z, radius, turn}, the same every time; between any two, and between a floe and any coast, there is
    room for a ship. */
export const FLOES = [];
for (let k = 0; FLOES.length < 34 && k < 4000; k++) {
  const x = FLOE_BAND.x0 + hash(k, 3.1) * (FLOE_BAND.x1 - FLOE_BAND.x0);
  const z = FLOE_BAND.z0 + hash(7.7, k) * (FLOE_BAND.z1 - FLOE_BAND.z0);
  const radius = 3 + hash(k, k * 0.37) * 4.5;
  /* a wide lane stays open straight in to the jetty, so no one is ever shut out */
  const inLane = Math.abs(x - RIME_BERTH.x) < 16;
  const isClear =
    !nearEmberLand(x, z, radius + 9) &&
    !onFrostLand(x, z, -(radius + 9)) &&
    FLOES.every((floe) => Math.hypot(x - floe.x, z - floe.z) > floe.radius + radius + 9);
  if (!inLane && isClear) {
    FLOES.push({ x, z, radius, turn: hash(k, 1.3) * Math.PI * 2 });
  }
}

/** Is (x, z) too close to a floe for a hull of `room`? */
export const nearFloe = (x, z, room) =>
  FLOES.some((floe) => Math.hypot(x - floe.x, z - floe.z) < floe.radius + room);

/** Is (x, z) too close to the Frostmarch for a ship's hull of `room`: its land, the bay's ice, the jetty? */
export function nearFrostmarch(x, z, room) {
  if (
    Math.abs(x - RIME_JETTY.x) < RIME_JETTY.halfWidth + room &&
    z > RIME_JETTY.north &&
    z < RIME_JETTY.south + room
  ) {
    return true;
  }
  if (bayShare(x, z, room) < 1) {
    return true;
  }
  return onFrostLand(x, z, -room);
}

/* ---------- where the monsters of the shore keep watch ---------- */

/* `count` spots on the shore inside this box, spread out, away from the village and the ways, each the same every
   time */
function shoreSpots(count, seed, x0, x1, z0, z1) {
  const spots = [];
  for (let k = 0; spots.length < count && k < count * 80; k++) {
    const x = x0 + hash(seed, k) * (x1 - x0);
    const z = z0 + hash(k, seed) * (z1 - z0);
    const isOpen =
      inFrostmarch(x, z, 3) &&
      !onBayIce(x, z, -4) &&
      Math.hypot(x - RIMEHOLT.x, z - RIMEHOLT.z) > RIMEHOLT.radius + 14 &&
      rimePathDistance(x, z) > 4 &&
      spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 9);
    if (isOpen) {
      spots.push([x, z]);
    }
  }
  return spots;
}

const SPOTS = {
  /* the frost wolves hunt the snowfields east of the village, the ice slimes creep over the shore to the west */
  frost_wolf: shoreSpots(12, 31, -96, 8, -1625, -1525),
  ice_slime: shoreSpots(10, 47, -290, -186, -1615, -1515),
};

/** The spot of the monster with this id ("frost_wolf#2") on the Frostmarch, or null for one that is not of it. */
export function frostSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots || !spots.length) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  return [x + (Math.random() - 0.5), z + (Math.random() - 0.5)];
}

/** How many monsters of this kind keep watch on the Frostmarch (one per spot). */
export const frostSpotCount = (key) => (SPOTS[key] ? SPOTS[key].length : 0);
