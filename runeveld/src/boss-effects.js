/* Eldoria – what the players see of a boss's moves (rules/bosses.js): the red warning on the ground before a blow,
   the charge, the daze after running into something, the call for help, the smoke bomb and the rage. The host
   (the server or the hosting client) sends the events; every client shows them the same way. */
import * as THREE from "three";
import { scene, camera, shakeCamera } from "./world.js";
import { player, monsters, now, playEffect } from "./game-state.js";
import { groundRing, stopAfter } from "./skill-effects.js";
import { burst, ringBurst } from "./particles.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";
import { bossOf } from "./rules/bosses.js";
import { setSanctumDark } from "./crypt.js";

/* a warning on the ground draws over the night haze (renderOrder 10000), so it is never missed */
const WARNING_ORDER = 10001;
const WARNING_COLOR = 0xff3b2f;
/* a boss further away than this makes no sound and does not shake the screen */
const HEARING_DISTANCE = 22;

/* a lane of one by one, from its start along +z: scaled to width and length */
const laneGeometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const discGeometry = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
const edgeGeometry = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);

/* running warnings, advanced by updateBossEffects() */
const warnings = [];

const distanceToPlayer = (x, z) => Math.hypot(x - player.x, z - player.z);

function warningMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: WARNING_COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function warningMesh(geometry, opacity) {
  const mesh = new THREE.Mesh(geometry, warningMaterial(opacity));
  mesh.renderOrder = WARNING_ORDER;
  return mesh;
}

/* the boss itself, while it is alive */
function bossById(id) {
  const monster = monsters.get(id);
  return monster && !monster.isDead ? monster : null;
}

/** boss_telegraph: a red lane (charge) or circle (cleave) on the ground that fills up until the blow lands. */
export function bossTelegraph(data) {
  const group = new THREE.Group();
  const area = warningMesh(data.kind === "charge" ? laneGeometry : discGeometry, 0.16);
  const fill = warningMesh(data.kind === "charge" ? laneGeometry : discGeometry, 0.32);
  group.add(area, fill);
  /* a bright border that pulses */
  const edges = [];
  if (data.kind === "charge") {
    const dx = data.x1 - data.x0;
    const dz = data.z1 - data.z0;
    const length = Math.hypot(dx, dz);
    group.position.set(data.x0, 0.07, data.z0);
    group.rotation.y = Math.atan2(dx, dz);
    area.scale.set(data.width, 1, length);
    for (const side of [-1, 1]) {
      const edge = warningMesh(laneGeometry, 0.7);
      edge.scale.set(0.1, 1, length);
      edge.position.x = (side * (data.width - 0.1)) / 2;
      edges.push(edge);
    }
  } else {
    group.position.set(data.x, 0.07, data.z);
    area.scale.setScalar(data.radius);
    const edge = warningMesh(edgeGeometry, 0.7);
    edge.scale.setScalar(data.radius);
    edges.push(edge);
  }
  group.add(...edges);
  scene.add(group);
  warnings.push({ data, group, area, fill, edges, time: 0, fade: 0 });

  const boss = bossById(data.id);
  if (boss) {
    /* it rears back: away from where it is going to strike */
    if (data.kind === "charge") {
      boss.sprite.nudge(data.x0 - data.x1, data.z0 - data.z1, 0.35);
    } else {
      boss.sprite.play("attack", true);
      boss.attackAnimUntil = now() + data.duration + 0.3;
    }
  }
  const x = data.kind === "charge" ? data.x0 : data.x;
  const z = data.kind === "charge" ? data.z0 : data.z;
  if (distanceToPlayer(x, z) < HEARING_DISTANCE) {
    sfx.bossWarn();
  }
}

/** boss_charge: the boss rushes along its lane; updateMonsters() moves it (monster.charge). */
export function bossCharge(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  boss.charge = {
    x0: boss.x,
    z0: boss.z,
    x1: data.x1,
    z1: data.z1,
    t0: now(),
    duration: data.duration,
  };
  boss.chargeDustTimer = 0;
  if (distanceToPlayer(boss.x, boss.z) < HEARING_DISTANCE) {
    sfx.bossSlam();
    shakeCamera(0.12, 0.25);
  }
}

/** Called by updateMonsters() for a charging boss: dust at its feet and a rumble for those close by. */
export function chargeDust(boss, dt) {
  boss.chargeDustTimer -= dt;
  if (boss.chargeDustTimer > 0) {
    return;
  }
  boss.chargeDustTimer = 0.05;
  burst(boss.x, 0.2, boss.z, { color: 0xb89a74, count: 3, speed: 2, size: 3, life: 0.5 });
  if (distanceToPlayer(boss.x, boss.z) < 7) {
    shakeCamera(0.08, 0.1);
  }
}

/** boss_stunned: it ran into something and is dazed for a moment; the moment to hit it. */
export function bossStunned(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  const height = boss.sprite.height * boss.scale;
  UI.floatingText(boss.x, height, boss.z, camera, "Stunned!", "crit");
  playEffect("rubble", boss.x, boss.z, { size: 2.6, grounded: true });
  ringBurst(boss.x, boss.z, 1.2, { color: 0xc8a878, count: 24, size: 3 });
  stopAfter(
    playEffect("sparkle", boss.x, boss.z, {
      size: 1.7,
      y: height * 0.9,
      tint: 0xfff1a0,
      loop: true,
      follow: boss,
    }),
    data.duration,
  );
  if (distanceToPlayer(boss.x, boss.z) < HEARING_DISTANCE) {
    sfx.bossSlam();
    shakeCamera(0.3, 0.3);
  }
}

