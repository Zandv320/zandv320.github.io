/* Eldoria – the Forge of the First Flame inside Mount Kharos. rules/forge.js has its halls; this file builds them
   (basalt floor and walls, braziers, the lava channels of the Lava Run, the bellows, the First Forge, the gate to the
   Heart of Kharos with its pillars and the fire seal) and runs what happens down there: the dark with its fires and
   lava light, walls that fade when they stand in front of the hero, the way in at the Gate of Kharos and out again,
   the channels that surge over their banks, the three bellows plates, the forge that the bellows wake and that opens
   the Heart, and the fire seal's ritual. What a hero has done here (pumped the bellows, lit the forge) comes back
   from their quests; for a hero without them it lasts this session. */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  FORGE_ROOMS,
  FORGE_ENTRY,
  FORGE_EXIT,
  LAVA_CHANNELS,
  SURGE,
  BELLOWS_PLATES,
  GREAT_FORGE,
  SANCTUM_GATE,
  SANCTUM_PILLARS,
  PILLAR_RADIUS,
  FIRE_SEAL,
  forgeFloorCells,
  forgePoint,
  forgeRoomAt,
  inForge,
  surgePhase,
  isSurging,
} from "./rules/forge.js";
import { EMBER_LANDS, MOUNT_KHAROS, kharosRadius } from "./rules/ember.js";
import { QUESTS } from "./rules/quests.js";
import { player, game, now, hpMax, playEffect, ADMIN } from "./game-state.js";
import { addFxPlace } from "./weapon-fx.js";
import { scene, camera, cameraState, shakeCamera } from "./world.js";
import { takeDamage } from "./player.js";
import { burst } from "./particles.js";
import { groundRing } from "./skill-effects.js";
import { screenFlash } from "./feel.js";
import { wallRectangles, travel } from "./crypt.js";
import { lavaTexture } from "./ember.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const WALL_HEIGHT = 2.6;
/* the haze down here: almost black, a deep ember red */
const FORGE_HAZE = [96, 54, 40];
const FIRE_COLOR = [255, 168, 88];
const LAVA_COLOR = [255, 110, 50];
const EMBER_COLOR = 0xff8a2a;
/* how far a hero reaches to use the forge or lay a hand on the seal */
const USE_DISTANCE = 2.6;

const state = {
  walls: [],
  /* light sources for the haze: {x, z, y, radius, color, strength, base, seed} */
  lights: [],
  /* things to click: {kind, x, z, mesh} */
  objects: [],
  /* fire spots, lit while the hero is down here: {x, z, y, size, effect} */
  fires: [],
  channels: [],
  plates: [],
  gate: null,
  forge: null,
  seal: null,
  isBellowsAwake: false,
  isForgeLit: false,
  isWaking: false,
  isInside: false,
  seenRooms: new Set(),
  singedAt: 0,
};

const local = (x, z) => forgePoint(x, z);

/* ---------------------------------------------------------------- building ---------------------------------- */

/* an invisible box to click on (see-through, not invisible: the click handler skips invisible meshes) */
function addObject(kind, x, z, [w, h, d] = [1.6, 1.8, 1.6]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  const object = { kind, x, z, mesh };
  mesh.userData.forgeObject = object;
  state.objects.push(object);
  return object;
}

function addLight(x, z, { y = 1.2, radius = 5, color = FIRE_COLOR, strength = 0.95 } = {}) {
  const light = { x, z, y, radius, color, strength, base: strength, seed: Math.random() * 10 };
  state.lights.push(light);
  return light;
}

/* a fire with its light: braziers */
function addFire(x, z, { y = 1.1, size = 1, radius = 5 } = {}) {
  const fire = { x, z, y, size, effect: null };
  state.fires.push(fire);
  /* flames and embers over it, like a flame enchantment's, while it burns */
  addFxPlace({
    element: "hearth",
    x,
    y,
    z,
    spread: 0.18 * size,
    rate: 0.6 * size,
    active: () => !!fire.effect,
  });
  return addLight(x, z, { y, radius });
}

