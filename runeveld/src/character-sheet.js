/* Eldoria – the character sheet (C) with equipment, stats, skill tree and quests, and the shop window. */
import { ITEMS, EQUIPMENT_SLOTS, SHOPS, CLASSES } from "./data.js";
import { icon } from "./icons.js";
import { heroLayers, drawHero } from "./appearance.js";
import { STATS, MAX_STAT, statCost } from "./rules/stats.js";
import { SKILLS, canLearn, jobExpForLevel, SKILL_TREES, TREE_BRANCHES } from "./rules/skills.js";
import { escapeHtml } from "./ui.js";
import { ENCHANTMENTS, applyMods, displayName, modsOf } from "./rules/item-mods.js";
import {
  SAGAS,
  CHAPTERS,
  MAIN_QUESTS,
  QUESTS,
  mainStoryStep,
  sagaOfChapter,
  chaptersOf,
} from "./rules/quests.js";
import { GUIDE_TOPICS, GUIDE_ORDER } from "./guide-topics.js";
import {
  PROFESSIONS,
  MAX_PROFESSION_LEVEL,
  professionOf,
  professionExpForLevel,
} from "./rules/professions.js";
import { classOf, slotFor } from "./rules/progression.js";

const TABS = ["equipment", "stats", "skills", "quests", "professions"];

const QUEST_STATE_LABELS = {
  available: "Available",
  active: "In progress",
  ready: "Ready to turn in",
  done: "Completed",
};

const MAGE_CLASSES = ["mage", "wizard", "sage"];

const plural = (count) => (count === 1 ? "" : "s");

/** One-line summary of what an item adds, e.g. "ATK +12 · STR +2 · CRIT +3%". */
export function itemStatText(item) {
  const parts = [];
  if (item.atk) parts.push("ATK +" + item.atk);
  if (item.matk) parts.push("MATK +" + item.matk);
  if (item.def) parts.push("DEF +" + item.def);
  if (item.hp) parts.push("HP +" + item.hp);
  for (const stat in item.bonus || {}) {
    parts.push(stat.toUpperCase() + " +" + item.bonus[stat]);
  }
  if (item.flee) parts.push("FLEE +" + item.flee);
  if (item.crit) parts.push("CRIT +" + item.crit + "%");
  if (item.sp) parts.push("SP +" + item.sp);
  if (item.forClass) parts.push(CLASSES[item.forClass].name);
  return parts.join(" · ");
}

/* the stats a comparison looks at, as [field, label, unit] */
const COMPARED_STATS = [
  ["atk", "ATK", ""],
  ["matk", "MATK", ""],
  ["def", "DEF", ""],
  ["hp", "HP", ""],
  ["sp", "SP", ""],
  ["flee", "FLEE", ""],
  ["crit", "CRIT", "%"],
];

/**
 * What wearing this item (bag entry or shop item, `source` holds its refine/enchantment) would change compared
 * with what the hero wears in that slot now, as HTML: green gains, red losses. Items for another class say so.
 * Uses the same rules as equipping (rules/progression.js: class check and ring slot).
 */
export function compareHtml(hero, id, source = null) {
  const item = ITEMS[id];
  if (!item || !item.slot) {
    return "";
  }
  if (item.forClass && item.forClass !== hero.classId && item.forClass !== classOf(hero).base) {
    return `<span class="compare locked">${CLASSES[item.forClass].name} only</span>`;
  }
  const slot = slotFor(hero, item);
  const wornId = hero.equipment[slot];
  if (!wornId) {
    return '<span class="compare new">Nothing worn here yet</span>';
  }
  const worn = applyMods(ITEMS[wornId], (hero.equipmentMods || {})[slot]);
  const next = applyMods(item, source);
  const rows = COMPARED_STATS.map(([field, label, unit]) => [
    label,
    (next[field] || 0) - (worn[field] || 0),
    unit,
  ]);
  const bonusKeys = new Set([...Object.keys(next.bonus || {}), ...Object.keys(worn.bonus || {})]);
  for (const key of bonusKeys) {
    rows.push([
      key.toUpperCase(),
      ((next.bonus || {})[key] || 0) - ((worn.bonus || {})[key] || 0),
      "",
    ]);
  }
  const changes = rows
    .filter(([, delta]) => delta !== 0)
    .map(([label, delta, unit]) =>
      delta > 0
        ? `<b class="up">▲ ${label} +${delta}${unit}</b>`
        : `<b class="down">▼ ${label} −${-delta}${unit}</b>`,
    );
  const wornName = escapeHtml(displayName(wornId, (hero.equipmentMods || {})[slot]));
  if (!changes.length) {
    return `<span class="compare same">The same as your ${wornName}</span>`;
  }
  return `<span class="compare"><small>vs ${wornName}</small>${changes.join("")}</span>`;
}

