import * as THREE from 'three';

// Wapens in de wereld (echte first person): de wapens hangen aan een anker dat de camera volgt.
// Ze worden niet meer apart over de wereld heen getekend: ze botsen dus echt met muren, krijgen
// hetzelfde licht en dezelfde schaduwen, en de armen van je eigen lichaam pakken ze vast (IK).
// Deze klasse regelt wisselen, traagheid, loop-bob, landing, richten (ADS) en terugduwen bij muren.

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0, 0));   // de oude viewmodel-camera keek 0,04 rad omlaag

export class Viewmodel {
  constructor(scene) {
    this.anchor = new THREE.Group();        // = camera
    this.sway = new THREE.Group();
    this.ads = new THREE.Group();           // richten over het vizier
    this.anchor.add(this.sway); this.sway.add(this.ads);
    scene.add(this.anchor);
    this.rigs = [];
    this.current = null;
    this.pending = null;
    this.switchT = 0;
    this.switchPhase = 'none';
    this.swayRot = new THREE.Vector2();
    this.swayPos = new THREE.Vector2();
    this.adsT = 0;
    this.push = 0;
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

  // s: { camera, mouseDX, mouseDY, bobPhase, bobAmount, sprint, land, kick, aim (0/1), wall (0..1), lean }
  update(dt, s) {
    let drop = 0;
    if (this.switchPhase === 'down') {
      this.switchT = Math.min(1, this.switchT + dt / 0.16);
      drop = this.switchT;
      if (this.switchT >= 1) { this.set(this.pending); this.pending = null; this.switchPhase = 'up'; }
    } else if (this.switchPhase === 'up') {
      this.switchT = Math.max(0, this.switchT - dt / 0.22);
      drop = this.switchT;
      if (this.switchT <= 0) this.switchPhase = 'none';
    }
    const rig = this.current;
    if (rig) rig.update(dt);

    // anker = camera
    s.camera.getWorldPosition(this.anchor.position);
    s.camera.getWorldQuaternion(this.anchor.quaternion).multiply(TILT);

    // richten: zacht in en uit (ca. 0,22 s), niet tijdens wisselen of sprinten
    const wantAds = s.aim && rig?.adsPose && !drop && !s.sprint ? 1 : 0;
    this.adsT += (wantAds - this.adsT) * (1 - Math.exp(-dt * 13));
    const a = THREE.MathUtils.smootherstep(this.adsT, 0, 1);
    // reach: wapen verder van het oog dan het oude viewmodel, zodat je armen bijna gestrekt zijn
    const reach = rig?.reach || 0;
    if (rig?.adsPose) {
      this.ads.position.copy(rig.adsPose.pos).multiplyScalar(a);
      this.ads.position.z -= reach * (1 - a);
      this.ads.quaternion.identity().slerp(rig.adsPose.quat, a);
    } else { this.ads.position.set(0, 0, -reach); this.ads.quaternion.identity(); }

    // traagheid: het wapen heeft gewicht en loopt achter de muis aan (minder bij richten)
    const calm = 1 - a * 0.75;
    const k = 1 - Math.exp(-dt * 10);
    const tx = THREE.MathUtils.clamp(-s.mouseDX * 0.0011, -0.11, 0.11) * calm;
    const ty = THREE.MathUtils.clamp(-s.mouseDY * 0.0011, -0.08, 0.08) * calm;
    this.swayRot.x += (ty - this.swayRot.x) * k;
    this.swayRot.y += (tx - this.swayRot.y) * k;
    this.swayPos.x += (tx * 0.22 - this.swayPos.x) * k;
    this.swayPos.y += (ty * 0.22 - this.swayPos.y) * k;

    // muur vlak voor je: wapen terugtrekken en omhoog kantelen
    this.push += ((s.wall || 0) - this.push) * (1 - Math.exp(-dt * 12));
    const w = this.push;

    const busy = rig?.busy;
    const amt = s.bobAmount * calm;
    const bx = Math.sin(s.bobPhase) * 0.012 * amt;
    const by = -Math.abs(Math.cos(s.bobPhase)) * 0.014 * amt;
    this.sprintLerp = (this.sprintLerp || 0) + ((s.sprint && !busy ? 1 : 0) - (this.sprintLerp || 0)) * (1 - Math.exp(-dt * 7));
    const sp = this.sprintLerp;
    const kick = s.kick || 0;
    this.sway.position.set(
      bx + this.swayPos.x - sp * 0.03,
      by + this.swayPos.y + s.land * 0.5 - sp * 0.06 - drop * 0.3 - w * 0.06,
      sp * 0.03 + kick * 0.9 + w * 0.16
    );
    this.sway.rotation.set(
      this.swayRot.x - sp * 0.3 + s.land * 0.4 - drop * 0.7 + kick * 2.6 + w * 0.9,
      this.swayRot.y + sp * 0.35,
      this.swayRot.y * 0.8 + bx * 2 + sp * 0.12 + (s.lean || 0) * 0.15
    );
    this.anchor.updateMatrixWorld(true);
  }

  get aimAmount() { return this.adsT; }
}
