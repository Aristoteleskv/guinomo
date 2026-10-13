// Saudação (greeting): the non-invasive wave. There is no dedicated protocol —
// the 👋 rides the existing plain-text P2P chat channel (exactly like a
// sticker) and every client lifts a floating 👋 + a ring of particles over the
// greeter's avatar. Pure helpers only; the scene draws them. Deterministic so
// two clients with the same seed draw the same ring.

import { mulberry32 } from './confetti';
import { WAVE_DURATION_MS } from './wavePose';

/** The glyph that means "wave" on the chat channel (already in the emoji tray). */
export const GREETING_EMOJI = '👋';

/**
 * Future sticker id: if a dedicated `wave` sticker is ever added to the catalog
 * (`[[sticker:wave]]`), greetings ride the same token without touching the scene.
 */
export const GREETING_STICKER_ID = 'wave';

const GREETING_TOKENS = [GREETING_EMOJI, `[[sticker:${GREETING_STICKER_ID}]]`];

/** Seconds a greeting stays on screen (matches the procedural arm wave). */
export const GREETING_DURATION = WAVE_DURATION_MS / 1000;

/** Number of ring particles per greeting. */
export const GREETING_PARTICLES = 14;

export interface GreetingParticle {
  dx: number;
  dz: number;
  dy: number;
  phase: number;
}

/** True when a chat text carries a greeting (emoji or wave sticker token). */
export function isGreetingText(text: string | null | undefined): boolean {
  if (typeof text !== 'string') return false;
  return GREETING_TOKENS.some((token) => text.includes(token));
}

/** The greeting message sent on the chat channel. */
export function greetingMessage(): string {
  return GREETING_EMOJI;
}

/** Deterministic ring of particles for a greeting (same seed → same ring). */
export function greetingBurst(seed: number, count = GREETING_PARTICLES): GreetingParticle[] {
  const rng = mulberry32(seed);
  const particles: GreetingParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.35;
    const radius = 0.55 + rng() * 0.45;
    particles.push({
      dx: Math.cos(angle) * radius,
      dz: Math.sin(angle) * radius,
      dy: 0.2 + rng() * 0.7,
      phase: rng(),
    });
  }
  return particles;
}

/** Deterministic seed for a greeting by `uid` on the UTC day of `minutes`. */
export function greetingSeed(uid: number, minutes: number): number {
  const day = Math.floor(minutes / (24 * 60));
  let hash = 0x9e3779b9 ^ (uid >>> 0);
  hash = Math.imul(hash ^ day, 0x01000193);
  return hash >>> 0;
}
