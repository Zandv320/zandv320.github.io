/* Eldoria – the Sunken Crypt under the old altar in Whisperwood. rules/crypt.js has its rooms; this file builds
   them (floor, walls, pillars, tombs, braziers and torches), and runs what happens down there: the dark with its
   flickering lights, walls that fade when they stand in front of the hero, the stairs in and out, the iron gate that
   a lever opens, the rune stones that open the Count's sanctum, the spike traps and arrow plates in the gallery and
   the cracked wall to the forgotten vault. Gates, runes and the crumbled wall stay open for this session; opening
   one is sent to the other players ('crypt_open'), so a party goes through together. */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  CRYPT_ROOMS,
  CRYPT_ENTRY,
  CRYPT_EXIT,
  CRYPT_STAIRS,
  cryptFloorCells,
  cryptPoint,
  cryptRoomAt,
  inCrypt,
} from "./rules/crypt.js";
import { player, game, now, hpMax, playEffect, ADMIN } from "./game-state.js";
import { scene, camera, cameraState, shakeCamera } from "./world.js";
import { takeDamage } from "./player.js";
import { burst, trail } from "./particles.js";
import { groundRing } from "./skill-effects.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const WALL_HEIGHT = 2.2;
/* the haze down there: almost black, a little violet */
const CRYPT_HAZE = [50, 45, 74];
const FIRE_COLOR = [255, 168, 88];
const RUNE_COLOR = [190, 130, 255];
/* the stairs into the crypt, north of the altar, and where you stand when you come back up */
const ENTRANCE = CRYPT_STAIRS;
const ENTRANCE_ARRIVAL = [ENTRANCE[0], ENTRANCE[1] + 2.4];
/* how far a hero reaches to pull a lever or touch a stone */
const USE_DISTANCE = 2.2;
/* the moon phases on the rune stones, in the order the plaque gives them */
const MOON_ORDER = ["new", "crescent", "half", "full"];
const MOON_NAMES = {
  new: "a dark moon",
  crescent: "a sickle moon",
  half: "a half moon",
  full: "a full moon",
};

const state = {
  walls: [],
  /* light sources for the haze: {x, z, y, radius, color, strength, base, seed, room} */
  lights: [],
  /* things to click: {kind, id, x, z, mesh} */
  objects: [],
  /* fire spots, lit while the hero is down here: {x, z, y, size, room, effect} */
  fires: [],
  doors: {},
  runes: [],
  runeProgress: [],
  spikes: [],
  plates: [],
  arrows: [],
  isInside: false,
  isSanctumDark: false,
  seenRooms: new Set(),
  isTraveling: false,
};

/* ---------------------------------------------------------------- building ---------------------------------- */

const local = (x, z) => cryptPoint(x, z);

/* an invisible box to click on (the click handler skips invisible meshes, so it is merely see-through) */
function hitBox(w, h, d, x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  return mesh;
}

function addObject(kind, id, x, z, size = [1.2, 1.6, 1.2]) {
  const mesh = hitBox(size[0], size[1], size[2], x, z);
  const object = { kind, id, x, z, mesh };
  mesh.userData.cryptObject = object;
  state.objects.push(object);
  return object;
}

function addLight(
  x,
  z,
  { y = 1.2, radius = 5, color = FIRE_COLOR, strength = 0.95, room = null } = {},
) {
  const light = {
    x,
    z,
    y,
    radius,
    color,
    strength,
    /* its strength when burning, and what it flickers around now (0 when put out) */
    full: strength,
    base: strength,
    seed: Math.random() * 10,
    room,
  };
  state.lights.push(light);
  return light;
}

/* a fire with its light: braziers and wall torches */
function addFire(x, z, { y = 1.1, size = 1, radius = 5, room = null } = {}) {
  state.fires.push({ x, z, y, size, room, effect: null });
  return addLight(x, z, { y, radius, room });
}

/* The floor cells that are walls: every cell next to the floor (also diagonally) that is not floor itself, joined
   into as few rectangles as possible (rows first, then equal rows on top of each other). */
