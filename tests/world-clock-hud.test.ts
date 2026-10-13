import { describe, expect, it } from 'vitest';
import {
  eventStatus,
  isSameUtcDay,
  phaseStatus,
  remainingMinutes,
  utcClock,
} from '../src/components/worldClockHud';
import { minutesOf } from '../src/core/worldRhythm';

/** Epoch minutes for a UTC date (months 1-based). */
function utcMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  return minutesOf(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

const MAR_ALTA = {
  icon: '🌊',
  title: { pt: 'Maré alta', en: 'High tide' },
  start: utcMinutes(2026, 10, 13, 18, 30),
  end: utcMinutes(2026, 10, 13, 20, 0),
};

describe('utcClock (relógio UTC do ri tmo do mundo)', () => {
  it('formata minutos em HH:MM (UTC)', () => {
    expect(utcClock(0)).toBe('00:00');
    expect(utcClock(390)).toBe('06:30');
    expect(utcClock(1320)).toBe('22:00');
    expect(utcClock(1439)).toBe('23:59');
  });
});

describe('remainingMinutes e isSameUtcDay', () => {
  it('conta os minutos até ao fim da janela, com piso em 0', () => {
    expect(remainingMinutes(utcMinutes(2026, 10, 13, 18, 30), utcMinutes(2026, 10, 13, 20, 0))).toBe(90);
    expect(remainingMinutes(utcMinutes(2026, 10, 13, 20, 0), utcMinutes(2026, 10, 13, 20, 0))).toBe(0);
    expect(remainingMinutes(utcMinutes(2026, 10, 13, 21, 0), utcMinutes(2026, 10, 13, 20, 0))).toBe(0);
  });

  it('compara dias UTC', () => {
    expect(isSameUtcDay(utcMinutes(2026, 10, 13, 6, 0), utcMinutes(2026, 10, 13, 23, 59))).toBe(true);
    expect(isSameUtcDay(utcMinutes(2026, 10, 13, 23, 59), utcMinutes(2026, 10, 14, 0, 0))).toBe(false);
  });
});

describe('phaseStatus e eventStatus (linhas do chip)', () => {
  it('linha 1: mundo + fase do dia (PT/EN)', () => {
    expect(phaseStatus('pt', '🏙️', 'Cidade Noop', 'day')).toBe('🏙️ Cidade Noop · ☀️ dia');
    expect(phaseStatus('en', '🏰', 'Old Town', 'dusk')).toBe('🏰 Old Town · 🌇 evening');
  });

  it('linha 2 ativa: evento em curso com contagem', () => {
    const now = utcMinutes(2026, 10, 13, 18, 30);
    expect(eventStatus('pt', MAR_ALTA, null, now)).toBe('🌊 Maré alta · até 20:00 UTC · ≈90 min');
    expect(eventStatus('en', MAR_ALTA, null, now)).toBe('🌊 High tide · till 20:00 UTC · ≈90 min');
  });

  it('linha 2 em espera: próximo evento, hoje ou amanhã', () => {
    const feats: Array<{ label: { pt: string; en: string }; icon: string }> = [
      { icon: '🎉', label: { pt: 'Festa das comadres', en: 'Town feast' } },
    ];
    const nextToday: Parameters<typeof eventStatus>[1] = {
      icon: feats[0].icon,
      title: feats[0].label,
      start: utcMinutes(2026, 10, 13, 19, 0),
      end: utcMinutes(2026, 10, 13, 21, 0),
    };
    const nextTomorrow: Parameters<typeof eventStatus>[1] = {
      ...nextToday,
      start: utcMinutes(2026, 10, 14, 19, 0),
      end: utcMinutes(2026, 10, 14, 21, 0),
    };
    expect(eventStatus('pt', null, nextToday, utcMinutes(2026, 10, 13, 12, 0))).toBe(
      '⏳ 🎉 Festa das comadres · hoje às 19:00 UTC',
    );
    expect(eventStatus('pt', null, nextTomorrow, utcMinutes(2026, 10, 13, 23, 0))).toBe(
      '⏳ 🎉 Festa das comadres · amanhã às 19:00 UTC',
    );
    expect(eventStatus('en', null, nextToday, utcMinutes(2026, 10, 13, 12, 0))).toBe(
      '⏳ 🎉 Town feast · today at 19:00 UTC',
    );
  });

  it('linha 2 sem eventos restantes no dia', () => {
    expect(eventStatus('pt', null, null, utcMinutes(2026, 10, 13, 12, 0))).toBe('sem mais eventos hoje');
    expect(eventStatus('en', null, null, utcMinutes(2026, 10, 13, 12, 0))).toBe('no more events today');
  });
});