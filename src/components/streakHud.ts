// Daily-visit streak HUD: the 🔥 badge counts consecutive days of exploration.
// Mounted once by main.ts; turns golden after GOLDEN_STREAK_DAYS.

import './streak.css';
import { bumpStreak, GOLDEN_STREAK_DAYS } from '../core/streak';
import { claimDailyStreakPoints } from '../core/adventurePoints';
import { events } from '../core/events';
import { badgeChipsSlot } from './badgeSlot';

export function mountStreakHud(): void {
  if (document.getElementById('streak-hud')) return;

  const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
  const english = language === 'en';
  const days = bumpStreak();

  // Fixed habit reward: 10 adventure points once per local day.
  if (claimDailyStreakPoints() > 0) events.emit('webgl_points_changed');

  const hud = document.createElement('div');
  hud.id = 'streak-hud';
  hud.setAttribute('aria-live', 'polite');
  hud.title = english
    ? `${days} day streak · ${GOLDEN_STREAK_DAYS} days for the golden poster`
    : `Sequência de ${days} dias · ${GOLDEN_STREAK_DAYS} dias para o cartaz dourado`;

  const flame = document.createElement('span');
  flame.className = 'streak-hud-flame';
  flame.textContent = '🔥';
  flame.setAttribute('aria-hidden', 'true');

  const count = document.createElement('span');
  count.className = 'streak-hud-count';
  count.textContent = String(days);
  count.setAttribute('aria-label', english ? `${days} day streak` : `Sequência de ${days} dias`);

  hud.append(flame, count);
  if (days >= GOLDEN_STREAK_DAYS) hud.classList.add('golden');

  // With a visible identity card the streak sits inside the badge (compact
  // pill); without one it falls back to the floating top-right HUD.
  const host = badgeChipsSlot();
  if (host) {
    hud.classList.add('in-badge');
    host.append(hud);
  } else {
    document.body.append(hud);
  }
}