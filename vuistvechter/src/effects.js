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

  muzzleLight(pos) {
    this.light.position.copy(pos);
    this.light.intensity = 6;
    this.lightTime = 0.05;
  }

  update(dt) {
    if (this.lightTime > 0) { this.lightTime -= dt; if (this.lightTime <= 0) this.light.intensity = 0; }
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
