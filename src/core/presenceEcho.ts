// Presence echoes ("Espectros"): while another player is near, we quietly
// record their path; when they drop offline (or leave the world) we release
// that path back into the world as a translucent ghost that loops for a while
// — a memory of a friend. Pure logic + injectable storage, no DOM/network, so
// it is fully unit-testable. Persisted echoes (`guinomo.ghosts.v1`) let the
// next visit replay who walked here before you.
//
// Positions come from the P2P room (peers publish their own spot), so the
// recorder never invents movement: it only remembers what it actually saw.

import type { WorldId } from './worlds';

/** How long a ghost replays before dissolving. */
export const ECHO_LIFETIME_MS = 75_000;

/** Minimum horizontal movement between recorded samples (metres). */
export const ECHO_MIN_STEP_M = 0.25;

/** Maximum interval without movement before a continuity sample is forced. */
export const ECHO_IDLE_RESAMPLE_MS = 2_500;

/** Maximum samples kept per tracked player (ring buffer, oldest dropped). */
export const ECHO_MAX_SAMPLES = 160;

/** Maximum points used to draw the ghost path. */
export const ECHO_MAX_POINTS = 48;

/** Storage key under which recent ghosts are persisted per world. */
export const GHOST_STORAGE_KEY = 'guinomo.ghosts.v1';

/** Max ghosts persisted per world and max points each (keeps the blob tiny). */
export const ECHO_MAX_STORED = 2;
export const ECHO_MAX_STORED_POINTS = 40;

export interface EchoPoint {
  x: number;
  y: number;
  z: number;
}

export interface EchoSample extends EchoPoint {
  /** Wall-clock ms epoch of the sample. */
  t: number;
}

export interface GhostTrack {
  /** Remote/client id that produced the track. */
  id: string;
  uid: number;
  name: string | null;
  points: EchoPoint[];
  /** Wall-clock ms epoch of the first recorded sample. */
  t0: number;
  /** Wall-clock ms epoch of the last recorded sample. */
  t1: number;
  /** Wall-clock ms epoch when the ghost started replaying. */
  bornAt: number;
}

export interface EchoPosition extends EchoPoint {
  alive: boolean;
  /** 1 fully visible → 0 dissolving (fade-in/out envelope). */
  fade: number;
}

interface TrackState {
  id: string;
  uid: number;
  name: string | null;
  samples: EchoSample[];
  lastRecorded: { x: number; z: number } | null;
  lastSampleAt: number;
}

/** Records observed paths while peers are present; see module doc. */
export class EchoRecorder {
  private tracks = new Map<string, TrackState>();

  /** Ids currently being recorded (used by the scene to detect departures). */
  activeIds(): string[] {
    return [...this.tracks.keys()];
  }

  /** Feeds one observation of a peer. Ignores junk movement/values. */
  observe(id: string, uid: number, name: string | null, point: EchoPoint, nowMs: number): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return;
    let track = this.tracks.get(id);
    const first = !track;
    if (!track) {
      track = { id, uid: Math.max(0, Math.floor(uid)), name: name ?? null, samples: [], lastRecorded: null, lastSampleAt: 0 };
      this.tracks.set(id, track);
    }
    if (uid > 0) track.uid = Math.floor(uid);
    if (typeof name === 'string' && name) track.name = name;

    if (
      !first &&
      track.lastRecorded &&
      Math.hypot(point.x - track.lastRecorded.x, point.z - track.lastRecorded.z) < ECHO_MIN_STEP_M &&
      nowMs - track.lastSampleAt < ECHO_IDLE_RESAMPLE_MS
    ) {
      return; // still, and not idle-forced yet — nothing new to remember
    }

    track.samples.push({ x: point.x, y: point.y, z: point.z, t: nowMs });
    track.lastRecorded = { x: point.x, z: point.z };
    track.lastSampleAt = nowMs;
    if (track.samples.length > ECHO_MAX_SAMPLES) track.samples.shift();
  }

  /** Finalizes the track of a peer that left. Null when it was too short. */
  drop(id: string, nowMs: number): GhostTrack | null {
    const track = this.tracks.get(id);
    if (!track) return null;
    this.tracks.delete(id);
    if (track.samples.length < 2) return null;
    return {
      id: track.id,
      uid: track.uid,
      name: track.name,
      points: decimate(track.samples, ECHO_MAX_POINTS),
      t0: track.samples[0].t,
      t1: track.samples[track.samples.length - 1].t,
      bornAt: nowMs,
    };
  }

  /** Finalizes every open track (used when leaving the page). */
  finalizeAll(nowMs: number): GhostTrack[] {
    const out: GhostTrack[] = [];
    for (const id of [...this.tracks.keys()]) {
      const track = this.drop(id, nowMs);
      if (track) out.push(track);
    }
    return out;
  }
}

/** Evenly decimates a path to at most `maxPoints`, keeping both endpoints. */
export function decimate(points: EchoPoint[], maxPoints: number): EchoPoint[] {
  const n = points.length;
  if (n <= maxPoints) return points.slice();
  const out: EchoPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round((i * (n - 1)) / (maxPoints - 1));
    out.push({ x: points[index].x, y: points[index].y, z: points[index].z });
  }
  return out;
}

function cumulativeLengths(points: EchoPoint[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          points[i].z - points[i - 1].z,
        ),
    );
  }
  return lengths;
}

