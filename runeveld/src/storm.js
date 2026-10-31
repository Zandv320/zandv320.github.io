/* Eldoria – the storms over the Northroad (rules/weather.js) as the hero sees them: rain slanting through the
   picture, a grey sky (daylight.js), lightning and thunder now and then. Only on the Northroad; the storm swells and
   fades with the clock, and walking out of the region it clears. */
import * as THREE from "three";
import { stormStrength } from "./rules/weather.js";
import { inNorthroad } from "./regions.js";
import { player, game } from "./game-state.js";
import { scene, cameraState } from "./world.js";
import { screenFlash } from "./feel.js";
import { sfx } from "./audio.js";
import * as UI from "./ui.js";

const DROPS = 1500;
/* the box of rain around the camera's target, in units */
const RAIN_WIDTH = 46;
const RAIN_HEIGHT = 16;
const FALL_SPEED = 24;
/* the rain slants with the wind: per unit of fall, this far along x */
const WIND = 0.28;
const DROP_LENGTH = 1.5;

let rain = null;
let drops = null; /* x, y, z per drop, in the box */
let strength = 0;
let nextFlashAt = 0;
let wasStorm = false;

/** Makes the rain (hidden until it storms). */
export function createStorm() {
  drops = new Float32Array(DROPS * 3);
  for (let i = 0; i < DROPS; i++) {
    drops[i * 3] = (Math.random() - 0.5) * RAIN_WIDTH;
    drops[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
    drops[i * 3 + 2] = (Math.random() - 0.5) * RAIN_WIDTH;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
  rain = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xdde8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  /* drawn after the haze, so the rain stays light against a dark sky */
  rain.renderOrder = 10002;
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
}

function updateRain(dt) {
  const positions = rain.geometry.attributes.position.array;
  for (let i = 0; i < DROPS; i++) {
    let y = drops[i * 3 + 1] - FALL_SPEED * dt;
    let x = drops[i * 3] + FALL_SPEED * WIND * dt;
    if (y < 0) {
      y += RAIN_HEIGHT;
      x = (Math.random() - 0.5) * RAIN_WIDTH;
      drops[i * 3 + 2] = (Math.random() - 0.5) * RAIN_WIDTH;
    }
    if (x > RAIN_WIDTH / 2) {
      x -= RAIN_WIDTH;
    }
    drops[i * 3] = x;
    drops[i * 3 + 1] = y;
    const z = drops[i * 3 + 2];
    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x - DROP_LENGTH * WIND;
    positions[i * 6 + 4] = y + DROP_LENGTH;
    positions[i * 6 + 5] = z;
  }
  rain.geometry.attributes.position.needsUpdate = true;
  rain.position.set(cameraState.target.x, 0, cameraState.target.z);
}

/* a flash, and the thunder a moment later (further away, later) */
function lightning() {
  screenFlash("235, 242, 255");
  setTimeout(() => sfx.thunder(), 250 + Math.random() * 1400);
}

/** Per frame: follow the storm where the hero is. */
export function updateStorm(dt, time) {
  if (!rain) {
    return;
  }
  const isOnRoad = game.isStarted && inNorthroad(player.x, player.z);
  const target = isOnRoad ? stormStrength() : 0;
  strength += (target - strength) * Math.min(1, dt * 0.8);
  if (strength < 0.005) {
    strength = 0;
  }
  game.daylight.setWeather(strength);
  rain.visible = strength > 0.02;
  if (rain.visible) {
    rain.material.opacity = 0.8 * strength;
    updateRain(dt);
  }
  if (strength > 0.6 && time > nextFlashAt) {
    if (nextFlashAt > 0) {
      lightning();
    }
    nextFlashAt = time + 5 + Math.random() * 11;
  }
  /* say so when a storm comes up or passes while the hero is out on the road */
  const isStormNow = isOnRoad && target > 0.5;
  if (isStormNow !== wasStorm && isOnRoad) {
    UI.systemMessage(
      isStormNow
        ? "Thunder rolls over the hills. A storm is coming: the storm wolves hunt harder now."
        : "The storm moves on. The sky clears over the Northroad.",
    );
  }
  wasStorm = isStormNow;
}
