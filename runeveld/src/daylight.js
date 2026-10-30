/* Eldoria – day and night. The clock runs on real time (one game day = 24 minutes), so everybody sees the same
   light without anything going over the network. At night a blue haze lies over the picture (a canvas that
   multiplies with the scene) with warm holes at the lanterns and the altar, and the lamps get a glow in the scene.
   Sun, sky light and sky colour follow along. */
import * as THREE from "three";

export const DAY_MINUTES = 24; /* real minutes per game day */

let timeOverride = null; /* admin: a fixed time in hours, or null */

/** Admin: fix the time of day to `hours` (0..24), or pass null to follow the real clock again. */
export function setTimeOverride(hours) {
  timeOverride = hours;
}

/** Time of day in hours, 0..24. */
export function timeOfDay() {
  if (timeOverride !== null) {
    return timeOverride;
  }
  return (((Date.now() / 1000 / 60) % DAY_MINUTES) / DAY_MINUTES) * 24;
}

/** The time of day as "hh:mm". */
export function clockText() {
  const hoursFloat = timeOfDay();
  const hours = Math.floor(hoursFloat);
  const minutes = Math.floor((hoursFloat - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/** Daylight 0 (night) .. 1 (day): night 21–5, day 7–19, dawn and dusk in between. */
export function daylight(hours = timeOfDay()) {
  if (hours >= 7 && hours <= 19) {
    return 1;
  }
  if (hours >= 21 || hours <= 5) {
    return 0;
  }
  if (hours < 7) {
    return smoothstep((hours - 5) / 2);
  }
  return 1 - smoothstep((hours - 19) / 2);
}

export const isNight = () => daylight() < 0.5;

/* the night is blue, but roads and objects stay visible */
const NIGHT_COLOR = [122, 138, 196];
const DAY_COLOR = [255, 255, 255];
const DUSK_COLOR = [255, 206, 150];

/** The colour of the haze: night → (through a warm dusk) → day. */
export function hazeColor(light = daylight()) {
  const warmth = 4 * light * (1 - light); /* warm around the transition */
  return [0, 1, 2].map((i) =>
    Math.round(
      NIGHT_COLOR[i] * (1 - light) +
        DAY_COLOR[i] * light +
        (DUSK_COLOR[i] - DAY_COLOR[i]) * warmth * 0.55,
    ),
  );
}

/**
 * Sets up the day/night cycle.
 * lights: light sources {x, z, radius (units), color: [r,g,b], strength 0..1, y (height of the glow)}.
 * Returns {update(cameraState, extraLights)}.
 */
export function createDaylight({ scene, camera, renderer, sun, hemiLight, lights }) {
  const overlay = document.getElementById("night-overlay");
  const ctx = overlay.getContext("2d");
  const projected = new THREE.Vector3();

  /* glow in the scene: a soft round sprite, additive */
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const glowCtx = glowCanvas.getContext("2d");
  const gradient = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  glowCtx.fillStyle = gradient;
  glowCtx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  const glows = lights.map((light) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(light.radius * 1.1, light.radius * 1.1),
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: new THREE.Color(light.color[0] / 255, light.color[1] / 255, light.color[2] / 255),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.set(light.x, light.y ?? 1.1, light.z);
    mesh.renderOrder = 3;
    scene.add(mesh);
    return { mesh, light };
  });

  const sunDayColor = new THREE.Color(0xfff1d6);
  const sunNightColor = new THREE.Color(0x9aa6d8);
  const hemiDayColor = new THREE.Color(0xdff3ff);
  const hemiNightColor = new THREE.Color(0x6a78a8);
  const skyDayColor = new THREE.Color(0x87c9ee);
  const skyNightColor = new THREE.Color(0x0e1630);
  let lastNight = -1;

  function update(cameraState, extraLights = []) {
    const light = daylight();
    const night = 1 - light;
    /* sun, sky light and sky */
    sun.intensity = 1.1 + 1.5 * light;
    sun.color.copy(sunNightColor).lerp(sunDayColor, light);
    hemiLight.intensity = 1.4 + 0.8 * light;
    hemiLight.color.copy(hemiNightColor).lerp(hemiDayColor, light);
    scene.background.copy(skyNightColor).lerp(skyDayColor, light);
    for (const glow of glows) {
      glow.mesh.material.opacity = night * (glow.light.strength ?? 0.8) * 0.4;
      glow.mesh.rotation.y = cameraState.yaw;
      glow.mesh.rotation.x = -cameraState.tilt;
      glow.mesh.visible = night > 0.02;
    }

    /* the haze */
    if (night < 0.01) {
      if (lastNight !== 0) {
        overlay.style.display = "none";
        lastNight = 0;
      }
      return;
    }
    overlay.style.display = "block";
    lastNight = night;
    const width = innerWidth;
    const height = innerHeight;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    const [r, g, b] = hazeColor(light);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, width, height);

    /* warm holes at the light sources: brighten where lamps stand */
    ctx.globalCompositeOperation = "lighter";
    const pxPerUnit = cameraState.px / renderer.getPixelRatio(); /* CSS pixels per unit */
    for (const source of lights.concat(extraLights)) {
      projected.set(source.x, source.y ?? 0.8, source.z).project(camera);
      if (projected.z > 1 || Math.abs(projected.x) > 1.5 || Math.abs(projected.y) > 1.5) {
        continue;
      }
      const screenX = ((projected.x + 1) / 2) * width;
      const screenY = ((1 - projected.y) / 2) * height;
      const radius = source.radius * pxPerUnit * 1.15;
      const color = source.color;
      const strength = (source.strength ?? 0.8) * night;
      const rgb = `${color[0]},${color[1]},${color[2]}`;
      const holeGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
      holeGradient.addColorStop(0, `rgba(${rgb},${(0.85 * strength).toFixed(3)})`);
      holeGradient.addColorStop(0.4, `rgba(${rgb},${(0.45 * strength).toFixed(3)})`);
      holeGradient.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = holeGradient;
      ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
    }
  }

  return { update };
}
