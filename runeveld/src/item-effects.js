/* Eldoria – the unique effects of worn items (rules/item-effects.js) in play: what happens when the hero hits
   (ignite, lifesteal, SP, a second strike, a chain to another monster), when they are hit (a block, thorns) and
   when they fall low (a last stand). Every extra blow goes through hitMonster() like any other, so the host or
   server applies it. */
import { heroEffects } from "./rules/item-effects.js";
import { player, monsters, now, hpMax, spMax, derived, playEffect } from "./game-state.js";
import { camera } from "./world.js";
import { hitMonster } from "./player.js";
import { burst } from "./particles.js";
import { groundRing } from "./skill-effects.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

/* the blows the effects deal themselves: they set off no further effects */
const OWN_BLOWS = new Set(["burn", "thorns", "chain", "double_strike", "nova"]);

/* a last stand's cooldown per item id: time it is ready again */
const lastStandReady = new Map();

const heal = (amount, label) => {
  const gained = Math.min(hpMax() - player.hp, Math.round(amount));
  if (gained >= 1) {
    player.hp += gained;
    UI.floatingText(
      player.x,
      player.sprite.height + 0.5,
      player.z,
      camera,
      label || "+" + gained,
      "heal",
    );
  }
};

const blow = (damage) => ({ miss: false, damage: Math.max(1, Math.round(damage)), crit: false });

/** The hero hit a monster (hitMonster): ignite, lifesteal, SP, a second strike, a chain. */
export function onHeroHit(monster, result, kind) {
  if (result.miss || OWN_BLOWS.has(kind)) {
    return;
  }
  const effects = heroEffects(player);
  const isBasic = !kind;
  for (const ignite of effects.ignite) {
    if ((!ignite.spells || result.magic) && Math.random() < ignite.chance && !monster.isDead) {
      const ticks = Math.max(1, Math.round(ignite.seconds));
      monster.itemBurn = {
        damage: (result.damage * ignite.share) / ticks,
        left: ticks,
        next: now() + 1,
      };
      playEffect("fire", monster.x, monster.z, { size: 1.4, y: monster.sprite.height * 0.4 });
    }
  }
  if (effects.lifesteal) {
    heal(result.damage * effects.lifesteal);
  }
  if (effects.spRegain && result.magic) {
    player.sp = Math.min(spMax(), player.sp + result.damage * effects.spRegain);
  }
  if (isBasic && !result.magic && Math.random() < effects.doubleStrike) {
    setTimeout(() => {
      if (!monster.isDead) {
        hitMonster(monster, result, "double_strike");
        UI.floatingText(
          monster.x,
          monster.sprite.height + 0.3,
          monster.z,
          camera,
          "Twice!",
          "miss",
        );
      }
    }, 140);
  }
  if (!isBasic) {
    for (const chain of effects.chain) {
      if (Math.random() < chain.chance) {
        chainFrom(monster, result.damage * chain.share);
      }
    }
  }
}

/* a skill's blow jumps to the nearest other monster close by, as a crackle of light between them */
function chainFrom(monster, damage) {
  let nearest = null;
  let best = 4.5;
  for (const other of monsters.values()) {
    if (other === monster || other.isDead || !other.sprite.group.visible) {
      continue;
    }
    const distance = Math.hypot(other.x - monster.x, other.z - monster.z);
    if (distance < best) {
      best = distance;
      nearest = other;
    }
  }
  if (!nearest) {
    return;
  }
  playEffect("lightning", nearest.x, nearest.z, { size: 1.6, y: 0.2, tint: 0x9ad0ff });
  burst(nearest.x, 0.8, nearest.z, { color: 0x9ad0ff, count: 10, speed: 3 });
  hitMonster(nearest, blow(damage), "chain");
}

/** A blow is about to land on the hero: a block takes part of it. Returns what is left. */
export function blockWithItems(damage) {
  for (const block of heroEffects(player).block) {
    if (Math.random() < block.chance) {
      UI.floatingText(player.x, player.sprite.height + 0.3, player.z, camera, "Block", "miss");
      sfx.hammer();
      return Math.max(1, Math.round(damage * (1 - block.share)));
    }
  }
  return damage;
}

/** A blow landed on the hero: thorns burn the attacker, and a last stand may catch them. */
export function afterHeroHurt(damage, attacker) {
  const effects = heroEffects(player);
  if (attacker && !attacker.isDead) {
    for (const thorns of effects.thorns) {
      if (Math.random() < thorns.chance) {
        playEffect("fire", attacker.x, attacker.z, { size: 1.3, y: attacker.sprite.height * 0.4 });
        hitMonster(attacker, blow(damage * thorns.share), "thorns");
        break;
      }
    }
  }
  const time = now();
  for (const stand of effects.lastStand) {
    if (
      player.hp > 0 &&
      player.hp < hpMax() * stand.below &&
      time >= (lastStandReady.get(stand.id) || 0)
    ) {
      lastStandReady.set(stand.id, time + stand.cooldown);
      heal(hpMax() * stand.heal, "Last stand!");
      groundRing(player.x, player.z, stand.nova ? 0xff8a2a : 0xd0303c, 0.4, 3, 0.7, 0.9);
      burst(player.x, 1, player.z, {
        color: stand.nova ? 0xff8a2a : 0xd0303c,
        count: 30,
        speed: 4,
        size: 3,
      });
      sfx.levelUp();
      if (stand.nova) {
        nova(stand.nova);
      }
      break;
    }
  }
}

/* flames burst round the hero and burn every monster close by */
function nova(multiple) {
  const stats = derived();
  playEffect("fire_ring", player.x, player.z, { size: 6, y: 0.1 });
  for (const monster of monsters.values()) {
    if (!monster.isDead && Math.hypot(monster.x - player.x, monster.z - player.z) < 3.2) {
      hitMonster(monster, blow(Math.max(stats.atk, stats.matk) * multiple), "nova");
    }
  }
}

/** Per frame: monsters set ablaze burn on, one blow a second. */
export function updateItemEffects() {
  const time = now();
  for (const monster of monsters.values()) {
    const burn = monster.itemBurn;
    if (!burn) {
      continue;
    }
    if (monster.isDead || burn.left <= 0) {
      monster.itemBurn = null;
      continue;
    }
    if (time >= burn.next) {
      burn.next = time + 1;
      burn.left--;
      playEffect("fire", monster.x, monster.z, { size: 1.1, y: monster.sprite.height * 0.4 });
      hitMonster(monster, blow(burn.damage), "burn");
    }
  }
}
