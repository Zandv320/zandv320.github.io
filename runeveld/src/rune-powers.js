/* Eldoria – the rune powers (rules/runes.js) in play: the rune slot on the hotbar (Q), calling the power, and what
   it does: the Moon Rune's Moonward, a shell of moonlight that takes the blows for a while, the Ember Rune's
   Emberbreath, a cone of the First Flame before the hero, and the Tide Rune's Undertow, a whirl of water that drags
   the monsters round the hero in and holds them. */
import { RUNES, activeRune } from "./rules/runes.js";
import { player, game, monsters, now, hpMax, derived, playEffect } from "./game-state.js";
import { spellHit } from "./rules/combat.js";
import { hitMonster, playOnce } from "./player.js";
import { camera, shakeCamera } from "./world.js";
import { groundRing } from "./skill-effects.js";
import { burst, trail } from "./particles.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const MOON_COLOR = 0xc8b0ff;

const runeSlot = () => document.querySelector('#hotbar .slot[data-skill="rune"]');

/** Shows the rune slot when the hero has a rune, with its power's icon and name. */
export function refreshRuneSlot() {
  const slot = runeSlot();
  const id = activeRune(player.runes);
  slot.hidden = !id;
  if (!id) {
    return;
  }
  const rune = RUNES[id];
  slot.title = `${rune.power} (${rune.name}): ${rune.description}`;
  slot.querySelector(".slot-icon").textContent = rune.icon;
  slot.querySelector(".slot-name").textContent = rune.power;
}

/** A rune was bound to the hero (the reward of the quest that restored its seal). */
export function bindRune(id) {
  if (!RUNES[id] || player.runes.includes(id)) {
    return;
  }
  player.runes = [...player.runes, id];
  refreshRuneSlot();
  /* a new stone in the rune codex: a mark on its button until it is opened */
  document.querySelector("#runes-button")?.classList.add("attention");
  const rune = RUNES[id];
  setTimeout(() => {
    UI.announce(rune.name, `${rune.power} is yours. Press Q to call it.`);
    screenFlash("200, 176, 255");
    sfx.levelUp();
    groundRing(player.x, player.z, parseInt(rune.color.slice(1), 16), 0.4, 3, 0.8, 0.9);
  }, 2800);
  UI.logMessage(
    `<span class="level-msg">The ${UI.escapeHtml(rune.name)} is bound to you: ${UI.escapeHtml(rune.power)} (Q). ${UI.escapeHtml(rune.description)}</span>`,
  );
}

/** Calls the power of the hero's rune (the Q key or the slot). */
export function useRunePower() {
  const id = activeRune(player.runes);
  if (!id || player.isDead) {
    return;
  }
  const time = now();
  if ((player.cooldowns.rune || 0) > time) {
    return;
  }
  const rune = RUNES[id];
  player.cooldowns.rune = time + rune.cooldown;
  if (id === "moon") {
    moonward(rune, time);
  } else if (id === "ember") {
    emberbreath(rune);
  } else if (id === "tide") {
    undertow(rune);
  }
}

const TIDE_COLOR = 0x7fe0d4;

/* Undertow: every monster round the hero is dragged in (a pull, sent like a blow's push), held, and hit; the hero
   heals a little for each */
function undertow(rune) {
  playOnce("attack", 0.6);
  sfx.bossSlam();
  shakeCamera(0.18, 0.35);
  screenFlash("120, 220, 210");
  playEffect("whirl", player.x, player.z, {
    size: rune.radius * 0.9,
    grounded: true,
    tint: TIDE_COLOR,
  });
  playEffect("ripples", player.x, player.z, {
    size: rune.radius,
    grounded: true,
    tint: TIDE_COLOR,
  });
  groundRing(player.x, player.z, TIDE_COLOR, 0.3, rune.radius, 0.7, 0.9);
  const time = now();
  const caught = [...monsters.values()].filter(
    (monster) =>
      !monster.isDead &&
      !monster.isSubmerged &&
      monster.sprite.group.visible &&
      Math.hypot(monster.x - player.x, monster.z - player.z) <= rune.radius,
  );
  if (!caught.length) {
    UI.systemMessage(`${rune.power} caught nothing.`);
  }
  const stats = derived();
  for (const monster of caught) {
    monster.frozenUntil = time + rune.hold;
    playEffect("splash", monster.x, monster.z, { size: 1.4, grounded: true, tint: TIDE_COLOR });
    /* a negative force: towards the hero instead of away */
    hitMonster(
      monster,
      spellHit({ matk: Math.max(stats.atk, stats.matk), mult: rune.mult }),
      "undertow",
    );
  }
  if (caught.length) {
    game.network.send("freeze", { ids: caught.map((monster) => monster.id), duration: rune.hold });
    const heal = Math.round(hpMax() * Math.min(rune.healMax, rune.heal * caught.length));
    player.hp = Math.min(hpMax(), player.hp + heal);
    UI.floatingText(player.x, player.sprite.height + 0.6, player.z, camera, `+${heal}`, "heal");
  }
  UI.floatingText(player.x, player.sprite.height + 0.4, player.z, camera, "Undertow", "skill");
}

