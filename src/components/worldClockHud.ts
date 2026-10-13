// World clock HUD: the deterministic world state, always visible — UTC day
// phase and the world's daily event (current with countdown, or next). Same
// instant ⇒ same state on every device (pure clock, no network), mirroring the
// goldenHourHud chip pattern. The formatting helpers are pure and unit-tested;
// the mount just renders them into a fixed chip.

import './worldClock.css';
import { dayPhase, minutesOf, nextWorldEvent, worldEvent } from '../core/worldRhythm';
import type { DayPhase } from '../core/worldRhythm';
import { WORLDS, getWorldId } from '../core/worlds';
import { showToast } from './toast';

export const TICK_MS = 30_000;

export const MINUTES_PER_DAY = 24 * 60;

/** Below this time-to-start the chip shows a live countdown instead of the
 *  scheduled time, and pulses. Deterministic for every player. */
export const SOON_MINUTES = 60;

/** Below this time-to-start a one-shot toast warns everyone in the world. */
export const WARNING_MINUTES = 15;

/** Whole minutes until `start` (ceiling, floored at 0). */
export function minutesUntil(now: number, start: number): number {
  return Math.max(0, Math.ceil(start - now));
}

/** Minute within the UTC day, 0..1439 (normalizes negatives like worldRhythm). */
export function minuteOfDayUtc(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** "HH:MM" in UTC for an epoch-minute value. */
export function utcClock(minutes: number): string {
  const m = minuteOfDayUtc(minutes);
  const hours = String(Math.floor(m / 60)).padStart(2, '0');
  const mins = String(m % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

/** Whole minutes until `end` (ceiling, floored at 0). */
export function remainingMinutes(now: number, end: number): number {
  return Math.max(0, Math.ceil(end - now));
}

/** True when both epoch-minute values fall on the same UTC day. */
export function isSameUtcDay(a: number, b: number): boolean {
  return Math.floor(a / MINUTES_PER_DAY) === Math.floor(b / MINUTES_PER_DAY);
}

export const PHASE_META: Record<DayPhase, { icon: string; label: { pt: string; en: string } }> = {
  night: { icon: '🌙', label: { pt: 'noite', en: 'night' } },
  dawn: { icon: '🌅', label: { pt: 'manhã', en: 'morning' } },
  day: { icon: '☀️', label: { pt: 'dia', en: 'day' } },
  dusk: { icon: '🌇', label: { pt: 'entardecer', en: 'evening' } },
};

export type EventLike = {
  icon: string;
  title: { pt: string; en: string };
  start: number;
  end: number;
};

/** Line 1 of the chip: "🏙️ Cidade Noop · ☀️ dia". */
export function phaseStatus(
  lang: 'pt' | 'en',
  worldIcon: string,
  worldLabel: string,
  phase: DayPhase,
): string {
  const meta = PHASE_META[phase];
  return `${worldIcon} ${worldLabel} · ${meta.icon} ${meta.label[lang]}`;
}

/** Line 2 of the chip: the running event with its countdown, else the next one
 *  (also an EventLike — the HUD resolves it via worldEvent(world, next start),
 *  because the start minute is inclusive and carries icon/title). */
export function eventStatus(
  lang: 'pt' | 'en',
  active: EventLike | null,
  next: EventLike | null,
  now: number,
): string {
  if (active) {
    const mins = remainingMinutes(now, active.end);
    return lang === 'en'
      ? `${active.icon} ${active.title.en} · till ${utcClock(active.end)} UTC · ≈${mins} min`
      : `${active.icon} ${active.title.pt} · até ${utcClock(active.end)} UTC · ≈${mins} min`;
  }
  if (!next) return lang === 'en' ? 'no more events today' : 'sem mais eventos hoje';
  const delta = minutesUntil(now, next.start);
  if (delta > 0 && delta <= SOON_MINUTES) {
    return lang === 'en'
      ? `⏳ ${next.icon} ${next.title.en} · in ${delta} min (${utcClock(next.start)} UTC)`
      : `⏳ ${next.icon} ${next.title.pt} · em ${delta} min (${utcClock(next.start)} UTC)`;
  }
  const when = isSameUtcDay(now, next.start)
    ? lang === 'en'
      ? 'today at'
      : 'hoje às'
    : lang === 'en'
      ? 'tomorrow at'
      : 'amanhã às';
  return lang === 'en'
    ? `⏳ ${next.icon} ${next.title.en} · ${when} ${utcClock(next.start)} UTC`
    : `⏳ ${next.icon} ${next.title.pt} · ${when} ${utcClock(next.start)} UTC`;
}

function uiLanguage(): 'pt' | 'en' {
  return window.GUINOMO_PROFILE?.language === 'en' ? 'en' : 'pt';
}

export function mountWorldClockHud(): void {
  if (document.getElementById('world-chip')) return;

  const worldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
  const world = WORLDS.find((entry) => entry.id === worldId) ?? WORLDS[0];

  const chip = document.createElement('div');
  chip.id = 'world-chip';
  chip.setAttribute('aria-live', 'polite');
  chip.title =
    uiLanguage() === 'en'
      ? 'World state: UTC day phase and the daily event of this world'
      : 'Estado do mundo: fase do dia (UTC) e o evento diário deste mundo';
  document.body.append(chip);

  let wasActive = false;
  let trackedWindowStart = -1;
  let warnedNear = false;

  const render = () => {
    const lang = uiLanguage();
    const now = minutesOf(new Date());
    const phase = dayPhase(now);
    const active = worldEvent(worldId, now);
    const nextWindow = nextWorldEvent(worldId, now);
    // The start minute is inclusive: resolving worldEvent at the next start
    // yields the upcoming event with its icon/title, so the idle line names it.
    const next = nextWindow ? worldEvent(worldId, nextWindow.start) : null;

    chip.textContent = `${phaseStatus(lang, world.icon, world.label[lang], phase)}\n${eventStatus(
      lang,
      active,
      next,
      now,
    )}`;
    chip.classList.toggle('active', active !== null);
    chip.classList.toggle('soon', !active && next !== null && (next.start - now) <= SOON_MINUTES && next.start > now);

    if (active && !wasActive) {
      showToast(
        lang === 'en'
          ? `${active.icon} ${active.title.en} has begun in ${world.label.en}`
          : `${active.icon} ${active.title.pt} começou em ${world.label.pt}`,
        'violet',
      );
    }
    wasActive = active !== null;

    // Aviso one-shot 15 min antes do evento do mundo atual (por janela).
    if (!active && nextWindow) {
      if (nextWindow.start !== trackedWindowStart) {
        trackedWindowStart = nextWindow.start;
        warnedNear = false;
      }
      const delta = minutesUntil(now, nextWindow.start);
      if (!warnedNear && delta > 0 && delta <= WARNING_MINUTES) {
        warnedNear = true;
        const meta = next ?? { icon: world.icon, title: world.label, start: nextWindow.start, end: nextWindow.end };
        showToast(
          lang === 'en'
            ? `⏳ ${meta.icon} ${meta.title.en} begins in ${world.label.en} in ${delta} min`
            : `⏳ ${meta.icon} ${meta.title.pt} começa em ${world.label.pt} em ${delta} min`,
          'violet',
        );
      }
    }
  };

  render();
  window.setInterval(render, TICK_MS);
  document.addEventListener('visibilitychange', render);
}