// Pure post-FX tuning (no three import): the values the main composer's bloom
// and vignette passes are built from. Kept in core so it can be unit-tested
// without pulling the renderer; engine/postfx.ts turns these into passes.

export interface BloomConfig {
  strength: number;
  radius: number;
  threshold: number;
}

export interface VignetteConfig {
  offset: number;
  darkness: number;
  grain: number;
}

/** Reads a finite numeric URL param, or undefined when absent/invalid. */
function finiteParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Default bloom for capable devices — a faint glint on secrets, foam and the
 *  sky. Kept subtle: the image is already sRGB-encoded, so bloom reads stronger
 *  than in linear space. A high threshold means only real highlights bloom. */
export const BLOOM: BloomConfig = { strength: 0.3, radius: 0.6, threshold: 0.9 };

/** Weaker bloom for mobiles, which have far less fill rate to spare. */
export const BLOOM_MOBILE: BloomConfig = { strength: 0.22, radius: 0.55, threshold: 0.92 };

/** Film vignette: how much the corners darken and how strong the grain is. */
export const VIGNETTE: VignetteConfig = { offset: 1.08, darkness: 0.68, grain: 0.02 };

/**
 * Picks the bloom settings for a device, or null to skip bloom entirely
 * (old iPhones can't afford the extra full-resolution passes). Optional URL
 * overrides (`?bloom=0.5&bloomRadius=0.7&bloomThreshold=0.85`) let the look be
 * tuned live without a rebuild.
 */
export function bloomConfigFor(
  device: 'desktop' | 'mobile' | 'tablet',
  oldIphone: boolean,
  search = '',
): BloomConfig | null {
  if (oldIphone) return null;
  const base = device === 'mobile' || device === 'tablet' ? BLOOM_MOBILE : BLOOM;
  const params = new URLSearchParams(search);
  const strength = finiteParam(params, 'bloom');
  const radius = finiteParam(params, 'bloomRadius');
  const threshold = finiteParam(params, 'bloomThreshold');
  if (strength === undefined && radius === undefined && threshold === undefined) return base;
  return {
    strength: strength ?? base.strength,
    radius: radius ?? base.radius,
    threshold: threshold ?? base.threshold,
  };
}

export interface GodRaysConfig {
  /** Additive strength of the shafts. */
  intensity: number;
  /** How far the samples travel toward the sun (as a fraction of the ray). */
  density: number;
  /** Per-sample falloff along the ray. */
  decay: number;
  /** Luminance above which a pixel is treated as the light source. */
  threshold: number;
  /** Radial samples (compile-time; more is smoother and slower). */
  samples: number;
}

/**
 * Screen-space sun shafts. A screen-space approximation of crepuscular rays:
 * it radially blurs the brightest pixels toward the sun, so it adds atmosphere
 * without needing an occlusion buffer (the sun is a sky shader, not geometry).
 */
export const GODRAYS: GodRaysConfig = {
  intensity: 0.24,
  density: 0.8,
  decay: 0.93,
  threshold: 0.84,
  samples: 28,
};

/** Cheaper sun shafts for mobiles. */
export const GODRAYS_MOBILE: GodRaysConfig = {
  intensity: 0.18,
  density: 0.75,
  decay: 0.91,
  threshold: 0.88,
  samples: 16,
};

export function godRaysConfigFor(
  device: 'desktop' | 'mobile' | 'tablet',
  oldIphone: boolean,
  search = '',
): GodRaysConfig | null {
  if (oldIphone) return null;
  const base = device === 'mobile' || device === 'tablet' ? GODRAYS_MOBILE : GODRAYS;
  const params = new URLSearchParams(search);
  const intensity = finiteParam(params, 'godrays');
  const threshold = finiteParam(params, 'godraysThreshold');
  const decay = finiteParam(params, 'godraysDecay');
  const density = finiteParam(params, 'godraysDensity');
  if (intensity === undefined && threshold === undefined && decay === undefined && density === undefined) {
    return base;
  }
  return {
    ...base,
    intensity: intensity ?? base.intensity,
    threshold: threshold ?? base.threshold,
    decay: decay ?? base.decay,
    density: density ?? base.density,
  };
}

/**
 * Vignette settings, with live overrides (`?vignette=0.5&grain=0.03`).
 */
export function vignetteFor(search = ''): VignetteConfig {
  const params = new URLSearchParams(search);
  const darkness = finiteParam(params, 'vignette');
  const grain = finiteParam(params, 'grain');
  const offset = finiteParam(params, 'vignetteOffset');
  if (darkness === undefined && grain === undefined && offset === undefined) return VIGNETTE;
  return {
    offset: offset ?? VIGNETTE.offset,
    darkness: darkness ?? VIGNETTE.darkness,
    grain: grain ?? VIGNETTE.grain,
  };
}

/**
 * SSAO is opt-in (`?ssao`) on purpose: it renders the scene with override
 * "normal"/"depth" materials, which look harsh on the stylised, alpha-tested
 * vegetation (billboards become solid quads). Keeping it behind a flag lets it
 * be evaluated without changing the default look.
 */
export function ssaoEnabled(search: string): boolean {
  return new URLSearchParams(search).has('ssao');
}
