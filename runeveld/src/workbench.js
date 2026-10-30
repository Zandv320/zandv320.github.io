/* Eldoria – the workbench window, opened at a crafting station: the recipes of the station's profession, and at an
   enchanting altar also refining, enchanting and disenchanting. Every action first plays the station's animation
   (hammering, brewing, cooking, enchanting) and then goes through gathering.perform(), so the server rolls the
   dice. */
import { ITEMS, EQUIPMENT_SLOTS } from "./data.js";
import {
  PROFESSIONS,
  STATIONS,
  RECIPES,
  MAX_PROFESSION_LEVEL,
  professionOf,
  professionExpForLevel,
  disenchantDust,
} from "./rules/professions.js";
import * as crafting from "./rules/crafting.js";
import { ENCHANTMENTS, displayName, isRefinable, isWeapon, modsOf } from "./rules/item-mods.js";
import { bagCount } from "./rules/progression.js";
import { icon } from "./icons.js";
import { modsBadge, modsText } from "./character-sheet.js";
import * as UI from "./ui.js";
import { sfx } from "./audio.js";

const ENCHANTING_TABS = [
  ["recipes", "Runes"],
  ["refine", "Refine"],
  ["enchant", "Enchant"],
  ["disenchant", "Disenchant"],
];

/**
 * @param {object} player the hero record of the player
 * @param {object} deps {perform(type, data) → Promise<result>, work(place, seconds, label) → Promise<boolean> (the
 *   hero works at the station first; false when interrupted), reportProgress(result), playEffect(name, place)}
 */
