import { describe, expect, it } from 'vitest';
import {
  decimate,
  EchoRecorder,
  ECHO_IDLE_RESAMPLE_MS,
  ECHO_LIFETIME_MS,
  ECHO_MAX_SAMPLES,
  ECHO_MIN_STEP_M,
  ghostPosition,
  loadGhosts,
  restoreTracks,
  saveGhosts,
} from '../src/core/presenceEcho';

const T0 = 1_750_000_000_000;

function walked(track: { x: number; z: number }, step: number, count: number) {
  // Prepares an EchoRecorder with a straight walk of `count` samples spaced
  // `step` metres apart, one sample per ms tick.
  const recorder = new EchoRecorder();
  for (let i = 0; i < count; i++) {
    recorder.observe('peer-1', 7, 'Kivova', { x: track.x + i * step, y: 0, z: track.z + i * step }, T0 + i * 100);
  }
  return recorder;
}

function memoryStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem(key: string): string | null {
      return key in store ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

describe('EchoRecorder — amostragem', () => {
  it('grava a primeira amostra e ignora movimentos menores que o passo mínimo', () => {
    const recorder = new EchoRecorder();
    recorder.observe('p', 1, 'A', { x: 0, y: 0, z: 0 }, T0);
    recorder.observe('p', 1, 'A', { x: 0.05, y: 0, z: 0 }, T0 + 100); // < 0.25 m → ignorada
    recorder.observe('p', 1, 'A', { x: 0.3, y: 0, z: 0 }, T0 + 200); // ≥ 0.25 m → gravada
    expect(recorder.activeIds()).toEqual(['p']);
    const track = recorder.drop('p', T0 + 300);
    expect(track).not.toBeNull();
    expect(track!.points).toHaveLength(2); // a que chegou lá — não o passinho de 0.05
    expect(track!.points[1].x).toBe(0.3);
  });

  it('grava quando há movimento ≥ ao passo mínimo', () => {
    const recorder = new EchoRecorder();
    recorder.observe('p', 1, 'A', { x: 0, y: 0, z: 0 }, T0);
    recorder.observe('p', 1, 'A', { x: ECHO_MIN_STEP_M, y: 0, z: 0 }, T0 + 10);
    const track = recorder.drop('p', T0 + 20);
    expect(track!.points).toHaveLength(2);
  });

  it('força amostras de continuidade quando parado além do intervalo', () => {
    const recorder = new EchoRecorder();
    recorder.observe('p', 1, 'A', { x: 0, y: 0, z: 0 }, T0);
    recorder.observe('p', 1, 'A', { x: 0, y: 0, z: 0 }, T0 + ECHO_IDLE_RESAMPLE_MS + 1);
    const track = recorder.drop('p', T0 + 1);
    expect(track!.points).toHaveLength(2);
  });

  it('mantém um máximo de amostras (anel: descarta as mais antigas)', () => {
    const recorder = new EchoRecorder();
    for (let i = 0; i < ECHO_MAX_SAMPLES + 20; i++) {
      recorder.observe('p', 1, 'A', { x: i * 0.3, y: 0, z: i * 0.3 }, T0 + i * 10);
    }
    const track = recorder.drop('p', T0 + 1)!;
    expect(track.t0).toBeGreaterThan(T0); // as primeiras amostras foram descartadas
  });

  it('drop de um rasto com menos de duas amostras devolve null', () => {
    const recorder = new EchoRecorder();
    recorder.observe('p', 1, 'A', { x: 0, y: 0, z: 0 }, T0);
    expect(recorder.drop('p', T0 + 1)).toBeNull();
  });

  it('ignora amostras com valores não finitos', () => {
    const recorder = new EchoRecorder();
    recorder.observe('p', 1, 'A', { x: NaN, y: Infinity, z: 0 }, T0);
    expect(recorder.activeIds()).toEqual([]);
  });
});

describe('decime — mantém extremos e limita pontos', () => {
  it('preserva o primeiro e o último ponto', () => {
    const samples = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ x: i, y: 0, z: i }));
    const out = decimate(samples, 4);
    expect(out[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(out[out.length - 1]).toEqual({ x: 9, y: 0, z: 9 });
    expect(out.length).toBe(4);
  });

  it('devolve o array intacto quando já cabe no limite', () => {
    const samples = [0, 1].map((i) => ({ x: i, y: 0, z: 0 }));
    expect(decimate(samples, 48)).toHaveLength(2);
  });
});