function wallRectangles(floor) {
  const isWall = (x, z) => !floor.has(`${x},${z}`);
  const walls = new Set();
  for (const key of floor) {
    const [x, z] = key.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (isWall(x + dx, z + dz)) {
          walls.add(`${x + dx},${z + dz}`);
        }
      }
    }
  }
  /* runs along x, per row */
  const runs = [];
  const byRow = new Map();
  for (const key of walls) {
    const [x, z] = key.split(",").map(Number);
    if (!byRow.has(z)) {
      byRow.set(z, []);
    }
    byRow.get(z).push(x);
  }
  for (const [z, xs] of byRow) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i === xs.length || xs[i] !== xs[i - 1] + 1) {
        runs.push({ x0: start, x1: xs[i - 1] + 1, z0: z, z1: z + 1 });
        start = xs[i];
      }
    }
  }
  /* runs with the same span in neighbouring rows become one rectangle */
  runs.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1 || a.z0 - b.z0);
  const rectangles = [];
  for (const run of runs) {
    const last = rectangles[rectangles.length - 1];
    if (last && last.x0 === run.x0 && last.x1 === run.x1 && last.z1 === run.z0) {
      last.z1 = run.z1;
    } else {
      rectangles.push({ ...run });
    }
  }
  return rectangles;
}

function addWall(rect, obstacles, make = builders.cryptWall) {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const x = (rect.x0 + rect.x1) / 2;
  const z = (rect.z0 + rect.z1) / 2;
  const mesh = make(w, WALL_HEIGHT, d);
  mesh.position.x = x;
  mesh.position.z = z;
  scene.add(mesh);
  state.walls.push(mesh);
  const obstacle = { x, z, r: Math.hypot(w, d) / 2, box: { hw: w / 2, hd: d / 2, cos: 1, sin: 0 } };
  obstacles.push(obstacle);
  return { mesh, obstacle };
}

