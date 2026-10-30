/* Eldoria – using skills from the hotbar: the red potion, sitting, and every active skill of the six classes.
   Each skill spends SP, starts its cooldown, plays its effects and hits monsters through hitMonster()
   (player.js); freezes are sent to the host or server as freeze events. */
import { ITEMS } from "./data.js";
import { SKILLS } from "./rules/skills.js";
import { meleeHit, spellHit, monsterCombatStats } from "./rules/combat.js";
import { sfx } from "./audio.js";
import { camera, resolveCollision, shakeCamera } from "./world.js";
import * as UI from "./ui.js";
import {
  player,
  monsters,
  game,
  now,
  playEffect,
  heroClass,
  derived,
  hpMax,
  spMax,
} from "./game-state.js";
import { setSitting, playOnce, hitMonster } from "./player.js";
import { bagCount, removeFromBag } from "./bag.js";
import {
  flamesAround,
  iceShardsAround,
  runeCircle,
  stopAfter,
  screenAngle,
  flyEffect,
  launchProjectile,
  groundRing,
  wardAura,
} from "./skill-effects.js";

/** Uses a hotbar entry: "sit", "red_potion" or a skill id. */
export function useSkill(id) {
  if (player.isDead || !game.isStarted) {
    return;
  }
  const time = now();
  if (id === "sit") {
    setSitting(!player.isSitting);
    return;
  }
  if ((player.cooldowns[id] || 0) > time) {
    return;
  }
  if (id === "red_potion") {
    drinkPotion(time);
    return;
  }
  const skill = SKILLS[id];
  const level = player.skills[id] || 0;
  if (!skill || skill.passive) {
    return;
  }
  if (level <= 0) {
    UI.systemMessage(
      `You have not learned ${skill.name} yet. Spend skill points in your character sheet (C).`,
    );
    return;
  }
  /* Clear Mind makes every skill cheaper */
  const spCost = Math.max(
    0,
    Math.round(skill.spCost(level) * (1 - passiveValue("clear_mind", "discount"))),
  );
  if (player.sp < spCost) {
    UI.systemMessage("Not enough SP.");
    return;
  }
  const cast = SKILL_CASTS[id];
  if (cast) {
    cast({ id, skill, level, stats: derived(), spCost, time });
  }
}

function drinkPotion(time) {
  const potion = ITEMS.red_potion;
  if (bagCount("red_potion") <= 0) {
    UI.systemMessage("You are out of potions. Merchant Bram at the stall sells them.");
    return;
  }
  if (player.hp >= hpMax()) {
    return;
  }
  removeFromBag("red_potion");
  // send the HP from before drinking: the server's copy may be several seconds old
  game.network.heroAction("drink", { id: "red_potion", hp: Math.round(player.hp) });
  sfx.potion();
  playEffect("sparkle", player.x, player.z, { size: 2, grounded: true, follow: player });
  player.hp = Math.min(hpMax(), player.hp + potion.heal);
  player.cooldowns.red_potion = time + potion.cooldown;
  UI.floatingText(player.x, player.sprite.height, player.z, camera, "+" + potion.heal, "heal");
  game.characterSheet.render();
  game.inventory.render();
}

/* The value `field` of a learned passive skill at its level (0 when not learned). */
function passiveValue(skillId, field) {
  const skill = SKILLS[skillId];
  const level = player.skills[skillId] || 0;
  return skill && level > 0 && skill[field] ? skill[field](level) : 0;
}

/* SP and cooldown of the skill being cast */
function spend(cast) {
  player.sp -= cast.spCost;
  player.cooldowns[cast.id] = cast.time + cast.skill.cooldown;
}

function standUp() {
  if (player.isSitting) {
    setSitting(false);
  }
}

/* The target when it is alive and within `range`. Out of range the skill is queued: it fires once the
   player has walked up to the target. */
function targetInRange(cast, range) {
  if (!player.target || player.target.isDead) {
    UI.systemMessage("Pick a target first: tap or click a monster.");
    return null;
  }
  const monster = player.target;
  /* a skill on the target starts the fight */
  player.isAttacking = true;
  if (Math.hypot(monster.x - player.x, monster.z - player.z) > range) {
    player.queuedSkill = cast.id;
    return null;
  }
  return monster;
}

