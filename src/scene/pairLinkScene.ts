// "Par Extraordinário" (3D): a golden link that forms between the local player
// and a remote player who stay close together in the same world. The pair
// state machine is pure (`src/core/extraordinaryPair.ts`); this module renders
// the charging line + aura rings and emits the `webgl_pair_*` events on
// transitions.

import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { events } from '../core/events';
import { advancePair, NO_PAIR, pairFriendKey, type PairState } from '../core/extraordinaryPair';
import { clock } from '../engine/clock';
import { SceneModule } from './SceneModule';

const LINK_POINTS = 9;
const LINK_HEIGHT = 1.05;

interface PairTarget {
  id: string;
  uid: number;
  name: string | null;
}

interface NearestRemote {
  id: string;
  uid: number;
  name: string | null;
  x: number;
  z: number;
  distance: number;
}

export class PairLinkScene extends SceneModule {
  private group = new Group();
  private line!: Line;
  private orb!: Mesh;
  private ringLocal!: Mesh;
  private ringRemote!: Mesh;
  private linePoints!: Float32Array;
  private state: PairState = NO_PAIR;
  private linked: string | null = null;
  private remoteX = 0;
  private remoteZ = 0;
  private notifiedName: string | null = null;

  protected init() {
    this.linePoints = new Float32Array(LINK_POINTS * 3);
    this.line = new Line(
      new BufferGeometry().setAttribute('position', new Float32BufferAttribute(this.linePoints, 3)),
      new LineBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0 }),
    );
    this.line.frustumCulled = false;

    this.orb = new Mesh(
      new SphereGeometry(0.18, 10, 8),
      new MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0 }),
    );

    const ringMaterial = new MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
    });
    this.ringLocal = new Mesh(new RingGeometry(1, 1.35, 32), ringMaterial);
    this.ringLocal.rotation.x = -Math.PI / 2;
    this.ringRemote = new Mesh(new RingGeometry(1, 1.35, 32), ringMaterial);
    this.ringRemote.rotation.x = -Math.PI / 2;

    this.group.add(this.line, this.orb, this.ringLocal, this.ringRemote);
    this.group.visible = false;
    this.scene.add(this.group);

    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private findNearest(): NearestRemote | null {
    const mesh = this.scene.characters?.mesh;
    const local = mesh?._localObject;
    if (!mesh || !local) return null;
    let best: NearestRemote | null = null;
    const x = local.position.x;
    const z = local.position.z;
    mesh._charactersObjects.forEach((remote, id) => {
      if (id === 'local') return;
      const distance = Math.hypot(remote.position.x - x, remote.position.z - z);
      if (!best || distance < best.distance) {
        best = {
          id,
          uid: remote.userData.uid || 0,
          name:
            typeof remote.userData.name === 'string' && remote.userData.name ? remote.userData.name : null,
          x: remote.position.x,
          z: remote.position.z,
          distance,
        };
      }
    });
    return best;
  }

  private update = () => {
    const mesh = this.scene.characters?.mesh;
    const local = mesh?._localObject;
    if (!mesh || !local) {
      // Characters not ready (yet) — nothing to pair with.
      if (this.state.phase !== 'none' || this.linked) this.applyState(NO_PAIR, null);
      return;
    }
    const dt = Math.min(0.25, clock.delta / 1000);

    if (this.state.phase === 'linked' && this.linked) {
      const remote = mesh._charactersObjects.get(this.linked);
      if (!remote) {
        this.applyState(NO_PAIR, null);
        return;
      }
      const uid = remote.userData.uid || 0;
      const name =
        typeof remote.userData.name === 'string' && remote.userData.name ? remote.userData.name : null;
      const key = pairFriendKey(uid, this.linked);
      const distance = Math.hypot(remote.position.x - local.position.x, remote.position.z - local.position.z);
      this.remoteX = remote.position.x;
      this.remoteZ = remote.position.z;
      this.applyState(advancePair(this.state, distance, dt, key), { id: this.linked, uid, name });
      return;
    }

    const nearest = this.findNearest();
    if (!nearest) {
      if (this.state.phase !== 'none' || this.linked) this.applyState(NO_PAIR, null);
      return;
    }
    this.remoteX = nearest.x;
    this.remoteZ = nearest.z;
    const key = pairFriendKey(nearest.uid, nearest.id);
    this.applyState(advancePair(this.state, nearest.distance, dt, key), {
      id: nearest.id,
      uid: nearest.uid,
      name: nearest.name,
    });
  };

  private applyState(next: PairState, target: PairTarget | null) {
    const previous = this.state;
    this.state = next;
    this.linked = next.phase === 'linked' && target ? target.id : null;

    // A pair formed: the HUD claims the daily reward and toasts it.
    if (next.phase === 'linked' && previous.phase !== 'linked' && target) {
      events.emit('webgl_pair_linked', {
        uid: target.uid,
        name: target.name,
        clientId: target.id,
        friendKey: next.friendKey,
      });
      this.notifiedName = target.name;
      events.emit('webgl_pair_state', { active: true, name: target.name });
    } else if (previous.phase === 'linked' && next.phase !== 'linked') {
      this.notifiedName = null;
      events.emit('webgl_pair_state', { active: false, name: null });
    } else if (next.phase === 'linked' && target && target.name && target.name !== this.notifiedName) {
      // The avatar name can arrive right after the link forms — refresh the chip.
      this.notifiedName = target.name;
      events.emit('webgl_pair_state', { active: true, name: target.name });
    }

    this.renderVisual(clock.time);
  }

  private renderVisual(time: number) {
    const mesh = this.scene.characters?.mesh;
    const local = mesh?._localObject;
    const visible = this.state.phase !== 'none' && Boolean(local);
    this.group.visible = visible;
    if (!visible || !local) return;

    const warming = this.state.phase === 'warming';
    const progress = warming ? this.state.progress : 1;
    const pulse = 0.92 + Math.sin(time * 5) * 0.08;

    const material = this.line.material as LineBasicMaterial;
    const x0 = local.position.x;
    const z0 = local.position.z;
    const x1 = this.remoteX;
    const z1 = this.remoteZ;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    material.opacity = length < 0.01 ? 0 : warming ? 0.18 + 0.55 * progress : 0.95 * pulse;

    const positions = this.linePoints;
    for (let i = 0; i < LINK_POINTS; i++) {
      const t = i / (LINK_POINTS - 1);
      positions[i * 3] = x0 + dx * t;
      positions[i * 3 + 1] = LINK_HEIGHT + Math.sin(t * Math.PI) * 0.35 + Math.sin(time * 2.5 + t * 4) * 0.06;
      positions[i * 3 + 2] = z0 + dz * t;
    }
    this.line.geometry.attributes.position.needsUpdate = true;

    // Midpoint glow orb.
    const orbMaterial = this.orb.material as MeshBasicMaterial;
    orbMaterial.opacity = warming ? 0.25 + 0.5 * progress : 0.95 * pulse;
    this.orb.position.set((x0 + x1) / 2, LINK_HEIGHT + 0.15, (z0 + z1) / 2);
    this.orb.scale.setScalar(0.8 + Math.sin(time * 6) * 0.25);

    // Aura rings under both players.
    const ringMaterial = this.ringLocal.material as MeshBasicMaterial;
    ringMaterial.opacity = warming ? 0.2 + 0.35 * progress : 0.5 * pulse;
    this.ringLocal.position.set(x0, 0.06, z0);
    this.ringRemote.position.set(x1, 0.06, z1);
    this.ringLocal.scale.setScalar(1 + Math.sin(time * 4) * 0.05);
    this.ringRemote.scale.setScalar(1 + Math.sin(time * 4 + 1.7) * 0.05);
  }
}
