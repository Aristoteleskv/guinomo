// Procedural arm-wave pose (real 3D, no animation clip). The kid avatar ships
// with only four clips (idle/run/air/bored); a greeting raises the *actual arm
// bones* on top of the blended pose instead of drawing a 2D sprite. The pure
// math lives here so it is unit-tested and the rig wiring (which bone is the
// arm and around which axis) stays in the engine.
//
// Rig reference (kid.bin): right arm = bone_11 → bone_21 → bone_19 → bone_20 →
// bone_18 (hand). Raising `bone_21` around its local X lifts the hand; swinging
// `bone_19`/`bone_18` around local Z waves it.

export const WAVE_DURATION_MS = 2200;

/** Raise angle (radians) of the upper arm at full strength. */
export const WAVE_RAISE = 1.15;

/** Swing amplitude (radians) of the forearm/hand at full strength. */
export const WAVE_AMPLITUDE = 0.45;

/** 0 → 1 → 0 envelope: quick fade in, hold, gentle fade out. */
export function waveStrength(elapsedMs: number, durationMs = WAVE_DURATION_MS): number {
  if (!(elapsedMs > 0) || elapsedMs >= durationMs) return 0;
  const k = elapsedMs / durationMs;
  return Math.min(1, k / 0.15, (1 - k) / 0.25);
}

/** Hand swing (radians, ~1.75 Hz) for the horizontal oscillation. */
export function waveSwing(elapsedMs: number): number {
  return Math.sin((elapsedMs / 1000) * 11);
}

/** Additive bone angles (radians) for a greeting at `elapsedMs`. */
export function waveAngles(elapsedMs: number): { raise: number; fore: number; hand: number } {
  const strength = waveStrength(elapsedMs);
  const swing = waveSwing(elapsedMs);
  return {
    raise: -WAVE_RAISE * strength,
    fore: WAVE_AMPLITUDE * strength * swing,
    hand: 0.35 * strength * Math.sin((elapsedMs / 1000) * 11 + 0.6),
  };
}