/* A strike on the target within reach (the skill's range or the class's melee range): spends SP, plays the
   attack and returns the target, or null. */
function startTargetedStrike(cast) {
  const monster = targetInRange(cast, cast.skill.range || heroClass().range);
  if (!monster) {
    return null;
  }
  spend(cast);
  standUp();
  player.nextAttackAt = cast.time + cast.stats.attackInterval;
  playOnce("attack", 0.5);
  player.sprite.face(monster.x - player.x, monster.z - player.z);
  sfx.skill();
  return monster;
}

/* every visible living monster within `radius` of (x, z) */
function monstersInRadius(x, z, radius) {
  return [...monsters.values()].filter(
    (monster) =>
      !monster.isDead &&
      monster.sprite.group.visible &&
      Math.hypot(monster.x - x, monster.z - z) <= radius,
  );
}

/* tells the host or server that these monsters are frozen */
function sendFreeze(ids, duration) {
  game.network.send("freeze", { ids, duration });
}

function freezeMonster(monster, duration) {
  monster.frozenUntil = now() + duration;
}

/* a strike that never misses, for skills */
const sureHit = (cast, monster) =>
  meleeHit(
    { ...cast.stats, hit: 999, mult: cast.skill.mult(cast.level) },
    monsterCombatStats(monster.spec),
  );
const spell = (cast) => spellHit({ matk: cast.stats.matk, mult: cast.skill.mult(cast.level) });

/* ---- swordsman ---- */

function crushingBlow(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  player.sprite.nudge(monster.x - player.x, monster.z - player.z, 0.25);
  const result = meleeHit(
    { ...cast.stats, mult: cast.skill.mult(cast.level) },
    monsterCombatStats(monster.spec),
  );
  /* Stunning Strike: a chance to stun the target for a moment */
  const stunDuration =
    !result.miss && Math.random() < passiveValue("stunning_strike", "chance") ? 0.8 : 0;
  setTimeout(() => {
    if (monster.isDead) {
      return;
    }
    hitMonster(monster, result, "crushing_blow");
    playEffect("swing", monster.x, monster.z, { size: 2.6, y: 0.8, mirror: monster.x < player.x });
    playEffect("shockwave", monster.x, monster.z, {
      size: 2.2,
      y: 0.08,
      tint: 0xdfe6f5,
      delay: 0.06,
    });
    if (stunDuration) {
      freezeMonster(monster, stunDuration);
      sendFreeze([monster.id], stunDuration);
      playEffect("spark", monster.x, monster.z, { size: 1.6, y: 0.8 });
      UI.floatingText(monster.x, monster.sprite.height + 0.3, monster.z, camera, "Stun!", "miss");
    }
  }, 220);
}

function flameSweep(cast) {
  const { skill } = cast;
  spend(cast);
  standUp();
  playOnce("attack", 0.6);
  groundRing(player.x, player.z, 0xff8c42, 0.4, skill.radius, 0.45, 0.9);
  sfx.skill();
  shakeCamera(0.15, 0.2);
  playEffect("fire_ring", player.x, player.z, { size: skill.radius * 2.3, y: 0.1 });
  playEffect("shockwave", player.x, player.z, {
    size: skill.radius * 2.4,
    y: 0.08,
    tint: 0xffb060,
  });
  flamesAround(player.x, player.z, 1.9, 4, 1.1, "fire_pillar", 2.4);
  playEffect("swing", player.x, player.z, { size: 3.2, y: 1, tint: 0xffc080, follow: player });
  setTimeout(() => {
    const targets = monstersInRadius(player.x, player.z, skill.radius);
    for (const monster of targets) {
      const result = meleeHit(
        { ...cast.stats, hit: 999, mult: skill.mult(cast.level) * cast.stats.skillBonus },
        monsterCombatStats(monster.spec),
      );
      hitMonster(monster, result, "flame_sweep");
    }
    if (!targets.length) {
      UI.systemMessage(skill.name + " hit nothing.");
    }
  }, 200);
}

