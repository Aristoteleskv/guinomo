// Avatar-vs-avatar duels (real PvP). Two actual players face the *same*
// deterministic strike pattern; each records their parry presses locally, then
// both exchange their press records over the existing chat channel. Because
// arbitration is a pure function of (seed, presses) — reused from shadowDuel.ts
// — both clients compute the SAME score for both players, with no server and no
// trust: neither side can lie about the other's presses, only about their own,
// and their own presses are judged against the shared pattern on both machines.
//
// Wire tokens (space-free, like stickers, so they ride the plain-text channel):
//   [[duel:c:<nonce>:<from>:<to>]]              challenge
//   [[duel:a:<nonce>:<from>:<to>]]              accept
//   [[duel:r:<nonce>:<uid>:<p1,p2,...>]]        result (parry presses, ms)
// Malformed tokens parse to null; unknown clients render them as literal text.

import { arbitrateDuel, DUEL_WINDOW_MS, type DuelResult } from './shadowDuel';

export interface DuelChallenge {
  kind: 'challenge';
  nonce: number;
  from: number;
  to: number;
}

export interface DuelAccept {
  kind: 'accept';
  nonce: number;
  from: number;
  to: number;
}

export interface DuelResultMessage {
  kind: 'result';
  nonce: number;
  uid: number;
  presses: number[];
}

export type AvatarDuelMessage = DuelChallenge | DuelAccept | DuelResultMessage;

export type AvatarDuelVerdict = 'win' | 'lose' | 'draw';

export interface AvatarDuelOutcome {
  mine: DuelResult;
  theirs: DuelResult;
  verdict: AvatarDuelVerdict;
}

const PREFIX = '[[duel:';
const SUFFIX = ']]';
const TOKEN_RE = /\[\[duel:([car]):([^\]]*)\]\]/;

/** A fresh, collision-resistant duel id (integer). */
export function avatarDuelNonce(random = Math.random()): number {
  return 1000 + Math.floor(random * 900_000_000);
}

/** Deterministic shared seed for a nonce — identical on both clients. */
export function avatarDuelSeed(nonce: number): number {
  let hash = 0x9e3779b9 ^ (nonce >>> 0);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function encodeChallenge(nonce: number, from: number, to: number): string {
  return `${PREFIX}c:${nonce}:${from}:${to}${SUFFIX}`;
}

export function encodeAccept(nonce: number, from: number, to: number): string {
  return `${PREFIX}a:${nonce}:${from}:${to}${SUFFIX}`;
}

export function encodeResult(nonce: number, uid: number, presses: number[]): string {
  const body = presses.map((press) => Math.round(press)).join(',');
  return `${PREFIX}r:${nonce}:${uid}:${body}${SUFFIX}`;
}

/** True when a chat text is a duel control token (should not appear in chat). */
export function isAvatarDuelText(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.includes(PREFIX);
}

function toUid(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : -1;
}

export function parseAvatarDuel(text: string | null | undefined): AvatarDuelMessage | null {
  if (typeof text !== 'string') return null;
  const match = TOKEN_RE.exec(text);
  if (!match) return null;
  const parts = match[2].split(':');
  const nonce = Number(parts[0]);
  if (!Number.isFinite(nonce) || nonce < 0) return null;

  if (match[1] === 'c' || match[1] === 'a') {
    const from = toUid(parts[1]);
    const to = toUid(parts[2]);
    if (from < 0 || to < 0) return null;
    return { kind: match[1] === 'c' ? 'challenge' : 'accept', nonce, from, to };
  }

  const uid = toUid(parts[1]);
  if (uid < 0) return null;
  const raw = parts[2] ?? '';
  const presses = raw === '' ? [] : raw.split(',').map(Number);
  if (!presses.every((p) => Number.isFinite(p) && p >= 0 && p <= DUEL_WINDOW_MS + 500)) return null;
  return { kind: 'result', nonce, uid, presses };
}

/** Scores both sides against the shared pattern and decides the winner. */
export function resolveAvatarDuel(
  seed: number,
  myPresses: number[],
  theirPresses: number[],
): AvatarDuelOutcome {
  const mine = arbitrateDuel(seed, myPresses);
  const theirs = arbitrateDuel(seed, theirPresses);
  const verdict: AvatarDuelVerdict =
    mine.score > theirs.score ? 'win' : mine.score < theirs.score ? 'lose' : 'draw';
  return { mine, theirs, verdict };
}
