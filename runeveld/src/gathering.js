/* Eldoria – the professions in play: clicking a gathering node walks there and gathers it (a progress bar, the
   profession animation of work-animation.js, then the server's roll), clicking a crafting station walks there and
   opens the workbench; crafting there plays the station's animation first (workAt).
   Depleted nodes show what is left (a stump, a picked plant, a bare rock) until they grow back; the server tells
   everyone ('node_state'). Every profession action goes through perform(): with a server the server applies the
   rules and rolls the dice, without one the same rules run here. */
import * as THREE from "three";
import { ITEMS } from "./data.js";
import { GATHER_NODES } from "./rules/gather-nodes.js";
import {
  RESOURCES,
  PROFESSIONS,
  STATIONS,
  STATION_PLACES,
  USE_DISTANCE,
  professionLevel,
} from "./rules/professions.js";
import * as crafting from "./rules/crafting.js";
import { activeBuffs } from "./rules/progression.js";
import { nodeSprites } from "./profession-sites.js";
import { loadTexture } from "./sprites.js";
import { camera, scene, isFree } from "./world.js";
import { sfx } from "./audio.js";
import { icon } from "./icons.js";
import * as UI from "./ui.js";
import { player, game, clickables, now, playEffect, hpMax, spMax } from "./game-state.js";
import { pressedKeys } from "./player.js";
import { createWorkAnimation } from "./work-animation.js";
import { flyToHud } from "./feel.js";

/* what a node is called above it */
const NODE_NAMES = {
  copper_ore: "Copper vein",
  iron_ore: "Iron vein",
  silver_ore: "Silver vein",
  gold_ore: "Gold vein",
  arcane_crystal: "Arcane crystals",
  pine_log: "Pine",
  oak_log: "Oak",
  ash_log: "Ash",
  elder_log: "Elder",
};
const nodeName = (node) =>
  node.profession === "fishing"
    ? "Fishing spot"
    : NODE_NAMES[node.resource] || ITEMS[node.resource].name;

const GATHER_VERBS = {
  mining: "Mining",
  woodcutting: "Chopping",
  herbalism: "Picking",
  fishing: "Fishing",
};

/* how close the hero walks to a node before gathering (fishing spots lie in the water) */
const reachOf = (node) => (node.profession === "fishing" ? USE_DISTANCE - 0.3 : 2);
/* labels of nodes and stations show within this distance */
const LABEL_DISTANCE = 9;
/* the animation per gathering profession and per crafting station (sheets.js WORK) */
const GATHER_ANIMS = {
  mining: "mine",
  woodcutting: "chop",
  herbalism: "harvest",
  fishing: "fish_cast",
};
const STATION_ANIMS = {
  forge: "smith",
  alchemy_table: "brew",
  campfire: "cook",
  enchanting_altar: "enchant",
};
/* How far from the centre of a node or station the hero stands to work: beside it, so it is seen from the side
   (the clearest view of the swing) and not hidden behind it. */
const WORK_SIDE = { mining: 1.3, woodcutting: 1.2, herbalism: 0.8 };
const STATION_SIDE = { forge: 1.9, alchemy_table: 1.6, campfire: 1.2, enchanting_altar: 2.9 };

/** A free spot beside (x, z) at `side` units, on the hero's side if possible, a little in front (towards the camera). */
function spotBeside(x, z, side) {
  const preferred = Math.sign(player.x - x) || 1;
  for (const [dx, dz] of [
    [preferred, 0.2],
    [-preferred, 0.2],
    [0, 1],
    [0, -1],
  ]) {
    const spotX = x + dx * side;
    const spotZ = z + dz * (dx ? 1 : side);
    if (isFree(spotX, spotZ, 0.35)) {
      return [spotX, spotZ];
    }
  }
  return null;
}

/* how long a node shakes after a hit, in seconds */
const SHAKE_TIME = 0.3;

/**
 * @param {object} deps {applyHero(hero), openWorkbench(place), closeWorkbench(), workbenchPlace()}
 */
