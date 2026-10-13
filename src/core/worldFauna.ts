// Deterministic world fauna: the same creature at the same place at the same
// moment for every player — positions derive only from (world, index) seeds
// plus the unix-seconds clock, never Math.random. No DOM, no network, no
// storage: pure math, trivially unit-testable in any environment.
//
// This is the live "WASM fusion" candidate (docs/CPP_STRATEGY.md, Fase B):
// the exact same function compiles to a shared binary, and the parity test
// guarantees the TS and compiled versions never drift.

import type { WorldId } from './worlds';

export interface FaunaConfig {
  /** Friendly name of the species (PT). */
  kind: string;
  /** Number of points rendered for this world. */
  count: number;
  /** Horizontal spread of the flock centers around the world's origin. */
  radius: number;
  /** Bottom/top of the vertical band (y). */
  altitudeMin: number;
  altitudeMax: number;
  /** Point size in world units (PointsMaterial). */
  size: number;
  /** Base color (hex). */
  color: string;
  /** Min/max angular speed of each creature's orbit (rad/s). */
  minSpeed: number;
  maxSpeed: number;
}

/** One species per world. A null means "no fauna" (currently none). */
export const FAUNA: Record<WorldId, FaunaConfig | null> = {
  lobby: {
    kind: 'pombos',
    count: 240,
    radius: 30,
    altitudeMin: 4,
    altitudeMax: 14,
    size: 0.16,
    color: '#ff9e5e',
    minSpeed: 0.1,
    maxSpeed: 0.34,
  },
  alien: {
    kind: 'poeira-estrela',
    count: 900,
    radius: 34,
    altitudeMin: 2,
    altitudeMax: 22,
    size: 0.22,
    color: '#c084fc',
    minSpeed: 0.05,
    maxSpeed: 0.2,
  },
  forest: {
    kind: 'pirilampos',
    count: 700,
    radius: 28,
    altitudeMin: 0.6,
    altitudeMax: 5,
    size: 0.18,
    color: '#ffd166',
    minSpeed: 0.08,
    maxSpeed: 0.3,
  },
  'floating-city': {
    kind: 'cardumes',
    count: 500,
    radius: 26,
    altitudeMin: 0.8,
    altitudeMax: 6,
    size: 0.18,
    color: '#6ee7ff',
    minSpeed: 0.12,
    maxSpeed: 0.4,
  },
  'tropical-city': {
    kind: 'pétalas',
    count: 300,
    radius: 30,
    altitudeMin: 1,
    altitudeMax: 9,
    size: 0.15,
    color: '#ff8fa3',
    minSpeed: 0.06,
    maxSpeed: 0.24,
  },
  'old-town': {
    kind: 'traças-bisbilhoteiras',
    count: 380,
    radius: 26,
    altitudeMin: 0.7,
    altitudeMax: 7,
    size: 0.16,
    color: '#a7c957',
    minSpeed: 0.09,
    maxSpeed: 0.28,
  },
};

/** Config for a world, or null when the world has no fauna. */
export function faunaFor(world: WorldId): FaunaConfig | null {
  return FAUNA[world] ?? null;
}

/** FNV-1a — the project's standard stable-hash family (see worldRhythm). */
function hashOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (mulberry32) seeded by a u32 — same stream for everyone. */
function randomOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FlockCenter {
  x: number;
  y: number;
  z: number;
}

/**
 * Stable flock centers for a world — derived only from (world, flock), so the
 * layout never snaps at midnight and every player sees the same arrangement.
 */
function flockCenters(config: FaunaConfig, world: WorldId, flocks: number): FlockCenter[] {
  const centers: FlockCenter[] = [];
  for (let f = 0; f < flocks; f++) {
    const rnd = randomOf(hashOf(`${world}:flock:${f}`));
    const angle = rnd() * Math.PI * 2;
    const dist = config.radius * (0.25 + rnd() * 0.5);
    centers.push({
      x: Math.cos(angle) * dist,
      y: config.altitudeMin + rnd() * (config.altitudeMax - config.altitudeMin),
      z: Math.sin(angle) * dist,
    });
  }
  return centers;
}

/**
 * Writes the deterministic positions of every creature of `world` at `time`
 * (unix seconds, UTC) into `out` (length >= count * 3). The same instant
 * yields the same array on every device.
 */
export function writeFaunaPositions(world: WorldId, time: number, out: Float32Array): void {
  const config = FAUNA[world];
  if (!config) return;
  const flocks = Math.max(1, Math.min(8, Math.floor(config.count / 110)));
  const centers = flockCenters(config, world, flocks);
  for (let i = 0; i < config.count; i++) {
    const rnd = randomOf(hashOf(`${world}:${i}`));
    const flock = centers[i % flocks];
    const phase = rnd() * Math.PI * 2;
    const orbit = 1 + rnd() * 6.5;
    const speed = config.minSpeed + rnd() * (config.maxSpeed - config.minSpeed);
    const bob = 0.4 + rnd() * 1.2;
    const t = time * speed + phase;
    out[i * 3] = flock.x + Math.cos(t) * orbit;
    out[i * 3 + 1] = flock.y + Math.sin(t * 1.7 + phase) * bob;
    out[i * 3 + 2] = flock.z + Math.sin(t) * orbit * 0.85;
  }
}

/** Convenience allocation: the full position buffer for a world at `time`. */
export function faunaPositions(world: WorldId, time: number): Float32Array {
  const config = FAUNA[world];
  const out = new Float32Array((config?.count ?? 0) * 3);
  writeFaunaPositions(world, time, out);
  return out;
}