import * as THREE from 'three';

(() => {
  // ---------- Config ----------
  const ROOM = 20;          // room is ROOM x ROOM metres
  const WALL_H = 4;
  const EYE = 1.7;
  const RADIUS = 0.35;      // player collision radius
  const WALK = 4.2, SPRINT = 7, JUMP = 5, GRAVITY = 14;

  // ---------- Renderer / scene ----------
  const host = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f12);
  scene.fog = new THREE.Fog(0x0d0f12, 18, 40);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, EYE, 0);
  scene.add(camera);

  // ---------- Textures (canvas, so no external files) ----------
  function gridTexture(base, line, cells, repeat) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    // subtle noise
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    g.strokeStyle = line; g.lineWidth = 3;
    const s = 256 / cells;
    for (let i = 0; i <= cells; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  // ---------- Room ----------
  const floorMat = new THREE.MeshStandardMaterial({ map: gridTexture('#3b3f45', '#2a2d31', 2, [ROOM / 2, ROOM / 2]), roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 1 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; scene.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ map: gridTexture('#6b6e72', '#585b5f', 1, [ROOM / 2, WALL_H / 2]), roughness: 0.85 });
  const walls = [
    [0, -ROOM / 2, 0], [0, ROOM / 2, Math.PI], [-ROOM / 2, 0, Math.PI / 2], [ROOM / 2, 0, -Math.PI / 2],
  ];
  for (const [x, z, ry] of walls) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, WALL_H), wallMat);
    w.position.set(x, WALL_H / 2, z); w.rotation.y = ry; w.receiveShadow = true; scene.add(w);
  }
  // baseboard strip, so the walls read as walls
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.6 });
  for (const [x, z, ry] of walls) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(ROOM, 0.15, 0.04), trimMat);
    t.position.set(x, 0.075, z); t.rotation.y = ry;
    t.translateZ(0.02); scene.add(t);
  }

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x2a2622, 0.55));
  const lamp = new THREE.PointLight(0xfff1d6, 60, 30, 1.6);
  lamp.position.set(0, WALL_H - 0.3, 0); lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.4), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  bulb.position.set(0, WALL_H - 0.03, 0); scene.add(bulb);

  // ---------- Fists (attached to camera) ----------
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98f6b, roughness: 0.7 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2f3a46, roughness: 0.9 });

  function makeFist(side) {
    const arm = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.55, 12), sleeve);
    forearm.rotation.x = Math.PI / 2; forearm.position.z = 0.3; arm.add(forearm);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.08, 12), skin);
    wrist.rotation.x = Math.PI / 2; wrist.position.z = 0.0; arm.add(wrist);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.13), skin);
    hand.position.z = -0.08; arm.add(hand);
    // four knuckles
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), skin);
      k.position.set(-0.045 + i * 0.03, 0.035, -0.145); arm.add(k);
    }
    // thumb tucked over the front
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.035), skin);
    thumb.position.set(side * 0.02, -0.035, -0.13); arm.add(thumb);
    arm.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return arm;
  }
  const fists = [-1, 1].map(side => {
    const f = makeFist(side);
    const rest = new THREE.Vector3(side * 0.24, -0.26, -0.42);
    f.position.copy(rest);
    f.rotation.set(0.15, side * -0.12, side * 0.2);
    camera.add(f);
    return { mesh: f, side, rest, t: 1 }; // t: punch progress 0..1 (1 = idle)
  });

  // ---------- Input ----------
  const keys = {};
  addEventListener('keydown', e => { keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });

  let yaw = 0, pitch = 0, locked = false;
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  function requestLock() {
    try {
      const p = renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }
  overlay.addEventListener('click', requestLock);
  startBtn.addEventListener('click', e => { e.stopPropagation(); requestLock(); });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === renderer.domElement;
    overlay.hidden = locked;
    if (!locked) for (const k in keys) keys[k] = false;
  });
  addEventListener('mousemove', e => {
    if (!locked) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
  });

  let nextFist = 0, punchCooldown = 0;
  addEventListener('mousedown', e => {
    if (!locked || e.button !== 0 || punchCooldown > 0) return;
    const f = fists[nextFist];
    if (f.t < 1) return;
    f.t = 0; nextFist = 1 - nextFist; punchCooldown = 0.18;
  });

  // ---------- Player ----------
  const vel = new THREE.Vector3();
  let onGround = true, bob = 0;

  function update(dt) {
    camera.rotation.set(pitch, yaw, 0);

    // movement on the XZ plane relative to view yaw
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const speed = keys.ShiftLeft || keys.ShiftRight ? SPRINT : WALK;
    const dir = new THREE.Vector3(
      str * Math.cos(yaw) - fwd * Math.sin(yaw), 0,
      -str * Math.sin(yaw) - fwd * Math.cos(yaw)
    );
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed);
    const accel = onGround ? 12 : 3;
    vel.x += (dir.x - vel.x) * Math.min(1, accel * dt);
    vel.z += (dir.z - vel.z) * Math.min(1, accel * dt);

    if (keys.Space && onGround) { vel.y = JUMP; onGround = false; }
    vel.y -= GRAVITY * dt;

    const p = camera.position;
    p.x += vel.x * dt; p.z += vel.z * dt; p.y += vel.y * dt;

    // walls
    const lim = ROOM / 2 - RADIUS;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
    // floor / ceiling
    if (p.y <= EYE) { p.y = EYE; vel.y = 0; onGround = true; }
    if (p.y > WALL_H - 0.15) { p.y = WALL_H - 0.15; vel.y = Math.min(0, vel.y); }

    // head bob + fist sway
    const hSpeed = Math.hypot(vel.x, vel.z);
    if (onGround && hSpeed > 0.5) bob += dt * hSpeed * 2.2; else bob *= 0.9;
    const bobY = Math.sin(bob * 2) * 0.012 * Math.min(1, hSpeed / WALK);
    const bobX = Math.cos(bob) * 0.012 * Math.min(1, hSpeed / WALK);

    punchCooldown = Math.max(0, punchCooldown - dt);
    for (const f of fists) {
      let ext = 0;
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / 0.28);
        // fast out, slower back
        ext = f.t < 0.35 ? Math.sin((f.t / 0.35) * Math.PI / 2) : Math.cos(((f.t - 0.35) / 0.65) * Math.PI / 2);
      }
      f.mesh.position.set(
        f.rest.x - f.side * 0.16 * ext + bobX,
        f.rest.y + 0.1 * ext + bobY * (f.side > 0 ? 1 : -1) + bobY,
        f.rest.z - 0.38 * ext
      );
      f.mesh.rotation.z = f.side * 0.2 * (1 - ext) + f.side * -0.6 * ext;
      f.mesh.rotation.y = f.side * -0.12 * (1 - ext);
    }
  }

  // ---------- Loop ----------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (locked) update(dt); else camera.rotation.set(pitch, yaw, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
