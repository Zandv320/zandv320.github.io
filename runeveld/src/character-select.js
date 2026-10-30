/* Eldoria – character select, as in WoW: a list of heroes on the right, the chosen hero large in view, and Enter
   World / Create / Delete at the bottom. Creating takes a name and hair colour; deleting asks you to type the name. */
import { heroLayers, drawHero, HAIR_CHOICES } from "./appearance.js";
import { icon } from "./icons.js";
import { CLASSES } from "./data.js";
import { inForest, FOREST } from "./regions.js";
import { escapeHtml } from "./ui.js";
import { SHEETS } from "./sheets.js";
import { Sprite2D } from "./sprites.js";
import * as THREE from "three";

export const MAX_HEROES = 6;
/* Where the chosen hero stands: in front of the well on the square, facing the camera. */
export const PODIUM = { x: 0, z: 4.5, yaw: 0, tilt: 36 };

const DEFAULT_HAIR = "plum";
const DEFAULT_CLASS = "swordsman";

/**
 * @param {object} deps {heroes() → list of hero records, save(), start(index), lastIndex() → index,
 *   inVillage(x, z), scene, cameraState, camera, setZoom(px), minZoom() → px, pixelRatio() → rendered pixels per
 *   CSS pixel, onCreate(hero), onDelete(name)}
 * Screens: 'select', 'create', 'delete' and 'account' (account.js).
 */
