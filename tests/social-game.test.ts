import { describe, expect, it } from 'vitest';
import {
  ANIM,
  ANIM_CLIP,
  inSafeZone,
  isProtected,
  makeName,
  MODELS,
  NAME_WORDS,
  pickLook,
  RESTING_ANIMS,
  SCALES,
  SCORE_WEIGHTS,
  scoreOf,
  shouldTintPart,
  TINTS,
} from '../src/core/socialGame';

describe('ranking social-first', () => {
  it('ser cumprimentado vale mais do que cumprimentar', () => {
    expect(SCORE_WEIGHTS.waveGot).toBeGreaterThan(SCORE_WEIGHTS.waveGave);
    // um cumprimento recebido > um dado + uma kill: social vence o conflito
    expect(scoreOf({ waveGot: 1 })).toBeGreaterThan(scoreOf({ waveGave: 1, kills: 1 }));
  });

  it('morrer puxa a pontuação para baixo', () => {
    expect(scoreOf({ kills: 1 })).toBeGreaterThan(scoreOf({ kills: 1, deaths: 1 }));
  });

  it('zero stats dá zero', () => {
    expect(scoreOf({})).toBe(0);
  });
});

describe('zonas de paz', () => {
  const CX = 0;
  const CZ = 0;
  const RADIUS = 21;

  it('dentro do raio está em zona segura; fora, não', () => {
    expect(inSafeZone(10, 10, CX, CZ, RADIUS)).toBe(true);
    expect(inSafeZone(30, 30, CX, CZ, RADIUS)).toBe(false);
  });

  it('a descansar está protegido em qualquer lugar', () => {
    expect(isProtected(50, 50, ANIM.LIE, CX, CZ, RADIUS)).toBe(true);
    expect(isProtected(50, 50, ANIM.SIT_CHAIR, CX, CZ, RADIUS)).toBe(true);
    expect(RESTING_ANIMS.has(ANIM.SIT_FLOOR)).toBe(true);
  });

  it('em pé e fora da zona não está protegido', () => {
    expect(isProtected(50, 50, ANIM.WALK, CX, CZ, RADIUS)).toBe(false);
  });
});

describe('estados de animação', () => {
  it('cada estado tem um clip correspondente', () => {
    for (const value of Object.values(ANIM)) {
      expect(Object.prototype.hasOwnProperty.call(ANIM_CLIP, value)).toBe(true);
      expect(ANIM_CLIP[value as keyof typeof ANIM]).toBeTruthy();
    }
  });
});

describe('nomes', () => {
  it('nome é palavra + número de dois dígitos', () => {
    for (let i = 0; i < 200; i++) {
      const name = makeName();
      expect(name).toMatch(/^[A-Za-z]+\d{2}$/);
      expect(NAME_WORDS.some((w) => name.startsWith(w))).toBe(true);
    }
  });

  it('respeita o gerador injetado (determinístico)', () => {
    const zero = () => 0;
    expect(makeName(zero)).toBe(`${NAME_WORDS[0]}10`);
  });
});

describe('variedade de looks', () => {
  it('tinta e escala vêm dos conjuntos definidos', () => {
    for (let i = 0; i < 200; i++) {
      const look = pickLook();
      expect(MODELS).toContain(look.model);
      expect(TINTS).toContain(look.tint);
      expect(SCALES).toContain(look.scale);
    }
  });

  it('cara e cabelo nunca recebem tinta de roupa', () => {
    expect(shouldTintPart('head')).toBe(false);
    expect(shouldTintPart('face')).toBe(false);
    expect(shouldTintPart('hair')).toBe(false);
    expect(shouldTintPart('Torso')).toBe(true);
    expect(shouldTintPart('legs')).toBe(true);
  });
});
