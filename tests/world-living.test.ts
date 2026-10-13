import { describe, expect, it } from 'vitest';
import { seaTideLevel, TIDE_EASE_MINUTES, TIDE_RISE_METERS } from '../src/core/seaTide';
import {
  awakeningActive,
  AWAKENING_GRAND_SECRET_KEY,
  awakeningPulse,
  isWorldAwakened,
  type StorageLike,
} from '../src/core/worldAwakening';
import { confettiBurst, CONFETTI_COLORS, pieceColor, type ConfettiTheme } from '../src/core/confetti';

/** 2026-10-13 time-of-day in UTC. */
function at(hours: number, minutes = 0, seconds = 0): Date {
  return new Date(Date.UTC(2026, 9, 13, hours, minutes, seconds));
}

describe('maré determinística (A2)', () => {
  it('Nível 0 fora da janela do evento', () => {
    expect(seaTideLevel('floating-city', at(17, 0))).toBe(0);
    expect(seaTideLevel('floating-city', at(17, 59))).toBe(0);
    expect(seaTideLevel('floating-city', at(20, 0))).toBe(0);
  });

  it('Sobe com easing no arranque da janela (18:00–19:30)', () => {
    expect(seaTideLevel('floating-city', at(18, 0))).toBe(0);
    expect(seaTideLevel('floating-city', at(18, 5))).toBeCloseTo(0.15625, 4);
    expect(seaTideLevel('floating-city', at(18, 10))).toBeCloseTo(0.5, 4);
    expect(seaTideLevel('floating-city', at(18, 20))).toBe(1); // após os easing minutos
    expect(seaTideLevel('floating-city', at(19, 29))).toBe(1);
  });

  it('Vaza logo após fechar (continuidade no pico)', () => {
    expect(seaTideLevel('floating-city', at(19, 30))).toBe(1);
    expect(seaTideLevel('floating-city', at(19, 40))).toBeCloseTo(0.5, 4);
    expect(seaTideLevel('floating-city', at(19, 50))).toBe(0);
  });

  it('Outros mundos ficam calmos durante a maré da Cidade Flutuante', () => {
    expect(seaTideLevel('alien', at(18, 10))).toBe(0);
    expect(seaTideLevel('forest', at(18, 10))).toBe(0);
  });

  it('Constantes coerentes', () => {
    expect(TIDE_RISE_METERS).toBeGreaterThan(0);
    expect(TIDE_EASE_MINUTES).toBeGreaterThan(0);
  });
});

describe('despertar do mundo (C7)', () => {
  function awake(key: string | null): StorageLike {
    return { getItem: (k: string) => (k === AWAKENING_GRAND_SECRET_KEY ? key : null) };
  }

  it('Mundo dormido: nunca desperta nem pulsa', () => {
    const storage = awake(null);
    expect(isWorldAwakened(storage)).toBe(false);
    expect(awakeningActive(at(12, 10), storage)).toBe(false);
    expect(awakeningPulse(at(12, 10), storage)).toBe(0);
  });

  it('Mundo desperto: pulso fade-in, janela e fade-out', () => {
    const storage = awake('1');
    expect(isWorldAwakened(storage)).toBe(true);

    expect(awakeningPulse(at(11, 59), storage)).toBe(0);
    expect(awakeningPulse(at(12, 2), storage)).toBeCloseTo(0.25, 4);
    expect(awakeningPulse(at(12, 8), storage)).toBe(1);
    expect(awakeningPulse(at(12, 25), storage)).toBe(1);
    expect(awakeningPulse(at(12, 30), storage)).toBe(1);
    expect(awakeningPulse(at(12, 34), storage)).toBeCloseTo(0.5, 4);
    expect(awakeningPulse(at(12, 38), storage)).toBe(0);
  });

  it('Janela ativa apenas dentro do intervalo (12:00–12:30 UTC)', () => {
    const storage = awake('1');
    expect(awakeningActive(at(11, 59), storage)).toBe(false);
    expect(awakeningActive(at(12, 0), storage)).toBe(true);
    expect(awakeningActive(at(12, 29), storage)).toBe(true);
    expect(awakeningActive(at(12, 30), storage)).toBe(false);
  });

  it('Sem storage (node) nunca assume desperto', () => {
    expect(isWorldAwakened(undefined)).toBe(false);
    expect(awakeningPulse(at(12, 10), undefined)).toBe(0);
  });
});

describe('confetti determinístico', () => {
  it('Mesma seed ⇒ idêntico; seed diferente ⇒ diferente', () => {
    expect(confettiBurst(42, 'gold', 8)).toEqual(confettiBurst(42, 'gold', 8));
    expect(confettiBurst(42, 'gold', 8)).not.toEqual(confettiBurst(43, 'gold', 8));
  });

  it('Contagem e campos fisicamente sanos', () => {
    const pieces = confettiBurst(7, 'violet', 16);
    expect(pieces).toHaveLength(16);
    for (const piece of pieces) {
      expect(Math.abs(piece.dx)).toBeLessThanOrEqual(0.8);
      expect(Math.abs(piece.dz)).toBeLessThanOrEqual(0.8);
      expect(piece.dy).toBeGreaterThanOrEqual(0.5);
      expect(piece.dy).toBeLessThanOrEqual(2.1);
      expect(piece.vy).toBeGreaterThanOrEqual(2.4);
      expect(piece.vy).toBeLessThanOrEqual(4.8);
      expect(piece.ttl).toBeGreaterThan(1);
      expect(piece.ttl).toBeLessThanOrEqual(2.6);
    }
  });

  it('Cores sempre dentro da paleta do tema', () => {
    const themes: ConfettiTheme[] = ['gold', 'violet', 'neutral'];
    for (const theme of themes) {
      const color = pieceColor(3, 0, theme);
      expect(CONFETTI_COLORS[theme]).toContain(color);
    }
  });
});