export function createCharacterSelect(deps) {
  const $ = (selector) => document.querySelector(selector);
  const startScreen = $("#start");
  const selectScreen = $("#select");
  const createScreen = $("#create");
  const deleteScreen = $("#delete");
  const accountScreen = $("#account");
  const avatarScale = SHEETS.hero.frameWidth / 64;

  /* The hero really stands in the world: a sprite on the podium that gets the layers of the chosen hero. */
  const podiumHero = new Sprite2D(SHEETS.hero, {
    layers: heroLayers(CLASSES.swordsman.starterEquipment, DEFAULT_HAIR),
  });
  podiumHero.group.position.set(PODIUM.x, 0, PODIUM.z);
  podiumHero.group.visible = false;
  deps.scene.add(podiumHero.group);
  let podiumKey = "";
  const projected = new THREE.Vector3();

  function setPodiumHero(layers, key) {
    if (key === podiumKey) {
      return;
    }
    podiumKey = key;
    podiumHero.setLayers(layers);
    podiumHero.play("idle", true);
  }

  let index = deps.lastIndex() || 0;
  let hair = DEFAULT_HAIR;
  let chosenClass = DEFAULT_CLASS;
  let isOpenNow = false;
  let screen = "select";

  const classOf = (hero) => CLASSES[hero.classId] || CLASSES.swordsman;
  const heroes = () => deps.heroes();
  const zoneOf = (hero) => {
    if (!hero.level) {
      return "Never played";
    }
    const x = hero.x || 0;
    const z = hero.z || 0;
    if (inForest(x, z)) {
      return FOREST.name;
    }
    return deps.inVillage(x, z) ? "Runeveld village" : "Runeveld fields";
  };
  const layersOf = (hero) =>
    heroLayers(hero.equipment || classOf(hero).starterEquipment, hero.hair);

  function renderList() {
    const list = heroes();
    index = Math.max(0, Math.min(list.length - 1, index));
    const cards = list.map(
      (hero, n) =>
        `<button class="hero-card${n === index ? " active" : ""}" data-index="${n}"><canvas width="${36 * avatarScale}" height="${40 * avatarScale}"></canvas><div><b>${escapeHtml(hero.name)}</b><small>Level ${hero.level || 1} ${classOf(hero).name}</small><small class="zone">${escapeHtml(zoneOf(hero))}</small></div></button>`,
    );
    $("#select-list").innerHTML =
      cards.join("") + `<div class="select-count">${list.length} / ${MAX_HEROES} characters</div>`;
    $("#select-list")
      .querySelectorAll(".hero-card")
      .forEach((card, n) =>
        drawHero(card.querySelector("canvas").getContext("2d"), layersOf(list[n]), 0),
      );
    const hero = list[index];
    $("#select-name").textContent = hero ? hero.name : "No characters yet";
    $("#select-subtitle").textContent = hero
      ? `Level ${hero.level || 1} ${classOf(hero).name} · ${zoneOf(hero)}`
      : "Create your first hero to begin.";
    $("#select-play").disabled = !hero;
    $("#select-delete").disabled = !hero;
    $("#select-create").disabled = list.length >= MAX_HEROES;
  }

  /* The hero about a quarter of the stage high (40 to 110 CSS pixels), zoomed in whole steps of the pixel art so
     the pixels stay crisp; never further out than the game itself. */
  function fitZoom() {
    const rect = stageRect();
    const heroUnits = SHEETS.hero.height * SHEETS.hero.scale;
    const wantedCss = Math.max(40, Math.min(110, rect.height * 0.24, rect.width * 0.22));
    const step = 16;
    const px = Math.floor(((wantedCss / heroUnits) * deps.pixelRatio()) / step) * step;
    const zoom = Math.max(deps.minZoom(), Math.min(px, 160));
    if (zoom !== deps.cameraState.px) {
      deps.setZoom(zoom);
    }
  }

  function tick(dt) {
    if (!isOpenNow) {
      return;
    }
    fitZoom();
    const list = heroes();
    const hero =
      screen === "create"
        ? { equipment: CLASSES[chosenClass].starterEquipment, hair, classId: chosenClass }
        : list[index];
    podiumHero.group.visible = !!hero && screen !== "delete";
    if (hero) {
      const layers = layersOf(hero);
      const key = JSON.stringify([
        hero.equipment || null,
        hero.hair || null,
        hero.classId || null,
        layers.length,
      ]);
      setPodiumHero(layers, key);
      /* Face the camera, even while it turns. */
      podiumHero.face(Math.sin(deps.cameraState.yaw), Math.cos(deps.cameraState.yaw));
      podiumHero.update(dt, deps.cameraState);
    }
    /* Name and level under the hero's feet. */
    const info = $("#select-info");
    info.hidden = screen !== "select" || !hero;
    if (!info.hidden) {
      projected.set(PODIUM.x, -0.15, PODIUM.z).project(deps.camera);
      const screenX = (((projected.x + 1) / 2) * innerWidth).toFixed(1);
      const screenY = (((1 - projected.y) / 2) * innerHeight).toFixed(1);
      info.style.transform = `translate(${screenX}px,${screenY}px) translate(-50%,0)`;
    }
  }

  /* The part of the screen where the hero stands: the empty stage of the select screen, or the room beside (or
     above, on a narrow screen) the card of the other screens. */
  function stageRect() {
    if (screen === "select") {
      const stage = $(".select-hero").getBoundingClientRect();
      if (stage.width > 60 && stage.height > 60) {
        return stage;
      }
    }
    const screenElement = { create: createScreen, delete: deleteScreen, account: accountScreen }[
      screen
    ];
    const card = screenElement && screenElement.querySelector(".card");
    const box = card ? card.getBoundingClientRect() : null;
    if (!box || !box.width) {
      return { left: 0, top: 0, width: innerWidth, height: innerHeight, bottom: innerHeight };
    }
    if (box.left >= 220) {
      return { left: 0, top: 0, width: box.left, height: innerHeight, bottom: innerHeight * 0.62 };
    }
    return { left: 0, top: 0, width: innerWidth, height: box.top, bottom: box.top };
  }

  const feet = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const awayFromCamera = new THREE.Vector3();
  const toScreen = (point) => {
    probe.copy(point).project(deps.camera);
    return [((probe.x + 1) / 2) * innerWidth, ((1 - probe.y) / 2) * innerHeight];
  };

  /**
   * What the camera looks at while the start screens are open: chosen so that the hero's feet land at the bottom of
   * the stage (with room for the name below), whatever the size and shape of the screen. The camera is
   * orthographic, so moving its target moves every point on screen by the same, linear amount.
   */
  function cameraTarget() {
    const { cameraState } = deps;
    const target = cameraState.target;
    const rect = stageRect();
    const nameSpace = screen === "select" ? 66 : 14;
    const wantX = rect.left + rect.width / 2;
    const wantY = Math.max(rect.top + rect.height * 0.6, rect.bottom - nameSpace);
    feet.set(PODIUM.x, 0, PODIUM.z);
    const [x, y] = toScreen(feet);
    const right = cameraState.right;
    awayFromCamera.set(-Math.sin(cameraState.yaw), 0, -Math.cos(cameraState.yaw));
    const perRight = toScreen(feet.clone().add(right))[0] - x;
    const perAway = toScreen(feet.clone().add(awayFromCamera))[1] - y;
    if (!perRight || !perAway) {
      return [PODIUM.x, 0.7, PODIUM.z];
    }
    const alongRight = (x - wantX) / perRight;
    const alongAway = (y - wantY) / perAway;
    return [
      target.x + right.x * alongRight + awayFromCamera.x * alongAway,
      0.7,
      target.z + right.z * alongRight + awayFromCamera.z * alongAway,
    ];
  }

  function showScreen(name) {
    screen = name;
    selectScreen.hidden = name !== "select";
    createScreen.hidden = name !== "create";
    deleteScreen.hidden = name !== "delete";
    accountScreen.hidden = name !== "account";
    if (name === "select") {
      renderList();
    }
  }

  const focusNameInput = () => {
    if (!matchMedia("(pointer:coarse)").matches) {
      $("#create-name").focus();
    }
  };

  /* ---- select ---- */

  $("#select-list").addEventListener("click", (event) => {
    const card = event.target.closest(".hero-card");
    if (!card) {
      return;
    }
    const clicked = +card.dataset.index;
    if (clicked === index) {
      enterWorld();
      return;
    }
    index = clicked;
    renderList();
  });
  $("#select-list").addEventListener("dblclick", (event) => {
    if (event.target.closest(".hero-card")) {
      enterWorld();
    }
  });

  function enterWorld() {
    const list = heroes();
    if (!list[index]) {
      return;
    }
    isOpenNow = false;
    startScreen.hidden = true;
    podiumHero.group.visible = false;
    $("#select-info").hidden = true;
    deps.start(index);
  }

  $("#select-play").onclick = enterWorld;
  $("#select-create").onclick = () => {
    if (heroes().length >= MAX_HEROES) {
      return;
    }
    hair = DEFAULT_HAIR;
    chosenClass = DEFAULT_CLASS;
    $("#create-name").value = "";
    $("#create-error").textContent = "";
    renderClasses();
    renderHair();
    showScreen("create");
    focusNameInput();
  };
  $("#select-delete").onclick = () => {
    const hero = heroes()[index];
    if (!hero) {
      return;
    }
    $("#delete-name").textContent = hero.name;
    $("#delete-confirm").value = "";
    $("#delete-submit").disabled = true;
    showScreen("delete");
    $("#delete-confirm").focus();
  };

  /* ---- create ---- */

  function renderClasses() {
    $("#create-classes").innerHTML = Object.entries(CLASSES)
      .filter(([, heroClass]) => heroClass.tier === 1)
      .map(
        ([id, heroClass]) =>
          `<button class="class-option${id === chosenClass ? " active" : ""}" data-class="${id}"><div class="class-icon">${icon("class_" + id, heroClass.icon)}</div><div><b>${heroClass.name}</b><small>${escapeHtml(heroClass.description)}</small></div></button>`,
      )
      .join("");
  }
  $("#create-classes").addEventListener("click", (event) => {
    const button = event.target.closest(".class-option");
    if (!button) {
      return;
    }
    chosenClass = button.dataset.class;
    renderClasses();
  });

  function renderHair() {
    $("#create-hair").innerHTML = HAIR_CHOICES.map(
      ([id, label, [r, g, b]]) =>
        `<button class="hair${id === hair ? " active" : ""}" data-hair="${id}" title="${label}" style="background:rgb(${r},${g},${b})"></button>`,
    ).join("");
    $("#create-hair-name").textContent = HAIR_CHOICES.find((choice) => choice[0] === hair)[1];
  }
  $("#create-hair").addEventListener("click", (event) => {
    const button = event.target.closest(".hair");
    if (!button) {
      return;
    }
    hair = button.dataset.hair;
    renderHair();
  });

  function createHero() {
    const name = $("#create-name").value.trim();
    const list = heroes();
    const error = $("#create-error");
    if (name.length < 2 || name.length > 14) {
      error.textContent = "A name has 2 to 14 characters.";
      return;
    }
    if (!/^[\p{L}\p{N} '-]+$/u.test(name)) {
      error.textContent = "Letters, numbers, spaces and - only.";
      return;
    }
    if (list.some((hero) => hero.name.toLowerCase() === name.toLowerCase())) {
      error.textContent = "You already have a hero with that name.";
      return;
    }
    list.push({ name, hair, classId: chosenClass });
    deps.save();
    if (deps.onCreate) {
      deps.onCreate(list[list.length - 1]);
    }
    index = list.length - 1;
    showScreen("select");
  }
  $("#create-submit").onclick = createHero;
  $("#create-name").onkeydown = (event) => {
    if (event.key === "Enter") {
      createHero();
    }
  };
  $("#create-back").onclick = () => showScreen("select");

  /* ---- delete: typing the name is the confirmation ---- */

  $("#delete-confirm").oninput = () => {
    const hero = heroes()[index];
    $("#delete-submit").disabled =
      !hero || $("#delete-confirm").value.trim().toLowerCase() !== hero.name.toLowerCase();
  };
  $("#delete-submit").onclick = () => {
    const list = heroes();
    if ($("#delete-submit").disabled || !list[index]) {
      return;
    }
    const removed = list.splice(index, 1)[0];
    deps.save();
    if (deps.onDelete) {
      deps.onDelete(removed.name);
    }
    index = Math.max(0, index - 1);
    showScreen("select");
  };
  $("#delete-back").onclick = () => showScreen("select");

  /* Keys: arrows choose, Enter enters the world, Escape goes back. */
  addEventListener("keydown", (event) => {
    if (!isOpenNow) {
      return;
    }
    if (screen !== "select") {
      if (event.key === "Escape") {
        showScreen("select");
      }
      return;
    }
    if (document.activeElement && document.activeElement.tagName === "INPUT") {
      return;
    }
    const list = heroes();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!list.length) {
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : list.length - 1;
      index = (index + step) % list.length;
      renderList();
    } else if (event.key === "Enter") {
      enterWorld();
    }
  });

  function show() {
    isOpenNow = true;
    startScreen.hidden = false;
    showScreen(heroes().length ? "select" : "create");
    if (screen === "create") {
      hair = DEFAULT_HAIR;
      chosenClass = DEFAULT_CLASS;
      renderClasses();
      renderHair();
      focusNameInput();
    }
  }

  return { show, tick, isOpen: () => isOpenNow, cameraTarget, showScreen };
}
