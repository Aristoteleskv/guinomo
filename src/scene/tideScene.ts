// Tide (A2, 3D): raises the sea surface by the deterministic seaTideLevel()
// and rides a soft additive foam glow on top — the same height for every
// player because the pure level comes from the world's own event calendar
// (floating-city "High tide" 18:00–19:30 UTC). Water worlds only; untouched
// elsewhere. No shader changes.

import { AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { getWorldId } from '../core/worlds';
import { seaTideLevel, TIDE_RISE_METERS } from '../core/seaTide';
import { SceneModule } from './SceneModule';

const WATER_WORLDS: ReadonlySet<string> = new Set(['floating-city', 'tropical-city']);

export class TideScene extends SceneModule {
  private world = getWorldId(new URLSearchParams(window.location.search).get('world'));
  private baseY = 0;
  private foam: Mesh | null = null;

  protected init() {
    if (!WATER_WORLDS.has(this.world)) {
      this.ready.resolve();
      return;
    }

    this.baseY = this.scene.sea?.mesh?.position.y ?? 0;

    this.foam = new Mesh(
      new PlaneGeometry(540, 540),
      new MeshBasicMaterial({
        color: '#dff3ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.y = 0.15;
    this.scene.add(this.foam);

    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private update = () => {
    const sea = this.scene.sea?.mesh;
    if (!sea || !this.foam) return;
    const level = seaTideLevel(this.world, new Date());
    sea.position.y = this.baseY + level * TIDE_RISE_METERS;
    const material = this.foam.material as MeshBasicMaterial;
    material.opacity = level * 0.18;
    this.foam.visible = level > 0.01;
  };
}