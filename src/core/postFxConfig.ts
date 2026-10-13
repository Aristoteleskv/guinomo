// Pure post-FX tuning (no three import): the values the main composer's bloom
// and vignette passes are built from. Kept in core so it can be unit-tested
// without pulling the renderer; engine/postfx.ts turns these into passes.

export interface BloomConfig {
  strength: number;
  radius: number;
  threshold: number;
}

/** Default bloom for capable devices — glints on secrets, foam and the sky. */
export const BLOOM: BloomConfig = { strength: 0.6, radius: 0.55, threshold: 0.82 };

/** Weaker bloom for mobiles, which have far less fill rate to spare. */
export const BLOOM_MOBILE: BloomConfig = { strength: 0.42, radius: 0.5, threshold: 0.86 };

/** Film vignette: how much the corners darken and how strong the grain is. */
export const VIGNETTE = { offset: 1.08, darkness: 0.8, grain: 0.028 };

/**
 * Picks the bloom settings for a device, or null to skip bloom entirely
 * (old iPhones can't afford the extra full-resolution passes).
 */
export function bloomConfigFor(
  device: 'desktop' | 'mobile' | 'tablet',
  oldIphone: boolean,
): BloomConfig | null {
  if (oldIphone) return null;
  return device === 'mobile' || device === 'tablet' ? BLOOM_MOBILE : BLOOM;
}
