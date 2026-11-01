/* Eldoria – sailing the Gull's Promise yourself (the sea's rules are in rules/sea.js). A hero who has helped Captain
   Mara Holt takes the helm at her berth by Saltmere's east pier (or at the jetty in Cinder Cove, once she lies
   there). At sea the hero is the ship: the walking keys (or a click on the water or the sea chart) give the course,
   the ship comes round and gathers way, runs into rocks and stops, and moors by itself when brought slowly to a
   berth. Other players see each other's ships (their
   presence carries `ship: [x, z, heading]`). */
import * as builders from "./builders.js";
import { SAILING, HULL, BERTHS, EMBER_ISLES, canSail } from "./rules/sea.js";
import { WATER_Y } from "./rules/saltmere.js";
import { scene, camera, cameraState, shakeCamera } from "./world.js";
import { player, peers, now } from "./game-state.js";
import { keyDirection } from "./player.js";
import { setMooredGullVisible } from "./saltmere.js";
import { setCoveGullVisible } from "./ember.js";
import { createWake } from "./sea.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

/* brought this close to the berth and this slow, the ship moors */
const MOOR_DISTANCE = 6;
const MOOR_SPEED = 2.6;
/* a click on the water: sail there, and stop this close */
const ARRIVE_DISTANCE = 4;

/* the hero's own ship (built the first time they take the helm) and her wake */
let ship = null;
let wake = null;
let bumpedAt = 0;
let toldIsles = false;

/* the Gull's Promise as she sails: the same build as at her berth */
const gullsPromise = () =>
  builders.ship({ length: HULL.length, beam: HULL.beam, sail: "cloth_red", hullColor: 0x3e4a5a });

function buildShip() {
  const group = gullsPromise();
  scene.add(group);
  wake = createWake();
  return group;
}

/* The sails between the camera and the helm turn see-through, so the one steering stays in sight: how much depends
   on how far the stern (where the helm is) points away from the camera. */
function fadeSails(group, heading) {
  const yaw = cameraState.yaw;
  const sternAway = -Math.cos(heading - yaw);
  const opacity = 1 - 0.6 * Math.max(0, Math.min(1, sternAway * 1.6 + 0.3));
  for (const sail of group.userData.sails) {
    sail.material.opacity = opacity;
    sail.material.depthWrite = opacity > 0.99;
  }
}

/* The Gull's Promise lying at her berths shows only while the hero is ashore: at sea they sail her. */
function showMooredGulls(isVisible) {
  setMooredGullVisible(isVisible);
  setCoveGullVisible(isVisible);
}

/* May the hero bring her in at this berth? Cinder Cove only once Mara has told them the way through the reefs. */
const mayMoorAt = (berth) => berth.id !== "cinder_cove" || !!player.quests.mara_landfall;

/** The hero takes the helm of the Gull's Promise at her berth with this id (rules/sea.js BERTHS). */
export function takeHelm(berthId = "saltmere") {
  if (player.ship || player.isDead) {
    return;
  }
  if (!ship) {
    ship = buildShip();
  }
  const berth = BERTHS.find((each) => each.id === berthId) || BERTHS[0];
  /* `from`: still in this berth, so she does not moor there again before she has left it */
  player.ship = {
    x: berth.x,
    z: berth.z,
    heading: berth.heading,
    speed: 0,
    destination: null,
    from: berth.id,
  };
  player.destination = null;
  player.target = null;
  player.isAttacking = false;
  ship.visible = true;
  showMooredGulls(false);
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
  wake.hide();
  showMooredGulls(true);
  cameraState.target.set(player.x, 0, player.z);
}

