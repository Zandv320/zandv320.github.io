/* Eldoria – 2D sprites in a 3D world (like Ragnarok Online).
   A sprite is a flat plane that always faces the camera; its drawing comes from a sprite sheet with four rows
   per animation (one per facing direction). A sprite can consist of several layers that share the same layout
   (body, clothing, head, weapon): that is how equipment becomes visible. */
import * as THREE from "three";

/* Phone: touch screen and a small display. There smooth mode is off by default (4x less texture memory) and the
   shadow map is smaller. */
export const IS_PHONE =
  matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 820;

/* Smooth graphics: the sprites in sprites/smooth/ are upscaled 2x with Scale2x (tools/build_sprites.py) and drawn
   with soft filtering. Can be switched off in the admin panel. */
export const SMOOTH = (() => {
  try {
    const stored = localStorage.getItem("eldoria.smooth");
    if (stored === "1") {
      return true;
    }
    if (stored === "0") {
      return false;
    }
  } catch (e) {
    /* localStorage unavailable: fall back to the default */
  }
  return !IS_PHONE;
})();

/* Pixel size: how many screen (CSS) pixels one rendered pixel covers. 2 makes the sprites land roughly 1:1 on the
   pixel grid; 1 is full resolution. Adjustable in the admin panel.
   In smooth mode everything renders at full resolution: the 2x sprites are then 1:1 at a pixel scale of 32. */
export const PIXEL_SCALE = SMOOTH
  ? 1
  : (() => {
      try {
        const stored = parseFloat(localStorage.getItem("eldoria.pixel"));
        if (stored > 0) {
          return stored;
        }
      } catch (e) {
        /* localStorage unavailable: fall back to the default */
      }
      return innerWidth < 700 ? 1 : 2;
    })();

/* How many times larger the loaded sprites are than the original pixel art. */
export const SHEET_SCALE = SMOOTH ? 2 : 1;

const textureCache = new Map();

/**
 * Loads an image as a texture (resolves to null when the file is missing). In smooth mode it comes from
 * sprites/smooth/, unless `raw` is set (for the ground tiles, which are composed in a canvas themselves).
 */
export function loadTexture(url, { raw = false } = {}) {
  const useSmooth = SMOOTH && !raw && url.startsWith("sprites/");
  const source = useSmooth ? url.replace("sprites/", "sprites/smooth/") : url;
  if (textureCache.has(source)) {
    return textureCache.get(source);
  }
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(makeTexture(img, useSmooth));
    /* a missing smooth version falls back to the original pixel art */
    img.onerror = () => resolve(useSmooth ? loadTexture(url, { raw: true }) : null);
    img.src = source;
  });
  textureCache.set(source, promise);
  return promise;
}

