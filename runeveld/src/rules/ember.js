/* Eldoria – game rules: the Ember Isles at the far side of the Grey Sea (Saga II). Black rock and ash under Mount
   Kharos, which smokes in the middle; on the south coast a cove opens between the reefs, Cinder Cove, with a jetty
   where the Gull's Promise can moor and a camp on the ash beach above it. The land is star-shaped round the isles'
   middle: along every bearing it reaches as far as the coast, or as far as the cove where the cove cuts in.
   Pure data and geometry, no browser: the server runs it too. */

export const EMBER_ISLES = { name: "The Ember Isles", x: -170, z: -905, radius: 70 };

/* the cove: a round bay of water cut into the south coast, open to the sea */
export const CINDER_COVE = { name: "Cinder Cove", x: -170, z: -838, radius: 14 };

/* the jetty on the cove's east side, from the beach in the north out to the mouth in the south */
export const COVE_JETTY = { x: -161, halfWidth: 1.4, north: -850, south: -829 };

/* where the Gull's Promise lies alongside the jetty, bow to the beach (heading 0 = bow to -z) */
export const COVE_BERTH = { name: "Cinder Cove", x: -165.6, z: -836, heading: 0 };
/* where a hero steps ashore from her: on the jetty's planks */
export const COVE_LANDING = [COVE_JETTY.x - 0.5, -837];

/* the camp on the ash beach behind the cove: its fire, and how far its safety reaches */
export const CINDER_CAMP = { name: "Cinder Cove", x: -168, z: -864, radius: 15 };
/* where a hero who fell on the isles wakes up, once the camp is made: by the fire */
export const CAMP_WAKE = [-164.5, -860.5];

/* Mount Kharos, smoking in the middle of the isles: nobody climbs it (yet) */
export const MOUNT_KHAROS = { name: "Mount Kharos", x: -180, z: -923, radius: 40 };

/* rivers of lava from the mountain's foot down to the sea, west and east of the camp: [x, z] along each, and
   pools of it at the foot ({x, z, r}). Nobody walks through them. */
export const LAVA_FLOWS = [
  [
    [-215, -906],
    [-223, -893],
    [-231, -880],
    [-236, -866],
    [-244, -852],
  ],
  [
    [-143, -906],
    [-131, -901],
    [-120, -896],
    [-110, -887],
    [-99, -880],
    [-90, -875],
  ],
];
export const LAVA_WIDTH = 1.7;
export const LAVA_POOLS = [
  { x: -203, z: -880, r: 3.2 },
  { x: -148, z: -885, r: 2.4 },
  { x: -196, z: -965, r: 3.6 },
];

/* shortest distance from (x, z) to a line of points */
function distanceToLine(x, z, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** How far (x, z) lies from the nearest lava, river or pool: below 0 inside it. */
export function lavaDistance(x, z) {
  let best = Infinity;
  for (const flow of LAVA_FLOWS) {
    best = Math.min(best, distanceToLine(x, z, flow) - LAVA_WIDTH);
  }
  for (const pool of LAVA_POOLS) {
    best = Math.min(best, Math.hypot(x - pool.x, z - pool.z) - pool.r);
  }
  return best;
}

/** The coast's distance from the isles' middle along this bearing (atan2(dx, dz)): a wavy circle. */
export function emberCoast(angle) {
  return EMBER_ISLES.radius * (1 + 0.08 * Math.sin(angle * 5 + 1) + 0.05 * Math.sin(angle * 11));
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
    Math.hypot(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z) > MOUNT_KHAROS.radius + margin &&
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
