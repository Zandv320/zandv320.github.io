/* Eldoria – game rules: the rune powers of the seven seals (from Saga II, "The Shattered Runes"). Each seal that
   the hero sets right binds its rune to them: a power for every class, on a slot of its own on the hotbar (Q); the
   rune codex chooses which one is there. A rune comes
   only with the quest that restores its seal (`quest`), so a record from outside cannot just claim one.
   Pure data and functions, shared by client and server. */

export const RUNES = {
  moon: {
    name: "Moon Rune",
    power: "Moonward",
    icon: "🌙",
    quest: "selwyn_altar",
    description:
      "A shell of moonlight takes the blows for you: it absorbs damage worth a quarter of your HP, for 10 seconds.",
    cooldown: 60,
    duration: 10,
    /* the shell holds this share of the hero's HP */
    absorb: 0.25,
    /* what the rune gives while it is bound, worn like an item (rules/stats.js) */
    bonus: { hp: 150, def: 4, bonus: { vit: 2, int: 2 } },
    color: "#c8b0ff",
  },
  ember: {
    name: "Ember Rune",
    power: "Emberbreath",
    icon: "🔥",
    quest: "orven_seal",
    description:
      "You breathe the First Flame: a cone of fire before you burns every monster in it for eight times your ATK or MATK, whichever is higher.",
    cooldown: 40,
    /* the cone: this long, this wide (radians, all of it), the damage as a multiple of the hero's best attack */
    range: 7,
    angle: 1.4,
    mult: 8,
    bonus: { atkPct: 0.05, matkPct: 0.05, bonus: { str: 2, dex: 2 } },
    color: "#ff9a40",
  },
  tide: {
    name: "Tide Rune",
    power: "Undertow",
    icon: "🌊",
    quest: "ondine_seal",
    description:
      "The lake pulls with you: a whirl of water drags every monster round you closer, holds them for 2.5 seconds and hits them for five times your ATK or MATK; you heal 4% of your HP for each one caught.",
    cooldown: 45,
    /* the whirl: how far it reaches, how long it holds, the damage as a multiple of the hero's best attack, and the
       healing per monster caught (a share of max HP, at most `healMax` in all) */
    radius: 6.5,
    hold: 2.5,
    mult: 5,
    heal: 0.04,
    healMax: 0.2,
    bonus: { hp: 120, sp: 60, bonus: { vit: 2, int: 1, dex: 1 } },
    color: "#7fe0d4",
  },
  frost: {
    name: "Frost Rune",
    power: "Hoarfrost",
    icon: "❄️",
    quest: "ulf_maelis",
    description:
      "A ring of ice bursts out round you: every monster in it is frozen solid for 3 seconds and hit for six times your ATK or MATK.",
    cooldown: 45,
    /* the ring: how far it reaches, how long it holds, the damage as a multiple of the hero's best attack */
    radius: 6,
    hold: 3,
    mult: 6,
    bonus: { hp: 120, def: 6, bonus: { vit: 2, dex: 1 } },
    color: "#9fd8ff",
  },
};

/** How many runes there are in all: one for each of the seven seals, most of them not yet found. */
export const RUNE_SLOTS = 7;

/** The bonuses of a rune in words, for the rune overview. */
export function runeBonusLines(id) {
  const bonus = RUNES[id]?.bonus || {};
  const lines = [];
  for (const [key, value] of Object.entries(bonus.bonus || {})) {
    lines.push(`+${value} ${key.toUpperCase()}`);
  }
  for (const [key, label] of [
    ["hp", "Max HP"],
    ["sp", "Max SP"],
    ["atk", "ATK"],
    ["matk", "MATK"],
    ["def", "DEF"],
  ]) {
    if (bonus[key]) {
      lines.push(`+${bonus[key]} ${label}`);
    }
  }
  for (const [key, label] of [
    ["atkPct", "ATK"],
    ["matkPct", "MATK"],
  ]) {
    if (bonus[key]) {
      lines.push(`+${Math.round(bonus[key] * 100)}% ${label}`);
    }
  }
  return lines;
}

/** What a hero's bound runes give, as items for deriveStats. */
export const runeItems = (runes) =>
  (Array.isArray(runes) ? runes : []).filter((id) => RUNES[id]?.bonus).map((id) => RUNES[id].bonus);

export const RUNE_IDS = Object.keys(RUNES);

/** The runes of a hero as stored: known ids whose seal quest is done, each once, in the order of RUNES. */
export function sanitizeRunes(list, quests = {}) {
  if (!Array.isArray(list)) {
    return [];
  }
  return RUNE_IDS.filter((id) => list.includes(id) && quests[RUNES[id].quest]?.state === "done");
}

/** The rune whose power is on the hotbar (Q): the one the hero chose in the rune codex, else the newest one bound,
    or null. */
export const activeRune = (runes, chosen = null) =>
  runes && runes.includes(chosen) ? chosen : runes && runes.length ? runes[runes.length - 1] : null;