/** A small "+7" badge (coloured by the enchantment) for a bag slot or equipment slot, or "". */
export function modsBadge(source) {
  const mods = modsOf(source);
  if (!mods) {
    return "";
  }
  const label = mods.refine ? "+" + mods.refine : "";
  const element = mods.enchant ? icon("ench_" + mods.enchant, "", "tiny") : "";
  return `<span class="mods-badge ${mods.enchant || ""}">${label}${element}</span>`;
}

/** Lines that explain the refine and enchantment of an item, as HTML (empty without modifiers). */
export function modsText(source) {
  const mods = modsOf(source);
  if (!mods) {
    return "";
  }
  const lines = [];
  if (mods.refine) {
    lines.push(`Refined to <b>+${mods.refine}</b>`);
  }
  if (mods.enchant) {
    const enchantment = ENCHANTMENTS[mods.enchant];
    lines.push(
      `<span class="ench ${mods.enchant}">Enchanted with ${escapeHtml(enchantment.name)}: ${escapeHtml(enchantment.effect)}</span>`,
    );
  }
  return `<p class="item-mods">${lines.join("<br>")}</p>`;
}

/** Label/value pairs as the <span>/<b> rows of a stat table. */
const statRows = (rows) =>
  rows.map(([label, value]) => `<span>${label}</span><b>${value}</b>`).join("");

/**
 * @param {object} player the hero record of the player
 * @param {object} deps callbacks from main.js: derived(), heroClass(), maxJobLevel(), skillOrder(),
 *   expToNextLevel(), freeStatPoints(), freeSkillPoints(), raiseStat(key), raiseSkill(id), equip(id),
 *   unequip(slot), buy(id), openInventory(), onShopClosed(), questList(), readyQuestCount()
 */
