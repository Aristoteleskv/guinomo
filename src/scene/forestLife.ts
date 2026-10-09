import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { getWorldId } from '../core/worlds';
import { SceneModule } from './SceneModule';

const bodyGeometry = new SphereGeometry(1, 8, 6);
const headGeometry = new SphereGeometry(1, 8, 6);
const legGeometry = new CylinderGeometry(0.075, 0.11, 0.72, 6);
const antlerGeometry = new CylinderGeometry(0.035, 0.07, 0.52, 5);
const earGeometry = new ConeGeometry(0.1, 0.34, 5);

export class ForestLife extends SceneModule {
  protected init() {
    if (getWorldId(new URLSearchParams(window.location.search).get('world')) !== 'forest') {
      this.ready.resolve();
      return;
    }

    const coat = new MeshStandardMaterial({ color: '#9b6038', roughness: 0.92 });
    const lightCoat = new MeshStandardMaterial({ color: '#d6b783', roughness: 1 });
    const dark = new MeshStandardMaterial({ color: '#49372e', roughness: 1 });
    const animals = [
      { x: -8, y: 0, z: -44, angle: 0.7 },
      { x: 27, y: 0, z: -25, angle: -1.8 },
      { x: -24, y: 0, z: -76, angle: 2.6 },
    ].map(({ x, y, z, angle }) => {
      const deer = this.createDeer(coat, lightCoat, dark);
      deer.position.set(x, y, z);
      deer.rotation.y = angle;
      this.scene.add(deer);
      return deer;
    });

    this.scene.beforeRenderCbs.push(() => {
      const time = Date.now() * 0.001;
      animals.forEach((animal, index) => {
        animal.scale.y = 1 + Math.sin(time * 1.3 + index * 2.1) * 0.012;
      });
    });
    this.ready.resolve();
  }

  private createDeer(
    coat: MeshStandardMaterial,
    lightCoat: MeshStandardMaterial,
    dark: MeshStandardMaterial,
  ): Group {
    const deer = new Group();
    this.addEllipsoid(deer, bodyGeometry, coat, [0, 1.05, 0], [0.48, 0.42, 0.78]);
    this.addEllipsoid(deer, bodyGeometry, lightCoat, [0, 0.88, 0.18], [0.34, 0.24, 0.49]);
    this.addEllipsoid(deer, bodyGeometry, coat, [0, 1.36, 0.48], [0.28, 0.48, 0.29], [-0.38, 0, 0]);
    this.addEllipsoid(deer, headGeometry, coat, [0, 1.78, 0.72], [0.3, 0.28, 0.36]);
    this.addEllipsoid(deer, headGeometry, lightCoat, [0, 1.68, 0.99], [0.2, 0.15, 0.22]);
    this.addEllipsoid(deer, headGeometry, dark, [0, 1.71, 1.17], [0.09, 0.07, 0.1]);

    for (const side of [-1, 1]) {
      this.addEllipsoid(deer, earGeometry, coat, [side * 0.25, 2.01, 0.66], [0.72, 1, 0.62], [0, 0, side * -0.35]);
      this.addEllipsoid(deer, antlerGeometry, lightCoat, [side * 0.18, 2.1, 0.67], [1, 1, 1], [0, 0, side * -0.28]);
      this.addEllipsoid(deer, antlerGeometry, lightCoat, [side * 0.31, 2.27, 0.66], [0.8, 0.82, 0.8], [0, 0, side * 0.65]);

      for (const z of [-0.48, 0.49]) {
        this.addEllipsoid(deer, legGeometry, coat, [side * 0.28, 0.48, z], [1, 1, 1]);
        this.addEllipsoid(deer, bodyGeometry, dark, [side * 0.28, 0.12, z + 0.02], [0.105, 0.1, 0.14]);
      }
    }

    this.addEllipsoid(deer, bodyGeometry, lightCoat, [0, 1.05, -0.78], [0.13, 0.17, 0.15]);
    return deer;
  }

  private addEllipsoid(
    parent: Group,
    geometry: SphereGeometry | ConeGeometry | CylinderGeometry,
    material: MeshStandardMaterial,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    parent.add(mesh);
  }
}
