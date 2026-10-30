/* Eldoria – sprite sheets (Craftpix freebies, cut by tools/build_sprites.py).
   Each sheet describes where in the image each animation lives:
     frameWidth/frameHeight  frame size in pixels
     scale                   world units per pixel (1/16: 16 px = 1 unit, see world.js)
     feet                    pixels between the bottom of the frame and the feet
     height                  height of the figure in pixels (for name labels)
     directions              row offset per facing direction; a missing direction mirrors the opposite one
     anims                   row (first row of the animation), frames, fps, once (plays a single time),
                             perDirection (false: a single row for all directions)
   The hero consists of layers with the same layout: body, clothing, head and weapon (see baseHeroLayers). */
import { loadTexture, SHEET_SCALE } from "./sprites.js";
import { ITEMS } from "./data.js";

const HERO_DIRECTIONS = { down: 0, left: 1, right: 2, up: 3 };
const ANIMAL_DIRECTIONS = { down: 0, up: 1, left: 2, right: 3 };

/* Every hero layer, named after its file in sprites/. A weapon or cloak also has a "_back" layer that is drawn
   behind the body. */
const HERO_LAYER_FILES = [
  "hero_body",
  "hero_head",
  "armor1",
  "armor2",
  "armor3",
  "sword1",
  "sword2",
  "sword3",
  "sword1_back",
  "sword2_back",
  "sword3_back",
  "cap",
  "helm",
  "robe1",
  "robe2",
  "robe3",
  "staff1",
  "staff1_back",
  "staff2",
  "staff2_back",
  "staff3",
  "staff3_back",
  "hat1",
  "hat2",
  "armor4",
  "armor5",
  "robe4",
  "robe5",
  "cloak1",
  "cloak1_back",
  "cloak2",
  "cloak2_back",
  "cloak3",
  "cloak3_back",
  "cloak4",
  "cloak4_back",
];

function animalSheet(name, { walk, attack, scale = 1 / 16, height = 20 }) {
  return {
    url: `sprites/${name}.png`,
    frameWidth: 32,
    frameHeight: 32,
    scale,
    feet: 4,
    height,
    directions: ANIMAL_DIRECTIONS,
    anims: {
      idle: { row: 0, frames: 4, fps: 5 },
      walk: { row: 4, frames: walk, fps: 10 },
      attack: { row: 8, frames: attack, fps: 12, once: true },
      hurt: { row: 12, frames: 4, fps: 10, once: true },
      death: { row: 16, frames: 6, fps: 8, once: true },
    },
  };
}

export const SHEETS = {
  hero: {
    frameWidth: 64,
    frameHeight: 64,
    scale: 1 / 16,
    feet: 20,
    height: 26,
    directions: HERO_DIRECTIONS,
    /* layer name → url; loadSheets() replaces this with layer name → texture */
    layers: Object.fromEntries(HERO_LAYER_FILES.map((name) => [name, `sprites/${name}.png`])),
    anims: {
      idle: { row: 0, frames: 12, fps: 8 },
      walk: { row: 4, frames: 8, fps: 13 },
      attack: { row: 8, frames: 8, fps: 16, once: true },
      hurt: { row: 12, frames: 5, fps: 12, once: true },
      death: { row: 16, frames: 7, fps: 9, once: true },
    },
  },
  merchant: {
    url: "sprites/merchant.png",
    frameWidth: 32,
    frameHeight: 32,
    scale: 1 / 16,
    feet: 2,
    height: 28,
    directions: { down: 0 },
    anims: { idle: { row: 0, frames: 4, fps: 5, perDirection: false } },
  },
  rabbit: animalSheet("rabbit", { walk: 5, attack: 6, height: 19 }),
  fox: animalSheet("fox", { walk: 6, attack: 6, height: 20 }),
  boar: animalSheet("boar", { walk: 6, attack: 5, scale: 1 / 14, height: 22 }),
  /* forest animals: the stag charges as its 'attack' (a thrust with the antlers); the wolf and the dire boar are
     larger */
  stag: animalSheet("stag", { walk: 6, attack: 6, scale: 1 / 15, height: 26 }),
  wolf: animalSheet("wolf", { walk: 6, attack: 6, scale: 1 / 13, height: 22 }),
  dire_boar: animalSheet("dire_boar", { walk: 6, attack: 5, scale: 1 / 11, height: 26 }),
};

