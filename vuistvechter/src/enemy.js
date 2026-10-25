import * as THREE from 'three';
import { loadGLTF, cloneCharacter, Locomotion, attachPistol, addHitboxes } from './characters.js';
import { Player, P } from './player.js';
import { MuzzleFlash } from './flash.js';

// CPU-tegenstanders. Elke vijand loopt een patrouilleroute, ziet je alleen binnen zijn
// gezichtsveld en als er niets tussen zit, heeft een korte reactietijd, schiet in korte
// salvo's en stapt opzij tijdens een vuurgevecht. Kwijt? Dan loopt hij naar waar hij je
// het laatst zag, kijkt rond en gaat terug naar zijn ronde.

export const ENEMY = {
  HEALTH: 100,
  WALK: 1.7, COMBAT: 2.3, RUN: 4.6,
  VIEW: 45, FOV: Math.cos(THREE.MathUtils.degToRad(65)),   // 130 graden gezichtsveld
  REACT: 0.5,                                                // seconden voor het eerste schot
  DAMAGE: 10,
  RESPAWN: 6,
  TURN: 7,                                                   // draaisnelheid (rad/s, gedempt)
};
const PARTS = { head: 2.5, torso: 1, limb: 0.75 };
const EYE = 1.6;

// patrouilles: [spawnpunt, ...route]; de route wordt heen en terug gelopen
const ROUTES = [
  [[-9.5, 1.5, -12.5], [-8, 1.5, -10], [-12.5, 1.5, -11.5], [-12.5, 0, -6.2], [-6, 0, -5.5], [-2, 0, -9]],
  [[8.4, 2.4, -13], [8.4, 2.4, -11.5], [8.4, 0, -0.5], [4.5, 0, -2.5], [1, 0, -6], [5.5, 0, -8]],
];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Enemies {
  // ctx: { scene, level, audio, effects, camera, player, onPlayerHit(dmg, from), onKill(enemy) }
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    this.hitboxes = [];
    this.ready = false;
    this.kills = 0;
    this.ray = new THREE.Raycaster();
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  async load() {
    const gltf = await loadGLTF('models/enemy.glb');
    for (let i = 0; i < ROUTES.length; i++) {
      const e = new Enemy(this, gltf, ROUTES[i], i);
      await e.init();
      this.list.push(e);
      this.hitboxes.push(...e.hitboxes);
    }
    this.ready = true;
  }

  // hitboxen van levende vijanden (de raycaster kijkt niet naar .visible)
  live() { return this.ready ? this.hitboxes.filter(h => !h.userData.owner.dead) : []; }

  // vrije zichtlijn tussen twee punten (alleen het level, niet de personages)
  clear(a, b) {
    const d = _v2.subVectors(b, a); const len = d.length();
    this.ray.set(a, d.divideScalar(len)); this.ray.far = len - 0.05;
    return this.ray.intersectObjects(this.ctx.level.hittables, false).length === 0;
  }

  // schot van de speler of een stoot raakt een hitbox
  damage(hitbox, amount, dir) {
    const e = hitbox.userData.owner;
    if (!e || e.dead) return null;
    this.provoked = true;
    const mult = PARTS[hitbox.userData.part] ?? 1;
    e.takeDamage(amount * mult, dir, hitbox.userData.part);
    return { enemy: e, killed: e.dead, head: hitbox.userData.part === 'head' };
  }

  tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const l = new THREE.Line(g, this.tracerMat.clone());
    this.ctx.scene.add(l);
    this.tracers.push({ l, t: 0.07 });
  }

  // na doodgaan van de speler: iedereen terug naar de patrouille
  reset() { for (const e of this.list) e.respawn(true); }

  update(dt) {
    if (!this.ready) return;
    for (const e of this.list) e.update(dt);
    // personages duwen elkaar (en de speler) opzij
    const pl = this.ctx.player;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i]; if (a.dead) continue;
      for (let j = i + 1; j < this.list.length; j++) { const b = this.list[j]; if (!b.dead) separate(a.body.pos, b.body.pos, 0.5, 0.5); }
      if (!this.ctx.playerDead) separate(pl.pos, a.body.pos, 0.35, 0.65);
    }
    for (const t of this.tracers) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.07) * 0.8; }
    for (const t of this.tracers.filter(t => t.t <= 0)) { this.ctx.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); }
    this.tracers = this.tracers.filter(t => t.t > 0);
  }
}

