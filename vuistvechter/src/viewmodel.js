import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Viewmodel: de armen met het wapen in je handen, zoals in CoD, Battlefield en Tarkov.
// Eigen scène en camera, over de wereld heen getekend: de professioneel geanimeerde armen houden
// het wapen natuurlijk vast, steken nooit door een muur en hebben een eigen beeldhoek.
// Je lichaam (romp, benen, schaduw) staat gewoon in de wereld; alleen de armen komen van hier.
// Regelt wisselen, traagheid, loop-bob, landing, richten (ADS), leunen en terugtrekken bij muren.

export class Viewmodel {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.01, 10);
    this.camera.rotation.x = -0.04;
    this.scene.add(new THREE.HemisphereLight(0xf2efe9, 0x4a4038, 1.2));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.8);
    key.position.set(0.6, 1.5, 0.8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 0.8);
    rim.position.set(-1, 0.5, -0.5); this.scene.add(rim);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    // flitslicht van het eigen wapen
    this.flash = new THREE.PointLight(0xffb060, 0, 1.2, 2);
    this.scene.add(this.flash);

    this.sway = new THREE.Group();
    this.ads = new THREE.Group();          // richten over het vizier
    this.scene.add(this.sway); this.sway.add(this.ads);
    this.rigs = [];
    this.current = null;
    this.pending = null;
    this.switchT = 0;
    this.switchPhase = 'none';
    this.swayRot = new THREE.Vector2();
    this.swayPos = new THREE.Vector2();
    this.fov = 66;
    this.adsT = 0;
    this.push = 0;
    this.flashT = 0;
  }

  add(rig) {
    rig.root.visible = false;
    this.ads.add(rig.root);
    this.rigs.push(rig);
  }

  set(rig) {
    if (this.current) this.current.root.visible = false;
    this.current = rig;
    rig.root.visible = true;
    rig.equip();
    this.switchPhase = 'none';
  }

  switchTo(rig) {
    if (!rig || !rig.ready || rig === this.current || rig === this.pending) return false;
    this.pending = rig;
    this.switchPhase = 'down';
    return true;
  }

  get switching() { return this.switchPhase !== 'none'; }
  get aimAmount() { return this.adsT; }

  // s: { mouseDX, mouseDY, bobPhase, bobAmount, sprint, land, kick, aim, wall, lean }
  update(dt, s) {
    let drop = 0;
    if (this.switchPhase === 'down') {
      this.switchT = Math.min(1, this.switchT + dt / 0.14);
      drop = this.switchT;
      if (this.switchT >= 1) { this.set(this.pending); this.pending = null; this.switchPhase = 'up'; }
    } else if (this.switchPhase === 'up') {
      this.switchT = Math.max(0, this.switchT - dt / 0.18);
      drop = this.switchT;
      if (this.switchT <= 0) this.switchPhase = 'none';
    }
    const rig = this.current;
    if (rig) rig.update(dt);

    // richten: zacht in en uit
    const wantAds = s.aim && rig?.adsPose && !drop && !s.sprint ? 1 : 0;
    this.adsT += (wantAds - this.adsT) * (1 - Math.exp(-dt * 13));
    const a = THREE.MathUtils.smootherstep(this.adsT, 0, 1);
    if (rig?.adsPose) {
      this.ads.position.copy(rig.adsPose.pos).multiplyScalar(a);
      this.ads.quaternion.identity().slerp(rig.adsPose.quat, a);
    } else { this.ads.position.set(0, 0, 0); this.ads.quaternion.identity(); }

    // beeldhoek per wapen, bij richten iets ingezoomd
    const want = (rig ? rig.fov : 66) * (1 - a * 0.22);
    this.fov += (want - this.fov) * (1 - Math.exp(-dt * 10));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

    // traagheid (minder bij richten)
    const calm = 1 - a * 0.75;
    const k = 1 - Math.exp(-dt * 14);
    const tx = THREE.MathUtils.clamp(-s.mouseDX * 0.0009, -0.09, 0.09) * calm;
    const ty = THREE.MathUtils.clamp(-s.mouseDY * 0.0009, -0.07, 0.07) * calm;
    this.swayRot.x += (ty - this.swayRot.x) * k;
    this.swayRot.y += (tx - this.swayRot.y) * k;
    this.swayPos.x += (tx * 0.25 - this.swayPos.x) * k;
    this.swayPos.y += (ty * 0.25 - this.swayPos.y) * k;

    // vlak voor een muur: wapen een stukje terug en omhoog
    this.push += ((s.wall || 0) - this.push) * (1 - Math.exp(-dt * 12));
    const w = this.push;

    const busy = rig?.busy;
    const amt = s.bobAmount * calm;
    const bx = Math.sin(s.bobPhase) * 0.011 * amt;
    const by = -Math.abs(Math.cos(s.bobPhase)) * 0.013 * amt;
    this.sprintLerp = (this.sprintLerp || 0) + ((s.sprint && !busy ? 1 : 0) - (this.sprintLerp || 0)) * (1 - Math.exp(-dt * 8));
    const sp = this.sprintLerp;
    const kick = s.kick || 0;
    this.sway.position.set(
      bx + this.swayPos.x - sp * 0.02,
      by + this.swayPos.y + s.land * 0.5 - sp * 0.05 - drop * 0.25 - w * 0.03,
      sp * 0.02 + kick * 0.6 * (1 - a * 0.5) + w * 0.08
    );
    this.sway.rotation.set(
      this.swayRot.x - sp * 0.16 + s.land * 0.4 - drop * 0.6 + kick * 2.2 * (1 - a * 0.6) + w * 0.6,
      this.swayRot.y,
      this.swayRot.y * 0.8 + bx * 2 + sp * 0.08 + (s.lean || 0) * 0.12
    );
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT / 0.055) * 1.4;
    }
  }

  // lichtje bij de mondingsflits, zodat handen en wapen even oplichten
  muzzleFlash(rig) {
    if (!rig?.muzzle) return;
    rig.muzzle.getWorldPosition(this.flash.position);
    this.flash.intensity = 1.4;
    this.flashT = 0.055;
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
