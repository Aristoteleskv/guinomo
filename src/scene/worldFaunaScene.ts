// World fauna (3D): deterministic creatures rendered as additive points — the
// same at the same instant for every player (src/core/worldFauna.ts). Each
// world has its own species; during the world's daily event the fauna
// brightens and enlarges, so the deterministic calendar visibly moves the 3D
// world (bridge to the "ocean reacts to the tide" idea).

import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial } from 'three';
import { getWorldId } from '../core/worlds';
import { faunaFor, writeFaunaPositions } from '../core/worldFauna';
import { minutesOf, worldEvent } from '../core/worldRhythm';
import { SceneModule } from './SceneModule';

/** Fauna opacity while the world's daily event is not running. */
const IDLE_OPACITY = 0.55;

/** Fauna opacity during the world's daily event. */
const EVENT_OPACITY = 0.95;

/** Size multiplier applied while the world's daily event is running. */
const EVENT_SIZE_MULTIPLIER = 1.25;

export class WorldFaunaScene extends SceneModule {
  private world = getWorldId(new URLSearchParams(window.location.search).get('world'));
  private points: Points | null = null;
  private material: PointsMaterial | null = null;

  protected init() {
    const config = faunaFor(this.world);
    if (!config) {
      this.ready.resolve();
      return;
    }

    const positions = new Float32Array(config.count * 3);
    writeFaunaPositions(this.world, Date.now() / 1000, positions);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    const colors = new Float32Array(config.count * 3);
    const color = new Color(config.color);
    for (let i = 0; i < config.count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));

    this.material = new PointsMaterial({
      size: config.size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: IDLE_OPACITY,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(geometry, this.material);
    this.scene.add(this.points);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private update = () => {
    if (!this.points || !this.material) return;
    const config = faunaFor(this.world);
    if (!config) return;

    // Same unix seconds for everyone ⇒ identical world on every device.
    const now = Date.now() / 1000;
    writeFaunaPositions(this.world, now, (this.points.geometry.getAttribute('position') as BufferAttribute).array as Float32Array);
    (this.points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;

    // The deterministic calendar drives the ambience density.
    const active = worldEvent(this.world, minutesOf(new Date()));
    this.material.opacity = active ? EVENT_OPACITY : IDLE_OPACITY;
    this.material.size = config.size * (active ? EVENT_SIZE_MULTIPLIER : 1);
  };
}