export function createWorkbench(player, deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#workbench");
  let place = null;
  let tab = "recipes";
  /* the item picked on the refine/enchant/disenchant tabs: {slot} or {index} */
  let picked = null;
  let confirmDisenchant = -1;
  let isBusy = false;

  const professionId = () => STATIONS[place.kind].profession;
  const itemLine = (id, mods) =>
    `${icon(id, ITEMS[id].icon, "small")} ${UI.escapeHtml(displayName(id, mods))}`;

  function renderHeader() {
    const station = STATIONS[place.kind];
    const id = professionId();
    const { level, exp } = professionOf(player, id);
    const isMax = level >= MAX_PROFESSION_LEVEL;
    const needed = professionExpForLevel(level);
    $("#workbench-title").innerHTML =
      `${icon("prof_" + id, station.emoji)} ${UI.escapeHtml(station.name)}`;
    $("#workbench-level").innerHTML =
      `${UI.escapeHtml(PROFESSIONS[id].name)} <b>${level}</b> · ` +
      (isMax ? "max" : `${exp} / ${needed} exp`) +
      ` · <span>${player.zeny} zeny</span>`;
    const tabs = $("#workbench-tabs");
    tabs.hidden = place.kind !== "enchanting_altar";
    tabs.innerHTML = ENCHANTING_TABS.map(
      ([key, label]) =>
        `<button class="tab ${tab === key ? "active" : ""}" data-tab="${key}">${label}</button>`,
    ).join("");
  }

  /* ---- recipes ---- */

  function renderRecipes() {
    const id = professionId();
    const level = professionOf(player, id).level;
    const recipes = Object.values(RECIPES)
      .filter((recipe) => recipe.profession === id)
      .sort((a, b) => a.level - b.level);
    return recipes
      .map((recipe) => {
        const output = ITEMS[recipe.output];
        const isLocked = level < recipe.level;
        const inputs = Object.entries(recipe.inputs)
          .map(([inputId, needed]) => {
            const have = bagCount(player, inputId);
            return `<span class="ingredient ${have >= needed ? "" : "missing"}" title="${UI.escapeHtml(ITEMS[inputId].name)}">${icon(inputId, ITEMS[inputId].icon, "small")}<b>${have}/${needed}</b></span>`;
          })
          .join("");
        const most = isLocked ? 0 : crafting.maxCraftable(player, recipe.output);
        const buttons = isLocked
          ? `<span class="locked-text">Level ${recipe.level}</span>`
          : `<button class="btn small" data-craft="${recipe.output}" data-times="1" ${most ? "" : "disabled"}>Make</button>` +
            (most > 1
              ? `<button class="btn small alt" data-craft="${recipe.output}" data-times="${Math.min(most, 50)}">All ×${Math.min(most, 50)}</button>`
              : "");
        const count = recipe.count > 1 ? ` <small>×${recipe.count}</small>` : "";
        return `<div class="recipe ${isLocked ? "locked" : ""}"><span class="item-icon">${icon(recipe.output, output.icon)}</span><div class="recipe-body"><div class="recipe-name"><b>${UI.escapeHtml(output.name)}</b>${count}<small>Lv ${recipe.level} · ${recipe.exp} exp</small></div><div class="ingredients">${inputs}</div></div><div class="recipe-buttons">${buttons}</div></div>`;
      })
      .join("");
  }

  /* ---- enchanting: the items that can be worked on ---- */

  /* {target, id, mods} for every worn and carried item that passes `test(item)` */
  function candidates(test, { includeWorn = true } = {}) {
    const list = [];
    if (includeWorn) {
      for (const [slot] of EQUIPMENT_SLOTS) {
        const id = player.equipment[slot];
        if (id && test(ITEMS[id])) {
          list.push({ target: { slot }, id, mods: player.equipmentMods[slot], worn: true });
        }
      }
    }
    player.bag.forEach((entry, index) => {
      if (test(ITEMS[entry.id])) {
        list.push({ target: { index }, id: entry.id, mods: entry, worn: false });
      }
    });
    return list;
  }

  const sameTarget = (a, b) => !!a && !!b && a.slot === b.slot && a.index === b.index;

  function itemPicker(list, emptyText) {
    if (!list.length) {
      return `<p class="hint">${emptyText}</p>`;
    }
    if (!list.some((entry) => sameTarget(entry.target, picked))) {
      picked = list[0].target;
    }
    return `<div class="pick-list">${list
      .map(
        (entry) =>
          `<button class="pick ${sameTarget(entry.target, picked) ? "selected" : ""}" data-slot="${entry.target.slot || ""}" data-index="${entry.target.index ?? ""}"><span class="item-icon">${icon(entry.id, ITEMS[entry.id].icon)}</span>${modsBadge(entry.mods)}<small>${entry.worn ? "worn" : "bag"}</small></button>`,
      )
      .join("")}</div>`;
  }

  function pickedEntry(list) {
    return list.find((entry) => sameTarget(entry.target, picked)) || null;
  }

  function renderRefine() {
    const list = candidates(isRefinable);
    let html = itemPicker(list, "You carry nothing that can be refined: weapons and armour can.");
    const entry = pickedEntry(list);
    if (entry) {
      const info = crafting.refineInfo(player, entry.target);
      html += `<div class="work-detail"><b>${itemLine(entry.id, entry.mods)}</b>${modsText(entry.mods)}`;
      if (info.reason) {
        html += `<p class="hint">${UI.escapeHtml(info.reason)}</p>`;
      } else {
        const level = professionOf(player, "enchanting").level;
        const runes = bagCount(player, info.rune);
        const risk = info.dropsOnFailure
          ? "On failure it drops back to +" + (info.current - 1) + "."
          : "Nothing is lost on failure but the runes and zeny.";
        html += `<p>+${info.current} → <b>+${info.target}</b> · chance <b>${Math.round(info.chance * 100)}%</b><br><small>${risk}</small></p>
          <div class="ingredients"><span class="ingredient ${runes >= info.runes ? "" : "missing"}">${icon(info.rune, ITEMS[info.rune].icon, "small")}<b>${runes}/${info.runes}</b></span><span class="ingredient ${player.zeny >= info.zeny ? "" : "missing"}">${icon("ui_zeny", "🪙", "small")}<b>${info.zeny}</b></span><span class="ingredient ${level >= info.level ? "" : "missing"}">Enchanting <b>${info.level}</b></span></div>
          <button class="btn" data-work="refine" ${runes >= info.runes && player.zeny >= info.zeny && level >= info.level ? "" : "disabled"}>Refine to +${info.target}</button>`;
      }
      html += "</div>";
    }
    return html;
  }

  function renderEnchant() {
    const list = candidates(isWeapon);
    let html = itemPicker(list, "You carry no weapon to enchant.");
    const entry = pickedEntry(list);
    if (entry) {
      const level = professionOf(player, "enchanting").level;
      html += `<div class="work-detail"><b>${itemLine(entry.id, entry.mods)}</b>${modsText(entry.mods)}<div class="rune-list">`;
      for (const [element, enchantment] of Object.entries(ENCHANTMENTS)) {
        const have = bagCount(player, enchantment.rune);
        const canUse = have > 0 && level >= enchantment.level;
        html += `<div class="rune-option ${canUse ? "" : "unavailable"}"><span class="item-icon">${icon(enchantment.rune, ITEMS[enchantment.rune].icon)}</span><div><b>${UI.escapeHtml(enchantment.name)}</b> <small>×${have} · Lv ${enchantment.level}</small><small class="ench ${element}">${UI.escapeHtml(enchantment.effect)}</small></div><button class="btn small" data-work="enchant" data-rune="${enchantment.rune}" ${canUse ? "" : "disabled"}>Enchant</button></div>`;
      }
      html += "</div></div>";
    }
    return html;
  }

  function renderDisenchant() {
    const list = candidates((item) => !!item && !!item.slot, { includeWorn: false });
    let html = itemPicker(list, "Your bag holds no equipment to break down.");
    const entry = pickedEntry(list);
    if (entry) {
      const mods = modsOf(entry.mods) || {};
      const dust = disenchantDust(ITEMS[entry.id].price, mods.refine);
      const isConfirming = confirmDisenchant === entry.target.index;
      html += `<div class="work-detail"><b>${itemLine(entry.id, entry.mods)}</b>${modsText(entry.mods)}<p>Breaks the item down into ${icon("arcane_dust", "✨", "small")} <b>${dust}</b> arcane dust. The item is gone for good.</p><button class="btn ${isConfirming ? "danger" : "alt"}" data-work="disenchant">${isConfirming ? "Click again to destroy it" : "Disenchant"}</button></div>`;
    }
    return html;
  }

  function render() {
    if (!place) {
      return;
    }
    renderHeader();
    const isAltar = place.kind === "enchanting_altar";
    let html;
    if (!isAltar || tab === "recipes") html = renderRecipes();
    else if (tab === "refine") html = renderRefine();
    else if (tab === "enchant") html = renderEnchant();
    else html = renderDisenchant();
    $("#workbench-body").innerHTML = html;
  }

  /* ---- actions ---- */

  /* time spent working before the result: a moment per item made, a little longer for the rituals of the altar */
  const WORK_SECONDS = { refine: 2.4, enchant: 2.4, disenchant: 1.6 };

  async function run(type, data, label) {
    if (isBusy) {
      return null;
    }
    isBusy = true;
    panel.classList.add("busy", "working");
    try {
      const seconds =
        type === "craft" ? Math.min(6, 1.5 + 0.5 * ((data.times || 1) - 1)) : WORK_SECONDS[type];
      const isDone = await deps.work(place, seconds, label);
      if (!isDone) {
        return null;
      }
      const result = await deps.perform(type, data);
      if (result && !result.ok) {
        UI.systemMessage(result.reason);
      }
      return result && result.ok ? result : null;
    } finally {
      isBusy = false;
      panel.classList.remove("busy", "working");
      render();
    }
  }

  async function craft(recipeId, times) {
    const result = await run(
      "craft",
      { recipe: recipeId, times },
      `Making ${ITEMS[RECIPES[recipeId].output].name.toLowerCase()}…`,
    );
    if (!result) {
      return;
    }
    const item = ITEMS[result.item];
    sfx.loot();
    UI.logMessage(
      `<span class="loot-msg">You make ${result.made > 1 ? result.made + " × " : ""}${icon(result.item, item.icon, "small")} ${UI.escapeHtml(item.name)}.</span>`,
    );
    const effects = {
      forge: "spark",
      alchemy_table: "green_burst",
      campfire: "smoke",
      enchanting_altar: "sparkle",
    };
    deps.playEffect(effects[place.kind] || "sparkle", place);
    deps.reportProgress(result);
  }

  async function refine() {
    const result = await run("refine", { ...picked }, "Refining…");
    if (!result) {
      return;
    }
    if (result.success) {
      sfx.levelUp();
      UI.logMessage(
        `<span class="level-msg">Success! Your item is now ${UI.escapeHtml(result.name)}.</span>`,
      );
      UI.announce("Refine succeeded", result.name);
      deps.playEffect("light_rays", place);
    } else {
      sfx.miss();
      UI.logMessage(
        `<span class="system">The runes crack. ${UI.escapeHtml(result.name)} remains.</span>`,
      );
      UI.announce("Refine failed", result.name);
      deps.playEffect("smoke", place);
    }
    deps.reportProgress(result);
  }

  async function enchant(rune) {
    const result = await run("enchant", { ...picked, rune }, "Enchanting…");
    if (!result) {
      return;
    }
    sfx.skill();
    UI.logMessage(
      `<span class="level-msg">The rune sinks in: ${UI.escapeHtml(result.name)}.</span>`,
    );
    const looks = {
      flame: "fire_pillar",
      frost: "frost",
      storms: "lightning",
      arcane: "rune_circle",
    };
    deps.playEffect(looks[result.enchant] || "sparkle", place);
    deps.reportProgress(result);
  }

  async function disenchant() {
    const index = picked && picked.index;
    if (confirmDisenchant !== index) {
      confirmDisenchant = index;
      render();
      return;
    }
    confirmDisenchant = -1;
    const result = await run("disenchant", { index }, "Disenchanting…");
    if (!result) {
      return;
    }
    sfx.skill();
    UI.logMessage(
      `<span class="loot-msg">${UI.escapeHtml(result.name)} crumbles into ${result.dust} ${icon("arcane_dust", "✨", "small")} arcane dust.</span>`,
    );
    deps.playEffect("sparkle", place);
    picked = null;
    deps.reportProgress(result);
  }

  panel.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      tab = tabButton.dataset.tab;
      picked = null;
      confirmDisenchant = -1;
      render();
      return;
    }
    const craftButton = event.target.closest("[data-craft]");
    if (craftButton) {
      craft(craftButton.dataset.craft, +craftButton.dataset.times);
      return;
    }
    const pick = event.target.closest(".pick");
    if (pick) {
      picked = pick.dataset.slot ? { slot: pick.dataset.slot } : { index: +pick.dataset.index };
      confirmDisenchant = -1;
      render();
      return;
    }
    const work = event.target.closest("[data-work]");
    if (!work) {
      return;
    }
    if (work.dataset.work === "refine") refine();
    else if (work.dataset.work === "enchant") enchant(work.dataset.rune);
    else if (work.dataset.work === "disenchant") disenchant();
  });
  $("#workbench-close").onclick = () => close();

  function open(newPlace) {
    place = newPlace;
    tab = "recipes";
    picked = null;
    confirmDisenchant = -1;
    panel.hidden = false;
    render();
  }

  function close() {
    place = null;
    panel.hidden = true;
  }

  return {
    open,
    close,
    render,
    isOpen: () => !!place,
    place: () => place,
  };
}
