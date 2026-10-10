// The kid character: skinned mesh, four animation clips (idle/run/air/
// bored), local physics + controls, multiplayer connection, random colors.

import { Color, InstancedBufferAttribute, Mesh, Vector3 } from 'three';
import { events } from '../core/events';
import { geometryLoader } from '../engine/loaders/geometries';
import { Characters } from '../engine/characters';
import { depthCharsMaterial, phongMaterial } from './materials';
import { SceneModule } from './SceneModule';
import { appEndpointUrl } from '../core/assets';
import { signIfEnabled } from '../core/hmac';
import { getWorldId, getWorldRoomSeed } from '../core/worlds';

/** Converte um array RGB 0..1 em hex (para o editor de avatar). */
function charactersHex(rgb: number[] | undefined, fallback: string): string {
  if (!rgb || rgb.length < 3) return fallback;
  return `#${new Color(rgb[0], rgb[1], rgb[2]).getHexString()}`;
}

export class CharactersModule extends SceneModule {
  declare mesh: Characters;
  seed = 0;

  private _avatarCache = new Map<number, { shirt: number[], skin: number[], name: string, nameTagColor: string, hatVisible: number, h: number, isOwner: boolean, ageScale: number, gender: string, role: string }>();
  private _nameTags = new Map<string, HTMLDivElement>();
  private _nameTagsContainer: HTMLDivElement | null = null;
  private _localNameTagColor: string | null = null;
  private _localRole = (() => {
    try {
      return localStorage.getItem('guinomo.role.v1') || '';
    } catch {
      return '';
    }
  })();

  /** Fetches avatar data from PHP and updates a specific character instance */
  private async updateCharacterColors(uid: number, userData: any, clientId: string) {
    if (uid <= 0) return;

    if (this._avatarCache.has(uid)) {
      const data = this._avatarCache.get(uid)!;
      userData.colorShirt = data.shirt;
      userData.colorSkin = data.skin;
      userData.name = data.name;
      userData.hatVisible = data.hatVisible ?? data.h ?? 1;
      userData.h = data.h ?? data.hatVisible ?? 1;
      userData.isOwner = data.isOwner;
      userData.ageScale = data.ageScale;
      userData.gender = data.gender;
      userData.role = data.role;
      this.ensureNameTag(clientId, data.name, clientId === 'local' ? this._localNameTagColor || data.nameTagColor : data.nameTagColor, uid, clientId === 'local' ? this._localRole || data.role : data.role);
      if (clientId === 'local') this.emitLocalAvatarState(data);
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
      const skinHex = dna['skin-hex'] || '#e5b299';
      const skin = new Color(skinHex);
      const name = dna['username'] || (clientId === 'local' ? window.GUINOMO_PROFILE?.username : '') || `User ${uid}`;
      const nameTagColor = clientId === 'local' && this._localNameTagColor
        ? this._localNameTagColor
        : this.isValidNameTagColor(dna['name-tag-color']) ? dna['name-tag-color'] : skinHex;

      const hatVisible = dna['hat-visible'] !== undefined ? (dna['hat-visible'] ? 1 : 0) : 1;
      const physique = dna['physique'] || 'default';
      const ageScales: Record<string, number> = { child: 0.82, teen: 0.93, adult: 1, senior: 0.98 };
      const ageScale = ageScales[dna['age_group']] || 1;
      const role = typeof dna['role'] === 'string' ? dna['role'] : '';

      const data = {
        shirt: [shirt.r, shirt.g, shirt.b],
        skin: [skin.r, skin.g, skin.b],
        name: name,
        nameTagColor,
        hatVisible,
        h: hatVisible,
        isOwner: dna['is_owner'] || false,
        physique: physique,
        ageScale: ageScale,
        gender: typeof dna['gender_category'] === 'string' ? dna['gender_category'] : 'nao_informado',
        role,
      };

      this._avatarCache.set(uid, data);
      userData.colorShirt = data.shirt;
      userData.colorSkin = data.skin;
      userData.name = data.name;
      userData.hatVisible = data.hatVisible;
      userData.h = data.h;
      userData.isOwner = data.isOwner;
      userData.physique = data.physique;
      userData.ageScale = data.ageScale;
      userData.gender = data.gender;
      userData.role = data.role;

      // Aplicar escala física baseada no biótipo
      this.applyPhysiqueScale(userData);

      this.ensureNameTag(clientId, name, nameTagColor, uid, clientId === 'local' ? this._localRole || role : role);

      // Se for o usuário local, avisa a UI para mostrar o botão de chapéu
      if (clientId === 'local' && data.isOwner) {
        events.emit('ui_show_hat_button', true);
      }
      if (clientId === 'local') this.emitLocalAvatarState(data);
    } catch (e) {
      console.warn('Unable to load avatar profile:', e);
      const hue = (uid * 137.5) % 360 / 360;
      const c = new Color().setHSL(hue, 0.5, 0.5);
      userData.colorShirt = [c.r, c.g, c.b];
      userData.colorSkin = [0.9, 0.7, 0.6];
      userData.name = `User ${uid}`;
      userData.hatVisible = 1;
      userData.h = 1;
      userData.isOwner = false;
      userData.ageScale = 1;
      userData.gender = 'nao_informado';
      userData.role = '';
      this.ensureNameTag(clientId, userData.name, clientId === 'local' && this._localNameTagColor ? this._localNameTagColor : '#e5b299', uid, clientId === 'local' ? this._localRole : '');
    }
  }

