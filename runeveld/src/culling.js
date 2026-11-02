/* Eldoria – culling by area. The whole world lives in one scene: the village, the vale, the Northroad, Saltmere, the
   islands, the crypt and the forge, thousands of objects. Every frame three.js walks all of them to update their
   matrices and to test them against the view, wherever the hero is. So once the world is built, its standing things
   are sorted into square cells; a cell far from the camera is hidden as a whole, and three.js neither updates nor
   tests what is in it.
   Left where they are: what is much bigger than a cell (grounds, the sea, coasts),
   lights, what follows the camera (pollen: Points) and what must never be culled (frustumCulled off). Things made
   after the world is built (heroes, monsters, effects) are never sorted. */
import * as THREE from "three";

/* the size of a cell in units, and how far past the edge of the view a cell still shows (tall things and their
   shadows reach into the view from outside it) */
const CELL = 48;
const MARGIN = 24;

/* the cells: {group, box, x, z, radius}, and by their key */
const cells = [];
const cellsByKey = new Map();
/* the middle of the view and how far it reaches over the ground (updateCells), for isNearView */
const view = { x: 0, z: 0, reach: Infinity };
const box = new THREE.Box3();
const sphere = new THREE.Sphere();

/* may this object go into a cell? */
function isSortable(object) {
  if (object.isLight || object.isCamera || object.isPoints || object.frustumCulled === false) {
    return false;
  }
  if (object.userData.keepInScene) {
    return false;
  }
  return true;
}

/* Puts one object into the cell its middle lies in (true), or leaves it (false: too big, or nothing to it). */
function putInCell(scene, object) {
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  if (box.isEmpty()) {
    return false;
  }
  box.getBoundingSphere(sphere);
  if (sphere.radius > CELL * 1.6) {
    return false;
  }
  const key = `${Math.floor(sphere.center.x / CELL)},${Math.floor(sphere.center.z / CELL)}`;
  let cell = cellsByKey.get(key);
  if (!cell) {
    const group = new THREE.Group();
    group.name = "cell " + key;
    /* it never moves: its matrix stays the identity */
    group.matrixAutoUpdate = false;
    scene.add(group);
    cell = { group, box: new THREE.Box3(), x: 0, z: 0, radius: 0 };
    cellsByKey.set(key, cell);
    cells.push(cell);
  }
  /* the cell's group sits at the origin unturned, so the object keeps its place in the world */
  cell.group.add(object);
  cell.box.union(box);
  cell.box.getBoundingSphere(sphere);
  cell.x = sphere.center.x;
  cell.z = sphere.center.z;
  cell.radius = sphere.radius;
  return true;
}

/** Sorts the scene's standing objects into cells (once, right after the world is built). */
export function sortIntoCells(scene) {
  /* The scene itself never moves. Left to update its own matrix every frame, it would mark it changed and so force
     every object in the world, hidden cells and all, to work out its matrix again: by far the dearest part of a
     frame. */
  scene.matrixAutoUpdate = false;
  scene.updateMatrix();
  /* see-through two-sided things are drawn in one pass, not two (see sprites.js makeFlashable) */
  scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material && material.transparent && material.side === THREE.DoubleSide) {
        material.forceSinglePass = true;
      }
    }
  });
  for (const object of [...scene.children]) {
    if (isSortable(object)) {
      putInCell(scene, object);
    }
  }
}

/** Puts something that stands still and was made later (a painted chunk of ground) into its cell. */
export function addToCell(object) {
  const scene = object.parent;
  if (scene && cells.length) {
    putInCell(scene, object);
  }
}

/** Is (x, z) within sight of the camera, or `extra` units beyond it? For what is not in a cell (monsters,
    villagers, lights, effects): far away it need not be drawn or animated. */
export const isNearView = (x, z, extra = 0) =>
  Math.hypot(x - view.x, z - view.z) < view.reach + extra;

/**
 * Shows the cells within sight of the camera and hides the rest; a hidden cell is skipped by three.js altogether
 * (matrixWorldAutoUpdate off), and brought up to date when it shows again.
 * @param {THREE.OrthographicCamera} camera
 * @param {{target: THREE.Vector3, tilt: number}} cameraState
 */
export function updateCells(camera, cameraState) {
  /* how far the view reaches over the ground from its middle: its half width, and its half height stretched by the
     tilt (the camera looks down at a slant) */
  const halfWidth = (camera.right - camera.left) / 2 / camera.zoom;
  const halfDepth = (camera.top - camera.bottom) / 2 / camera.zoom / Math.sin(cameraState.tilt);
  const reach = Math.hypot(halfWidth, halfDepth) + MARGIN;
  const { x, z } = cameraState.target;
  view.x = x;
  view.z = z;
  view.reach = reach;
  for (const cell of cells) {
    const isNear = Math.hypot(cell.x - x, cell.z - z) - cell.radius < reach;
    if (isNear !== cell.group.visible) {
      cell.group.visible = isNear;
      cell.group.matrixWorldAutoUpdate = isNear;
    }
  }
}

/** How many cells there are and how many show (for the admin panel and measuring). */
export const cellStats = () => ({
  cells: cells.length,
  shown: cells.filter((cell) => cell.group.visible).length,
});
