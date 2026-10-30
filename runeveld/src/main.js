/* Eldoria – entry point and game loop: startup (world, panels, character select), entering the world with a
   hero, the multiplayer glue (presence, other players, game events), mouse and keyboard input, and the frame
   loop that drives everything and updates the HUD.
   The parts of the loop live in their own modules: game-state.js (shared state), player.js, monsters.js,
   abilities.js (skills), bag.js (bag and equipment), skill-effects.js and storage.js. */
/* storage.js goes first: it migrates the old save data before other modules read their settings */
import { readHeroList, writeHeroList } from "./storage.js";
import * as THREE from "three";
import {
  CLASSES,
  ADVANCEMENTS,
  MAX_LEVEL,
  expForLevel,
  MONSTERS,
  ITEMS,
  SHOPS,
  emptyEquipment,
} from "./data.js";
import { createInventory } from "./inventory.js";
import { createAdminPanel } from "./admin.js";
import {
  createVillagers,
  updateVillagers,
  faceSpeaker,
  villagers,
  greetingOf,
  showVillagers,
} from "./villagers.js";
import { createQuestLog } from "./quest-log.js";
import { createDialogue } from "./dialogue.js";
import {
  FOREST,
  inForest,
  ALTAR_CLEARING,
  VALE,
  inVale,
  inFields,
  CAPITAL,
  inCapital,
  inCastle,
  CASTLE,
  BANDIT_CAMP,
} from "./regions.js";
import { createWorldMap } from "./world-map.js";
import { createDaylight, daylight, clockText, setTimeOverride } from "./daylight.js";
import { createPerfOverlay } from "./perf-overlay.js";
import { createAmbience } from "./ambience.js";
import { createSettings } from "./settings.js";
import { createEffects } from "./effects.js";
import { unlockAudio, sfx } from "./audio.js";
import { baseStats } from "./rules/stats.js";
import { icon } from "./icons.js";
import { SKILLS, SKILLS_BY_CLASS, jobExpForLevel } from "./rules/skills.js";
import { SHEETS, loadSheets, loadLayersFor, onLayerLoaded } from "./sheets.js";
import { heroLayers, drawHero } from "./appearance.js";
import { createCharacterSelect, PODIUM } from "./character-select.js";
import { createAccountPanel } from "./account.js";
import { createParty } from "./party.js";
import { createCharacterSheet } from "./character-sheet.js";
import { Sprite2D } from "./sprites.js";
import {
  renderer,
  scene,
  camera,
  cameraState,
  updateCamera,
  setZoom,
  ZOOM_LEVELS,
  buildWorld,
  FIELD_SIZE,
  VILLAGE_HALF_SIZE,
  inVillage,
  canvas,
  warmUpGpu,
  smokeSources,
  waterSpots,
  spinners,
  groundPoint,
  screenRay,
  updateBillboards,
  obstacles,
  billboards,
  insideWorld,
  sun,
  hemiLight,
  followSun,
} from "./world.js";
import { createNetwork } from "./network.js";
import * as UI from "./ui.js";
import {
  player,
  monsters,
  peers,
  clickables,
  ADMIN,
  game,
  now,
  playEffect,
  heroClass,
  maxJobLevel,
  hotbarSkills,
  derived,
  hpMax,
  spMax,
  freeStatPoints,
  freeSkillPoints,
} from "./game-state.js";
import {
  ensureMonster,
  monsterDied,
  becomeHost,
  hostHandleHit,
  hostTick,
  applyMonsterSnapshot,
  knockBack,
  updateMonsters,
} from "./monsters.js";
import {
  pressedKeys,
  isChatActive,
  setSitting,
  clearTarget,
  updatePlayer,
  hitMonster,
  takeDamage,
  grantReward,
  raiseStat,
  raiseSkill,
} from "./player.js";
import { useSkill } from "./abilities.js";
import {
  bagCount,
  addToBag,
  removeFromBag,
  refreshAppearance,
  equip,
  unequip,
  buy,
  sell,
  drop,
  sortBag,
} from "./bag.js";
import { groundRing, updateSkillEffects, updateTargetRing } from "./skill-effects.js";
import { createGathering } from "./gathering.js";
import { createWorkbench } from "./workbench.js";
import { createGuide } from "./guide.js";
import { validModsFor } from "./rules/item-mods.js";
import { sanitizeProfessions } from "./rules/professions.js";

const $ = (selector) => document.querySelector(selector);

const isTouch = matchMedia("(pointer:coarse)").matches;
if (isTouch) {
  document.body.classList.add("touch");
}

const MERCHANT_NAME = "Merchant Bram";
const MERCHANT_GREETING =
  "Welcome to Runeveld, adventurer. A potion for the road, or something sturdier to wear?";

/* name and subtitle shown when the player walks into another area */
const ZONES = {
  forest: [FOREST.name, "The old forest. Stay on the path."],
  fields: ["Runeveld", "Fields and village."],
  vale: [VALE.name, "Meadows along the Kingsroad. Bandits roam here."],
  capital: [CAPITAL.name, "The capital of Eldoria. Safe within the walls."],
};

/* the normal camera zoom and tilt; the character select screen uses its own until Enter World */
let defaultZoom = 0;
let defaultTilt = 0;
/* the server knows accounts (otherwise the heroes live only in this browser) */
let isServerAccount = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ====================== startup ====================== */

async function init() {
  await loadSheets();
  await buildWorld();
  createMerchant();
  createVillagers(scene, clickables);
  showNpcs(false);
  game.effects = await createEffects({ scene });
  game.gathering = createGathering({
    applyHero: applyHeroRecord,
    openWorkbench: (place) => game.workbench.open(place),
    closeWorkbench: () => game.workbench.close(),
    workbenchPlace: () => (game.workbench ? game.workbench.place() : null),
  });
  await game.gathering.setup();
  game.daylight = createDaylight({
    scene,
    camera,
    renderer,
    sun,
    hemiLight,
    lights: createWorldLights(),
  });
  game.ambience = createAmbience(scene, { smokeSources, waterSpots, spinners });
  warmUpGpu();
  $("#loading").classList.add("away");
  addEventListener("pointerdown", unlockAudio, { capture: true });
  addEventListener("keydown", unlockAudio, { capture: true });

  game.heroList = readHeroList();
  startNetwork();
  game.party = createParty({ network: game.network, player, peers });
  await loadHeroesFromServer();
  game.characterSelect = createCharacterSelect({
    heroes: () => game.heroList.heroes,
    save: () => writeHeroList(game.heroList),
    start: (index) => start(index),
    lastIndex: () => game.heroList.last,
    inVillage,
    scene,
    cameraState,
    camera,
    setZoom,
    minZoom: () => defaultZoom,
    pixelRatio: () => renderer.getPixelRatio(),
    onCreate: async (hero) => {
      const response = await game.network.request({ kind: "create_hero", hero });
      if (response && response.heroes) {
        adoptHeroList(response);
      }
    },
    onDelete: async (name) => {
      const response = await game.network.request({ kind: "delete_hero", name });
      if (response && response.heroes) {
        adoptHeroList(response);
      }
    },
  });

  /* the select screen looks zoomed in at the podium; Enter World puts the camera back to normal */
  defaultZoom = cameraState.px;
  defaultTilt = cameraState.tilt;
  const closerZoom = Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(defaultZoom) + 2);
  setZoom(ZOOM_LEVELS[closerZoom]);
  cameraState.yaw = PODIUM.yaw;
  cameraState.tilt = THREE.MathUtils.degToRad(PODIUM.tilt);
  const podiumTarget = game.characterSelect.cameraTarget();
  cameraState.target.set(podiumTarget[0], podiumTarget[1], podiumTarget[2]);

  createAccountPanel({
    showScreen: (screen) => game.characterSelect.showScreen(screen),
    reload: () => location.reload(),
  });
  setupInput();
  loop();
  game.characterSelect.show();
}

