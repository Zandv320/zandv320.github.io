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
 * Returns {update(cameraState, extraLights), setIndoor(indoor)}.
 */
export function createDaylight({ scene, camera, renderer, sun, hemiLight, lights }) {
  const overlay = document.getElementById("night-overlay");
  const projected = new THREE.Vector3();
  /* At full resolution the haze is a pass in WebGL (hazeMesh); a canvas over the page with mix-blend-mode is costly
     on phones, which have to redraw and blend it every frame. In the low-resolution pixel mode the canvas stays,
     so the light holes keep their smooth edges. */
  const hazeMesh = renderer.getPixelRatio() >= 1 ? createHazeMesh(scene) : null;
  const ctx = hazeMesh ? null : overlay.getContext("2d");

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
  /* underground (the crypt): {haze: [r, g, b], lights}, its own dark and its own light sources, whatever the hour */
  let indoor = null;

  function update(cameraState, extraLights = []) {
    const light = indoor ? 0 : daylight();
    const night = 1 - light;
    /* sun, sky light and sky. Underground the scene is lit as by day and the haze makes it dark: then the light
       holes show the true colours, and around them is black */
    const lit = indoor ? 1 : light;
    sun.intensity = 1.1 + 1.5 * lit;
    sun.color.copy(sunNightColor).lerp(sunDayColor, lit);
    hemiLight.intensity = 1.4 + 0.8 * lit;
    hemiLight.color.copy(hemiNightColor).lerp(hemiDayColor, lit);
    if (indoor) {
      scene.background.setRGB(0.008, 0.007, 0.012);
    } else {
      scene.background.copy(skyNightColor).lerp(skyDayColor, light);
    }
    for (const glow of glows) {
      glow.mesh.material.opacity = night * (glow.light.strength ?? 0.8) * 0.4;
      glow.mesh.rotation.y = cameraState.yaw;
      glow.mesh.rotation.x = -cameraState.tilt;
      glow.mesh.visible = night > 0.02 && !indoor;
    }

    /* the haze */
    if (night < 0.01) {
      if (lastNight !== 0) {
        overlay.style.display = "none";
        if (hazeMesh) {
          hazeMesh.visible = false;
        }
        lastNight = 0;
      }
      return;
    }
    lastNight = night;
    const width = innerWidth;
    const height = innerHeight;
    const [r, g, b] = indoor ? indoor.haze : hazeColor(light);
    const sources = (indoor ? indoor.lights : lights).concat(extraLights);
    const pxPerUnit = cameraState.px / renderer.getPixelRatio(); /* CSS pixels per unit */
    if (hazeMesh) {
      updateHazeMesh(hazeMesh, [r, g, b], sources, pxPerUnit, night);
      return;
    }
    overlay.style.display = "block";
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, width, height);

    /* warm holes at the light sources: brighten where lamps stand */
    ctx.globalCompositeOperation = "lighter";
    for (const source of sources) {
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

  /* The light sources on screen into the haze pass: position and radius in CSS pixels, as the canvas draws them. */
  function updateHazeMesh(mesh, haze, sources, pxPerUnit, night) {
    const uniforms = mesh.material.uniforms;
    uniforms.uHaze.value.set(haze[0] / 255, haze[1] / 255, haze[2] / 255);
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    uniforms.uHeight.value = renderer.domElement.height;
    let count = 0;
    for (const source of sources) {
      if (count === MAX_HAZE_LIGHTS) {
        break;
      }
      projected.set(source.x, source.y ?? 0.8, source.z).project(camera);
      if (projected.z > 1 || Math.abs(projected.x) > 1.5 || Math.abs(projected.y) > 1.5) {
        continue;
      }
      uniforms.uLights.value[count].set(
        ((projected.x + 1) / 2) * innerWidth,
        ((1 - projected.y) / 2) * innerHeight,
        source.radius * pxPerUnit * 1.15,
        (source.strength ?? 0.8) * night,
      );
      uniforms.uColors.value[count].set(
        source.color[0] / 255,
        source.color[1] / 255,
        source.color[2] / 255,
      );
      count++;
    }
    uniforms.uCount.value = count;
    mesh.visible = true;
  }

  /** Underground: `{haze: [r, g, b], lights}` (light sources as above), or null for the sky again. */
  function setIndoor(value) {
    indoor = value;
  }

  return { update, setIndoor };
}

/* the most light holes the haze pass draws at once (more than ever fit on a screen) */
const MAX_HAZE_LIGHTS = 48;

/* The night haze as the last thing drawn: a quad over the whole screen that multiplies the picture with the haze
   colour, brightened around the light sources. Exactly what the canvas does (fill with the haze, add a radial
   gradient per light with "lighter", multiply over the page), but on the GPU. */
function createHazeMesh(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHaze: { value: new THREE.Color(1, 1, 1) },
      uCount: { value: 0 },
      uLights: { value: Array.from({ length: MAX_HAZE_LIGHTS }, () => new THREE.Vector4()) },
      uColors: { value: Array.from({ length: MAX_HAZE_LIGHTS }, () => new THREE.Vector3()) },
      uPixelRatio: { value: 1 },
      uHeight: { value: 1 },
    },
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #define MAX_LIGHTS ${MAX_HAZE_LIGHTS}
      uniform vec3 uHaze;
      uniform int uCount;
      uniform vec4 uLights[MAX_LIGHTS];
      uniform vec3 uColors[MAX_LIGHTS];
      uniform float uPixelRatio;
      uniform float uHeight;
      void main() {
        /* this pixel in CSS pixels from the top left, like the canvas */
        vec2 point = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uPixelRatio;
        vec3 color = uHaze;
        for (int i = 0; i < MAX_LIGHTS; i++) {
          if (i >= uCount) {
            break;
          }
          vec4 light = uLights[i];
          float t = length(point - light.xy) / light.z;
          /* the gradient's stops: .85 in the middle, .45 at 40 %, 0 at the edge */
          float alpha = t < 0.4 ? mix(0.85, 0.45, t / 0.4) : mix(0.45, 0.0, min(1.0, (t - 0.4) / 0.6));
          color += uColors[i] * alpha * light.w;
        }
        gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
      }
    `,
    /* multiply: the result is the picture times this colour; the alpha stays */
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10000;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}
