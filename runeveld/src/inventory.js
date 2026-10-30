/* Eldoria – the inventory window (I): a grid of bag slots with stacks, and buttons to equip, use, sell or drop. */
import { ITEMS, BAG_SIZE } from "./data.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";
import { itemStatText, modsText, modsBadge } from "./character-sheet.js";
import { sellPrice } from "./rules/progression.js";
import { displayName, applyMods } from "./rules/item-mods.js";

/**
 * @param {object} player the hero record of the player (player.bag = [{id, count}])
 * @param {object} deps callbacks from main.js: equip(id, index), use(id), sell(id, index), drop(id, index),
 *   isShopOpen()
 */
export function createInventory(player, deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#inventory");
  let isOpenNow = false;
  /* the selected bag slot; `selectedId` guards against the bag shifting under it */
  let selectedIndex = -1;
  let selectedId = null;

  function renderGrid() {
    const slots = [];
    for (let i = 0; i < BAG_SIZE; i++) {
      const entry = player.bag[i];
      if (!entry) {
        slots.push('<div class="bag-slot empty"></div>');
        continue;
      }
      const item = ITEMS[entry.id];
      const countBadge = entry.count > 1 ? `<span class="item-count">${entry.count}</span>` : "";
      slots.push(
        `<button class="bag-slot ${selectedIndex === i ? "selected" : ""}" data-index="${i}" title="${escapeHtml(displayName(entry.id, entry))}"><span class="item-icon">${icon(entry.id, item.icon)}</span>${countBadge}${modsBadge(entry)}</button>`,
      );
    }
    $("#inventory-grid").innerHTML = slots.join("");
  }

  function renderDetail() {
    const detail = $("#inventory-detail");
    const entry = player.bag[selectedIndex];
    if (!entry) {
      detail.innerHTML = '<p class="hint">Select an item to see what it does.</p>';
      return;
    }
    const item = ITEMS[entry.id];

    const buttons = [];
    if (item.slot) {
      buttons.push('<button class="btn" data-action="equip">Equip</button>');
    }
    if (item.use) {
      buttons.push('<button class="btn" data-action="use">Use</button>');
    }
    // While a shop is open the bag sells instead of dropping.
    if (deps.isShopOpen()) {
      const salePrice = sellPrice(entry.id, entry);
      buttons.push(
        `<button class="btn alt" data-action="sell">Sell for ${salePrice} zeny</button>`,
      );
    } else {
      buttons.push('<button class="btn alt" data-action="drop">Drop</button>');
    }

    const countText = entry.count > 1 ? ` <small>×${entry.count}</small>` : "";
    detail.innerHTML = `<div class="item-detail-header"><span class="item-icon large">${icon(entry.id, item.icon)}</span><div><b>${escapeHtml(displayName(entry.id, entry))}</b>${countText}<small class="item-stats">${itemStatText(applyMods(item, entry)) || ""}</small></div></div>${modsText(entry)}<p>${escapeHtml(item.description || "")}</p><div class="item-actions">${buttons.join("")}</div>`;
  }

  function render() {
    if (!isOpenNow) return;
    $("#inventory-zeny").textContent = player.zeny;
    $("#inventory-count").textContent = `${player.bag.length} / ${BAG_SIZE}`;
    // Follow the selected item when the bag shifts, and forget it once it has left the bag.
    if (
      selectedIndex >= 0 &&
      (!player.bag[selectedIndex] || player.bag[selectedIndex].id !== selectedId)
    ) {
      selectedIndex = player.bag.findIndex((entry) => entry.id === selectedId);
    }
    if (selectedIndex < 0) {
      selectedId = null;
    }
    renderGrid();
    renderDetail();
  }

  panel.addEventListener("click", (event) => {
    const slot = event.target.closest(".bag-slot[data-index]");
    if (slot) {
      selectedIndex = +slot.dataset.index;
      selectedId = player.bag[selectedIndex] ? player.bag[selectedIndex].id : null;
      render();
      return;
    }
    const button = event.target.closest("button[data-action]");
    const entry = player.bag[selectedIndex];
    if (!button || !entry) return;
    const id = entry.id;
    const index = selectedIndex;
    const action = button.dataset.action;
    if (action === "equip") deps.equip(id, index);
    else if (action === "use") deps.use(id);
    else if (action === "sell") deps.sell(id, index);
    else if (action === "drop") deps.drop(id, index);
    render();
  });
  $("#inventory-close").onclick = () => close();

  function show() {
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
    render,
  };
}