function fadeFor(age: number): number {
  const fadeIn = Math.min(1, age / 1_500);
  const fadeOut = Math.min(1, (ECHO_LIFETIME_MS - age) / (ECHO_LIFETIME_MS * 0.35));
  return Math.max(0, Math.min(1, fadeIn * fadeOut));
}

/**
 * Where the ghost is at wall-clock `nowMs`. Travel is constant-speed along the
 * recorded path (mapped by cumulative length) and loops until the lifetime
 * expires — an echo, not a person, so it never asks permission to exist.
 */
export function ghostPosition(track: GhostTrack, nowMs: number): EchoPosition {
  const age = nowMs - track.bornAt;
  const alive = age >= 0 && age <= ECHO_LIFETIME_MS;
  const last = track.points[track.points.length - 1];
  const fallback: EchoPosition = { x: last.x, y: last.y, z: last.z, alive, fade: 0 };
  if (!alive || track.points.length < 2) return fallback;

  const span = Math.max(1, track.t1 - track.t0);
  const progress = ((age % span) + span) % span / span; // loop, always in [0,1)
  const lengths = cumulativeLengths(track.points);
  const total = lengths[lengths.length - 1];
  if (total <= 0) return { ...track.points[0], alive, fade: fadeFor(age) };

  const target = progress * total;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < target) i++;
  const segStart = lengths[i - 1];
  const segEnd = lengths[i];
  const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
  const a = track.points[i - 1];
  const b = track.points[i];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    alive: true,
    fade: fadeFor(age),
  };
}

// ---------------------------------------------------------------------------
// Persistence — `guinomo.ghosts.v1`, scoped per world, strictly validated and
// size-capped so the blob stays under a few KB whatever it contains.
// ---------------------------------------------------------------------------

export interface StoredGhost {
  id: string;
  uid: number;
  name: string | null;
  world: string;
  /** Flat x,y,z triples. */
  points: number[];
  t0: number;
  t1: number;
  savedAt: number;
}

type WorldGhostMap = Record<string, StoredGhost[]>;

function readGhostMap(storage: Pick<Storage, 'getItem' | 'setItem'>): WorldGhostMap {
  try {
    const parsed = JSON.parse(storage.getItem(GHOST_STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as WorldGhostMap;
  } catch {
    // Corrupt blob: start fresh.
  }
  return {};
}

function isValidStored(value: unknown): value is StoredGhost {
  if (!value || typeof value !== 'object') return false;
  const ghost = value as Record<string, unknown>;
  if (typeof ghost.id !== 'string' || !ghost.id) return false;
  if (typeof ghost.uid !== 'number' || !Number.isFinite(ghost.uid)) return false;
  if (ghost.name !== null && typeof ghost.name !== 'string') return false;
  if (!Array.isArray(ghost.points)) return false;
  if (ghost.points.length < 6 || ghost.points.length % 3 !== 0) return false;
  if (ghost.points.length / 3 > ECHO_MAX_STORED_POINTS) return false;
  for (const value of ghost.points) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (Math.abs(value) > 10_000) return false;
  }
  for (const key of ['t0', 't1', 'savedAt'] as const) {
    if (typeof ghost[key] !== 'number' || !Number.isFinite(ghost[key]) || ghost[key] < 0 || ghost[key] > 4e15) return false;
  }
  return true;
}

function flatten(points: EchoPoint[], max: number): number[] {
  const trimmed = decimate(points, max);
  const out: number[] = [];
  for (const point of trimmed) out.push(point.x, point.y, point.z);
  return out;
}

/** Persists the given tracks for a world, replacing older ghosts of it. */
export function saveGhosts(
  world: WorldId,
  tracks: GhostTrack[],
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  try {
    const map = readGhostMap(storage);
    map[world] = tracks
      .filter((track) => track.points.length >= 2 && track.t1 > track.t0)
      .slice(-ECHO_MAX_STORED)
      .map((track) => ({
        id: track.id,
        uid: track.uid,
        name: track.name,
        world,
        points: flatten(track.points, ECHO_MAX_STORED_POINTS),
        t0: track.t0,
        t1: track.t1,
        savedAt: Date.now(),
      }));
    storage.setItem(GHOST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / quota: persistence is best-effort and never throws.
  }
}

/** Loads the validated ghosts persisted for a world. */
export function loadGhosts(world: WorldId, storage: Pick<Storage, 'getItem' | 'setItem'>): StoredGhost[] {
  try {
    const stored = readGhostMap(storage)[world];
    if (!Array.isArray(stored)) return [];
    return stored.filter(isValidStored).slice(-ECHO_MAX_STORED).map((ghost) => ({ ...ghost }));
  } catch {
    return [];
  }
}

/**
 * Ghosts ready to replay for a world (bornAt is 0; callers set it to start).
 * The historic t0/t1 are kept, so the loop replays the original pacing.
 */
export function restoreTracks(world: WorldId, storage: Pick<Storage, 'getItem' | 'setItem'>): GhostTrack[] {
  return loadGhosts(world, storage).map((ghost) => {
    const points: EchoPoint[] = [];
    for (let i = 0; i < ghost.points.length; i += 3) {
      points.push({ x: ghost.points[i], y: ghost.points[i + 1], z: ghost.points[i + 2] });
    }
    return { id: ghost.id, uid: ghost.uid, name: ghost.name, points, t0: ghost.t0, t1: ghost.t1, bornAt: 0 };
  });
}