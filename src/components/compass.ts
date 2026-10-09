// Secret compass HUD: a floating needle that points at the current world's
// secret and hides once the player is within reach of it. Mounted by
// environmentScene via `mountCompass(scene)`.

import { Vector3 } from 'three';
import type { EnvironmentScene } from '../scene/environmentScene';
import './compass.css';

/** Distance (metres) under which the compass hides — the player has arrived. */
const HIDE_DISTANCE = 5;

export function mountCompass(scene: EnvironmentScene): void {
  let compass = document.getElementById('compass') as HTMLDivElement | null;
  if (!compass) {
    compass = document.createElement('div');
    compass.id = 'compass';
    compass.setAttribute('aria-hidden', 'true');

    const needle = document.createElement('div');
    needle.className = 'compass-needle';

    const label = document.createElement('div');
    label.className = 'compass-label';

    compass.append(needle, label);
    document.body.append(compass);
  }

  const needle = compass.querySelector<HTMLDivElement>('.compass-needle')!;
  const label = compass.querySelector<HTMLDivElement>('.compass-label')!;
  label.textContent = document.documentElement.lang.startsWith('en') ? 'Secret' : 'Segredo';

  const toTarget = new Vector3();
  const cameraForward = new Vector3();

  scene.beforeRenderCbs.push(() => {
    const local = scene.characters?.mesh?._localObject;
    const target = scene.worldLocations?.secretTargets?.[0];
    if (!local || !target) {
      compass.hidden = true;
      return;
    }

    // Player → target bearing, flattened to the XZ plane.
    toTarget.set(target.position.x - local.position.x, 0, target.position.z - local.position.z);
    const distance = toTarget.length();
    if (distance < HIDE_DISTANCE) {
      compass.hidden = true;
      return;
    }
    compass.hidden = false;
    toTarget.divideScalar(distance);

    // Camera facing on the XZ plane.
    scene.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() === 0) cameraForward.set(0, 0, -1);
    else cameraForward.normalize();

    // right = forward × up (three.js Y-up), so a positive angle is to the right.
    const rightX = -cameraForward.z;
    const rightZ = cameraForward.x;
    const ahead = toTarget.x * cameraForward.x + toTarget.z * cameraForward.z;
    const right = toTarget.x * rightX + toTarget.z * rightZ;
    const angle = Math.atan2(right, ahead) * (180 / Math.PI);

    needle.style.transform = `rotate(${angle}deg)`;
  });
}
