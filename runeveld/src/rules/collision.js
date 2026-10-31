/* Eldoria – game rules: collision and pathfinding, shared by the client and the server.
   Obstacles are circles {x, z, r} or turned boxes {x, z, r, box: {hw, hd, cos, sin}} (half width and depth along
   the box's own axes; r is then the radius of the circle around it, for a quick check). A grid files them by area,
   so a check only looks at the ones nearby. Pure code without browser or network: the server runs the same rules.

   createCollision(obstacles, isInside) returns:
     pushOut(x, z, r)            the point pushed clear of every obstacle a circle of radius r overlaps
     touches(x, z, r)            whether that circle overlaps an obstacle
     isFree(x, z, r)             inside the world (isInside) and touching nothing
     isLineClear(x0, z0, x1, z1, r)  a circle of radius r can move along the line
     findPath(x0, z0, x1, z1, r) waypoints [[x, z], …] from start to goal around obstacles (A* on a grid of
                                 whole units, then shortened to the fewest straight legs), or null
   `obstacles` may grow later (the world is built bit by bit); new ones are filed when they are first needed. An
   obstacle with `isOpen` set (a raised gate, a wall that has crumbled) blocks nothing until it is cleared again. */

const GRID_CELL = 8;
/* obstacles are filed with this much extra room: checks for figures up to this radius use the grid */
const GRID_REACH = 1.5;
const NO_OBSTACLES = [];

/** Packs an obstacle for the network: [x, z, r] for a circle, [x, z, r, hw, hd, cos, sin] for a box. */
export function packObstacle(obstacle) {
  const round = (value) => +value.toFixed(3);
  const packed = [round(obstacle.x), round(obstacle.z), round(obstacle.r)];
  if (obstacle.box) {
    const { hw, hd, cos, sin } = obstacle.box;
    packed.push(round(hw), round(hd), round(cos), round(sin));
  }
  return packed;
}

/** The obstacle from packObstacle(), or null when it is not a valid one. */
export function unpackObstacle(packed) {
  if (!Array.isArray(packed) || !packed.every(Number.isFinite)) {
    return null;
  }
  if (packed.length === 3) {
    const [x, z, r] = packed;
    return { x, z, r };
  }
  if (packed.length === 7) {
    const [x, z, r, hw, hd, cos, sin] = packed;
    return { x, z, r, box: { hw, hd, cos, sin } };
  }
  return null;
}

/* A circle of radius r at (x, z) against a box: the point that moves it clear, or null when it is clear already. */
function boxPush(obstacle, x, z, r) {
  const { hw, hd, cos, sin } = obstacle.box;
  /* into the box's own axes */
  const dx = x - obstacle.x;
  const dz = z - obstacle.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const nearestX = Math.max(-hw, Math.min(hw, lx));
  const nearestZ = Math.max(-hd, Math.min(hd, lz));
  const ox = lx - nearestX;
  const oz = lz - nearestZ;
  const distance = Math.hypot(ox, oz);
  if (distance >= r) {
    return null;
  }
  let targetX;
  let targetZ;
  if (distance > 1e-4) {
    /* outside the box, closer than r: out along the line from the nearest point */
    targetX = nearestX + (ox / distance) * r;
    targetZ = nearestZ + (oz / distance) * r;
  } else {
    /* inside the box: out through the nearest side */
    const toSide = [hw - lx, hw + lx, hd - lz, hd + lz];
    const side = toSide.indexOf(Math.min(...toSide));
    targetX = side === 0 ? hw + r : side === 1 ? -hw - r : lx;
    targetZ = side === 2 ? hd + r : side === 3 ? -hd - r : lz;
  }
  /* back to the world */
  return [obstacle.x + targetX * cos + targetZ * sin, obstacle.z - targetX * sin + targetZ * cos];
}

/* a small binary heap of [priority, value] for A* */
function createHeap() {
  const items = [];
  return {
    get size() {
      return items.length;
    },
    push(priority, value) {
      items.push([priority, value]);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent][0] <= items[i][0]) {
          break;
        }
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const left = i * 2 + 1;
          const right = left + 1;
          let smallest = i;
          if (left < items.length && items[left][0] < items[smallest][0]) {
            smallest = left;
          }
          if (right < items.length && items[right][0] < items[smallest][0]) {
            smallest = right;
          }
          if (smallest === i) {
            break;
          }
          [items[smallest], items[i]] = [items[i], items[smallest]];
          i = smallest;
        }
      }
      return top[1];
    },
  };
}

