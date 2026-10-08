// Sky dome: skydome.bin + a custom shader with flowmapped drifting clouds.
// Shader GLSL is verbatim from the original.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
} from 'three';
import { geometryLoader } from '../engine/loaders/geometries';
import { textureLoader } from '../engine/loaders/textures';
import { globalUBO } from '../engine/globals';
import { events } from '../core/events';
import { SceneModule } from './SceneModule';
import easesGLSL from './glsl/eases.glsl?raw';
import flowmapGLSL from './glsl/flowmap.glsl?raw';
import fitGLSL from './glsl/fit.glsl?raw';
import falloffGLSL from './glsl/falloff.glsl?raw';
import { globalUBODeclaration } from './materials';

export class Sky extends SceneModule {
  declare mesh: Mesh;
  private nightBlend = 0;
  private theme: 'cycle' | 'night' | 'alien' = 'cycle';
  private stars: Points | null = null;

  get nightIntensity(): number {
    return this.nightBlend;
  }

  get alienIntensity(): number {
    return this.theme === 'alien' ? 1 : 0;
  }

  protected async init() {
    const dome = await geometryLoader.load('skydome.bin');
    const material = new ShaderMaterial({
      uniformsGroups: [globalUBO],
      uniforms: {
        tMap: { value: textureLoader.load('sky-srgb-highq.png', 'srgb-repeat') },
        tFlow: { value: textureLoader.load('skyflow-highq.ktx2', 'repeat') },
        uColorHorizon: { value: new Color('#caf0fe') },
        uColorHorizonOverlay: { value: new Color('#d8eeff') },
        uColorSky: { value: new Color('#248fd5') },
        uColorClouds: { value: new Color('#ffe5c4') },
        uNightBlend: { value: 0 },
        uAlienBlend: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 wPos;

        void main() {
          vUv = uv;
          wPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tMap;
        uniform sampler2D tFlow;
        uniform vec3 uColorHorizon;
        uniform vec3 uColorHorizonOverlay;
        uniform vec3 uColorSky;
        uniform vec3 uColorClouds;
        uniform float uNightBlend;
        uniform float uAlienBlend;
        uniform vec3 uColorSun;
        varying vec2 vUv;
        varying vec3 wPos;

        ${globalUBODeclaration}
        ${easesGLSL}
        ${flowmapGLSL}
        ${fitGLSL}
        ${falloffGLSL}

        void main() {
          float limits = smoothstep(0.0, 0.025, vUv.y) * smoothstep(1.0, 1.0 - 0.025, vUv.y);
          float clouds = applyFlowmap(tMap, vUv * vec2(2.0, 1.0) + vec2(time * 0.001 + 0.135, 0.0), tFlow, vUv, 0.2, vec2(0.125, 0.075) * limits).r;

          vec3 dayHorizon = uColorHorizon;
          vec3 daySky = uColorSky;
          vec3 nightHorizon = vec3(0.018, 0.027, 0.08);
          vec3 nightSky = vec3(0.008, 0.014, 0.045);
          vec3 alienHorizon = vec3(0.12, 0.025, 0.24);
          vec3 alienSky = vec3(0.018, 0.16, 0.25);
          vec3 horizon = mix(mix(dayHorizon, nightHorizon, uNightBlend), alienHorizon, uAlienBlend);
          vec3 sky = mix(mix(daySky, nightSky, uNightBlend), alienSky, uAlienBlend);
          vec3 color = mix(horizon, sky, power1InOut(fit(wPos.y, -0.2, 0.35, 0.0, 1.0))); // horizon
          color = mix(color, uColorClouds, power2Out(clouds)); // clouds
          color = mix(color, uColorHorizonOverlay, fit(wPos.y, -0.04, 0.06, 1.0, 0.0)); // far horizon

          gl_FragColor.rgb = color;
          gl_FragColor.a = 1.0;
        }
      `,
      depthWrite: false,
    });

    this.mesh = new Mesh(dome, material);
    this.mesh.name = 'sky';
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.scale.setScalar(2);

    const starPositions = new Float32Array(420 * 3);
    for (let index = 0; index < 420; index++) {
      const offset = index * 3;
      const azimuth = Math.random() * Math.PI * 2;
      const elevation = Math.acos(2 * Math.random() - 1);
      const radius = 78 + Math.random() * 8;
      starPositions[offset] = radius * Math.sin(elevation) * Math.cos(azimuth);
      starPositions[offset + 1] = Math.abs(radius * Math.cos(elevation));
      starPositions[offset + 2] = radius * Math.sin(elevation) * Math.sin(azimuth);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
    const starMaterial = new PointsMaterial({
      color: '#c9ddff',
      size: 0.42,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.stars = new Points(starGeometry, starMaterial);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    const uniforms = material.uniforms;
    // the dome follows the camera
    this.scene.beforeRenderCbs.push(() => {
      this.mesh.position.copy(this.scene.camera.position);
      if (this.stars) this.stars.position.copy(this.scene.camera.position);
      if (this.theme === 'cycle') {
        const daylight = Math.max(0, Math.sin(performance.now() * (Math.PI * 2 / 240000) - Math.PI / 2));
        this.nightBlend = 1 - daylight;
      } else {
        this.nightBlend = this.theme === 'night' ? 1 : 0;
      }
      uniforms.uNightBlend.value = this.nightBlend;
      uniforms.uAlienBlend.value = this.theme === 'alien' ? 1 : 0;
      if (this.stars) (this.stars.material as PointsMaterial).opacity = this.theme === 'alien' ? 0.7 : this.nightBlend * 0.8;
    });

    events.on('webgl_sky_theme_cycle', () => {
      this.theme = this.theme === 'cycle' ? 'night' : this.theme === 'night' ? 'alien' : 'cycle';
    });

    this.scene.add(this.mesh);
    this.ready.resolve();
  }
}
