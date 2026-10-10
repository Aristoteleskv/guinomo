import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advancePair,
  claimPairToday,
  hasClaimedPair,
  NO_PAIR,
  pairCountToday,
  pairFriendKey,
  PAIR_BREAK_DISTANCE,
  PAIR_LINK_SECONDS,
  PAIR_START_DISTANCE,
} from '../src/core/extraordinaryPair';

const FIRST_DAY = new Date('2026-10-10T12:00:00');
const NEXT_DAY = new Date('2026-10-11T09:00:00');

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIRST_DAY);
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('extraordinary pair', () => {
  it('stays idle when no one is close', () => {
    const next = advancePair(NO_PAIR, PAIR_START_DISTANCE + 1, 1, 'u1');
    expect(next.phase).toBe('none');
    expect(next.progress).toBe(0);
    expect(next.friendKey).toBeNull();
  });

  it('warms up with sustained proximity and links after PAIR_LINK_SECONDS', () => {
    let state = NO_PAIR;
    const dt = 0.3;
    const steps = PAIR_LINK_SECONDS / dt;
    for (let i = 0; i < steps; i++) {
      state = advancePair(state, PAIR_START_DISTANCE - 0.5, dt, 'u1');
      if (i < steps - 1) expect(state.phase).toBe('warming');
    }
    expect(state.phase).toBe('linked');
    expect(state.progress).toBe(1);
    expect(state.friendKey).toBe('u1');
  });

  it('restarts the progress when the target changes while warming', () => {
    const warmed = { phase: 'warming' as const, progress: 0.5, friendKey: 'u1' };
    const switched = advancePair(warmed, 2, 0.1, 'u2');
    expect(switched.friendKey).toBe('u2');
    expect(switched.progress).toBeCloseTo(0.1 / PAIR_LINK_SECONDS);
  });

  it('resets the warming progress when stepping far away', () => {
    const warmed = { phase: 'warming' as const, progress: 0.6, friendKey: 'u1' };
    const next = advancePair(warmed, PAIR_START_DISTANCE + 3, 0.1, 'u1');
    expect(next.phase).toBe('none');
    expect(next.progress).toBe(0);
  });

  it('keeps a formed link with hysteresis between start and break distance', () => {
    const linked = { phase: 'linked' as const, progress: 1, friendKey: 'u1' };
    expect(advancePair(linked, PAIR_START_DISTANCE + 1, 0.1, 'u1').phase).toBe('linked');
    expect(advancePair(linked, PAIR_BREAK_DISTANCE, 0.1, 'u1').phase).toBe('linked');
    const broken = advancePair(linked, PAIR_BREAK_DISTANCE + 0.1, 0.1, 'u1');
    expect(broken.phase).toBe('none');
    expect(broken.friendKey).toBeNull();
  });

  it('uses the real uid for claims and the client id for guests', () => {
    expect(pairFriendKey(42, 'client-a')).toBe('u42');
    expect(pairFriendKey(0, 'client-a')).toBe('cclient-a');
  });

  it('claims the daily pair once per friend, per day', () => {
    expect(claimPairToday('u1', FIRST_DAY)).toBe(true);
    expect(claimPairToday('u1', FIRST_DAY)).toBe(false);
    expect(hasClaimedPair('u1', FIRST_DAY)).toBe(true);

    expect(claimPairToday('u2', FIRST_DAY)).toBe(true);
    expect(claimPairToday('cclient-a', FIRST_DAY)).toBe(true);
    expect(pairCountToday(FIRST_DAY)).toBe(3);

    // A new day re-arms the same friend.
    vi.setSystemTime(NEXT_DAY);
    expect(hasClaimedPair('u1', NEXT_DAY)).toBe(false);
    expect(claimPairToday('u1', NEXT_DAY)).toBe(true);
    expect(pairCountToday(NEXT_DAY)).toBe(1);
  });
});
