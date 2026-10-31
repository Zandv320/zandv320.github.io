/* Eldoria – admin panel (Ctrl+Shift+A, or ?admin in the URL).
   Everything here runs in the player's own browser and is therefore NOT security: it is a handy dashboard for the
   developer. Once the world runs on a server, these become server commands. */
import { ITEMS, MONSTERS, MAX_LEVEL } from "./data.js";
import { VILLAGE_HALF_SIZE, FIELD_SIZE } from "./world.js";
import * as THREE from "three";
import * as UI from "./ui.js";
import { SMOOTH } from "./sprites.js";
import { CRYPT_ENTRY, CRYPT_STAIRS, cryptPoint } from "./rules/crypt.js";

const ADMIN_KEY = "eldoria.admin";
const TOKEN_KEY = "eldoria.token";
const PIXEL_KEY = "eldoria.pixel";
const SMOOTH_KEY = "eldoria.smooth";

/* Colours of the monster zones in the debug overlay. */
const ZONE_COLORS = { rabbit: 0x9fe3b0, fox: 0xffb84d, boar: 0xff6b6b };

/**
 * @param {object} ctx {player, monsters, peers, cameraState, camera, scene, renderer, ADMIN, setZoom, network(),
 *   isHost(), addToBag, setLevel, setJobLevel, respec, teleport, spawnMonster, killMonster, killAll, respawnAll,
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

    /* ---------- items ---------- */
    group = section("Items");
    const itemSelect = element("select");
    for (const [id, item] of Object.entries(ITEMS)) {
      itemSelect.appendChild(element("option", { value: id }, `${item.icon} ${item.name}`));
    }
    const countInput = element("input", { type: "number", min: 1, max: 99, value: 1 });
    const giveButton = element("button", { class: "admin-btn" }, "Give");
    giveButton.onclick = () => {
      ctx.addToBag(itemSelect.value, +countInput.value || 1);
      ctx.render();
    };
    row(group, "", itemSelect, countInput, giveButton);
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
