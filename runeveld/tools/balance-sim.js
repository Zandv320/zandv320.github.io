/* Eldoria – balance check for Saga I: a simulated hero plays the whole story and reports the level, play time
   and how hard each kill quest is when the hero gets there. It uses the game's own data and rules
   (data.js, rules/), so it shows the effect of any change to monsters, quests, items, skills or stats.

   node runeveld/tools/balance-sim.js [swordsman|mage] [--main] [-v]
     --main  only the main story (no side quests)
     -v      also list every purchase

   The hero plays perfectly (always the best monster, perfect skill use, best gear it can afford, no deaths),
   so real play takes about 2–3 times as long and fights cost more HP than reported. Targets for Saga I:
   level ~20 at the end, normal fights at the hero's level ~15–30% HP, the Dire Boar and Varek potion fights. */
import { MONSTERS, ITEMS, SHOPS, CLASSES, expForLevel, SELL_RATIO } from "../src/data.js";
import { deriveStats, statCost, statPointsForLevel, statPointsSpent } from "../src/rules/stats.js";
import { hitChance, applyDefense, monsterCombatStats } from "../src/rules/combat.js";
import { QUESTS, QUEST_ORDER } from "../src/rules/quests.js";
import {
  SKILLS,
  jobExpForLevel,
  JOB_EXP_SHARE,
  skillPointsForJobLevel,
} from "../src/rules/skills.js";

const CLASS = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : "swordsman";
const MAIN_ONLY = process.argv.includes("--main");
const fightNotes = [];
const income = { drops: 0, loot: 0, quests: 0 };
const VERBOSE = process.argv.includes("-v");
const TRAVEL = 6; // seconds walking to the next monster
const MONSTER_INTERVAL = 1.6;

// Where each chapter's monsters live and which shops are reachable.
const AREA = {
  1: ["rabbit"],
  2: ["rabbit", "fox"],
  3: ["rabbit", "fox", "boar"],
  4: ["fox", "boar", "wolf", "stag"],
  5: ["wolf", "stag", "bandit", "dire_wolf", "bandit_brute"],
};
const SHOPS_BY_CHAPTER = (ch) => (ch >= 5 ? Object.keys(SHOPS) : ["bram"]);

const hero = {
  level: 1,
  exp: 0,
  jobLevel: 1,
  jobExp: 0,
  zeny: 0,
  stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
  equipment: { ...CLASSES[CLASS].starterEquipment },
  time: 0,
  kills: {},
  grindKills: 0,
  quests: {},
};
const SPLIT = CLASS === "mage" ? { int: 3, dex: 1, vit: 1 } : { str: 2, dex: 1, vit: 1, agi: 1 };

function spendStats() {
  let free = statPointsForLevel(hero.level) - statPointsSpent(hero.stats);
  for (;;) {
    // the stat furthest below its share
    const total = Object.values(SPLIT).reduce((a, b) => a + b, 0);
    const sum = Object.keys(SPLIT).reduce((a, k) => a + hero.stats[k], 0);
    let best = null;
    for (const k of Object.keys(SPLIT)) {
      const want = (sum * SPLIT[k]) / total;
      const gap = want - hero.stats[k];
      if (!best || gap > best.gap) best = { k, gap };
    }
    const cost = statCost(hero.stats[best.k]);
    if (cost > free) break;
    hero.stats[best.k]++;
    free -= cost;
  }
}

function items() {
  return Object.values(hero.equipment)
    .filter(Boolean)
    .map((id) => ITEMS[id]);
}
function skillLevel() {
  return Math.min(10, skillPointsForJobLevel(hero.jobLevel));
}
function derived() {
  const skills = CLASS === "mage" ? { ember_bolt: skillLevel() } : { crushing_blow: skillLevel() };
  return deriveStats({
    level: hero.level,
    stats: hero.stats,
    items: items(),
    skills,
    heroClass: CLASSES[CLASS],
  });
}

function score(item) {
  const b = item.bonus || {};
  const main =
    CLASS === "mage"
      ? (item.matk || 0) * 3 + (b.int || 0) * 4
      : (item.atk || 0) * 3 + (b.str || 0) * 4;
  return (
    main +
    (item.def || 0) * 2 +
    (item.hp || 0) * 0.08 +
    ((b.vit || 0) + (b.dex || 0) + (b.agi || 0)) * 2
  );
}
function slotOf(item) {
  return item.slot === "ring" ? (hero.equipment.ring1 ? "ring2" : "ring1") : item.slot;
}
function shop(chapter) {
  const reserve = 150 + hero.level * 15; // potions
  const offers = new Set(SHOPS_BY_CHAPTER(chapter).flatMap((s) => SHOPS[s].items));
  let bought = true;
  while (bought) {
    bought = false;
    let best = null;
    for (const id of offers) {
      const item = ITEMS[id];
      if (!item.slot || (item.forClass && item.forClass !== CLASS)) continue;
      if (item.price > hero.zeny - reserve) continue;
      const slot = slotOf(item);
      const current = hero.equipment[slot] ? score(ITEMS[hero.equipment[slot]]) : 0;
      const gain = score(item) - current;
      if (gain > 0 && (!best || gain / item.price > best.value))
        best = { id, slot, value: gain / item.price, gain };
    }
    if (best) {
      hero.zeny -= ITEMS[best.id].price;
      if (VERBOSE)
        console.log(`    buys ${best.id} (${ITEMS[best.id].price}z) at lvl ${hero.level}`);
      hero.equipment[best.slot] = best.id;
      bought = true;
    }
  }
}

