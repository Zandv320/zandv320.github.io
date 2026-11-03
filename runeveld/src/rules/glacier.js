/* Eldoria – game rules: the Glacier Halls, inside the glacier at the north edge of the White Waste (Saga III,
   chapter 16). The Unbound dug their way to its door (rules/frostmarch.js GLACIER_DIG); behind it the old keepers of
   the frost seal cut halls out of the ice. Like the forge (rules/forge.js), its halls are rectangles on a grid of
   whole units far away from the rest of the world: the client builds them (glacier.js), the server and the host keep
   its monsters inside them, each on its own spot.

   From the Ice Gate in the south a passage runs north, shut by a door of ice that only fire opens; then the Glass
   Hall, its floor clear ice over black water, where golems of the glacier stand guard; west of it the Mirror Hall,
   three mirrors of ice on its north wall that show what the ice remembers; north of the Glass Hall a second door of ice, and behind it
   the Heart of the Glacier, where the Rime Wyrm lies coiled round the frost seal. Pure data and geometry, no browser. */

/** The halls' (0, 0) in the world. */
export const GLACIER_ORIGIN = [700, 500];

/* halls and passages in glacier coordinates (x to the east, z to the south), [x0, z0, x1, z1] */
const ROOMS = {
  entry: { name: "The Ice Gate", rect: [-7, 38, 7, 50] },
  entryPassage: { rect: [-2, 32, 2, 38] },
  glassHall: { name: "The Glass Hall", rect: [-14, 10, 14, 32] },
  westPassage: { rect: [-19, 18, -14, 22] },
  mirrorHall: { name: "The Mirror Hall", rect: [-37, 8, -19, 30] },
  heartPassage: { rect: [-3, 2, 3, 10] },
  heart: { name: "The Heart of the Glacier", rect: [-18, -28, 18, 2] },
  /* behind the seal, under the ice that the seal's waking opens (chapter 17): where Maelis waits for its heart */
  vault: { name: "The Keeper's Vault", rect: [-7, -40, 7, -28] },
};

const [ORIGIN_X, ORIGIN_Z] = GLACIER_ORIGIN;
const toWorld = ([x0, z0, x1, z1]) => [x0 + ORIGIN_X, z0 + ORIGIN_Z, x1 + ORIGIN_X, z1 + ORIGIN_Z];

/** The halls and passages in world coordinates: key → {name (halls only), rect: [x0, z0, x1, z1]}. */
export const GLACIER_ROOMS = Object.fromEntries(
  Object.entries(ROOMS).map(([key, room]) => [key, { ...room, rect: toWorld(room.rect) }]),
);

/** A point given in glacier coordinates, in the world. */
export const glacierPoint = (x, z) => [x + ORIGIN_X, z + ORIGIN_Z];

const BOUNDS = Object.values(GLACIER_ROOMS).reduce(
  ([x0, z0, x1, z1], { rect }) => [
    Math.min(x0, rect[0]),
    Math.min(z0, rect[1]),
    Math.max(x1, rect[2]),
    Math.max(z1, rect[3]),
  ],
  [Infinity, Infinity, -Infinity, -Infinity],
);

/** The key of the hall or passage at (x, z), or null outside the Glacier Halls. */
export function glacierRoomAt(x, z) {
  if (x < BOUNDS[0] || x > BOUNDS[2] || z < BOUNDS[1] || z > BOUNDS[3]) {
    return null;
  }
  for (const [key, { rect }] of Object.entries(GLACIER_ROOMS)) {
    if (x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3]) {
      return key;
    }
  }
  return null;
}

/** Is (x, z) in the Glacier Halls? Their walls are obstacles, so no margin is needed. */
export const inGlacier = (x, z) => glacierRoomAt(x, z) !== null;

/** The halls' floor as whole cells: a Set of "x,z" keys of the unit squares with (x, z) as their corner. */
export function glacierFloorCells() {
  const cells = new Set();
  for (const { rect } of Object.values(GLACIER_ROOMS)) {
    for (let x = rect[0]; x < rect[2]; x++) {
      for (let z = rect[1]; z < rect[3]; z++) {
        cells.add(`${x},${z}`);
      }
    }
  }
  return cells;
}

