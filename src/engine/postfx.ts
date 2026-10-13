// Extra post-processing for the main composer: a soft bloom and a film
// vignette (with an optional, very subtle grain). The composer already runs
// RenderPass → SMAA → Gamma (see engine/globals.ts); bloom slots in right after
// the render pass and the vignette just before gamma correction.
//
// Pure, testable tuning lives in BLOOM/VIGNETTE/bloomConfigFor; the pass
// objects themselves are built here so the engine only wires them.

import { Vector2 } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { BloomConfig } from '../core/postFxConfig';
import { BLOOM, VIGNETTE } from '../core/postFxConfig';

export function createBloomPass(resolution: Vector2, config: BloomConfig = BLOOM): UnrealBloomPass {
  return new UnrealBloomPass(resolution, config.strength, config.radius, config.threshold);
}

/**
 * Vignette + grain. Offsets the uv from the centre, mixes toward black by the
 * squared radial distance (classic three vignette), then adds a per-frame,
 * time-seeded grain of `uGrain` amplitude.
 */
export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: VIGNETTE.offset },
    uDarkness: { value: VIGNETTE.darkness },
    uGrain: { value: VIGNETTE.grain },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uDarkness;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 radial = (vUv - 0.5) * uOffset;
      vec3 color = mix(texel.rgb, vec3(1.0 - uDarkness), dot(radial, radial));
      float t = fract(uTime * 0.5) * 97.0;
      color += (hash(vUv * 1024.0 + t) - 0.5) * uGrain;
      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export function createVignettePass(): ShaderPass {
  return new ShaderPass(VignetteShader);
}
