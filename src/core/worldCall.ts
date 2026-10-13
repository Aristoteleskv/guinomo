// Synchronized inauguration ("Alinhamento celeste"): one fixed daily UTC
// window shared by every world. While it runs, if enough friends are present
// in the world, a collective "celestial alignment" qualifies and each present
// player mints one daily seal. Pure clock + injectable storage — no network,
// no DOM — so every device agrees on the same phase (the metaverse heartbeat).
//
// The window is deterministic (single epoch UTC, not local time), like
// worldRhythm: even players with no server see the exact same state.

export const WC_START_MINUTES = 21 * 60; // 21:00 UTC
export const WC_DURATION_MINUTES = 20; // until 21:20 UTC
/** Friends present for the alignment to qualify (you count as online too). */
export const WC_MIN_ONLINE = 2;
/** Show "in X min" from this many minutes before the window opens. */
export const WC_LOOKAHEAD_MINUTES = 60;
/** Storage key of the daily claim map. */
export const WC_CLAIM_KEY = 'guinomo.inauguration.v1';

export type WorldCallPhase = 'idle' | 'upcoming' | 'active' | 'done';

export interface WorldCallState {
  phase: WorldCallPhase;
  /** Friends present in this world (from the presence poller). */
  online: number;
  /** Whole minutes until start (upcoming) or until end (active); 0 otherwise. */
  minutesLeft: number;
  /** Window active AND enough friends online → the alignment qualifies. */
  qualifies: boolean;
  /** Whether today's collective seal was already minted. */
  claimed: boolean;
}

/** "YYYY-MM-DD" of the UTC day of `now` (the claim clock is UTC). */
export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Fractional minute of the UTC day, 0..1440. */
export function minuteOfUtcDay(now: Date): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
}

type ClaimState = Record<string, boolean>;

function readClaims(storage: Pick<Storage, 'getItem' | 'setItem'>): ClaimState {
  try {
    const parsed = JSON.parse(storage.getItem(WC_CLAIM_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const claims: ClaimState = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof key === 'string' && value === true) claims[key] = true;
      }
      return claims;
    }
  } catch {
    // Corrupt blob: treated as no claim.
  }
  return {};
}

function markClaimedToday(now: Date, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const claims = readClaims(storage);
  claims[utcDayKey(now)] = true;
  try {
    storage.setItem(WC_CLAIM_KEY, JSON.stringify(claims));
  } catch {
    // Private mode: keep it in-memory for this session.
  }
}

/** True when today's collective seal was already minted. */
export function isClaimedToday(now: Date, storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  return readClaims(storage)[utcDayKey(now)] === true;
}

/** The deterministic inauguration state for this instant (UTC). */
export function worldCallState(
  now: Date,
  online: number,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): WorldCallState {
  const total = minuteOfUtcDay(now);
  const start = WC_START_MINUTES;
  const end = start + WC_DURATION_MINUTES;

  let phase: WorldCallPhase;
  let minutesLeft = 0;
  if (total < start) {
    phase = total >= start - WC_LOOKAHEAD_MINUTES ? 'upcoming' : 'idle';
    if (phase === 'upcoming') minutesLeft = Math.max(0, Math.ceil(start - total));
  } else if (total < end) {
    phase = 'active';
    minutesLeft = Math.max(0, Math.ceil(end - total));
  } else {
    phase = 'done';
  }

  return {
    phase,
    online: Math.max(0, Math.floor(online)),
    minutesLeft,
    qualifies: phase === 'active' && Math.max(0, Math.floor(online)) >= WC_MIN_ONLINE,
    claimed: isClaimedToday(now, storage),
  };
}

/**
 * Mints today's seal if the alignment is qualifying and it was not yet minted.
 * Returns whether the seal is new (so callers toast exactly once).
 */
export function claimWorldCall(
  now: Date,
  online: number,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): boolean {
  if (isClaimedToday(now, storage)) return false;
  if (!worldCallState(now, online, storage).qualifies) return false;
  markClaimedToday(now, storage);
  return true;
}