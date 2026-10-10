// "Par Extraordinário" (Extraordinary Pair): a live proximity link between the
// local player and one remote player in the same world. Pure logic +
// localStorage, no DOM/three, so it is trivially unit-testable.

/** Metres within which two players start linking. */
export const PAIR_START_DISTANCE = 4;

/** Metres beyond which an already-formed pair breaks (hysteresis). */
export const PAIR_BREAK_DISTANCE = 6;

/** Sustained seconds inside PAIR_START_DISTANCE to form the link. */
export const PAIR_LINK_SECONDS = 1.2;

export type PairPhase = 'none' | 'warming' | 'linked';

export interface PairState {
  phase: PairPhase;
  /** 0..1 progress toward the link (only meaningful while warming). */
  progress: number;
  /** Stable key of the remote being paired with (uid-based when known). */
  friendKey: string | null;
}

export const NO_PAIR: PairState = { phase: 'none', progress: 0, friendKey: null };

/**
 * Advances the pair state machine by `dt` seconds given the current horizontal
 * distance to the remote. `friendKey` identifies who we are next to; switching
 * target while warming restarts the progress. Once linked, hysteresis keeps
 * the pair until PAIR_BREAK_DISTANCE is exceeded.
 */
export function advancePair(prev: PairState, distance: number, dt: number, friendKey: string): PairState {
  if (prev.phase === 'linked') {
    if (distance > PAIR_BREAK_DISTANCE) return { phase: 'none', progress: 0, friendKey: null };
    return prev;
  }
  if (distance <= PAIR_START_DISTANCE) {
    const base = prev.friendKey === friendKey ? prev.progress : 0;
    const progress = Math.min(1, base + dt / PAIR_LINK_SECONDS);
    return { phase: progress >= 1 ? 'linked' : 'warming', progress, friendKey };
  }
  return { phase: 'none', progress: 0, friendKey: null };
}

const PAIR_CLAIMS_KEY = 'guinomo.pairclaims.v1';

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type ClaimsState = Record<string, string>; // friendKey → day key of last pair link

function readClaims(): ClaimsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAIR_CLAIMS_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const claims: ClaimsState = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') claims[key] = value;
      }
      return claims;
    }
  } catch {
    // Private mode / no storage: every pairing is claimable again.
  }
  return {};
}

function writeClaims(claims: ClaimsState): void {
  try {
    localStorage.setItem(PAIR_CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // Private mode: keep the claims for the session only.
  }
}

/** Stable identity of a remote for daily claims: the real uid when known,
 *  otherwise the P2P client id (stable for the session). */
export function pairFriendKey(uid: number, clientId: string): string {
  return uid > 0 ? `u${uid}` : `c${clientId}`;
}

/** Whether the pair with this remote was already celebrated today. */
export function hasClaimedPair(friendKey: string, now: Date): boolean {
  return readClaims()[friendKey] === dayKey(now);
}

/** Marks today's pair link with this remote. Returns whether it was new. */
export function claimPairToday(friendKey: string, now: Date): boolean {
  if (hasClaimedPair(friendKey, now)) return false;
  const claims = readClaims();
  claims[friendKey] = dayKey(now);
  writeClaims(claims);
  return true;
}

/** Number of distinct remotes paired today. */
export function pairCountToday(now: Date): number {
  const key = dayKey(now);
  return Object.values(readClaims()).filter((day) => day === key).length;
}
