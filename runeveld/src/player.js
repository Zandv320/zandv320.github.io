/* Eldoria – the player's hero in the world: walking (keys, click-to-move, following a target), sitting,
   basic attacks, hitting monsters, taking damage, dying and respawning, and rewards with level ups. */
import { CLASSES, ADVANCEMENTS, MAX_LEVEL, expForLevel, ITEMS } from "./data.js";
import { statCost, MAX_STAT } from "./rules/stats.js";
import { SKILLS, jobExpForLevel, JOB_EXP_SHARE, canLearn } from "./rules/skills.js";
import { meleeHit, spellHit, applyDefense, hitChance, monsterCombatStats } from "./rules/combat.js";
import { sfx } from "./audio.js";
import { icon } from "./icons.js";
import { camera, cameraState, resolveCollision, FIELD_SIZE, shakeCamera } from "./world.js";
import * as UI from "./ui.js";
import {
  player,
  game,
  ADMIN,
  now,
  playEffect,
  heroClass,
  maxJobLevel,
  derived,
  hpMax,
  spMax,
  freeStatPoints,
  freeSkillPoints,
} from "./game-state.js";
import { knockBack } from "./monsters.js";
import { addToBag } from "./bag.js";
import { groundRing, launchProjectile } from "./skill-effects.js";
import { hitStop, buzz, flyToHud } from "./feel.js";
import { useSkill } from "./abilities.js";

/** Keys held down (KeyboardEvent.code), filled by the input handlers in main.js. */
export const pressedKeys = new Set();
/** True while the chat input has focus: keys then type text instead of moving. */
export const isChatActive = () => document.activeElement === document.querySelector("#chat-input");

/* seconds before a defeated hero is back at the well */
const RESPAWN_DELAY = 5;

export function setAnim(name) {
  if (player.anim === name) {
    return;
  }
  player.anim = name;
  player.sprite.play(name);
}

/** Plays a one-shot animation (attack, hurt, death) and keeps the hero busy for `duration` seconds. */
export function playOnce(name, duration) {
  player.anim = name;
  player.seq++;
  player.sprite.play(name, true);
  player.busyUntil = now() + duration;
}

export function setSitting(isSitting) {
  if (player.isDead || player.isSitting === isSitting) {
    return;
  }
  player.isSitting = isSitting;
  if (isSitting) {
    player.destination = null;
    player.target = null;
    UI.setTargetFrame(null);
    setAnim("sit");
  } else {
    setAnim("idle");
  }
}

/** Drops the current target and any skill waiting for it. */
export function clearTarget() {
  player.target = null;
  player.isAttacking = false;
  player.queuedSkill = null;
  UI.setTargetFrame(null);
}

/* Targeting works as in the classic MMOs: selecting a monster (left click, or a first tap) only shows it in the
   target frame; attacking (right click, a second tap, or a skill) walks up to it and keeps fighting. */

/** Selects a monster without attacking it. */
export function selectTarget(monster) {
  if (player.target !== monster) {
    player.queuedSkill = null;
  }
  player.target = monster;
  player.isAttacking = false;
  UI.setTargetFrame(monster);
}

/** Selects a monster and attacks it: walk up to it and keep swinging (or casting). */
export function attackTarget(monster) {
  selectTarget(monster);
  player.isAttacking = true;
  player.destination = null;
  player.onArrive = null;
  if (player.isSitting) {
    setSitting(false);
  }
}

/* The arrival callback for the current destination runs once. */
function arrive() {
  player.destination = null;
  if (player.onArrive) {
    const onArrive = player.onArrive;
    player.onArrive = null;
    onArrive();
  }
}

/* The movement direction from the keys (relative to the camera), or [0, 0]. */
function keyDirection(dt) {
  let moveX = 0;
  let moveZ = 0;
  if (!isChatActive()) {
    if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
      moveZ -= 1;
    }
    if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
      moveZ += 1;
    }
    if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
      moveX -= 1;
    }
    if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
      moveX += 1;
    }
    /* Q and E turn the camera */
    if (pressedKeys.has("KeyQ")) {
      cameraState.yaw += dt * 1.8;
    }
    if (pressedKeys.has("KeyE")) {
      cameraState.yaw -= dt * 1.8;
    }
  }
  if (!moveX && !moveZ) {
    return [0, 0];
  }
  const sinYaw = Math.sin(cameraState.yaw);
  const cosYaw = Math.cos(cameraState.yaw);
  const dx = moveZ * sinYaw + moveX * cosYaw;
  const dz = moveZ * cosYaw - moveX * sinYaw;
  const length = Math.hypot(dx, dz);
  return [dx / length, dz / length];
}

