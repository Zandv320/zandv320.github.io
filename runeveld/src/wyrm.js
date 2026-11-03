/* Eldoria – the Rime Wyrm as the players see it (its moves are in rules/bosses.js, its hall in rules/glacier.js). A
   white dragon without wings, in the same style as the Grey Leviathan (leviathan.js, whose shapes it borrows): its
   long body lies coiled on the ice round the frost seal, scaled white and pale blue with a belly of plates, a ridge of
   ice spikes down its back; four short legs with claws; the neck rises out of the coil to a horned head with eyes
   that burn blue and a jaw full of teeth, frost smoking from it. It burrows down into the ice and breaks out again
   (submerge), and slumps when it dies.
   RimeWyrmModel stands in for a Sprite2D, like the Leviathan: play('idle'|'attack'|'hurt'|'death'), face, nudge,
   flashHit, tint, freeze, submerge. */
import * as THREE from "three";
import { burst } from "./particles.js";
import {
  Tube,
  canvasTexture,
  inked,
  inkHull,
  shapedEgg,
  shapedBox,
  hornGeometry,
  lambert,
  glow,
} from "./leviathan.js";

/* how much bigger than its own units it is drawn, and how far down into the ice it goes when it burrows */
const SIZE = 1.3;
const BURROW_DEPTH = 8;
const DIG_SPEED = 7;
const INK = 0x0c0f2a;

const hex = (r, g, b) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const BACK = [150, 176, 206];
const FLANK = [206, 222, 238];
const SHEEN = [246, 250, 255];
const EDGE = [76, 104, 146];
const BELLY = [228, 232, 222];
const BELLY_LINE = [168, 176, 172];

