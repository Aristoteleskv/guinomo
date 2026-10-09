import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, STATE_BYTES, STATE_VERSION } from '../src/engine/multiplayer/stateCodec';

describe('P2P state codec', () => {
  it('round-trips a full state frame', () => {
    const data = {
      p: [1.5, -2.25, 3.75],
      r: [0.5, -1.25],
      a: 1,
      seed: 2.5,
      uid: 42,
      h: 0,
      phy: 4,
      ageScale: 0.93,
      gender: 'feminino',
    };

    const encoded = encodeState(data);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBe(STATE_BYTES);
    expect(encoded[0]).toBe(STATE_VERSION);

    const decoded = decodeState(encoded);
    expect(decoded.p).toEqual([1.5, -2.25, 3.75]);
    expect(decoded.r).toEqual([0.5, -1.25]);
    expect(decoded.a).toBe(1);
    expect(decoded.seed).toBeCloseTo(2.5, 5);
    expect(decoded.uid).toBe(42);
    expect(decoded.h).toBe(0);
    expect(decoded.phy).toBe(4);
    expect(decoded.ageScale).toBeCloseTo(0.93, 5);
    expect(decoded.gender).toBe('feminino');
  });

  it('applies defaults for missing fields', () => {
    const decoded = decodeState(encodeState({}));
    expect(decoded.p).toEqual([0, 0, 0]);
    expect(decoded.r).toEqual([0, 0]);
    expect(decoded.a).toBe(0);
    expect(decoded.uid).toBe(0);
    expect(decoded.h).toBe(1);
    expect(decoded.phy).toBe(0);
    expect(decoded.ageScale).toBe(1);
    expect(decoded.gender).toBe('nao_informado');
  });

  it('clamps ageScale to the 0.6..1.2 range', () => {
    expect(decodeState(encodeState({ ageScale: 5 })).ageScale).toBeCloseTo(1.2, 5);
    expect(decodeState(encodeState({ ageScale: 0.1 })).ageScale).toBeCloseTo(0.6, 5);
  });

  it('maps gender categories', () => {
    expect(decodeState(encodeState({ gender: 'masculino' })).gender).toBe('masculino');
    expect(decodeState(encodeState({ gender: 'outro' })).gender).toBe('outro');
    expect(decodeState(encodeState({ gender: 'qualquer' })).gender).toBe('nao_informado');
  });

  it('rejects malformed frames', () => {
    expect(() => decodeState(new Uint8Array(10))).toThrow(/bad state frame/);

    const wrongVersion = encodeState({});
    wrongVersion[0] = 99;
    expect(() => decodeState(wrongVersion)).toThrow(/bad state frame/);
  });
});