function addWall(rect, obstacles) {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const x = (rect.x0 + rect.x1) / 2;
  const z = (rect.z0 + rect.z1) / 2;
  const mesh = builders.cryptWall(w, WALL_HEIGHT, d, "basalt");
  mesh.position.x = x;
  mesh.position.z = z;
  scene.add(mesh);
  state.walls.push(mesh);
  obstacles.push({ x, z, r: Math.hypot(w, d) / 2, box: { hw: w / 2, hd: d / 2, cos: 1, sin: 0 } });
}

/* a pixel flame on a 16 × 16 canvas, for the fire seal's rune stones */
function flameGlyph() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const rows = [
    "................",
    ".......o........",
    "......oo........",
    "......ooo.......",
    ".....oooo..o....",
    ".....oOoo.oo....",
    "....ooOOooooo...",
    "....oOOOOoooo...",
    "...ooOOYOOOooo..",
    "...oOOYYYOOOoo..",
    "...oOOYYYYOOOo..",
    "...oOOYYYYOOOo..",
    "....oOOYYOOOo...",
    ".....ooOOOoo....",
    "......oooo......",
    "................",
  ];
  const colors = { o: "#c8441e", O: "#ff8a2a", Y: "#ffe070" };
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (colors[cell]) {
        ctx.fillStyle = colors[cell];
        ctx.fillRect(x, y, 1, 1);
      }
    }),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds the forge (world.js calls this with its build context).
 * @param {object} context {scene, prop, place, obstacles, pending}
 */
