// Explorer seals album: one collectible stamp per hidden secret, with rarity.
// The panel reads the same localStorage as the secrets themselves
// (guinomo_secrets) and live-updates when a new one is found.

import { WORLDS, type WorldId } from '../core/worlds';
import { events } from '../core/events';
import { isGrandSecretUnlocked, readFoundSecrets, readGoldenSeals } from '../core/secrets';
import { badgeChipsSlot } from '../components/badgeSlot';
import './album.css';

type Rarity = 'common' | 'rare' | 'legendary';

interface Seal {
  /** Stable id — mirrors the persisted secret id in setpieces.ts. */
  id: string;
  icon: string;
  label: { pt: string; en: string };
  world: WorldId;
  rarity: Rarity;
  hint: { pt: string; en: string };
}

const SEALS: Seal[] = [
  {
    id: "It's a big metallic object. You want to believe it's some kind of vehicle.",
    icon: '🛸',
    label: { pt: 'O Objeto Metálico', en: 'The Metallic Object' },
    world: 'lobby',
    rarity: 'legendary',
    hint: { pt: 'Mantém os olhos no céu…', en: 'Keep an eye on the sky…' },
  },
  {
    id: "It's a very pale and strange looking man. He probably spends too much time on the computer.",
    icon: '👽',
    label: { pt: 'O Homem Pálido', en: 'The Pale Man' },
    world: 'alien',
    rarity: 'rare',
    hint: { pt: 'Procura por quem veio de muito longe.', en: 'Look for someone who came from very far.' },
  },
  {
    id: "If these two white cats weren't next to each other it would seem like they were the same one.",
    icon: '🐱',
    label: { pt: 'Os Dois Gatos', en: 'The Two Cats' },
    world: 'tropical-city',
    rarity: 'common',
    hint: { pt: 'Os gatos adoram as palmeiras tropicais.', en: 'The cats love the tropical palms.' },
  },
  {
    id: 'A sloth? That permanent smile it has is so creepy. What is it doing there?',
    icon: '🦥',
    label: { pt: 'A Preguiça', en: 'The Sloth' },
    world: 'forest',
    rarity: 'common',
    hint: { pt: 'Alguém preguiçoso esconde-se entre as árvores.', en: 'A lazy someone hides among the trees.' },
  },
  {
    id: 'These things look as if they have been taken out of a video game.',
    icon: '🗣️',
    label: { pt: 'As Comadres', en: 'The Gossips' },
    world: 'old-town',
    rarity: 'rare',
    hint: { pt: 'As comadres da praça contam tudo…', en: 'The town gossips tell everything…' },
  },
];

const RARITY_LABEL: Record<Rarity, { pt: string; en: string }> = {
  common: { pt: 'Comum', en: 'Common' },
  rare: { pt: 'Raro', en: 'Rare' },
  legendary: { pt: 'Lendário', en: 'Legendary' },
};

function uiLanguage(): string {
  return window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
}

/** The 5/5 finale seal: a trophy instead of a world-stamped keepsake. */
const MASTER_SEAL = {
  icon: '👑',
  label: { pt: 'Mestre dos Segredos', en: 'Master of Secrets' },
} as const;