export function createGathering(deps) {
  const $ = (selector) => document.querySelector(selector);
  const bar = $("#gather-bar");
  /* node id → game time (s) at which it grows back */
  const depletedUntil = new Map();
  /* node id → {label, ripples} */
  const extras = new Map();
  const stationLabels = [];
  /* what the hero is doing: {node, start, duration} while gathering, {place, start, duration, resolve} while
     working at a station */
  let active = null;
  const work = createWorkAnimation();
  /* node id → {amount, time}: nodes shaking from a hit */
  const shakes = new Map();
  let ripplesInfo = null;
  let ripplesTexture = null;
  let buffTimer = 0;
  let buffsShown = "";

  /* ---- setting up: clickable meshes, labels, ripples ---- */

  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  /* an invisible cylinder that catches clicks (stations, fishing spots) */
  function hitCylinder(x, z, radius, height, userData) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 10),
      hitMaterial,
    );
    mesh.position.set(x, height / 2, z);
    mesh.userData = userData;
    scene.add(mesh);
    clickables.push(mesh);
    return mesh;
  }

  async function setup() {
    const [texture, fxInfo] = await Promise.all([
      loadTexture("sprites/fx/ripples.png", { raw: true }),
      fetch("sprites/fx/fx.json")
        .then((response) => response.json())
        .catch(() => ({})),
    ]);
    ripplesTexture = texture;
    ripplesInfo = fxInfo.ripples || null;

    for (const node of Object.values(GATHER_NODES)) {
      const sprites = nodeSprites.get(node.id);
      const extra = { label: UI.createLabel("node", nodeName(node)), ripples: null };
      extras.set(node.id, extra);
      if (node.profession === "fishing") {
        extra.ripples = makeRipples(node.x, node.z);
        hitCylinder(node.x, node.z, 1.3, 0.6, { node });
      } else if (sprites && sprites.full) {
        sprites.full.mesh.userData = { node };
        clickables.push(sprites.full.mesh);
      }
    }
    for (const place of STATION_PLACES) {
      const station = STATIONS[place.kind];
      hitCylinder(place.x, place.z, place.existing ? 1.9 : 1.4, 2.2, { station: place });
      stationLabels.push({
        place,
        label: UI.createLabel("station", station.emoji + " " + station.name),
      });
      /* a little life: fire on the forge and the campfire, a glow on the altars, bubbles on the table */
      if (place.kind === "forge") {
        playEffect("fire", place.x, place.z + 0.1, { size: 0.9, y: 1.25, loop: true });
      } else if (place.kind === "campfire") {
        playEffect("fire", place.x, place.z, { size: 1.3, y: 0.55, loop: true });
      } else if (place.kind === "enchanting_altar") {
        playEffect("sparkle", place.x, place.z, {
          size: 1.6,
          y: 1.7,
          loop: true,
          tint: 0xc9a2ff,
          fps: 8,
        });
      } else if (place.kind === "alchemy_table") {
        playEffect("candle", place.x - 0.6, place.z, { size: 0.5, y: 1.55, loop: true });
      }
    }
  }

  /* concentric rings on the water, lying flat, animated through the frames of the 'ripples' sheet */
  function makeRipples(x, z) {
    if (!ripplesTexture || !ripplesInfo) {
      return null;
    }
    const texture = ripplesTexture.clone();
    texture.needsUpdate = true;
    texture.repeat.set(1 / ripplesInfo.n, 1);
    const size = 2.2;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, (size * ripplesInfo.fh) / ripplesInfo.fw),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.34, z);
    mesh.renderOrder = 2;
    scene.add(mesh);
    return { mesh, texture, frame: 0, time: Math.random() * 2 };
  }

  /* ---- depleting and growing back ---- */

  const isDepleted = (id) => (depletedUntil.get(id) || 0) > now();

  function showNode(id, isAvailable) {
    const sprites = nodeSprites.get(id);
    if (sprites && sprites.full) {
      sprites.full.group.visible = isAvailable;
    }
    if (sprites && sprites.depleted) {
      sprites.depleted.group.visible = !isAvailable;
    }
    const extra = extras.get(id);
    if (extra && extra.ripples) {
      extra.ripples.mesh.visible = isAvailable;
    }
  }

  function deplete(id, respawnIn) {
    if (!GATHER_NODES[id]) {
      return;
    }
    depletedUntil.set(id, now() + Math.max(0, +respawnIn || 0));
    showNode(id, false);
    if (active && active.node.id === id) {
      cancel("Someone else got there first.");
    }
  }

  /* ---- gathering ---- */

  function clickNode(node) {
    if (isDepleted(node.id)) {
      UI.systemMessage(`The ${nodeName(node).toLowerCase()} is spent. It will be back soon.`);
      return;
    }
    const problem = crafting.gatherProblem(player, node.resource);
    if (problem) {
      UI.systemMessage(problem);
      return;
    }
    const distance = Math.hypot(node.x - player.x, node.z - player.z);
    /* fishing: walk towards the spot until the shore stops the hero; otherwise to a spot beside the node */
    const spot =
      node.profession === "fishing" ? null : spotBeside(node.x, node.z, WORK_SIDE[node.profession]);
    const isThere = spot
      ? Math.hypot(spot[0] - player.x, spot[1] - player.z) < 0.5
      : distance <= reachOf(node);
    if (isThere) {
      begin(node);
      return;
    }
    player.destination = spot || [node.x, node.z];
    player.onArrive = () => {
      if (Math.hypot(node.x - player.x, node.z - player.z) <= USE_DISTANCE) {
        begin(node);
      }
    };
    player.target = null;
  }

  function begin(node) {
    if (isDepleted(node.id) || player.isDead) {
      return;
    }
    const duration = crafting.gatherTime(player, node.resource);
    active = { node, start: now(), duration, hasBite: false };
    player.destination = null;
    player.onArrive = null;
    work.start(GATHER_ANIMS[node.profession], {
      x: node.x,
      z: node.z,
      shake: (amount) => shakes.set(node.id, { amount, time: 0 }),
    });
    const resourceName = ITEMS[node.resource].name.toLowerCase();
    $("#gather-label").textContent =
      node.profession === "fishing"
        ? "Fishing…"
        : `${GATHER_VERBS[node.profession]} ${resourceName}…`;
    $("#gather-icon").innerHTML = icon(
      "prof_" + node.profession,
      PROFESSIONS[node.profession].emoji,
    );
    bar.hidden = false;
  }

  function cancel(reason) {
    if (!active) {
      return;
    }
    const resolve = active.resolve;
    active = null;
    bar.hidden = true;
    work.stop();
    if (resolve) {
      resolve(false);
    }
    if (reason) {
      UI.systemMessage(reason);
    }
  }

  /**
   * Work at a station for `duration` seconds with its animation, before a craft, refine or enchant goes to the
   * server. Resolves true when done, false when the hero walked away or was interrupted.
   */
  function workAt(place, duration, label) {
    cancel();
    return new Promise((resolve) => {
      active = { place, start: now(), duration, resolve };
      $("#gather-label").textContent = label;
      const profession = STATIONS[place.kind].profession;
      $("#gather-icon").innerHTML = icon("prof_" + profession, PROFESSIONS[profession].emoji);
      bar.hidden = false;
      work.start(STATION_ANIMS[place.kind], { x: place.x, z: place.z, shake: () => {} });
    });
  }

  async function finish(node) {
    active = null;
    bar.hidden = true;
    work.stop();
    const result = await perform("gather", { node: node.id });
    if (!result) {
      return;
    }
    if (!result.ok) {
      UI.systemMessage(result.reason);
      return;
    }
    /* without a server this client depletes the node itself */
    if (!game.network.usesServer()) {
      deplete(node.id, RESOURCES[node.resource].respawn);
    }
    const item = ITEMS[result.item];
    sfx.loot();
    flyToHud(result.item, item.icon, node.x, 0.5, node.z, camera, "bag");
    UI.floatingText(
      player.x,
      player.sprite.height + 0.6,
      player.z,
      camera,
      `+${result.count} ${item.name}`,
      "loot",
    );
    UI.logMessage(
      `<span class="loot-msg">You gather ${result.count > 1 ? result.count + " × " : ""}${icon(result.item, item.icon, "small")} ${UI.escapeHtml(item.name)}.</span>`,
    );
    if (result.gem) {
      const gem = ITEMS[result.gem];
      UI.logMessage(
        `<span class="level-msg">A gem! You found ${icon(result.gem, gem.icon, "small")} ${UI.escapeHtml(gem.name)}.</span>`,
      );
      playEffect("sparkle", node.x, node.z, { size: 1.4, y: 0.6 });
      flyToHud(result.gem, gem.icon, node.x, 0.5, node.z, camera, "bag", 0.25);
    }
    reportProgress(result);
  }

  /** Profession exp and level ups after an action. */
  function reportProgress(result) {
    if (!result || !result.profession || !result.exp) {
      return;
    }
    const profession = PROFESSIONS[result.profession];
    UI.floatingText(
      player.x,
      player.sprite.height + 0.3,
      player.z,
      camera,
      `+${result.exp} ${profession.name}`,
      "exp",
    );
    if (result.levelUps > 0) {
      sfx.levelUp();
      UI.announce(`${profession.name} ${result.level}`, "Your skill grows.");
      UI.logMessage(
        `<span class="level-msg">${UI.escapeHtml(profession.name)} is now level ${result.level}!</span>`,
      );
      playEffect("light_rays", player.x, player.z, { size: 2.6, grounded: true, tint: 0xffe6a0 });
    }
    game.characterSheet.render();
    game.inventory.render();
    if (game.questLog) {
      game.questLog.refresh();
    }
  }

  /* ---- talking to the server ---- */

  /**
   * Run a profession action: on the server when there is one (the reply carries the new hero record), otherwise
   * with the same rules here. Resolves the result {ok, ...} or null when the server did not answer.
   */
  async function perform(type, data) {
    const network = game.network;
    if (network && network.usesServer()) {
      const response = await network.professionAction(type, data);
      if (!response) {
        UI.systemMessage("The server did not answer. Try again in a moment.");
        return null;
      }
      if (response.hero) {
        deps.applyHero(response.hero);
      }
      return response.result || { ok: false, reason: "That did not work." };
    }
    return performLocally(type, data);
  }

  function performLocally(type, data) {
    const target = { slot: data.slot, index: data.index };
    switch (type) {
      case "gather":
        return crafting.gather(player, GATHER_NODES[data.node].resource);
      case "craft":
        return crafting.craft(player, data.recipe, data.times);
      case "refine":
        return crafting.refine(player, target);
      case "enchant":
        return crafting.enchant(player, target, data.rune);
      case "disenchant":
        return crafting.disenchant(player, data.index);
      case "use":
        return crafting.useItem(player, data.id);
    }
    return { ok: false, reason: "Unknown action." };
  }

  /** Use a consumable from the bag (food, mana potions, elixirs). */
  async function useItem(id) {
    const item = ITEMS[id];
    const result = await perform("use", {
      id,
      hp: Math.round(player.hp),
      sp: Math.round(player.sp),
    });
    if (!result) {
      return;
    }
    if (!result.ok) {
      UI.systemMessage(result.reason);
      return;
    }
    sfx.potion();
    /* the server only sends the record back; hp and sp are kept by this client, so add what was restored */
    if (game.network.usesServer()) {
      if (result.use === "heal") {
        player.hp += result.amount;
      } else if (result.use === "mana") {
        player.sp += result.amount;
      }
    }
    if (result.use === "heal") {
      UI.floatingText(
        player.x,
        player.sprite.height + 0.4,
        player.z,
        camera,
        "+" + result.amount,
        "heal",
      );
      playEffect("hearts", player.x, player.z, { size: 1.4, y: 1 });
    } else if (result.use === "mana") {
      UI.floatingText(
        player.x,
        player.sprite.height + 0.4,
        player.z,
        camera,
        "+" + result.amount + " SP",
        "heal",
      );
      playEffect("sparkle", player.x, player.z, { size: 1.6, y: 1, tint: 0x8fc8ff });
    } else {
      UI.systemMessage(`You drink the ${item.name.toLowerCase()}. ${item.description}`);
      playEffect("light_rays", player.x, player.z, { size: 2.4, grounded: true, tint: 0xffb36b });
    }
    player.hp = Math.min(player.hp, hpMax());
    player.sp = Math.min(player.sp, spMax());
    game.inventory.render();
  }

  /* ---- stations ---- */

  function clickStation(place) {
    cancel();
    const spot = spotBeside(place.x, place.z, STATION_SIDE[place.kind]);
    if (!spot || Math.hypot(spot[0] - player.x, spot[1] - player.z) < 0.5) {
      player.sprite.face(place.x - player.x, place.z - player.z);
      deps.openWorkbench(place);
      return;
    }
    player.destination = spot;
    player.onArrive = () => {
      if (Math.hypot(place.x - player.x, place.z - player.z) <= USE_DISTANCE + 0.5) {
        player.sprite.face(place.x - player.x, place.z - player.z);
        deps.openWorkbench(place);
      }
    };
    player.target = null;
  }

  /* the running elixirs as icons next to the player frame, with the minutes left */
  const BUFF_ICONS = {
    str: "elixir_of_might",
    int: "elixir_of_wisdom",
    agi: "elixir_of_swiftness",
  };
  function renderBuffs() {
    const buffs = activeBuffs(player);
    const html = Object.entries(buffs)
      .map(([stat, buff]) => {
        const minutes = Math.max(1, Math.ceil((buff.until - Date.now()) / 60000));
        const itemId = BUFF_ICONS[stat] || "elixir_of_might";
        return `<span class="buff" title="${stat.toUpperCase()} +${buff.amount}">${icon(itemId, "🧪")}<small>${minutes}m</small></span>`;
      })
      .join("");
    if (html !== buffsShown) {
      buffsShown = html;
      $("#hud-buffs").innerHTML = html;
    }
  }

  /* ---- every frame ---- */

  function update(dt) {
    const time = now();
    buffTimer -= dt;
    if (buffTimer <= 0) {
      buffTimer = 1;
      renderBuffs();
    }
    for (const [id, until] of depletedUntil) {
      if (until <= time) {
        depletedUntil.delete(id);
        showNode(id, true);
      }
    }

    if (active) {
      const wantsToMove = player.destination || player.target || pressedKeys.size > 0;
      if (player.isDead || wantsToMove) {
        cancel();
      } else {
        const progress = Math.min(1, (time - active.start) / active.duration);
        $("#gather-fill").style.transform = `scaleX(${progress.toFixed(3)})`;
        if (
          active.node &&
          active.node.profession === "fishing" &&
          progress > 0.85 &&
          !active.hasBite
        ) {
          active.hasBite = true;
          work.bite();
        }
        if (progress >= 1) {
          if (active.node) {
            finish(active.node);
          } else {
            const resolve = active.resolve;
            active = null;
            bar.hidden = true;
            work.stop();
            resolve(true);
          }
        }
      }
    }
    work.update(dt);

    /* nodes shaking from a hit: a quick wobble that dies out */
    for (const [id, shake] of shakes) {
      shake.time += dt;
      const sprites = nodeSprites.get(id);
      const mesh = sprites && sprites.full ? sprites.full.mesh : null;
      if (shake.time >= SHAKE_TIME) {
        shakes.delete(id);
        if (mesh) {
          mesh.position.x = 0;
        }
      } else if (mesh) {
        mesh.position.x = Math.sin(shake.time * 60) * shake.amount * (1 - shake.time / SHAKE_TIME);
      }
    }

    /* a workbench closes when the hero walks away from its station */
    const place = deps.workbenchPlace();
    if (place && Math.hypot(place.x - player.x, place.z - player.z) > USE_DISTANCE + 1.5) {
      deps.closeWorkbench();
    }

    /* labels of nodes and stations nearby; ripples */
    for (const [id, extra] of extras) {
      const node = GATHER_NODES[id];
      const isNear = Math.hypot(node.x - player.x, node.z - player.z) < LABEL_DISTANCE;
      if (isNear && !isDepleted(id)) {
        const sprites = nodeSprites.get(id);
        const height = sprites && sprites.full ? sprites.full.mesh.geometry.parameters.height : 0.6;
        const resource = RESOURCES[node.resource];
        extra.label.el.classList.toggle(
          "locked",
          professionLevel(player, resource.profession) < resource.level,
        );
        UI.positionLabel(extra.label, node.x, Math.min(height, 3.2) + 0.2, node.z, camera);
      } else {
        extra.label.el.style.display = "none";
      }
      if (extra.ripples && extra.ripples.mesh.visible && ripplesInfo) {
        const ripples = extra.ripples;
        ripples.time += dt;
        const frame = Math.floor(ripples.time * ripplesInfo.fps) % ripplesInfo.n;
        if (frame !== ripples.frame) {
          ripples.frame = frame;
          ripples.texture.offset.x = frame / ripplesInfo.n;
        }
      }
    }
    for (const { place, label } of stationLabels) {
      if (Math.hypot(place.x - player.x, place.z - player.z) < LABEL_DISTANCE + 3) {
        UI.positionLabel(label, place.x, place.kind === "forge" ? 3.6 : 2.4, place.z, camera);
      } else {
        label.el.style.display = "none";
      }
    }
  }

  return {
    setup,
    update,
    clickNode,
    clickStation,
    perform,
    workAt,
    isDepleted,
    reportProgress,
    useItem,
    cancel,
    /** A node was gathered (server event 'node_state'). */
    onNodeState: (data) => deplete(String(data.id), data.respawnIn),
    /** Every depleted node when joining the world. */
    onNodeStates: (list) => {
      for (const entry of list || []) {
        deplete(String(entry.id), entry.respawnIn);
      }
    },
    /** The crafting stations for the world map. */
    markers: () =>
      STATION_PLACES.map((place) => ({
        x: place.x,
        z: place.z,
        emoji: STATIONS[place.kind].emoji,
        title: STATIONS[place.kind].name,
      })),
  };
}
