import { describe, expect, it } from 'vitest';
import {
  BLOOM,
  BLOOM_MOBILE,
  GODRAYS,
  GODRAYS_MOBILE,
  VIGNETTE,
  bloomConfigFor,
  godRaysConfigFor,
  ssaoEnabled,
} from '../src/core/postFxConfig';

function expectBloom(config: { strength: number; radius: number; threshold: number }) {
  expect(config.strength).toBeGreaterThan(0);
  expect(config.strength).toBeLessThanOrEqual(1.5);
  expect(config.radius).toBeGreaterThan(0);
  expect(config.radius).toBeLessThanOrEqual(1);
  // A high threshold keeps the bloom to real highlights instead of washing
  // the whole frame.
  expect(config.threshold).toBeGreaterThanOrEqual(0.5);
  expect(config.threshold).toBeLessThanOrEqual(1);
}

describe('pós-processamento (postFxConfig)', () => {
  it('o bloom por omissão e o de telemóvel estão em intervalos são', () => {
    expectBloom(BLOOM);
    expectBloom(BLOOM_MOBILE);
    expect(BLOOM_MOBILE.strength).toBeLessThan(BLOOM.strength);
  });

  it('a vinheta tem valores contidos', () => {
    expect(VIGNETTE.offset).toBeGreaterThan(1);
    expect(VIGNETTE.offset).toBeLessThan(2);
    expect(VIGNETTE.darkness).toBeGreaterThan(0);
    expect(VIGNETTE.darkness).toBeLessThan(1);
    expect(VIGNETTE.grain).toBeGreaterThanOrEqual(0);
    expect(VIGNETTE.grain).toBeLessThan(0.1);
  });

  it('escolhe o bloom por dispositivo e desliga em iPhones antigos', () => {
    expect(bloomConfigFor('desktop', true)).toBeNull();
    expect(bloomConfigFor('mobile', true)).toBeNull();
    expect(bloomConfigFor('desktop', false)).toBe(BLOOM);
    expect(bloomConfigFor('mobile', false)).toBe(BLOOM_MOBILE);
    expect(bloomConfigFor('tablet', false)).toBe(BLOOM_MOBILE);
  });

  it('a afinação dos raios de sol está em intervalos são', () => {
    for (const config of [GODRAYS, GODRAYS_MOBILE]) {
      expect(config.intensity).toBeGreaterThan(0);
      expect(config.intensity).toBeLessThanOrEqual(1.5);
      expect(config.density).toBeGreaterThan(0);
      expect(config.density).toBeLessThanOrEqual(1.5);
      expect(config.decay).toBeGreaterThan(0);
      expect(config.decay).toBeLessThanOrEqual(1);
      expect(config.threshold).toBeGreaterThanOrEqual(0.5);
      expect(config.threshold).toBeLessThanOrEqual(1);
      expect(Number.isInteger(config.samples)).toBe(true);
      expect(config.samples).toBeGreaterThanOrEqual(8);
      expect(config.samples).toBeLessThanOrEqual(64);
    }
    // Telemóvel faz menos amostras.
    expect(GODRAYS_MOBILE.samples).toBeLessThan(GODRAYS.samples);
  });

  it('escolhe os raios de sol por dispositivo e desliga em iPhones antigos', () => {
    expect(godRaysConfigFor('desktop', true)).toBeNull();
    expect(godRaysConfigFor('desktop', false)).toBe(GODRAYS);
    expect(godRaysConfigFor('mobile', false)).toBe(GODRAYS_MOBILE);
    expect(godRaysConfigFor('tablet', false)).toBe(GODRAYS_MOBILE);
  });

  it('liga o SSAO apenas quando pedido explicitamente', () => {
    expect(ssaoEnabled('')).toBe(false);
    expect(ssaoEnabled('?world=lobby')).toBe(false);
    expect(ssaoEnabled('?ssao')).toBe(true);
    expect(ssaoEnabled('?world=lobby&ssao=1&audit=1')).toBe(true);
  });
});
