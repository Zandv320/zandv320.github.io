import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Viewmodel: wat je in je handen hebt. Eigen scène en camera, over de wereld heen getekend,
// zodat wapens nooit door een muur steken en een eigen FOV hebben.
// Houdt de wapens ("rigs") bij en regelt wisselen, traagheid, loop-bob en landing.

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
    // zachte omgevingsreflectie voor het metaal van wapens
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;

    this.sway = new THREE.Group();
    this.scene.add(this.sway);
    this.rigs = [];
    this.current = null;
    this.pending = null;      // wapen waar we naartoe wisselen
    this.switchT = 0;         // 0..1 omlaag, daarna weer omhoog
    this.switchPhase = 'none';
    this.swayRot = new THREE.Vector2();
    this.swayPos = new THREE.Vector2();
    this.fov = 66;
  }

  add(rig) {
    rig.root.visible = false;
    this.sway.add(rig.root);
    this.rigs.push(rig);
  }

  // direct een wapen pakken (bij het starten)
  set(rig) {
    if (this.current) this.current.root.visible = false;
    this.current = rig;
    rig.root.visible = true;
    rig.equip();
    this.switchPhase = 'none';
  }

  // wisselen: huidig wapen gaat omlaag, nieuw komt omhoog
  switchTo(rig) {
    if (!rig || !rig.ready || rig === this.current || rig === this.pending) return false;
    this.pending = rig;
    this.switchPhase = 'down';
    return true;
  }

  get switching() { return this.switchPhase !== 'none'; }

  update(dt, s) {
    // wissel-animatie: 0,14 s omlaag, wapen wisselen, dan de equip-animatie van het nieuwe wapen
    let drop = 0;
    if (this.switchPhase === 'down') {
      this.switchT = Math.min(1, this.switchT + dt / 0.14);
      drop = this.switchT;
      if (this.switchT >= 1) {
        this.set(this.pending);
        this.pending = null;
        this.switchPhase = 'up';
      }
    } else if (this.switchPhase === 'up') {
      this.switchT = Math.max(0, this.switchT - dt / 0.18);
      drop = this.switchT;
      if (this.switchT <= 0) this.switchPhase = 'none';
    }

    if (this.current) this.current.update(dt);

    // FOV per wapen, zacht overvloeien
    const want = this.current ? this.current.fov : 66;
    this.fov += (want - this.fov) * (1 - Math.exp(-dt * 10));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

    // traagheid
    const k = 1 - Math.exp(-dt * 14);
    const tx = THREE.MathUtils.clamp(-s.mouseDX * 0.0009, -0.09, 0.09);
    const ty = THREE.MathUtils.clamp(-s.mouseDY * 0.0009, -0.07, 0.07);
    this.swayRot.x += (ty - this.swayRot.x) * k;
    this.swayRot.y += (tx - this.swayRot.y) * k;
    this.swayPos.x += (tx * 0.25 - this.swayPos.x) * k;
    this.swayPos.y += (ty * 0.25 - this.swayPos.y) * k;

    // loop-bob, sprinthouding, landing, terugslag en wisselen
    const busy = this.current?.busy;
    const amt = s.bobAmount;
    const bx = Math.sin(s.bobPhase) * 0.011 * amt;
    const by = -Math.abs(Math.cos(s.bobPhase)) * 0.013 * amt;
    this.sprintLerp = (this.sprintLerp || 0) + ((s.sprint && !busy ? 1 : 0) - (this.sprintLerp || 0)) * (1 - Math.exp(-dt * 8));
    const sp = this.sprintLerp;
    const kick = s.kick || 0;
    this.sway.position.set(
      bx + this.swayPos.x - sp * 0.02,
      by + this.swayPos.y + s.land * 0.5 - sp * 0.05 - drop * 0.25,
      sp * 0.02 + kick * 0.6
    );
    this.sway.rotation.set(
      this.swayRot.x - sp * 0.16 + s.land * 0.4 - drop * 0.6 + kick * 2.2,
      this.swayRot.y,
      this.swayRot.y * 0.8 + bx * 2 + sp * 0.08
    );
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
