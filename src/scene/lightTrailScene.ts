// Friends' light trail (3D): a winding chain of floating golden orbs linking
// the player to the world's meeting spot while a friend is online in the same
// world. Driven by `light_trail_update` events from the HUD presence poller;
// reaching the beacon emits `webgl_light_friend_reached`.

import { Group, Mesh, MeshBasicMaterial, PointLight, SphereGeometry, Vector3 } from 'three';
import { events } from '../core/events';
import { TRAIL_REACH_DISTANCE, type LightTrailInfo } from '../core/friendsLight';
import { clock } from '../engine/clock';
import { SceneModule } from './SceneModule';

const ORB_COUNT = 9;

export class LightTrailScene extends SceneModule {
  private group = new Group();
  private orbs: Mesh[] = [];
  private spot = { x: 0, z: 0 };
  private friendsCount = 0;
  private metSent = false;

  protected init() {
    const beacon = new Mesh(new SphereGeometry(0.6, 12, 10), new MeshBasicMaterial({ color: '#ffd166' }));
    beacon.position.set(0, 2.1, 0);
    this.group.add(beacon);

    const beaconLight = new PointLight('#ffc94d', 0.9, 26);
    beaconLight.position.set(0, 3.4, 0);
    this.group.add(beaconLight);

    const orbMaterial = new MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.85 });
    for (let i = 0; i < ORB_COUNT; i++) {
      const orb = new Mesh(new SphereGeometry(0.22, 8, 6), orbMaterial);
      this.orbs.push(orb);
      this.group.add(orb);
    }

    this.group.visible = false;
    this.scene.add(this.group);

    events.on('light_trail_update', this.onTrailUpdate);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private onTrailUpdate = (info: LightTrailInfo) => {
    if (info.visible) {
      this.spot = { x: info.spot.x, z: info.spot.z };
      this.repositionTrail();
      // Only a different crowd resets the reach latch, so the trail stays
      // claimable again when the player steps away and returns.
      if (info.friends !== this.friendsCount) {
        this.friendsCount = info.friends;
        this.metSent = false;
      }
    } else {
      this.friendsCount = 0;
      this.metSent = false;
    }
    this.group.visible = info.visible;
  };

  /** Trails the orbs from the player's spot toward the meeting spot. */
  private repositionTrail() {
    const local = this.scene.characters?.mesh?._localObject;
    if (!local) return;
    const start = new Vector3(local.position.x, 0, local.position.z);
    const end = new Vector3(this.spot.x, 0, this.spot.z);
    const delta = end.clone().sub(start);
    const distance = delta.length();
    if (distance < 0.01) return;
    const direction = delta.clone().divideScalar(distance);
    const perp = new Vector3(-direction.z, 0, direction.x);
    const amplitude = Math.min(5, distance * 0.22);
    for (let i = 0; i < this.orbs.length; i++) {
      const t = (i + 1) / (this.orbs.length + 1);
      const wobble = Math.sin(t * Math.PI) * amplitude;
      const orb = this.orbs[i];
      orb.position.set(
        start.x + direction.x * distance * t + perp.x * wobble,
        1.15 + Math.sin(i * 1.7 + this.friendsCount) * 0.18,
        start.z + direction.z * distance * t + perp.z * wobble,
      );
    }
  }

  private update = () => {
    if (!this.group.visible) return;

    const time = clock.time;
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      orb.scale.setScalar(0.85 + Math.sin(time * 2.4 + i * 0.9) * 0.18);
    }

    const local = this.scene.characters?.mesh?._localObject;
    if (!local) return;
    const dx = local.position.x - this.spot.x;
    const dz = local.position.z - this.spot.z;
    const reached = Math.hypot(dx, dz) < TRAIL_REACH_DISTANCE;
    if (reached && !this.metSent) {
      this.metSent = true;
      events.emit('webgl_light_friend_reached');
    } else if (!reached) {
      // Stepping away arms the latch again, so returning can claim another
      // friend's duo poster (once per friend per day).
      this.metSent = false;
    }
  };
}