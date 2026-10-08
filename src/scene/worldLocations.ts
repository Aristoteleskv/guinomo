import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
} from 'three';
import { events } from '../core/events';
import { getWorldId, type WorldId } from '../core/worlds';
import { SceneModule } from './SceneModule';

type CityWorld = 'floating-city' | 'tropical-city' | 'old-town';

const CITY_WORLDS: CityWorld[] = ['floating-city', 'tropical-city', 'old-town'];
const REST_X = 19;
const REST_Z = -49;
const REST_RADIUS = 4.5;

export class WorldLocations extends SceneModule {
  declare worldId: WorldId;
  declare restPosition: Vector3;
  declare private raycaster: Raycaster;
  declare private down: Vector3;
  declare private restButton: HTMLButtonElement | null;

  protected async init() {
    this.worldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
    if (!CITY_WORLDS.includes(this.worldId as CityWorld)) {
      this.ready.resolve();
      return;
    }

    this.raycaster = new Raycaster();
    this.down = new Vector3(0, -1, 0);
    this.restPosition = new Vector3();
    this.restButton = this.createRestButton();
    await this.scene.terrain.ready;
    this.scene.terrain.mesh.updateMatrixWorld(true);

    const restGround = this.groundAt(REST_X, REST_Z);
    this.restPosition.set(REST_X, restGround + 0.2, REST_Z);
    this.createRestArea(restGround);

    if (this.worldId === 'floating-city') this.createFloatingCity();
    else if (this.worldId === 'tropical-city') this.createTropicalCity();
    else this.createOldTown();

    this.scene.beforeRenderCbs.push(this.updateRestButton);
    this.ready.resolve();
  }

  private groundAt(x: number, z: number): number {
    this.raycaster.set(new Vector3(x, 50, z), this.down);
    const hit = this.raycaster.intersectObject(this.scene.terrain.mesh, false)[0];
    return hit?.point.y ?? 0;
  }

  private groundGroup(x: number, z: number): Group {
    const group = new Group();
    group.position.set(x, this.groundAt(x, z), z);
    this.scene.add(group);
    return group;
  }

