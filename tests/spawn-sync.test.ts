import { describe, expect, it } from 'vitest';
import { buildSpawnBody, parseSpawnResponse, roundPoint } from '../src/core/spawnSync';

describe('roundPoint (0.1 m resolution)', () => {
  it('rounds to one decimal place', () => {
    expect(roundPoint(12.24)).toBe(12.2);
    expect(roundPoint(-57.96)).toBe(-58);
    expect(roundPoint(2.25)).toBe(2.3);
  });
});

describe('buildSpawnBody (payload da API)', () => {
  it('serializa uid, mundo e coordenadas arredondadas', () => {
    const body = buildSpawnBody(15, 'old-town', { x: 12.24, y: 2.253, z: -57.97 });
    expect(body.get('uid')).toBe('15');
    expect(body.get('world')).toBe('old-town');
    expect(body.get('x')).toBe('12.2');
    expect(body.get('y')).toBe('2.3');
    expect(body.get('z')).toBe('-58');
  });

  it('envia o token CSRF quando presente', () => {
    expect(buildSpawnBody(1, 'forest', { x: 0, y: 0, z: 0 }, 'abc').get('csrf_token')).toBe('abc');
    expect(buildSpawnBody(1, 'forest', { x: 0, y: 0, z: 0 }).get('csrf_token')).toBe('');
  });
});

describe('parseSpawnResponse (GET api/guinomo/spawn.php)', () => {
  it('devolve o ponto quando saved é verdadeiro', () => {
    expect(parseSpawnResponse({ success: true, saved: true, x: 15.5, y: 2.2, z: -60 })).toEqual({
      x: 15.5,
      y: 2.2,
      z: -60,
    });
  });

  it('devolve null quando não há ponto guardado', () => {
    expect(parseSpawnResponse({ success: true, saved: false, x: null, y: null, z: null })).toBeNull();
  });

  it('rejeita coordenadas não numéricas ou não finitas', () => {
    expect(parseSpawnResponse({ saved: true, x: '12', y: 2, z: 3 })).toBeNull();
    expect(parseSpawnResponse({ saved: true, x: Infinity, y: 2, z: 3 })).toBeNull();
    expect(parseSpawnResponse(null)).toBeNull();
    expect(parseSpawnResponse('nope')).toBeNull();
  });
});