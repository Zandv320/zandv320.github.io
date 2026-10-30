/* Eldoria – migration of old save data. Heroes saved before the English refactor use Dutch field names and ids
   (naam, klasse, lvl, uitr, tas [{id, n}], quests {st, n}, item ids like 'drank'). migrateHero turns such a record
   into the current English one. Pure, and idempotent: an already-English record passes through unchanged
   (apart from dropping ids that no longer exist). */
import { ITEMS, emptyEquipment } from "../data.js";
import { SKILLS } from "./skills.js";
import { catchUpMainStory } from "./quests.js";

/* Old id → new id, per kind of id. */
export const LEGACY_IDS = {
  /* hero record fields */
  heroFields: {
    naam: "name",
    haar: "hair",
    klasse: "classId",
    lvl: "level",
    job: "jobLevel",
    jobexp: "jobExp",
    uitr: "equipment",
    tas: "bag",
  },
  items: {
    drank: "red_potion",
    grote_drank: "orange_potion",
    leren_kap: "leather_cap",
    ijzeren_helm: "iron_helm",
    punthoed: "pointed_hat",
    sterrenhoed: "starry_hat",
    tuniek: "tattered_tunic",
    vest: "leather_vest",
    harnas: "steel_armor",
    gewaad: "apprentice_robe",
    zijden_gewaad: "silk_robe",
    magiergewaad: "archmage_robe",
    ridderharnas: "knight_plate",
    kruisharnas: "crusader_plate",
    wizardgewaad: "wizard_robe",
    sagegewaad: "sage_robe",
    houtzwaard: "wooden_sword",
    ijzerzwaard: "iron_sword",
    staalzwaard: "steel_sword",
    houtstaf: "wooden_staff",
    eikenstaf: "oak_staff",
    kristalstaf: "crystal_staff",
    konijnenpoot: "rabbit_foot",
    vossenstaart: "fox_tail",
    zwijnenhuid: "boar_hide",
    wolfsvacht: "wolf_pelt",
    gewei: "stag_antler",
    slagtand: "dire_tusk",
    donkere_vacht: "dire_wolf_pelt",
    bandietenzegel: "bandit_insignia",
    reismantel: "travelers_cloak",
    wolmantel: "wool_cloak",
    schaduwmantel: "shadow_cloak",
    koningsmantel: "royal_cloak",
    koperring: "copper_ring",
    krachtring: "ring_of_might",
    wijsheidsring: "ring_of_wisdom",
    behendigheidsring: "ring_of_agility",
    koningsring: "royal_signet",
    leren_koord: "leather_cord",
    zilveren_ketting: "silver_necklace",
    wolfstand_ketting: "wolf_fang_necklace",
    amulet_van_aurelia: "amulet_of_aurelia",
    leren_riem: "leather_belt",
    gespriem: "buckled_belt",
    ridderriem: "knights_belt",
    linnen_broek: "linen_pants",
    leren_broek: "leather_pants",
    geschubde_broek: "scaled_pants",
    stoffen_schoenen: "cloth_shoes",
    leren_laarzen: "leather_boots",
    ijzeren_laarzen: "iron_boots",
  },
  skills: {
    beuk: "crushing_blow",
    vuurkring: "flame_sweep",
    zwaardbeheersing: "blade_mastery",
    hpherstel: "second_wind",
    provocatie: "war_cry",
    wapenversnelling: "quickening",
    ijzerhuid: "stoneskin",
    doodslag: "stunning_strike",
    vuurpijl: "ember_bolt",
    vorstnova: "frostburst",
    barriere: "mana_ward",
    ijsbout: "ice_shard",
    zielsslag: "spirit_volley",
    spreukfocus: "clear_mind",
    stafbeheersing: "arcane_mastery",
    meditatie: "inner_calm",
    doorboor: "piercing_thrust",
    rolstoot: "whirlwind_sweep",
    volharden: "iron_resolve",
    spiraal: "spiral_lance",
    heiligkruis: "radiant_cross",
    schildstoot: "shield_rush",
    genezing: "mending_light",
    heiligeschild: "aegis_of_light",
    bliksem: "thunderclap",
    stormvlaag: "blizzard",
    energiemantel: "mana_shell",
    meteoor: "starfall",
    aardspies: "stone_spires",
    manaspiegel: "mana_echo",
    manabron: "wellspring",
  },
  quests: {
    mette_welkom: "mette_welcome",
    rolf_konijnen: "rolf_rabbits",
    teun_poten: "teun_lucky_feet",
    pim_vos: "pim_fox",
    sven_vossen: "sven_foxes",
    lise_staarten: "lise_fox_tails",
    jorn_zwijnen: "jorn_boars",
    ragnar_huiden: "ragnar_hides",
    mette_altaar: "mette_altar",
    rolf_wolven: "rolf_wolves",
    lise_vacht: "lise_warm_coat",
    ragnar_gewei: "ragnar_antlers",
    rolf_everzwijn: "rolf_dire_boar",
    rolf_westen: "rolf_road_west",
    aldric_bandieten: "aldric_bandits",
    wren_vachten: "wren_dark_pelts",
    aldric_bruten: "aldric_brutes",
    aldric_varek: "aldric_varek",
    corvin_audientie: "corvin_audience",
  },
  questStates: {
    nieuw: "available",
    gesloten: "locked",
    bezig: "active",
    klaar: "ready",
    gedaan: "done",
  },
  monsters: {
    konijn: "rabbit",
    vos: "fox",
    zwijn: "boar",
    wolf: "wolf",
    hert: "stag",
    everzwijn: "dire_boar",
    bandiet: "bandit",
    direwolf: "dire_wolf",
    bruut: "bandit_brute",
    hoofdman: "bandit_chief",
  },
  slots: {
    hoofd: "head",
    lichaam: "body",
    mantel: "cloak",
    wapen: "weapon",
    ketting: "necklace",
    ring1: "ring1",
    ring2: "ring2",
    riem: "belt",
    broek: "pants",
    laarzen: "boots",
  },
  hair: {
    standaard: "plum",
    bruin: "brown",
    blond: "blond",
    zwart: "black",
    rood: "red",
    grijs: "silver",
    blauw: "blue",
    groen: "green",
  },
  shops: {
    bram: "bram",
    apotheek: "apothecary",
    wapensmid: "armorer",
    kleermaker: "tailor",
    juwelier: "jeweler",
  },
};