// twee cilinders uit elkaar duwen; wa = aandeel dat a beweegt
function separate(a, b, wa, wb) {
  if (Math.abs(a.y - b.y) > 1.6) return;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = P.RADIUS * 2;
  if (d >= min || d < 1e-4) return;
  const push = (min - d), nx = dx / d, nz = dz / d;
  a.x -= nx * push * wa; a.z -= nz * push * wa;
  b.x += nx * push * wb; b.z += nz * push * wb;
}

class Enemy {
  constructor(mgr, gltf, route, index) {
    this.mgr = mgr; this.gltf = gltf; this.index = index;
    this.spawnPt = new THREE.Vector3(...route[0]);
    this.route = route.map(p => new THREE.Vector3(...p));
  }

  async init() {
    const { scene, level } = this.mgr.ctx;
    const { model, bones } = cloneCharacter(this.gltf);
    this.model = model; this.bones = bones;
    this.root = new THREE.Group(); this.root.add(model);
    scene.add(this.root);
    this.loco = new Locomotion(model, this.gltf.animations);
    const clip = n => this.gltf.animations.find(c => c.name === n);
    const gun = await attachPistol(model, bones, clip('idle'));
    this.muzzle = gun.muzzle;
    this.flash = new MuzzleFlash(new THREE.Vector3(0, 0, 1), 1, { length: 0.2, width: 0.12 });
    this.muzzle.add(this.flash.group);
    this.light = new THREE.PointLight(0xffc27a, 0, 7, 2);
    scene.add(this.light);
    this.hitboxes = addHitboxes(model, bones, this);
    this.body = new Player(this.spawnPt, level.colliders);
    this.respawn(true);
  }

  respawn(atSpawn = false) {
    const pl = this.mgr.ctx.player;
    // ander startpunt als de speler te dichtbij staat
    let pt = this.spawnPt;
    if (!atSpawn) {
      const options = [this.spawnPt, ...this.route].sort((a, b) => b.distanceToSquared(pl.pos) - a.distanceToSquared(pl.pos));
      pt = options[0];
    }
    this.body.pos.copy(pt); this.body.prevPos.copy(pt); this.body.vel.set(0, 0, 0);
    this.health = ENEMY.HEALTH;
    this.dead = false; this.deadT = 0;
    this.state = 'patrol';
    this.wp = 1; this.wpDir = 1; this.wait = 0;
    this.heading = Math.PI;                        // kijkt naar -z (het midden van de hal)
    this.aware = 0; this.seen = false; this.lastSeen = new THREE.Vector3(); this.lostT = 0;
    this.cooldown = 1; this.burst = 0; this.firstShot = true;
    this.strafe = 0; this.strafeT = 0;
    this.searchT = 0; this.stuckT = 0;
    this.recoil = 0; this.aimPitch = 0;
    this.thinkT = Math.random() * 0.1;
    this.root.visible = true;
    this.loco.reset();
  }

  takeDamage(amount, dir, part) {
    this.health -= amount;
    const { audio } = this.mgr.ctx;
    // geraakt: meteen alert en draai naar waar het vandaan kwam
    if (dir) this.lastSeen.copy(this.body.pos).addScaledVector(_v.copy(dir).setY(0).normalize(), -6);
    if (this.state === 'patrol' || this.state === 'search') {
      this.state = 'search'; this.searchT = 4; this.aware = Math.max(this.aware, ENEMY.REACT * 0.6);
    }
    if (this.health <= 0) {
      this.dead = true; this.deadT = 0; this.state = 'dead';
      // van voren geraakt: achterover vallen
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const front = dir ? dir.x * fx + dir.z * fz < 0 : true;
      this.loco.die(front ? 'deathBack' : 'deathFwd');
      this.body.vel.set(0, this.body.vel.y, 0);
      this.mgr.kills++;
      this.mgr.ctx.onKill?.(this, part);
      setTimeout(() => audio.play('land', { gain: 0.5, rate: 0.7 }), 650);
      return;
    }
    if (part !== 'limb' || Math.random() < 0.5) this.loco.once('hit', 0.08, 1.4);
    this.cooldown = Math.max(this.cooldown, 0.35);
  }

