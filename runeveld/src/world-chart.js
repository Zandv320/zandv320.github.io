/* Eldoria – the whole world painted as a map (world-map.js puts it on screen): the ocean with its depths and its
   waves, the mainland's coast and the wild lands behind it, and out on the Grey Sea its rocks, the islets and the
   Ember Isles with their beaches, lava and mountain; names in the old style, a compass rose and a scale bar. The
   playable lands themselves (fields, forest, vale, the Northroad, Saltmere) come from the map's own detailed land
   layer, drawn over this. Everything here is drawn for one view at a time: (x, z) in the world to canvas pixels by
   `scale` from the corner (worldX0, worldZ0). */
import { SALTMERE } from "./rules/saltmere.js";
import { GREY_SEA, ROCKS, ISLETS, EMBER_ISLES, isletReach } from "./rules/sea.js";
import {
  EMBER_REACH,
  MOUNT_KHAROS,
  CINDER_CAMP,
  COVE_JETTY,
  LAVA_FLOWS,
  LAVA_POOLS,
  LAVA_WIDTH,
  emberShore,
  kharosRadius,
  inCamp,
  EMBER_LANDS,
  EMBER_ROADS,
} from "./rules/ember.js";
import { VALE, FOREST, CAPITAL, NORTHROAD } from "./regions.js";

/* The bounds of the world map: from the mainland's southern fields to beyond the Ember Isles. */
export const WORLD = {
  x0: GREY_SEA.x0 - 40,
  x1: GREY_SEA.x1 + 40,
  z0: Math.floor(EMBER_ISLES.z - EMBER_REACH - 25),
  z1: 110,
};

/* the lands a click zooms into from the whole world: the start lands and the Ember Isles */
export const ZOOM_REGIONS = [
  { name: "The mainland", x0: VALE.x0 - 10, x1: 75, z0: SALTMERE.z0 - 40, z1: 75 },
  {
    name: EMBER_ISLES.name,
    x0: EMBER_ISLES.x - EMBER_REACH - 8,
    x1: EMBER_ISLES.x + EMBER_REACH + 8,
    z0: EMBER_ISLES.z - EMBER_REACH - 8,
    z1: EMBER_ISLES.z + EMBER_REACH + 8,
  },
];

const PALETTE = {
  deep: "#1d3a52",
  ocean: "#2c5677",
  shallow: "rgba(110, 170, 200, 0.35)",
  shoal: "rgba(150, 205, 225, 0.45)",
  wave: "rgba(200, 228, 240, 0.32)",
  grid: "rgba(220, 235, 245, 0.06)",
  sand: "#c8ad7a",
  sandDark: "#a68c5e",
  wild: "#6a9450",
  tree: "#2e4f2a",
  treeLight: "#5d8a48",
  hill: "rgba(60, 50, 30, 0.35)",
  grass: "#6a9a4a",
  ash: "#5a5452",
  ashDark: "#45403f",
  basalt: "#2e2a2b",
  lava: "#e8541e",
  lavaCore: "#ffc24a",
  ink: "rgba(16, 20, 28, 0.8)",
  gold: "rgba(255, 226, 160, 0.95)",
};

/* a fixed pseudo-random number per spot, so the map looks the same every time */
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** The mainland's coast on the map: Saltmere's straight quay, and wavy beaches to either side of it. */
export function mainlandCoast(x) {
  const cityX = (SALTMERE.x0 + SALTMERE.x1) / 2;
  const blend = Math.min(1, Math.max(0, Math.abs(x - cityX) - 80) / 50);
  const wave =
    7 * Math.sin(x * 0.031 + 1.3) + 4 * Math.sin(x * 0.083 + 0.4) + 2 * Math.sin(x * 0.19);
  return SALTMERE.z0 + blend * (15 + wave);
}

/* Traces a coast round (cx, cz) that reaches `reach(angle)` (plus `grow`) as a closed path. */
function traceCoast(g, px, pz, cx, cz, reach, grow = 0) {
  g.beginPath();
  for (let k = 0; k <= 120; k++) {
    const angle = (k / 120) * Math.PI * 2;
    const r = reach(angle) + grow;
    const x = px(cx + Math.sin(angle) * r);
    const z = pz(cz + Math.cos(angle) * r);
    if (k === 0) {
      g.moveTo(x, z);
    } else {
      g.lineTo(x, z);
    }
  }
  g.closePath();
}