export function buildForge({ prop, place, obstacles, pending }) {
  const floor = forgeFloorCells();
  /* the floor: basalt, one plane per hall */
  for (const { rect } of Object.values(FORGE_ROOMS)) {
    const group = new THREE.Group();
    group.add(builders.cryptFloor(rect[2] - rect[0], rect[3] - rect[1], "basalt"));
    place(group, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
  }
  for (const rect of wallRectangles(floor)) {
    addWall(rect, obstacles);
  }

  /* the Gate Hall: stairs up to the Gate of Kharos against the west wall, braziers by the way in */
  place(builders.cryptStairsUp(), ...FORGE_EXIT, { rotation: Math.PI / 2 });
  addObject("exit", ...FORGE_EXIT, [1.6, 1.2, 2.6]);
  for (const [x, z] of [
    [-4.5, 37.5],
    [4.5, 37.5],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, radius: 5.5 });
  }
  pending.push(prop("ember_skull", ...local(4.6, 44.6), { radius: 0.3, shadow: 0.5, scale: 0.6 }));
  pending.push(prop("ember_rock2", ...local(-4.6, 44.8), { radius: 0.3, shadow: 0.5, scale: 0.7 }));
  /* outside, the Gate of Kharos itself is the way in */
  const [gateX, gateZ] = gateFront();
  addObject("enter", gateX, gateZ, [4, 5, 2]);

  buildChannels();
  for (const [x, z] of [
    [-10.5, 28.5],
    [10.5, 28.5],
    [-10.5, 11.5],
    [10.5, 11.5],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, radius: 5.5 });
  }

  /* the Hall of Bellows: a pair of bellows beside every plate, braziers in the corners */
  for (const [x, z] of BELLOWS_PLATES) {
    const plate = builders.pressurePlate(1.4);
    plate.position.set(x, 0, z);
    scene.add(plate);
    const bellows = builders.bellows();
    /* beside the plate, blowing east */
    bellows.position.set(x + 2, 0, z);
    bellows.rotation.y = Math.PI / 2;
    scene.add(bellows);
    obstacles.push({ x: x + 2, z, r: 0.85 });
    state.plates.push({
      x,
      z,
      plate: plate.userData.plate,
      bellows,
      standFor: 0,
      isPressed: false,
    });
  }
  for (const [x, z] of [
    [17.5, 9.5],
    [30.5, 9.5],
    [17.5, 26.5],
    [30.5, 26.5],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, radius: 5.5 });
  }

  /* the First Forge: the great hearth against the north wall, anvils before it */
  const forgeGroup = builders.forge();
  forgeGroup.scale.setScalar(2.2);
  place(forgeGroup, ...GREAT_FORGE, { radius: 2.2 });
  const coals = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1.9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3a1c14, transparent: true }),
  );
  coals.position.set(GREAT_FORGE[0], 2.03, GREAT_FORGE[1] + 0.22);
  /* over the night haze once it burns */
  coals.renderOrder = 10002;
  scene.add(coals);
  state.forge = {
    coals,
    light: addLight(GREAT_FORGE[0], GREAT_FORGE[1] + 1.5, {
      y: 1.6,
      radius: 9,
      strength: 0,
    }),
    effect: null,
  };
  addObject("forge", GREAT_FORGE[0], GREAT_FORGE[1] + 1.2, [4.4, 3.6, 3]);
  for (const [x, z] of [
    [-28, 15],
    [-22, 15.5],
  ]) {
    pending.push(prop("anvil", ...local(x, z), { radius: 0.5, shadow: 0.8, scale: 1 }));
  }
  pending.push(prop("crypt_crates", ...local(-32.5, 26.5), { radius: 0.7, scale: 0.9 }));
  pending.push(prop("woodpile", ...local(-17.8, 26.4), { radius: 0.6 }));
  for (const [x, z] of [
    [-32.5, 9.5],
    [-17.5, 9.5],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, radius: 5.5 });
  }

  /* the gate to the Heart of Kharos, across the passage's north end */
  const gate = builders.ironGate(6, WALL_HEIGHT);
  gate.position.set(SANCTUM_GATE[0], 0, SANCTUM_GATE[1]);
  scene.add(gate);
  const gateObstacle = {
    x: SANCTUM_GATE[0],
    z: SANCTUM_GATE[1],
    r: 3,
    box: { hw: 3, hd: 0.2, cos: 1, sin: 0 },
    isDoor: true,
  };
  obstacles.push(gateObstacle);
  state.gate = { bars: gate.userData.bars, obstacle: gateObstacle, isOpen: false, rise: 0 };

  /* the Heart of Kharos: four pillars, pools of lava in its corners, the fire seal at the north end */
  for (const [x, z] of SANCTUM_PILLARS) {
    place(builders.cryptPillar(WALL_HEIGHT), x, z, { radius: PILLAR_RADIUS });
  }
  buildPools();
  for (const [x, z] of [
    [-12, -2],
    [12, -2],
    [-3.5, -12.5],
    [3.5, -12.5],
    [-12, -16],
    [12, -16],
    [-4.5, -24.5],
    [4.5, -24.5],
  ]) {
    const [bx, bz] = local(x, z);
    place(builders.brazier(), bx, bz, { radius: 0.45 });
    addFire(bx, bz, { y: 1.15, radius: 5.5 });
  }
  place(builders.altar(), ...FIRE_SEAL, { radius: 1.6 });
  const glyph = flameGlyph();
  const runes = [];
  for (let k = 0; k < 4; k++) {
    /* on the diagonals round the altar, clear of the north wall */
    const angle = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const x = FIRE_SEAL[0] + Math.cos(angle) * 2.8;
    const z = FIRE_SEAL[1] + Math.sin(angle) * 2.4;
    const stone = builders.runeStone(glyph);
    stone.position.set(x, 0, z);
    stone.rotation.y = Math.atan2(FIRE_SEAL[0] - x, FIRE_SEAL[1] - z) + Math.PI;
    scene.add(stone);
    obstacles.push({ x, z, r: 0.5 });
    stone.userData.glyph.material.color.set(0xb06a48);
    runes.push({ x, z, face: stone.userData.glyph });
    addLight(x, z, { y: 1, radius: 2.6, color: LAVA_COLOR, strength: 0.3 });
  }
  state.seal = { runes, light: addLight(...FIRE_SEAL, { y: 1.2, radius: 6, strength: 0.35 }) };
  addObject("seal", FIRE_SEAL[0], FIRE_SEAL[1], [3.4, 1.6, 2.6]);
}

