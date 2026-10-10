// Daily-visit streak: how many consecutive days the player explored Guinomo.
// Persisted in localStorage; feeds the HUD flame badge and unlocks the golden
// poster frame after GOLDEN_STREAK_DAYS consecutive days.

const STREAK_STORAGE_KEY = 'guinomo.streak.v1';
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

/** Consecutive days needed to unlock the golden poster frame. */
export const GOLDEN_STREAK_DAYS = 7;

interface StreakState {
  count: number;
  last: string;
}

/** Local calendar day key, e.g. "2026-10-10". */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function readState(): StreakState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as StreakState).count === 'number' &&
      typeof (parsed as StreakState).last === 'string'
    ) {
      return { count: (parsed as StreakState).count, last: (parsed as StreakState).last };
    }
  } catch {
    // Private mode / no storage: the streak resets every session.
  }
  return { count: 0, last: '' };
}

function writeState(state: StreakState): void {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode: keep the run session-only.
  }
}

/** Registers today's visit (idempotent within the day) and returns the streak. */
export function bumpStreak(): number {
  const today = dayKey(new Date());
  const state = readState();
  if (state.last === today) return state.count;

  const yesterday = dayKey(new Date(Date.now() - MILLIS_PER_DAY));
  const count = state.last === yesterday ? state.count + 1 : 1;
  writeState({ count, last: today });
  return count;
}

/**
 * Current streak without mutating storage. A visit from yesterday still counts
 * until today's visit bumps/resets it; older gaps mean the streak is over.
 */
export function readStreak(): number {
  const state = readState();
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - MILLIS_PER_DAY));
  if (state.last === today || state.last === yesterday) return state.count;
  return 0;
}