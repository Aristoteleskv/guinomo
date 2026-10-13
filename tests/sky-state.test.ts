import { describe, expect, it } from 'vitest';
import { mixHex, skyStateFor } from '../src/core/skyState';

const DAY = 1440 * 20_000;
const at = (hour: number, minute = 0) => DAY + hour * 60 + minute;

describe('céu como estado (A3)', () => {
  it('é determinístico: mesma (mundo, instante, awake) → mesmo céu', () => {
    const a = skyStateFor('floating-city', at(19, 30), false);
    const b = skyStateFor('floating-city', at(19, 30), false);
    expect(a).toEqual(b);
  });

  it('a fase segue o relógio UTC (6h/12h/18h/0h)', () => {
    expect(skyStateFor('lobby', at(6)).phase).toBe('dawn');
    expect(skyStateFor('lobby', at(12)).phase).toBe('day');
    expect(skyStateFor('lobby', at(18)).phase).toBe('dusk');
    expect(skyStateFor('lobby', at(0)).phase).toBe('night');
  });

  it('o ângulo solar é 0 a 6h, π/2 a 12h e π a 18h', () => {
    expect(skyStateFor('lobby', at(6)).angle).toBeCloseTo(0, 6);
    expect(skyStateFor('lobby', at(12)).angle).toBeCloseTo(Math.PI / 2, 6);
    expect(skyStateFor('lobby', at(18)).angle).toBeCloseTo(Math.PI, 6);
  });

  it('a noite mistura para 1 a meia-noite e para 0 ao meio-dia', () => {
    expect(skyStateFor('lobby', at(12)).nightBlend).toBeCloseTo(0, 3);
    expect(skyStateFor('lobby', at(0)).nightBlend).toBeCloseTo(1, 3);
    expect(skyStateFor('lobby', at(18)).nightBlend).toBeGreaterThan(0);
  });

  it('as flags de tema derivam do mundo', () => {
    expect(skyStateFor('alien', at(12)).alien).toBe(true);
    expect(skyStateFor('alien', at(12)).forest).toBe(false);
    expect(skyStateFor('forest', at(12)).forest).toBe(true);
    expect(skyStateFor('lobby', at(12)).alien).toBe(false);
  });

  it('o despertar (C7) tinge o céu e suaviza a noite', () => {
    const asleep = skyStateFor('old-town', at(18), false);
    const awake = skyStateFor('old-town', at(18), true);
    expect(awake.palette.sky).not.toBe(asleep.palette.sky);
    expect(awake.palette.horizon).not.toBe(asleep.palette.horizon);
    expect(awake.awake).toBe(true);
    expect(awake.nightBlend).toBeLessThan(asleep.nightBlend);
  });

  it('o humor do dia é estável e está em 0..99', () => {
    const morning = skyStateFor('tropical-city', at(8));
    const evening = skyStateFor('tropical-city', at(20));
    expect(morning.mood).toBe(evening.mood); // mesmo dia
    expect(morning.mood).toBeGreaterThanOrEqual(0);
    expect(morning.mood).toBeLessThanOrEqual(99);
    const moods = new Set([0, 1, 2, 3, 4].map((d) => skyStateFor('tropical-city', DAY + d * 1440 + 720).mood));
    expect(moods.size).toBeGreaterThan(1); // varia ao longo dos dias
  });

  it('todas as cores são hex válidos', () => {
    for (const world of ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'] as const) {
      const state = skyStateFor(world, at(7), true);
      for (const value of Object.values(state.palette)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('mixHex interpola e fixa as extremidades', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff'); // clamp
  });
});