/* a pixel moon on a 16 × 16 canvas, for the rune stones */
function moonGlyph(phase) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const distance = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (distance > 6.5) {
        continue;
      }
      const isRim = distance > 5.4;
      let isLit;
      if (phase === "full") {
        isLit = true;
      } else if (phase === "half") {
        isLit = x >= 8;
      } else if (phase === "crescent") {
        isLit = Math.hypot(x + 0.5 - 5, y + 0.5 - 8) > 5.6;
      } else {
        isLit = false;
      }
      if (isRim || isLit) {
        ctx.fillStyle = isLit && !isRim ? "#f4ecff" : "#c8b0ff";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds the crypt (world.js calls this with its build context) and the stairs down at the altar.
 * @param {object} context {scene, prop, place, obstacles, pending}
 */
export function buildCrypt({ prop, place, obstacles, pending }) {
  const floor = cryptFloorCells();
  /* the floor: one plane per room; the sanctum gets a red runner up to the throne */
  for (const { rect } of Object.values(CRYPT_ROOMS)) {
    const group = new THREE.Group();
    group.add(builders.cryptFloor(rect[2] - rect[0], rect[3] - rect[1]));
    place(group, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
  }
  const runner = new THREE.Group();
  const carpet = builders.cryptFloor(2.2, 17, "carpet");
  carpet.position.y = 0.01;
  runner.add(carpet);
  place(runner, ...local(-9, -15.5));

  /* the walls; the gates and the cracked wall stand in floor cells of their own */
  for (const rect of wallRectangles(floor)) {
    addWall(rect, obstacles);
  }
  const crack = CRYPT_ROOMS.crack.rect;
  const cracked = addWall(
    { x0: crack[0], x1: crack[2], z0: crack[1], z1: crack[3] },
    obstacles,
    builders.crackedWall,
  );
  cracked.obstacle.isDoor = true;
  state.doors.crack = { ...cracked, kind: "crack", isOpen: false };
  addObject("crack", "crack", cracked.mesh.position.x, cracked.mesh.position.z, [2.2, 2.4, 1.4]);

  buildGate("iron", local(-21, 6.5), 3, Math.PI / 2, obstacles);
  buildGate("sanctum", local(-9, -5), 4, 0, obstacles);

  /* the stairs: down at the altar, up in the entrance hall */
  place(builders.cryptEntrance(), ENTRANCE[0], ENTRANCE[1]);
  addObject("stairs_down", "down", ENTRANCE[0], ENTRANCE[1], [2.4, 1, 2.8]);
  /* against the west wall of the entrance hall, the top step at the wall */
  place(builders.cryptStairsUp(), CRYPT_EXIT[0], CRYPT_EXIT[1], { rotation: Math.PI / 2 });
  addObject("stairs_up", "up", CRYPT_EXIT[0], CRYPT_EXIT[1], [1.6, 1.2, 2.6]);

  /* the entrance hall: two braziers by the stairs (the checkpoint), torches on the north wall */
  for (const x of [-3.5, 3.5]) {
    const [bx, bz] = local(x, 38.5);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, size: 1, radius: 4.2, room: "entry" });
  }
  wallTorches([-3, 3], 32, "entry");
  pending.push(prop("crypt_urn", ...local(-4.2, 33.2), { radius: 0.35, shadow: 0.6, scale: 1 }));
  pending.push(prop("crypt_vase", ...local(4.2, 40.6), { radius: 0.3, shadow: 0.5, scale: 1 }));
  pending.push(prop("crypt_pots", ...local(4.1, 33.4), { radius: 0.45, shadow: 0.8, scale: 1 }));

  /* the Hall of Thralls: pillars, tombs along the north wall, bones */
  for (const [x, z] of [
    [-6, 15.5],
    [6, 15.5],
    [-6, 21.5],
    [6, 21.5],
  ]) {
    place(builders.cryptPillar(WALL_HEIGHT), ...local(x, z), { radius: 0.55 });
  }
  for (const x of [-9, 9]) {
    place(builders.sarcophagus(), ...local(x, 13.6), { rotation: Math.PI / 2 });
  }
  wallTorches([-10, -3, 3, 10], 12, "hall");
  for (const [name, x, z, scale] of [
    ["crypt_bones", -10.5, 23.5, 1],
    ["crypt_skulls", 10.2, 23.2, 0.8],
    ["crypt_horned_skull", 0, 13.4, 0.9],
    ["crypt_hand", -2.5, 23.6, 0.8],
  ]) {
    pending.push(prop(name, ...local(x, z), { radius: 0.4, shadow: 0.9, scale }));
  }

  /* the Tomb of the Fallen: two rows of tombs, an aisle between them */
  for (const x of [20, 26]) {
    for (const z of [15, 21]) {
      place(builders.sarcophagus(), ...local(x, z));
    }
  }
  wallTorches([20, 26], 11, "fallen");
  pending.push(prop("crypt_tombs", ...local(23, 25), { radius: 0.6, shadow: 1, scale: 1 }));
  pending.push(prop("crypt_gold", ...local(27, 12.3), { shadow: 0.6, scale: 1 }));
  pending.push(prop("crypt_chest", ...local(26, 12.2), { radius: 0.4, shadow: 0.6, scale: 1 }));

  /* the Gallery of Traps: spikes, plates and the arrow slits above them */
  for (const [x, offset] of [
    [-16, 0],
    [-24, 1.1],
    [-31, 2.2],
  ]) {
    buildSpikes(...local(x, 18.5), offset);
  }
  for (const x of [-20, -28]) {
    buildPlate(...local(x, 18.5));
  }
  wallTorches([-18, -26, -32], 16, "gallery");

  /* the Forgotten Vault behind the cracked wall */
  for (const [name, x, z, scale] of [
    ["crypt_chest_open", -21, 23.2, 1.2],
    ["crypt_gold", -22.5, 23.4, 1],
    ["crypt_gold", -25.6, 23.2, 1],
    ["crypt_urn", -26.3, 27.2, 1],
    ["crypt_vase", -19.6, 27.3, 1],
  ]) {
    pending.push(prop(name, ...local(x, z), { radius: 0.35, shadow: 0.6, scale }));
  }
  /* the vault's gold only shines once the wall is down: until then it is a dark room you cannot reach */
  state.vaultLight = addLight(...local(-23, 25), {
    y: 0.6,
    radius: 4.5,
    color: [255, 210, 120],
    strength: 0.6,
  });
  state.vaultLight.base = 0;

  /* the Ossuary: the bones of a crowned giant, skull piles, the lever */
  pending.push(
    prop("crypt_bone_king", ...local(-32, 4.6), { radius: 2.6, shadow: 4, scale: 0.75 }),
  );
  for (const [name, x, z, scale] of [
    ["crypt_skulls", -36.3, 14.3, 1],
    ["crypt_skulls", -27.4, 2.6, 0.9],
    ["crypt_skull_maw", -37, 6.5, 1],
    ["crypt_ruin", -27.6, 12.6, 0.8],
    ["crypt_bones", -33, 11, 1],
  ]) {
    pending.push(prop(name, ...local(x, z), { radius: 0.6, shadow: 1, scale }));
  }
  const [leverX, leverZ] = local(-37, 10.5);
  const leverGroup = builders.lever();
  leverGroup.rotation.y = -Math.PI / 2;
  leverGroup.position.set(leverX, 0, leverZ);
  scene.add(leverGroup);
  obstacles.push({ x: leverX, z: leverZ, r: 0.4 });
  state.lever = { group: leverGroup, isPulled: false };
  addObject("lever", "lever", leverX, leverZ, [1, 1.4, 1]);
  wallTorches([-35, -29], 1, "ossuary");
  const [ossuaryX, ossuaryZ] = local(-31, 13.5);
  place(builders.brazier(), ossuaryX, ossuaryZ, { radius: 0.45 });
  addFire(ossuaryX, ossuaryZ, { y: 1.15, size: 1, radius: 4.5, room: "ossuary" });

  /* the Chamber of Runes: four stones and the plaque that tells their order */
  const placement = [
    ["crescent", -14, 0.4],
    ["full", -4, 0.4],
    ["new", -14, 8.4],
    ["half", -4, 8.4],
  ];
  for (const [phase, x, z] of placement) {
    const [wx, wz] = local(x, z);
    const stone = builders.runeStone(moonGlyph(phase));
    stone.position.set(wx, 0, wz);
    scene.add(stone);
    obstacles.push({ x: wx, z: wz, r: 0.5 });
    const rune = { phase, x: wx, z: wz, face: stone.userData.glyph, isLit: false, light: null };
    /* a faint glow even when asleep, so the moons can be read in the dark */
    rune.light = addLight(wx, wz + 0.4, { y: 1, radius: 3.2, color: RUNE_COLOR, strength: 0.3 });
    state.runes.push(rune);
    addObject("rune", phase, wx, wz, [1, 1.6, 1]);
  }
  const plaque = new THREE.Group();
  plaque.add(builders.cryptPillar(1.3));
  const [plaqueX, plaqueZ] = local(-9, -1.2);
  plaque.position.set(plaqueX, 0, plaqueZ);
  scene.add(plaque);
  obstacles.push({ x: plaqueX, z: plaqueZ, r: 0.5 });
  addObject("plaque", "plaque", plaqueX, plaqueZ, [1.2, 1.6, 1.2]);
  wallTorches([-13, -5], -2, "runes");

  /* the Crimson Sanctum: pillars, braziers that go out when the Count calls the dark, his throne */
  for (const x of [-15, -3]) {
    for (const z of [-12, -17.5, -23]) {
      place(builders.cryptPillar(WALL_HEIGHT), ...local(x, z), { radius: 0.55 });
    }
  }
  for (const [x, z] of [
    [-12, -9.5],
    [-6, -9.5],
    [-18, -14.5],
    [0, -14.5],
    [-18, -20.5],
    [0, -20.5],
    [-12, -25.8],
    [-6, -25.8],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, size: 1, radius: 4.2, room: "sanctum" });
  }
  place(builders.throne(), ...local(-9, -26.4));
  pending.push(
    prop("crypt_skulls", ...local(-17.5, -26.6), { radius: 0.6, shadow: 1, scale: 0.9 }),
  );
  pending.push(prop("crypt_skulls", ...local(-0.5, -26.6), { radius: 0.6, shadow: 1, scale: 0.9 }));
}

