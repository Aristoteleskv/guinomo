// Synchronized inauguration (3D): while the daily UTC alignment window is open
// and enough friends are present in the world, a golden celestial ring + beam
// rises above the meeting spot — the metaverse heartbeat made visible. The
// state machine is pure (src/core/worldCall.ts); this module only renders it,
// fed by the presence poller's `light_trail_update` events (no extra network).

import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import { events } from '../core/events';
import { getWorldId } from '../core/worlds';
import { meetingSpotFor, type LightTrailInfo } from '../core/friendsLight';
import { worldCallState } from '../core/worldCall';
import { isWorldAwakened } from '../core/worldAwakening';
import { clock } from '../engine/clock';
import { SceneModule } from './SceneModule';

const OUTER_RADIUS = 5.5;

export class WorldCallScene extends SceneModule {
  private group = new Group();
  private ringOuter!: Mesh;
  private ringInner!: Mesh;
  private beam!: Mesh;
  private online = 0;
  private world = getWorldId(new URLSearchParams(window.location.search).get('world'));

  protected init() {
    const spot = meetingSpotFor(this.world);

    const ringMaterial = new MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    this.ringOuter = new Mesh(new RingGeometry(OUTER_RADIUS * 0.86, OUTER_RADIUS, 48), ringMaterial);
    this.ringOuter.rotation.x = -Math.PI / 2;
    this.ringInner = new Mesh(new RingGeometry(OUTER_RADIUS * 0.6, OUTER_RADIUS * 0.71, 40), ringMaterial);
    this.ringInner.rotation.x = -Math.PI / 2;

    this.beam = new Mesh(
      new CylinderGeometry(0.35, 0.9, 10, 14, 1, true),
      new MeshBasicMaterial({
        color: '#ffe08a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.beam.position.y = 5;

    this.group.add(this.ringOuter, this.ringInner, this.beam);
    this.group.position.set(spot.x, 0, spot.z);
    this.group.visible = false;
    this.scene.add(this.group);

    events.on('light_trail_update', this.onTrail);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private onTrail = (info: LightTrailInfo) => {
    this.online = info.friends;
  };

  private update = () => {
    const state = worldCallState(new Date(), this.online, window.localStorage);
    this.group.visible = state.qualifies;
    if (!state.qualifies) return;

    const t = clock.time;
    const pulse = 0.9 + Math.sin(t * 1.8) * 0.1;
    // Awakened worlds (C7) hold a violet-gold alignment instead of the golden one.
    const awakened = isWorldAwakened();
    (this.ringOuter.material as MeshBasicMaterial).color.set(awakened ? '#e6c8ff' : '#ffd166');
    (this.ringInner.material as MeshBasicMaterial).color.set(awakened ? '#e6c8ff' : '#ffd166');
    (this.beam.material as MeshBasicMaterial).color.set(awakened ? '#f7e8ff' : '#ffe08a');
    (this.ringOuter.material as MeshBasicMaterial).opacity = 0.8 * pulse;
    (this.ringInner.material as MeshBasicMaterial).opacity = 0.6 * pulse;
    (this.beam.material as MeshBasicMaterial).opacity = 0.34 * pulse;
    this.ringOuter.rotation.z = t * 0.15;
    this.ringInner.rotation.z = -t * 0.22;
    this.beam.scale.set(1 + Math.sin(t * 2.2) * 0.08, 1, 1);
  };
}