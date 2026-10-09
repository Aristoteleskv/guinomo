import { events } from '../core/events';
import { DEFAULT_WORLD_ID, getWorldId, WORLDS } from '../core/worlds';
import { playSfx } from '../engine/sfx';

const speakerIcon = '<svg class="sound sound2" viewBox="0 0 17 13" aria-hidden="true"><path d="M10.189 0.228 6.13 3.332H4.168c-.512 0-.938.41-.938.938v4.384c0 .165.043.321.118.457L.816 10.907a1 1 0 1 0 1.157 1.631l4.153-2.946h.021l.026.02 5.756-4.082v-.054l3.694-2.62a1 1 0 0 0-1.157-1.631l-2.537 1.8V1.08c-.017-.904-1.041-1.399-1.74-.853Z" fill="#716C66"/></svg>';
const mutedIcon = '<svg class="sound sound2" viewBox="0 0 17 13" aria-hidden="true"><path d="M6.96.228 2.9 3.332H.938A.94.94 0 0 0 0 4.27v4.384c0 .511.41.938.938.938h1.979l4.042 3.104a1 1 0 0 0 1.74-.853V1.08C8.682.177 7.659-.318 6.96.228Z" fill="#716C66"/></svg>';
const infoIcon = '<svg class="info" viewBox="0 0 4 18" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2 2v6.818a2 2 0 1 1-4 0V8a2 2 0 0 1 2-2ZM4 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" fill="#716C66"/></svg>';
const hatIcon = '<svg class="hat" viewBox="0 0 20 20" style="width:18px;height:18px;" aria-hidden="true"><path d="M17 13v-2c0-3.866-3.134-7-7-7S3 7.134 3 11v2a4 4 0 0 0-4 4h20a4 4 0 0 0-4-4Z" fill="#716C66"/></svg>';
const closeIcon = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m1.5 1.5 15 15m0-15-15 15" stroke="#989389" stroke-width="2" stroke-linecap="round"/></svg>';
const backIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6M7 10h10" fill="none" stroke="#716C66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const guideIcon = '<svg viewBox="0 0 20 20" style="width:16px;height:16px;" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="#716C66" stroke-width="1.6"/><path d="M7.9 7.6a2.1 2.1 0 0 1 4.2.5c0 1.3-2 1.7-2 3M10 14.3h.01" fill="none" stroke="#716C66" stroke-width="1.6" stroke-linecap="round"/></svg>';
const mapIcon = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" fill="none" stroke="#716C66" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 4v14m6-12v14" stroke="#716C66" stroke-width="1.6"/></svg>';
const chatIcon = '<svg viewBox="0 0 24 24" style="width:17px;height:17px;" aria-hidden="true"><path d="M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9.5L4.5 21.5V5.5a1 1 0 0 1 .5-1Z" fill="none" stroke="#716C66" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.5" cy="10.8" r="1" fill="#716C66"/><circle cx="12" cy="10.8" r="1" fill="#716C66"/><circle cx="15.5" cy="10.8" r="1" fill="#716C66"/></svg>';

const infoContent = {
  about: {
    title: 'Guinomo',
    paragraphs: [
      'Bem-vindo ao Guinomo, um espaço relaxante da comunidade Noop. Explore, descanse e descubra os segredos escondidos nestes mundos procedurais.',
      'Existem 5 segredos espalhados pelos diferentes mundos. Consegues encontrar todos?',
      'Dica: abre o Mapa de Mundos para veres a pista de cada cidade.',
    ],
  },
  congrats: {
    title: 'Parabéns! Encontraste os 5 segredos!',
    paragraphs: [
      "Exploraste todos os cantos deste experimento. Como recompensa, o teu nome agora tem um crachá dourado.",
      "Obrigado por fazeres parte da Noop. Aproveita o pôr do sol! ☀️",
    ],
  },
} as const;