/* Moves towards the target until in range, then uses the queued skill or attacks. Returns the walk direction. */
function followTarget(time, isBusy) {
  const monster = player.target;
  if (monster.isDead || !monster.sprite.group.visible) {
    clearTarget();
    return [0, 0];
  }
  const dx = monster.x - player.x;
  const dz = monster.z - player.z;
  const distance = Math.hypot(dx, dz);
  const queued = player.queuedSkill && SKILLS[player.queuedSkill];
  const range = queued && queued.range ? queued.range : heroClass().range;
  if (distance > range) {
    return [dx / distance, dz / distance];
  }
  player.sprite.face(dx, dz);
  if (player.queuedSkill) {
    const skillId = player.queuedSkill;
    player.queuedSkill = null;
    useSkill(skillId);
  } else if (player.isAttacking && !isBusy && time >= player.nextAttackAt) {
    basicAttack(monster);
  }
  return [0, 0];
}

/** Moves and animates the player for one frame, and regenerates HP and SP. */
export function updatePlayer(dt) {
  const time = now();
  if (player.isDead) {
    if (time > player.respawnAt) {
      respawn();
    }
    player.sprite.update(dt, cameraState);
    UI.positionLabel(player.label, player.x, player.sprite.height + 0.15, player.z, camera);
    return;
  }
  const isBusy = time < player.busyUntil;

  /* keys win over a target, a target over a destination */
  let [dx, dz] = keyDirection(dt);
  if (dx || dz) {
    player.destination = null;
    player.onArrive = null;
    /* walking away stops the fight; the monster stays selected */
    player.isAttacking = false;
    player.queuedSkill = null;
  } else if (player.target && (player.isAttacking || player.queuedSkill)) {
    [dx, dz] = followTarget(time, isBusy);
  } else if (player.destination) {
    const toX = player.destination[0] - player.x;
    const toZ = player.destination[1] - player.z;
    const distance = Math.hypot(toX, toZ);
    if (distance < 0.15) {
      arrive();
    } else {
      dx = toX / distance;
      dz = toZ / distance;
    }
  }

  if ((dx || dz) && !isBusy) {
    if (player.isSitting) {
      setSitting(false);
    }
    if (game.dialogue.isOpen()) {
      game.dialogue.close();
    }
    const step = heroClass().speed * ADMIN.speed * dt;
    let newX;
    let newZ;
    if (ADMIN.noclip) {
      const limit = FIELD_SIZE - 1;
      newX = Math.max(-limit, Math.min(limit, player.x + dx * step));
      newZ = Math.max(-limit, Math.min(limit, player.z + dz * step));
    } else {
      [newX, newZ] = resolveCollision(player.x + dx * step, player.z + dz * step);
    }
    /* walking into something on the way to a destination: stop there */
    if (player.destination && Math.hypot(newX - player.x, newZ - player.z) < step * 0.2) {
      arrive();
    }
    player.x = newX;
    player.z = newZ;
    player.sprite.face(dx, dz);
    setAnim("walk");
  } else if (time >= player.busyUntil) {
    /* checked again: an attack in this frame sets busyUntil */
    setAnim(player.isSitting ? "sit" : player.workAnim || "idle");
  }
  player.sprite.group.position.set(player.x, 0, player.z);
  player.sprite.update(dt, cameraState);
  UI.positionLabel(player.label, player.x, player.sprite.height + 0.15, player.z, camera);

  /* regeneration once per second, four times as fast while sitting */
  player.regenTimer += dt;
  if (player.regenTimer >= 1) {
    player.regenTimer -= 1;
    const stats = derived();
    const factor = player.isSitting ? 4 : 1;
    player.hp = Math.min(stats.hpMax, player.hp + stats.hpRegen * factor);
    player.sp = Math.min(stats.spMax, player.sp + stats.spRegen * factor);
  }
}

/* A mage's basic attack: a small bolt of raw magic, this share of MATK, that never misses */
const MAGIC_BOLT_SHARE = 0.5;

