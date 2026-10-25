import * as THREE from 'three';

// Kogelgaten, inslagdeeltjes en het licht van de mondingsflits in de wereld.

const MAX_HOLES = 80;

function holeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(8,7,6,1)');
  grd.addColorStop(0.22, 'rgba(15,13,12,0.95)');
  grd.addColorStop(0.32, 'rgba(40,36,32,0.6)');
  grd.addColorStop(0.6, 'rgba(60,55,50,0.18)');
  grd.addColorStop(1, 'rgba(60,55,50,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.holes = [];
    this.holeGeo = new THREE.PlaneGeometry(0.07, 0.07);
    this.holeMat = new THREE.MeshBasicMaterial({
      map: holeTexture(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.bursts = [];
    this.light = new THREE.PointLight(0xffc27a, 0, 9, 2);
    scene.add(this.light);
    this.lightTime = 0;
    this._n = new THREE.Vector3();
    // rooktexturen uit Kenney's Particle Pack (CC0)
    this.smokeTex = [1, 2, 3, 4].map(i => { const t = new THREE.TextureLoader().load(`textures/fx/smoke${i}.png`); t.colorSpace = THREE.SRGBColorSpace; return t; });
    this.smoke = [];
  }

  // kogelgat op een oppervlak (niet op bewegende dingen)
  hole(hit) {
    if (!hit.face) return;
    const n = this._n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    const m = new THREE.Mesh(this.holeGeo, this.holeMat);
    m.position.copy(hit.point).addScaledVector(n, 0.003);
    m.lookAt(hit.point.clone().add(n));
    m.rotateZ(Math.random() * Math.PI * 2);
    const s = 0.8 + Math.random() * 0.4; m.scale.set(s, s, s);
    this.scene.add(m);
    this.holes.push(m);
    if (this.holes.length > MAX_HOLES) this.scene.remove(this.holes.shift());
  }

  // stof/vonkjes bij een inslag
  burst(point, normal, color = 0xbdb6aa, count = 10) {
    const pos = new Float32Array(count * 3), vel = [];
    for (let i = 0; i < count; i++) {
      pos.set([point.x, point.y, point.z], i * 3);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.6).addScaledVector(normal, 1.5 + Math.random() * 1.5);
      vel.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.bursts.push({ pts, vel, life: 0.45, max: 0.45 });
  }

  // rookpluim uit de loop; strength 0..1
  puff(pos, strength = 1, forward = null, wisp = false) {
    const tex = this.smokeTex[(Math.random() * this.smokeTex.length) | 0];
    const m = new THREE.SpriteMaterial({ map: tex, color: 0xcfccc6, transparent: true, depthWrite: false, opacity: 0 });
    m.rotation = Math.random() * Math.PI * 2;
    const sp = new THREE.Sprite(m);
    sp.position.copy(pos);
    const s0 = wisp ? 0.015 + Math.random() * 0.01 : 0.025 + Math.random() * 0.015;
    sp.scale.set(s0, s0, s0);
    this.scene.add(sp);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 0.04, (wisp ? 0.16 : 0.08) + Math.random() * 0.06, (Math.random() - 0.5) * 0.04);
    if (forward) vel.addScaledVector(forward, 0.25 + Math.random() * 0.15);
    // kort en licht: een schotwolkje is na ~0,5 s weg, een sliertje na ~0,8 s
    const life = wisp ? 0.6 + Math.random() * 0.3 : 0.35 + Math.random() * 0.25;
    const grow = wisp ? 0.05 + Math.random() * 0.03 : 0.08 + Math.random() * 0.05;
    this.smoke.push({ sp, vel, age: 0, life, s0, grow, peak: (wisp ? 0.13 : 0.16) * strength, spin: (Math.random() - 0.5) * 1.2 });
    if (this.smoke.length > 60) { const o = this.smoke.shift(); this.scene.remove(o.sp); o.sp.material.dispose(); }
  }

  muzzleLight(pos, intensity = 6) {
    this.light.position.copy(pos);
    this.light.intensity = intensity;
    this.lightTime = 0.05;
  }

  update(dt) {
    if (this.lightTime > 0) { this.lightTime -= dt; if (this.lightTime <= 0) this.light.intensity = 0; }
    for (const p of this.smoke) {
      p.age += dt;
      const k = p.age / p.life;
      p.vel.y += 0.05 * dt;                       // warme lucht stijgt iets sneller
      p.vel.multiplyScalar(1 - 0.6 * dt);
      p.vel.y = Math.max(p.vel.y, 0.08);
      p.sp.position.addScaledVector(p.vel, dt);
      const sc = p.s0 + p.grow * Math.sqrt(k);
      p.sp.scale.set(sc, sc, sc);
      p.sp.material.rotation += p.spin * dt;
      // snel opkomen, langzaam vervagen
      p.sp.material.opacity = p.peak * Math.min(1, k * 10) * Math.pow(1 - k, 2);
    }
    for (const p of this.smoke.filter(p => p.age >= p.life)) { this.scene.remove(p.sp); p.sp.material.dispose(); }
    this.smoke = this.smoke.filter(p => p.age < p.life);
    for (const b of this.bursts) {
      b.life -= dt;
      const p = b.pts.geometry.attributes.position;
      for (let i = 0; i < b.vel.length; i++) {
        b.vel[i].y -= 9 * dt;
        p.setXYZ(i, p.getX(i) + b.vel[i].x * dt, p.getY(i) + b.vel[i].y * dt, p.getZ(i) + b.vel[i].z * dt);
      }
      p.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, b.life / b.max);
    }
    for (const b of this.bursts.filter(b => b.life <= 0)) {
      this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose();
    }
    this.bursts = this.bursts.filter(b => b.life > 0);
  }
}
