/* Eldoria – the Grey Leviathan as the players see it (its moves are in rules/bosses.js, its lake in
   rules/tidecrown.js): a long neck that rises out of the Crownmere in an arc towards the shore, a head with a jaw
   that snaps, glowing eyes, a frill and spines; and the tentacles it slams across the shore. LeviathanModel stands
   in for a Sprite2D, so the monster code (monsters.js) draws, targets and animates it like any other monster. */
import * as THREE from "three";
import { scene } from "./world.js";
import { burst } from "./particles.js";
import { LAKE_Y } from "./rules/tidecrown.js";

const WATER_Y = LAKE_Y;

/* how far under the water it goes when it dives */
const DIVE_DEPTH = 10;
/* how fast it rises and sinks, in units per second */
const RISE_SPEED = 9;

/* how much bigger than the model's own units it is drawn */
const SIZE = 1.35;

/* A tube along `curve` that narrows from radius r0 at its start to r1 at its end (THREE.TubeGeometry keeps one
   radius); `radial` sides, `segments` rings along it. */
function taperedTube(curve, segments, radial, r0, r1) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point);
    const radius = r0 + (r1 - r0) * t;
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * Math.PI * 2;
      const cos = Math.cos(angle) * radius;
      const sin = Math.sin(angle) * radius;
      positions.push(
        point.x + normal.x * cos + binormal.x * sin,
        point.y + normal.y * cos + binormal.y * sin,
        point.z + normal.z * cos + binormal.z * sin,
      );
    }
    if (i > 0) {
      for (let j = 0; j < radial; j++) {
        const a = (i - 1) * radial + j;
        const b = (i - 1) * radial + ((j + 1) % radial);
        const c = i * radial + j;
        const d = i * radial + ((j + 1) % radial);
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const skin = () => new THREE.MeshLambertMaterial({ color: 0x4f6866, flatShading: true });
const belly = () => new THREE.MeshLambertMaterial({ color: 0x9aa89a, flatShading: true });
const glow = (color) => new THREE.MeshBasicMaterial({ color });

/** The sea serpent's head and neck, behaving like a monster's sprite (see the top of this file). */
export class LeviathanModel {
  constructor() {
    this.group = new THREE.Group();
    /* everything that moves up and down with the dive, and sways */
    this.body = new THREE.Group();
    this.body.scale.setScalar(SIZE);
    this.group.add(this.body);
    this.materials = [];
    const neckMaterial = skin();
    this.materials.push(neckMaterial);
    /* the neck: out of the water behind (+z) and arching forward (-z) to the head over the rail */
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -4, 5.5),
      new THREE.Vector3(0, -0.5, 4.6),
      new THREE.Vector3(0, 2.6, 3),
      new THREE.Vector3(0, 4.4, 1),
      new THREE.Vector3(0, 4.7, -0.4),
    ]);
    const neck = new THREE.Mesh(taperedTube(curve, 28, 9, 1.35, 0.78), neckMaterial);
    this.body.add(neck);
    /* a paler belly along the inside of the arc */
    const bellyCurve = new THREE.CatmullRomCurve3(
      curve.points.map((point) => point.clone().add(new THREE.Vector3(0, -0.35, -0.35))),
    );
    const bellyMaterial = belly();
    this.materials.push(bellyMaterial);
    this.body.add(new THREE.Mesh(taperedTube(bellyCurve, 28, 7, 0.95, 0.5), bellyMaterial));
    /* spines along the back */
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 - t * 0.3, 4), neckMaterial);
      spine.position.copy(point).add(new THREE.Vector3(0, 0.75, 0.45 * Math.sign(tangent.z || 1)));
      spine.rotation.x = -0.5 - t * 0.6;
      this.body.add(spine);
    }
    /* the head: a long skull narrowing to the snout, the lower jaw on a hinge */
    this.head = new THREE.Group();
    this.head.position.set(0, 4.75, -0.5);
    this.body.add(this.head);
    const skull = new THREE.BoxGeometry(1.7, 1, 2.8, 1, 1, 2);
    const positions = skull.attributes.position;
    for (let k = 0; k < positions.count; k++) {
      /* the front end (-z) narrower and lower */
      const front = Math.max(0, -positions.getZ(k) / 1.4);
      positions.setX(k, positions.getX(k) * (1 - front * 0.45));
      positions.setY(k, positions.getY(k) * (1 - front * 0.3) - front * 0.15);
    }
    skull.computeVertexNormals();
    const headMesh = new THREE.Mesh(skull.translate(0, 0.1, -1.2), neckMaterial);
    this.head.add(headMesh);
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.35, 0.1);
    this.head.add(this.jaw);
    const jawMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.32, 2.4).translate(0, -0.1, -1.2),
      bellyMaterial,
    );
    this.jaw.add(jawMesh);
    const tooth = new THREE.ConeGeometry(0.07, 0.3, 4);
    const toothMaterial = new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        const upper = new THREE.Mesh(tooth, toothMaterial);
        upper.rotation.x = Math.PI;
        upper.position.set(side * (0.55 - i * 0.05), -0.45, -0.3 - i * 0.38);
        this.head.add(upper);
        const lower = new THREE.Mesh(tooth, toothMaterial);
        lower.position.set(side * (0.45 - i * 0.04), 0.15, -0.3 - i * 0.36);
        this.jaw.add(lower);
      }
    }
    /* eyes that glow, over the night haze */
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), glow(0xffd84a));
      eye.position.set(side * 0.72, 0.35, -0.7);
      eye.renderOrder = 10001;
      this.head.add(eye);
    }
    /* a frill behind the head */
    const frillMaterial = new THREE.MeshLambertMaterial({
      color: 0x3f8a86,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    this.materials.push(frillMaterial);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(side * 1.4, 0.9);
      shape.lineTo(side * 1.2, -0.2);
      shape.lineTo(side * 1.5, -0.8);
      shape.lineTo(0, -0.4);
      const frill = new THREE.Mesh(new THREE.ShapeGeometry(shape), frillMaterial);
      frill.position.set(side * 0.6, 0.4, 0.5);
      frill.rotation.y = side * 0.5;
      this.head.add(frill);
    }
    /* what a click catches: the head and the top of the neck (unseen, but there) */
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 * SIZE, 3.4 * SIZE, 4 * SIZE).translate(0, 4.2 * SIZE, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.group.add(this.mesh);

    this.height = 5.6 * SIZE;
    this.tintColor = 0xffffff;
    this.facing = new THREE.Vector2(0, 1);
    this.anim = "idle";
    this.animTime = 0;
    this.time = Math.random() * 10;
    this.flash = 0;
    this.freezeTime = 0;
    this.nudgeTime = 0;
    this.nudgeVector = new THREE.Vector2();
    /* how far it has sunk: DIVE_DEPTH under the water, 0 up; it starts under */
    this.depth = DIVE_DEPTH;
    this.isUnder = true;
    this.body.position.y = -DIVE_DEPTH * SIZE;
  }

  /** Under the water (true) or up by the shore (false); it sinks or rises there. */
  submerge(isUnder) {
    if (isUnder !== this.isUnder && !isUnder) {
      /* it breaks the surface: a burst of spray */
      const at = this.group.position;
      burst(at.x, WATER_Y + 0.4, at.z, {
        color: 0xe8f2f6,
        count: 40,
        speed: 6,
        size: 5,
        life: 0.9,
      });
    }
    this.isUnder = isUnder;
  }

  tint(color) {
    this.tintColor = color;
    const tint = new THREE.Color(color);
    for (const material of this.materials) {
      material.userData.base = material.userData.base || material.color.clone();
      material.color.copy(material.userData.base).multiply(tint);
    }
  }

  get animName() {
    return this.anim;
  }

  /* a sprite's picture can arrive late; the serpent has none */
  setLayers() {}

  dispose() {}

  has(name) {
    return ["idle", "walk", "attack", "hurt", "death"].includes(name);
  }

  duration() {
    return 0.6;
  }

  play(name, restart = false) {
    if (name !== this.anim || restart) {
      this.anim = name;
      this.animTime = 0;
    }
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
      this.facing.set(dx, dz).normalize();
    }
  }

  flashHit() {
    this.flash = 1;
  }

  nudge(dx, dz, strength = 0.3) {
    const length = Math.hypot(dx, dz) || 1;
    this.nudgeVector.set((dx / length) * strength, (dz / length) * strength);
    this.nudgeTime = 1;
  }

  freeze(seconds) {
    this.freezeTime = Math.max(this.freezeTime, seconds);
  }

  update(dt) {
    if (this.freezeTime > 0) {
      this.freezeTime -= dt;
      dt = 0;
    }
    this.time += dt;
    this.animTime += dt;
    /* the head turns to face whoever it hunts */
    this.group.rotation.y = Math.atan2(-this.facing.x, -this.facing.y);
    /* rising or sinking; dead, it sinks for good */
    const isDown = this.isUnder || this.anim === "death";
    const goal = isDown ? DIVE_DEPTH : 0;
    this.depth +=
      Math.sign(goal - this.depth) *
      Math.min(Math.abs(goal - this.depth), RISE_SPEED * dt * (this.anim === "death" ? 0.35 : 1));
    this.body.position.y = -this.depth * SIZE;
    this.group.visible = this.depth < DIVE_DEPTH - 0.1;
    /* a slow sway, and the lunge and snap of a bite */
    let lunge = 0;
    let jaw = 0.12 + Math.sin(this.time * 1.7) * 0.05;
    if (this.anim === "attack") {
      const t = Math.min(1, this.animTime / 0.6);
      lunge = Math.sin(t * Math.PI) * 1.3;
      jaw = t < 0.45 ? 0.75 : 0.1;
    } else if (this.anim === "death") {
      jaw = 0.9;
    }
    this.body.rotation.z = Math.sin(this.time * 0.9) * 0.06;
    this.body.rotation.x = -lunge * 0.12;
    this.body.position.z = -lunge;
    this.jaw.rotation.x = jaw;
    this.head.rotation.x = Math.sin(this.time * 1.3) * 0.06;
    if (this.nudgeTime > 0) {
      this.nudgeTime = Math.max(0, this.nudgeTime - dt * 5);
      this.body.position.x = this.nudgeVector.x * this.nudgeTime;
    }
    /* the white flash of a blow */
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 8);
    }
    for (const material of this.materials) {
      material.emissive.setScalar(this.flash * 0.8);
    }
  }
}

