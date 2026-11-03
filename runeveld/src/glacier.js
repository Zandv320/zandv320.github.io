/* Eldoria – the Glacier Halls inside the glacier at the north edge of the White Waste (Saga III, chapter 16).
   rules/glacier.js has its halls; this file builds them (walls of ice blocks, floors of clear ice and of black ice
   over water, pillars of ice, crystals that glow, the doors of ice, the three mirrors, the frost seal on its altar)
   and runs what happens in there: a blue gloom lit by the crystals, walls that fade when they stand in front of the
   hero, the way in through the Unbound's dig and out again, doors that only the Ember Rune's fire melts, and the
   mirrors that show what the ice remembers. What a hero has opened here comes back from their quests; for a hero
   without them it lasts this session. */
import * as THREE from "three";
import * as builders from "./builders.js";
import {
  GLACIER_ROOMS,
  GLACIER_ENTRY,
  GLACIER_EXIT,
  FROZEN_DOORS,
  ICE_PILLARS,
  ICE_PILLAR_RADIUS,
  MIRRORS,
  FROST_SEAL,
  WYRM_HOME,
  glacierFloorCells,
  glacierPoint,
  glacierRoomAt,
  inGlacier,
} from "./rules/glacier.js";
import { GLACIER_DIG } from "./rules/frostmarch.js";
import { player, game, ADMIN } from "./game-state.js";
import { scene, camera, cameraState, shakeCamera } from "./world.js";
import { burst } from "./particles.js";
import { groundRing } from "./skill-effects.js";
import { wallRectangles, travel } from "./crypt.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const WALL_HEIGHT = 2.8;
/* the gloom in here: a deep, cold blue */
const GLACIER_HAZE = [40, 66, 104];
const CRYSTAL_COLOR = [150, 214, 255];
const ICE_BLUE = 0x9fdcff;
/* how far a hero reaches to touch a mirror or the seal */
const USE_DISTANCE = 2.6;

const state = {
  walls: [],
  lights: [],
  objects: [],
  doors: [],
  mirrors: [],
  seen: 0,
  isInside: false,
  seenRooms: new Set(),
};

const local = (x, z) => glacierPoint(x, z);

/* ---------------------------------------------------------------- building ---------------------------------- */

/* an invisible box to click on (see-through, not invisible: the click handler skips invisible meshes) */
function addObject(kind, x, z, [w, h, d] = [1.6, 1.8, 1.6], extra = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  const object = { kind, x, z, mesh, ...extra };
  mesh.userData.glacierObject = object;
  state.objects.push(object);
  return object;
}

function addLight(x, z, { y = 1.4, radius = 6, color = CRYSTAL_COLOR, strength = 0.8 } = {}) {
  const light = { x, z, y, radius, color, strength, base: strength, seed: Math.random() * 10 };
  state.lights.push(light);
  return light;
}

function addWall(rect, obstacles) {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const x = (rect.x0 + rect.x1) / 2;
  const z = (rect.z0 + rect.z1) / 2;
  const mesh = builders.cryptWall(w, WALL_HEIGHT, d, "ice_wall");
  mesh.position.x = x;
  mesh.position.z = z;
  scene.add(mesh);
  state.walls.push(mesh);
  obstacles.push({ x, z, r: Math.hypot(w, d) / 2, box: { hw: w / 2, hd: d / 2, cos: 1, sin: 0 } });
}

const CRYSTAL = new THREE.MeshLambertMaterial({
  color: 0xbfe8ff,
  emissive: 0x3a7ab0,
  flatShading: true,
});

/* a cluster of glowing crystals growing out of the floor, with its light */
function crystals(x, z, size = 1) {
  const group = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const height = (0.6 + ((k * 37) % 7) * 0.12) * size;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.16 * size, height, 5).translate(0, height / 2, 0),
      CRYSTAL,
    );
    shard.position.set(Math.cos(k * 2.4) * 0.25 * size, 0, Math.sin(k * 2.4) * 0.25 * size);
    shard.rotation.set(Math.sin(k) * 0.35, k, Math.cos(k * 1.7) * 0.35);
    group.add(shard);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  addLight(x, z, { y: 0.8, radius: 4.5 * size });
}

