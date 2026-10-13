// Procedural "look around" (real 3D, no animation clip). The kid ships with
// only four clips (idle/run/air/bored); a normal human glances to the sides
// while walking and idly, so we pose the *actual neck/head bones* on top of the
// blended animation and restore them after baking (engine/characters.ts, same
// snapshot/restore as the greeting wave). The pure math lives here so it is
// unit-tested.
//
// Rig reference (kid.bin): neck = bone_13 → head = bone_14, both with the child
// offset along +Y (the bone axis points up). Side-to-side is therefore a yaw
// around each bone's local Y; a small local X nod adds life.

export interface LookAngles {
  /** Yaw handed to the neck (radians). */
  neckYaw: number;
  /** Extra yaw handed to the head (radians). */
  headYaw: number;
  /** Nod around the head's local X (radians). */
  pitch: number;
}

/** Peak side-glance (radians, ~20°). */
export const LOOK_YAW = 0.3;

/** Peak nod (radians). */
export const LOOK_PITCH = 0.06;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Side-glance for an avatar at `elapsedMs`. `speed` (0…1) makes a moving avatar
 * scan a little more; `seed` desynchronises avatars so a crowd does not turn in
 * unison. Deterministic and bounded.
 */
export function lookAngles(elapsedMs: number, speed = 0, seed = 0): LookAngles {
  const t = elapsedMs / 1000;
  const active = clamp01(speed);
  const amplitude = LOOK_YAW * (0.55 + 0.45 * active);
  const rate = 0.45 + 0.5 * active;
  const yaw = amplitude * Math.sin(t * rate + seed) + amplitude * 0.35 * Math.sin(t * 0.19 + seed * 1.7);
  const pitch = LOOK_PITCH * Math.sin(t * 0.33 + seed * 0.7) * (1 - 0.5 * active);
  return {
    neckYaw: yaw * 0.6,
    headYaw: yaw * 0.4,
    pitch,
  };
}
