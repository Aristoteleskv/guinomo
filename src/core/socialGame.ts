// Regras sociais portadas de "Warm Afternoon" (Imtiaj-Sajin/3dWeb,
// shared/world.js). A ideia central: o ranking premia a vida social
// (ser cumprimentado vale mais do que cumprimentar, que vale mais do que
// qualquer conflito) e há sempre um "chão pacífico" onde ninguém pode ser
// atingido. Módulo puro, sem DOM nem motor — um único contrato que o cliente
// e qualquer futuro servidor podem importar sem nunca se afastarem.

/** Vida máxima de um participante (referência para o servidor autoritativo). */
export const MAX_HEALTH = 100;

/**
 * Estados de animação remota, enviados como um único inteiro por atualização.
 * Manter pequeno: é isto que viaja na rede, não nomes de clips.
 */
export const ANIM = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
  WAVE: 4,
  SIT_CHAIR: 5,
  SIT_FLOOR: 6,
  LIE: 7,
  INTERACT: 8,
} as const;

export type AnimCode = (typeof ANIM)[keyof typeof ANIM];

/** Código de estado -> clip que um personagem remoto deve repetir. */
export const ANIM_CLIP: Record<AnimCode, string> = {
  [ANIM.IDLE]: 'Idle',
  [ANIM.WALK]: 'Walking_A',
  [ANIM.RUN]: 'Running_A',
  [ANIM.JUMP]: 'Jump_Idle',
  [ANIM.WAVE]: 'Cheer',
  [ANIM.SIT_CHAIR]: 'Sit_Chair_Idle',
  [ANIM.SIT_FLOOR]: 'Sit_Floor_Idle',
  [ANIM.LIE]: 'Lie_Idle',
  [ANIM.INTERACT]: 'Interact',
};

/** Estados em que uma pessoa está em tréguas, onde quer que esteja. */
export const RESTING_ANIMS: ReadonlySet<AnimCode> = new Set([ANIM.SIT_CHAIR, ANIM.SIT_FLOOR, ANIM.LIE]);

/**
 * Zona circular de paz: ninguém pode ser atingido dentro dela (ex.: a praça
 * da mostra), nem estando a descansar em qualquer lado — há sempre um lugar
 * onde o conflito não chega. Valor referência usado no mundo original: raio 21.
 */
export function inSafeZone(x: number, z: number, cx: number, cz: number, radius: number): boolean {
  return Math.hypot(x - cx, z - cz) < radius;
}

/** Precisamente a regra do servidor: seguro dentro da zona OU a descansar. */
export function isProtected(
  x: number,
  z: number,
  anim: AnimCode,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  return inSafeZone(x, z, cx, cz, radius) || RESTING_ANIMS.has(anim);
}

// ---------- ranking social-first ----------
//
// Deliberadamente ponderado para que o topo da tabela seja quem as pessoas
// gostaram, não quem "venceu" mais: ser cumprimentado > cumprimentar > lutar.

export const SCORE_WEIGHTS = {
  waveGot: 4,
  waveGave: 2,
  kills: 1,
  deaths: -0.5,
} as const;

export interface ScoreStats {
  waveGot?: number;
  waveGave?: number;
  kills?: number;
  deaths?: number;
}

export function scoreOf(s: ScoreStats): number {
  return (
    (s.waveGot ?? 0) * SCORE_WEIGHTS.waveGot +
    (s.waveGave ?? 0) * SCORE_WEIGHTS.waveGave +
    (s.kills ?? 0) * SCORE_WEIGHTS.kills +
    (s.deaths ?? 0) * SCORE_WEIGHTS.deaths
  );
}

// ---------- nomes ----------
//
// Um nome é uma palavra + um número, gerado na hora e nunca armazenado — o
// Guinomo usa isto para convidados/bots sem precisar de base de dados.

export const NAME_WORDS: readonly string[] = [
  'Willow',
  'Pebble',
  'Meadow',
  'Cricket',
  'Sunny',
  'Maple',
  'Clover',
  'Breeze',
  'Poppy',
  'Cedar',
  'Rusty',
  'Puddle',
  'Hazel',
  'Comet',
  'Bramble',
  'Fern',
  'Peach',
  'Otter',
  'Juniper',
  'Sparrow',
  'Olive',
  'Waffle',
  'Pumpkin',
  'Wren',
  'Basil',
  'Mango',
  'Thistle',
  'Robin',
  'Acorn',
  'Daisy',
  'Ginger',
  'Marlow',
];

export function makeName(rand: () => number = Math.random): string {
  const word = NAME_WORDS[Math.floor(rand() * NAME_WORDS.length)];
  return `${word}${Math.floor(rand() * 90) + 10}`;
}

// ---------- variedade de looks ----------
//
// Modelo x tinta x altura = dezenas de pessoas distinguíveis sem download
// extra nem draw calls extras: a tinta multiplica a textura da roupa, a
// escala dá diferença de altura que se lê à distância.

/** Modelos KayKit incluídos no pack CC0 (ver scripts/fetch-kaykit.mjs). */
export const MODELS: readonly string[] = ['Rogue', 'Knight', 'Barbarian', 'Mage', 'Rogue_Hooded'];

/** Tintas de roupa — claras, porque multiplicar só escurece. */
export const TINTS: readonly string[] = [
  '#ffffff',
  '#ffd0b0',
  '#b9daff',
  '#c6ecbb',
  '#f6c8e2',
  '#ffe89a',
  '#bde4dc',
  '#dcc9ff',
  '#ffc0c0',
  '#cdeeff',
  '#ddf7c0',
  '#ffd6ea',
  '#c9d4ff',
  '#ffe6bd',
];

/** Um pouco de diferença de altura lê-se tão bem quanto a cor, à distância. */
export const SCALES: readonly number[] = [0.93, 1.0, 1.07];

/** Partes do corpo que nunca devem ser tingidas — cara verde é bug, não variedade. */
export const SKIN_PART = /head|face|hair/i;

/** Uma parte pode receber tinta de roupa? (cara/cabelo não). */
export function shouldTintPart(name: string): boolean {
  return !SKIN_PART.test(name);
}

export interface Look {
  model: string;
  tint: string;
  scale: number;
}

export function pickLook(rand: () => number = Math.random): Look {
  return {
    model: MODELS[Math.floor(rand() * MODELS.length)],
    tint: TINTS[Math.floor(rand() * TINTS.length)],
    scale: SCALES[Math.floor(rand() * SCALES.length)],
  };
}