/* a pillar of ice: six sides, wider at the foot and the head, frost on top */
function icePillar(x, z) {
  const group = new THREE.Group();
  const shaft = builders.outline(
    new THREE.Mesh(
      new THREE.CylinderGeometry(ICE_PILLAR_RADIUS * 0.8, ICE_PILLAR_RADIUS, WALL_HEIGHT, 6),
      new THREE.MeshLambertMaterial({ color: 0xaad6f0, flatShading: true }),
    ),
  );
  shaft.position.y = WALL_HEIGHT / 2;
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(ICE_PILLAR_RADIUS * 1.15, ICE_PILLAR_RADIUS * 0.8, 0.4, 6),
    new THREE.MeshLambertMaterial({ color: 0xeaf6fd, flatShading: true }),
  );
  head.position.y = WALL_HEIGHT - 0.2;
  group.add(shaft, head);
  group.position.set(x, 0, z);
  scene.add(group);
}

/* a rune of frost on a 16 × 16 canvas, for the seal's stones */
function frostGlyph() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * Math.PI * 2;
    for (let r = 1; r < 7; r++) {
      ctx.fillRect(
        Math.round(8 + Math.cos(angle) * r) - (r === 6 ? 1 : 0),
        Math.round(8 + Math.sin(angle) * r),
        1,
        1,
      );
    }
    ctx.fillRect(
      Math.round(8 + Math.cos(angle) * 4 + Math.cos(angle + 1) * 1.5),
      Math.round(8 + Math.sin(angle) * 4 + Math.sin(angle + 1) * 1.5),
      1,
      1,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return texture;
}

/* a door of ice across a passage: a wall of clear blocks with frost runes in it, the frost seal's keepers' work */
function frozenDoor(width) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({
    color: 0xc8ecff,
    emissive: 0x1a4a70,
    transparent: true,
    opacity: 0.88,
    flatShading: true,
  });
  for (let k = 0; k < Math.round(width); k++) {
    for (let row = 0; row < 3; row++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(1, 0.95, 0.9), material);
      block.position.set(
        -width / 2 + 0.5 + k + (row % 2) * 0.12,
        0.48 + row * 0.93,
        Math.sin(k * 3 + row) * 0.08,
      );
      block.rotation.y = Math.sin(k + row * 2) * 0.06;
      group.add(block);
    }
  }
  const rune = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: frostGlyph(), transparent: true, color: 0x8fdcff }),
  );
  rune.position.set(0, 1.5, 0.48);
  group.add(rune);
  return group;
}

export function buildGlacier({ prop, place, obstacles, pending }) {
  const floor = glacierFloorCells();
  /* the floors: clear ice, but black ice over the water in the Glass Hall */
  for (const [key, { rect }] of Object.entries(GLACIER_ROOMS)) {
    const group = new THREE.Group();
    group.add(
      builders.cryptFloor(
        rect[2] - rect[0],
        rect[3] - rect[1],
        key === "glassHall" ? "black_ice" : "ice_floor",
      ),
    );
    place(group, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
  }
  for (const rect of wallRectangles(floor)) {
    addWall(rect, obstacles);
  }

  /* the Ice Gate: steps of ice up to the dig against its west wall, crystals by the way in, what the Unbound left */
  place(builders.cryptStairsUp(), ...GLACIER_EXIT, { rotation: Math.PI / 2 });
  addObject("exit", ...GLACIER_EXIT, [1.6, 1.2, 2.6]);
  crystals(...local(-5.5, 39.5));
  crystals(...local(5.5, 39.5));
  crystals(...local(5.5, 48.5), 0.8);
  pending.push(prop("crypt_crates", ...local(4.5, 46.5), { radius: 0.7, scale: 0.9 }));
  /* outside, the dig into the glacier is the way in */
  addObject("enter", GLACIER_DIG[0], GLACIER_DIG[1] - 3, [5, 4, 2.4]);

  /* the doors of ice */
  for (const door of FROZEN_DOORS) {
    const mesh = frozenDoor(door.width);
    mesh.position.set(door.x, 0, door.z);
    scene.add(mesh);
    const obstacle = {
      x: door.x,
      z: door.z,
      r: door.width / 2,
      box: { hw: door.width / 2, hd: 0.45, cos: 1, sin: 0 },
      isDoor: true,
    };
    obstacles.push(obstacle);
    state.doors.push({ ...door, mesh, obstacle, isOpen: false, melt: 0 });
    addObject("door", door.x, door.z + 0.8, [door.width, 3, 1], { door: state.doors.at(-1) });
  }

  /* the Glass Hall and the Heart: pillars of ice; crystals in the corners */
  for (const [x, z] of ICE_PILLARS) {
    icePillar(x, z);
    obstacles.push({ x, z, r: ICE_PILLAR_RADIUS });
  }
  for (const [x, z] of [
    [-12.5, 30.5],
    [12.5, 30.5],
    [-12.5, 11.5],
    [12.5, 11.5],
    [-16.5, 0.5],
    [16.5, 0.5],
    [-16.5, -26.5],
    [16.5, -26.5],
    [-20.5, 9.5],
    [-20.5, 28.5],
  ]) {
    crystals(...local(x, z), 1.1);
  }

  /* the Mirror Hall: three tall panes of ice in frames of ice along the north wall, facing south */
  MIRRORS.forEach(([x, z], index) => {
    const group = new THREE.Group();
    const frame = builders.outline(
      new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 2.7, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xd6eefa, flatShading: true }),
      ),
    );
    frame.position.y = 1.35;
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x9ccbe8, emissive: 0x16304a }),
    );
    pane.position.set(0, 1.35, 0.22);
    group.add(frame, pane);
    group.position.set(x, 0, z);
    scene.add(group);
    obstacles.push({ x, z, r: 0.6 });
    state.mirrors.push({ x, z, pane, light: addLight(x, z + 1.2, { radius: 4, strength: 0.4 }) });
    addObject("mirror", x, z + 0.6, [2.2, 2.7, 1.2], { index });
  });

  /* the Heart: the frost seal on its altar, four stones with frost runes round it */
  place(builders.altar(), ...FROST_SEAL, { radius: 1.6 });
  const glyph = frostGlyph();
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const x = FROST_SEAL[0] + Math.cos(angle) * 2.8;
    const z = FROST_SEAL[1] + Math.sin(angle) * 2.4;
    const stone = builders.runeStone(glyph);
    stone.position.set(x, 0, z);
    stone.rotation.y = Math.atan2(FROST_SEAL[0] - x, FROST_SEAL[1] - z) + Math.PI;
    scene.add(stone);
    obstacles.push({ x, z, r: 0.5 });
    stone.userData.glyph.material.color.set(0x5a8ab0);
  }
  addLight(...FROST_SEAL, { y: 1.2, radius: 7, strength: 0.5 });
  /* the Heart's own pale light, over the coil of the Wyrm */
  addLight(...WYRM_HOME, { y: 3, radius: 12, color: [200, 232, 255], strength: 0.75 });
  for (const [x, z] of [
    [-8, -2],
    [8, -2],
    [-14, -13],
    [14, -13],
    [-8, -25],
    [8, -25],
  ]) {
    crystals(...local(x, z), 1.2);
  }
  addObject("seal", FROST_SEAL[0], FROST_SEAL[1], [3.4, 1.6, 2.6]);
}

