/* Eldoria – the heroes on the server. One Durable Object (HeroStore, instance "main") keeps, per account token (a
   secret the browser creates), the list of that account's heroes. Every world (the live "v1" and local development
   "local") asks this store, so the same heroes appear everywhere.
   The store applies the game rules itself (runeveld/src/rules/progression.js): exp and loot from the server's own
   monsters, stat and skill points, shops, equipment, potions, class advancement and quests. A client asks for an
   action and gets the updated record back; whatever it makes up itself does not count.
   World objects call the public methods below over Durable Object RPC. */
import { DurableObject } from "cloudflare:workers";
import * as progression from "../../runeveld/src/rules/progression.js";
import * as crafting from "../../runeveld/src/rules/crafting.js";
import { migrateHero } from "../../runeveld/src/rules/legacy.js";
import { ITEMS } from "../../runeveld/src/data.js";

const MAX_HEROES = 6;
const STORAGE_PREFIX = "heroes:";
/* before HeroStore existed, every world kept its own heroes under this key prefix */
export const LEGACY_STORAGE_PREFIX = "t:";
/* the worlds that may still hold heroes from before HeroStore ("lokaal" was the old local development world) */
const LEGACY_WORLDS = ["v1", "lokaal"];
const DEFAULT_POTION = "red_potion";
/* share of the gather time that must have passed since the previous gather (network jitter) */
const GATHER_TIME_TOLERANCE = 0.75;

export const isValidToken = (token) => typeof token === "string" && /^[a-z0-9]{20,48}$/.test(token);
export const isValidHeroName = (name) =>
  typeof name === "string" && name.length >= 1 && name.length <= 14;

const storageKey = (token) => STORAGE_PREFIX + token;
const isObject = (value) => Boolean(value) && typeof value === "object";

/* old records call the level `lvl`; migrated ones `level` */
const levelOf = (record) => +(record.level ?? record.lvl) || 0;
const expOf = (record) => +record.exp || 0;

/* true when record a is further along than record b (higher level, then higher exp) */
function isFurtherThan(a, b) {
  if (levelOf(a) !== levelOf(b)) {
    return levelOf(a) > levelOf(b);
  }
  return expOf(a) > expOf(b);
}

