/* Eldoria – the player's quest progress: accepting, tracking (kills, items, visits), turning in, the markers above
   npcs, the tracker in the HUD and the list for the character sheet. */
import {
  QUESTS,
  QUEST_ORDER,
  questState,
  isQuestComplete,
  questsFrom,
  progressText,
} from "./rules/quests.js";
import { icon } from "./icons.js";
import { ITEMS, MONSTERS } from "./data.js";
import * as UI from "./ui.js";
import { sfx } from "./audio.js";

/* Classes that receive the `mage` variant of an item reward. */
const MAGE_CLASSES = ["mage", "wizard", "sage"];

/* Sort order of the quest list on the character sheet. */
const LIST_ORDER = { ready: 0, active: 1, available: 2, done: 3 };

/**
 * @param {object} player the player (player.quests holds the progress records `{state, count}`)
 * @param {object} deps {heroAction, bagCount, removeFromBag, addToBag, grantReward({exp, zeny}),
 *   forEachNpc(fn(name, label)), render(), playEffect(name)}
 */
export function createQuestLog(player, deps) {
  const tracker = document.querySelector("#quest-tracker");
  const monsterName = (id) => MONSTERS[id]?.name || id;
  const itemName = (id) => ITEMS[id]?.name || id;
  if (!player.quests) {
    player.quests = {};
  }
  const state = (id) => questState(id, player.quests, player.level);

  const reportProgress = (id) => {
    if (deps.heroAction) {
      deps.heroAction("quest", { id, step: "progress" });
    }
  };
  const logLevelMessage = (html) => UI.logMessage(`<span class="level-msg">${html}</span>`);

  /* Everything an npc has to tell: new quests, running ones and ones ready to turn in. */
  function fromNpc(npcName) {
    return questsFrom(npcName)
      .map((id) => ({ id, quest: QUESTS[id], state: state(id) }))
      .filter((entry) => entry.state !== "locked" && entry.state !== "done");
  }

  function accept(id) {
    if (state(id) !== "available") {
      return false;
    }
    player.quests[id] = { state: "active", count: 0 };
    if (deps.heroAction) {
      deps.heroAction("quest", { id, step: "accept" });
    }
    const goal = QUESTS[id].goal;
    if (goal.type === "item") {
      player.quests[id].count = Math.min(goal.count, deps.bagCount(goal.item));
    }
    logLevelMessage(`Quest accepted: ${UI.escapeHtml(QUESTS[id].title)}`);
    refresh();
    return true;
  }

  function turnIn(id) {
    const quest = QUESTS[id];
    const record = player.quests[id];
    if (!isQuestComplete(id, record)) {
      return false;
    }
    if (quest.goal.type === "item" && !deps.removeFromBag(quest.goal.item, quest.goal.count)) {
      return false;
    }
    record.state = "done";
    const reward = quest.reward;
    deps.grantReward({ exp: reward.exp, zeny: reward.zeny });
    if (deps.heroAction) {
      deps.heroAction("quest", { id, step: "turn_in" });
    }
    const received = [];
    for (const rewardItem of reward.items || []) {
      const itemId =
        MAGE_CLASSES.includes(player.classId) && rewardItem.mage ? rewardItem.mage : rewardItem.id;
      const item = ITEMS[itemId];
      if (deps.addToBag(itemId, rewardItem.count)) {
        const countText = rewardItem.count > 1 ? " ×" + rewardItem.count : "";
        received.push(
          `${icon(itemId, item.icon, "small")} ${UI.escapeHtml(item.name)}${countText}`,
        );
      } else {
        UI.systemMessage(`Your bag is full, the ${item.name.toLowerCase()} was left behind.`);
      }
    }
    const receivedText = received.length ? " · " + received.join(", ") : "";
    logLevelMessage(
      `Quest complete: ${UI.escapeHtml(quest.title)} · +${reward.exp} exp · +${reward.zeny} zeny${receivedText}`,
    );
    UI.announce("QUEST COMPLETE", quest.title);
    sfx.quest();
    if (deps.playEffect) {
      deps.playEffect("sparkle");
    }
    refresh();
    return true;
  }

  /* ---- events ---- */

  function onKill(monsterId) {
    let changed = false;
    for (const id in player.quests) {
      const record = player.quests[id];
      const goal = QUESTS[id].goal;
      if (
        record.state === "active" &&
        goal.type === "kill" &&
        goal.monster === monsterId &&
        record.count < goal.count
      ) {
        record.count++;
        changed = true;
        if (record.count >= goal.count) {
          logLevelMessage(
            `${UI.escapeHtml(QUESTS[id].title)}: done! Return to ${UI.escapeHtml(QUESTS[id].giver)}.`,
          );
        }
      }
    }
    if (changed) {
      refresh();
    }
  }

  function onVisit(npcName) {
    let changed = false;
    for (const id in player.quests) {
      const record = player.quests[id];
      const goal = QUESTS[id].goal;
      if (
        record.state === "active" &&
        goal.type === "visit" &&
        goal.npc === npcName &&
        !record.count
      ) {
        record.count = 1;
        changed = true;
        reportProgress(id);
        logLevelMessage(
          `${UI.escapeHtml(QUESTS[id].title)}: done! Return to ${UI.escapeHtml(QUESTS[id].giver)}.`,
        );
      }
    }
    if (changed) {
      refresh();
    }
  }

  function onPosition(x, z) {
    let changed = false;
    for (const id in player.quests) {
      const record = player.quests[id];
      const goal = QUESTS[id].goal;
      if (
        record.state === "active" &&
        goal.type === "reach" &&
        !record.count &&
        Math.hypot(x - goal.x, z - goal.z) <= goal.r
      ) {
        record.count = 1;
        changed = true;
        reportProgress(id);
        logLevelMessage(
          `${UI.escapeHtml(QUESTS[id].title)}: you found ${UI.escapeHtml(goal.label)}. Return to ${UI.escapeHtml(QUESTS[id].giver)}.`,
        );
      }
    }
    if (changed) {
      refresh();
    }
  }

  /* Item quests simply look in the bag. */
  function onBagChanged() {
    let changed = false;
    for (const id in player.quests) {
      const record = player.quests[id];
      const goal = QUESTS[id].goal;
      if (record.state !== "active" || goal.type !== "item") {
        continue;
      }
      const count = Math.min(goal.count, deps.bagCount(goal.item));
      if (count !== record.count) {
        if (count >= goal.count && record.count < goal.count) {
          logLevelMessage(
            `${UI.escapeHtml(QUESTS[id].title)}: you have everything. Return to ${UI.escapeHtml(QUESTS[id].giver)}.`,
          );
        }
        record.count = count;
        changed = true;
      }
    }
    if (changed) {
      refresh();
    }
  }

  /* Markers above the npcs: ! new, ? in progress (grey) or ready (gold). A ready quest wins over a new one, a new one
     over one in progress. The marker kinds double as CSS classes on the marker. */
  function updateMarkers() {
    const markerByGiver = {};
    for (const id of QUEST_ORDER) {
      const questStatus = state(id);
      if (questStatus === "locked" || questStatus === "done") {
        continue;
      }
      const giver = QUESTS[id].giver;
      if (questStatus === "ready") {
        markerByGiver[giver] = "ready";
      } else if (questStatus === "available" && markerByGiver[giver] !== "ready") {
        markerByGiver[giver] = "new";
      } else {
        markerByGiver[giver] = markerByGiver[giver] || "in-progress";
      }
    }
    deps.forEachNpc((name, label) => UI.setQuestMarker(label, markerByGiver[name] || null));
  }

  function progress(id) {
    return progressText(id, player.quests[id], monsterName, itemName);
  }

  function renderTracker() {
    const running = QUEST_ORDER.filter(
      (id) => player.quests[id] && player.quests[id].state !== "done",
    );
    tracker.hidden = !running.length;
    const rows = running.map((id) => {
      const isReady = state(id) === "ready";
      const detail = isReady
        ? "Return to " + UI.escapeHtml(QUESTS[id].giver)
        : UI.escapeHtml(progress(id));
      return `<div class="tracker-quest${isReady ? " ready" : ""}"><b>${UI.escapeHtml(QUESTS[id].title)}</b><span>${detail}</span></div>`;
    });
    tracker.innerHTML = '<div class="tracker-title">Quests</div>' + rows.join("");
  }

  function refresh() {
    updateMarkers();
    renderTracker();
    deps.render();
  }

  /** For the character sheet: every quest that is not locked, ready ones first. */
  function list() {
    return QUEST_ORDER.map((id, index) => ({
      id,
      quest: QUESTS[id],
      state: state(id),
      progress: progress(id),
      index,
    }))
      .filter((entry) => entry.state !== "locked")
      .sort((a, b) => LIST_ORDER[a.state] - LIST_ORDER[b.state] || a.index - b.index);
  }

  const readyCount = () => QUEST_ORDER.filter((id) => state(id) === "ready").length;

  return {
    fromNpc,
    accept,
    turnIn,
    onKill,
    onVisit,
    onBagChanged,
    onPosition,
    refresh,
    list,
    readyCount,
    state,
    progress,
  };
}
