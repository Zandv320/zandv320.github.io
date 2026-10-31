/* Eldoria – game rules: Greyfall Gorge and Northwatch on the Northroad (Saga II). The gorge cuts across the land
   from edge to edge; the only way over is the Old King's Bridge, where Grumm the bridge troll asks for his toll.
   When he smashes the planks, a stretch of one half of the deck falls into the gorge (breakPlanks) until he is
   beaten or starts over (mendBridge). Northwatch is the ruined watchtower east of the road, held by goblins that
   keep to their own spots around it (northSpotFor). Pure data and geometry, no browser: the server runs it too. */

/* the gorge's rims: north and south of them is land, in between the drop */
export const GORGE = { name: "Greyfall Gorge", south: -262, north: -278 };

/* the bridge over it: the deck's centre line, half its width, and its ends on the land at both sides */
export const BRIDGE = {
  name: "The Old King's Bridge",
  x: -136,
  halfWidth: 3.6,
  south: GORGE.south + 2,
  north: GORGE.north - 2,
};

/* the ruined watchtower, with the humming runestone in the middle */
export const NORTHWATCH = { name: "Northwatch", x: -119, z: -214, radius: 11 };

/* The rims wave a little, except at the bridge, where they run straight across. */
function rimWave(x) {
  const calm = Math.min(1, Math.abs(x - BRIDGE.x) / 10);
  return (1.6 * Math.sin(0.21 * x + 1) + 1 * Math.sin(0.47 * x + 2)) * calm;
}

export const gorgeSouthRim = (x) => GORGE.south + rimWave(x);
export const gorgeNorthRim = (x) => GORGE.north + rimWave(x) * 0.8;

/** Is (x, z) over the drop (between the rims)? */
export const inGorge = (x, z) => z < gorgeSouthRim(x) && z > gorgeNorthRim(x);

/** Is (x, z) on the bridge's deck, at least `margin` from its sides? */
export const onBridge = (x, z, margin = 0) =>
  Math.abs(x - BRIDGE.x) < BRIDGE.halfWidth - margin && z < BRIDGE.south && z > BRIDGE.north;

/* ---------- the planks Grumm smashes ---------- */

/* the broken stretches: {x0, z0, x1, z1} */
const broken = [];

/** The stretches of the deck that have fallen into the gorge. */
export const brokenPlanks = () => broken;

/** Has the deck at (x, z) fallen away (with `margin` around the hole)? */
export const isBrokenAt = (x, z, margin = 0) =>
  broken.some(
    (hole) =>
      x > hole.x0 - margin && x < hole.x1 + margin && z > hole.z0 - margin && z < hole.z1 + margin,
  );

/**
 * The stretch a smash at (x, z) breaks: the half of the deck that spot is on, three units along the bridge, over
 * the drop only. Null when that would cut the bridge in two (the other half is already gone there), so there is
 * always a way across.
 */
export function plankStretch(x, z) {
  const isWest = x < BRIDGE.x;
  const z1 = Math.min(GORGE.south, z + 1.5);
  const z0 = Math.max(GORGE.north, z1 - 3);
  const stretch = {
    x0: isWest ? BRIDGE.x - BRIDGE.halfWidth : BRIDGE.x,
    x1: isWest ? BRIDGE.x : BRIDGE.x + BRIDGE.halfWidth,
    z0: +z0.toFixed(2),
    z1: +Math.max(z0 + 1, z1).toFixed(2),
  };
  const cutsAcross = broken.some(
    (hole) => hole.x0 < BRIDGE.x !== isWest && hole.z0 < stretch.z1 + 1 && hole.z1 > stretch.z0 - 1,
  );
  return cutsAcross ? null : stretch;
}

/** A stretch falls (the same one twice counts once: the host and its own event both call this). */
export function breakPlanks(stretch) {
  const isKnown = broken.some(
    (hole) => Math.abs(hole.x0 - stretch.x0) < 0.01 && Math.abs(hole.z0 - stretch.z0) < 0.01,
  );
  if (!isKnown) {
    broken.push({ x0: stretch.x0, z0: stretch.z0, x1: stretch.x1, z1: stretch.z1 });
  }
}

/** Every plank back in its place (the troll was beaten, or nobody is left to fight him). */
export function mendBridge() {
  broken.length = 0;
}

/** Can one stand at (x, z) in the gorge: on the deck, and not where it has broken away? */
export const gorgeFloorAt = (x, z, margin = 0) =>
  onBridge(x, z, margin * 0.5) && !isBrokenAt(x, z, margin * 0.5);

/* ---------- Northwatch's goblins: each keeps to its own spot ---------- */

const [NX, NZ] = [NORTHWATCH.x, NORTHWATCH.z];
const SPOTS = {
  goblin_scavenger: [
    [NX - 8, NZ + 5],
    [NX - 6, NZ - 6],
    [NX + 2, NZ + 8],
    [NX + 6, NZ + 4],
    [NX + 5, NZ - 7],
    [NX - 2, NZ - 9],
    [NX - 10, NZ - 1],
    [NX + 7, NZ - 2],
  ],
  goblin_raider: [
    [NX - 4, NZ + 4],
    [NX + 4, NZ + 3],
    [NX + 3, NZ - 5],
    [NX - 5, NZ - 3],
    [NX - 9, NZ + 8],
  ],
  goblin_chief: [[NX, NZ - 1.5]],
  grumm: [[BRIDGE.x, (GORGE.south + GORGE.north) / 2]],
};

/** The spot of the monster with this id ('goblin_raider#2'), or null for one that roams. */
export function northSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  return [x + (Math.random() - 0.5), z + (Math.random() - 0.5)];
}

/** How many of this monster have a spot (data.js spawns one per spot). */
export const northSpotCount = (key) => (SPOTS[key] ? SPOTS[key].length : 0);
