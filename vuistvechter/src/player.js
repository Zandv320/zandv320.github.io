import * as THREE from 'three';

// Karakter-controller met vaste tijdstap.
// Beweging in Quake-stijl (versnelling + wrijving), botsingen als cirkel tegen rechthoeken,
// automatisch opstappen tot STEP hoog, meeglijden langs muren en hellingen op/af.

export const P = {
  RADIUS: 0.35,
  HEIGHT: 1.8,
  EYE: 1.65,
  STEP: 0.45,
  WALK: 4.6,
  SPRINT: 7.2,
  ACCEL: 11,          // op de grond
  AIR_ACCEL: 2.2,     // in de lucht: een beetje bijsturen
  AIR_MAX: 1.0,       // max snelheid die je in de lucht kunt "toevoegen" per richting
  FRICTION: 7.5,
  STOP_SPEED: 1.6,
  GRAVITY: 21,
  JUMP_V: 7.0,        // ~1,15 m hoog
  COYOTE: 0.12,       // nog kunnen springen net na een rand
  BUFFER: 0.13,       // sprong die je net te vroeg indrukt telt toch
  SNAP_DOWN: 0.3,     // trap en helling af zonder te "stuiteren"
};

export class Player {
  constructor(spawn, colliders) {
    this.pos = spawn.clone();
    this.spawn = spawn.clone();
    this.prevPos = spawn.clone();
    this.vel = new THREE.Vector3();
    this.colliders = colliders;
    this.onGround = true;
    this.sinceGround = 0;
    this.jumpBuffer = 0;
    this.stepSmooth = 0;       // camera-correctie na een opstap, loopt naar 0
    this.events = [];          // 'jump', 'land:<snelheid>'
    this.distance = 0;         // afgelegde afstand op de grond (voor voetstappen/bob)
  }