export class HeroStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /* token → {heroes: [record], last: index of the hero played last} */
    this.rosters = new Map();
    /* token → promise of a roster that is being read (or migrated) right now */
    this.pendingLoads = new Map();
  }

  /** All heroes of an account: `{heroes, last}`. */
  async load(token) {
    return this.#getRoster(token);
  }

  /** One-time takeover of heroes from the browser's local storage, only while the account is still empty. */
  async importHeroes(token, list) {
    const roster = await this.#getRoster(token);
    if (roster.heroes.length) {
      return roster;
    }
    const sources = Array.isArray(list) ? list.slice(0, MAX_HEROES) : [];
    for (const source of sources) {
      const hero = this.#migrateOrNull(source);
      if (!hero || !isValidHeroName(hero.name) || this.#findHero(roster, hero.name)) {
        continue;
      }
      roster.heroes.push(progression.sanitizeHero(hero));
    }
    await this.#persist(token, roster);
    return roster;
  }

  /** Creates a new level 1 hero from `{name, hair, classId}`. */
  async create(token, hero) {
    const roster = await this.#getRoster(token);
    if (
      roster.heroes.length >= MAX_HEROES ||
      !isObject(hero) ||
      !isValidHeroName(hero.name) ||
      this.#findHero(roster, hero.name)
    ) {
      return roster;
    }
    roster.heroes.push(
      progression.newHero({ name: hero.name.trim(), hair: hero.hair, classId: hero.classId }),
    );
    await this.#persist(token, roster);
    return roster;
  }

  async remove(token, name) {
    const roster = await this.#getRoster(token);
    const index = roster.heroes.findIndex((hero) => hero.name === name);
    if (index >= 0) {
      roster.heroes.splice(index, 1);
      roster.last = 0;
      await this.#persist(token, roster);
    }
    return roster;
  }

  /** Stores the volatile fields the client does keep itself (hp, sp, position); returns the hero or null. */
  async save(token, name, volatileFields) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero || !isObject(volatileFields)) {
      return null;
    }
    const derived = progression.derivedStatsOf(hero);
    const hp = +volatileFields.hp;
    const sp = +volatileFields.sp;
    const x = +volatileFields.x;
    const z = +volatileFields.z;
    if (Number.isFinite(hp)) {
      hero.hp = Math.max(0, Math.min(derived.hpMax, Math.round(hp)));
    }
    if (Number.isFinite(sp)) {
      hero.sp = Math.max(0, Math.min(derived.spMax, Math.round(sp)));
    }
    if (Number.isFinite(x) && Number.isFinite(z)) {
      hero.x = +x.toFixed(2);
      hero.z = +z.toFixed(2);
    }
    roster.last = roster.heroes.indexOf(hero);
    await this.#persist(token, roster);
    return hero;
  }

  /**
   * A player action. Returns the hero record (also when nothing changed, so the client stays in sync), or null
   * when the hero does not exist.
   */
  async action(token, name, type, data) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero) {
      return null;
    }
    const payload = isObject(data) ? data : {};
    const id = typeof payload.id === "string" ? payload.id : "";
    /* the bag entry the client means, so a refined copy is not mixed up with a plain one */
    const index = Number.isInteger(payload.index) ? payload.index : undefined;
    let changed = false;
    switch (type) {
      case "stat":
        changed = progression.raiseStat(hero, String(payload.stat));
        break;
      case "skill":
        changed = progression.raiseSkill(hero, id);
        break;
      case "buy":
        changed = progression.buy(hero, id);
        break;
      case "sell":
        changed = progression.sell(hero, id, index);
        break;
      case "drop":
        changed = progression.drop(hero, id, index);
        break;
      case "equip":
        changed = progression.equip(hero, id, index);
        break;
      case "unequip":
        changed = progression.unequip(hero, String(payload.slot));
        break;
      case "drink": {
        // The stored HP is only synced every few seconds, so a potion right after a hit would be refused as
        // "already at full health". The client sends its current HP; it can only lower it, never raise it.
        const currentHp = Number(payload.hp);
        if (Number.isFinite(currentHp)) {
          hero.hp = Math.max(0, Math.min(hero.hp, Math.round(currentHp)));
        }
        changed = progression.drinkPotion(hero, id || DEFAULT_POTION);
        break;
      }
      case "advance":
        changed = progression.advanceClass(hero, id);
        break;
      case "quest":
        changed = this.#questStep(hero, id, payload.step);
        break;
      case "respawn":
        this.#respawn(hero);
        changed = true;
        break;
    }
    /* quests that ask for a state (wear something, raise a stat, learn a skill) */
    if (progression.syncStateQuests(hero)) {
      changed = true;
    }
    if (changed) {
      await this.#persist(token, roster);
    }
    return hero;
  }

  /**
   * A profession action (rules/crafting.js) with the server's dice: gather, craft, refine, enchant, disenchant or
   * use. The World has already checked where the hero stands. `context.sinceLastGather`: ms since this player's
   * previous gather, so nobody gathers faster than the gather time allows. Returns {hero, result} or null.
   */
  async profession(token, name, type, data, context = {}) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero) {
      return null;
    }
    const payload = isObject(data) ? data : {};
    const target = {
      slot: typeof payload.slot === "string" ? payload.slot : undefined,
      index: Number.isInteger(payload.index) ? payload.index : undefined,
    };
    let result;
    switch (type) {
      case "gather": {
        const resource = String(payload.resource);
        const minimumMs = crafting.gatherTime(hero, resource) * 1000 * GATHER_TIME_TOLERANCE;
        result =
          context.sinceLastGather < minimumMs
            ? { ok: false, reason: "Not so fast." }
            : crafting.gather(hero, resource);
        break;
      }
      case "craft":
        result = crafting.craft(hero, String(payload.recipe), payload.times);
        break;
      case "refine":
        result = crafting.refine(hero, target);
        break;
      case "enchant":
        result = crafting.enchant(hero, target, String(payload.rune));
        break;
      case "disenchant":
        result = crafting.disenchant(hero, target.index);
        break;
      case "use": {
        const currentHp = Number(payload.hp);
        if (Number.isFinite(currentHp)) {
          hero.hp = Math.max(0, Math.min(hero.hp, Math.round(currentHp)));
        }
        const currentSp = Number(payload.sp);
        if (Number.isFinite(currentSp)) {
          hero.sp = Math.max(0, Math.min(hero.sp, Math.round(currentSp)));
        }
        result = crafting.useItem(hero, String(payload.id), Date.now());
        break;
      }
      default:
        result = { ok: false, reason: "Unknown action." };
    }
    if (result.ok) {
      await this.#persist(token, roster);
    }
    return { hero, result };
  }

  /** A monster was killed: exp, zeny, loot and quest progress. Returns the hero or null. */
  async rewardKill(token, name, { monsterId, exp, zeny, loot, material }) {
    const roster = await this.#getRoster(token);
    const hero = this.#findHero(roster, name);
    if (!hero) {
      return null;
    }
    progression.grantReward(hero, { exp, zeny });
    if (loot && ITEMS[loot]) {
      progression.addToBag(hero, loot, 1);
    }
    if (material && ITEMS[material]) {
      progression.addToBag(hero, material, 1);
    }
    progression.recordQuestKill(hero, monsterId);
    progression.syncItemQuests(hero);
    await this.#persist(token, roster);
    return hero;
  }

  #questStep(hero, questId, step) {
    if (step === "accept") {
      return progression.acceptQuest(hero, questId);
    }
    if (step === "turn_in") {
      return progression.turnInQuest(hero, questId);
    }
    return progression.markQuestProgress(hero, questId);
  }

  /* back in the village with half hp and sp */
  #respawn(hero) {
    const derived = progression.derivedStatsOf(hero);
    hero.hp = Math.max(1, Math.round(derived.hpMax * 0.5));
    hero.sp = Math.round(derived.spMax * 0.5);
    hero.x = 0;
    hero.z = 4;
  }

  #findHero(roster, name) {
    return roster.heroes.find((hero) => hero.name === name) || null;
  }

  #migrateOrNull(record) {
    if (!isObject(record)) {
      return null;
    }
    try {
      return migrateHero(record);
    } catch {
      return null;
    }
  }

  async #persist(token, roster) {
    await this.ctx.storage.put(storageKey(token), { heroes: roster.heroes, last: roster.last });
  }

  /* the cached roster, or one read from storage; concurrent first loads share a single read */
  async #getRoster(token) {
    if (!isValidToken(token)) {
      throw new Error("invalid token");
    }
    const cached = this.rosters.get(token);
    if (cached) {
      return cached;
    }
    let pending = this.pendingLoads.get(token);
    if (!pending) {
      pending = this.#readRoster(token).finally(() => this.pendingLoads.delete(token));
      this.pendingLoads.set(token, pending);
    }
    return pending;
  }

  async #readRoster(token) {
    const stored = await this.ctx.storage.get(storageKey(token));
    let roster;
    if (stored) {
      /* stored records always pass through migrateHero, which leaves English records alone */
      const heroes = (Array.isArray(stored.heroes) ? stored.heroes : [])
        .map((record) => this.#migrateOrNull(record))
        .filter(Boolean);
      roster = { heroes, last: +stored.last || 0 };
    } else {
      roster = await this.#importLegacyRoster(token);
      await this.#persist(token, roster);
    }
    this.rosters.set(token, roster);
    return roster;
  }

  /* first visit of a token: collect its heroes from the old worlds, keeping the further-along copy of each name */
  async #importLegacyRoster(token) {
    const recordsByName = new Map();
    let lastPlayedName = null;
    for (const worldName of LEGACY_WORLDS) {
      const world = this.env.WORLD.get(this.env.WORLD.idFromName(worldName));
      const legacy = await world.legacyHeroes(token);
      const list = isObject(legacy) && Array.isArray(legacy.lijst) ? legacy.lijst : [];
      if (lastPlayedName === null && list.length) {
        const lastPlayed = list[legacy.laatst];
        lastPlayedName = isObject(lastPlayed) ? (lastPlayed.naam ?? lastPlayed.name) : null;
      }
      for (const record of list) {
        if (!isObject(record)) {
          continue;
        }
        const name = record.naam ?? record.name;
        if (!isValidHeroName(name)) {
          continue;
        }
        const existing = recordsByName.get(name);
        if (!existing || isFurtherThan(record, existing)) {
          recordsByName.set(name, record);
        }
      }
    }
    const heroes = [...recordsByName.values()]
      .map((record) => this.#migrateOrNull(record))
      .filter(Boolean);
    const lastIndex = heroes.findIndex((hero) => hero.name === lastPlayedName);
    return { heroes, last: Math.max(0, lastIndex) };
  }
}
