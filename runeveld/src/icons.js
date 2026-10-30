/* Eldoria – pixel icons from the atlas sprites/icons.png (Craftpix). icon(id) returns an <i> that shows the icon
   of a skill, item, class or button; unknown ids fall back to the given emoji. The size comes from CSS
   (--icon-size); the atlas is scaled with pixelated rendering so the pixels stay crisp. */
import { ICONS, COLUMNS } from "./icon-index.js";

export const hasIcon = (id) => !!ICONS[id];

/** HTML for the icon `id`, or a span with `fallback` (an emoji) when there is no such icon. */
export function icon(id, fallback = "", className = "") {
  const position = ICONS[id];
  if (!position) {
    return fallback ? `<span class="ico-emoji ${className}">${fallback}</span>` : "";
  }
  return `<i class="ico ${className}" style="--icon-x:${position[0]};--icon-y:${position[1]}"></i>`;
}

export const ICON_COLUMNS = COLUMNS;