/* ---------- tentacles: one rises out of the lake while its lane glows, then slams across the shore ---------- */

const tentacles = [];
const tentacleMaterial = new THREE.MeshLambertMaterial({ color: 0x5a5868, flatShading: true });
const suckerMaterial = new THREE.MeshLambertMaterial({ color: 0xc8b0b8 });
const suckerGeometry = new THREE.SphereGeometry(0.12, 6, 4);

/** A tentacle for a 'tentacle' warning (boss_telegraph): up out of the water at (x0, z0), down across to (x1, z1). */
export function tentacleStrike(data) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), tentacleMaterial);
  scene.add(mesh);
  /* suckers along its underside, moved with it every frame */
  const suckers = [];
  for (let k = 0; k < 10; k++) {
    const sucker = new THREE.Mesh(suckerGeometry, suckerMaterial);
    scene.add(sucker);
    suckers.push(sucker);
  }
  tentacles.push({ data, mesh, suckers, time: 0 });
}

/* the tentacle's line at this moment: rising (0..1 of the warning), slamming (just after), pulling back */
function tentacleCurve({ x0, z0, x1, z1 }, rise, slam, back) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz) || 1;
  const outX = -dx / length;
  const outZ = -dz / length;
  /* from under the water behind its start, up high, and forward over the shore */
  const reach = slam * (1 - back);
  const height = 1 + rise * 5 * (1 - reach) - back * 6;
  /* the tip curls up over the end while it rises, and lies flat along the ground once it has come down */
  const tipX = x0 + dx * (0.2 + 0.8 * reach);
  const tipZ = z0 + dz * (0.2 + 0.8 * reach);
  const tipY = Math.max(0.15, height - 1.5 - reach * 2);
  const curl = 1 - reach;
  const alongX = dx / length;
  const alongZ = dz / length;
  const points = [
    new THREE.Vector3(x0 + outX * 2.5, WATER_Y - 2.5, z0 + outZ * 2.5),
    new THREE.Vector3(x0 + outX * 0.6, WATER_Y + rise * 3 - back * 3, z0 + outZ * 0.6),
    new THREE.Vector3(x0 + dx * 0.25 * (0.3 + reach), height, z0 + dz * 0.25 * (0.3 + reach)),
    new THREE.Vector3(tipX - alongX * curl, tipY + 0.4 * curl, tipZ - alongZ * curl),
    new THREE.Vector3(tipX, tipY + 1.1 * curl, tipZ),
    new THREE.Vector3(
      tipX - alongX * 0.7 * curl,
      tipY + 1.4 * curl + 0.1,
      tipZ - alongZ * 0.7 * curl,
    ),
  ];
  return new THREE.CatmullRomCurve3(points);
}

