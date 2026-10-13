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
import type { BloomConfig, GodRaysConfig, VignetteConfig } from '../core/postFxConfig';
import { BLOOM, GODRAYS, VIGNETTE } from '../core/postFxConfig';

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

export function createVignettePass(config: VignetteConfig = VIGNETTE): ShaderPass {
  const pass = new ShaderPass(VignetteShader);
  pass.uniforms.uOffset.value = config.offset;
  pass.uniforms.uDarkness.value = config.darkness;
  pass.uniforms.uGrain.value = config.grain;
  return pass;
}

/**
 * Screen-space sun shafts. Radial samples walk from each pixel toward `uSun`
 * (the sun's screen position, 0..1) and accumulate only the brightest pixels,
 * decaying along the way — the classic screen-space god-rays approximation.
 * `uVisible` fades the whole effect out at night or when the sun is behind the
 * camera, and the sample count is baked into the shader (GLSL1 needs constant
 * loops) so mobiles compile a cheaper variant.
 */
function godRaysFragment(samples: number): string {
  return /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSun;
    uniform float uVisible;
    uniform float uIntensity;
    uniform float uDensity;
    uniform float uDecay;
    uniform float uThreshold;
    varying vec2 vUv;

    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      if (uVisible <= 0.001) {
        gl_FragColor = vec4(base, 1.0);
        return;
      }

      vec2 delta = (uSun - vUv) * (uDensity / float(${samples}));
      vec2 coord = vUv;
      float decay = 1.0;
      float accumulation = 0.0;
      for (int i = 0; i < ${samples}; i++) {
        coord += delta;
        vec3 samp = texture2D(tDiffuse, coord).rgb;
        float bright = smoothstep(uThreshold, 1.0, max(max(samp.r, samp.g), samp.b));
        accumulation += bright * decay;
        decay *= uDecay;
      }
      accumulation /= float(${samples});

      vec3 shafts = uIntensity * uVisible * accumulation * vec3(1.0, 0.9, 0.74);
      gl_FragColor = vec4(min(base + shafts, vec3(1.0)), 1.0);
    }
  `;
}

export function createGodRaysPass(config: GodRaysConfig = GODRAYS): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uSun: { value: new Vector2(0.5, 0.5) },
      uVisible: { value: 0 },
      uIntensity: { value: config.intensity },
      uDensity: { value: config.density },
      uDecay: { value: config.decay },
      uThreshold: { value: config.threshold },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: godRaysFragment(config.samples),
  });
  return pass;
}
