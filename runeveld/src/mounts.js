/* Eldoria – riding (the rules are in rules/mounts.js). The hero calls the mount in their mount slot (H, or the slot on
   the hotbar) and sits in its saddle. A mount is drawn in two layers with the rider between them
   (tools/build_mounts.py): under the rider the animal, its blanket and saddle; over the rider what is nearer the
   camera than their legs (the pommel, the reins, the stirrup; seen from the front the animal's head, from behind
   its haunches and tail). Every frame the rider's hips go to the seat of the animal's frame, so they rise and fall
   with its stride. Off its back for any fight, a seat, the helm or a crafting station, and where riding is not
   allowed. The other players' mounts are drawn the same way, from their presence. */
import { MOUNTS, mountOf, canRideAt } from "./rules/mounts.js";
import { ITEMS } from "./data.js";
import { SHEETS } from "./sheets.js";
import { Sprite2D } from "./sprites.js";
import { scene, cameraState } from "./world.js";
import { player, game, playEffect } from "./game-state.js";
import { burst } from "./particles.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

/* the game's sixteen pixels to a unit */
const PPU = 16;
/* how far before the animal the rider is drawn, and the front layer before the rider (along the view) */
const RIDER_AHEAD = 0.03;
const FRONT_AHEAD = 0.06;
/* how far behind the rider a hand on the far side goes: behind the animal too */
const FAR_SIDE = 0.12;

/* The hand on the far side of the animal holds what it holds behind it: the weapon (right hand) riding to the left,
   the shield (left hand) riding to the right. Those layers are moved back along the view, behind the animal; the
   others stay where they are. `isRiding` false puts every layer back. */
function sortHands(rider, isRiding, tilt) {
  for (const layer of rider.layers) {
    const data = layer.source?.userData || {};
    const isFar =
      isRiding &&
      ((rider.direction === "left" && data.isWeapon) ||
        (rider.direction === "right" && data.isShield));
    if (isFar) {
      layer.baseZ ??= layer.mesh.position.z;
      layer.isFar = true;
      layer.mesh.position.y = -Math.sin(tilt) * FAR_SIDE;
      layer.mesh.position.z = layer.baseZ - Math.cos(tilt) * FAR_SIDE;
    } else if (layer.isFar) {
      layer.isFar = false;
      layer.mesh.position.y = 0;
      layer.mesh.position.z = layer.baseZ;
    }
  }
}

/** The mount in the hero's slot (a key of MOUNTS), or null. */
export const heroMount = () => mountOf(player.equipment, ITEMS);

/** How much faster the hero goes now: a share (0 on foot). */
export const mountSpeed = () => (player.riding ? MOUNTS[player.riding].speed : 0);

/** How much higher a rider's name goes on this mount (0 on foot). */
export const riderLift = (key) => (key && MOUNTS[key] ? 1.5 : 0);

/* the seats of every mount, loaded once: {frame, feet, seats: anim → direction → [[x, y] per frame]}, in the
   pixels of the original sheet (the smooth sheets are twice as large) */
const seats = {};
for (const [key, spec] of Object.entries(MOUNTS)) {
  fetch(spec.seats)
    .then((response) => response.json())
    .then((data) => {
      seats[key] = data;
    })
    .catch(() => {});
}

/* A mount in the scene: its two layers, kept in step. */
function createRig(key) {
  const spec = MOUNTS[key];
  const back = new Sprite2D(SHEETS[spec.sheet], { shadow: spec.shadow });
  const front = new Sprite2D(SHEETS[spec.front], { shadow: 0 });
  scene.add(back.group, front.group);
  return { key, back, front };
}

function removeRig(rig) {
  scene.remove(rig.back.group, rig.front.group);
  rig.back.dispose();
  rig.front.dispose();
}