/* the lava texture, drawn once and repeated rx × ry times on each surface */
let lavaImage = null;
function lavaMap(rx, ry) {
  lavaImage ??= lavaTexture();
  const map = lavaImage.clone();
  map.repeat.set(rx, ry);
  map.needsUpdate = true;
  return map;
}

/* the Lava Run's channels: a crust that glows in its cracks, and the lava that surges over it */
function buildChannels() {
  for (const channel of LAVA_CHANNELS) {
    const width = channel.x1 - channel.x0;
    const crustMap = lavaMap(width / 4, (channel.halfWidth * 2) / 4);
    const crust = new THREE.Mesh(
      new THREE.PlaneGeometry(width, channel.halfWidth * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: crustMap, color: 0x5a2a1c }),
    );
    crust.position.set((channel.x0 + channel.x1) / 2, 0.02, channel.z);
    scene.add(crust);
    const surgeMap = lavaMap(width / 4, (channel.halfWidth * 2 * SURGE_SPREAD) / 4);
    const lava = new THREE.Mesh(
      new THREE.PlaneGeometry(width, channel.halfWidth * 2 * SURGE_SPREAD).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: surgeMap, transparent: true, opacity: 0 }),
    );
    lava.position.set((channel.x0 + channel.x1) / 2, 0.04, channel.z);
    /* drawn over the haze: it glows */
    lava.renderOrder = 10002;
    scene.add(lava);
    const lights = [-0.33, 0, 0.33].map((share) =>
      addLight(channel.x0 + width * (0.5 + share), channel.z, {
        y: 0.4,
        radius: 5,
        color: LAVA_COLOR,
        strength: 0.35,
      }),
    );
    state.channels.push({ channel, crust, lava, lights, wasSurging: false });
  }
}
/* how far over its banks a channel surges: this many times its own width */
const SURGE_SPREAD = 1.9;

/* glowing pools of lava in the Heart's corners, for its light */
function buildPools() {
  for (const [x, z, r] of [
    [-13, -23, 2.2],
    [13, -23, 2.2],
    [-13, -9, 1.6],
    [13, -9, 1.6],
  ]) {
    const map = lavaMap(r / 2, r / 2);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map, transparent: true }),
    );
    const [px, pz] = local(x, z);
    pool.position.set(px, 0.03, pz);
    pool.renderOrder = 10002;
    scene.add(pool);
    addLight(px, pz, { y: 0.4, radius: r + 4, color: LAVA_COLOR, strength: 0.6 });
  }
}

export const forgeClickables = () => state.objects.map((object) => object.mesh);

/* ---------------------------------------------------------------- the way in and out ------------------------- */

/** May this hero go in? Once the gate has woken (The Gate of Kharos is done), or for the admin. */
const mayEnter = () => ADMIN.noclip || player.quests?.edda_gate?.state === "done";

/* the door of the Gate of Kharos (where ember.js sets it into the slope), and a little in front of it */
function gateFront(away = 1.6) {
  const [x, z] = EMBER_LANDS.gate.center;
  const bearing = Math.atan2(x - MOUNT_KHAROS.x, z - MOUNT_KHAROS.z);
  const into = kharosRadius(bearing, 0) - 1.2 + away;
  return [MOUNT_KHAROS.x + Math.sin(bearing) * into, MOUNT_KHAROS.z + Math.cos(bearing) * into];
}
/* where a hero stands when they come out of the gate */
const outsideGate = () => gateFront(4.5);

/** Clicked something of the forge (or the Gate of Kharos outside): walk to it, then use it. */
export function clickForgeObject(object) {
  const use = () => useObject(object);
  if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE) {
    use();
    return;
  }
  const dx = player.x - object.x;
  const dz = player.z - object.z;
  const length = Math.hypot(dx, dz) || 1;
  player.destination = [object.x + (dx / length) * 1.8, object.z + (dz / length) * 1.8];
  player.onArrive = () => {
    if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE + 0.8) {
      use();
    }
  };
  player.target = null;
}

