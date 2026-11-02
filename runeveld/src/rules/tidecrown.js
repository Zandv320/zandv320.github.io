/* Eldoria – game rules: Tidecrown, the island that rose out of the Grey Sea east of the Ember Isles the night
   Maelis took the First Flame (Saga II, chapter 12). A ring of land round a round lake, the Crownmere, the old
   crater of a sea mountain; a crown of rock teeth stands along the lake's shore, with gaps to walk through. On the
   south coast a landing with a short pier, where the Gull's Promise can moor; a path climbs from there to the
   lake. In the middle of the lake an islet carries the tide seal, the third of the seven, and an old causeway runs
   out to it from the south shore. The Grey Leviathan, the seal's guardian, lives in the lake.
   The land is star-shaped round the island's middle: along every bearing it reaches from the lake's shore out to
   the coast. Pure data and geometry, no browser: the server runs it too. */

export const TIDECROWN = { name: "Tidecrown", x: 30, z: -890, radius: 56 };

/** The coast's distance from the island's middle along this bearing (atan2(dx, dz)): a few capes and bays. */
export function tidecrownCoast(angle) {
  return (
    TIDECROWN.radius *
    (1 +
      0.1 * Math.sin(angle * 3 + 0.8) +
      0.06 * Math.sin(angle * 5 + 2.2) +
      0.03 * Math.sin(angle * 11 + 0.4))
  );
}

/* how far the coast reaches at most, for the ground and the maps */
export const TIDECROWN_REACH = 72;

/* the lake in the old crater, a little north of the middle; its water lies lower than the land */
export const CROWNMERE = { name: "The Crownmere", x: TIDECROWN.x, z: TIDECROWN.z - 4, radius: 22 };
export const LAKE_Y = -0.6;

/* the islet of the tide seal in the middle of the lake, and the causeway out to it from the south shore */
export const SEAL_ISLET = { x: CROWNMERE.x, z: CROWNMERE.z, radius: 4.6 };
export const CAUSEWAY = {
  x: CROWNMERE.x,
  halfWidth: 1.5,
  north: SEAL_ISLET.z + SEAL_ISLET.radius - 1,
  /* it runs a little way up the shore, so it meets the land whatever margin is asked */
  south: CROWNMERE.z + CROWNMERE.radius + 3,
};
/* the altar of the tide seal, at the islet's north end */
export const TIDE_SEAL = [SEAL_ISLET.x, SEAL_ISLET.z - 1.6];

/* the crown: rock teeth standing along the lake's shore, [bearing, radius, height] each, with gaps between some of
   them to walk through (and to hide behind from the Leviathan's surge) */
const CROWN_RING = CROWNMERE.radius + 4.5;
export const CROWN_TEETH = [];
for (let k = 0; k < 18; k++) {
  const bearing = (k / 18) * Math.PI * 2;
  /* the south (bearing 0) stays open for the causeway and the path up from the landing */
  if (k === 0) {
    continue;
  }
  CROWN_TEETH.push({
    x: CROWNMERE.x + Math.sin(bearing) * CROWN_RING,
    z: CROWNMERE.z + Math.cos(bearing) * CROWN_RING,
    radius: 1.3 + (k % 3) * 0.25,
    height: 4 + ((k * 7) % 5) * 0.9,
  });
}

/* the landing on the south coast: a short pier out into the sea, the Gull's Promise's berth beside it, and the camp
   above the beach (where a hero who falls on the island wakes up) */
const SOUTH_COAST = TIDECROWN.z + tidecrownCoast(0);
export const TIDE_PIER = {
  x: TIDECROWN.x + 6,
  halfWidth: 1.4,
  north: SOUTH_COAST - 3,
  south: SOUTH_COAST + 12,
};
export const TIDE_BERTH = {
  name: "Tidecrown",
  x: TIDE_PIER.x - 5,
  z: SOUTH_COAST + 9,
  heading: 0,
};
export const TIDE_LANDING = [TIDE_PIER.x + 0.4, SOUTH_COAST + 8];
export const TIDE_CAMP = { name: "Tidecrown", x: TIDECROWN.x + 4, z: SOUTH_COAST - 9, radius: 7 };
export const TIDE_WAKE = [TIDE_CAMP.x + 2, TIDE_CAMP.z + 1.5];

/* where the Leviathan waits in the deep middle of the lake, before anyone comes */
export const LEVIATHAN_HOME = [CROWNMERE.x + 9, CROWNMERE.z - 6];

/** Is (x, z) water of the Crownmere (not the islet, not the causeway), at least `margin` from its shores? */
export function inCrownmere(x, z, margin = 0) {
  if (Math.hypot(x - CROWNMERE.x, z - CROWNMERE.z) > CROWNMERE.radius - margin) {
    return false;
  }
  if (Math.hypot(x - SEAL_ISLET.x, z - SEAL_ISLET.z) < SEAL_ISLET.radius + margin) {
    return false;
  }
  return !onCauseway(x, z, -margin);
}

/** Is (x, z) on the causeway, at least `margin` from its edges? */
export const onCauseway = (x, z, margin = 0) =>
  Math.abs(x - CAUSEWAY.x) < CAUSEWAY.halfWidth - margin &&
  z > CAUSEWAY.north &&
  z < CAUSEWAY.south;

/** Is (x, z) on the pier's planks, at least `margin` from their edge? */
export const onTidePier = (x, z, margin = 0) =>
  Math.abs(x - TIDE_PIER.x) < TIDE_PIER.halfWidth - margin &&
  z > TIDE_PIER.north - 2 &&
  z < TIDE_PIER.south - margin;

