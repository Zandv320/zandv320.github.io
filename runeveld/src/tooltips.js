/* Eldoria – tooltips in the game's own style instead of the browser's: they show at once over a button with a
   `title`, near it, and a shortcut in brackets ("Character (C)") becomes a key cap. Only where there is a mouse;
   on a touch screen a tooltip would stick after a tap. */

const KEY = /\s*\(([A-Z0-9])\)\s*$/;

/** Sets up the tooltips for the whole page. */
export function createTooltips() {
  if (!matchMedia("(hover: hover)").matches) {
    return;
  }
  const tip = document.createElement("div");
  tip.id = "tooltip";
  tip.hidden = true;
  document.body.append(tip);
  let target = null;

  function hide() {
    tip.hidden = true;
    target = null;
  }

  document.addEventListener("pointerover", (event) => {
    const element = event.target.closest("[title], [data-tip]");
    if (!element || element === target) {
      return;
    }
    /* the browser's own tooltip would show as well: keep the text, drop the title */
    if (element.hasAttribute("title")) {
      element.dataset.tip = element.getAttribute("title");
      element.removeAttribute("title");
    }
    const text = element.dataset.tip;
    if (!text) {
      return;
    }
    target = element;
    const key = text.match(KEY);
    tip.innerHTML = "";
    tip.append(text.replace(KEY, ""));
    if (key) {
      const cap = document.createElement("kbd");
      cap.textContent = key[1];
      tip.append(cap);
    }
    tip.hidden = false;
    /* above the element, or below it when there is no room */
    const box = element.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const left = Math.max(
      6,
      Math.min(innerWidth - width - 6, box.left + box.width / 2 - width / 2),
    );
    const top = box.top - height - 8 > 4 ? box.top - height - 8 : box.bottom + 8;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  });
  document.addEventListener("pointerout", (event) => {
    if (target && !target.contains(event.relatedTarget)) {
      hide();
    }
  });
  document.addEventListener("pointerdown", hide, { capture: true });
  addEventListener("blur", hide);
}
