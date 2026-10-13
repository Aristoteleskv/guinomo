// Server-side spawn memory: remembers where the player was in each world
// (api/guinomo/spawn.php), so returning brings them back to that spot instead
// of the default plaza. Mirrors sealsSync: additive and inert — without a
// logged-in uid, or with the endpoint missing, nothing happens and nothing
// throws.

import { appEndpointUrl } from './assets';
import { signIfEnabled } from './hmac';

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
}

/** Read + teleport access to the local player, decoupled from the mesh. */
export interface SpawnMeshAdapter {
  /** The local player's current position in world units. */
  position(): SpawnPoint | null;
  /** Teleports the local player to the given point. */
  teleport(point: SpawnPoint): void;
}

/** The logged-in user id; 0 when no profile session is present. */
export function currentUid(): number {
  return typeof window !== 'undefined' && typeof window.GUINOMO_UID === 'number' ? window.GUINOMO_UID : 0;
}

/** 0.1 m resolution is plenty for a spawn point. */
export function roundPoint(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Pure builder: the urlencoded body the PHP endpoint parses. */
export function buildSpawnBody(uid: number, world: string, point: SpawnPoint, csrfToken = ''): URLSearchParams {
  const body = new URLSearchParams();
  body.set('uid', String(uid));
  body.set('world', world);
  body.set('x', String(roundPoint(point.x)));
  body.set('y', String(roundPoint(point.y)));
  body.set('z', String(roundPoint(point.z)));
  body.set('csrf_token', csrfToken);
  return body;
}

/** Pure: parses the GET response; null when there is no saved spot. */
export function parseSpawnResponse(payload: unknown): SpawnPoint | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { saved?: unknown; x?: unknown; y?: unknown; z?: unknown };
  if (record.saved !== true) return null;
  if (typeof record.x !== 'number' || typeof record.y !== 'number' || typeof record.z !== 'number') return null;
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y) || !Number.isFinite(record.z)) return null;
  return { x: record.x, y: record.y, z: record.z };
}

/** Reads the saved spawn of this world; null when none / logged out / offline. */
export async function loadSavedSpawn(world: string): Promise<SpawnPoint | null> {
  if (currentUid() <= 0) return null;
  try {
    const response = await fetch(
      appEndpointUrl(`api/guinomo/spawn.php?world=${encodeURIComponent(world)}`),
      { credentials: 'include', cache: 'no-store' },
    );
    if (!response.ok) return null;
    return parseSpawnResponse(await response.json());
  } catch {
    return null;
  }
}

/** POSTs the current spot for this world. Resolves false when skipped/failed. */
export async function saveSpawn(world: string, point: SpawnPoint): Promise<boolean> {
  if (currentUid() <= 0) return false;
  try {
    const endpoint = appEndpointUrl('api/guinomo/spawn.php');
    const csrfToken = typeof window !== 'undefined' ? window.CSRF_TOKEN || '' : '';
    const rawBody = buildSpawnBody(currentUid(), world, point, csrfToken).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    };
    // Additive HMAC signing: inert unless a runtime key is configured.
    Object.assign(headers, await signIfEnabled('POST', endpoint, rawBody));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: rawBody,
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

const SAVE_INTERVAL_MS = 12_000;

/**
 * Restores the saved spot on load and keeps it fresh while playing. Fire-and-
 * forget: never blocks the scene and never throws.
 */
export function mountSpawnSync(mesh: SpawnMeshAdapter, world: string): void {
  if (currentUid() <= 0) return;
  if (document.getElementById('guinomo-spawn-sync')) return;
  const guard = document.createElement('div');
  guard.id = 'guinomo-spawn-sync';
  document.body.append(guard);

  void loadSavedSpawn(world).then((saved) => {
    if (saved) mesh.teleport(saved);
  });

  // Save on a slow cadence and on the way out; skip repeats while the player
  // stands still (or the previous request is still in flight).
  let lastKey = '';
  let inFlight = false;
  const save = () => {
    if (inFlight) return;
    const point = mesh.position();
    if (!point) return;
    const key = `${roundPoint(point.x)},${roundPoint(point.y)},${roundPoint(point.z)}`;
    if (key === lastKey) return;
    lastKey = key;
    inFlight = true;
    void saveSpawn(world, point).finally(() => {
      inFlight = false;
    });
  };

  window.setInterval(save, SAVE_INTERVAL_MS);
  document.addEventListener('visibilitychange', save);
  window.addEventListener('pagehide', save);
}