function useObject(object) {
  switch (object.kind) {
    case "enter":
      if (!mayEnter()) {
        UI.systemMessage(
          "The door is carved from one block of stone, its runes cold. It does not move.",
        );
        return;
      }
      travel(
        FORGE_ENTRY,
        "The Forge of the First Flame",
        "Heat, and the sound of hammering far below.",
      );
      return;
    case "exit":
      travel(outsideGate(), "The Gate of Kharos", "Cool air, ash, and the sea far below.");
      return;
    case "forge":
      useForge();
      return;
    case "seal":
      touchSeal();
      return;
  }
}

/* ---------------------------------------------------------------- the bellows and the forge ------------------ */

const isQuestDone = (id) => player.quests?.[id]?.state === "done";

/* the bellows and the forge as the hero left them: pumped and lit for good once their quests are done */
function restoreProgress() {
  if (isQuestDone("orven_bellows") && !state.isBellowsAwake) {
    state.isBellowsAwake = true;
    for (const plate of state.plates) {
      plate.isPressed = true;
    }
  }
  if (isQuestDone("orven_forge") && !state.isForgeLit) {
    lightForge(true);
  }
}

function pressPlate(plate) {
  plate.isPressed = true;
  sfx.click();
  /* the bellows heave, and fire roars up beside them */
  playEffect("fire", plate.x + 3.4, plate.z, { size: 1.6, grounded: true });
  burst(plate.x + 3.2, 0.8, plate.z, { color: EMBER_COLOR, count: 18, speed: 4, size: 3 });
  shakeCamera(0.08, 0.25);
  const left = state.plates.filter((other) => !other.isPressed).length;
  if (left > 0) {
    UI.systemMessage(
      `The plate sinks under your feet and the bellows heave. ${left === 1 ? "One more." : `${left} more.`}`,
    );
    return;
  }
  state.isBellowsAwake = true;
  UI.announce("The Bellows Breathe", "Far to the west, the First Forge draws breath.");
  sfx.bossWarn();
  game.questLog.onRitual("bellows");
}

function useForge() {
  if (state.isForgeLit) {
    UI.systemMessage("The First Forge roars. Its heat beats on your face like a drum.");
    return;
  }
  if (!state.isBellowsAwake) {
    UI.systemMessage(
      "The great hearth is cold and black. Somewhere, the bellows that fed it must breathe again first.",
    );
    return;
  }
  lightForge(false);
}

/* the forge catches: fire in the hearth, and far off the gate to the Heart of Kharos rises */
function lightForge(isRestoring) {
  state.isForgeLit = true;
  state.forge.coals.material.color.set(0xff7a2a);
  state.forge.light.base = 1;
  if (state.isInside) {
    startForgeFire();
  }
  openGate(isRestoring);
  if (isRestoring) {
    return;
  }
  groundRing(GREAT_FORGE[0], GREAT_FORGE[1] + 1.5, EMBER_COLOR, 0.5, 6, 1, 0.9);
  burst(GREAT_FORGE[0], 2.2, GREAT_FORGE[1] + 0.5, {
    color: EMBER_COLOR,
    count: 40,
    speed: 6,
    size: 4,
  });
  screenFlash("255, 150, 60");
  shakeCamera(0.3, 0.8);
  sfx.bossIntro();
  UI.announce("The First Flame", "The forge catches. Far off, iron grinds against stone.");
  game.questLog.onRitual("forge");
}

function startForgeFire() {
  if (!state.forge.effect) {
    state.forge.effect = playEffect("fire", GREAT_FORGE[0], GREAT_FORGE[1] + 0.3, {
      size: 2.4,
      y: 1.95,
      grounded: true,
      loop: true,
    });
  }
}