/* torches on the inside of a wall that runs along x at crypt z `wallZ` (they face the camera, +z) */
function wallTorches(xs, wallZ, room) {
  for (const x of xs) {
    const [tx, tz] = local(x, wallZ);
    const torch = builders.wallTorch();
    torch.position.set(tx, 0, tz);
    scene.add(torch);
    addFire(tx, tz + 0.3, { y: 1.85, size: 0.55, radius: 4, room });
  }
}

function buildGate(id, [x, z], width, rotation, obstacles) {
  const group = builders.ironGate(width, WALL_HEIGHT);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
  const along = Math.abs(Math.sin(rotation)) > 0.5;
  const obstacle = {
    x,
    z,
    r: width / 2,
    box: { hw: along ? 0.2 : width / 2, hd: along ? width / 2 : 0.2, cos: 1, sin: 0 },
    isDoor: true,
  };
  obstacles.push(obstacle);
  state.doors[id] = {
    kind: "gate",
    group,
    bars: group.userData.bars,
    obstacle,
    isOpen: false,
    rise: 0,
  };
}

function buildSpikes(x, z, offset) {
  const group = builders.spikeTrap(1.8);
  group.position.set(x, 0, z);
  scene.add(group);
  state.spikes.push({
    x,
    z,
    half: 0.9,
    spikes: group.userData.spikes,
    offset,
    wasUp: false,
    hitAt: 0,
  });
}