  private applyPhysiqueScale(userData: any) {
    const p = userData.physique || 'default';
    let s = [1, 1, 1]; // [x, y, z]

    switch (p) {
      case 'heroic':    s = [1.15, 1.2, 1.1]; break;   // Mais alto e largo
      case 'stylized':  s = [0.85, 0.85, 0.85]; break; // Pequeno e cartunesco
      case 'curvy':     s = [1.1, 0.95, 1.15]; break;  // Mais baixo e largo
      case 'slim_long': s = [0.8, 1.25, 0.8]; break;   // Muito alto e magro
      case 'dynamic':   s = [1.0, 1.1, 1.0]; break;
      case 'athletic':  s = [1.1, 1.05, 1.05]; break;
      default:          s = [1, 1, 1]; break;
    }

    userData.baseScale = s;
  }

  private ensureNameTag(clientId: string, name: string, backgroundColor: string, uid: number, role = '') {
    const roleText = clientId === 'local' ? this._localRole : role;
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
      this._nameTagsContainer.style.zIndex = '1000';
      document.body.appendChild(this._nameTagsContainer);
    }

    let tag = this._nameTags.get(clientId);
    if (!tag) {
      tag = document.createElement('div');
      tag.className = 'character-name-tag';
      tag.tabIndex = 0;
      tag.setAttribute('role', 'group');
      const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
      const avatar = document.createElement('img');
      avatar.className = 'character-tooltip-avatar';
      avatar.alt = '';
      avatar.loading = 'lazy';
      if (clientId === 'local' && window.GUINOMO_PROFILE) {
        avatar.src = window.GUINOMO_PROFILE.avatarUrl;
      } else if (uid > 0) {
        avatar.src = appEndpointUrl(`php/avatar.php?uid=${encodeURIComponent(uid)}`);
      } else {
        avatar.classList.add('unavailable');
      }
      avatar.addEventListener('error', () => avatar.classList.add('unavailable'), { once: true });

      const details = document.createElement('span');
      details.className = 'character-tooltip-details';
      const username = document.createElement('strong');
      username.className = 'character-tooltip-name';
      const status = document.createElement('span');
      status.className = 'character-tooltip-status';
      status.textContent = language === 'en' ? 'Online' : 'Online';
      const category = document.createElement('span');
      category.className = 'character-tooltip-category';
      category.textContent = language === 'en' ? 'Noop community' : 'Comunidade Noop';
      details.append(username, status, category);

      const pill = document.createElement('span');
      pill.className = 'character-name-pill';
      const label = document.createElement('span');
      label.className = 'character-name-label';
      const roleLabel = document.createElement('span');
      roleLabel.className = 'character-name-role';
      pill.append(label, roleLabel);
      const tooltip = document.createElement('span');
      tooltip.className = 'character-tooltip-card';
      tooltip.append(avatar, details);
      tag.append(pill, tooltip);
      this._nameTagsContainer.appendChild(tag);
      this._nameTags.set(clientId, tag);
    }
    const safeColor = this.isValidNameTagColor(backgroundColor) ? backgroundColor : '#e5b299';
    const pill = tag.querySelector<HTMLElement>('.character-name-pill')!;
    const label = tag.querySelector<HTMLElement>('.character-name-label')!;
    const roleLabel = tag.querySelector<HTMLElement>('.character-name-role')!;
    pill.style.backgroundColor = safeColor;
    pill.style.color = this.getReadableTextColor(safeColor);
    label.textContent = name;
    roleLabel.textContent = roleText;
    roleLabel.hidden = !roleText;
    tag.title = name;
    tag.setAttribute('aria-label', `${name} · ${document.documentElement.lang.startsWith('en') ? 'Online, Noop community member' : 'Online, membro da comunidade Noop'}`);