/** A basic attack on a monster in range; the hit lands a moment later, in the swing (or when the bolt arrives). */
function basicAttack(monster) {
  const stats = derived();
  const quickening = now() < (player.quickenUntil || 0) ? player.quickenFactor : 1;
  player.nextAttackAt = now() + stats.attackInterval * quickening;
  playOnce("attack", Math.min(0.45, stats.attackInterval * quickening * 0.8));
  if (heroClass().base === "mage") {
    player.sprite.face(monster.x - player.x, monster.z - player.z);
    sfx.cast();
    const result = spellHit({ matk: stats.matk, mult: MAGIC_BOLT_SHARE });
    launchProjectile(
      player.x,
      player.z,
      monster,
      0xbfd9ff,
      () => {
        if (!monster.isDead) {
          hitMonster(monster, result, "");
        }
      },
      "spirit",
      1.1,
    );
    return;
  }
  player.sprite.nudge(monster.x - player.x, monster.z - player.z, 0.18);
  sfx.swing();
  const result = meleeHit(stats, monsterCombatStats(monster.spec));
  setTimeout(() => {
    if (!monster.isDead) {
      hitMonster(monster, result, "");
    }
  }, 220);
}

/**
 * Applies an attack result (rules/combat.js) to a monster: damage number, knockback, sound, and the hit event
 * to the host or server. `kind` is "" for a basic attack, otherwise the skill id.
 */
export function hitMonster(monster, result, kind) {
  const numberHeight = monster.sprite.height * 0.8;
  if (result.miss) {
    UI.floatingText(monster.x, numberHeight, monster.z, camera, "Miss", "miss");
    sfx.miss();
    return;
  }
  const text = result.crit ? result.damage + "!" : result.damage;
  const style = result.crit ? "crit" : kind ? "skill" : "own";
  UI.floatingText(monster.x, numberHeight, monster.z, camera, text, style);
  const force = kind === "whirlwind_sweep" ? 1.2 : result.crit ? 0.45 : 0.28;
  knockBack(monster, monster.x - player.x, monster.z - player.z, force);
  /* the blow lands: hero and monster hold for a moment, longer on a critical hit */
  hitStop([monster.sprite, kind ? null : player.sprite], result.crit ? 0.09 : 0.045);
  sfx.hit(result.crit);
  if (result.crit && !kind) {
    playEffect("flash", monster.x, monster.z, { size: 1.4, y: 0.6, tint: 0xffe6a0 });
  }
  /* Mana Echo: spell damage gives back SP */
  if (result.magic && player.skills.mana_echo > 0) {
    const share = SKILLS.mana_echo.share(player.skills.mana_echo);
    player.sp = Math.min(spMax(), player.sp + result.damage * share);
  }
  if (result.crit) {
    shakeCamera(0.22, 0.2);
    buzz("crit");
  } else if (kind) {
    shakeCamera(0.1, 0.15);
  }
  weaponEnchantEffect(monster);
  /* the host (or server) applies the damage itself when the hit event arrives */
  if (!game.host) {
    monster.hp = Math.max(0, monster.hp - result.damage);
  }
  game.network.send("hit", {
    id: monster.id,
    damage: result.damage,
    pushX: +(monster.x - player.x).toFixed(2),
    pushZ: +(monster.z - player.z).toFixed(2),
    force,
  });
}

/* The element of an enchanted weapon shows on every hit; frost can freeze the target. */
function weaponEnchantEffect(monster) {
  const mods = player.equipmentMods && player.equipmentMods.weapon;
  const element = mods && mods.enchant;
  if (!element) {
    return;
  }
  const y = monster.sprite.height * 0.5;
  if (element === "flame") {
    playEffect("fire", monster.x, monster.z, { size: 1.1, y });
  } else if (element === "storms") {
    playEffect("spark", monster.x, monster.z, { size: 1.2, y, tint: 0xfff2a0 });
  } else if (element === "arcane") {
    playEffect("sparkle", monster.x, monster.z, { size: 1.2, y, tint: 0xd3a6ff });
  } else if (element === "frost") {
    playEffect("ice_shards", monster.x, monster.z, { size: 1, y, tint: 0xcfefff });
    if (!monster.isDead && Math.random() < derived().freezeChance) {
      const duration = 1.5;
      monster.frozenUntil = now() + duration;
      playEffect("frost", monster.x, monster.z, { size: 1.6, y });
      game.network.send("freeze", { ids: [monster.id], duration });
    }
  }
}

/* stat and skill points */
export function raiseStat(stat) {
  const value = player.stats[stat] || 1;
  const cost = statCost(value);
  if (value >= MAX_STAT || freeStatPoints() < cost) {
    return;
  }
  player.stats[stat] = value + 1;
  player.hp = Math.min(player.hp, hpMax());
  game.network.heroAction("stat", { stat });
}