/* the most grid cells a path search may look at (a path across the whole world needs far fewer) */
const MAX_SEARCH = 40000;
/* the eight neighbours of a cell, with their step cost */
const STEPS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** Collision and pathfinding over `obstacles`; isInside(x, z) tells whether a point lies inside the world. */
export function createCollision(obstacles, isInside = () => true) {
  const grid = new Map();
  let filed = 0;

  function fileObstacles() {
    for (; filed < obstacles.length; filed++) {
      const obstacle = obstacles[filed];
      const reach = obstacle.r + GRID_REACH;
      const cx0 = Math.floor((obstacle.x - reach) / GRID_CELL);
      const cx1 = Math.floor((obstacle.x + reach) / GRID_CELL);
      const cz0 = Math.floor((obstacle.z - reach) / GRID_CELL);
      const cz1 = Math.floor((obstacle.z + reach) / GRID_CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = cx * 4096 + cz;
          let cell = grid.get(key);
          if (!cell) {
            cell = [];
            grid.set(key, cell);
          }
          cell.push(obstacle);
        }
      }
    }
  }

  /* the obstacles that a figure of radius r at (x, z) could touch */
  function near(x, z, r) {
    if (r > GRID_REACH) {
      return obstacles;
    }
    fileObstacles();
    return grid.get(Math.floor(x / GRID_CELL) * 4096 + Math.floor(z / GRID_CELL)) || NO_OBSTACLES;
  }

  function pushOut(x, z, r) {
    for (const obstacle of near(x, z, r)) {
      if (obstacle.isOpen) {
        continue;
      }
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = obstacle.r + r;
      if (distance >= minDistance) {
        continue;
      }
      if (obstacle.box) {
        const pushed = boxPush(obstacle, x, z, r);
        if (pushed) {
          [x, z] = pushed;
        }
      } else if (distance < 1e-4) {
        x += minDistance;
      } else {
        x = obstacle.x + (dx / distance) * minDistance;
        z = obstacle.z + (dz / distance) * minDistance;
      }
    }
    return [x, z];
  }

  function touches(x, z, r) {
    for (const obstacle of near(x, z, r)) {
      if (!obstacle.isOpen && Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + r) {
        if (!obstacle.box || boxPush(obstacle, x, z, r)) {
          return true;
        }
      }
    }
    return false;
  }

  const isFree = (x, z, r) => isInside(x, z) && !touches(x, z, r);

  function isLineClear(x0, z0, x1, z1, r) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(length / 0.3));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!isFree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r)) {
        return false;
      }
    }
    return true;
  }

  function findPath(x0, z0, x1, z1, r = 0.4) {
    if (isLineClear(x0, z0, x1, z1, r)) {
      return [[x1, z1]];
    }
    /* cells of one unit; a cell is open when a figure fits at its centre (worked out once per search) */
    const open = new Map();
    const isOpen = (cx, cz) => {
      const key = cx * 8192 + cz;
      let value = open.get(key);
      if (value === undefined) {
        value = isFree(cx + 0.5, cz + 0.5, r);
        open.set(key, value);
      }
      return value;
    };
    const startX = Math.floor(x0);
    const startZ = Math.floor(z0);
    /* a goal inside something (a click on a house): the nearest open cell around it */
    let goalX = Math.floor(x1);
    let goalZ = Math.floor(z1);
    let goalPoint = [x1, z1];
    if (!isOpen(goalX, goalZ)) {
      let best = null;
      for (let ring = 1; ring <= 8 && !best; ring++) {
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring || !isOpen(goalX + dx, goalZ + dz)) {
              continue;
            }
            const distance = Math.hypot(goalX + dx + 0.5 - x0, goalZ + dz + 0.5 - z0);
            if (!best || distance < best.distance) {
              best = { x: goalX + dx, z: goalZ + dz, distance };
            }
          }
        }
      }
      if (!best) {
        return null;
      }
      goalX = best.x;
      goalZ = best.z;
      goalPoint = [goalX + 0.5, goalZ + 0.5];
    }
    /* A* from the start cell to the goal cell; no cutting corners past a blocked cell */
    const key = (cx, cz) => cx * 8192 + cz;
    const cost = new Map([[key(startX, startZ), 0]]);
    const cameFrom = new Map();
    const heap = createHeap();
    const estimate = (cx, cz) => {
      const dx = Math.abs(cx - goalX);
      const dz = Math.abs(cz - goalZ);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    heap.push(estimate(startX, startZ), [startX, startZ]);
    let searched = 0;
    let found = false;
    while (heap.size && searched++ < MAX_SEARCH) {
      const [cx, cz] = heap.pop();
      if (cx === goalX && cz === goalZ) {
        found = true;
        break;
      }
      const here = cost.get(key(cx, cz));
      for (const [dx, dz, stepCost] of STEPS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!isOpen(nx, nz) || (dx && dz && (!isOpen(cx + dx, cz) || !isOpen(cx, cz + dz)))) {
          continue;
        }
        const next = here + stepCost;
        const nextKey = key(nx, nz);
        if (next < (cost.get(nextKey) ?? Infinity)) {
          cost.set(nextKey, next);
          cameFrom.set(nextKey, [cx, cz]);
          heap.push(next + estimate(nx, nz), [nx, nz]);
        }
      }
    }
    if (!found) {
      return null;
    }
    /* the cells back from the goal, as points at their centres */
    const cells = [];
    for (let cell = [goalX, goalZ]; cell; cell = cameFrom.get(key(cell[0], cell[1]))) {
      cells.push([cell[0] + 0.5, cell[1] + 0.5]);
    }
    cells.reverse();
    cells[cells.length - 1] = goalPoint;
    /* string pulling: from each point straight on to the furthest point still in sight */
    const path = [];
    let from = [x0, z0];
    let index = 0;
    while (index < cells.length - 1) {
      let furthest = index;
      for (let j = cells.length - 1; j > index; j--) {
        if (isLineClear(from[0], from[1], cells[j][0], cells[j][1], r)) {
          furthest = j;
          break;
        }
      }
      if (furthest === index) {
        furthest = index + 1;
      }
      path.push(cells[furthest]);
      from = cells[furthest];
      index = furthest;
    }
    if (!path.length) {
      path.push(goalPoint);
    }
    return path;
  }

  return { pushOut, touches, isFree, isLineClear, findPath };
}
