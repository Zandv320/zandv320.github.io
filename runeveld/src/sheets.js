/* Eldoria – sprite sheets (Craftpix freebies, cut by tools/build_sprites.py).
   Each sheet describes where in the image each animation lives:
     frameWidth/frameHeight  frame size in pixels
     scale                   world units per pixel (1/16: 16 px = 1 unit, see world.js)
     feet                    pixels between the bottom of the frame and the feet
     height                  height of the figure in pixels (for name labels)
     directions              row offset per facing direction; a missing direction mirrors the opposite one
     anims                   row (first row of the animation), frames, fps, once (plays a single time),
                             perDirection (false: a single row for all directions)
   The hero consists of layers with the same layout: body, clothing, head and weapon (see baseHeroLayers).
   The profession animations (mine, chop, harvest, fish_cast, fish, smith, brew, cook, enchant) come from
   sprites/work.json: body frames of the attack animation per direction, with the tool from work_<name>.png
   (tools/build_sprites.py). WORK holds their tool tips and impact frames. */
import { loadTexture, makeTexture, SHEET_SCALE, SMOOTH } from "./sprites.js";
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
  "cloak5",
  "cloak5_back",
  /* weapons of other shapes, drawn along the sword (tools/build_sprites.py WEAPON_SHAPES, STAFFS_EXTRA) */
  "axe1",
  "axe1_back",
  "hammer1",
  "hammer1_back",
  "spear1",
  "spear1_back",
  "greatsword1",
  "greatsword1_back",
  "scimitar1",
  "scimitar1_back",
  "runestaff1",
  "runestaff1_back",
  "moonstaff1",
  "moonstaff1_back",
  "crystalstaff1",
  "crystalstaff1_back",
  "shield1",
  "shield1_back",
  "shield2",
  "shield2_back",
  /* the buckler, the kite and the tower shield; helmets, the hood and the circlet; mail, plate and leathers; the
     fur mantle and the tattered cloak (tools/build_sprites.py --only shields, headgear, armour) */
  "shield3",
  "shield3_back",
  "shield4",
  "shield4_back",
  "shield5",
  "shield5_back",
  "helm_horned",
  "helm_great",
  "hood1",
  "circlet1",
  "armor6",
  "armor7",
  "armor8",
  "cloak6",
  "cloak6_back",
  "cloak7",
  "cloak7_back",
  /* more for the mage: robes of other cuts, a wide-brimmed hat, an antler crown, an orb and a tome
     (tools/build_sprites.py --only mage, shields) */
  "robe6",
  "robe7",
  "robe8",
  "hat3",
  "hat4",
  "shield6",
  "shield6_back",
  "shield7",
  "shield7_back",
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

/* The crypt's vampires and its ooze: 64x64 frames like the hero, rows down/up/left/right like the animals. The
   count also has 'fly' (the flight he dives with). */
function cryptSheet(
  name,
  { idle = 4, walk = 6, attack = 12, death = 11, hurt = 4, feet = 20, height = 27 },
) {
  return {
    url: `sprites/${name}.png`,
    /* the monsters of the later lands: loaded after the start screens are up, or as soon as one appears */
    isLazy: true,
    frameWidth: 64,
    frameHeight: 64,
    scale: 1 / 16,
    feet,
    height,
    directions: ANIMAL_DIRECTIONS,
    anims: {
      idle: { row: 0, frames: idle, fps: 6 },
      walk: { row: 4, frames: walk, fps: 10 },
      attack: { row: 8, frames: attack, fps: 18, once: true },
      hurt: { row: 12, frames: hurt, fps: 10, once: true },
      death: { row: 16, frames: death, fps: 10, once: true },
      fly: { row: 20, frames: 8, fps: 14 },
    },
  };
}

/* the orc pack's frames per animation; its figures stand a little lower in the frame */
const GOBLIN_FRAMES = {
  idle: 4,
  walk: 6,
  attack: 8,
  hurt: 6,
  death: 8,
  feet: 22,
  height: 28,
};

