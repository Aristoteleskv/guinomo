import { events } from '../core/events';
import { DEFAULT_WORLD_ID, getWorldId, WORLDS } from '../core/worlds';

const speakerIcon = '<svg class="sound sound2" viewBox="0 0 17 13" aria-hidden="true"><path d="M10.189 0.228 6.13 3.332H4.168c-.512 0-.938.41-.938.938v4.384c0 .165.043.321.118.457L.816 10.907a1 1 0 1 0 1.157 1.631l4.153-2.946h.021l.026.02 5.756-4.082v-.054l3.694-2.62a1 1 0 0 0-1.157-1.631l-2.537 1.8V1.08c-.017-.904-1.041-1.399-1.74-.853Z" fill="#716C66"/></svg>';
const mutedIcon = '<svg class="sound sound2" viewBox="0 0 17 13" aria-hidden="true"><path d="M6.96.228 2.9 3.332H.938A.94.94 0 0 0 0 4.27v4.384c0 .511.41.938.938.938h1.979l4.042 3.104a1 1 0 0 0 1.74-.853V1.08C8.682.177 7.659-.318 6.96.228Z" fill="#716C66"/></svg>';
const infoIcon = '<svg class="info" viewBox="0 0 4 18" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2 2v6.818a2 2 0 1 1-4 0V8a2 2 0 0 1 2-2ZM4 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" fill="#716C66"/></svg>';
const hatIcon = '<svg class="hat" viewBox="0 0 20 20" style="width:18px;height:18px;" aria-hidden="true"><path d="M17 13v-2c0-3.866-3.134-7-7-7S3 7.134 3 11v2a4 4 0 0 0-4 4h20a4 4 0 0 0-4-4Z" fill="#716C66"/></svg>';
const closeIcon = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m1.5 1.5 15 15m0-15-15 15" stroke="#989389" stroke-width="2" stroke-linecap="round"/></svg>';
const backIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6M7 10h10" fill="none" stroke="#716C66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const infoContent = {
  about: {
    title: 'Guinomo',
    paragraphs: [
      'This is a web experiment I made to practice some procedural 3D art. There are 5 secrets hidden across it. I hope you can find them!',
      'Thanks to Ana and Michael for their tips.',
      '<a href="https://vlucendo.com" rel="noreferrer" target="_blank" class="link2">Vicente</a>',
    ],
  },
  congrats: {
    title: 'You found all 5 secrets!',
    paragraphs: [
      "(I hope that didn't take too long)",
      "I don't have anything to give you other than my thanks for exploring this experiment, inspired by those calm summer days where life just passes by... ☀️",
    ],
  },
} as const;

type InfoName = keyof typeof infoContent;

type GuinomoFriend = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  world: string;
  in_guinomo: boolean;
  is_online: boolean;
  room_url: string | null;
  profile_url: string;
};

export class UiController {
  readonly webglContainer: HTMLDivElement;
  private readonly loader: HTMLDivElement;
  private readonly nav: HTMLElement;
  private readonly secretModal: HTMLDivElement;
  private readonly infoModal: HTMLDivElement;
  private readonly infoPanel: HTMLElement;
  private readonly secretPanel: HTMLElement;
  private readonly colorSquare: HTMLDivElement;
  private readonly nameTagColorButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly hatButton: HTMLButtonElement;
  private readonly count: HTMLDivElement;
  private chatOverlay: HTMLElement | null = null;
  private easterEggs = 0;
  private totalEasterEggs = 0;
  private overlayOpen = false;
  private secretTimer = 0;
  private notificationIds = new Set<number>();
  private friendsButton: HTMLButtonElement | null = null;
  private friendsPanel: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    if (language === 'pt' || language === 'en') document.documentElement.lang = language;

    this.webglContainer = document.createElement('div');
    this.webglContainer.id = 'webgl';
    root.append(this.webglContainer);

