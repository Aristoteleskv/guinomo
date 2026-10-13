import { describe, expect, it } from 'vitest';
import {
  MINUTES_PER_DAY,
  dayOfMinutes,
  dayPhase,
  minuteOfDay,
  minutesOf,
  nextWorldEvent,
  worldEvent,
  worldMood,
} from '../src/core/worldRhythm';

describe('relógio UTC do mundo', () => {
  it('converte Date em minutos e extrai a hora do dia', () => {
    const date = new Date(Date.UTC(2026, 9, 13, 18, 30)); // 18:30 UTC
    expect(minutesOf(date)).toBe(Math.floor(date.getTime() / 60000));
    expect(minuteOfDay(minutesOf(date))).toBe(18 * 60 + 30);
    expect(dayOfMinutes(minutesOf(date))).toBe(Math.floor(minutesOf(date) / MINUTES_PER_DAY));
  });

  it('é invariante ao fuso horário local', () => {
    const utc = new Date(Date.UTC(2026, 9, 13, 12, 0));
    expect(minuteOfDay(minutesOf(utc))).toBe(12 * 60);
  });

  it('normaliza minutos negativos para o dia atual (mod)', () => {
    expect(minuteOfDay(-1)).toBe(MINUTES_PER_DAY - 1);
  });
});

describe('dayPhase (fases do dia UTC)', () => {
  it('mapeia as fronteiras corretamente', () => {
    expect(dayPhase(0)).toBe('night'); // 00:00
    expect(dayPhase(5 * 60 + 59)).toBe('night');
    expect(dayPhase(6 * 60)).toBe('dawn');
    expect(dayPhase(10 * 60 + 59)).toBe('dawn');
    expect(dayPhase(11 * 60)).toBe('day');
    expect(dayPhase(16 * 60 + 59)).toBe('day');
    expect(dayPhase(17 * 60)).toBe('dusk');
    expect(dayPhase(20 * 60 + 59)).toBe('dusk');
    expect(dayPhase(21 * 60)).toBe('night');
    expect(dayPhase(MINUTES_PER_DAY - 1)).toBe('night');
  });
});

describe('worldEvent (evento diário por mundo)', () => {
  it('ativa o evento certo no slot do mundo (18:00–19:30 UTC em floating-city)', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 18, 30)));
    const event = worldEvent('floating-city', minutes);
    expect(event).not.toBeNull();
    expect(event!.icon).toBe('🌊');
    expect(event!.title.pt).toBe('Maré alta');
    expect(minuteOfDay(event!.start)).toBe(18 * 60);
    expect(event!.end - event!.start).toBe(90); // janela de 90 minutos
  });

  it('devolve null fora da janela (midnight market às 21:00 UTC)', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 21, 0)));
    expect(worldEvent('lobby', minutes)).toBeNull();
  });

  it('é determinístico: mesmos minutos ⇒ mesmo evento, sempre', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 19, 30)));
    const a = worldEvent('old-town', minutes);
    const b = worldEvent('old-town', minutes);
    expect(a).toEqual(b);
    expect(a!.start).toBe(b!.start);
  });

  it('as janelas de cada mundo não cruzam a meia-noite UTC', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 6, 0)));
    const day = dayOfMinutes(minutes);
    for (const world of ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'] as const) {
      const event = worldEvent(world, minutes);
      if (event) {
        expect(event.end).toBeLessThanOrEqual((day + 1) * MINUTES_PER_DAY);
      }
    }
  });
});

describe('nextWorldEvent (anúncio antes do evento)', () => {
  it('dentro da janela devolve a janela em curso', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 19, 30)));
    const next = nextWorldEvent('old-town', minutes)!;
    expect(minuteOfDay(next.start)).toBe(19 * 60);
    expect(next.end).toBeGreaterThan(minutes);
  });

  it('após o fim devolve a janela do dia seguinte', () => {
    const minutes = minutesOf(new Date(Date.UTC(2026, 9, 13, 21, 30)));
    const next = nextWorldEvent('old-town', minutes)!;
    expect(minuteOfDay(next.start)).toBe(19 * 60);
    expect(dayOfMinutes(next.start)).toBe(dayOfMinutes(minutes) + 1);
  });
});

describe('worldMood (semente por dia, sem rede)', () => {
  it('é estável por (mundo, dia) e dentro do intervalo', () => {
    const dayA = minutesOf(new Date(Date.UTC(2026, 9, 13, 6, 0)));
    expect(worldMood('forest', dayA)).toBe(worldMood('forest', dayA));
    expect(worldMood('forest', dayA)).toBeGreaterThanOrEqual(0);
    expect(worldMood('forest', dayA)).toBeLessThan(100);
  });
});