/** Is (x, z) land of Tidecrown inside its coast, at least `margin` from the sea (the lake not counted)? */
export function onTidecrownLand(x, z, margin = 0) {
  const dx = x - TIDECROWN.x;
  const dz = z - TIDECROWN.z;
  return Math.hypot(dx, dz) < tidecrownCoast(Math.atan2(dx, dz)) - margin;
}

/** Can a hero walk at (x, z) on Tidecrown: on its land off the lake, out on the causeway and the seal's islet, or
    on the pier? The narrow ways take only part of the margin, or a hero could not walk them at all. (The crown's
    teeth are obstacles of their own, tidecrown.js.) */
export function inTidecrown(x, z, margin = 0) {
  if (onTidePier(x, z, margin * 0.5) || onCauseway(x, z, margin * 0.4)) {
    return true;
  }
  const fromLake = Math.hypot(x - CROWNMERE.x, z - CROWNMERE.z);
  if (fromLake < CROWNMERE.radius + 2) {
    if (Math.hypot(x - SEAL_ISLET.x, z - SEAL_ISLET.z) < SEAL_ISLET.radius - 0.3 - margin * 0.5) {
      return true;
    }
    if (fromLake < CROWNMERE.radius + 0.3 + margin * 0.3) {
      return false;
    }
  }
  return onTidecrownLand(x, z, 1.2 + margin);
}

/* clear of the crown's rock teeth (for the monsters' spots) */
const clearOfTeeth = (x, z, room) =>
  CROWN_TEETH.every((tooth) => Math.hypot(x - tooth.x, z - tooth.z) > tooth.radius + room);

/** Is (x, z) in the camp at the landing, where no monster comes? */
export const inTideCamp = (x, z) =>
  Math.hypot(x - TIDE_CAMP.x, z - TIDE_CAMP.z) < TIDE_CAMP.radius || onTidePier(x, z, -1);

/** Is (x, z) by the Crownmere: on its shore inside the crown, the causeway or the islet (the Leviathan's reach)? */
export const byCrownmere = (x, z) => Math.hypot(x - CROWNMERE.x, z - CROWNMERE.z) < CROWN_RING + 2;

/** Is (x, z) too close to Tidecrown for a ship's hull of `room`: near its land or its pier? */
export function nearTidecrown(x, z, room) {
  if (
    Math.abs(x - TIDE_PIER.x) < TIDE_PIER.halfWidth + room &&
    z > TIDE_PIER.north &&
    z < TIDE_PIER.south + room
  ) {
    return true;
  }
  const dx = x - TIDECROWN.x;
  const dz = z - TIDECROWN.z;
  return Math.hypot(dx, dz) < tidecrownCoast(Math.atan2(dx, dz)) + room;
}

/** Where the Leviathan comes up near a hero at (x, z): in deep water of the lake, a few steps from them, so a blade
    can reach its head from the shore. Null when the hero is nowhere near the lake. */
export function surfaceSpotNear(x, z) {
  if (!byCrownmere(x, z)) {
    return null;
  }
  let best = null;
  for (const reach of [3, 3.8, 4.8, 6.5]) {
    for (let k = 0; k < 24; k++) {
      const angle = (k / 24) * Math.PI * 2;
      const sx = x + Math.sin(angle) * reach;
      const sz = z + Math.cos(angle) * reach;
      if (inCrownmere(sx, sz, 1.4)) {
        const depth = CROWNMERE.radius - Math.hypot(sx - CROWNMERE.x, sz - CROWNMERE.z);
        /* deeper water is better, and the nearest reach wins */
        if (!best || depth > best.depth) {
          best = { x: sx, z: sz, depth };
        }
      }
    }
    if (best) {
      return [+best.x.toFixed(2), +best.z.toFixed(2)];
    }
  }
  return null;
}

/* ---------- where the monsters of the island keep watch ---------- */

const hash = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/* `count` spots on the ring of land between the crown and the coast, spread out, away from the camp and the path
   up from the landing, each the same every time */
function ringSpots(count, seed) {
  const spots = [];
  for (let k = 0; spots.length < count && k < count * 60; k++) {
    const angle = hash(seed, k) * Math.PI * 2;
    const distance = CROWN_RING + 4 + hash(k, seed) * 22;
    const x = TIDECROWN.x + Math.sin(angle) * distance;
    const z = TIDECROWN.z + Math.cos(angle) * distance;
    const isOpen =
      inTidecrown(x, z, 2) &&
      clearOfTeeth(x, z, 2) &&
      !inTideCamp(x, z) &&
      Math.hypot(x - TIDE_CAMP.x, z - TIDE_CAMP.z) > 14 &&
      Math.abs(x - CAUSEWAY.x) > 5 &&
      spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 6);
    if (isOpen) {
      spots.push([x, z]);
    }
  }
  return spots;
}

const SPOTS = {
  drowned_sailor: ringSpots(10, 51),
  tide_ooze: ringSpots(8, 67),
  grey_leviathan: [LEVIATHAN_HOME],
};

/** The spot of the monster with this id ("tide_ooze#2") on Tidecrown, or null for one that is not of the island. */
export function tidecrownSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots || !spots.length) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  /* the Leviathan stays exactly where it was put; the others shuffle a little */
  const jitter = key === "grey_leviathan" ? 0 : 1;
  return [x + (Math.random() - 0.5) * jitter, z + (Math.random() - 0.5) * jitter];
}

/** How many monsters of this kind keep watch on Tidecrown (one per spot). */
export const tidecrownSpotCount = (key) => (SPOTS[key] ? SPOTS[key].length : 0);