    this.loader = document.createElement('div');
    this.loader.id = 'loader';
    this.loader.innerHTML = '<h1>Guinomo</h1><div class="spinner"><svg viewBox="0 0 66 66" aria-hidden="true"><circle class="path" fill="none" stroke-width="7" stroke-linecap="round" cx="33" cy="33" r="29"/></svg></div>';
    root.append(this.loader);

    this.nav = document.createElement('nav');
    this.nav.setAttribute('aria-label', language === 'en' ? 'Guinomo controls' : 'Controlos do Guinomo');
    this.nav.innerHTML = `
      <a class="button back-button" href="/" aria-label="${language === 'en' ? 'Back to Noop' : 'Voltar para Noop'}" title="${language === 'en' ? 'Back to Noop' : 'Voltar para Noop'}" data-spa="false">${backIcon}</a>
      <a class="button profile-avatar" href="/" aria-label="${language === 'en' ? 'Open my profile' : 'Abrir meu perfil'}" title="${language === 'en' ? 'My profile' : 'Meu perfil'}" data-spa="false"><img alt=""></a>
      <button class="button sound-button" type="button" aria-label="${language === 'en' ? 'Toggle sound' : 'Alternar som'}" title="${language === 'en' ? 'Toggle sound' : 'Alternar som'}"></button>
      <button class="button hat-button" type="button" aria-label="toggle hat" style="display:none;">${hatIcon}</button>
      <button class="button color-button" type="button" aria-label="${language === 'en' ? 'Randomize avatar color' : 'Randomizar cor do avatar'}" title="${language === 'en' ? 'Randomize avatar color' : 'Randomizar cor do avatar'}"><div class="color-square"></div></button>
      <button class="button name-tag-color-button" type="button" aria-label="${language === 'en' ? 'Choose name color' : 'Escolher cor do nome'}" title="${language === 'en' ? 'Choose name color' : 'Escolher cor do nome'}">Aa</button>
      <input class="name-tag-color-input" type="color" aria-label="${language === 'en' ? 'Name tag color' : 'Cor da etiqueta do nome'}" tabindex="-1">
      <button class="button about-button" type="button" aria-label="${language === 'en' ? 'About Guinomo' : 'Sobre o Guinomo'}" title="${language === 'en' ? 'About Guinomo' : 'Sobre o Guinomo'}">${infoIcon}</button>
      <div class="cnt">0/0</div>
    `;
    root.append(this.nav);

    const appPath = (window.APP_URL_PATH || '').replace(/\/+$/, '');
    const backLink = this.nav.querySelector<HTMLAnchorElement>('.back-button')!;
    backLink.href = `${appPath}/`;
    backLink.hidden = !window.APP_URL_PATH;
    backLink.dataset.transition = 'manual';
    backLink.addEventListener('click', (event) => {
      event.preventDefault();
      let previous;
      try {
        previous = document.referrer ? new URL(document.referrer) : null;
      } catch {
        previous = null;
      }
      const isNoopPage = previous?.origin === window.location.origin
        && (previous.pathname === appPath || previous.pathname.startsWith(`${appPath}/`));
      const navigate = () => isNoopPage
        ? window.history.back()
        : window.location.assign(backLink.href);
      void (window.NoopPageTransition?.cover() || Promise.resolve()).then(navigate);
    });

    const profileLink = this.nav.querySelector<HTMLAnchorElement>('.profile-avatar')!;
    const profileImage = profileLink.querySelector('img')!;
    const profile = window.GUINOMO_PROFILE;
    if (profile) {
      profileLink.href = profile.profileUrl;
      profileLink.title = profile.username;
      profileLink.setAttribute('aria-label', `Abrir perfil de ${profile.username}`);
      profileImage.src = profile.avatarUrl;
      profileImage.alt = `Avatar de ${profile.username}`;
      profileLink.dataset.spa = 'false';
    } else {
      profileLink.hidden = true;
    }

