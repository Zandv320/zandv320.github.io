/* Eldoria – HUD, name labels, floating damage numbers and the chat log. */
import * as THREE from "three";

export const $ = (selector) => document.querySelector(selector);

const labelsLayer = $("#labels");
const fxLayer = $("#fx-layer");
const chatLog = $("#chat-log");
const projected = new THREE.Vector3();

/** Projects a world point to screen space; the result is in `projected` (x/y in -1..1, z > 1 behind the camera). */
function project(x, y, z, camera) {
  projected.set(x, y, z).project(camera);
}

/**
 * Creates a name label above a character.
 * @param {string} kind CSS class of the label: 'player', 'other', 'monster' or 'npc'
 * @param {string} name text shown in the label
 * @returns {{el: HTMLElement, nameEl: HTMLElement, hp: HTMLElement, hpFill: HTMLElement, bubble: HTMLElement|null, timer: number}}
 */
export function createLabel(kind, name) {
  const el = document.createElement("div");
  el.className = "label " + kind;
  el.innerHTML =
    '<div class="quest-mark" hidden></div><div class="name"></div><div class="hp" hidden><i></i></div>';
  el.querySelector(".name").textContent = name;
  // hidden until positionLabel places it; otherwise labels created before the game starts (monsters arriving from
  // the server while the character select is open) pile up in the top-left corner
  el.style.display = "none";
  labelsLayer.appendChild(el);
  return {
    el,
    nameEl: el.querySelector(".name"),
    hp: el.querySelector(".hp"),
    hpFill: el.querySelector(".hp i"),
    bubble: null,
    timer: 0,
  };
}

/** Moves a label to the screen position of a world point, and hides it when it is off screen. */
export function positionLabel(label, x, y, z, camera) {
  project(x, y, z, camera);
  const isOffScreen = projected.z > 1 || Math.abs(projected.x) > 1.3 || Math.abs(projected.y) > 1.3;
  if (isOffScreen) {
    label.el.style.display = "none";
    return;
  }
  label.el.style.display = "";
  const screenX = (((projected.x + 1) / 2) * innerWidth).toFixed(1);
  const screenY = (((1 - projected.y) / 2) * innerHeight).toFixed(1);
  label.el.style.transform = `translate(${screenX}px,${screenY}px) translate(-50%,-100%)`;
}

/** Shows or hides the small hp bar under a label and sets its fill. */
export function setLabelHp(label, hp, max, isVisible) {
  label.hp.hidden = !isVisible;
  if (isVisible) {
    label.hpFill.style.transform = `scaleX(${Math.max(0, hp / max).toFixed(3)})`;
  }
}

export function removeLabel(label) {
  label.el.remove();
}

/* Red screen edge on damage; the `low` class keeps a soft pulse going while hp is low. */
export function hurtFlash() {
  const overlay = $("#hurt-overlay");
  overlay.classList.remove("flash");
  // Reading offsetWidth forces a reflow so the animation restarts.
  void overlay.offsetWidth;
  overlay.classList.add("flash");
}

export function setLowHp(isLow) {
  $("#hurt-overlay").classList.toggle("low", !!isLow);
}

/**
 * Quest marker above an npc. The kind doubles as the CSS class of the marker.
 * @param {object} label label from createLabel
 * @param {'new'|'in-progress'|'ready'|null} kind '!' for a new quest, a grey '?' while one is in progress,
 *   a gold '?' when one is ready to turn in, or null for no marker
 */
export function setQuestMarker(label, kind) {
  const marker = label.el.querySelector(".quest-mark");
  marker.hidden = !kind;
  marker.className = "quest-mark " + (kind || "");
  if (kind === "new") {
    marker.textContent = "!";
  } else {
    marker.textContent = kind ? "?" : "";
  }
}

