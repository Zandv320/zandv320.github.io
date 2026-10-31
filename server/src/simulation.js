/* Eldoria – server-side monster simulation. The same rules the old host player ran in the browser (main.js), now
   inside the World Durable Object: spawning, wandering, attacking, dying, loot and respawning. It uses the pure game
   modules (data.js for the monsters, regions.js for the shape of the world) plus the obstacle list the client sends,
   because the world itself is built in the browser and the server only knows its collision circles.
   emit(type, data) sends an event to every player: 'monsters' (snapshot), 'monster_attack' and 'kill'. */
import { MONSTERS, SPAWNS, RESPAWN_SECONDS } from "../../runeveld/src/data.js";
import {
  inForest,
  inVale,
  inFields,
  inCapital,
  FOREST,
  ALTAR_CLEARING,
  VALE,
  CAPITAL,
  BANDIT_CAMP,
  distanceToPath,
  insideWorld,
} from "../../runeveld/src/regions.js";
import { createCollision, unpackObstacle } from "../../runeveld/src/rules/collision.js";

/* half the width of the starting village, where monsters never go (matches world.js) */
const VILLAGE_HALF_SIZE = 22;
/* day and night: the same clock as daylight.js (24 real minutes per game day) */
const DAY_MINUTES = 24;

/* monster states as sent in the snapshot */
const STATE_IDLE = 0;
const STATE_WALK = 1;
const STATE_DEAD = 3;

const ATTACK_COOLDOWN = 1.6;
const MAX_CHASE_DISTANCE = 13;
const MIN_SPAWN_DISTANCE_TO_PLAYER = 6;
const WANDER_SPEED_FACTOR = 0.55;
const MAX_HIT_DAMAGE = 99999;
const MAX_FREEZE_SECONDS = 10;
const DEFAULT_FREEZE_SECONDS = 1.5;
const MAX_PROVOKE_RADIUS = 12;
const DEFAULT_PROVOKE_RADIUS = 5;
const MAX_KNOCKBACK_FORCE = 2;
const KNOCKBACK_SCALE = 0.6;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const inVillage = (x, z) => Math.abs(x) < VILLAGE_HALF_SIZE && Math.abs(z) < VILLAGE_HALF_SIZE;
/* players in the village or the capital cannot be attacked */
const isSafe = (x, z) => inVillage(x, z) || inCapital(x, z);
const nowSeconds = () => Date.now() / 1000;

function gameHour() {
  const minuteOfDay = (Date.now() / 1000 / 60) % DAY_MINUTES;
  return (minuteOfDay / DAY_MINUTES) * 24;
}

/* the same moment daylight() drops below .5 in daylight.js */
function isNight() {
  const hour = gameHour();
  return hour < 6 || hour > 20;
}

/**
 * Creates the monster simulation of one world.
 * @param {(type: string, data: object) => void} emit sends a game event to all players
 */