    this.soundButton = this.nav.querySelector<HTMLButtonElement>('.sound-button')!;
    this.hatButton = this.nav.querySelector<HTMLButtonElement>('.hat-button')!;
    const colorButton = this.nav.querySelector<HTMLButtonElement>('.color-button')!;
    this.nameTagColorButton = this.nav.querySelector<HTMLButtonElement>('.name-tag-color-button')!;
    const nameTagColorInput = this.nav.querySelector<HTMLInputElement>('.name-tag-color-input')!;
    const infoButton = this.nav.querySelector<HTMLButtonElement>('.about-button')!;

    this.colorSquare = colorButton.querySelector('.color-square')!;
    this.count = this.nav.querySelector('.cnt') as HTMLDivElement;
    this.soundButton.innerHTML = speakerIcon;
    nameTagColorInput.value = window.GUINOMO_PROFILE?.nameTagColor || '#e5b299';
    this.nameTagColorButton.style.backgroundColor = nameTagColorInput.value;
    this.nameTagColorButton.addEventListener('click', () => nameTagColorInput.click());
    nameTagColorInput.addEventListener('change', () => {
      this.nameTagColorButton.style.backgroundColor = nameTagColorInput.value;
      events.emit('webgl_character_set_name_tag_color', nameTagColorInput.value);
    });
    events.on('ui_name_tag_color_saved', (saved: boolean) => {
      this.nameTagColorButton.title = saved
        ? (language === 'en' ? 'Name color saved to profile' : 'Cor do nome salva no perfil')
        : (language === 'en' ? 'Unable to save name color' : 'Não foi possível salvar a cor do nome');
      this.nameTagColorButton.setAttribute('aria-invalid', saved ? 'false' : 'true');
    });

    this.soundButton.addEventListener('click', () => events.emit('webgl_audio_mute_toggle'));
    this.hatButton.addEventListener('click', () => events.emit('webgl_character_toggle_hat'));
    colorButton.addEventListener('click', () => events.emit('webgl_character_randomize_color'));
    infoButton.addEventListener('click', () => this.toggleOverlay('about'));

    // Ouvir evento para mostrar o botão de chapéu apenas para o dono
    events.on('ui_show_hat_button', (show: boolean) => {
      this.hatButton.style.display = show ? 'inline-block' : 'none';
    });

    this.createSocialSidebar(appPath);
    this.createFriendsPanel(appPath);
    this.startPresenceHeartbeat(appPath);
    this.startNotificationToasts(appPath);

    this.secretModal = document.createElement('div');
    this.secretModal.id = 'modal';
    this.secretModal.innerHTML = '<div class="cnt"><div class="bg-dark"></div><div class="bg-light"></div><article></article><button class="button-close" type="button" aria-label="close">' + closeIcon + '</button></div>';
    root.append(this.secretModal);
    this.secretPanel = this.secretModal.querySelector('article') as HTMLElement;
    this.secretModal.querySelector('button')?.addEventListener('click', () => this.closeSecret());

