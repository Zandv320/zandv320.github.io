/* Eldoria – skill and spell effects: animated billboards from the Craftpix effect sheets (sprites/fx/).
   Each effect is a single row of frames; fx.json (from tools/build_sprites.py) gives frame size, frame count and
   speed. play() puts an effect at a spot in the world (or lets it follow a figure); update() runs it and cleans
   it up. Effects always draw on top of the scene, so they never disappear behind a sprite. */
import * as THREE from "three";
import { loadTexture } from "./sprites.js";

/**
 * Loads all effect sheets and returns the effects system {play, update, info, count}.
 * info: the parsed fx.json, per effect {fw, fh, n, fps} (frame width/height, frame count, frames per second).
 */
export async function createEffects({ scene }) {
  const info = await (await fetch("sprites/fx/fx.json")).json();
  const textures = {};
  await Promise.all(
    Object.keys(info).map(async (name) => {
      const texture = await loadTexture("sprites/fx/" + name + ".png", { raw: true });
      if (texture) {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
      }
      textures[name] = texture;
    }),
  );
  const active = [];

  /* name: effect from fx.json; x,z: spot; options: size (height in units), y, tint (colour), loop, follow ({x,z}),
     fps, grounded (bottom on the ground instead of centred), additive, mirror, delay (seconds),
     angle (rotation within the plane, radians). Returns a handle with stop(), or null for an unknown effect. */
  function play(
    name,
    x,
    z,
    {
      size = 2,
      y = 0,
      tint = null,
      loop = false,
      follow = null,
      fps = null,
      grounded = false,
      additive = false,
      mirror = false,
      delay = 0,
      angle = 0,
    } = {},
  ) {
    const sheetInfo = info[name];
    const source = textures[name];
    if (!sheetInfo || !source) {
      return null;
    }
    const texture = source.clone();
    texture.needsUpdate = true;
    texture.repeat.set((mirror ? -1 : 1) / sheetInfo.n, 1);
    texture.offset.set(mirror ? 1 / sheetInfo.n : 0, 0);
    const height = size;
    const width = (size * sheetInfo.fw) / sheetInfo.fh;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      depthTest: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    if (tint) {
      material.color.set(tint);
    }
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(0, grounded ? height / 2 : 0, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.rotation.z = angle;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(x, y, z);
    scene.add(group);
    const effect = {
      group,
      mesh,
      texture,
      material,
      geometry,
      sheetInfo,
      fps: fps || sheetInfo.fps,
      time: -delay,
      frame: -1,
      loop,
      follow,
      finished: false,
      stop() {
        effect.finished = true;
      },
    };
    active.push(effect);
    return effect;
  }

  function update(dt, cameraState) {
    for (let k = active.length - 1; k >= 0; k--) {
      const effect = active[k];
      effect.time += dt;
      if (effect.time >= 0) {
        let frame = Math.floor(effect.time * effect.fps);
        const frameCount = effect.sheetInfo.n;
        if (frame >= frameCount) {
          if (effect.loop) {
            frame %= frameCount;
          } else {
            effect.finished = true;
          }
        }
        if (!effect.finished && frame !== effect.frame) {
          effect.frame = frame;
          /* a mirrored texture counts its offset from the right edge of the frame */
          const column = effect.texture.repeat.x < 0 ? frame + 1 : frame;
          effect.texture.offset.x = column / frameCount;
          effect.mesh.visible = true;
        }
      }
      if (effect.follow) {
        effect.group.position.x = effect.follow.x;
        effect.group.position.z = effect.follow.z;
      }
      effect.group.rotation.y = cameraState.yaw;
      effect.mesh.rotation.x = -cameraState.tilt;
      if (effect.finished) {
        scene.remove(effect.group);
        effect.material.dispose();
        effect.texture.dispose();
        effect.geometry.dispose();
        active.splice(k, 1);
      }
    }
  }

  return { play, update, info, count: () => active.length };
}