const onboardingContent = {
  en: 'Use WASD to move, E to rest, and H for your hat! 🏖️',
  pt: 'Usa WASD para andar, E para descansar e H para o chapéu! 🏖️',
};

const guideContent = {
  pt: {
    title: 'Guia do Guinomo',
    steps: [
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — anda pelo mundo',
      '<kbd>E</kbd> — descansa junto ao fogo ou à sombra',
      '<kbd>H</kbd> — mostra ou esconde o teu chapéu',
      '<kbd>Shift</kbd> — corre; o rato (ou o toque) roda a câmara',
      '<kbd>Esc</kbd> — fecha esta janela e as outras',
      '🎁 Há segredos escondidos nos mundos — encontra os 5 para ganhares o crachá dourado. O Mapa de Mundos tem uma pista para cada cidade.',
    ],
    multi: '👥 <b>Multiplayer:</b> partilha o link desta página para encontrar os teus amigos no mesmo mundo e conversa com eles no chat do mundo.',
    map: '🗺️ <b>Mapa:</b> viaja entre os 6 mundos e escolhe o teu papel no mapa de mundos.',
  },
  en: {
    title: 'Guinomo Guide',
    steps: [
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — move around',
      '<kbd>E</kbd> — rest by the fire or in the shade',
      '<kbd>H</kbd> — toggle your hat',
      '<kbd>Shift</kbd> — run; the mouse (or touch) rotates the camera',
      '<kbd>Esc</kbd> — closes this and other windows',
      '🎁 There are hidden secrets in the worlds — find all 5 to earn your golden badge. The World Map has a hint for every city.',
    ],
    multi: '👥 <b>Multiplayer:</b> share a link to this page to meet your friends in the same world and talk with them in the world chat.',
    map: '🗺️ <b>Map:</b> travel between the 6 worlds and pick your role from the world map.',
  },
} as const;

const avatarRoles = [
  { id: 'explorer', icon: '🧭', label: { pt: 'Explorador', en: 'Explorer' } },
  { id: 'artist', icon: '🎨', label: { pt: 'Artista', en: 'Artist' } },
  { id: 'builder', icon: '🔨', label: { pt: 'Construtor', en: 'Builder' } },
  { id: 'dreamer', icon: '🌙', label: { pt: 'Sonhador', en: 'Dreamer' } },
  { id: 'guide', icon: '🧑‍🏫', label: { pt: 'Guia', en: 'Guide' } },
  { id: 'hunter', icon: '🌟', label: { pt: 'Caçador de Segredos', en: 'Secret Hunter' } },
  { id: 'none', icon: '🙂', label: { pt: 'Sem papel', en: 'No role' } },
] as const;

type InfoName = keyof typeof infoContent;

/** Default language is Portuguese; only an explicit profile `'en'` switches the
 *  interface to English. */
