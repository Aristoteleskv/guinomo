// Poster/photo mode: captures the current frame, wraps it in a polaroid-style
// paper frame (with a world caption) and downloads the result as a PNG.
//
// Contract (frozen):
//   engine.requestFrameCapture(): Promise<HTMLCanvasElement>  // integrator provides
//   capturePoster(opts?): Promise<Blob>
//   downloadPoster(blob, filename): void
//   mountPosterButton(): void                                  // called by main.ts

import './photo.css';
import { engine } from './globals';
import { events } from '../core/events';
import { getWorldId, WORLDS } from '../core/worlds';
import { GOLDEN_STREAK_DAYS, readStreak } from '../core/streak';
import { duoCountToday } from '../core/friendsLight';

export interface PosterOptions {
  /** Overrides the caption (defaults to the world label). */
  title?: string;
  /** World id used for the caption (defaults to the URL world). */
  world?: string;
}

function uiLanguage(): string {
  return window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
}

/** Builds a polaroid-style poster from the current frame. */
export async function capturePoster(opts: PosterOptions = {}): Promise<Blob> {
  const frame = await engine.requestFrameCapture();
  const poster = drawPoster(frame, opts);
  return new Promise<Blob>((resolve, reject) => {
    poster.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('poster: toBlob failed'))), 'image/png');
  });
}

/**
 * Draws the paper frame around the captured frame. Pure canvas work, so it is
 * trivially reusable/redirectable later.
 */
export function drawPoster(frame: HTMLCanvasElement, opts: PosterOptions = {}): HTMLCanvasElement {
  const worldId = getWorldId(opts.world ?? new URLSearchParams(window.location.search).get('world'));
  const world = WORLDS.find((entry) => entry.id === worldId);
  const language = uiLanguage();
  const caption = opts.title ?? (language === 'en' ? world?.label.en : world?.label.pt) ?? worldId;

  // Golden poster: unlocked by reaching GOLDEN_STREAK_DAYS consecutive visits.
  const streak = readStreak();
  const golden = streak >= GOLDEN_STREAK_DAYS;

  // Duo poster: unlocked by following a friend's light trail today.
  const duo = duoCountToday(new Date()) > 0;

  const photoWidth = frame.width;
  const photoHeight = frame.height;
  const margin = Math.max(1, Math.round(photoWidth * 0.05));
  const captionHeight = Math.max(1, Math.round(photoWidth * 0.11));
  const width = photoWidth + margin * 2;
  const height = photoHeight + margin * 2 + captionHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required to render the poster.');

  // Soft drop shadow under the paper card.
  context.shadowColor = 'rgba(0, 0, 0, 0.28)';
  context.shadowBlur = Math.max(4, Math.round(margin * 0.5));
  context.shadowOffsetY = Math.max(2, Math.round(margin * 0.3));
  // Paper card.
  context.fillStyle = '#fffdf6';
  context.fillRect(0, 0, width, height);
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  // Photo area.
  context.drawImage(frame, margin, margin, photoWidth, photoHeight);

  // Caption strip.
  context.fillStyle = '#fffdf6';
  context.fillRect(0, margin + photoHeight, width, captionHeight);
  context.fillStyle = '#3f3d3a';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const fontSize = Math.max(10, Math.round(captionHeight * 0.42));
  context.font = `600 ${fontSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const icon = world?.icon ? `${world.icon} ` : '';
  context.fillText(
    icon + caption,
    width / 2,
    margin + photoHeight + captionHeight / 2 + 1,
    width - margin * 2,
  );

  if (golden) {
    // Double golden frame around the paper card.
    const outer = Math.max(2, Math.round(margin * 0.14));
    context.strokeStyle = '#c99a2e';
    context.lineWidth = outer;
    context.strokeRect(outer / 2, outer / 2, width - outer, height - outer);
    context.strokeStyle = '#f2d27a';
    context.lineWidth = Math.max(1, Math.round(outer * 0.4));
    context.strokeRect(outer, outer, width - outer * 2, height - outer * 2);

    // Flame + day counter on the caption strip (bottom-right).
    context.textAlign = 'right';
    context.fillStyle = '#7a5910';
    context.font = `600 ${Math.max(10, Math.round(fontSize * 0.9))}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    context.fillText(`🔥 ${streak}`, width - margin, margin + photoHeight + captionHeight / 2 + 1);
    context.textAlign = 'center';
  }

  if (duo) {
    // Duo poster: violet inner frame + pair mark (bottom-left) — the keepsake
    // of following a friend's light trail.
    const inner = Math.max(2, Math.round(margin * 0.1));
    context.strokeStyle = '#a75fd6';
    context.lineWidth = inner;
    context.strokeRect(inner * 1.6, inner * 1.6, width - inner * 3.2, height - inner * 3.2);
    context.textAlign = 'left';
    context.fillStyle = '#8a3fb8';
    context.font = `600 ${Math.max(10, Math.round(fontSize * 0.9))}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    context.fillText('👥 2', margin, margin + photoHeight + captionHeight / 2 + 1);
    context.textAlign = 'center';
  }

  return canvas;
}

/** Triggers a browser download for a poster blob. */
export function downloadPoster(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Prompts for an optional poster caption. Resolves null when cancelled. */
function promptCaption(defaultCaption: string): Promise<string | null> {
  return new Promise((resolve) => {
    const language = uiLanguage();
    const overlay = document.createElement('div');
    overlay.id = 'poster-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', language === 'en' ? 'Poster caption' : 'Legenda do cartaz');

    const card = document.createElement('div');
    card.className = 'poster-dialog-card';

    const label = document.createElement('label');
    label.className = 'poster-dialog-label';
    label.textContent = language === 'en' ? 'Caption (optional)' : 'Legenda (opcional)';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'poster-dialog-input';
    input.className = 'poster-dialog-input';
    input.maxLength = 60;
    input.value = defaultCaption;
    label.htmlFor = input.id;

    const actions = document.createElement('div');
    actions.className = 'poster-dialog-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'poster-dialog-cancel';
    cancel.textContent = language === 'en' ? 'Cancel' : 'Cancelar';

    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'poster-dialog-download';
    download.textContent = language === 'en' ? 'Download' : 'Descarregar';

    let done = false;
    const close = (value: string | null): void => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        close(input.value);
      }
    };

    cancel.addEventListener('click', () => close(null));
    download.addEventListener('click', () => close(input.value));
    document.addEventListener('keydown', onKey);

    actions.append(cancel, download);
    card.append(label, input, actions);
    overlay.append(card);
    document.body.append(overlay);
    input.focus();
    input.select();
  });
}

/** Mounts the floating poster button. */
export function mountPosterButton(): void {
  if (document.getElementById('poster-btn')) return;
  const label = uiLanguage() === 'en' ? 'Poster' : 'Cartaz';

  const button = document.createElement('button');
  button.id = 'poster-btn';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = '📸';
  button.addEventListener('click', () => {
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    const worldLabel = WORLDS.find((entry) => entry.id === world);
    const defaultCaption = worldLabel
      ? uiLanguage() === 'en'
        ? worldLabel.label.en
        : worldLabel.label.pt
      : world;
    void promptCaption(defaultCaption)
      .then((caption) => {
        if (caption === null) return;
        return capturePoster({ world, title: caption.trim() || undefined });
      })
      .then((blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        downloadPoster(blob, `guinomo-${world}-${stamp}.png`);
        events.emit('webgl_poster_captured');
      })
      .catch((error) => {
        console.warn('Unable to create the poster:', error);
      });
  });
  document.body.append(button);
}