    // Golden name tag for secret hunters
    if (backgroundColor === '#ffd700') {
      pill.classList.add('golden-name-tag');
      pill.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.6)';
      pill.style.border = '1px solid #ffffff';
    } else {
      pill.classList.remove('golden-name-tag');
      pill.style.boxShadow = '';
      pill.style.border = '';
    }
  }

  private isValidNameTagColor(color: unknown): color is string {
    return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  }

  private getReadableTextColor(hex: string): string {
    const value = hex.slice(1);
    const channels = [0, 2, 4].map((offset) => {
      const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const blackContrast = (luminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (luminance + 0.05);
    return blackContrast >= whiteContrast ? '#171513' : '#ffffff';
  }

  private async setLocalNameTagColor(color: unknown) {
    if (!this.isValidNameTagColor(color)) return;

    this._localNameTagColor = color.toLowerCase();
    const uid = window.GUINOMO_UID || 0;
    const cached = this._avatarCache.get(uid);
    if (cached) cached.nameTagColor = this._localNameTagColor;

    const localTag = this._nameTags.get('local');
    if (localTag) {
      const pill = localTag.querySelector<HTMLElement>('.character-name-pill');
      if (pill) {
        pill.style.backgroundColor = this._localNameTagColor;
        pill.style.color = this.getReadableTextColor(this._localNameTagColor);
      }
    }

    const saved = uid > 0 && await this._saveAvatarConfig(uid, 'name_tag_color', this._localNameTagColor);
    events.emit('ui_name_tag_color_saved', Boolean(saved));
  }

  private async setLocalRole(role: string) {
    this._localRole = role;
    try {
      localStorage.setItem('guinomo.role.v1', role);
    } catch {
      // Private mode: the role still applies for this session only.
    }
    const uid = window.GUINOMO_UID || 0;
    const cached = this._avatarCache.get(uid);
    if (cached) cached.role = role;

    const localTag = this._nameTags.get('local');
    if (localTag) {
      const roleLabel = localTag.querySelector<HTMLElement>('.character-name-role');
      if (roleLabel) {
        roleLabel.textContent = role;
        roleLabel.hidden = !role;
      }
    }

    if (uid > 0) await this._saveAvatarConfig(uid, 'role', role);
  }

  /** Aplica e guarda a cor de camisa/pele do avatar local (dono guarda no perfil). */
  private async setLocalColor(kind: 'shirt' | 'skin', hex: unknown) {
    if (!this.isValidNameTagColor(hex)) return;
    const local = this.mesh?._localObject;
    const uid = local?.userData.uid ?? window.GUINOMO_UID ?? 0;
    const isOwner = Boolean(local?.userData.isOwner);

    const color = new Color(hex).toArray();
    if (local) {
      if (kind === 'shirt') local.userData.colorShirt = color;
      else local.userData.colorSkin = color;
      const cached = this._avatarCache.get(uid);
      if (cached) {
        if (kind === 'shirt') cached.shirt = color;
        else cached.skin = color;
      }
    }
    if (uid > 0 && isOwner) {
      await this._saveAvatarConfig(uid, kind === 'shirt' ? 'shirt_color' : 'skin_color', hex);
    }
    this.emitLocalAvatarState({
      shirt: kind === 'shirt' ? color : local?.userData.colorShirt,
      skin: kind === 'skin' ? color : local?.userData.colorSkin,
      isOwner: true,
    });
  }

  /** Avisa a UI do editor de avatar: mostra o painel (dono) e as cores atuais. */
  private emitLocalAvatarState(data: { shirt?: number[]; skin?: number[]; isOwner?: boolean }) {
    if (!data?.isOwner) return;
    events.emit('ui_show_avatar_editor', true);
    events.emit('webgl_character_colors', {
      shirt: charactersHex(data.shirt, '#3a86ff'),
      skin: charactersHex(data.skin, '#e5b299'),
    });
  }

  protected async init() {
    events.on('webgl_character_set_name_tag_color', (color: string) => {
      void this.setLocalNameTagColor(color);
    });
    events.on('webgl_character_set_role', (role: string) => {
      void this.setLocalRole(role || '');
    });
    events.on('webgl_character_set_shirt_color', (hex: string) => {
      void this.setLocalColor('shirt', hex);
    });
    events.on('webgl_character_set_skin_color', (hex: string) => {
      void this.setLocalColor('skin', hex);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const uid = window.GUINOMO_UID || parseInt(urlParams.get('uid') || '0', 10);
    const worldId = getWorldId(urlParams.get('world'));
    const roomSeed = await getWorldRoomSeed(worldId, urlParams.get('room'));

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
    events.on('webgl_all_secrets_found', () => {
      // Guard so the reward is applied (and persisted) only once.
      if (this.mesh && !this.mesh._localObject.userData.hasAllSecrets) {
        this.mesh._localObject.userData.hasAllSecrets = true;
        void this.setLocalNameTagColor('#ffd700'); // Recompensa: Nome Dourado
      }
    });

    const colliderMesh = new Mesh(colliderGeometry);

    this.mesh = new Characters(skinned, clips, {
      animationsOptions: [{ speed: 1 }, { speed: 1.1 }, { speed: 1 }, { speed: 1 }],
      colliderMesh,
      scene: this.scene,
      radiusPercentage: 0.2,
      floorDetectInclination: 0.8,
      positionForce: 0.005,
      damp: 0.92,
      initialPosition: [12.2, 2.25, -58],
      initialRadius: 4,
      camera: this.scene.camera,
      relativeCameraPosition: new Vector3(0, 1, -5.75),
      lookatMeshOffset: new Vector3(0, 1.1, 0.5),
      initialData: { seed: this.seed, uid, ...(uid > 0 ? { h: 1 } : {}) },
      roomSeed, // Passa a semente da sala para o motor P2P
      customAttribUpdate: (local, clientId, instanceId) => {
        const charUid = local.userData.uid || 0;

        if (charUid > 0 && !local.userData.colorShirt) {
          this.updateCharacterColors(charUid, local.userData, clientId);
        }

        this.mesh.geometry.attributes.instanceSeed.setX(instanceId, local.userData.seed);
        const shirt = local.userData.colorShirt || [0.3, 0.5, 0.9];
        const skin = local.userData.colorSkin || [0.9, 0.7, 0.6];
        const hat = local.userData.h ?? local.userData.hatVisible ?? 1;

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
    local.userData.h = nextState;

    // Atualiza cache local
    if (this._avatarCache.has(uid)) {
      this._avatarCache.get(uid)!.hatVisible = nextState;
      this._avatarCache.get(uid)!.h = nextState;
    }

    // Salva no banco de dados via endpoint seguro
    await this._saveAvatarConfig(uid, 'hat_visible', nextState === 1);
  };

  private async _saveAvatarConfig(uid: number, key: string, value: string | number | boolean): Promise<boolean> {
    try {
      const endpoint = appEndpointUrl('php/save_avatar_3d.php');
      // application/x-www-form-urlencoded (not FormData) so the exact bytes can
      // be signed, and so it matches PHP's $_POST parsing.
      const body = new URLSearchParams({
        uid: uid.toString(),
        key,
        value: value.toString(),
        csrf_token: window.CSRF_TOKEN || '',
      });
      const rawBody = body.toString();
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      };
      // Additive HMAC signing: inert unless a runtime key is configured.
      Object.assign(headers, await signIfEnabled('POST', endpoint, rawBody));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: rawBody,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        console.log(`Configuração ${key} salva com sucesso.`);
        return true;
      } else {
        console.error('Erro ao salvar:', result.error);
        return false;
      }
    } catch (e) {
      console.error('Falha na comunicação com o servidor PHP:', e);
      return false;
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
        if (id === 'local') {
          document.documentElement.classList.toggle('guinomo-avatar-right', x > window.innerWidth * 0.5);
        }
      } else {
        tag.style.display = 'none';
        if (id === 'local') document.documentElement.classList.remove('guinomo-avatar-right');
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

    // Além da semente, aleatoriza as cores reais de camisa e pele. O dono
    // guarda no perfil (PHP); um convidado só altera a sessão local.
    const shirtHex = `#${new Color().setHSL(Math.random(), 0.55, 0.5).getHexString()}`;
    const skinPalette = ['#f2c8a0', '#e5b299', '#d7916e', '#b06c46', '#8c4f2b', '#5d3a1f'];
    const skinHex = skinPalette[Math.floor(Math.random() * skinPalette.length)];
    void this.setLocalColor('shirt', shirtHex);
    void this.setLocalColor('skin', skinHex);
  };
}