function buildPlate(x, z) {
  const group = builders.pressurePlate(1.1);
  group.position.set(x, 0, z);
  scene.add(group);
  /* the slit in the north wall of the gallery that the arrows come from */
  const [, slitZ] = local(0, 16.05);
  state.plates.push({ x, z, plate: group.userData.plate, slitZ, armedAt: 0, isDown: false });
}

/* ---------------------------------------------------------------- using things ------------------------------ */

/** The clickable meshes of the crypt (stairs, lever, rune stones, plaque, cracked wall). */
export const cryptClickables = () => state.objects.map((object) => object.mesh);

/** Can this hero go down? Only once the dire boar is dead, the runes woke up then (or for the admin). */
const mayEnter = () => ADMIN.noclip || player.quests?.rolf_dire_boar?.state === "done";

/** Clicked a crypt object: walk to it, then use it. */
export function clickCryptObject(object) {
  const use = () => useObject(object);
  if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE) {
    use();
    return;
  }
  const dx = player.x - object.x;
  const dz = player.z - object.z;
  const length = Math.hypot(dx, dz) || 1;
  player.destination = [object.x + (dx / length) * 1.4, object.z + (dz / length) * 1.4];
  player.onArrive = () => {
    if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE + 0.6) {
      use();
    }
  };
  player.target = null;
}

function useObject(object) {
  switch (object.kind) {
    case "stairs_down":
      if (!mayEnter()) {
        UI.systemMessage(
          "Steps lead down into the dark, but the runes are cold. Something still guards this place.",
        );
        return;
      }
      travel(CRYPT_ENTRY, "The Sunken Crypt", "Beneath the old altar. Keep your torch high.");
      return;
    case "stairs_up":
      travel(ENTRANCE_ARRIVAL, "Whisperwood", "Fresh air, and the old altar above the stairs.");
      return;
    case "lever":
      pullLever();
      return;
    case "rune":
      touchRune(state.runes.find((rune) => rune.phase === object.id));
      return;
    case "plaque":
      UI.announce(
        "The Moon Wakes the Dead",
        "First the dark moon, then the sickle, the half, and last the full.",
      );
      UI.systemMessage(
        'The plaque reads: "First the dark moon, then the sickle, then the half, and last the full: so the moon wakes the dead."',
      );
      return;
    case "crack":
      if (!state.doors.crack.isOpen) {
        openDoor("crack");
      }
      return;
  }
}

/* black for a moment, then somewhere else */
function travel([x, z], title, subtitle) {
  if (state.isTraveling) {
    return;
  }
  state.isTraveling = true;
  let fade = document.getElementById("travel-fade");
  if (!fade) {
    fade = document.createElement("div");
    fade.id = "travel-fade";
    document.body.appendChild(fade);
  }
  fade.classList.add("on");
  sfx.bossSlam();
  setTimeout(() => {
    player.x = x;
    player.z = z;
    player.destination = null;
    player.onArrive = null;
    player.target = null;
    player.sprite.group.position.set(x, 0, z);
    cameraState.target.set(x, 0, z);
    UI.announce(title, subtitle);
    fade.classList.remove("on");
    state.isTraveling = false;
  }, 450);
}

