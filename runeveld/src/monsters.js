/* Eldoria – monsters: creating their sprites, where they spawn and roam, the simulation when this client is
   the host (no server: the player online longest simulates the monsters), applying snapshots from the host or
   server, and drawing them every frame. */
import { MONSTERS, SPAWNS, RESPAWN_SECONDS } from "./data.js";
import {
  FOREST,
  inForest,
  ALTAR_CLEARING,
  distanceToPath,
  VALE,
  inVale,
  inFields,
  CAPITAL,
  inCapital,
  BANDIT_CAMP,
  inCrypt,
} from "./regions.js";
import { isNight } from "./daylight.js";
import { bossOf, bossTick, resetBoss, rageFactors } from "./rules/bosses.js";
import { spotFor } from "./rules/crypt.js";
import { sfx } from "./audio.js";
import { chargeDust } from "./boss-effects.js";
import { setSanctumDark } from "./crypt.js";
import { SHEETS } from "./sheets.js";
import { recolor, HAIR_SOURCE, HAIR_PALETTES } from "./appearance.js";
import { Sprite2D } from "./sprites.js";
import { scene, camera, cameraState, resolveCollision, isFree, inVillage } from "./world.js";
import * as UI from "./ui.js";
import {
  player,
  monsters,
  peers,
  clickables,
  ADMIN,
  game,
  now,
  randomBetween,
  playEffect,
} from "./game-state.js";

/* monster.state values, also used in the snapshots of the host and the server */
export const MONSTER_STATE = { idle: 0, walking: 1, dead: 3 };

/* how far a hunting monster follows a player before giving up */
const CHASE_DISTANCE = 13;
/* how far a crypt monster follows anyone away from its own spot */
const LEASH_DISTANCE = 16;
/* seconds between two attacks of a monster */
const MONSTER_ATTACK_INTERVAL = 1.6;
/* seconds between two monster snapshots sent by the host */
const SNAPSHOT_INTERVAL = 0.2;

/* bandits are humans built from the hero layers: weapon behind, body, outfit, head (in a hair colour), weapon */
function humanoidLayers(look) {
  const layers = SHEETS.hero.layers;
  const head = recolor(
    look.headgear || "hero_head",
    HAIR_SOURCE,
    HAIR_PALETTES[look.hair],
    "hair-" + look.hair,
    !!look.headgear,
  );
  return [
    look.weapon && layers[`${look.weapon}_back`],
    layers.hero_body,
    layers[look.outfit],
    head,
    look.weapon && layers[look.weapon],
  ].filter(Boolean);
}

/** The monster with this world id; creates it (sprite, label) when it does not exist yet. Null for unknown kinds. */
export function ensureMonster(id) {
  let monster = monsters.get(id);
  if (monster) {
    return monster;
  }
  const monsterId = id.split("#")[0];
  const spec = MONSTERS[monsterId];
  if (!spec) {
    return null;
  }
  /* animals can borrow another sheet, be bigger and get a tint */
  const layers = spec.humanoid ? humanoidLayers(spec.humanoid) : null;
  const scale = spec.scale || (spec.humanoid && spec.humanoid.scale) || 1;
  const sheet = spec.humanoid ? SHEETS.hero : SHEETS[spec.sheet || monsterId];
  const sprite = new Sprite2D(sheet, { shadow: 1.1 * scale, layers });
  if (scale !== 1) {
    sprite.group.scale.setScalar(scale);
  }
  if (spec.tint) {
    sprite.tint(spec.tint);
  }
  scene.add(sprite.group);

  monster = {
    id,
    spec,
    sprite,
    scale,
    label: UI.createLabel("monster", spec.name),
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    faceX: 0,
    faceZ: 1,
    state: MONSTER_STATE.idle,
    hp: spec.hp,
    hpMax: spec.hp,
    isDead: false,
    hideAt: 0 /* hide the body after the death animation */,
    attackAnimUntil: 0,
    aggroTarget: null /* peer id of the player it hunts (host only) */,
    attackCooldown: 0,
    wanderTarget: null,
    wanderTimer: randomBetween(0, 3),
    respawnTimer: 0,
    isNew: true /* not placed yet by a snapshot */,
  };
  sprite.mesh.userData.monster = monster;
  clickables.push(sprite.mesh);
  monsters.set(id, monster);
  return monster;
}