export const SHEETS = {
  hero: {
    frameWidth: 64,
    frameHeight: 64,
    scale: 1 / 16,
    feet: 20,
    height: 26,
    directions: HERO_DIRECTIONS,
    /* pixels from the feet to the hip: the legs below it are squeezed when crouching */
    hip: 8,
    /* layer name → url; loadSheets() replaces this with layer name → texture */
    layers: Object.fromEntries(HERO_LAYER_FILES.map((name) => [name, `sprites/${name}.png`])),
    anims: {
      /* facing away the pack breathes in 4 frames, three times over the 12: played once, slowly, it keeps the
         calm pace of the other directions instead of twitching every half second */
      idle: {
        row: 0,
        frames: 12,
        fps: 8,
        columns: { up: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] },
      },
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
  crypt_thrall: cryptSheet("crypt_thrall", {}),
  grave_witch: cryptSheet("grave_witch", { height: 28 }),
  crimson_count: cryptSheet("crimson_count", { height: 27 }),
  grave_ooze: cryptSheet("grave_ooze", {
    idle: 6,
    walk: 8,
    attack: 11,
    hurt: 5,
    death: 10,
    feet: 24,
    height: 20,
  }),
  /* Northwatch's goblins and Grumm the bridge troll: the orc pack, laid out like the vampires */
  goblin_scavenger: cryptSheet("goblin_scavenger", GOBLIN_FRAMES),
  goblin_raider: cryptSheet("goblin_raider", GOBLIN_FRAMES),
  goblin_chief: cryptSheet("goblin_chief", { ...GOBLIN_FRAMES, height: 32 }),
  grumm: cryptSheet("grumm", GOBLIN_FRAMES),
  rune_construct: cryptSheet("rune_construct", GOBLIN_FRAMES),
  /* the Ember Isles: the slime pack's magma slime, and the orc pack's goblins as a fire imp and an ash golem */
  magma_slime: cryptSheet("magma_slime", {
    idle: 6,
    walk: 8,
    attack: 9,
    hurt: 5,
    death: 10,
    feet: 24,
    height: 20,
  }),
  fire_imp: cryptSheet("fire_imp", GOBLIN_FRAMES),
  ash_golem: cryptSheet("ash_golem", GOBLIN_FRAMES),
  /* the Forge of the First Flame's guardian: the goblin chief as charred stone and fire */
  ember_warden: cryptSheet("ember_warden", { ...GOBLIN_FRAMES, height: 32 }),
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
  const shield = equipment.shield && ITEMS[equipment.shield];
  /* the cloak hangs behind the body (the _back layer) and comes over the back and shoulders (the plain layer);
     the shield is in the left hand: over the cloak, under the head and the sword arm, except from behind, where it
     is behind the body with the arm in front of it (the _back layer) */
  return [
    weapon && weapon.layer + "_back",
    cloak && cloak.layer + "_back",
    shield && shield.layer + "_back",
    "hero_body",
    body && body.layer,
    cloak && cloak.layer,
    shield && shield.layer,
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
  const looks = itemLooks(equipment);
  return heroLayerNames(equipment)
    .map((name) => {
      if (!loaded[name]) {
        loadLayer(name);
        return null;
      }
      return looks[name] ? lookedLayer(name, looks[name]) : loaded[name];
    })
    .filter(Boolean);
}

/* layer name → the `look` of the worn item that uses it (weapons and cloaks with a colour of their own) */
function itemLooks(equipment) {
  const looks = {};
  for (const slot of ["weapon", "cloak"]) {
    const item = equipment[slot] && ITEMS[equipment[slot]];
    if (item && item.look) {
      looks[item.layer] = looks[item.layer + "_back"] = item.look;
    }
  }
  return looks;
}

/* A layer in an item's own colour (data.js `look`: {color, amount, value}): every pixel is tinted towards the
   colour by its own brightness, so light and shade stay, and grey steel takes the colour as well as wood does.
   Made once per layer and look. */
const lookedLayers = new Map();
function lookedLayer(name, look) {
  const amount = look.amount ?? 0.6;
  const value = look.value ?? 1;
  const key = `${name}|${look.color}|${amount}|${value}`;
  if (lookedLayers.has(key)) {
    return lookedLayers.get(key);
  }
  const source = SHEETS.hero.layers[name];
  const canvas = document.createElement("canvas");
  canvas.width = source.image.width;
  canvas.height = source.image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source.image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const tr = parseInt(look.color.slice(1, 3), 16);
  const tg = parseInt(look.color.slice(3, 5), 16);
  const tb = parseInt(look.color.slice(5, 7), 16);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) {
      continue;
    }
    const lightness = (0.3 * pixels[i] + 0.59 * pixels[i + 1] + 0.11 * pixels[i + 2]) / 255;
    const scale = Math.min(1.6, lightness * 1.7);
    pixels[i] = Math.min(255, (pixels[i] * (1 - amount) + tr * scale * amount) * value);
    pixels[i + 1] = Math.min(255, (pixels[i + 1] * (1 - amount) + tg * scale * amount) * value);
    pixels[i + 2] = Math.min(255, (pixels[i + 2] * (1 - amount) + tb * scale * amount) * value);
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = makeTexture(canvas, SMOOTH);
  texture.userData = { ...source.userData };
  lookedLayers.set(key, texture);
  return texture;
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
    markWeapon(name, texture);
    loaded[name] = texture;
    delete layersLoading[name];
    for (const callback of layerListeners) {
      callback(name);
    }
    return texture;
  });
  return layersLoading[name];
}

