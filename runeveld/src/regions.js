/* Eldoria – regions of the world. Its only imports are the layouts of the crypt, Greyfall Gorge and Saltmere (pure
   rules), so every file (client and server) can use this.
   The fields around the village and the forest "Whisperwood" north of it have organic edges: a radius that
   undulates with the angle (fixed phases, so the shape is the same every time). The forest overlaps the fields
   by a few units at the north gate; that is the only way in. The rectangles (FOREST, FIELD_SIZE) are the bounding
   boxes for the ground map and the world map; the real shape comes from inFields() and inForest(). */
import { inCrypt, spotFor } from "./rules/crypt.js";
import {
  GORGE,
  BRIDGE,
  NORTHWATCH,
  gorgeSouthRim,
  gorgeNorthRim,
  gorgeFloorAt,
  northSpotFor,
} from "./rules/gorge.js";

import { SALTMERE, inSaltmere, isSaltmereSafe, saltmereSpotFor } from "./rules/saltmere.js";
import { inEmberIsles, inCinderCamp, emberSpotFor } from "./rules/ember.js";
import { inForge, forgeSpotFor } from "./rules/forge.js";

export {
  inCrypt,
  GORGE,
  BRIDGE,
  NORTHWATCH,
  SALTMERE,
  inSaltmere,
  isSaltmereSafe,
  inEmberIsles,
  inCinderCamp,
  inForge,
};

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

/* The Northroad (Saga II): from Aurelia's north gate up through farmland and hills, past Fort Harrow to the
   Halfway Inn, past the ruins of Northwatch and over the Old King's Bridge across Greyfall Gorge (rules/gorge.js),
   to the gate of Saltmere (rules/saltmere.js). The land is a wavy band along the road. */
export const NORTH_ROAD = [
  [-137, -40],
  [-137, -64],
  [-131, -84],
  [-127, -100],
  [-133, -120],
  [-146, -140],
  [-153, -158],
  [-149, -178],
  [-141, -198],
  [-137, -216],
  [-133, -240],
  [BRIDGE.x, BRIDGE.south + 2],
  [BRIDGE.x, BRIDGE.north - 2],
  [-141, -300],
  [-146, -318],
  [SALTMERE.gate[0], SALTMERE.gate[1] + 1],
];

export const NORTHROAD = {
  name: "The Northroad",
  /* the bounding box, for the ground map and the world map */
  x0: -196,
  x1: -86,
  z0: -330,
  z1: -38,
  /* the toll fort across the road, and the hamlet halfway */
  fort: [-127, -100],
  inn: [-165, -158],
};

/* The barley fields of Fort Harrow, north of the fort on both sides of the road: [x0, z0, x1, z1]. */
export const NORTH_FARMS = [
  [-163, -132, -143, -112],
  [-122, -136, -108, -114],
];

/** Half the width of the Northroad's land at depth z: about thirty units, wavy. */
export function northroadWidth(z) {
  return 30 + 6 * waviness(z * 0.06, 0.8, 2.6, 1.9);
}

/** Is (x, z) on the Northroad's land, at least `margin` away from its edge? North of the city wall only. Over
    Greyfall Gorge only the bridge's deck counts, without the planks that have fallen. */
export function inNorthroad(x, z, margin = 0) {
  if (z > NORTHROAD.z1 - 2 || z < NORTHROAD.z0) {
    return false;
  }
  if (z < gorgeSouthRim(x) + margin * 0.5 && z > gorgeNorthRim(x) - margin * 0.5) {
    return gorgeFloorAt(x, z, margin);
  }
  return distanceToPath(x, z, NORTH_ROAD) < northroadWidth(z) - margin;
}

/**
 * A random spot on the Northroad's land for a monster, between depths `stretch` [north, south]: away from the
 * road, Fort Harrow and the Halfway Inn. `isOk(x, z)` adds the caller's own checks (free of obstacles, away from
 * players). Returns null when no spot was found.
 */
export function northroadSpot(random, [north, south], isOk, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const z = north + random() * (south - north);
    const x = NORTHROAD.x0 + random() * (NORTHROAD.x1 - NORTHROAD.x0);
    const isAway =
      distanceToPath(x, z, NORTH_ROAD) > 6 &&
      Math.hypot(x - NORTHROAD.fort[0], z - NORTHROAD.fort[1]) > 16 &&
      Math.hypot(x - NORTHROAD.inn[0], z - NORTHROAD.inn[1]) > 20 &&
      Math.hypot(x - NORTHWATCH.x, z - NORTHWATCH.z) > NORTHWATCH.radius + 4;
    if (inNorthroad(x, z, 4) && isAway && isOk(x, z)) {
      return [x, z];
    }
  }
  return null;
}

/** May a Northroad monster with this `stretch` [north, south] roam at (x, z)? A little beyond its stretch is fine. */
export const isNorthroadHome = ([north, south], x, z) =>
  inNorthroad(x, z, 2) && z > north - 12 && z < south + 12;

/** The fixed spot of a monster that keeps watch in one place (the crypt's, Northwatch's goblins, the bridge troll,
    Saltmere's constructs, the monsters of the Ember Isles and of the forge in their mountain), or null for one
    that roams. */
export const fixedSpot = (key, id) =>
  spotFor(key, id) ||
  northSpotFor(key, id) ||
  saltmereSpotFor(key, id) ||
  emberSpotFor(key, id) ||
  forgeSpotFor(key, id);

/** Does this monster go back to its own spot after a fight (and give up on anyone who leads it too far)? */
export const keepsHome = (spec) =>
  spec.area === "crypt" ||
  spec.area === "northwatch" ||
  spec.area === "bridge" ||
  spec.area === "saltmere" ||
  spec.area === "ember" ||
  spec.area === "forge";

/** Is (x, z) inside the world (the fields, the forest, the vale, the Northroad, Saltmere, the Ember Isles, the
    crypt or the forge), with a margin to the edge? The crypt and the forge need none: their walls are obstacles. */
export function insideWorld(x, z, margin = 1.5) {
  return (
    inFields(x, z, margin) ||
    inForest(x, z, margin) ||
    inVale(x, z, margin) ||
    inNorthroad(x, z, margin) ||
    inSaltmere(x, z, margin) ||
    inEmberIsles(x, z, margin) ||
    inCrypt(x, z) ||
    inForge(x, z)
  );
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