/* War Cry: draws every monster nearby to the player (the host or server makes them hunt the player) */
function warCry(cast) {
  const { skill, level } = cast;
  spend(cast);
  standUp();
  playOnce("hurt", 0.3);
  const radius = skill.radius(level);
  groundRing(player.x, player.z, 0xff4d4d, 0.3, radius, 0.5, 0.7);
  playEffect("shockwave", player.x, player.z, { size: radius * 2.2, y: 0.08, tint: 0xff6060 });
  playEffect("shockwave", player.x, player.z, {
    size: radius * 1.4,
    y: 0.08,
    tint: 0xff9090,
    delay: 0.12,
  });
  playEffect("burst", player.x, player.z, { size: 2.4, y: 1.6, tint: 0xff6060, follow: player });
  const count = monstersInRadius(player.x, player.z, radius).length;
  game.network.send("provoke", { x: +player.x.toFixed(2), z: +player.z.toFixed(2), radius });
  UI.systemMessage(
    count
      ? `You provoke ${count} monster${count === 1 ? "" : "s"}.`
      : "There is nobody to provoke.",
  );
}

function quickening(cast) {
  const { skill, level } = cast;
  spend(cast);
  player.quickenUntil = cast.time + skill.duration(level);
  player.quickenFactor = skill.factor(level);
  groundRing(player.x, player.z, 0xffd27a, 0.3, 1.6, 0.5, 0.9);
  playEffect("sparkle", player.x, player.z, {
    size: 2.2,
    grounded: true,
    follow: player,
    tint: 0xfff0b0,
  });
  stopAfter(
    playEffect("whirl", player.x, player.z, {
      size: 2.6,
      y: 0.9,
      loop: true,
      follow: player,
      additive: true,
      tint: 0xfff0b0,
    }),
    0.9,
  );
  sfx.skill();
  const faster = Math.round((1 - skill.factor(level)) * 100);
  UI.systemMessage(`${skill.name}: ${faster}% faster attacks for ${skill.duration(level)}s.`);
}

/* ---- mage ---- */

function emberBolt(cast) {
  const monster = targetInRange(cast, cast.skill.range);
  if (!monster) {
    return;
  }
  spend(cast);
  standUp();
  player.nextAttackAt = cast.time + Math.max(cast.stats.attackInterval, 0.6);
  playOnce("attack", 0.45);
  player.sprite.face(monster.x - player.x, monster.z - player.z);
  sfx.skill();
  const result = spell(cast);
  launchProjectile(player.x, player.z, monster, 0xff8c42, () => {
    if (!monster.isDead) {
      hitMonster(monster, result, "ember_bolt");
      playEffect("explosion", monster.x, monster.z, { size: 2.2, grounded: true, y: -0.1 });
    }
  });
}

function frostburst(cast) {
  const { skill, level } = cast;
  spend(cast);
  standUp();
  playOnce("attack", 0.6);
  groundRing(player.x, player.z, 0x9ad8ff, 0.4, skill.radius, 0.5, 0.9);
  sfx.skill();
  shakeCamera(0.12, 0.2);
  runeCircle(0x9ad8ff, 0.6);
  playEffect("frost_ground", player.x, player.z, { size: skill.radius * 2.6, y: 0.06 });
  iceShardsAround(player.x, player.z, skill.radius * 0.72, 5, 1.7);
  stopAfter(
    playEffect("snow", player.x, player.z, { size: skill.radius * 2.2, y: 1.4, loop: true }),
    0.8,
  );
  setTimeout(() => {
    const ids = [];
    for (const monster of monstersInRadius(player.x, player.z, skill.radius)) {
      hitMonster(monster, spell(cast), "frostburst");
      freezeMonster(monster, skill.freeze(level));
      ids.push(monster.id);
    }
    if (ids.length) {
      sendFreeze(ids, skill.freeze(level));
    } else {
      UI.systemMessage(skill.name + " hit nothing.");
    }
  }, 200);
}

/* Mana Ward and Mana Shell: part of every blow is taken from SP for a while (see takeDamage in player.js) */
function startWard(cast) {
  const { skill, level } = cast;
  spend(cast);
  player.wardUntil = cast.time + skill.duration(level);
  player.wardShare = skill.share(level);
}

