// Sea tide (A2): deterministic water level derived from the world's own daily
// event window (worldRhythm) — same instant ⇒ same sea height on every device,
// no network, no shader changes. The level eases 0→1 while the window is open
// and ebbs 1→0 just after it closes, so the world visibly breathes with its
// calendar. The scene (tideScene.ts) only raises the sea mesh and a foam glow
// by this value.

import type { WorldId } from './worlds';
import { MINUTES_PER_DAY, minutesOf, nextWorldEvent, worldEvent } from './worldRhythm';

/** Maximum rise (metres) applied to the sea surface at full tide. */
export const TIDE_RISE_METERS = 1.6;

/** Minutes the tide takes to ease in at the start of the window. */
export const TIDE_EASE_MINUTES = 20;

/** Minutes the tide takes to ebb after the window closes. */
export const TIDE_EBB_MINUTES = 20;

/** Smoothstep 0→1. */
function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Tide level 0..1 for a world at a UTC instant. Inside the world's daily event
 * the sea rises (eased over the first 20 minutes, full until the end); right
 * after the window it ebbs back to calm over 20 minutes.
 */
export function seaTideLevel(worldId: WorldId, now: Date): number {
  const minutes = minutesOf(now);

  const active = worldEvent(worldId, minutes);
  if (active) {
    const inside = minutes - active.start;
    if (inside < TIDE_EASE_MINUTES) return easeInOut(inside / TIDE_EASE_MINUTES);
    return 1;
  }

  // Ebb just after the window closes: the "previous" daily window is the next
  // one minus a day (worlds have exactly one window that never crosses
  // midnight, so this is always the just-closed window).
  const next = nextWorldEvent(worldId, minutes);
  if (!next) return 0;
  const previousEnd = next.end - MINUTES_PER_DAY;
  const sinceEnd = minutes - previousEnd;
  if (sinceEnd >= 0 && sinceEnd < TIDE_EBB_MINUTES) {
    return 1 - easeInOut(sinceEnd / TIDE_EBB_MINUTES);
  }
  return 0;
}