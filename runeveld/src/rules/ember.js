/* Eldoria – game rules: the Ember Isles at the far side of the Grey Sea (Saga II). A wide land of ash and black
   rock round Mount Kharos, which smokes in its middle. On the south coast a cove opens between the reefs, Cinder
   Cove, with a jetty where the Gull's Promise can moor and a camp on the beach above it. From the camp the roads
   run out to the isles' lands: the Ash Flats with their pools of lava in the south-west, the burnt Scorchwood in
   the south-east, the ruins of the Fallen Watch in the west, the black glass of the Obsidian Steps in the east,
   and round the mountain to the Gate of Kharos on its north side. Three rivers of lava run from the mountain to
   the sea; the roads cross them where the lava has crusted over.
   The land is star-shaped round the isles' middle: along every bearing it reaches as far as the coast, or as far
   as the cove where the cove cuts in. Pure data and geometry, no browser: the server runs it too. */

export const EMBER_ISLES = { name: "The Ember Isles", x: -170, z: -1185, radius: 165 };

/** The coast's distance from the isles' middle along this bearing (atan2(dx, dz)): capes and bays, wide and
    small (chosen so every land of the isles, the lava and a way round the mountain all stay on land). */
export function emberCoast(angle) {
  return (
    EMBER_ISLES.radius *
    (1 +
      0.16 * Math.sin(angle * 2 + 3.05) +
      0.12 * Math.sin(angle * 3 + 2.49) +
      0.06 * Math.sin(angle * 5 + 1) +
      0.035 * Math.sin(angle * 9 + 0.3) +
      0.02 * Math.sin(angle * 17 + 1.1))
  );
}

/* how far the coast reaches at most, for the ground and the maps */
export const EMBER_REACH = 205;

/* the cove: a round bay of water cut into the south coast, open to the sea */
const SOUTH_COAST = EMBER_ISLES.z + emberCoast(0);
export const CINDER_COVE = {
  name: "Cinder Cove",
  x: EMBER_ISLES.x,
  z: SOUTH_COAST - 8,
  radius: 14,
};

/* the jetty on the cove's east side, from the beach in the north out to the mouth in the south */
export const COVE_JETTY = {
  x: CINDER_COVE.x + 9,
  halfWidth: 1.4,
  north: CINDER_COVE.z - 12,
  south: CINDER_COVE.z + 9,
};

/* where the Gull's Promise lies alongside the jetty, bow to the beach (heading 0 = bow to -z) */
export const COVE_BERTH = {
  name: "Cinder Cove",
  x: CINDER_COVE.x + 4.4,
  z: CINDER_COVE.z + 2,
  heading: 0,
};
/* where a hero steps ashore from her: on the jetty's planks */
export const COVE_LANDING = [COVE_JETTY.x - 0.5, CINDER_COVE.z + 1];

/* the camp on the beach behind the cove: its fire, and how far its safety reaches */
export const CINDER_CAMP = {
  name: "Cinder Cove",
  x: CINDER_COVE.x + 2,
  z: CINDER_COVE.z - 26,
  radius: 15,
};
/** A spot in the camp, (dx, dz) from its middle. */
export const inCamp = (dx, dz) => [CINDER_CAMP.x + dx, CINDER_CAMP.z + dz];
/* where a hero who fell on the isles wakes up, once the camp has taken them in: by the fire */
export const CAMP_WAKE = inCamp(3.5, 3.5);

/* Mount Kharos, smoking in the middle of the isles; the Forge of the First Flame lies inside it */
export const MOUNT_KHAROS = {
  name: "Mount Kharos",
  x: -172,
  z: -1235,
  radius: 52,
  height: 44,
  craterRadius: 8,
};

/** How far Mount Kharos's slope lies from its middle along this bearing, at height share t (0 the foot, 1 the
    crater's rim): a cone that narrows upwards, its foot wavy and gullies running down it. */
export function kharosRadius(angle, t) {
  const { radius, craterRadius } = MOUNT_KHAROS;
  const wave =
    1 + (0.06 * Math.sin(angle * 5 + 0.7) + 0.04 * Math.sin(angle * 13 + t * 6.4)) * (1 - t * 0.6);
  return (radius * Math.pow(1 - t, 1.25) + craterRadius * t) * wave;
}

/** How far (x, z) lies outside the foot of Mount Kharos (below 0 under it). */
export const outsideKharos = (x, z) =>
  Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z) -
  kharosRadius(Math.atan2(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z), 0);

/* ---------- the lands of the isles ---------- */

/* a spot `share` of the way from the isles' middle to the coast, along this bearing */
const inland = (bearing, share) => {
  const reach = emberCoast(bearing) * share;
  return [EMBER_ISLES.x + Math.sin(bearing) * reach, EMBER_ISLES.z + Math.cos(bearing) * reach];
};