/**
 * The layer names of a hero wearing this equipment ({head, body, weapon, cloak}: item ids or null), back first.
 * Headgear is a complete head layer (head plus headgear, with the hair removed underneath) and replaces 'hero_head'.
 */
export function heroLayerNames(equipment) {
  const weapon = equipment.weapon && ITEMS[equipment.weapon];
  const body = equipment.body && ITEMS[equipment.body];
  const head = equipment.head && ITEMS[equipment.head];
  const cloak = equipment.cloak && ITEMS[equipment.cloak];
  /* the cloak hangs behind the body (the _back layer) and comes over the back and shoulders (the plain layer) */
  return [
    weapon && weapon.layer + "_back",
    cloak && cloak.layer + "_back",
    "hero_body",
    body && body.layer,
    cloak && cloak.layer,
    head ? head.layer : "hero_head",
    weapon && weapon.layer,
  ].filter(Boolean);
}

/**
 * The textures of those layers. Layers that are not loaded yet are requested now and are missing for a moment;
 * through onLayerLoaded() the game hears when they arrive and resets the sprites. Without clothing the hero stands
 * in his underwear.
 */
export function baseHeroLayers(equipment) {
  const loaded = SHEETS.hero.layers;
  return heroLayerNames(equipment)
    .map((name) => {
      if (!loaded[name]) {
        loadLayer(name);
      }
      return loaded[name];
    })
    .filter(Boolean);
}

/* Only the layers needed at startup (body, head, the villagers' outfits) are loaded right away; the rest (armour,
   robes, staves, swords, hats) only when somebody wears them. In smooth mode each layer is over 15 MB of texture
   memory, and phones crash when they are all loaded at once. */
const STARTUP_LAYERS = [
  "hero_body",
  "hero_head",
  "armor1",
  "armor2",
  "cap",
  "helm",
  "sword1",
  "sword1_back",
  "sword2",
  "sword2_back",
];
const layerUrls = {};
const layersLoading = {};
const layerListeners = [];

/** Registers a callback that receives the layer name each time a hero layer finishes loading. */
export function onLayerLoaded(callback) {
  layerListeners.push(callback);
}

/** Loads one hero layer by name (resolves to its texture, or null for an unknown name). */
export function loadLayer(name) {
  const loaded = SHEETS.hero.layers;
  if (loaded[name]) {
    return Promise.resolve(loaded[name]);
  }
  if (layersLoading[name]) {
    return layersLoading[name];
  }
  const url = layerUrls[name];
  if (!url) {
    return Promise.resolve(null);
  }
  layersLoading[name] = loadTexture(url).then((texture) => {
    if (!texture) {
      throw new Error("Sprite missing: " + url);
    }
    loaded[name] = texture;
    delete layersLoading[name];
    for (const callback of layerListeners) {
      callback(name);
    }
    return texture;
  });
  return layersLoading[name];
}

/** Loads every layer needed for this equipment. */
export const loadLayersFor = (equipment) => Promise.all(heroLayerNames(equipment).map(loadLayer));

/** Loads the textures of all sheets (for the hero: only the startup layers). */
export async function loadSheets() {
  const load = async (url) => {
    const texture = await loadTexture(url);
    if (!texture) {
      throw new Error("Sprite missing: " + url);
    }
    return texture;
  };
  await Promise.all(
    Object.values(SHEETS).map(async (sheet) => {
      /* in smooth mode the sheets are SHEET_SCALE times larger: scale the frame size up and the world scale down */
      if (!sheet.isScaled) {
        sheet.isScaled = true;
        sheet.frameWidth *= SHEET_SCALE;
        sheet.frameHeight *= SHEET_SCALE;
        sheet.feet = (sheet.feet || 0) * SHEET_SCALE;
        sheet.height = (sheet.height || sheet.frameHeight / SHEET_SCALE) * SHEET_SCALE;
        sheet.scale /= SHEET_SCALE;
      }
      if (sheet.url) {
        sheet.texture = await load(sheet.url);
      }
      if (sheet.layers && typeof Object.values(sheet.layers)[0] === "string") {
        Object.assign(layerUrls, sheet.layers);
        const textures = {};
        sheet.layers = textures;
        await Promise.all(
          STARTUP_LAYERS.map(async (name) => {
            textures[name] = await load(layerUrls[name]);
          }),
        );
        sheet.texture = textures.hero_body;
      }
    }),
  );
  return SHEETS;
}