/* Day and night: lanterns and the altar give light at night; the bandit campfire and the fire baskets at the
   castle gate always burn. */
function createWorldLights() {
  const lights = billboards
    .filter((billboard) => billboard.name === "lantern")
    .map((billboard) => ({
      x: billboard.x,
      z: billboard.z,
      y: 1.1,
      radius: 4.5,
      color: [255, 210, 130],
      strength: 0.85,
    }));
  lights.push({
    x: ALTAR_CLEARING[0],
    z: ALTAR_CLEARING[1],
    y: 1.2,
    radius: 6.5,
    color: [170, 120, 255],
    strength: 0.7,
  });
  const fires = [
    [BANDIT_CAMP[0], BANDIT_CAMP[1], 1.7],
    [CASTLE.x1 + 2.6, -5.2, 1.1],
    [CASTLE.x1 + 2.6, 5.2, 1.1],
  ];
  for (const [x, z, size] of fires) {
    playEffect("fire", x, z, { size, grounded: true, loop: true });
    lights.push({ x, z, y: 0.8, radius: 3.5 * size, color: [255, 160, 80], strength: 0.9 });
  }
  return lights;
}

/* The heroes live on the server (per account token); the browser keeps a copy for when the server is not
   there. An empty account takes over the heroes from the browser once. */
function adoptHeroList(response) {
  const heroList = game.heroList;
  heroList.heroes.splice(0, heroList.heroes.length, ...response.heroes);
  heroList.last = response.last | 0;
  writeHeroList(heroList);
}

async function loadHeroesFromServer() {
  const network = game.network;
  /* wait a moment for the connection */
  for (let i = 0; i < 40 && !network.usesServer() && !network.isConnected(); i++) {
    await wait(100);
  }
  if (!network.usesServer()) {
    return;
  }
  let response = await network.request({ kind: "load_heroes" });
  if (!response || !response.heroes) {
    return;
  }
  isServerAccount = true;
  if (!response.heroes.length && game.heroList.heroes.length) {
    response = await network.request({ kind: "import_heroes", heroes: game.heroList.heroes });
    if (!response || !response.heroes) {
      return;
    }
  }
  adoptHeroList(response);
}

/* Takes over the hero record from the server (after a hero action or a kill); hp, sp and position stay the
   client's. */
function applyHeroRecord(hero) {
  if (!game.isStarted || !hero || hero.name !== player.name) {
    return;
  }
  const hasNewClass = hero.classId !== player.classId;
  const hasNewEquipment =
    JSON.stringify(hero.equipment) !== JSON.stringify(player.equipment) ||
    JSON.stringify(hero.equipmentMods || {}) !== JSON.stringify(player.equipmentMods);
  Object.assign(player, {
    classId: hero.classId,
    level: hero.level,
    exp: hero.exp,
    jobLevel: hero.jobLevel,
    jobExp: hero.jobExp,
    zeny: hero.zeny,
    stats: hero.stats,
    skills: hero.skills,
    equipment: { ...emptyEquipment(), ...hero.equipment },
    equipmentMods: hero.equipmentMods || {},
    bag: hero.bag,
    quests: hero.quests,
    professions: hero.professions || {},
    buffs: hero.buffs || {},
  });
  player.hp = Math.min(player.hp, hpMax());
  player.sp = Math.min(player.sp, spMax());
  if (hasNewClass) {
    buildHotbar();
  }
  if (hasNewEquipment || hasNewClass) {
    refreshAppearance();
  }
  game.characterSheet.render();
  game.inventory.render();
  if (game.workbench) {
    game.workbench.render();
  }
  if (game.questLog) {
    game.questLog.refresh();
  }
}

/* Restores a hero that has played before. */
function restoreHero(hero) {
  Object.assign(player, {
    level: hero.level,
    exp: hero.exp,
    zeny: hero.zeny,
    x: hero.x,
    z: hero.z,
  });
  if (hero.equipment) {
    player.equipment = { ...emptyEquipment(), ...hero.equipment };
  }
  if (Array.isArray(hero.bag)) {
    player.bag = [];
    for (const entry of hero.bag) {
      if (typeof entry === "string") {
        addToBag(entry, 1, true);
      } else if (entry && ITEMS[entry.id]) {
        addToBag(entry.id, entry.count | 0, true, entry);
      }
    }
  }
  /* very old saves counted the potions as a plain number */
  if (hero.dranken > 0) {
    addToBag("red_potion", hero.dranken, true);
  }
  if (hero.quests && typeof hero.quests === "object") {
    player.quests = hero.quests;
  }
  player.equipmentMods = {};
  for (const [slot, mods] of Object.entries(hero.equipmentMods || {})) {
    const valid = player.equipment[slot] && validModsFor(player.equipment[slot], mods);
    if (valid) {
      player.equipmentMods[slot] = valid;
    }
  }
  player.professions = sanitizeProfessions(hero.professions);
  player.buffs = hero.buffs && typeof hero.buffs === "object" ? hero.buffs : {};
  if (!insideWorld(player.x, player.z, 1)) {
    player.x = 0;
    player.z = 4;
  }
  for (const slot in player.equipment) {
    if (player.equipment[slot] && !ITEMS[player.equipment[slot]]) {
      player.equipment[slot] = null;
    }
  }
  if (hero.stats) {
    player.stats = { ...baseStats(), ...hero.stats };
  }
  if (hero.skills) {
    player.skills = hero.skills;
  }
  player.jobLevel = Math.min(maxJobLevel(), hero.jobLevel || Math.min(maxJobLevel(), hero.level));
  player.jobExp = hero.jobExp || 0;
  player.hp = Math.min(hero.hp, hpMax());
  player.sp = Math.min(hero.sp, spMax());
}

