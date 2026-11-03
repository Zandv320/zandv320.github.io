/* Eldoria – game rules: what bosses do besides walking up and hitting. Shared by the server (server/src/
   simulation.js) and the offline host in the browser (monsters.js), so a boss fights the same everywhere.

   bossTick(monster, target, dt, ctx) runs a boss for one step and returns true when it took over this step (the
   normal chase is skipped). The monster needs {id, x, z, hp, faceX, faceZ, spec}; the brain keeps its own state in
   monster.boss. ctx: {now (seconds), emit(type, data), players [{id, x, z, isDead}], resolveCollision(x, z, r) →
   [x, z] or null, isFree(x, z, r), spawnAdd(monsterKey, x, z) (a helper that fights for the boss)}.

   Events (all with the boss id):
     boss_telegraph {kind: 'charge', x0, z0, x1, z1, width, duration} or {kind: 'circle', x, z, radius, duration}
       a warning on the ground: where the blow will land; kind 'planks' is a lane like 'charge', but the boss
       stays where it is and strikes; kind 'icicle' is a circle where spikes of ice burst up out of the ground
     boss_charge   {x1, z1, duration}  the boss rushes to (x1, z1)
     boss_stunned  {duration}          it hit something and is dazed
     boss_summon   {}                  it calls for help (the helpers appear like any other monster)
     boss_smoke    {x0, z0, x1, z1}    a smoke bomb: it vanishes at (x0, z0) and appears at (x1, z1)
     boss_enrage   {}                  low on health: faster and harder (and with `darkness`, the room goes dark)
     boss_dive     {x0, z0, x1, z1, duration}  it flies up and comes down on (x1, z1)
     boss_planks   {x0, z0, x1, z1}    a stretch of the bridge's deck falls into the gorge (rules/gorge.js)
     boss_boulder  {x0, z0, x1, z1, duration}  a rock thrown from (x0, z0) lands on (x1, z1)
     boss_submerge {}                  it sinks out of sight (and cannot be hit until it surfaces)
     boss_surface  {x, z}              it rises out of the water at (x, z)
     boss_reset    {}                  nobody left to fight: it heals and starts over (a broken bridge is mended)
   A telegraph of kind 'blast' is a lane like 'charge', but the boss stays where it is and breathes fire along it;
   the lane stops at the first wall or pillar, so whoever stands behind one is safe. Kind 'surge' is the same with
   a wave of the lake instead of fire, and kind 'tentacle' a lane where a tentacle comes down out of the water.
   Damage goes out as the usual monster_attack {id, target, damage}, per player that is hit. */

