/* Eldoria – the look of a particle of light, shared by every point cloud that glows: the sparks of hits and spells
   (particles.js), an enchantment's particles (weapon-fx.js), fireflies and glints on the water (ambience.js) and the
   embers over the lava (ember.js). Not a square pixel but soft light: a round glow fading from a white-hot heart, or
   a four-pointed sparkle. */
import * as THREE from "three";

/** GLSL: how bright a point is at `coord` (gl_PointCoord); `star` 0 for a round glow, 1 for a sparkle. */
export const GLOW_SHAPE = /* glsl */ `
  float glowShape(vec2 coord, float star) {
    vec2 p = coord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float disc = exp(-r2 * 4.5);
    float rays = max(
      exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.2),
      exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.2)
    );
    float sparkle = max(rays, exp(-r2 * 18.0)) * smoothstep(1.0, 0.6, sqrt(r2));
    return mix(disc, sparkle, star);
  }
  /* the colour of a point of that brightness: its own colour, going white where it is brightest */
  vec3 glowColor(vec3 color, float light) {
    return color * light + vec3(pow(light, 4.0) * 0.45 * max(color.r, max(color.g, color.b)));
  }
`;

/* a soft glow fills less of its square than a pixel does: points grow this much to read as bright */
const GROWTH = 2.4;

/**
 * Turns a PointsMaterial into glowing points (in place; returns it): every point drawn as glowShape, `star` of the
 * way to a sparkle, and `growth` times its size. Meant for additive, depth-write-free materials.
 */
export function glowPoints(material, { star = 0, growth = GROWTH } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "gl_PointSize = size;",
      `gl_PointSize = size * ${growth.toFixed(2)};`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `${GLOW_SHAPE}\nvoid main() {`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float light = glowShape(gl_PointCoord, ${star.toFixed(2)});
          if (light < 0.01) {
            discard;
          }
          diffuseColor.rgb = glowColor(diffuseColor.rgb, light);
          diffuseColor.a *= min(1.0, light * 1.5);
        }`,
      );
  };
  material.customProgramCacheKey = () => `glow-points-${star}-${growth}`;
  return material;
}

/** A PointsMaterial of glowing points: additive, drawn over the night haze's level of brightness. */
export const glowPointsMaterial = (options = {}, glow = {}) =>
  glowPoints(
    new THREE.PointsMaterial({
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...options,
    }),
    glow,
  );
