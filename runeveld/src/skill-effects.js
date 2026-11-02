/* Eldoria – visual helpers for skills and clicks: rings of light that spread over the ground, flashes of light,
   projectiles that fly to a monster with a glow round them and a trail of their element, rings of flames or ice
   shards, the rune circle under a caster, the ward aura and the target ring. The sprite effects themselves come
   from effects.js (via playEffect); the particles and the light at night from weapon-fx.js, as an enchantment's. */
import * as THREE from "three";
import { scene, camera } from "./world.js";
import { player, playEffect } from "./game-state.js";
import { trail } from "./particles.js";
import { fxBurst, fxStream, flashLight } from "./weapon-fx.js";
import { SMOOTH } from "./sprites.js";

export { fxBurst, fxStream, flashLight };

/* running ground rings, flashes and projectile flights, advanced by updateSkillEffects() */
const activeEffects = [];
/* with smooth sprites a ring of soft light; without them a flat band, as pixel art has */
const ringGeometry = SMOOTH
  ? new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
  : new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);

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
  if (!SMOOTH) {
    return;
  }
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

/* a canvas texture of `size` pixels, drawn by draw(ctx, size), smooth */
function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  return new THREE.CanvasTexture(canvas);
}

/* a circle of runes: two rings, runes between them and a six-pointed star, in soft light */
const runeRingTexture = canvasTexture(256, (ctx, size) => {
  const middle = size / 2;
  ctx.strokeStyle = "#fff";
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3;
  for (const radius of [120, 98]) {
    ctx.beginPath();
    ctx.arc(middle, middle, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(middle, middle, 90, 0, Math.PI * 2);
  ctx.stroke();
  /* runes between the outer rings: small strokes, each a little different */
  for (let k = 0; k < 18; k++) {
    const angle = (k / 18) * Math.PI * 2;
    ctx.save();
    ctx.translate(middle + Math.cos(angle) * 109, middle + Math.sin(angle) * 109);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    if (k % 3 === 0) {
      ctx.moveTo(-4, -2);
      ctx.lineTo(4, 2);
    } else if (k % 3 === 1) {
      ctx.moveTo(0, -6);
      ctx.lineTo(4, -1);
    } else {
      ctx.moveTo(-4, 3);
      ctx.lineTo(0, 0);
      ctx.lineTo(4, 3);
    }
    ctx.stroke();
    ctx.restore();
  }
  /* the star */
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    const b = ((k + 2) / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.moveTo(middle + Math.cos(a) * 90, middle + Math.sin(a) * 90);
    ctx.lineTo(middle + Math.cos(b) * 90, middle + Math.sin(b) * 90);
  }
  ctx.stroke();
});

/* frost on the ground: a pale disc, brighter in the middle, with streaks of ice out to its edge */
const frostTexture = canvasTexture(256, (ctx, size) => {
  const middle = size / 2;
  const gradient = ctx.createRadialGradient(middle, middle, 0, middle, middle, middle);
  gradient.addColorStop(0, "rgba(255,255,255,0.75)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 28; k++) {
    const angle = (k / 28) * Math.PI * 2 + Math.sin(k * 7.3) * 0.1;
    const from = 16 + (k % 4) * 10;
    const to = 70 + ((k * 37) % 50);
    ctx.beginPath();
    ctx.moveTo(middle + Math.cos(angle) * from, middle + Math.sin(angle) * from);
    ctx.lineTo(middle + Math.cos(angle) * to, middle + Math.sin(angle) * to);
    /* a little branch */
    const branch = (from + to) / 2;
    ctx.moveTo(middle + Math.cos(angle) * branch, middle + Math.sin(angle) * branch);
    ctx.lineTo(
      middle + Math.cos(angle + 0.12) * (branch + 14),
      middle + Math.sin(angle + 0.12) * (branch + 14),
    );
    ctx.stroke();
  }
});

/* a burnt patch: dark in the middle, fading out */
const scorchTexture = canvasTexture(128, (ctx, size) => {
  const middle = size / 2;
  const gradient = ctx.createRadialGradient(middle, middle, 0, middle, middle, middle);
  gradient.addColorStop(0, "rgba(20,10,6,0.85)");
  gradient.addColorStop(0.55, "rgba(30,16,10,0.5)");
  gradient.addColorStop(1, "rgba(30,16,10,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
});

/* a flat patch of light (or shade) on the ground of `radius`, over the night haze when it glows */
function groundPatch(texture, color, radius, { additive = true } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = additive ? 10001 : 1;
  return mesh;
}

/* an effect that runs for `duration` seconds: tick(progress, time) each frame, then done() */
function timed(duration, tick, done = () => {}) {
  activeEffects.push({ time: 0, duration, tick, done });
}

/* fades in quickly, holds, fades out over the last `fade` of its life */
const envelope = (progress, fadeIn = 0.12, fadeOut = 0.35) =>
  Math.min(1, progress / fadeIn, (1 - progress) / fadeOut);

/** Ice crystals that shoot up out of the ground in a circle, stand a moment and burst into frost (frost spells). */
export function iceShardsAround(x, z, radius, count, size) {
  if (!SMOOTH) {
    /* the shards of the effect sheet */
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2 + Math.random() * 0.6;
      playEffect("ice_shards", x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, {
        size,
        grounded: true,
        delay: 0.05 + Math.random() * 0.2,
      });
    }
    return;
  }
  const iceMaterial = new THREE.MeshLambertMaterial({
    color: 0xcdeeff,
    emissive: 0x3b86c8,
    transparent: true,
    opacity: 0.88,
    flatShading: true,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf4fcff });
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + Math.random() * 0.6;
    const cx = x + Math.cos(angle) * radius;
    const cz = z + Math.sin(angle) * radius;
    const crystal = new THREE.Group();
    /* two or three shards leaning out of one spot */
    for (let n = 0; n < 2 + (k % 2); n++) {
      const geometry = new THREE.OctahedronGeometry(0.28 * size * (1 - n * 0.25), 0);
      geometry.scale(0.5, 2.4, 0.5);
      const shard = new THREE.Mesh(geometry, iceMaterial);
      shard.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial));
      shard.position.set((n - 1) * 0.18 * size, 0, (n % 2) * 0.12 * size);
      shard.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (n - 1) * 0.35);
      crystal.add(shard);
    }
    crystal.position.set(cx, 0, cz);
    crystal.scale.set(1, 0.01, 1);
    scene.add(crystal);
    const delay = 0.05 + Math.random() * 0.2;
    const life = 1.1 + Math.random() * 0.3;
    timed(
      delay + life,
      (progress, time) => {
        const t = Math.max(0, time - delay);
        /* shoots up with an overshoot, stands, sinks back at the end */
        const grow = t < 0.16 ? (t / 0.16) * 1.15 : t < 0.26 ? 1.15 - ((t - 0.16) / 0.1) * 0.15 : 1;
        const sink = t > life - 0.2 ? Math.max(0.01, (life - t) / 0.2) : 1;
        crystal.scale.set(1, Math.max(0.01, grow * sink), 1);
      },
      () => {
        scene.remove(crystal);
        fxBurst("frost", cx, 0.5, cz, { count: 10, spread: 0.2, speed: 0.9 });
      },
    );
  }
}