/** Shows a speech bubble above a label for six seconds. */
export function speechBubble(label, text) {
  if (label.bubble) {
    label.bubble.remove();
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  label.el.appendChild(bubble);
  label.bubble = bubble;
  clearTimeout(label.timer);
  label.timer = setTimeout(() => {
    bubble.remove();
    if (label.bubble === bubble) {
      label.bubble = null;
    }
  }, 6000);
}

/**
 * Floating number or word above a world point (damage, heal, exp, "Miss").
 * @param {string} kind '', 'own', 'skill', 'crit', 'heal', 'exp', 'miss' or 'hurt'
 */
export function floatingText(x, y, z, camera, text, kind = "") {
  project(x, y, z, camera);
  if (projected.z > 1) {
    return;
  }
  const el = document.createElement("div");
  el.className = "damage " + kind;
  el.textContent = text;
  // A little horizontal jitter so numbers in quick succession do not stack on top of each other.
  const jitter = Math.random() * 24 - 12;
  el.style.left = (((projected.x + 1) / 2) * innerWidth + jitter).toFixed(0) + "px";
  el.style.top = (((1 - projected.y) / 2) * innerHeight).toFixed(0) + "px";
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/** Appends a line of HTML to the chat log, keeping the last 60 lines. */
export function logMessage(html) {
  const line = document.createElement("div");
  line.innerHTML = html;
  chatLog.appendChild(line);
  while (chatLog.children.length > 60) {
    chatLog.firstChild.remove();
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

export function systemMessage(text) {
  logMessage('<span class="system">' + escapeHtml(text) + "</span>");
}

export function chatMessage(who, text) {
  logMessage('<span class="who">' + escapeHtml(who) + ":</span> " + escapeHtml(text));
}

let announceTimer = 0;
let announcePlacer = 0;

/* Below the frames at the top (player, target and party on the left; status, minimap and quests on the right)
   when it would otherwise cover one of them. */
function placeAnnouncement(el) {
  el.style.top = "";
  const box = el.getBoundingClientRect();
  let top = box.top;
  /* twice: moving below one frame can bring it next to the other */
  for (let pass = 0; pass < 2; pass++) {
    for (const selector of ["#top-left", "#top-right"]) {
      const frame = $(selector);
      const other = frame ? frame.getBoundingClientRect() : null;
      if (!other || !other.width) {
        continue;
      }
      const overlapsX = box.left < other.right && other.left < box.right;
      const overlapsY = top < other.bottom && other.top < top + box.height;
      if (overlapsX && overlapsY) {
        top = other.bottom + 12;
      }
    }
  }
  if (top !== box.top) {
    el.style.top = `${(top + box.height / 2).toFixed(0)}px`;
  }
}

/** Large centred announcement (level up, quest done), cleared after a few seconds. */
export function announce(title, subtitle = "") {
  const el = $("#announcement");
  let html = '<div class="large">' + escapeHtml(title) + "</div>";
  if (subtitle) {
    html += '<div class="small">' + escapeHtml(subtitle) + "</div>";
  }
  el.innerHTML = html;
  placeAnnouncement(el);
  /* the frames can grow while it shows (a new target, a party): keep it clear of them */
  clearInterval(announcePlacer);
  announcePlacer = setInterval(() => placeAnnouncement(el), 200);
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    el.innerHTML = "";
    clearInterval(announcePlacer);
  }, 2600);
}

/**
 * Refreshes the player frame and the counters in the HUD.
 * @param {object} player hero record (name, level, jobLevel, hp, sp, exp, jobExp, zeny)
 * @param {number} hpMax
 * @param {number} spMax
 * @param {number} expToNextLevel
 * @param {number} potionCount number shown on the potion slot
 * @param {string} [className] class name for the frame; left alone when empty
 * @param {number} [jobExpToNextLevel] 0 at the maximum job level; the job bar is left alone when undefined
 */
export function updateHud(
  player,
  hpMax,
  spMax,
  expToNextLevel,
  potionCount,
  className,
  jobExpToNextLevel,
) {
  $("#hud-name").textContent = player.name;
  $("#hud-level").textContent = player.level;
  $("#hud-job").textContent = player.jobLevel;
  if (className) {
    $("#hud-class").textContent = className;
  }

  $("#hud-hp").style.transform = `scaleX(${(player.hp / hpMax).toFixed(3)})`;
  $("#hud-hp-text").textContent = Math.ceil(player.hp) + " / " + hpMax;
  $("#hud-sp").style.transform = `scaleX(${(player.sp / spMax).toFixed(3)})`;
  $("#hud-sp-text").textContent = Math.floor(player.sp) + " / " + spMax;
  $("#hud-exp").style.transform = `scaleX(${(player.exp / expToNextLevel).toFixed(3)})`;
  $("#hud-exp-bar").title = "Experience: " + player.exp + " / " + expToNextLevel;

  if (jobExpToNextLevel !== undefined) {
    const jobFill = jobExpToNextLevel
      ? Math.min(1, player.jobExp / jobExpToNextLevel).toFixed(3)
      : 1;
    $("#hud-job-exp").style.transform = `scaleX(${jobFill})`;
    $("#hud-job-bar").title = jobExpToNextLevel
      ? "Job experience: " + player.jobExp + " / " + jobExpToNextLevel
      : "Job level at maximum";
  }

  $("#hud-zeny").textContent = player.zeny;
  $("#hud-potions").textContent = potionCount;
  $("#shop-zeny").textContent = player.zeny;
}

let targetLabel = null;

/** Shows the target frame for a monster (and marks its label), or hides it when `monster` is null. */
export function setTargetFrame(monster) {
  const frame = $("#target-frame");
  if (targetLabel) {
    targetLabel.el.classList.remove("target");
    targetLabel = null;
  }
  if (!monster) {
    frame.hidden = true;
    return;
  }
  targetLabel = monster.label;
  targetLabel.el.classList.add("target");
  frame.hidden = false;
  $("#target-name").textContent = monster.spec.name;
  $("#target-level").textContent = "Lv " + monster.spec.level;
  $("#target-hp").style.transform = `scaleX(${Math.max(0, monster.hp / monster.hpMax).toFixed(3)})`;
  $("#target-hp-text").textContent = Math.max(0, Math.ceil(monster.hp)) + " / " + monster.hpMax;
}

/** Sets the cooldown shade of a hotbar slot; `fraction` 1 is fully covered, 0 is ready. */
export function setCooldown(skill, fraction) {
  const shade = document.querySelector(`.slot[data-skill="${skill}"] .cooldown`);
  if (shade) {
    const clamped = Math.max(0, Math.min(1, fraction));
    shade.style.transform = `scaleY(${clamped.toFixed(3)})`;
  }
}

/** Dims a hotbar slot when it cannot be used, and highlights it while it is active. */
export function setSlotState(skill, isUnavailable, isActive) {
  const slot = document.querySelector(`.slot[data-skill="${skill}"]`);
  if (!slot) {
    return;
  }
  slot.classList.toggle("off", !!isUnavailable);
  slot.classList.toggle("active", !!isActive);
}

export function setOnlineStatus(isConnected, playerCount) {
  $("#hud-online-dot").classList.toggle("on", isConnected);
  $("#hud-online").textContent = isConnected ? playerCount + " online" : "offline";
}