export const glacierClickables = () => state.objects.map((object) => object.mesh);

/* ---------------------------------------------------------------- the way in and out ------------------------- */

/** May this hero go in? Once Hrimgar has fallen and the road to the glacier is open, or for the admin. */
const mayEnter = () => ADMIN.noclip || player.quests?.torvald_hrimgar?.state === "done";

/** Clicked something of the halls (or the dig outside): walk to it, then use it. */
export function clickGlacierObject(object) {
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
          "A black hole cut into the glacier, propped with timber. Ice trolls' tracks all round it. Not yet.",
        );
        return;
      }
      travel(
        GLACIER_ENTRY,
        "The Glacier Halls",
        "Blue light, and a cold that is older than the snow.",
      );
      return;
    case "exit":
      travel([GLACIER_DIG[0], GLACIER_DIG[1] + 1.5], "The White Waste", "Wind, and the sky again.");
      return;
    case "door":
      if (!object.door.isOpen) {
        UI.systemMessage(
          "A door of ice, a frost rune glowing in it. Hammers would only chip it. Ice that a seal made remembers one thing it fears: fire. (Put your Ember Rune on Q in the rune codex, U, then face the door and call it.)",
        );
      }
      return;
    case "mirror":
      lookInMirror(object.index);
      return;
    case "seal":
      UI.systemMessage(
        "Four stones with frost runes round the altar, their light low and blue. Under the ice of the altar something white pulses, slowly, like a heart.",
      );
      return;
  }
}

/* ---------------------------------------------------------------- the doors of ice --------------------------- */

const isQuestDone = (id) => player.quests?.[id]?.state === "done";

/* the doors as the hero left them: open for good once the quest that passes them is done */
function restoreProgress() {
  for (const door of state.doors) {
    if (!door.isOpen && isQuestDone(door.quest)) {
      openDoor(door, true);
    }
  }
  if (isQuestDone("ulf_mirrors")) {
    state.seen = MIRRORS.length;
  }
}

function openDoor(door, isRestoring) {
  door.isOpen = true;
  door.obstacle.isOpen = true;
  if (isRestoring) {
    door.melt = 1;
    door.mesh.visible = false;
  }
}

