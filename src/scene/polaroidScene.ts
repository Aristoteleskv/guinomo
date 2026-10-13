// World polaroids (B5, 3D): floating polaroid frames where photos were taken,
// shared through the PHP backend (api/guinomo/photos.php). A corner-nav button
// captures the poster (reusing engine/photo.capturePoster), shrinks it to a
// thumbnail and hangs it in the world at the player's feet; frames bob and
// sway with the deterministic clock. Plain CanvasTextures — no shader changes.

import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from 'three';
import { events } from '../core/events';
import { clock } from '../engine/clock';
import { capturePoster } from '../engine/photo';
import { getWorldId, type WorldId } from '../core/worlds';
import {
  fetchWorldPolaroids,
  placeWorldPolaroid,
  type WorldPolaroid,
} from '../core/worldPolaroid';
import { showToast } from '../components/toast';
import { SceneModule } from './SceneModule';
import './polaroids.css';

const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 72;
const FLOAT_HEIGHT = 2.3;
const MAX_FRAMES = 40;

interface FrameData {
  id: number;
  x: number;
  y: number;
  z: number;
  mesh: Mesh;
  seed: number;
}

export class PolaroidScene extends SceneModule {
  declare private worldId: WorldId;
  declare private raycaster: Raycaster;
  declare private down: Vector3;

  private frames = new Map<number, FrameData>();

  protected async init() {
    this.worldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
    this.raycaster = new Raycaster();
    this.down = new Vector3(0, -1, 0);

    this.setupButton();
    this.scene.beforeRenderCbs.push(this.update);

    try {
      const polaroids = await fetchWorldPolaroids(this.worldId);
      for (const polaroid of polaroids) this.addFrame(polaroid);
    } catch (error) {
      // A failed endpoint simply shows no frames — not fatal.
      console.warn('Unable to load the world polaroids:', error);
    }

    this.ready.resolve();
  }

  private setupButton(): void {
    if (document.getElementById('polaroids-capture')) return;
    const label = this.text('Leave a polaroid in the world', 'Deixar polaroid no mundo');
    const button = document.createElement('button');
    button.id = 'polaroids-capture';
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = '🖼️';
    button.addEventListener('click', () => void this.capture());
    const nav = document.querySelector('nav');
    if (nav) {
      button.classList.add('in-nav');
      nav.append(button);
    } else {
      document.body.append(button);
    }
  }

  private async capture(): Promise<void> {
    const local = this.scene.characters?.mesh?._localObject;
    if (!local) {
      showToast(this.text('Cannot find your position.', 'Não foi possível encontrar a tua posição.'), 'neutral');
      return;
    }
    if (this.frames.size >= MAX_FRAMES) {
      showToast(this.text('Too many polaroids in this world already.', 'Já há muitas polaroids neste mundo.'), 'neutral');
      return;
    }

    const prompt = window.prompt(this.text('Caption (optional)', 'Legenda (opcional)'), '');
    if (prompt === null) return;
    const caption = prompt.trim().slice(0, 60);

    try {
      const blob = await capturePoster({ world: this.worldId, title: caption || undefined });
      const thumb = await this.thumbFromBlob(blob);
      const { x, y, z } = local.position;
      const result = await placeWorldPolaroid(
        { world: this.worldId, x, y, z, thumb, caption },
        window.GUINOMO_UID ?? 0,
        window.CSRF_TOKEN || '',
      );
      if (!result.ok) {
        showToast(result.error, 'neutral');
        return;
      }
      this.addFrame({
        id: result.id,
        world: this.worldId,
        x,
        y,
        z,
        thumb,
        caption,
        uid: window.GUINOMO_UID ?? 0,
        createdAt: Math.floor(Date.now() / 1000),
      });
      events.emit('webgl_polaroid_placed');
      showToast(this.text('Polaroid left in the world!', 'Polaroid deixada no mundo!'), 'violet');
    } catch (error) {
      console.warn('Unable to place the polaroid:', error);
      showToast(this.text('Unable to create the polaroid.', 'Não foi possível criar a polaroid.'), 'neutral');
    }
  }

  private thumbFromBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_WIDTH;
        canvas.height = THUMB_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error('polaroids: no 2d context'));
          return;
        }
        context.drawImage(image, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('polaroids: image decode failed'));
      };
      image.src = url;
    });
  }

  private addFrame(polaroid: WorldPolaroid): void {
    if (this.frames.has(polaroid.id)) return;

    let texture: CanvasTexture;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_WIDTH;
      canvas.height = THUMB_HEIGHT;
      const context = canvas.getContext('2d');
      texture = new CanvasTexture(canvas);
      if (context) {
        const image = new Image();
        image.onload = () => {
          context.drawImage(image, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
          texture.needsUpdate = true;
        };
        image.src = polaroid.thumb;
      }
    } catch {
      return;
    }

    const mesh = new Mesh(
      new PlaneGeometry(1.7, 1.275),
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );

    const ground = this.groundAt(polaroid.x, polaroid.z);
    mesh.position.set(polaroid.x, ground + FLOAT_HEIGHT, polaroid.z);
    mesh.rotation.y = (polaroid.id % 7) * 0.35;
    this.scene.add(mesh);

    const seed = polaroid.id * 7919 + polaroid.createdAt;
    this.frames.set(polaroid.id, { id: polaroid.id, x: polaroid.x, y: ground, z: polaroid.z, mesh, seed });
  }

  /** Anchor height from the terrain (same raycast as the world notes). */
  private groundAt(x: number, z: number): number {
    try {
      this.raycaster.set(new Vector3(x, 50, z), this.down);
      this.raycaster.far = 1000;
      const terrain = this.scene.terrain?.mesh as unknown;
      if (!terrain) return 0;
      const hits = this.raycaster.intersectObject(terrain as import('three').Object3D, false);
      return hits.length > 0 ? hits[0].point.y : 0;
    } catch {
      return 0;
    }
  }

  private update = () => {
    if (this.frames.size === 0) return;
    const t = clock.time;
    for (const frame of this.frames.values()) {
      frame.mesh.position.y = frame.y + FLOAT_HEIGHT + 0.14 * Math.sin(t * 0.9 + frame.seed);
      frame.mesh.rotation.z = 0.05 * Math.sin(t * 0.55 + frame.seed * 1.7);
    }
  };

  private text(pt: string, en: string): string {
    return window.GUINOMO_PROFILE?.language === 'en' ? en : pt;
  }
}