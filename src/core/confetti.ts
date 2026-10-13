// Celebration confetti (pure): a deterministic particle burst generated from
// a seed (mulberry32). The same (seed, theme, count) produces byte-identical
// shards, so the effect is testable and stable across sessions; the scene
// (confettiScene.ts) only animates these fields with gravity and wobble.

export type ConfettiTheme = 'gold' | 'violet' | 'neutral';

export interface ConfettiPiece {
  /** Horizontal offset (metres) around the burst origin. */
  dx: number;
  dz: number;
  /** Initial height offset (metres) above the origin. */
  dy: number;
  /** Upward launch speed (metres/second). */
  vy: number;
  /** Wobble phase (radians) — spells the shard's sway. */
  phase: number;
  /** Lifetime (seconds) before the shard falls and fades. */
  ttl: number;
}

export const CONFETTI_COLORS: Record<ConfettiTheme, readonly string[]> = {
  gold: ['#ffd166', '#ffe08a', '#fff3c4', '#ffb84d'],
  violet: ['#b388ff', '#d0a8ff', '#8c6fff', '#e6d6ff'],
  neutral: ['#ffffff', '#ffd166', '#80d8ff', '#ff8a80'],
};

export const CONFETTI_COUNT = 120;
export const CONFETTI_GRAVITY = 5;
export const CONFETTI_SPREAD = 0.55;

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic burst of celebration shards for (seed, theme, count). */
export function confettiBurst(
  seed: number,
  theme: ConfettiTheme,
  count = CONFETTI_COUNT,
): ConfettiPiece[] {
  const rng = mulberry32(seed);
  const palette = CONFETTI_COLORS[theme];
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    void palette; // colors consumed by the scene renderer
    pieces.push({
      dx: (rng() - 0.5) * 1.6,
      dz: (rng() - 0.5) * 1.6,
      dy: 0.5 + rng() * 1.6,
      vy: 2.4 + rng() * 2.4,
      phase: rng() * Math.PI * 2,
      ttl: 1.4 + rng() * 1.2,
    });
  }
  return pieces;
}

/** Deterministic color pick per shard index (theme-aware). */
export function pieceColor(seed: number, index: number, theme: ConfettiTheme): string {
  const palette = CONFETTI_COLORS[theme];
  const rng = mulberry32(seed ^ (index * 0x9e3779b9));
  return palette[Math.floor(rng() * palette.length)];
}