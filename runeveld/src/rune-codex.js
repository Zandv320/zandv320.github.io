/* Eldoria – the rune codex (the rune button in the menu, or U): the seven runes of the seals in a ring around a
   turning sigil. The runes the hero has bound glow in their own colour; the ones still out there are dark stones
   with a question mark. Hovering a rune (or tapping it) shows its power and what it gives while it is bound. */
import { RUNES, RUNE_IDS, RUNE_SLOTS, activeRune, runeBonusLines } from "./rules/runes.js";
import { player } from "./game-state.js";
import { sfx } from "./audio.js";
import { escapeHtml } from "./ui.js";

/* each rune's sign, drawn in a 40 × 40 box */
const GLYPHS = {
  moon: '<path d="M25 6a15 15 0 1 0 9 26a12 12 0 1 1 -9 -26z"/><circle cx="29" cy="11" r="1.6"/><circle cx="33" cy="18" r="1"/>',
  ember:
    '<path d="M20 4c2 7 10 10 10 20a10 10 0 0 1 -20 0c0 -5 3 -8 5 -11c0 4 2 6 4 6c-1 -5 -1 -10 1 -15z"/><path class="glyph-core" d="M20 20c1 3 4 5 4 8a4 4 0 0 1 -8 0c0 -3 3 -5 4 -8z"/>',
};

function runeStone(id, index) {
  const angle = (index / RUNE_SLOTS) * Math.PI * 2 - Math.PI / 2;
  const style = `--x:${(50 + Math.cos(angle) * 39).toFixed(2)}%;--y:${(50 + Math.sin(angle) * 39).toFixed(2)}%;--delay:${index * 70}ms`;
  if (!id) {
    return `<button class="rune-stone unknown" data-slot="${index}" style="${style}" aria-label="An unknown rune"><span class="rune-mark">?</span></button>`;
  }
  const rune = RUNES[id];
  return (
    `<button class="rune-stone bound${id === activeRune(player.runes) ? " active" : ""}" data-rune="${id}" data-slot="${index}" style="${style};--rune:${rune.color}" aria-label="${escapeHtml(rune.name)}">` +
    `<svg viewBox="0 0 40 40" aria-hidden="true">${GLYPHS[id] || `<text x="20" y="27" text-anchor="middle">${rune.icon}</text>`}</svg>` +
    "</button>"
  );
}

function detail(id) {
  if (!id) {
    return (
      '<div class="rune-detail unknown" data-detail=""><h4>An unknown rune</h4>' +
      "<p>Its seal still stands somewhere in the world, waiting for a hand that knows it.</p></div>"
    );
  }
  const rune = RUNES[id];
  const bonuses = runeBonusLines(id)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const onQ =
    id === activeRune(player.runes) ? '<span class="rune-key">On <kbd>Q</kbd></span>' : "";
  return (
    `<div class="rune-detail" data-detail="${id}" style="--rune:${rune.color}">` +
    `<div class="rune-detail-head"><svg viewBox="0 0 40 40" aria-hidden="true">${GLYPHS[id] || ""}</svg>` +
    `<h4>${escapeHtml(rune.name)}</h4></div>` +
    `<div class="rune-power"><b>${escapeHtml(rune.power)}</b>${onQ}<small>Cooldown ${rune.cooldown} s</small></div>` +
    `<p>${escapeHtml(rune.description)}</p>` +
    (bonuses ? `<h5>While bound</h5><ul class="rune-bonuses">${bonuses}</ul>` : "") +
    "</div>"
  );
}

/** Sets up the rune codex; returns {show, close, toggle, isOpen}. */
export function createRuneCodex() {
  const panel = document.querySelector("#runes");
  const body = document.querySelector("#runes-body");
  let isOpenNow = false;

  /* the runes in the order they were bound, then the empty places */
  const slots = () => {
    const bound = RUNE_IDS.filter((id) => (player.runes || []).includes(id));
    return Array.from({ length: RUNE_SLOTS }, (_, index) => bound[index] || null);
  };

  function render() {
    const list = slots();
    const count = list.filter(Boolean).length;
    document.querySelector("#runes-count").textContent = `${count} of ${RUNE_SLOTS} seals restored`;
    body.innerHTML =
      '<div class="rune-circle">' +
      '<svg class="rune-sigil" viewBox="0 0 200 200" aria-hidden="true">' +
      '<circle class="sigil-ring" cx="100" cy="100" r="92"/>' +
      '<circle class="sigil-ring thin" cx="100" cy="100" r="66"/>' +
      /* carved marks round the ring, like letters too worn to read */
      '<circle class="sigil-marks" cx="100" cy="100" r="79"/>' +
      '<polygon class="sigil-star" points="100,44 113,87 156,100 113,113 100,156 87,113 44,100 87,87"/>' +
      '<circle class="sigil-heart" cx="100" cy="100" r="12"/>' +
      "</svg>" +
      list.map((id, index) => runeStone(id, index)).join("") +
      "</div>" +
      /* every rune's card (and the unknown one) in the same place, only the chosen one showing: the window
         keeps the size of the longest, whichever rune is chosen and however many are bound */
      `<div id="rune-detail-box">${[null, ...RUNE_IDS].map(detail).join("")}</div>`;
    const first = body.querySelector(".rune-stone");
    first?.classList.add("selected");
    showDetail(list[0]);
  }

  function showDetail(id) {
    body.querySelectorAll(".rune-detail").forEach((card) => {
      card.classList.toggle("shown", card.dataset.detail === (id || ""));
    });
  }

  /* hovering or tapping a stone shows what it is */
  function select(stone) {
    if (!stone || stone.classList.contains("selected")) {
      return;
    }
    body
      .querySelectorAll(".rune-stone.selected")
      .forEach((other) => other.classList.remove("selected"));
    stone.classList.add("selected");
    showDetail(stone.dataset.rune || null);
  }
  body.addEventListener("pointerover", (event) => select(event.target.closest(".rune-stone")));
  body.addEventListener("click", (event) => {
    const stone = event.target.closest(".rune-stone");
    if (stone) {
      select(stone);
      sfx.click();
    }
  });
  body.addEventListener("focusin", (event) => select(event.target.closest(".rune-stone")));
  document.querySelector("#runes-close").onclick = () => close();

  function show() {
    isOpenNow = true;
    panel.hidden = false;
    document.querySelector("#runes-button")?.classList.remove("attention");
    render();
    sfx.chime();
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
  };
}
