// The environment: composes every scene module, the sun (CSM), audio, intro.

import { Color, HemisphereLight, Spherical } from 'three';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { events } from '../core/events';
import { client } from '../core/client';
import { getWorldId } from '../core/worlds';
import { BaseScene } from '../engine/scene';
import { AudioController } from '../engine/audio';
import { FollowSunLight } from '../engine/sunlight';
import { SceneModule } from './SceneModule';
import { Sky } from './sky';
import { Terrain } from './terrain';
import { Sea } from './sea';
import { Birds } from './birds';
import { Trees, Bushes, Palmtrees, Rocks1, Rocks2, Grass } from './vegetation';
import { Houses, Warehouses, Machines, Lightposts, Parasols, Castles, Blockers } from './structures';
import { UFO, Alien, Cats, Sloth, Sign, Gossip } from './setpieces';
import { CharactersModule } from './characters';
import { ForestLife } from './forestLife';
import { WorldLocations } from './worldLocations';
import type { MainController } from './mainController';

gsap.registerPlugin(CustomEase);

export class EnvironmentScene extends BaseScene {
  declare audioController: AudioController;
  declare sky: Sky;
  declare terrain: Terrain;
  declare sea: Sea;
  declare birds: Birds;
  declare trees: Trees;
  declare bushes: Bushes;
  declare lightposts: Lightposts;
  declare palmtrees: Palmtrees;
  declare houses: Houses;
  declare warehouses: Warehouses;
  declare machines: Machines;
  declare rocks1: Rocks1;
  declare rocks2: Rocks2;
  declare grass: Grass;
  declare parasols: Parasols;
  declare castles: Castles;
  declare blockers: Blockers;
  declare ufo: UFO;
  declare alien: Alien;
  declare sign: Sign;
  declare cats: Cats;
  declare sloth: Sloth;
  declare gossip: Gossip;
  declare characters: CharactersModule;
  declare forestLife: ForestLife;
  declare worldLocations: WorldLocations;

  constructor(_mainController: MainController) {
    super();
    this.init();
  }

  private async init() {
    this.setupCamera();
    this.audioController = new AudioController(this, 0.25);

    type ModuleCtor = new (scene: EnvironmentScene) => SceneModule;
    const modules: Array<[string, ModuleCtor]> = [
        ['characters', CharactersModule],
        ['sky', Sky],
        ['terrain', Terrain],
        ['sea', Sea],
        ['birds', Birds],
        ['trees', Trees],
        ['bushes', Bushes],
        ['lightposts', Lightposts],
        ['palmtrees', Palmtrees],
        ['houses', Houses],
        ['warehouses', Warehouses],
        ['machines', Machines],
        ['rocks1', Rocks1],
        ['rocks2', Rocks2],
        ['parasols', Parasols],
        ['castles', Castles],
        ['grass', Grass],
        ['blockers', Blockers],
        ['ufo', UFO],
        ['alien', Alien],
        ['sign', Sign],
        ['cats', Cats],
        ['sloth', Sloth],
        ['gossip', Gossip],
        ['forestLife', ForestLife],
        ['worldLocations', WorldLocations],
      ];
    await Promise.all(
      modules.map(([name, Module]) => {
        (this as any)[name] = new Module(this);
        return (this as any)[name].ready;
      }),
    );

    this.configureWorld();
    this.setupLights();
    (this.sea.mesh as any).addReflectedObject(this.sky.mesh);

    // P1.1: Force world-specific sky themes
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    if (world === 'floating-city') {
      this.sky.setTheme('alien');
    } else if (world === 'old-town') {
      this.sky.setTheme('night');
    } else if (world === 'alien') {
      this.sky.setTheme('alien');
    }

    this.ready.resolve();
  }

