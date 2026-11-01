/* Eldoria – game rules: the Grey Sea north of Saltmere (Saga II). Heroes sail it themselves at the helm of the Gull's
   Promise (sailing.js): from her berth by Saltmere's east pier out between sea stacks and islets towards the smoking
   Ember Isles on the horizon. The sea chart (world-map.js) shows all of it. Pure data and geometry, no browser: the
   server runs it too. */
import { SALTMERE, PIERS, MOLE } from "./saltmere.js";
import { EMBER_ISLES, COVE_BERTH, COVE_LANDING, nearEmberLand } from "./ember.js";

export { EMBER_ISLES };

/* where a ship may sail: the sea north of Saltmere's quay */
export const GREY_SEA = { name: "The Grey Sea", x0: -430, x1: 130, z0: -980, z1: SALTMERE.z0 };

/* how a ship handles: top speed (units per second), how fast it gathers way and loses it, and how fast it turns
   (radians per second at full speed; slower when slow) */
export const SAILING = { speed: 9, accelerate: 2.2, slowdown: 3, turnRate: 1.1 };
/* the hull, for running into things: three circles along it, bow, middle and stern */
export const HULL = { length: 16, beam: 5, radius: 2.4 };

/* the Gull's Promise's berth between the east pier and the mole, bow to the sea (heading 0 = bow to -z) */
export const BERTH = { name: "Saltmere", x: -117.5, z: -397, heading: 0 };
/* where a hero comes ashore from the berth: the east pier */
export const BERTH_LANDING = [PIERS[2].x + 0.6, -397];
/* sailed into the circle this far round a berth, she moors there */
export const MOOR_DISTANCE = 6;
/* every berth where she can moor, with the spot where a hero steps ashore from her there */
export const BERTHS = [
  { ...BERTH, id: "saltmere", landing: BERTH_LANDING },
  { ...COVE_BERTH, id: "cinder_cove", landing: COVE_LANDING },
];

/* sea stacks: [x, z, radius] */
export const ROCKS = [
  [-206, -444, 3.5],
  [-80, -470, 4],
  [-150, -505, 3],
  [-228, -585, 4.5],
  [-62, -612, 3.5],
  [-196, -680, 3],
  [-112, -705, 4],
  [-260, -742, 5],
  [-30, -770, 4],
  [-150, -790, 3.5],
];
/* the islets nobody lives on, with the names the sailors give them; `shape` turns their coasts this way and that
   (phases for the waves of isletReach) */
export const ISLETS = [
  { name: "Saltwind Isle", x: -280, z: -520, radius: 11, shape: [0.4, 2.1, 5.2] },
  { name: "Little Tern", x: -20, z: -548, radius: 8, shape: [2.6, 0.3, 1.7] },
  { name: "Greenhollow", x: -70, z: -690, radius: 12, shape: [4.4, 3.8, 0.9] },
  { name: "Widow's Isle", x: -330, z: -660, radius: 9, shape: [1.3, 5.5, 3.6] },
];

/** How far an islet's coast reaches from its middle along this bearing (atan2(dx, dz)): long and lobed. */
export function isletReach(islet, angle) {
  const [a, b, c] = islet.shape;
  return (
    islet.radius *
    (1 +
      0.26 * Math.sin(angle * 2 + a) +
      0.15 * Math.sin(angle * 3 + b) +
      0.07 * Math.sin(angle * 5 + c))
  );
}

/** How far (x, z) lies outside this islet's coast (below 0 on it). */
export const outsideIslet = (islet, x, z) =>
  Math.hypot(x - islet.x, z - islet.z) - isletReach(islet, Math.atan2(x - islet.x, z - islet.z));

/** Is (x, z) out on the Grey Sea (water, not land)? */
export const inGreySea = (x, z) =>
  x > GREY_SEA.x0 && x < GREY_SEA.x1 && z > GREY_SEA.z0 && z < GREY_SEA.z1;

/* the land of Saltmere that reaches into the water: piers and the mole, with room for the hull's breadth */
function nearHarborWorks(x, z, room) {
  for (const pier of PIERS) {
    if (Math.abs(x - pier.x) < pier.halfWidth + room && z > pier.end - room) {
      return true;
    }
  }
  if (Math.abs(x - MOLE.x) < MOLE.halfWidth + 1.4 + room && z > MOLE.end - room) {
    return true;
  }
  return Math.hypot(x - MOLE.head[0], z - MOLE.head[1]) < MOLE.headRadius + 1.4 + room;
}

/** Can a circle of `room` at (x, z) float here: inside the sea, clear of the quay, the piers, rocks and islands? */
export function isOpenWater(x, z, room = HULL.radius) {
  if (
    x < GREY_SEA.x0 + room ||
    x > GREY_SEA.x1 - room ||
    z < GREY_SEA.z0 + room ||
    z > GREY_SEA.z1 - 1 - room
  ) {
    return false;
  }
  if (nearHarborWorks(x, z, room)) {
    return false;
  }
  for (const [rockX, rockZ, radius] of ROCKS) {
    if (Math.hypot(x - rockX, z - rockZ) < radius + room) {
      return false;
    }
  }
  for (const islet of ISLETS) {
    if (outsideIslet(islet, x, z) < room) {
      return false;
    }
  }
  return !nearEmberLand(x, z, room);
}

/** The three points along a hull at (x, z) with this heading (bow to (-sin, -cos)), for running into things. */
export function hullPoints(x, z, heading) {
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const reach = HULL.length / 2 - HULL.radius;
  return [
    [x + forwardX * reach, z + forwardZ * reach],
    [x, z],
    [x - forwardX * reach, z - forwardZ * reach],
  ];
}

/** Can a ship lie at (x, z) with this heading? */
export const canSail = (x, z, heading) =>
  hullPoints(x, z, heading).every(([px, pz]) => isOpenWater(px, pz));
