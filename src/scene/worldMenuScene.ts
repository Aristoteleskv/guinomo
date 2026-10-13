// 3D world menu (lobby): six glowing orbs float on an arc over the meeting
// spot, each tagged with its world icon. The orbs are pure three.js; the
// clickable chips are DOM buttons projected onto the orbs' screen positions
// every frame (same math as the player name tags), so travelling works with
// mouse and touch exactly like the World Map button (ui.ts travelTo).

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { clock } from '../engine/clock';
import { playSfx } from '../engine/sfx';
import { getWorldId, type WorldId } from '../core/worlds';
import { meetingSpotFor } from '../core/friendsLight';
import { travelHref, worldMenuLayout, WORLD_ORB_Y, type WorldMenuEntry } from '../core/worldMenu';
import { SceneModule } from './SceneModule';
import './worldMenu.css';

interface Orb {
  id: WorldId;
  mesh: Mesh;
  button: HTMLButtonElement;
}

export class WorldMenuScene extends SceneModule {
  private world = getWorldId(new URLSearchParams(window.location.search).get('world'));
  private orbs: Orb[] = [];
  private container: HTMLDivElement | null = null;
  private scratch = new Vector3();
  private spot = meetingSpotFor('lobby');

  protected init() {
    if (this.world !== 'lobby') {
      this.ready.resolve();
      return;
    }

    this.setupDom();

    const entries = worldMenuLayout();
    for (const entry of entries) this.createOrb(entry);

    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private setupDom(): void {
    if (document.getElementById('world-menu')) return;
    const container = document.createElement('div');
    container.id = 'world-menu';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = this.text('Choose a world', 'Escolhe um mundo');
    container.append(title);

    document.body.append(container);
    this.container = container;
  }

  private createOrb(entry: WorldMenuEntry): void {
    const glow = new Color(entry.color)

    const orb = new Mesh(
      new SphereGeometry(0.55, 20, 16),
      new MeshBasicMaterial({
        color: glow,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    orb.position.set(this.spot.x + entry.x, WORLD_ORB_Y, this.spot.z + entry.z);
    this.scene.add(orb);

    const icon = new Sprite(
      new SpriteMaterial({
        map: this.iconTexture(entry.icon),
        transparent: true,
        depthWrite: false,
      }),
    );
    icon.position.copy(orb.position);
    icon.position.y += 0.9;
    icon.scale.setScalar(1.35);
    this.scene.add(icon);
    orb.userData.icon = icon;

    const button = this.createChip(entry);
    this.orbs.push({ id: entry.id, mesh: orb, button });
  }

  private iconTexture(icon: string): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '44px system-ui, Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(icon, 32, 34);
    }
    return new CanvasTexture(canvas);
  }

  private createChip(entry: WorldMenuEntry): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'orb-chip';
    button.textContent = entry.icon;
    button.setAttribute('aria-label', `${entry.icon} ${this.entryLabel(entry)}`);
    button.title = this.entryLabel(entry);

    const label = document.createElement('span');
    label.className = 'orb-label';
    label.textContent = this.entryLabel(entry);
    button.append(label);

    button.addEventListener('click', () => {
      playSfx('travel');
      window.location.assign(travelHref(entry.id, window.location.href));
    });

    this.container?.append(button);
    return button;
  }

  private update = () => {
    if (this.orbs.length === 0) return;
    const t = clock.time;
    const camera = this.scene.camera;

    this.orbs.forEach((orb, index) => {
      const bob = 0.2 * Math.sin(t * 0.8 + index * 1.7);
      const mesh = orb.mesh;
      mesh.position.y = WORLD_ORB_Y + bob;
      mesh.rotation.y = t * 0.3 * (index % 2 === 0 ? 1 : -1);
      const icon = mesh.userData.icon as Sprite | undefined;
      if (icon) {
        icon.position.copy(mesh.position);
        icon.position.y += 0.9;
      }

      // Project the orb onto the screen — same math as the name tags.
      this.scratch.copy(mesh.position);
      this.scratch.project(camera);
      const inside =
        this.scratch.z < 1 &&
        this.scratch.x >= -1 &&
        this.scratch.x <= 1 &&
        this.scratch.y >= -1 &&
        this.scratch.y <= 1;
      orb.button.style.display = inside ? 'grid' : 'none';
      if (inside) {
        const x = (this.scratch.x * 0.5 + 0.5) * window.innerWidth;
        const y = (this.scratch.y * -0.5 + 0.5) * window.innerHeight;
        orb.button.style.left = `${x}px`;
        orb.button.style.top = `${y}px`;
      }
    });
  };

  private entryLabel(entry: WorldMenuEntry): string {
    return this.text(entry.label.pt, entry.label.en);
  }

  private text(pt: string, en: string): string {
    return window.GUINOMO_PROFILE?.language === 'en' ? en : pt;
  }
}