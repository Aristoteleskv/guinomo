// Deterministic world state: the day phase and the daily world event of each
// world, derived ONLY from the UTC clock — pure functions, no DOM, no storage,
// no network. The same instant ⇒ the same state on every device, so friends
// always agree on what is happening in a world without sending a single byte.
//
// Note the clock is UTC (not the player's local day, unlike the golden hour):
// this is the *world's* state, and it must be identical for everyone standing
// in the same world, whatever their timezone.
//
// This is the first "deterministic core" of the project — the exact kind of
// module that later moves to a single WASM build (client + server share the
// compiled simulation) when world-governed gameplay needs authority.

import type { WorldId } from './worlds';

export const MINUTES_PER_DAY = 24 * 60;

/** Whole minutes since the epoch (UTC) — this module's clock unit. */
export function minutesOf(date: Date): number {
  return Math.floor(date.getTime() / 60_000);
}

/** Minute within the UTC day, 0..1439. */
export function minuteOfDay(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** UTC calendar day index (whole days since the epoch). */
export function dayOfMinutes(minutes: number): number {
  return Math.floor(minutes / MINUTES_PER_DAY);
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

/** Rough phase of the world's UTC day. */
export function dayPhase(minutes: number): DayPhase {
  const m = minuteOfDay(minutes);
  if (m < 6 * 60) return 'night';
  if (m < 11 * 60) return 'dawn';
  if (m < 17 * 60) return 'day';
  if (m < 21 * 60) return 'dusk';
  return 'night';
}

/** FNV-1a hash → a stable pseudo-random number per key (same algorithm family
 *  as the golden hour, but the salt keeps the two daily cycles uncorrelated). */
function hashOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface WorldEvent {
  worldId: WorldId;
  icon: string;
  title: { pt: string; en: string };
  /** UTC minutes when the daily window starts. */
  start: number;
  /** UTC minutes when the daily window ends (exclusive). */
  end: number;
}

/** Daily slot of each world. Every world has exactly one; the window never
 *  crosses midnight, so `end` is always inside the same UTC day. */
const EVENT_DEFS: Record<
  WorldId,
  { icon: string; pt: string; en: string; startMinute: number; lengthMinutes: number }
> = {
  lobby: { icon: '🛎️', pt: 'Mercado da meia-noite', en: 'Midnight market', startMinute: 22 * 60, lengthMinutes: 90 },
  alien: { icon: '🌠', pt: 'Chuva de estrelas', en: 'Stardust showers', startMinute: 20 * 60, lengthMinutes: 60 },
  forest: { icon: '🍃', pt: 'Canto do vento', en: 'Wind-song', startMinute: 6 * 60 + 30, lengthMinutes: 60 },
  'floating-city': { icon: '🌊', pt: 'Maré alta', en: 'High tide', startMinute: 18 * 60, lengthMinutes: 90 },
  'tropical-city': { icon: '🌅', pt: 'Crepúsculo coral', en: 'Coral dusk', startMinute: 17 * 60, lengthMinutes: 90 },
  'old-town': { icon: '🎉', pt: 'Festa das comadres', en: 'Town feast', startMinute: 19 * 60, lengthMinutes: 120 },
};

/** The world's daily event when one is active at `minutes`, else null. */
export function worldEvent(worldId: WorldId, minutes: number): WorldEvent | null {
  const def = EVENT_DEFS[worldId];
  if (!def) return null;
  const day = dayOfMinutes(minutes);
  const start = day * MINUTES_PER_DAY + def.startMinute;
  const end = Math.min(start + def.lengthMinutes, (day + 1) * MINUTES_PER_DAY);
  if (minutes < start || minutes >= end) return null;
  return { worldId, icon: def.icon, title: { pt: def.pt, en: def.en }, start, end };
}

export interface NextWorldEvent {
  /** UTC minutes when the next (or running) window starts. */
  start: number;
  /** UTC minutes when it ends (exclusive). */
  end: number;
}

/** The next window of the world's daily event, from `minutes` — today's when
 *  it has not ended yet, tomorrow's otherwise. */
export function nextWorldEvent(worldId: WorldId, minutes: number): NextWorldEvent | null {
  const def = EVENT_DEFS[worldId];
  if (!def) return null;
  const day = dayOfMinutes(minutes);
  let start = day * MINUTES_PER_DAY + def.startMinute;
  let end = Math.min(start + def.lengthMinutes, (day + 1) * MINUTES_PER_DAY);
  if (minutes >= end) {
    start = (day + 1) * MINUTES_PER_DAY + def.startMinute;
    end = Math.min(start + def.lengthMinutes, (day + 2) * MINUTES_PER_DAY);
  }
  return { start, end };
}

/** Deterministic "mood" of the day for a world (0..99) — stable per (world, UTC
 *  day), the seed from which future per-day variations (music, sky tint, loot)
 *  will be drawn without network. */
export function worldMood(worldId: WorldId, minutes: number): number {
  return hashOf(`${worldId}:${dayOfMinutes(minutes)}`) % 100;
}