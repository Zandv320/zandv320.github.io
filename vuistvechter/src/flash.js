import * as THREE from 'three';

// Mondingsflits op basis van Kenney's Particle Pack (CC0), vooraf ingekleurd van wit naar geel/oranje.
// Twee gekruiste vlakken langs de loop (de vlammenkegel die je van opzij ziet) plus een
// stervormige uitbarsting die naar de camera kijkt. Elk schot kiest een willekeurige variant,
// draaiing en lengte, zodat geen twee flitsen hetzelfde zijn. Herbruikbaar voor elk wapen.

const DIR = 'textures/fx/';
const loader = new THREE.TextureLoader();
let shared = null;
function textures() {
  if (shared) return shared;
  const load = f => { const t = loader.load(DIR + f); t.colorSpace = THREE.SRGBColorSpace; return t; };
  shared = {
    side: [1, 2, 3, 4, 5].map(i => load(`flash_side${i}.jpg`)),
    front: load('flash_front.jpg'),
  };
  return shared;
}

function additive(map) {
  return new THREE.MeshBasicMaterial({
    map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  });
}

export class MuzzleFlash {
  // axis: richting van de loop in de lokale ruimte van de ouder; unit: 1 meter in lokale eenheden
  constructor(axis, unit = 1, { length = 0.17, width = 0.11, front = 0.1 } = {}) {
    const tex = textures();
    this.tex = tex;
    this.group = new THREE.Group();
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    this.group.scale.setScalar(unit);
    this.group.visible = false;

    // kegel: onderkant van de textuur (het felle begin) op de vuurmond
    const geo = new THREE.PlaneGeometry(width, length);
    geo.translate(0, length * 0.36, 0);
    this.coneMat = additive(tex.side[0]);
    this.cones = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geo, this.coneMat);
      m.rotation.y = i * Math.PI / 2;
      m.renderOrder = 10;
      this.cones.add(m);
    }
    this.group.add(this.cones);

    const sm = new THREE.SpriteMaterial({ map: tex.front, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.star = new THREE.Sprite(sm);
    this.star.scale.setScalar(front);
    this.star.position.y = 0.01;
    this.star.renderOrder = 11;
    this.group.add(this.star);
    this.time = 0;
    this.dur = 0.05;
  }

  fire() {
    const t = this.tex;
    this.coneMat.map = t.side[(Math.random() * t.side.length) | 0];
    this.cones.rotation.y = Math.random() * Math.PI;
    const len = 0.75 + Math.random() * 0.5;
    this.cones.scale.set(0.85 + Math.random() * 0.3, len, 0.85 + Math.random() * 0.3);
    this.star.material.rotation = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.45;
    this.star.scale.setScalar(0.12 * s);
    this.coneMat.opacity = 1; this.star.material.opacity = 1;
    this.time = this.dur;
    this.group.visible = true;
  }

  update(dt) {
    if (this.time <= 0) return;
    this.time -= dt;
    // eerste frame vol, daarna snel weg
    const k = Math.max(0, this.time / this.dur);
    this.coneMat.opacity = k > 0.5 ? 1 : k * 2;
    this.star.material.opacity = this.coneMat.opacity;
    if (this.time <= 0) this.group.visible = false;
  }
}
