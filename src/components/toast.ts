// Tiny transient toast helper shared by the engagement HUDs (golden hour,
// light trail, points). One container, stacked toasts, auto-dismiss.

import './toast.css';

const TOAST_MS = 6000;

/** Shows a short toast message. `kind` picks the accent style. */
export function showToast(message: string, kind: 'gold' | 'violet' | 'neutral' = 'neutral', ms = TOAST_MS): void {
  let container = document.getElementById('guinomo-toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'guinomo-toasts';
    container.setAttribute('aria-live', 'polite');
    document.body.append(container);
  }
  const toast = document.createElement('div');
  toast.className = `guinomo-toast ${kind}`;
  toast.textContent = message;
  container.append(toast);
  window.setTimeout(() => toast.remove(), ms);
}