  private configureWorld() {
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    if (world === 'lobby' || world === 'alien') return;

    this.sea.mesh.visible = world !== 'forest';

    // World-specific asset visibility
    const isCity = ['floating-city', 'tropical-city', 'old-town'].includes(world);

    if (world !== 'tropical-city') {
      this.palmtrees.meshes.forEach((mesh) => { mesh.visible = false; });
    }

    // Cities use houses and infrastructure
    if (!isCity) {
      this.houses.meshes.forEach((mesh) => { mesh.visible = false; });
      this.lightposts.meshes.forEach((mesh) => { mesh.visible = false; });
      this.lightposts.meshWire.visible = false;
    }

    // Specific asset rules
    if (world !== 'floating-city') {
      this.machines.meshes.forEach((mesh) => { mesh.visible = false; });
    }

    if (world !== 'old-town') {
      this.castles.meshes.forEach((mesh) => { mesh.visible = false; });
      this.warehouses.meshes.forEach((mesh) => { mesh.visible = false; });
    }

    if (world !== 'tropical-city') {
      this.parasols.mesh.visible = false;
    }

    // Always keep gameplay/secret assets active in cities for B to place them
    this.blockers.meshes.forEach((mesh) => { mesh.visible = isCity; });
    this.ufo.mesh.visible = true; // B will position these as secrets
    this.alien.mesh.visible = true;
    this.sign.mesh.visible = true;
    this.cats.mesh.visible = true;
    this.sloth.mesh.visible = true;
    this.gossip.mesh.visible = true;
  }

  private setupCamera() {
    this.camera.shake.set(0.08, 0.08, 0.02);
    this.camera.shakeSpeed.setScalar(0.2);
    this.camera.near = 1;
    this.camera.far = 175;
    this.camera.updateProjectionMatrix();
    if (client.device === 'mobile') {
      this.camera.displacement.position.y = 0;
    }
  }

  private setupLights() {
    const hemi = new HemisphereLight('#33434f', '#737575', 0.7);
    this.add(hemi);
    const nightSky = new Color('#111b42');
    const alienSky = new Color('#631aa1');
    const nightGround = new Color('#20243b');
    const alienGround = new Color('#193d56');
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    const daySky = world === 'forest' ? new Color('#527d69')
      : world === 'floating-city' ? new Color('#536b7b')
        : world === 'tropical-city' ? new Color('#558a83')
          : world === 'old-town' ? new Color('#806957')
            : new Color('#33434f');
    const dayGround = world === 'forest' ? new Color('#526b4a')
      : world === 'floating-city' ? new Color('#62706d')
        : world === 'tropical-city' ? new Color('#65845e')
          : world === 'old-town' ? new Color('#796b57')
            : new Color('#737575');
    this.beforeRenderCbs.push(() => {
      const night = this.sky.nightIntensity;
      const alien = this.sky.alienIntensity;
      hemi.intensity = 0.7 - night * 0.38 + alien * 0.18;
      hemi.color.copy(daySky).lerp(nightSky, night).lerp(alienSky, alien);
      hemi.groundColor.copy(dayGround).lerp(nightGround, night).lerp(alienGround, alien);
    });

    const sun = new FollowSunLight({
      scene: this,
      positionOffset: new Spherical(100, Math.PI * 0.2, Math.PI * -1.75),
      forwardOffset: 6,
      castShadow: true,
      shadowMapSize: 2048,
      shadowSize: 12,
      csm: true,
      csmBoundingSphere: (this.characters.mesh._collisionPhysics as any)._colliderMesh?.geometry?.boundingSphere,
      csmNear: 50,
      csmLODLevel: client.oldIphone ? 1 : 3,
      skipCSMMeshes: [this.characters.mesh, this.sky.mesh, this.sea.mesh, this.birds.mesh],
    });
    sun.shadow.normalBias = 0.07;
    this.beforeRenderCbs.push(() => {
      sun.intensity = 0.2 + (1 - this.sky.nightIntensity) * 0.8;
    });
    this.add(sun);
  }

  playIntroAnimation() {
    this.camera.followSphericalZoom = 12;
    this.camera.updateCamera();
    this.camera.spherical.copy(this.camera.sphericalTarget);
    gsap.to(this.camera, {
      followSphericalZoom: 0,
      delay: 0,
      ease: 'inOut3',
      duration: 6,
    });
    this.camera.touchAmount = 0;
    gsap.to(this.camera, {
      touchAmount: 1,
      delay: 4,
      duration: 4,
    });
    gsap.delayedCall(1.5, () => {
      events.emit('webgl_character_controls_enable', true);
      this.audioController.canPlaySound.resolve();
    });
  }
}
