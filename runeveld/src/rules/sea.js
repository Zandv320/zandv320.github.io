/* Eldoria – game rules: the Grey Sea north of Saltmere (Saga II). Heroes sail it themselves at the helm of the Gull's
   Promise (sailing.js): from her berth by Saltmere's east pier out between sea stacks and islets towards the smoking
   Ember Isles on the horizon. The sea chart (world-map.js) shows all of it. Pure data and geometry, no browser: the
   server runs it too. */
import { SALTMERE, PIERS, MOLE } from "./saltmere.js";

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
/* the islets nobody lives on, with the names the sailors give them */
export const ISLETS = [
  { name: "Saltwind Isle", x: -280, z: -520, radius: 11 },
  { name: "Little Tern", x: -20, z: -548, radius: 8 },
  { name: "Greenhollow", x: -70, z: -690, radius: 12 },
  { name: "Widow's Isle", x: -330, z: -660, radius: 9 },
];
/* the Ember Isles: for now a coast nobody can land on, under a smoking mountain */
export const EMBER_ISLES = { name: "The Ember Isles", x: -170, z: -905, radius: 70 };

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
    if (Math.hypot(x - islet.x, z - islet.z) < islet.radius + room) {
      return false;
    }
  }
  return Math.hypot(x - EMBER_ISLES.x, z - EMBER_ISLES.z) >= EMBER_ISLES.radius + room;
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