/* Enters the world with hero number `index` from the list; a hero without a level is new. */
async function start(index) {
  const heroList = game.heroList;
  const network = game.network;
  let hero = heroList.heroes[index];
  if (network.usesServer()) {
    /* one retry: the server may just be restarting */
    let response = await network.request({ kind: "play_hero", name: hero.name });
    if (!response && network.usesServer()) {
      response = await network.request({ kind: "play_hero", name: hero.name });
    }
    if (response && response.hero) {
      isServerAccount = true;
      hero = { ...hero, ...response.hero };
      heroList.heroes[index] = hero;
    }
  }
  player.heroIndex = index;
  player.name = hero.name;
  player.hair = hero.hair || "plum";
  player.classId = CLASSES[hero.classId] ? hero.classId : "swordsman";
  player.equipment = { ...emptyEquipment(), ...heroClass().starterEquipment };
  heroList.last = index;
  writeHeroList(heroList);
  buildHotbar();

  setZoom(defaultZoom);
  cameraState.yaw = 0;
  cameraState.tilt = defaultTilt;
  showNpcs(true);
  if (hero.level) {
    restoreHero(hero);
  } else {
    player.hp = hpMax();
    player.sp = spMax();
  }

  /* this hero's clothes are only loaded now */
  await loadLayersFor(player.equipment);
  const name = player.name;
  player.sprite = new Sprite2D(SHEETS.hero, { layers: heroLayers(player.equipment, player.hair) });
  scene.add(player.sprite.group);
  onLayerLoaded(() => {
    if (player.sprite) {
      player.sprite.setLayers(heroLayers(player.equipment, player.hair));
    }
    for (const peer of peers.values()) {
      peer.sprite.setLayers(heroLayers(peer.presence.equipment || {}, peer.presence.hair));
    }
  });
  createPanels(name);
  $("#start").hidden = true;
  $("#hud").hidden = false;

  UI.systemMessage(
    hero.level
      ? `Welcome back, ${name}!`
      : `Welcome to Eldoria, ${name}! The village of Runeveld is safe; the monsters roam the fields beyond the gates. Merchant Bram at the stall sells potions and gear. Old Mette by the well is looking for you.`,
  );
  if (player.classId === "mage" && !hero.level) {
    UI.systemMessage(
      "As a Mage you fight from a distance: click a monster and press 1 for Ember Bolt.",
    );
  }
  if (freeStatPoints() > 0 || freeSkillPoints() > 0) {
    UI.logMessage(
      `<span class="level-msg">You have ${freeStatPoints()} stat points and ${freeSkillPoints()} skill points to spend. Press C.</span>`,
    );
  }
  game.isStarted = true;
  /* a new hero: how to play, and where the story starts */
  if (!Object.keys(player.quests || {}).length) {
    game.guide.teach("welcome");
  }
  sendPresence();
  setInterval(saveProgress, 5000);
  addEventListener("pagehide", saveProgress);
}

/** Where an npc stands (the merchant or a villager), for the guide: {x, z, height} or null. */
function npcPosition(name) {
  if (name === MERCHANT_NAME && game.merchant) {
    return { x: game.merchant.x, z: game.merchant.z, height: game.merchant.sprite.height };
  }
  const villager = villagers().find((candidate) => candidate.spec.name === name);
  return villager ? { x: villager.x, z: villager.z, height: villager.sprite.height } : null;
}

/* The UI panels of the hero: character sheet, inventory, admin, quest log, dialogue and world map. */
function createPanels(name) {
  const renderSheetAndBag = () => {
    game.characterSheet.render();
    game.inventory.render();
  };
  game.characterSheet = createCharacterSheet(player, {
    derived,
    heroClass,
    maxJobLevel,
    skillOrder: () => (SKILLS_BY_CLASS[player.classId] || SKILLS_BY_CLASS.swordsman).order,
    expToNextLevel: () => expForLevel(player.level),
    freeStatPoints,
    freeSkillPoints,
    raiseStat,
    raiseSkill,
    equip,
    unequip,
    buy,
    openInventory: () => game.inventory.show(),
    onShopClosed: () => game.inventory.render(),
    questList: () => (game.questLog ? game.questLog.list() : []),
    readyQuestCount: () => (game.questLog ? game.questLog.readyCount() : 0),
    showGuide: (topicId) => game.guide.showCard(topicId),
  });
  game.settings = createSettings();
  game.inventory = createInventory(player, {
    equip,
    use: (id) => {
      if (id === "red_potion") {
        useSkill("red_potion");
      } else {
        game.gathering.useItem(id);
      }
    },
    sell,
    drop,
    sort: sortBag,
    isShopOpen: () => game.characterSheet.isShopOpen(),
  });
  game.adminPanel = createAdminPanel({
    player,
    monsters,
    peers,
    cameraState,
    camera,
    scene,
    renderer,
    ADMIN,
    setZoom,
    network: () => game.network,
    isHost: () => !!game.host,
    addToBag,
    setLevel,
    setJobLevel,
    respec,
    teleport,
    spawnMonster,
    killMonster,
    killAll,
    respawnAll,
    refreshAppearance,
    save: saveProgress,
    restore: () => {
      player.hp = hpMax();
      player.sp = spMax();
      game.characterSheet.render();
    },
    exportSave: () => JSON.stringify(game.heroList.heroes[player.heroIndex]),
    importSave: (text) => {
      game.isStarted = false;
      game.heroList.heroes[player.heroIndex] = { ...JSON.parse(text), name: player.name };
      writeHeroList(game.heroList);
      location.reload();
    },
    resetSave: () => {
      game.isStarted = false;
      game.heroList.heroes.splice(player.heroIndex, 1);
      game.heroList.last = 0;
      writeHeroList(game.heroList);
      location.reload();
    },
    timeOfDay: () => 24,
    setTimeOverride,
    derived,
    obstacles,
    render: renderSheetAndBag,
  });
  game.workbench = createWorkbench(player, {
    perform: (type, data) => game.gathering.perform(type, data),
    work: (place, seconds, label) => game.gathering.workAt(place, seconds, label),
    reportProgress: (result) => game.gathering.reportProgress(result),
    playEffect: (effectName, place) =>
      playEffect(effectName, place.x, place.z, { size: 2, y: 1.2 }),
  });
  player.label = UI.createLabel("player", name);
  game.questLog = createQuestLog(player, {
    heroAction: (type, data) => game.network.heroAction(type, data),
    bagCount,
    removeFromBag,
    addToBag,
    /* quest rewards bring their items themselves */
    grantReward: (reward) => grantReward({ ...reward, loot: null }),
    render: renderSheetAndBag,
    playEffect: (effectName) =>
      playEffect(effectName, player.x, player.z, {
        size: 2.6,
        grounded: true,
        follow: player,
        tint: 0xffe6a0,
      }),
    forEachNpc: (visit) => {
      visit(MERCHANT_NAME, game.merchant.label);
      for (const villager of villagers()) {
        visit(villager.spec.name, villager.label);
      }
    },
    onAccepted: (id) => game.guide.onAccepted(id),
    onTurnedIn: (id) => game.guide.onTurnedIn(id),
  });
  game.guide = createGuide({
    player,
    monsters,
    camera,
    questLog: game.questLog,
    npcPosition,
    isDepleted: (nodeId) => game.gathering.isDepleted(nodeId),
  });
  game.dialogue = createDialogue(game.questLog, {
    openShop,
    advancementOptions,
    advanceClass,
    classInfo: (id) => CLASSES[id],
  });
  game.questLog.refresh();
  game.worldMap = createWorldMap({
    scene,
    billboards,
    player,
    monsters,
    peers,
    VILLAGE_HALF_SIZE,
    inVillage,
    isPartyMember: (id) => game.party.isMember(id),
    npcs: () => [
      game.merchant,
      ...villagers().map((villager) => ({
        name: villager.spec.name,
        x: villager.x,
        z: villager.z,
        label: villager.label,
      })),
    ],
    markers: () => [...game.gathering.markers(), ...game.guide.markers()],
    walkTo,
  });
}

/* walking to a spot picked on the world map */
function walkTo(x, z) {
  if (player.isDead || !insideWorld(x, z)) {
    return false;
  }
  game.dialogue.close();
  player.destination = [x, z];
  player.onArrive = null;
  clearTarget();
  if (player.isSitting) {
    setSitting(false);
  }
  groundRing(x, z, 0xffffff, 0.5, 0.1, 0.35, 0.7);
  return true;
}