/**
 * Paints the world for this view: the ocean, the mainland, the islands. `scale` canvas pixels per unit, the view's
 * top-left corner at (worldX0, worldZ0), `ratio` the device pixel ratio (for line widths and lettering).
 */
export function drawWorldBase(g, scale, worldX0, worldZ0, ratio) {
  const px = (x) => (x - worldX0) * scale;
  const pz = (z) => (z - worldZ0) * scale;
  const { width, height } = g.canvas;
  const viewX1 = worldX0 + width / scale;
  const viewZ1 = worldZ0 + height / scale;
  const view = { px, pz, scale, ratio, worldX0, worldZ0, viewX1, viewZ1 };
  drawOcean(g, view);
  drawMainland(g, view);
  for (const [x, z, radius] of ROCKS) {
    drawRock(g, view, x, z, radius);
  }
  for (const islet of ISLETS) {
    drawIslet(g, view, islet);
  }
  drawEmberIsles(g, view);
}

/* ---------- the ocean: deeper further out, a faint grid, waves drawn in the old way ---------- */

function drawOcean(g, { px, pz, scale, ratio, worldX0, worldZ0, viewX1, viewZ1 }) {
  const { width, height } = g.canvas;
  const water = g.createLinearGradient(0, pz(WORLD.z0), 0, pz(SALTMERE.z0));
  water.addColorStop(0, PALETTE.deep);
  water.addColorStop(1, PALETTE.ocean);
  g.fillStyle = water;
  g.fillRect(0, 0, width, height);
  /* a grid of a hundred units, like the lines on a sailor's chart */
  g.strokeStyle = PALETTE.grid;
  g.lineWidth = ratio;
  for (let x = Math.ceil(worldX0 / 100) * 100; x < viewX1; x += 100) {
    g.beginPath();
    g.moveTo(px(x), 0);
    g.lineTo(px(x), height);
    g.stroke();
  }
  for (let z = Math.ceil(worldZ0 / 100) * 100; z < viewZ1; z += 100) {
    g.beginPath();
    g.moveTo(0, pz(z));
    g.lineTo(width, pz(z));
    g.stroke();
  }
  /* the waves: little double arcs, spaced so they stay a few pixels apart at any zoom; none near land */
  const spacing = Math.max(16, (26 * ratio) / scale);
  const size = Math.min(9 * ratio, Math.max(3 * ratio, scale * 2.4));
  g.strokeStyle = PALETTE.wave;
  g.lineWidth = Math.max(1, ratio);
  for (let z = Math.floor(worldZ0 / spacing) * spacing; z < viewZ1; z += spacing) {
    for (let x = Math.floor(worldX0 / spacing) * spacing; x < viewX1; x += spacing) {
      const wx = x + (hash(x, z) - 0.5) * spacing * 0.8;
      const wz = z + (hash(z, x) - 0.5) * spacing * 0.8;
      if (hash(wx, wz) < 0.45 || isNearLand(wx, wz, 10)) {
        continue;
      }
      const sx = px(wx);
      const sz = pz(wz);
      g.beginPath();
      g.arc(sx - size * 0.5, sz, size * 0.5, Math.PI * 1.1, Math.PI * 1.9);
      g.arc(sx + size * 0.5, sz, size * 0.5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  }
}

/* is (x, z) within `margin` of any land on the map? */
function isNearLand(x, z, margin) {
  if (z > mainlandCoast(x) - margin) {
    return true;
  }
  for (const [rx, rz, radius] of ROCKS) {
    if (Math.hypot(x - rx, z - rz) < radius + margin) {
      return true;
    }
  }
  for (const islet of ISLETS) {
    if (Math.hypot(x - islet.x, z - islet.z) < islet.radius * 1.5 + margin) {
      return true;
    }
  }
  return Math.hypot(x - EMBER_ISLES.x, z - EMBER_ISLES.z) < EMBER_REACH + margin;
}

/* ---------- the mainland: the coast with its beach, and the wild lands behind it ---------- */

function drawMainland(g, { px, pz, scale, ratio, worldX0, viewX1, viewZ1 }) {
  const { height } = g.canvas;
  const from = Math.floor(worldX0 / 4) * 4 - 4;
  const to = viewX1 + 4;
  const coastPath = (grow) => {
    g.beginPath();
    g.moveTo(px(from), height + 10);
    for (let x = from; x <= to; x += 4) {
      g.lineTo(px(x), pz(mainlandCoast(x) - grow));
    }
    g.lineTo(px(to), height + 10);
    g.closePath();
  };
  /* the shallows off the coast, the beach, the land */
  g.fillStyle = PALETTE.shallow;
  coastPath(9);
  g.fill();
  g.fillStyle = PALETTE.shoal;
  coastPath(4);
  g.fill();
  g.fillStyle = PALETTE.sand;
  coastPath(1.6);
  g.fill();
  g.fillStyle = PALETTE.wild;
  coastPath(0);
  g.fill();
  /* the wild lands: woods, meadows and hills in soft relief (painted once), and close in their trees and hills */
  const terrain = wildLands();
  g.save();
  coastPath(0);
  g.clip();
  g.imageSmoothingEnabled = true;
  g.drawImage(
    terrain.canvas,
    px(terrain.x0),
    pz(terrain.z0),
    terrain.canvas.width * scale * terrain.unitsPerPixel,
    terrain.canvas.height * scale * terrain.unitsPerPixel,
  );
  if (scale >= 1.4 * ratio) {
    const cell = 6;
    for (let z = Math.floor(SALTMERE.z0 / cell) * cell; z < viewZ1; z += cell) {
      for (let x = Math.floor(from / cell) * cell; x < to; x += cell) {
        const cx = x + cell / 2 + (hash(x, z) - 0.5) * cell * 0.7;
        const cz = z + cell / 2 + (hash(z, x) - 0.5) * cell * 0.7;
        const { wood, height: rise } = wildAt(cx, cz);
        if (wood > 0.56) {
          /* a clump of trees, more of them deeper in the wood */
          const count = wood > 0.66 ? 3 : 1;
          for (let k = 0; k < count; k++) {
            const tx = px(cx + (hash(k, cx) - 0.5) * 4);
            const tz = pz(cz + (hash(cz, k) - 0.5) * 4);
            g.fillStyle = "rgba(20, 34, 16, 0.35)";
            g.beginPath();
            g.ellipse(
              tx + scale * 0.5,
              tz + scale * 0.9,
              scale * 1.3,
              scale * 0.6,
              0,
              0,
              Math.PI * 2,
            );
            g.fill();
            g.fillStyle = PALETTE.tree;
            g.beginPath();
            g.arc(tx, tz, scale * 1.3, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = PALETTE.treeLight;
            g.beginPath();
            g.arc(tx - scale * 0.4, tz - scale * 0.4, scale * 0.6, 0, Math.PI * 2);
            g.fill();
          }
        } else if (rise > 0.62 && hash(cx, cz) < 0.55) {
          /* a hill, lit from the north-west */
          g.strokeStyle = "rgba(255, 246, 210, 0.35)";
          g.lineWidth = Math.max(1, scale * 0.45);
          g.beginPath();
          g.arc(px(cx), pz(cz) + scale * 2, scale * 3, Math.PI * 1.15, Math.PI * 1.5);
          g.stroke();
          g.strokeStyle = PALETTE.hill;
          g.beginPath();
          g.arc(px(cx), pz(cz) + scale * 2, scale * 3, Math.PI * 1.5, Math.PI * 1.85);
          g.stroke();
        }
      }
    }
  }
  g.restore();
  /* the coastline in ink */
  g.strokeStyle = "rgba(60, 46, 26, 0.6)";
  g.lineWidth = Math.max(1, ratio);
  g.beginPath();
  for (let x = from; x <= to; x += 4) {
    if (x === from) {
      g.moveTo(px(x), pz(mainlandCoast(x)));
    } else {
      g.lineTo(px(x), pz(mainlandCoast(x)));
    }
  }
  g.stroke();
}

/* the wild lands at (x, z): how high (0..1) and how wooded (0..1), from a few layers of smooth noise */
function smooth(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function wildAt(x, z) {
  const height =
    smooth(x * 0.012 + 3.1, z * 0.012) * 0.55 +
    smooth(x * 0.03, z * 0.03 + 7.7) * 0.3 +
    smooth(x * 0.08 + 1.9, z * 0.08) * 0.15;
  const wood =
    smooth(x * 0.02 + 11.3, z * 0.02 + 5.2) * 0.7 + smooth(x * 0.07, z * 0.07 + 2.6) * 0.3;
  return { height, wood };
}

/* The wild lands painted once, one pixel a unit: meadow, wood and heath by how high and wooded the land is,
   shaded by the light from the north-west so the hills stand out. */
let wildCanvas = null;
function wildLands() {
  if (wildCanvas) {
    return wildCanvas;
  }
  /* wider than the world: on a wide screen the map shows land to either side of it */
  const x0 = WORLD.x0 - 1300;
  const z0 = SALTMERE.z0 - 30;
  const width = WORLD.x1 - WORLD.x0 + 2600;
  const height = WORLD.z1 - z0;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(width, height);
  const meadow = [116, 156, 80];
  const wood = [62, 102, 54];
  const heath = [150, 146, 92];
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = x0 + i + 0.5;
      const z = z0 + j + 0.5;
      const here = wildAt(x, z);
      /* the slope towards the light, from the height a step to the north-west */
      const uphill = wildAt(x - 1.5, z - 1.5).height;
      const light = Math.max(0.72, Math.min(1.25, 1 + (here.height - uphill) * 9));
      let color = mix(meadow, heath, Math.max(0, Math.min(1, (here.height - 0.5) * 4)));
      color = mix(color, wood, Math.max(0, Math.min(1, (here.wood - 0.5) * 5)));
      const k = (j * width + i) * 4;
      image.data[k] = color[0] * light;
      image.data[k + 1] = color[1] * light;
      image.data[k + 2] = color[2] * light;
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  wildCanvas = { canvas, x0, z0, unitsPerPixel: 1 };
  return wildCanvas;
}

/* ---------- the islands ---------- */

function drawRock(g, { px, pz, scale, ratio }, x, z, radius) {
  const dot = (r, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(px(x), pz(z), Math.max(r * scale, 1.5 * ratio), 0, Math.PI * 2);
    g.fill();
  };
  dot(radius * 2.2, PALETTE.shallow);
  dot(radius * 1.4, PALETTE.shoal);
  dot(radius, "#5f5a5c");
  dot(radius * 0.5, "#7a7476");
}

function drawIslet(g, { px, pz, scale, ratio }, islet) {
  const reach = (angle) => isletReach(islet, angle);
  const fill = (grow, color, factor = 1) => {
    g.fillStyle = color;
    traceCoast(g, px, pz, islet.x, islet.z, (angle) => reach(angle) * factor, grow);
    g.fill();
  };
  fill(8, PALETTE.shallow);
  fill(3.5, PALETTE.shoal);
  fill(1.2, PALETTE.sand);
  fill(0, PALETTE.grass, 0.85);
  /* its trees */
  if (scale >= 1.2 * ratio) {
    for (let k = 0; k < Math.round(islet.radius / 2); k++) {
      const angle = hash(k, islet.x) * Math.PI * 2;
      const distance = hash(islet.z, k) * reach(angle) * 0.6;
      g.fillStyle = PALETTE.tree;
      g.beginPath();
      g.arc(
        px(islet.x + Math.sin(angle) * distance),
        pz(islet.z + Math.cos(angle) * distance),
        Math.max(1.2 * ratio, scale * 1.2),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }
}

function drawEmberIsles(g, view) {
  const { px, pz, scale, ratio } = view;
  const coast = (grow, color) => {
    g.fillStyle = color;
    traceCoast(g, px, pz, EMBER_ISLES.x, EMBER_ISLES.z, emberShore, grow);
    g.fill();
  };
  coast(12, PALETTE.shallow);
  coast(5, PALETTE.shoal);
  coast(2.2, PALETTE.sandDark);
  coast(0, PALETTE.ash);
  /* close in: specks of ash, rocks and dead trees strewn over the land */
  if (scale >= 1.4 * ratio) {
    g.save();
    traceCoast(g, px, pz, EMBER_ISLES.x, EMBER_ISLES.z, emberShore, -2);
    g.clip();
    for (let k = 0; k < 900; k++) {
      const angle = hash(k, 1.7) * Math.PI * 2;
      const distance = Math.sqrt(hash(k, 4.1)) * EMBER_REACH;
      const x = EMBER_ISLES.x + Math.sin(angle) * distance;
      const z = EMBER_ISLES.z + Math.cos(angle) * distance;
      const kind = hash(k, 9.3);
      if (kind < 0.7) {
        g.fillStyle = kind < 0.35 ? PALETTE.ashDark : "#6a6462";
        g.fillRect(px(x), pz(z), Math.max(1, scale * 0.5), Math.max(1, scale * 0.5));
      } else if (kind < 0.85) {
        g.fillStyle = "#2e2a2b";
        g.beginPath();
        g.arc(px(x), pz(z), Math.max(1.2 * ratio, scale * 0.6), 0, Math.PI * 2);
        g.fill();
      } else {
        /* a dead tree: a trunk and two bare branches */
        const size = Math.max(3 * ratio, scale * 1.4);
        g.strokeStyle = "#241c18";
        g.lineWidth = Math.max(1, ratio);
        g.beginPath();
        g.moveTo(px(x), pz(z));
        g.lineTo(px(x), pz(z) - size);
        g.moveTo(px(x), pz(z) - size * 0.55);
        g.lineTo(px(x) - size * 0.45, pz(z) - size);
        g.moveTo(px(x), pz(z) - size * 0.7);
        g.lineTo(px(x) + size * 0.4, pz(z) - size * 1.05);
        g.stroke();
      }
    }
    g.restore();
  }
  /* the mountain: its foot, then rings of the slope ever lighter with ash, the crater glowing */
  const slope = (t, color) => {
    g.fillStyle = color;
    traceCoast(g, px, pz, MOUNT_KHAROS.x, MOUNT_KHAROS.z, (angle) => kharosRadius(angle, t));
    g.fill();
  };
  slope(0, PALETTE.basalt);
  slope(0.3, "#3a3436");
  slope(0.55, "#4a4244");
  slope(0.8, "#6a6260");
  slope(0.97, "#5a2a1e");
  g.fillStyle = PALETTE.lava;
  g.beginPath();
  g.arc(
    px(MOUNT_KHAROS.x),
    pz(MOUNT_KHAROS.z),
    Math.max(2 * ratio, MOUNT_KHAROS.craterRadius * 0.6 * scale),
    0,
    Math.PI * 2,
  );
  g.fill();
  /* ridges down the slopes */
  g.strokeStyle = "rgba(20, 16, 18, 0.45)";
  g.lineWidth = Math.max(1, ratio * 0.8);
  for (let k = 0; k < 18; k++) {
    const angle = (k / 18) * Math.PI * 2 + hash(k, 2) * 0.2;
    g.beginPath();
    for (const t of [0.95, 0.6, 0.3, 0.02]) {
      const r = kharosRadius(angle + (t - 0.5) * 0.1, t);
      const x = px(MOUNT_KHAROS.x + Math.sin(angle) * r);
      const z = pz(MOUNT_KHAROS.z + Math.cos(angle) * r);
      if (t === 0.95) {
        g.moveTo(x, z);
      } else {
        g.lineTo(x, z);
      }
    }
    g.stroke();
  }
  /* the lava: down from the crater, across the land to the sea, and its pools */
  g.save();
  traceCoast(g, px, pz, EMBER_ISLES.x, EMBER_ISLES.z, emberShore, 0.5);
  g.clip();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const [width, color] of [
    [LAVA_WIDTH * 2, PALETTE.lava],
    [LAVA_WIDTH * 0.8, PALETTE.lavaCore],
  ]) {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1.2 * ratio, width * scale);
    for (const flow of LAVA_FLOWS) {
      const [startX, startZ] = flow[0];
      const bearing = Math.atan2(startX - MOUNT_KHAROS.x, startZ - MOUNT_KHAROS.z);
      g.beginPath();
      g.moveTo(
        px(MOUNT_KHAROS.x + Math.sin(bearing) * MOUNT_KHAROS.craterRadius),
        pz(MOUNT_KHAROS.z + Math.cos(bearing) * MOUNT_KHAROS.craterRadius),
      );
      for (const [x, z] of flow) {
        g.lineTo(px(x), pz(z));
      }
      g.stroke();
    }
    g.fillStyle = color;
    for (const pool of LAVA_POOLS) {
      g.beginPath();
      g.arc(
        px(pool.x),
        pz(pool.z),
        Math.max(1.5 * ratio, (pool.r - (color === PALETTE.lava ? 0 : 1)) * scale),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }
  g.restore();
  /* the roads, trodden ash between the lands */
  g.save();
  g.setLineDash([3 * ratio, 2.5 * ratio]);
  g.strokeStyle = "rgba(214, 190, 140, 0.85)";
  g.lineWidth = Math.max(1.2 * ratio, scale * 1.4);
  g.lineCap = "round";
  for (const road of EMBER_ROADS) {
    g.beginPath();
    road.forEach(([x, z], k) => (k ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))));
    g.stroke();
  }
  g.restore();
  /* the gate in the mountain's north foot */
  const [gateX, gateZ] = EMBER_LANDS.gate.center;
  g.fillStyle = "#1c1718";
  g.fillRect(
    px(gateX) - Math.max(3 * ratio, scale * 4),
    pz(gateZ) - Math.max(2 * ratio, scale * 2.5),
    Math.max(6 * ratio, scale * 8),
    Math.max(4 * ratio, scale * 5),
  );
  g.fillStyle = PALETTE.lava;
  g.fillRect(
    px(gateX) - Math.max(1 * ratio, scale * 1.2),
    pz(gateZ) - Math.max(1.5 * ratio, scale * 2),
    Math.max(2 * ratio, scale * 2.4),
    Math.max(3 * ratio, scale * 4),
  );
  /* the camp: the jetty, two tents and the fire */
  g.fillStyle = "#8a6a42";
  g.fillRect(
    px(COVE_JETTY.x - COVE_JETTY.halfWidth),
    pz(COVE_JETTY.north),
    Math.max(2 * ratio, COVE_JETTY.halfWidth * 2 * scale),
    (COVE_JETTY.south - COVE_JETTY.north) * scale,
  );
  const tent = (x, z, color) => {
    const size = Math.max(3 * ratio, scale * 1.8);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(px(x), pz(z) - size);
    g.lineTo(px(x) + size, pz(z) + size * 0.6);
    g.lineTo(px(x) - size, pz(z) + size * 0.6);
    g.closePath();
    g.fill();
  };
  tent(...inCamp(-5.5, -4.5), "#c9473d");
  tent(...inCamp(8.5, -4), "#6f8f4a");
  g.fillStyle = "#ffb04a";
  g.beginPath();
  const [fireX, fireZ] = inCamp(2, 2);
  g.arc(px(fireX), pz(fireZ), Math.max(1.5 * ratio, scale * 0.9), 0, Math.PI * 2);
  g.fill();
}

/* ---------- names, compass and scale ---------- */

/* the names on the map: where, how big in world units, and whether it is the name of a whole region (in italics) */
const NAMES = [
  { text: "Runeveld", x: 0, z: 30, size: 7, major: true },
  { text: FOREST.name, x: FOREST.cx, z: FOREST.cz, size: 6 },
  { text: VALE.name, x: -95, z: 50, size: 7, region: true },
  { text: CAPITAL.name, x: CAPITAL.cx, z: CAPITAL.z0 - 6, size: 7, major: true },
  { text: NORTHROAD.name, x: -100, z: -180, size: 7, region: true },
  { text: SALTMERE.name, x: SALTMERE.gate[0], z: SALTMERE.z1 + 8, size: 7, major: true },
  { text: GREY_SEA.name, x: -150, z: -600, size: 18, region: true },
  ...ISLETS.map((islet) => ({
    text: islet.name,
    x: islet.x,
    z: islet.z + islet.radius * 1.6 + 6,
    size: 5,
  })),
  {
    text: EMBER_ISLES.name,
    x: EMBER_ISLES.x,
    z: EMBER_ISLES.z + EMBER_REACH + 12,
    size: 10,
    region: true,
  },
  { text: MOUNT_KHAROS.name, x: MOUNT_KHAROS.x, z: MOUNT_KHAROS.z - 10, size: 5 },
  { text: CINDER_CAMP.name, x: CINDER_CAMP.x + 22, z: CINDER_CAMP.z + 6, size: 5 },
  ...Object.values(EMBER_LANDS).map((land) => ({
    text: land.name,
    x: land.center[0],
    z: land.center[1] + (land === EMBER_LANDS.gate ? -10 : 0),
    size: 6,
  })),
  { text: "Uncharted waters", x: WORLD.x0 + 110, z: WORLD.z0 + 40, size: 9, region: true },
];

/** The names on the map, over everything else: sized with the map, never too small to read or too big. */
export function drawNames(g, scale, worldX0, worldZ0, ratio) {
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const name of NAMES) {
    /* far out only the regions and the great places; the rest once there is room for them */
    if (!name.region && !name.major && name.size * scale < 6 * ratio) {
      continue;
    }
    const size = name.region
      ? Math.max(18 * ratio, Math.min(44 * ratio, name.size * scale))
      : Math.max(13 * ratio, Math.min(24 * ratio, name.size * scale));
    g.font = name.region
      ? `italic 700 ${size}px Cinzel, Georgia, serif`
      : `700 ${size}px Cinzel, Georgia, serif`;
    const x = (name.x - worldX0) * scale;
    const z = (name.z - worldZ0) * scale;
    g.lineWidth = Math.max(2 * ratio, size * 0.2);
    g.strokeStyle = PALETTE.ink;
    g.strokeText(name.text, x, z);
    g.fillStyle = name.region ? "rgba(236, 242, 246, 0.8)" : "rgba(255, 244, 214, 0.97)";
    g.fillText(name.text, x, z);
  }
  g.restore();
}

/** The compass rose (bottom left), the scale bar (bottom right) and a gilt frame round the map. */
export function drawMapFurniture(g, scale, ratio) {
  const { width, height } = g.canvas;
  /* the frame */
  g.strokeStyle = "rgba(230, 187, 99, 0.55)";
  g.lineWidth = 2 * ratio;
  g.strokeRect(5 * ratio, 5 * ratio, width - 10 * ratio, height - 10 * ratio);
  g.strokeStyle = "rgba(230, 187, 99, 0.25)";
  g.lineWidth = ratio;
  g.strokeRect(10 * ratio, 10 * ratio, width - 20 * ratio, height - 20 * ratio);
  /* the compass rose: eight points, north in gold */
  const cx = 52 * ratio;
  const cy = height - 56 * ratio;
  const long = 32 * ratio;
  const short = 18 * ratio;
  g.save();
  g.translate(cx, cy);
  g.fillStyle = "rgba(10, 20, 30, 0.35)";
  g.beginPath();
  g.arc(0, 0, long + 6 * ratio, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255, 226, 160, 0.5)";
  g.lineWidth = ratio;
  g.beginPath();
  g.arc(0, 0, long * 0.72, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const length = k % 2 === 0 ? long : short;
    g.rotate(Math.PI / 4);
    for (const side of [-1, 1]) {
      g.fillStyle =
        k === 7
          ? side < 0
            ? "#ffd27a"
            : "#c99a3a"
          : side < 0
            ? "rgba(240, 232, 214, 0.95)"
            : "rgba(170, 160, 140, 0.95)";
      g.beginPath();
      g.moveTo(0, -length);
      g.lineTo(side * 5 * ratio, 0);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
  g.font = `700 ${12 * ratio}px Cinzel, Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffe2a0";
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = 3 * ratio;
  g.strokeText("N", cx, cy - long - 12 * ratio);
  g.fillText("N", cx, cy - long - 12 * ratio);
  /* the scale bar: a round number of units, about a hundred and twenty pixels long */
  const units = [10, 25, 50, 100, 200, 500].find((u) => u * scale >= 90 * ratio) || 500;
  const barWidth = units * scale;
  const right = width - 24 * ratio;
  const bottom = height - 26 * ratio;
  g.fillStyle = "rgba(10, 20, 30, 0.35)";
  g.fillRect(right - barWidth - 10 * ratio, bottom - 24 * ratio, barWidth + 20 * ratio, 34 * ratio);
  for (let k = 0; k < 4; k++) {
    g.fillStyle = k % 2 ? "rgba(40, 32, 20, 0.9)" : "rgba(255, 236, 190, 0.95)";
    g.fillRect(right - barWidth + (k * barWidth) / 4, bottom - 4 * ratio, barWidth / 4, 5 * ratio);
  }
  g.font = `600 ${11 * ratio}px Rubik, sans-serif`;
  g.fillStyle = "#ffe9c0";
  g.fillText(`${units} paces`, right - barWidth / 2, bottom - 13 * ratio);
}