function pullLever() {
  if (state.lever.isPulled) {
    UI.systemMessage("The lever is already down. Somewhere, a gate stands open.");
    return;
  }
  openDoor("iron");
}

function touchRune(rune) {
  if (!rune || state.doors.sanctum.isOpen) {
    return;
  }
  if (rune.isLit) {
    UI.systemMessage(`The stone with ${MOON_NAMES[rune.phase]} already glows.`);
    return;
  }
  const expected = MOON_ORDER[state.runeProgress.length];
  if (rune.phase !== expected) {
    /* the wrong moon: a jolt, and every stone goes dark again */
    UI.systemMessage(
      `You touch the stone with ${MOON_NAMES[rune.phase]}. It spits violet sparks at you.`,
    );
    takeDamage(Math.round(hpMax() * 0.08), null, null);
    burst(rune.x, 1, rune.z + 0.3, { color: 0xc89bff, count: 16, speed: 4 });
    sfx.bossWarn();
    for (const other of state.runes) {
      setRuneLit(other, false);
    }
    state.runeProgress = [];
    return;
  }
  setRuneLit(rune, true);
  state.runeProgress.push(rune.phase);
  sfx.chime();
  UI.systemMessage(`The stone with ${MOON_NAMES[rune.phase]} starts to glow.`);
  if (state.runeProgress.length === MOON_ORDER.length) {
    setTimeout(() => openDoor("sanctum"), 500);
  }
}

function setRuneLit(rune, isLit) {
  rune.isLit = isLit;
  rune.face.material.color.set(isLit ? 0xffffff : 0x9a8ab8);
  rune.light.base = isLit ? 0.9 : 0.3;
  if (isLit) {
    groundRing(rune.x, rune.z, 0xb07cff, 0.4, 1.6, 0.5, 0.8);
  }
}

/**
 * Opens a gate, pulls the lever with it or crumbles the cracked wall. `isFromOthers`: another player did it (no
 * message to the others again).
 */
export function openDoor(id, isFromOthers = false) {
  const door = state.doors[id];
  if (!door || door.isOpen) {
    return;
  }
  door.isOpen = true;
  door.obstacle.isOpen = true;
  const isNear = Math.hypot(door.obstacle.x - player.x, door.obstacle.z - player.z) < 20;
  if (id === "iron" && state.lever) {
    state.lever.isPulled = true;
    state.lever.group.userData.handle.rotation.x = 0.6;
  }
  if (id === "sanctum") {
    for (const rune of state.runes) {
      setRuneLit(rune, true);
    }
  }
  if (door.kind === "crack") {
    /* the wall crumbles: rubble and dust, and the way is free */
    door.mesh.visible = false;
    state.vaultLight.base = state.vaultLight.full;
    playEffect("rubble", door.obstacle.x, door.obstacle.z, { size: 2.6, grounded: true });
    burst(door.obstacle.x, 1, door.obstacle.z, { color: 0x6a6480, count: 24, speed: 4, size: 3 });
    if (isNear) {
      shakeCamera(0.3, 0.35);
      sfx.bossSlam();
    }
    if (!isFromOthers) {
      UI.systemMessage(
        "You put your shoulder to the cracked wall. It gives way to a hidden vault.",
      );
    }
  } else if (isNear) {
    shakeCamera(0.15, 1.2);
    sfx.bossWarn();
  }
  if (!isFromOthers) {
    if (id === "iron") {
      UI.systemMessage("The lever grinds down. Far off, iron scrapes against stone: a gate rises.");
    }
    if (id === "sanctum") {
      UI.announce("The Way Is Open", "Behind the runes, something old wakes up.");
      screenFlash("200, 140, 255");
    }
    game.network.send("crypt_open", { door: id });
  }
}

