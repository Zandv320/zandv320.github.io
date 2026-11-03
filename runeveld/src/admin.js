/* Eldoria – admin panel (Ctrl+Shift+A, or ?admin in the URL).
   Everything here runs in the player's own browser and is therefore NOT security: it is a handy dashboard for the
   developer. Once the world runs on a server, these become server commands. */
import { ITEMS, MONSTERS, MAX_LEVEL } from "./data.js";
import { VILLAGE_HALF_SIZE, FIELD_SIZE } from "./world.js";
import * as THREE from "three";
import * as UI from "./ui.js";
import { SMOOTH } from "./sprites.js";
import { CRYPT_ENTRY, CRYPT_STAIRS, cryptPoint } from "./rules/crypt.js";
import { SAGAS, CHAPTERS, QUESTS, MAIN_QUESTS, chaptersOf } from "./rules/quests.js";
import {
  stormStrength,
  setStormOverride,
  whiteoutStrength,
  setWhiteoutOverride,
} from "./rules/weather.js";
import { NORTHROAD, BRIDGE, GORGE, SALTMERE } from "./regions.js";
import { CAMP_WAKE, MOUNT_KHAROS, EMBER_LANDS } from "./rules/ember.js";
import { TIDE_WAKE, CAUSEWAY } from "./rules/tidecrown.js";
import {
  RIME_WAKE,
  PASS_FOOT,
  SHELTER_WAKE,
  UNBOUND_CAMP,
  TROLL_HOLLOW,
} from "./rules/frostmarch.js";
import { FORGE_ENTRY, forgePoint } from "./rules/forge.js";
import { PROFESSIONS, MAX_PROFESSION_LEVEL, professionLevel } from "./rules/professions.js";
import { RARITIES, rarityOf } from "./rules/rarity.js";
import { itemLevel } from "./rules/item-level.js";
import { effectLines } from "./rules/item-effects.js";
import { icon } from "./icons.js";
import { itemStatText, setText } from "./character-sheet.js";
import { heroLayers, drawHero } from "./appearance.js";
import { equip } from "./bag.js";

const ADMIN_KEY = "eldoria.admin";
const TOKEN_KEY = "eldoria.token";
const PIXEL_KEY = "eldoria.pixel";
const SMOOTH_KEY = "eldoria.smooth";

/* Colours of the monster zones in the debug overlay. */
const ZONE_COLORS = { rabbit: 0x9fe3b0, fox: 0xffb84d, boar: 0xff6b6b };

/**
 * @param {object} ctx {player, monsters, peers, cameraState, camera, scene, renderer, ADMIN, setZoom, network(),
 *   isHost(), addToBag, giveItem, setLevel, setJobLevel, setProfessions, respec, teleport, spawnMonster, killMonster, killAll, respawnAll,
 *   refreshAppearance, save, restore, exportSave, importSave, resetSave, derived, obstacles, render, timeOfDay(),
 *   setTimeOverride}
 */