/* A spot in this monster's area: outside the palisade, free of obstacles, not on the path at the gates. The crypt's
   monsters have spots of their own. */
function spawnPoint(spec, id) {
  const spot = spotFor(spec.key, id);
  if (spot) {
    return spot;
  }
  if (spec.area === "camp") {
    const [campX, campZ] = BANDIT_CAMP;
    for (let i = 0; i < 80; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(2, 6);
      const x = campX + Math.cos(angle) * distance;
      const z = campZ + Math.sin(angle) * distance;
      if (isFree(x, z, 0.8)) {
        return [x, z];
      }
    }
    return [campX, campZ - 7];
  }

  if (spec.area === "vale") {
    for (let i = 0; i < 160; i++) {
      const x = randomBetween(VALE.x0 + 6, VALE.x1 - 6);
      const z = randomBetween(VALE.z0 + 6, VALE.z1 - 6);
      const isBlocked =
        !inVale(x, z, 3) ||
        inFields(x, z) ||
        inCapital(x, z, -9) ||
        (Math.abs(x - CAPITAL.cx) < 5 && Math.abs(z) < CAPITAL.z1 + 10) ||
        Math.hypot(x - BANDIT_CAMP[0], z - BANDIT_CAMP[1]) < 12 ||
        !isFree(x, z, 0.8) ||
        Math.hypot(x - player.x, z - player.z) < 6;
      if (isBlocked) {
        continue;
      }
      return [x, z];
    }
    return [VALE.cx, VALE.z1 - 12];
  }

  if (spec.area === "altar") {
    const [clearingX, clearingZ] = ALTAR_CLEARING;
    for (let i = 0; i < 80; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(2.6, 5.4);
      const x = clearingX + Math.cos(angle) * distance;
      const z = clearingZ + Math.sin(angle) * distance;
      if (isFree(x, z, 0.8)) {
        return [x, z];
      }
    }
    return [clearingX, clearingZ - 4];
  }

  if (spec.area === "forest") {
    for (let i = 0; i < 120; i++) {
      const x = randomBetween(FOREST.x0 + 4, FOREST.x1 - 4);
      const z = randomBetween(FOREST.z0 + 4, FOREST.z1 - 6);
      const isBlocked =
        distanceToPath(x, z) < 3 ||
        Math.hypot(x - ALTAR_CLEARING[0], z - ALTAR_CLEARING[1]) < 10 ||
        !isFree(x, z, 0.8) ||
        Math.hypot(x - player.x, z - player.z) < 4;
      if (isBlocked) {
        continue;
      }
      return [x, z];
    }
    return [FOREST.x0 + 8, FOREST.z1 - 12];
  }

  /* the fields around the village: a square ring between zone[0] and zone[1] */
  const [min, max] = spec.zone;
  for (let i = 0; i < 80; i++) {
    const x = randomBetween(-max, max);
    const z = randomBetween(-max, max);
    const ringDistance = Math.max(Math.abs(x), Math.abs(z));
    const isBlocked =
      ringDistance < min ||
      ringDistance > max ||
      inVillage(x, z) ||
      Math.abs(x) < 4 ||
      !isFree(x, z, 0.8) ||
      Math.hypot(x - player.x, z - player.z) < 4;
    if (isBlocked) {
      continue;
    }
    return [x, z];
  }
  return [max, max];
}

/* May this monster roam here? Forest animals stay in the forest, the dire boar at the altar. */
function isHome(spec, x, z) {
  if (spec.area === "altar") {
    return Math.hypot(x - ALTAR_CLEARING[0], z - ALTAR_CLEARING[1]) < 8;
  }
  if (spec.area === "forest") {
    return inForest(x, z);
  }
  if (spec.area === "camp") {
    return Math.hypot(x - BANDIT_CAMP[0], z - BANDIT_CAMP[1]) < 9;
  }
  if (spec.area === "vale") {
    return inVale(x, z, 2) && !inFields(x, z) && !inCapital(x, z, -4);
  }
  return !inVillage(x, z) && Math.abs(x) >= 3;
}

