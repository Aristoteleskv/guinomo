// Synchronized inauguration HUD: chip under the world clock showing the daily
// UTC alignment window (upcoming countdown / active) and minting today's
// collective seal once enough friends are present. Fed by the existing
// presence poller via `light_trail_update` — no extra network, and the pure
// state machine (src/core/worldCall.ts) keeps every device in the same phase.

import './worldCall.css';
import { events } from '../core/events';
import {
  claimWorldCall,
  WC_MIN_ONLINE,
  WC_START_MINUTES,
  worldCallState,
} from '../core/worldCall';
import { showToast } from './toast';

export const WC_TICK_MS = 15_000;

const START_CLOCK = `${String(Math.floor(WC_START_MINUTES / 60)).padStart(2, '0')}:00`;

function uiLanguage(): 'pt' | 'en' {
  return window.GUINOMO_PROFILE?.language === 'en' ? 'en' : 'pt';
}

export function mountWorldCallHud(): void {
  if (document.getElementById('world-call-chip')) return;

  const chip = document.createElement('div');
  chip.id = 'world-call-chip';
  chip.hidden = true;
  chip.setAttribute('aria-live', 'polite');
  chip.title = uiLanguage() === 'en' ? 'Daily celestial alignment (UTC)' : 'Alinhamento celeste diário (UTC)';
  document.body.append(chip);

  let online = 0;

  events.on('light_trail_update', (info: { friends?: number }) => {
    online = typeof info.friends === 'number' ? info.friends : online;
    render();
  });

  const render = () => {
    const lang = uiLanguage();
    const state = worldCallState(new Date(), online, window.localStorage);

    chip.hidden = state.phase === 'idle' && !state.claimed;
    if (chip.hidden) return;

    chip.classList.toggle('active', state.phase === 'active');
    chip.classList.toggle('soon', state.phase === 'upcoming');

    if (state.phase === 'upcoming') {
      chip.textContent =
        lang === 'en'
          ? `🌌 Celestial alignment · in ${state.minutesLeft} min (${START_CLOCK} UTC)`
          : `🌌 Alinhamento celeste · em ${state.minutesLeft} min (${START_CLOCK} UTC)`;
      return;
    }

    if (state.phase === 'active') {
      if (state.claimed) {
        chip.textContent =
          lang === 'en' ? `🌌 Today's inauguration seal ✓` : `🌌 Selo das Inaugurações de hoje ✓`;
        return;
      }
      if (state.qualifies) {
        chip.textContent =
          lang === 'en'
            ? `🌌 ALIGNMENT · ${state.online} present — sealing!`
            : `🌌 ALINHAMENTO · ${state.online} presente(s) — a selar!`;
        if (claimWorldCall(new Date(), online, window.localStorage)) {
          events.emit('world_call_claimed', { online });
          showToast(
            lang === 'en'
              ? `🌌 Collective seal minted — the world remembers this moment`
              : `🌌 Selo coletivo cunhado — o mundo recorda este momento`,
            'gold',
          );
          render(); // switches the chip to the claimed line
        }
        return;
      }
      const missing = Math.max(0, WC_MIN_ONLINE - state.online);
      chip.textContent =
        lang === 'en'
          ? `🌌 Alignment · ${state.minutesLeft} min left · need ${missing} more present`
          : `🌌 Alinhamento · faltam ${state.minutesLeft} min · precisas de ${missing} presente(s)`;
      return;
    }

    // done
    chip.textContent =
      lang === 'en'
        ? state.claimed
          ? `🌌 Today's inauguration seal ✓`
          : `🌌 Today's window closed`
        : state.claimed
          ? `🌌 Selo das Inaugurações de hoje ✓`
          : `🌌 Janela de hoje fechada`;
  };

  render();
  window.setInterval(render, WC_TICK_MS);
  document.addEventListener('visibilitychange', render);
}