export function raiseSkill(id) {
  if (freeSkillPoints() <= 0 || !canLearn(player.skills, id)) {
    return;
  }
  player.skills[id] = (player.skills[id] || 0) + 1;
  UI.systemMessage(`${SKILLS[id].name} is now level ${player.skills[id]}.`);
  game.network.heroAction("skill", { id });
}

/**
 * The player takes damage from a monster (`spec`, the attacking monster `attacker`; both may be null).
 * Monsters can miss; DEF, Iron Resolve, the mana wards and Aegis of Light reduce or return damage.
 */
export function takeDamage(damage, spec, attacker) {
  if (player.isDead || ADMIN.god) {
    return;
  }
  const stats = derived();
  if (spec && Math.random() > hitChance(monsterCombatStats(spec).hit, stats.flee)) {
    UI.floatingText(player.x, player.sprite.height, player.z, camera, "Miss", "miss");
    sfx.miss();
    return;
  }
  const isResolute = now() < (player.ironResolveUntil || 0);
  damage = applyDefense(damage, stats.def + (isResolute ? player.ironResolveDef || 0 : 0));

  /* Mana Ward / Mana Shell: part of the damage is taken from SP */
  if (now() < player.wardUntil && player.sp > 0) {
    const absorbed = Math.min(
      Math.floor(player.sp),
      Math.round(damage * (player.wardShare || 0.3)),
    );
    if (absorbed > 0) {
      player.sp -= absorbed;
      damage -= absorbed;
      UI.floatingText(
        player.x,
        player.sprite.height + 0.3,
        player.z,
        camera,
        "-" + absorbed + " SP",
        "miss",
      );
    }
  }
  player.hp -= damage;
  UI.floatingText(player.x, player.sprite.height, player.z, camera, damage, "hurt");
  player.sprite.flashHit();
  player.sprite.freeze(0.05);
  if (attacker) {
    attacker.sprite.freeze(0.05);
  }
  buzz("hurt");

  /* Aegis of Light: part of the damage goes back to the attacker */
  if (attacker && !attacker.isDead && player.skills.aegis_of_light > 0) {
    const returned = Math.round(damage * SKILLS.aegis_of_light.share(player.skills.aegis_of_light));
    if (returned > 0) {
      hitMonster(attacker, { miss: false, damage: returned, crit: false }, "aegis_of_light");
      playEffect("holy_cross", attacker.x, attacker.z, { size: 1.5, y: 0.8 });
      playEffect("flash", attacker.x, attacker.z, { size: 1.2, y: 0.6, tint: 0xfff0a0 });
    }
  }
  /* with Iron Resolve nothing pushes or shakes the hero */
  if (now() >= (player.ironResolveUntil || 0)) {
    if (attacker) {
      player.sprite.nudge(player.x - attacker.x, player.z - attacker.z, 0.22);
    }
    shakeCamera(Math.min(0.35, 0.08 + (damage / hpMax()) * 0.8), 0.2);
  }
  UI.hurtFlash();
  sfx.hurt();
  if (now() >= player.busyUntil) {
    playOnce("hurt", 0.25);
  }
  if (player.hp <= 0) {
    die();
  }
}

function die() {
  player.hp = 0;
  player.isDead = true;
  player.target = null;
  player.queuedSkill = null;
  player.destination = null;
  player.isSitting = false;
  UI.setTargetFrame(null);
  playOnce("death", 999);
  player.respawnAt = now() + RESPAWN_DELAY;
  sfx.death();
  buzz("death");
  shakeCamera(0.4, 0.4);
  UI.setLowHp(false);
  UI.announce("You were defeated", "You will be back at the well in 5 seconds.");
  UI.systemMessage("You were defeated.");
}

/* back at the well in the village, with full HP and SP */
function respawn() {
  player.isDead = false;
  player.hp = hpMax();
  player.sp = spMax();
  player.x = 0;
  player.z = 4;
  player.busyUntil = 0;
  player.anim = "";
  setAnim("idle");
  game.network.heroAction("respawn", {});
  groundRing(player.x, player.z, 0x7cf5a0, 0.3, 1.8, 0.6, 0.8);
}

/* level ups: full HP and SP, effects and a message */
function celebrateLevelUp() {
  sfx.levelUp();
  buzz("levelUp");
  playEffect("flash", player.x, player.z, { size: 3.4, y: 0.9, tint: 0xffd27a });
  playEffect("sparkle", player.x, player.z, {
    size: 2.6,
    grounded: true,
    follow: player,
    tint: 0xffe6a0,
  });
  player.hp = hpMax();
  player.sp = spMax();
  UI.announce(
    "LEVEL UP!",
    `You are now level ${player.level}. You have ${freeStatPoints()} stat points to spend (C).`,
  );
  UI.logMessage(
    '<span class="level-msg">You are now level ' +
      player.level +
      "! Spend your stat points with C.</span>",
  );
  groundRing(player.x, player.z, 0xffc857, 0.3, 2.6, 0.8, 1);
}