/* npcs and villagers only in the real world, not on the select screen */
function showNpcs(isVisible) {
  game.merchant.sprite.group.visible = isVisible;
  game.merchant.label.el.hidden = !isVisible;
  showVillagers(isVisible);
}

/* The skill buttons on the hotbar belong to the class; the potion and sit slots are fixed in the HTML. */
function buildHotbar() {
  const hotbar = $("#hotbar");
  hotbar.querySelectorAll(".slot[data-skill]").forEach((slot) => {
    if (slot.dataset.skill !== "red_potion" && slot.dataset.skill !== "sit") {
      slot.remove();
    }
  });
  const firstFixedSlot = hotbar.firstElementChild;
  const skillIds = hotbarSkills();
  const needsTwoRows = skillIds.length > 6;
  hotbar.classList.toggle("full", needsTwoRows);
  document.body.classList.toggle("hotbar-two-rows", needsTwoRows);
  skillIds.forEach((id, index) => {
    const skill = SKILLS[id];
    const button = document.createElement("button");
    button.className = "slot";
    button.dataset.skill = id;
    button.title = `${skill.name}: ${skill.description}`;
    button.innerHTML =
      `<kbd>${index + 1}</kbd>` +
      `<span class="slot-icon">${icon(id, skill.icon)}</span>` +
      `<span class="slot-name">${UI.escapeHtml(skill.name.split(" ")[0])}</span>` +
      `<i class="cooldown"></i>`;
    button.addEventListener("click", () => useSkill(id));
    hotbar.insertBefore(button, firstFixedSlot);
  });
}

/* Merchant Bram at his stall on the square */
function createMerchant() {
  const sprite = new Sprite2D(SHEETS.merchant);
  sprite.group.position.set(-7.4, 0, -3.4);
  sprite.face(0.3, 1);
  scene.add(sprite.group);
  const merchant = { sprite, label: UI.createLabel("npc", MERCHANT_NAME), x: -7.4, z: -3.4 };
  game.merchant = merchant;
  sprite.mesh.userData.npc = merchant;
  clickables.push(sprite.mesh);
  obstacles.push({ x: merchant.x, z: merchant.z, r: 0.4 });
}

/* Saves the hero: hp, sp and position to the server (the rest it already knows from the hero actions), the
   whole record to the browser. */
function saveProgress() {
  if (!game.isStarted) {
    return;
  }
  const x = +player.x.toFixed(2);
  const z = +player.z.toFixed(2);
  if (game.network && game.network.usesServer()) {
    game.network.saveHero({ hp: Math.round(player.hp), sp: Math.round(player.sp), x, z });
  }
  const heroList = game.heroList;
  heroList.heroes[player.heroIndex] = {
    name: player.name,
    hair: player.hair,
    classId: player.classId,
    level: player.level,
    exp: player.exp,
    jobLevel: player.jobLevel,
    jobExp: player.jobExp,
    stats: player.stats,
    skills: player.skills,
    hp: player.hp,
    sp: player.sp,
    zeny: player.zeny,
    equipment: player.equipment,
    equipmentMods: player.equipmentMods,
    bag: player.bag,
    quests: player.quests,
    professions: player.professions,
    buffs: player.buffs,
    x,
    z,
  };
  heroList.last = player.heroIndex;
  writeHeroList(heroList);
}

/* ====================== npcs: shops, class advancement, talking ====================== */

function openShop(npc) {
  const shopId = npc && typeof npc.shop === "string" ? npc.shop : "bram";
  const shop = SHOPS[shopId] || SHOPS.bram;
  game.characterSheet.showShop(shop);
  if (npc && npc.sprite) {
    npc.sprite.face(player.x - npc.x, player.z - npc.z);
  }
}

/* Class advancement: at the maximum job level of a first class the player picks a second class at the npc. */
function advancementOptions(npcName) {
  if (heroClass().tier !== 1 || player.jobLevel < maxJobLevel()) {
    return null;
  }
  const options = (ADVANCEMENTS[player.classId] || []).filter(
    (id) => CLASSES[id].mentor === npcName,
  );
  return options.length ? options : null;
}

function advanceClass(id) {
  const newClass = CLASSES[id];
  const canAdvance =
    newClass &&
    (ADVANCEMENTS[player.classId] || []).includes(id) &&
    player.jobLevel >= maxJobLevel();
  if (!canAdvance) {
    return false;
  }
  player.classId = id;
  player.jobLevel = 1;
  player.jobExp = 0;
  player.hp = hpMax();
  player.sp = spMax();
  if (newClass.grantedArmor && !addToBag(newClass.grantedArmor, 1)) {
    UI.systemMessage(
      `Your bag is full; come back for your ${ITEMS[newClass.grantedArmor].name.toLowerCase()}.`,
    );
  }
  buildHotbar();
  UI.announce(
    newClass.name.toUpperCase(),
    `You are now a ${newClass.name}. New skills await on the Skills tab.`,
  );
  sfx.levelUp();
  groundRing(player.x, player.z, 0xffc857, 0.3, 3, 1, 1);
  playEffect("flash", player.x, player.z, { size: 4, y: 1, tint: 0xffd27a });
  playEffect("ring", player.x, player.z, { size: 3.6, y: 0.2, tint: 0xffd27a });
  UI.logMessage(
    `<span class="level-msg">You have become a ${newClass.name}! Your job level starts again at 1 and now goes up to ${maxJobLevel()}. Your ${UI.escapeHtml(ITEMS[newClass.grantedArmor].name)} is in your bag.</span>`,
  );
  game.characterSheet.render();
  game.inventory.render();
  saveProgress();
  game.network.heroAction("advance", { id });
  return true;
}

/* A conversation with an npc at (x, z): right away when close by, otherwise walk there first. */
function talkTo(npc, x, z, onOpen) {
  const open = () => {
    if (onOpen) {
      onOpen();
    }
    game.dialogue.open(npc);
  };
  if (Math.hypot(x - player.x, z - player.z) < 2.6) {
    open();
    return;
  }
  /* stop 1.6 units in front of the npc, on the player's side */
  const dx = player.x - x;
  const dz = player.z - z;
  const length = Math.hypot(dx, dz) || 1;
  player.destination = [x + (dx / length) * 1.6, z + (dz / length) * 1.6];
  player.onArrive = open;
  clearTarget();
  if (player.isSitting) {
    setSitting(false);
  }
}

/* ====================== admin actions (admin.js) ====================== */

function setLevel(level) {
  player.level = Math.max(1, Math.min(MAX_LEVEL, level | 0));
  player.exp = 0;
  player.hp = hpMax();
  player.sp = spMax();
  game.characterSheet.render();
}

function setJobLevel(jobLevel) {
  player.jobLevel = Math.max(1, Math.min(maxJobLevel(), jobLevel | 0));
  player.jobExp = 0;
  game.characterSheet.render();
}

function respec() {
  player.stats = baseStats();
  player.skills = {};
  player.hp = Math.min(player.hp, hpMax());
  game.characterSheet.render();
  UI.systemMessage("Stats and skills reset.");
}

