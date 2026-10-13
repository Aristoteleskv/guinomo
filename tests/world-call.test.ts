import { describe, expect, it } from 'vitest';
import {
  claimWorldCall,
  isClaimedToday,
  minuteOfUtcDay,
  utcDayKey,
  WC_CLAIM_KEY,
  WC_DURATION_MINUTES,
  WC_MIN_ONLINE,
  worldCallState,
} from '../src/core/worldCall';

/** 2026-10-13 21:05 UTC por defeito — dentro da janela diária. */
function at(hours: number, minutes = 0, seconds = 0): Date {
  return new Date(Date.UTC(2026, 9, 13, hours, minutes, seconds));
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

describe('máquina do alinhamento (UTC determinístico)', () => {
  it('idle muito antes da janela', () => {
    const state = worldCallState(at(12), 5, memoryStorage());
    expect(state.phase).toBe('idle');
    expect(state.qualifies).toBe(false);
    expect(state.minutesLeft).toBe(0);
  });

  it('upcoming com contagem a partir de 1h antes', () => {
    const at20 = worldCallState(at(20, 0), 0, memoryStorage());
    expect(at20.phase).toBe('upcoming');
    expect(at20.minutesLeft).toBe(60);
    expect(worldCallState(at(20, 59), 0, memoryStorage()).minutesLeft).toBe(1);
    expect(worldCallState(at(19, 59), 0, memoryStorage()).phase).toBe('idle');
  });

  it('active durante a janela com contagem decrescente', () => {
    const open = worldCallState(at(21, 0), 2, memoryStorage());
    expect(open.phase).toBe('active');
    expect(open.minutesLeft).toBe(WC_DURATION_MINUTES);
    expect(worldCallState(at(21, 19), 2, memoryStorage()).minutesLeft).toBe(1);
    expect(worldCallState(at(21, 19, 59), 2, memoryStorage()).minutesLeft).toBe(1);
  });

  it('qualifica com >= MIN online durante a janela, nunca fora', () => {
    expect(worldCallState(at(21, 5), 1, memoryStorage()).qualifies).toBe(false);
    expect(worldCallState(at(21, 5), WC_MIN_ONLINE, memoryStorage()).qualifies).toBe(true);
    expect(worldCallState(at(21, 5), 9, memoryStorage()).qualifies).toBe(true);
    expect(worldCallState(at(20, 30), 9, memoryStorage()).qualifies).toBe(false);
  });

  it('done depois da janela', () => {
    expect(worldCallState(at(21, 20), 2, memoryStorage()).phase).toBe('done');
    expect(worldCallState(at(23, 0), 2, memoryStorage()).phase).toBe('done');
  });
});

describe('selo coletivo diário', () => {
  it('cunha uma vez por dia UTC quando qualifica', () => {
    const storage = memoryStorage();
    expect(claimWorldCall(at(21, 5), 3, storage)).toBe(true);
    expect(isClaimedToday(at(21, 5), storage)).toBe(true);
    expect(claimWorldCall(at(21, 10), 3, storage)).toBe(false); // já cunhado hoje
    expect(worldCallState(at(21, 10), 3, storage).claimed).toBe(true);
  });

  it('recusa fora da janela ou sem gente suficiente', () => {
    const storage = memoryStorage();
    expect(claimWorldCall(at(12, 0), 5, storage)).toBe(false);
    expect(claimWorldCall(at(21, 5), 1, storage)).toBe(false);
    expect(isClaimedToday(at(21, 5), storage)).toBe(false);
  });

  it('no dia seguinte volta a permitir (chave = dia UTC)', () => {
    const storage = memoryStorage();
    expect(claimWorldCall(at(21, 5), 2, storage)).toBe(true);
    const nextDay = new Date(Date.UTC(2026, 9, 14, 21, 5));
    expect(claimWorldCall(nextDay, 2, storage)).toBe(true);
  });

  it('blob corrompido tratado como sem selo', () => {
    const storage = memoryStorage();
    storage.setItem(WC_CLAIM_KEY, '{corrupto');
    expect(isClaimedToday(at(21, 5), storage)).toBe(false);
    expect(claimWorldCall(at(21, 5), 2, storage)).toBe(true);
  });
});

describe('utilidades de tempo', () => {
  it('minuteOfUtcDay e utcDayKey são determinísticos em UTC', () => {
    expect(minuteOfUtcDay(at(21, 30))).toBe(21 * 60 + 30);
    expect(utcDayKey(at(21, 30))).toBe('2026-10-13');
  });
});