import { GORGE, onBridge, plankStretch, breakPlanks, mendBridge, BRIDGE } from "./gorge.js";
import { surfaceSpotNear } from "./tidecrown.js";

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
  /* the Sunken Crypt (rules/crypt.js) */
  crimson_count: {
    bloodRunes: { every: [7, 9], windup: 1.3, radius: 1.7, damage: 1.5, range: 12 },
    dive: { every: [11, 14], windup: 1.1, radius: 2.4, damage: 2, minDistance: 4 },
    summon: { below: 0.6, helper: "crypt_thrall", count: 2 },
    enrage: { below: 0.3, cooldownFactor: 0.7, damageFactor: 1.25, darkness: true },
  },
  /* Northwatch and Greyfall Gorge on the Northroad (rules/gorge.js) */
  goblin_chief: {
    cleave: { every: [6, 8], windup: 0.9, radius: 3, damage: 1.7 },
    summon: { below: 0.6, helper: "goblin_scavenger", count: 2 },
    enrage: { below: 0.3, cooldownFactor: 0.7, damageFactor: 1.25 },
  },
  grumm: {
    /* on the bridge he smashes the planks under you; off it, the ground around him */
    planks: { every: [6.5, 8.5], windup: 1.2, damage: 2.2, range: 9 },
    cleave: { every: [7, 9], windup: 1, radius: 3, damage: 1.8 },
    boulders: {
      below: 0.4,
      every: [6, 8],
      windup: 1.4,
      radius: 1.8,
      damage: 1.6,
      range: 14,
    },
    enrage: { below: 0.25, cooldownFactor: 0.75, damageFactor: 1.2 },
  },
  /* the Troll Hollow in the White Waste (rules/frostmarch.js): spikes of ice burst up under whoever is near, and
     from below half health he tears blocks out of the ice and throws them */
  hrimgar: {
    cleave: { every: [6, 8], windup: 1.1, radius: 3.4, damage: 1.9 },
    icicles: { every: [6.5, 8.5], windup: 1.4, radius: 2, damage: 1.6, range: 16 },
    boulders: {
      below: 0.5,
      every: [5.5, 7.5],
      windup: 1.4,
      radius: 1.9,
      damage: 1.7,
      range: 16,
    },
    summon: { below: 0.6, helper: "ice_troll", count: 2 },
    enrage: { below: 0.25, cooldownFactor: 0.7, damageFactor: 1.25 },
  },
  /* the Forge of the First Flame (rules/forge.js): pools of lava burst under whoever stands still, a blast of fire
     runs down a lane until a pillar stops it, and below 30 % his shell of cooled stone breaks: faster, harder */
  ember_warden: {
    cleave: { every: [6, 8], windup: 1, radius: 3.4, damage: 1.8 },
    lavaPools: { every: [6.5, 8.5], windup: 1.5, radius: 2, damage: 1.5, range: 16 },
    blast: { every: [9, 12], windup: 1.9, length: 22, width: 3.4, damage: 2.8 },
    summon: { below: 0.6, helper: "molten_slime", count: 2 },
    enrage: { below: 0.3, cooldownFactor: 0.6, damageFactor: 1.3 },
  },
  /* the Crownmere on Tidecrown (rules/tidecrown.js): it never leaves the lake. It comes up beside whoever it hunts,
     bites at the shore and slams tentacles across it, then sinks out of reach and comes up somewhere else; geysers
     burst under everyone near the lake, and from half health a wave rolls out over the shore until a rock tooth of
     the crown breaks it */
  grey_leviathan: {
    surface: { under: [3, 4.5], above: [10, 13] },
    cleave: { every: [5, 7], windup: 1, radius: 3.6, damage: 1.8 },
    tentacles: { every: [4.5, 6.5], windup: 1.3, width: 2.2, length: 11, damage: 1.9 },
    geysers: { every: [7, 9], windup: 1.4, radius: 2, damage: 1.5, range: 30 },
    surge: { below: 0.5, every: [11, 14], windup: 1.8, length: 18, width: 4.4, damage: 2.6 },
    enrage: { below: 0.25, cooldownFactor: 0.7, damageFactor: 1.25 },
  },
};
/* a boss with nobody to fight for this long heals and starts over */
const RESET_SECONDS = 8;

/* the body of a charging boss, for what it runs into */
const CHARGE_RADIUS = 0.5;

const randomBetween = ([min, max]) => min + Math.random() * (max - min);

/** The boss rules for a monster key ('dire_boar'), or null for an ordinary monster. */
export const bossOf = (key) => BOSSES[key] || null;

/** Is this monster out of reach under the water (a lake monster between surfacings)? It cannot be hit then. */
export const isSubmerged = (monster) => !!(monster.boss && monster.boss.submerged);