function openGate(isRestoring) {
  if (state.gate.isOpen) {
    return;
  }
  state.gate.isOpen = true;
  state.gate.obstacle.isOpen = true;
  if (isRestoring) {
    state.gate.rise = 1;
    state.gate.bars.position.y = WALL_HEIGHT - 0.25;
  }
}

/* ---------------------------------------------------------------- the fire seal ------------------------------ */

/* Is the fire seal's ritual waiting for this hero? */
const isRitualWaiting = () =>
  Object.entries(player.quests || {}).some(([id, record]) => {
    const goal = QUESTS[id]?.goal;
    return (
      record.state === "active" && !record.count && goal?.type === "ritual" && goal.seal === "ember"
    );
  });

function touchSeal() {
  if (state.isWaking) {
    return;
  }
  if (!isRitualWaiting()) {
    UI.systemMessage(
      (player.runes || []).includes("ember")
        ? "The flame runes glow warm under your hand. The seal holds."
        : "Four stones carved with flames stand round the altar. The fire in them is low, as if it waits.",
    );
    return;
  }
  state.isWaking = true;
  player.destination = null;
  UI.systemMessage(
    "You lay your hand on the altar. Heat runs up your arm, and the flame runes stir.",
  );
  state.seal.runes.forEach((rune, k) => {
    setTimeout(
      () => {
        rune.face.material.color.set(0xffffff);
        groundRing(rune.x, rune.z, EMBER_COLOR, 0.2, 1.2, 0.7, 0.9);
        playEffect("fire", rune.x, rune.z, { size: 1.2, grounded: true });
        burst(rune.x, 1, rune.z, { color: EMBER_COLOR, count: 12, speed: 3 });
        sfx.chime();
        UI.systemMessage(
          ["The first flame wakes.", "The second wakes.", "The third.", "The fourth."][k],
        );
      },
      600 + k * 700,
    );
  });
  setTimeout(
    () => {
      groundRing(FIRE_SEAL[0], FIRE_SEAL[1], EMBER_COLOR, 0.5, 7, 1.2, 0.9);
      playEffect("light_rays", FIRE_SEAL[0], FIRE_SEAL[1], {
        size: 4,
        grounded: true,
        tint: EMBER_COLOR,
      });
      state.seal.light.base = 1;
      screenFlash("255, 160, 80");
      shakeCamera(0.2, 0.6);
      sfx.bossIntro();
      UI.announce("The Fire Seal", "The flame runes wake. But the heart of the fire is gone.");
      game.questLog.onRitual("ember");
      state.isWaking = false;
    },
    600 + 4 * 700 + 400,
  );
}

/* ---------------------------------------------------------------- every frame -------------------------------- */

