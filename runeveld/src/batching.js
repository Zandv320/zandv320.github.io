/* Eldoria – fewer draw calls, the same picture.
   The world holds thousands of static things: trees, rocks, bushes and props (flat sprites that turn to the
   camera), each with a blob shadow, and pixel-3D buildings made of many small boxes with outlines. Drawn one by
   one that is well over a thousand draw calls a frame, too many for most phones. This module draws them in bulk:
   - static billboards of the same picture become one InstancedMesh; turning to the camera, leaning back and
     snapping to the pixel grid happen in the vertex shader, exactly as Billboard.update() does it per object
   - their blob shadows become one InstancedMesh
   - the meshes and outlines of the pixel-3D builds are merged per material and per area of the world (so the
     camera can still skip areas out of view), with the texture repeat baked into the uvs
   The result looks identical; only the number of draw calls and objects drops. */
import * as THREE from "three";

/* The camera state the billboard shader needs, shared by every batch; update once per frame. */
const sharedUniforms = {
  uYaw: { value: 0 },
  uTilt: { value: 0 },
  uRight: { value: new THREE.Vector3(1, 0, 0) },
  uUp: { value: new THREE.Vector3(0, 1, 0) },
  uPx: { value: 16 },
};

/** Copy the camera's yaw, tilt, screen axes and pixel scale into the shader uniforms. */
export function updateBatchUniforms(cameraState) {
  sharedUniforms.uYaw.value = cameraState.yaw;
  sharedUniforms.uTilt.value = cameraState.tilt;
  sharedUniforms.uRight.value.copy(cameraState.right);
  sharedUniforms.uUp.value.copy(cameraState.up);
  sharedUniforms.uPx.value = cameraState.px;
}

/* The vertex transform of a batched billboard: the instance matrix holds the position (translation) and any
   scale or flat rotation (mat3); the shader adds the lean towards the camera (uLean × tilt), the turn with the
   camera (yaw) and the snap of the position to the camera's pixel grid. Same order as Billboard: the mesh leans
   inside a group that turns. */
const BILLBOARD_VERTEX = /* glsl */ `
  vec3 local = mat3(instanceMatrix) * transformed;
  float leanAngle = -uTilt * uLean;
  float leanCos = cos(leanAngle);
  float leanSin = sin(leanAngle);
  local = vec3(local.x, local.y * leanCos - local.z * leanSin, local.y * leanSin + local.z * leanCos);
  float yawCos = cos(uYaw);
  float yawSin = sin(uYaw);
  local = vec3(local.x * yawCos + local.z * yawSin, local.y, -local.x * yawSin + local.z * yawCos);
  vec3 base = instanceMatrix[3].xyz;
  float alongRight = dot(base, uRight);
  float alongUp = dot(base, uUp);
  base += uRight * (floor(alongRight * uPx + 0.5) / uPx - alongRight);
  base += uUp * (floor(alongUp * uPx + 0.5) / uPx - alongUp);
  vec4 mvPosition = viewMatrix * vec4(base + local, 1.0);
  gl_Position = projectionMatrix * mvPosition;
`;

/* Turn a material into a batched-billboard material. `lean`: 1 for a standing sprite, 0 for a flat shadow. */
function makeBillboardMaterial(material, lean) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sharedUniforms, { uLean: { value: lean } });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uYaw;\nuniform float uTilt;\nuniform vec3 uRight;\nuniform vec3 uUp;\nuniform float uPx;\nuniform float uLean;",
      )
      .replace("#include <project_vertex>", BILLBOARD_VERTEX);
  };
  material.customProgramCacheKey = () => "eldoria-billboard-" + lean;
  return material;
}

/* Instances drawn far side first, so soft (semi-transparent) edges blend over what lies behind them. */
function sortFarFirst(positions, yaw) {
  /* the direction the camera looks, on the ground */
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  return positions.slice().sort((a, b) => b.x * lookX + b.z * lookZ - (a.x * lookX + a.z * lookZ));
}

