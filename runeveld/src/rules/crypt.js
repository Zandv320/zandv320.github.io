/* Eldoria – game rules: the Sunken Crypt under the old altar in Whisperwood. Its rooms are rectangles on a grid of
   whole units, far away from the rest of the world (nothing of the forest is in view down there); the client builds
   floor and walls from them (crypt.js), the server and the host keep the crypt's monsters inside them. The monsters
   do not roam: each has its own spot in a room (spotFor). Pure data and geometry, no browser. */

/** The crypt's (0, 0) in the world. */
export const CRYPT_ORIGIN = [0, 500];

/* rooms and passages in crypt coordinates (x to the east, z to the south), [x0, z0, x1, z1]; the entrance lies in
   the south, the sanctum in the north (the top of the screen) */
const ROOMS = {
  entry: { name: "Entrance Hall", rect: [-5, 32, 5, 42] },
  stairway: { rect: [-2, 25, 2, 32] },
  hall: { name: "Hall of Thralls", rect: [-12, 12, 12, 25] },
  eastPassage: { rect: [12, 17, 18, 20] },
  fallen: { name: "Tomb of the Fallen", rect: [18, 11, 28, 26] },
  gallery: { name: "Gallery of Traps", rect: [-34, 16, -12, 21] },
  /* behind the cracked wall in the gallery */
  crack: { rect: [-24, 21, -22, 22] },
  vault: { name: "Forgotten Vault", rect: [-27, 22, -19, 28] },
  ossuary: { name: "Ossuary", rect: [-38, 1, -26, 16] },
  ironPassage: { rect: [-26, 5, -16, 8] },
  runes: { name: "Chamber of Runes", rect: [-16, -2, -2, 10] },
  sanctumPassage: { rect: [-11, -8, -7, -2] },
  sanctum: { name: "Crimson Sanctum", rect: [-20, -28, 2, -8] },
};

const [ORIGIN_X, ORIGIN_Z] = CRYPT_ORIGIN;
const toWorld = ([x0, z0, x1, z1]) => [x0 + ORIGIN_X, z0 + ORIGIN_Z, x1 + ORIGIN_X, z1 + ORIGIN_Z];

/** The crypt's rooms and passages in world coordinates: key → {name (rooms only), rect: [x0, z0, x1, z1]}. */
export const CRYPT_ROOMS = Object.fromEntries(
  Object.entries(ROOMS).map(([key, room]) => [key, { ...room, rect: toWorld(room.rect) }]),
);

/** A point given in crypt coordinates, in the world. */
export const cryptPoint = (x, z) => [x + ORIGIN_X, z + ORIGIN_Z];

/* all rooms together, for a quick first check */
const BOUNDS = Object.values(CRYPT_ROOMS).reduce(
  ([x0, z0, x1, z1], { rect }) => [
    Math.min(x0, rect[0]),
    Math.min(z0, rect[1]),
    Math.max(x1, rect[2]),
    Math.max(z1, rect[3]),
  ],
  [Infinity, Infinity, -Infinity, -Infinity],
);

/** The key of the room or passage at (x, z), or null outside the crypt. */
export function cryptRoomAt(x, z) {
  if (x < BOUNDS[0] || x > BOUNDS[2] || z < BOUNDS[1] || z > BOUNDS[3]) {
    return null;
  }
  for (const [key, { rect }] of Object.entries(CRYPT_ROOMS)) {
    if (x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3]) {
      return key;
    }
  }
  return null;
}

/** Is (x, z) in the crypt? The walls themselves are obstacles, so no margin is needed. */
export const inCrypt = (x, z) => cryptRoomAt(x, z) !== null;

/** The crypt's floor as whole cells: a Set of "x,z" keys of the unit squares with (x, z) as their corner. */
export function cryptFloorCells() {
  const cells = new Set();
  for (const { rect } of Object.values(CRYPT_ROOMS)) {
    for (let x = rect[0]; x < rect[2]; x++) {
      for (let z = rect[1]; z < rect[3]; z++) {
        cells.add(`${x},${z}`);
      }
    }
  }
  return cells;
}

/** Where you come down the stairs, and where you go back up to the altar (in the world). */
export const CRYPT_ENTRY = cryptPoint(-1.5, 37);
export const CRYPT_EXIT = cryptPoint(-4, 37);
/** The stairs down, at the old altar in Whisperwood (six units north of ALTAR_CLEARING in regions.js). */
export const CRYPT_STAIRS = [0, -109];

/* the monsters' own spots, in crypt coordinates: SPAWNS in data.js has as many of each */
const SPOTS = {
  grave_ooze: [
    [0, 18],
    [-4, 14],
    [22, 14],
    [24, 23],
    [-32, 8.5],
    [-9, 3],
    [-9, 7],
  ],
  crypt_thrall: [
    [-8, 15],
    [8, 15],
    [-8, 22],
    [8, 22],
    [21, 18],
    [26, 18],
    [-22, 19.5],
    [-35, 12],
    [-28.5, 3.5],
  ],
  grave_witch: [
    [-33, 19.5],
    [-36, 2.5],
    [-28, 10.5],
    [23, 12.6],
  ],
  crimson_count: [[-9, -21]],
};

/** How many spots a crypt monster has (0 for the others). */
export const spotCount = (key) => (SPOTS[key] ? SPOTS[key].length : 0);

/** The spot in the world of the crypt monster with world id `<key>#<n>`, with a little play; null for others. */
export function spotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  return cryptPoint(x + (Math.random() - 0.5), z + (Math.random() - 0.5));
}