/** Per frame: the tentacles rise, slam and sink away. */
export function updateTentacles(dt) {
  for (let i = tentacles.length - 1; i >= 0; i--) {
    const tentacle = tentacles[i];
    tentacle.time += dt;
    const windup = tentacle.data.duration;
    const t = tentacle.time;
    const rise = Math.min(1, t / windup);
    const slam = t < windup ? 0 : Math.min(1, (t - windup) / 0.15);
    const back = t < windup + 0.6 ? 0 : Math.min(1, (t - windup - 0.6) / 0.8);
    tentacle.mesh.geometry.dispose();
    const curve = tentacleCurve(tentacle.data, rise, slam, back);
    const thickness = 1 - back * 0.4;
    tentacle.mesh.geometry = taperedTube(curve, 24, 7, 0.62 * thickness, 0.07);
    tentacle.suckers.forEach((sucker, k) => {
      const t = 0.3 + (k / tentacle.suckers.length) * 0.62;
      curve.getPointAt(t, sucker.position);
      sucker.position.y -= (0.62 + (0.07 - 0.62) * t) * thickness * 0.85;
      sucker.scale.setScalar(1.2 - t);
    });
    if (slam >= 1 && !tentacle.hasSlammed) {
      tentacle.hasSlammed = true;
      const { x0, z0, x1, z1 } = tentacle.data;
      burst((x0 + x1) / 2, 0.4, (z0 + z1) / 2, { color: 0xd8e8ee, count: 26, speed: 5, size: 4 });
    }
    if (back >= 1) {
      scene.remove(tentacle.mesh, ...tentacle.suckers);
      tentacle.mesh.geometry.dispose();
      tentacles.splice(i, 1);
    }
  }
}