const matrix = new THREE.Matrix4();

/**
 * One InstancedMesh for every static billboard with this picture. `geometry` is the billboard's plane (standing
 * on its feet), `positions` [{x, z}].
 */
export function createBillboardBatch(texture, geometry, positions, yaw = 0) {
  const material = makeBillboardMaterial(
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    1,
  );
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  sortFarFirst(positions, yaw).forEach((position, i) => {
    mesh.setMatrixAt(i, matrix.makeTranslation(position.x, 0, position.z));
  });
  mesh.instanceMatrix.needsUpdate = true;
  /* the shader moves the vertices, so the bounding volume three.js computes does not fit: never cull */
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/**
 * One InstancedMesh for the blob shadows of many billboards: `material` and `geometry` are those of a single
 * blob shadow (a circle), `shadows` [{x, z, diameter}], `y` its height above the ground.
 */
export function createShadowBatch(geometry, material, shadows, y) {
  const flat = geometry
    .clone()
    .rotateX(-Math.PI / 2)
    .translate(0, y, 0);
  const batchMaterial = makeBillboardMaterial(material.clone(), 0);
  const mesh = new THREE.InstancedMesh(flat, batchMaterial, shadows.length);
  const scale = new THREE.Matrix4();
  shadows.forEach((shadow, i) => {
    /* the ellipse: wide across, shorter in depth (as the blob shadow scales it) */
    scale.makeScale(shadow.diameter, 1, shadow.diameter * 0.62);
    mesh.setMatrixAt(i, matrix.makeTranslation(shadow.x, 0, shadow.z).multiply(scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 2;
  return mesh;
}

/* ---- merging the pixel-3D builds ---- */

/* the area of the world a merged mesh covers, in units: small enough for the camera to skip what is out of view */
const CHUNK = 48;

/* a base texture per image, repeating, for surfaces whose repeat is baked into their uvs */
const baseTextures = new Map();
function baseTextureOf(texture) {
  let base = baseTextures.get(texture.image);
  if (!base) {
    base = new THREE.Texture(texture.image);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.magFilter = texture.magFilter;
    base.minFilter = texture.minFilter;
    base.generateMipmaps = texture.generateMipmaps;
    base.anisotropy = texture.anisotropy;
    base.colorSpace = texture.colorSpace;
    base.needsUpdate = true;
    baseTextures.set(texture.image, base);
  }
  return base;
}

/* what makes two materials draw the same, once their texture repeat lives in the uvs */
function materialKey(material) {
  const map = material.map;
  return [
    material.type,
    map ? map.image.src || map.image.uuid || baseTextureOf(map).uuid : "-",
    material.color ? material.color.getHexString() : "-",
    material.vertexColors,
    material.side,
    material.transparent,
    material.opacity,
    material.alphaTest,
    material.depthWrite,
    material.polygonOffset,
    material.polygonOffsetFactor,
    material.polygonOffsetUnits,
    material.visible,
  ].join("|");
}

/* the merged-into material for a key: a copy of the first material, with the base texture */
const mergedMaterials = new Map();
function mergedMaterialFor(material, key) {
  let merged = mergedMaterials.get(key);
  if (!merged) {
    merged = material.clone();
    if (material.map) {
      merged.map = baseTextureOf(material.map);
    }
    mergedMaterials.set(key, merged);
  }
  return merged;
}

/* A world-space copy of an object's geometry, without index, with the texture's repeat and offset in the uvs and
   only the attributes the merged mesh uses. An instanced mesh gives one copy per instance. */
function worldGeometry(object, keepColor) {
  if (object.isInstancedMesh) {
    const instance = new THREE.Matrix4();
    const copies = [];
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, instance);
      copies.push(transformedGeometry(object, keepColor, instance.premultiply(object.matrixWorld)));
    }
    return concatenate(copies);
  }
  return transformedGeometry(object, keepColor, object.matrixWorld);
}

function transformedGeometry(object, keepColor, transform) {
  const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
  geometry.applyMatrix4(transform);
  const map = object.material && object.material.map;
  const uv = geometry.attributes.uv;
  if (map && uv && (map.repeat.x !== 1 || map.repeat.y !== 1 || map.offset.x || map.offset.y)) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        uv.getX(i) * map.repeat.x + map.offset.x,
        uv.getY(i) * map.repeat.y + map.offset.y,
      );
    }
  }
  for (const name of Object.keys(geometry.attributes)) {
    const isUsed =
      name === "position" ||
      (name === "normal" && !object.isLineSegments) ||
      (name === "uv" && !object.isLineSegments && !!map) ||
      (name === "color" && keepColor);
    if (!isUsed) {
      geometry.deleteAttribute(name);
    }
  }
  return geometry;
}

