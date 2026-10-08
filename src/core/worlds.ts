export const DEFAULT_WORLD_ID = 'lobby';

export const WORLDS = [
  {
    id: 'lobby',
    label: { pt: 'Cidade Noop', en: 'Noop City' },
    description: { pt: 'O ponto de encontro público.', en: 'The public meeting place.' },
  },
  {
    id: 'alien',
    label: { pt: 'Universo Alienígena', en: 'Alien Universe' },
    description: { pt: 'A cidade sob um céu alienígena.', en: 'The city beneath an alien sky.' },
  },
] as const;

export type WorldId = (typeof WORLDS)[number]['id'];

export function getWorldId(value: string | null): WorldId {
  return WORLDS.find((world) => world.id === value)?.id ?? DEFAULT_WORLD_ID;
}

export async function getWorldRoomSeed(worldId: WorldId, roomCode: string | null): Promise<Uint8Array> {
  if (worldId === DEFAULT_WORLD_ID && !roomCode) {
    const seed = new Uint8Array(32);
    seed.set(new TextEncoder().encode('guinomo-p2p-room-v1'));
    return seed;
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is required to join a Guinomo world.');
  }

  const room = roomCode ? `invite:${roomCode}` : 'public';
  const source = new TextEncoder().encode(`guinomo-world:${worldId}:${room}`);
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', source));
}
