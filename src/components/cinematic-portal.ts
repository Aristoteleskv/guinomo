import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  TorusGeometry,
  WebGLRenderer,
  MeshBasicMaterial,
} from 'three';

const DURATION = 4600;
const PARTICLE_COUNT = 900;

export function playCinematicPortal(host: HTMLElement): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'cinematic-portal';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x050713, 0);

  const scene = new Scene();
  scene.fog = new FogExp2('#11172f', 0.035);
  const camera = new PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 80);
  camera.position.z = 15;

  const vortex = new Mesh(
    new TorusGeometry(2.5, 0.13, 18, 120),
    new MeshStandardMaterial({
      color: '#1c4268',
      emissive: '#42dfff',
      emissiveIntensity: 1.15,
      metalness: 0.2,
      roughness: 0.32,
      transparent: true,
      opacity: 0.82,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  const innerRing = new Mesh(
    new TorusGeometry(1.86, 0.07, 14, 100),
    new MeshStandardMaterial({
      color: '#513376',
      emissive: '#bd77ff',
      emissiveIntensity: 1.05,
      metalness: 0.15,
      roughness: 0.36,
      transparent: true,
      opacity: 0.78,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  vortex.rotation.set(0.38, -0.24, 0);
  innerRing.rotation.set(-0.3, 0.2, 0.5);
  const rim = new Mesh(
    new TorusGeometry(3.1, 0.025, 8, 128),
    new MeshStandardMaterial({
      color: '#806a4a',
      emissive: '#ffe7a8',
      emissiveIntensity: 0.85,
      metalness: 0.1,
      roughness: 0.42,
      transparent: true,
      opacity: 0.58,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  rim.rotation.set(0.2, 0.34, -0.18);
  scene.add(vortex, innerRing, rim);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT * 4);
  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const offset = index * 4;
    seeds[offset] = Math.random() * Math.PI * 2;
    seeds[offset + 1] = Math.random() * 14 - 7;
    seeds[offset + 2] = Math.random();
    seeds[offset + 3] = Math.random();
  }
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64;
  spriteCanvas.height = 64;
  const spriteContext = spriteCanvas.getContext('2d');
  if (!spriteContext) throw new Error('Unable to create the Guinomo portal particle texture.');
  const glow = spriteContext.createRadialGradient(32, 32, 1, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.32, 'rgba(255,255,255,0.8)');
  glow.addColorStop(0.72, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  spriteContext.fillStyle = glow;
  spriteContext.fillRect(0, 0, 64, 64);
  const particleTexture = new CanvasTexture(spriteCanvas);
  const particleMaterial = new PointsMaterial({
    color: '#b8edff',
    size: 0.15,
    map: particleTexture,
    transparent: true,
    opacity: 0.88,
    alphaTest: 0.01,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  const particles = new Points(particleGeometry, particleMaterial);
  scene.add(particles);

  const haze = new Mesh(
    new TorusGeometry(2.25, 0.55, 10, 72),
    new MeshBasicMaterial({
      color: '#7678ff',
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  scene.add(haze);

  const cyanLight = new PointLight('#60e7ff', 30, 18);
  cyanLight.position.set(-3, 1.8, 1.5);
  const violetLight = new PointLight('#9c67ff', 34, 20);
  violetLight.position.set(3, -1.5, -2);
  scene.add(cyanLight, violetLight);

  const startedAt = performance.now();
  let animationFrame = 0;
  let finished = false;

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', resize, { passive: true });

  return new Promise((resolve) => {
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      vortex.geometry.dispose();
      innerRing.geometry.dispose();
      rim.geometry.dispose();
      haze.geometry.dispose();
      for (const object of [vortex, innerRing, rim, haze]) {
        (object.material as MeshStandardMaterial | MeshBasicMaterial).dispose();
      }
      canvas.classList.add('leaving');
      window.setTimeout(() => {
        canvas.remove();
        resolve();
      }, 500);
    };

    const render = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / DURATION);
      const ease = progress * progress * (3 - 2 * progress);
      camera.position.z = 15 - ease * 22;
      camera.position.x = Math.sin(progress * Math.PI * 2) * 0.18;
      camera.position.y = Math.cos(progress * Math.PI * 2) * 0.12;
      camera.lookAt(0, 0, 0);
      vortex.rotation.z = elapsed * 0.00024;
      innerRing.rotation.z = -elapsed * 0.00034;
      innerRing.rotation.x = -0.3 + Math.sin(elapsed * 0.0003) * 0.18;
      rim.rotation.z = elapsed * 0.00012;
      haze.rotation.z = -elapsed * 0.00017;
      haze.scale.setScalar(1 + Math.sin(elapsed * 0.002) * 0.035);
      cyanLight.position.x = Math.sin(elapsed * 0.0008) * 3;
      violetLight.position.y = Math.cos(elapsed * 0.0007) * 2;

      for (let index = 0; index < PARTICLE_COUNT; index++) {
        const seedOffset = index * 4;
        const angle = seeds[seedOffset] + elapsed * (0.00032 + seeds[seedOffset + 2] * 0.00048);
        const depth = seeds[seedOffset + 1];
        const radius = (0.28 + Math.abs(depth) * 0.24) * (0.72 + seeds[seedOffset + 3] * 0.48);
        const offset = index * 3;
        positions[offset] = Math.cos(angle + depth * 0.55) * radius;
        positions[offset + 1] = Math.sin(angle + depth * 0.55) * radius * 0.72;
        positions[offset + 2] = depth;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);

      if (elapsed >= DURATION) {
        finish();
        return;
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
  });
}