/** A disc of frost on the ground of `radius` round (x, z) for `duration` seconds. */
export function frostDisc(x, z, radius, duration) {
  if (!SMOOTH) {
    playEffect("frost_ground", x, z, { size: radius * 2.3, y: 0.06 });
    return;
  }
  const mesh = groundPatch(frostTexture, 0xbfe8ff, radius);
  mesh.position.set(x, 0.05, z);
  mesh.rotation.y = Math.random() * Math.PI;
  scene.add(mesh);
  timed(
    duration,
    (progress) => {
      mesh.material.opacity = 0.8 * envelope(progress, 0.1, 0.4);
    },
    () => {
      scene.remove(mesh);
      mesh.material.dispose();
    },
  );
}

/** A burnt patch of `radius` that fades over `duration` seconds (where a star fell). */
export function scorch(x, z, radius, duration) {
  if (!SMOOTH) {
    return;
  }
  const mesh = groundPatch(scorchTexture, 0xffffff, radius, { additive: false });
  mesh.position.set(x, 0.045, z);
  scene.add(mesh);
  timed(
    duration,
    (progress) => {
      mesh.material.opacity = envelope(progress, 0.05, 0.6);
    },
    () => {
      scene.remove(mesh);
      mesh.material.dispose();
    },
  );
}