  eye(out) { return out.copy(this.body.pos).setY(this.body.pos.y + EYE); }

  // kan ik de speler zien?
  look() {
    const { camera, player } = this.mgr.ctx;
    if (this.mgr.ctx.playerDead || !(this.mgr.ctx.hostile || this.mgr.provoked)) return false;
    const eye = this.eye(new THREE.Vector3());
    const to = _v.subVectors(camera.position, eye);
    const dist = to.length();
    if (dist > ENEMY.VIEW) return false;
    const fwd = _v2.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const cos = (to.x * fwd.x + to.z * fwd.z) / Math.max(1e-4, Math.hypot(to.x, to.z));
    // binnen het gezichtsveld, of zo dichtbij dat hij je hoort; alert = breder
    const wide = this.state === 'combat' || this.state === 'search';
    if (cos < (wide ? -0.2 : ENEMY.FOV) && dist > 3) return false;
    const chest = camera.position.clone(); chest.y -= 0.5;
    return this.mgr.clear(eye, camera.position) || this.mgr.clear(eye, chest);
  }

  update(dt) {
    const ctx = this.mgr.ctx;
    const body = this.body;
    this.flash.update(dt);
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; }

    if (this.dead) {
      this.deadT += dt;
      // val nog door (bijv. van de richel), verder stil liggen
      body.step(dt, { forward: 0, right: 0, jump: false, speed: 0 }, this.heading + Math.PI);
      this.place(dt, 0, 0);
      if (this.deadT > ENEMY.RESPAWN) this.respawn(false);
      return;
    }

