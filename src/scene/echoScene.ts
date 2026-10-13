// "Espectros" (3D): translucent ghosts replaying the last path a friend walked
// in this world. While a peer is present we record their track
// (src/core/presenceEcho.ts); when they drop from the P2P room, we release the
// looped ghost with the friend's name floating above it. Ghosts also persist
// per world (`guinomo.ghosts.v1`), so the next visit replays who was here
// before you. Never touches the character mesh — echoes are pure light.

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { showToast } from '../components/toast';
import { getWorldId } from '../core/worlds';
import {
  EchoRecorder,
  ghostPosition,
  restoreTracks,
  saveGhosts,
  type GhostTrack,
} from '../core/presenceEcho';
import { SceneModule } from './SceneModule';

/** Height of the ghost path line above the floor. */
const LINE_Y = 0.55;
/** Height of the travelling glow orb. */
const ORB_HEIGHT = 1.0;
/** Max live ghosts — echoes are limited so the scene stays light. */
const MAX_LIVE_GHOSTS = 3;

const GHOST_LINE = '#a5d8ff';
const GHOST_ORB = '#c7e6ff';

interface EchoVisual {
  track: GhostTrack;
  group: Group;
  line: Line;
  orb: Mesh;
  ring: Mesh;
  sprite: Sprite;
}

function uiLanguage(): string {
  return typeof window !== 'undefined' && window.GUINOMO_PROFILE?.language
    ? window.GUINOMO_PROFILE.language
    : document.documentElement.lang.slice(0, 2);
}

export class EchoScene extends SceneModule {
  private recorder = new EchoRecorder();
  private visuals: EchoVisual[] = [];
  private world = getWorldId(new URLSearchParams(window.location.search).get('world'));

  protected init() {
    // Ghosts left by previous visits are stored per world — replay them now.
    const stored = restoreTracks(this.world, window.localStorage);
    for (const track of stored.slice(-MAX_LIVE_GHOSTS)) {
      track.bornAt = Date.now();
      this.spawn(track, false);
    }

    this.scene.beforeRenderCbs.push(this.update);
    window.addEventListener('pagehide', this.flush);
    this.ready.resolve();
  }

  /** Before leaving, keep the current tracks as next visit's ghosts. */
  private flush = () => {
    saveGhosts(this.world, this.recorder.finalizeAll(Date.now()), window.localStorage);
  };

  private update = () => {
    const now = Date.now();
    const mesh = this.scene.characters?.mesh;

    if (mesh) {
      // Record every peer currently in the world (their own published position).
      mesh._charactersObjects.forEach((remote, id) => {
        if (id === 'local') return;
        const position = remote.position;
        this.recorder.observe(
          id,
          remote.userData.uid || 0,
          typeof remote.userData.name === 'string' && remote.userData.name ? remote.userData.name : null,
          { x: position.x, y: position.y, z: position.z },
          now,
        );
      });
      // Peers we were recording but that are gone → release their ghost.
      for (const id of this.recorder.activeIds()) {
        if (!mesh._charactersObjects.has(id)) {
          const track = this.recorder.drop(id, now);
          if (track) this.spawn(track, true);
        }
      }
    }

    for (const visual of [...this.visuals]) {
      const position = ghostPosition(visual.track, now);
      if (!position.alive) {
        this.remove(visual);
        continue;
      }
      const bob = Math.sin(now / 320 + visual.track.id.length) * 0.08;
      visual.orb.position.set(position.x, ORB_HEIGHT + bob, position.z);
      visual.ring.position.set(position.x, 0.05, position.z);
      visual.sprite.position.set(position.x, ORB_HEIGHT + 1.15, position.z);

      (visual.line.material as LineBasicMaterial).opacity = 0.32 * position.fade;
      (visual.orb.material as MeshBasicMaterial).opacity = 0.85 * position.fade;
      (visual.ring.material as MeshBasicMaterial).opacity = 0.5 * position.fade;
      (visual.sprite.material as SpriteMaterial).opacity = 0.9 * position.fade;
    }
  };

  private spawn(track: GhostTrack, notify: boolean) {
    if (this.visuals.length >= MAX_LIVE_GHOSTS) this.remove(this.visuals[0]);

    const group = new Group();

    const line = new Line(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(
          track.points.flatMap((point) => [point.x, LINE_Y + Math.sin(point.y * 0.7) * 0.05, point.z]),
          3,
        ),
      ),
      new LineBasicMaterial({
        color: GHOST_LINE,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    line.frustumCulled = false;

    const orb = new Mesh(
      new SphereGeometry(0.16, 10, 8),
      new MeshBasicMaterial({
        color: GHOST_ORB,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );

    const ring = new Mesh(
      new RingGeometry(0.5, 0.85, 24),
      new MeshBasicMaterial({
        color: GHOST_LINE,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;

    const sprite = this.buildSprite(track);

    group.add(line, orb, ring, sprite);
    this.scene.add(group);
    this.visuals.push({ track, group, line, orb, ring, sprite });

    if (notify) {
      showToast(this.toastText(track.name), 'violet');
    }
  }

  private remove(visual: EchoVisual) {
    this.scene.remove(visual.group);
    visual.sprite.material.map?.dispose();
    visual.sprite.material.dispose();
    const index = this.visuals.indexOf(visual);
    if (index >= 0) this.visuals.splice(index, 1);
  }

  private toastText(name: string | null): string {
    const english = uiLanguage() === 'en';
    const who = name ?? (english ? 'someone' : 'alguém');
    return english ? `👻 ${who} left a ghost in this world` : `👻 ${who} deixou um espectro neste mundo`;
  }

  private buildSprite(track: GhostTrack): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(8, 24, 48, 0.62)';
      const radius = 12;
      const path = new Path2D();
      path.roundRect(4, 4, canvas.width - 8, canvas.height - 8, radius);
      context.fill(path);
      context.strokeStyle = 'rgba(165, 216, 255, 0.8)';
      context.lineWidth = 2;
      context.stroke(path);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#e7f2ff';
      context.font = '600 26px system-ui, sans-serif';
      const name = track.name ?? (uiLanguage() === 'en' ? 'someone' : 'alguém');
      context.fillText(name, canvas.width / 2, 36);
      context.fillStyle = '#9ec5e8';
      context.font = '500 17px system-ui, sans-serif';
      context.fillText('· espectro ·', canvas.width / 2, 68);
    }
    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.scale.set(3.4, 1.28, 1);
    return sprite;
  }
}