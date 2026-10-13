import { describe, expect, it } from 'vitest';
import {
  arbitrateDuel,
  duelPattern,
  duelReplay,
  duelSeed,
  parryDuel,
  validateReplay,
  DUEL_STRIKES,
  DUEL_WINDOW_MS,
  HIT_MS,
  PERFECT_MS,
  STRIKE_MIN_GAP_MS,
  TELEGRAPH_MS,
} from '../src/core/shadowDuel';

const DAY = 1440 * 20_000; // a fixed UTC day in minutes
const NOON = DAY + 12 * 60;

describe('duelo de sombras — núcleo determinístico', () => {
  it('a semente depende do mundo e do dia UTC', () => {
    const a = duelSeed('floating-city', NOON);
    expect(duelSeed('floating-city', NOON)).toBe(a);
    expect(duelSeed('floating-city', NOON + 1440)).not.toBe(a); // outro dia
    expect(duelSeed('alien', NOON)).not.toBe(a); // outro mundo
  });

  it('o padrão é idêntico para a mesma semente e varia entre sementes', () => {
    const a = duelPattern(duelSeed('old-town', NOON));
    const b = duelPattern(duelSeed('old-town', NOON));
    expect(a.strikes).toEqual(b.strikes);
    expect(a.telegraphs).toEqual(b.telegraphs);

    const c = duelPattern(duelSeed('forest', NOON));
    expect(c.strikes).not.toEqual(a.strikes);
  });

  it('as investidas respeitam janela, ordem e espaçamento mínimo', () => {
    for (let seed = 0; seed < 24; seed++) {
      const pattern = duelPattern(seed * 0x9e3779b9);
      expect(pattern.strikes).toHaveLength(DUEL_STRIKES);
      for (let i = 0; i < pattern.strikes.length; i++) {
        const strike = pattern.strikes[i];
        expect(strike).toBeGreaterThanOrEqual(0);
        expect(strike).toBeLessThanOrEqual(DUEL_WINDOW_MS);
        expect(pattern.telegraphs[i]).toBeCloseTo(strike - TELEGRAPH_MS, 6);
        if (i > 0) expect(strike - pattern.strikes[i - 1]).toBeGreaterThanOrEqual(STRIKE_MIN_GAP_MS - 1e-6);
      }
    }
  });

  it('jogo perfeito marca 3 pontos por investida e vence com critical', () => {
    const pattern = duelPattern(duelSeed('alien', NOON));
    const result = parryDuel(pattern, [...pattern.strikes]);
    expect(result.hits.every((h) => h === 'perfect')).toBe(true);
    expect(result.perfects).toBe(DUEL_STRIKES);
    expect(result.score).toBe(DUEL_STRIKES * 3);
    expect(result.verdict).toBe('critical');
  });

  it('dentro da janela mas fora do ponto exato vale um hit; todas acertadas vencem', () => {
    const pattern = duelPattern(duelSeed('alien', NOON));
    const presses = pattern.strikes.map((strike) => strike + PERFECT_MS + 40);
    const result = parryDuel(pattern, presses);
    expect(result.hits.every((h) => h === 'hit')).toBe(true);
    expect(result.landed).toBe(DUEL_STRIKES);
    expect(result.score).toBe(DUEL_STRIKES);
    expect(result.verdict).toBe('win');
  });

  it('falhar metade perde; acertar metade aguenta', () => {
    const pattern = duelPattern(duelSeed('forest', NOON));
    // Acerta as 3 primeiras, falha as restantes.
    const presses = pattern.strikes.slice(0, 3);
    const result = parryDuel(pattern, presses);
    expect(result.landed).toBe(3);
    expect(result.verdict).toBe('hold');

    const misses = parryDuel(pattern, []);
    expect(misses.landed).toBe(0);
    expect(misses.score).toBe(0);
    expect(misses.verdict).toBe('lose');
  });

  it('nunca conta a mesma carga para duas investidas', () => {
    const pattern = duelPattern(duelSeed('lobby', NOON));
    const strike = pattern.strikes[1];
    // Duas cargas que caem na janela da mesma investida: só uma conta.
    const result = parryDuel(pattern, [strike - 10, strike + 10]);
    expect(result.landed).toBe(1);
  });

  it('arbitrateDuel reproduz o resultado sem estado', () => {
    const seed = duelSeed('tropical-city', NOON);
    const presses = duelPattern(seed).strikes.map((strike) => strike + 30);
    const direct = parryDuel(duelPattern(seed), presses);
    const replayed = arbitrateDuel(seed, presses);
    expect(replayed.score).toBe(direct.score);
    expect(replayed.verdict).toBe(direct.verdict);
    expect(replayed.hits).toEqual(direct.hits);
  });

  it('o replay só é válido no dia em que foi gravado', () => {
    const replay = duelReplay('floating-city', NOON, 7, [1000, 2000]);
    expect(replay.day).toBe(20_000);
    expect(replay.seed).toBe(duelSeed('floating-city', NOON));
    expect(validateReplay(replay, NOON)).toBe(true);
    expect(validateReplay(replay, NOON + 1440)).toBe(false); // outro dia
    expect(validateReplay({ ...replay, seed: 123 }, NOON)).toBe(false); // adulterado
    expect(validateReplay({ ...replay, presses: [Number.NaN] }, NOON)).toBe(false);
  });

  it('a janela de acerto está ordenada: perfect ⊂ hit', () => {
    expect(PERFECT_MS).toBeLessThan(HIT_MS);
  });
});
