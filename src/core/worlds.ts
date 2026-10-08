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
  {
    id: 'forest',
    label: { pt: 'Bosque Noop', en: 'Noop Forest' },
    description: { pt: 'Um refúgio verde para explorar com amigos.', en: 'A green retreat to explore with friends.' },
  },
  {
    id: 'floating-city',
    label: { pt: 'Cidade Flutuante', en: 'Floating City' },
    description: { pt: 'Uma cidade original suspensa sobre o oceano.', en: 'An original city suspended above the ocean.' },
  },
  {
    id: 'tropical-city',
    label: { pt: 'Cidade Tropical', en: 'Tropical City' },
    description: { pt: 'Cúpulas futuristas entre palmeiras e água.', en: 'Futuristic domes among palms and water.' },
  },
  {
    id: 'old-town',
    label: { pt: 'Vila Antiga', en: 'Old Town' },
    description: { pt: 'Uma vila acolhedora de pedra e madeira.', en: 'A welcoming village of stone and timber.' },
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
