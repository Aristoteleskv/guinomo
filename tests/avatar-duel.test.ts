import { describe, expect, it } from 'vitest';
import {
  avatarDuelNonce,
  avatarDuelSeed,
  encodeAccept,
  encodeChallenge,
  encodeResult,
  isAvatarDuelText,
  parseAvatarDuel,
  resolveAvatarDuel,
} from '../src/core/avatarDuel';
import { duelPattern, DUEL_STRIKES } from '../src/core/shadowDuel';

describe('duelo entre avatares (avatarDuel)', () => {
  it('codifica e volta a ler um desafio', () => {
    const token = encodeChallenge(4242, 7, 9);
    expect(token).toBe('[[duel:c:4242:7:9]]');
    expect(parseAvatarDuel(token)).toEqual({ kind: 'challenge', nonce: 4242, from: 7, to: 9 });
  });

  it('codifica e volta a ler uma aceitação', () => {
    const token = encodeAccept(4242, 9, 7);
    expect(parseAvatarDuel(token)).toEqual({ kind: 'accept', nonce: 4242, from: 9, to: 7 });
  });

  it('codifica e volta a ler um resultado com e sem cargas', () => {
    expect(parseAvatarDuel(encodeResult(77, 3, [412.6, 1900.2]))).toEqual({
      kind: 'result',
      nonce: 77,
      uid: 3,
      presses: [413, 1900],
    });
    expect(parseAvatarDuel(encodeResult(77, 3, []))).toEqual({
      kind: 'result',
      nonce: 77,
      uid: 3,
      presses: [],
    });
  });

  it('reconhece texto de duelo e ignora o resto', () => {
    expect(isAvatarDuelText('[[duel:c:1:2:3]]')).toBe(true);
    expect(isAvatarDuelText('olá [[duel:r:1:2:10]] adeus')).toBe(true);
    expect(isAvatarDuelText('[[sticker:wave]]')).toBe(false);
    expect(isAvatarDuelText('texto normal')).toBe(false);
    expect(isAvatarDuelText(undefined)).toBe(false);
  });

  it('devolve null para tokens malformados', () => {
    expect(parseAvatarDuel('texto normal')).toBeNull();
    expect(parseAvatarDuel('[[duel:c:abc:1:2]]')).toBeNull();
    expect(parseAvatarDuel('[[duel:c:5:-1:2]]')).toBeNull();
    expect(parseAvatarDuel('[[duel:r:5:1:10,abc]]')).toBeNull();
    expect(parseAvatarDuel('[[duel:r:5:1:99999999]]')).toBeNull();
    expect(parseAvatarDuel('[[sticker:heart]]')).toBeNull();
    expect(parseAvatarDuel(null)).toBeNull();
  });

  it('a semente é determinística e muda com o nonce', () => {
    expect(avatarDuelSeed(123)).toBe(avatarDuelSeed(123));
    expect(avatarDuelSeed(123)).not.toBe(avatarDuelSeed(124));
    expect(avatarDuelSeed(0)).toBeGreaterThanOrEqual(0);
  });

  it('gera nonces inteiros positivos e distintos', () => {
    const a = avatarDuelNonce(0.1);
    const b = avatarDuelNonce(0.9);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('ambos os clientes concordam no vencedor (determinístico)', () => {
    const seed = avatarDuelSeed(999);
    const pattern = duelPattern(seed);
    expect(pattern.strikes).toHaveLength(DUEL_STRIKES);
    const perfect = [...pattern.strikes];
    const empty: number[] = [];

    const fromChallenger = resolveAvatarDuel(seed, perfect, empty);
    const fromAcceptor = resolveAvatarDuel(seed, empty, perfect);

    expect(fromChallenger.mine.score).toBe(DUEL_STRIKES * 3);
    expect(fromChallenger.verdict).toBe('win');
    expect(fromAcceptor.verdict).toBe('lose');
    // O mesmo par de resultados é visto de forma simétrica.
    expect(fromAcceptor.theirs.score).toBe(fromChallenger.mine.score);
    expect(fromAcceptor.mine.score).toBe(fromChallenger.theirs.score);
  });

  it('empate quando os dois registos são iguais', () => {
    const seed = avatarDuelSeed(321);
    const presses = [200, 1200, 2500];
    expect(resolveAvatarDuel(seed, presses, [...presses]).verdict).toBe('draw');
  });
});
