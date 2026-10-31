/* Eldoria – game rules: what bosses do besides walking up and hitting. Shared by the server (server/src/
   simulation.js) and the offline host in the browser (monsters.js), so a boss fights the same everywhere.

   bossTick(monster, target, dt, ctx) runs a boss for one step and returns true when it took over this step (the
   normal chase is skipped). The monster needs {id, x, z, hp, faceX, faceZ, spec}; the brain keeps its own state in
   monster.boss. ctx: {now (seconds), emit(type, data), players [{id, x, z, isDead}], resolveCollision(x, z, r) →
   [x, z] or null, isFree(x, z, r), spawnAdd(monsterKey, x, z) (a helper that fights for the boss)}.

   Events (all with the boss id):
     boss_telegraph {kind: 'charge', x0, z0, x1, z1, width, duration} or {kind: 'circle', x, z, radius, duration}
       a warning on the ground: where the blow will land
     boss_charge   {x1, z1, duration}  the boss rushes to (x1, z1)
     boss_stunned  {duration}          it hit something and is dazed
     boss_summon   {}                  it calls for help (the helpers appear like any other monster)
     boss_smoke    {x0, z0, x1, z1}    a smoke bomb: it vanishes at (x0, z0) and appears at (x1, z1)
     boss_enrage   {}                  low on health: faster and harder
   Damage goes out as the usual monster_attack {id, target, damage}, per player that is hit. */

/* the bosses and their moves; numbers in seconds, units and multiples of the boss's ATK */
export const BOSSES = {
  dire_boar: {
    charge: {
      every: [6.5, 9],
      windup: 1.1,
      speed: 15,
      length: 12,
      width: 2.2,
      damage: 2.2,
      stun: 2.5,
    },
  },
  bandit_chief: {
    cleave: { every: [6, 8], windup: 0.95, radius: 3.2, damage: 1.8 },
    summon: { below: 0.6, helper: "bandit_brute", count: 2 },
    smoke: { every: [11, 15], below: 0.9 },
    enrage: { below: 0.25, cooldownFactor: 0.6, damageFactor: 1.3 },
  },
};

/* the body of a charging boss, for what it runs into */
const CHARGE_RADIUS = 0.5;

const randomBetween = ([min, max]) => min + Math.random() * (max - min);

/** The boss rules for a monster key ('dire_boar'), or null for an ordinary monster. */
export const bossOf = (key) => BOSSES[key] || null;

/** Clears a boss's state, for a fresh start after it respawns. */
export function resetBoss(monster) {
  monster.boss = null;
}

/** How much harder an enraged boss hits and how much sooner it attacks again: {damage, cooldown} factors. */
export function rageFactors(monster) {
  const enrage = monster.boss && monster.boss.isEnraged && bossOf(monster.spec.key)?.enrage;
  return enrage
    ? { damage: enrage.damageFactor, cooldown: enrage.cooldownFactor }
    : { damage: 1, cooldown: 1 };
}

function brain(monster, now) {
  if (!monster.boss) {
    monster.boss = {
      move: null /* {kind, until, ...}: a move in progress */,
      stunnedUntil: 0,
      nextCharge: now + 1.5 /* opens with a charge at whoever keeps their distance */,
      nextCleave: now + 3,
      nextSmoke: now + 6,
      hasSummoned: false,
      isEnraged: false,
    };
  }
  return monster.boss;
}

/* the players a blow at the line from (x0, z0) to (x1, z1), `width` wide, hits */
function playersOnLine(players, x0, z0, x1, z1, width) {
  const length = Math.hypot(x1 - x0, z1 - z0) || 1e-4;
  const ux = (x1 - x0) / length;
  const uz = (z1 - z0) / length;
  return players.filter((player) => {
    if (player.isDead) {
      return false;
    }
    const along = (player.x - x0) * ux + (player.z - z0) * uz;
    const across = Math.abs((player.x - x0) * uz - (player.z - z0) * ux);
    return along >= -0.5 && along <= length + 0.5 && across <= width / 2;
  });
}

/* how far a charge from (x0, z0) along (ux, uz) gets before it hits something: {x1, z1, isBlocked} */
function freeRun(x0, z0, ux, uz, length, ctx) {
  let x1 = x0;
  let z1 = z0;
  const steps = Math.ceil(length / 0.25);
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ux * i * 0.25;
    const z = z0 + uz * i * 0.25;
    if (!ctx.isFree(x, z, CHARGE_RADIUS)) {
      return { x1, z1, isBlocked: true };
    }
    x1 = x;
    z1 = z;
  }
  return { x1, z1, isBlocked: false };
}

function strike(monster, players, factor, ctx) {
  const rage = rageFactors(monster);
  for (const player of players) {
    ctx.emit("monster_attack", {
      id: monster.id,
      target: player.id,
      damage: Math.round(monster.spec.atk * factor * rage.damage * (0.9 + Math.random() * 0.2)),
    });
  }
}

