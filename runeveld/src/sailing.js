/* Eldoria – sailing the Gull's Promise yourself (the sea's rules are in rules/sea.js). A hero who has helped Captain
   Mara Holt takes the helm at her berth by Saltmere's east pier. At sea the hero is the ship: the walking keys (or a
   click on the water or the sea chart) give the course, the ship comes round and gathers way, runs into rocks and
   stops, and moors by itself when brought slowly back to its berth. Other players see each other's ships (their
   presence carries `ship: [x, z, heading]`). */
import * as builders from "./builders.js";
import {
  SAILING,
  HULL,
  BERTH,
  BERTH_LANDING,
  EMBER_ISLES,
  canSail,
  hullPoints,
} from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { scene, camera, cameraState, shakeCamera } from "./world.js";
import { player, peers, now } from "./game-state.js";
import { keyDirection } from "./player.js";
import { setMooredGullVisible } from "./saltmere.js";
import { helmWheel } from "./sea.js";
import { burst } from "./particles.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

/* where the helm stands on the ship: this far towards the stern from the middle */
const HELM_AFT = HULL.length * 0.27;
/* brought this close to the berth and this slow, the ship moors */
const MOOR_DISTANCE = 6;
const MOOR_SPEED = 2.6;
/* a click on the water: sail there, and stop this close */
const ARRIVE_DISTANCE = 4;

/* the hero's own ship (built the first time they take the helm) */
let ship = null;
let wakeTimer = 0;
let bumpedAt = 0;
let toldIsles = false;

function buildShip() {
  const group = builders.ship({
    length: HULL.length,
    beam: HULL.beam,
    sail: "cloth_red",
    hullColor: 0x3e4a5a,
  });
  const wheel = helmWheel();
  wheel.position.set(0, group.userData.deck + 0.05, HELM_AFT - 0.6);
  group.add(wheel);
  group.userData.wheel = wheel.userData.wheel;
  scene.add(group);
  return group;
}

/** The hero takes the helm of the Gull's Promise at her berth in Saltmere. */
export function takeHelm() {
  if (player.ship || player.isDead) {
    return;
  }
  if (!ship) {
    ship = buildShip();
  }
  /* `from`: still in the berth, so she does not moor again before she has left it */
  player.ship = {
    x: BERTH.x,
    z: BERTH.z,
    heading: BERTH.heading,
    speed: 0,
    destination: null,
    from: "berth",
  };
  player.destination = null;
  player.target = null;
  player.isAttacking = false;
  ship.visible = true;
  setMooredGullVisible(false);
  UI.setTargetFrame(null);
  UI.systemMessage(
    "You take the helm of the Gull's Promise. Steer with the walking keys, or click the water (or the sea chart, M) to sail there.",
  );
  sfx.click();
}

/* off the ship, ashore at (landX, landZ) */
function leaveShip(landX, landZ) {
  player.ship = null;
  player.x = landX;
  player.z = landZ;
  player.destination = null;
  ship.visible = false;
  setMooredGullVisible(true);
  cameraState.target.set(player.x, 0, player.z);
}

/** Off the ship at once, with no word about it (another hero is loaded, or the hero fell). */
export function resetSailing() {
  player.ship = null;
  if (ship) {
    ship.visible = false;
  }
  setMooredGullVisible(true);
}

/** A click on the water while sailing: set the course for that spot. */
export function sailTo(x, z) {
  if (player.ship) {
    player.ship.destination = [x, z];
  }
}

/* the ship's middle from the hero's place at the helm, and back */
const forwardOf = (heading) => [-Math.sin(heading), -Math.cos(heading)];

