/* Eldoria – a boss fight's frame around the fight itself: the bar across the top with the boss's name, title and
   health (its phases from rules/bosses.js marked on it), the intro the first time you face a boss (black bars, the
   camera turning to it, its name card) and the banner when it falls. The moves themselves are in boss-effects.js. */
import { player, monsters, now } from "./game-state.js";
import { BOSSES } from "./rules/bosses.js";
import { shakeCamera } from "./world.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import { escapeHtml, writeStyle, writeText } from "./ui.js";

/* the elements, looked up once (the bar is updated every frame) */
const elements = {};
const $ = (selector) =>
  elements[selector] || (elements[selector] = document.querySelector(selector));

/* a boss this close that fights you (or that you picked out) gets the bar; further than LEAVE_DISTANCE it goes */
const ENGAGE_DISTANCE = 12;
const LEAVE_DISTANCE = 24;
const INTRO_SECONDS = 2.8;
/* how long the lost health stays visible on the bar before it drains away */
const CHIP_HOLD = 0.5;
/* the phase marks on the bar: what the boss does at that much health */
const PHASES = { summon: "Calls for help", enrage: "Enrages" };

/* the boss in the bar */
let shown = null;
let chip = 1;
let chipHoldUntil = 0;
/* bosses (by monster key) the hero has met this session: the intro plays once */
const introduced = new Set();
/* the intro that is running: {boss, until} */
let intro = null;
let cardTimer = 0;

const distanceTo = (boss) => Math.hypot(boss.x - player.x, boss.z - player.z);

function isEngaged(boss) {
  if (boss.isDead || !BOSSES[boss.spec.key]) {
    return false;
  }
  const distance = distanceTo(boss);
  return (
    distance < ENGAGE_DISTANCE &&
    (player.target === boss || boss.hp < boss.hpMax || distance < (boss.spec.aggroRange || 6) + 1)
  );
}

/* the name card in the middle of the screen; `kind` 'intro' or 'defeat'. New elements each time, so the
   animations start over when one card follows another. */
function showCard(kind, title, subtitle, seconds) {
  const card = $("#boss-card");
  card.className = kind;
  card.innerHTML =
    '<i class="rule"></i><div class="name">' +
    escapeHtml(title) +
    '</div><div class="subtitle">' +
    escapeHtml(subtitle) +
    '</div><i class="rule"></i>';
  card.hidden = false;
  /* an announcement that is showing makes way (new ones wait for the card: ui.js announce()) */
  $("#announcement").innerHTML = "";
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    card.classList.add("leaving");
    cardTimer = setTimeout(() => {
      card.hidden = true;
    }, 450);
  }, seconds * 1000);
}

function setLetterbox(isOn) {
  $("#letterbox").classList.toggle("on", isOn);
}

function startIntro(boss) {
  introduced.add(boss.spec.key);
  intro = { boss, until: now() + INTRO_SECONDS };
  showCard("intro", boss.spec.name, boss.spec.title || "", INTRO_SECONDS - 0.4);
  setLetterbox(true);
  sfx.bossIntro();
  shakeCamera(0.15, 0.4);
}

function endIntro() {
  intro = null;
  setLetterbox(false);
}

function show(boss) {
  shown = boss;
  chip = boss.hp / boss.hpMax;
  boss.lastBarHealth = chip;
  writeText($("#boss-name"), boss.spec.name);
  writeText($("#boss-title"), boss.spec.title || "Lv " + boss.spec.level);
  const rules = BOSSES[boss.spec.key];
  $("#boss-notches").innerHTML = Object.keys(PHASES)
    .filter((phase) => rules[phase] && rules[phase].below)
    .map(
      (phase) =>
        `<i style="left: ${(rules[phase].below * 100).toFixed(1)}%" title="${PHASES[phase]}"></i>`,
    )
    .join("");
  const bar = $("#boss-bar");
  bar.classList.remove("leaving", "defeated");
  bar.hidden = false;
  /* on phones it sits under the player frame (ui.css) */
  document.body.classList.add("boss-fight");
  const frameBottom = $("#player-frame").getBoundingClientRect().bottom;
  bar.style.setProperty("--boss-bar-top", `${Math.round(frameBottom + 8)}px`);
  if (!introduced.has(boss.spec.key)) {
    startIntro(boss);
  }
}

function hide() {
  shown = null;
  const bar = $("#boss-bar");
  bar.classList.add("leaving");
  setTimeout(() => {
    if (!shown) {
      bar.hidden = true;
      document.body.classList.remove("boss-fight");
    }
  }, 400);
}

function defeated(boss) {
  if (intro) {
    endIntro();
  }
  showCard("defeat", boss.spec.name, "Defeated", 2.6);
  $("#boss-bar").classList.add("defeated");
  writeStyle($("#boss-fill"), "transform", "scaleX(0)");
  writeText($("#boss-hp-text"), "0 / " + boss.hpMax.toLocaleString("en-US"));
  sfx.bossDefeat();
  screenFlash("255, 220, 140");
  shown = null;
  setTimeout(() => {
    if (!shown) {
      hide();
    }
  }, 1200);
}

/** Where the camera looks during a boss's intro (between the hero and the boss), or null. */
export function bossCameraFocus() {
  if (!intro) {
    return null;
  }
  const { boss } = intro;
  return [(player.x + boss.x) / 2, (player.z + boss.z) / 2];
}

/** Per frame, after updateMonsters(): picks the boss for the bar and keeps the bar, intro and banner going. */
export function updateBossPresentation(dt) {
  const time = now();
  if (intro && (time >= intro.until || intro.boss.isDead || player.isDead)) {
    endIntro();
  }
  if (shown) {
    if (shown.isDead) {
      defeated(shown);
    } else if (distanceTo(shown) > LEAVE_DISTANCE || player.isDead) {
      hide();
    }
  }
  if (!shown && !player.isDead) {
    for (const monster of monsters.values()) {
      if (isEngaged(monster)) {
        show(monster);
        break;
      }
    }
  }
  if (!shown) {
    return;
  }

  /* the health, and the white chip of what was just lost, draining after a moment */
  const health = Math.max(0, shown.hp / shown.hpMax);
  if (health < chip && time > chipHoldUntil + CHIP_HOLD) {
    chip = Math.max(health, chip - Math.max(0.002, (chip - health) * 4 * dt));
  }
  if (health > chip) {
    chip = health;
  }
  if (health < shown.lastBarHealth) {
    chipHoldUntil = time;
  }
  shown.lastBarHealth = health;
  writeStyle($("#boss-fill"), "transform", `scaleX(${health.toFixed(4)})`);
  writeStyle($("#boss-chip"), "transform", `scaleX(${chip.toFixed(4)})`);
  writeText(
    $("#boss-hp-text"),
    Math.ceil(shown.hp).toLocaleString("en-US") + " / " + shown.hpMax.toLocaleString("en-US"),
  );
  $("#boss-bar").classList.toggle("enraged", !!shown.isEnraged);
  /* the boss bar says it all: no second frame for the same boss */
  if (player.target === shown) {
    $("#target-frame").hidden = true;
  }
}