/* The area in which a monster keeps chasing a player. */
function isHuntingGround(spec, x, z) {
  if (spec.area === "altar" || spec.area === "forest") {
    return inForest(x, z);
  }
  if (spec.area === "camp" || spec.area === "vale") {
    return inVale(x, z) && !inCapital(x, z, -3);
  }
  if (spec.area === "crypt") {
    return inCrypt(x, z);
  }
  return true;
}

/** Safe places: inside the palisade of Runeveld and inside the walls of Aurelia. */
export const isSafe = (x, z) => inVillage(x, z) || inCapital(x, z);

/** A monster died: death animation, smoke, and (on the host) the respawn timer. */
export function monsterDied(monster) {
  if (monster.isDead) {
    return;
  }
  monster.isDead = true;
  monster.hp = 0;
  /* a boss that darkened its room lights it again when it falls */
  if (bossOf(monster.spec.key)?.enrage?.darkness) {
    setSanctumDark(false);
  }
  monster.state = MONSTER_STATE.dead;
  monster.aggroTarget = null;
  const respawnRange = monster.spec.respawn || RESPAWN_SECONDS;
  monster.respawnTimer = randomBetween(respawnRange[0], respawnRange[1]);
  monster.sprite.play("death", true);
  monster.hideAt = now() + 1.6;
  if (Math.hypot(monster.x - player.x, monster.z - player.z) < 14) {
    sfx.monsterDeath();
  }
  if (game.effects) {
    playEffect("smoke", monster.x, monster.z, { size: 1.6, grounded: true, delay: 0.9 });
  }
  if (player.target === monster) {
    player.target = null;
    player.queuedSkill = null;
    UI.setTargetFrame(null);
  }
}

function reviveMonster(monster, [x, z]) {
  resetBoss(monster);
  if (monster.isEnraged && bossOf(monster.spec.key)?.enrage?.darkness) {
    setSanctumDark(false);
  }
  monster.isEnraged = false;
  monster.charge = null;
  monster.isDead = false;
  monster.hp = monster.hpMax;
  monster.x = monster.targetX = x;
  monster.z = monster.targetZ = z;
  monster.home = monster.spec.area === "crypt" ? [x, z] : null;
  monster.aggroTarget = null;
  monster.state = MONSTER_STATE.idle;
  monster.hideAt = 0;
  monster.sprite.group.visible = true;
  monster.label.el.hidden = false;
  monster.sprite.play("idle", true);
}

/** This client becomes the host: spawn all monsters, or take over the ones received from the old host. */
export function becomeHost() {
  game.host = { snapshotTimer: 0 };
  if (monsters.size === 0) {
    for (const spawn of SPAWNS) {
      for (let i = 0; i < spawn.count; i++) {
        const monster = ensureMonster(spawn.monster + "#" + i);
        const [x, z] = spawnPoint(monster.spec, monster.id);
        monster.x = monster.targetX = x;
        monster.z = monster.targetZ = z;
        monster.home = monster.spec.area === "crypt" ? [x, z] : null;
        monster.isNew = false;
      }
    }
    return;
  }
  for (const monster of monsters.values()) {
    monster.x = monster.targetX;
    monster.z = monster.targetZ;
    monster.aggroTarget = null;
    if (monster.isDead && monster.respawnTimer <= 0) {
      const respawnRange = monster.spec.respawn || RESPAWN_SECONDS;
      monster.respawnTimer = randomBetween(respawnRange[0], respawnRange[1]);
    }
  }
}

/** Host: a player hit a monster. On a kill the host sends the kill event with exp, zeny and loot. */
export function hostHandleHit(data, attackerId) {
  const monster = monsters.get(data.id);
  if (!monster || monster.isDead) {
    return;
  }
  monster.hp = Math.max(0, monster.hp - data.damage);
  if (!monster.aggroTarget) {
    monster.aggroTarget = attackerId;
  }
  if (monster.hp > 0) {
    return;
  }
  /* the kill event immediately calls monsterDied, which handles the death and the respawn timer */
  const spec = monster.spec;
  let loot = null;
  for (const [itemId, chance] of Object.entries(spec.loot || {})) {
    if (Math.random() < chance * ADMIN.dropMultiplier) {
      loot = itemId;
      break;
    }
  }
  let material = null;
  for (const [itemId, chance] of Object.entries(spec.materials || {})) {
    if (Math.random() < chance * ADMIN.dropMultiplier) {
      material = itemId;
      break;
    }
  }
  game.network.send("kill", {
    id: monster.id,
    killer: attackerId,
    exp: spec.exp,
    zeny: Math.round(randomBetween(spec.zeny[0], spec.zeny[1])),
    loot,
    material,
  });
}

