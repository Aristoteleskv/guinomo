import { describe, expect, it } from 'vitest';
import { BLOOM, BLOOM_MOBILE, VIGNETTE, bloomConfigFor } from '../src/core/postFxConfig';

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
});
