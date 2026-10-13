// B8 — Duelo de sombras. Deterministic core: the shadow's strike pattern is a
// pure function of (world, UTC day) — every player standing near the shadow
// during the same event faces the exact same schedule. Parrying is a timing
// minigame (the projection telegraphs each strike, press F inside the window);
// the whole duel is a plain record the verifier can re-arbitrate offline:
//
//   arbitrateDuel(seed, presses)  ≡  parryDuel(duelPattern(seed), presses)
//
// No server, no state — the seed alone decides the pattern and the score. This
// is the same "deterministic core → single WASM build" discipline as
// worldRhythm.ts.

import { mulberry32 } from './confetti';
import { worldMood } from './worldRhythm';
import type { WorldId } from './worlds';

export const DUEL_STRIKES = 5; // strikes per duel
export const DUEL_WINDOW_MS = 8000; // full strike timeline (ms since duel start)
export const STRIKE_MIN_GAP_MS = 900; // no two strikes closer than this
export const TELEGRAPH_MS = 1100; // the flash leads the strike by this much
export const PERFECT_MS = 120; // within ±120 ms of the strike → perfect (3 pts)
export const HIT_MS = 420; // within ±420 ms → hit (1 pt)

export type DuelHit = 'perfect' | 'hit' | 'miss';
export type DuelVerdict = 'critical' | 'win' | 'hold' | 'lose';

export interface DuelPattern {
  seed: number;
  /** Absolute strike moments (ms since duel start), ascending. */
  strikes: number[];
  /** Flash moments: strikes[i] - TELEGRAPH_MS. */
  telegraphs: number[];
}

export interface DuelResult {
  pattern: DuelPattern;
  presses: number[];
  hits: DuelHit[];
  score: number;
  perfects: number;
  landed: number;
  verdict: DuelVerdict;
}

/** Stable seed for (world, UTC day) — mixed with the world's daily mood. */
export function duelSeed(world: WorldId, minutes: number): number {
  const day = Math.floor(minutes / (24 * 60));
  const mood = worldMood(world, minutes);
  let hash = 0x811c9dc5 ^ world.length;
  for (let i = 0; i < world.length; i++) {
    hash ^= world.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= day;
  hash = Math.imul(hash, 0x01000193);
  hash ^= mood;
  hash = Math.imul(hash, 0x01000193);
  return hash >>> 0;
}

/** Deterministic strike schedule for a seed — same array on every device,
 *  same day, same world. Strikes are never closer than STRIKE_MIN_GAP_MS and
 *  always leave a reaction tail inside DUEL_WINDOW_MS. */
export function duelPattern(seed: number): DuelPattern {
  const rng = mulberry32(seed);
  const strikes: number[] = [];
  const tail = 450; // room after the last strike
  let previous = 400 + rng() * 700; // first strike 400..1100 ms in (clears its telegraph)
  strikes.push(previous);
  for (let i = 1; i < DUEL_STRIKES; i++) {
    const min = previous + STRIKE_MIN_GAP_MS;
    const remainingSlots = DUEL_STRIKES - 1 - i;
    const max = DUEL_WINDOW_MS - tail - remainingSlots * STRIKE_MIN_GAP_MS;
    previous = min + rng() * Math.max(0, max - min);
    strikes.push(previous);
  }
  return { seed, strikes, telegraphs: strikes.map((s) => s - TELEGRAPH_MS) };
}

/** Score a duel: each strike claims the press closest to it inside the window.
 *  Unmatched strikes are misses; presses outside every window are ignored. */
export function parryDuel(pattern: DuelPattern, presses: number[]): DuelResult {
  const hits: DuelHit[] = [];
  const used = new Set<number>();
  for (const strike of pattern.strikes) {
    let bestIndex = -1;
    let bestDelta = Infinity;
    presses.forEach((press, index) => {
      if (used.has(index)) return;
      const delta = Math.abs(press - strike);
      if (delta <= HIT_MS && delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });
    if (bestIndex === -1) {
      hits.push('miss');
      continue;
    }
    used.add(bestIndex);
    hits.push(bestDelta <= PERFECT_MS ? 'perfect' : 'hit');
  }

  const perfects = hits.filter((h) => h === 'perfect').length;
  const landed = hits.filter((h) => h !== 'miss').length;
  const score = perfects * 3 + (landed - perfects); // 3 pts perfect, 1 pt hit
  let verdict: DuelVerdict;
  if (perfects === DUEL_STRIKES) verdict = 'critical';
  else if (landed === DUEL_STRIKES) verdict = 'win';
  else if (landed >= Math.ceil(DUEL_STRIKES / 2)) verdict = 'hold';
  else verdict = 'lose';
  return { pattern, presses, hits, score, perfects, landed, verdict };
}

/** Stateless arbitration — reproduce the pattern from the seed alone. */
export function arbitrateDuel(seed: number, presses: number[]): DuelResult {
  return parryDuel(duelPattern(seed), presses);
}

export interface DuelReplay {
  v: 1;
  world: WorldId;
  /** UTC day index of the duel. */
  day: number;
  seed: number;
  uid: number;
  /** Presses relative to the duel start (ms). */
  presses: number[];
  /** When it finished (epoch ms) — informational only, never arbitrated. */
  ts: number;
}

/** A replay record the verifier can check with arbitrateDuel. */
export function duelReplay(world: WorldId, minutes: number, uid: number, presses: number[]): DuelReplay {
  return {
    v: 1,
    world,
    day: Math.floor(minutes / (24 * 60)),
    seed: duelSeed(world, minutes),
    uid,
    presses: [...presses],
    ts: Date.now(),
  };
}

/** Reject tampered or stale replays: the seed must match the recorded day. */
export function validateReplay(replay: DuelReplay, minutes: number): boolean {
  const day = Math.floor(minutes / (24 * 60));
  return (
    replay.v === 1 &&
    replay.day === day &&
    replay.seed === duelSeed(replay.world, minutes) &&
    Array.isArray(replay.presses) &&
    replay.presses.every((p) => Number.isFinite(p) && p >= 0 && p <= DUEL_WINDOW_MS + 500)
  );
}