/* Per frame: the animal where its rider is, facing their way, walking or standing; the rider in its saddle. */
function updateRig(rig, rider, x, z, isMoving, dt) {
  const { back, front } = rig;
  back.group.position.set(x, 0, z);
  back.face(rider.facing.x, rider.facing.y);
  back.play(isMoving ? "walk" : "idle");
  back.update(dt, cameraState);
  /* the front layer shows the very same frame */
  front.face(rider.facing.x, rider.facing.y);
  front.play(back.animName);
  front.time = back.time;
  front.update(0, cameraState);
  /* along the view: right, up the leaning picture, and towards the camera */
  const yaw = cameraState.yaw;
  const tilt = cameraState.tilt;
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [-Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), -Math.sin(tilt) * Math.cos(yaw)];
  const toward = [Math.cos(tilt) * Math.sin(yaw), Math.sin(tilt), Math.cos(tilt) * Math.cos(yaw)];
  front.group.position.set(
    x + toward[0] * FRONT_AHEAD,
    toward[1] * FRONT_AHEAD,
    z + toward[2] * FRONT_AHEAD,
  );
  /* the rider's hips on the seat of this frame; their feet half a unit (eight pixels) below */
  const data = seats[rig.key];
  const frames = data?.seats[back.animName]?.[back.direction];
  if (!frames) {
    return;
  }
  const [seatX, seatY] = frames[back.frame % frames.length];
  const across = (seatX + 0.5 - data.frame / 2) / PPU;
  const height = (data.frame - data.feet - (seatY + 0.5)) / PPU - 0.5;
  rider.group.position.set(
    x + right[0] * across + up[0] * height + toward[0] * RIDER_AHEAD,
    up[1] * height + toward[1] * RIDER_AHEAD,
    z + right[2] * across + up[2] * height + toward[2] * RIDER_AHEAD,
  );
  sortHands(rider, true, tilt);
  /* nothing tipped towards the camera below a rider's feet: their blade hangs down the animal's flank */
  rider.setFold(false);
}

/* a puff and a sound where the mount comes or goes */
function puff(x, z) {
  playEffect("smoke", x, z, { size: 1.8, grounded: true });
  burst(x, 0.8, z, { color: 0xf0d8b8, count: 16, speed: 2.6, size: 2.4 });
}

/* the hero's mount, while riding */
let heroRig = null;

/** Calls the mount (or says why not). */
export function mountUp() {
  const key = heroMount();
  if (!key) {
    UI.systemMessage(
      "You have no mount. Put one in your mount slot (Stablemaster Hilde in Aurelia sells them).",
    );
    return;
  }
  if (player.isDead || player.riding) {
    return;
  }
  if (player.ship) {
    UI.systemMessage("You are at the helm of a ship.");
    return;
  }
  if (!canRideAt(player.x, player.z)) {
    UI.systemMessage("There is no room to ride down here.");
    return;
  }
  player.isSitting = false;
  player.riding = key;
  heroRig = createRig(key);
  if (player.sprite.shadow) {
    player.sprite.shadow.visible = false;
  }
  player.anim = "";
  puff(player.x, player.z);
  sfx.chime();
}

/** Off the mount's back; `message` says why, when it was not the hero's own choice. */
export function dismount(message = "") {
  if (!player.riding) {
    return;
  }
  puff(player.x, player.z);
  player.riding = null;
  if (heroRig) {
    removeRig(heroRig);
    heroRig = null;
  }
  sortHands(player.sprite, false, cameraState.tilt);
  player.sprite.setFold(true);
  if (player.sprite.shadow) {
    player.sprite.shadow.visible = true;
  }
  player.sprite.group.position.set(player.x, 0, player.z);
  player.anim = "";
  if (message) {
    UI.systemMessage(message);
  }
}

/** H, or the slot on the hotbar: up on the mount, or off it. */
export function toggleMount() {
  if (player.riding) {
    dismount();
  } else {
    mountUp();
  }
}

/** Per frame, after the hero moved: the mount under them, in step; off it where riding is not allowed. */
export function updateHeroMount(dt, isMoving) {
  if (!player.riding) {
    return;
  }
  if (heroMount() !== player.riding) {
    dismount();
    return;
  }
  if (player.isDead || player.ship || player.workAnim || !canRideAt(player.x, player.z)) {
    dismount(player.isDead || player.ship ? "" : "You get off your mount.");
    return;
  }
  updateRig(heroRig, player.sprite, player.x, player.z, isMoving, dt);
}

/** Per frame for another player: their mount under them while they ride (`key`), none when they do not. */
export function updatePeerMount(peer, key, isMoving, dt) {
  const wanted = key && MOUNTS[key] ? key : null;
  if ((peer.rig?.key || null) !== wanted) {
    removePeerMount(peer);
    if (wanted) {
      peer.rig = createRig(wanted);
      puff(peer.x, peer.z);
    }
  }
  if (peer.rig) {
    updateRig(peer.rig, peer.sprite, peer.x, peer.z, isMoving, dt);
  }
}

/** A player left (or stopped riding): their mount goes too. */
export function removePeerMount(peer) {
  if (peer.rig) {
    removeRig(peer.rig);
    peer.rig = null;
    sortHands(peer.sprite, false, cameraState.tilt);
    peer.sprite.setFold(true);
  }
}

/** The first mount in the slot: a word on how to ride, once (guide.js). */
export function teachRiding() {
  if (heroMount() && game.guide) {
    game.guide.teach("riding");
  }
}
