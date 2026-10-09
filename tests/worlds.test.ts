import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_ID, getWorldId, getWorldRoomSeed, WORLDS } from '../src/core/worlds';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const hex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

describe('world routing', () => {
  it('falls back to the default world for missing or unknown ids', () => {
    expect(getWorldId(null)).toBe(DEFAULT_WORLD_ID);
    expect(getWorldId('does-not-exist')).toBe(DEFAULT_WORLD_ID);
  });

  it('accepts every declared world id', () => {
    for (const world of WORLDS) {
      expect(getWorldId(world.id)).toBe(world.id);
    }
  });
});

describe('world room seeds', () => {
  it('keeps the fixed legacy seed for the default room', async () => {
    const expected = new Uint8Array(32);
    expected.set(bytes('guinomo-p2p-room-v1'));
    expect(hex(await getWorldRoomSeed(DEFAULT_WORLD_ID, null))).toBe(hex(expected));
  });

  it('hashes non-default rooms into 32-byte seeds', async () => {
    const union = await getWorldRoomSeed('forest', null);
    expect(union).toBeInstanceOf(Uint8Array);
    expect(union.length).toBe(32);
    expect(hex(union)).not.toBe(hex(await getWorldRoomSeed(DEFAULT_WORLD_ID, null)));
  });

  it('is stable for the same world + room and isolated across worlds', async () => {
    const a = hex(await getWorldRoomSeed('forest', 'abcdef0123456789'));
    const b = hex(await getWorldRoomSeed('forest', 'abcdef0123456789'));
    const otherWorld = hex(await getWorldRoomSeed('old-town', 'abcdef0123456789'));
    const otherRoom = hex(await getWorldRoomSeed('forest', '0000000000000000'));

    expect(a).toBe(b);
    expect(a).not.toBe(otherWorld);
    expect(a).not.toBe(otherRoom);
  });
});
