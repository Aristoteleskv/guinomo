// Weather as shared, deterministic state — the "calm vs heavy" rain the user
// asked for. Like core/skyState.ts, the weather depends only on the *world* and
// the UTC clock (with a per-world rain bias), so every player in a world sees
// the same drizzle/storm at the same moment without any networking. The scene
// (scene/rainScene.ts) turns this state into falling streaks.

export type WeatherKind = 'clear' | 'drizzle' | 'rain' | 'storm';

export interface WeatherState {
  kind: WeatherKind;
  /** 0 (dry) .. 1 (downpour). */
  intensity: number;
  /** Horizontal drift, roughly -1..1. */
  wind: number;
  /** 0..1 accumulated wetness (drives the wet look). */
  wetness: number;
}

/** Per-world rain bias: -1 desert-dry, +1 rainforest. */
const WORLD_RAIN_BIAS: Record<string, number> = {
  lobby: -0.08,
  alien: -0.34,
  forest: 0.34,
  'floating-city': 0.24,
  'tropical-city': 0.18,
  'old-town': 0.08,
};

/** Deterministic hash → [0, 1). */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth value noise in [0, 1) over a real axis. */
function smoothNoise(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash01(i);
  const b = hash01(i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * The weather of `world` at UTC instant `at`. Two overlapping octaves give long
 * calm stretches broken by wet spells; the world bias shifts the whole curve.
 */
export function weatherFor(world: string, at: Date): WeatherState {
  const hours = at.getTime() / 3_600_000;
  const base = smoothNoise(hours * 0.5) * 0.62 + smoothNoise(hours * 0.13 + 17) * 0.38;
  const bias = WORLD_RAIN_BIAS[world] ?? 0;
  const v = clamp01(base + bias);

  let kind: WeatherKind;
  if (v < 0.46) kind = 'clear';
  else if (v < 0.63) kind = 'drizzle';
  else if (v < 0.85) kind = 'rain';
  else kind = 'storm';

  const intensity = kind === 'clear' ? 0 : clamp01((v - 0.42) / 0.58);
  const wind = (smoothNoise(hours * 0.31 + 5) - 0.5) * 2 * (0.35 + intensity * 0.85);
  return { kind, intensity, wind, wetness: intensity };
}

export function isWet(state: WeatherState): boolean {
  return state.kind !== 'clear';
}

/** How many of the pool's drops are active for this weather. */
export function rainDropCount(state: WeatherState, poolSize: number): number {
  return Math.round(poolSize * state.intensity);
}

/** Fall speed in metres per second (calm drizzle vs driving storm). */
export function rainFallSpeed(state: WeatherState): number {
  return 9 + state.intensity * 12;
}

/** Streak length in metres. */
export function rainDropLength(state: WeatherState): number {
  return 0.22 + state.intensity * 0.7;
}

/** Line opacity of the rain. */
export function rainOpacity(state: WeatherState): number {
  return 0.16 + state.intensity * 0.5;
}

export const WEATHER_KINDS: WeatherKind[] = ['clear', 'drizzle', 'rain', 'storm'];

/**
 * A hand-picked weather from the URL (`?weather=storm`), or null for the
 * deterministic default. Lets the user preview calm vs heavy rain on demand
 * without waiting for the clock.
 */
export function forcedWeather(value: string | null): WeatherState | null {
  if (!value) return null;
  const kind = value.toLowerCase() as WeatherKind;
  if (!WEATHER_KINDS.includes(kind)) return null;
  const intensity = kind === 'clear' ? 0 : kind === 'drizzle' ? 0.22 : kind === 'rain' ? 0.6 : 1;
  const wind = kind === 'storm' ? 0.8 : kind === 'clear' ? 0.1 : 0.4;
  return { kind, intensity, wind, wetness: intensity };
}