const EMBER_COLOR = 0xff8a2a;

/* Emberbreath: fire in a cone before the hero (towards their target, else the way they face) */
function emberbreath(rune) {
  const target = player.target && !player.target.isDead ? player.target : null;
  let [dx, dz] = target
    ? [target.x - player.x, target.z - player.z]
    : [player.sprite.facing.x, player.sprite.facing.y];
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;
  player.sprite.face(dx, dz);
  playOnce("attack", 0.6);
  sfx.bossSlam();
  shakeCamera(0.2, 0.3);
  screenFlash("255, 150, 60");
  /* the flames roll out along the cone, the far ones a moment later */
  for (let step = 1; step <= 5; step++) {
    const reach = (step / 5) * rune.range;
    const spread = Math.tan(rune.angle / 2) * reach;
    for (const side of step < 3 ? [0] : [-0.6, 0, 0.6]) {
      const x = player.x + dx * reach - dz * spread * side;
      const z = player.z + dz * reach + dx * spread * side;
      setTimeout(() => {
        playEffect("fire", x, z, { size: 1 + step * 0.25, grounded: true });
        trail(x, 0.8, z, EMBER_COLOR);
      }, step * 60);
    }
  }
  burst(player.x + dx, 1, player.z + dz, { color: EMBER_COLOR, count: 24, speed: 5, size: 3 });
  const stats = derived();
  setTimeout(() => {
    let isAnyHit = false;
    for (const monster of monsters.values()) {
      if (monster.isDead || !monster.sprite.group.visible) {
        continue;
      }
      const mx = monster.x - player.x;
      const mz = monster.z - player.z;
      const along = mx * dx + mz * dz;
      const distance = Math.hypot(mx, mz);
      if (distance > rune.range + 0.5 || along <= 0) {
        continue;
      }
      if (distance > 1 && along / distance < Math.cos(rune.angle / 2)) {
        continue;
      }
      isAnyHit = true;
      hitMonster(
        monster,
        spellHit({ matk: Math.max(stats.atk, stats.matk), mult: rune.mult }),
        "emberbreath",
      );
      playEffect("fire", monster.x, monster.z, { size: 1.4, y: monster.sprite.height * 0.4 });
    }
    if (!isAnyHit) {
      UI.systemMessage(`${rune.power} hit nothing.`);
    }
  }, 200);
  UI.floatingText(player.x, player.sprite.height + 0.4, player.z, camera, "Emberbreath", "skill");
}

/* Moonward: a shell that absorbs damage worth a share of the hero's HP until it is spent or its time is up */
function moonward(rune, time) {
  player.moonwardLeft = Math.round(hpMax() * rune.absorb);
  player.moonwardUntil = time + rune.duration;
  if (player.moonwardEffect) {
    player.moonwardEffect.stop();
  }
  player.moonwardEffect = playEffect("shield_dome", player.x, player.z, {
    size: 3,
    y: 0.05,
    grounded: true,
    tint: MOON_COLOR,
    loop: true,
    follow: player,
    additive: true,
  });
  groundRing(player.x, player.z, MOON_COLOR, 0.4, 2.4, 0.6, 0.9);
  burst(player.x, 1.2, player.z, { color: MOON_COLOR, count: 18, speed: 3 });
  sfx.chime();
  UI.floatingText(player.x, player.sprite.height + 0.4, player.z, camera, "Moonward", "heal");
}

/** Is a rune power running now (for the slot's highlight)? */
export const isRunePowerActive = () =>
  now() < (player.moonwardUntil || 0) && player.moonwardLeft > 0;

/** Seconds until the rune power can be called again, as a share of its cooldown (for the slot's shade). */
export function runeCooldownShare() {
  const id = activeRune(player.runes);
  return id ? ((player.cooldowns.rune || 0) - now()) / RUNES[id].cooldown : 0;
}

/**
 * Damage about to reach the hero: the moon shell takes what it can. Returns what is left of the blow.
 * @param {number} damage after defense
 */
export function absorbWithRunes(damage) {
  if (!isRunePowerActive()) {
    return damage;
  }
  const absorbed = Math.min(player.moonwardLeft, damage);
  player.moonwardLeft -= absorbed;
  UI.floatingText(player.x, player.sprite.height + 0.3, player.z, camera, `-${absorbed}`, "miss");
  return damage - absorbed;
}

/** Per frame: the shell breaks when it is spent or its time is up. */
export function updateRunePowers() {
  if (!player.moonwardEffect) {
    return;
  }
  if (!isRunePowerActive() || player.isDead) {
    player.moonwardEffect.stop();
    player.moonwardEffect = null;
    player.moonwardLeft = 0;
    burst(player.x, 1, player.z, { color: MOON_COLOR, count: 14, speed: 3 });
  }
}