export function createSimulation(emit) {
  const monsters = new Map();
  /* collision circles and building boxes (rules/collision.js), the same rules as in the browser */
  let obstacles = [];
  let collision = createCollision(obstacles, (x, z) => insideWorld(x, z));

  function isFree(x, z, radius = 0.5) {
    return collision.isFree(x, z, radius);
  }

  /* pushes a point out of every obstacle; null when it lies outside the world */
  function resolveCollision(x, z, radius = 0.3) {
    if (!insideWorld(x, z, 1.2)) {
      return null;
    }
    return collision.pushOut(x, z, radius);
  }

  /* a random free point around a centre, between two distances */
  function pointAround([centerX, centerZ], minDistance, maxDistance, tries) {
    for (let i = 0; i < tries; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(minDistance, maxDistance);
      const x = centerX + Math.cos(angle) * distance;
      const z = centerZ + Math.sin(angle) * distance;
      if (isFree(x, z, 0.8)) {
        return [x, z];
      }
    }
    return null;
  }

  function spawnPoint(spec, players) {
    const isAwayFromPlayers = (x, z) =>
      players.every(
        (player) => Math.hypot(x - player.x, z - player.z) > MIN_SPAWN_DISTANCE_TO_PLAYER,
      );

    if (spec.area === "camp") {
      const point = pointAround(BANDIT_CAMP, 2, 6, 80);
      return point || [BANDIT_CAMP[0], BANDIT_CAMP[1] - 7];
    }

    if (spec.area === "vale") {
      for (let i = 0; i < 160; i++) {
        const x = randomBetween(VALE.x0 + 6, VALE.x1 - 6);
        const z = randomBetween(VALE.z0 + 6, VALE.z1 - 6);
        const onKingsRoad = Math.abs(x - CAPITAL.cx) < 5 && Math.abs(z) < CAPITAL.z1 + 10;
        const nearCamp = Math.hypot(x - BANDIT_CAMP[0], z - BANDIT_CAMP[1]) < 12;
        if (
          !inVale(x, z, 3) ||
          inFields(x, z) ||
          inCapital(x, z, -9) ||
          onKingsRoad ||
          nearCamp ||
          !isFree(x, z, 0.8) ||
          !isAwayFromPlayers(x, z)
        ) {
          continue;
        }
        return [x, z];
      }
      return [VALE.cx, VALE.z1 - 12];
    }

    if (spec.area === "altar") {
      const point = pointAround(ALTAR_CLEARING, 2.6, 5.4, 80);
      return point || [ALTAR_CLEARING[0], ALTAR_CLEARING[1] - 4];
    }

    if (spec.area === "forest") {
      for (let i = 0; i < 120; i++) {
        const x = randomBetween(FOREST.x0 + 4, FOREST.x1 - 4);
        const z = randomBetween(FOREST.z0 + 4, FOREST.z1 - 6);
        const nearAltar = Math.hypot(x - ALTAR_CLEARING[0], z - ALTAR_CLEARING[1]) < 10;
        if (
          distanceToPath(x, z) < 3 ||
          nearAltar ||
          !isFree(x, z, 0.8) ||
          !isAwayFromPlayers(x, z)
        ) {
          continue;
        }
        return [x, z];
      }
      return [FOREST.x0 + 8, FOREST.z1 - 12];
    }

    /* the fields around the village: a square ring between two distances */
    const [minRing, maxRing] = spec.zone;
    for (let i = 0; i < 80; i++) {
      const x = randomBetween(-maxRing, maxRing);
      const z = randomBetween(-maxRing, maxRing);
      const ring = Math.max(Math.abs(x), Math.abs(z));
      if (
        ring < minRing ||
        ring > maxRing ||
        inVillage(x, z) ||
        Math.abs(x) < 4 ||
        !isFree(x, z, 0.8) ||
        !isAwayFromPlayers(x, z)
      ) {
        continue;
      }
      return [x, z];
    }
    return [maxRing, maxRing];
  }

  /* where a monster may wander on its own */
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

  /* how far a monster follows its target */
  function isHuntingGround(spec, x, z) {
    if (spec.area === "altar" || spec.area === "forest") {
      return inForest(x, z);
    }
    if (spec.area === "camp" || spec.area === "vale") {
      return inVale(x, z) && !inCapital(x, z, -3);
    }
    return true;
  }

  function spawn(players) {
    if (monsters.size) {
      return;
    }
    for (const entry of SPAWNS) {
      const spec = MONSTERS[entry.monster];
      for (let i = 0; i < entry.count; i++) {
        const id = entry.monster + "#" + i;
        const [x, z] = spawnPoint(spec, players);
        monsters.set(id, {
          id,
          spec,
          x,
          z,
          faceX: 0,
          faceZ: 1,
          state: STATE_IDLE,
          hp: spec.hp,
          isDead: false,
          respawnTimer: 0,
          targetId: null,
          cooldown: 0,
          wanderTarget: null,
          wanderTimer: randomBetween(0, 3),
          frozenUntil: 0,
        });
      }
    }
  }

  function die(monster, killerId) {
    const spec = monster.spec;
    monster.isDead = true;
    monster.hp = 0;
    monster.state = STATE_DEAD;
    monster.targetId = null;
    const [minRespawn, maxRespawn] = spec.respawn || RESPAWN_SECONDS;
    monster.respawnTimer = randomBetween(minRespawn, maxRespawn);

    /* at most one drop: the first item whose chance hits */
    let loot = null;
    for (const [itemId, chance] of Object.entries(spec.loot || {})) {
      if (Math.random() < chance) {
        loot = itemId;
        break;
      }
    }
    /* crafting material (raw meat, arcane dust) drops on its own roll */
    let material = null;
    for (const [itemId, chance] of Object.entries(spec.materials || {})) {
      if (Math.random() < chance) {
        material = itemId;
        break;
      }
    }

    emit("kill", {
      id: monster.id,
      killer: killerId,
      exp: spec.exp,
      zeny: Math.round(randomBetween(spec.zeny[0], spec.zeny[1])),
      loot,
      material,
      x: +monster.x.toFixed(1),
      z: +monster.z.toFixed(1),
    });
  }

  function respawnIfReady(monster, dt, players) {
    monster.respawnTimer -= dt;
    if (monster.respawnTimer > 0) {
      return;
    }
    const [x, z] = spawnPoint(monster.spec, players);
    monster.isDead = false;
    monster.hp = monster.spec.hp;
    monster.x = x;
    monster.z = z;
    monster.targetId = null;
    monster.state = STATE_IDLE;
  }

  function findTarget(monster, players, nightFactors) {
    const spec = monster.spec;
    let target = monster.targetId ? players.find((player) => player.id === monster.targetId) : null;
    if (
      target &&
      (target.isDead ||
        isSafe(target.x, target.z) ||
        Math.hypot(target.x - monster.x, target.z - monster.z) > MAX_CHASE_DISTANCE ||
        !isHuntingGround(spec, target.x, target.z))
    ) {
      target = null;
      monster.targetId = null;
    }

    if (!target && spec.aggressive) {
      let closestDistance = spec.aggroRange * (nightFactors ? nightFactors.aggroFactor : 1);
      for (const player of players) {
        if (player.isDead || isSafe(player.x, player.z)) {
          continue;
        }
        const distance = Math.hypot(player.x - monster.x, player.z - monster.z);
        if (distance < closestDistance) {
          closestDistance = distance;
          target = player;
        }
      }
      if (target) {
        monster.targetId = target.id;
      }
    }
    return target;
  }

  function chase(monster, target, dt, nightFactors) {
    const spec = monster.spec;
    const dx = target.x - monster.x;
    const dz = target.z - monster.z;
    const distance = Math.hypot(dx, dz) || 1e-4;
    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;

    if (distance > spec.range) {
      const step = spec.speed * (nightFactors ? nightFactors.speedFactor : 1) * dt;
      const position = resolveCollision(
        monster.x + (dx / distance) * step,
        monster.z + (dz / distance) * step,
      );
      if (position) {
        monster.x = position[0];
        monster.z = position[1];
      }
      monster.state = STATE_WALK;
      return;
    }

    monster.state = STATE_IDLE;
    if (monster.cooldown <= 0) {
      monster.cooldown = ATTACK_COOLDOWN;
      emit("monster_attack", {
        id: monster.id,
        target: target.id,
        damage: Math.round(spec.atk * randomBetween(0.85, 1.15)),
      });
    }
  }

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
        monster.wanderTarget = isHome(spec, wanderX, wanderZ) ? [wanderX, wanderZ] : null;
        monster.wanderTimer = randomBetween(2, 5);
      }
    }

    if (!monster.wanderTarget) {
      monster.state = STATE_IDLE;
      return;
    }

    const dx = monster.wanderTarget[0] - monster.x;
    const dz = monster.wanderTarget[1] - monster.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2) {
      monster.wanderTarget = null;
      monster.wanderTimer = randomBetween(1.5, 4);
      monster.state = STATE_IDLE;
      return;
    }

    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;
    const step = spec.speed * WANDER_SPEED_FACTOR * dt;
    const position = resolveCollision(
      monster.x + (dx / distance) * step,
      monster.z + (dz / distance) * step,
    );
    /* blocked: give up on this spot and pick another one soon */
    if (!position || Math.hypot(position[0] - monster.x, position[1] - monster.z) < step * 0.3) {
      monster.wanderTarget = null;
      monster.wanderTimer = 1;
    } else {
      monster.x = position[0];
      monster.z = position[1];
    }
    monster.state = STATE_WALK;
  }

  /**
   * Advances every monster by dt seconds.
   * @param {number} dt
   * @param {{id: string, x: number, z: number, isDead: boolean}[]} players
   */
  function tick(dt, players) {
    for (const monster of monsters.values()) {
      if (monster.isDead) {
        respawnIfReady(monster, dt, players);
        continue;
      }
      if (nowSeconds() < monster.frozenUntil) {
        monster.state = STATE_IDLE;
        continue;
      }
      const nightFactors = isNight() && monster.spec.night ? monster.spec.night : null;
      const target = findTarget(monster, players, nightFactors);
      monster.cooldown = Math.max(0, monster.cooldown - dt);
      if (target) {
        chase(monster, target, dt, nightFactors);
      } else {
        wander(monster, dt);
      }
    }
  }

  /* from the browser: [x, z, r] circles and [x, z, r, hw, hd, cos, sin] boxes; older clients send circles only */
  function setObstacles(list) {
    obstacles = list.map(unpackObstacle).filter(Boolean);
    collision = createCollision(obstacles, (x, z) => insideWorld(x, z));
  }

  function hasObstacles() {
    return obstacles.length > 0;
  }

  function hit(id, damage, attackerId) {
    const monster = monsters.get(id);
    if (!monster || monster.isDead || !Number.isFinite(damage)) {
      return;
    }
    const appliedDamage = Math.max(0, Math.min(damage, MAX_HIT_DAMAGE));
    monster.hp = Math.max(0, monster.hp - appliedDamage);
    if (!monster.targetId) {
      monster.targetId = attackerId;
    }
    if (monster.hp <= 0) {
      die(monster, attackerId);
    }
  }

  function freeze(ids, duration) {
    const seconds = Math.min(MAX_FREEZE_SECONDS, Math.max(0, duration || DEFAULT_FREEZE_SECONDS));
    const until = nowSeconds() + seconds;
    for (const id of ids || []) {
      const monster = monsters.get(id);
      if (monster && !monster.isDead) {
        monster.frozenUntil = until;
      }
    }
  }

  /* every living monster within the radius turns on the provoker */
  function provoke(x, z, radius, attackerId) {
    const reach = Math.min(MAX_PROVOKE_RADIUS, radius || DEFAULT_PROVOKE_RADIUS);
    for (const monster of monsters.values()) {
      if (!monster.isDead && Math.hypot(monster.x - x, monster.z - z) <= reach) {
        monster.targetId = attackerId;
      }
    }
  }

  function knockback(id, dx, dz, force) {
    const monster = monsters.get(id);
    if (!monster || monster.isDead) {
      return;
    }
    const length = Math.hypot(dx, dz) || 1;
    const distance = Math.min(MAX_KNOCKBACK_FORCE, force || 0) * KNOCKBACK_SCALE;
    const nextX = monster.x + (dx / length) * distance;
    const nextZ = monster.z + (dz / length) * distance;
    if (isFree(nextX, nextZ, 0.4) && !isSafe(nextX, nextZ)) {
      monster.x = nextX;
      monster.z = nextZ;
    }
  }

  /* compact snapshot: [id, x, z, faceX, faceZ, state, hp] per monster */
  function snapshot() {
    const list = [...monsters.values()].map((monster) => [
      monster.id,
      +monster.x.toFixed(2),
      +monster.z.toFixed(2),
      +monster.faceX.toFixed(2),
      +monster.faceZ.toFixed(2),
      monster.isDead ? STATE_DEAD : monster.state,
      Math.round(monster.hp),
    ]);
    return { list };
  }

  return {
    monsters,
    setObstacles,
    hasObstacles,
    spawn,
    tick,
    hit,
    freeze,
    provoke,
    knockback,
    snapshot,
  };
}
