import * as THREE from 'three';

// Hulpmiddelen om een eigen "inspecteer"-animatie (toets J) te bouwen uit bestaande poses.
// We nemen houdingen uit de animatie van het model (bijvoorbeeld "hand op de slede") en
// laten die vloeiend in elkaar overlopen, met extra sporen voor losse onderdelen.

const ease = t => t * t * (3 - 2 * t);                       // smoothstep
export const smooth = (t, a, b) => ease(THREE.MathUtils.clamp((t - a) / (b - a), 0, 1));

// waarde van een spoor op tijdstip t in de bronclip
function sample(track, t) {
  const interp = track.createInterpolant();
  return Array.from(interp.evaluate(t));
}

/**
 * Bouw een clip die per frame mengt tussen pose A en pose B.
 * - source: de volledige clip van het model
 * - tA, tB: tijdstippen (s) in de bronclip van de twee houdingen
 * - duration, fps
 * - weight(t): 0 = pose A, 1 = pose B
 * - useB(nodeName): welke onderdelen pose B volgen (de rest blijft in pose A)
 * - overrides: { 'node.property': (t, base) => nieuwe waarde (array) }
 */
export function buildPoseBlendClip({ source, tA, tB, duration, fps = 30, weight, useB, overrides = {}, name = 'inspect' }) {
  const n = Math.round(duration * fps) + 1;
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = i / fps;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const tracks = [];
  for (const tr of source.tracks) {
    const node = tr.name.split('.')[0];
    const a = sample(tr, tA);
    const b = useB(node) ? sample(tr, tB) : a;
    const size = a.length;
    const values = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      const t = times[i];
      const w = weight(t);
      let v;
      if (tr instanceof THREE.QuaternionKeyframeTrack) {
        qa.fromArray(a); qb.fromArray(b); qa.slerp(qb, w); v = qa.toArray();
      } else v = a.map((x, k) => x + (b[k] - x) * w);
      if (overrides[tr.name]) v = overrides[tr.name](t, v);
      values.set(v, i * size);
    }
    tracks.push(new tr.constructor(tr.name, times, values));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}
