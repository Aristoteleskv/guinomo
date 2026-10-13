// A3 — the sky as world state. The dome no longer follows each device's local
// clock: it follows the *world's* deterministic state — the UTC day phase
// (worldRhythm), the daily mood and the per-player awakening (C7). The same
// instant renders the same sky for everyone standing in the same world, with
// no bytes on the wire. Pure and testable; the scene only feeds these values
// into the existing sky uniforms (no shader edits).

import { dayPhase, minuteOfDay, worldMood, type DayPhase } from './worldRhythm';
import type { WorldId } from './worlds';

export interface SkyPalette {
  horizon: string;
  overlay: string;
  sky: string;
  clouds: string;
  sun: string;
}

export interface SkyState {
  phase: DayPhase;
  /** Solar angle (radians) on the shared UTC clock. */
  angle: number;
  /** Night mix 0..1 (1 = deep night). */
  nightBlend: number;
  alien: boolean;
  forest: boolean;
  /** Deterministic mood of the day (0..99). */
  mood: number;
  awake: boolean;
  palette: SkyPalette;
}

/** Resting (day) palette per world. */
const BASE: Record<WorldId, SkyPalette> = {
  lobby: { horizon: '#cfeefc', overlay: '#d8eeff', sky: '#2b96d8', clouds: '#ffe9cf', sun: '#ffe1a1' },
  alien: { horizon: '#3a1a5a', overlay: '#4a2570', sky: '#12233f', clouds: '#c9a6ff', sun: '#d9b8ff' },
  forest: { horizon: '#a8cf8f', overlay: '#b7d9a0', sky: '#1f5c4a', clouds: '#eef2d2', sun: '#ffe6b0' },
  'floating-city': { horizon: '#b6d0d8', overlay: '#a2c6d2', sky: '#347a9e', clouds: '#c9e6e8', sun: '#ffe1a1' },
  'tropical-city': { horizon: '#f0c9a0', overlay: '#ffe0b0', sky: '#36a5a0', clouds: '#fff0cf', sun: '#ffe0a0' },
  'old-town': { horizon: '#e6cba8', overlay: '#e4c69e', sky: '#729bb0', clouds: '#f2dfc4', sun: '#ffe1a1' },
};

const DAWN: SkyPalette = { horizon: '#f6c9a8', overlay: '#ffd9b0', sky: '#6f7fc0', clouds: '#ffe6cf', sun: '#ffd0a0' };
const DUSK: SkyPalette = { horizon: '#f0a06a', overlay: '#ffbe86', sky: '#5a5aa8', clouds: '#ffcfa0', sun: '#ff9d5c' };
const NIGHT: SkyPalette = { horizon: '#12203a', overlay: '#1a2c4e', sky: '#070f28', clouds: '#b9c8f0', sun: '#dfe8ff' };
const AWAKENED: SkyPalette = { horizon: '#b98cff', overlay: '#d9b0ff', sky: '#3a2a6e', clouds: '#ffe6b0', sun: '#ffe9a6' };

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smooth01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => Math.round(clamp01(channel / 255) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Deterministic linear blend of two hex colors. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp01(t);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ]);
}

function mixPalette(a: SkyPalette, b: SkyPalette, t: number): SkyPalette {
  return {
    horizon: mixHex(a.horizon, b.horizon, t),
    overlay: mixHex(a.overlay, b.overlay, t),
    sky: mixHex(a.sky, b.sky, t),
    clouds: mixHex(a.clouds, b.clouds, t),
    sun: mixHex(a.sun, b.sun, t),
  };
}

/**
 * The world's sky state at `minutes` (whole minutes since the epoch, UTC).
 * `awake` reflects the player's Grand Secret (C7).
 */
export function skyStateFor(world: WorldId, minutes: number, awake = false): SkyState {
  const phase = dayPhase(minutes);
  const angle = (minuteOfDay(minutes) / 1440 - 0.25) * Math.PI * 2;
  const daylight = smooth01((Math.sin(angle) + 0.12) / 0.24);
  const mood = worldMood(world, minutes);
  const base = BASE[world] ?? BASE.lobby;

  let palette = base;
  if (phase === 'dawn') palette = mixPalette(base, DAWN, 0.72);
  else if (phase === 'dusk') palette = mixPalette(base, DUSK, 0.72);
  else if (phase === 'night') palette = mixPalette(base, NIGHT, 0.9);

  let nightBlend = 1 - daylight;
  if (awake) {
    palette = mixPalette(palette, AWAKENED, 0.4);
    nightBlend *= 0.82;
  }

  // The mood only ever nudges the clouds — deterministic and never structural.
  const moodShift = (mood - 50) / 50;
  palette = {
    ...palette,
    clouds: mixHex(palette.clouds, moodShift >= 0 ? '#fff2d0' : '#dfe8ff', Math.abs(moodShift) * 0.28),
  };

  return {
    phase,
    angle,
    nightBlend,
    alien: world === 'alien',
    forest: world === 'forest',
    mood,
    awake,
    palette,
  };
}