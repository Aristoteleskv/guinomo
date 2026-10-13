// World polaroids (B5): the captured poster, placed in the world where it was
// taken and shared through the same PHP backend as the notes
// (api/guinomo/photos.php). Only a small thumbnail travels over the network;
// the full PNG stays on the player's disk.
//
//   GET  api/guinomo/photos.php?world=<id>
//        -> { success: true, photos: [{ id, world, x, y, z, thumb, caption, uid, createdAt }] }
//   POST api/guinomo/photos.php  { world, x, y, z, thumb, caption }
//        -> { success: true, id }
//
// This module carries the shapes, validation guards and the two HTTP calls,
// kept dependency-light so tests run offline (node) without a network.

import { appEndpointUrl } from './assets';
import { WORLDS, type WorldId } from './worlds';

export const POLAROID_THUMB_MAX_CHARS = 24_000;
export const POLAROID_CAPTION_MAX = 60;

export interface WorldPolaroid {
  id: number;
  world: string;
  x: number;
  y: number;
  z: number;
  /** data:image/… thumbnail (the frame texture). */
  thumb: string;
  caption: string;
  uid: number;
  createdAt: number;
}

export interface PolaroidPlace {
  world: WorldId;
  x: number;
  y: number;
  z: number;
  thumb: string;
  caption: string;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= POLAROID_THUMB_MAX_CHARS;
}

export function isWorldPolaroid(value: unknown): value is WorldPolaroid {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'number' &&
    typeof item.world === 'string' &&
    isNumber(item.x) &&
    isNumber(item.y) &&
    isNumber(item.z) &&
    isDataUrl(item.thumb) &&
    typeof item.caption === 'string' &&
    item.caption.length <= POLAROID_CAPTION_MAX &&
    typeof item.uid === 'number' &&
    isNumber(item.createdAt)
  );
}

export function isPhotosPayload(value: unknown): value is { success: true; photos: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return payload.success === true && Array.isArray(payload.photos);
}

export function isPlacedPayload(value: unknown): value is { success: true; id: number } {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return payload.success === true && typeof payload.id === 'number';
}

export function isValidPlacement(place: PolaroidPlace): boolean {
  const known = WORLDS.some((world) => world.id === place.world);
  return (
    known &&
    isNumber(place.x) &&
    isNumber(place.y) &&
    isNumber(place.z) &&
    isDataUrl(place.thumb) &&
    place.caption.length <= POLAROID_CAPTION_MAX
  );
}

export function polaroidError(value: unknown): string | null {
  if (typeof value === 'object' && value !== null) {
    const error = (value as Record<string, unknown>).error;
    if (typeof error === 'string' && error !== '') return error;
  }
  return null;
}

/** Loads the world's hanging polaroids (empty array when unreachable). */
export async function fetchWorldPolaroids(world: string): Promise<WorldPolaroid[]> {
  const endpoint = appEndpointUrl(`api/guinomo/photos.php?world=${encodeURIComponent(world)}`);
  try {
    const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!isPhotosPayload(payload)) return [];
    return payload.photos.filter(isWorldPolaroid);
  } catch {
    return [];
  }
}

/** POSTs a new polaroid; returns { ok, id } or { ok, error }. */
export async function placeWorldPolaroid(
  place: PolaroidPlace,
  uid: number,
  csrfToken = '',
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!isValidPlacement(place)) {
    return { ok: false, error: 'Polaroid inválida' };
  }

  const body = new URLSearchParams({
    world: place.world,
    x: String(place.x),
    y: String(place.y),
    z: String(place.z),
    thumb: place.thumb,
    caption: place.caption,
    uid: String(uid),
    csrf_token: csrfToken,
  });

  try {
    const response = await fetch(appEndpointUrl('api/guinomo/photos.php'), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    const payload: unknown = await response.json();
    if (response.ok && isPlacedPayload(payload)) return { ok: true, id: payload.id };
    return { ok: false, error: polaroidError(payload) ?? 'Não foi possível deixar a polaroid.' };
  } catch {
    return { ok: false, error: 'Não foi possível contactar o servidor.' };
  }
}