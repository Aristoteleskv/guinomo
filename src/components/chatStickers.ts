// Chat emotes/stickers for the world chat.
//
// Stickers travel over the existing plain-text P2P chat channel as a space-free
// token (`[[sticker:<id>]]`), so there is no protocol change and remote players
// see them as long as they run the same client. Unknown tokens are rendered as
// literal text (graceful degradation with older clients).
//
// The catalog is data-driven: a sticker renders `svg` (inline, our own art) or,
// if present, `src` (any image path — e.g. a curated file under
// `public/assets/bitstrips/`). `svg`/`src` are compile-time constants from this
// module, never user input, so building the DOM from them is safe.

export interface Sticker {
  id: string;
  /** Short label shown as `title`/`aria-label`. */
  label: { pt: string; en: string };
  /** Inline SVG markup (trusted constant). */
  svg?: string;
  /** Optional image URL/path, takes precedence over `svg`. */
  src?: string;
}

const face = (inner: string, fill = '#ffd76a'): string =>
  `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
  `<circle cx="20" cy="20" r="18.5" fill="${fill}" stroke="rgba(0,0,0,.12)" stroke-width="1"/>` +
  inner +
  `</svg>`;

const eyes = (y = 16): string =>
  `<circle cx="14" cy="${y}" r="2.3" fill="#3a2f1a"/><circle cx="26" cy="${y}" r="2.3" fill="#3a2f1a"/>`;

const smile = (): string =>
  `<path d="M12.5 23.5Q20 31 27.5 23.5" fill="none" stroke="#7a3b3b" stroke-width="2.4" stroke-linecap="round"/>`;

export const STICKERS: readonly Sticker[] = [
  {
    id: 'smile',
    label: { pt: 'Sorriso', en: 'Smile' },
    svg: face(eyes() + smile()),
  },
  {
    id: 'laugh',
    label: { pt: 'Gargalhada', en: 'Laugh' },
    svg: face(
      `<path d="M11 15q3-4 6 0" fill="none" stroke="#3a2f1a" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M23 15q3-4 6 0" fill="none" stroke="#3a2f1a" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M11 22h18q-1 10-9 10t-9-10z" fill="#7a3b3b"/>` +
        `<path d="M15 27h10q-1 4-5 4t-5-4z" fill="#ff9aa0"/>`,
    ),
  },
  {
    id: 'wink',
    label: { pt: 'Piscadela', en: 'Wink' },
    svg: face(
      `<path d="M11 16h6" stroke="#3a2f1a" stroke-width="2.4" stroke-linecap="round"/>` +
        `<circle cx="26" cy="16" r="2.3" fill="#3a2f1a"/>` +
        smile(),
    ),
  },
  {
    id: 'love',
    label: { pt: 'Apaixonado', en: 'In love' },
    svg: face(
      `<path d="M14 18c-2.2-2.6-5.5-.6-5.2 1.9.2 1.9 2.7 3.3 5.2 5.1 2.5-1.8 5-3.2 5.2-5.1.3-2.5-3-4.5-5.2-1.9z" fill="#ff5c8a" transform="translate(-3.5 -4) scale(.62)"/>` +
        `<path d="M14 18c-2.2-2.6-5.5-.6-5.2 1.9.2 1.9 2.7 3.3 5.2 5.1 2.5-1.8 5-3.2 5.2-5.1.3-2.5-3-4.5-5.2-1.9z" fill="#ff5c8a" transform="translate(11.5 -4) scale(.62)"/>` +
        smile(),
    ),
  },
  {
    id: 'cool',
    label: { pt: 'Fixe', en: 'Cool' },
    svg: face(
      `<rect x="7" y="12.5" width="26" height="7.5" rx="2.4" fill="#20242b"/>` +
        `<path d="M20 14v4" stroke="#20242b" stroke-width="2.4"/>` +
        smile(),
    ),
  },
  {
    id: 'sad',
    label: { pt: 'Triste', en: 'Sad' },
    svg: face(
      `<path d="M11 13.5l6 2" stroke="#3a2f1a" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M29 13.5l-6 2" stroke="#3a2f1a" stroke-width="2" stroke-linecap="round"/>` +
        eyes(17) +
        `<path d="M13 28q7-6 14 0" fill="none" stroke="#7a3b3b" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M25 19c1.6 2.2 2.6 3.6 2.6 4.7 0 1.4-1.2 2.4-2.6 2.4s-2.6-1-2.6-2.4c0-1.1 1-2.5 2.6-4.7z" fill="#6cc8ff"/>`,
    ),
  },
  {
    id: 'party',
    label: { pt: 'Festa', en: 'Party' },
    svg: face(
      `<path d="M20 2l6 13H14z" fill="#7d5cff"/>` +
        `<circle cx="20" cy="2" r="2.4" fill="#ffd76a"/>` +
        eyes(19) +
        `<path d="M13 26q7 6 14 0" fill="none" stroke="#7a3b3b" stroke-width="2.4" stroke-linecap="round"/>`,
    ),
  },
  {
    id: 'think',
    label: { pt: 'A pensar', en: 'Thinking' },
    svg: face(
      eyes(15) +
        `<path d="M13 26h12" stroke="#7a3b3b" stroke-width="2.2" stroke-linecap="round"/>` +
        `<circle cx="33" cy="9" r="2.6" fill="#fff" opacity=".85"/>` +
        `<circle cx="36.5" cy="5" r="1.8" fill="#fff" opacity=".7"/>`,
    ),
  },
  {
    id: 'heart',
    label: { pt: 'Coração', en: 'Heart' },
    svg:
      `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<path d="M20 34C8 25 3 19 3 13.5 3 9 6.5 6 10.5 6 14 6 17 8 20 11.5 23 8 26 6 29.5 6 33.5 6 37 9 37 13.5 37 19 32 25 20 34z" fill="#ff5c8a"/></svg>`,
  },
  {
    id: 'star',
    label: { pt: 'Estrela', en: 'Star' },
    svg:
      `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<path d="M20 3l5.3 10.9 12 1.7-8.7 8.4 2.1 11.9L20 30.3 9.3 35.9l2.1-11.9L2.7 15.6l12-1.7z" fill="#ffc93c" stroke="#e0a000" stroke-width="1"/></svg>`,
  },
];

