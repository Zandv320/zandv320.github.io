/* Eldoria – world map (M) and minimap. The static layer (ground, roads, buildings, trees) is drawn once from what
   stands in the scene (userData.mapKind on built objects and ground planes, the billboards from `billboards`); the
   live layer (player, other players, monsters, npcs with quest markers) is redrawn every frame while the map is open. */
import * as THREE from "three";
import { CRYPT_ROOMS, cryptFloorCells, inCrypt, CRYPT_EXIT } from "./rules/crypt.js";
import {
  FOREST,
  inForest,
  inFields,
  VALE,
  inVale,
  CAPITAL,
  CASTLE,
  inCapital,
  inCastle,
  BANDIT_CAMP,
  ALTAR_CLEARING,
  NORTHROAD,
  NORTH_FARMS,
  NORTH_ROAD,
  inNorthroad,
  northroadWidth,
  distanceToPath,
  NORTHWATCH,
  GORGE,
} from "./regions.js";
import { inGorge, onBridge } from "./rules/gorge.js";
import { SALTMERE, inSaltmere, onPier } from "./rules/saltmere.js";
import { GREY_SEA, ROCKS, ISLETS, EMBER_ISLES } from "./rules/sea.js";
import { emberShore, MOUNT_KHAROS, CINDER_CAMP, COVE_JETTY } from "./rules/ember.js";

/* Traces the coast of the Ember Isles (with Cinder Cove cut into it) as a path on `g`, through `px`/`pz`. */
function traceEmberCoast(g, px, pz) {
  g.beginPath();
  for (let k = 0; k <= 120; k++) {
    const angle = (k / 120) * Math.PI * 2;
    const reach = emberShore(angle);
    const x = px(EMBER_ISLES.x + Math.sin(angle) * reach);
    const z = pz(EMBER_ISLES.z + Math.cos(angle) * reach);
    if (k === 0) {
      g.moveTo(x, z);
    } else {
      g.lineTo(x, z);
    }
  }
  g.closePath();
}
import { PIERS, MOLE, LIGHTHOUSE } from "./rules/saltmere.js";

/* Colours per terrain, per map kind (userData.mapKind, ground plane kind, billboard name) and per live marker. */
const COLORS = {
  outside: "#2f4a22",
  cryptOutside: "#08070c",
  barley: "#c9a44c",
  gorge: "#1d1f27",
  sea: "#3c6a88",
  bridge: "#8a6a42",
  cryptWall: "#2a2738",
  cryptFloor: "#5a5674",
  grass: "#86b54c",
  forest: "#4c7a3b",
  village: "#8fbb52",
  meadow: "#9cbe56",
  capital: "#c4ab84",
  castleGround: "#b3a494",
  plaza: "#d9905a",
  path: "#caa062",
  clearing: "#8e8d86",
  street: "#a99a84",
  wall: "#7d7d78",
  tower: "#66665f",
  gatehouse: "#55554f",
  keep: "#6a6a92",
  fountain: "#58a6d8",
  statue: "#b9b9b2",
  church: "#8f7fb2",
  tent: "#6f8f4a",
  house: "#5d6c9c",
  houseOutline: "#0c0f2a",
  hut: "#a6713c",
  fence: "#6b4a2a",
  well: "#8f8e89",
  stall: "#c9473d",
  stallEast: "#4f9a4f",
  small: "#8a5a2a",
  hay: "#d9b25a",
  pond: "#58a6d8",
  garden: "#7a5536",
  altar: "#b4b2aa",
  menhir: "#86857f",
  tree: "#3b8a3c",
  pine: "#2d6b3a",
  bush: "#67ad4c",
  rock: "#9b9b95",
  station: "#c08a4a",
  ore: "#d58a4a",
  herb: "#c8e66a",
  lantern: "#ffd27a",
  player: "#ffffff",
  otherPlayer: "#7cc4ff",
  partyMember: "#7cf5a0",
  monster: "#f87171",
  monsterPassive: "#ffd1a6",
  npc: "#ffc857",
  quest: "#ffe9a8",
};

/* Map kinds drawn as ellipses instead of boxes. */
const ROUND_KINDS = new Set(["pond", "well", "altar", "menhir", "tower", "fountain", "statue"]);

/* The world: Kingsvale in the west, the fields, the forest above them, the Northroad up north of Aurelia. */
const X0 = VALE.x0 - 4;
const X1 = 70;
const Z0 = SALTMERE.mapZ0 - 4;
const Z1 = 70;

/* The sea chart: the Grey Sea from Saltmere's quay to past the Ember Isles, drawn fresh each time it is shown. */
const SEA_CHART = {
  x0: GREY_SEA.x0 - 10,
  x1: GREY_SEA.x1 + 10,
  z0: GREY_SEA.z0 - 10,
  z1: SALTMERE.z1 + 6,
};
const LAND_MAP = { x0: X0, x1: X1, z0: Z0, z1: Z1 };

/* The static layer is rendered at 8 px per unit (× device pixel ratio): the whole world in one canvas that phones
   can still hold. */
const STATIC_SCALE = 8;
/* The minimap shows 2.4 px per unit. */
const MINIMAP_SCALE = 2.4;
const MINIMAP_SIZE = 156;

/**
 * @param {object} deps {scene, billboards, player, monsters, peers, npcs() → [{name, x, z, label}],
 *   markers() → [{x, z, emoji, title}] (crafting stations), VILLAGE_HALF_SIZE, inVillage(x, z), walkTo(x, z),
 *   sailTo(x, z) (true when the hero is at a helm and sets a course), isPartyMember(id)}
 */
