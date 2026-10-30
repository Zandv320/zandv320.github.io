/* Eldoria – the player's quest progress: accepting, tracking (kills, items, visits, and through the shared rules
   also purchases, gathering, crafting and enchanting), turning in, the markers above npcs, the tracker in the HUD
   (side quests; the main story has the objective panel of guide.js) and the list for the character sheet. */
import {
  QUESTS,
  QUEST_ORDER,
  questState,
  isQuestComplete,
  questsFrom,
  progressText,
  turnInNpc,
} from "./rules/quests.js";
import * as progression from "./rules/progression.js";
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
 *   forEachNpc(fn(name, label)), render(), playEffect(name), onAccepted(id), onTurnedIn(id)}
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

  /* Everything an npc has to tell: the quests it gives (new and running) and the ones handed in to it when they
     are ready. A quest handed in elsewhere shows at its giver while it runs, and at the other npc when ready. */
  function fromNpc(npcName) {
    return questsFrom(npcName)
      .map((id) => ({ id, quest: QUESTS[id], state: state(id) }))
      .filter((entry) => {
        if (entry.state === "locked" || entry.state === "done") {
          return false;
        }
        const takesItIn = turnInNpc(entry.id) === npcName;
        if (entry.state === "ready") {
          return takesItIn;
        }
        return entry.quest.giver === npcName;
      });
  }

  function accept(id) {
    if (!progression.acceptQuest(player, id)) {
      return false;
    }
    if (deps.heroAction) {
      deps.heroAction("quest", { id, step: "accept" });
    }
    const quest = QUESTS[id];
    logLevelMessage(`Quest accepted: ${UI.escapeHtml(quest.title)}`);
    for (const given of quest.gives || []) {
      const item = ITEMS[given.id];
      UI.logMessage(
        `<span class="loot-msg">${UI.escapeHtml(quest.giver)} gives you ${icon(given.id, item.icon, "small")} ${UI.escapeHtml(item.name)}.</span>`,
      );
    }
    refresh();
    if (deps.onAccepted) {
      deps.onAccepted(id);
    }
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
        UI.systemMessage(`Your bag is full: the ${UI.itemNoun(item.name)} was left behind.`);
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
    if (deps.onTurnedIn) {
      deps.onTurnedIn(id);
    }
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
            `${UI.escapeHtml(QUESTS[id].title)}: done! Return to ${UI.escapeHtml(turnInNpc(id))}.`,
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
        if (turnInNpc(id) !== npcName) {
          logLevelMessage(
            `${UI.escapeHtml(QUESTS[id].title)}: done! Return to ${UI.escapeHtml(turnInNpc(id))}.`,
          );
        }
      }
    }
    if (changed) {
      refresh();
    }
  }

  /* Quests that ask for a state (wear something, raise a stat, learn a skill): checked against the player. */
  function onStateChanged() {
    if (progression.syncStateQuests(player)) {
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
          `${UI.escapeHtml(QUESTS[id].title)}: you found ${UI.escapeHtml(goal.label)}. Return to ${UI.escapeHtml(turnInNpc(id))}.`,
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
            `${UI.escapeHtml(QUESTS[id].title)}: you have everything. Return to ${UI.escapeHtml(turnInNpc(id))}.`,
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
     over one in progress; a ready quest shows at the npc it is handed in to. The main story's markers glow
     ("main"). The marker kinds double as CSS classes on the marker. */
  function updateMarkers() {
    const markerByNpc = {};
    const isMainFor = {};
    for (const id of QUEST_ORDER) {
      const questStatus = state(id);
      if (questStatus === "locked" || questStatus === "done") {
        continue;
      }
      const npc = questStatus === "ready" ? turnInNpc(id) : QUESTS[id].giver;
      if (questStatus === "ready") {
        markerByNpc[npc] = "ready";
      } else if (questStatus === "available" && markerByNpc[npc] !== "ready") {
        markerByNpc[npc] = "new";
      } else {
        markerByNpc[npc] = markerByNpc[npc] || "in-progress";
      }
      if (QUESTS[id].main && questStatus !== "active") {
        isMainFor[npc] = true;
      }
    }
    deps.forEachNpc((name, label) =>
      UI.setQuestMarker(label, markerByNpc[name] || null, !!isMainFor[name]),
    );
  }

  function progress(id) {
    return progressText(id, player.quests[id], monsterName, itemName);
  }

  /* the side quests; the main story has its own objective panel */
  function renderTracker() {
    const running = QUEST_ORDER.filter(
      (id) => player.quests[id] && player.quests[id].state !== "done" && !QUESTS[id].main,
    );
    tracker.hidden = !running.length;
    const rows = running.map((id) => {
      const isReady = state(id) === "ready";
      const detail = isReady
        ? "Return to " + UI.escapeHtml(turnInNpc(id))
        : UI.escapeHtml(progress(id));
      return `<div class="tracker-quest${isReady ? " ready" : ""}"><b>${UI.escapeHtml(QUESTS[id].title)}</b><span>${detail}</span></div>`;
    });
    tracker.innerHTML = '<div class="tracker-title">Side quests</div>' + rows.join("");
  }

  function refresh() {
    progression.syncStateQuests(player);
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
    onStateChanged,
    refresh,
    list,
    readyCount,
    state,
    progress,
  };
}
