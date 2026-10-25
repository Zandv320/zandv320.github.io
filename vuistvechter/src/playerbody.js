import * as THREE from 'three';
import { loadGLTF, cloneCharacter, Locomotion } from './characters.js';

// Het lichaam van de speler in de wereld: als je naar beneden kijkt zie je je benen en voeten.
// Alles boven de heupen wordt weggevouwen (de armen zitten al in het viewmodel), zodat je niet
// tegen de binnenkant van je eigen romp aankijkt. Een tweede, onzichtbare kopie van het hele
// lichaam werpt wel een volledige schaduw.

const BACK = 0.15;     // heupen iets achter de camera

export class PlayerBody {
  constructor(scene) {
    this.scene = scene;
    this.ready = false;
    this.root = new THREE.Group();
    this.shadowRoot = new THREE.Group();
    scene.add(this.root, this.shadowRoot);
  }

  async load() {
    const gltf = await loadGLTF('models/player.glb');

    // zichtbare benen
    const { model, bones } = cloneCharacter(gltf);
    model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    this.root.add(model);
    this.loco = new Locomotion(model, gltf.animations);
    this.fold = bones.Spine;

    // schaduw van het hele lichaam: tekent niets, maar staat wel in de schaduwkaart
    const sh = cloneCharacter(gltf);
    const hide = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    sh.model.traverse(o => { if (o.isMesh) { o.material = hide; o.castShadow = true; o.receiveShadow = false; } });
    this.shadowRoot.add(sh.model);
    this.shadowLoco = new Locomotion(sh.model, gltf.animations);
    this.ready = true;
  }

  // feet: positie van de voeten; vel: wereldsnelheid; yaw: kijkrichting van de camera
  update(dt, feet, vel, yaw, airborne, visible = true) {
    if (!this.ready) return;
    const h = yaw + Math.PI;                       // model kijkt naar +z, camera naar -z
    const fx = Math.sin(h), fz = Math.cos(h);
    const vz = vel.x * fx + vel.z * fz;           // vooruit
    const vx = vel.x * -fz + vel.z * fx;          // naar rechts
    for (const [root, loco] of [[this.root, this.loco], [this.shadowRoot, this.shadowLoco]]) {
      root.position.set(feet.x - fx * BACK, feet.y, feet.z - fz * BACK);
      root.rotation.y = h;
      loco.update(dt, vx, vz, { airborne });
    }
    // na de animatie: bovenlijf wegvouwen
    this.fold.scale.setScalar(1e-4);
    this.root.visible = visible;
    this.shadowRoot.visible = visible;
  }
}