/* swords and staffs hide while the hero works with a tool; shields are marked for their enchantment's light
   (weapon-fx.js) */
function markWeapon(name, texture) {
  if (
    /^(sword|staff|axe|hammer|spear|greatsword|scimitar|runestaff|moonstaff|crystalstaff)\d/.test(
      name,
    )
  ) {
    texture.userData.isWeapon = true;
  }
  if (/^shield\d/.test(name)) {
    texture.userData.isShield = true;
  }
  /* the equipment slot whose refine makes it shine (weapon-fx.js) */
  if (/^(armor|robe)\d/.test(name)) {
    texture.userData.refineSlot = "body";
  } else if (/^(cap|helm|helm_\w+|hat\d|hood\d|circlet\d)$/.test(name)) {
    texture.userData.refineSlot = "head";
  } else if (/^cloak\d/.test(name)) {
    texture.userData.refineSlot = "cloak";
  }
  /* the half behind the body */
  texture.userData.isBack = name.endsWith("_back");
}

/** Profession animations: name → {tool, fps, once, crouch, impact, columns, tips} (sprites/work.json). */
export const WORK = {};
const HERO_DIRECTION_NAMES = ["down", "left", "right", "up"];
const workLoading = {};

/** Loads the tool sheet of a profession animation (resolves to its texture). */
function loadWork(name) {
  const sheet = SHEETS.hero;
  if (sheet.workSheets[name]) {
    return Promise.resolve(sheet.workSheets[name]);
  }
  if (!workLoading[name]) {
    workLoading[name] = loadTexture(`sprites/work_${name}.png`).then((texture) => {
      sheet.workSheets[name] = texture;
      return texture;
    });
  }
  return workLoading[name];
}

/* the profession animations as hero animations: body frames from the attack rows, the tool from its own sheet */
async function loadWorkAnimations() {
  const sheet = SHEETS.hero;
  sheet.workSheets = {};
  sheet.loadWork = loadWork;
  let info = {};
  try {
    info = await (await fetch("sprites/work.json")).json();
  } catch {
    return;
  }
  for (const [name, work] of Object.entries(info)) {
    WORK[name] = work;
    sheet.anims[name] = {
      row: sheet.anims.attack.row,
      frames: work.columns[0].length,
      fps: work.fps,
      once: work.once,
      crouch: work.crouch,
      work: name,
      mirrorLeft: true,
      columns: Object.fromEntries(
        HERO_DIRECTION_NAMES.map((direction, i) => [direction, work.columns[i]]),
      ),
    };
  }
}

/** Loads every layer needed for this equipment. */
export const loadLayersFor = (equipment) => Promise.all(heroLayerNames(equipment).map(loadLayer));

/** Loads the textures of all sheets (for the hero: only the startup layers). */
/** The texture of a sheet, loading it first when it is a lazy one (the monsters of the later lands). */
export function sheetTexture(sheet) {
  if (sheet.texture) {
    return Promise.resolve(sheet.texture);
  }
  if (!sheet.texturePromise) {
    sheet.texturePromise = loadTexture(sheet.url).then((texture) => {
      sheet.texture = texture;
      return texture;
    });
  }
  return sheet.texturePromise;
}

/** Loads the lazy sheets one after another, in the background, so they are there before they are needed. */
export async function preloadLazySheets() {
  for (const sheet of Object.values(SHEETS)) {
    if (sheet.isLazy) {
      await sheetTexture(sheet);
    }
  }
}

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
      if (sheet.url && !sheet.isLazy) {
        sheet.texture = await load(sheet.url);
      }
      if (sheet.layers && typeof Object.values(sheet.layers)[0] === "string") {
        Object.assign(layerUrls, sheet.layers);
        const textures = {};
        sheet.layers = textures;
        await Promise.all(
          STARTUP_LAYERS.map(async (name) => {
            textures[name] = await load(layerUrls[name]);
            markWeapon(name, textures[name]);
          }),
        );
        sheet.texture = textures.hero_body;
      }
    }),
  );
  await loadWorkAnimations();
  return SHEETS;
}
