/* Eldoria – appearance: recolouring hair and clothing on the hero layers, the layers of a hero with a hair colour,
   and drawing a hero on a 2D canvas (character sheet, character select). */
import { SHEETS, baseHeroLayers } from "./sheets.js";
import { makeTexture, SMOOTH } from "./sprites.js";

/* colour palettes, dark → light; the source colours are those of the sprites */
export const HAIR_SOURCE = [
  [33, 26, 28],
  [43, 32, 35],
  [59, 44, 51],
  [77, 57, 69],
  [104, 79, 90],
  [135, 108, 125],
];
export const HAIR_PALETTES = {
  brown: [
    [40, 24, 12],
    [66, 40, 20],
    [96, 60, 30],
    [130, 86, 44],
    [165, 116, 66],
    [196, 150, 96],
  ],
  blond: [
    [96, 70, 20],
    [140, 104, 32],
    [184, 140, 50],
    [214, 172, 78],
    [236, 200, 112],
    [250, 226, 150],
  ],
  silver: [
    [60, 60, 64],
    [92, 92, 98],
    [124, 124, 132],
    [160, 160, 168],
    [196, 196, 204],
    [226, 226, 232],
  ],
  black: [
    [14, 12, 16],
    [24, 20, 24],
    [36, 30, 36],
    [50, 42, 50],
    [66, 56, 66],
    [88, 76, 88],
  ],
  red: [
    [70, 22, 14],
    [104, 34, 20],
    [140, 48, 26],
    [176, 68, 34],
    [206, 96, 52],
    [230, 130, 80],
  ],
  blue: [
    [22, 34, 70],
    [34, 52, 104],
    [52, 80, 146],
    [76, 110, 180],
    [110, 146, 210],
    [150, 186, 232],
  ],
  green: [
    [22, 54, 30],
    [36, 82, 44],
    [54, 112, 60],
    [80, 144, 82],
    [114, 176, 112],
    [156, 206, 150],
  ],
};
/* The hair colours a player can choose: [id, label, swatch]. 'plum' is the purple-grey hair of the sprite itself. */
export const HAIR_CHOICES = [
  ["plum", "Plum", [104, 79, 90]],
  ["brown", "Brown", [130, 86, 44]],
  ["blond", "Blond", [214, 172, 78]],
  ["black", "Black", [50, 42, 50]],
  ["red", "Red", [176, 68, 34]],
  ["silver", "Silver", [160, 160, 168]],
  ["blue", "Blue", [76, 110, 180]],
  ["green", "Green", [80, 144, 82]],
];
export const TUNIC_SOURCE = [
  [45, 49, 43],
  [63, 67, 61],
  [94, 97, 90],
  [111, 115, 106],
  [134, 139, 124],
];
export const TUNIC_PALETTES = {
  blue: [
    [28, 42, 78],
    [42, 62, 110],
    [64, 92, 150],
    [84, 116, 176],
    [118, 150, 204],
  ],
  red: [
    [96, 26, 22],
    [132, 38, 32],
    [170, 54, 44],
    [196, 78, 62],
    [222, 112, 92],
  ],
  green: [
    [34, 62, 28],
    [50, 90, 40],
    [72, 122, 56],
    [96, 150, 74],
    [132, 180, 104],
  ],
  cream: [
    [120, 104, 72],
    [160, 140, 100],
    [200, 180, 140],
    [222, 206, 168],
    [240, 228, 196],
  ],
  grey: [
    [52, 52, 56],
    [78, 78, 84],
    [108, 108, 116],
    [136, 136, 146],
    [168, 168, 178],
  ],
};

/* The head layers that carry hair and can therefore be recoloured. */
const HAIR_LAYERS = ["hero_head", "cap", "helm", "hat1", "hat2"];

const recolorCache = new Map();

/**
 * A hero layer with its colours replaced: every pixel close to a source colour gets the target colour of the same
 * shade. `strict`: exact matches only (for helmets, otherwise the iron gets recoloured too).
 * `name` identifies the recolouring in the cache together with the layer name.
 */
export function recolor(layer, source, target, name, strict = false) {
  const cacheKey = layer + "|" + name;
  if (recolorCache.has(cacheKey)) {
    return recolorCache.get(cacheKey);
  }
  const img = SHEETS.hero.layers[layer].image;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) {
      continue;
    }
    let best = -1;
    let bestDistance = strict ? 3 * 3 : 48 * 48;
    for (let j = 0; j < source.length; j++) {
      const color = source[j];
      const distance =
        (pixels[i] - color[0]) ** 2 +
        (pixels[i + 1] - color[1]) ** 2 +
        (pixels[i + 2] - color[2]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = j;
      }
    }
    if (best >= 0) {
      pixels[i] = target[best][0];
      pixels[i + 1] = target[best][1];
      pixels[i + 2] = target[best][2];
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = makeTexture(canvas, SMOOTH);
  recolorCache.set(cacheKey, texture);
  return texture;
}

/** The head layer (bare hair, cap or helmet) in a hair colour. */
export function hairLayer(layer, hair) {
  if (!SHEETS.hero.layers[layer]) {
    return undefined; /* not loaded yet: heroLayers() requests it */
  }
  if (!hair || hair === "plum" || !HAIR_PALETTES[hair]) {
    return SHEETS.hero.layers[layer];
  }
  return recolor(layer, HAIR_SOURCE, HAIR_PALETTES[hair], "hair-" + hair, layer !== "hero_head");
}

/** The layers of a hero: equipment (sheets.js) with the hair in the chosen colour. */
export function heroLayers(equipment, hair) {
  const loaded = SHEETS.hero.layers;
  const layers = baseHeroLayers(equipment || {});
  if (!hair || hair === "plum") {
    return layers;
  }
  return layers.map((texture) => {
    for (const name of HAIR_LAYERS) {
      if (texture === loaded[name]) {
        return hairLayer(name, hair);
      }
    }
    return texture;
  });
}

/**
 * Draws the hero on a canvas: only the part of the frame where the figure stands, so it fills the canvas.
 * time: seconds into the animation; direction: 'down' (towards the viewer) etc.
 */
export function drawHero(ctx, layers, time, { anim = "idle", direction = "down" } = {}) {
  const canvas = ctx.canvas;
  const sheet = SHEETS.hero;
  const animation = sheet.anims[anim] || sheet.anims.idle;
  const frame = Math.floor(time * animation.fps) % animation.frames;
  const row = animation.row + (sheet.directions[direction] ?? 0);
  /* crop factor relative to the original 64 px frame (2 in smooth mode) */
  const k = sheet.frameWidth / 64;
  ctx.imageSmoothingEnabled = k > 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const texture of layers) {
    ctx.drawImage(
      texture.image,
      frame * sheet.frameWidth + 14 * k,
      row * sheet.frameHeight + 10 * k,
      36 * k,
      40 * k,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
}