/** Where you come in through the dig in the glacier, and the steps of ice against the Ice Gate's west wall that
    lead out. */
export const GLACIER_ENTRY = glacierPoint(-1.5, 45);
export const GLACIER_EXIT = glacierPoint(-5.5, 45);

/* the doors of ice that only fire opens: across the passage north of the Ice Gate, and across the passage to the
   Heart; each with the quest that opens it for good once it is done */
export const FROZEN_DOORS = [
  { id: "gate", x: 0, z: 35, width: 4, quest: "ulf_doors" },
  { id: "heart", x: 0, z: 6, width: 6, quest: "ulf_wyrm" },
].map((door) => {
  const [x, z] = glacierPoint(door.x, door.z);
  return { ...door, x, z };
});

/* the Glass Hall's pillars of ice, and the Heart's, to step behind when the Wyrm breathes */
export const ICE_PILLARS = [
  [-7, 16],
  [7, 16],
  [-7, 26],
  [7, 26],
  [-9, -7],
  [9, -7],
  [-9, -19],
  [9, -19],
].map(([x, z]) => glacierPoint(x, z));
export const ICE_PILLAR_RADIUS = 1.1;

/* the three mirrors of ice along the Mirror Hall's north wall, west to east: the order the ice tells its story in */
export const MIRRORS = [
  [-33, 8.3],
  [-28, 8.3],
  [-23, 8.3],
].map(([x, z]) => glacierPoint(x, z));

/* the frost seal at the north end of the Heart, and where the Wyrm lies coiled before it */
export const FROST_SEAL = glacierPoint(0, -24);
export const WYRM_HOME = glacierPoint(0, -13);
/* the wall of ice between the Heart and the Keeper's Vault: it opens for each hero once they have woken the seal */
export const VAULT_WALL = (() => {
  const [x, z] = glacierPoint(0, -28.3);
  return { x, z, width: 14, quest: "ulf_seal" };
})();
/* where Maelis waits in the vault */
export const MAELIS_HOME = glacierPoint(0, -35);

/** Is (x, z) in the Keeper's Vault? */
export const inVault = (x, z) => glacierRoomAt(x, z) === "vault";

/* the monsters' own spots, in glacier coordinates: SPAWNS in data.js has as many of each */
const SPOTS = {
  glacier_golem: [
    [-9, 29],
    [9, 29],
    [-9, 12],
    [9, 12],
  ],
  rime_ooze: [
    [0, 21],
    [-11, 21],
    [-26, 12],
    [-26, 26],
    [11, 21],
  ],
  rime_wyrm: [[0, -13]],
  maelis: [[0, -35]],
};

/** The spot in the world of the glacier monster with world id `<key>#<n>`, with a little play; null for others. */
export function glacierSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = glacierPoint(...spots[index % spots.length]);
  const jitter = key === "rime_wyrm" || key === "maelis" ? 0 : 0.5;
  return [x + (Math.random() - 0.5) * jitter, z + (Math.random() - 0.5) * jitter];
}

/** Where the Rime Wyrm can break out of the ice near a hero at (x, z): a spot in the Heart a few steps from them,
    clear of the pillars and the seal. Null when the hero is not in the Heart. */
export function wyrmSpotNear(x, z) {
  if (glacierRoomAt(x, z) !== "heart") {
    return null;
  }
  const [x0, z0, x1, z1] = GLACIER_ROOMS.heart.rect;
  for (let k = 0; k < 16; k++) {
    const angle = (k / 16) * Math.PI * 2 + Math.random() * 0.4;
    const sx = x + Math.sin(angle) * 4.5;
    const sz = z + Math.cos(angle) * 4.5;
    const isClear =
      sx > x0 + 3 &&
      sx < x1 - 3 &&
      sz > z0 + 3 &&
      sz < z1 - 3 &&
      ICE_PILLARS.every(([px, pz]) => Math.hypot(sx - px, sz - pz) > ICE_PILLAR_RADIUS + 2.5) &&
      Math.hypot(sx - FROST_SEAL[0], sz - FROST_SEAL[1]) > 4;
    if (isClear) {
      return [+sx.toFixed(2), +sz.toFixed(2)];
    }
  }
  return [+WYRM_HOME[0].toFixed(2), +WYRM_HOME[1].toFixed(2)];
}
