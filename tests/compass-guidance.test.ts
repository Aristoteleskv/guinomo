import { describe, expect, it } from 'vitest';
import {
  HIDE_DISTANCE,
  NEAR_PULSE_DISTANCE,
  questLabel,
  questWhisper,
  screenAngleTo,
  whisperForDistance,
} from '../src/core/compassGuidance';

describe('whisperForDistance', () => {
  it('picks the closest bracket at or below the distance (portuguese)', () => {
    expect(whisperForDistance(100, false)).toContain('para lá das ruas');
    expect(whisperForDistance(45, false)).toContain('já te viu');
    expect(whisperForDistance(20, false)).toContain('mesmo adiante');
    expect(whisperForDistance(6, false)).toContain('mesmo ao lado');
  });

  it('matches exact bracket boundaries', () => {
    expect(whisperForDistance(60, false)).toContain('para lá das ruas');
    expect(whisperForDistance(35, false)).toContain('já te viu');
    expect(whisperForDistance(18, false)).toContain('mesmo adiante');
    expect(whisperForDistance(HIDE_DISTANCE, false)).toContain('mesmo ao lado');
  });

  it('localizes the hint', () => {
    expect(whisperForDistance(45, false)).toContain('aproximar-te');
    expect(whisperForDistance(45, true)).toContain('getting closer');
    expect(whisperForDistance(100, true)).toContain('beyond the streets');
  });

  it('returns an empty string once the player has arrived', () => {
    expect(whisperForDistance(HIDE_DISTANCE - 0.01, false)).toBe('');
    expect(whisperForDistance(0, true)).toBe('');
  });

  it('keeps the distance windows consistent', () => {
    expect(HIDE_DISTANCE).toBe(5);
    expect(NEAR_PULSE_DISTANCE).toBe(18);
    expect(NEAR_PULSE_DISTANCE).toBeGreaterThan(HIDE_DISTANCE);
    expect(NEAR_PULSE_DISTANCE).toBeLessThan(35);
  });
});

describe('quest copy (compass pointing at the next secret world)', () => {
  it('names the destination world with its icon', () => {
    expect(questLabel('🌴', 'Cidade Tropical', false)).toBe('Próximo · 🌴 Cidade Tropical');
    expect(questLabel('🌴', 'Tropical City', true)).toBe('Next · 🌴 Tropical City');
  });

  it('whispers how to reach the next world, localized', () => {
    expect(questWhisper(false)).toContain('Mapa de Mundos');
    expect(questWhisper(true)).toContain('World Map');
    expect(questWhisper(true)).toContain('travel');
  });
});

describe('screenAngleTo (quest needle aims at the World Map button)', () => {
  const origin = { x: 100, y: 100 };

  it('points up at 0°, right at 90° and down at 180°', () => {
    expect(screenAngleTo(origin, { x: 100, y: 0 })).toBeCloseTo(0);
    expect(screenAngleTo(origin, { x: 300, y: 100 })).toBeCloseTo(90);
    expect(screenAngleTo(origin, { x: 100, y: 300 })).toBeCloseTo(180);
  });

  it('points left at −90° and diagonals half-way', () => {
    expect(screenAngleTo(origin, { x: -100, y: 100 })).toBeCloseTo(-90);
    expect(screenAngleTo(origin, { x: 200, y: 0 })).toBeCloseTo(45);
  });

  it('stays at 0° when the target sits on the source', () => {
    expect(screenAngleTo(origin, origin)).toBe(0);
  });
});