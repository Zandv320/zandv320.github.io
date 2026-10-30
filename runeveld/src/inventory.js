/* Eldoria – the inventory window (I): a grid of bag slots with stacks, and buttons to equip, use, sell or drop. */
import { ITEMS, BAG_SIZE, SELL_RATIO } from "./data.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";
import { itemStatText } from "./character-sheet.js";

/**
 * @param {object} player the hero record of the player (player.bag = [{id, count}])
 * @param {object} deps callbacks from main.js: equip(id), use(id), sell(id), drop(id), isShopOpen()
 */
export function createInventory(player, deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#inventory");
  let isOpenNow = false;
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
        `<button class="bag-slot ${selectedId === entry.id ? "selected" : ""}" data-id="${entry.id}" title="${escapeHtml(item.name)}"><span class="item-icon">${icon(entry.id, item.icon)}</span>${countBadge}</button>`,
      );
    }
    $("#inventory-grid").innerHTML = slots.join("");
  }

  function renderDetail() {
    const detail = $("#inventory-detail");
    if (!selectedId) {
      detail.innerHTML = '<p class="hint">Select an item to see what it does.</p>';
      return;
    }
    const item = ITEMS[selectedId];
    const entry = player.bag.find((bagEntry) => bagEntry.id === selectedId);

    const buttons = [];
    if (item.slot) {
      buttons.push('<button class="btn" data-action="equip">Equip</button>');
    }
    if (item.use) {
      buttons.push('<button class="btn" data-action="use">Use</button>');
    }
    // While a shop is open the bag sells instead of dropping.
    if (deps.isShopOpen()) {
      const salePrice = Math.floor(item.price * SELL_RATIO);
      buttons.push(
        `<button class="btn alt" data-action="sell">Sell for ${salePrice} zeny</button>`,
      );
    } else {
      buttons.push('<button class="btn alt" data-action="drop">Drop</button>');
    }

    const countText = entry.count > 1 ? ` <small>×${entry.count}</small>` : "";
    detail.innerHTML = `<div class="item-detail-header"><span class="item-icon large">${icon(selectedId, item.icon)}</span><div><b>${escapeHtml(item.name)}</b>${countText}<small class="item-stats">${itemStatText(item) || ""}</small></div></div><p>${escapeHtml(item.description || "")}</p><div class="item-actions">${buttons.join("")}</div>`;
  }

  function render() {
    if (!isOpenNow) return;
    $("#inventory-zeny").textContent = player.zeny;
    $("#inventory-count").textContent = `${player.bag.length} / ${BAG_SIZE}`;
    // Forget the selection once the item has left the bag.
    if (selectedId && !player.bag.some((entry) => entry.id === selectedId)) {
      selectedId = null;
    }
    renderGrid();
    renderDetail();
  }

  panel.addEventListener("click", (event) => {
    const slot = event.target.closest(".bag-slot[data-id]");
    if (slot) {
      selectedId = slot.dataset.id;
      render();
      return;
    }
    const button = event.target.closest("button[data-action]");
    if (!button || !selectedId) return;
    const id = selectedId;
    const action = button.dataset.action;
    if (action === "equip") deps.equip(id);
    else if (action === "use") deps.use(id);
    else if (action === "sell") deps.sell(id);
    else if (action === "drop") deps.drop(id);
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