function teleport(x, z) {
  const limit = FIELD_SIZE - 1;
  player.x = Math.max(-limit, Math.min(limit, x));
  player.z = Math.max(-limit, Math.min(limit, z));
  player.destination = null;
  player.target = null;
  UI.setTargetFrame(null);
  cameraState.target.set(player.x, 0, player.z);
}

function spawnMonster(monsterId, x, z) {
  if (!game.host || !MONSTERS[monsterId]) {
    return false;
  }
  let number = 0;
  while (monsters.has(monsterId + "#" + number)) {
    number++;
  }
  const monster = ensureMonster(monsterId + "#" + number);
  monster.x = monster.targetX = x;
  monster.z = monster.targetZ = z;
  monster.isNew = false;
  return true;
}

function killMonster(monster) {
  if (monster.isDead) {
    return;
  }
  hitMonster(monster, { miss: false, damage: monster.hp + 1, crit: false }, "admin");
}

function killAll() {
  for (const monster of monsters.values()) {
    if (!monster.isDead && monster.sprite.group.visible) {
      killMonster(monster);
    }
  }
}

function respawnAll() {
  if (!game.host) {
    return;
  }
  for (const monster of monsters.values()) {
    if (monster.isDead) {
      monster.respawnTimer = 0;
    }
  }
}

/* ====================== multiplayer ====================== */

function startNetwork() {
  const network = createNetwork();
  game.network = network;
  network.onHero(applyHeroRecord);
  /* After a restart the server no longer knows which hero this connection plays: announce it again. If loading
     the heroes failed at startup (the server was just restarting), do that now. */
  const announceHero = () => {
    if (!game.isStarted) {
      return;
    }
    network.request({ kind: "play_hero", name: player.name }).then((response) => {
      if (response && response.hero) {
        isServerAccount = true;
        applyHeroRecord(response.hero);
      }
    });
  };
  network.onReconnect(async () => {
    if (!isServerAccount && !game.isStarted) {
      await loadHeroesFromServer();
    }
    announceHero();
  });
  network.onMessage("error", (message) => {
    if (message.error === "no_hero") {
      announceHero();
    }
  });
  network.onHost((isHost) => {
    if (isHost) {
      becomeHost();
    } else {
      game.host = null;
    }
  });
  network.onPeers(updatePeerList);
  network.onConnection((isConnected) => {
    UI.setOnlineStatus(isConnected, network.playerCount());
    UI.systemMessage(
      isConnected ? "Connected to the world." : "No connection: you are playing alone for now.",
    );
  });
  network.on("hit", onHitEvent);
  network.on("freeze", onFreezeEvent);
  network.on("kill", onKillEvent);
  network.on("monster_attack", onMonsterAttackEvent);
  network.on("provoke", onProvokeEvent);
  network.on("monsters", (data, from) => {
    if (from !== network.hostId() || game.host) {
      return;
    }
    applyMonsterSnapshot(data);
  });
  network.on("chat", onChatEvent);
  network.on("node_state", (data, from) => {
    if (from === network.hostId()) {
      game.gathering.onNodeState(data);
    }
  });
  network.onMessage("node_states", (message) => game.gathering.onNodeStates(message.nodes));
  UI.setOnlineStatus(false, 1);
  /* the server simulates the monsters and only knows the world as circles */
  network.setWorldObstacles(() =>
    obstacles.map((obstacle) => [
      +obstacle.x.toFixed(2),
      +obstacle.z.toFixed(2),
      +obstacle.r.toFixed(2),
    ]),
  );
  /* without a server the first player is the host */
  if (network.isHost()) {
    becomeHost();
  }
}

/* someone hit a monster; the host applies the damage, everyone else shows it */
function onHitEvent(data, from, isMe) {
  if (game.host) {
    hostHandleHit(data, from);
  }
  if (isMe) {
    return;
  }
  const monster = monsters.get(data.id);
  if (!monster || monster.isDead) {
    return;
  }
  const numberHeight = monster.sprite.height * 0.8 * monster.scale;
  UI.floatingText(monster.x, numberHeight, monster.z, camera, data.damage, "");
  const attacker = peers.get(from);
  knockBack(
    monster,
    attacker ? monster.x - attacker.x : 0,
    attacker ? monster.z - attacker.z : 1,
    0.25,
  );
  if (!game.host) {
    monster.hp = Math.max(0, monster.hp - data.damage);
  }
}

function onFreezeEvent(data) {
  const until = now() + (data.duration || 1.5);
  for (const id of data.ids || []) {
    const monster = monsters.get(id);
    if (monster && !monster.isDead) {
      monster.frozenUntil = until;
    }
  }
}

/* a monster died; party members nearby get a share (computed by the server), the killer gets the loot */
function onKillEvent(data, from) {
  const network = game.network;
  if (from !== network.hostId()) {
    return;
  }
  const monster = monsters.get(data.id);
  if (monster) {
    monsterDied(monster);
  }
  let share = null;
  if (data.shares) {
    share = data.shares[network.me];
  } else if (data.killer === network.me) {
    share = { exp: data.exp, zeny: data.zeny };
  }
  if (share) {
    grantReward({
      ...data,
      from: monster ? { x: monster.x, z: monster.z } : null,
      exp: share.exp,
      zeny: share.zeny,
      loot: data.killer === network.me ? data.loot : null,
      material: data.killer === network.me ? data.material : null,
    });
    game.questLog.onKill(data.id.split("#")[0]);
  }
}

function onMonsterAttackEvent(data, from) {
  const network = game.network;
  if (from !== network.hostId()) {
    return;
  }
  const monster = monsters.get(data.id);
  if (monster && !monster.isDead) {
    monster.sprite.play("attack", true);
    monster.attackAnimUntil = now() + 0.5;
    const victim = data.target === network.me ? player : peers.get(data.target);
    if (victim) {
      monster.sprite.nudge(victim.x - monster.x, victim.z - monster.z, 0.22);
    }
  }
  if (data.target === network.me && monster) {
    takeDamage(data.damage, monster.spec, monster);
  }
}

/* War Cry of another player: the host makes the monsters around them hunt that player */
function onProvokeEvent(data, from) {
  if (!game.host) {
    return;
  }
  for (const monster of monsters.values()) {
    if (!monster.isDead && Math.hypot(monster.x - data.x, monster.z - data.z) <= data.radius) {
      monster.aggroTarget = from;
    }
  }
}

function onChatEvent(data, from, isMe) {
  const peer = peers.get(from);
  const name = isMe ? player.name : (peer && peer.presence.name) || "?";
  UI.chatMessage(name, data.text);
  const label = isMe ? player.label : peer && peer.label;
  if (label) {
    UI.speechBubble(label, data.text);
  }
}