function celebrateJobLevelUp(hasLevelledUp) {
  if (!hasLevelledUp) {
    sfx.levelUp();
  }
  const points = freeSkillPoints();
  UI.logMessage(
    `<span class="level-msg">Job level ${player.jobLevel}! You have ${points} skill point${points === 1 ? "" : "s"} to spend (C).</span>`,
  );
  if (!hasLevelledUp) {
    groundRing(player.x, player.z, 0x8ad0ff, 0.3, 2.2, 0.7, 0.9);
  }
  /* a first class at its maximum job level can advance at its mentor */
  if (heroClass().tier === 1 && player.jobLevel >= maxJobLevel()) {
    const options = ADVANCEMENTS[player.classId] || [];
    const mentor = CLASSES[options[0]].mentor;
    UI.announce("JOB MASTERED", `Speak to ${mentor} to choose your path.`);
    const classNames = options.map((option) => CLASSES[option].name).join(" or ");
    UI.logMessage(
      `<span class="level-msg">You have mastered the ${heroClass().name} path. Speak to ${UI.escapeHtml(mentor)} to advance to ${classNames}.</span>`,
    );
  }
}

/**
 * Exp, zeny and loot (a killed monster or a quest reward), with level and job level ups. `reward.from` ({x, z},
 * the killed monster) is where found items and coins fly to the bag and zeny counter from; else the hero.
 */
export function grantReward(reward) {
  reward = { ...reward, exp: Math.round(reward.exp * ADMIN.expMultiplier) };
  player.exp += reward.exp;
  player.zeny += reward.zeny;
  const from = reward.from || player;
  if (reward.zeny > 0) {
    flyToHud("ui_zeny", "🪙", from.x, 0.6, from.z, camera, "zeny");
  }
  UI.floatingText(
    player.x,
    player.sprite.height + 0.4,
    player.z,
    camera,
    "+" + reward.exp + " exp",
    "exp",
  );

  if (reward.loot && ITEMS[reward.loot]) {
    const item = ITEMS[reward.loot];
    sfx.loot();
    if (addToBag(reward.loot)) {
      flyToHud(reward.loot, item.icon, from.x, 0.6, from.z, camera, "bag", 0.15);
      const equipHint = item.slot ? " Open your inventory (I) to equip it." : "";
      UI.logMessage(
        '<span class="level-msg">You found: ' +
          icon(reward.loot, item.icon, "small") +
          " " +
          UI.escapeHtml(item.name) +
          "!" +
          equipHint +
          "</span>",
      );
    } else {
      UI.systemMessage(`Your bag is full: the ${UI.itemNoun(item.name)} was left behind.`);
    }
    game.inventory.render();
  }

  /* crafting material (raw meat, arcane dust) */
  if (reward.material && ITEMS[reward.material]) {
    const material = ITEMS[reward.material];
    if (addToBag(reward.material, 1, true)) {
      flyToHud(reward.material, material.icon, from.x, 0.6, from.z, camera, "bag", 0.3);
      UI.logMessage(
        '<span class="loot-msg">You found: ' +
          icon(reward.material, material.icon, "small") +
          " " +
          UI.escapeHtml(material.name) +
          ".</span>",
      );
      game.inventory.render();
    }
  }

  let hasLevelledUp = false;
  let hasJobLevelledUp = false;
  while (player.level < MAX_LEVEL && player.exp >= expForLevel(player.level)) {
    player.exp -= expForLevel(player.level);
    player.level++;
    hasLevelledUp = true;
  }
  /* part of the exp also counts as job exp, until the job level is at its maximum */
  if (player.jobLevel < maxJobLevel()) {
    player.jobExp += Math.round(reward.exp * JOB_EXP_SHARE);
    while (player.jobLevel < maxJobLevel() && player.jobExp >= jobExpForLevel(player.jobLevel)) {
      player.jobExp -= jobExpForLevel(player.jobLevel);
      player.jobLevel++;
      hasJobLevelledUp = true;
    }
  }
  if (hasLevelledUp) {
    celebrateLevelUp();
  }
  if (hasJobLevelledUp) {
    celebrateJobLevelUp(hasLevelledUp);
  }
  game.characterSheet.render();
}
