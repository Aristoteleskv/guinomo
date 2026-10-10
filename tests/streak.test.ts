import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bumpStreak, GOLDEN_STREAK_DAYS, readStreak } from '../src/core/streak';

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

const advanceTo = (iso: string) => vi.setSystemTime(new Date(iso));

describe('daily visit streak', () => {
  it('starts at 1 on the first visit and is idempotent within the day', () => {
    expect(bumpStreak()).toBe(1);
    expect(bumpStreak()).toBe(1);
  });

  it('increments on consecutive days', () => {
    expect(bumpStreak()).toBe(1);
    advanceTo('2026-10-11T08:00:00');
    expect(bumpStreak()).toBe(2);
    advanceTo('2026-10-12T23:59:00');
    expect(bumpStreak()).toBe(3);
  });

  it('resets after a missed day', () => {
    expect(bumpStreak()).toBe(1);
    advanceTo('2026-10-11T09:00:00');
    expect(bumpStreak()).toBe(2);
    advanceTo('2026-10-14T09:00:00');
    expect(bumpStreak()).toBe(1);
  });

  it('readStreak keeps yesterday-only runs alive until today bumps', () => {
    expect(bumpStreak()).toBe(1);
    advanceTo('2026-10-11T09:00:00');
    expect(readStreak()).toBe(1);
    expect(bumpStreak()).toBe(2);
    expect(readStreak()).toBe(2);
  });

  it('readStreak reports 0 once the streak is broken', () => {
    expect(bumpStreak()).toBe(1);
    advanceTo('2026-10-13T09:00:00');
    expect(readStreak()).toBe(0);
  });

  it('exposes the golden poster threshold', () => {
    expect(GOLDEN_STREAK_DAYS).toBe(7);
  });
});