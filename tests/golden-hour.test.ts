import { describe, expect, it } from 'vitest';
import {
  GOLDEN_HOUR_END_MINUTE,
  GOLDEN_HOUR_MINUTES,
  GOLDEN_HOUR_START_MINUTE,
  goldenHourRemainingMs,
  goldenHourWindow,
  isGoldenHour,
  nextGoldenWindow,
} from '../src/core/goldenHour';

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

describe('daily golden hour', () => {
  it('lasts exactly 10 minutes', () => {
    const window = goldenHourWindow(new Date('2026-10-10T12:00:00'));
    expect((window.end.getTime() - window.start.getTime()) / 60_000).toBe(GOLDEN_HOUR_MINUTES);
  });

  it('starts at a deterministic time inside the announced range', () => {
    const first = goldenHourWindow(new Date('2026-10-10T00:00:00'));
    expect(minutesOf(first.start)).toBeGreaterThanOrEqual(GOLDEN_HOUR_START_MINUTE);
    expect(minutesOf(first.start)).toBeLessThanOrEqual(GOLDEN_HOUR_END_MINUTE);
    // Same day → the exact same window, whatever local time you ask at.
    expect(goldenHourWindow(new Date('2026-10-10T20:00:00')).start.getTime()).toBe(first.start.getTime());
  });

  it('varies the start time across days', () => {
    // Over 15 consecutive days at least two different start times must appear
    // (collision odds are negligible for the 361-minute range).
    const seen = new Set<number>();
    for (let day = 0; day < 15; day++) {
      const date = new Date(2026, 9, 10 + day, 12, 0, 0);
      seen.add(minutesOf(goldenHourWindow(date).start));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is active only inside the window', () => {
    const window = goldenHourWindow(new Date('2026-10-10T12:00:00'));
    const inside = new Date(window.start.getTime() + 5 * 60_000);
    expect(isGoldenHour(inside)).toBe(true);
    expect(isGoldenHour(new Date(window.start.getTime() - 1))).toBe(false);
    expect(isGoldenHour(new Date(window.end.getTime()))).toBe(false);
  });

  it('announces the next window: today before it starts, tomorrow after it ends', () => {
    const window = goldenHourWindow(new Date('2026-10-10T12:00:00'));

    const before = new Date(window.start.getTime() - 60_000);
    const next = nextGoldenWindow(before);
    expect(next.day.toDateString()).toBe('Sat Oct 10 2026');
    expect(next.fromNowMs).toBe(60_000);

    const after = new Date(window.end.getTime() + 60_000);
    const following = nextGoldenWindow(after);
    expect(following.day.toDateString()).toBe('Sun Oct 11 2026');
    expect(following.fromNowMs).toBeGreaterThan(0);
  });

  it('reports remaining time while active and zero afterwards', () => {
    const window = goldenHourWindow(new Date('2026-10-10T12:00:00'));
    const midway = new Date(window.start.getTime() + 3 * 60_000);
    expect(goldenHourRemainingMs(midway)).toBe(7 * 60_000);
    expect(goldenHourRemainingMs(new Date(window.end.getTime() + 1000))).toBe(0);
  });
});