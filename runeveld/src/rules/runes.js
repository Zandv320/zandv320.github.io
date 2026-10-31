/* Eldoria – game rules: the rune powers of Saga II, "The Shattered Runes". Each of the seven seals that the hero
   sets right binds its rune to them: a power for every class, on a slot of its own on the hotbar (Q). A rune comes
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
  },
};

export const RUNE_IDS = Object.keys(RUNES);

/** The runes of a hero as stored: known ids whose seal quest is done, each once, in the order of RUNES. */
export function sanitizeRunes(list, quests = {}) {
  if (!Array.isArray(list)) {
    return [];
  }
  return RUNE_IDS.filter((id) => list.includes(id) && quests[RUNES[id].quest]?.state === "done");
}

/** The rune whose power is on the hotbar: the newest one bound, or null. */
export const activeRune = (runes) => (runes && runes.length ? runes[runes.length - 1] : null);