/* lights and fires only burn while the hero is down here */
function setInside(isInside) {
  state.isInside = isInside;
  if (isInside) {
    restoreProgress();
  }
  for (const fire of state.fires) {
    if (isInside && !fire.effect) {
      fire.effect = playEffect("fire", fire.x, fire.z, {
        size: fire.size,
        y: fire.y - 0.08,
        grounded: true,
        loop: true,
      });
    } else if (!isInside && fire.effect) {
      fire.effect.stop();
      fire.effect = null;
    }
  }
  if (isInside && state.isForgeLit) {
    startForgeFire();
  } else if (!isInside && state.forge.effect) {
    state.forge.effect.stop();
    state.forge.effect = null;
  }
  game.daylight.setIndoor(isInside ? { haze: FORGE_HAZE, lights: state.lights } : null);
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

/* the Lava Run: each channel glows brighter as it gathers, then spills over its banks; whoever stands in it burns */
function updateChannels(time) {
  for (const entry of state.channels) {
    const { channel, lava, lights } = entry;
    const phase = surgePhase(channel, time);
    const surging = isSurging(channel, time);
    let opacity = 0;
    let spread = 0.5;
    if (phase < SURGE.warning) {
      /* gathering: the lava wells up in the channel, flickering */
      opacity = (phase / SURGE.warning) * (0.55 + 0.25 * Math.sin(time * 30));
      spread = 0.5;
    } else if (surging) {
      opacity = 1;
      spread = 1;
    } else {
      /* sinking back into the channel */
      const after = phase - SURGE.warning - SURGE.length;
      opacity = Math.max(0, 1 - after * 1.6);
      spread = Math.max(0.5, 1 - after);
    }
    lava.material.opacity = opacity;
    lava.scale.z = spread;
    for (const light of lights) {
      light.base = 0.35 + opacity * 0.6;
    }
    if (surging && !entry.wasSurging && Math.abs(player.z - channel.z) < 10) {
      sfx.bossSlam();
      burst((channel.x0 + channel.x1) / 2, 0.4, channel.z, {
        color: EMBER_COLOR,
        count: 20,
        speed: 5,
        size: 3,
      });
    }
    entry.wasSurging = surging;
    const isInLava =
      surging &&
      player.x > channel.x0 &&
      player.x < channel.x1 &&
      Math.abs(player.z - channel.z) < channel.halfWidth * SURGE_SPREAD;
    if (isInLava && !player.isDead && time - state.singedAt > 0.6) {
      state.singedAt = time;
      takeDamage(Math.round(hpMax() * 0.12), null, null);
      burst(player.x, 0.4, player.z, { color: EMBER_COLOR, count: 10, speed: 3 });
    }
  }
}

/* a hero who stands on a bellows plate a moment presses it down for good */
function updatePlates(dt) {
  for (const plate of state.plates) {
    const isOn = Math.abs(player.x - plate.x) < 0.75 && Math.abs(player.z - plate.z) < 0.75;
    plate.plate.position.y +=
      ((plate.isPressed || isOn ? 0.01 : 0.05) - plate.plate.position.y) * Math.min(1, dt * 20);
    if (plate.isPressed) {
      continue;
    }
    plate.standFor = isOn ? plate.standFor + dt : 0;
    if (plate.standFor > 0.4) {
      pressPlate(plate);
    }
  }
}

function updateGate(dt) {
  const gate = state.gate;
  if (gate.isOpen && gate.rise < 1) {
    gate.rise = Math.min(1, gate.rise + dt / 1.6);
    gate.bars.position.y = gate.rise * (WALL_HEIGHT - 0.25);
  }
}

/* the halls' names, the first time the hero walks into one */
function announceRooms() {
  const key = forgeRoomAt(player.x, player.z);
  const room = key && FORGE_ROOMS[key];
  if (!room || !room.name || state.seenRooms.has(key)) {
    return;
  }
  state.seenRooms.add(key);
  if (key !== "entry") {
    UI.announce(room.name);
  }
}

/** Per frame: the forge's lights, see-through walls, the lava channels, the plates and the gate, while the hero is
    down here. */
export function updateForge(dt) {
  const isInside = inForge(player.x, player.z);
  if (isInside !== state.isInside) {
    setInside(isInside);
  }
  if (!isInside) {
    return;
  }
  const time = now();
  for (const light of state.lights) {
    const flicker =
      light.color === FIRE_COLOR
        ? 0.86 +
          Math.sin(time * 7.3 + light.seed) * 0.07 +
          Math.sin(time * 13.1 + light.seed * 2) * 0.05
        : 0.9 + Math.sin(time * 2 + light.seed) * 0.1;
    light.strength += (light.base * flicker - light.strength) * Math.min(1, dt * 8);
  }
  const glow = 0.85 + 0.15 * Math.sin(time * 3.1);
  if (state.isForgeLit) {
    state.forge.coals.material.color.setRGB(1, 0.42 * glow + 0.05, 0.12, THREE.SRGBColorSpace);
  }
  fadeWallsInFront();
  updateChannels(time);
  updatePlates(dt);
  updateGate(dt);
  announceRooms();
}

/** Is the hero in the forge (for their torch and the ambience)? */
export const isHeroInForge = () => state.isInside;

/** Where a hero who fell in the forge comes back: in the Gate Hall. */
export const FORGE_RESPAWN = FORGE_ENTRY;
