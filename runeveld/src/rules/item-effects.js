/* Eldoria – game rules: the unique effects of the great bosses' drops. Each worn item can carry one or more:
     ignite       {chance, share, seconds, spells}  a hit sets the target ablaze: `share` of the blow again, spread
                                                     over `seconds` (spells: only magic hits)
     lifesteal    share                             heal by this share of the damage dealt
     spRegain     share                             magic damage gives back this share as SP
     doubleStrike chance                            a basic attack strikes twice
     chain        {chance, share}                   a skill hit jumps to another monster nearby for `share` of it
     block        {chance, share}                   a blow taken loses `share` of its damage
     thorns       {chance, share}                   a blow taken burns the attacker for `share` of it
     lastStand    {below, heal, cooldown, nova}     falling below `below` of max HP heals `heal` of it, once per
                                                     `cooldown` seconds; with `nova`, flames burst round the hero
                                                     for `nova` times their best attack
   The game (item-effects.js) applies them; every extra hit goes to the host or server like any other. Pure data,
   shared by client and server. */
import { ITEMS } from "../data.js";

export const ITEM_EFFECTS = {
  /* the Ember Warden's hoard */
  firstflame_blade: { ignite: { chance: 0.25, share: 0.35, seconds: 3 } },
  flamecaller_staff: { ignite: { chance: 0.3, share: 0.3, seconds: 3, spells: true } },
  wardens_heart: { thorns: { chance: 0.3, share: 0.5 } },
  molten_mantle: { lastStand: { below: 0.3, heal: 0.2, cooldown: 60, nova: 1.5 } },
  /* Count Vaelor's */
  bloodfang_blade: { lifesteal: 0.06 },
  nightveil_staff: { spRegain: 0.08 },
  crimson_mantle: { lastStand: { below: 0.25, heal: 0.15, cooldown: 90 } },
  counts_signet: { lifesteal: 0.03 },
  /* Skrag the goblin chief's and Grumm the troll's */
  skrags_cleaver: { doubleStrike: 0.15 },
  humming_staff: { chain: { chance: 0.25, share: 0.5 } },
  trollhide_cloak: { block: { chance: 0.12, share: 0.5 } },
  grumms_toll: { block: { chance: 0.06, share: 0.4 } },
  bridgestone_pendant: { block: { chance: 0.08, share: 0.35 } },
};

const percent = (share) => Math.round(share * 100) + "%";

/** The effects of one item in words, one line each (for its details). */
export function effectLines(id) {
  const effects = ITEM_EFFECTS[id] || {};
  const lines = [];
  if (effects.ignite) {
    const { chance, share, seconds, spells } = effects.ignite;
    lines.push(
      `${percent(chance)} chance on ${spells ? "a spell hit" : "hit"} to set the target ablaze: ${percent(share)} of the blow again over ${seconds} s`,
    );
  }
  if (effects.lifesteal) {
    lines.push(`Heals you for ${percent(effects.lifesteal)} of the damage you deal`);
  }
  if (effects.spRegain) {
    lines.push(`${percent(effects.spRegain)} of your magic damage returns as SP`);
  }
  if (effects.doubleStrike) {
    lines.push(`${percent(effects.doubleStrike)} chance for a basic attack to strike twice`);
  }
  if (effects.chain) {
    lines.push(
      `${percent(effects.chain.chance)} chance for a skill hit to jump to another monster for ${percent(effects.chain.share)} of it`,
    );
  }
  if (effects.block) {
    lines.push(
      `${percent(effects.block.chance)} chance to block ${percent(effects.block.share)} of a blow`,
    );
  }
  if (effects.thorns) {
    lines.push(
      `${percent(effects.thorns.chance)} chance to burn an attacker for ${percent(effects.thorns.share)} of its blow`,
    );
  }
  if (effects.lastStand) {
    const { below, heal, cooldown, nova } = effects.lastStand;
    lines.push(
      `Below ${percent(below)} HP: heals ${percent(heal)} of your max HP${nova ? " and bursts into flame" : ""} (once per ${cooldown} s)`,
    );
  }
  return lines;
}

/**
 * Everything the hero's worn items do, gathered: chances and shares of the same kind add up (lifesteal,
 * spRegain, doubleStrike), the rest is a list to try one by one.
 */
export function heroEffects(hero) {
  const total = {
    ignite: [],
    lifesteal: 0,
    spRegain: 0,
    doubleStrike: 0,
    chain: [],
    block: [],
    thorns: [],
    lastStand: [],
  };
  for (const [slot, id] of Object.entries(hero.equipment || {})) {
    const effects = id && ITEMS[id] ? ITEM_EFFECTS[id] : null;
    if (!effects) {
      continue;
    }
    for (const [kind, value] of Object.entries(effects)) {
      if (Array.isArray(total[kind])) {
        total[kind].push({ ...value, id, slot });
      } else {
        total[kind] += value;
      }
    }
  }
  return total;
}
