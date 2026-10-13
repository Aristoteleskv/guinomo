// Parity corpus generator (Fase A do docs/CPP_STRATEGY.md): dumps a golden set
// of inputs/outputs computed by the *real* TS worldRhythm into
// native/cpp/corpus.txt, which native/cpp/parity_test.cpp replays against the
// C++ port. Same input ⇒ same output means the two implementations agree.
//
// The corpus is deterministic (fixed input list + pure functions), so
// regenerating it is a no-op — unless the rhythm rules change, in which case
// the git diff of corpus.txt shows exactly which boundary moved.

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import {
  dayPhase,
  minutesOf,
  nextWorldEvent,
  worldEvent,
  worldMood,
} from '../src/core/worldRhythm';
import type { WorldId } from '../src/core/worlds';

const WORLDS: WorldId[] = ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];

/** Epoch minutes for a UTC date (months 1-based, like Date.UTC's arguments). */
function utcMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  return minutesOf(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

/** Deterministic input list: every phase boundary, every event slot, a few
 *  "window just ended" cases, the epoch, and one mood sample per world. */
const CASES: Array<{ world: WorldId; minutes: number }> = [
  // Fases do dia (UTC) — fronteiras
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 0, 0) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 5, 59) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 6, 0) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 10, 59) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 11, 0) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 16, 59) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 17, 0) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 20, 59) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 21, 0) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 23, 59) },
  // Eventos ativos no respetivo slot
  { world: 'floating-city', minutes: utcMinutes(2026, 10, 13, 18, 30) },
  { world: 'old-town', minutes: utcMinutes(2026, 10, 13, 19, 30) },
  { world: 'alien', minutes: utcMinutes(2026, 10, 13, 20, 45) },
  { world: 'lobby', minutes: utcMinutes(2026, 10, 13, 22, 30) },
  { world: 'forest', minutes: utcMinutes(2025, 1, 1, 6, 30) },
  { world: 'tropical-city', minutes: utcMinutes(2025, 6, 15, 17, 30) },
  // Janela acabada → o próximo evento é amanhã
  { world: 'old-town', minutes: utcMinutes(2026, 10, 13, 21, 30) },
  // Época 0 (1970-01-01T00:00 UTC)
  { world: 'lobby', minutes: 0 },
  // Mood: uma amostra por mundo no mesmo instante
  ...WORLDS.map((world) => ({ world, minutes: utcMinutes(2026, 10, 13, 6, 0) })),
];

/** One corpus line per case — plain text, integers only, so the C++ side parses
 *  it without a JSON dependency:
 *  <world> <minutes> <phase> <eventStart|-1> <eventEnd|-1> <mood> <nextStart> <nextEnd> */
function corpusLine(c: { world: WorldId; minutes: number }): string {
  const minutes = c.minutes;
  const event = worldEvent(c.world, minutes);
  const next = nextWorldEvent(c.world, minutes);
  return [
    c.world,
    String(minutes),
    dayPhase(minutes),
    String(event ? event.start : -1),
    String(event ? event.end : -1),
    String(worldMood(c.world, minutes)),
    String(next ? next.start : -1),
    String(next ? next.end : -1),
  ].join(' ');
}

describe('world-rhythm parity corpus (golden set para o port C++)', () => {
  it('é determinístico — um corpus por run, sempre igual', () => {
    const first = CASES.map(corpusLine);
    const second = CASES.map(corpusLine);
    expect(second).toEqual(first);
  });

  it('gera native/cpp/corpus.txt (repetível: conteúdo determinístico)', () => {
    const lines = CASES.map(corpusLine);
    const header = [
      '# Parity corpus — worldRhythm (TS) -> world_rhythm.cpp (C++)',
      '# <world> <minutes> <phase> <eventStart|-1> <eventEnd|-1> <mood> <nextStart> <nextEnd>',
    ];
    const output = header.join('\n') + '\n' + lines.join('\n') + '\n';
    fs.writeFileSync(new URL('../native/cpp/corpus.txt', import.meta.url), output, 'utf8');
    expect(lines.length).toBeGreaterThanOrEqual(20);
  });

  it('spot-checks valores conhecidos (TS é a verdade para o C++)', () => {
    // 18:30 UTC em floating-city: Maré alta ativa (18:00–19:30).
    const minutes = utcMinutes(2026, 10, 13, 18, 30);
    const event = worldEvent('floating-city', minutes)!;
    expect(event.start).toBe(minutes - 30);
    expect(event.end - event.start).toBe(90);
    // 22:30 UTC no lobby: Mercado da meia-noite ativo.
    expect(worldEvent('lobby', utcMinutes(2026, 10, 13, 22, 30))).not.toBeNull();
    // 21:30 UTC na Vila Antiga: a festa acabou às 21:00.
    expect(worldEvent('old-town', utcMinutes(2026, 10, 13, 21, 30))).toBeNull();
  });
});