function getLanguage(): 'pt' | 'en' {
  return window.GUINOMO_PROFILE?.language === 'en' ? 'en' : 'pt';
}

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
  /** Left-side identity card: photo + username + elements found. */
  private readonly badge: HTMLDivElement;
  private chatOverlay: HTMLElement | null = null;
  private easterEggs = 0;
  private totalEasterEggs = 0;
  private rewardGranted = false;
  private congratsShown = false;
  private overlayOpen = false;
  private pendingOnboardingToast = false;
  private secretTimer = 0;
  private notificationIds = new Set<number>();
  private chatButton: HTMLButtonElement | null = null;
  private chatPanel: HTMLElement | null = null;
  private chatUnread = 0;
  private chatTypingTimer = 0;

  constructor(root: HTMLElement) {
    const language = getLanguage();
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
      <button class="button sound-button" type="button" aria-label="${language === 'en' ? 'Toggle sound' : 'Alternar som'}" title="${language === 'en' ? 'Toggle sound' : 'Alternar som'}"></button>
      <button class="button hat-button" type="button" aria-label="toggle hat" style="display:none;">${hatIcon}</button>
      <button class="button color-button" type="button" aria-label="${language === 'en' ? 'Randomize avatar color' : 'Randomizar cor do avatar'}" title="${language === 'en' ? 'Randomize avatar color' : 'Randomizar cor do avatar'}"><div class="color-square"></div></button>
      <button class="button name-tag-color-button" type="button" aria-label="${language === 'en' ? 'Choose name color' : 'Escolher cor do nome'}" title="${language === 'en' ? 'Choose name color' : 'Escolher cor do nome'}">Aa</button>
      <input class="name-tag-color-input" type="color" aria-label="${language === 'en' ? 'Name tag color' : 'Cor da etiqueta do nome'}" tabindex="-1">
      <button class="button about-button" type="button" aria-label="${language === 'en' ? 'About Guinomo' : 'Sobre o Guinomo'}" title="${language === 'en' ? 'About Guinomo' : 'Sobre o Guinomo'}">${infoIcon}</button>
      <button class="button guide-button" type="button" aria-label="${language === 'en' ? 'Help and guide' : 'Ajuda e guia'}" title="${language === 'en' ? 'Help and guide' : 'Ajuda e guia'}">${guideIcon}</button>
      <button class="button map-button" type="button" aria-label="${language === 'en' ? 'World map' : 'Mapa de mundos'}" title="${language === 'en' ? 'World map' : 'Mapa de mundos'}">${mapIcon}</button>
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

    const profile = window.GUINOMO_PROFILE;

    // Identity card on the left: photo, username, and the number of elements
    // (secrets) found. Falls back to the module-level counter target.
    const badge = document.createElement('div');
    badge.className = 'guinomo-badge';
    badge.innerHTML = `
      <a class="guinomo-badge-avatar" data-spa="false"><img alt=""></a>
      <div class="guinomo-badge-meta">
        <a class="guinomo-badge-name" data-spa="false"></a>
        <span class="guinomo-badge-count">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1 5.7-4.9-2.7-4.9 2.7 1-5.7L4 8.9l5.6-.7L12 3Z" fill="#716C66"/></svg>
          <span class="cnt">0/0</span>
          <em>${language === 'en' ? 'elements' : 'elementos'}</em>
        </span>
      </div>
    `;
    root.append(badge);
    this.badge = badge;
    this.count = badge.querySelector<HTMLDivElement>('.cnt')!;
    if (profile) {
      const avatar = badge.querySelector<HTMLAnchorElement>('.guinomo-badge-avatar')!;
      const image = avatar.querySelector('img')!;
      const name = badge.querySelector<HTMLAnchorElement>('.guinomo-badge-name')!;
      avatar.href = profile.profileUrl;
      avatar.title = profile.username;
      image.src = profile.avatarUrl;
      image.alt = `Avatar de ${profile.username}`;
      name.href = profile.profileUrl;
      name.textContent = `@${profile.username}`;
      name.title = profile.username;
      badge.hidden = false;
    } else {
      badge.hidden = true;
      badge.style.display = 'none';
    }

    this.soundButton = this.nav.querySelector<HTMLButtonElement>('.sound-button')!;
    this.hatButton = this.nav.querySelector<HTMLButtonElement>('.hat-button')!;
    const colorButton = this.nav.querySelector<HTMLButtonElement>('.color-button')!;
    this.nameTagColorButton = this.nav.querySelector<HTMLButtonElement>('.name-tag-color-button')!;
    const nameTagColorInput = this.nav.querySelector<HTMLInputElement>('.name-tag-color-input')!;
    const infoButton = this.nav.querySelector<HTMLButtonElement>('.about-button')!;

    this.colorSquare = colorButton.querySelector('.color-square')!;
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
    const guideButton = this.nav.querySelector<HTMLButtonElement>('.guide-button')!;
    const mapButton = this.nav.querySelector<HTMLButtonElement>('.map-button')!;
    guideButton.addEventListener('click', () => this.openGuide());
    mapButton.addEventListener('click', () => this.openWorldMap());

    // Ouvir evento para mostrar o botão de chapéu apenas para o dono
    events.on('ui_show_hat_button', (show: boolean) => {
      this.hatButton.style.display = show ? 'inline-block' : 'none';
    });

    this.createSocialSidebar(appPath);
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
    this.badge.classList.add('visible');

    // First-time visitors get the full guide overlay instead of the toast; the
    // toast is deferred until the guide is dismissed. The ?audit hook is left
    // untouched so the E2E matrix stays deterministic.
    const params = new URLSearchParams(window.location.search);
    if (!params.has('audit') && !this.guideSeen()) {
      this.markGuideSeen();
      this.pendingOnboardingToast = true;
      window.setTimeout(() => this.openGuide(), 900);
      return;
    }
    this.showOnboardingToast();
  }

  private guideSeen(): boolean {
    try {
      return localStorage.getItem('guinomo.guide.v1') === '1';
    } catch {
      return true;
    }
  }

  private markGuideSeen(): void {
    try {
      localStorage.setItem('guinomo.guide.v1', '1');
    } catch {
      // Private mode: keep the guide off rather than throwing.
    }
  }

  private showOnboardingToast() {
    const language = getLanguage();
    const toast = document.createElement('div');
    toast.className = 'guinomo-onboarding-toast';
    toast.textContent = onboardingContent[language === 'pt' ? 'pt' : 'en'];
    document.body.append(toast);

    setTimeout(() => {
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 500);
      }, 8000);
    }, 2000);
  }

  showSecret(message: string) {
    playSfx('secret');
    if (this.overlayOpen) this.closeOverlay();
    this.secretPanel.textContent = message;
    this.secretModal.classList.add('visible');
    this.count.textContent = this.easterEggs + '/' + this.totalEasterEggs;
    window.clearTimeout(this.secretTimer);
    this.secretTimer = window.setTimeout(() => this.closeSecret(), 10000);
    window.setTimeout(() => {
      this.easterEggs = Math.min(this.totalEasterEggs, this.easterEggs + 1);
      this.count.textContent = this.easterEggs + '/' + this.totalEasterEggs;
      this.maybeGrantReward(false);
    }, 750);
  }

  incrementEasterEggs(alreadyFound = false) {
    this.totalEasterEggs += 1;
    if (alreadyFound) this.easterEggs += 1;
    this.count.textContent = `${this.easterEggs}/${this.totalEasterEggs}`;
    // Secrets found in earlier sessions are restored from localStorage, so the
    // reward must be re-applied on load instead of only when a modal closes.
    this.maybeGrantReward(false);
  }

  /** Applies the all-secrets reward once, and the congrats overlay at most once. */
  private maybeGrantReward(showCongrats: boolean) {
    if (this.totalEasterEggs <= 0 || this.easterEggs < this.totalEasterEggs) return;
    if (!this.rewardGranted) {
      this.rewardGranted = true;
      events.emit('webgl_all_secrets_found');
    }
    if (showCongrats && !this.congratsShown) {
      this.congratsShown = true;
      this.toggleOverlay('congrats');
    }
  }

  setMuted(muted: boolean) {
    this.soundButton.innerHTML = muted ? speakerIcon : mutedIcon;
  }

  setCharacterColor(color: string) {
    this.colorSquare.style.backgroundColor = color;
  }

  private createSocialSidebar(appPath: string) {
    const language = getLanguage();
    const links = [
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

    const chatLabel = language === 'en' ? 'World chat' : 'Chat do mundo';
    const chatButton = document.createElement('button');
    chatButton.className = 'button social-link guinomo-chat-button';
    chatButton.type = 'button';
    chatButton.title = chatLabel;
    chatButton.setAttribute('aria-label', chatLabel);
    chatButton.innerHTML = `${chatIcon}<span class="guinomo-chat-badge" hidden></span>`;
    this.chatButton = chatButton;
    chatButton.addEventListener('click', () => this.toggleChat());
    this.nav.insertBefore(chatButton, this.soundButton);
    this.createChatPanel();

    const skyTheme = document.createElement('button');
      skyTheme.className = 'button social-link sky-theme-toggle';
      skyTheme.type = 'button';
      skyTheme.title = language === 'en' ? 'Cycle day, night, and alien skies' : 'Alternar céu de dia, noite ou alienígena';
      skyTheme.setAttribute('aria-label', skyTheme.title);
      skyTheme.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
      skyTheme.addEventListener('click', () => events.emit('webgl_sky_theme_cycle'));
      this.nav.insertBefore(skyTheme, this.soundButton);
  }

  private createChatPanel() {
      const language = getLanguage();
      const panel = document.createElement('section');
      panel.id = 'guinomo-room-chat';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', language === 'en' ? 'World chat' : 'Chat do mundo');
      panel.innerHTML = `
        <header>
          <strong>${language === 'en' ? 'World chat' : 'Chat do mundo'}</strong>
          <span class="guinomo-chat-status">${language === 'en' ? 'Connecting…' : 'A ligar…'}</span>
          <button type="button" class="guinomo-chat-close" aria-label="${language === 'en' ? 'Close chat' : 'Fechar chat'}">×</button>
        </header>
        <div class="guinomo-chat-messages" aria-live="polite"></div>
        <p class="guinomo-chat-typing" hidden></p>
        <form class="guinomo-chat-form" novalidate>
          <input class="guinomo-chat-input" maxlength="200" autocomplete="off"
            aria-label="${language === 'en' ? 'Write a message' : 'Escreve uma mensagem'}"
            placeholder="${language === 'en' ? 'Say something to the world…' : 'Diz algo ao mundo…'}">
          <button type="submit" class="guinomo-chat-send">${language === 'en' ? 'Send' : 'Enviar'}</button>
        </form>
      `;
      panel.hidden = true;
      document.body.append(panel);
      this.chatPanel = panel;

      panel.querySelector<HTMLButtonElement>('.guinomo-chat-close')?.addEventListener('click', () => this.closeChat());
      panel.querySelector<HTMLFormElement>('.guinomo-chat-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        this.sendChatMessage();
      });
      const input = panel.querySelector<HTMLInputElement>('.guinomo-chat-input');
      input?.addEventListener('input', () => {
        // Signal "typing" once per burst, when the box goes from empty to text.
        if (input.value.trim() && input.dataset.typingSent !== '1') {
          input.dataset.typingSent = '1';
          events.emit('p2p_typing_send');
          window.setTimeout(() => { input.dataset.typingSent = '0'; }, 1500);
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !panel || panel.hidden) return;
        this.closeChat();
      });

      events.on('p2p_chat', (chat: { uid?: number; name?: string; text?: string }) => this.receiveChatMessage(chat));
      events.on('p2p_typing', (typing: { uid?: number; name?: string }) => this.showTyping(typing.name || ''));
      events.on('p2p_ready', (ready: boolean) => this.setChatStatus(ready === true));
  }

  private toggleChat() {
      if (!this.chatPanel) return;
      if (this.chatPanel.hidden) {
        this.chatPanel.hidden = false;
        this.chatUnread = 0;
        this.updateChatBadge();
        const input = this.chatPanel.querySelector<HTMLInputElement>('.guinomo-chat-input');
        input?.focus();
      } else {
        this.closeChat();
      }
  }

  private closeChat() {
      if (!this.chatPanel || this.chatPanel.hidden) return;
      this.chatPanel.hidden = true;
  }

  private receiveChatMessage(chat: { uid?: number; name?: string; text?: string }) {
      if (!this.chatPanel) return;
      const language = getLanguage();
      const name = (chat.name || '').trim() || (language === 'en' ? 'Guest' : 'Visitante');
      const text = (chat.text || '').trim();
      if (!text) return;
      this.appendChatMessage(name, text, false);
      if (this.chatPanel.hidden) {
        this.chatUnread += 1;
        this.updateChatBadge();
      }
  }

  private appendChatMessage(name: string, text: string, own: boolean) {
      if (!this.chatPanel) return;
      const list = this.chatPanel.querySelector<HTMLElement>('.guinomo-chat-messages');
      if (!list) return;
      const bubble = document.createElement('div');
      bubble.className = `guinomo-chat-msg${own ? ' own' : ''}`;
      const sender = document.createElement('span');
      sender.className = 'guinomo-chat-msg-name';
      sender.textContent = name;
      const body = document.createElement('span');
      body.className = 'guinomo-chat-msg-text';
      body.textContent = text;
      bubble.append(sender, body);
      list.append(bubble);
      list.scrollTop = list.scrollHeight;
      while (list.children.length > 80) list.firstElementChild?.remove();
  }

  private sendChatMessage() {
      if (!this.chatPanel) return;
      const language = getLanguage();
      const input = this.chatPanel.querySelector<HTMLInputElement>('.guinomo-chat-input');
      if (!input) return;
      const text = input.value.replace(/\s+/g, ' ').trim();
      input.value = '';
      if (!text) return;
      const name = window.GUINOMO_PROFILE?.username?.trim()
        || (language === 'en' ? 'You' : 'Tu');
      events.emit('p2p_send_chat', text);
      this.appendChatMessage(name, text, true);
  }

  private showTyping(name: string) {
      if (!this.chatPanel) return;
      const typing = this.chatPanel.querySelector<HTMLElement>('.guinomo-chat-typing');
      if (!typing) return;
      const language = getLanguage();
      const clean = name.trim() || (language === 'en' ? 'Someone' : 'Alguém');
      typing.textContent = `${clean} ${language === 'en' ? 'is typing…' : 'está a escrever…'}`;
      typing.hidden = false;
      window.clearTimeout(this.chatTypingTimer);
      this.chatTypingTimer = window.setTimeout(() => {
        typing.hidden = true;
        typing.textContent = '';
      }, 2500);
  }

  private setChatStatus(ready: boolean) {
      if (!this.chatPanel) return;
      const language = getLanguage();
      const status = this.chatPanel.querySelector<HTMLElement>('.guinomo-chat-status');
      if (!status) return;
      status.textContent = ready
        ? (language === 'en' ? 'In world' : 'No mundo')
        : (language === 'en' ? 'Offline' : 'Offline');
      status.classList.toggle('online', ready);
  }

  private updateChatBadge() {
      if (!this.chatButton) return;
      const badge = this.chatButton.querySelector<HTMLElement>('.guinomo-chat-badge');
      if (!badge) return;
      badge.textContent = this.chatUnread > 9 ? '9+' : String(this.chatUnread);
      badge.hidden = this.chatUnread === 0;
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

    const language = getLanguage();
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
    const language = getLanguage();
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
    playSfx('close');
    this.infoModal.classList.remove('visible');
    this.nav.classList.add('visible');
    this.badge.classList.add('visible');
    events.emit('webgl_overlay_animation', 0);
    events.emit('webgl_overlay_volume', 1);
    events.emit('webgl_character_controls_enable', true);
    if (this.pendingOnboardingToast) {
      this.pendingOnboardingToast = false;
      this.showOnboardingToast();
    }
  }

  private showInfoPanel(html: string) {
    if (this.overlayOpen) {
      this.closeOverlay();
      return;
    }
    this.overlayOpen = true;
    this.secretModal.classList.remove('visible');
    this.nav.classList.remove('visible');
    this.badge.classList.remove('visible');
    this.infoPanel.innerHTML = html;
    this.infoModal.classList.add('visible');
    events.emit('webgl_overlay_animation', 1);
    events.emit('webgl_overlay_volume', 0.4);
    events.emit('webgl_character_controls_enable', false);
  }

  private toggleOverlay(name: InfoName) {
    const content = infoContent[name];
    playSfx('open');
    const paragraphs = name === 'about'
      ? [...content.paragraphs, `Desenvolvido com ❤️ pela equipa Noop e @${window.GUINOMO_PROFILE?.username || 'Noop'}.`]
      : content.paragraphs;
    this.showInfoPanel(`<h1>${content.title}</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}`);
  }

  private openGuide() {
    playSfx('guide');
    const language = getLanguage();
    const text = guideContent[language === 'pt' ? 'pt' : 'en'];
    const steps = text.steps.map((step) => `<p class="guide-step">${step}</p>`).join('');
    this.showInfoPanel(
      `<h1>${text.title}</h1><div class="overlay-guide">${steps}<p>${text.multi}</p><p>${text.map}</p></div>`,
    );
  }

  private openWorldMap() {
    playSfx('open');
    const language = getLanguage();
    const lang = language === 'en' ? 'en' : 'pt';
    const currentWorld = getWorldId(new URLSearchParams(window.location.search).get('world'));
    const cards = WORLDS.map((world) => {
      const current = world.id === currentWorld;
      const travel = current
        ? (language === 'en' ? 'Here' : 'Aqui')
        : (language === 'en' ? 'Visit' : 'Visitar');
      return `
        <li class="world-card${current ? ' current' : ''}" data-world="${world.id}">
          <span class="world-icon" aria-hidden="true">${world.icon}</span>
          <div class="world-info">
            <strong>${world.label[lang]}</strong>
            <span class="world-desc">${world.description[lang]}</span>
            <span class="world-hint">${language === 'en' ? 'Hint' : 'Dica'}: ${world.hint[lang]}</span>
          </div>
          <button type="button" class="world-travel" data-world="${world.id}">${travel}</button>
        </li>`;
    }).join('');
    const chips = avatarRoles.map((role) => {
      const active = role.id === this.currentRole();
      return `<button type="button" class="role-chip${active ? ' active' : ''}" data-role="${role.id}">${role.icon} ${role.label[lang]}</button>`;
    }).join('');

    const panel = this.infoPanel;
    this.showInfoPanel(
      `<h1>${language === 'en' ? 'World map' : 'Mapa de mundos'}</h1>`
      + `<ul class="world-list">${cards}</ul>`
      + `<h2 class="role-title">${language === 'en' ? 'Choose who you want to be' : 'Escolhe quem queres ser'}</h2>`
      + `<div class="role-chips">${chips}</div>`,
    );
    if (this.overlayOpen) {
      panel.querySelectorAll<HTMLButtonElement>('.world-travel').forEach((button) => {
        button.addEventListener('click', () => this.travelTo(button.dataset.world || DEFAULT_WORLD_ID));
      });
      panel.querySelectorAll<HTMLButtonElement>('.role-chip').forEach((chip) => {
        chip.addEventListener('click', () => this.selectRole(chip.dataset.role || ''));
      });
    }
  }

  private currentRole(): string {
    try {
      return localStorage.getItem('guinomo.role.v1') || '';
    } catch {
      return '';
    }
  }

  private selectRole(roleId: string) {
    const role = roleId === 'none' ? '' : roleId;
    try {
      localStorage.setItem('guinomo.role.v1', role);
    } catch {
      // Private mode: the role still applies for this session only.
    }
    events.emit('webgl_character_set_role', role);
    this.closeOverlay();
  }

  private travelTo(worldId: string) {
    const next = new URL(window.location.href);
    if (worldId === DEFAULT_WORLD_ID) next.searchParams.delete('world');
    else next.searchParams.set('world', worldId);
    playSfx('travel');
    window.location.assign(next.toString());
  }

  private closeSecret() {
    if (!this.secretModal.classList.contains('visible')) return;
    this.secretModal.classList.remove('visible');
    this.maybeGrantReward(true);
  }
}