    // waarnemen (10x per seconde)
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.1;
      this.seen = this.look();
      if (this.seen) {
        this.lastSeen.copy(ctx.player.pos);
        this.lostT = 0;
        if (this.state !== 'combat') { this.state = 'combat'; this.firstShot = true; this.cooldown = Math.max(this.cooldown, 0.15); }
      }
    }
    if (this.seen) this.aware = Math.min(ENEMY.REACT + 0.5, this.aware + dt);
    else this.aware = Math.max(0, this.aware - dt * 0.25);

    // wat wil ik: richting om te lopen, snelheid, waar te kijken
    let moveX = 0, moveZ = 0, speed = 0, faceAt = null;
    const pos = body.pos;
    const toPlayer = _v.subVectors(ctx.player.pos, pos); toPlayer.y = 0;
    const distP = toPlayer.length();

    if (this.state === 'combat') {
      faceAt = ctx.player.pos;
      if (!this.seen) {
        this.lostT += dt;
        if (this.lostT > 1.2) { this.state = 'search'; this.searchT = 0; }
      }
      // opzij stappen, afstand houden
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe = [-1, 0, 1, 1, -1][(Math.random() * 5) | 0]; this.strafeT = 0.9 + Math.random() * 1.3; }
      const fx = toPlayer.x / (distP || 1), fz = toPlayer.z / (distP || 1);
      let fwd = distP > 15 ? 1 : distP < 5 ? -1 : 0;
      moveX = fwd * fx + this.strafe * -fz;
      moveZ = fwd * fz + this.strafe * fx;
      speed = ENEMY.COMBAT;
      // schieten
      this.cooldown -= dt;
      if (this.seen && this.aware >= ENEMY.REACT && this.cooldown <= 0 && Math.abs(angleDiff(Math.atan2(fx, fz), this.heading)) < 0.25) {
        this.shoot(distP);
        if (this.burst <= 0) this.burst = 2 + ((Math.random() * 3) | 0);
        this.burst--;
        this.cooldown = this.burst > 0 ? 0.24 + Math.random() * 0.12 : 0.7 + Math.random() * 0.8;
      }
    } else if (this.state === 'search') {
      // naar de plek waar de speler het laatst was
      const d = _v2.subVectors(this.lastSeen, pos); d.y = 0;
      const dl = d.length();
      if (dl > 1 && this.searchT >= 0 && this.searchT < 6) {
        moveX = d.x; moveZ = d.z; speed = ENEMY.RUN * 0.75; faceAt = this.lastSeen;
        this.searchT += dt;
      } else {
        // rondkijken
        this.searchT = Math.max(this.searchT, 6) + dt;
        this.heading += Math.sin(this.searchT * 1.6) * dt * 1.4;
        if (this.searchT > 9.5) { this.state = 'patrol'; this.wp = this.nearestWaypoint(); }
      }
    } else {
      // patrouille
      const target = this.route[this.wp];
      const d = _v2.subVectors(target, pos); d.y = 0;
      if (this.wait > 0) this.wait -= dt;
      else if (d.length() < 0.5) {
        this.wait = 0.8 + Math.random() * 1.6;
        if (this.wp + this.wpDir >= this.route.length || this.wp + this.wpDir < 0) this.wpDir *= -1;
        this.wp += this.wpDir;
      } else { moveX = d.x; moveZ = d.z; speed = ENEMY.WALK; }
    }

    // vast? (tegen een obstakel aan lopen)
    const wantMove = speed > 0 && Math.hypot(moveX, moveZ) > 1e-3;
    if (wantMove && body.horizontalSpeed() < speed * 0.25) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.2) {
      this.stuckT = 0;
      if (this.state === 'search') this.searchT = 6;
      else if (this.state === 'patrol') { this.wpDir *= -1; this.wp = THREE.MathUtils.clamp(this.wp + this.wpDir, 0, this.route.length - 1); }
      else this.strafe = -this.strafe;
    }

    // kijkrichting
    if (faceAt) this.faceTo(Math.atan2(faceAt.x - pos.x, faceAt.z - pos.z), dt);
    else if (wantMove) this.faceTo(Math.atan2(moveX, moveZ), dt);

    // bewegen met dezelfde natuurkunde als de speler
    let wish = { forward: 0, right: 0, jump: false, speed: 0 }, yaw = 0;
    if (wantMove) { wish = { forward: 1, right: 0, jump: false, speed }; yaw = Math.atan2(-moveX, -moveZ); }
    // tijdens "geraakt" niet lopen
    if (this.loco.locked) wish.speed = 0;
    for (let left = dt; left > 1e-6; left -= 1 / 120) body.step(Math.min(1 / 120, left), wish, yaw);
    body.events.length = 0;

    // animatie op basis van de echte snelheid in de eigen kijkrichting
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const v = body.vel;
    this.place(dt, v.x * -fz + v.z * fx, v.x * fx + v.z * fz);
  }

  faceTo(target, dt) {
    const diff = angleDiff(target, this.heading);
    this.heading += diff * Math.min(1, ENEMY.TURN * dt);
  }

  nearestWaypoint() {
    const pos = this.body.pos;
    let best = 0, bd = Infinity;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.route.forEach((p, i) => {
      const d = p.distanceToSquared(pos);
      a.copy(pos).setY(pos.y + 0.5); b.copy(p).setY(p.y + 0.5);
      if (d < bd && this.mgr.clear(a, b)) { bd = d; best = i; }
    });
    return best;
  }

  place(dt, vx, vz) {
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.heading;
    this.loco.update(dt, vx, vz, { airborne: !this.body.onGround && this.body.vel.y < -3 });
    if (this.dead) return;
    // bovenlijf richten op de speler (op en neer) + terugslag van het pistool
    const cam = this.mgr.ctx.camera.position;
    let target = 0;
    if (this.state === 'combat') {
      const eye = this.eye(_v);
      target = Math.atan2(cam.y - 0.25 - eye.y, Math.hypot(cam.x - eye.x, cam.z - eye.z));
    }
    this.aimPitch += (target - this.aimPitch) * Math.min(1, dt * 8);
    this.recoil *= Math.exp(-dt * 14);
    const pitch = THREE.MathUtils.clamp(this.aimPitch, -0.8, 0.8);
    this.root.updateMatrixWorld(true);
    // as = rechterkant van het personage in de wereld
    const axis = _v2.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    for (const [name, k] of [['Spine1', 0.5], ['Spine2', 0.5]]) rotateBoneWorld(this.bones[name], axis, pitch * k);
    rotateBoneWorld(this.bones.RightHand, axis, this.recoil * 0.6);
    rotateBoneWorld(this.bones.RightForeArm, axis, this.recoil * 0.4);
  }

  shoot(dist) {
    const ctx = this.mgr.ctx;
    const from = new THREE.Vector3(); this.muzzle.getWorldPosition(from);
    this.flash.fire();
    this.light.position.copy(from); this.light.intensity = 3; this.lightT = 0.05;
    this.recoil = 0.35;
    // geluid: zachter, doffer en in stereo op afstand
    const cam = ctx.camera;
    const rel = from.clone().sub(cam.position);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const pan = rel.clone().normalize().dot(right) * 0.8;
    ctx.audio.play('shot', { gain: Math.min(0.75, 2.4 / (1 + dist * 0.35)), rate: 0.94, pan, lowpass: 9000 / (1 + dist * 0.08) });

    // raakkans: lager op afstand, als je snel beweegt en bij het eerste schot
    const pspeed = ctx.player.horizontalSpeed() + (ctx.player.onGround ? 0 : 3);
    let chance = THREE.MathUtils.clamp(0.62 - dist * 0.02 - pspeed * 0.05, 0.12, 0.65);
    if (this.firstShot) chance *= 0.45;
    this.firstShot = false;
    const target = cam.position.clone(); target.y -= 0.35;
    if (Math.random() < chance) {
      ctx.onPlayerHit?.(ENEMY.DAMAGE, from);
      this.mgr.tracer(from, from.clone().lerp(target, 0.92));
      return;
    }
    // mis: kogel vliegt langs je heen en slaat ergens in
    const side = new THREE.Vector3().subVectors(target, from).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const off = (0.35 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1);
    target.addScaledVector(side, off).y += (Math.random() - 0.4) * 0.8;
    const dir = target.sub(from).normalize();
    const ray = this.mgr.ray; ray.set(from, dir); ray.far = 120;
    const hit = ray.intersectObjects(ctx.level.hittables, false)[0];
    const end = hit ? hit.point : from.clone().addScaledVector(dir, 60);
    this.mgr.tracer(from, end);
    if (hit) {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : dir.clone().negate();
      if (!hit.object.userData.bag && !hit.object.userData.target) ctx.effects.hole(hit);
      ctx.effects.burst(hit.point, n, 0xb8b0a2, 8);
    }
    // langs je oor?
    const closest = new THREE.Vector3(); new THREE.Ray(from, dir).closestPointToPoint(cam.position, closest);
    if (closest.distanceTo(cam.position) < 1.5 && (!hit || hit.distance > from.distanceTo(cam.position))) {
      ctx.audio.whiz(THREE.MathUtils.clamp(closest.sub(cam.position).dot(right) * 1.5, -1, 1), 0.3);
    }
  }
}

// bot draaien om een as in wereldcoördinaten
function rotateBoneWorld(bone, axisWorld, angle) {
  if (!bone || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_q);
  const local = _v.copy(axisWorld).applyQuaternion(_q.invert()).normalize();
  _q2.setFromAxisAngle(local, angle);
  bone.quaternion.premultiply(_q2);
  bone.updateMatrixWorld(true);
}