/* the presence of the other players changed: add, update or remove their figures */
function updatePeerList(presences, leftIds) {
  for (const id of leftIds) {
    removePeer(id);
  }
  for (const [id, presence] of presences) {
    /* without a name someone is still on the select screen */
    if (!presence || !presence.name) {
      continue;
    }
    const appearanceKey = JSON.stringify([presence.equipment || {}, presence.hair]);
    let peer = peers.get(id);
    if (!peer) {
      peer = {
        sprite: new Sprite2D(SHEETS.hero, {
          layers: heroLayers(presence.equipment || {}, presence.hair),
        }),
        label: UI.createLabel("other", presence.name),
        x: presence.x || 0,
        z: presence.z || 0,
        targetX: 0,
        targetZ: 0,
        presence,
        seq: presence.seq,
        busyUntil: 0,
        appearanceKey,
      };
      scene.add(peer.sprite.group);
      peer.sprite.mesh.userData.peerId = id;
      clickables.push(peer.sprite.mesh);
      peers.set(id, peer);
      UI.systemMessage(`${presence.name} is online.`);
    }
    if (appearanceKey !== peer.appearanceKey) {
      peer.appearanceKey = appearanceKey;
      peer.sprite.setLayers(heroLayers(presence.equipment || {}, presence.hair));
    }
    peer.presence = presence;
    peer.targetX = presence.x || 0;
    peer.targetZ = presence.z || 0;
    peer.label.nameEl.textContent = `${presence.name} · Lv ${presence.level || 1}`;
  }
  UI.setOnlineStatus(game.network.isConnected(), game.network.playerCount());
}

function removePeer(id) {
  const peer = peers.get(id);
  if (!peer) {
    return;
  }
  const clickableIndex = clickables.indexOf(peer.sprite.mesh);
  if (clickableIndex >= 0) {
    clickables.splice(clickableIndex, 1);
  }
  peer.sprite.dispose();
  UI.removeLabel(peer.label);
  peers.delete(id);
  UI.systemMessage(`${peer.presence.name || "Someone"} left.`);
}

/* sends the player's presence at most five times per second, and only when it changed */
let lastPresenceAt = 0;
let lastPresenceKey = "";
function sendPresence() {
  const time = now();
  if (time - lastPresenceAt < 0.2) {
    return;
  }
  const presence = {
    name: player.name,
    hair: player.hair,
    classId: player.classId,
    level: player.level,
    x: +player.x.toFixed(2),
    z: +player.z.toFixed(2),
    faceX: +player.sprite.facing.x.toFixed(2),
    faceZ: +player.sprite.facing.y.toFixed(2),
    anim: player.anim,
    work: player.workAnim,
    seq: player.seq,
    hp: Math.round(player.hp),
    hpMax: hpMax(),
    dead: player.isDead,
    sitting: player.isSitting,
    equipment: player.equipment,
  };
  const key = JSON.stringify(presence);
  if (key === lastPresenceKey) {
    return;
  }
  lastPresenceKey = key;
  lastPresenceAt = time;
  game.network.setPresence(presence, true);
}

/* the other players: smooth movement towards their last position, and their animations */
function updatePeers(dt) {
  const time = now();
  for (const peer of peers.values()) {
    const follow = 1 - Math.exp(-10 * dt);
    const isMoving = Math.hypot(peer.targetX - peer.x, peer.targetZ - peer.z) > 0.04;
    if (isMoving) {
      peer.sprite.face(peer.targetX - peer.x, peer.targetZ - peer.z);
    } else {
      peer.sprite.face(peer.presence.faceX || 0, peer.presence.faceZ || 1);
    }
    peer.x += (peer.targetX - peer.x) * follow;
    peer.z += (peer.targetZ - peer.z) * follow;
    peer.sprite.group.position.set(peer.x, 0, peer.z);

    const presence = peer.presence;
    /* a new one-shot animation (attack, hurt) */
    if (presence.seq !== peer.seq) {
      peer.seq = presence.seq;
      if (presence.anim === "attack" || presence.anim === "hurt") {
        peer.sprite.play(presence.anim, true);
        peer.busyUntil = time + 0.45;
      }
    }
    if (time >= peer.busyUntil) {
      if (presence.dead) {
        peer.sprite.play("death");
      } else if (isMoving) {
        peer.sprite.play("walk");
      } else if (presence.sitting) {
        peer.sprite.play("sit");
      } else if (presence.work && peer.sprite.has(presence.work)) {
        peer.sprite.play(presence.work);
      } else {
        peer.sprite.play("idle");
      }
    }
    peer.sprite.update(dt, cameraState);
    UI.positionLabel(peer.label, peer.x, peer.sprite.height + 0.15, peer.z, camera);
    const hp = presence.hp || 0;
    const peerHpMax = presence.hpMax || 1;
    UI.setLabelHp(peer.label, hp, peerHpMax, hp < peerHpMax);
  }
}

/* ====================== input ====================== */

function handleClick(clientX, clientY) {
  if (player.isDead) {
    return;
  }
  const hits = screenRay(clientX, clientY)
    .intersectObjects(clickables, false)
    .filter((hit) => hit.object.visible && hit.object.parent.visible);
  if (hits.length) {
    const data = hits[0].object.userData;
    if (data.monster && !data.monster.isDead) {
      player.target = data.monster;
      player.queuedSkill = null;
      player.destination = null;
      player.onArrive = null;
      UI.setTargetFrame(data.monster);
      if (player.isSitting) {
        setSitting(false);
      }
      return;
    }
    if (data.villager) {
      const villager = data.villager;
      const npc = {
        name: villager.spec.name,
        greeting: greetingOf(villager),
        sprite: villager.sprite,
        shop: villager.spec.shop,
        x: villager.x,
        z: villager.z,
      };
      talkTo(npc, villager.x, villager.z, () => faceSpeaker(villager, player, 8));
      return;
    }
    if (data.node) {
      clearTarget();
      game.gathering.clickNode(data.node);
      return;
    }
    if (data.station) {
      clearTarget();
      game.gathering.clickStation(data.station);
      return;
    }
    if (data.peerId !== undefined) {
      game.party.showPlayerCard(data.peerId, clientX, clientY);
      return;
    }
    if (data.npc) {
      const merchant = game.merchant;
      const npc = {
        name: MERCHANT_NAME,
        greeting: MERCHANT_GREETING,
        sprite: merchant.sprite,
        shop: "bram",
        x: merchant.x,
        z: merchant.z,
      };
      talkTo(npc, merchant.x, merchant.z, () =>
        merchant.sprite.face(player.x - merchant.x, player.z - merchant.z),
      );
      return;
    }
  }
  /* click on the ground: walk there */
  const point = groundPoint(clientX, clientY);
  if (!point) {
    return;
  }
  game.dialogue.close();
  game.party.closePlayerCard();
  player.destination = [point.x, point.z];
  player.onArrive = null;
  clearTarget();
  if (player.isSitting) {
    setSitting(false);
  }
  groundRing(point.x, point.z, 0xffffff, 0.5, 0.1, 0.35, 0.7);
}

/* zoom in fixed steps (pixels per unit), so the pixel scale always stays whole */
function zoom(direction) {
  const index = ZOOM_LEVELS.indexOf(cameraState.px);
  const newIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction));
  if (newIndex !== index) {
    setZoom(ZOOM_LEVELS[newIndex]);
  }
}

function toggleQuestTab() {
  const sheet = game.characterSheet;
  if (sheet.isOpen()) {
    sheet.close();
  } else {
    sheet.show("quests");
  }
}

function isAnyPanelOpen() {
  return (
    game.characterSheet.isOpen() ||
    game.characterSheet.isShopOpen() ||
    game.inventory.isOpen() ||
    game.dialogue.isOpen() ||
    game.worldMap.isOpen() ||
    game.workbench.isOpen() ||
    game.settings.isOpen()
  );
}

function closeAllPanels() {
  game.characterSheet.close();
  game.characterSheet.closeShop();
  game.inventory.close();
  game.dialogue.close();
  game.worldMap.close();
  game.workbench.close();
  game.settings.close();
}