export function createAdminPanel(ctx) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#admin");
  const content = $("#admin-content");
  const hudButton = $("#admin-button");
  const { player, monsters, peers, cameraState, scene, ADMIN } = ctx;
  let isOpenNow = false;
  let fps = 0;
  let frames = 0;
  let fpsTimer = 0;
  let debugOverlay = null;
  let pixelReloadTimer = null;
  /* Refreshes the live values; set once the panel has been built. */
  let refreshValues = null;

  /* ?admin in the URL remembers the button in the HUD. */
  if (new URLSearchParams(location.search).has("admin")) {
    try {
      localStorage.setItem(ADMIN_KEY, "1");
    } catch (e) {}
  }
  let isButtonVisible = false;
  try {
    isButtonVisible = localStorage.getItem(ADMIN_KEY) === "1";
  } catch (e) {}
  hudButton.hidden = !isButtonVisible;

  /* ---- small DOM builders ---- */

  const element = (tag, attributes = {}, html = "") => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    node.innerHTML = html;
    return node;
  };
  const section = (title, isOpenInitially = false) => {
    const details = element("details", isOpenInitially ? { open: "" } : {});
    details.appendChild(element("summary", {}, title));
    content.appendChild(details);
    return details;
  };
  const row = (parent, label, ...children) => {
    const rowElement = element("div", { class: "admin-row" });
    rowElement.appendChild(element("label", {}, label));
    for (const child of children) {
      rowElement.appendChild(child);
    }
    parent.appendChild(rowElement);
    return rowElement;
  };
  const buttons = (parent, list) => {
    const group = element("div", { class: "admin-buttons" });
    for (const [text, onClick, extraClass] of list) {
      const button = element("button", { class: "admin-btn " + (extraClass || "") }, text);
      button.onclick = () => {
        onClick();
        refresh();
      };
      group.appendChild(button);
    }
    parent.appendChild(group);
    return group;
  };
  const slider = (parent, label, get, set, min, max, step = 1, format = (value) => value) => {
    const input = element("input", { type: "range", min, max, step });
    input.value = get();
    const output = element("output", {}, format(get()));
    input.oninput = () => {
      set(+input.value);
      output.textContent = format(+input.value);
    };
    row(parent, label, input, output);
    return input;
  };
  const numberField = (parent, label, get, set, min, max) => {
    const input = element("input", { type: "number", min, max });
    input.value = get();
    input.onchange = () => {
      set(+input.value);
      refresh();
    };
    row(parent, label, input);
    return input;
  };
  const toggleSwitch = (parent, label, get, set) => {
    const button = element(
      "button",
      { class: "admin-btn" + (get() ? " on" : "") },
      get() ? "on" : "off",
    );
    button.onclick = () => {
      set(!get());
      button.classList.toggle("on", get());
      button.textContent = get() ? "on" : "off";
    };
    row(parent, label, button);
    return button;
  };

  const readStorage = (key, fallback) => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (e) {
      return fallback;
    }
  };
  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };

  function build() {
    content.innerHTML = "";

    /* ---------- character ---------- */
    let group = section("Character", true);
    const levelInput = numberField(
      group,
      "Base level",
      () => player.level,
      (value) => ctx.setLevel(value),
      1,
      MAX_LEVEL,
    );
    const jobLevelInput = numberField(
      group,
      "Job level",
      () => player.jobLevel,
      (value) => ctx.setJobLevel(value),
      1,
      /* Second-tier classes go up to job level 50. */
      50,
    );
    numberField(
      group,
      "Zeny",
      () => player.zeny,
      (value) => {
        player.zeny = Math.max(0, value | 0);
        ctx.render();
      },
      0,
      9999999,
    );
    buttons(group, [
      ["Full HP/SP", () => ctx.restore()],
      [
        "+1000 zeny",
        () => {
          player.zeny += 1000;
          ctx.render();
        },
      ],
      ["Reset stats & skills", () => ctx.respec(), "danger"],
    ]);
    toggleSwitch(
      group,
      "God mode (no damage)",
      () => ADMIN.god,
      (value) => (ADMIN.god = value),
    );
    toggleSwitch(
      group,
      "No clip (walk through things)",
      () => ADMIN.noclip,
      (value) => (ADMIN.noclip = value),
    );
    slider(
      group,
      "Speed ×",
      () => ADMIN.speed,
      (value) => (ADMIN.speed = value),
      0.5,
      6,
      0.5,
      (value) => value + "×",
    );
    slider(
      group,
      "Exp ×",
      () => ADMIN.expMultiplier,
      (value) => (ADMIN.expMultiplier = value),
      1,
      50,
      1,
      (value) => value + "×",
    );
    slider(
      group,
      "Drop chance ×",
      () => ADMIN.dropMultiplier,
      (value) => (ADMIN.dropMultiplier = value),
      1,
      20,
      1,
      (value) => value + "×",
    );

    /* ---------- professions ---------- */
    group = section("Professions");
    const professionInputs = {};
    for (const [id, profession] of Object.entries(PROFESSIONS)) {
      professionInputs[id] = numberField(
        group,
        `${profession.emoji} ${profession.name}`,
        () => professionLevel(player, id),
        (value) => ctx.setProfessions({ [id]: value }),
        1,
        MAX_PROFESSION_LEVEL,
      );
    }
    const allProfessions = (level) =>
      ctx.setProfessions(Object.fromEntries(Object.keys(PROFESSIONS).map((id) => [id, level])));
    buttons(group, [
      [`All ${MAX_PROFESSION_LEVEL}`, () => allProfessions(MAX_PROFESSION_LEVEL)],
      ["All 25", () => allProfessions(25)],
      ["All 1", () => allProfessions(1), "danger"],
    ]);

    /* ---------- items: search, filter by kind and rarity, a preview, give ---------- */
    group = section("Items");
    const itemGroup = group;
    const ITEM_KINDS = [
      ["all", "All"],
      ["weapon", "Weapons"],
      ["armor", "Armour"],
      ["cloak", "Cloaks"],
      ["shield", "Shields"],
      ["jewel", "Jewels"],
      ["use", "Usable"],
      ["rune", "Runes"],
      ["material", "Materials"],
    ];
    const kindOfItem = (item) => {
      if (item.rune) return "rune";
      if (item.slot === "weapon" || item.slot === "cloak" || item.slot === "shield")
        return item.slot;
      if (item.slot === "ring" || item.slot === "necklace") return "jewel";
      if (item.slot) return "armor";
      return item.use ? "use" : "material";
    };
    /* one of a kind, for the preview */
    const KIND_NAMES = {
      weapon: "Weapon",
      armor: "Armour",
      cloak: "Cloak",
      shield: "Off-hand",
      jewel: "Jewel",
      use: "Usable",
      rune: "Rune",
      material: "Material",
    };
    /* the slots a preview can show the hero wearing */
    const VISIBLE_SLOTS = ["weapon", "body", "head", "cloak", "shield"];
    const itemFilter = { text: "", kind: "all", rarity: "" };
    let selectedItem = Object.keys(ITEMS)[0];

    const searchInput = element("input", { type: "text", placeholder: "Search items…" });
    row(group, "Find", searchInput);
    const raritySelect = element("select");
    raritySelect.appendChild(element("option", { value: "" }, "Any rarity"));
    for (const [grade, info] of Object.entries(RARITIES)) {
      raritySelect.appendChild(element("option", { value: grade }, info.name));
    }
    row(group, "Rarity", raritySelect);
    const chips = element("div", { class: "admin-chips" });
    for (const [kind, label] of ITEM_KINDS) {
      const chip = element("button", { class: "admin-chip", "data-kind": kind }, label);
      chips.appendChild(chip);
    }
    group.appendChild(chips);
    const grid = element("div", { class: "admin-item-grid" });
    group.appendChild(grid);
    const preview = element("div", { class: "admin-item-preview" });
    const heroCanvas = element("canvas", { class: "admin-item-hero", width: 72, height: 80 });
    const previewInfo = element("div", { class: "admin-item-info" });
    preview.append(heroCanvas, previewInfo);
    group.appendChild(preview);
    const countInput = element("input", { type: "number", min: 1, max: 99, value: 1 });
    const giveButton = element("button", { class: "admin-btn" }, "Give");
    const equipButton = element("button", { class: "admin-btn" }, "Give & equip");
    row(group, "", countInput, giveButton, equipButton);

    const matches = (id, item) =>
      (itemFilter.kind === "all" || kindOfItem(item) === itemFilter.kind) &&
      (!itemFilter.rarity || rarityOf(id) === itemFilter.rarity) &&
      (!itemFilter.text ||
        item.name.toLowerCase().includes(itemFilter.text) ||
        id.includes(itemFilter.text));

    function renderItemGrid() {
      const ids = Object.keys(ITEMS).filter((id) => matches(id, ITEMS[id]));
      grid.innerHTML = ids.length
        ? ids
            .map(
              (id) =>
                `<button class="admin-item ${UI.rarityClass(id)} ${id === selectedItem ? "selected" : ""}" data-item="${id}" title="${UI.escapeHtml(ITEMS[id].name)}">${icon(id, ITEMS[id].icon)}</button>`,
            )
            .join("")
        : '<p class="admin-mono">No item fits.</p>';
      for (const chip of chips.children) {
        chip.classList.toggle("on", chip.dataset.kind === itemFilter.kind);
      }
    }

    function renderItemPreview() {
      const item = ITEMS[selectedItem];
      const grade = rarityOf(selectedItem);
      const level = itemLevel(selectedItem);
      const kind = [grade ? RARITIES[grade].name : "", KIND_NAMES[kindOfItem(item)]]
        .filter(Boolean)
        .join(" · ");
      const stats = itemStatText(item);
      const unique = effectLines(selectedItem)
        .map((line) => "Unique: " + UI.escapeHtml(line))
        .join("<br>");
      previewInfo.innerHTML =
        `<div class="admin-item-head">${icon(selectedItem, item.icon)}<div><b class="rname ${UI.rarityClass(selectedItem)}">${UI.escapeHtml(item.name)}</b>` +
        `<small>${UI.escapeHtml(kind)}${level > 1 ? ` · level ${level}` : ""} · ${item.price || 0} zeny</small></div></div>` +
        (stats ? `<small class="item-stats">${stats}</small>` : "") +
        (unique ? `<p class="item-unique">${unique}</p>` : "") +
        setText(player, selectedItem) +
        `<p class="admin-item-desc">${UI.escapeHtml(item.description || "")}</p>` +
        `<small class="admin-mono">${selectedItem}</small>`;
      const isVisible = VISIBLE_SLOTS.includes(item.slot);
      heroCanvas.hidden = !isVisible;
      equipButton.hidden = !item.slot;
    }

    /* the hero wearing the chosen piece, turning slowly, while the section is open */
    const directions = ["down", "left", "up", "right"];
    function drawItemHero(time) {
      if (!isOpenNow || !itemGroup.open || heroCanvas.hidden) {
        return;
      }
      const item = ITEMS[selectedItem];
      const equipment = { ...player.equipment, [item.slot]: selectedItem };
      const context = heroCanvas.getContext("2d");
      const seconds = time / 1000;
      drawHero(context, heroLayers(equipment, player.hair), seconds, {
        direction: directions[Math.floor(seconds / 1.6) % directions.length],
      });
    }
    (function animate(time) {
      drawItemHero(time || 0);
      requestAnimationFrame(animate);
    })();

    searchInput.oninput = () => {
      itemFilter.text = searchInput.value.trim().toLowerCase();
      renderItemGrid();
    };
    raritySelect.onchange = () => {
      itemFilter.rarity = raritySelect.value;
      renderItemGrid();
    };
    chips.onclick = (event) => {
      const chip = event.target.closest("[data-kind]");
      if (chip) {
        itemFilter.kind = chip.dataset.kind;
        renderItemGrid();
      }
    };
    grid.onclick = (event) => {
      const button = event.target.closest("[data-item]");
      if (button) {
        selectedItem = button.dataset.item;
        renderItemGrid();
        renderItemPreview();
      }
    };
    giveButton.onclick = async () => {
      await ctx.giveItem(selectedItem, +countInput.value || 1);
      ctx.render();
    };
    equipButton.onclick = async () => {
      if (await ctx.giveItem(selectedItem, 1)) {
        equip(selectedItem);
      }
      ctx.render();
    };
    renderItemGrid();
    renderItemPreview();
    buttons(group, [
      [
        "Give one of everything",
        () => {
          for (const id of Object.keys(ITEMS)) {
            ctx.addToBag(id, 1);
          }
          ctx.render();
        },
      ],
      [
        "Empty bag",
        () => {
          player.bag.length = 0;
          ctx.render();
        },
        "danger",
      ],
    ]);

    /* ---------- story: begin the main story at any quest ---------- */
    group = section("Story");
    const questSelect = element("select");
    for (const saga of SAGAS) {
      for (const chapter of chaptersOf(saga)) {
        const chapterGroup = element("optgroup", {
          label: `${saga.title} · ${chapter}. ${CHAPTERS[chapter]}`,
        });
        for (const id of MAIN_QUESTS.filter((questId) => QUESTS[questId].chapter === chapter)) {
          chapterGroup.appendChild(
            element("option", { value: id }, `${QUESTS[id].title} (lvl ${QUESTS[id].level})`),
          );
        }
        questSelect.appendChild(chapterGroup);
      }
    }
    const storyButton = element("button", { class: "admin-btn" }, "Begin here");
    storyButton.onclick = () => ctx.startStory(questSelect.value);
    row(group, "", questSelect, storyButton);
    group.appendChild(
      element(
        "p",
        { class: "admin-mono" },
        "Every main quest before it counts as done (with its runes); it and the rest start fresh.",
      ),
    );

    /* ---------- teleport ---------- */
    group = section("Teleport");
    const teleportX = element("input", { type: "number", value: 0 });
    const teleportZ = element("input", { type: "number", value: 0 });
    const goButton = element("button", { class: "admin-btn" }, "Go");
    goButton.onclick = () => ctx.teleport(+teleportX.value, +teleportZ.value);
    row(group, "x / z", teleportX, teleportZ, goButton);
    buttons(group, [
      ["Well", () => ctx.teleport(0, 4)],
      ["North gate", () => ctx.teleport(0, -VILLAGE_HALF_SIZE - 3)],
      ["South gate", () => ctx.teleport(0, VILLAGE_HALF_SIZE + 3)],
      ["Rabbits", () => ctx.teleport(12, -30)],
      ["Foxes", () => ctx.teleport(-40, 10)],
      ["Aurelia gate", () => ctx.teleport(-93, 0)],
      ["Aurelia square", () => ctx.teleport(-130, 0)],
      ["Castle", () => ctx.teleport(-150, 0)],
      ["Bandit camp", () => ctx.teleport(-110, -45)],
      ["Boars", () => ctx.teleport(50, 45)],
      ["World edge", () => ctx.teleport(FIELD_SIZE - 3, 0)],
      ["Crypt stairs", () => ctx.teleport(CRYPT_STAIRS[0], CRYPT_STAIRS[1] + 2.4)],
      ["Crypt", () => ctx.teleport(...CRYPT_ENTRY)],
      ["Sanctum", () => ctx.teleport(...cryptPoint(-9, -12))],
      ["Fort Harrow", () => ctx.teleport(NORTHROAD.fort[0], NORTHROAD.fort[1] + 6)],
      ["Halfway Inn", () => ctx.teleport(NORTHROAD.inn[0] + 6, NORTHROAD.inn[1])],
      ["Northwatch", () => ctx.teleport(-138, -212)],
      ["Bridge", () => ctx.teleport(BRIDGE.x, GORGE.south + 5)],
      ["Saltmere", () => ctx.teleport(SALTMERE.gate[0], SALTMERE.gate[1] - 4)],
      ["Quay", () => ctx.teleport(SALTMERE.square[0], SALTMERE.z0 + 3)],
      ["Cinder Cove", () => ctx.teleport(...CAMP_WAKE)],
      ["Kharos foot", () => ctx.teleport(MOUNT_KHAROS.x, MOUNT_KHAROS.z + MOUNT_KHAROS.radius + 4)],
      [
        "Kharos gate",
        () => ctx.teleport(EMBER_LANDS.gate.center[0], EMBER_LANDS.gate.center[1] - 4),
      ],
      ["Forge", () => ctx.teleport(...FORGE_ENTRY)],
      ["Heart of Kharos", () => ctx.teleport(...forgePoint(0, -2))],
      ["Tidecrown", () => ctx.teleport(...TIDE_WAKE)],
      ["Crownmere", () => ctx.teleport(CAUSEWAY.x, CAUSEWAY.south - 1)],
      ["Rimeholt", () => ctx.teleport(...RIME_WAKE)],
      ["East shore", () => ctx.teleport(-50, -1560)],
      ["West shore", () => ctx.teleport(-240, -1555)],
      ["Snowed pass", () => ctx.teleport(...PASS_FOOT)],
      ["Torvald's shelter", () => ctx.teleport(...SHELTER_WAKE)],
      [
        "Unbound camp",
        () => ctx.teleport(UNBOUND_CAMP.x, UNBOUND_CAMP.z + UNBOUND_CAMP.radius + 4),
      ],
      [
        "Troll hollow",
        () => ctx.teleport(TROLL_HOLLOW.x + TROLL_HOLLOW.radius + 5, TROLL_HOLLOW.z),
      ],
    ]);

    /* ---------- monsters ---------- */
    group = section("Monsters");
    const hostNote = element("p", { class: "admin-mono" });
    group.appendChild(hostNote);
    const monsterSelect = element("select");
    for (const [id, monster] of Object.entries(MONSTERS)) {
      monsterSelect.appendChild(element("option", { value: id }, monster.name));
    }
    const spawnButton = element("button", { class: "admin-btn" }, "Spawn here");
    spawnButton.onclick = () => {
      if (!ctx.spawnMonster(monsterSelect.value, player.x + 2, player.z)) {
        UI.systemMessage("Only the world host can spawn monsters.");
      }
      refresh();
    };
    row(group, "", monsterSelect, spawnButton);
    toggleSwitch(
      group,
      "Freeze monsters (host)",
      () => ADMIN.frozen,
      (value) => (ADMIN.frozen = value),
    );
    buttons(group, [
      ["Kill all", () => ctx.killAll(), "danger"],
      ["Respawn dead (host)", () => ctx.respawnAll()],
    ]);
    const monsterTable = element("table", { class: "admin-table" });
    group.appendChild(monsterTable);

    /* ---------- world & camera ---------- */
    group = section("World & camera");
    toggleSwitch(
      group,
      "Storm on the Northroad",
      () => stormStrength() > 0.5,
      (isOn) => setStormOverride(isOn ? 1 : null),
    );
    toggleSwitch(
      group,
      "Whiteout over the White Waste",
      () => whiteoutStrength() > 0.5,
      (isOn) => setWhiteoutOverride(isOn ? 1 : null),
    );
    slider(
      group,
      "Camera tilt",
      () => Math.round(THREE.MathUtils.radToDeg(cameraState.tilt)),
      (value) => (cameraState.tilt = THREE.MathUtils.degToRad(value)),
      25,
      85,
      1,
      (value) => value + "°",
    );
    slider(
      group,
      "Zoom (px per unit)",
      () => cameraState.px,
      (value) => ctx.setZoom(value),
      4,
      96,
      4,
    );
    slider(
      group,
      "Time of day (24 = real clock)",
      () => ctx.timeOfDay(),
      (value) => ctx.setTimeOverride(value >= 24 ? null : value),
      0,
      24,
      0.5,
      (value) => (value >= 24 ? "real" : value + "h"),
    );
    toggleSwitch(
      group,
      "Fog",
      () => !!scene.fog,
      (value) => {
        scene.fog = value ? new THREE.Fog(0x87c9ee, 55, 95) : null;
      },
    );
    slider(
      group,
      "Pixel size (reloads)",
      () => parseFloat(readStorage(PIXEL_KEY, null)) || 2,
      (value) => {
        writeStorage(PIXEL_KEY, String(value));
        /* Reload once the slider has been still for a moment. */
        clearTimeout(pixelReloadTimer);
        pixelReloadTimer = setTimeout(() => location.reload(), 600);
      },
      1,
      4,
      0.5,
      (value) => value + "px",
    );
    toggleSwitch(
      group,
      "Smooth graphics (reloads)",
      () => SMOOTH,
      (value) => {
        writeStorage(SMOOTH_KEY, value ? "1" : "0");
        location.reload();
      },
    );
    toggleSwitch(
      group,
      "Show collision & zones",
      () => !!debugOverlay,
      (value) => {
        if (value) {
          showDebugOverlay();
        } else {
          hideDebugOverlay();
        }
      },
    );
    const renderInfo = element("p", { class: "admin-mono" });
    group.appendChild(renderInfo);

    /* ---------- network ---------- */
    group = section("Network");
    const networkInfo = element("p", { class: "admin-mono" });
    group.appendChild(networkInfo);
    const peerTable = element("table", { class: "admin-table" });
    group.appendChild(peerTable);

    /* ---------- save ---------- */
    group = section("Save");
    const saveText = element("textarea", { spellcheck: "false" });
    group.appendChild(saveText);
    /* The account: the token the heroes on the server belong to; enter it on another device to continue there. */
    const tokenInput = element("input", {
      type: "text",
      value: readStorage(TOKEN_KEY, "") || "",
      spellcheck: "false",
      style: "width:100%;font-family:monospace;font-size:11px",
    });
    group.appendChild(
      element(
        "p",
        { class: "hint" },
        "Account token (keep it secret; enter it on another device to play with the same heroes):",
      ),
    );
    group.appendChild(tokenInput);
    buttons(group, [
      [
        "Use this token",
        () => {
          const token = tokenInput.value.trim();
          if (/^[a-z0-9]{20,48}$/.test(token)) {
            writeStorage(TOKEN_KEY, token);
            location.reload();
          }
        },
      ],
    ]);
    buttons(group, [
      [
        "Show save",
        () => {
          ctx.save();
          saveText.value = ctx.exportSave() || "";
        },
      ],
      [
        "Copy",
        () => {
          ctx.save();
          if (navigator.clipboard) {
            navigator.clipboard.writeText(ctx.exportSave() || "");
          }
        },
      ],
      [
        "Load from text",
        () => {
          try {
            JSON.parse(saveText.value);
            ctx.importSave(saveText.value);
          } catch (e) {
            UI.systemMessage("That is not valid save JSON.");
          }
        },
        "danger",
      ],
      [
        "Reset save",
        () => {
          if (confirm("Delete this character and start over?")) {
            ctx.resetSave();
          }
        },
        "danger",
      ],
    ]);
    buttons(group, [
      [
        hudButton.hidden ? "Show 🛠️ button in HUD" : "Hide 🛠️ button",
        () => {
          hudButton.hidden = !hudButton.hidden;
          writeStorage(ADMIN_KEY, hudButton.hidden ? "0" : "1");
        },
      ],
    ]);

    refreshValues = () => {
      for (const [id, input] of Object.entries(professionInputs)) {
        if (document.activeElement !== input) {
          input.value = professionLevel(player, id);
        }
      }
      levelInput.value = player.level;
      jobLevelInput.value = player.jobLevel;
      hostNote.textContent = ctx.isHost()
        ? "You are the world host: spawn, freeze and respawn work."
        : "Another player hosts the world: kill works, spawn/freeze/respawn do not.";

      const monsterRows = [];
      for (const monster of monsters.values()) {
        const hpText = monster.isDead ? "dead" : Math.round(monster.hp) + "/" + monster.hpMax;
        monsterRows.push(
          `<tr><td>${monster.id}</td><td class="r">${hpText}</td><td class="r">${monster.x.toFixed(0)},${monster.z.toFixed(0)}</td><td><button class="admin-btn" data-goto="${monster.id}">go</button> <button class="admin-btn danger" data-kill="${monster.id}">kill</button></td></tr>`,
        );
      }
      monsterTable.innerHTML = monsterRows.join("") || "<tr><td>no monsters yet</td></tr>";

      const stats = ctx.renderer.info.render;
      renderInfo.textContent = `${fps} fps · ${stats.calls} draw calls · ${stats.triangles} triangles · player ${player.x.toFixed(1)}, ${player.z.toFixed(1)} · ${ctx.obstacles.length} obstacles`;

      const network = ctx.network();
      if (network) {
        const host = network.hostId() === network.me ? "me" : network.hostId();
        const status = network.isConnected() ? "connected" : "offline";
        networkInfo.textContent = `id ${network.me} · ${status} · broker ${network.transport() || "-"} · host ${host}`;
      } else {
        networkInfo.textContent = "no network yet";
      }

      peerTable.innerHTML =
        [...peers.entries()]
          .map(
            ([id, peer]) =>
              `<tr><td>${peer.presence.name}</td><td class="r">Lv ${peer.presence.level}</td><td class="r">${peer.x.toFixed(0)},${peer.z.toFixed(0)}</td><td><button class="admin-btn" data-target="${id}">go</button></td></tr>`,
          )
          .join("") || "<tr><td>nobody else online</td></tr>";
    };
  }

  content.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-goto],button[data-kill],button[data-target]");
    if (!button) {
      return;
    }
    if (button.dataset.goto) {
      const monster = monsters.get(button.dataset.goto);
      if (monster) {
        ctx.teleport(monster.x + 1.5, monster.z);
      }
    } else if (button.dataset.kill) {
      const monster = monsters.get(button.dataset.kill);
      if (monster) {
        ctx.killMonster(monster);
      }
    } else if (button.dataset.target) {
      const peer = peers.get(button.dataset.target);
      if (peer) {
        ctx.teleport(peer.x + 1.5, peer.z);
      }
    }
    refresh();
  });
  $("#admin-close").onclick = () => close();

  /* ---------- debug overlay: collision circles and monster zones ---------- */

  const squareOutline = (half) => {
    const shape = new THREE.Shape();
    shape.moveTo(-half, -half);
    shape.lineTo(half, -half);
    shape.lineTo(half, half);
    shape.lineTo(-half, half);
    shape.lineTo(-half, -half);
    return new THREE.BufferGeometry().setFromPoints(shape.getPoints());
  };

  function showDebugOverlay() {
    hideDebugOverlay();
    debugOverlay = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4d4d,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const obstacle of ctx.obstacles) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(obstacle.r * 0.85, obstacle.r, 24),
        ringMaterial,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(obstacle.x, 0.05, obstacle.z);
      debugOverlay.add(ring);
    }
    for (const [id, spec] of Object.entries(MONSTERS)) {
      for (const radius of spec.zone || []) {
        const line = new THREE.Line(
          squareOutline(radius),
          new THREE.LineBasicMaterial({ color: ZONE_COLORS[id] }),
        );
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.06;
        debugOverlay.add(line);
      }
    }
    const villageLine = new THREE.Line(
      squareOutline(VILLAGE_HALF_SIZE),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    villageLine.rotation.x = -Math.PI / 2;
    villageLine.position.y = 0.06;
    debugOverlay.add(villageLine);
    scene.add(debugOverlay);
  }

  function hideDebugOverlay() {
    if (debugOverlay) {
      scene.remove(debugOverlay);
      debugOverlay.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
      });
      debugOverlay = null;
    }
  }

  function refresh() {
    if (isOpenNow && refreshValues) {
      refreshValues();
    }
  }

  function show() {
    isOpenNow = true;
    panel.hidden = false;
    if (!refreshValues) {
      build();
    }
    refresh();
  }

  function close() {
    isOpenNow = false;
    panel.hidden = true;
  }

  let refreshTimer = 0;

  return {
    show,
    close,
    toggle() {
      if (isOpenNow) {
        close();
      } else {
        show();
      }
    },
    isOpen: () => isOpenNow,
    tick(dt) {
      frames++;
      fpsTimer += dt;
      if (fpsTimer >= 1) {
        fps = Math.round(frames / fpsTimer);
        frames = 0;
        fpsTimer = 0;
      }
      if (!isOpenNow) {
        return;
      }
      refreshTimer += dt;
      if (refreshTimer >= 1) {
        refreshTimer = 0;
        refresh();
      }
    },
  };
}
