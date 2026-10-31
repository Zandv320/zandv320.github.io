/* Eldoria – the rune powers (rules/runes.js) in play: the rune slot on the hotbar (Q), calling the power, and what
   it does. For now there is one: the Moon Rune's Moonward, a shell of moonlight that takes the blows for a while. */
import { RUNES, activeRune } from "./rules/runes.js";
import { player, now, hpMax, playEffect } from "./game-state.js";
import { camera } from "./world.js";
import { groundRing } from "./skill-effects.js";
import { burst } from "./particles.js";
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
  const rune = RUNES[id];
  setTimeout(() => {
    UI.announce(rune.name, `${rune.power} is yours. Press Q to call it.`);
    screenFlash("200, 176, 255");
    sfx.levelUp();
    groundRing(player.x, player.z, MOON_COLOR, 0.4, 3, 0.8, 0.9);
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
  }
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