/* Mouse and touch on the game canvas: click or tap to walk, target or talk; drag to walk along; right drag to
   turn the camera; pinch or wheel to zoom. */
function setupPointerInput() {
  const pointers = new Map();
  let drag = null;
  let pinchDistance = 0;
  const distanceBetweenPointers = () => {
    const [first, second] = [...pointers.values()];
    return Math.hypot(first[0] - second[0], first[1] - second[1]);
  };

  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 2) {
      drag = null;
      pinchDistance = distanceBetweenPointers();
      return;
    }
    if (event.button === 2) {
      drag = { isRotating: true, x: event.clientX, y: event.clientY };
      return;
    }
    if (event.button !== 0) {
      return;
    }
    drag = { x: event.clientX, y: event.clientY, hasMoved: false };
    if (isChatActive()) {
      $("#chat-input").blur();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
    }
    if (pointers.size === 2) {
      const distance = distanceBetweenPointers();
      if (pinchDistance && Math.abs(distance - pinchDistance) > 40) {
        zoom(distance > pinchDistance ? 1 : -1);
        pinchDistance = distance;
      }
      return;
    }
    if (!drag) {
      return;
    }
    if (drag.isRotating) {
      cameraState.yaw -= (event.clientX - drag.x) * 0.006;
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 10) {
      drag.hasMoved = true;
    }
    if (drag.hasMoved && game.isStarted && !player.isDead) {
      const point = groundPoint(event.clientX, event.clientY);
      if (point) {
        player.destination = [point.x, point.z];
        player.onArrive = null;
        clearTarget();
      }
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    pointers.delete(event.pointerId);
    if (!drag) {
      return;
    }
    const finished = drag;
    drag = null;
    if (finished.isRotating) {
      return;
    }
    if (!finished.hasMoved && game.isStarted) {
      handleClick(event.clientX, event.clientY);
    }
  });
  canvas.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    drag = null;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  let lastWheelAt = 0;
  canvas.addEventListener(
    "wheel",
    (event) => {
      const time = now();
      if (time - lastWheelAt < 0.15) {
        return;
      }
      lastWheelAt = time;
      zoom(event.deltaY < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

function setupKeyboardInput() {
  const chatInput = $("#chat-input");
  addEventListener("keydown", (event) => {
    if (isChatActive()) {
      if (event.key === "Escape") {
        chatInput.blur();
      }
      return;
    }
    if (!game.isStarted) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      chatInput.focus();
      return;
    }
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit) {
      const id = hotbarSkills()[+digit[1] - 1];
      if (id) {
        useSkill(id);
      }
    } else if (event.code === "KeyR") {
      useSkill("red_potion");
    } else if (event.code === "KeyX") {
      useSkill("sit");
    } else if (event.code === "KeyC") {
      game.characterSheet.toggle();
    } else if (event.code === "KeyI") {
      game.inventory.toggle();
    } else if (event.code === "KeyJ") {
      toggleQuestTab();
    } else if (event.code === "KeyM") {
      game.worldMap.toggle();
    } else if (event.code === "KeyO") {
      game.settings.toggle();
    } else if (event.code === "KeyA" && event.ctrlKey && event.shiftKey) {
      event.preventDefault();
      game.adminPanel.toggle();
      return;
    } else if (event.key === "Escape") {
      if (isAnyPanelOpen()) {
        closeAllPanels();
      } else {
        clearTarget();
      }
    }
    pressedKeys.add(event.code);
  });
  addEventListener("keyup", (event) => pressedKeys.delete(event.code));
  addEventListener("blur", () => pressedKeys.clear());
}

/* the buttons of the HUD, the menu and the chat */
function setupButtons() {
  const chatInput = $("#chat-input");
  document
    .querySelectorAll('.slot[data-skill="red_potion"],.slot[data-skill="sit"]')
    .forEach((button) => button.addEventListener("click", () => useSkill(button.dataset.skill)));
  $("#chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    chatInput.value = "";
    chatInput.blur();
    /* chat commands (/invite, /leave, /kick) go to the party */
    if (text && game.network && !game.party.handleCommand(text)) {
      game.network.send("chat", { text: text.slice(0, 120) });
    }
  });
  $("#character-button").onclick = () => {
    if (game.characterSheet) {
      game.characterSheet.toggle();
    }
  };
  $("#inventory-button").onclick = () => {
    if (game.inventory) {
      game.inventory.toggle();
    }
  };
  $("#admin-button").onclick = () => {
    if (game.adminPanel) {
      game.adminPanel.toggle();
    }
  };
  $("#map-button").onclick = () => {
    if (game.worldMap) {
      game.worldMap.toggle();
    }
  };

  $("#settings-button").onclick = () => game.settings.toggle();

  /* fixed icons in the HTML (buttons, potion, sit, zeny) */
  document.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = icon(element.dataset.icon, element.dataset.emoji || "");
  });
  $("#mobile-chat").onclick = () => {
    document.body.classList.add("chat-open");
    chatInput.focus();
  };
  $("#chat-close").onclick = () => {
    document.body.classList.remove("chat-open");
    chatInput.blur();
  };
  $("#quests-button").onclick = () => {
    if (game.characterSheet) {
      toggleQuestTab();
    }
  };
  $("#zoom-in").onclick = () => zoom(1);
  $("#zoom-out").onclick = () => zoom(-1);
}

function setupInput() {
  setupPointerInput();
  setupKeyboardInput();
  setupButtons();
}

/* ====================== main loop ====================== */

const cameraFocus = new THREE.Vector3();
let lastFrameTime = now();
/* Touch devices draw a steady 60 frames per second. Many phones have a 90 or 120 Hz screen: drawing on every
   refresh there doubles the work, misses frames unevenly (which reads as stutter) and heats the phone until it
   slows down. A frame is drawn once at least FRAME_INTERVAL has passed, with some slack for timing jitter. */
const FRAME_INTERVAL = matchMedia("(pointer: coarse)").matches ? 1 / 60 : 0;
let nextFrameAt = 0;
const perfOverlay = createPerfOverlay(renderer);
function loop() {
  requestAnimationFrame(loop);
  const time = now();
  if (FRAME_INTERVAL) {
    if (time < nextFrameAt - 0.006) {
      return;
    }
    nextFrameAt = time + FRAME_INTERVAL;
  }
  const dt = Math.min(0.05, time - lastFrameTime);
  lastFrameTime = time;
  if (perfOverlay) {
    perfOverlay.begin();
  }
  step(dt);
  if (perfOverlay) {
    perfOverlay.end();
  }
}

let questCheckTimer = 0;
let currentZone = null;
let clockTimer = 2;
let portraitTimer = 1;
const portraitContext = $("#hud-portrait").getContext("2d");

/* the area the player is in, for the area banner and the minimap */
function zoneAt(x, z) {
  if (inCapital(x, z)) {
    return "capital";
  }
  if (inForest(x, z)) {
    return "forest";
  }
  if (inVale(x, z) && !inFields(x, z)) {
    return "vale";
  }
  return "fields";
}

function zoneLabel(zone, x, z) {
  if (zone === "capital") {
    return inCastle(x, z) ? "Aurelia Castle" : CAPITAL.name;
  }
  if (zone === "vale") {
    return VALE.name;
  }
  if (zone === "forest") {
    return FOREST.name;
  }
  return inVillage(x, z) ? "Runeveld" : "Runeveld fields";
}