export const EMOJI: readonly string[] = [
  '😀',
  '😂',
  '😍',
  '😎',
  '😢',
  '😮',
  '👍',
  '👋',
  '🎉',
  '🔥',
  '❤️',
  '⭐',
];

const TOKEN_PREFIX = '[[sticker:';

export function stickerToken(id: string): string {
  return `${TOKEN_PREFIX}${id}]]`;
}

export function findSticker(id: string): Sticker | undefined {
  return STICKERS.find((sticker) => sticker.id === id);
}

export function isKnownSticker(id: string): boolean {
  return findSticker(id) !== undefined;
}

export type ChatSegment = { type: 'text'; value: string } | { type: 'sticker'; id: string };

/**
 * Splits a chat message into text and sticker segments. Tokens whose id is not
 * in the catalog are left as literal text, so old/foreign tokens survive.
 */
export function parseChatTokens(text: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  const re = /\[\[sticker:([a-z0-9_-]+)\]\]/g;
  let last = 0;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    const id = match[1];
    if (!isKnownSticker(id)) continue;
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    segments.push({ type: 'sticker', id });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  if (segments.length === 0) segments.push({ type: 'text', value: text });
  return segments;
}

/** Builds the DOM node for a sticker, or `null` when the id is unknown. */
export function createStickerNode(id: string): HTMLSpanElement | null {
  const sticker = findSticker(id);
  if (!sticker) return null;
  const wrap = document.createElement('span');
  wrap.className = 'guinomo-chat-sticker-inline';
  wrap.dataset.sticker = id;
  if (sticker.src) {
    const img = document.createElement('img');
    img.className = 'guinomo-chat-sticker-img';
    img.src = sticker.src;
    img.alt = '';
    wrap.append(img);
  } else if (sticker.svg) {
    wrap.innerHTML = sticker.svg;
  }
  return wrap;
}
