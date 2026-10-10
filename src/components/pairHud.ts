// "Par Extraordinário" HUD: the 👥 chip that lives in the identity card (or
// floats top-right without one) and lights up while the local player is linked
// with another player. The first link of the day with each friend awards
// adventure points and toasts, once per friend per day.

import './pairHud.css';
import { events } from '../core/events';
import { isGoldenHour } from '../core/goldenHour';
import { awardPoints, POINTS } from '../core/adventurePoints';
import { claimPairToday, pairCountToday, pairFriendKey } from '../core/extraordinaryPair';
import { badgeChipsSlot } from './badgeSlot';
import { showToast } from './toast';

function uiLanguage(): string {
  return window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
}

export function mountPairHud(): void {
  if (document.getElementById('pair-hud')) return;

  const english = uiLanguage() === 'en';

  const chip = document.createElement('div');
  chip.id = 'pair-hud';
  chip.setAttribute('aria-live', 'polite');

  const icon = document.createElement('span');
  icon.className = 'pair-hud-icon';
  icon.textContent = '👥';
  icon.setAttribute('aria-hidden', 'true');
  chip.append(icon);

  const label = document.createElement('span');
  label.className = 'pair-hud-label';
  label.textContent = english ? 'Extraordinary Pair' : 'Par Extraordinário';
  chip.append(label);

  let active = false;
  let activeName: string | null = null;
  let claimedToday = pairCountToday(new Date()) > 0;

  const titleText = (): string => {
    if (active && activeName) {
      return english ? `Extraordinary Pair · with ${activeName}` : `Par Extraordinário · com ${activeName}`;
    }
    if (claimedToday) {
      return english
        ? `Extraordinary Pair · unlocked today (+${POINTS.pair} XP)`
        : `Par Extraordinário · desbloqueado hoje (+${POINTS.pair} XP)`;
    }
    return english
      ? 'Extraordinary Pair · stay close to another player to link'
      : 'Par Extraordinário · fica perto de outro jogador para criar o vínculo';
  };

  const render = () => {
    chip.hidden = !(active || claimedToday);
    chip.classList.toggle('active', active);
    chip.classList.toggle('claimed', claimedToday);
    const mark = chip.querySelector<HTMLElement>('.pair-hud-mark');
    if (claimedToday) {
      if (!mark) {
        const fresh = document.createElement('span');
        fresh.className = 'pair-hud-mark';
        fresh.textContent = ' ✨';
        fresh.setAttribute('aria-hidden', 'true');
        chip.append(fresh);
      }
    } else if (mark) {
      mark.remove();
    }
    chip.title = titleText();
  };

  const host = badgeChipsSlot();
  if (host) {
    chip.classList.add('in-badge');
    host.append(chip);
  } else {
    document.body.append(chip);
  }
  render();

  events.on('webgl_pair_state', (info: { active: boolean; name: string | null }) => {
    active = Boolean(info.active);
    activeName = active ? (info.name ?? null) : null;
    render();
  });

  events.on(
    'webgl_pair_linked',
    (info: { uid?: number; name?: string | null; clientId?: string; friendKey?: string }) => {
      const now = new Date();
      const friendKey = info.friendKey ?? pairFriendKey(info.uid ?? 0, info.clientId ?? '');
      const name = info.name || (english ? 'a player' : 'um jogador');
      if (claimPairToday(friendKey, now)) {
        const golden = isGoldenHour(now);
        const gained = awardPoints(POINTS.pair, golden);
        events.emit('webgl_points_changed');
        claimedToday = true;
        active = true;
        render();
        showToast(
          english
            ? `✨ Extraordinary Pair with ${name}! +${gained} XP${golden ? ' · golden hour' : ''}`
            : `✨ Par Extraordinário com ${name}! +${gained} XP${golden ? ' · hora dourada' : ''}`,
          'gold',
        );
      } else {
        // Reunited again today: warm, but no new points.
        active = true;
        render();
        showToast(
          english
            ? `💛 Extraordinary Pair with ${name} again!`
            : `💛 Par Extraordinário com ${name} de novo!`,
          'neutral',
          3500,
        );
      }
    },
  );
}