/* the lands, each round its middle (x, z) out to `radius`, and the levels of what lives there */
export const EMBER_LANDS = {
  ashFlats: { name: "The Ash Flats", center: inland(-0.75, 0.62), radius: 42 },
  scorchwood: { name: "Scorchwood", center: inland(0.8, 0.62), radius: 36 },
  fallenWatch: { name: "The Fallen Watch", center: inland(-2.0, 0.66), radius: 24 },
  obsidianSteps: { name: "The Obsidian Steps", center: inland(2.1, 0.64), radius: 38 },
  gate: {
    name: "The Gate of Kharos",
    center: [MOUNT_KHAROS.x, MOUNT_KHAROS.z - MOUNT_KHAROS.radius - 4],
    radius: 16,
  },
};

/** The land of the isles (x, z) lies in, or null. */
export function emberLandAt(x, z) {
  for (const land of Object.values(EMBER_LANDS)) {
    if (Math.hypot(x - land.center[0], z - land.center[1]) < land.radius) {
      return land;
    }
  }
  return null;
}

/* the roads: from the camp out to the lands, and on round the mountain to its gate */
const CAMP = [CINDER_CAMP.x, CINDER_CAMP.z];
const { ashFlats, scorchwood, fallenWatch, obsidianSteps, gate } = EMBER_LANDS;
export const EMBER_ROADS = [
  [[COVE_JETTY.x, COVE_JETTY.north], inCamp(4.5, 8), inCamp(1, 3), CAMP],
  [CAMP, ashFlats.center],
  [CAMP, scorchwood.center],
  [ashFlats.center, fallenWatch.center],
  [scorchwood.center, obsidianSteps.center],
  [fallenWatch.center, [-232, -1300], gate.center],
  [obsidianSteps.center, [-110, -1300], gate.center],
];

/* rivers of lava from the mountain's foot down to the sea: [x, z] along each, and pools of it ({x, z, r}). Nobody
   walks through them. */
export const LAVA_FLOWS = [
  [
    [-220.5, -1227.8],
    [-232.8, -1230],
    [-245, -1234.1],
    [-256.9, -1238.1],
    [-268.9, -1239.7],
    [-281, -1237],
    [-292.9, -1229.8],
    [-304.1, -1219.9],
    [-314.9, -1210.5],
  ],
  [
    [-123.8, -1226],
    [-111.5, -1227.1],
    [-99.2, -1229.7],
    [-87, -1232.3],
    [-75, -1232.9],
    [-63.1, -1229.9],
    [-51.6, -1223.2],
    [-40.6, -1214.2],
    [-30, -1205.8],
    [-18.8, -1200.6],
    [-6.5, -1200.8],
    [6.8, -1206.6],
    [20.1, -1216],
  ],
  [
    [-199.9, -1275.3],
    [-203.9, -1287],
    [-206.5, -1299.3],
    [-209.1, -1311.5],
    [-213.5, -1322.7],
    [-221.1, -1332.3],
    [-232, -1340.1],
  ],
];
export const LAVA_WIDTH = 1.9;
/* where the lava has crusted over, black and cool enough to walk across: where the roads cross the rivers, and a
   few more, so every part of the isles can be reached */
export const LAVA_CROSSINGS = [
  { x: -255.1, z: -1236.9 },
  { x: -206.2, z: -1296.1 },
  { x: -72, z: -1232.1 },
  { x: -298.5, z: -1224.9 },
  { x: -24.4, z: -1203.2 },
];
export const CROSSING_REACH = 3.6;
export const LAVA_POOLS = [
  { x: -226, z: -1060, r: 4 },
  { x: -268, z: -1103, r: 3.5 },
  { x: -246, z: -1117, r: 3 },
  { x: -226, z: -1112, r: 2.5 },
  { x: -90, z: -1262, r: 3 },
];

