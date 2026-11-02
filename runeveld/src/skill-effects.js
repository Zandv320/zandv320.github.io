/* Eldoria – visual helpers for skills and clicks: rings of light that spread over the ground, flashes of light,
   projectiles that fly to a monster with a glow round them and a trail of their element, rings of flames or ice
   shards, the rune circle under a caster, the ward aura and the target ring. The sprite effects themselves come
   from effects.js (via playEffect); the particles and the light at night from weapon-fx.js, as an enchantment's. */
import * as THREE from "three";
import { scene, camera } from "./world.js";
import { player, playEffect } from "./game-state.js";
import { trail } from "./particles.js";
import { fxBurst, fxStream, flashLight } from "./weapon-fx.js";

export { fxBurst, fxStream, flashLight };

/* running ground rings, flashes and projectile flights, advanced by updateSkillEffects() */
const activeEffects = [];
const ringGeometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

/* a ring of light with a soft glow on both sides of its bright rim, fading towards the middle */
const ringTexture = (() => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.08)");
  gradient.addColorStop(0.84, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.92, "rgba(255,255,255,1)");
  gradient.addColorStop(0.97, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
})();

/* a round soft light, white in its heart */
const haloTexture = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.7)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
})();

/* a soft light that always faces the camera, over the night haze */
function halo(color, size) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.setScalar(size);
  sprite.renderOrder = 10002;
  return sprite;
}

/**
 * A flash of soft light at (x, y, z): it swells to `size` and fades in `duration` seconds; at night it lights
 * the ground around it too.
 */
export function glowFlash(x, y, z, color, size = 2, duration = 0.35) {
  const sprite = halo(color, size * 0.4);
  sprite.position.set(x, y, z);
  scene.add(sprite);
  activeEffects.push({ flash: sprite, time: 0, duration, size });
  const tint = new THREE.Color(color);
  flashLight(x, z, [tint.r * 255, tint.g * 255, tint.b * 255], {
    radius: size * 2.2,
    strength: 0.9,
    seconds: duration * 1.6,
    y,
  });
}

/* a spell's colour → the element of its particles (for the trail of a bolt) */
const ELEMENT_OF = { 0xff8c42: "flame", 0xffb347: "flame", 0x9ad8ff: "frost", 0xd8c8ff: "arcane" };

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
export function flyEffect(effect, x0, z0, target, duration, onArrive, trailColor = null) {
  const element = trailColor === null ? null : ELEMENT_OF[trailColor] || null;
  /* a glow round the bolt in its colour */
  const glow = trailColor === null ? null : halo(trailColor, 1.4);
  if (glow) {
    scene.add(glow);
  }
  activeEffects.push({
    time: 0,
    duration,
    flight: { x0, z0, target, onArrive, effect, trailColor, element, glow },
  });
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
  /* a spark trail behind it, in its colour */
  flyEffect(effect, x0, z0, monster, duration, onHit, color);
}

/** A ring of light on the ground that spreads from startRadius to endRadius and fades out. */
export function groundRing(x, z, color, startRadius, endRadius, duration, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    map: ringTexture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(ringGeometry, material);
  mesh.position.set(x, 0.05, z);
  /* over the night haze: a spell's ring lights up */
  mesh.renderOrder = 10001;
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

    if (entry.flash) {
      /* swells fast, fades slower */
      entry.flash.scale.setScalar(entry.size * (0.4 + 0.6 * Math.sqrt(progress)));
      entry.flash.material.opacity = 1 - progress * progress;
      if (progress >= 1) {
        scene.remove(entry.flash);
        entry.flash.material.dispose();
        activeEffects.splice(i, 1);
      }
      continue;
    }

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
        if (flight.trailColor !== null) {
          const position = flight.effect.group.position;
          /* the bolt sheds its element's particles, as an enchanted blade does */
          if (flight.element) {
            fxBurst(flight.element, position.x, position.y, position.z, {
              count: 3,
              spread: 0.12,
              speed: 0.3,
            });
          } else {
            trail(position.x, position.y, position.z, flight.trailColor);
          }
          if (flight.glow) {
            flight.glow.position.copy(position);
            flight.glow.material.opacity = 0.75 + 0.25 * Math.sin(entry.time * 40);
          }
        }
      }
      if (progress >= 1) {
        if (flight.effect) {
          flight.effect.stop();
        }
        if (flight.glow) {
          scene.remove(flight.glow);
          flight.glow.material.dispose();
          const position = flight.effect ? flight.effect.group.position : flight.glow.position;
          glowFlash(position.x, position.y, position.z, flight.trailColor, 2.2, 0.3);
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