function wardMessage(cast) {
  const { skill, level } = cast;
  const percentage = Math.round(skill.share(level) * 100);
  UI.systemMessage(
    `${skill.name}: ${percentage}% of damage is taken from your SP for ${skill.duration(level)}s.`,
  );
}

function manaWard(cast) {
  startWard(cast);
  wardAura(0xd8c0ff);
  runeCircle(0xd8c0ff, 0.8);
  playEffect("burst", player.x, player.z, { size: 2.4, y: 1, tint: 0xd8c0ff, follow: player });
  groundRing(player.x, player.z, 0x8ad0ff, 0.3, 1.6, 0.6, 0.9);
  sfx.skill();
  wardMessage(cast);
}

function iceShard(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const { skill, level } = cast;
  const result = spell(cast);
  const onHit = () => {
    if (monster.isDead) {
      return;
    }
    hitMonster(monster, result, "ice_shard");
    freezeMonster(monster, skill.freeze(level));
    sendFreeze([monster.id], skill.freeze(level));
    playEffect("ice_shards", monster.x, monster.z, { size: 2, grounded: true });
    playEffect("splatter", monster.x, monster.z, { size: 1.4, y: 0.7, tint: 0xe0f8ff });
  };
  launchProjectile(player.x, player.z, monster, 0x9ad8ff, onHit, "ice_bolt", 1.5);
  player.sprite.nudge(player.x - monster.x, player.z - monster.z, 0.12);
}

/* Spirit Volley: a series of bolts, one every 170 ms */
function spiritVolley(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const boltCount = cast.skill.bolts(cast.level);
  for (let k = 0; k < boltCount; k++) {
    setTimeout(() => {
      if (monster.isDead || player.isDead) {
        return;
      }
      const result = spell(cast);
      const onHit = () => {
        if (!monster.isDead) {
          hitMonster(monster, result, "spirit_volley");
          playEffect("sparkle", monster.x, monster.z, {
            size: 1.6,
            grounded: true,
            tint: 0xd8c8ff,
          });
        }
      };
      launchProjectile(player.x, player.z, monster, 0xd8c8ff, onHit, "spirit", 1.5);
    }, k * 170);
  }
}

/* ---- knight and crusader ---- */

function piercingThrust(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  player.sprite.nudge(monster.x - player.x, monster.z - player.z, 0.5);
  playEffect(
    "drill",
    player.x + (monster.x - player.x) * 0.55,
    player.z + (monster.z - player.z) * 0.55,
    { size: 1.3, y: 0.9, angle: screenAngle(player.x, player.z, monster.x, monster.z) },
  );
  const result = sureHit(cast, monster);
  setTimeout(() => {
    if (!monster.isDead) {
      hitMonster(monster, result, "piercing_thrust");
      playEffect("shockwave", monster.x, monster.z, { size: 2.4, y: 0.08, tint: 0xdfe6f5 });
      playEffect("flash", monster.x, monster.z, { size: 2, y: 0.7 });
    }
  }, 200);
}

function radiantCross(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  player.sprite.nudge(monster.x - player.x, monster.z - player.z, 0.25);
  groundRing(monster.x, monster.z, 0xfff2b0, 0.2, 1.2, 0.35, 0.9);
  /* holy damage: half of MATK adds to ATK */
  const result = meleeHit(
    {
      ...cast.stats,
      atk: cast.stats.atk + cast.stats.matk * 0.5,
      mult: cast.skill.mult(cast.level),
    },
    monsterCombatStats(monster.spec),
  );
  setTimeout(() => {
    if (!monster.isDead) {
      hitMonster(monster, result, "radiant_cross");
      playEffect("holy_cross", monster.x, monster.z, { size: 3.2, y: 0.9, follow: monster });
      playEffect("sparkle", monster.x, monster.z, {
        size: 2,
        grounded: true,
        tint: 0xfff4c0,
        delay: 0.1,
      });
    }
  }, 200);
}

