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
import { getWorldId, WORLDS } from '../core/worlds';

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
    void capturePoster({ world })
      .then((blob) => {
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        downloadPoster(blob, `guinomo-${world}-${stamp}.png`);
      })
      .catch((error) => {
        console.warn('Unable to create the poster:', error);
      });
  });
  document.body.append(button);
}
