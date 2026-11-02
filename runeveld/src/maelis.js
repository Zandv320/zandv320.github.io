/* Eldoria – the chase through Saltmere ('Thief in the night', rules/quests.js goal 'chase'). While the quest is
   open, Maelis waits at the Salty Gull's door with the stolen chart. Each time the hero catches up he says something,
   leaves a rune on the ground under the hero (who is held a moment if still standing in it when it flares) and runs
   on to the next point of his route (rules/saltmere.js CHASE_ROUTE). Lose him for too long and he is back at the
   start; reach the end of the mole and he leaps into his boat and is gone over the sea: the quest is done.
   Purely for the hero chasing him: other players do not see this Maelis. */
import * as THREE from "three";
import * as builders from "./builders.js";
import { SHEETS } from "./sheets.js";
import { Sprite2D } from "./sprites.js";
import { HAIR_SOURCE, HAIR_PALETTES, recolor } from "./appearance.js";
import { QUESTS } from "./rules/quests.js";
import { CHASE_ROUTE, ESCAPE_BOAT, WATER_Y } from "./rules/saltmere.js";
import { scene, camera, cameraState } from "./world.js";
import { player, game, now, playEffect } from "./game-state.js";
import { groundRing } from "./skill-effects.js";
import { burst } from "./particles.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

/* he runs a little faster than a hero walks, so he gets ahead and waits */
const RUN_SPEED = 5.2;
/* this close, and he runs on */
const CATCH_DISTANCE = 6.5;
/* this far for this long, and he is lost */
const LOST_DISTANCE = 30;
const LOST_SECONDS = 12;
/* the rune he leaves: its size, how long before it flares, how long it holds the hero */
const TRAP_RADIUS = 1.5;
const TRAP_DELAY = 1.1;
const TRAP_HOLD = 1.6;

const LINES = [
  "You are quick. For a courier.",
  "The seals are a cage, and I have the key. Well: a map of the locks.",
  "Careful where you step!",
  "Still there? How tiresome.",
  "My constructs send their regards.",
  "Selwyn sends children now?",
  "Farewell, little hero. Tell the archmage the sea is wide.",
];

let maelis = null;
/* the rune on the ground: {x, z, flareIn (seconds), ring} */
let trap = null;

/** Maelis as the players see him, wherever he turns up: his figure (in the scene) and his name label. */
export function maelisFigure() {
  const layers = SHEETS.hero.layers;
  const head = recolor("hero_head", HAIR_SOURCE, HAIR_PALETTES.black, "hair-black");
  const sprite = new Sprite2D(SHEETS.hero, {
    layers: [layers.hero_body, layers.armor2, head].filter(Boolean),
    shadow: 0.9,
  });
  sprite.tint(0xc8b8ff);
  scene.add(sprite.group);
  return { sprite, label: UI.createLabel("npc", "Maelis the Unbound") };
}

function build() {
  const { sprite, label } = maelisFigure();
  /* his boat: a rowing boat at the head of the mole, its bow to the open sea */
  const boat = builders.rowingBoat();
  boat.rotation.y = Math.atan2(
    -(ESCAPE_BOAT.away[0] - ESCAPE_BOAT.x),
    -(ESCAPE_BOAT.away[1] - ESCAPE_BOAT.z),
  );
  boat.position.set(ESCAPE_BOAT.x, WATER_Y, ESCAPE_BOAT.z);
  scene.add(boat);
  maelis = {
    sprite,
    boat,
    label,
    x: CHASE_ROUTE[0][0],
    z: CHASE_ROUTE[0][1],
    index: 0,
    run: null /* {x0, z0, x1, z1, t, duration} */,
    lostFor: 0,
    line: 0,
    escape: 0 /* seconds since he stepped into the boat, 0 before */,
    isShown: false /* in the game, for this hero's chase */,
  };
}

/** The open chase quest of the hero, or null. */
function chaseQuest() {
  for (const [id, record] of Object.entries(player.quests || {})) {
    if (record.state === "active" && !record.count && QUESTS[id]?.goal.type === "chase") {
      return id;
    }
  }
  return null;
}

function show(isShown) {
  maelis.isShown = isShown;
  /* his boat waits at the mole only while he is on the run */
  maelis.boat.visible = isShown;
  maelis.sprite.group.visible = isShown;
  maelis.label.el.hidden = !isShown;
}

function clearTrap() {
  if (trap) {
    scene.remove(trap.ring);
    trap.ring.material.dispose();
    trap = null;
  }
}

function reset() {
  clearTrap();
  [maelis.x, maelis.z] = CHASE_ROUTE[0];
  maelis.index = 0;
  maelis.run = null;
  maelis.lostFor = 0;
  maelis.line = 0;
  maelis.escape = 0;
  maelis.boat.position.set(ESCAPE_BOAT.x, WATER_Y, ESCAPE_BOAT.z);
}

function say(text) {
  UI.speechBubble(maelis.label, text);
}

/* a violet rune under the hero, that flares a moment later */
function leaveTrap() {
  clearTrap();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TRAP_RADIUS * 0.82, TRAP_RADIUS, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xb98cff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  ring.position.set(player.x, 0.06, player.z);
  /* over the night haze, so it is never missed */
  ring.renderOrder = 10001;
  scene.add(ring);
  trap = { x: player.x, z: player.z, flareIn: TRAP_DELAY, ring };
}

