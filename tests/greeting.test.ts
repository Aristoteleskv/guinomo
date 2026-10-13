import { describe, expect, it } from 'vitest';
import {
  greetingBurst,
  greetingMessage,
  greetingSeed,
  isGreetingText,
  GREETING_DURATION,
  GREETING_PARTICLES,
} from '../src/core/greeting';

const DAY = 1440 * 20_000;

describe('saudação (greeting)', () => {
  it('reconhece o 👋 e o token de sticker, e ignora o resto', () => {
    expect(isGreetingText('👋')).toBe(true);
    expect(isGreetingText('olá 👋!')).toBe(true);
    expect(isGreetingText('[[sticker:wave]]')).toBe(true);
    expect(isGreetingText('   ')).toBe(false);
    expect(isGreetingText('hello world')).toBe(false);
    expect(isGreetingText(null)).toBe(false);
    expect(isGreetingText(undefined)).toBe(false);
  });

  it('a mensagem de saudação é o emoji', () => {
    expect(greetingMessage()).toBe('👋');
  });

  it('o anel de partículas é determinístico por seed', () => {
    const a = greetingBurst(12345);
    const b = greetingBurst(12345);
    const c = greetingBurst(54321);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(GREETING_PARTICLES);
    expect(greetingBurst(1, 5)).toHaveLength(5);
  });

  it('as partículas estão dentro dos limites esperados', () => {
    for (const particle of greetingBurst(98765)) {
      const radius = Math.hypot(particle.dx, particle.dz);
      expect(radius).toBeGreaterThanOrEqual(0.55 - 1e-6);
      expect(radius).toBeLessThanOrEqual(1.0 + 1e-6);
      expect(particle.dy).toBeGreaterThanOrEqual(0.2 - 1e-6);
      expect(particle.dy).toBeLessThanOrEqual(0.9 + 1e-6);
      expect(particle.phase).toBeGreaterThanOrEqual(0);
      expect(particle.phase).toBeLessThan(1);
    }
  });

  it('a seed depende do uid e do dia UTC', () => {
    const seed = greetingSeed(7, DAY + 12 * 60);
    expect(greetingSeed(7, DAY + 12 * 60)).toBe(seed);
    expect(greetingSeed(8, DAY + 12 * 60)).not.toBe(seed);
    expect(greetingSeed(7, DAY + 1440 + 12 * 60)).not.toBe(seed);
  });

  it('a duração é positiva', () => {
    expect(GREETING_DURATION).toBeGreaterThan(0);
  });
});
