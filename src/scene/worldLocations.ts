import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
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

  /** Current secret to point the HUD compass at (empty when the world has none). */
  secretTargets: Array<{ id: string; position: Vector3 }> = [];

  protected async init() {
    this.worldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
    this.raycaster = new Raycaster();
    this.down = new Vector3(0, -1, 0);
    this.restPosition = new Vector3(0, -999, 0); // Default far away
    this.restButton = this.createRestButton();

    if (CITY_WORLDS.includes(this.worldId as CityWorld)) {
      await this.scene.terrain.ready;
      this.scene.terrain.mesh.updateMatrixWorld(true);

      const restGround = this.groundAt(REST_X, REST_Z);
      this.restPosition.set(REST_X, restGround + 0.2, REST_Z);
      this.createRestArea(restGround);

      if (this.worldId === 'floating-city') this.createFloatingCity();
      else if (this.worldId === 'tropical-city') this.createTropicalCity();
      else if (this.worldId === 'old-town') this.createOldTown();
    }

    this.scene.ready.then(() => this.setupSecrets());

    // Safe because SceneModule defers `init()` past field initializers.
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
      // Universal rest logic: if near a rest zone, snap to it. Otherwise, rest in place.
      local.userData.worldAction = 'sleep';
      local.userData.a = 2; // Sitting/Rest animation
      if (dist <= REST_RADIUS) {
        this.scene.characters.mesh.snap(this.restPosition.toArray());
      }
    }
  };

  private setupSecrets() {
    const world = this.worldId;
    const { ufo, alien, cats, sloth, gossip } = this.scene;

    // Default: hide all, then enable based on world context
    [ufo, alien, cats, sloth, gossip].forEach((s) => {
      if (s?.mesh) s.mesh.visible = false;
    });

    if (world === 'lobby') {
      // UFO appearing in the distance in the main lobby
      ufo.mesh.visible = true;
      ufo.mesh.position.set(-60, 5, 30);
    } else if (world === 'forest') {
      sloth.mesh.visible = true;
      sloth.mesh.position.set(-15, 4, -40);
    } else if (world === 'floating-city') {
      ufo.mesh.visible = true;
      ufo.mesh.position.set(12, 10, -58); // Floating above the city plaza
    } else if (world === 'tropical-city') {
      cats.mesh.visible = true;
      cats.mesh.position.set(12, 0.5, -50); // Near the futuristic domes
    } else if (world === 'old-town') {
      gossip.mesh.visible = true;
      gossip.mesh.position.set(35, 0.5, -60); // Tucked away in the stone village
    } else if (world === 'alien') {
      alien.mesh.visible = true;
      alien.mesh.position.set(60.14, 0.1, 40.6); // Original alien spot
    }

    // Point the compass HUD at whichever set piece is active in this world.
    const secret = [ufo, alien, cats, sloth, gossip].find((piece) => piece?.mesh?.visible);
    this.secretTargets = secret?.mesh ? [{ id: world, position: secret.mesh.position.clone() }] : [];
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

  // The authored .bin geometries carry the original map's world offset baked
  // into the vertices (e.g. houses[0] lives at ~x=31, z=8). Re-centering the
  // asset (x/z) makes `mesh.position` control the real spot, so the city
  // layouts below land exactly where they are assigned.
  private recenter(mesh: Mesh) {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return;
    geometry.translate(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
  }

  // Instanced patches (machines) carry their world spots in the per-instance
  // matrices. Shift those so the first instance sits at the origin; the public
  // mesh.position then places the whole patch where the city wants it.
  private recenterInstanced(mesh: InstancedMesh) {
    const array = mesh.instanceMatrix.array as Float32Array;
    const tx = array[12];
    const ty = array[13];
    const tz = array[14];
    for (let i = 0; i < mesh.count; i++) {
      array[i * 16 + 12] -= tx;
      array[i * 16 + 13] -= ty;
      array[i * 16 + 14] -= tz;
    }
    mesh.instanceMatrix.needsUpdate = true;
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
    const isIdle = local.velocityHorizontal < 0.01;
    // Button is visible if we're sleeping (to wake up) or if we're standing still (to sit down)
    button.hidden = !isIdle && !sleeping;
    if (button.hidden) return;

    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    const label = sleeping
      ? language === 'en'
        ? 'Wake up'
        : 'Acordar'
      : language === 'en'
        ? 'Rest · press E'
        : 'Descansar · tecla E';
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

    // Integrar Machines autorais na cidade flutuante. As instâncias vêm com as
    // posições do mapa original baked; recentra-se cada patch e distribuem-se
    // as três máquinas por spots distintos em torno da praça.
    this.scene.ready.then(() => {
      if (this.scene.machines?.meshes.length) {
        const spots = [
          { x: -10, z: -68 },
          { x: 26, z: -42 },
          { x: 44, z: -52 },
        ];
        this.scene.machines.meshes.forEach((mesh, i) => {
          mesh.visible = true;
          this.recenterInstanced(mesh);
          const spot = spots[i % spots.length];
          mesh.position.set(spot.x, this.groundAt(spot.x, spot.z), spot.z);
          mesh.updateMatrixWorld(true);
        });
      }

      this.scene.blockers.meshes.forEach((mesh, i) => {
        mesh.visible = true;
        this.recenter(mesh);
        const x = 12 + i * 5;
        mesh.position.set(x, this.groundAt(x, -70), -70);
        mesh.updateMatrixWorld(true);
      });
    });

    const towers = [
      { x: -5, z: -77, width: 7, height: 10 },
      { x: 18, z: -79, width: 8, height: 16 },
      { x: 34, z: -57, width: 6, height: 11 },
    ];
    towers.forEach(({ x, z, width, height }) => {
      const tower = this.groundGroup(x, z);
      this.add(
        tower,
        new BoxGeometry(width, height, width),
        this.standard('#425d70', 0.32),
        0,
        height / 2,
        0,
      );
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
        this.recenter(this.scene.parasols.mesh);
        this.scene.parasols.mesh.position.set(25, this.groundAt(25, -45), -45);
        this.scene.parasols.mesh.updateMatrixWorld(true);
      }
      this.scene.castles.meshes.forEach((mesh, i) => {
        mesh.visible = true;
        this.recenter(mesh);
        const x = 5 + i * 15;
        mesh.position.set(x, this.groundAt(x, -40), -40);
        mesh.updateMatrixWorld(true);
      });
    });

    const domes = [
      { x: -5, z: -77, radius: 5, height: 5 },
      { x: 19, z: -79, radius: 5.5, height: 6 },
      { x: 34, z: -57, radius: 4.3, height: 4.5 },
    ];
    domes.forEach(({ x, z, radius, height }) => {
      const dome = this.groundGroup(x, z);
      this.add(
        dome,
        new CylinderGeometry(radius, radius * 1.1, height, 10),
        this.standard('#d8c8a0'),
        0,
        height / 2,
        0,
      );
      this.add(
        dome,
        new SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        this.standard('#2e8f85', 0.22),
        0,
        height,
        0,
      );
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
        this.recenter(mesh);
        mesh.position.set(pos.x, this.groundAt(pos.x, pos.z), pos.z);
        mesh.rotation.y = pos.rot;
        mesh.updateMatrixWorld(true);
      });

      this.scene.warehouses.meshes.forEach((mesh, i) => {
        const x = i === 0 ? -15 : i === 1 ? 10 : 35;
        const z = -40;
        mesh.visible = true;
        this.recenter(mesh);
        mesh.position.set(x, this.groundAt(x, z), z);
        mesh.updateMatrixWorld(true);
      });
    });
  }
}
