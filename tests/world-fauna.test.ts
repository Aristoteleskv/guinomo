import { describe, expect, it } from 'vitest';
import { faunaFor, faunaPositions, writeFaunaPositions } from '../src/core/worldFauna';
import type { WorldId } from '../src/core/worlds';

const WORLDS: WorldId[] = ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];

describe('configuração por mundo', () => {
  it('cada mundo tem fauna com contagem positiva e tamanho válido', () => {
    for (const world of WORLDS) {
      const config = faunaFor(world);
      expect(config).not.toBeNull();
      expect(config!.count).toBeGreaterThan(0);
      expect(config!.size).toBeGreaterThan(0);
      expect(config!.altitudeMax).toBeGreaterThan(config!.altitudeMin);
      expect(config!.maxSpeed).toBeGreaterThan(config!.minSpeed);
    }
  });

  it('as espécies/mundos são distintas (configs diferentes)', () => {
    const forest = faunaFor('forest')!;
    const alien = faunaFor('alien')!;
    expect(forest.kind).not.toBe(alien.kind);
    expect(forest.color).not.toBe(alien.color);
  });
});

describe('faunaPositions (determinismo)', () => {
  it('o mesmo instante dá exatamente as mesmas posições (todos veem o mesmo)', () => {
    const a = faunaPositions('forest', 1_751_000_000);
    const b = faunaPositions('forest', 1_751_000_000);
    expect(a).toEqual(b);
    expect(a.length).toBe(faunaFor('forest')!.count * 3);
  });

  it('escrever duas vezes no mesmo buffer produz o mesmo resultado', () => {
    const out1 = new Float32Array(faunaFor('floating-city')!.count * 3);
    const out2 = new Float32Array(faunaFor('floating-city')!.count * 3);
    writeFaunaPositions('floating-city', 1_751_000_000.5, out1);
    writeFaunaPositions('floating-city', 1_751_000_000.5, out2);
    expect(out2).toEqual(out1);
  });

  it('não tem NaN e mantém-se dentro dos limites do mundo', () => {
    for (const world of WORLDS) {
      const config = faunaFor(world)!;
      const positions = faunaPositions(world, 1_751_000_000);
      for (let i = 0; i < config.count; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
        // órbitas: centro ≤ radius*0.75, raio de órbita ≤ 7.5
        expect(Math.abs(x)).toBeLessThanOrEqual(config.radius * 0.8 + 8);
        expect(Math.abs(z)).toBeLessThanOrEqual(config.radius * 0.8 + 8);
        // altitude: centro ∈ [min, max], bob ≤ 1.6
        expect(y).toBeGreaterThanOrEqual(config.altitudeMin - 1.7);
        expect(y).toBeLessThanOrEqual(config.altitudeMax + 1.7);
      }
    }
  });

  it('o tempo move as criaturas (instantes diferentes ≠ posições)', () => {
    const t1 = faunaPositions('alien', 1_751_000_000);
    const t2 = faunaPositions('alien', 1_751_000_000 + 7);
    let changed = 0;
    for (let i = 0; i < t1.length; i++) {
      if (t1[i] !== t2[i]) changed++;
    }
    expect(changed).toBe(t1.length); // tudo se move (sinais com fases distintas)
  });

  it('mundos diferentes têm cenários diferentes no mesmo instante', () => {
    const forest = faunaPositions('forest', 1_751_000_000);
    const oldTown = faunaPositions('old-town', 1_751_000_000);
    expect(forest).not.toEqual(oldTown);
  });
});