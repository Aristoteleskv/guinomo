// Interiors scene — "entrar em casas" (D9). The authored houses are open shells,
// so this module builds a deterministic room (core/interiors.ts) far away on the
// terrain, hidden while the player is outdoors, and MOVES THE PLAYER into it when
// they press Q by a house door. Walking out the walls sends them back to the
// door. Real 3D, real collider (the terrain under the room is the floor), no new
// assets and no new dependencies: the existing rest/sleep logic then works from
// the room's bed, so the kid can sleep indoors and wake up with E.

import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Raycaster,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { events } from '../core/events';
import { getWorldId, type WorldId } from '../core/worlds';
import {
  INTERIOR_EXIT_MARGIN,
  interiorContains,
  interiorEntrance,
  interiorPlan,
  nearestInterior,
  type InteriorFurniture,
  type InteriorPalette,
  type InteriorPlan,
} from '../core/interiors';
import { SceneModule } from './SceneModule';
import './interior.css';

/** Worlds whose houses can be entered. */
const INTERIOR_WORLDS: WorldId[] = ['old-town', 'alien'];
/** Flat, empty stretch of terrain (the cities all live at z < 0). */
const ORIGIN = { x: 0, z: 60 };
const WALL = 0.22;
const DOOR_WIDTH = 1.7;
const DOOR_HEIGHT = 2.3;

export class InteriorScene extends SceneModule {
  private groundY = 0;
  private plan: InteriorPlan | null = null;
  private room: Group | null = null;
  private outsidePosition: number[] | null = null;
  private savedRest: Vector3 | null = null;
  private nearIndex: number | null = null;
  private readonly raycaster = new Raycaster();
  private readonly down = new Vector3(0, -1, 0);
  private button: HTMLButtonElement | null = null;

  get inside(): boolean {
    return this.active;
  }

  private active = false;

  protected async init() {
    this.button = this.createButton();
    await this.scene.terrain.ready;
    this.scene.terrain.mesh.updateMatrixWorld(true);
    this.groundY = this.groundAt(ORIGIN.x, ORIGIN.z);

    // House doors only exist in the worlds that place houses; build the little
    // entrance markers once the world module has published them.
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    if (INTERIOR_WORLDS.includes(world)) {
      this.scene.ready.then(() => this.buildMarkers());
    }

    this.scene.beforeRenderCbs.push(this.update);
    events.on('keydown', this.onKey);
    this.ready.resolve();
  }

  // ---- portals -----------------------------------------------------------

  private portals() {
    return this.scene.worldLocations?.housePortals ?? [];
  }

  // ---- enter / exit ------------------------------------------------------

  private enter(index: number) {
    const local = this.scene.characters?.mesh?._localObject;
    if (!local || this.active) return;

    this.outsidePosition = [local.position.x, local.position.y, local.position.z];
    this.plan = interiorPlan(this.world(), index);
    this.buildRoom(this.plan);
    this.active = true;

    const entrance = interiorEntrance(this.plan);
    this.scene.characters.mesh.snap([ORIGIN.x + entrance.x, this.groundY + 0.2, ORIGIN.z + entrance.z]);

    // No weather indoors (the roof would clip the falling streaks otherwise).
    if (this.scene.rain) this.scene.rain.suspended = true;

    // Sleeping indoors happens on the bed: reuse worldLocations' rest zone.
    const rest = this.scene.worldLocations?.restPosition;
    if (rest) {
      this.savedRest = rest.clone();
      rest.set(ORIGIN.x + this.plan.bed.x, this.groundY + 0.2, ORIGIN.z + this.plan.bed.z);
    }
  }

