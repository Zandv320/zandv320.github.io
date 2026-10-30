/* Eldoria – visual helpers for skills and clicks: expanding rings on the ground, projectiles that fly to a
   monster, rings of flames or ice shards, the rune circle under a caster, the ward aura and the target ring.
   The sprite effects themselves come from effects.js (via playEffect). */
import * as THREE from "three";
import { scene, camera } from "./world.js";
import { player, playEffect } from "./game-state.js";

/* running ground rings and projectile flights, advanced by updateSkillEffects() */
const activeEffects = [];
const ringGeometry = new THREE.RingGeometry(0.82, 1, 40);

/** `count` flames in a circle of `radius` around (x, z) that go out after `duration` seconds. */
export function flamesAround(x, z, radius, count, duration, name = "fire", size = 1.3) {
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + Math.random();
    const flame = playEffect(name, x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, {
      size: size + Math.random() * 0.5,
      grounded: true,
      loop: true,
      delay: 0.2 + k * 0.07,
    });
    if (flame) {
      setTimeout(() => flame.stop(), duration * 1000 + k * 120);
    }
  }
}

/** Ice shards in a circle (frost spells). */
export function iceShardsAround(x, z, radius, count, size) {
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + Math.random() * 0.6;
    playEffect("ice_shards", x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, {
      size,
      grounded: true,
      delay: 0.05 + Math.random() * 0.2,
    });
  }
}

/** The rune circle under the caster, for `duration` seconds. */
export function runeCircle(tint, duration) {
  const circle = playEffect("rune_circle", player.x, player.z, {
    size: 3.4,
    y: 0.05,
    tint,
    loop: true,
    follow: player,
    additive: true,
  });
  if (circle) {
    setTimeout(() => circle.stop(), duration * 1000);
  }
}

/** Stops a (looping) effect after `duration` seconds; returns the effect. */
export function stopAfter(effect, duration) {
  if (effect) {
    setTimeout(() => effect.stop(), duration * 1000);
  }
  return effect;
}

/** The on-screen angle from (x0, z0) to (x1, z1), for directed effects such as the lance. */
export function screenAngle(x0, z0, x1, z1) {
  const from = new THREE.Vector3(x0, 0.8, z0).project(camera);
  const to = new THREE.Vector3(x1, 0.8, z1).project(camera);
  return Math.atan2((to.y - from.y) * innerHeight, (to.x - from.x) * innerWidth);
}

/**
 * Moves `effect` in an arc from (x0, z0) to `target` (anything with x and z, followed while it moves) in
 * `duration` seconds, then stops the effect and calls `onArrive`.
 */
export function flyEffect(effect, x0, z0, target, duration, onArrive) {
  activeEffects.push({ time: 0, duration, flight: { x0, z0, target, onArrive, effect } });
}

/** A projectile: the comet from the effect sheets (or another effect) flies from (x0, z0) to the monster, then onHit(). */
export function launchProjectile(x0, z0, monster, color, onHit, name = "comet", size = 2.6) {
  /* the comet is orange by itself; other colours tint it */
  const tint = name === "comet" && color !== 0xff8c42 ? color : null;
  const effect = playEffect(name, x0, z0, {
    size,
    y: 0.9,
    loop: true,
    mirror: monster.x - x0 < 0,
    tint,
  });
  const duration = Math.max(0.14, Math.hypot(monster.x - x0, monster.z - z0) / 20);
  flyEffect(effect, x0, z0, monster, duration, onHit);
}

/** A flat ring on the ground that grows from startRadius to endRadius and fades out. */
export function groundRing(x, z, color, startRadius, endRadius, duration, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(ringGeometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.04, z);
  scene.add(mesh);
  activeEffects.push({ mesh, time: 0, duration, startRadius, endRadius, opacity });
}

/** An aura that follows the hero while a ward lasts. */
export function wardAura(tint) {
  if (player.wardEffect) {
    player.wardEffect.stop();
  }
  player.wardEffect = playEffect("shield_dome", player.x, player.z, {
    size: 2.9,
    y: 0.05,
    grounded: true,
    tint,
    loop: true,
    follow: player,
    additive: true,
  });
}

export function updateSkillEffects(dt) {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const entry = activeEffects[i];
    entry.time += dt;
    const progress = Math.min(1, entry.time / entry.duration);

    if (entry.flight) {
      const flight = entry.flight;
      const targetX = flight.target.x;
      const targetZ = flight.target.z;
      if (flight.effect) {
        flight.effect.group.position.set(
          flight.x0 + (targetX - flight.x0) * progress,
          0.9 + Math.sin(progress * Math.PI) * 0.4,
          flight.z0 + (targetZ - flight.z0) * progress,
        );
      }
      if (progress >= 1) {
        if (flight.effect) {
          flight.effect.stop();
        }
        activeEffects.splice(i, 1);
        flight.onArrive();
      }
      continue;
    }

    /* ease out: fast at first, slowing down */
    const radius =
      entry.startRadius + (entry.endRadius - entry.startRadius) * (1 - Math.pow(1 - progress, 2));
    entry.mesh.scale.setScalar(Math.max(0.01, radius));
    entry.mesh.material.opacity = entry.opacity * (1 - progress);
    if (progress >= 1) {
      scene.remove(entry.mesh);
      entry.mesh.material.dispose();
      activeEffects.splice(i, 1);
    }
  }
}

/* the red ring under the current target */
const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.62, 32),
  new THREE.MeshBasicMaterial({
    color: 0xff6b6b,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.position.y = 0.03;
targetRing.visible = false;
scene.add(targetRing);

/** Shows the target ring under the player's target, slowly turning and pulsing. */
/* the ring under the target: gold while it is only selected, red while the hero fights it */
const SELECTED_COLOR = new THREE.Color(0xffd166);
const ATTACKING_COLOR = new THREE.Color(0xff6b6b);

export function updateTargetRing(dt, time) {
  targetRing.visible = !!player.target;
  if (player.target) {
    targetRing.material.color.copy(player.isAttacking ? ATTACKING_COLOR : SELECTED_COLOR);
    targetRing.position.set(player.target.x, 0.03, player.target.z);
    targetRing.rotation.z += dt * 1.5;
    targetRing.scale.setScalar(1 + 0.08 * Math.sin(time * 7));
  }
}