/** Runs a boss for one step; true when its moves took over (see the top of this file). */
export function bossTick(monster, target, dt, ctx) {
  const rules = bossOf(monster.spec.key);
  if (!rules) {
    return false;
  }
  const now = ctx.now;
  const state = brain(monster, now);
  const health = monster.hp / monster.spec.hp;

  /* dazed after running into something */
  if (now < state.stunnedUntil) {
    return true;
  }

  /* low on health, once: enraged */
  if (rules.enrage && !state.isEnraged && health <= rules.enrage.below) {
    state.isEnraged = true;
    ctx.emit("boss_enrage", { id: monster.id });
  }
  /* once per life: helpers */
  if (rules.summon && !state.hasSummoned && health <= rules.summon.below) {
    state.hasSummoned = true;
    ctx.emit("boss_summon", { id: monster.id });
    for (let i = 0; i < rules.summon.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      ctx.spawnAdd(
        rules.summon.helper,
        monster.x + Math.cos(angle) * 2.5,
        monster.z + Math.sin(angle) * 2.5,
      );
    }
  }

  /* a move in progress */
  const move = state.move;
  if (move) {
    if (move.kind === "charge-windup" && now >= move.until) {
      /* off it goes, to the end of the lane shown on the ground */
      const charge = rules.charge;
      const { x1, z1, isBlocked } = move;
      const duration = Math.max(0.15, Math.hypot(x1 - move.x0, z1 - move.z0) / charge.speed);
      ctx.emit("boss_charge", { id: monster.id, x1: +x1.toFixed(2), z1: +z1.toFixed(2), duration });
      strike(
        monster,
        playersOnLine(ctx.players, move.x0, move.z0, x1, z1, charge.width),
        charge.damage,
        ctx,
      );
      state.move = {
        kind: "charging",
        until: now + duration,
        duration,
        x0: move.x0,
        z0: move.z0,
        x1,
        z1,
        isBlocked,
      };
      return true;
    }
    if (move.kind === "charging") {
      /* along the lane, so the positions sent to the players match what they see */
      const progress = Math.min(1, 1 - (move.until - now) / move.duration);
      monster.x = move.x0 + (move.x1 - move.x0) * progress;
      monster.z = move.z0 + (move.z1 - move.z0) * progress;
      if (now >= move.until) {
        state.move = null;
        if (move.isBlocked) {
          state.stunnedUntil = now + rules.charge.stun;
          ctx.emit("boss_stunned", { id: monster.id, duration: rules.charge.stun });
        }
      }
      return true;
    }
    if (move.kind === "cleave-windup") {
      if (now >= move.until) {
        const cleave = rules.cleave;
        const hit = ctx.players.filter(
          (player) =>
            !player.isDead &&
            Math.hypot(player.x - monster.x, player.z - monster.z) <= cleave.radius,
        );
        strike(monster, hit, cleave.damage, ctx);
        state.move = null;
      }
      return true;
    }
    return true;
  }

  if (!target) {
    return false;
  }
  const dx = target.x - monster.x;
  const dz = target.z - monster.z;
  const distance = Math.hypot(dx, dz) || 1e-4;

  /* the charge: from a few steps away, along a lane that shows on the ground first */
  if (rules.charge && now >= state.nextCharge && distance > 3 && distance < rules.charge.length) {
    const charge = rules.charge;
    const ux = dx / distance;
    const uz = dz / distance;
    const lane = freeRun(monster.x, monster.z, ux, uz, charge.length, ctx);
    /* not with a tree in the way before it reaches the target: try again in a moment */
    if (Math.hypot(lane.x1 - monster.x, lane.z1 - monster.z) < distance) {
      state.nextCharge = now + 1;
    } else {
      state.nextCharge = now + charge.windup + randomBetween(charge.every);
      monster.faceX = ux;
      monster.faceZ = uz;
      state.move = {
        kind: "charge-windup",
        until: now + charge.windup,
        x0: monster.x,
        z0: monster.z,
        ...lane,
      };
      ctx.emit("boss_telegraph", {
        id: monster.id,
        kind: "charge",
        x0: +monster.x.toFixed(2),
        z0: +monster.z.toFixed(2),
        x1: +lane.x1.toFixed(2),
        z1: +lane.z1.toFixed(2),
        width: charge.width,
        duration: charge.windup,
      });
      return true;
    }
  }

  /* the cleave: a circle around the boss that lights up, then everyone still inside is hit */
  if (rules.cleave && now >= state.nextCleave && distance < rules.cleave.radius + 1) {
    const cleave = rules.cleave;
    state.nextCleave =
      now + cleave.windup + randomBetween(cleave.every) * rageFactors(monster).cooldown;
    state.move = { kind: "cleave-windup", until: now + cleave.windup };
    ctx.emit("boss_telegraph", {
      id: monster.id,
      kind: "circle",
      x: +monster.x.toFixed(2),
      z: +monster.z.toFixed(2),
      radius: cleave.radius,
      duration: cleave.windup,
    });
    return true;
  }

  /* the smoke bomb: gone in a cloud, back behind the target */
  if (rules.smoke && now >= state.nextSmoke && health <= rules.smoke.below) {
    state.nextSmoke = now + randomBetween(rules.smoke.every);
    const behindX = target.x + (dx / distance) * 1.8;
    const behindZ = target.z + (dz / distance) * 1.8;
    if (ctx.isFree(behindX, behindZ, 0.6)) {
      ctx.emit("boss_smoke", {
        id: monster.id,
        x0: +monster.x.toFixed(2),
        z0: +monster.z.toFixed(2),
        x1: +behindX.toFixed(2),
        z1: +behindZ.toFixed(2),
      });
      monster.x = behindX;
      monster.z = behindZ;
      monster.faceX = -dx / distance;
      monster.faceZ = -dz / distance;
      return true;
    }
  }
  return false;
}