export function createCharacterSheet(player, deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#character-sheet");
  const previewCanvas = $("#sheet-preview");
  const previewContext = previewCanvas.getContext("2d");
  const shopPanel = $("#shop");
  let isOpenNow = false;
  let animationTime = 0;
  let activeTab = "equipment";

  function render() {
    const derived = deps.derived();
    $("#sheet-name").textContent = player.name;
    $("#sheet-subtitle").textContent =
      `Level ${player.level} · ${deps.heroClass().name} · Job ${player.jobLevel}`;
    const freeStats = deps.freeStatPoints();
    const freeSkills = deps.freeSkillPoints();

    // Tab buttons: highlight the active one and show a badge with points to spend or quests to turn in.
    document.querySelectorAll("#character-sheet .tab").forEach((button) => {
      const tab = button.dataset.tab;
      button.classList.toggle("active", tab === activeTab);
      let badgeCount = 0;
      if (tab === "stats") badgeCount = freeStats;
      else if (tab === "skills") badgeCount = freeSkills;
      else if (tab === "quests") badgeCount = deps.readyQuestCount();
      const badge = button.querySelector(".tab-badge");
      badge.textContent = badgeCount > 0 ? badgeCount : "";
      badge.hidden = badgeCount <= 0;
    });
    for (const tab of TABS) {
      $("#sheet-tab-" + tab).hidden = activeTab !== tab;
    }

    if (activeTab === "equipment") renderEquipment(derived);
    else if (activeTab === "stats") renderStats(derived, freeStats);
    else if (activeTab === "skills") renderSkills(freeSkills);
    else if (activeTab === "professions") renderProfessions();
    else renderQuests();
  }

  function rewardItemHtml(rewardItem) {
    // Mage classes get the `mage` variant of a reward item when the quest has one.
    const id =
      MAGE_CLASSES.includes(player.classId) && rewardItem.mage ? rewardItem.mage : rewardItem.id;
    const count = rewardItem.count > 1 ? " ×" + rewardItem.count : "";
    return " · " + icon(id, ITEMS[id].icon, "small") + " " + escapeHtml(ITEMS[id].name) + count;
  }

  /* the main story at a glance: the current saga, its chapter and a bar per chapter of that saga */
  function sagaProgressHtml() {
    const step = mainStoryStep(player.quests || {}, player.level);
    const lastSaga = SAGAS[SAGAS.length - 1];
    const saga = step ? sagaOfChapter(step.quest.chapter) : lastSaga;
    const chapters = chaptersOf(saga);
    const sagaQuests = MAIN_QUESTS.filter((id) => chapters.includes(QUESTS[id].chapter));
    const doneCount = sagaQuests.filter((id) => player.quests?.[id]?.state === "done").length;
    const chapter = step ? step.quest.chapter : Infinity;
    const bars = chapters
      .map((number) => {
        const state = number < chapter ? "done" : number === chapter ? "current" : "";
        return `<span class="${state}" title="${escapeHtml(CHAPTERS[number])}"></span>`;
      })
      .join("");
    const where = step
      ? `Chapter ${step.quest.chapter}: ${escapeHtml(CHAPTERS[step.quest.chapter])}`
      : "Complete for now. The road north opens soon.";
    return `<div class="saga-progress"><b>${escapeHtml(saga.title)}: ${escapeHtml(saga.name)}</b><small>${where} · ${doneCount} / ${sagaQuests.length} steps</small><div class="saga-chapters">${bars}</div></div>`;
  }

  /* every guide card, to read again */
  function guideBookHtml() {
    const topics = GUIDE_ORDER.map(
      (id) =>
        `<button class="btn alt small" data-guide-topic="${id}">${escapeHtml(GUIDE_TOPICS[id].title)}</button>`,
    ).join("");
    return `<div class="guide-book"><h4>Adventurer's guide</h4><div class="topics">${topics}</div></div>`;
  }

  function renderQuests() {
    const entries = deps.questList();
    const list = entries.length
      ? entries
          .map(({ id, quest, state, progress }) => {
            const isDone = state === "done";
            const reward = quest.reward;
            const rewardItems = (reward.items || []).map(rewardItemHtml).join("");
            const kind = QUESTS[id].main ? " main" : "";
            return `<div class="quest ${state}${kind}"><div class="quest-header"><b>${escapeHtml(quest.title)}</b><span class="quest-state">${QUEST_STATE_LABELS[state]}</span></div>
      <small>${escapeHtml(quest.giver)}${isDone ? "" : " · " + escapeHtml(progress)}</small><p>${escapeHtml(isDone ? quest.completeText : quest.intro)}</p>
      <div class="quest-reward">Reward: ${reward.exp} exp · ${reward.zeny} zeny${rewardItems}</div></div>`;
          })
          .join("")
      : '<p class="hint">No quests yet. Villagers with a <b class="quest-mark new">!</b> above their head have work for you.</p>';
    $("#sheet-quest-list").innerHTML = sagaProgressHtml() + list + guideBookHtml();
  }

  function renderProfessions() {
    const groups = { gathering: [], crafting: [] };
    for (const [id, profession] of Object.entries(PROFESSIONS)) {
      const { level, exp } = professionOf(player, id);
      const isMax = level >= MAX_PROFESSION_LEVEL;
      const needed = professionExpForLevel(level);
      const fill = isMax ? 1 : Math.min(1, exp / needed);
      const progress = isMax ? "max" : `${exp} / ${needed}`;
      groups[profession.kind].push(
        `<div class="profession" title="${escapeHtml(profession.description)}"><span class="item-icon">${icon("prof_" + id, profession.emoji)}</span><div class="profession-body"><div class="profession-header"><b>${profession.name}</b><span>Lv <b>${level}</b></span></div><div class="bar prof"><i style="transform:scaleX(${fill.toFixed(3)})"></i><span>${progress}</span></div><small>${escapeHtml(profession.description)}</small></div></div>`,
      );
    }
    $("#sheet-profession-list").innerHTML =
      `<h4>Gathering</h4>${groups.gathering.join("")}<h4>Crafting</h4>${groups.crafting.join("")}`;
  }

  function renderEquipment(derived) {
    $("#sheet-stats").innerHTML = statRows([
      ["HP", `${Math.ceil(player.hp)} / ${derived.hpMax}`],
      ["SP", `${Math.floor(player.sp)} / ${derived.spMax}`],
      ["ATK", derived.atk],
      ["MATK", derived.matk],
      ["DEF", derived.def],
      ["EXP", `${player.exp} / ${deps.expToNextLevel()}`],
      ["Zeny", player.zeny],
    ]);

    /* the shield slot only for those who can carry one (the crusader), or while something is in it */
    const slots = EQUIPMENT_SLOTS.filter(
      ([slot]) => slot !== "shield" || player.classId === "crusader" || player.equipment.shield,
    );
    $("#sheet-slots").innerHTML = slots
      .map(([slot, label]) => {
        const itemId = player.equipment[slot];
        const item = itemId && ITEMS[itemId];
        if (!item) {
          return `<button class="equip-slot empty" data-slot="${slot}"><small>${label}</small><b>— empty —</b></button>`;
        }
        const mods = player.equipmentMods && player.equipmentMods[slot];
        const name = displayName(itemId, mods);
        return `<button class="equip-slot ${modsOf(mods) ? "modded" : ""}" data-slot="${slot}" title="Click to unequip"><small>${label}</small><b>${icon(itemId, item.icon, "small")} ${escapeHtml(name)}</b><i>${itemStatText(applyMods(item, mods))}</i></button>`;
      })
      .join("");

    const itemCount = player.bag.reduce((total, entry) => total + entry.count, 0);
    const bagText = itemCount
      ? `${itemCount} item${plural(itemCount)} in your bag.`
      : "Your bag is empty. Monsters sometimes drop gear, and Merchant Bram sells it.";
    $("#sheet-bag").innerHTML =
      `<button class="btn alt" data-open-inventory="1">${icon("ui_bag", "🎒", "small")} Open inventory (I)</button><span class="hint">${bagText}</span>`;
    drawPreview();
  }

  function renderStats(derived, freePoints) {
    $("#sheet-stat-points").innerHTML =
      freePoints > 0
        ? `You have <b>${freePoints}</b> stat point${plural(freePoints)} to spend.`
        : "No stat points left. Every level grants new ones.";

    $("#sheet-stat-list").innerHTML = STATS.map(([key, label, description]) => {
      const value = player.stats[key] || 1;
      const cost = statCost(value);
      const canRaise = freePoints >= cost && value < MAX_STAT;
      // The description reads "Name: effect"; the row shows only the effect.
      const effect = description.split(":")[1] || "";
      return `<div class="stat-row" title="${escapeHtml(description)}"><span class="stat-name">${label}</span><b>${value}</b><button class="plus-btn" data-stat="${key}" ${canRaise ? "" : "disabled"} title="Costs ${cost} point${plural(cost)}">+<small>${cost}</small></button><em>${escapeHtml(effect)}</em></div>`;
    }).join("");

    $("#sheet-derived").innerHTML = statRows([
      ["ATK", derived.atk],
      ["MATK", derived.matk],
      ["DEF", derived.def],
      ["Hit", derived.hit],
      ["Flee", derived.flee],
      ["Crit", derived.crit.toFixed(1) + "%"],
      ["Attacks/s", (1 / derived.attackInterval).toFixed(2)],
      ["HP recovery", derived.hpRegen.toFixed(1) + "/s"],
      ["SP recovery", derived.spRegen.toFixed(1) + "/s"],
      ["Max HP", derived.hpMax],
      ["Max SP", derived.spMax],
    ]);
  }

  /* The skill tree: three branches, a row per tier, lines along the requirements; click a skill to read about it
     and to learn it. */
  let selectedSkill = null;

  function renderSkills(freePoints) {
    const jobProgress =
      player.jobLevel < deps.maxJobLevel()
        ? ` · job exp ${player.jobExp} / ${jobExpForLevel(player.jobLevel)}`
        : " (max)";
    const pointsText =
      freePoints > 0
        ? `<b>${freePoints}</b> skill point${plural(freePoints)} to spend`
        : "no skill points left";
    $("#sheet-skill-points").innerHTML =
      `Job level <b>${player.jobLevel}</b>${jobProgress} · ${pointsText}`;

    const heroClass = deps.heroClass();
    const tree = SKILL_TREES[player.classId] || SKILL_TREES.swordsman;
    const branches = TREE_BRANCHES[player.classId] || TREE_BRANCHES.swordsman;

    // A second class gets a divider row between the first class's tree (rows 0–2) and its own rows.
    const gridRow = (y) => (heroClass.tier === 2 && y >= 3 ? y + 2 : y + 1);
    const rowCount = gridRow(Math.max(...Object.values(tree).map((position) => position[1])));

    let html = `<div class="tree-branches">${branches.map((branch) => `<span>${escapeHtml(branch)}</span>`).join("")}</div><div class="skill-tree" style="grid-template-rows:repeat(${rowCount},auto)">`;
    for (const [id, [x, y]] of Object.entries(tree)) {
      const skill = SKILLS[id];
      const level = player.skills[id] || 0;
      const isLearnable = freePoints > 0 && canLearn(player.skills, id);
      // Available: its requirements are met (or it is already learned).
      const isAvailable = canLearn({ ...player.skills, [id]: 0 }, id) || level > 0;
      let stateClass = " locked";
      if (level > 0) stateClass = " learned";
      else if (isAvailable) stateClass = " available";
      const classes =
        "tree-node" +
        stateClass +
        (isLearnable ? " learnable" : "") +
        (level >= skill.maxLevel ? " max" : "") +
        (selectedSkill === id ? " selected" : "");
      const passiveTag = skill.passive ? '<span class="node-passive">passive</span>' : "";
      html += `<button class="${classes}" data-tree-skill="${id}" style="grid-column:${x + 1};grid-row:${gridRow(y)}" title="${escapeHtml(skill.name)}"><span class="node-icon">${icon(id, skill.icon)}</span><span class="node-level">${level}/${skill.maxLevel}</span><span class="node-name">${escapeHtml(skill.name)}</span>${passiveTag}</button>`;
    }
    if (heroClass.tier === 2) {
      html += `<div class="tree-divider" style="grid-column:1/4;grid-row:4"><span>${escapeHtml(heroClass.name)} · job ${player.jobLevel} / ${deps.maxJobLevel()}</span></div>`;
    }
    html += `<svg class="tree-lines"></svg></div><div class="skill-detail" id="sheet-skill-detail"></div>`;
    $("#sheet-skill-tree").innerHTML = html;

    drawTreeLines(tree);
    renderSkillDetail(freePoints);
  }

  /* Draws a line from each requirement to the skill that needs it; lit when the requirement is met. */
  function drawTreeLines(tree) {
    const wrap = $("#sheet-skill-tree .skill-tree");
    if (!wrap) return;
    const svg = wrap.querySelector(".tree-lines");
    if (!svg) return;
    const wrapRect = wrap.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${wrapRect.width} ${wrapRect.height}`);
    svg.style.width = wrapRect.width + "px";
    svg.style.height = wrapRect.height + "px";

    // Centre of a node's round icon: the icon is as tall as the node is wide, at the top of the node.
    const iconCentre = (id) => {
      const node = wrap.querySelector(`[data-tree-skill="${id}"]`);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return [rect.left - wrapRect.left + rect.width / 2, rect.top - wrapRect.top + rect.width / 2];
    };

    let lines = "";
    for (const id of Object.keys(tree)) {
      const skill = SKILLS[id];
      for (const [requiredId, requiredLevel] of Object.entries(skill.requires)) {
        if (!tree[requiredId]) continue;
        const from = iconCentre(requiredId);
        const to = iconCentre(id);
        if (!from || !to) continue;
        const isMet = (player.skills[requiredId] || 0) >= requiredLevel;
        lines += `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" class="${isMet ? "on" : ""}"/>`;
      }
    }
    svg.innerHTML = lines;
  }

  function renderSkillDetail(freePoints) {
    const detail = $("#sheet-skill-detail");
    if (!detail) return;
    const id = selectedSkill;
    if (!id || !SKILLS[id]) {
      detail.innerHTML =
        '<p class="hint">Click a skill in the tree to read what it does and to learn it.</p>';
      return;
    }
    const skill = SKILLS[id];
    const level = player.skills[id] || 0;
    const isLearnable = freePoints > 0 && canLearn(player.skills, id);
    const requirements = Object.entries(skill.requires)
      .map(([requiredId, requiredLevel]) => `${SKILLS[requiredId].name} ${requiredLevel}`)
      .join(", ");
    const currentText = level > 0 ? skill.text(level) : "not learned yet";
    const nextText = level < skill.maxLevel ? `next: ${skill.text(level + 1)}` : "max level";
    const passiveTag = skill.passive ? " <small>(passive)</small>" : "";
    const requiresText = requirements ? " · requires " + escapeHtml(requirements) : "";
    detail.innerHTML = `<div class="skill-detail-header"><span class="skill-detail-icon">${icon(id, skill.icon)}</span><div><b>${escapeHtml(skill.name)}${passiveTag}</b><small>Lv ${level} / ${skill.maxLevel}${requiresText}</small></div><button class="btn" data-learn="${id}" ${isLearnable ? "" : "disabled"}>${level > 0 ? "Level up" : "Learn"} (1 point)</button></div><p>${escapeHtml(skill.description)}</p><em>${escapeHtml(currentText)} · ${escapeHtml(nextText)}</em>`;
  }

  function drawPreview() {
    drawHero(previewContext, heroLayers(player.equipment, player.hair), animationTime);
  }

  panel.addEventListener("click", (event) => {
    const topicButton = event.target.closest("[data-guide-topic]");
    if (topicButton) {
      deps.showGuide(topicButton.dataset.guideTopic);
      return;
    }
    const tabButton = event.target.closest(".tab");
    if (tabButton) {
      activeTab = tabButton.dataset.tab;
      render();
      return;
    }
    const slotButton = event.target.closest(".equip-slot");
    if (slotButton && !slotButton.classList.contains("empty")) {
      deps.unequip(slotButton.dataset.slot);
      render();
      return;
    }
    if (event.target.closest("[data-open-inventory]")) {
      deps.openInventory();
      return;
    }
    const treeNode = event.target.closest(".tree-node");
    if (treeNode) {
      selectedSkill = treeNode.dataset.treeSkill;
      render();
      return;
    }
    const learnButton = event.target.closest("[data-learn]");
    if (learnButton && !learnButton.disabled) {
      deps.raiseSkill(learnButton.dataset.learn);
      render();
      return;
    }
    const plusButton = event.target.closest(".plus-btn");
    if (plusButton && !plusButton.disabled) {
      if (plusButton.dataset.stat) deps.raiseStat(plusButton.dataset.stat);
      else if (plusButton.dataset.skill) deps.raiseSkill(plusButton.dataset.skill);
      render();
    }
  });
  $("#sheet-close").onclick = () => close();
  // The tree lines are measured in pixels, so redraw them when the window changes size.
  addEventListener("resize", () => {
    if (isOpenNow && activeTab === "skills") render();
  });

  /* ---------- shop ---------- */
  let shop = SHOPS.bram;

  function renderShop() {
    $("#shop-name").textContent = shop.name;
    $("#shop-greeting").textContent = shop.greeting;
    $("#shop-list").innerHTML =
      shop.items
        .map((id) => {
          const item = ITEMS[id];
          const stats = itemStatText(item) || escapeHtml(item.description || "");
          const compare = compareHtml(player, id);
          /* gear for the other class stays visible (it can be sold on), but dimmed */
          const isLocked = compare.includes("compare locked");
          const owned = player.bag
            .filter((entry) => entry.id === id)
            .reduce((total, entry) => total + entry.count, 0);
          const ownedText = owned ? `<small class="shop-owned">You have ${owned}</small>` : "";
          return `<div class="row ${isLocked ? "locked" : ""}"><span>${icon(id, item.icon, "small")} ${escapeHtml(item.name)}<small class="shop-stat">${stats}</small>${compare}${ownedText}</span><button class="btn" data-item="${id}" ${player.zeny < item.price ? "disabled" : ""}>${item.price} zeny</button></div>`;
        })
        .join("") +
      '<p class="hint">Sell items from your inventory while the shop is open, for half their price.</p>';
    $("#shop-zeny").textContent = player.zeny;
  }

  shopPanel.addEventListener("click", (event) => {
    const buyButton = event.target.closest("button[data-item]");
    if (!buyButton) return;
    deps.buy(buyButton.dataset.item);
    renderShop();
    if (isOpenNow) render();
  });
  const closeShop = () => {
    shopPanel.hidden = true;
    if (deps.onShopClosed) deps.onShopClosed();
  };
  $("#shop-close").onclick = closeShop;
  $("#shop-x").onclick = closeShop;
  $("#shop-sell").onclick = () => deps.openInventory();

  function show(tab) {
    if (tab) activeTab = tab;
    isOpenNow = true;
    panel.hidden = false;
    render();
  }

  function close() {
    isOpenNow = false;
    panel.hidden = true;
  }

  return {
    show,
    close,
    toggle() {
      if (isOpenNow) close();
      else show();
    },
    isOpen: () => isOpenNow,
    render: () => {
      if (isOpenNow) render();
    },
    tick(dt) {
      // Only the equipment tab shows the animated hero preview.
      if (!isOpenNow || activeTab !== "equipment") return;
      animationTime += dt;
      drawPreview();
    },
    showShop(newShop) {
      shop = newShop || SHOPS.bram;
      shopPanel.hidden = false;
      renderShop();
    },
    closeShop() {
      shopPanel.hidden = true;
    },
    isShopOpen: () => !shopPanel.hidden,
    renderShop: () => {
      if (!shopPanel.hidden) renderShop();
    },
  };
}
