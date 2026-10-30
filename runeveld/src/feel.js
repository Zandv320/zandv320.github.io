/* Eldoria – game feel: the small touches that make a blow land and a reward count.
   - hitStop: attacker and target hold their pose for a few hundredths of a second when a blow lands
   - buzz: a short vibration on phones (taking a hit, a critical hit, a level up), unless switched off
   - flyToHud: a found item or coin flies from where it was found to the bag or the zeny counter, which then bumps
   All of it is presentation only: nothing here changes the game state. */
import * as THREE from "three";
import { icon } from "./icons.js";

export const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
const VIBRATION_KEY = "eldoria.vibration";

let vibrationOn = (() => {
  try {
    return localStorage.getItem(VIBRATION_KEY) !== "0";
  } catch (e) {
    return true;
  }
})();

export const isVibrationOn = () => vibrationOn;

export function setVibrationOn(isOn) {
  vibrationOn = isOn;
  try {
    localStorage.setItem(VIBRATION_KEY, isOn ? "1" : "0");
  } catch (e) {}
}

const projected = new THREE.Vector3();

/** Freezes the animation of these sprites for `seconds` (a crit holds longer). */
export function hitStop(sprites, seconds) {
  for (const sprite of sprites) {
    if (sprite) {
      sprite.freeze(seconds);
    }
  }
}

/* vibration patterns in milliseconds */
const BUZZ = {
  hurt: 18,
  crit: 12,
  levelUp: [30, 60, 40],
  death: [80, 60, 160],
};

/** A short vibration on touch devices that have it, unless switched off in the settings. */
export function buzz(kind) {
  if (!IS_TOUCH || !vibrationOn || !navigator.vibrate) {
    return;
  }
  try {
    navigator.vibrate(BUZZ[kind] || 10);
  } catch (e) {
    /* some browsers refuse vibration outside a user gesture; then it simply does not buzz */
  }
}

/* the first of these that is on screen receives the flying icon */
const TARGETS = {
  bag: ["#inventory-button"],
  zeny: ["#hud-zeny"],
};

function targetElement(kind) {
  for (const selector of TARGETS[kind]) {
    const el = document.querySelector(selector);
    if (el && el.offsetParent !== null) {
      return el;
    }
  }
  return null;
}

/**
 * An icon (item id from the icon atlas) flies from a world point to the bag button or the zeny counter.
 * `kind` 'bag' or 'zeny'; `delay` in seconds lets several items leave one after the other.
 */
export function flyToHud(itemId, emoji, x, y, z, camera, kind = "bag", delay = 0) {
  const target = targetElement(kind);
  if (!target) {
    return;
  }
  projected.set(x, y, z).project(camera);
  if (projected.z > 1) {
    return;
  }
  const fromX = ((projected.x + 1) / 2) * innerWidth;
  const fromY = ((1 - projected.y) / 2) * innerHeight;
  const box = target.getBoundingClientRect();
  const toX = box.left + box.width / 2;
  const toY = box.top + box.height / 2;

  const el = document.createElement("div");
  el.className = "fly-icon";
  el.innerHTML = icon(itemId, emoji);
  el.style.left = fromX + "px";
  el.style.top = fromY + "px";
  document.body.appendChild(el);
  /* an arc: up out of the spot first, then into the target */
  const dx = toX - fromX;
  const dy = toY - fromY;
  const animation = el.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%, -120%) scale(1.25)", opacity: 1, offset: 0.25 },
      {
        transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.35 - 40}px)) scale(1)`,
        opacity: 1,
        offset: 0.6,
      },
      {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.55)`,
        opacity: 0.9,
      },
    ],
    { duration: 750, delay: delay * 1000, easing: "cubic-bezier(0.45, 0, 0.55, 1)", fill: "both" },
  );
  animation.onfinish = () => {
    el.remove();
    target.classList.remove("bump");
    /* restart the bump animation */
    void target.offsetWidth;
    target.classList.add("bump");
  };
}