/* the skin round the body, as on the Leviathan: scales in shifted rows on back and flanks, plates across the belly */
function skinTexture() {
  const width = 32;
  const height = 64;
  return canvasTexture(
    width,
    height,
    (ctx) => {
      for (let y = 0; y < height; y++) {
        const round = 1 - Math.abs(y / height - 0.5) * 2;
        for (let x = 0; x < width; x++) {
          let color;
          if (round > 0.74) {
            color = x % 4 === 0 ? BELLY_LINE : mix(BELLY, [244, 246, 240], (x % 4) / 6);
          } else {
            const row = Math.floor(y / 5);
            const sx = (x + (row % 2) * 3) % 6;
            const sy = y % 5;
            const base = mix(BACK, FLANK, Math.min(1, round / 0.6));
            const dx = sx - 2.5;
            const inScale = dx * dx * 0.55 + (sy - 1) * (sy - 1) * 0.7;
            if (sy === 4 || inScale > 5.2) {
              color = mix(base, EDGE, 0.6);
            } else if (sy === 0 && sx > 0 && sx < 5) {
              color = mix(base, SHEEN, 0.75);
            } else {
              color = mix(base, SHEEN, 0.2 - sy * 0.04);
            }
          }
          ctx.fillStyle = hex(...color);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
}

/* the head's skin: small scales, white going blue at their rims */
function headTexture() {
  return canvasTexture(
    16,
    16,
    (ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const sx = (x + (Math.floor(y / 4) % 2) * 2) % 4;
          const isRim = y % 4 === 3 || sx === 0;
          ctx.fillStyle = hex(
            ...(isRim ? mix(FLANK, EDGE, 0.5) : mix(FLANK, SHEEN, (y % 4) * 0.2)),
          );
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
}

/* the body at rest, tail tip to the back of the head, in the model's own units (head towards −z): the tail curls
   round behind, the trunk lies on the ice, the neck rises */
const BODY_REST = [
  [-4.6, 0.25, 7.2],
  [-5.8, 0.35, 4.4],
  [-4.4, 0.5, 1.9],
  [-1.6, 0.72, 2.7],
  [1.3, 0.92, 3.7],
  [3, 1.02, 1.6],
  [1.9, 1.06, -0.8],
  [0.5, 1.9, -2.3],
  [0, 3.4, -3.2],
  [0, 4.6, -3.6],
];
/* where along the body (0 tail tip, 1 head) the legs grow, and from which side */
const LEGS = [
  [0.62, -1],
  [0.62, 1],
  [0.74, -1],
  [0.74, 1],
];
/* from the tail's tip it thickens to the trunk, and narrows again up the neck */
const bodyProfile = (t) =>
  0.2 + 0.85 * Math.sin(Math.min(1, t / 0.72) * Math.PI * 0.5) - Math.max(0, t - 0.75) * 1.1;

export class RimeWyrmModel {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.body.scale.setScalar(SIZE);
    this.group.add(this.body);

    const skin = lambert({ map: skinTexture() });
    const headMap = headTexture();
    headMap.repeat.set(3, 3);
    const headSkin = lambert({ map: headMap });
    const belly = lambert({ color: 0xe4e8de });
    const horn = lambert({ color: 0xc8e2f4 });
    const ice = lambert({ color: 0xbfe6ff, emissive: 0x1c3c5c, flatShading: true });
    const claw = lambert({ color: 0x3a4a62 });
    this.materials = [skin, headSkin, belly, horn, ice, claw];
    /* the glow each has of its own (the ice), under the white flash of a blow */
    for (const material of this.materials) {
      material.userData.glow = material.emissive.clone();
    }
    const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

    /* the body, its ink outline, the spikes of ice along its back */
    this.points = BODY_REST.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(this.points);
    this.tube = new Tube(72, 14, 1, 1, skin, { profile: bodyProfile, lengthPerRepeat: 2.6 });
    this.tubeInk = new Tube(72, 14, 1, 1, ink, { profile: bodyProfile });
    this.body.add(this.tube.mesh, this.tubeInk.mesh);
    this.spikeTs = [];
    for (let t = 0.12; t < 0.9; t += 0.035) {
      this.spikeTs.push(t);
    }
    this.spikes = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.16, 1, 5).translate(0, 0.5, 0),
      ice,
      this.spikeTs.length,
    );
    this.spikes.frustumCulled = false;
    this.body.add(this.spikes);

    /* four short legs, each a thick thigh and three claws */
    this.legs = LEGS.map(([t, side]) => {
      const leg = new THREE.Group();
      const thigh = inkHull(
        new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 1.1, 8).translate(0, -0.55, 0), skin),
      );
      leg.add(thigh);
      for (const spread of [-0.35, 0, 0.35]) {
        const talon = inked(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 4), claw));
        talon.rotation.x = -Math.PI / 2;
        talon.position.set(spread * 0.6, -1.08, -0.32);
        talon.rotation.z = spread;
        leg.add(talon);
      }
      this.body.add(leg);
      return { leg, t, side };
    });

    this.head = this.buildHead({ headSkin, belly, horn, ice });
    this.head.scale.setScalar(1.3);
    this.body.add(this.head);

    /* what a click catches: the head and the top of the neck */
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3.4, 4.4).translate(0, -0.6, -0.8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.head.add(this.mesh);

    this.height = 5.6 * SIZE;
    this.startsUnder = false;
    this.tintColor = 0xffffff;
    this.facing = new THREE.Vector2(0, 1);
    this.anim = "idle";
    this.animTime = 0;
    this.time = Math.random() * 10;
    this.flash = 0;
    this.freezeTime = 0;
    this.flinch = 0;
    this.nudgeVector = new THREE.Vector2();
    this.frostIn = 0.4;
    this.depth = 0;
    this.isUnder = false;
    this.basis = new THREE.Matrix4();
    this.mouthTip = new THREE.Vector3();
    this.spot = new THREE.Object3D();
  }

  /* the head, facing −z with its top up: a long skull, brows, swept horns, a fan of short spikes behind, blue eyes,
     the jaw with its teeth */
  buildHead({ headSkin, belly, horn, ice }) {
    const head = new THREE.Group();
    const skull = inkHull(
      new THREE.Mesh(shapedEgg(1.5, 1, 2.5, { taper: 0.5, drop: 0.2, flat: 0.5 }), headSkin),
    );
    skull.position.set(0, 0.06, -1);
    head.add(skull);
    for (const side of [-1, 1]) {
      const brow = inked(
        new THREE.Mesh(shapedBox(0.36, 0.22, 0.8, { taper: 0.55, drop: -0.05 }), headSkin),
      );
      brow.position.set(side * 0.42, 0.52, -0.7);
      brow.rotation.set(0.15, side * 0.2, side * -0.3);
      head.add(brow);
      /* the long horns, swept back over the neck, and a smaller pair below */
      const long = inked(new THREE.Mesh(hornGeometry(1.9, 0.15), horn));
      long.position.set(side * 0.4, 0.5, -0.15);
      long.rotation.set(0.05, side * 0.3, side * -0.18);
      head.add(long);
      const small = inked(new THREE.Mesh(hornGeometry(0.8, 0.08), horn));
      small.position.set(side * 0.7, 0.12, 0.1);
      small.rotation.set(-0.2, side * 0.9, side * -0.4);
      head.add(small);
      /* blue eyes that burn, with a slit, over the haze of the halls */
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 8).scale(0.7, 1, 1.3),
        glow(0x8fdcff),
      );
      eye.position.set(side * 0.56, 0.32, -0.7);
      eye.renderOrder = 10001;
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.06), glow(0x0a1a2a));
      pupil.position.set(side * 0.65, 0.32, -0.72);
      pupil.renderOrder = 10002;
      head.add(pupil);
    }
    /* a fan of ice spikes behind the skull */
    for (let k = 0; k < 5; k++) {
      const spike = inked(
        new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8 - Math.abs(k - 2) * 0.12, 4), ice),
      );
      spike.position.set((k - 2) * 0.22, 0.5, 0.35);
      spike.rotation.set(-1.1, 0, (k - 2) * -0.35);
      head.add(spike);
    }
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.06, 1.9).translate(0, -0.38, -1.1),
      lambert({ color: 0x1c2c4a }),
    );
    head.add(mouth);
    const tooth = new THREE.ConeGeometry(0.05, 0.24, 4);
    const toothMaterial = lambert({ color: 0xf2f6fa });
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const upper = new THREE.Mesh(tooth, toothMaterial);
        upper.rotation.x = Math.PI;
        upper.position.set(side * (0.46 - i * 0.06), -0.42, -0.35 - i * 0.34);
        head.add(upper);
      }
    }
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.34, 0);
    head.add(this.jaw);
    const jaw = inkHull(
      new THREE.Mesh(shapedEgg(1.15, 0.42, 2.2, { taper: 0.5, drop: 0, flat: 0 }), belly),
    );
    jaw.position.set(0, -0.1, -1);
    this.jaw.add(jaw);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const lower = new THREE.Mesh(tooth, toothMaterial);
        lower.position.set(side * (0.4 - i * 0.06), 0.06, -0.5 - i * 0.36);
        this.jaw.add(lower);
      }
    }
    return head;
  }

  /** Down into the ice (true) or up out of it (false); it digs, it does not vanish. */
  submerge(isUnder) {
    if (isUnder !== this.isUnder) {
      const at = this.group.position;
      burst(at.x, 0.6, at.z, { color: 0xe4f4ff, count: 40, speed: 6, size: 4, life: 0.9 });
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

  setLayers() {}

  dispose() {}

  has(name) {
    return ["idle", "walk", "attack", "hurt", "death"].includes(name);
  }

  duration() {
    return 0.7;
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
    this.flinch = 1;
  }

  nudge(dx, dz) {
    const length = Math.hypot(dx, dz) || 1;
    this.nudgeVector.set(dx / length, dz / length);
    this.flinch = Math.max(this.flinch, 0.6);
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
    const time = this.time;
    /* the whole coil turns slowly to face whoever it hunts */
    const goal = Math.atan2(-this.facing.x, -this.facing.y);
    let turn = goal - this.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.group.rotation.y += turn * Math.min(1, dt * 3);
    /* digging down or coming up */
    const target = this.isUnder ? BURROW_DEPTH : 0;
    this.depth +=
      Math.sign(target - this.depth) * Math.min(Math.abs(target - this.depth), DIG_SPEED * dt);
    this.body.position.y = -this.depth * SIZE;
    this.group.visible = this.depth < BURROW_DEPTH - 0.1;
    if (!this.group.visible) {
      return;
    }

    /* the strike: back, then a lunge with the jaw wide; a flinch when hit; slumping onto the ice when dead */
    let lunge = 0;
    let rear = 0;
    let jaw = 0.1 + Math.sin(time * 1.6) * 0.05;
    if (this.anim === "attack") {
      const t = Math.min(1, this.animTime / 0.7);
      rear = t < 0.35 ? Math.sin((t / 0.35) * Math.PI * 0.5) : Math.max(0, 1 - (t - 0.35) * 4);
      lunge = t < 0.35 ? 0 : Math.sin(((t - 0.35) / 0.65) * Math.PI);
      jaw = 0.1 + rear * 0.7 + lunge * 0.25;
    }
    const isDead = this.anim === "death";
    if (isDead) {
      jaw = 0.6;
    }
    this.flinch = Math.max(0, this.flinch - dt * 3);
    const slump = isDead ? Math.min(1, this.animTime / 2) : 0;
    const breath = Math.sin(time * 1.2);

    /* the body: the tail sways at its tip, the trunk breathes, the neck rises and strikes */
    BODY_REST.forEach(([x, y, z], k) => {
      const point = this.points[k];
      const neck = Math.max(0, (k - 6) / 3);
      const tail = Math.max(0, (3 - k) / 3);
      point.set(
        x + Math.sin(time * 1.3 + k) * 0.35 * tail + this.nudgeVector.x * this.flinch * neck * 0.8,
        y + breath * 0.04 * (1 - tail) - slump * neck * neck * 2.6,
        z + this.nudgeVector.y * this.flinch * neck * 0.8,
      );
      if (neck > 0) {
        point.x += Math.sin(time * 0.7 + k) * 0.15 * neck;
        point.z += rear * 1.2 * neck - lunge * 2.6 * neck;
        point.y += rear * 0.8 * neck - lunge * 1.4 * neck;
      }
    });
    this.tube.update(this.curve);
    this.tubeInk.update(this.curve, 0.07);
    /* the spikes stand up along the back, the tallest over the trunk */
    this.spikeTs.forEach((t, k) => {
      const frame = this.tube.frameAt(this.curve, t);
      const r = this.tube.radiusAt(t);
      this.spot.position.copy(frame.point).addScaledVector(frame.normal, r * 0.85);
      this.spot.quaternion.setFromUnitVectors(UP, frame.normal);
      this.spot.rotateX(-0.45);
      const height = 0.5 + Math.sin(Math.min(1, (t - 0.1) / 0.6) * Math.PI) * 0.9;
      this.spot.scale.set(1.4, height, 1.4);
      this.spot.updateMatrix();
      this.spikes.setMatrixAt(k, this.spot.matrix);
    });
    this.spikes.instanceMatrix.needsUpdate = true;
    /* the legs at their places along the trunk, standing down onto the ice */
    for (const { leg, t, side } of this.legs) {
      const frame = this.tube.frameAt(this.curve, t);
      const r = this.tube.radiusAt(t);
      leg.position.copy(frame.point).addScaledVector(frame.binormal, side * r * 0.8);
      leg.position.y = 1.1 - slump * 0.4;
      leg.rotation.set(0, Math.atan2(frame.tangent.x, frame.tangent.z) + Math.PI, side * 0.25);
    }

    /* the head on the end of the neck */
    const end = this.tube.frameAt(this.curve, 1);
    const forward = end.tangent.clone();
    const up = end.normal.clone();
    const zAxis = forward.clone().negate();
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    this.basis.makeBasis(xAxis, yAxis, zAxis);
    this.head.quaternion.setFromRotationMatrix(this.basis);
    this.head.rotateX(0.25 + lunge * 0.45 - rear * 0.3 + Math.sin(time * 1.1) * 0.05);
    this.head.position.copy(end.point).addScaledVector(forward, 0.15);
    this.jaw.rotation.x = jaw;

    /* frost smoking from its jaw, more as it rears to breathe */
    this.frostIn -= dt * (1 + rear * 4);
    if (this.frostIn <= 0 && !isDead) {
      this.frostIn = 0.3 + Math.random() * 0.4;
      this.mouthTip.set(0, -0.4, -2.1);
      this.head.localToWorld(this.mouthTip);
      burst(this.mouthTip.x, this.mouthTip.y, this.mouthTip.z, {
        color: 0xe8f6ff,
        count: 3 + Math.round(rear * 8),
        speed: 0.9,
        size: 2,
        life: 0.8,
      });
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 8);
    }
    for (const material of this.materials) {
      material.emissive.copy(material.userData.glow).addScalar(this.flash * 0.7);
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);