/** boss_summon: it calls for help; the helpers come out of the smoke around it. */
export function bossSummon(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  UI.speechBubble(boss.label, boss.spec.lines?.summon || "To me, lads!");
  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * Math.PI * 2;
    playEffect("smoke", boss.x + Math.cos(angle) * 2.5, boss.z + Math.sin(angle) * 2.5, {
      size: 2.2,
      grounded: true,
      delay: k * 0.05,
    });
  }
  if (distanceToPlayer(boss.x, boss.z) < HEARING_DISTANCE) {
    sfx.bossRoar();
  }
}

/** boss_smoke: gone in a cloud at (x0, z0), back out of one at (x1, z1). */
export function bossSmoke(data) {
  playEffect("smoke", data.x0, data.z0, { size: 2.6, grounded: true });
  playEffect("smoke", data.x1, data.z1, { size: 2.6, grounded: true, delay: 0.08 });
  const boss = bossById(data.id);
  if (boss) {
    boss.x = boss.targetX = data.x1;
    boss.z = boss.targetZ = data.z1;
    boss.sprite.play("attack", true);
    boss.attackAnimUntil = now() + 0.4;
  }
  if (distanceToPlayer(data.x1, data.z1) < HEARING_DISTANCE) {
    sfx.skill();
  }
}

/** boss_dive: it takes to the air (its 'fly' frames) and comes down on the circle shown on the ground. */
export function bossDive(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  boss.charge = {
    x0: boss.x,
    z0: boss.z,
    x1: data.x1,
    z1: data.z1,
    t0: now(),
    duration: data.duration,
    arc: 2.6,
    anim: "fly",
  };
  burst(boss.x, 1.2, boss.z, { color: 0x2a1830, count: 14, speed: 3, size: 3 });
  if (distanceToPlayer(boss.x, boss.z) < HEARING_DISTANCE) {
    sfx.bossRoar();
  }
}

/** boss_reset: nobody left to fight it, so it healed and starts over. */
export function bossReset(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  boss.isEnraged = false;
  if (bossOf(boss.spec.key)?.enrage?.darkness) {
    setSanctumDark(false);
  }
}

/** boss_enrage: low on health, it turns red and hits harder and sooner. */
export function bossEnrage(data) {
  const boss = bossById(data.id);
  if (!boss) {
    return;
  }
  boss.isEnraged = true;
  /* the Count calls the dark: the sanctum's fires go out */
  if (bossOf(boss.spec.key)?.enrage?.darkness) {
    setSanctumDark(true);
  }
  UI.speechBubble(boss.label, boss.spec.lines?.enrage || "Enough games!");
  UI.floatingText(boss.x, boss.sprite.height * boss.scale, boss.z, camera, "Enraged!", "crit");
  groundRing(boss.x, boss.z, WARNING_COLOR, 0.5, 4, 0.6, 0.8);
  ringBurst(boss.x, boss.z, 1, { color: 0xff6a4a, count: 36, size: 3 });
  if (distanceToPlayer(boss.x, boss.z) < HEARING_DISTANCE) {
    sfx.bossRoar();
    screenFlash("255, 60, 40");
    shakeCamera(0.25, 0.35);
  }
}

function removeWarning(index) {
  const warning = warnings[index];
  scene.remove(warning.group);
  for (const mesh of warning.group.children) {
    mesh.material.dispose();
  }
  warnings.splice(index, 1);
}

/** Fills the warnings on the ground; once the blow lands, a warning flashes and fades. */
export function updateBossEffects(dt) {
  for (let i = warnings.length - 1; i >= 0; i--) {
    const warning = warnings[i];
    const { data, area, fill, edges } = warning;
    warning.time += dt;
    const progress = Math.min(1, warning.time / data.duration);
    if (data.kind === "charge") {
      fill.scale.set(data.width, 1, area.scale.z * progress);
    } else {
      fill.scale.setScalar(data.radius * progress);
    }
    for (const edge of edges) {
      edge.material.opacity = 0.5 + 0.3 * Math.sin(warning.time * 18);
    }
    if (progress < 1) {
      continue;
    }
    /* the blow: a bright flash, then gone */
    if (!warning.fade) {
      warning.fade = 1e-4;
      fill.material.opacity = 0.6;
      if (data.kind === "circle") {
        ringBurst(data.x, data.z, data.radius, { color: 0xffb08a, count: 40, size: 3 });
        if (distanceToPlayer(data.x, data.z) < HEARING_DISTANCE) {
          sfx.bossSlam();
          shakeCamera(0.2, 0.2);
        }
      }
    }
    warning.fade += dt;
    const left = Math.max(0, 1 - warning.fade / 0.3);
    fill.material.opacity = 0.6 * left;
    area.material.opacity = 0.16 * left;
    for (const edge of edges) {
      edge.material.opacity = 0.7 * left;
    }
    if (left <= 0) {
      removeWarning(i);
    }
  }
}