/** Wraps an image or canvas in a texture: soft filtering with mipmaps, or crisp pixels. */
export function makeTexture(source, soft = SMOOTH) {
  const texture = new THREE.Texture(source);
  if (soft) {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
  } else {
    /* no mipmaps: nothing switches between levels */
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/* Blob shadow under figures and plants: a flat ellipse just above plaza and path (y .06), so it never z-fights
   with the ground. */
const shadowGeometry = new THREE.CircleGeometry(0.5, 16);
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x1a1540,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const SHADOW_Y = 0.06;
const clickMaterial = new THREE.MeshBasicMaterial({ visible: false });

function addBlobShadow(group, diameter) {
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW_Y;
  shadow.scale.set(diameter, diameter * 0.62, 1);
  shadow.renderOrder = 2;
  group.add(shadow);
  return shadow;
}

/* White silhouette version of a sheet, for the hit flash; one per source texture. */
function whiteTexture(source) {
  if (source.userData.white) {
    return source.userData.white;
  }
  const img = source.image;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = source.magFilter;
  texture.minFilter = source.minFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = source.colorSpace;
  source.userData.white = texture;
  return texture;
}

/* How far sprites lean back towards the camera (1 = facing the camera exactly). */
export const LEAN = 1;

export class Sprite2D {
  /* sheet: {texture, frameWidth, frameHeight, scale, feet, height, directions:{down,left,right,up},
             anims:{name:{row, frames, fps, once, perDirection}}}
     layers: textures in draw order (back first); without layers sheet.texture is used
     shadow: diameter of the shadow in world units (0 = none) */
  constructor(sheet, { shadow = 0.9, layers = null } = {}) {
    this.group = new THREE.Group();
    this.layers = [];
    /* invisible plane to click on (raycast) */
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), clickMaterial);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.anim = null;
    this.animName = "";
    this.time = 0;
    this.frame = 0;
    this.direction = "down";
    this.finished = false;
    this.facing = new THREE.Vector2(0, 1);
    this.flashTime = 0;
    this.cols = 1;
    this.rows = 1;
    this.nudgeVector = new THREE.Vector2();
    this.nudgeTime = 0;
    this.punch = 0;
    this.setSheet(sheet, layers);
    if (shadow > 0) {
      this.shadow = addBlobShadow(this.group, shadow);
    }
  }

  /* Use a (different) sheet; the figure height and foot position come from the sheet. */
  setSheet(sheet, layers = null) {
    this.sheet = sheet;
    this.anim = null;
    this.animName = "";
    const width = sheet.frameWidth * sheet.scale;
    const height = sheet.frameHeight * sheet.scale;
    const feet = (sheet.feet || 0) * sheet.scale;
    this.width = width;
    this.height = (sheet.height || sheet.frameHeight) * sheet.scale;
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.geometry = new THREE.PlaneGeometry(width, height);
    this.geometry.translate(0, height / 2 - feet, 0);
    this.mesh.geometry = this.geometry;
    for (const layer of this.layers) {
      layer.mesh.geometry = this.geometry;
    }
    this.setLayers(layers || [sheet.texture]);
    this.play("idle", true);
  }

  /* Replace the layers (textures), in draw order. */
  setLayers(sources) {
    sources = sources.filter(Boolean);
    while (this.layers.length > sources.length) {
      const layer = this.layers.pop();
      layer.mesh.removeFromParent();
      layer.mesh.material.dispose();
      layer.texture.dispose();
    }
    sources.forEach((source, i) => {
      let layer = this.layers[i];
      if (!layer) {
        const material = new THREE.MeshBasicMaterial({
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.frustumCulled = false;
        /* a tiny offset per layer keeps the draw order stable */
        mesh.position.z = 0.004 * (i + 1);
        this.group.add(mesh);
        layer = { mesh, source: null, texture: null, white: null };
        this.layers.push(layer);
      }
      if (layer.source !== source) {
        if (layer.texture) {
          layer.texture.dispose();
        }
        if (layer.white) {
          layer.white.dispose();
        }
        layer.source = source;
        layer.texture = source.clone();
        layer.texture.needsUpdate = true;
        layer.white = whiteTexture(source).clone();
        layer.white.needsUpdate = true;
        layer.mesh.material.map = layer.texture;
        layer.mesh.material.needsUpdate = true;
      }
    });
    const first = sources[0];
    this.cols = Math.max(1, Math.round(first.image.width / this.sheet.frameWidth));
    this.rows = Math.max(1, Math.round(first.image.height / this.sheet.frameHeight));
    this._updateUv();
  }

  /* Give all layers a colour cast (e.g. a dark wolf). */
  tint(color) {
    this.tintColor = color;
    for (const layer of this.layers) {
      layer.mesh.material.color.set(color);
    }
  }

  has(name) {
    return !!this.sheet.anims[name];
  }

  play(name, restart = false) {
    const anim = this.sheet.anims[name] || this.sheet.anims.idle;
    if (!anim) {
      return;
    }
    if (this.anim === anim && !restart) {
      return;
    }
    this.anim = anim;
    this.animName = name;
    this.time = 0;
    this.frame = 0;
    this.finished = false;
    this._updateUv();
  }

  duration(name) {
    const anim = this.sheet.anims[name];
    return anim ? anim.frames / anim.fps : 0;
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) {
      return;
    }
    this.facing.set(dx, dz).normalize();
  }

  /* Short white flash on damage, with a squash. */
  flashHit() {
    this.flashTime = 0.09;
    this.punch = 1;
    for (const layer of this.layers) {
      layer.white.repeat.copy(layer.texture.repeat);
      layer.white.offset.copy(layer.texture.offset);
      layer.mesh.material.map = layer.white;
    }
  }

  /* A push in world direction (dx,dz): knockback from a blow or a lunge when attacking. Visual only; the position
     stays the same. */
  nudge(dx, dz, strength = 0.3) {
    const length = Math.hypot(dx, dz) || 1;
    this.nudgeVector.set((dx / length) * strength, (dz / length) * strength);
    this.nudgeTime = 1;
  }

  update(dt, cameraState) {
    const anim = this.anim;
    if (anim) {
      this.time += dt;
      let frame = Math.floor(this.time * anim.fps);
      if (anim.once) {
        if (frame >= anim.frames) {
          frame = anim.frames - 1;
          this.finished = true;
        }
      } else {
        frame %= anim.frames;
      }
      if (frame !== this.frame) {
        this.frame = frame;
        this._updateUv();
      }
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) {
        for (const layer of this.layers) {
          layer.mesh.material.map = layer.texture;
        }
      }
    }
    const sinYaw = Math.sin(cameraState.yaw);
    const cosYaw = Math.cos(cameraState.yaw);
    /* squash and nudge: applied to the layers themselves, so the group (position, scale) stays the game's */
    if (this.punch > 0 || this.nudgeTime > 0) {
      this.punch = Math.max(0, this.punch - dt * 7);
      this.nudgeTime = Math.max(0, this.nudgeTime - dt * 5);
      const punch = this.punch;
      const scaleX = 1 + 0.16 * punch;
      const scaleY = 1 - 0.12 * punch;
      const nudgeX = this.nudgeVector.x;
      const nudgeZ = this.nudgeVector.y;
      const toRight = (nudgeX * cosYaw - nudgeZ * sinYaw) * this.nudgeTime;
      const away = -(nudgeX * sinYaw + nudgeZ * cosYaw) * this.nudgeTime;
      for (const layer of this.layers) {
        layer.mesh.scale.set(scaleX, scaleY, 1);
        layer.mesh.position.x = toRight;
        layer.mesh.position.y = away * 0.55;
      }
    }
    /* turn the facing into down/left/right/up as seen from the camera */
    const faceX = this.facing.x;
    const faceZ = this.facing.y;
    const away = -(
      faceX * sinYaw +
      faceZ * cosYaw
    ); /* > 0: away from the camera (we see the back) */
    const toRight = faceX * cosYaw - faceZ * sinYaw;
    let direction;
    if (Math.abs(away) >= Math.abs(toRight)) {
      direction = away > 0 ? "up" : "down";
    } else {
      direction = toRight > 0 ? "right" : "left";
    }
    if (direction !== this.direction) {
      this.direction = direction;
      this._updateUv();
    }
    this.group.rotation.y = cameraState.yaw;
    const tiltX = -cameraState.tilt * LEAN;
    this.mesh.rotation.x = tiltX;
    for (const layer of this.layers) {
      layer.mesh.rotation.x = tiltX;
    }
    snapToCameraGrid(this, cameraState);
  }

  /* Point every layer's texture at the current frame of the current animation and direction. */
  _updateUv() {
    const anim = this.anim;
    if (!anim || !this.layers.length) {
      return;
    }
    const directions = this.sheet.directions || { down: 0 };
    let directionRow = directions[this.direction];
    let mirror = false;
    if (directionRow === undefined) {
      /* no row of its own for this direction: use the opposite side, mirrored */
      let opposite = "down";
      if (this.direction === "left") {
        opposite = "right";
      } else if (this.direction === "right") {
        opposite = "left";
      }
      directionRow = directions[opposite] ?? directions.down ?? 0;
      mirror =
        (this.direction === "left" || this.direction === "right") &&
        directions[opposite] !== undefined;
    }
    const row = (anim.row || 0) + (anim.perDirection === false ? 0 : directionRow);
    const column = (anim.column || 0) + this.frame;
    const cellWidth = 1 / this.cols;
    const cellHeight = 1 / this.rows;
    for (const layer of this.layers) {
      layer.texture.repeat.set(mirror ? -cellWidth : cellWidth, cellHeight);
      layer.texture.offset.set(
        mirror ? (column + 1) * cellWidth : column * cellWidth,
        1 - (row + 1) * cellHeight,
      );
      if (layer.white) {
        layer.white.repeat.copy(layer.texture.repeat);
        layer.white.offset.copy(layer.texture.offset);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const layer of this.layers) {
      layer.mesh.material.dispose();
      layer.texture.dispose();
    }
    this.layers = [];
    this.geometry.dispose();
  }
}

/* A static picture (house, tree, fence) that also stays turned towards the camera. */
export class Billboard {
  constructor(texture, width, height, { shadow = 0, lean = LEAN } = {}) {
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(0, height / 2, 0);
    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.lean = lean;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    if (shadow > 0) {
      addBlobShadow(this.group, shadow);
    }
  }

  update(cameraState) {
    this.group.rotation.y = cameraState.yaw;
    this.mesh.rotation.x = -cameraState.tilt * this.lean;
    snapToCameraGrid(this, cameraState);
  }
}

/* Puts a sprite's group on the camera's pixel grid. The logical position (as the game sets it) is remembered so
   the snapping does not accumulate; when the game changes the position, that becomes the new logical position. */
function snapToCameraGrid(sprite, cameraState) {
  if (!cameraState.right || !cameraState.px) {
    return;
  }
  if (!sprite._logicalPosition) {
    sprite._logicalPosition = new THREE.Vector3();
    sprite._snappedPosition = new THREE.Vector3(NaN, NaN, NaN);
  }
  if (!sprite.group.position.equals(sprite._snappedPosition)) {
    sprite._logicalPosition.copy(sprite.group.position);
  }
  const position = sprite.group.position.copy(sprite._logicalPosition);
  const px = cameraState.px;
  const alongRight = position.dot(cameraState.right);
  const alongUp = position.dot(cameraState.up);
  position
    .addScaledVector(cameraState.right, Math.round(alongRight * px) / px - alongRight)
    .addScaledVector(cameraState.up, Math.round(alongUp * px) / px - alongUp);
  sprite._snappedPosition.copy(position);
}