/** The Count calls the dark: the sanctum's fires go out (and come back when the fight is over). */
export function setSanctumDark(isDark) {
  if (state.isSanctumDark === isDark) {
    return;
  }
  state.isSanctumDark = isDark;
  for (const fire of state.fires) {
    if (fire.room !== "sanctum") {
      continue;
    }
    if (isDark && fire.effect) {
      fire.effect.stop();
      fire.effect = null;
      burst(fire.x, fire.y, fire.z, { color: 0x6a6480, count: 6, speed: 1.5 });
    } else if (!isDark && state.isInside && !fire.effect) {
      fire.effect = startFire(fire);
    }
  }
  for (const light of state.lights) {
    if (light.room === "sanctum") {
      light.base = isDark ? 0 : light.full;
    }
  }
}

/** Where a hero who fell in the crypt comes back: at the braziers by the stairs. */
export const cryptRespawnPoint = () => CRYPT_ENTRY;

/* ---------------------------------------------------------------- every frame -------------------------------- */

function startFire(fire) {
  /* the flames stand on the coals (fire.y) */
  return playEffect("fire", fire.x, fire.z, {
    size: fire.size,
    y: fire.y - 0.08,
    grounded: true,
    loop: true,
  });
}

/* lights and fires only burn while the hero is down here */
function setInside(isInside) {
  state.isInside = isInside;
  for (const fire of state.fires) {
    if (isInside && !fire.effect && !(state.isSanctumDark && fire.room === "sanctum")) {
      fire.effect = startFire(fire);
    } else if (!isInside && fire.effect) {
      fire.effect.stop();
      fire.effect = null;
    }
  }
  game.daylight.setIndoor(isInside ? { haze: CRYPT_HAZE, lights: state.lights } : null);
  if (!isInside) {
    for (const wall of state.walls) {
      setWallFaded(wall, false);
    }
  }
}

function setWallFaded(wall, isFaded) {
  if (!!wall.userData.isFaded === isFaded) {
    return;
  }
  wall.userData.isFaded = isFaded;
  wall.material.transparent = isFaded;
  wall.material.opacity = isFaded ? 0.28 : 1;
  wall.material.depthWrite = !isFaded;
  wall.material.needsUpdate = true;
}

/* walls between the camera and the hero (or a monster the hero fights) turn see-through */
const raycaster = new THREE.Raycaster();
const probe = new THREE.Vector3();
const ndc = new THREE.Vector2();
function fadeWallsInFront() {
  const faded = new Set();
  const targets = [player];
  if (player.target && !player.target.isDead) {
    targets.push(player.target);
  }
  for (const target of targets) {
    for (const [side, height] of [
      [0, 0.25],
      [0, 1],
      [0, 1.7],
      [-0.5, 1],
      [0.5, 1],
    ]) {
      probe.set(target.x, height, target.z).addScaledVector(cameraState.right, side);
      const distance = probe.distanceTo(camera.position);
      probe.project(camera);
      ndc.set(probe.x, probe.y);
      raycaster.setFromCamera(ndc, camera);
      for (const hit of raycaster.intersectObjects(state.walls, false)) {
        if (hit.distance < distance - 0.2) {
          faded.add(hit.object);
        }
      }
    }
  }
  for (const wall of state.walls) {
    setWallFaded(wall, faded.has(wall));
  }
}

function updateDoors(dt) {
  for (const door of Object.values(state.doors)) {
    if (door.kind === "gate" && door.isOpen && door.rise < 1) {
      door.rise = Math.min(1, door.rise + dt / 1.6);
      door.bars.position.y = door.rise * (WALL_HEIGHT - 0.25);
    }
  }
}

const isOnSquare = (thing, half) =>
  Math.abs(player.x - thing.x) < half && Math.abs(player.z - thing.z) < half;

