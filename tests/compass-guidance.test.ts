import { describe, expect, it } from 'vitest';
import { HIDE_DISTANCE, NEAR_PULSE_DISTANCE, whisperForDistance } from '../src/core/compassGuidance';

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