function renderAlbum(panel: HTMLDivElement, english: boolean): void {
  const found = new Set(readFoundSecrets());
  const goldenFound = new Set(readGoldenSeals());
  const grandUnlocked = isGrandSecretUnlocked();
  const total = SEALS.length + 1;
  const count = SEALS.filter((seal) => found.has(seal.id)).length + (grandUnlocked ? 1 : 0);

  const title =
    count === total ? (english ? 'Complete collection!' : 'Coleção completa!') : english ? 'Explorer seals' : 'Selos de explorador';

  const cards = SEALS.map((seal) => {
    const isFound = found.has(seal.id);
    const isGolden = isFound && goldenFound.has(seal.id);
    const world = WORLDS.find((entry) => entry.id === seal.world);
    const worldLabel = english ? world?.label.en : world?.label.pt;
    const rarity = english ? RARITY_LABEL[seal.rarity].en : RARITY_LABEL[seal.rarity].pt;
    const name = english ? seal.label.en : seal.label.pt;
    const hint = isGolden
      ? english
        ? 'Found during golden hour'
        : 'Encontrado na hora dourada'
      : isFound
        ? english
          ? 'Found'
          : 'Encontrado'
        : english
          ? seal.hint.en
          : seal.hint.pt;

    return `
      <article class="album-seal ${isFound ? 'found' : ''} ${isGolden ? 'golden' : ''} rarity-${seal.rarity}">
        ${isGolden ? '<span class="album-seal-gold" aria-hidden="true">✨</span>' : ''}
        ${isFound ? '<span class="album-seal-check" aria-hidden="true">✓</span>' : ''}
        <div class="album-seal-icon" aria-hidden="true">${seal.icon}</div>
        <h3>${name}</h3>
        <span class="album-seal-meta">${world ? world.icon : ''} ${worldLabel ?? seal.world} · ${rarity}</span>
        <p class="album-seal-hint">${hint}</p>
      </article>`;
  }).join('');

  // The Grand Secret finale seal: secretly locked until the 5/5 moment.
  const masterName = english ? MASTER_SEAL.label.en : MASTER_SEAL.label.pt;
  const masterHint = grandUnlocked
    ? english
      ? 'Found all 5 secrets'
      : 'Encontrou os 5 segredos'
    : english
      ? 'Find all 5 secrets to unlock it.'
      : 'Encontra os 5 segredos para o desbloquear.';
  const masterCard = `
    <article class="album-seal ${grandUnlocked ? 'found ' : ''}rarity-legendary master">
      ${grandUnlocked ? '<span class="album-seal-check" aria-hidden="true">✓</span>' : ''}
      <div class="album-seal-icon" aria-hidden="true">${grandUnlocked ? MASTER_SEAL.icon : '🔒'}</div>
      <h3>${grandUnlocked ? masterName : '???'}</h3>
      <span class="album-seal-meta">✨ ${english ? 'Grand Secret · Legendary' : 'Grande Segredo · Lendário'}</span>
      <p class="album-seal-hint">${masterHint}</p>
    </article>`;

  panel.innerHTML = `
    <div class="album-panel">
      <header class="album-header">
        <div>
          <h2>${title}</h2>
          <span class="album-progress">${count}/${total}</span>
        </div>
        <button class="album-close" type="button" aria-label="${english ? 'Close' : 'Fechar'}">×</button>
      </header>
      <div class="album-grid">${cards}${masterCard}</div>
    </div>`;
}

/** Mounts the floating seal button (bottom-left) and its overlay panel. */
export function mountAlbum(): void {
  if (document.getElementById('album-btn')) return;

  const english = uiLanguage() === 'en';

  const button = document.createElement('button');
  button.id = 'album-btn';
  button.type = 'button';
  button.setAttribute('aria-label', english ? 'Explorer seals' : 'Selos de explorador');
  button.title = english ? 'Explorer seals' : 'Selos de explorador';
  button.textContent = '🏅';

  const panel = document.createElement('div');
  panel.id = 'album-overlay';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', english ? 'Explorer seals' : 'Selos de explorador');

  const close = () => {
    panel.hidden = true;
  };
  const toggle = () => {
    if (panel.hidden) {
      renderAlbum(panel, uiLanguage() === 'en');
      panel.hidden = false;
    } else {
      close();
    }
  };

  button.addEventListener('click', toggle);
  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === panel || target.closest('.album-close')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      close();
    }
  });
  events.on('webgl_secret_found', () => {
    if (!panel.hidden) renderAlbum(panel, uiLanguage() === 'en');
  });
  events.on('webgl_grand_secret_unlocked', () => {
    if (!panel.hidden) renderAlbum(panel, uiLanguage() === 'en');
  });

  // With a visible identity card the seal button lives inside the badge as a
  // small chip; otherwise it keeps the floating bottom-left circle.
  const host = badgeChipsSlot();
  if (host) {
    button.classList.add('in-badge');
    host.append(button);
  } else {
    document.body.append(button);
  }
  document.body.append(panel);
}