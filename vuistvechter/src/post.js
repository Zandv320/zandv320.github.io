import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Nabewerking voor een realistischer beeld:
// - ambient occlusion (GTAO): contactschaduw in hoeken, onder kisten en tussen je vingers
// - bloom: felle lampen en de mondingsflits stralen een beetje uit
// - lens: lichte vignettering, een beetje kleurschifting aan de randen en filmkorrel
// Drie standen (instelling): hoog = alles, gemiddeld = zonder AO, laag = direct tekenen.

const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, grain: { value: 0.035 }, aberration: { value: 0.0015 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, aberration; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 61.7) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * aberration * (1.0 + r2 * 4.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c *= 1.0 - vignette * smoothstep(0.08, 0.55, r2);
      c += (hash(vUv * 1000.0) - 0.5) * grain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.quality = 'hoog';
    this.composer = null;
  }

  build(w, h) {
    this.composer?.dispose?.();
    this.composer = null;
    if (this.quality === 'laag') return;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(this.renderer, rt);
    c.setPixelRatio(this.renderer.getPixelRatio());
    c.setSize(w, h);
    c.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality === 'hoog') {
      const ao = new GTAOPass(this.scene, this.camera, w, h);
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      c.addPass(ao);
      this.ao = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.45, 0.9);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.lens = new ShaderPass(LensShader);
    c.addPass(this.lens);
    this.composer = c;
    this.w = w; this.h = h;
  }

  setQuality(q, w, h) { this.quality = q; this.build(w, h); }
  setSize(w, h) { if (!this.composer || w !== this.w || h !== this.h) this.build(w, h); }

  render(dt, extraVignette = 0) {
    if (!this.composer) { this.renderer.render(this.scene, this.camera); return; }
    this.lens.uniforms.time.value = (this.lens.uniforms.time.value + dt) % 100;
    this.lens.uniforms.vignette.value = 0.32 + extraVignette;
    this.composer.render(dt);
  }
}
