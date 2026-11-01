/* Eldoria – game rules: the Forge of the First Flame, inside Mount Kharos on the Ember Isles (Saga II). The Gate of
   Kharos (rules/ember.js) opens on it. Its halls are rectangles on a grid of whole units, far away from the rest of
   the world, like the Sunken Crypt (rules/crypt.js): the client builds them (forge.js), the server and the host
   keep the forge's monsters inside them, each on its own spot.

   From the Gate Hall in the south the way runs north through the Lava Run, where channels of lava surge across the
   floor; east of it the Hall of Bellows with three plates that pump the bellows, west of it the First Forge that
   the bellows wake; north of it, behind a sealed gate, the Heart of Kharos, where the Ember Warden guards the fire
   seal. Pure data and geometry, no browser. */

/** The forge's (0, 0) in the world. */
export const FORGE_ORIGIN = [420, 500];

/* halls and passages in forge coordinates (x to the east, z to the south), [x0, z0, x1, z1] */
const ROOMS = {
  entry: { name: "The Gate Hall", rect: [-6, 36, 6, 46] },
  entryPassage: { rect: [-2, 30, 2, 36] },
  lavaRun: { name: "The Lava Run", rect: [-12, 10, 12, 30] },
  eastPassage: { rect: [12, 17, 16, 21] },
  bellows: { name: "The Hall of Bellows", rect: [16, 8, 32, 28] },
  westPassage: { rect: [-16, 17, -12, 21] },
  forge: { name: "The First Forge", rect: [-34, 8, -16, 28] },
  sanctumPassage: { rect: [-3, 2, 3, 10] },
  sanctum: { name: "The Heart of Kharos", rect: [-16, -26, 16, 2] },
};

const [ORIGIN_X, ORIGIN_Z] = FORGE_ORIGIN;
const toWorld = ([x0, z0, x1, z1]) => [x0 + ORIGIN_X, z0 + ORIGIN_Z, x1 + ORIGIN_X, z1 + ORIGIN_Z];

/** The forge's halls and passages in world coordinates: key → {name (halls only), rect: [x0, z0, x1, z1]}. */
export const FORGE_ROOMS = Object.fromEntries(
  Object.entries(ROOMS).map(([key, room]) => [key, { ...room, rect: toWorld(room.rect) }]),
);

/** A point given in forge coordinates, in the world. */
export const forgePoint = (x, z) => [x + ORIGIN_X, z + ORIGIN_Z];

/* all halls together, for a quick first check */
const BOUNDS = Object.values(FORGE_ROOMS).reduce(
  ([x0, z0, x1, z1], { rect }) => [
    Math.min(x0, rect[0]),
    Math.min(z0, rect[1]),
    Math.max(x1, rect[2]),
    Math.max(z1, rect[3]),
  ],
  [Infinity, Infinity, -Infinity, -Infinity],
);

/** The key of the hall or passage at (x, z), or null outside the forge. */
export function forgeRoomAt(x, z) {
  if (x < BOUNDS[0] || x > BOUNDS[2] || z < BOUNDS[1] || z > BOUNDS[3]) {
    return null;
  }
  for (const [key, { rect }] of Object.entries(FORGE_ROOMS)) {
    if (x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3]) {
      return key;
    }
  }
  return null;
}

/** Is (x, z) in the forge? Its walls are obstacles, so no margin is needed. */
export const inForge = (x, z) => forgeRoomAt(x, z) !== null;

/** The forge's floor as whole cells: a Set of "x,z" keys of the unit squares with (x, z) as their corner. */
export function forgeFloorCells() {
  const cells = new Set();
  for (const { rect } of Object.values(FORGE_ROOMS)) {
    for (let x = rect[0]; x < rect[2]; x++) {
      for (let z = rect[1]; z < rect[3]; z++) {
        cells.add(`${x},${z}`);
      }
    }
  }
  return cells;
}

/** Where you come in through the Gate of Kharos, and the stairs against the Gate Hall's west wall that lead out. */
export const FORGE_ENTRY = forgePoint(-1.5, 41);
export const FORGE_EXIT = forgePoint(-5, 41);

/* The Lava Run: channels of lava across the hall (forge z of their middle, half their width), each surging over its
   banks for a while every few seconds, out of step with the others: [z, halfWidth, offset] */
export const LAVA_CHANNELS = [
  [25, 0.9, 0],
  [19.5, 0.9, 1.4],
  [14, 0.9, 2.8],
].map(([z, halfWidth, offset]) => ({
  z: z + ORIGIN_Z,
  x0: FORGE_ROOMS.lavaRun.rect[0],
  x1: FORGE_ROOMS.lavaRun.rect[2],
  halfWidth,
  offset,
}));
/* a surge: every this many seconds, warning for so long before it, then over the banks for so long */
export const SURGE = { every: 4.2, warning: 0.9, length: 1.3 };

/** How far into its cycle a channel is (0 at the start of its warning): a number of seconds since. */
export const surgePhase = (channel, time) => (time + channel.offset) % SURGE.every;

/** Is this channel over its banks at `time` (seconds; the same clock on every client is not needed)? */
export const isSurging = (channel, time) => {
  const phase = surgePhase(channel, time);
  return phase >= SURGE.warning && phase < SURGE.warning + SURGE.length;
};

/* the Hall of Bellows: three plates that pump the bellows, and the vents where their fire comes up */
export const BELLOWS_PLATES = [
  [20, 12],
  [28, 18],
  [20, 24],
].map(([x, z]) => forgePoint(x, z));

/* the First Forge against the hall's north wall, and its sanctum gate between the Lava Run and the Heart */
export const GREAT_FORGE = forgePoint(-25, 10.6);
export const SANCTUM_GATE = forgePoint(0, 2.5);

/* the Heart of Kharos: four pillars to hide from the Warden's fire behind, and the fire seal at the north end */
export const SANCTUM_PILLARS = [
  [-7, -7],
  [7, -7],
  [-7, -18],
  [7, -18],
].map(([x, z]) => forgePoint(x, z));
export const PILLAR_RADIUS = 1.1;
export const FIRE_SEAL = forgePoint(0, -23);

/* the monsters' own spots, in forge coordinates: SPAWNS in data.js has as many of each */
const SPOTS = {
  molten_slime: [
    [-8, 27.5],
    [8, 22],
    [-6, 16.5],
    [7, 11.5],
  ],
  forge_imp: [
    [24, 10],
    [30, 14],
    [24, 21],
    [30, 26],
  ],
  forge_golem: [
    [-30, 13],
    [-20, 18],
    [-30, 24],
  ],
  ember_warden: [[0, -12]],
};

/** The spot in the world of the forge monster with world id `<key>#<n>`, with a little play; null for others. */
export function forgeSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = forgePoint(...spots[index % spots.length]);
  return [x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5];
}