  private add(
    parent: Group,
    geometry: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry,
    material: MeshStandardMaterial | MeshBasicMaterial,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private standard(color: string, metalness = 0.08): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, roughness: 0.78, metalness, flatShading: true });
  }

  private createRestArea(ground: number) {
    const shelter = this.groundGroup(REST_X, REST_Z);
    const wood = this.standard(this.worldId === 'old-town' ? '#71503a' : '#475b62');
    const mattress = this.standard(this.worldId === 'tropical-city' ? '#d8b694' : '#c9d5d0');
    const pillow = this.standard('#f3e8d5');
    const trim = this.standard(this.worldId === 'floating-city' ? '#6cd7e8' : '#d7b36b', 0.28);

    for (const x of [-1.05, 1.05]) {
      for (const z of [-0.7, 0.7]) {
        this.add(shelter, new BoxGeometry(0.16, 0.55, 0.16), wood, x, 0.28, z);
      }
    }
    this.add(shelter, new BoxGeometry(2.45, 0.24, 1.8), wood, 0, 0.62, 0);
    this.add(shelter, new BoxGeometry(2.28, 0.3, 1.65), mattress, 0, 0.88, 0);
    this.add(shelter, new BoxGeometry(0.56, 0.2, 1.35), pillow, -0.76, 1.13, 0);
    this.add(shelter, new BoxGeometry(0.12, 0.07, 1.7), trim, 0.64, 1.06, 0);

    const canopy = this.standard(this.worldId === 'old-town' ? '#8c6244' : '#4d7782');
    for (const x of [-1.32, 1.32]) {
      for (const z of [-0.95, 0.95]) {
        this.add(shelter, new CylinderGeometry(0.055, 0.08, 2.35, 6), canopy, x, 1.25, z);
      }
    }
    this.add(shelter, new BoxGeometry(2.85, 0.12, 2.1), canopy, 0, 2.48, 0);
    shelter.position.y = ground;
  }

  private createRestButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'world-rest-action';
    button.type = 'button';
    button.hidden = true;
    button.addEventListener('click', () => events.emit('world_rest_toggle'));
    document.body.append(button);
    return button;
  }

  private updateRestButton = () => {
    const button = this.restButton;
    const local = this.scene.characters?.mesh?._localObject;
    if (!button || !local) return;

    const sleeping = local.userData.worldAction === 'sleep';
    const nearby = Math.hypot(local.position.x - this.restPosition.x, local.position.z - this.restPosition.z) <= REST_RADIUS;
    button.hidden = !nearby && !sleeping;
    if (button.hidden) return;

    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    const label = sleeping
      ? (language === 'en' ? 'Wake up' : 'Acordar')
      : (language === 'en' ? 'Rest · press E' : 'Descansar · tecla E');
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(sleeping));
  };

  private createFloatingCity() {
    const stone = this.standard('#607985', 0.2);
    const shell = this.standard('#425d70', 0.32);
    const cap = this.standard('#92aeb5', 0.4);
    const glow = new MeshBasicMaterial({ color: '#79e5ed' });

    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(12, 13, 0.45, 12), stone, 0, 0.24, 0);
    this.add(plaza, new CylinderGeometry(7.4, 7.4, 0.12, 12), cap, 0, 0.53, 0);

    const towers = [
      { x: -5, z: -77, width: 7, depth: 7, height: 10 },
      { x: 18, z: -79, width: 8, depth: 8, height: 16 },
      { x: 34, z: -57, width: 6, depth: 7, height: 11 },
      { x: -4, z: -37, width: 8, depth: 7, height: 12 },
      { x: 23, z: -35, width: 7, depth: 7, height: 9 },
    ];
    towers.forEach(({ x, z, width, depth, height }, index) => {
      const tower = this.groundGroup(x, z);
      this.add(tower, new BoxGeometry(width, height, depth), shell, 0, height / 2, 0);
      this.add(tower, new CylinderGeometry(width * 0.62, width * 0.78, 0.38, 8), cap, 0, height + 0.2, 0);
      this.add(tower, new CylinderGeometry(width * 0.36, width * 0.36, 0.11, 8), glow, 0, height + 0.43, 0);

      const floors = Math.floor(height / 2.6);
      for (let floor = 0; floor < floors; floor++) {
        for (const side of [-1, 1]) {
          this.add(
            tower,
            new BoxGeometry(width * 0.22, 0.72, 0.09),
            glow,
            side * width * 0.24,
            1.2 + floor * 2.45,
            -depth / 2 - 0.05,
          );
        }
      }
      if (index % 2 === 0) {
        this.add(tower, new CylinderGeometry(0.09, 0.16, 2.2, 6), glow, 0, height + 1.3, 0);
        this.add(tower, new SphereGeometry(0.38, 8, 6), cap, 0, height + 2.5, 0);
      }
    });

    for (const [x, z] of [[-8, -53], [31, -70], [9, -31]]) {
      const pad = this.groundGroup(x, z);
      this.add(pad, new CylinderGeometry(2.5, 3.5, 0.48, 8), cap, 0, 3.2, 0);
      this.add(pad, new CylinderGeometry(0.16, 0.24, 3.1, 6), glow, 0, 1.55, 0);
    }
  }

  private createTropicalCity() {
    const wall = this.standard('#d8c8a0');
    const roof = this.standard('#2e8f85', 0.22);
    const glass = new MeshBasicMaterial({ color: '#94f1d8' });
    const trunk = this.standard('#806447');
    const leaf = this.standard('#3f9368');

    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(11, 12, 0.3, 12), this.standard('#b39d77'), 0, 0.15, 0);
    this.add(plaza, new CylinderGeometry(5.4, 5.4, 0.12, 12), glass, 0, 0.36, 0);

    const domes = [
      { x: -5, z: -77, radius: 5, height: 5 },
      { x: 19, z: -79, radius: 5.5, height: 6 },
      { x: 34, z: -57, radius: 4.3, height: 4.5 },
      { x: -4, z: -37, radius: 4.6, height: 5 },
      { x: 23, z: -35, radius: 4.2, height: 4 },
    ];
    domes.forEach(({ x, z, radius, height }) => {
      const dome = this.groundGroup(x, z);
      this.add(dome, new CylinderGeometry(radius, radius * 1.1, height, 10), wall, 0, height / 2, 0);
      this.add(dome, new SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), roof, 0, height, 0);
      this.add(dome, new CylinderGeometry(radius * 0.7, radius * 0.7, 0.12, 10), glass, 0, height * 0.66, -radius * 0.65);
      this.add(dome, new BoxGeometry(0.15, height * 0.75, 0.12), glass, 0, height * 0.48, -radius - 0.03);
    });

    for (const [x, z, height] of [[-15, -68, 5], [42, -70, 6], [-14, -44, 5], [43, -42, 6], [7, -27, 5]]) {
      const palm = this.groundGroup(x, z);
      this.add(palm, new CylinderGeometry(0.16, 0.28, height, 7), trunk, 0, height / 2, 0);
      for (let leafIndex = 0; leafIndex < 6; leafIndex++) {
        const angle = leafIndex * Math.PI / 3;
        const frond = this.add(
          palm,
          new ConeGeometry(0.42, 2.6, 5),
          leaf,
          Math.sin(angle) * 0.82,
          height + 0.48,
          Math.cos(angle) * 0.82,
          angle,
        );
        frond.rotation.z = -0.72;
      }
    }
  }

  private createOldTown() {
    const stone = this.standard('#b99d7d');
    const timber = this.standard('#584233');
    const roof = this.standard('#75483e');
    const window = new MeshBasicMaterial({ color: '#f5d890' });

    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(10, 11, 0.28, 10), this.standard('#9c8a70'), 0, 0.14, 0);
    this.add(plaza, new CylinderGeometry(3.4, 3.4, 0.12, 10), window, 0, 0.34, 0);

    const houses = [
      { x: -4, z: -77, width: 7, depth: 6, height: 5 },
      { x: 18, z: -79, width: 8, depth: 6, height: 6 },
      { x: 34, z: -57, width: 6, depth: 7, height: 4.5 },
      { x: -4, z: -37, width: 8, depth: 6, height: 5 },
      { x: 23, z: -35, width: 7, depth: 6, height: 5.5 },
    ];
    houses.forEach(({ x, z, width, depth, height }, index) => {
      const house = this.groundGroup(x, z);
      const wallColor = index % 2 === 0 ? stone : this.standard('#d4bb96');
      this.add(house, new BoxGeometry(width, height, depth), wallColor, 0, height / 2, 0);
      this.add(house, new ConeGeometry(Math.max(width, depth) * 0.78, height * 0.58, 4), roof, 0, height + height * 0.28, 0, Math.PI / 4);
      this.add(house, new BoxGeometry(width * 0.18, height * 0.46, 0.12), timber, 0, height * 0.25, -depth / 2 - 0.08);
      this.add(house, new BoxGeometry(width * 0.17, height * 0.2, 0.1), window, -width * 0.27, height * 0.65, -depth / 2 - 0.08);
      this.add(house, new BoxGeometry(width * 0.17, height * 0.2, 0.1), window, width * 0.27, height * 0.65, -depth / 2 - 0.08);
      this.add(house, new BoxGeometry(0.8, 1.5, 0.12), timber, width * 0.28, 0.75, -depth / 2 - 0.1);
      this.add(house, new BoxGeometry(0.65, 1.65, 0.65), stone, -width * 0.26, height + 0.8, 0);
    });
  }
}
