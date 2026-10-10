// Golden hour HUD: an announced daily window (10 min, varying start time) with
// double adventure points. Shows a countdown chip while active, the announced
// start time beforehand, a soft golden vignette, and the adventure-points
// total. Mounted once by main.ts.

import './goldenHour.css';
import { events } from '../core/events';
import {
  goldenHourRemainingMs,
  isGoldenHour,
  nextGoldenWindow,
} from '../core/goldenHour';
import { readPoints } from '../core/adventurePoints';
import { showToast } from './toast';

function uiLanguage(): string {
  return window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
}

const TICK_MS = 1000;

export function mountGoldenHourHud(): void {
  if (document.getElementById('golden-hud')) return;

  const english = uiLanguage() === 'en';

  const hud = document.createElement('div');
  hud.id = 'golden-hud';

  const vignette = document.createElement('div');
  vignette.id = 'golden-vignette';
  vignette.hidden = true;
  vignette.setAttribute('aria-hidden', 'true');

  const chip = document.createElement('div');
  chip.id = 'golden-chip';
  chip.setAttribute('aria-live', 'polite');
  chip.title = english
    ? 'Golden hour: double adventure points'
    : 'Hora dourada: pontos de exploração a dobrar';

  const points = document.createElement('div');
  points.id = 'points-chip';
  points.setAttribute('aria-label', english ? 'Adventure points' : 'Pontos de exploração');
  points.textContent = `⭐ ${readPoints()}`;

  hud.append(vignette, chip, points);
  document.body.append(hud);

  let wasActive = isGoldenHour(new Date());
  let shownSeconds = -1;

  const formatClock = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const tick = () => {
    const now = new Date();
    const active = isGoldenHour(now);

    if (active) {
      chip.classList.add('active');
      vignette.hidden = false;
      const seconds = Math.ceil(goldenHourRemainingMs(now) / 1000);
      if (seconds !== shownSeconds) {
        shownSeconds = seconds;
        const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        chip.textContent = english ? `☀️ Golden hour · ${minutes}:${secs}` : `☀️ Hora dourada · ${minutes}:${secs}`;
      }
      if (!wasActive) {
        showToast(
          english ? '☀️ Golden hour has begun — double points!' : '☀️ A hora dourada começou — pontos a dobrar!',
          'gold',
        );
      }
    } else {
      chip.classList.remove('active');
      vignette.hidden = true;
      shownSeconds = -1;
      const next = nextGoldenWindow(now);
      const sameDay = next.day.toDateString() === now.toDateString();
      const when = english
        ? sameDay
          ? 'Golden hour today at'
          : 'Golden hour tomorrow at'
        : sameDay
          ? 'Hora dourada hoje às'
          : 'Hora dourada amanhã às';
      chip.textContent = `☀️ ${when} ${formatClock(next.day)}`;
    }

    wasActive = active;
  };

  tick();
  window.setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', tick);

  events.on('webgl_points_changed', () => {
    points.textContent = `⭐ ${readPoints()}`;
  });
}