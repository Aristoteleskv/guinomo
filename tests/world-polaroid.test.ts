import { describe, expect, it } from 'vitest';
import {
  isPhotosPayload,
  isPlacedPayload,
  isValidPlacement,
  isWorldPolaroid,
  polaroidError,
  POLAROID_CAPTION_MAX,
  POLAROID_THUMB_MAX_CHARS,
  type WorldPolaroid,
} from '../src/core/worldPolaroid';

const VALID: WorldPolaroid = {
  id: 1,
  world: 'floating-city',
  x: 12.5,
  y: 0.2,
  z: -3,
  thumb: 'data:image/jpeg;base64,abc',
  caption: 'noite na cidade',
  uid: 15,
  createdAt: 1_700_000_000,
};

describe('validação de polaroid (B5)', () => {
  it('Aceita uma polaroid bem formada', () => {
    expect(isWorldPolaroid(VALID)).toBe(true);
  });

  it('Rejeita thumbnail que não é data URL', () => {
    expect(isWorldPolaroid({ ...VALID, thumb: 'http://x/y.png' })).toBe(false);
  });

  it('Rejeita thumbnail acima do limite', () => {
    expect(isWorldPolaroid({ ...VALID, thumb: `data:image/jpeg;base64,${'a'.repeat(POLAROID_THUMB_MAX_CHARS)}` })).toBe(false);
  });

  it('Rejeita legenda acima de 60 caracteres', () => {
    expect(isWorldPolaroid({ ...VALID, caption: 'a'.repeat(POLAROID_CAPTION_MAX + 1) })).toBe(false);
  });

  it('Rejeita coordenadas não finitas', () => {
    expect(isWorldPolaroid({ ...VALID, x: Number.NaN })).toBe(false);
    expect(isWorldPolaroid({ ...VALID, z: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('Payloads de resposta e de colocação', () => {
    expect(isPhotosPayload({ success: true, photos: [] })).toBe(true);
    expect(isPhotosPayload({ success: false, notes: [] })).toBe(false);
    expect(isPlacedPayload({ success: true, id: 5 })).toBe(true);
    expect(isPlacedPayload({ success: true })).toBe(false);
  });

  it('Valida um pedido de colocação antes de o enviar', () => {
    expect(isValidPlacement({ world: 'floating-city', x: 1, y: 2, z: 3, thumb: 'data:image/jpeg;base64,x', caption: 'oi' })).toBe(true);
    expect(isValidPlacement({ world: 'marte', x: 1, y: 2, z: 3, thumb: 'data:image/jpeg;base64,x', caption: 'oi' })).toBe(false);
    expect(isValidPlacement({ world: 'lobby', x: Number.NaN, y: 2, z: 3, thumb: 'data:image/jpeg;base64,x', caption: 'oi' })).toBe(false);
    expect(isValidPlacement({ world: 'lobby', x: 1, y: 2, z: 3, thumb: 'not-a-data-url', caption: 'oi' })).toBe(false);
  });

  it('Erros de backend lidos com proteção', () => {
    expect(polaroidError({ error: 'Mundo inválido' })).toBe('Mundo inválido');
    expect(polaroidError({})).toBeNull();
    expect(polaroidError(null)).toBeNull();
  });
});