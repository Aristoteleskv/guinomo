// World awakening (C7): after all five secrets and the Grand Secret are
// unlocked, the world never looks the same again. The "awakened" flag is read
// from the same persisted Grand Secret (guinomo.grand_secret.v1), so it is
// stable, offline and per-player. Deterministic effects follow: a daily "Echo
// of the Awakening" window and a visual pulse, both derived only from the UTC
// clock — the same instant renders the same metamorphosis on every device.

import { minuteOfDay, minutesOf } from './worldRhythm';

/** Mirrors the persisted key in core/secrets.ts (guinomo.grand_secret.v1). */
export const AWAKENING_GRAND_SECRET_KEY = 'guinomo.grand_secret.v1';

/** UTC minute when the awakening window starts (12:00). */
export const AWAKENING_START_UTC = 12 * 60;

/** Length (minutes) of the awakening window. */
export const AWAKENING_LENGTH_MINUTES = 30;

/** Minutes the pulse takes to fade in (and later out). */
export const AWAKENING_FADE_MINUTES = 8;

export interface StorageLike {
  getItem(key: string): string | null;
}

function storageOf(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof globalThis === 'undefined') return null;
  const globalLocal = (globalThis as { localStorage?: StorageLike }).localStorage;
  return globalLocal ?? null;
}

/** True when the player has unlocked the Grand Secret (world awake). */
export function isWorldAwakened(storage?: StorageLike | null): boolean {
  return storageOf(storage)?.getItem(AWAKENING_GRAND_SECRET_KEY) === '1';
}

/** Whether the awakening window is live right now (awakened only). */
export function awakeningActive(now: Date, storage?: StorageLike | null): boolean {
  if (!isWorldAwakened(storage)) return false;
  const minutes = minuteOfDay(minutesOf(now));
  return minutes >= AWAKENING_START_UTC && minutes < AWAKENING_START_UTC + AWAKENING_LENGTH_MINUTES;
}

/**
 * 0..1 visual pulse of the awakening — fades in at 12:00, holds during the
 * window, fades out after. 0 whenever the world is not awakened.
 */
export function awakeningPulse(now: Date, storage?: StorageLike | null): number {
  if (!isWorldAwakened(storage)) return 0;
  const minutes = minuteOfDay(minutesOf(now));
  const inside = minutes - AWAKENING_START_UTC;
  if (inside < 0) return 0;
  if (inside < AWAKENING_FADE_MINUTES) return inside / AWAKENING_FADE_MINUTES;
  if (inside < AWAKENING_LENGTH_MINUTES) return 1;
  const after = inside - AWAKENING_LENGTH_MINUTES;
  if (after < AWAKENING_FADE_MINUTES) return 1 - after / AWAKENING_FADE_MINUTES;
  return 0;
}