/** Clears a boss's state, for a fresh start after it respawns (the troll's bridge is whole again). */
export function resetBoss(monster) {
  monster.boss = null;
  if (bossOf(monster.spec.key)?.planks) {
    mendBridge();
  }
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
      nextRunes: now + 4,
      nextPlanks: now + 2.5,
      nextDive: now + 7,
      nextBlast: now + 5,
      nextTentacle: now + 2.5,
      nextSurge: now + 6,
      /* a lake monster starts out of sight, and comes up a moment after someone is near */
      submerged: !!bossOf(monster.spec.key)?.surface,
      surfaceAt: now + 1.5,
      diveAt: 0,
      idleFor: 0,
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

  /* nobody left to fight: heal, and start over (a dark room lights up again) */
  state.idleFor = target ? 0 : state.idleFor + dt;
  if (!state.move && state.idleFor > RESET_SECONDS && (health < 1 || state.isEnraged)) {
    monster.hp = monster.spec.hp;
    resetBoss(monster);
    ctx.emit("boss_reset", { id: monster.id });
    return false;
  }

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
    if (
      move.kind === "blast-windup" ||
      move.kind === "surge-windup" ||
      move.kind === "tentacle-windup"
    ) {
      if (now >= move.until) {
        const blast =
          move.kind === "surge-windup"
            ? rules.surge
            : move.kind === "tentacle-windup"
              ? rules.tentacles
              : rules.blast;
        strike(
          monster,
          playersOnLine(ctx.players, move.x0, move.z0, move.x1, move.z1, blast.width),
          blast.damage,
          ctx,
        );
        state.move = null;
      }
      return true;
    }
    if (move.kind === "volley-windup") {
      if (now >= move.until) {
        const volley = rules[move.volley];
        const hit = ctx.players.filter(
          (player) =>
            !player.isDead &&
            move.spots.some(([x, z]) => Math.hypot(player.x - x, player.z - z) <= volley.radius),
        );
        strike(monster, hit, volley.damage, ctx);
        state.move = null;
      }
      return true;
    }
    if (move.kind === "planks-windup") {
      if (now >= move.until) {
        const { area } = move;
        const hit = ctx.players.filter(
          (player) =>
            !player.isDead &&
            player.x > area.x0 - 0.3 &&
            player.x < area.x1 + 0.3 &&
            player.z > area.z0 - 0.3 &&
            player.z < area.z1 + 0.3,
        );
        strike(monster, hit, rules.planks.damage, ctx);
        /* the planks give way, unless the bridge would be cut in two */
        if (move.breaks) {
          breakPlanks(area);
          ctx.emit("boss_planks", { id: monster.id, ...area });
        }
        state.move = null;
      }
      return true;
    }
    if (move.kind === "dive") {
      /* through the air, like the charge: the positions sent along match the flight */
      const progress = Math.min(1, 1 - (move.until - now) / move.duration);
      monster.x = move.x0 + (move.x1 - move.x0) * progress;
      monster.z = move.z0 + (move.z1 - move.z0) * progress;
      if (now >= move.until) {
        const dive = rules.dive;
        const hit = ctx.players.filter(
          (player) =>
            !player.isDead && Math.hypot(player.x - move.x1, player.z - move.z1) <= dive.radius,
        );
        strike(monster, hit, dive.damage, ctx);
        state.move = null;
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

  /* a lake monster: under the water out of reach, then up beside the one it hunts for a while */
  if (rules.surface) {
    return lakeTick(monster, target, rules, state, now, ctx);
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

  /* the blast: a lane of fire straight at the target, shown on the ground first; it stops at the first wall or
     pillar in its way, so stepping behind one is the way out */
  if (rules.blast && now >= state.nextBlast && distance <= rules.blast.length) {
    const blast = rules.blast;
    state.nextBlast =
      now + blast.windup + randomBetween(blast.every) * rageFactors(monster).cooldown;
    const ux = dx / distance;
    const uz = dz / distance;
    const lane = freeRun(monster.x, monster.z, ux, uz, blast.length, ctx);
    monster.faceX = ux;
    monster.faceZ = uz;
    state.move = {
      kind: "blast-windup",
      until: now + blast.windup,
      x0: monster.x,
      z0: monster.z,
      x1: lane.x1,
      z1: lane.z1,
    };
    ctx.emit("boss_telegraph", {
      id: monster.id,
      kind: "blast",
      x0: +monster.x.toFixed(2),
      z0: +monster.z.toFixed(2),
      x1: +lane.x1.toFixed(2),
      z1: +lane.z1.toFixed(2),
      width: blast.width,
      duration: blast.windup,
    });
    return true;
  }

  /* the planks: with the target on the bridge, a stretch of the deck under it shows red, then breaks */
  const isOverGorge =
    onBridge(target.x, target.z) && target.z < GORGE.south && target.z > GORGE.north;
  if (rules.planks && now >= state.nextPlanks && isOverGorge && distance <= rules.planks.range) {
    const planks = rules.planks;
    state.nextPlanks =
      now + planks.windup + randomBetween(planks.every) * rageFactors(monster).cooldown;
    const stretch = plankStretch(target.x, target.z);
    /* where the bridge must hold, he still smashes the planks there: they hurt, but do not fall */
    const isWest = target.x < BRIDGE.x;
    const area = stretch || {
      x0: isWest ? BRIDGE.x - BRIDGE.halfWidth : BRIDGE.x,
      x1: isWest ? BRIDGE.x : BRIDGE.x + BRIDGE.halfWidth,
      z0: +(target.z - 1.5).toFixed(2),
      z1: +(target.z + 1.5).toFixed(2),
    };
    state.move = {
      kind: "planks-windup",
      until: now + planks.windup,
      area,
      breaks: !!stretch,
    };
    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;
    const middle = +((area.x0 + area.x1) / 2).toFixed(2);
    ctx.emit("boss_telegraph", {
      id: monster.id,
      kind: "planks",
      x0: middle,
      z0: area.z1,
      x1: middle,
      z1: area.z0,
      width: +(area.x1 - area.x0).toFixed(2),
      duration: planks.windup,
    });
    return true;
  }

  /* a volley: blood runes, pools of lava or spikes of ice (from the start), or boulders (when low on health: they
     take over), a circle under every player nearby that bursts a moment later; boulders fly there from the boss's
     hands */
  const volleyName =
    (rules.boulders && health <= rules.boulders.below && "boulders") ||
    (rules.geysers && "geysers") ||
    (rules.bloodRunes && "bloodRunes") ||
    (rules.lavaPools && "lavaPools") ||
    (rules.icicles && "icicles");
  if (volleyName && now >= state.nextRunes) {
    const volley = rules[volleyName];
    const spots = ctx.players
      .filter(
        (player) =>
          !player.isDead && Math.hypot(player.x - monster.x, player.z - monster.z) <= volley.range,
      )
      .map((player) => [+player.x.toFixed(2), +player.z.toFixed(2)]);
    state.nextRunes =
      now + volley.windup + randomBetween(volley.every) * rageFactors(monster).cooldown;
    if (spots.length) {
      state.move = {
        kind: "volley-windup",
        volley: volleyName,
        until: now + volley.windup,
        spots,
      };
      for (const [x, z] of spots) {
        ctx.emit("boss_telegraph", {
          id: monster.id,
          kind: volleyName === "icicles" ? "icicle" : "circle",
          x,
          z,
          radius: volley.radius,
          duration: volley.windup,
        });
        if (volleyName === "boulders") {
          ctx.emit("boss_boulder", {
            id: monster.id,
            x0: +monster.x.toFixed(2),
            z0: +monster.z.toFixed(2),
            x1: x,
            z1: z,
            duration: volley.windup,
          });
        }
      }
      return true;
    }
  }

  /* the dive: up into the air, and down on whoever keeps their distance; the landing shows on the ground first */
  if (rules.dive && now >= state.nextDive && distance >= rules.dive.minDistance) {
    const dive = rules.dive;
    state.nextDive = now + dive.windup + randomBetween(dive.every) * rageFactors(monster).cooldown;
    const x1 = +target.x.toFixed(2);
    const z1 = +target.z.toFixed(2);
    state.move = {
      kind: "dive",
      until: now + dive.windup,
      duration: dive.windup,
      x0: monster.x,
      z0: monster.z,
      x1,
      z1,
    };
    monster.faceX = dx / distance;
    monster.faceZ = dz / distance;
    ctx.emit("boss_telegraph", {
      id: monster.id,
      kind: "circle",
      x: x1,
      z: z1,
      radius: dive.radius,
      duration: dive.windup,
    });
    ctx.emit("boss_dive", {
      id: monster.id,
      x0: +monster.x.toFixed(2),
      z0: +monster.z.toFixed(2),
      x1,
      z1,
      duration: dive.windup,
    });
    return true;
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

/* A blow in a lane from (x0, z0) along (ux, uz), `length` long, shown on the ground first: 'blast' and 'surge' stop
   at the first rock or wall in their way, a tentacle does not. */
function laneMove(monster, kind, x0, z0, ux, uz, rules, now, ctx) {
  /* a wave starts in the water: it runs free until it reaches the shore, and from there until something stops it */
  let startX = x0;
  let startZ = z0;
  for (let k = 0; kind === "surge" && k < 32 && !ctx.isFree(startX, startZ, 0.5); k++) {
    startX += ux * 0.25;
    startZ += uz * 0.25;
  }
  const lane =
    kind === "tentacle"
      ? { x1: x0 + ux * rules.length, z1: z0 + uz * rules.length }
      : freeRun(startX, startZ, ux, uz, rules.length - Math.hypot(startX - x0, startZ - z0), ctx);
  monster.boss.move = {
    kind: kind + "-windup",
    until: now + rules.windup,
    x0,
    z0,
    x1: lane.x1,
    z1: lane.z1,
  };
  ctx.emit("boss_telegraph", {
    id: monster.id,
    kind,
    x0: +x0.toFixed(2),
    z0: +z0.toFixed(2),
    x1: +lane.x1.toFixed(2),
    z1: +lane.z1.toFixed(2),
    width: rules.width,
    duration: rules.windup,
  });
}

/* The Leviathan's step in its lake (see the top of grey_leviathan): it never walks, so this always takes over. */
function lakeTick(monster, target, rules, state, now, ctx) {
  const surface = rules.surface;
  const rage = rageFactors(monster).cooldown;
  if (!state.submerged && (now >= state.diveAt || !target)) {
    state.submerged = true;
    state.surfaceAt = now + randomBetween(surface.under);
    ctx.emit("boss_submerge", { id: monster.id });
    return true;
  }
  if (!target) {
    return true;
  }
  if (state.submerged) {
    if (now < state.surfaceAt) {
      return true;
    }
    const spot = surfaceSpotNear(target.x, target.z);
    if (!spot) {
      /* nobody by the lake: it waits under the water */
      state.surfaceAt = now + 1;
      return true;
    }
    [monster.x, monster.z] = spot;
    const length = Math.hypot(target.x - monster.x, target.z - monster.z) || 1;
    monster.faceX = (target.x - monster.x) / length;
    monster.faceZ = (target.z - monster.z) / length;
    state.submerged = false;
    state.diveAt = now + randomBetween(surface.above) * rage;
    /* a moment to see it come up before it strikes */
    state.nextCleave = Math.max(state.nextCleave, now + 1.2);
    state.nextTentacle = Math.max(state.nextTentacle, now + 1.6);
    ctx.emit("boss_surface", { id: monster.id, x: monster.x, z: monster.z });
    return true;
  }
  const dx = target.x - monster.x;
  const dz = target.z - monster.z;
  const distance = Math.hypot(dx, dz) || 1e-4;
  const ux = dx / distance;
  const uz = dz / distance;
  monster.faceX = ux;
  monster.faceZ = uz;
  const health = monster.hp / monster.spec.hp;
  /* the wave: from half health, out of the lake over the shore at the one it hunts */
  if (rules.surge && health <= rules.surge.below && now >= state.nextSurge) {
    state.nextSurge = now + rules.surge.windup + randomBetween(rules.surge.every) * rage;
    laneMove(monster, "surge", monster.x, monster.z, ux, uz, rules.surge, now, ctx);
    return true;
  }
  /* the bite: whoever stands at the water's edge before its head */
  if (now >= state.nextCleave && distance < rules.cleave.radius + 1) {
    state.nextCleave = now + rules.cleave.windup + randomBetween(rules.cleave.every) * rage;
    state.move = { kind: "cleave-windup", until: now + rules.cleave.windup };
    ctx.emit("boss_telegraph", {
      id: monster.id,
      kind: "circle",
      x: +monster.x.toFixed(2),
      z: +monster.z.toFixed(2),
      radius: rules.cleave.radius,
      duration: rules.cleave.windup,
    });
    return true;
  }
  /* a tentacle: out of the water beside its head, and down across the target */
  if (now >= state.nextTentacle) {
    state.nextTentacle = now + rules.tentacles.windup + randomBetween(rules.tentacles.every) * rage;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x0 = monster.x - uz * side * 2;
    const z0 = monster.z + ux * side * 2;
    const tx = target.x - x0;
    const tz = target.z - z0;
    const reach = Math.hypot(tx, tz) || 1;
    laneMove(monster, "tentacle", x0, z0, tx / reach, tz / reach, rules.tentacles, now, ctx);
    return true;
  }
  /* geysers under everyone near the lake */
  if (now >= state.nextRunes) {
    const volley = rules.geysers;
    const spots = ctx.players
      .filter(
        (player) =>
          !player.isDead && Math.hypot(player.x - monster.x, player.z - monster.z) <= volley.range,
      )
      .map((player) => [+player.x.toFixed(2), +player.z.toFixed(2)]);
    state.nextRunes = now + volley.windup + randomBetween(volley.every) * rage;
    if (spots.length) {
      state.move = { kind: "volley-windup", volley: "geysers", until: now + volley.windup, spots };
      for (const [x, z] of spots) {
        ctx.emit("boss_telegraph", {
          id: monster.id,
          kind: "geyser",
          x,
          z,
          radius: volley.radius,
          duration: volley.windup,
        });
      }
      return true;
    }
  }
  return true;
}
