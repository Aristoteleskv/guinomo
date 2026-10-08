// The kid character: skinned mesh, four animation clips (idle/run/air/
// bored), local physics + controls, multiplayer connection, random colors.

import { Color, InstancedBufferAttribute, Mesh, Vector3 } from 'three';
import { events } from '../core/events';
import { geometryLoader } from '../engine/loaders/geometries';
import { Characters } from '../engine/characters';
import { depthCharsMaterial, phongMaterial } from './materials';
import { SceneModule } from './SceneModule';
import { appEndpointUrl } from '../core/assets';

export class CharactersModule extends SceneModule {
  declare mesh: Characters;
  seed = 0;

  private _avatarCache = new Map<number, { shirt: number[], skin: number[], name: string, hatVisible: number, isOwner: boolean }>();
  private _nameTags = new Map<string, HTMLDivElement>();
  private _nameTagsContainer: HTMLDivElement | null = null;

  /** Fetches avatar data from PHP and updates a specific character instance */
  private async updateCharacterColors(uid: number, userData: any, clientId: string) {
    if (uid <= 0) return;

    if (this._avatarCache.has(uid)) {
      const data = this._avatarCache.get(uid)!;
      userData.colorShirt = data.shirt;
      userData.colorSkin = data.skin;
      userData.name = data.name;
      userData.hatVisible = data.hatVisible;
      userData.isOwner = data.isOwner;
      this.ensureNameTag(clientId, data.name);
      return;
    }

    try {
      const endpoint = clientId === 'local'
        ? appEndpointUrl('php/avatar.php?format=json')
        : appEndpointUrl(`php/avatar.php?uid=${encodeURIComponent(uid)}&format=json`);
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Avatar profile request failed (${response.status})`);
      const dna = await response.json();

      const shirt = new Color(dna['shirt-hex'] || '#4c80e5');
      const skin = new Color(dna['skin-hex'] || '#e5b299');
      const name = dna['username'] || (clientId === 'local' ? window.GUINOMO_PROFILE?.username : '') || `User ${uid}`;

      const data = {
        shirt: [shirt.r, shirt.g, shirt.b],
        skin: [skin.r, skin.g, skin.b],
        name: name,
        hatVisible: dna['hat-visible'] !== undefined ? (dna['hat-visible'] ? 1 : 0) : 1,
        isOwner: dna['is_owner'] || false
      };

      this._avatarCache.set(uid, data);
      userData.colorShirt = data.shirt;
      userData.colorSkin = data.skin;
      userData.name = data.name;
      userData.hatVisible = data.hatVisible;
      userData.isOwner = data.isOwner;
      this.ensureNameTag(clientId, name);

      // Se for o usuário local, avisa a UI para mostrar o botão de chapéu
      if (clientId === 'local' && data.isOwner) {
        events.emit('ui_show_hat_button', true);
      }
    } catch (e) {
      console.warn('Unable to load avatar profile:', e);
      const hue = (uid * 137.5) % 360 / 360;
      const c = new Color().setHSL(hue, 0.5, 0.5);
      userData.colorShirt = [c.r, c.g, c.b];
      userData.colorSkin = [0.9, 0.7, 0.6];
      userData.name = `User ${uid}`;
      userData.hatVisible = 1;
      userData.isOwner = false;
      this.ensureNameTag(clientId, userData.name);
    }
  }

  private ensureNameTag(clientId: string, name: string) {
    if (!this._nameTagsContainer) {
      this._nameTagsContainer = document.createElement('div');
      this._nameTagsContainer.id = 'name-tags-container';
      this._nameTagsContainer.style.position = 'absolute';
      this._nameTagsContainer.style.top = '0';
      this._nameTagsContainer.style.left = '0';
      this._nameTagsContainer.style.pointerEvents = 'none';
      this._nameTagsContainer.style.width = '100%';
      this._nameTagsContainer.style.height = '100%';
      this._nameTagsContainer.style.overflow = 'hidden';
      document.body.appendChild(this._nameTagsContainer);
    }

    let tag = this._nameTags.get(clientId);
    if (!tag) {
      tag = document.createElement('div');
      tag.style.position = 'absolute';
      tag.style.background = 'rgba(0, 0, 0, 0.5)';
      tag.style.color = 'white';
      tag.style.padding = '2px 10px';
      tag.style.borderRadius = '12px';
      tag.style.fontSize = '12px';
      tag.style.fontWeight = 'bold';
      tag.style.fontFamily = 'Arial, sans-serif';
      tag.style.whiteSpace = 'nowrap';
      tag.style.transform = 'translate(-50%, -100%)';
      tag.style.border = '1px solid rgba(255,255,255,0.2)';
      this._nameTagsContainer.appendChild(tag);
      this._nameTags.set(clientId, tag);
    }
    tag.innerText = name;
  }

  protected async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = window.GUINOMO_UID || parseInt(urlParams.get('uid') || '0', 10);

    const [skinned, clips, colliderGeometry] = await Promise.all([
      geometryLoader.skin('kid.bin', 'kid-bones.bin'),
      Promise.all(['kid-idle.bin', 'kid-run.bin', 'kid-air.bin', 'kid-bored.bin'].map((c) => geometryLoader.skinAnimation(c))),
      geometryLoader.load('collider.bin'),
    ]);

    skinned.geometry.setAttribute('instanceSeed', new InstancedBufferAttribute(new Float32Array(128), 1));
    skinned.geometry.setAttribute('instanceColorShirt', new InstancedBufferAttribute(new Float32Array(128 * 3), 3));
    skinned.geometry.setAttribute('instanceColorSkin', new InstancedBufferAttribute(new Float32Array(128 * 3), 3));
    skinned.geometry.setAttribute('instanceHatVisible', new InstancedBufferAttribute(new Float32Array(128), 1));
    skinned.material = phongMaterial({ isCharacters: true });
    skinned.customDepthMaterial = depthCharsMaterial();

    // Set local identity
    if (uid > 0) {
      this.seed = this.deriveSeedFromId(uid);
      this.updateCharacterColors(uid, { a: 0 }, 'local');
    } else {
      this.seed = Math.random() * 4;
    }

    this.updateLocalCharacterSeed();
    events.on('webgl_character_randomize_color', this.changeColor);
    events.on('webgl_character_controls_enable', this.enableControls);
    events.on('webgl_character_toggle_hat', this.toggleHat);

    const colliderMesh = new Mesh(colliderGeometry);

    this.mesh = new Characters(skinned, clips, {
      animationsOptions: [{ speed: 1 }, { speed: 1.1 }, { speed: 1 }, { speed: 1 }],
      colliderMesh,
      radiusPercentage: 0.2,
      floorDetectInclination: 0.8,
      positionForce: 0.005,
      damp: 0.92,
      initialPosition: [12.2, 2.25, -58],
      initialRadius: 4,
      camera: this.scene.camera,
      relativeCameraPosition: new Vector3(0, 1, -5.75),
      lookatMeshOffset: new Vector3(0, 1.1, 0.5),
      initialData: { seed: this.seed, uid },
      customAttribUpdate: (local, clientId, instanceId) => {
        const charUid = local.userData.uid || 0;

        if (charUid > 0 && !local.userData.colorShirt) {
          this.updateCharacterColors(charUid, local.userData, clientId);
        }

        this.mesh.geometry.attributes.instanceSeed.setX(instanceId, local.userData.seed);
        const shirt = local.userData.colorShirt || [0.3, 0.5, 0.9];
        const skin = local.userData.colorSkin || [0.9, 0.7, 0.6];
        const hat = local.userData.hatVisible !== undefined ? local.userData.hatVisible : 1;

        this.mesh.geometry.attributes.instanceColorShirt.setXYZ(instanceId, shirt[0], shirt[1], shirt[2]);
        this.mesh.geometry.attributes.instanceColorSkin.setXYZ(instanceId, skin[0], skin[1], skin[2]);
        this.mesh.geometry.attributes.instanceHatVisible.setX(instanceId, hat);
      },
    });

    this.scene.beforeRenderCbs.push(() => {
      this.mesh.geometry.attributes.instanceSeed.needsUpdate = true;
      this.mesh.geometry.attributes.instanceColorShirt.needsUpdate = true;
      this.mesh.geometry.attributes.instanceColorSkin.needsUpdate = true;
      this.mesh.geometry.attributes.instanceHatVisible.needsUpdate = true;
      this.mesh.update();
      this._updateNameTagPositions();

      this.scene.audioController?.updatePlayerPosition(
        this.mesh._localObject.position.toArray(),
        this.mesh._localObject.velocityHorizontal,
        this.mesh._localObject.userData.a === 0,
      );
    });

    this.scene.add(this.mesh);
    this.scene.add(this.mesh._controls.circles);

    // Atalho para alternar chapéu (apenas se for o dono)
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') {
        this.toggleHat();
      }
    });

    this.ready.resolve();
  }

  /** Alterna a visibilidade do chapéu e salva no banco de dados PHP */
  toggleHat = async () => {
    if (!this.mesh) return;
    const local = this.mesh._localObject;
    const uid = local.userData.uid;

    // Só permite se for o dono (autenticado via PHP)
    if (!uid || !local.userData.isOwner) {
      console.warn("Apenas o dono pode alterar o visual.");
      return;
    }

    const nextState = local.userData.hatVisible === 0 ? 1 : 0;
    local.userData.hatVisible = nextState;

    // Atualiza cache local
    if (this._avatarCache.has(uid)) {
      this._avatarCache.get(uid)!.hatVisible = nextState;
    }

    // Salva no banco de dados via endpoint seguro
    await this._saveAvatarConfig(uid, 'hat_visible', nextState === 1);
  };

  private async _saveAvatarConfig(uid: number, key: string, value: any) {
    try {
      const formData = new FormData();
      formData.append('uid', uid.toString());
      formData.append('key', key);
      formData.append('value', value.toString());
      formData.append('csrf_token', window.CSRF_TOKEN || '');

      const response = await fetch(appEndpointUrl('php/save_avatar_3d.php'), {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        console.log(`Configuração ${key} salva com sucesso.`);
      } else {
        console.error('Erro ao salvar:', result.error);
      }
    } catch (e) {
      console.error('Falha na comunicação com o servidor PHP:', e);
    }
  }

  private _v3 = new Vector3();
  private _updateNameTagPositions() {
    if (!this.mesh || !this._nameTagsContainer) return;

    const camera = this.scene.camera;
    this.mesh._charactersObjects.forEach((obj, id) => {
      const tag = this._nameTags.get(id);
      if (!tag) return;

      this._v3.copy(obj.position);
      this._v3.y += 2.2;
      this._v3.project(camera);

      const x = (this._v3.x * 0.5 + 0.5) * window.innerWidth;
      const y = (this._v3.y * -0.5 + 0.5) * window.innerHeight;

      if (this._v3.z < 1 && this._v3.x >= -1 && this._v3.x <= 1 && this._v3.y >= -1 && this._v3.y <= 1) {
        tag.style.display = 'block';
        tag.style.left = `${x}px`;
        tag.style.top = `${y}px`;
      } else {
        tag.style.display = 'none';
      }
    });
  }

  enableControls = (enabled: boolean) => {
    if (enabled) this.mesh._controls.enable();
    else this.mesh._controls.disable();
  };

  private deriveSeedFromId(id: number): number {
    const skinIdx = id % 4;
    const hue = (id * 137.508) % 360 / 360;
    return skinIdx + hue;
  }

  private updateLocalCharacterSeed() {
    if (this.mesh) {
      this.mesh._localObject.userData.seed = this.seed;
      const hue = this.seed % 1;
      const c = new Color().setHSL(hue, 0.4, 0.3);
      events.emit('webgl_character_update_color', `#${c.getHexString()}`);
    }
  }

  changeColor = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('uid')) return;

    const color = Math.floor(Math.random() * 4);
    const seed = this.seed % 1;
    let hue = Math.random();
    while (Math.abs(hue - seed) < 0.2) hue = Math.random();
    this.seed = color + hue;
    this.updateLocalCharacterSeed();
  };
}