  // wish: {forward, right, sprint, jump}
  step(dt, wish, yaw) {
    this.prevPos.copy(this.pos);
    const v = this.vel;

    // gewenste richting in het horizontale vlak
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const wx = wish.right * cos - wish.forward * sin;
    const wz = -wish.right * sin - wish.forward * cos;
    const wl = Math.hypot(wx, wz);
    const dirX = wl > 0 ? wx / wl : 0, dirZ = wl > 0 ? wz / wl : 0;
    const wishSpeed = wl > 0 ? (wish.speed ?? (wish.sprint && wish.forward > 0 ? P.SPRINT : P.WALK)) : 0;

    if (wish.jump) this.jumpBuffer = P.BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.onGround) {
      // wrijving
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0) {
        const drop = Math.max(speed, P.STOP_SPEED) * P.FRICTION * dt;
        const ns = Math.max(0, speed - drop) / speed;
        v.x *= ns; v.z *= ns;
      }
      accelerate(v, dirX, dirZ, wishSpeed, P.ACCEL, dt);
    } else {
      accelerate(v, dirX, dirZ, Math.min(wishSpeed, P.AIR_MAX), P.AIR_ACCEL * wishSpeed, dt);
    }

    // springen (met coyote time en buffer)
    if (this.jumpBuffer > 0 && this.sinceGround <= P.COYOTE && v.y <= 0.01) {
      v.y = P.JUMP_V;
      this.onGround = false;
      this.sinceGround = P.COYOTE + 1;
      this.jumpBuffer = 0;
      this.events.push('jump');
    }

    v.y -= P.GRAVITY * dt;

    // horizontaal bewegen in twee halve stappen (minder kans om door dunne dingen te gaan)
    for (let i = 0; i < 2; i++) {
      this.pos.x += v.x * dt / 2;
      this.pos.z += v.z * dt / 2;
      this.collideHorizontal();
    }
    this.moveVertical(dt);

    if (this.onGround) {
      this.sinceGround = 0;
      this.distance += Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z);
    } else this.sinceGround += dt;

    // opstap-correctie laten uitlopen (exponentieel, ~70 ms)
    this.stepSmooth *= Math.exp(-dt / 0.07);
  }

  collideHorizontal() {
    const p = this.pos, R = P.RADIUS;
    for (const c of this.colliders) {
      if (p.y + P.HEIGHT <= c.bottom) continue;               // hangt boven ons hoofd
      const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      // hoe hoog is het op het punt waar we het object raken?
      const h = colliderTop(c, cx, cz);
      if (h <= p.y + 0.001) continue;                                   // we staan erboven
      if (h <= p.y + P.STEP && (this.onGround || h <= p.y + 0.05)) continue; // opstapbaar, verticaal afgehandeld
      let nx, nz, pen;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d; pen = R - d;
      } else {
        // middelpunt zit in de rechthoek: kortste weg eruit
        const opts = [[p.x - c.minX, -1, 0], [c.maxX - p.x, 1, 0], [p.z - c.minZ, 0, -1], [c.maxZ - p.z, 0, 1]];
        opts.sort((a, b) => a[0] - b[0]);
        nx = opts[0][1]; nz = opts[0][2]; pen = opts[0][0] + R;
      }
      p.x += nx * pen; p.z += nz * pen;
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn < 0) { this.vel.x -= vn * nx; this.vel.z -= vn * nz; }  // meeglijden langs de muur
    }
  }

  // hoogste stuk grond onder de speler dat we kunnen betreden
  groundHeight(maxY) {
    const p = this.pos, r = P.RADIUS * 0.8;
    let best = 0;
    for (const c of this.colliders) {
      if (p.x + r < c.minX || p.x - r > c.maxX || p.z + r < c.minZ || p.z - r > c.maxZ) continue;
      const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
      // cirkel moet de rechthoek echt raken
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 > r * r) continue;
      const h = c.heightAt ? c.heightAt(p.x, p.z) : c.top;
      if (h <= maxY && h > best) best = h;
    }
    return best;
  }

  moveVertical(dt) {
    const p = this.pos, v = this.vel;
    const wasGround = this.onGround;
    const oldY = p.y;
    let newY = p.y + v.y * dt;

    // plafond / onderkant van objecten
    if (v.y > 0) {
      for (const c of this.colliders) {
        if (c.bottom < oldY + P.HEIGHT - 0.01) continue;
        if (p.x + P.RADIUS * 0.8 < c.minX || p.x - P.RADIUS * 0.8 > c.maxX || p.z + P.RADIUS * 0.8 < c.minZ || p.z - P.RADIUS * 0.8 > c.maxZ) continue;
        if (newY + P.HEIGHT > c.bottom) { newY = c.bottom - P.HEIGHT; v.y = 0; }
      }
    }

    const ground = this.groundHeight(Math.max(oldY, newY) + P.STEP);
    if (v.y <= 0 && newY <= ground + 0.0001) {
      // landen of op de grond blijven; ook opstap
      if (!wasGround) this.events.push('land:' + (-v.y).toFixed(2));
      if (ground > oldY + 0.01 && wasGround) this.stepSmooth -= ground - oldY;
      p.y = ground; v.y = 0; this.onGround = true;
    } else if (wasGround && v.y <= 0 && oldY - ground <= P.SNAP_DOWN) {
      // trap/helling af: plakken aan de grond
      if (ground < oldY - 0.01) this.stepSmooth += oldY - ground;
      p.y = ground; v.y = 0; this.onGround = true;
    } else {
      p.y = newY; this.onGround = false;
    }
    if (p.y < -5) { p.copy(this.spawn); v.set(0, 0, 0); }   // vangnet
  }

  // geïnterpoleerde positie voor de camera
  lerpPos(alpha, out) {
    return out.lerpVectors(this.prevPos, this.pos, alpha);
  }

  horizontalSpeed() { return Math.hypot(this.vel.x, this.vel.z); }
}

function colliderTop(c, x, z) { return c.heightAt ? c.heightAt(x, z) : c.top; }

function accelerate(v, dx, dz, wishSpeed, accel, dt) {
  if (wishSpeed <= 0) return;
  const cur = v.x * dx + v.z * dz;
  const add = wishSpeed - cur;
  if (add <= 0) return;
  const a = Math.min(accel * wishSpeed * dt, add);
  v.x += a * dx; v.z += a * dz;
}