export function createWorldMap(deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#world-map");
  const canvas = $("#world-map-canvas");
  const context = canvas.getContext("2d");
  const minimap = $("#minimap");
  const minimapContext = minimap.getContext("2d");
  let isOpenNow = false;
  let cachedScale = 0;
  let staticLayer = null;
  let features = null;

  /* ---- the static layer ---- */

  function collectFeatures() {
    features = { planes: [], buildings: [], props: [] };
    const box = new THREE.Box3();
    deps.scene.traverse((object) => {
      const mapKind = object.userData && object.userData.mapKind;
      if (!mapKind) {
        return;
      }
      if (typeof mapKind === "string") {
        /* merged builds keep their box in userData.mapBox (batching.js) */
        if (object.userData.mapBox) {
          box.copy(object.userData.mapBox);
        } else {
          box.setFromObject(object);
        }
        features.buildings.push({
          kind: mapKind,
          x0: box.min.x,
          z0: box.min.z,
          x1: box.max.x,
          z1: box.max.z,
          x: object.position.x,
          z: object.position.z,
          rotation: object.rotation.y,
        });
      } else {
        features.planes.push({
          ...mapKind,
          x: object.position.x,
          z: object.position.z,
          rotation: object.rotation.y,
        });
      }
    });
    for (const billboard of deps.billboards) {
      if (billboard.name) {
        features.props.push({
          kind: billboard.name,
          x: billboard.x,
          z: billboard.z,
          scale: billboard.scale || 1,
        });
      }
    }
  }

  function drawStaticLayer(scale) {
    if (!features) {
      collectFeatures();
    }
    const layer = document.createElement("canvas");
    layer.width = Math.ceil((X1 - X0) * scale);
    layer.height = Math.ceil((Z1 - Z0) * scale);
    const g = layer.getContext("2d");
    const px = (x) => (x - X0) * scale;
    const pz = (z) => (z - Z0) * scale;
    const villageHalf = deps.VILLAGE_HALF_SIZE;
    /* a fixed pseudo-random number per spot, so the map looks the same every time */
    const hash = (x, z) => {
      const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    /* everything that stands casts a short shadow to the bottom right, like the sun in the world */
    const SHADOW = "rgba(20, 30, 10, 0.32)";
    const shadowOffset = scale * 0.35;

    /* ---- ground: outside the world, fields, forest, meadows, the city, the village ---- */
    g.fillStyle = COLORS.outside;
    g.fillRect(0, 0, layer.width, layer.height);
    const step = 0.5;
    const regionAt = (x, z) => {
      if (inFields(x, z)) {
        return Math.abs(x) <= villageHalf && Math.abs(z) <= villageHalf ? "village" : "grass";
      }
      if (inForest(x, z)) {
        return "forest";
      }
      if (inVale(x, z)) {
        if (inCapital(x, z)) {
          return inCastle(x, z) ? "castleGround" : "capital";
        }
        return "meadow";
      }
      /* Saltmere: the city like Aurelia, its piers like the bridge, and the sea beyond the quay */
      if (onPier(x, z)) {
        return "bridge";
      }
      if (inSaltmere(x, z)) {
        return "capital";
      }
      if (z < SALTMERE.z0 && x > SALTMERE.x0 - 40 && x < SALTMERE.x1 + 40) {
        return "sea";
      }
      /* Greyfall Gorge cuts across the Northroad's land; the bridge is the only way over */
      if (inGorge(x, z) && distanceToPath(x, z, NORTH_ROAD) < northroadWidth(z)) {
        return onBridge(x, z) ? "bridge" : "gorge";
      }
      if (inNorthroad(x, z)) {
        const isFarm = NORTH_FARMS.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
        return isFarm ? "barley" : "meadow";
      }
      return null;
    };
    for (let z = Z0; z < Z1; z += step) {
      for (let x = X0; x < X1; x += step) {
        const region = regionAt(x + step / 2, z + step / 2);
        if (!region) {
          continue;
        }
        g.fillStyle = COLORS[region];
        g.fillRect(px(x), pz(z), step * scale + 0.5, step * scale + 0.5);
        /* speckles: a lighter or darker fleck now and then, so the ground is not flat */
        const fleck = hash(x, z);
        if (fleck < 0.16) {
          g.fillStyle = fleck < 0.08 ? "rgba(255, 255, 220, 0.10)" : "rgba(0, 30, 0, 0.12)";
          g.fillRect(px(x), pz(z), step * scale * 0.6, step * scale * 0.6);
        }
        /* a darker rim where one region meets another (or the edge of the world) */
        const above = regionAt(x + step / 2, z - step / 2);
        const left = regionAt(x - step / 2, z + step / 2);
        if (above !== region || left !== region) {
          g.fillStyle = "rgba(20, 35, 10, 0.28)";
          g.fillRect(px(x), pz(z), step * scale + 0.5, step * scale + 0.5);
        }
      }
    }

    /* ---- ground planes: roads and streets with a darker edge, the plaza and clearings ---- */
    const planeRect = (plane, grow, color) => {
      g.save();
      g.translate(px(plane.x), pz(plane.z));
      g.rotate(-plane.rotation);
      g.fillStyle = color;
      g.fillRect(
        (-plane.w / 2 - grow) * scale,
        (-plane.l / 2 - grow) * scale,
        (plane.w + grow * 2) * scale,
        (plane.l + grow * 2) * scale,
      );
      g.restore();
    };
    const roads = features.planes.filter(
      (plane) => plane.kind === "path" || plane.kind === "street",
    );
    for (const plane of roads) {
      planeRect(plane, 0.35, plane.kind === "path" ? "#9c7448" : "#7c7062");
    }
    for (const plane of features.planes) {
      if (plane.kind === "path" || plane.kind === "street") {
        planeRect(plane, 0, COLORS[plane.kind]);
      } else {
        g.fillStyle = plane.kind === "plaza" ? "#b87447" : "#6f6e68";
        g.beginPath();
        g.arc(px(plane.x), pz(plane.z), (plane.r + 0.35) * scale, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = COLORS[plane.kind] || COLORS.plaza;
        g.beginPath();
        g.arc(px(plane.x), pz(plane.z), plane.r * scale, 0, Math.PI * 2);
        g.fill();
      }
    }

    /* ---- built objects ---- */
    const outlineWidth = Math.max(1, scale * 0.18);
    for (const building of features.buildings) {
      const width = (building.x1 - building.x0) * scale;
      const height = (building.z1 - building.z0) * scale;
      const x = px(building.x0);
      const y = pz(building.z0);
      const kind = building.kind;
      if (kind === "fence") {
        g.fillStyle = COLORS.fence;
        g.fillRect(x, y, Math.max(width, scale * 0.4), Math.max(height, scale * 0.4));
        continue;
      }
      if (ROUND_KINDS.has(kind)) {
        const cx = px(building.x);
        const cz = pz(building.z);
        const isWater = kind === "pond" || kind === "fountain";
        if (!isWater) {
          g.fillStyle = SHADOW;
          g.beginPath();
          g.ellipse(cx + shadowOffset, cz + shadowOffset, width / 2, height / 2, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = isWater ? "#7d7a72" : COLORS[kind];
        g.beginPath();
        g.ellipse(cx, cz, width / 2, height / 2, 0, 0, Math.PI * 2);
        g.fill();
        if (isWater) {
          /* water inside a stone rim, a lighter shine at the top left */
          g.fillStyle = COLORS.pond;
          g.beginPath();
          g.ellipse(cx, cz, width / 2 - scale * 0.45, height / 2 - scale * 0.45, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(255, 255, 255, 0.45)";
          g.lineWidth = Math.max(1, scale * 0.15);
          g.beginPath();
          g.ellipse(
            cx,
            cz,
            width / 2 - scale * 1.1,
            height / 2 - scale * 1.1,
            0,
            Math.PI * 1.05,
            Math.PI * 1.45,
          );
          g.stroke();
        } else {
          g.strokeStyle = COLORS.houseOutline;
          g.lineWidth = outlineWidth;
          g.stroke();
        }
        continue;
      }
      /* everything else: a shadow, the body, an outline */
      g.fillStyle = SHADOW;
      g.fillRect(x + shadowOffset, y + shadowOffset, width, height);
      if (kind === "house") {
        /* a roof: two halves along the long side, one in the light and one in the shade, with a ridge */
        const isHut = building.z < FOREST.z1;
        const roof = isHut ? COLORS.hut : COLORS.house;
        g.fillStyle = roof;
        g.fillRect(x, y, width, height);
        g.fillStyle = "rgba(0, 0, 0, 0.22)";
        if (width >= height) {
          g.fillRect(x, y + height / 2, width, height / 2);
          g.fillStyle = "rgba(255, 255, 255, 0.35)";
          g.fillRect(x, y + height / 2 - scale * 0.1, width, Math.max(1, scale * 0.2));
        } else {
          g.fillRect(x + width / 2, y, width / 2, height);
          g.fillStyle = "rgba(255, 255, 255, 0.35)";
          g.fillRect(x + width / 2 - scale * 0.1, y, Math.max(1, scale * 0.2), height);
        }
      } else if (kind === "garden") {
        /* tilled soil with rows of crops */
        g.fillStyle = COLORS.garden;
        g.fillRect(x, y, width, height);
        g.fillStyle = "rgba(214, 190, 90, 0.75)";
        for (let row = y + scale * 0.5; row < y + height - scale * 0.3; row += scale * 0.75) {
          g.fillRect(x + scale * 0.3, row, width - scale * 0.6, Math.max(1, scale * 0.28));
        }
      } else if (kind === "stall") {
        g.fillStyle = building.x < 0 ? COLORS.stall : COLORS.stallEast;
        g.fillRect(x, y, width, height);
        g.fillStyle = "rgba(255, 255, 255, 0.55)";
        for (let stripe = x; stripe < x + width; stripe += scale * 0.7) {
          g.fillRect(stripe, y, Math.max(1, scale * 0.3), height);
        }
      } else if (kind === "tent") {
        g.fillStyle = COLORS.tent;
        g.beginPath();
        g.moveTo(x + width / 2, y);
        g.lineTo(x + width, y + height);
        g.lineTo(x, y + height);
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = COLORS[kind] || COLORS.small;
        g.fillRect(x, y, width, height);
      }
      if (kind !== "tent") {
        g.strokeStyle = COLORS.houseOutline;
        g.lineWidth = outlineWidth;
        g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
      }
    }

    /* ---- trees, bushes, rocks, nodes, lanterns ("tree2" draws as "tree") ---- */
    const blob = (x, z, radius, color, highlight) => {
      const cx = px(x);
      const cz = pz(z);
      const r = radius * scale;
      g.fillStyle = SHADOW;
      g.beginPath();
      g.arc(cx + shadowOffset, cz + shadowOffset, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cz, r, 0, Math.PI * 2);
      g.fill();
      if (highlight && r > 2) {
        g.fillStyle = highlight;
        g.beginPath();
        g.arc(cx - r * 0.3, cz - r * 0.3, r * 0.45, 0, Math.PI * 2);
        g.fill();
      }
      if (r > 2.5) {
        g.strokeStyle = "rgba(12, 15, 42, 0.55)";
        g.lineWidth = Math.max(1, scale * 0.1);
        g.beginPath();
        g.arc(cx, cz, r, 0, Math.PI * 2);
        g.stroke();
      }
    };
    for (const prop of features.props) {
      const kind = prop.kind.replace(/\d$/, "").replace(/_.*$/, "");
      if (kind === "tree") {
        blob(prop.x, prop.z, (0.95 * prop.scale) / 1.3, COLORS.tree, "rgba(190, 230, 110, 0.45)");
      } else if (kind === "pine") {
        blob(prop.x, prop.z, (0.85 * prop.scale) / 1.3, COLORS.pine, "rgba(140, 200, 120, 0.35)");
      } else if (kind === "bush") {
        blob(prop.x, prop.z, 0.5, COLORS.bush, "rgba(200, 240, 140, 0.4)");
      } else if (kind === "rock") {
        blob(prop.x, prop.z, 0.55, COLORS.rock, "rgba(255, 255, 255, 0.35)");
      } else if (kind === "ore" || kind === "herb") {
        /* gathering nodes (rules/gather-nodes.js): ore veins and herbs */
        blob(prop.x, prop.z, 0.45, COLORS[kind], null);
      } else if (kind === "lantern") {
        g.fillStyle = "rgba(255, 210, 122, 0.35)";
        g.beginPath();
        g.arc(px(prop.x), pz(prop.z), scale * 0.7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = COLORS.lantern;
        g.fillRect(px(prop.x) - scale * 0.2, pz(prop.z) - scale * 0.2, scale * 0.4, scale * 0.4);
      }
    }

    /* the minimap draws this layer small: names and the compass only on the big map */
    if (scale < 6) {
      return layer;
    }

    /* ---- names: regions in the heading font, places smaller ---- */
    g.textAlign = "center";
    g.lineJoin = "round";
    const drawName = (text, x, z, size, isPlace = false) => {
      g.font = isPlace ? `600 ${size}px Rubik, sans-serif` : `700 ${size}px Cinzel, Rubik, serif`;
      g.lineWidth = Math.max(2, size * 0.22);
      g.strokeStyle = "rgba(20, 16, 10, 0.7)";
      g.strokeText(text, px(x), pz(z));
      g.fillStyle = isPlace ? "rgba(255, 244, 214, 0.92)" : "#ffe9a8";
      g.fillText(text, px(x), pz(z));
    };
    drawName("Runeveld", 0, -villageHalf - 3, scale * 2.8);
    drawName(FOREST.name, 0, FOREST.z0 + 5, scale * 2.8);
    drawName(VALE.name, VALE.cx, VALE.z0 + 8, scale * 2.8);
    drawName(CAPITAL.name, CAPITAL.cx, CAPITAL.z0 - 3, scale * 2.4);
    const placeSize = scale * 1.9;
    drawName("Old Altar", ALTAR_CLEARING[0], ALTAR_CLEARING[1] + 7.5, placeSize, true);
    drawName("Bandit Camp", BANDIT_CAMP[0], BANDIT_CAMP[1] - 6, placeSize, true);
    drawName("Mill", -78, 24.5, placeSize, true);
    drawName("Farm", -76, -18.5, placeSize, true);
    drawName("Castle", CASTLE.cx, CASTLE.z0 - 1.5, placeSize, true);
    drawName("Lake", -118, 64, placeSize, true);
    drawName("Farmland", 32.5, -8.5, placeSize, true);
    drawName(NORTHROAD.name, NORTHROAD.inn[0] + 30, -128, scale * 2.6);
    drawName("Fort Harrow", NORTHROAD.fort[0], NORTHROAD.fort[1] + 6, placeSize, true);
    drawName("Halfway Inn", NORTHROAD.inn[0], NORTHROAD.inn[1] - 8, placeSize, true);
    drawName(NORTHWATCH.name, NORTHWATCH.x, NORTHWATCH.z - NORTHWATCH.radius - 1, placeSize, true);
    drawName(GORGE.name, NORTHROAD.x0 + 26, GORGE.north - 3, placeSize, true);
    drawName(SALTMERE.name, SALTMERE.gate[0], SALTMERE.gate[1] + 6, scale * 2.4);

    /* ---- a compass rose in the bottom left corner ---- */
    const rx = layer.width * 0.06;
    const rz = layer.height * 0.93;
    const rr = scale * 3.2;
    g.save();
    g.translate(rx, rz);
    for (const [angle, color] of [
      [0, "#ffe9a8"],
      [Math.PI / 2, "#d6c08a"],
      [Math.PI, "#d6c08a"],
      [-Math.PI / 2, "#d6c08a"],
    ]) {
      g.save();
      g.rotate(angle);
      g.fillStyle = color;
      g.strokeStyle = "rgba(20, 16, 10, 0.8)";
      g.lineWidth = Math.max(1, scale * 0.12);
      g.beginPath();
      g.moveTo(0, -rr);
      g.lineTo(rr * 0.22, 0);
      g.lineTo(-rr * 0.22, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    g.font = `700 ${scale * 1.3}px Cinzel, serif`;
    g.fillStyle = "#ffe9a8";
    g.strokeStyle = "rgba(20, 16, 10, 0.8)";
    g.lineWidth = Math.max(2, scale * 0.25);
    g.strokeText("N", 0, -rr - scale * 0.5);
    g.fillText("N", 0, -rr - scale * 0.5);
    g.restore();
    return layer;
  }

  /* The crypt is far from everything else: a small map of its own, floor and walls, for the minimap down there. */
  let cryptLayer = null;
  const cryptBounds = Object.values(CRYPT_ROOMS).reduce(
    ([x0, z0, x1, z1], { rect }) => [
      Math.min(x0, rect[0] - 2),
      Math.min(z0, rect[1] - 2),
      Math.max(x1, rect[2] + 2),
      Math.max(z1, rect[3] + 2),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  function ensureCryptLayer(scale) {
    if (cryptLayer && cryptLayer.scale === scale) {
      return cryptLayer;
    }
    const [x0, z0, x1, z1] = cryptBounds;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((x1 - x0) * scale);
    canvas.height = Math.ceil((z1 - z0) * scale);
    const g = canvas.getContext("2d");
    const floor = cryptFloorCells();
    /* walls first, a cell wider than the floor all round, then the floor over them */
    g.fillStyle = COLORS.cryptWall;
    for (const key of floor) {
      const [x, z] = key.split(",").map(Number);
      g.fillRect((x - 1 - x0) * scale, (z - 1 - z0) * scale, 3 * scale, 3 * scale);
    }
    g.fillStyle = COLORS.cryptFloor;
    for (const key of floor) {
      const [x, z] = key.split(",").map(Number);
      g.fillRect((x - x0) * scale, (z - z0) * scale, scale + 0.5, scale + 0.5);
    }
    /* the stairs up */
    g.font = `${Math.round(scale * 2.2)}px system-ui`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("🪜", (CRYPT_EXIT[0] - x0) * scale, (CRYPT_EXIT[1] - z0) * scale);
    cryptLayer = { canvas, scale, x0, z0 };
    return cryptLayer;
  }

  function ensureStaticLayer(scale) {
    if (!staticLayer || cachedScale !== scale) {
      cachedScale = scale;
      staticLayer = drawStaticLayer(scale);
    }
    return staticLayer;
  }

  /* ---- the live layer ---- */

  function drawDot(g, x, y, radius, color, outline) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, radius, 0, Math.PI * 2);
    g.fill();
    if (outline) {
      g.strokeStyle = outline;
      g.lineWidth = 1;
      g.stroke();
    }
  }

  /* Draws the live markers at `scale` canvas pixels per unit, with the view origin at (offsetX, offsetZ) pixels. */
  function drawLiveLayer(g, scale, offsetX, offsetZ, pixelRatio) {
    const px = (x) => (x - X0) * scale - offsetX;
    const pz = (z) => (z - Z0) * scale - offsetZ;
    for (const monster of deps.monsters.values()) {
      if (monster.isDead || !monster.sprite.group.visible) {
        continue;
      }
      const color = monster.spec.aggressive ? COLORS.monster : COLORS.monsterPassive;
      drawDot(g, px(monster.x), pz(monster.z), 2.2 * pixelRatio, color, "rgba(0,0,0,.5)");
    }
    /* crafting stations as their emoji; the guide's objective as a gold star (`color`) */
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const marker of deps.markers ? deps.markers() : []) {
      if (marker.color) {
        g.font = `900 ${16 * pixelRatio}px sans-serif`;
        g.lineWidth = 3 * pixelRatio;
        g.strokeStyle = "rgba(0,0,0,.75)";
        g.strokeText(marker.emoji, px(marker.x), pz(marker.z));
        g.fillStyle = marker.color;
      } else {
        g.font = `${11 * pixelRatio}px sans-serif`;
        g.fillStyle = "#fff";
      }
      g.fillText(marker.emoji, px(marker.x), pz(marker.z));
    }
    g.restore();
    for (const npc of deps.npcs()) {
      drawDot(g, px(npc.x), pz(npc.z), 2.6 * pixelRatio, COLORS.npc, "rgba(0,0,0,.6)");
      const marker = npc.label && npc.label.el.querySelector(".quest-mark");
      if (marker && !marker.hidden) {
        g.font = `900 ${11 * pixelRatio}px Rubik,sans-serif`;
        g.textAlign = "center";
        g.fillStyle = marker.classList.contains("in-progress") ? "#c9d3dd" : COLORS.quest;
        g.strokeStyle = "#000";
        g.lineWidth = 2 * pixelRatio;
        g.strokeText(marker.textContent, px(npc.x), pz(npc.z) - 4 * pixelRatio);
        g.fillText(marker.textContent, px(npc.x), pz(npc.z) - 4 * pixelRatio);
      }
    }
    for (const [id, peer] of deps.peers) {
      const isPartyMember = deps.isPartyMember && deps.isPartyMember(id);
      const color = isPartyMember ? COLORS.partyMember : COLORS.otherPlayer;
      drawDot(g, px(peer.x), pz(peer.z), 3 * pixelRatio, color, "#000");
    }
    /* The player: an arrow in the facing direction. */
    const player = deps.player;
    const facing = player.sprite ? player.sprite.facing : { x: 0, y: 1 };
    const angle = Math.atan2(facing.x, -facing.y);
    g.save();
    g.translate(px(player.x), pz(player.z));
    g.rotate(angle);
    g.fillStyle = COLORS.player;
    g.strokeStyle = "#000";
    g.lineWidth = 1.5 * pixelRatio;
    g.beginPath();
    g.moveTo(0, -6 * pixelRatio);
    g.lineTo(4.5 * pixelRatio, 5 * pixelRatio);
    g.lineTo(0, 2.5 * pixelRatio);
    g.lineTo(-4.5 * pixelRatio, 5 * pixelRatio);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  /* ---- the map panel: at zoom 1 the whole world fits; zoom in up to 4× beyond what fills the panel with the
     wheel, a pinch or the + and − buttons; drag to pan, click or tap to walk there. On a phone (or a short
     screen) the map fills the screen and opens zoomed in on the player. ---- */

  /* the land map or the sea chart (the ⚓ button switches; it opens on the sea chart out at sea) */
  let isSeaChart = false;
  let bounds = LAND_MAP;
  const worldWidth = () => bounds.x1 - bounds.x0;
  const worldHeight = () => bounds.z1 - bounds.z0;
  const viewport = $("#world-map-viewport");
  const fillsScreen = () => matchMedia("(max-width: 700px), (max-height: 520px)").matches;
  let zoom = 1;
  let centerX = (bounds.x0 + bounds.x1) / 2;
  let centerZ = (bounds.z0 + bounds.z1) / 2;
  let fitScale = 1;
  let pixelRatio = 1;
  let drag = null;
  /* pointers on the canvas (two of them pinch) */
  const pointers = new Map();
  let pinch = null;

  function resizeCanvas() {
    pixelRatio = Math.min(2, devicePixelRatio || 1);
    let width;
    let height;
    if (fillsScreen()) {
      width = Math.max(120, viewport.clientWidth);
      height = Math.max(120, viewport.clientHeight);
      fitScale = Math.min(width / worldWidth(), height / worldHeight());
    } else {
      const maxWidth = Math.min(innerWidth - 48, 960);
      const maxHeight = innerHeight - 150;
      fitScale = Math.max(1, Math.min(maxWidth / worldWidth(), maxHeight / worldHeight()));
      width = Math.round(worldWidth() * fitScale);
      height = Math.round(worldHeight() * fitScale);
    }
    if (canvas.style.width !== width + "px" || canvas.style.height !== height + "px") {
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    }
  }

  /* the zoom at which the map fills the whole canvas (no bands around the world) */
  const coverZoom = () => {
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;
    return Math.max(width / worldWidth(), height / worldHeight()) / fitScale;
  };
  const maxZoom = () => coverZoom() * 4;

  /** Zoom by `factor`, keeping the world point under (clientX, clientY) in place. */
  function zoomAt(factor, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const [x, z] = toWorld({
      clientX: clientX ?? rect.left + rect.width / 2,
      clientY: clientY ?? rect.top + rect.height / 2,
    });
    const previousZoom = zoom;
    zoom = Math.max(1, Math.min(maxZoom(), zoom * factor));
    const shift = 1 - previousZoom / zoom;
    centerX += (x - centerX) * shift;
    centerZ += (z - centerZ) * shift;
    render();
  }

  /* Scale in canvas pixels per unit, and the top-left corner of the view in world coordinates. */
  function view() {
    const scale = fitScale * zoom * pixelRatio;
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    /* stay within the world; a view wider (or taller) than the world keeps it centred */
    const { x0, x1, z0, z1 } = bounds;
    centerX =
      viewWidth >= worldWidth()
        ? (x0 + x1) / 2
        : Math.max(x0 + viewWidth / 2, Math.min(x1 - viewWidth / 2, centerX));
    centerZ =
      viewHeight >= worldHeight()
        ? (z0 + z1) / 2
        : Math.max(z0 + viewHeight / 2, Math.min(z1 - viewHeight / 2, centerZ));
    return {
      scale,
      worldX0: centerX - viewWidth / 2,
      worldZ0: centerZ - viewHeight / 2,
      viewWidth,
      viewHeight,
    };
  }

  function render() {
    if (!isOpenNow) {
      return;
    }
    resizeCanvas();
    if (isSeaChart) {
      const { scale, worldX0, worldZ0 } = view();
      drawSeaChart(context, scale, worldX0, worldZ0, pixelRatio);
      return;
    }
    const layer = ensureStaticLayer(STATIC_SCALE * pixelRatio);
    const { scale, worldX0, worldZ0, viewWidth, viewHeight } = view();
    const layerScale = STATIC_SCALE * pixelRatio;
    context.imageSmoothingEnabled = true;
    context.fillStyle = COLORS.outside;
    context.fillRect(0, 0, canvas.width, canvas.height);
    /* the part of the world in view (the view may reach past the world's edges) */
    const fromX = Math.max(X0, worldX0);
    const fromZ = Math.max(Z0, worldZ0);
    const toX = Math.min(X1, worldX0 + viewWidth);
    const toZ = Math.min(Z1, worldZ0 + viewHeight);
    if (toX > fromX && toZ > fromZ) {
      context.drawImage(
        layer,
        (fromX - X0) * layerScale,
        (fromZ - Z0) * layerScale,
        (toX - fromX) * layerScale,
        (toZ - fromZ) * layerScale,
        (fromX - worldX0) * scale,
        (fromZ - worldZ0) * scale,
        (toX - fromX) * scale,
        (toZ - fromZ) * scale,
      );
    }
    drawLiveLayer(context, scale, (worldX0 - X0) * scale, (worldZ0 - Z0) * scale, pixelRatio);
  }

  const toWorld = (event) => {
    const rect = canvas.getBoundingClientRect();
    const { scale, worldX0, worldZ0 } = view();
    return [
      worldX0 + ((event.clientX - rect.left) * pixelRatio) / scale,
      worldZ0 + ((event.clientY - rect.top) * pixelRatio) / scale,
    ];
  };

  const regionNameAt = (x, z) => {
    if (isSeaChart) {
      const islet = ISLETS.find((isle) => Math.hypot(x - isle.x, z - isle.z) < isle.radius + 6);
      if (islet) {
        return islet.name;
      }
      if (Math.hypot(x - CINDER_CAMP.x, z - CINDER_CAMP.z) < 18) {
        return CINDER_CAMP.name;
      }
      if (Math.hypot(x - EMBER_ISLES.x, z - EMBER_ISLES.z) < EMBER_ISLES.radius + 10) {
        return EMBER_ISLES.name;
      }
      return z > SALTMERE.z0 ? SALTMERE.name : GREY_SEA.name;
    }
    if (inCapital(x, z)) {
      return CAPITAL.name;
    }
    if (inForest(x, z)) {
      return FOREST.name;
    }
    if (inVale(x, z) && !inFields(x, z)) {
      return VALE.name;
    }
    return deps.inVillage(x, z) ? "Runeveld village" : "Runeveld fields";
  };

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = Math.max(1 / 1.6, Math.min(1.6, Math.exp(-event.deltaY * 0.0025)));
      zoomAt(factor, event.clientX, event.clientY);
    },
    { passive: false },
  );
  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      /* a second finger: pinch instead of drag */
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      drag = null;
      return;
    }
    drag = {
      x: event.clientX,
      y: event.clientY,
      centerX,
      centerZ,
      hasMoved: false,
    };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomAt(distance / pinch.distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.distance = distance;
      return;
    }
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) {
        drag.hasMoved = true;
      }
      if (drag.hasMoved) {
        const scale = fitScale * zoom;
        centerX = drag.centerX - dx / scale;
        centerZ = drag.centerZ - dy / scale;
        render();
      }
    }
    const [x, z] = toWorld(event);
    $("#world-map-position").textContent =
      `${Math.round(x)}, ${Math.round(z)} · ${regionNameAt(x, z)}`;
  });
  canvas.addEventListener("pointerup", (event) => {
    pointers.delete(event.pointerId);
    if (pinch) {
      /* the pinch ends when a finger lifts; no walking from it */
      if (pointers.size < 2) {
        pinch = null;
      }
      return;
    }
    if (!drag) {
      return;
    }
    const finished = drag;
    drag = null;
    if (finished.hasMoved) {
      return;
    }
    const [x, z] = toWorld(event);
    /* at the helm a click on the chart (or the map) sets the course; ashore it is a walk */
    if ((deps.sailTo && deps.sailTo(x, z)) || deps.walkTo(x, z)) {
      close();
    }
  });
  canvas.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    pinch = null;
    drag = null;
  });
  $("#world-map-close").onclick = () => close();
  $("#world-map-sea").onclick = () => setSeaChart(!isSeaChart);
  $("#world-map-zoom-in").onclick = () => zoomAt(1.5);
  $("#world-map-zoom-out").onclick = () => zoomAt(1 / 1.5);
  addEventListener("resize", () => render());

  /* the land map or the sea chart, fresh at zoom 1 (or around the hero on a phone) */
  function setSeaChart(isSea) {
    isSeaChart = isSea;
    bounds = isSea ? SEA_CHART : LAND_MAP;
    $("#world-map-title").textContent = isSea ? "Sea chart" : "World map";
    $("#world-map-sea").textContent = isSea ? "🗺️" : "⚓";
    $("#world-map-sea").title = isSea ? "World map" : "Sea chart";
    panel.classList.toggle("sea-chart", isSea);
    zoom = 1;
    centerX = (bounds.x0 + bounds.x1) / 2;
    centerZ = (bounds.z0 + bounds.z1) / 2;
    if (isOpenNow) {
      resizeCanvas();
      if (fillsScreen()) {
        zoom = Math.min(maxZoom(), Math.max(1, coverZoom()));
        centerX = deps.player.x;
        centerZ = deps.player.z;
      }
      render();
    }
  }

  function show() {
    isOpenNow = true;
    panel.hidden = false;
    /* out at sea the sea chart, ashore the map of the land */
    const isAtSea = deps.player.z < SALTMERE.z0 - 2;
    if (isAtSea !== isSeaChart) {
      setSeaChart(isAtSea);
    }
    resizeCanvas();
    if (fillsScreen()) {
      /* a phone: fill the screen, centred on the player */
      zoom = Math.min(maxZoom(), Math.max(1, coverZoom()));
      centerX = deps.player.x;
      centerZ = deps.player.z;
    } else if (zoom === 1) {
      centerX = (bounds.x0 + bounds.x1) / 2;
      centerZ = (bounds.z0 + bounds.z1) / 2;
    }
    render();
  }

  function close() {
    isOpenNow = false;
    panel.hidden = true;
  }

  /* ---- the sea chart: the Grey Sea as a sailor's chart, with the ships on it ---- */

  function drawSeaChart(g, scale, worldX0, worldZ0, ratio) {
    const px = (x) => (x - worldX0) * scale;
    const pz = (z) => (z - worldZ0) * scale;
    const { width, height } = g.canvas;
    /* the water, a little lighter near the coast; a grid of fifty units */
    const water = g.createLinearGradient(0, pz(SEA_CHART.z0), 0, pz(SALTMERE.z0));
    water.addColorStop(0, "#26475e");
    water.addColorStop(1, "#3c6a88");
    g.fillStyle = water;
    g.fillRect(0, 0, width, height);
    g.strokeStyle = "rgba(220, 235, 245, 0.08)";
    g.lineWidth = 1;
    for (let x = Math.ceil(SEA_CHART.x0 / 50) * 50; x < SEA_CHART.x1; x += 50) {
      g.beginPath();
      g.moveTo(px(x), pz(SEA_CHART.z0));
      g.lineTo(px(x), pz(SALTMERE.z0));
      g.stroke();
    }
    for (let z = Math.ceil(SEA_CHART.z0 / 50) * 50; z < SALTMERE.z0; z += 50) {
      g.beginPath();
      g.moveTo(px(SEA_CHART.x0), pz(z));
      g.lineTo(px(SEA_CHART.x1), pz(z));
      g.stroke();
    }
    /* the coast of the land and Saltmere on it: its walls, piers, the mole and the lighthouse */
    g.fillStyle = COLORS.meadow;
    g.fillRect(0, pz(SALTMERE.z0), width, height);
    g.fillStyle = COLORS.capital;
    g.fillRect(
      px(SALTMERE.x0),
      pz(SALTMERE.z0),
      (SALTMERE.x1 - SALTMERE.x0) * scale,
      (SALTMERE.z1 - SALTMERE.z0) * scale,
    );
    g.fillStyle = COLORS.bridge;
    for (const pier of PIERS) {
      g.fillRect(
        px(pier.x - pier.halfWidth),
        pz(pier.end),
        pier.halfWidth * 2 * scale,
        (SALTMERE.z0 - pier.end) * scale,
      );
    }
    g.fillStyle = "#9a948a";
    g.fillRect(
      px(MOLE.x - MOLE.halfWidth),
      pz(MOLE.end),
      MOLE.halfWidth * 2 * scale,
      (SALTMERE.z0 - MOLE.end) * scale,
    );
    const circle = (x, z, radius, fill, minimum = 1.5) => {
      g.fillStyle = fill;
      g.beginPath();
      g.arc(px(x), pz(z), Math.max(radius * scale, minimum * ratio), 0, Math.PI * 2);
      g.fill();
    };
    circle(MOLE.head[0], MOLE.head[1], MOLE.headRadius, "#9a948a");
    circle(LIGHTHOUSE[0], LIGHTHOUSE[1], 1.8, "#e05a48", 2.5);
    /* sea stacks, islets and their names */
    for (const [x, z, radius] of ROCKS) {
      circle(x, z, radius * 1.5, "rgba(240, 246, 250, 0.25)");
      circle(x, z, radius, "#5a5658", 2);
    }
    const name = (text, x, z, size, isRegion = false) => {
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = isRegion
        ? `italic 700 ${size}px Cinzel, Rubik, serif`
        : `600 ${size}px Rubik, sans-serif`;
      g.lineWidth = Math.max(2, size * 0.22);
      g.strokeStyle = "rgba(10, 16, 24, 0.75)";
      g.strokeText(text, px(x), pz(z));
      g.fillStyle = isRegion ? "rgba(220, 235, 245, 0.55)" : "rgba(255, 244, 214, 0.95)";
      g.fillText(text, px(x), pz(z));
    };
    const placeSize = Math.max(11 * ratio, scale * 6);
    for (const islet of ISLETS) {
      circle(islet.x, islet.z, islet.radius + 1.5, "#d8c08a", 3);
      circle(islet.x, islet.z, islet.radius * 0.9, "#6a9a4a", 2);
      name(islet.name, islet.x, islet.z + islet.radius + 9, placeSize);
    }
    /* the Ember Isles: black rock round Cinder Cove, the mountain and its glow, the camp */
    g.fillStyle = "#3a3436";
    traceEmberCoast(g, px, pz);
    g.fill();
    circle(MOUNT_KHAROS.x, MOUNT_KHAROS.z, MOUNT_KHAROS.radius * 0.7, "#4a4244");
    circle(MOUNT_KHAROS.x, MOUNT_KHAROS.z, 5, "#ff7a2a", 3);
    g.fillStyle = "#8a6a42";
    g.fillRect(
      px(COVE_JETTY.x - COVE_JETTY.halfWidth),
      pz(COVE_JETTY.north),
      Math.max(2 * ratio, COVE_JETTY.halfWidth * 2 * scale),
      (COVE_JETTY.south - COVE_JETTY.north) * scale,
    );
    circle(CINDER_CAMP.x, CINDER_CAMP.z, 2.5, "#ffb04a", 3);
    name(EMBER_ISLES.name, EMBER_ISLES.x, EMBER_ISLES.z + EMBER_ISLES.radius + 14, placeSize * 1.2);
    name(CINDER_CAMP.name, CINDER_CAMP.x, CINDER_CAMP.z - 7, placeSize);
    name(SALTMERE.name, SALTMERE.gate[0], SALTMERE.z1 - 2, placeSize * 1.2);
    name(GREY_SEA.name, -150, -600, placeSize * 2.2, true);
    name("Uncharted waters", -150, SEA_CHART.z0 + 18, placeSize * 1.1, true);
    /* a compass in the corner */
    const compassX = 34 * ratio;
    const compassY = 40 * ratio;
    g.fillStyle = "rgba(255, 233, 168, 0.85)";
    g.beginPath();
    g.moveTo(compassX, compassY - 18 * ratio);
    g.lineTo(compassX + 6 * ratio, compassY);
    g.lineTo(compassX - 6 * ratio, compassY);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255, 233, 168, 0.4)";
    g.beginPath();
    g.moveTo(compassX, compassY + 18 * ratio);
    g.lineTo(compassX + 6 * ratio, compassY);
    g.lineTo(compassX - 6 * ratio, compassY);
    g.closePath();
    g.fill();
    g.font = `700 ${11 * ratio}px Cinzel, Rubik, serif`;
    g.fillStyle = "#ffe9a8";
    g.fillText("N", compassX, compassY - 26 * ratio);
    /* the other players' ships, and the hero: a ship under sail with the course ahead, or a dot ashore */
    for (const peer of deps.peers.values()) {
      const pose = peer.presence && peer.presence.ship;
      if (Array.isArray(pose)) {
        drawShip(g, px(pose[0]), pz(pose[1]), pose[2], COLORS.otherPlayer, ratio);
      } else {
        drawDot(g, px(peer.x), pz(peer.z), 3 * ratio, COLORS.otherPlayer, "#000");
      }
    }
    const ship = deps.player.ship;
    if (ship) {
      if (ship.destination) {
        g.setLineDash([6 * ratio, 5 * ratio]);
        g.strokeStyle = "rgba(255, 233, 168, 0.8)";
        g.lineWidth = 1.5 * ratio;
        g.beginPath();
        g.moveTo(px(ship.x), pz(ship.z));
        g.lineTo(px(ship.destination[0]), pz(ship.destination[1]));
        g.stroke();
        g.setLineDash([]);
        circle(ship.destination[0], ship.destination[1], 0, "rgba(255, 233, 168, 0.8)", 3);
      }
      drawShip(g, px(ship.x), pz(ship.z), ship.heading, COLORS.player, ratio);
    } else {
      drawDot(g, px(deps.player.x), pz(deps.player.z), 4 * ratio, COLORS.player, "#000");
    }
  }

  /* a little ship on the chart, its bow along `heading` (to (-sin, -cos)) */
  function drawShip(g, x, y, heading, color, ratio) {
    g.save();
    g.translate(x, y);
    g.rotate(-heading);
    g.fillStyle = color;
    g.strokeStyle = "#000";
    g.lineWidth = 1.5 * ratio;
    g.beginPath();
    g.moveTo(0, -9 * ratio);
    g.quadraticCurveTo(5 * ratio, -2 * ratio, 4 * ratio, 7 * ratio);
    g.lineTo(-4 * ratio, 7 * ratio);
    g.quadraticCurveTo(-5 * ratio, -2 * ratio, 0, -9 * ratio);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  /* ---- the minimap: a window around the player, cut from the same static layer ---- */

  let minimapPixelRatio = 0;

  function renderMinimap() {
    if (minimap.hidden || !deps.player.sprite) {
      return;
    }
    const ratio = Math.min(2, devicePixelRatio || 1);
    if (ratio !== minimapPixelRatio) {
      minimapPixelRatio = ratio;
      minimap.width = Math.round(MINIMAP_SIZE * ratio);
      minimap.height = Math.round(MINIMAP_SIZE * ratio);
    }
    const scale = MINIMAP_SCALE * ratio;
    const layerScale = STATIC_SCALE * ratio;
    /* down in the crypt its own map, with its own corner */
    const isBelow = inCrypt(deps.player.x, deps.player.z);
    const crypt = isBelow ? ensureCryptLayer(layerScale) : null;
    const layer = crypt ? crypt.canvas : ensureStaticLayer(layerScale);
    const layerX0 = crypt ? crypt.x0 : X0;
    const layerZ0 = crypt ? crypt.z0 : Z0;
    const width = minimap.width;
    const height = minimap.height;
    const worldX0 = deps.player.x - width / 2 / scale;
    const worldZ0 = deps.player.z - height / 2 / scale;
    minimapContext.save();
    minimapContext.beginPath();
    /* roundRect is missing on older phone browsers: a square corner then */
    if (minimapContext.roundRect) {
      minimapContext.roundRect(0, 0, width, height, 10 * ratio);
    } else {
      minimapContext.rect(0, 0, width, height);
    }
    minimapContext.clip();
    /* out at sea, beyond the map of the land: open water */
    const isAtSea = deps.player.z < SALTMERE.z0 - 2;
    minimapContext.fillStyle = isBelow
      ? COLORS.cryptOutside
      : isAtSea
        ? COLORS.sea
        : COLORS.outside;
    minimapContext.fillRect(0, 0, width, height);
    minimapContext.imageSmoothingEnabled = true;
    minimapContext.drawImage(
      layer,
      (worldX0 - layerX0) * layerScale,
      (worldZ0 - layerZ0) * layerScale,
      (width / scale) * layerScale,
      (height / scale) * layerScale,
      0,
      0,
      width,
      height,
    );
    if (isAtSea) {
      drawSea(minimapContext, scale, worldX0, worldZ0, ratio);
    }
    drawLiveLayer(minimapContext, scale, (worldX0 - X0) * scale, (worldZ0 - Z0) * scale, ratio);
    minimapContext.restore();
  }

  /* the Grey Sea on the minimap: the darker water of the Reach, rocks, islets and the Ember Isles */
  function drawSea(context, scale, worldX0, worldZ0, ratio) {
    const circle = (x, z, radius, fill) => {
      context.fillStyle = fill;
      context.beginPath();
      context.arc(
        (x - worldX0) * scale,
        (z - worldZ0) * scale,
        Math.max(radius * scale, 1.5 * ratio),
        0,
        Math.PI * 2,
      );
      context.fill();
    };
    for (const [x, z, radius] of ROCKS) {
      circle(x, z, radius, "#5a5658");
    }
    for (const { x, z, radius } of ISLETS) {
      circle(x, z, radius + 1, "#d8c08a");
      circle(x, z, radius * 0.9, "#6a9a4a");
    }
    context.fillStyle = "#3a3436";
    traceEmberCoast(
      context,
      (x) => (x - worldX0) * scale,
      (z) => (z - worldZ0) * scale,
    );
    context.fill();
    circle(MOUNT_KHAROS.x, MOUNT_KHAROS.z, MOUNT_KHAROS.radius, "#4a4244");
    context.fillStyle = "#8a6a42";
    context.fillRect(
      (COVE_JETTY.x - COVE_JETTY.halfWidth - worldX0) * scale,
      (COVE_JETTY.north - worldZ0) * scale,
      COVE_JETTY.halfWidth * 2 * scale,
      (COVE_JETTY.south - COVE_JETTY.north) * scale,
    );
  }

  return {
    show,
    close,
    toggle() {
      if (isOpenNow) {
        close();
      } else {
        show();
      }
    },
    isOpen: () => isOpenNow,
    render,
    renderMinimap,
    invalidate() {
      features = null;
      staticLayer = null;
    },
  };
}
