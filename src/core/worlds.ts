export const DEFAULT_WORLD_ID = 'lobby';

export const WORLDS = [
  {
    id: 'lobby',
    icon: '🏙️',
    label: { pt: 'Cidade Noop', en: 'Noop City' },
    description: { pt: 'O ponto de encontro público.', en: 'The public meeting place.' },
    hint: { pt: 'Mantém os olhos no céu…', en: 'Keep an eye on the sky…' },
  },
  {
    id: 'alien',
    icon: '🛸',
    label: { pt: 'Universo Alienígena', en: 'Alien Universe' },
    description: { pt: 'A cidade sob um céu alienígena.', en: 'The city beneath an alien sky.' },
    hint: { pt: 'Procura por quem veio de muito longe.', en: 'Look for someone who came from very far.' },
  },
  {
    id: 'forest',
    icon: '🌲',
    label: { pt: 'Bosque Noop', en: 'Noop Forest' },
    description: { pt: 'Um refúgio verde para explorar com amigos.', en: 'A green retreat to explore with friends.' },
    hint: { pt: 'Alguém preguiçoso esconde-se entre as árvores.', en: 'A lazy someone hides among the trees.' },
  },
  {
    id: 'floating-city',
    icon: '☁️',
    label: { pt: 'Cidade Flutuante', en: 'Floating City' },
    description: { pt: 'Uma cidade original suspensa sobre o oceano.', en: 'An original city suspended above the ocean.' },
    hint: { pt: 'O céu desta cidade guarda um segredo.', en: 'This city’s sky keeps a secret.' },
  },
  {
    id: 'tropical-city',
    icon: '🌴',
    label: { pt: 'Cidade Tropical', en: 'Tropical City' },
    description: { pt: 'Cúpulas futuristas entre palmeiras e água.', en: 'Futuristic domes among palms and water.' },
    hint: { pt: 'Os gatos adoram as palmeiras tropicais.', en: 'The cats love the tropical palms.' },
  },
  {
    id: 'old-town',
    icon: '🏰',
    label: { pt: 'Vila Antiga', en: 'Old Town' },
    description: { pt: 'Uma vila acolhedora de pedra e madeira.', en: 'A welcoming village of stone and timber.' },
    hint: { pt: 'As comadres da praça contam tudo…', en: 'The town gossips tell everything…' },
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