function gainExp(exp) {
  hero.exp += exp;
  while (hero.exp >= expForLevel(hero.level)) {
    hero.exp -= expForLevel(hero.level);
    hero.level++;
    spendStats();
  }
  if (hero.jobLevel < 20) {
    hero.jobExp += Math.round(exp * JOB_EXP_SHARE);
    while (hero.jobLevel < 20 && hero.jobExp >= jobExpForLevel(hero.jobLevel)) {
      hero.jobExp -= jobExpForLevel(hero.jobLevel);
      hero.jobLevel++;
    }
  }
}

/* one fight: seconds needed (fight + walk + rest) and damage taken; null when the hero would lose */
function fight(monsterId) {
  const m = MONSTERS[monsterId];
  const s = derived();
  const mc = monsterCombatStats(m);
  let dps;
  if (CLASS === "mage") {
    const l = Math.max(1, skillLevel());
    const bolt = SKILLS.ember_bolt;
    const mult = bolt.mult ? bolt.mult(l) : 1.5;
    const cost = bolt.spCost ? bolt.spCost(l) : 8;
    const cast = Math.max(bolt.cooldown || 1, 1);
    const castsPerSec = Math.min(1 / cast, (s.spRegen + s.spMax / 20) / cost);
    dps =
      s.matk * mult * castsPerSec +
      /* between casts: magic bolts, half of MATK, never missing (player.js basicAttack) */
      ((1 - Math.min(1, castsPerSec * cast)) * s.matk * 0.5) / s.attackInterval;
  } else {
    const l = skillLevel();
    const hit = hitChance(s.hit, mc.flee);
    const mult = l ? SKILLS.crushing_blow.mult(l) : 0;
    const cost = l ? SKILLS.crushing_blow.spCost(l) : 1e9;
    const rate = l
      ? Math.min(1 / SKILLS.crushing_blow.cooldown, (s.spRegen + s.spMax / 20) / cost)
      : 0;
    const crit = 1 + (s.crit / 100) * 0.5;
    dps =
      s.atk * hit * crit * ((1 / s.attackInterval) * (1 - rate * s.attackInterval) + rate * mult);
  }
  const ttk = m.hp / dps;
  const monsterHit = hitChance(mc.hit, s.flee);
  const taken = (ttk / MONSTER_INTERVAL) * monsterHit * applyDefense(m.atk, s.def);
  // in a fight hp also regenerates
  const net = Math.max(0, taken - s.hpRegen * ttk);
  let potions = 0;
  if (net > s.hpMax * 0.85) {
    // bosses are potion fights: one potion a second at most
    const isBoss = !!m.respawn;
    const heal = hero.level >= 15 ? 160 : 45;
    potions = Math.ceil((net - s.hpMax * 0.6) / heal);
    if (!isBoss || potions > ttk * 0.5) return null;
  }
  const rest = Math.min(net, s.hpMax) / (s.hpRegen * 4);
  return { seconds: ttk + TRAVEL + rest, ttk, taken: net, hpMax: s.hpMax, potions };
}

function lootValue(m) {
  let v = 0;
  for (const [id, p] of Object.entries(m.loot || {})) v += p * (ITEMS[id]?.price || 0) * SELL_RATIO;
  return v;
}

function kill(monsterId, count, why) {
  const m = MONSTERS[monsterId];
  for (let i = 0; i < count; i++) {
    const f = fight(monsterId);
    if (!f) return false;
    hero.time += f.seconds;
    gainExp(m.exp);
    hero.zeny += (m.zeny[0] + m.zeny[1]) / 2 + lootValue(m);
    income.drops += (m.zeny[0] + m.zeny[1]) / 2;
    income.loot += lootValue(m);
    hero.kills[monsterId] = (hero.kills[monsterId] || 0) + 1;
    if (why === "grind") hero.grindKills++;
  }
  return true;
}

function bestGrind(chapter) {
  let best = null;
  for (const id of AREA[chapter]) {
    const f = fight(id);
    if (!f) continue;
    const rate = MONSTERS[id].exp / f.seconds;
    if (!best || rate > best.rate) best = { id, rate, f };
  }
  return best;
}