/* The new id for an old one; ids that are not in the table (already new, or unknown) come back unchanged. */
function translate(table, id) {
  return Object.prototype.hasOwnProperty.call(table, id) ? table[id] : id;
}

function migrateSkills(skills) {
  if (!skills || typeof skills !== "object") {
    return skills;
  }
  const result = {};
  for (const [id, level] of Object.entries(skills)) {
    const newId = translate(LEGACY_IDS.skills, id);
    if (!SKILLS[newId]) {
      continue;
    }
    /* a record holding both an old and a new id for the same skill keeps the higher level */
    result[newId] = newId in result ? Math.max(result[newId], level) : level;
  }
  return result;
}

/* All ten slots, old slot names translated; items that no longer exist leave their slot empty. */
function migrateEquipment(equipment) {
  const result = emptyEquipment();
  if (!equipment || typeof equipment !== "object") {
    return result;
  }
  for (const [slot, id] of Object.entries(equipment)) {
    const newSlot = translate(LEGACY_IDS.slots, slot);
    if (!(newSlot in result) || !id) {
      continue;
    }
    const newId = translate(LEGACY_IDS.items, id);
    if (ITEMS[newId]) {
      result[newSlot] = newId;
    }
  }
  return result;
}

/* Bag entries {id, n} → {id, count}; unknown items are dropped. */
function migrateBag(bag) {
  if (!Array.isArray(bag)) {
    return bag;
  }
  const result = [];
  for (const entry of bag) {
    if (!entry) {
      continue;
    }
    const newId = translate(LEGACY_IDS.items, entry.id);
    if (!ITEMS[newId]) {
      continue;
    }
    result.push({ id: newId, count: entry.count !== undefined ? entry.count : entry.n });
  }
  return result;
}

/* Quest progress {st, n} → {state, count}, with old quest ids and states translated. */
function migrateQuests(quests) {
  if (!quests || typeof quests !== "object") {
    return quests;
  }
  const result = {};
  for (const [id, progress] of Object.entries(quests)) {
    if (!progress || typeof progress !== "object") {
      continue;
    }
    const state = progress.state !== undefined ? progress.state : progress.st;
    result[translate(LEGACY_IDS.quests, id)] = {
      state: translate(LEGACY_IDS.questStates, state),
      count: progress.count !== undefined ? progress.count : progress.n,
    };
  }
  return result;
}

/* The fields of a hero record, in the order they are written. */
const RECORD_FIELDS = [
  "name",
  "hair",
  "classId",
  "level",
  "exp",
  "jobLevel",
  "jobExp",
  "stats",
  "skills",
  "hp",
  "sp",
  "zeny",
  "equipment",
  "bag",
  "quests",
  "x",
  "z",
];

/* The old name of a record field, for the fields that were renamed. */
const OLD_FIELD_NAMES = Object.fromEntries(
  Object.entries(LEGACY_IDS.heroFields).map(([oldName, newName]) => [newName, oldName]),
);

/* Field conversions beyond the rename. */
const CONVERT_FIELD = {
  hair: (hair) => (typeof hair === "string" ? translate(LEGACY_IDS.hair, hair) : hair),
  skills: migrateSkills,
  bag: migrateBag,
  quests: migrateQuests,
};

/**
 * Convert an old (Dutch) hero record to the current English record with new ids. Already-English records pass
 * through. Unknown item and skill ids are dropped and the equipment always gets all ten slots. Fields the
 * migration does not know are kept as they are. Returns a new object; the input is not changed.
 */
export function migrateHero(record) {
  if (!record || typeof record !== "object") {
    return record;
  }
  const hero = {};
  for (const key of RECORD_FIELDS) {
    const oldName = OLD_FIELD_NAMES[key];
    /* prefer the new field name; fall back to the old one */
    let value = record[key];
    if (value === undefined && oldName) {
      value = record[oldName];
    }
    if (key === "equipment") {
      hero.equipment = migrateEquipment(value);
    } else if (value !== undefined) {
      hero[key] = CONVERT_FIELD[key] ? CONVERT_FIELD[key](value) : value;
    }
  }
  for (const [key, value] of Object.entries(record)) {
    const isOldField = Object.prototype.hasOwnProperty.call(LEGACY_IDS.heroFields, key);
    if (!isOldField && !(key in hero)) {
      hero[key] = value;
    }
  }
  /* heroes from before the main story (or before a step was added) skip what they are already past */
  if (hero.quests && typeof hero.quests === "object") {
    hero.quests = { ...hero.quests };
    catchUpMainStory(hero.quests);
  }
  return hero;
}
