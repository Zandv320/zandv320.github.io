/* Eldoria – regions of the world. No imports, so every file (client and server) can use this.
   The fields around the village and the forest "Whisperwood" north of it have organic edges: a radius that
   undulates with the angle (fixed phases, so the shape is the same every time). The forest overlaps the fields
   by a few units at the north gate; that is the only way in. The rectangles (FOREST, FIELD_SIZE) are the bounding
   boxes for the ground map and the world map; the real shape comes from inFields() and inForest(). */

/* Half width of the ground map around the village. */
export const FIELD_SIZE = 60;

export const FOREST = {
  x0: -44,
  x1: 44,
  z0: -126,
  z1: -56,
  name: "Whisperwood",
  cx: 0,
  cz: -88,
  rx: 34,
  rz: 27,
};

/* Undulation with the angle: the sum of three sines with fixed phases. */
function waviness(angle, phaseA, phaseB, phaseC) {
  return (
    0.5 * Math.sin(3 * angle + phaseA) +
    0.3 * Math.sin(5 * angle + phaseB) +
    0.2 * Math.sin(8 * angle + phaseC)
  );
}

/* A bump around `centerAngle` (1 there, 0 on the opposite side), used to pull the edge to a fixed size at an
   entrance. */
function bump(angle, centerAngle) {
  return Math.pow((1 + Math.cos(angle - centerAngle)) / 2, 3);
}

/* The fields: radius from the village centre, 55 on average (undulating 49–61), and exactly 62 due north (at the
   road). The bump cancels the waviness at the north so the radius there is fixed. */
const northFieldWaviness = waviness(Math.PI, 1.3, 2.9, 0.4);

/** Radius of the fields' edge at the given angle (atan2(x, z)). */
export function fieldEdge(angle) {
  return (
    55 + 6 * waviness(angle, 1.3, 2.9, 0.4) + (7 - 6 * northFieldWaviness) * bump(angle, Math.PI)
  );
}

/** Is (x, z) inside the fields, at least `margin` away from the edge? */
export function inFields(x, z, margin = 0) {
  return Math.hypot(x, z) < fieldEdge(Math.atan2(x, z)) - margin;
}

/* The forest: an undulating ellipse around (0, -88); due south (at the entrance) it reaches to z ≈ -58.8. */
const southForestWaviness = waviness(Math.PI, 0.7, 2.1, 3.3);

/** Relative radius (1 = the ellipse) of the forest's edge at the given angle. */
export function forestEdge(angle) {
  return (
    1 +
    0.14 * waviness(angle, 0.7, 2.1, 3.3) +
    (0.08 - 0.14 * southForestWaviness) * bump(angle, Math.PI)
  );
}

/** Is (x, z) inside the forest, at least `margin` away from the edge? */
export function inForest(x, z, margin = 0) {
  const dx = x / FOREST.rx;
  const dz = (z - FOREST.cz) / FOREST.rz;
  return Math.hypot(dx, dz) < forestEdge(Math.atan2(dx, dz)) - margin / FOREST.rz;
}

/* Kingsvale: the meadow plain west of the fields, with the capital Aurelia and the castle. An undulating ellipse
   around (-130, 0) that overlaps the fields a fair bit on the west side; there the Kingsroad runs from the
   village's west gate to the city's east gate. */
export const VALE = {
  name: "Kingsvale",
  cx: -130,
  cz: 0,
  rx: 80,
  rz: 60,
  x0: -218,
  x1: -44,
  z0: -66,
  z1: 66,
};

const eastValeWaviness = waviness(Math.PI / 2, 2.2, 0.9, 4.1);

/** Relative radius (1 = the ellipse) of the vale's edge at the given angle. */
export function valeEdge(angle) {
  return (
    1 +
    0.11 * waviness(angle, 2.2, 0.9, 4.1) +
    (0.07 - 0.11 * eastValeWaviness) * bump(angle, Math.PI / 2)
  );
}

/** Is (x, z) inside Kingsvale, at least `margin` away from the edge? */
export function inVale(x, z, margin = 0) {
  const dx = (x - VALE.cx) / VALE.rx;
  const dz = (z - VALE.cz) / VALE.rz;
  return Math.hypot(dx, dz) < valeEdge(Math.atan2(dx, dz)) - margin / VALE.rz;
}

/* The city of Aurelia: the walled rectangle, with the castle on its west side. */
export const CAPITAL = { name: "Aurelia", x0: -176, x1: -98, z0: -40, z1: 40, cx: -137, cz: 0 };

/** Is (x, z) inside the city walls, at least `margin` away from them? */
export function inCapital(x, z, margin = 0) {
  return (
    x > CAPITAL.x0 + margin &&
    x < CAPITAL.x1 - margin &&
    z > CAPITAL.z0 + margin &&
    z < CAPITAL.z1 - margin
  );
}

export const CASTLE = { x0: -174, x1: -146, z0: -17, z1: 17, cx: -161, cz: 0 };

export function inCastle(x, z) {
  return x > CASTLE.x0 && x < CASTLE.x1 && z > CASTLE.z0 && z < CASTLE.z1;
}

/* The Kingsroad: from the west gate of Runeveld straight to the east gate of Aurelia. */
export const KINGS_ROAD = [
  [-22, 0],
  [-98, 0],
];

/* The bandit camp: in the meadows north-east of the city, between the north gate and the farm. */
export const BANDIT_CAMP = [-82, -44];

/** Is (x, z) inside the world (the fields, the forest or the vale), with a margin to the edge? */
export function insideWorld(x, z, margin = 1.5) {
  return inFields(x, z, margin) || inForest(x, z, margin) || inVale(x, z, margin);
}

/* The winding path through the forest, from the entrance to the clearing. */
export const FOREST_PATH = [
  [0, -59],
  [0, -70],
  [-9, -80],
  [-10, -90],
  [-3, -98],
  [0, -101],
];

/* Centre of the clearing with the altar. */
export const ALTAR_CLEARING = [0, -103];

/** Shortest distance from (x, z) to a polyline path. */
export function distanceToPath(x, z, path = FOREST_PATH) {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    /* project the point onto the segment, clamped to its ends */
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}