/** The Ember Rune's fire went out from (x, z) along (dx, dz), `range` far in a cone `angle` wide (rune-powers.js):
    a door of ice in it melts. */
export function meltWithFire(x, z, dx, dz, range, angle) {
  for (const door of state.doors) {
    if (door.isOpen) {
      continue;
    }
    const mx = door.x - x;
    const mz = door.z - z;
    const distance = Math.hypot(mx, mz);
    const along = mx * dx + mz * dz;
    const isInCone =
      distance < range + door.width / 2 &&
      along > 0 &&
      (distance < 1.5 || along / distance > Math.cos(angle / 2 + 0.35));
    if (!isInCone) {
      continue;
    }
    openDoor(door, false);
    sfx.bossSlam();
    shakeCamera(0.2, 0.4);
    UI.systemMessage(
      "The fire takes hold of the ice. The rune in it flickers, hisses, and goes out. The door melts.",
    );
    if (door.id === "gate") {
      game.questLog.onRitual("thaw");
    }
  }
}

/* a melting door sinks into a puddle of steam */
function updateDoors(dt) {
  for (const door of state.doors) {
    if (!door.isOpen || door.melt >= 1) {
      continue;
    }
    door.melt = Math.min(1, door.melt + dt / 2.2);
    door.mesh.scale.y = Math.max(0.02, 1 - door.melt);
    if (Math.random() < dt * 14) {
      burst(
        door.x + (Math.random() - 0.5) * door.width,
        0.4 + Math.random() * 2 * (1 - door.melt),
        door.z,
        {
          color: 0xeef6fc,
          count: 4,
          speed: 1.4,
          size: 3,
          life: 1,
        },
      );
    }
    if (door.melt >= 1) {
      door.mesh.visible = false;
    }
  }
}

/* ---------------------------------------------------------------- the mirrors -------------------------------- */

/* what the ice remembers, mirror by mirror: the first kings and their crown */
const VISIONS = [
  [
    "A king in the ice",
    "A man in a crown of seven stones, each a different light: moon, fire, tide, frost, storm, root, and one so bright you cannot look at it. Behind him a dark that moves.",
  ],
  [
    "The crown breaks",
    "The king and six others stand round a pit in the ground. He lifts the crown off his head and breaks it across his knee. The seven stones fly apart, and the dark in the pit lies down and is still.",
  ],
  [
    "The keepers",
    "Seven people walk away from the pit, each holding a stone against their chest. One of them walks north, into the snow, and the ice closes over her as she kneels. Her stone still glows, under you.",
  ],
];

function lookInMirror(index) {
  const mirror = state.mirrors[index];
  if (index > state.seen) {
    UI.systemMessage("The ice is cloudy. As if it wants to be looked at in order, from the west.");
    return;
  }
  const [title, text] = VISIONS[index];
  mirror.pane.material.emissive.set(0x4a90c8);
  mirror.light.base = 1;
  groundRing(mirror.x, mirror.z + 1.2, ICE_BLUE, 0.3, 2.4, 0.8, 0.8);
  sfx.chime();
  UI.announce(title, text);
  UI.systemMessage(text);
  if (index === state.seen) {
    state.seen++;
    if (state.seen === MIRRORS.length) {
      game.questLog.onRitual("mirrors");
    }
  }
}

/* ---------------------------------------------------------------- every frame -------------------------------- */

function setInside(isInside) {
  state.isInside = isInside;
  if (isInside) {
    restoreProgress();
  }
  game.daylight.setIndoor(isInside ? { haze: GLACIER_HAZE, lights: state.lights } : null);
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

function announceRooms() {
  const key = glacierRoomAt(player.x, player.z);
  const room = key && GLACIER_ROOMS[key];
  if (!room || !room.name || state.seenRooms.has(key)) {
    return;
  }
  state.seenRooms.add(key);
  if (key !== "entry") {
    UI.announce(room.name);
  }
}

/** Per frame, while the hero is in here: the crystals' light, see-through walls, melting doors, the halls' names. */
export function updateGlacier(dt, time) {
  const isInside = inGlacier(player.x, player.z);
  if (isInside !== state.isInside) {
    setInside(isInside);
  }
  if (!isInside) {
    return;
  }
  for (const light of state.lights) {
    const shimmer = 0.9 + Math.sin(time * 1.7 + light.seed) * 0.1;
    light.strength += (light.base * shimmer - light.strength) * Math.min(1, dt * 4);
  }
  fadeWallsInFront();
  updateDoors(dt);
  announceRooms();
}

/** Is the hero in the Glacier Halls (for their light and the ambience)? */
export const isHeroInGlacier = () => state.isInside;
