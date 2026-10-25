import * as THREE from 'three';

// Testkamer: een betonnen hal met trap, helling, kratten, richels en een stootzak.
// Elk vast object levert een "collider": een rechthoek op de vloer met een onderkant en een
// bovenkant (bij een helling is de bovenkant een functie van de positie).

const TEX = 'textures/';   // relatief aan de pagina
export const ROOM = 30;      // hal is ROOM x ROOM meter
export const ROOM_H = 6;

function loadSet(renderer, name, repeat = 1) {
  const L = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const set = {};
  for (const [key, file, srgb] of [['map', 'color', true], ['normalMap', 'normal', false], ['roughnessMap', 'rough', false]]) {
    const t = L.load(`${TEX}${name}_${file}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    set[key] = t;
  }
  return set;
}

// BoxGeometry met UV's in meters, zodat textuur op elk formaat even groot oogt
function boxGeo(w, h, d, texSize = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / texSize, uv.getY(k) * dims[f][1] / texSize);
    }
  }
  return g;
}

export function buildLevel(scene, renderer) {
  const colliders = [];
  const hittables = [];   // meshes die een stoot kunnen raken

  const concrete = loadSet(renderer, 'concrete');
  const planks = loadSet(renderer, 'planks');
  const floorMat = new THREE.MeshStandardMaterial({ ...concrete, color: 0x9a9a98, roughness: 1 });
  const wallMat = new THREE.MeshStandardMaterial({ ...concrete, color: 0xc9c6c0, roughness: 1 });
  const ceilMat = new THREE.MeshStandardMaterial({ ...concrete, color: 0x8a8680, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ ...planks, roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ ...planks, color: 0x8a6f58, roughness: 1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.55 });

  // --- vloer, plafond, muren ---
  const floor = new THREE.Mesh(boxGeo(ROOM, 0.2, ROOM, 3), floorMat);
  floor.position.y = -0.1; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(boxGeo(ROOM, 0.2, ROOM, 3), ceilMat);
  ceil.position.y = ROOM_H + 0.1; scene.add(ceil);
  const half = ROOM / 2;
  for (const [x, z, w, d] of [[0, -half - 0.25, ROOM + 1, 0.5], [0, half + 0.25, ROOM + 1, 0.5], [-half - 0.25, 0, 0.5, ROOM], [half + 0.25, 0, 0.5, ROOM]]) {
    const m = new THREE.Mesh(boxGeo(w, ROOM_H, d, 3), wallMat);
    m.position.set(x, ROOM_H / 2, z); m.receiveShadow = true; scene.add(m); hittables.push(m);
    const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.14, d + 0.02), trimMat);
    t.position.set(x, 0.07, z); scene.add(t);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: 0, top: ROOM_H + 5 });
  }

  // helper: massief blok met collider
  function block(x, y0, z, w, h, d, mat = woodMat, tex = 1.2) {
    const m = new THREE.Mesh(boxGeo(w, h, d, tex), mat);
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m); hittables.push(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y0, top: y0 + h });
    return m;
  }

  // --- trap naar een richel (linksachter) ---
  // richel 1,5 m hoog; vijf treden van 25 cm
  block(-10.5, 0, -12, 7, 1.5, 6, darkWood);
  for (let i = 0; i < 5; i++) {
    const top = 1.25 - i * 0.25;
    const z = -9 + 0.2 + i * 0.4;
    block(-12.5, 0, z, 3, top, 0.4, woodMat);
  }

  // --- helling naar een hoog plateau (rechtsachter) ---
  const rampTop = 2.4, rampLen = 9, rampW = 3.2;
  const rx0 = 8.4, rz0 = -2;             // voet van de helling (z = -2), loopt op richting -z
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(rampLen, 0); shape.lineTo(rampLen, rampTop); shape.lineTo(0, 0);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: rampW, bevelEnabled: false });
  // ExtrudeGeometry UV's zijn in shape-eenheden (meters); textuur 1,2 m groot maken
  const ruv = rg.attributes.uv;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) / 1.2, ruv.getY(i) / 1.2);
  const ramp = new THREE.Mesh(rg, woodMat);
  ramp.rotation.y = Math.PI / 2;          // shape-x wijst dan naar -z
  ramp.position.set(rx0 - rampW / 2, 0, rz0);
  ramp.castShadow = ramp.receiveShadow = true;
  scene.add(ramp); hittables.push(ramp);
  colliders.push({
    minX: rx0 - rampW / 2, maxX: rx0 + rampW / 2, minZ: rz0 - rampLen, maxZ: rz0, bottom: 0, top: rampTop,
    heightAt: (x, z) => THREE.MathUtils.clamp((rz0 - z) / rampLen, 0, 1) * rampTop,
  });
  block(rx0, 0, rz0 - rampLen - 2, 6, rampTop, 4, darkWood);   // plateau bovenaan
  block(rx0 - 4.5, 0, rz0 - rampLen - 2, 3, rampTop, 4, darkWood);

  // --- kratten: opstappen (30 cm), springen (60 cm), stapel (1 + 1 m) ---
  block(-2, 0, 2, 1.4, 0.3, 1.4);           // lage kist, kun je op stappen
  block(-4.5, 0, 2.5, 1.2, 0.6, 1.2);       // moet je op springen
  block(-6.5, 0, 1, 1, 1, 1);
  block(-6.5, 1, 1, 1, 1, 1);
  block(-7.6, 0, 1.2, 1, 1, 1);
  block(4, 0, 5, 1, 1, 1);
  block(5.2, 0, 5.3, 1, 1, 1);
  // los platform om op te springen vanaf de stapel
  block(-10, 1.9, 4, 2.5, 0.25, 2.5, darkWood);
  block(-10, 0, 4, 0.3, 1.9, 0.3, darkWood);

  // --- stootzak aan een balk ---
  const bag = buildBag(scene, darkWood, colliders, hittables);

  // --- licht ---
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x6e655a, 0.75));   // grondkleur = licht dat van de vloer terugkaatst naar het plafond
  const lamps = [[0, 0], [-8, -8], [8, -8], [-8, 8], [8, 8]];
  const shadowLights = [];
  lamps.forEach(([x, z], i) => {
    let l;
    if (i === 0) {
      // middelste lamp: spot recht omlaag (één schaduwkaart i.p.v. zes voor een puntlamp)
      l = new THREE.SpotLight(0xfff0d8, 80, 26, 1.35, 0.8, 1.6);
      l.target.position.set(x, 0, z); scene.add(l.target);
      l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0015; l.shadow.radius = 3;
      l.shadow.camera.near = 0.5; l.shadow.camera.far = 14;
    } else {
      // hoeklampen: brede spots recht naar beneden, met eigen (zachte) schaduw
      l = new THREE.SpotLight(0xfff0d8, 46, 24, 1.2, 0.75, 1.6);
      l.target.position.set(x, 0, z); scene.add(l.target);
      l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.0015; l.shadow.radius = 3;
      l.shadow.camera.near = 0.5; l.shadow.camera.far = 12;
    }
    l.position.set(x, ROOM_H - 0.4, z);
    shadowLights.push(l);
    scene.add(l);
    const fix = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
    fix.position.set(x, ROOM_H - 0.04, z); scene.add(fix);
  });

  // --- tafel met pistool en munitie bij het startpunt ---
  block(2.4, 0, 6.6, 1.6, 0.9, 0.8, darkWood);
  const pickupSpot = new THREE.Vector3(2.05, 0.93, 6.6);
  const ammoSpot = new THREE.Vector3(2.85, 0.9, 6.6);
  const ammo = buildAmmoBox(scene, ammoSpot);

  // --- schietbaan langs de rechtermuur ---
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8b04a });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 12), lineMat);
  line.rotation.x = -Math.PI / 2; line.position.set(4.5, 0.005, 8.5); scene.add(line);
  const targets = buildTargets(scene, hittables, colliders, [
    [14, 3], [14, 6.5], [14, 10], [14, 13.5], [10.5, 12.5], [9, 4],
  ]);

  // lage kwaliteit: alleen de middelste lamp werpt schaduw
  const setShadows = all => shadowLights.forEach((l, i) => { l.castShadow = i === 0 || all; });
  return { colliders, hittables, bag, targets, ammo, pickupSpot, spawn: new THREE.Vector3(0, 0, 9), setShadows };
}

// Stootzak als slinger: verplaatsing s (x,z) van het zwaartepunt met demping
function buildBag(scene, woodMat, colliders, hittables) {
  const X = 2.5, Z = -3, BEAM_Y = 2.9;
  // twee palen + balk
  const postMat = woodMat;
  for (const dx of [-1.3, 1.3]) {
    const p = new THREE.Mesh(boxGeo(0.25, BEAM_Y, 0.25, 1.2), postMat);
    p.position.set(X + dx, BEAM_Y / 2, Z); p.castShadow = true; scene.add(p);
    colliders.push({ minX: X + dx - 0.125, maxX: X + dx + 0.125, minZ: Z - 0.125, maxZ: Z + 0.125, bottom: 0, top: BEAM_Y });
  }
  const beam = new THREE.Mesh(boxGeo(2.85, 0.25, 0.25, 1.2), postMat);
  beam.position.set(X, BEAM_Y + 0.125, Z); beam.castShadow = true; scene.add(beam);
  colliders.push({ minX: X - 1.425, maxX: X + 1.425, minZ: Z - 0.125, maxZ: Z + 0.125, bottom: BEAM_Y, top: BEAM_Y + 0.25 });

  const pivot = new THREE.Group();
  pivot.position.set(X, BEAM_Y, Z);
  scene.add(pivot);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 }));
  chain.position.y = -0.225; pivot.add(chain);
  const leather = new THREE.MeshStandardMaterial({ color: 0x7a1f1a, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.25, 20), leather);
  body.position.y = -0.45 - 0.625; body.castShadow = true; pivot.add(body);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.6 });
  for (const y of [-0.45, -0.45 - 1.25]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.08, 20), capMat);
    c.position.y = y; pivot.add(c);
  }
  body.userData.bag = true;
  hittables.push(body);
  // speler kan niet door de zak lopen (rustpositie)
  colliders.push({ minX: X - 0.24, maxX: X + 0.24, minZ: Z - 0.24, maxZ: Z + 0.24, bottom: BEAM_Y - 1.7, top: BEAM_Y - 0.45 });

  const L = 1.1;                 // afstand ophangpunt tot zwaartepunt
  const s = new THREE.Vector2(), v = new THREE.Vector2();
  const axis = new THREE.Vector3();
  return {
    mesh: body,
    hit(dirX, dirZ, power) { v.x += dirX * power; v.y += dirZ * power; },
    update(dt) {
      const k = 9.81 / L;
      v.x += (-k * s.x - 1.2 * v.x) * dt;
      v.y += (-k * s.y - 1.2 * v.y) * dt;
      s.x += v.x * dt; s.y += v.y * dt;
      const len = Math.hypot(s.x, s.y);
      if (len < 1e-5) { pivot.quaternion.identity(); return; }
      axis.set(-s.y, 0, s.x).normalize();
      pivot.quaternion.setFromAxisAngle(axis, Math.min(len / L, 1.2));
    },
  };
}

// Munitiekist: blijft staan, vult je reservemunitie aan (opnieuw te gebruiken na 8 s)
function buildAmmoBox(scene, pos) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3f4a2e'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#e8d9a0'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('9 MM', 128, 66);
  g.strokeStyle = '#2a3120'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 116);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  const plain = new THREE.MeshStandardMaterial({ color: 0x3f4a2e, roughness: 0.7 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.24), [plain, plain, plain, plain, side, side]);
  box.position.copy(pos).add(new THREE.Vector3(0, 0.11, 0));
  box.rotation.y = 0.35;
  box.castShadow = true;
  scene.add(box);
  return { mesh: box, pos: box.position.clone(), cooldown: 0 };
}

// Doelwitten: schijf op een paal die achterover valt als je hem raakt en na 3 s weer opstaat
function buildTargets(scene, hittables, colliders, spots) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const rings = ['#f4efe6', '#b3261e', '#f4efe6', '#b3261e', '#f4efe6', '#b3261e'];
  rings.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(128, 128, 128 - i * 21, 0, Math.PI * 2); g.fill(); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const back = new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.6, roughness: 0.45 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3c3f, metalness: 0.5, roughness: 0.5 });

  const list = spots.map(([x, z]) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), postMat);
    base.position.set(x, 0.04, z); scene.add(base);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.08, z);
    pivot.rotation.order = 'YXZ';                 // eerst kantelen (lokaal), dan draaien
    pivot.rotation.y = -Math.PI / 2;             // schijf kijkt naar -x (naar het midden van de hal)
    scene.add(pivot);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), postMat);
    post.position.y = 0.55; pivot.add(post);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 32), [back, face, back]);
    plate.rotation.x = Math.PI / 2;               // platte kant naar +z (lokaal)
    plate.position.y = 1.35;
    plate.castShadow = true;
    pivot.add(plate);
    const t = { pivot, plate, down: false, angle: 0, vel: 0, timer: 0 };
    plate.userData.target = t;
    hittables.push(plate);
    colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25, bottom: 0, top: 0.08 });
    return t;
  });

  return {
    list,
    hits: 0,
    hit(t) {
      if (t.down) return false;
      t.down = true; t.timer = 3; t.vel = -9;
      this.hits++;
      return true;
    },
    update(dt) {
      for (const t of list) {
        if (t.down) {
          t.timer -= dt;
          if (t.timer <= 0) { t.down = false; t.vel = 3.5; }
        }
        const goal = t.down ? -Math.PI / 2 : 0;
        // val met zwaartekracht-achtige versnelling en een klein stuitertje
        t.vel += (goal - t.angle) * 60 * dt - t.vel * 6 * dt;
        t.angle += t.vel * dt;
        if (t.down && t.angle < goal) { t.angle = goal; t.vel = -t.vel * 0.25; }
        t.pivot.rotation.x = t.angle;
      }
    },
  };
}
