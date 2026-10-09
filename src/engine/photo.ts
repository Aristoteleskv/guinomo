// Poster/photo mode. STUB published by the integrator so Dev B has a wired,
// compiling contract; Dev B owns the presentation (paper frame, title, layout).
//
// Contract (frozen):
//   engine.requestFrameCapture(): Promise<HTMLCanvasElement>  // integrator provides
//   capturePoster(opts?): Promise<Blob>                       // Dev B
//   downloadPoster(blob, filename): void                      // Dev B
//   mountPosterButton(): void                                 // Dev B, called by main.ts

import './photo.css';
import { engine } from './globals';
import { getWorldId } from '../core/worlds';

/** Builds a poster from the current frame. Dev B: draw the frame + title here. */
export async function capturePoster(opts?: { title?: string }): Promise<Blob> {
  const frame = await engine.requestFrameCapture();
  void opts;
  return new Promise<Blob>((resolve, reject) => {
    frame.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('poster: toBlob failed'))), 'image/png');
  });
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
  const button = document.createElement('button');
  button.id = 'poster-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Poster');
  button.textContent = '📸';
  button.addEventListener('click', () => {
    const world = getWorldId(new URLSearchParams(window.location.search).get('world'));
    void capturePoster({ title: world }).then((blob) => {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadPoster(blob, `guinomo-${world}-${stamp}.png`);
    });
  });
  document.body.append(button);
}