/* Host: the player a monster hunts, or a new one in its aggro range (aggressive monsters only). */
function findTarget(monster, players, nightFactors) {
  const spec = monster.spec;
  let target = monster.aggroTarget ? players.find((p) => p.id === monster.aggroTarget) : null;
  const shouldGiveUp =
    target &&
    (target.isDead ||
      isSafe(target.x, target.z) ||
      Math.hypot(target.x - monster.x, target.z - monster.z) > CHASE_DISTANCE ||
      !isHuntingGround(spec, target.x, target.z) ||
      isFarFromHome(monster));
  if (shouldGiveUp) {
    target = null;
    monster.aggroTarget = null;
  }
  if (!target && spec.aggressive) {
    let closest = null;
    let closestDistance = spec.aggroRange * (nightFactors ? nightFactors.aggroFactor : 1);
    for (const candidate of players) {
      if (candidate.isDead || isSafe(candidate.x, candidate.z)) {
        continue;
      }
      const distance = Math.hypot(candidate.x - monster.x, candidate.z - monster.z);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = candidate;
      }
    }
    if (closest) {
      target = closest;
      monster.aggroTarget = closest.id;
    }
  }
  return target;
}

/* a crypt monster that has followed someone too far from its spot turns back */
const isFarFromHome = (monster) =>
  !!monster.home &&
  Math.hypot(monster.x - monster.home[0], monster.z - monster.home[1]) > LEASH_DISTANCE;

/* Host: walk to the target and attack it when in range. */
function chase(monster, target, nightFactors, dt) {
  const spec = monster.spec;
  const dx = target.x - monster.x;
  const dz = target.z - monster.z;
  const distance = Math.hypot(dx, dz) || 1e-4;
  monster.faceX = dx / distance;
  monster.faceZ = dz / distance;
  if (distance > spec.range) {
    const step = spec.speed * (nightFactors ? nightFactors.speedFactor : 1) * dt;
    [monster.x, monster.z] = resolveCollision(
      monster.x + (dx / distance) * step,
      monster.z + (dz / distance) * step,
      0.3,
    );
    monster.state = MONSTER_STATE.walking;
    return;
  }
  monster.state = MONSTER_STATE.idle;
  if (monster.attackCooldown <= 0) {
    /* an enraged boss attacks sooner and harder (rules/bosses.js) */
    const rage = rageFactors(monster);
    monster.attackCooldown = MONSTER_ATTACK_INTERVAL * rage.cooldown;
    game.network.send("monster_attack", {
      id: monster.id,
      target: target.id,
      damage: Math.round(spec.atk * rage.damage * randomBetween(0.85, 1.15)),
    });
  }
}

/* Host: without a target a monster now and then wanders to a nearby spot in its home area. */
function wander(monster, dt) {
  const spec = monster.spec;
  monster.wanderTimer -= dt;
  if (monster.wanderTimer <= 0) {
    if (monster.wanderTarget) {
      monster.wanderTarget = null;
      monster.wanderTimer = randomBetween(1.5, 4);
    } else {
      const wanderX = monster.x + randomBetween(-4, 4);
      const wanderZ = monster.z + randomBetween(-4, 4);
      if (monster.home) {
        /* the crypt's monsters keep watch on their spot, and walk back to it after a fight */
        const isAway = Math.hypot(monster.x - monster.home[0], monster.z - monster.home[1]) > 0.6;
        monster.wanderTarget = isAway ? monster.home : null;
      } else {
        monster.wanderTarget = isHome(spec, wanderX, wanderZ) ? [wanderX, wanderZ] : null;
      }
      monster.wanderTimer = randomBetween(2, 5);
    }
  }
  if (!monster.wanderTarget) {
    monster.state = MONSTER_STATE.idle;
    return;
  }
  const dx = monster.wanderTarget[0] - monster.x;
  const dz = monster.wanderTarget[1] - monster.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.2) {
    monster.wanderTarget = null;
    monster.wanderTimer = randomBetween(1.5, 4);
    monster.state = MONSTER_STATE.idle;
    return;
  }
  monster.faceX = dx / distance;
  monster.faceZ = dz / distance;
  const step = spec.speed * 0.55 * dt;
  const [newX, newZ] = resolveCollision(
    monster.x + (dx / distance) * step,
    monster.z + (dz / distance) * step,
    0.3,
  );
  /* stuck against something: pick another spot soon */
  if (Math.hypot(newX - monster.x, newZ - monster.z) < step * 0.3) {
    monster.wanderTarget = null;
    monster.wanderTimer = 1;
  }
  monster.x = newX;
  monster.z = newZ;
  monster.state = MONSTER_STATE.walking;
}