/* shortest distance from (x, z) to a line of points */
export function distanceToLine(x, z, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
      : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** How far (x, z) lies from the nearest road of the isles. */
export const roadDistance = (x, z) =>
  Math.min(...EMBER_ROADS.map((road) => distanceToLine(x, z, road)));

/** How far (x, z) lies from the nearest river of lava, crossings and all: below 0 over it. */
export function riverDistance(x, z) {
  return Math.min(...LAVA_FLOWS.map((flow) => distanceToLine(x, z, flow))) - LAVA_WIDTH;
}

/* The rivers as they burn: each cut where it has crusted over, so the crust between the pieces is free to walk on.
   A piece ends a river's width short of the crust, because the lava rounds off that far past its end. */
const LAVA_RUNS = LAVA_FLOWS.flatMap((flow) => {
  const runs = [];
  let run = [];
  for (let k = 0; k < flow.length - 1; k++) {
    const [ax, az] = flow[k];
    const [bx, bz] = flow[k + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
    for (let step = 0; step <= steps; step++) {
      const x = ax + ((bx - ax) * step) / steps;
      const z = az + ((bz - az) * step) / steps;
      const isCrust = LAVA_CROSSINGS.some(
        (crossing) => Math.hypot(x - crossing.x, z - crossing.z) < CROSSING_REACH + LAVA_WIDTH,
      );
      if (isCrust) {
        if (run.length > 1) {
          runs.push(run);
        }
        run = [];
      } else {
        run.push([x, z]);
      }
    }
  }
  if (run.length > 1) {
    runs.push(run);
  }
  return runs;
});

/** How far (x, z) lies from the nearest lava, river or pool: below 0 inside it (the crust of a crossing is not lava). */
export function lavaDistance(x, z) {
  let best = Infinity;
  for (const run of LAVA_RUNS) {
    best = Math.min(best, distanceToLine(x, z, run) - LAVA_WIDTH);
  }
  for (const pool of LAVA_POOLS) {
    best = Math.min(best, Math.hypot(x - pool.x, z - pool.z) - pool.r);
  }
  return best;
}

/** How far the land reaches from the isles' middle along this bearing: to the coast, or to the cove's near edge. */
export function emberShore(angle) {
  const coast = emberCoast(angle);
  /* where this bearing first runs into the cove's circle, if it does */
  const toX = CINDER_COVE.x - EMBER_ISLES.x;
  const toZ = CINDER_COVE.z - EMBER_ISLES.z;
  const along = toX * Math.sin(angle) + toZ * Math.cos(angle);
  const square = along * along - (toX * toX + toZ * toZ) + CINDER_COVE.radius ** 2;
  if (along <= 0 || square <= 0) {
    return coast;
  }
  return Math.min(coast, along - Math.sqrt(square));
}

/** Is (x, z) on the jetty's planks, at least `margin` from their edge? */
export function onCoveJetty(x, z, margin = 0) {
  return (
    Math.abs(x - COVE_JETTY.x) < COVE_JETTY.halfWidth - margin &&
    z > COVE_JETTY.north - 2 &&
    z < COVE_JETTY.south - margin
  );
}

/** Is (x, z) land of the Ember Isles (not the cove, not the sea), at least `margin` from the water? */
export function onEmberLand(x, z, margin = 0) {
  const dx = x - EMBER_ISLES.x;
  const dz = z - EMBER_ISLES.z;
  return Math.hypot(dx, dz) < emberShore(Math.atan2(dx, dz)) - margin;
}

/** Can a hero walk at (x, z) on the Ember Isles: on the land below the mountain and off the lava, or out on the
    jetty? */
export function inEmberIsles(x, z, margin = 0) {
  if (onCoveJetty(x, z, margin * 0.5)) {
    return true;
  }
  /* a strip of surf along the shore stays wet */
  return (
    onEmberLand(x, z, 1.2 + margin) &&
    outsideKharos(x, z) > margin &&
    lavaDistance(x, z) > 0.4 + margin
  );
}

/** Is (x, z) in the camp at Cinder Cove, where no monster comes? */
export const inCinderCamp = (x, z) =>
  Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) < CINDER_CAMP.radius || onCoveJetty(x, z, -1);

/** Is (x, z) too close to the isles for a ship's hull of `room`: near the land or the jetty, but not inside the cove? */
export function nearEmberLand(x, z, room) {
  if (
    Math.abs(x - COVE_JETTY.x) < COVE_JETTY.halfWidth + room &&
    z > COVE_JETTY.north &&
    z < COVE_JETTY.south + room
  ) {
    return true;
  }
  if (Math.hypot(x - CINDER_COVE.x, z - CINDER_COVE.z) < CINDER_COVE.radius - room) {
    return false;
  }
  const dx = x - EMBER_ISLES.x;
  const dz = z - EMBER_ISLES.z;
  return Math.hypot(dx, dz) < emberShore(Math.atan2(dx, dz)) + room;
}

/* ---------- where the monsters of the isles keep watch ---------- */

/* a fixed pseudo-random number per spot, the same on every client and the server */
const hash = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/* `count` spots in this land, spread out, on open ground (off the roads and the lava), each the same every time */
function spotsIn(land, count, seed) {
  const spots = [];
  for (let k = 0; spots.length < count && k < count * 40; k++) {
    const angle = hash(seed, k) * Math.PI * 2;
    const distance = Math.sqrt(hash(k, seed)) * land.radius;
    const x = land.center[0] + Math.sin(angle) * distance;
    const z = land.center[1] + Math.cos(angle) * distance;
    const isOpen =
      inEmberIsles(x, z, 2) &&
      lavaDistance(x, z) > 2.5 &&
      roadDistance(x, z) > 3 &&
      spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 6);
    if (isOpen) {
      spots.push([x, z]);
    }
  }
  return spots;
}

/* each monster of the isles keeps watch on its own spot in its land */
const SPOTS = {
  magma_slime: spotsIn(ashFlats, 12, 11),
  fire_imp: spotsIn(scorchwood, 12, 23),
  ash_golem: spotsIn(obsidianSteps, 9, 37),
};

/** The spot of the monster with this id ('fire_imp#2') on the isles, or null for one that is not of the isles. */
export function emberSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots || !spots.length) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  return [x + (Math.random() - 0.5), z + (Math.random() - 0.5)];
}

/** How many monsters of this kind keep watch on the isles (one per spot). */
export const emberSpotCount = (key) => (SPOTS[key] ? SPOTS[key].length : 0);