/* Shield Rush: leap at the target and stun it */
function shieldRush(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const { skill, level } = cast;
  const dx = monster.x - player.x;
  const dz = monster.z - player.z;
  const distance = Math.hypot(dx, dz) || 1;
  playEffect("smoke", player.x, player.z, { size: 1.8, grounded: true });
  if (distance > 1.2) {
    [player.x, player.z] = resolveCollision(
      monster.x - (dx / distance) * 1,
      monster.z - (dz / distance) * 1,
    );
  }
  player.sprite.nudge(dx, dz, 0.5);
  shakeCamera(0.15, 0.15);
  const result = sureHit(cast, monster);
  setTimeout(() => {
    if (monster.isDead) {
      return;
    }
    hitMonster(monster, result, "shield_rush");
    freezeMonster(monster, skill.freeze(level));
    sendFreeze([monster.id], skill.freeze(level));
    playEffect("spark", monster.x, monster.z, { size: 1.8, y: 0.6 });
    playEffect("shockwave", monster.x, monster.z, { size: 2.8, y: 0.08, tint: 0xfff0b0 });
    playEffect("holy_cross", monster.x, monster.z, { size: 2, y: 0.8, delay: 0.05 });
  }, 150);
}

function whirlwindSweep(cast) {
  const { skill } = cast;
  spend(cast);
  standUp();
  playOnce("attack", 0.6);
  groundRing(player.x, player.z, 0xffd27a, 0.4, skill.radius, 0.4, 0.9);
  sfx.skill();
  shakeCamera(0.2, 0.2);
  stopAfter(
    playEffect("whirl", player.x, player.z, {
      size: skill.radius * 2.1,
      y: 0.9,
      loop: true,
      follow: player,
    }),
    0.7,
  );
  playEffect("shockwave", player.x, player.z, {
    size: skill.radius * 2.4,
    y: 0.08,
    tint: 0xffd27a,
    delay: 0.15,
  });
  setTimeout(() => {
    const targets = monstersInRadius(player.x, player.z, skill.radius);
    for (const monster of targets) {
      hitMonster(monster, sureHit(cast, monster), "whirlwind_sweep");
      playEffect("splatter", monster.x, monster.z, { size: 1.5, y: 0.6, tint: 0xffd27a });
    }
    if (!targets.length) {
      UI.systemMessage(skill.name + " hit nothing.");
    }
  }, 180);
}

/* Iron Resolve: extra DEF, and nothing pushes the hero (see takeDamage in player.js) */
function ironResolve(cast) {
  const { skill, level } = cast;
  spend(cast);
  player.ironResolveUntil = cast.time + skill.duration(level);
  player.ironResolveDef = skill.def(level);
  groundRing(player.x, player.z, 0xd9b25a, 0.3, 1.5, 0.5, 0.9);
  if (player.ironResolveEffect) {
    player.ironResolveEffect.stop();
  }
  player.ironResolveEffect = playEffect("shield_dome", player.x, player.z, {
    size: 2.9,
    y: 0.05,
    grounded: true,
    tint: 0xffd27a,
    loop: true,
    follow: player,
    additive: true,
  });
  playEffect("shockwave", player.x, player.z, { size: 3, y: 0.08, tint: 0xffd27a });
  sfx.skill();
  UI.systemMessage(
    `${skill.name}: DEF +${skill.def(level)}, nothing moves you for ${skill.duration(level)}s.`,
  );
}

/* Spiral Lance: several quick thrusts */
function spiralLance(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const { skill } = cast;
  player.sprite.nudge(monster.x - player.x, monster.z - player.z, 0.3);
  const angle = screenAngle(player.x, player.z, monster.x, monster.z);
  for (let k = 0; k < skill.hits; k++) {
    setTimeout(
      () => {
        if (monster.isDead) {
          return;
        }
        hitMonster(monster, sureHit(cast, monster), "spiral_lance");
        playEffect(
          "drill",
          player.x + (monster.x - player.x) * 0.55,
          player.z + (monster.z - player.z) * 0.55,
          { size: 1.2, y: 0.9, angle: angle + (k - 1) * 0.3 },
        );
        playEffect("swing", monster.x, monster.z, { size: 2, y: 0.8, mirror: k % 2 === 1 });
        if (k === skill.hits - 1) {
          playEffect("shockwave", monster.x, monster.z, { size: 2.6, y: 0.08, tint: 0xdfe6f5 });
        }
      },
      150 + k * 160,
    );
  }
}