/* the hotbar: cooldowns, unlearned skills, and active buffs */
function updateHotbar(time) {
  for (const id of hotbarSkills()) {
    UI.setCooldown(id, ((player.cooldowns[id] || 0) - time) / SKILLS[id].cooldown);
    const isActive =
      ((id === "mana_ward" || id === "mana_shell") && time < player.wardUntil) ||
      (id === "iron_resolve" && time < (player.ironResolveUntil || 0)) ||
      (id === "quickening" && time < (player.quickenUntil || 0));
    UI.setSlotState(id, !(player.skills[id] > 0), isActive);
  }
  UI.setCooldown(
    "red_potion",
    ((player.cooldowns.red_potion || 0) - time) / ITEMS.red_potion.cooldown,
  );
  UI.setSlotState("sit", false, player.isSitting);
  UI.setSlotState("red_potion", bagCount("red_potion") <= 0, false);
}

/* everything that only runs once the hero is in the world */
function stepWorld(dt, time) {
  updatePlayer(dt);
  if (game.host) {
    hostTick(dt);
  }
  updateMonsters(dt);
  updatePeers(dt);
  sendPresence();

  const jobExpMax = player.jobLevel < maxJobLevel() ? jobExpForLevel(player.jobLevel) : 0;
  UI.updateHud(
    player,
    hpMax(),
    spMax(),
    expForLevel(player.level),
    bagCount("red_potion"),
    heroClass().name,
    jobExpMax,
  );
  portraitTimer += dt;
  if (portraitTimer > 0.25) {
    portraitTimer = 0;
    drawHero(portraitContext, heroLayers(player.equipment, player.hair), time);
  }
  updateHotbar(time);
  updateTargetRing(dt, time);
  UI.setLowHp(!player.isDead && player.hp < hpMax() * 0.25);
  if (player.wardEffect && (time >= player.wardUntil || player.isDead)) {
    player.wardEffect.stop();
    player.wardEffect = null;
  }
  if (player.ironResolveEffect && (time >= (player.ironResolveUntil || 0) || player.isDead)) {
    player.ironResolveEffect.stop();
    player.ironResolveEffect = null;
  }

  /* the area name on screen when walking into another area */
  const zone = zoneAt(player.x, player.z);
  if (currentZone && zone !== currentZone) {
    UI.announce(ZONES[zone][0], ZONES[zone][1]);
  }
  if (zone !== currentZone || questCheckTimer === 0) {
    currentZone = zone;
    $("#minimap-zone").textContent = zoneLabel(zone, player.x, player.z);
  }
  game.characterSheet.tick(dt);
  game.adminPanel.tick(dt);
  game.party.tick(dt);
  game.worldMap.render();
  game.worldMap.renderMinimap();
}

function step(dt) {
  if (game.questLog) {
    questCheckTimer += dt;
    if (questCheckTimer >= 0.5) {
      questCheckTimer = 0;
      game.questLog.onBagChanged();
      game.questLog.onPosition(player.x, player.z);
      game.questLog.onStateChanged();
    }
    game.guide.update();
  }
  if (game.characterSelect && !game.isStarted) {
    game.characterSelect.tick(dt);
  }
  const time = now();
  if (!game.isStarted && game.characterSelect && game.characterSelect.isOpen()) {
    const target = game.characterSelect.cameraTarget();
    cameraFocus.set(target[0], target[1], target[2]);
  } else {
    cameraFocus.set(player.x, 0, player.z);
  }
  cameraState.target.lerp(cameraFocus, 1 - Math.exp(-8 * dt));
  if (cameraState.shakeTime > 0) {
    cameraState.shakeTime -= dt;
  }
  updateCamera();
  followSun(cameraState.target.x, cameraState.target.z);

  if (game.isStarted) {
    stepWorld(dt, time);
    const merchant = game.merchant;
    merchant.sprite.update(dt, cameraState);
    UI.positionLabel(merchant.label, merchant.x, merchant.sprite.height + 0.1, merchant.z, camera);
    game.gathering.update(dt);
  }
  updateVillagers(dt, cameraState, camera, player);
  updateSkillEffects(dt);
  updateBillboards();
  if (game.ambience) {
    /* dust behind everyone walking near the camera; villagers too, they make the streets feel alive */
    const movers = game.isStarted ? [player, ...peers.values(), ...villagers()] : [];
    game.ambience.update(dt, time, cameraState, renderer, movers, 1 - daylight());
  }
  if (game.effects) {
    game.effects.update(dt, cameraState);
  }
  if (game.daylight) {
    /* a soft light around the hero at night */
    const heroLight = {
      x: player.x,
      z: player.z,
      y: 0.8,
      radius: 4,
      color: [255, 240, 220],
      strength: 0.4,
    };
    game.daylight.update(cameraState, game.isStarted && !player.isDead ? [heroLight] : []);
  }
  clockTimer += dt;
  if (clockTimer > 1) {
    clockTimer = 0;
    const isDay = daylight() > 0.5;
    $("#hud-clock").innerHTML =
      icon(isDay ? "ui_sun" : "ui_moon", isDay ? "☀️" : "🌙", "small") + " " + clockText();
  }
  renderer.render(scene, camera);
}

/* debug handle for the browser console */
window.eldoria = {
  player,
  monsters,
  peers,
  cameraState,
  camera,
  renderer,
  scene,
  sun,
  obstacles,
  admin: ADMIN,
  party: () => game.party,
  network: () => game.network,
  host: () => game.host,
  step,
  useSkill,
  equip,
  unequip,
  buy,
  sell,
  drop,
  addToBag,
  bagCount,
  raiseStat,
  raiseSkill,
  derived,
  characterSheet: () => game.characterSheet,
  inventory: () => game.inventory,
  adminPanel: () => game.adminPanel,
  questLog: () => game.questLog,
  dialogue: () => game.dialogue,
  worldMap: () => game.worldMap,
  gathering: () => game.gathering,
  guide: () => game.guide,
  merchant: () => game.merchant,
  workbench: () => game.workbench,
  effects: () => game.effects,
  talkTo,
  villagers,
  advanceClass,
  maxJobLevel,
};

/* Phones drop the graphics context now and then (the screen was off for long, another app needed the GPU).
   three.js rebuilds everything once the browser gives it back; until then a notice, with a reload button in case
   it never comes back. */
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  if ($("#context-lost")) {
    return;
  }
  const notice = document.createElement("div");
  notice.id = "context-lost";
  notice.innerHTML =
    '<div class="loading-problem"><p>The graphics were interrupted. Restoring…</p>' +
    '<button class="btn main">Reload</button></div>';
  notice.querySelector("button").addEventListener("click", () => location.reload());
  document.body.appendChild(notice);
});
canvas.addEventListener("webglcontextrestored", () => {
  renderer.shadowMap.needsUpdate = true;
  const notice = $("#context-lost");
  if (notice) {
    notice.remove();
  }
});

init().catch((error) => {
  console.error(error);
  if (window.eldoriaLoadProblem) {
    window.eldoriaLoadProblem("Loading failed: " + error.message);
  } else {
    $("#loading").textContent = "Loading failed: " + error.message;
  }
});
