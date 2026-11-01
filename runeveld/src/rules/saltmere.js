/* Eldoria – game rules: the layout of Saltmere, the great harbour at the end of the Northroad (Saga II). The city lies
   inside its wall between the gate in the south and the quay in the north; beyond the quay the sea, with three
   wooden piers and, in the east, a stone mole out to the lighthouse. Maelis has taken the old warehouses in the east
   quarter: his rune constructs keep watch there (the only unsafe part of the city), and the route he flees along
   with the stolen chart is here too. Pure data and geometry, no browser: the server runs it too. */

export const SALTMERE = {
  name: "Saltmere",
  /* inside the wall; the quay is the north edge */
  x0: -190,
  x1: -102,
  z0: -386,
  z1: -334,
  gate: [-146, -334],
  square: [-146, -368],
  /* the bounding box of the city with its piers and the mole, for the ground map and the world map */
  mapZ0: -416,
};

/* the stretch of road before the gate, between the end of the Northroad's land and the wall */
const FORECOURT = { x0: -158, x1: -134, z0: -334.5, z1: -326 };

/* the wooden piers: their middle line, half their width and how far out they reach */
export const PIERS = [
  { x: -174, halfWidth: 1.6, end: -402 },
  { x: -152, halfWidth: 1.6, end: -404 },
  { x: -127, halfWidth: 1.6, end: -402 },
];

/* the stone mole out to the lighthouse, with a round head */
export const MOLE = { x: -106, halfWidth: 2.5, end: -408, head: [-106, -413], headRadius: 5 };
export const LIGHTHOUSE = [-106, -415];
/* the sea's surface, below the quay */
export const WATER_Y = -0.9;

/* the old warehouses Maelis has taken, up to the foot of the mole: unsafe ground */
export const WAREHOUSES = { name: "The Old Warehouses", x0: -124, x1: -100, z0: -387, z1: -336 };

/* the Salty Gull: the inn where a hero who fell in or near Saltmere wakes up (in front of its door) */
export const SALTY_GULL = [-174, -352];
export const SALTY_GULL_DOOR = [-168.6, -352];

/** Is (x, z) on one of the piers or the mole (or its head), at least `margin` from the water? */
export function onPier(x, z, margin = 0) {
  for (const pier of PIERS) {
    /* reaching a little onto the quay, so the step from the quay onto the planks is open */
    if (
      Math.abs(x - pier.x) < pier.halfWidth - margin &&
      z < SALTMERE.z0 + 2 &&
      z > pier.end + margin
    ) {
      return true;
    }
  }
  if (Math.abs(x - MOLE.x) < MOLE.halfWidth - margin && z < SALTMERE.z0 + 2 && z > MOLE.end) {
    return true;
  }
  return Math.hypot(x - MOLE.head[0], z - MOLE.head[1]) < MOLE.headRadius - margin;
}

/** Is (x, z) in Saltmere (inside the wall, before the gate, or out on a pier), at least `margin` from its edge? */
export function inSaltmere(x, z, margin = 0) {
  const inCity =
    x > SALTMERE.x0 + margin &&
    x < SALTMERE.x1 - margin &&
    z > SALTMERE.z0 + margin &&
    z < SALTMERE.z1 + 2;
  const beforeGate =
    x > FORECOURT.x0 + margin && x < FORECOURT.x1 - margin && z > FORECOURT.z0 && z < FORECOURT.z1;
  /* the planks are narrow: half the margin there, as on the bridge */
  return inCity || beforeGate || onPier(x, z, margin * 0.5);
}

/** Is (x, z) in Maelis' warehouses or on the mole, where his constructs attack? */
export const inWarehouses = (x, z) =>
  (x > WAREHOUSES.x0 && x < WAREHOUSES.x1 && z > WAREHOUSES.z0 && z < WAREHOUSES.z1) ||
  (Math.abs(x - MOLE.x) < MOLE.halfWidth + 1 && z <= SALTMERE.z0) ||
  Math.hypot(x - MOLE.head[0], z - MOLE.head[1]) < MOLE.headRadius + 1;

/** Safe ground in Saltmere: all of it but the warehouses and the mole. */
export const isSaltmereSafe = (x, z) => inSaltmere(x, z, -1) && !inWarehouses(x, z);

/* The way Maelis flees with the chart: from the Salty Gull's door through the west alleys, along the quay, across
   the square, past his warehouses and out along the mole to the boat waiting at its head. */
export const CHASE_ROUTE = [
  [-168.6, -352],
  [-182, -362],
  [-184, -379],
  [-163, -381],
  [-140, -373],
  [-121, -381],
  [-106, -394],
  [-104.5, -410],
];
/* where his boat waits, and where it goes */
export const ESCAPE_BOAT = { x: -100.5, z: -411, away: [-96, -470] };

/* ---------- the constructs: each keeps watch in its own spot ---------- */
const SPOTS = {
  rune_construct: [
    /* in the lanes between the three warehouses, and at the foot of the mole */
    [-121, -341],
    [-114, -349],
    [-105, -349],
    [-121, -357],
    [-112, -364.5],
    [-104, -371],
    [-114, -379],
    [-106, -384],
  ],
};

/** The spot of the monster with this id ('rune_construct#2'), or null for one that roams. */
export function saltmereSpotFor(key, id) {
  const spots = SPOTS[key];
  if (!spots) {
    return null;
  }
  const index = Number(String(id).split("#")[1]) || 0;
  const [x, z] = spots[index % spots.length];
  return [x + (Math.random() - 0.5), z + (Math.random() - 0.5)];
}