/**
 * A star falling out of the sky onto (x, z) in `duration` seconds, from high up and off to one side: a white-hot
 * heart in an orange glow, with a tail of flames and embers behind it. onArrive() when it strikes.
 */
export function fallingStar(x, z, duration, onArrive) {
  if (!SMOOTH) {
    /* the comet of the effect sheet, falling in from the side with a trail of sparks */
    const comet = playEffect("comet", x - 3, z, { size: 3.4, y: 6, loop: true });
    flyEffect(comet, x - 3, z, { x, z }, duration, onArrive, 0xffb347);
    return;
  }
  const heart = halo(0xffffff, 1.1);
  const glow = halo(0xff9a3c, 3.2);
  scene.add(heart, glow);
  const from = new THREE.Vector3(x - 5, 9, z - 2);
  const to = new THREE.Vector3(x, 0.4, z);
  const position = new THREE.Vector3();
  timed(
    duration,
    (progress) => {
      /* faster as it falls */
      position.lerpVectors(from, to, progress * progress);
      heart.position.copy(position);
      glow.position.copy(position);
      glow.material.opacity = 0.8 + 0.2 * Math.sin(progress * 60);
      fxBurst("flame", position.x, position.y, position.z, { count: 9, spread: 0.25, speed: 0.5 });
      fxBurst("hearth", position.x, position.y, position.z, { count: 2, spread: 0.3, speed: 0.3 });
    },
    () => {
      scene.remove(heart, glow);
      heart.material.dispose();
      glow.material.dispose();
      onArrive();
    },
  );
}

/** The rune circle under the caster for `duration` seconds: a turning ring of runes in soft light. */
export function runeCircle(tint, duration) {
  if (!SMOOTH) {
    stopAfter(
      playEffect("rune_circle", player.x, player.z, {
        size: 3.4,
        y: 0.05,
        tint,
        loop: true,
        follow: player,
        additive: true,
      }),
      duration,
    );
    return;
  }
  const mesh = groundPatch(runeRingTexture, tint, 1.8);
  mesh.position.set(player.x, 0.06, player.z);
  scene.add(mesh);
  timed(
    duration + 0.3,
    (progress, time) => {
      mesh.position.set(player.x, 0.06, player.z);
      mesh.rotation.y = time * 1.4;
      mesh.material.opacity = 0.95 * envelope(progress, 0.15, 0.3);
      mesh.scale.setScalar(0.85 + 0.15 * Math.min(1, progress / 0.15));
    },
    () => {
      scene.remove(mesh);
      mesh.material.dispose();
    },
  );
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
  const isGlowing = SMOOTH && trailColor !== null;
  const element = isGlowing ? ELEMENT_OF[trailColor] || null : null;
  /* a glow round the bolt in its colour */
  const glow = isGlowing ? halo(trailColor, 1.4) : null;
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
  if (!SMOOTH) {
    /* a flat band, drawn under the night haze like the ground it lies on */
    material.map = null;
    material.blending = THREE.NormalBlending;
  }
  const mesh = new THREE.Mesh(ringGeometry, material);
  mesh.position.set(x, 0.05, z);
  /* over the night haze: a spell's ring lights up */
  mesh.renderOrder = SMOOTH ? 10001 : 0;
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

    if (entry.tick) {
      entry.tick(progress, entry.time);
      if (progress >= 1) {
        activeEffects.splice(i, 1);
        entry.done();
      }
      continue;
    }

    if (entry.flash) {
      /* swells fast, fades slower */
      entry.flash.scale.setScalar(entry.size * (0.4 + 0.6 * Math.sqrt(progress)));
      /* soft enough that the scene still shows through its heart */
      entry.flash.material.opacity = 0.7 * (1 - progress * progress);
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
    forceSinglePass: true,
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