function updateTraps(dt, time) {
  /* spikes: up for 0.9 s every 3.2 s */
  for (const trap of state.spikes) {
    const phase = (time + trap.offset) % 3.2;
    const isUp = phase < 0.9;
    const target = isUp ? 0 : -0.5;
    trap.spikes.position.y += (target - trap.spikes.position.y) * Math.min(1, dt * (isUp ? 30 : 6));
    const isNear = Math.hypot(trap.x - player.x, trap.z - player.z) < 9;
    if (isUp && !trap.wasUp && isNear) {
      sfx.snip();
    }
    trap.wasUp = isUp;
    if (isUp && phase < 0.6 && isOnSquare(trap, trap.half + 0.15) && time - trap.hitAt > 1) {
      trap.hitAt = time;
      takeDamage(Math.round(hpMax() * 0.12), null, null);
      burst(player.x, 0.4, player.z, { color: 0xc8ccd8, count: 8, speed: 3 });
    }
  }
  /* pressure plates: step on one and arrows fly from the slit in the north wall */
  for (const plate of state.plates) {
    const isPressed = isOnSquare(plate, 0.6);
    plate.plate.position.y +=
      ((isPressed ? 0.01 : 0.04) - plate.plate.position.y) * Math.min(1, dt * 20);
    if (isPressed && time >= plate.armedAt && !plate.isDown) {
      plate.isDown = true;
      plate.armedAt = time + 3;
      sfx.click();
      for (const dx of [-0.35, 0.35]) {
        state.arrows.push({
          x: plate.x + dx,
          z: plate.slitZ,
          toZ: plate.z + 2.6,
          t: -0.15 - Math.abs(dx) * 0.2,
          mesh: null,
          plate,
        });
      }
    }
    if (!isPressed) {
      plate.isDown = false;
    }
  }
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const arrow = state.arrows[i];
    arrow.t += dt;
    if (arrow.t < 0) {
      continue;
    }
    if (!arrow.mesh) {
      arrow.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xc8b090 }),
      );
      scene.add(arrow.mesh);
      sfx.swing();
    }
    const z = arrow.z + arrow.t * 18;
    arrow.mesh.position.set(arrow.x, 1, z);
    trail(arrow.x, 1, z, 0xd8c8a8);
    if (!arrow.hasHit && Math.abs(player.x - arrow.x) < 0.45 && Math.abs(player.z - z) < 0.5) {
      arrow.hasHit = true;
      takeDamage(Math.round(hpMax() * 0.07), null, null);
    }
    if (z >= arrow.toZ) {
      scene.remove(arrow.mesh);
      arrow.mesh.geometry.dispose();
      state.arrows.splice(i, 1);
    }
  }
}

/* the rooms' names, the first time the hero walks into one */
function announceRooms() {
  const key = cryptRoomAt(player.x, player.z);
  const room = key && CRYPT_ROOMS[key];
  if (!room || !room.name || state.seenRooms.has(key)) {
    return;
  }
  state.seenRooms.add(key);
  if (key !== "entry") {
    UI.announce(room.name);
  }
}

/** Per frame: the crypt's lights, see-through walls, gates and traps, while the hero is down here. */
export function updateCrypt(dt) {
  const isInside = inCrypt(player.x, player.z);
  if (isInside !== state.isInside) {
    setInside(isInside);
  }
  if (!isInside) {
    return;
  }
  const time = now();
  for (const light of state.lights) {
    /* a fire flickers: two waves and a little noise */
    const flicker =
      light.color === FIRE_COLOR
        ? 0.86 +
          Math.sin(time * 7.3 + light.seed) * 0.07 +
          Math.sin(time * 13.1 + light.seed * 2) * 0.05
        : 0.9 + Math.sin(time * 2 + light.seed) * 0.1;
    light.strength += (light.base * flicker - light.strength) * Math.min(1, dt * 8);
  }
  fadeWallsInFront();
  updateDoors(dt);
  updateTraps(dt, time);
  announceRooms();
}

/** The hero's own light: a torch down here, a soft glow at night above. */
export function heroLightIn(isDown, light) {
  if (!isDown) {
    return light;
  }
  const time = now();
  light.radius = 3.8;
  light.color = [255, 196, 130];
  light.strength = 0.8 + Math.sin(time * 9) * 0.04 + Math.sin(time * 15.7) * 0.03;
  light.y = 1.2;
  return light;
}

/** Is the hero in the crypt (for the zone, the map and the hero's torch)? */
export const isHeroInCrypt = () => state.isInside;