/** Off the ship at once, with no word about it (another hero is loaded, or the hero fell). */
export function resetSailing() {
  player.ship = null;
  if (ship) {
    ship.visible = false;
    wake.hide();
  }
  showMooredGulls(true);
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
    state.turning = Math.sign(turn) * Math.min(1, Math.abs(turn));
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
    state.turning = 0;
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

  /* brought slowly to a berth, she moors */
  for (const berth of BERTHS) {
    const distance = Math.hypot(state.x - berth.x, state.z - berth.z);
    if (berth.id === state.from) {
      /* once out of the berth she set off from, she may moor there again */
      if (distance > MOOR_DISTANCE + 2) {
        state.from = "sea";
      }
      continue;
    }
    if (distance < MOOR_DISTANCE && state.speed < MOOR_SPEED && !wantsWay && mayMoorAt(berth)) {
      leaveShip(...berth.landing);
      UI.systemMessage(
        `You bring the Gull's Promise alongside and make her fast at ${berth.name}.`,
      );
      return true;
    }
  }

  /* the Ember Isles: a word about their coast, the first time she comes near */
  if (
    !toldIsles &&
    Math.hypot(state.x - EMBER_ISLES.x, state.z - EMBER_ISLES.z) < EMBER_ISLES.radius + 24
  ) {
    toldIsles = true;
    UI.systemMessage(
      player.quests.mara_landfall
        ? "Cinder Cove opens between the reefs on the south coast. Bring her in slowly, alongside the jetty."
        : "The Ember Isles: black reefs, ash and smoke. Nobody you know has ever found a way in.",
    );
  }

  /* the ship rides the swell and heels in a turn; the hero stands at the helm */
  const swell = Math.sin(time * 1.3) * 0.08;
  ship.position.set(state.x, WATER_Y + swell, state.z);
  ship.rotation.set(Math.sin(time * 0.9) * 0.025, state.heading, Math.sin(time * 1.1) * 0.03);
  wake.update(state.x, state.z, state.heading, state.speed, dt);
  /* the wheel turns with the helm put over */
  state.wheel = (state.wheel || 0) * Math.exp(-dt * 1.5) + (state.turning || 0) * dt * 6;
  ship.userData.wheel.rotation.z = state.wheel;
  fadeSails(ship, state.heading);
  /* the hero stands on the quarterdeck, behind the wheel, facing the bow */
  const helm = ship.userData.helm;
  const helmX = state.x - forwardX * helm.z;
  const helmZ = state.z - forwardZ * helm.z;
  player.x = helmX;
  player.z = helmZ;
  player.sprite.face(forwardX, forwardZ);
  player.sprite.play("idle");
  player.sprite.group.position.set(helmX, WATER_Y + helm.y + swell, helmZ);
  player.sprite.update(dt, cameraState);
  UI.positionLabel(
    player.label,
    helmX,
    WATER_Y + helm.y + player.sprite.height + 0.15,
    helmZ,
    camera,
  );

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
        entry.wake.hide();
      }
      continue;
    }
    if (!entry) {
      entry = { group: gullsPromise(), wake: createWake(), speed: 0 };
      scene.add(entry.group);
      [entry.x, entry.z, entry.heading] = pose;
      peerShips.set(id, entry);
    }
    const follow = 1 - Math.exp(-6 * dt);
    const stepX = (pose[0] - entry.x) * follow;
    const stepZ = (pose[1] - entry.z) * follow;
    entry.x += stepX;
    entry.z += stepZ;
    /* her speed, from how far she moved: for the wake */
    const moved = dt > 0 ? Math.hypot(stepX, stepZ) / dt : 0;
    entry.speed += (moved - entry.speed) * Math.min(1, dt * 3);
    let turn = pose[2] - entry.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    entry.heading += turn * follow;
    entry.group.visible = true;
    entry.group.position.set(entry.x, WATER_Y + Math.sin(time * 1.3) * 0.08, entry.z);
    entry.group.rotation.set(0, entry.heading, Math.sin(time * 1.1) * 0.03);
    /* their figure on the deck */
    entry.wake.update(entry.x, entry.z, entry.heading, entry.speed, dt);
    /* their figure on the quarterdeck, behind the wheel */
    peer.sprite.group.position.y = WATER_Y + entry.group.userData.helm.y;
    fadeSails(entry.group, entry.heading);
  }
  for (const [id, entry] of peerShips) {
    if (!peers.has(id)) {
      scene.remove(entry.group);
      entry.wake.hide();
      peerShips.delete(id);
    }
  }
}

/** The ship's pose for the presence: [x, z, heading] while sailing, else null. */
export const shipPresence = () =>
  player.ship
    ? [+player.ship.x.toFixed(2), +player.ship.z.toFixed(2), +player.ship.heading.toFixed(3)]
    : null;
