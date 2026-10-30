/* Eldoria – the settings window (the gear in the menu, or O): sound, vibration, names above heads and graphics.
   Everything is stored in this browser (localStorage). The graphics settings are read at startup, so they apply
   after a reload; the window offers one. */
import { isSoundOn, setSoundOn, getVolume, setVolume, sfx } from "./audio.js";
import { IS_TOUCH, isVibrationOn, setVibrationOn, buzz } from "./feel.js";
import { SMOOTH } from "./sprites.js";

const NAMES_KEY = "eldoria.names";
const SMOOTH_KEY = "eldoria.smooth";
const PERF_KEY = "eldoria.perf";

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

/* names above heads can be hidden; quest marks, health bars and speech stay */
const applyNames = () => document.body.classList.toggle("hide-names", read(NAMES_KEY, "1") === "0");

/** Sets up the settings window; returns {show, close, toggle, isOpen}. */
export function createSettings() {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#settings");
  /* the graphics as they were at startup, to tell whether a reload is needed */
  const startup = { smooth: SMOOTH, perf: read(PERF_KEY, "0") === "1" };
  let isOpenNow = false;
  applyNames();

  /* the rows: {id, label, description, get(), set(value)}, optionally `slider`, `touchOnly` and `reload`;
     {section, note} starts a group */
  const rows = [
    { section: "Sound" },
    {
      id: "sound",
      label: "Sound effects",
      get: isSoundOn,
      set: (value) => {
        setSoundOn(value);
        sfx.click();
      },
    },
    {
      id: "volume",
      label: "Volume",
      slider: true,
      get: getVolume,
      set: (value) => setVolume(value),
    },
    { section: "Play" },
    {
      id: "vibration",
      label: "Vibration",
      description: "A short buzz when you are hit, land a critical hit or level up.",
      touchOnly: true,
      get: isVibrationOn,
      set: (value) => {
        setVibrationOn(value);
        buzz("crit");
      },
    },
    {
      id: "names",
      label: "Names above heads",
      description: "Quest marks, health bars and speech always show.",
      get: () => read(NAMES_KEY, "1") !== "0",
      set: (value) => {
        write(NAMES_KEY, value ? "1" : "0");
        applyNames();
      },
    },
    { section: "Graphics", note: "Applies after a reload" },
    {
      id: "smooth",
      label: "Smooth sprites",
      description: "Softer, upscaled sprites. Uses more memory; off on phones by default.",
      reload: true,
      get: () => (read(SMOOTH_KEY, null) === null ? SMOOTH : read(SMOOTH_KEY, "0") === "1"),
      set: (value) => write(SMOOTH_KEY, value ? "1" : "0"),
    },
    {
      id: "perf",
      label: "Performance meter",
      description: "Frames per second, frame times and draw calls at the top of the screen.",
      reload: true,
      get: () => read(PERF_KEY, "0") === "1",
      set: (value) => write(PERF_KEY, value ? "1" : "0"),
    },
  ].filter((row) => !row.touchOnly || IS_TOUCH);

  const needsReload = () => rows.some((row) => row.reload && row.get() !== startup[row.id]);

  function render() {
    $("#settings-body").innerHTML =
      rows
        .map((row) => {
          if (row.section) {
            return `<h4 class="settings-section">${row.section}${row.note ? `<small>${row.note}</small>` : ""}</h4>`;
          }
          const control = row.slider
            ? `<input type="range" min="0" max="100" step="5" value="${Math.round(row.get() * 100)}" data-setting="${row.id}" aria-label="${row.label}">`
            : `<button class="switch" role="switch" aria-checked="${row.get()}" data-setting="${row.id}" aria-label="${row.label}"><i></i></button>`;
          return `<div class="settings-row"><div><b>${row.label}</b>${row.description ? `<small>${row.description}</small>` : ""}</div>${control}</div>`;
        })
        .join("") +
      (needsReload()
        ? '<button class="btn main settings-reload" id="settings-reload">Reload to apply</button>'
        : "");
  }

  panel.addEventListener("click", (event) => {
    if (event.target.closest("#settings-reload")) {
      location.reload();
      return;
    }
    const control = event.target.closest("button.switch[data-setting]");
    if (!control) {
      return;
    }
    const row = rows.find((candidate) => candidate.id === control.dataset.setting);
    row.set(!row.get());
    render();
  });
  panel.addEventListener("input", (event) => {
    const row = rows.find((candidate) => candidate.id === event.target.dataset.setting);
    if (row && row.slider) {
      row.set(event.target.value / 100);
    }
  });
  /* a click when the slider is let go, so the new volume can be heard */
  panel.addEventListener("change", (event) => {
    if (event.target.dataset.setting === "volume") {
      sfx.click();
    }
  });
  $("#settings-close").onclick = () => close();

  function show() {
    isOpenNow = true;
    panel.hidden = false;
    render();
  }

  function close() {
    isOpenNow = false;
    panel.hidden = true;
  }

  return {
    show,
    close,
    toggle() {
      if (isOpenNow) close();
      else show();
    },
    isOpen: () => isOpenNow,
  };
}