function grindTo(level, chapter, label) {
  const start = hero.time;
  const startLevel = hero.level;
  while (hero.level < level) {
    const g = bestGrind(chapter);
    if (!g) {
      console.log(`  !! cannot grind anything in chapter ${chapter} at lvl ${hero.level}`);
      return;
    }
    kill(g.id, 1, "grind");
    shop(chapter);
  }
  const minutes = (hero.time - start) / 60;
  if (minutes > 0.5)
    console.log(`  grind ${startLevel}→${level} for ${label}: ${minutes.toFixed(1)} min`);
}

// item quests: kill the monster that drops the item until the expected count is there
function dropKills(itemId, count) {
  for (const [id, m] of Object.entries(MONSTERS)) {
    const p = m.loot?.[itemId];
    if (p) return { id, kills: Math.ceil(count / p) };
  }
  return null;
}

const SIDE_AT_CHAPTER = {};
let chapter = 1;
const log = [];
for (const id of QUEST_ORDER) {
  const q = QUESTS[id];
  if (MAIN_ONLY && !q.main) continue;
  if (q.main) chapter = q.chapter;
  const ch = q.main ? q.chapter : Math.max(chapter, 1);
  if (hero.level < q.level) grindTo(q.level, ch, id);
  shop(ch);
  const before = { level: hero.level, time: hero.time };
  const g = q.goal;
  if (g.type === "kill") {
    const f0 = fight(g.monster);
    fightNotes.push(
      `${id}: lvl ${hero.level} vs ${g.monster} (lvl ${MONSTERS[g.monster].level}) ` +
        (f0
          ? `ttk ${f0.ttk.toFixed(1)}s, takes ${Math.round((f0.taken / f0.hpMax) * 100)}% hp` +
            (f0.potions ? `, ${f0.potions} potions` : "")
          : "LOSES"),
    );
    // kills from earlier grinding of this monster after accepting do not count; do them all
    if (!kill(g.monster, g.count, "quest")) {
      console.log(`  !! ${id}: hero (lvl ${hero.level}) cannot beat ${g.monster}`);
      // grind up until possible
      while (!fight(g.monster)) {
        const gr = bestGrind(ch);
        if (!gr) break;
        kill(gr.id, 1, "grind");
        shop(ch);
      }
      kill(g.monster, g.count, "quest");
    }
  } else if (g.type === "item") {
    const d = dropKills(g.item, g.count);
    if (d && fight(d.id)) kill(d.id, d.kills, "quest");
    else hero.time += 60;
  } else if (g.type === "reach" || g.type === "visit") {
    hero.time += 60;
  } else {
    hero.time += 90; // gather, craft, equip, buy, stat, skill, disenchant, refine
  }
  hero.time += 30; // talking, walking to the giver
  gainExp(q.reward.exp);
  hero.zeny += q.reward.zeny;
  income.quests += q.reward.zeny;
  for (const reward of q.reward.items || []) {
    const rid = CLASS === "mage" && reward.mage ? reward.mage : reward.id;
    const item = ITEMS[rid];
    if (item?.slot && (!item.forClass || item.forClass === CLASS)) {
      const slot = slotOf(item);
      const cur = hero.equipment[slot] ? score(ITEMS[hero.equipment[slot]]) : 0;
      if (score(item) > cur) hero.equipment[slot] = rid;
    }
  }
  const s = derived();
  log.push({
    id,
    main: q.main ? "M" : "s",
    ch: q.main ? q.chapter : "-",
    gate: q.level,
    level: hero.level,
    min: Math.round(hero.time / 60),
    atk: CLASS === "mage" ? s.matk : s.atk,
    hp: s.hpMax,
    def: s.def,
    zeny: Math.round(hero.zeny),
  });
}
console.log(
  `\n${CLASS}: quest | M/side | chapter | gate | level after | minutes | atk | hp | def | zeny`,
);
for (const r of log) console.log(Object.values(r).join(" | "));
console.log(
  `\nfinal level ${hero.level} (+${Math.round((hero.exp / expForLevel(hero.level)) * 100)}%), job ${hero.jobLevel}, ${Math.round(hero.time / 60)} min, kills`,
  hero.kills,
  `grind kills ${hero.grindKills}`,
);
console.log("equipment", hero.equipment, "stats", hero.stats);
console.log(fightNotes.join("\n"));
console.log(
  "income",
  Object.fromEntries(Object.entries(income).map(([k, v]) => [k, Math.round(v)])),
);
for (const id of ["bandit", "dire_wolf", "bandit_brute", "bandit_chief", "dire_boar", "wolf"]) {
  const f = fight(id);
  console.log(
    `  vs ${id}: ${f ? `ttk ${f.ttk.toFixed(1)}s, taken ${Math.round(f.taken)}/${f.hpMax}` : "loses"}`,
  );
}
