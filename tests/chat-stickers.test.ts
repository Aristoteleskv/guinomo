import { describe, expect, it } from 'vitest';
import {
  EMOJI,
  STICKERS,
  isKnownSticker,
  parseChatTokens,
  stickerToken,
} from '../src/components/chatStickers';

describe('chat stickers', () => {
  it('round-trips a sticker token', () => {
    const token = stickerToken('heart');
    expect(token).toBe('[[sticker:heart]]');
    expect(parseChatTokens(token)).toEqual([{ type: 'sticker', id: 'heart' }]);
  });

  it('keeps text around a sticker', () => {
    expect(parseChatTokens('hey [[sticker:smile]] there')).toEqual([
      { type: 'text', value: 'hey ' },
      { type: 'sticker', id: 'smile' },
      { type: 'text', value: ' there' },
    ]);
  });

  it('parses several stickers in one message', () => {
    expect(parseChatTokens('[[sticker:heart]][[sticker:star]]')).toEqual([
      { type: 'sticker', id: 'heart' },
      { type: 'sticker', id: 'star' },
    ]);
  });

  it('leaves unknown tokens as literal text (graceful degradation)', () => {
    const text = 'olha [[sticker:does-not-exist]]!';
    expect(parseChatTokens(text)).toEqual([{ type: 'text', value: text }]);
    expect(isKnownSticker('does-not-exist')).toBe(false);
  });

  it('returns plain text unchanged', () => {
    expect(parseChatTokens('só texto')).toEqual([{ type: 'text', value: 'só texto' }]);
  });

  it('has a unique, well-formed catalog', () => {
    const ids = STICKERS.map((sticker) => sticker.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sticker of STICKERS) {
      expect(sticker.id).toMatch(/^[a-z0-9_-]+$/);
      expect(sticker.label.pt.length).toBeGreaterThan(0);
      expect(sticker.label.en.length).toBeGreaterThan(0);
      expect(Boolean(sticker.svg) || Boolean(sticker.src)).toBe(true);
      expect(isKnownSticker(sticker.id)).toBe(true);
    }
    expect(EMOJI.length).toBeGreaterThan(0);
  });
});
