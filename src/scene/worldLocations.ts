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
    else if (this.worldId === 'old-town') this.createOldTown();

    this.scene.ready.then(() => this.setupSecrets());

    this.scene.beforeRenderCbs.push(this.updateRestButton);
    events.on('world_rest_toggle', this.toggleRest);
    this.ready.resolve();
  }

  private toggleRest = () => {
    const local = this.scene.characters?.mesh?._localObject;
    if (!local) return;

    const sleeping = local.userData.worldAction === 'sleep';
    if (sleeping) {
      local.userData.worldAction = null;
      local.userData.a = 0; // Back to idle
    } else {
      const dist = Math.hypot(local.position.x - this.restPosition.x, local.position.z - this.restPosition.z);
      if (dist <= REST_RADIUS) {
        local.userData.worldAction = 'sleep';
        local.userData.a = 2; // Bored/Rest animation
        this.scene.characters.mesh.snap(this.restPosition.toArray());
      }
    }
  };

  private setupSecrets() {
    const world = this.worldId;
    const { ufo, alien, cats, sloth, gossip } = this.scene;

    // Hide all by default, then show one per world
    [ufo, alien, cats, sloth, gossip].forEach(s => { if (s?.mesh) s.mesh.visible = false; });

    if (world === 'forest') {
      sloth.mesh.visible = true;
      sloth.mesh.position.set(-15, 4, -40);
    } else if (world === 'floating-city') {
      ufo.mesh.visible = true;
      ufo.mesh.position.set(12, 10, -58); // Above plaza
    } else if (world === 'tropical-city') {
      cats.mesh.visible = true;
      cats.mesh.position.set(12, 0.5, -50); // Near plaza
    } else if (world === 'old-town') {
      gossip.mesh.visible = true;
      gossip.mesh.position.set(35, 0.5, -60);
    } else if (world === 'alien') {
      alien.mesh.visible = true;
    }
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
    const cap = this.standard('#92aeb5', 0.4);
    const glow = new MeshBasicMaterial({ color: '#79e5ed' });

    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(12, 13, 0.45, 12), stone, 0, 0.24, 0);
    this.add(plaza, new CylinderGeometry(7.4, 7.4, 0.12, 12), cap, 0, 0.53, 0);

    // Integrar Machines autorais na cidade flutuante
    this.scene.ready.then(() => {
      if (this.scene.machines?.meshes.length) {
        this.scene.machines.meshes.forEach((mesh, i) => {
          mesh.visible = true;
          const x = i === 0 ? -10 : 35;
          const z = -65;
          mesh.position.set(x, this.groundAt(x, z), z);
        });
      }

      this.scene.blockers.meshes.forEach((mesh, i) => {
        mesh.visible = true;
        mesh.position.set(12 + (i * 5), this.groundAt(12 + (i * 5), -70), -70);
      });
    });

    const towers = [
      { x: -5, z: -77, width: 7, height: 10 },
      { x: 18, z: -79, width: 8, height: 16 },
      { x: 34, z: -57, width: 6, height: 11 },
    ];
    towers.forEach(({ x, z, width, height }) => {
      const tower = this.groundGroup(x, z);
      this.add(tower, new BoxGeometry(width, height, width), this.standard('#425d70', 0.32), 0, height / 2, 0);
      this.add(tower, new CylinderGeometry(width * 0.6, width * 0.8, 0.4, 8), cap, 0, height + 0.2, 0);
      this.add(tower, new CylinderGeometry(width * 0.3, width * 0.3, 0.1, 8), glow, 0, height + 0.4, 0);
    });
  }

  private createTropicalCity() {
    const glass = new MeshBasicMaterial({ color: '#94f1d8' });
    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(11, 12, 0.3, 12), this.standard('#b39d77'), 0, 0.15, 0);
    this.add(plaza, new CylinderGeometry(5.4, 5.4, 0.12, 12), glass, 0, 0.36, 0);

    // Posicionar assets autorais: Guarda-sóis e Castelos
    this.scene.ready.then(() => {
      if (this.scene.parasols?.mesh) {
        this.scene.parasols.mesh.visible = true;
        this.scene.parasols.mesh.position.set(25, this.groundAt(25, -45), -45);
      }
      this.scene.castles.meshes.forEach((mesh, i) => {
        mesh.visible = true;
        mesh.position.set(5 + i * 15, this.groundAt(5 + i * 15, -40), -40);
      });
    });

    const domes = [
      { x: -5, z: -77, radius: 5, height: 5 },
      { x: 19, z: -79, radius: 5.5, height: 6 },
      { x: 34, z: -57, radius: 4.3, height: 4.5 },
    ];
    domes.forEach(({ x, z, radius, height }) => {
      const dome = this.groundGroup(x, z);
      this.add(dome, new CylinderGeometry(radius, radius * 1.1, height, 10), this.standard('#d8c8a0'), 0, height / 2, 0);
      this.add(dome, new SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.standard('#2e8f85', 0.22), 0, height, 0);
    });
  }

  private createOldTown() {
    const window = new MeshBasicMaterial({ color: '#f5d890' });
    const plaza = this.groundGroup(12, -58);
    this.add(plaza, new CylinderGeometry(10, 11, 0.28, 10), this.standard('#9c8a70'), 0, 0.14, 0);
    this.add(plaza, new CylinderGeometry(3.4, 3.4, 0.12, 10), window, 0, 0.34, 0);

    // Substituir blocos por Casas e Armazéns reais
    this.scene.ready.then(() => {
      const positions = [
        { x: -10, z: -75, rot: 0.5 },
        { x: 20, z: -80, rot: -0.2 },
        { x: 40, z: -60, rot: 1.2 },
      ];

      this.scene.houses.meshes.forEach((mesh, i) => {
        const pos = positions[i % positions.length];
        mesh.visible = true;
        mesh.position.set(pos.x, this.groundAt(pos.x, pos.z), pos.z);
        mesh.rotation.y = pos.rot;
        mesh.updateMatrixWorld(true);
      });

      this.scene.warehouses.meshes.forEach((mesh, i) => {
        const x = i === 0 ? -15 : 30;
        const z = -40;
        mesh.visible = true;
        mesh.position.set(x, this.groundAt(x, z), z);
        mesh.updateMatrixWorld(true);
      });
    });
  }
}