/* Host: a helper a boss calls in; it fights for the boss and does not come back once defeated */
let helperCount = 0;
function spawnHelper(key, x, z, targetId) {
  const helper = ensureMonster(`${key}#helper${helperCount++}`);
  if (!helper) {
    return;
  }
  [helper.x, helper.z] = resolveCollision(x, z, 0.3);
  helper.targetX = helper.x;
  helper.targetZ = helper.z;
  helper.isNew = false;
  helper.isHelper = true;
  helper.aggroTarget = targetId;
}

/** Host: simulate all monsters for one frame and send a snapshot five times per second. */
export function hostTick(dt) {
  const players = [{ id: game.network.me, x: player.x, z: player.z, isDead: player.isDead }];
  for (const [id, peer] of peers) {
    players.push({ id, x: peer.x, z: peer.z, isDead: !!peer.presence.dead });
  }

  for (const monster of monsters.values()) {
    const spec = monster.spec;
    if (monster.isDead) {
      /* a boss's helpers do not come back */
      if (monster.isHelper) {
        continue;
      }
      monster.respawnTimer -= dt;
      if (monster.respawnTimer <= 0) {
        reviveMonster(monster, spawnPoint(monster.spec, monster.id));
      }
      continue;
    }
    if (ADMIN.frozen || now() < (monster.frozenUntil || 0)) {
      monster.state = MONSTER_STATE.idle;
      monster.targetX = monster.x;
      monster.targetZ = monster.z;
      continue;
    }
    const nightFactors = isNight() && spec.night ? spec.night : null;
    const target = findTarget(monster, players, nightFactors);
    monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
    /* bosses have moves of their own (rules/bosses.js); the same rules as on the server */
    if (
      bossOf(spec.key) &&
      bossTick(monster, target, dt, {
        now: now(),
        emit: (type, data) => game.network.send(type, data),
        players,
        resolveCollision: (x, z, r) => resolveCollision(x, z, r),
        isFree,
        spawnAdd: (key, x, z) => spawnHelper(key, x, z, monster.aggroTarget),
      })
    ) {
      monster.state = MONSTER_STATE.idle;
      monster.targetX = monster.x;
      monster.targetZ = monster.z;
      continue;
    }
    if (target) {
      chase(monster, target, nightFactors, dt);
    } else {
      wander(monster, dt);
    }
    monster.targetX = monster.x;
    monster.targetZ = monster.z;
  }

  game.host.snapshotTimer -= dt;
  if (game.host.snapshotTimer <= 0) {
    game.host.snapshotTimer = SNAPSHOT_INTERVAL;
    const list = [...monsters.values()].map((monster) => [
      monster.id,
      +monster.x.toFixed(2),
      +monster.z.toFixed(2),
      +monster.faceX.toFixed(2),
      +monster.faceZ.toFixed(2),
      monster.isDead ? MONSTER_STATE.dead : monster.state,
      Math.round(monster.hp),
    ]);
    game.network.send("monsters", { list });
  }
}

/** Applies a monster snapshot from the host or the server: `{list: [[id, x, z, faceX, faceZ, state, hp], ...]}`. */
export function applyMonsterSnapshot(data) {
  for (const [id, x, z, faceX, faceZ, state, hp] of data.list) {
    const monster = ensureMonster(id);
    if (!monster) {
      continue;
    }
    monster.targetX = x;
    monster.targetZ = z;
    monster.faceX = faceX;
    monster.faceZ = faceZ;
    if (monster.isNew) {
      monster.isNew = false;
      monster.x = x;
      monster.z = z;
      if (state === MONSTER_STATE.dead) {
        monster.isDead = true;
        monster.sprite.group.visible = false;
        monster.label.el.hidden = true;
      }
    }
    if (state === MONSTER_STATE.dead && !monster.isDead) {
      monsterDied(monster);
    } else if (state !== MONSTER_STATE.dead && monster.isDead) {
      reviveMonster(monster, [x, z]);
    }
    if (!monster.isDead) {
      monster.hp = hp;
    }
    monster.state = state;
  }
}

