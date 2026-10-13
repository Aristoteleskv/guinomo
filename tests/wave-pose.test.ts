import { describe, expect, it } from 'vitest';
import {
  WAVE_AMPLITUDE,
  WAVE_DURATION_MS,
  WAVE_RAISE,
  waveAngles,
  waveStrength,
  waveSwing,
} from '../src/core/wavePose';

const HALF_SWING = (1000 * Math.PI) / 22; // 11·(ms/1000) = π/2 → sin = 1

describe('pose de onda 3D (wavePose)', () => {
  it('a força é 0 antes de começar e depois de acabar', () => {
    expect(waveStrength(0)).toBe(0);
    expect(waveStrength(-10)).toBe(0);
    expect(waveStrength(WAVE_DURATION_MS)).toBe(0);
    expect(waveStrength(WAVE_DURATION_MS + 500)).toBe(0);
  });

  it('sobe depressa, mantém e desce no fim', () => {
    expect(waveStrength(WAVE_DURATION_MS * 0.5)).toBe(1);
    expect(waveStrength(WAVE_DURATION_MS * 0.05)).toBeLessThan(1);
    expect(waveStrength(WAVE_DURATION_MS * 0.95)).toBeLessThan(1);
    expect(waveStrength(WAVE_DURATION_MS * 0.05)).toBeGreaterThan(0);
    expect(waveStrength(WAVE_DURATION_MS * 0.95)).toBeGreaterThan(0);
  });

  it('nunca sai de [0,1] ao longo de toda a duração', () => {
    for (let ms = 0; ms <= WAVE_DURATION_MS; ms += 25) {
      const s = waveStrength(ms);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('a oscilação da mão é senoidal e limitada a ±1', () => {
    expect(waveSwing(0)).toBeCloseTo(0, 6);
    expect(waveSwing(HALF_SWING)).toBeCloseTo(1, 6);
    expect(waveSwing(3 * HALF_SWING)).toBeCloseTo(-1, 6);
    for (let ms = 0; ms < 3000; ms += 17) {
      expect(Math.abs(waveSwing(ms))).toBeLessThanOrEqual(1);
    }
  });

  it('os ângulos levantam o braço e oscilam com amplitude limitada', () => {
    const mid = waveAngles(WAVE_DURATION_MS * 0.5);
    expect(mid.raise).toBeCloseTo(-WAVE_RAISE, 6);
    expect(Math.abs(mid.fore)).toBeLessThanOrEqual(WAVE_AMPLITUDE + 1e-9);
    expect(Math.abs(mid.hand)).toBeLessThanOrEqual(0.35 + 1e-9);
  });

  it('os ângulos são 0 fora da janela', () => {
    for (const elapsed of [-1, WAVE_DURATION_MS + 1]) {
      const out = waveAngles(elapsed);
      expect(out.raise).toBeCloseTo(0, 6);
      expect(out.fore).toBeCloseTo(0, 6);
      expect(out.hand).toBeCloseTo(0, 6);
    }
  });
});
