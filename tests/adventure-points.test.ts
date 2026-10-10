import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  awardPoints,
  claimDailyStreakPoints,
  GOLDEN_POINTS_MULTIPLIER,
  POINTS,
  pointsForActivity,
  readPoints,
} from '../src/core/adventurePoints';

const FIRST_DAY = new Date('2026-10-10T12:00:00');

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

describe('adventure points', () => {
  it('starts at zero', () => {
    expect(readPoints()).toBe(0);
  });

  it('doubles base points while the golden hour is active', () => {
    expect(pointsForActivity(POINTS.secret, false)).toBe(50);
    expect(pointsForActivity(POINTS.secret, true)).toBe(50 * GOLDEN_POINTS_MULTIPLIER);
    expect(pointsForActivity(POINTS.streakVisit, false)).toBe(10);
    expect(pointsForActivity(POINTS.friendMeet, true)).toBe(50);
  });

  it('awards, accumulates and returns the gain', () => {
    const first = awardPoints(POINTS.secret, false);
    expect(first).toBe(50);
    awardPoints(POINTS.poster, false);
    expect(readPoints()).toBe(55);
    const golden = awardPoints(POINTS.secret, true);
    expect(golden).toBe(100);
    expect(readPoints()).toBe(155);
  });

  it('claims the daily streak reward once per local day', () => {
    expect(claimDailyStreakPoints()).toBe(POINTS.streakVisit);
    expect(claimDailyStreakPoints()).toBe(0);
    expect(readPoints()).toBe(10);
    vi.setSystemTime(new Date('2026-10-11T09:00:00'));
    expect(claimDailyStreakPoints()).toBe(POINTS.streakVisit);
    expect(readPoints()).toBe(20);
  });
});