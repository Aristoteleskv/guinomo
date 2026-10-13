import { describe, expect, it } from 'vitest';
import {
  forcedWeather,
  rainDropCount,
  rainDropLength,
  rainFallSpeed,
  rainOpacity,
  weatherFor,
  WEATHER_KINDS,
} from '../src/core/weather';

const DAY = 1440 * 20_000;
const at = (hour: number, minute = 0) => new Date(DAY + (hour * 60 + minute) * 60_000);
/** A Date `hours` after a stable epoch, for sweeping time without wrapping. */
const t = (hours: number) => new Date(DAY + hours * 3_600_000);

describe('clima como estado (chuva)', () => {
  it('é determinístico: mesmo (mundo, instante) → mesmo clima', () => {
    expect(weatherFor('forest', at(19, 30))).toEqual(weatherFor('forest', at(19, 30)));
  });

  it('muda ao longo do tempo (não é constante)', () => {
    const kinds = new Set<string>();
    for (let h = 0; h < 240; h += 3) kinds.add(weatherFor('forest', t(h)).kind);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('o tipo e a intensidade são coerentes', () => {
    for (let h = 0; h < 400; h++) {
      const state = weatherFor('floating-city', t(h));
      expect(WEATHER_KINDS).toContain(state.kind);
      expect(state.intensity).toBeGreaterThanOrEqual(0);
      expect(state.intensity).toBeLessThanOrEqual(1);
      if (state.kind === 'clear') expect(state.intensity).toBe(0);
      else expect(state.intensity).toBeGreaterThan(0);
    }
  });

  it('o viés do mundo faz o bosque mais húmido que o mundo alien', () => {
    let forest = 0;
    let alien = 0;
    for (let h = 0; h < 500; h++) {
      forest += weatherFor('forest', t(h)).intensity;
      alien += weatherFor('alien', t(h)).intensity;
    }
    expect(forest).toBeGreaterThan(alien);
  });

  it('o vento é finito e limitado', () => {
    for (let h = 0; h < 300; h++) {
      const { wind } = weatherFor('old-town', t(h));
      expect(Number.isFinite(wind)).toBe(true);
      expect(Math.abs(wind)).toBeLessThanOrEqual(3);
    }
  });

  it('clear não tem gotas; mais intensidade → mais gotas e queda mais rápida', () => {
    const clear = { kind: 'clear', intensity: 0, wind: 0, wetness: 0 } as const;
    const drizzle = { kind: 'drizzle', intensity: 0.22, wind: 0.4, wetness: 0.22 } as const;
    const storm = { kind: 'storm', intensity: 1, wind: 0.8, wetness: 1 } as const;
    expect(rainDropCount(clear, 1000)).toBe(0);
    expect(rainDropCount(drizzle, 1000)).toBeLessThan(rainDropCount(storm, 1000));
    expect(rainFallSpeed(drizzle)).toBeLessThan(rainFallSpeed(storm));
    expect(rainDropLength(drizzle)).toBeLessThan(rainDropLength(storm));
    expect(rainOpacity(drizzle)).toBeLessThan(rainOpacity(storm));
  });

  it('forcedWeather lê os nomes e ignora o resto', () => {
    expect(forcedWeather('storm')?.kind).toBe('storm');
    expect(forcedWeather('STORM')?.intensity).toBe(1);
    expect(forcedWeather('clear')?.intensity).toBe(0);
    expect(forcedWeather('drizzle')?.kind).toBe('drizzle');
    expect(forcedWeather('bogus')).toBeNull();
    expect(forcedWeather(null)).toBeNull();
  });
});