    this.infoModal = document.createElement('div');
    this.infoModal.id = 'info';
    this.infoModal.innerHTML = '<div class="close-hit"></div><div class="cnt"><div class="bg-dark"></div><div class="bg-light"></div><article></article><button class="button-close" type="button" aria-label="close">' + closeIcon + '</button></div>';
    root.append(this.infoModal);
    this.infoPanel = this.infoModal.querySelector('article') as HTMLElement;
    this.infoModal.querySelector('.close-hit')?.addEventListener('click', () => this.closeOverlay());
    this.infoModal.querySelector('button')?.addEventListener('click', () => this.closeOverlay());
  }

  showUnsupported() {
    this.loader.remove();
    const unsupported = document.createElement('div');
    unsupported.id = 'unsupported';
    unsupported.textContent = 'Seems like WebGL2 is not supported by your browser 😰 Please update it to access the experience.';
    this.webglContainer.parentElement?.append(unsupported);
  }

  showExperience() {
    this.loader.remove();
    this.nav.classList.add('visible');
  }

  showSecret(message: string) {
    if (this.overlayOpen) this.closeOverlay();
    this.secretPanel.textContent = message;
    this.secretModal.classList.add('visible');
    this.count.textContent = this.easterEggs + '/' + this.totalEasterEggs;
    window.clearTimeout(this.secretTimer);
    this.secretTimer = window.setTimeout(() => this.closeSecret(), 10000);
    window.setTimeout(() => { this.easterEggs = Math.min(this.totalEasterEggs, this.easterEggs + 1); this.count.textContent = this.easterEggs + '/' + this.totalEasterEggs; }, 750);
  }

  incrementEasterEggs() {
    this.totalEasterEggs += 1;
    this.count.textContent = `${this.easterEggs}/${this.totalEasterEggs}`;
  }

  setMuted(muted: boolean) {
    this.soundButton.innerHTML = muted ? speakerIcon : mutedIcon;
  }

  setCharacterColor(color: string) {
    this.colorSquare.style.backgroundColor = color;
  }

  private createSocialSidebar(appPath: string) {
    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    const links = [
      { label: language === 'en' ? 'Map' : 'Mapa', href: `${appPath}/mapa`, icon: '<path d="M12 22s8-5.4 8-12a8 8 0 1 0-16 0c0 6.6 8 12 8 12Z"/><circle cx="12" cy="10" r="2.5"/>' },
      { label: language === 'en' ? 'Friends' : 'Amigos', href: `${appPath}/index.php?open=chat`, icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { label: language === 'en' ? 'Messages' : 'Mensagens', href: `${appPath}/index.php?open=chat&view=messages`, icon: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>' },
    ];

    links.forEach(({ label, href, icon }) => {
      const link = document.createElement('a');
      link.className = 'button social-link';
      link.href = href;
      link.title = label;
      link.setAttribute('aria-label', label);
      link.dataset.spa = 'false';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = icon;
      link.append(svg);

      if ((label === 'Mensagens' || label === 'Messages') && appPath) {
        link.dataset.transition = 'manual';
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.openChatOverlay(appPath);
        });
      }
      this.nav.insertBefore(link, this.soundButton);
    });

    const friendsButton = document.createElement('button');
    friendsButton.className = 'button social-link guinomo-friends-button';
    friendsButton.type = 'button';
    friendsButton.title = language === 'en' ? 'Friends in Noop' : 'Amigos na Noop';
    friendsButton.setAttribute('aria-label', language === 'en' ? 'Friends in Noop' : 'Amigos na Noop');
    friendsButton.setAttribute('aria-expanded', 'false');
    friendsButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1H3Zm14-10a3 3 0 1 0-1-5.83M18 14a5 5 0 0 1 3 4.58V20h-4"/></svg><span class="guinomo-friends-count" hidden></span>';
    this.friendsButton = friendsButton;
    friendsButton.addEventListener('click', () => {
      const isOpen = this.friendsPanel?.classList.toggle('open') ?? false;
      friendsButton.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) void this.refreshGuinomoFriends(appPath);
    });
    this.nav.insertBefore(friendsButton, this.soundButton);

    const worldControl = document.createElement('label');
    worldControl.className = 'button social-link world-select-control';
    worldControl.title = language === 'en' ? 'Choose a world' : 'Escolher mundo';
    worldControl.setAttribute('aria-label', worldControl.title);
    worldControl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
    const worldSelect = document.createElement('select');
    worldSelect.className = 'world-select';
    worldSelect.setAttribute('aria-label', language === 'en' ? 'Choose a world' : 'Escolher mundo');
    WORLDS.forEach((world) => {
      const option = document.createElement('option');
      option.value = world.id;
      option.textContent = world.label[language === 'en' ? 'en' : 'pt'];
      worldSelect.append(option);
    });
    const params = new URLSearchParams(window.location.search);
    worldSelect.value = getWorldId(params.get('world'));
    worldSelect.addEventListener('change', () => {
      const next = new URL(window.location.href);
      if (worldSelect.value === DEFAULT_WORLD_ID) next.searchParams.delete('world');
      else next.searchParams.set('world', worldSelect.value);
      window.location.assign(next.toString());
    });
    worldControl.append(worldSelect);
    this.nav.insertBefore(worldControl, this.soundButton);

    const inviteButton = document.createElement('button');
    inviteButton.className = 'button social-link world-invite';
    inviteButton.type = 'button';
    inviteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4"/></svg>';
    const inviteLabel = language === 'en' ? 'Invite friends' : 'Convidar amigos';
    inviteButton.setAttribute('aria-label', inviteLabel);
    inviteButton.title = language === 'en' ? 'Copy a link to meet in this world' : 'Copiar link para encontrar amigos neste mundo';
    inviteButton.addEventListener('click', async () => {
      const inviteUrl = new URL(window.location.href);
      let roomCode = inviteUrl.searchParams.get('room');
      if (!roomCode) {
        const bytes = new Uint8Array(8);
        window.crypto.getRandomValues(bytes);
        roomCode = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        inviteUrl.searchParams.set('room', roomCode);
      }
      const worldId = getWorldId(inviteUrl.searchParams.get('world'));
      if (worldId === DEFAULT_WORLD_ID) inviteUrl.searchParams.delete('world');
      else inviteUrl.searchParams.set('world', worldId);

      try {
        await navigator.clipboard.writeText(inviteUrl.toString());
      } catch (error) {
        console.warn('Unable to copy Guinomo invite link:', error);
        window.prompt(
          language === 'en' ? 'Copy this world invite link:' : 'Copie este link de convite para o mundo:',
          inviteUrl.toString(),
        );
      }

      if (!params.get('room')) {
        window.location.assign(inviteUrl.toString());
        return;
      }
      const copiedLabel = language === 'en' ? 'Link copied!' : 'Link copiado!';
      inviteButton.title = copiedLabel;
      inviteButton.setAttribute('aria-label', copiedLabel);
      window.setTimeout(() => {
        inviteButton.title = language === 'en' ? 'Copy a link to meet in this world' : 'Copiar link para encontrar amigos neste mundo';
        inviteButton.setAttribute('aria-label', inviteLabel);
      }, 2200);
      });
      this.nav.insertBefore(inviteButton, this.soundButton);

      const skyTheme = document.createElement('button');
      skyTheme.className = 'button social-link sky-theme-toggle';
      skyTheme.type = 'button';
      skyTheme.title = language === 'en' ? 'Cycle day, night, and alien skies' : 'Alternar céu de dia, noite ou alienígena';
      skyTheme.setAttribute('aria-label', skyTheme.title);
      skyTheme.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
      skyTheme.addEventListener('click', () => events.emit('webgl_sky_theme_cycle'));
      this.nav.insertBefore(skyTheme, this.soundButton);
  }

  private createFriendsPanel(appPath: string) {
      const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
      const panel = document.createElement('aside');
      panel.id = 'guinomo-friends-panel';
      panel.setAttribute('aria-label', language === 'en' ? 'Friends on Noop' : 'Amigos na Noop');
      panel.innerHTML = `
        <header>
          <strong>${language === 'en' ? 'Friends on Noop' : 'Amigos na Noop'}</strong>
          <button type="button" class="guinomo-friends-close" aria-label="${language === 'en' ? 'Close friends' : 'Fechar amigos'}">×</button>
        </header>
        <p class="guinomo-friends-summary" aria-live="polite"></p>
        <div class="guinomo-friends-list" role="list"></div>
      `;
      this.friendsPanel = panel;
      panel.querySelector<HTMLButtonElement>('.guinomo-friends-close')?.addEventListener('click', () => {
        panel.classList.remove('open');
        this.friendsButton?.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !panel.classList.contains('open')) return;
        panel.classList.remove('open');
        this.friendsButton?.setAttribute('aria-expanded', 'false');
      });
      document.body.append(panel);
      void this.refreshGuinomoFriends(appPath);
      window.setInterval(() => void this.refreshGuinomoFriends(appPath), 15_000);
  }

  private async refreshGuinomoFriends(appPath: string) {
      if (!this.friendsPanel) return;

      const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
      const summary = this.friendsPanel.querySelector<HTMLElement>('.guinomo-friends-summary')!;
      const list = this.friendsPanel.querySelector<HTMLElement>('.guinomo-friends-list')!;
      try {
        const response = await fetch(`${appPath}/api/guinomo/friends`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Friends request failed (${response.status})`);
        const payload: { success?: boolean; friends?: GuinomoFriend[] } = await response.json();
        if (payload.success !== true || !Array.isArray(payload.friends)) {
          throw new Error('Friends response has an invalid shape');
        }

        const friends = payload.friends;
        const inWorld = friends.filter((friend) => friend.in_guinomo);
        const onlineCount = friends.filter((friend) => friend.is_online).length;
        summary.textContent = language === 'en'
          ? `${inWorld.length} in Guinomo · ${onlineCount} online on Noop`
          : `${inWorld.length} no Guinomo · ${onlineCount} online na Noop`;
        list.replaceChildren();

        if (friends.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guinomo-friends-empty';
          empty.textContent = language === 'en'
            ? 'No friends to show yet.'
            : 'Ainda não há amigos para mostrar.';
          list.append(empty);
        }

        for (const friend of friends) {
          const card = document.createElement('article');
          card.className = 'guinomo-friend-card';
          card.setAttribute('role', 'listitem');

          const avatar = document.createElement('img');
          avatar.src = friend.avatar;
          avatar.alt = '';
          avatar.loading = 'lazy';
          avatar.className = 'guinomo-friend-avatar';

          const details = document.createElement('div');
          details.className = 'guinomo-friend-details';
          const name = document.createElement('a');
          name.href = friend.profile_url;
          name.textContent = friend.name || friend.username;
          name.title = friend.username ? `@${friend.username}` : name.textContent || '';
          name.dataset.spa = 'false';
          const status = document.createElement('span');
          status.className = `guinomo-friend-status${friend.is_online ? ' online' : ''}`;
          if (friend.in_guinomo) {
            const worldName = friend.world === 'alien'
              ? (language === 'en' ? 'Alien Universe' : 'Universo Alienígena')
              : friend.world === 'forest'
                ? (language === 'en' ? 'Noop Forest' : 'Bosque Noop')
              : (language === 'en' ? 'Noop City' : 'Cidade Noop');
            status.textContent = language === 'en' ? `In Guinomo · ${worldName}` : `No Guinomo · ${worldName}`;
          } else {
            status.textContent = friend.is_online
              ? (language === 'en' ? 'Online on Noop' : 'Online na Noop')
              : (language === 'en' ? 'Offline' : 'Offline');
          }
          details.append(name, status);
          card.append(avatar, details);

          if (friend.in_guinomo && friend.room_url) {
            const join = document.createElement('a');
            join.className = 'guinomo-friend-join';
            join.href = friend.room_url;
            join.textContent = language === 'en' ? 'Join' : 'Encontrar';
            join.setAttribute('aria-label', language === 'en' ? `Join ${friend.username}` : `Encontrar ${friend.username}`);
            join.dataset.spa = 'false';
            card.append(join);
          }
          list.append(card);
        }

        const count = this.friendsButton?.querySelector<HTMLElement>('.guinomo-friends-count');
        if (count) {
          count.textContent = inWorld.length > 9 ? '9+' : String(inWorld.length);
          count.hidden = inWorld.length === 0;
        }
      } catch (error) {
        console.warn('Unable to load Guinomo friends:', error);
        summary.textContent = language === 'en'
          ? 'Friends are temporarily unavailable.'
          : 'Amigos temporariamente indisponíveis.';
      }
  }

  private startPresenceHeartbeat(appPath: string) {
      if (!window.GUINOMO_PROFILE || !window.GUINOMO_UID) return;

      const params = new URLSearchParams(window.location.search);
      const world = getWorldId(params.get('world'));
      const rawRoom = params.get('room') || '';
      const room = /^[a-f\d]{16}$/i.test(rawRoom) ? rawRoom.toLowerCase() : '';
      const endpoint = `${appPath}/api/guinomo/presence`;
      const tabId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0')).join('');
      const sendHeartbeat = async (active: boolean) => {
        const body = new URLSearchParams({
          csrf_token: window.CSRF_TOKEN || '',
          world,
          room,
          tab_id: tabId,
          active: active ? '1' : '0',
        });
        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
        });
        if (!response.ok) throw new Error(`Presence request failed (${response.status})`);
        const payload: { success?: boolean } = await response.json();
        if (payload.success !== true) throw new Error('Presence response has an invalid shape');
      };

      const heartbeat = () => {
        void sendHeartbeat(true).catch((error) => console.warn('Unable to update Guinomo presence:', error));
      };
      heartbeat();
      window.setInterval(heartbeat, 20_000);
      window.addEventListener('pagehide', () => {
        const body = new URLSearchParams({
          csrf_token: window.CSRF_TOKEN || '',
          world,
          room,
          tab_id: tabId,
          active: '0',
        });
        if (!navigator.sendBeacon(endpoint, body)) {
          console.warn('Unable to clear Guinomo presence when leaving the page.');
        }
      }, { once: true });
  }

  private startNotificationToasts(appPath: string) {
    if (!window.GUINOMO_PROFILE) return;

    const language = window.GUINOMO_PROFILE.language || document.documentElement.lang.slice(0, 2);
    const container = document.createElement('div');
    container.id = 'guinomo-notification-toasts';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', language === 'en' ? 'Notifications' : 'Notificações');
    document.body.append(container);

    const poll = async () => {
      try {
        const response = await fetch(`${appPath}/php/notificacoes_action.php?action=recent&limit=5`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Notification request failed (${response.status})`);
        const payload: { itens?: Array<{ id?: number; titulo?: string; texto?: string; link?: string; avatar?: string; tempo?: string }> } = await response.json();
        if (!Array.isArray(payload.itens)) throw new Error('Notification response has an invalid shape');

        for (const item of [...payload.itens].reverse()) {
          const id = Number(item.id);
          if (!Number.isInteger(id) || id <= 0 || this.notificationIds.has(id)) continue;
          this.notificationIds.add(id);
          this.showNotificationToast(container, item);
        }
      } catch (error) {
        console.warn('Unable to load Guinomo notifications:', error);
      }
    };

    void poll();
    window.setInterval(() => void poll(), 15_000);
  }

  private showNotificationToast(
    container: HTMLElement,
    item: { titulo?: string; texto?: string; link?: string; avatar?: string; tempo?: string },
  ) {
    const toast = document.createElement('a');
    toast.className = 'guinomo-notification-toast';
    toast.href = '#';
    if (item.link) {
      try {
        const destination = new URL(item.link, window.location.origin);
        if (destination.origin === window.location.origin) toast.href = destination.toString();
      } catch {
        toast.href = '#';
      }
    }

    if (item.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'notification-avatar';
      avatar.src = item.avatar;
      avatar.alt = '';
      avatar.loading = 'lazy';
      toast.append(avatar);
    }

    const content = document.createElement('span');
    content.className = 'notification-content';
    const title = document.createElement('strong');
    title.textContent = item.titulo || (window.GUINOMO_PROFILE?.language === 'en' ? 'Notification' : 'Notificação');
    const message = document.createElement('span');
    message.textContent = item.texto || '';
    content.append(title, message);
    toast.append(content);
    if (item.tempo) {
      const time = document.createElement('small');
      time.textContent = item.tempo;
      toast.append(time);
    }

    toast.addEventListener('click', (event) => {
      if (toast.getAttribute('href') === '#') event.preventDefault();
      toast.classList.add('leaving');
      window.setTimeout(() => toast.remove(), 220);
    });
    container.append(toast);
    while (container.children.length > 4) container.firstElementChild?.remove();
    window.setTimeout(() => {
      toast.classList.add('leaving');
      window.setTimeout(() => toast.remove(), 220);
    }, 6500);
  }

  private openChatOverlay(appPath: string) {
    if (this.chatOverlay) {
      this.chatOverlay.classList.add('open');
      document.documentElement.classList.add('guinomo-chat-open');
      return;
    }

    const overlay = document.createElement('section');
    overlay.id = 'noop-chat-overlay';
    overlay.setAttribute('role', 'dialog');
    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    const title = language === 'en' ? 'Messages' : 'Mensagens';
    overlay.setAttribute('aria-label', language === 'en' ? 'Noop messages' : 'Mensagens da Noop');
    overlay.innerHTML = `
      <header class="chat-overlay-header">
        <span>${title}</span>
        <button type="button" class="chat-overlay-close" aria-label="${language === 'en' ? 'Close messages' : 'Fechar mensagens'}" title="${language === 'en' ? 'Close' : 'Fechar'}">${closeIcon}</button>
      </header>
      <iframe title="${language === 'en' ? 'Noop conversations' : 'Conversas da Noop'}" referrerpolicy="same-origin"></iframe>
      <p class="chat-overlay-error" hidden>${language === 'en' ? 'Unable to load messages.' : 'Não foi possível carregar o chat.'}</p>
    `;

    const frame = overlay.querySelector<HTMLIFrameElement>('iframe')!;
    const error = overlay.querySelector<HTMLElement>('.chat-overlay-error')!;
    frame.addEventListener('load', () => {
      try {
        const document = frame.contentDocument;
        if (!document?.head) throw new Error('Chat frame document is unavailable');

        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = `${appPath}/assets/estilos/guinomo-chat-embed.css`;
        stylesheet.addEventListener('load', () => frame.classList.add('ready'), { once: true });
        stylesheet.addEventListener('error', () => {
          frame.remove();
          error.hidden = false;
        }, { once: true });
        document.head.append(stylesheet);
      } catch {
        frame.remove();
        error.hidden = false;
      }
    }, { once: true });
    frame.src = `${appPath}/index.php?open=chat`;
    overlay.querySelector<HTMLButtonElement>('.chat-overlay-close')!.addEventListener('click', () => {
      overlay.classList.remove('open');
      document.documentElement.classList.remove('guinomo-chat-open');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        overlay.classList.remove('open');
        document.documentElement.classList.remove('guinomo-chat-open');
      }
    });

    document.body.append(overlay);
    this.chatOverlay = overlay;
    document.documentElement.classList.add('guinomo-chat-open');
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  closeOverlay() {
    if (!this.overlayOpen) return;
    this.overlayOpen = false;
    this.infoModal.classList.remove('visible');
    this.nav.classList.add('visible');
    events.emit('webgl_overlay_animation', 0);
    events.emit('webgl_overlay_volume', 1);
    events.emit('webgl_character_controls_enable', true);
  }

  private toggleOverlay(name: InfoName) {
    if (this.overlayOpen) {
      this.closeOverlay();
      return;
    }
    this.overlayOpen = true;
    this.secretModal.classList.remove('visible');
    this.nav.classList.remove('visible');
    const content = infoContent[name];
    this.infoPanel.innerHTML = `<h1>${content.title}</h1>${content.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}`;
    this.infoModal.classList.add('visible');
    events.emit('webgl_overlay_animation', 1);
    events.emit('webgl_overlay_volume', 0.4);
    events.emit('webgl_character_controls_enable', false);
  }

  private closeSecret() {
    if (!this.secretModal.classList.contains('visible')) return;
    this.secretModal.classList.remove('visible');
    if (this.easterEggs >= this.totalEasterEggs) this.toggleOverlay('congrats');
  }
}
