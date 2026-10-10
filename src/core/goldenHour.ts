// Daily "golden hour": a 10-minute window whose start time varies every day
// (deterministic per local calendar day) and is announced by the HUD. While it
// is active, discovery actions award double adventure points. Pure logic — no
// DOM and no storage — so it is trivially unit-testable.

/** Length of the golden window, in minutes. */
export const GOLDEN_HOUR_MINUTES = 10;

/** Earliest local minute-of-day the golden hour can start (17:00). */
export const GOLDEN_HOUR_START_MINUTE = 17 * 60;

/** Latest local minute-of-day the golden hour can start (23:00). */
export const GOLDEN_HOUR_END_MINUTE = 23 * 60;

/** Range (minutes) from which each day's start time is drawn. */
export const GOLDEN_HOUR_SPAN_MINUTES = GOLDEN_HOUR_END_MINUTE - GOLDEN_HOUR_START_MINUTE;

/** Local calendar day key, e.g. "2026-10-10". */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** FNV-1a hash of the day key → a stable pseudo-random minute-of-day offset
 *  in [GOLDEN_HOUR_START_MINUTE, GOLDEN_HOUR_END_MINUTE]. Same day, same
 *  window, on every device — so friends agree on when the golden hour is. */
function seededStartMinute(date: Date): number {
  const key = dayKey(date);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return GOLDEN_HOUR_START_MINUTE + (hash >>> 0) % (GOLDEN_HOUR_SPAN_MINUTES + 1);
}

export interface GoldenWindow {
  start: Date;
  end: Date;
}

/** The golden window (start/end) for the local day `date` belongs to. */
export function goldenHourWindow(date: Date): GoldenWindow {
  const start = new Date(date);
  start.setHours(0, seededStartMinute(date), 0, 0);
  const end = new Date(start.getTime() + GOLDEN_HOUR_MINUTES * 60_000);
  return { start, end };
}

/** Whether `date` falls inside today's golden window. */
export function isGoldenHour(date: Date): boolean {
  const { start, end } = goldenHourWindow(date);
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

export interface NextGoldenWindow {
  /** The day the next window belongs to (its start is a Date of that day). */
  day: Date;
  start: Date;
  end: Date;
  /** Milliseconds from `date` until the window starts (0 when already inside). */
  fromNowMs: number;
}

/** The next golden window from `date`: today's if it has not ended yet,
 *  otherwise tomorrow's. Used to announce the event before it happens. */
export function nextGoldenWindow(date: Date): NextGoldenWindow {
  const today = goldenHourWindow(date);
  if (date.getTime() < today.end.getTime()) {
    return {
      day: today.start,
      start: today.start,
      end: today.end,
      fromNowMs: Math.max(0, today.start.getTime() - date.getTime()),
    };
  }
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = goldenHourWindow(tomorrow);
  return { day: next.start, start: next.start, end: next.end, fromNowMs: next.start.getTime() - date.getTime() };
}

/** Milliseconds left in today's golden window (0 when not active). */
export function goldenHourRemainingMs(date: Date): number {
  const { end } = goldenHourWindow(date);
  return Math.max(0, end.getTime() - date.getTime());
}