/* Mending Light: heals a share of the maximum HP */
function mendingLight(cast) {
  const { skill, level } = cast;
  if (player.hp >= hpMax()) {
    UI.systemMessage("You are at full health.");
    return;
  }
  spend(cast);
  const healed = Math.round(hpMax() * skill.share(level));
  player.hp = Math.min(hpMax(), player.hp + healed);
  groundRing(player.x, player.z, 0x7cf5a0, 0.3, 1.6, 0.6, 0.9);
  UI.floatingText(player.x, player.sprite.height, player.z, camera, "+" + healed, "heal");
  sfx.potion();
  game.characterSheet.render();
  playEffect("green_burst", player.x, player.z, { size: 3.6, y: 0.2 });
  stopAfter(
    playEffect("light_rays", player.x, player.z, {
      size: 3.6,
      grounded: true,
      loop: true,
      follow: player,
      additive: true,
    }),
    1.3,
  );
  playEffect("hearts", player.x, player.z, {
    size: 2.2,
    y: 1.3,
    follow: player,
    tint: 0xffe0a0,
    delay: 0.15,
  });
}

/* ---- wizard and sage ---- */

function thunderclap(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const result = spell(cast);
  runeCircle(0xbfe8ff, 0.5);
  playEffect("lightning", monster.x, monster.z, { size: 5, grounded: true, follow: monster });
  player.sprite.nudge(player.x - monster.x, player.z - monster.z, 0.12);
  setTimeout(() => {
    if (!monster.isDead) {
      hitMonster(monster, result, "thunderclap");
      playEffect("spark", monster.x, monster.z, { size: 2, y: 0.4 });
      playEffect("shockwave", monster.x, monster.z, { size: 2.6, y: 0.08, tint: 0xbfe8ff });
      shakeCamera(0.14, 0.18);
    }
  }, 300);
}

function stoneSpires(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const result = spell(cast);
  runeCircle(0xc9a06a, 0.5);
  playEffect("rubble", monster.x, monster.z, { size: 2.8, grounded: true, follow: monster });
  playEffect("spikes", monster.x, monster.z, {
    size: 2.6,
    grounded: true,
    follow: monster,
    delay: 0.08,
  });
  playEffect("roots", monster.x, monster.z, {
    size: 2.2,
    grounded: true,
    follow: monster,
    delay: 0.15,
  });
  player.sprite.nudge(player.x - monster.x, player.z - monster.z, 0.12);
  setTimeout(() => {
    if (!monster.isDead) {
      hitMonster(monster, result, "stone_spires");
      shakeCamera(0.1, 0.15);
    }
  }, 350);
}

function blizzard(cast) {
  const { skill, level } = cast;
  spend(cast);
  standUp();
  playOnce("attack", 0.7);
  groundRing(player.x, player.z, 0xbfe8ff, 0.4, skill.radius, 0.7, 0.9);
  groundRing(player.x, player.z, 0xffffff, 0.2, skill.radius * 0.6, 0.5, 0.6);
  sfx.skill();
  shakeCamera(0.2, 0.3);
  runeCircle(0xbfe8ff, 1);
  playEffect("frost_ground", player.x, player.z, { size: skill.radius * 2.5, y: 0.06 });
  iceShardsAround(player.x, player.z, skill.radius * 0.8, 8, 2.1);
  iceShardsAround(player.x, player.z, skill.radius * 0.4, 4, 1.6);
  stopAfter(
    playEffect("snow", player.x, player.z, { size: skill.radius * 2.6, y: 2, loop: true }),
    1.6,
  );
  playEffect("shockwave", player.x, player.z, {
    size: skill.radius * 2.4,
    y: 0.08,
    tint: 0xdff4ff,
  });
  setTimeout(() => {
    const ids = [];
    for (const monster of monstersInRadius(player.x, player.z, skill.radius)) {
      hitMonster(monster, spell(cast), "blizzard");
      playEffect("splatter", monster.x, monster.z, { size: 1.5, y: 0.5, tint: 0xdff4ff });
      freezeMonster(monster, skill.freeze(level));
      ids.push(monster.id);
    }
    if (ids.length) {
      sendFreeze(ids, skill.freeze(level));
    } else {
      UI.systemMessage(skill.name + " hit nothing.");
    }
  }, 250);
}