function updateTrap(dt, time) {
  if (!trap) {
    return;
  }
  trap.ring.material.opacity = 0.5 + 0.4 * Math.sin(time * 16);
  trap.flareIn -= dt;
  if (trap.flareIn > 0) {
    return;
  }
  groundRing(trap.x, trap.z, 0xb98cff, 0.4, TRAP_RADIUS * 1.4, 0.4, 0.9);
  burst(trap.x, 0.4, trap.z, { color: 0xc9a6ff, count: 16, speed: 3, size: 3 });
  if (Math.hypot(player.x - trap.x, player.z - trap.z) < TRAP_RADIUS && !player.isDead) {
    /* held by the rune: no walking, no fighting, for a moment */
    player.busyUntil = Math.max(player.busyUntil, time + TRAP_HOLD);
    player.destination = null;
    UI.floatingText(player.x, 2, player.z, camera, "Held!", "crit");
    sfx.bossWarn();
  }
  clearTrap();
}

/** Where the guide points while the chase is on: Maelis himself. */
export function chaseMarker() {
  return maelis && maelis.isShown ? { x: maelis.x, z: maelis.z, height: 2 } : null;
}

/** Per frame: Maelis waits, runs, or gets away; only while the hero has the chase quest open. */
export function updateChase(dt) {
  const questId = game.isStarted ? chaseQuest() : null;
  if (!questId) {
    if (maelis && maelis.isShown) {
      show(false);
      reset();
    }
    return;
  }
  if (!maelis) {
    build();
  }
  if (!maelis.isShown) {
    reset();
    show(true);
  }
  const time = now();
  updateTrap(dt, time);
  const last = CHASE_ROUTE.length - 1;
  const distance = Math.hypot(player.x - maelis.x, player.z - maelis.z);

  if (maelis.escape > 0) {
    /* in the boat and away over the sea, then the quest is done */
    maelis.escape += dt;
    const progress = Math.min(1, maelis.escape / 5);
    const [awayX, awayZ] = ESCAPE_BOAT.away;
    maelis.boat.position.set(
      ESCAPE_BOAT.x + (awayX - ESCAPE_BOAT.x) * progress,
      WATER_Y + Math.sin(maelis.escape * 3) * 0.05,
      ESCAPE_BOAT.z + (awayZ - ESCAPE_BOAT.z) * progress,
    );
    maelis.x = maelis.boat.position.x;
    maelis.z = maelis.boat.position.z;
    if (progress >= 1) {
      show(false);
      reset();
      game.questLog.onChase(questId);
      UI.systemMessage("Maelis is gone over the grey sea, and the chart with him.");
      return;
    }
  } else if (maelis.run) {
    const run = maelis.run;
    run.t += dt;
    const progress = Math.min(1, run.t / run.duration);
    maelis.x = run.x0 + (run.x1 - run.x0) * progress;
    maelis.z = run.z0 + (run.z1 - run.z0) * progress;
    maelis.sprite.face(run.x1 - run.x0, run.z1 - run.z0);
    maelis.sprite.play("walk");
    if (progress >= 1) {
      maelis.run = null;
      if (maelis.index === last) {
        /* the head of the mole: into the boat */
        maelis.escape = 1e-4;
        say(LINES[LINES.length - 1]);
        playEffect("smoke", maelis.x, maelis.z, { size: 1.8, grounded: true });
        sfx.skill();
      }
    }
  } else {
    maelis.sprite.play("idle");
    maelis.sprite.face(player.x - maelis.x, player.z - maelis.z);
    if (distance < CATCH_DISTANCE && maelis.index < last) {
      /* caught up: a word, a rune, and off to the next point */
      say(LINES[maelis.line % (LINES.length - 1)]);
      maelis.line++;
      if (maelis.index > 0) {
        leaveTrap();
      }
      const [x1, z1] = CHASE_ROUTE[maelis.index + 1];
      maelis.run = {
        x0: maelis.x,
        z0: maelis.z,
        x1,
        z1,
        t: 0,
        duration: Math.hypot(x1 - maelis.x, z1 - maelis.z) / RUN_SPEED,
      };
      maelis.index++;
    }
  }

  /* fallen too far behind: he slips away and goes back to wait at the inn */
  if (maelis.escape === 0) {
    maelis.lostFor = distance > LOST_DISTANCE ? maelis.lostFor + dt : 0;
    if (maelis.lostFor > LOST_SECONDS && maelis.index > 0) {
      reset();
      UI.systemMessage(
        "You lost Maelis in the streets. Perhaps he is back at the Salty Gull, waiting.",
      );
    }
  }

  /* far out at sea he is lost from sight, the boat goes on a little longer */
  maelis.sprite.group.visible = maelis.escape < 4.5;
  maelis.label.el.hidden = maelis.escape >= 4.5;
  maelis.sprite.group.position.set(maelis.x, maelis.escape > 0 ? WATER_Y + 0.1 : 0, maelis.z);
  maelis.sprite.update(dt, cameraState);
  UI.positionLabel(maelis.label, maelis.x, maelis.sprite.height + 0.15, maelis.z, camera);
}
