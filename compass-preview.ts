import { PerspectiveCamera, Vector3 } from 'three';
import { mountCompass } from './src/components/compass';

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, -1);
camera.updateMatrixWorld(true);

const player = { position: new Vector3(0, 0, 0) };
const scene = {
  beforeRenderCbs: [] as Array<() => void>,
  camera,
  characters: { mesh: { _localObject: player } },
  worldLocations: { secretTargets: [{ id: 'lobby', position: new Vector3(0, 0, -30) }] },
};

mountCompass(scene as never);

(window as any).__compass = {
  tick() {
    for (const cb of scene.beforeRenderCbs) cb();
    const el = document.getElementById('compass')!;
    const needle = document.querySelector<HTMLElement>('.compass-needle')!;
    return {
      exists: Boolean(el),
      label: document.querySelector('.compass-label')?.textContent ?? null,
      hidden: el.hidden,
      transform: needle.style.transform,
      cbs: scene.beforeRenderCbs.length,
    };
  },
  setTarget(x: number, z: number) {
    scene.worldLocations.secretTargets[0].position.set(x, 0, z);
  },
  setPlayer(x: number, z: number) {
    player.position.set(x, 0, z);
  },
  clearTarget() {
    (scene.worldLocations as any).secretTargets = [];
  },
};

const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;bottom:10px;left:10px;font:14px monospace;background:#fff;padding:6px';
hud.textContent = 'compass preview ready';
document.body.append(hud);
