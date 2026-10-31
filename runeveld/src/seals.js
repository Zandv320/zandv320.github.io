/* Eldoria – the seals of the Shattered Runes in the world (Saga II). For now the seventh seal: the old altar in
   Whisperwood. During "What the altar remembers" a tap on the altar wakes its four moon runes one by one, in the
   order of the moon (the plaque in the crypt gave it), and the quest is done; the quest's reward binds the Moon
   Rune (rules/runes.js). Outside that quest the altar only says something about its runes. */
import * as THREE from "three";
import { ALTAR_CLEARING } from "./regions.js";
import { QUESTS } from "./rules/quests.js";
import { scene, shakeCamera } from "./world.js";
import { player, game, playEffect } from "./game-state.js";
import { groundRing } from "./skill-effects.js";
import { burst } from "./particles.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const MOON_COLOR = 0xc8b0ff;
/* the four runes around the altar, as they wake: dark, sickle, half and full moon */
const MOON_RUNES = ["dark moon", "sickle moon", "half moon", "full moon"];
/* how far a hero reaches to lay a hand on the altar */
const USE_DISTANCE = 2.8;

const state = { objects: [], isWaking: false };

/** The clickable spot on the old altar (world.js calls this with its build context). */
export function buildSeals() {
  const [x, z] = ALTAR_CLEARING;
  /* see-through, not invisible: the click handler skips invisible meshes */
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.4, 2.4),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.set(x, 0.7, z);
  scene.add(mesh);
  const object = { kind: "seal", seal: "moon", x, z, mesh };
  mesh.userData.sealObject = object;
  state.objects.push(object);
}

/** The clickable meshes of the seals. */
export const sealClickables = () => state.objects.map((object) => object.mesh);

/** Clicked a seal: walk to it, then lay a hand on it. */
export function clickSeal(object) {
  const use = () => touchSeal(object);
  if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE) {
    use();
    return;
  }
  const dx = player.x - object.x;
  const dz = player.z - object.z;
  const length = Math.hypot(dx, dz) || 1;
  player.destination = [object.x + (dx / length) * 2.2, object.z + (dz / length) * 2.2];
  player.onArrive = () => {
    if (Math.hypot(object.x - player.x, object.z - player.z) <= USE_DISTANCE + 0.6) {
      use();
    }
  };
  player.target = null;
}

/* is a ritual quest for this seal waiting to be done? */
const isRitualWaiting = (seal) =>
  Object.entries(player.quests || {}).some(([id, record]) => {
    const goal = QUESTS[id]?.goal;
    return (
      record.state === "active" && !record.count && goal?.type === "ritual" && goal.seal === seal
    );
  });

function touchSeal(object) {
  if (state.isWaking) {
    return;
  }
  if (!isRitualWaiting(object.seal)) {
    const isBound = (player.runes || []).includes(object.seal);
    UI.systemMessage(
      isBound
        ? "The moon runes glow faintly under your hand. The seal holds, for now."
        : "Old runes, worn almost smooth, run around the altar. They are cold.",
    );
    return;
  }
  wakeRunes(object);
}

/* the four runes wake one by one around the altar, then the seal answers */
function wakeRunes(object) {
  state.isWaking = true;
  player.destination = null;
  UI.systemMessage(
    "You lay your hand on the altar. Under your fingers the old runes begin to glow.",
  );
  MOON_RUNES.forEach((name, i) => {
    setTimeout(
      () => {
        const angle = -Math.PI / 2 + (i / MOON_RUNES.length) * Math.PI * 2;
        const x = object.x + Math.cos(angle) * 2.6;
        const z = object.z + Math.sin(angle) * 2.6;
        groundRing(x, z, MOON_COLOR, 0.2, 1.1, 0.7, 0.9);
        playEffect("sparkle", x, z, { size: 1.6, grounded: true, tint: MOON_COLOR });
        burst(x, 0.6, z, { color: MOON_COLOR, count: 10, speed: 2.5 });
        sfx.chime();
        UI.systemMessage(`The ${name} wakes.`);
      },
      600 + i * 700,
    );
  });
  setTimeout(
    () => {
      groundRing(object.x, object.z, MOON_COLOR, 0.5, 6, 1.1, 0.9);
      playEffect("light_rays", object.x, object.z, { size: 4, grounded: true, tint: MOON_COLOR });
      screenFlash("200, 176, 255");
      shakeCamera(0.15, 0.5);
      sfx.bossIntro();
      UI.announce("The Seventh Seal", "The moon runes wake. The seal remembers its makers.");
      game.questLog.onRitual(object.seal);
      state.isWaking = false;
    },
    600 + MOON_RUNES.length * 700 + 400,
  );
}