/**
 * A blow on a monster: white flash, squash and a push away from the attacker. The host also moves the
 * monster (when the spot is free and not safe ground).
 */
export function knockBack(monster, dx, dz, force) {
  monster.sprite.flashHit();
  monster.sprite.nudge(dx, dz, force);
  if (game.host && !monster.isDead) {
    const length = Math.hypot(dx, dz) || 1;
    const newX = monster.x + (dx / length) * force * 0.6;
    const newZ = monster.z + (dz / length) * force * 0.6;
    if (isFree(newX, newZ, 0.4) && !isSafe(newX, newZ)) {
      monster.x = monster.targetX = newX;
      monster.z = monster.targetZ = newZ;
    }
  }
}

/** Draws the monsters: smooth movement towards the received positions, animation, freeze tint, labels. */
export function updateMonsters(dt) {
  const time = now();
  for (const monster of monsters.values()) {
    const labelHeight = monster.sprite.height * monster.scale + 0.1;
    if (monster.isDead) {
      if (monster.hideAt && time > monster.hideAt) {
        monster.sprite.group.visible = false;
        monster.label.el.hidden = true;
        monster.hideAt = 0;
      }
      if (monster.sprite.group.visible) {
        monster.sprite.update(dt, cameraState);
        UI.positionLabel(monster.label, monster.x, labelHeight, monster.z, camera);
      }
      continue;
    }
    /* a charging boss runs its lane (boss-effects.js); the host moves it itself, the others follow the lane
       instead of the snapshots, which are too slow for a rush like that */
    const charge = monster.charge;
    const isCharging = charge && time < charge.t0 + charge.duration;
    if (charge && !game.host) {
      const progress = Math.min(1, (time - charge.t0) / charge.duration);
      monster.x = charge.x0 + (charge.x1 - charge.x0) * progress;
      monster.z = charge.z0 + (charge.z1 - charge.z0) * progress;
      monster.faceX = charge.x1 - charge.x0;
      monster.faceZ = charge.z1 - charge.z0;
    } else if (!game.host) {
      const follow = 1 - Math.exp(-10 * dt);
      monster.x += (monster.targetX - monster.x) * follow;
      monster.z += (monster.targetZ - monster.z) * follow;
    }
    /* a dive goes up and comes down again */
    const lift =
      isCharging && charge.arc
        ? Math.sin(Math.min(1, (time - charge.t0) / charge.duration) * Math.PI) * charge.arc
        : 0;
    if (isCharging && !charge.arc) {
      chargeDust(monster, dt);
    } else if (charge && !isCharging) {
      monster.charge = null;
      monster.targetX = charge.x1;
      monster.targetZ = charge.z1;
    }
    monster.sprite.group.position.set(monster.x, lift, monster.z);
    monster.sprite.face(monster.faceX, monster.faceZ);
    if (isCharging && charge.anim) {
      monster.sprite.play(charge.anim);
    } else if (time >= monster.attackAnimUntil) {
      monster.sprite.play(isCharging || monster.state === MONSTER_STATE.walking ? "walk" : "idle");
    }
    /* frozen monsters turn icy blue, an enraged boss red */
    const tint =
      time < (monster.frozenUntil || 0)
        ? 0x9ad8ff
        : monster.isEnraged
          ? 0xff8070
          : monster.spec.tint || 0xffffff;
    if (tint !== monster.sprite.tintColor) {
      monster.sprite.tint(tint);
    }
    monster.sprite.update(dt, cameraState);
    UI.positionLabel(monster.label, monster.x, labelHeight, monster.z, camera);
    UI.setLabelHp(
      monster.label,
      monster.hp,
      monster.hpMax,
      monster.hp < monster.hpMax || player.target === monster,
    );
  }
  if (player.target) {
    UI.setTargetFrame(player.target);
  }
}