/** Per frame while sailing: course, speed, the hull against rocks, mooring; the hero stands at the helm. */
export function updateSailing(dt) {
  const state = player.ship;
  if (!state) {
    return false;
  }
  const time = now();
  /* the course: the walking keys, else a clicked spot */
  let [dx, dz] = keyDirection(dt);
  /* top speed: full, but slowing down on the last stretch to a spot picked on the water or the chart */
  let topSpeed = SAILING.speed;
  if (dx || dz) {
    state.destination = null;
  } else if (state.destination) {
    const toX = state.destination[0] - state.x;
    const toZ = state.destination[1] - state.z;
    const distance = Math.hypot(toX, toZ);
    if (distance < ARRIVE_DISTANCE) {
      state.destination = null;
    } else {
      dx = toX / distance;
      dz = toZ / distance;
      topSpeed = Math.max(1.5, Math.min(SAILING.speed, distance * 0.6));
    }
  }
  const wantsWay = !!(dx || dz);
  if (wantsWay) {
    /* come round towards the course: slowly at a standstill, briskly under way */
    const goal = Math.atan2(-dx, -dz);
    let turn = goal - state.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const rate = SAILING.turnRate * (0.35 + (0.65 * state.speed) / SAILING.speed);
    const step = Math.sign(turn) * Math.min(Math.abs(turn), rate * dt);
    if (canSail(state.x, state.z, state.heading + step)) {
      state.heading += step;
    }
    /* the sails fill more the closer the bow is to the course */
    const along = Math.max(0, Math.cos(turn));
    state.speed = Math.max(
      0,
      Math.min(topSpeed * (0.25 + 0.75 * along), state.speed + SAILING.accelerate * dt),
    );
    if (state.speed > topSpeed) {
      state.speed = Math.max(topSpeed, state.speed - SAILING.slowdown * dt);
    }
  } else {
    state.speed = Math.max(0, state.speed - SAILING.slowdown * dt);
  }
  const [forwardX, forwardZ] = forwardOf(state.heading);
  const nextX = state.x + forwardX * state.speed * dt;
  const nextZ = state.z + forwardZ * state.speed * dt;
  if (canSail(nextX, nextZ, state.heading)) {
    state.x = nextX;
    state.z = nextZ;
  } else if (
    state.destination &&
    Math.hypot(nextX - state.destination[0], nextZ - state.destination[1]) < 40
  ) {
    /* sailing for an island or a rock on the chart: she heaves to just off it */
    state.destination = null;
    state.speed = 0;
    UI.systemMessage("You heave to, as close in as the water allows.");
  } else if (state.speed > 0.5) {
    /* aground: a jolt, and all way lost */
    if (time - bumpedAt > 1.5) {
      bumpedAt = time;
      shakeCamera(0.25, 0.3);
      sfx.bossSlam();
      UI.systemMessage("The hull scrapes over rock. Steer clear!");
    }
    state.speed = 0;
  }

  /* home: brought slowly to the berth, she moors */
  const isHome = Math.hypot(state.x - BERTH.x, state.z - BERTH.z) < MOOR_DISTANCE;
  if (isHome && state.speed < MOOR_SPEED && !wantsWay && state.from !== "berth") {
    leaveShip(...BERTH_LANDING);
    UI.systemMessage("You bring the Gull's Promise alongside and make her fast at Saltmere.");
    return true;
  }
  /* once out of the berth, she may moor there again */
  if (
    state.from === "berth" &&
    Math.hypot(state.x - BERTH.x, state.z - BERTH.z) > MOOR_DISTANCE + 2
  ) {
    state.from = "sea";
  }

  /* the Ember Isles: for now the reefs keep everyone off */
  if (
    !toldIsles &&
    Math.hypot(state.x - EMBER_ISLES.x, state.z - EMBER_ISLES.z) < EMBER_ISLES.radius + 20
  ) {
    toldIsles = true;
    UI.systemMessage(
      "The Ember Isles: black reefs, ash and smoke. There is no safe cove here yet.",
    );
  }

  /* the ship rides the swell and heels in a turn; the hero stands at the helm */
  const swell = Math.sin(time * 1.3) * 0.08;
  ship.position.set(state.x, WATER_Y + swell, state.z);
  ship.rotation.set(Math.sin(time * 0.9) * 0.025, state.heading, Math.sin(time * 1.1) * 0.03);
  if (ship.userData.wheel) {
    ship.userData.wheel.rotation.z = state.speed * 0.05 * Math.sin(time * 0.5);
  }
  const helmX = state.x - forwardX * HELM_AFT;
  const helmZ = state.z - forwardZ * HELM_AFT;
  player.x = helmX;
  player.z = helmZ;
  player.sprite.face(forwardX, forwardZ);
  player.sprite.play("idle");
  player.sprite.group.position.set(helmX, WATER_Y + ship.userData.deck + swell, helmZ);
  player.sprite.update(dt, cameraState);
  UI.positionLabel(
    player.label,
    helmX,
    WATER_Y + ship.userData.deck + player.sprite.height + 0.15,
    helmZ,
    camera,
  );

  /* the wake: foam at the bow and behind the stern */
  wakeTimer -= dt;
  if (state.speed > 1.5 && wakeTimer <= 0) {
    wakeTimer = 0.07;
    const [bow, , stern] = hullPoints(state.x, state.z, state.heading);
    burst(bow[0] + forwardX * 2, WATER_Y + 0.2, bow[1] + forwardZ * 2, {
      color: 0xf2f6f8,
      count: 3,
      speed: 2,
      size: 3,
      life: 0.6,
    });
    burst(stern[0] - forwardX * 2.5, WATER_Y + 0.1, stern[1] - forwardZ * 2.5, {
      color: 0xe8f0f4,
      count: 2,
      speed: 1,
      size: 4,
      life: 1.2,
    });
  }
  return true;
}

/* ---------- other players' ships ---------- */

/* one ship per sailing peer: peer id → {group, x, z, heading} */
const peerShips = new Map();

/** Per frame: a ship under every other player who is sailing, their figure at its helm. */
export function updatePeerShips(dt, time) {
  for (const [id, peer] of peers) {
    const pose = peer.presence && peer.presence.ship;
    let entry = peerShips.get(id);
    if (!Array.isArray(pose)) {
      if (entry) {
        entry.group.visible = false;
      }
      continue;
    }
    if (!entry) {
      entry = {
        group: builders.ship({
          length: HULL.length,
          beam: HULL.beam,
          sail: "cloth_red",
          hullColor: 0x3e4a5a,
        }),
      };
      scene.add(entry.group);
      [entry.x, entry.z, entry.heading] = pose;
      peerShips.set(id, entry);
    }
    const follow = 1 - Math.exp(-6 * dt);
    entry.x += (pose[0] - entry.x) * follow;
    entry.z += (pose[1] - entry.z) * follow;
    let turn = pose[2] - entry.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    entry.heading += turn * follow;
    entry.group.visible = true;
    entry.group.position.set(entry.x, WATER_Y + Math.sin(time * 1.3) * 0.08, entry.z);
    entry.group.rotation.set(0, entry.heading, Math.sin(time * 1.1) * 0.03);
    /* their figure on the deck */
    peer.sprite.group.position.y = WATER_Y + entry.group.userData.deck;
  }
  for (const [id, entry] of peerShips) {
    if (!peers.has(id)) {
      scene.remove(entry.group);
      peerShips.delete(id);
    }
  }
}

/** The ship's pose for the presence: [x, z, heading] while sailing, else null. */
export const shipPresence = () =>
  player.ship
    ? [+player.ship.x.toFixed(2), +player.ship.z.toFixed(2), +player.ship.heading.toFixed(3)]
    : null;
