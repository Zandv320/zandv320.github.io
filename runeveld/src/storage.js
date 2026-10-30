/* Eldoria – client storage: the list of heroes in localStorage, and the one-time migration from the old
   Runeveld keys. main.js imports this module first, so the migration runs before other modules (sprites.js,
   audio.js, network.js) read their settings while they load. */
import { migrateHero } from "./rules/legacy.js";

const HEROES_KEY = "eldoria.heroes";
const LEGACY_HEROES_KEY = "runeveld.chars.v1";
/* the very first save format: a single hero instead of a list */
const LEGACY_SINGLE_SAVE_KEY = "runeveld.save.v1";
/* old key → new key for the plain settings, copied as they are */
const LEGACY_SETTING_KEYS = {
  "runeveld.token": "eldoria.token",
  "runeveld.account": "eldoria.account",
  "runeveld.glad": "eldoria.smooth",
  "runeveld.pixel": "eldoria.pixel",
  "runeveld.geluid": "eldoria.sound",
  "runeveld.admin": "eldoria.admin",
  "runeveld.server": "eldoria.server",
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

/* The heroes in the old format ({lijst, laatst}, Dutch records), or the single very old save. */
function readLegacyHeroList() {
  const list = readJson(LEGACY_HEROES_KEY);
  if (list && Array.isArray(list.lijst)) {
    return { heroes: list.lijst.filter((hero) => hero && hero.naam), last: list.laatst | 0 };
  }
  const single = readJson(LEGACY_SINGLE_SAVE_KEY);
  if (single && single.naam) {
    return { heroes: [single], last: 0 };
  }
  return null;
}

/**
 * One-time migration from the old runeveld.* keys: the heroes are converted to English records and written to
 * eldoria.heroes, the settings are copied to their new keys, and the old keys are removed. Settings are copied
 * even without old heroes, so an account token is never lost.
 */
function migrateLegacyStorage() {
  try {
    if (localStorage.getItem(HEROES_KEY) === null) {
      const legacy = readLegacyHeroList();
      if (legacy) {
        const heroes = legacy.heroes.map(migrateHero).filter((hero) => hero && hero.name);
        localStorage.setItem(HEROES_KEY, JSON.stringify({ heroes, last: legacy.last }));
      }
    }
    for (const [oldKey, newKey] of Object.entries(LEGACY_SETTING_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
    }
    const oldKeys = [
      LEGACY_HEROES_KEY,
      LEGACY_SINGLE_SAVE_KEY,
      ...Object.keys(LEGACY_SETTING_KEYS),
    ];
    for (const key of oldKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Migrating the old save data failed", error);
  }
}

migrateLegacyStorage();

/** Writes the hero list `{heroes, last}`; storage errors (private mode, full quota) are ignored. */
export function writeHeroList(heroList) {
  try {
    localStorage.setItem(HEROES_KEY, JSON.stringify(heroList));
  } catch (error) {}
}

/** Reads the hero list `{heroes, last}`; every record passes through migrateHero, so imported old saves work too. */
export function readHeroList() {
  const stored = readJson(HEROES_KEY);
  if (stored && Array.isArray(stored.heroes)) {
    const heroes = stored.heroes
      .filter(Boolean)
      .map(migrateHero)
      .filter((hero) => hero && hero.name);
    return { heroes, last: stored.last | 0 };
  }
  const empty = { heroes: [], last: 0 };
  writeHeroList(empty);
  return empty;
}
