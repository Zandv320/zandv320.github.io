/* Eldoria – the guide: where to go next in the main story and how to do it.
   - the objective panel (top left, under the player): chapter, step, what to do and how, distance and direction
   - the waypoint: a gold marker above the target when it is in view, otherwise a compass arrow circling the hero
     and pointing at it (clear of the HUD, which sits at the edges)
   - a star on the world map and the minimap
   - the button of the panel a step needs (inventory, character sheet) glows
   - guide cards (guide-topics.js): shown once when a step introduces something new, and readable again any time
   Everything follows from the hero's quest progress (rules/quests.js), so it needs no state of its own apart from
   the cards already seen (kept in this browser). */
import * as THREE from "three";
import { QUESTS, CHAPTERS, SAGA, mainStoryStep, turnInNpc } from "./rules/quests.js";
import { GATHER_NODES } from "./rules/gather-nodes.js";
import { RECIPES, PROFESSIONS, STATION_PLACES } from "./rules/professions.js";
import { GUIDE_TOPICS } from "./guide-topics.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";

const SEEN_KEY = "eldoria.guide.seen";
/* a new step shows its tip for this long (ms), then folds it away unless the player opened it */
const HINT_SHOW_MS = 15000;
/* closer than this to the target and the waypoint steps aside */
const ARRIVED_DISTANCE = 2.6;
/* the waypoint stays this far from the screen edges (more at the bottom, above the hotbar) */
const EDGE_MARGIN = 28;

/* where to grow when the next step needs a higher level */
function levelAdvice(level) {
  if (level < 8) {
    return "Help the villagers with a ! above their head, or hunt foxes and boars in the fields around the village.";
  }
  if (level < 15) {
    return "Help the villagers with a ! above their head, or hunt wolves and stags in Whisperwood, north of the village.";
  }
  return "Take on side quests in Aurelia, or hunt bandits and dire wolves in Kingsvale, west of the village.";
}

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the guide simply forgets */
  }
};

/**
 * @param {object} deps {player, monsters, camera, questLog, npcPosition(name) → {x, z, height} | null,
 *   isDepleted(nodeId) → boolean}
 */
