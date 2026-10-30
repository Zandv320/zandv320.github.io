/* Eldoria – the conversation window with an npc: portrait, text and choices (quests, shop, farewell). */
import { icon } from "./icons.js";

/**
 * @param {object} questLog the quest log module (quest-log.js)
 * @param {object} deps {openShop(npc), advancementOptions(npcName), advanceClass(classId), classInfo(classId),
 *   onClose()}
 */
export function createDialogue(questLog, deps) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#dialogue");
  const portraitCanvas = $("#dialogue-portrait");
  const portraitContext = portraitCanvas.getContext("2d");
  let isOpenNow = false;
  let npc = null;

  function drawPortrait(sprite) {
    portraitContext.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);
    if (!sprite) {
      return;
    }
    const sheet = sprite.sheet;
    const idle = sheet.anims.idle;
    const row = idle.row + ((sheet.directions || { down: 0 }).down || 0);
    /* Cut out only the figure itself (feet and height come from the sheet), with some room around it, and scale it
       up to fit. */
    const sourceHeight = sheet.height + sheet.height * 0.3;
    const sourceWidth = sourceHeight * 0.75;
    const sourceX = sheet.frameWidth / 2 - sourceWidth / 2;
    const sourceY = sheet.frameHeight - sheet.feet - sheet.height - sheet.height * 0.15;
    const scale = Math.min(
      portraitCanvas.width / sourceWidth,
      portraitCanvas.height / sourceHeight,
    );
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    portraitContext.imageSmoothingEnabled = false;
    for (const layer of sprite.layers) {
      const image = (layer.source || layer.texture)?.image;
      if (!image) {
        continue;
      }
      portraitContext.drawImage(
        image,
        sourceX,
        row * sheet.frameHeight + sourceY,
        sourceWidth,
        sourceHeight,
        (portraitCanvas.width - width) / 2,
        (portraitCanvas.height - height) / 2,
        width,
        height,
      );
    }
  }

  /* Shows a text with a list of choices: [labelHtml, onClick, extraClass]. */
  function show(text, choices) {
    $("#dialogue-text").textContent = text;
    const choiceList = $("#dialogue-choices");
    choiceList.innerHTML = "";
    for (const [label, onClick, extraClass] of choices) {
      const button = document.createElement("button");
      button.className = "btn" + (extraClass ? " " + extraClass : "");
      button.innerHTML = label;
      button.onclick = onClick;
      choiceList.appendChild(button);
    }
  }

  /* The class advancement choice: one option per class this npc can grant. */
  function advancementChoices(classIds) {
    const choices = classIds.map((classId) => {
      const heroClass = deps.classInfo(classId);
      const label = `${icon("class_" + classId, heroClass.icon, "small")} ${heroClass.name}`;
      const confirm = () =>
        show(`${heroClass.name}: ${heroClass.description} Is this your path?`, [
          [
            `Become a ${heroClass.name}`,
            () => {
              if (deps.advanceClass(classId)) {
                close();
              }
            },
          ],
          ["Not yet", mainMenu, "alt"],
        ]);
      return [label, confirm];
    });
    return choices.concat([["Not yet", mainMenu, "alt"]]);
  }

  /* The main menu of an npc. */
  function mainMenu() {
    const current = npc;
    const choices = [];
    for (const { id, quest, state } of questLog.fromNpc(current.name)) {
      if (state === "available") {
        choices.push([
          "! " + quest.title,
          () =>
            show(quest.intro, [
              [
                "Accept",
                () => {
                  questLog.accept(id);
                  mainMenu();
                },
              ],
              ["Not now", mainMenu, "alt"],
            ]),
        ]);
      } else if (state === "ready") {
        choices.push([
          "? " + quest.title,
          () => {
            show(quest.completeText, [["Thank you", mainMenu]]);
            questLog.turnIn(id);
          },
        ]);
      } else {
        choices.push([
          "? " + quest.title,
          () =>
            show(quest.progressText + " (" + questLog.progress(id) + ")", [
              ["I am on it", mainMenu, "alt"],
            ]),
          "alt",
        ]);
      }
    }
    const advancement = deps.advancementOptions && deps.advancementOptions(current.name);
    if (advancement) {
      choices.push([
        "I am ready to choose my path",
        () =>
          show(
            "You have learned everything your first calling could teach you. Choose wisely; there is no way back.",
            advancementChoices(advancement),
          ),
      ]);
    }
    if (current.shop) {
      choices.push([
        "Let me see your wares",
        () => {
          close();
          deps.openShop(current);
        },
        "alt",
      ]);
    }
    choices.push(["Goodbye", close, "alt"]);
    show(current.greeting, choices);
  }

  /**
   * Opens the conversation.
   * @param {{name: string, greeting: string, sprite: object, shop?: string, x: number, z: number}} target
   */
  function open(target) {
    npc = target;
    isOpenNow = true;
    panel.hidden = false;
    document.body.classList.add("dialogue-open");
    $("#dialogue-name").textContent = target.name;
    drawPortrait(target.sprite);
    questLog.onVisit(target.name);
    mainMenu();
  }

  function close() {
    if (!isOpenNow) {
      return;
    }
    isOpenNow = false;
    panel.hidden = true;
    document.body.classList.remove("dialogue-open");
    npc = null;
    if (deps.onClose) {
      deps.onClose();
    }
  }

  panel.addEventListener("pointerdown", (event) => event.stopPropagation());

  return {
    open,
    close,
    isOpen: () => isOpenNow,
    refresh: () => {
      if (isOpenNow) {
        mainMenu();
      }
    },
  };
}