describe('ghostPosition — replay em loop', () => {
  const recorder = walked({ x: 0, z: 0 }, 1, 5); // 0→4 em 4 passos, 400 ms
  const track = recorder.drop('peer-1', T0)!;

  it('nasce no primeiro ponto e materializa-se (fade-in)', () => {
    const position = ghostPosition(track, T0);
    expect(position.alive).toBe(true);
    expect(position.x).toBe(0);
    expect(position.z).toBe(0);
    expect(position.fade).toBeLessThan(0.2); // ainda a aparecer
    const midFade = ghostPosition(track, T0 + 750);
    expect(midFade.fade).toBeCloseTo(0.5, 1); // a meio do fade-in
  });

  it('percorre a distância e recomeça o loop (fim = início)', () => {
    const span = track.t1 - track.t0;
    const atEnd = ghostPosition(track, T0 + span - 1);
    expect(atEnd.x).toBeGreaterThan(3.9); // próximo do fim do caminho
    const looped = ghostPosition(track, T0 + span);
    expect(looped.x).toBeCloseTo(0, 5); // recomeçou no início
  });

  it('dissolve e morre após a vida útil', () => {
    const near = ghostPosition(track, T0 + ECHO_LIFETIME_MS - 1_000);
    expect(near.alive).toBe(true);
    expect(near.fade).toBeLessThan(0.5); // a desaparecer
    const after = ghostPosition(track, T0 + ECHO_LIFETIME_MS + 1);
    expect(after.alive).toBe(false);
    expect(after.fade).toBe(0);
  });

  it('velocidade constante ao longo do caminho (mapeia por comprimento)', () => {
    const half = ghostPosition(track, T0 + (track.t1 - track.t0) / 2);
    // meio da duração ⇒ meio do comprimento (caminho reto equispaced)
    expect(half.x).toBeCloseTo(2, 1);
  });
});

describe('persistência — guinomo.ghosts.v1', () => {
  const recorder = walked({ x: 0, z: 0 }, 1, 6);
  const track = recorder.drop('peer-1', T0)!;
  const storage = memoryStorage();

  it('guarda e carrega com limites e arredondamento do mundo', () => {
    saveGhosts('forest', [track], storage);
    const loaded = loadGhosts('forest', storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].world).toBe('forest');
    expect(loaded[0].points.length / 3).toBeLessThanOrEqual(40);
    // outros mundos não trazem os espetros da floresta
    expect(loadGhosts('alien', storage)).toHaveLength(0);
  });

  it('restoreTracks devolve rastos prontos (bornAt 0 a definir)', () => {
    saveGhosts('forest', [track], storage);
    const tracks = restoreTracks('forest', storage);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].bornAt).toBe(0);
    expect(tracks[0].t1).toBeGreaterThan(tracks[0].t0);
    expect(tracks[0].points.length).toBe(loadedPointsCount(storage));
  });

  it('rejeita blobs corrompidos sem rebentar', () => {
    storage.setItem('guinomo.ghosts.v1', '{não é json');
    expect(loadGhosts('forest', storage)).toHaveLength(0);
  });

  it('valida e descarta entradas com geometria inválida', () => {
    const dump: Record<string, unknown> = {
      forest: [
        { id: 'ok', uid: 1, name: 'A', points: [0, 0, 0, 1, 1, 1], t0: 0, t1: 100, savedAt: 200 },
        { id: 'bad', uid: -1, name: 42, points: [NaN, 0, 0], t0: 0, t1: 1, savedAt: 2 },
        { id: 'huge', uid: 1, name: null, points: new Array(400).fill(0), t0: 0, t1: 1, savedAt: 2 },
      ],
    };
    storage.setItem('guinomo.ghosts.v1', JSON.stringify(dump));
    const loaded = loadGhosts('forest', storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('ok');
  });
});

function loadedPointsCount(storage: ReturnType<typeof memoryStorage>): number {
  const ghost = loadGhosts('forest', storage)[0];
  return ghost ? ghost.points.length / 3 : 0;
}