export function createGuide(deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#objective");
  const waypoint = $("#waypoint");
  const card = $("#guide-card");
  const projected = new THREE.Vector3();
  const seen = new Set(readJson(SEEN_KEY, []));
  let isHintOpen = true;
  let hintClosesAt = 0;
  let shownStepKey = "";
  let shownHtml = "";
  let target = null; /* {x, z, height} */
  let pulsing = null;
  const cardQueue = [];

  /* ---- what the current step asks ---- */

  const nearest = (list) => {
    const { player } = deps;
    let best = null;
    let bestDistance = Infinity;
    for (const item of list) {
      const distance = Math.hypot(item.x - player.x, item.z - player.z);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  };

  const nearestMonster = (type) =>
    nearest(
      [...deps.monsters.values()].filter(
        (monster) => !monster.isDead && monster.id.split("#")[0] === type,
      ),
    );

  const stationOf = (kind) => nearest(STATION_PLACES.filter((place) => place.kind === kind));

  const npcTarget = (name) => deps.npcPosition(name);

  /* The place the step points to, or null (a step done in a panel, or a monster not in sight). */
  function targetOf(id, state) {
    const quest = QUESTS[id];
    if (state === "available") {
      return npcTarget(quest.giver);
    }
    if (state === "ready") {
      return npcTarget(turnInNpc(id));
    }
    if (state !== "active") {
      return null;
    }
    const goal = quest.goal;
    const where = quest.where || {};
    switch (goal.type) {
      case "visit":
        return npcTarget(goal.npc);
      case "reach":
        return { x: goal.x, z: goal.z, height: 0.5 };
      case "kill":
        return nearestMonster(goal.monster);
      case "item":
        return where.monster ? nearestMonster(where.monster) : null;
      case "gather":
        return nearest(
          Object.values(GATHER_NODES).filter(
            (node) => node.resource === goal.item && !deps.isDepleted(node.id),
          ),
        );
      case "craft": {
        const recipe = RECIPES[goal.item];
        return recipe ? stationOf(PROFESSIONS[recipe.profession].station) : null;
      }
      case "disenchant":
      case "refine":
        return stationOf("enchanting_altar");
      case "buy":
        return where.npc ? npcTarget(where.npc) : null;
      default:
        return null;
    }
  }

  /* {chapter, title, goal, hint} for the objective panel */
  function describe(step) {
    const { player, questLog } = deps;
    const { id, state, quest } = step;
    const chapter = `${SAGA.title} · Chapter ${quest.chapter}: ${CHAPTERS[quest.chapter]}`;
    if (state === "locked") {
      return {
        chapter,
        title: quest.title,
        goal: `Reach level ${quest.level} to continue (you are level ${player.level})`,
        hint: levelAdvice(player.level),
      };
    }
    if (state === "available") {
      return {
        chapter,
        title: quest.title,
        goal: `Talk to ${quest.giver}`,
        hint: `${quest.giver} has the next part of your story. Look for the glowing ★ above their head.`,
      };
    }
    if (state === "ready") {
      return {
        chapter,
        title: quest.title,
        goal: `Return to ${turnInNpc(id)}`,
        hint: `Done! Talk to ${turnInNpc(id)} to finish this step and hear what comes next.`,
      };
    }
    return { chapter, title: quest.title, goal: questLog.progress(id), hint: quest.hint || "" };
  }

  /* ---- the objective panel ---- */

  function renderPanel(step, distanceText, arrowAngle) {
    if (!step) {
      panel.hidden = true;
      return;
    }
    const text = describe(step);
    const arrow =
      arrowAngle === null
        ? ""
        : `<i class="objective-arrow" style="transform:rotate(${arrowAngle.toFixed(0)}deg)">➤</i>`;
    const html =
      `<div class="objective-chapter">${escapeHtml(text.chapter)}</div>` +
      `<div class="objective-title">★ ${escapeHtml(text.title)}</div>` +
      `<div class="objective-goal">${arrow}<span>${escapeHtml(text.goal)}</span>${distanceText ? `<small>${distanceText}</small>` : ""}</div>` +
      (text.hint && isHintOpen ? `<p class="objective-hint">${escapeHtml(text.hint)}</p>` : "") +
      (text.hint
        ? `<span class="objective-toggle">${isHintOpen ? "Hide tip" : "How?"}</span>`
        : "");
    if (html !== shownHtml) {
      shownHtml = html;
      panel.innerHTML = html;
    }
    panel.hidden = false;
  }

  /* tapping the panel opens or folds the tip, and keeps it that way */
  panel.addEventListener("click", () => {
    isHintOpen = !isHintOpen;
    hintClosesAt = 0;
    shownHtml = "";
  });

  /* ---- the panel button a step needs ---- */

  function setPulse(selector) {
    if (pulsing === selector) {
      return;
    }
    if (pulsing) {
      $(pulsing)?.classList.remove("guide-pulse");
    }
    pulsing = selector;
    if (selector) {
      $(selector)?.classList.add("guide-pulse");
    }
  }

  /* ---- the waypoint ---- */

  /* the height of the hotbar (a CSS variable that changes with the screen), read again after a resize */
  let hotbarPixels = 0;
  addEventListener("resize", () => {
    hotbarPixels = 0;
  });
  const hotbarHeight = () => {
    if (!hotbarPixels) {
      const value = getComputedStyle(document.body).getPropertyValue("--hotbar-height");
      hotbarPixels = parseFloat(value) || 76;
    }
    return hotbarPixels;
  };

  const toScreen = (x, y, z) => {
    projected.set(x, y, z).project(deps.camera);
    return [((projected.x + 1) / 2) * innerWidth, ((1 - projected.y) / 2) * innerHeight];
  };

  function placeWaypoint(point, distance) {
    if (!point || distance < ARRIVED_DISTANCE) {
      waypoint.hidden = true;
      return null;
    }
    const [x, y] = toScreen(point.x, (point.height || 1.6) + 0.5, point.z);
    /* the hero, at chest height: the centre of the compass */
    const [heroX, heroY] = toScreen(deps.player.x, 0.9, deps.player.z);
    const isOnScreen =
      x > EDGE_MARGIN &&
      x < innerWidth - EDGE_MARGIN &&
      y > EDGE_MARGIN &&
      y < innerHeight - EDGE_MARGIN - hotbarHeight();
    waypoint.hidden = false;
    waypoint.querySelector("small").textContent = `${Math.round(distance)} m`;
    const angle = (Math.atan2(y - heroY, x - heroX) * 180) / Math.PI;
    const arrow = waypoint.querySelector("i");
    if (isOnScreen) {
      waypoint.classList.remove("compass");
      arrow.style.transform = "";
      waypoint.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-100%)`;
      return angle;
    }
    /* out of view: an arrow on a circle around the hero, pointing at the target */
    const radius = Math.min(150, Math.min(innerWidth, innerHeight) * 0.28);
    const radians = (angle * Math.PI) / 180;
    const ringX = heroX + Math.cos(radians) * radius;
    const ringY = heroY + Math.sin(radians) * radius;
    waypoint.classList.add("compass");
    waypoint.style.transform = `translate(${ringX.toFixed(0)}px,${ringY.toFixed(0)}px) translate(-50%,-50%)`;
    /* the ▼ points down (90°) */
    arrow.style.transform = `rotate(${(angle - 90).toFixed(0)}deg)`;
    return angle;
  }

  /* ---- guide cards ---- */

  function showCard(topicId) {
    const topic = GUIDE_TOPICS[topicId];
    if (!topic) {
      return;
    }
    const icons = topic.icons.map((id) => icon(id, "")).join("");
    card.innerHTML =
      `<div class="guide-icons">${icons}</div><h3>${escapeHtml(topic.title)}</h3>` +
      topic.body.map((paragraph) => `<p>${paragraph}</p>`).join("") +
      `<div class="guide-actions"><button class="btn" data-guide-close>Got it</button></div>`;
    card.hidden = false;
    seen.add(topicId);
    writeJson(SEEN_KEY, [...seen]);
  }

  card.addEventListener("click", (event) => {
    if (event.target.closest("[data-guide-close]")) {
      card.hidden = true;
      if (cardQueue.length) {
        showCard(cardQueue.shift());
      }
    }
  });
  card.addEventListener("pointerdown", (event) => event.stopPropagation());

  /** Show a card unless it was seen before (or queue it behind the one showing). */
  function teach(topicId) {
    if (seen.has(topicId) || !GUIDE_TOPICS[topicId]) {
      return;
    }
    if (!card.hidden) {
      if (!cardQueue.includes(topicId)) {
        cardQueue.push(topicId);
      }
      return;
    }
    showCard(topicId);
  }

  /* ---- every frame ---- */

  function update() {
    const { player } = deps;
    const step = mainStoryStep(player.quests || {}, player.level);
    if (!step) {
      renderPanel(null);
      waypoint.hidden = true;
      setPulse(null);
      target = null;
      return;
    }
    /* a new step (or a new state of it): show its tip for a while */
    const stepKey = step.id + ":" + step.state;
    if (stepKey !== shownStepKey) {
      shownStepKey = stepKey;
      isHintOpen = true;
      hintClosesAt = Date.now() + HINT_SHOW_MS;
    } else if (hintClosesAt && Date.now() > hintClosesAt) {
      isHintOpen = false;
      hintClosesAt = 0;
    }
    target = step.state === "locked" ? null : targetOf(step.id, step.state);
    const distance = target ? Math.hypot(target.x - player.x, target.z - player.z) : 0;
    const angle = placeWaypoint(target, distance);
    const distanceText = target && distance >= ARRIVED_DISTANCE ? `${Math.round(distance)} m` : "";
    renderPanel(step, distanceText, angle === null || angle === undefined ? null : angle);
    const quest = step.quest;
    const needsPanel = step.state === "active" && quest.ui;
    setPulse(
      needsPanel ? (quest.ui === "inventory" ? "#inventory-button" : "#character-button") : null,
    );
  }

  return {
    update,
    teach,
    showCard,
    /** The main quest just accepted: its card, if it has one. */
    onAccepted(id) {
      if (QUESTS[id] && QUESTS[id].tutorial) {
        teach(QUESTS[id].tutorial);
      }
    },
    onTurnedIn(id) {
      if (QUESTS[id] && QUESTS[id].final) {
        teach("saga_end");
      }
    },
    /** For the world map and the minimap: the current target. */
    markers: () =>
      target
        ? [{ x: target.x, z: target.z, emoji: "★", color: "#ffd34d", title: "Objective" }]
        : [],
  };
}
