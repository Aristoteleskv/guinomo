// Sky dome: skydome.bin + a custom shader with flowmapped drifting clouds.
// Shader GLSL is verbatim from the original.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  ShaderMaterial,
} from 'three';
import { geometryLoader } from '../engine/loaders/geometries';
import { textureLoader } from '../engine/loaders/textures';
import { globalUBO } from '../engine/globals';
import { events } from '../core/events';
import { getWorldId } from '../core/worlds';
import { SceneModule } from './SceneModule';
import easesGLSL from './glsl/eases.glsl?raw';
import flowmapGLSL from './glsl/flowmap.glsl?raw';
import fitGLSL from './glsl/fit.glsl?raw';
import falloffGLSL from './glsl/falloff.glsl?raw';
import { globalUBODeclaration } from './materials';

const DAY_NIGHT_PERIOD_MS = 240_000;

function createGlow(color: string, size: number): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required to render the sky glow.');

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `${color}cc`);
  gradient.addColorStop(0.2, `${color}66`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const sprite = new Sprite(new SpriteMaterial({
    map: new CanvasTexture(canvas),
    color,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

export class Sky extends SceneModule {
  declare mesh: Mesh;
  private nightBlend = 0;
  private theme: 'cycle' | 'night' | 'alien' = 'cycle';
  private stars: Points | null = null;
  private sun: Mesh | null = null;
  private sunGlow: Sprite | null = null;
  private moon: Mesh | null = null;
  private moonGlow: Sprite | null = null;

  get nightIntensity(): number {
    return this.nightBlend;
  }

  get alienIntensity(): number {
    return this.theme === 'alien' ? 1 : 0;
  }

  protected async init() {
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    const palette = world === 'floating-city'
      ? { horizon: '#b6d0d8', overlay: '#a2c6d2', sky: '#347a9e', clouds: '#c9e6e8' }
      : world === 'tropical-city'
        ? { horizon: '#f0c9a0', overlay: '#ffe0b0', sky: '#36a5a0', clouds: '#fff0cf' }
        : world === 'old-town'
          ? { horizon: '#e6cba8', overlay: '#e4c69e', sky: '#729bb0', clouds: '#f2dfc4' }
          : null;
    if (world === 'alien') {
      this.theme = 'alien';
    }

    const dome = await geometryLoader.load('skydome.bin');
    const material = new ShaderMaterial({
      uniformsGroups: [globalUBO],
      uniforms: {
        tMap: { value: textureLoader.load('sky-srgb-highq.png', 'srgb-repeat') },
        tFlow: { value: textureLoader.load('skyflow-highq.ktx2', 'repeat') },
        uColorHorizon: { value: new Color(palette?.horizon ?? '#caf0fe') },
        uColorHorizonOverlay: { value: new Color(palette?.overlay ?? '#d8eeff') },
        uColorSky: { value: new Color(palette?.sky ?? '#248fd5') },
        uColorClouds: { value: new Color(palette?.clouds ?? '#ffe5c4') },
        uNightBlend: { value: 0 },
        uAlienBlend: { value: 0 },
        uForestBlend: { value: world === 'forest' ? 1 : 0 },
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
        uniform float uForestBlend;
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

          vec3 dayHorizon = mix(uColorHorizon, vec3(0.66, 0.79, 0.61), uForestBlend);
          vec3 daySky = mix(uColorSky, vec3(0.12, 0.36, 0.29), uForestBlend);
          vec3 dayClouds = mix(uColorClouds, vec3(0.83, 0.87, 0.72), uForestBlend);
          vec3 horizonOverlay = mix(uColorHorizonOverlay, vec3(0.75, 0.82, 0.65), uForestBlend);
          vec3 nightHorizon = vec3(0.018, 0.027, 0.08);
          vec3 nightSky = vec3(0.008, 0.014, 0.045);
          vec3 alienHorizon = vec3(0.12, 0.025, 0.24);
          vec3 alienSky = vec3(0.018, 0.16, 0.25);
          vec3 horizon = mix(mix(dayHorizon, nightHorizon, uNightBlend), alienHorizon, uAlienBlend);
          vec3 sky = mix(mix(daySky, nightSky, uNightBlend), alienSky, uAlienBlend);
          vec3 color = mix(horizon, sky, power1InOut(fit(wPos.y, -0.2, 0.35, 0.0, 1.0))); // horizon
          color = mix(color, dayClouds, power2Out(clouds)); // clouds
          color = mix(color, horizonOverlay, fit(wPos.y, -0.04, 0.06, 1.0, 0.0)); // far horizon

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

    this.sun = new Mesh(
      new SphereGeometry(2.4, 20, 16),
      new MeshBasicMaterial({ color: '#ffe1a1', toneMapped: false }),
    );
    this.sun.name = 'daytime sun';
    this.sunGlow = createGlow('#ffc76d', 17);
    this.moon = new Mesh(
      new SphereGeometry(2.05, 20, 16),
      new MeshBasicMaterial({ color: '#e5e6d8', toneMapped: false }),
    );
    this.moon.name = 'nighttime moon';
    const craterMaterial = new MeshBasicMaterial({ color: '#b9bdba', toneMapped: false });
    for (const [x, y, size] of [[-0.62, 0.5, 0.32], [0.48, -0.2, 0.25], [-0.12, -0.74, 0.18]]) {
      const crater = new Mesh(new SphereGeometry(size, 10, 8), craterMaterial);
      const z = Math.sqrt(2.05 ** 2 - x ** 2 - y ** 2);
      crater.position.set(x, y, z);
      this.moon.add(crater);
    }
    this.moonGlow = createGlow('#d7e4ff', 12);
    this.scene.add(this.sun, this.sunGlow, this.moon, this.moonGlow);

    const uniforms = material.uniforms;
    this.scene.beforeRenderCbs.push(() => {
      const cameraPosition = this.scene.camera.position;
      this.mesh.position.copy(cameraPosition);
      if (this.stars) this.stars.position.copy(cameraPosition);
      const angle = (Date.now() % DAY_NIGHT_PERIOD_MS) / DAY_NIGHT_PERIOD_MS * Math.PI * 2;
      const sunHeight = Math.sin(angle);
      const daylightProgress = Math.min(1, Math.max(0, (sunHeight + 0.12) / 0.24));
      const daylight = daylightProgress * daylightProgress * (3 - 2 * daylightProgress);
      if (this.theme === 'cycle') {
        this.nightBlend = 1 - daylight;
      } else {
        this.nightBlend = this.theme === 'night' ? 1 : 0;
      }
      uniforms.uNightBlend.value = this.nightBlend;
      uniforms.uAlienBlend.value = this.theme === 'alien' ? 1 : 0;
      if (this.stars) (this.stars.material as PointsMaterial).opacity = this.theme === 'alien' ? 0.7 : this.nightBlend * 0.8;

      const distance = 88;
      const x = Math.cos(angle) * distance * 0.58;
      const y = Math.sin(angle) * distance * 0.58;
      this.sun?.position.set(cameraPosition.x + x, cameraPosition.y + y, cameraPosition.z - distance * 0.72);
      this.sunGlow?.position.copy(this.sun?.position ?? cameraPosition);
      this.moon?.position.set(cameraPosition.x - x, cameraPosition.y - y, cameraPosition.z - distance * 0.72);
      this.moonGlow?.position.copy(this.moon?.position ?? cameraPosition);
      const sunVisible = this.theme === 'cycle' && daylight > 0.12;
      const moonVisible = this.theme === 'night' || (this.theme === 'cycle' && daylight <= 0.5);
      if (this.sun) this.sun.visible = sunVisible;
      if (this.sunGlow) this.sunGlow.visible = sunVisible;
      if (this.moon) this.moon.visible = moonVisible;
      if (this.moonGlow) this.moonGlow.visible = moonVisible;
    });

    events.on('webgl_sky_theme_cycle', () => {
      this.theme = this.theme === 'cycle' ? 'night' : this.theme === 'night' ? 'alien' : 'cycle';
    });

    this.scene.add(this.mesh);
    this.ready.resolve();
  }
}
