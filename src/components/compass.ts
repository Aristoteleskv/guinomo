// Secret compass HUD: a floating needle that points at the current world's
// secret and hides once the player is within reach of it. Once the local
// secret is found (or the world has none), the compass switches to "quest
// mode": the needle sways while guiding the player to the NEXT secret's world.
// Mounted by environmentScene via `mountCompass(scene)`.

import { Vector3 } from 'three';
import type { EnvironmentScene } from '../scene/environmentScene';
import {
  HIDE_DISTANCE,
  NEAR_PULSE_DISTANCE,
  questLabel,
  questWhisper,
  screenAngleTo,
  whisperForDistance,
} from '../core/compassGuidance';
import { isWorldSecretFound, nextSecretToFind } from '../core/secrets';
import { WORLDS } from '../core/worlds';
import './compass.css';

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

    const whisper = document.createElement('div');
    whisper.className = 'compass-whisper';

    compass.append(needle, label, whisper);
    document.body.append(compass);
  }

  const needle = compass.querySelector<HTMLDivElement>('.compass-needle')!;
  const label = compass.querySelector<HTMLDivElement>('.compass-label')!;
  const whisper = compass.querySelector<HTMLDivElement>('.compass-whisper')!;
  const english = document.documentElement.lang.startsWith('en');
  const baseLabel = english ? 'Secret' : 'Segredo';
  label.textContent = baseLabel;

  const toTarget = new Vector3();
  const cameraForward = new Vector3();
  let shownDistance = -1;
  let shownWhisper = '';
  let shownQuestWorld: string | null = null;

  scene.beforeRenderCbs.push(() => {
    const world = scene.worldLocations?.worldId;
    const local = scene.characters?.mesh?._localObject;
    const next = nextSecretToFind();
    if (!local || !next) {
      // No character yet, or the five secrets are all found (the Grand Secret
      // finale takes over the celebrations): nothing left to point at.
      compass.hidden = true;
      return;
    }

    if (!world || isWorldSecretFound(world)) {
      // Quest mode: the local secret is done (or this world has none), so the
      // compass points at the World Map button — the way to travel to the next
      // secret's world — instead of at a spot in this world.
      const destination = WORLDS.find((entry) => entry.id === next.world);
      const worldLabel = destination ? (english ? destination.label.en : destination.label.pt) : next.world;
      if (shownQuestWorld !== next.world) {
        shownQuestWorld = next.world;
        label.textContent = questLabel(destination?.icon ?? '🗺️', worldLabel, english);
        whisper.textContent = questWhisper(english);
        label.classList.remove('near');
        label.classList.add('quest');
      }
      needle.classList.add('quest');
      // Aim the needle at the World Map button in screen space so the player
      // sees *where* to go instead of a needle that just sways in place.
      const mapButton = document.querySelector<HTMLElement>('.map-button');
      let angle = 0;
      if (mapButton) {
        const needleBox = needle.getBoundingClientRect();
        const mapBox = mapButton.getBoundingClientRect();
        if (needleBox.width > 0 && mapBox.width > 0) {
          angle = screenAngleTo(
            { x: needleBox.left + needleBox.width / 2, y: needleBox.top + needleBox.height / 2 },
            { x: mapBox.left + mapBox.width / 2, y: mapBox.top + mapBox.height / 2 },
          );
        }
      }
      needle.style.transform = `rotate(${angle}deg)`;
      compass.hidden = false;
      return;
    }
    needle.classList.remove('quest');
    label.classList.remove('quest');

    const target = scene.worldLocations?.secretTargets?.[0];
    if (!target) {
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

    // Distance read-out: only touched in the DOM when the rounded value changes.
    const metres = Math.max(HIDE_DISTANCE, Math.round(distance));
    if (metres !== shownDistance) {
      shownDistance = metres;
      label.textContent = `${baseLabel} · ${metres} m`;
    }
    label.classList.toggle('near', distance <= NEAR_PULSE_DISTANCE);

    // Whisper: hints grow more precise as the player approaches the secret.
    const hint = whisperForDistance(distance, english);
    if (hint !== shownWhisper) {
      shownWhisper = hint;
      whisper.textContent = hint;
    }

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