/* one geometry from many non-indexed geometries with the same attributes */
function concatenate(geometries) {
  const merged = new THREE.BufferGeometry();
  for (const name of Object.keys(geometries[0].attributes)) {
    const itemSize = geometries[0].attributes[name].itemSize;
    const total = geometries.reduce((sum, geometry) => sum + geometry.attributes[name].count, 0);
    const array = new Float32Array(total * itemSize);
    let offset = 0;
    for (const geometry of geometries) {
      const attribute = geometry.attributes[name];
      array.set(attribute.array.subarray(0, attribute.count * itemSize), offset);
      offset += attribute.count * itemSize;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Merge the meshes and outlines of these static groups (the builds placed in the world) into a few big meshes,
 * per material and per area. Each group keeps its place in the scene, empty, with its bounding box in
 * userData.mapBox for the world map. Returns the number of objects that were merged.
 */
export function mergeStaticGroups(scene, groups) {
  const buckets =
    new Map(); /* key → {material, isLine, castShadow, receiveShadow, renderOrder, geometries} */
  let mergedCount = 0;
  for (const group of groups) {
    group.updateMatrixWorld(true);
    if (group.userData.mapKind) {
      group.userData.mapBox = new THREE.Box3().setFromObject(group);
    }
    const chunk = `${Math.floor(group.position.x / CHUNK)},${Math.floor(group.position.z / CHUNK)}`;
    const merged = [];
    group.traverse((object) => {
      if (
        (!object.isMesh && !object.isLineSegments) ||
        Array.isArray(object.material) ||
        !object.visible ||
        object.count === 0
      ) {
        return;
      }
      const material = object.material;
      const geometry = worldGeometry(object, !!material.vertexColors);
      const key = [
        chunk,
        object.isLineSegments ? "line" : "mesh",
        object.castShadow,
        object.receiveShadow,
        object.renderOrder,
        materialKey(material),
        /* only geometries with the same attributes can be joined */
        Object.keys(geometry.attributes).sort().join(","),
      ].join("#");
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          material: object.isLineSegments
            ? material
            : mergedMaterialFor(material, materialKey(material)),
          isLine: object.isLineSegments,
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
          renderOrder: object.renderOrder,
          geometries: [],
        };
        buckets.set(key, bucket);
      }
      bucket.geometries.push(geometry);
      merged.push(object);
    });
    for (const object of merged) {
      object.removeFromParent();
      mergedCount++;
    }
  }
  for (const bucket of buckets.values()) {
    const geometry = concatenate(bucket.geometries);
    const object = bucket.isLine
      ? new THREE.LineSegments(geometry, bucket.material)
      : new THREE.Mesh(geometry, bucket.material);
    object.castShadow = bucket.castShadow;
    object.receiveShadow = bucket.receiveShadow;
    object.renderOrder = bucket.renderOrder;
    object.matrixAutoUpdate = false;
    object.userData.merged = true;
    scene.add(object);
    for (const part of bucket.geometries) {
      part.dispose();
    }
  }
  return mergedCount;
}
