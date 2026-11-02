/* Eldoria – the loading screen: the title, a bar that fills as the game really loads (the pictures as they arrive,
   then each step of building the world) and a tip to read meanwhile. Every step leaves a performance mark
   ("eldoria:<step>"), so the time each one takes can be read in the browser's performance tools. */
import { textureLoads } from "./sprites.js";

const TIPS = [
  "Click the ground to walk, right-click a monster to attack it.",
  "Press C for your character: stats, skills and equipment.",
  "Old Mette by the well knows where the story begins.",
  "A rune of flame or frost makes your weapon burn or freeze.",
  "The Wayside Shrine, the Old Watchtower and the falls of Greyfall Gorge are worth a walk.",
  "Fishing, mining and woodcutting all have their tools at Merchant Bram's stall.",
  "Party up with friends: the monsters' loot is shared.",
  "Press M for the map of the world.",
];

const $ = (selector) => document.querySelector(selector);

/* the share of the bar each step fills, in order */
let from = 0;
let to = 0;
let texturesAtStart = 0;
let shown = 0;
let frame = 0;
let tipTimer = 0;

function showFill() {
  const fill = $("#loading-fill");
  if (fill) {
    fill.style.transform = `scaleX(${shown.toFixed(4)})`;
  }
}

function paint() {
  /* within a step the bar follows the pictures that step asked for, and creeps on while it builds */
  const asked = textureLoads.requested - texturesAtStart;
  const arrived = textureLoads.done - texturesAtStart;
  const within = asked > 0 ? arrived / asked : 0.5;
  const target = from + (to - from) * Math.min(1, within);
  shown += (target - shown) * 0.15;
  showFill();
  frame = requestAnimationFrame(paint);
}

/** A new step of loading, shown as `label`, filling the bar up to `upTo` (0 to 1) when it is done. */
export function loadingStep(label, upTo) {
  performance.mark("eldoria:" + label);
  from = to;
  to = upTo;
  texturesAtStart = textureLoads.done;
  /* the bar is at least where the steps before brought it, also when no frame is drawn in between */
  shown = Math.max(shown, from);
  showFill();
  const text = $("#loading-step");
  if (text) {
    text.textContent = label;
  }
  if (!frame) {
    frame = requestAnimationFrame(paint);
    showTip();
  }
}

function showTip() {
  const tip = $("#loading-tip");
  if (tip) {
    tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    tip.classList.remove("fresh");
    void tip.offsetWidth;
    tip.classList.add("fresh");
  }
  tipTimer = setTimeout(showTip, 5000);
}

/** Loading is over: the bar fills and the screen fades away. */
export function loadingDone() {
  performance.mark("eldoria:ready");
  from = to = 1;
  shown = 1;
  showFill();
  clearTimeout(tipTimer);
  setTimeout(() => {
    cancelAnimationFrame(frame);
    $("#loading").classList.add("away");
  }, 250);
}