function manaShell(cast) {
  startWard(cast);
  wardAura(0xa8dcff);
  groundRing(player.x, player.z, 0x5fb0ff, 0.3, 1.8, 0.7, 0.9);
  runeCircle(0x8ad0ff, 0.8);
  playEffect("shockwave", player.x, player.z, { size: 3, y: 0.08, tint: 0x8ad0ff });
  sfx.skill();
  wardMessage(cast);
}

/* Starfall: a comet crashes down on the target's spot and hits everything around it */
function starfall(cast) {
  const monster = startTargetedStrike(cast);
  if (!monster) {
    return;
  }
  const { skill } = cast;
  const impactX = monster.x;
  const impactZ = monster.z;
  runeCircle(0xffb060, 0.7);
  playEffect("comet", impactX - 2.5, impactZ - 4, {
    size: 3.2,
    y: 5,
    mirror: false,
    loop: true,
  }).stop();
  const comet = playEffect("comet", impactX - 3, impactZ, { size: 3.4, y: 6, loop: true });
  flyEffect(comet, impactX - 3, impactZ, { x: impactX, z: impactZ }, 0.55, () => {});
  setTimeout(() => {
    playEffect("mushroom_cloud", impactX, impactZ, {
      size: skill.radius * 3,
      grounded: true,
      y: -0.1,
    });
    playEffect("fire_ring", impactX, impactZ, { size: skill.radius * 2.2, y: 0.2, delay: 0.08 });
    flamesAround(impactX, impactZ, 1.8, 4, 2.2);
    shakeCamera(0.35, 0.35);
    sfx.hit(true);
    for (const target of monstersInRadius(impactX, impactZ, skill.radius)) {
      hitMonster(target, spell(cast), "starfall");
    }
  }, 600);
}

/* Wellspring: restores a share of the maximum SP; costs no SP */
function wellspring(cast) {
  const { skill, level } = cast;
  if (player.sp >= spMax()) {
    UI.systemMessage("Your SP is full.");
    return;
  }
  player.cooldowns.wellspring = cast.time + skill.cooldown;
  const restored = Math.round(spMax() * skill.share(level));
  player.sp = Math.min(spMax(), player.sp + restored);
  groundRing(player.x, player.z, 0x8ad0ff, 0.3, 1.6, 0.6, 0.9);
  UI.floatingText(player.x, player.sprite.height, player.z, camera, "+" + restored + " SP", "miss");
  sfx.potion();
  game.characterSheet.render();
  runeCircle(0x8fe0a0, 1);
  playEffect("splash", player.x, player.z, {
    size: 3,
    grounded: true,
    tint: 0x7fb8ff,
    follow: player,
  });
  stopAfter(
    playEffect("leaves", player.x, player.z, { size: 2.8, y: 0.6, loop: true, follow: player }),
    1.1,
  );
  playEffect("sparkle", player.x, player.z, {
    size: 2.2,
    grounded: true,
    follow: player,
    tint: 0x9fd0ff,
    delay: 0.1,
  });
}

/* skill id → what it does; `cast` is {id, skill, level, stats, spCost, time} */
const SKILL_CASTS = {
  crushing_blow: crushingBlow,
  flame_sweep: flameSweep,
  war_cry: warCry,
  quickening,
  ember_bolt: emberBolt,
  frostburst,
  mana_ward: manaWard,
  ice_shard: iceShard,
  spirit_volley: spiritVolley,
  piercing_thrust: piercingThrust,
  radiant_cross: radiantCross,
  shield_rush: shieldRush,
  whirlwind_sweep: whirlwindSweep,
  iron_resolve: ironResolve,
  spiral_lance: spiralLance,
  mending_light: mendingLight,
  thunderclap,
  stone_spires: stoneSpires,
  blizzard,
  mana_shell: manaShell,
  starfall,
  wellspring,
};