  private exit() {
    if (!this.active) return;
    const back = this.outsidePosition;
    this.disposeRoom();
    this.active = false;
    this.plan = null;
    this.nearIndex = null;
    if (this.scene.rain) this.scene.rain.suspended = false;
    if (this.savedRest) {
      this.scene.worldLocations?.restPosition.copy(this.savedRest);
      this.savedRest = null;
    }
    if (back) this.scene.characters?.mesh?.snap(back);
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.code !== 'KeyQ' || event.repeat) return;
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    if (this.active) this.exit();
    else if (this.nearIndex !== null) this.enter(this.nearIndex);
  };

  // ---- frame -------------------------------------------------------------

  private update = () => {
    const local = this.scene.characters?.mesh?._localObject;
    const button = this.button;
    if (!local || !button) return;

    if (this.active && this.plan) {
      // Strayed past the walls (they are not in the collider): step back out.
      if (!interiorContains(this.plan, local.position.x - ORIGIN.x, local.position.z - ORIGIN.z, INTERIOR_EXIT_MARGIN)) {
        this.exit();
      } else {
        this.showButton(button, this.text('Sair · tecla Q', 'Leave · press Q'));
        return;
      }
    }

    const portal = nearestInterior(this.portals(), local.position);
    this.nearIndex = portal ? portal.index : null;
    if (this.nearIndex === null) {
      button.hidden = true;
      return;
    }
    this.showButton(button, this.text('Entrar em casa · tecla Q', 'Enter house · press Q'));
  };

  private showButton(button: HTMLButtonElement, label: string) {
    button.hidden = false;
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', label);
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'guinomo-interior';
    button.className = 'world-rest-action world-interior-action';
    button.type = 'button';
    button.hidden = true;
    button.addEventListener('click', () => {
      if (this.active) this.exit();
      else if (this.nearIndex !== null) this.enter(this.nearIndex);
    });
    document.body.append(button);
    return button;
  }

  // ---- geometry ----------------------------------------------------------

  private world(): WorldId {
    return getWorldId(new URLSearchParams(window.location.search).get('world'));
  }

  private groundAt(x: number, z: number): number {
    this.raycaster.set(new Vector3(x, 60, z), this.down);
    const hit = this.raycaster.intersectObject(this.scene.terrain.mesh, false)[0];
    return hit?.point.y ?? 0;
  }

  private standard(color: string, options: { emissive?: string; metalness?: number } = {}) {
    return new MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: options.metalness ?? 0.08,
      emissive: options.emissive ?? '#000000',
      flatShading: true,
      side: DoubleSide, // The camera may clip a wall in the tight room.
    });
  }

  private buildRoom(plan: InteriorPlan) {
    const palette: InteriorPalette = plan.palette;
    const wall = this.standard(palette.wall);
    const floor = this.standard(palette.floor);
    const alien = plan.world === 'alien';
    const trim = this.standard(palette.trim, { emissive: alien ? palette.trim : undefined, metalness: 0.3 });
    const textile = this.standard(palette.textile);
    const glow = new MeshBasicMaterial({ color: palette.trim });

    const group = new Group();
    group.position.set(ORIGIN.x, this.groundY, ORIGIN.z);
    const halfW = plan.width / 2;
    const halfD = plan.depth / 2;

    const box = (w: number, h: number, d: number, m: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    // Floor and roof.
    box(plan.width + WALL * 2, 0.24, plan.depth + WALL * 2, floor, 0, -0.12, 0);
    box(plan.width + WALL * 2, 0.24, plan.depth + WALL * 2, wall, 0, plan.height + 0.12, 0);

    // Side and back walls.
    box(WALL, plan.height, plan.depth, wall, -halfW, plan.height / 2, 0);
    box(WALL, plan.height, plan.depth, wall, halfW, plan.height / 2, 0);
    box(plan.width + WALL * 2, plan.height, WALL, wall, 0, plan.height / 2, halfD);

    // Front wall with a door opening.
    const side = (plan.width - DOOR_WIDTH) / 2;
    box(side, plan.height, WALL, wall, -(DOOR_WIDTH / 2 + side / 2), plan.height / 2, -halfD);
    box(side, plan.height, WALL, wall, DOOR_WIDTH / 2 + side / 2, plan.height / 2, -halfD);
    box(DOOR_WIDTH, plan.height - DOOR_HEIGHT, WALL, wall, 0, DOOR_HEIGHT + (plan.height - DOOR_HEIGHT) / 2, -halfD);

    // Door frame.
    box(0.14, DOOR_HEIGHT, 0.28, trim, -DOOR_WIDTH / 2, DOOR_HEIGHT / 2, -halfD);
    box(0.14, DOOR_HEIGHT, 0.28, trim, DOOR_WIDTH / 2, DOOR_HEIGHT / 2, -halfD);
    box(DOOR_WIDTH + 0.28, 0.14, 0.28, trim, 0, DOOR_HEIGHT, -halfD);

    for (const item of plan.furniture) this.buildFurniture(group, item, { trim, textile, glow });

    const light = new PointLight(alien ? '#b79bff' : '#ffd9a0', 0.9, 16, 2);
    light.position.set(0, plan.height - 0.5, 0);
    group.add(light);

    this.room = group;
    this.scene.add(group);
  }

  private buildFurniture(
    group: Group,
    item: InteriorFurniture,
    mats: { trim: MeshStandardMaterial; textile: MeshStandardMaterial; glow: MeshBasicMaterial },
  ) {
    const { trim, textile, glow } = mats;
    const add = (geometry: BoxGeometry | CylinderGeometry | SphereGeometry, material: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, rot = 0) => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = item.rot + rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    const s = item.size;

    switch (item.kind) {
      case 'bed':
        add(new BoxGeometry(1.1 * s, 0.3, 2.0 * s), trim, item.x, 0.32, item.z);
        add(new BoxGeometry(1.02 * s, 0.24, 1.9 * s), textile, item.x, 0.58, item.z);
        add(new BoxGeometry(0.8 * s, 0.16, 0.42 * s), glow, item.x, 0.74, item.z - 0.72 * s);
        break;
      case 'table':
        add(new BoxGeometry(1.5 * s, 0.12, 0.95 * s), trim, item.x, 0.78, item.z);
        for (const dx of [-0.6, 0.6]) {
          add(new BoxGeometry(0.12, 0.72, 0.12), trim, item.x + dx * s, 0.36, item.z + 0.34, 0);
          add(new BoxGeometry(0.12, 0.72, 0.12), trim, item.x + dx * s, 0.36, item.z - 0.34, 0);
        }
        break;
      case 'rug':
        add(new BoxGeometry(3.2 * s, 0.05, 2.3 * s), textile, item.x, 0.03, item.z);
        break;
      case 'shelf':
        add(new BoxGeometry(0.42 * s, 1.9, 1.6), trim, item.x, 0.95, item.z);
        add(new BoxGeometry(0.46 * s, 0.1, 1.5), glow, item.x, 1.1, item.z);
        break;
      case 'lamp':
        add(new CylinderGeometry(0.06, 0.09, 1.9, 6), trim, item.x, 0.95, item.z);
        add(new SphereGeometry(0.24, 10, 8), glow, item.x, 1.95, item.z);
        break;
      case 'crate':
        add(new BoxGeometry(1.0 * s, 0.9 * s, 1.0 * s), trim, item.x, 0.45 * s, item.z);
        break;
      case 'plant':
        add(new CylinderGeometry(0.3, 0.36, 0.5, 8), trim, item.x, 0.25, item.z);
        add(new SphereGeometry(0.42, 8, 6), textile, item.x, 0.9, item.z);
        break;
      case 'hearth':
        add(new BoxGeometry(2.0, 1.1, 0.7), trim, item.x, 0.55, item.z);
        add(new BoxGeometry(1.4, 0.5, 0.2), glow, item.x, 0.42, item.z - 0.36);
        break;
    }
  }

  private disposeRoom() {
    const group = this.room;
    if (!group) return;
    const disposeMaterial = (material: Material) => material.dispose();
    group.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach(disposeMaterial);
        else disposeMaterial(material);
      }
    });
    group.removeFromParent();
    this.room = null;
  }

  /** Glowing door frames outside every enterable house. */
  private buildMarkers() {
    const portals = this.portals();
    if (portals.length === 0) return;
    const group = new Group();
    const frame = new MeshBasicMaterial({ color: '#ffd76a' });

    for (const portal of portals) {
      const marker = new Group();
      marker.position.set(portal.x, this.groundAt(portal.x, portal.z), portal.z);
      const post = (x: number) => {
        const mesh = new Mesh(new BoxGeometry(0.12, 2.4, 0.12), frame);
        mesh.position.set(x, 1.2, 0);
        marker.add(mesh);
      };
      post(-0.8);
      post(0.8);
      const lintel = new Mesh(new BoxGeometry(1.9, 0.12, 0.12), frame);
      lintel.position.set(0, 2.4, 0);
      marker.add(lintel);
      group.add(marker);
    }

    this.scene.add(group);
  }

  private text(pt: string, en: string): string {
    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    return language === 'en' ? en : pt;
  }
}
