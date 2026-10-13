// Interiors — the *pure plan* for the rooms the kid can walk into. The houses
// in the authored map are exterior shells with nothing inside, so the scene has
// to build the interior itself. Keeping the layout here (positions/sizes/colours
// only) means the design is deterministic, reusable and testable without a GPU,
// exactly like the sky (A3), the weather (D7) and the alien city (D8).
//
// A plan is addressed by `(world, index)`, where `index` counts the house
// portals of the active world. The same address always yields the same room, so
// a player who leaves and returns finds their house unchanged.

import type { WorldId } from './worlds';

export type FurnitureKind =
  | 'bed'
  | 'table'
  | 'rug'
  | 'shelf'
  | 'lamp'
  | 'crate'
  | 'plant'
  | 'hearth';

export interface InteriorFurniture {
  kind: FurnitureKind;
  /** Local metres from the room centre on X. */
  x: number;
  /** Local metres from the room centre on Z. */
  z: number;
  /** Yaw in radians. */
  rot: number;
  /** Footprint scale (1 = the default size for the kind). */
  size: number;
}

export interface InteriorPalette {
  wall: string;
  floor: string;
  trim: string;
  textile: string;
}

export interface InteriorPlan {
  /** Address this plan was generated for. */
  world: WorldId;
  index: number;
  /** Interior extent on X (always even-ish so the door can sit at x = 0). */
  width: number;
  /** Interior extent on Z. */
  depth: number;
  /** Wall height. */
  height: number;
  palette: InteriorPalette;
  /** Door opening, on the front (−Z) wall. */
  door: { x: number; z: number };
  /** Bed centre, in local metres. */
  bed: { x: number; z: number };
  furniture: InteriorFurniture[];
}

/** Proximity (metres, XZ plane) under which a house door offers "enter". */
export const INTERIOR_PORTAL_RADIUS = 3.6;

/** Margin (metres) outside the walls before a wandering player is sent back out. */
export const INTERIOR_EXIT_MARGIN = 0.6;

const PALETTES: Record<WorldId, InteriorPalette> = {
  lobby: { wall: '#d9c39f', floor: '#8a6a45', trim: '#4b6a74', textile: '#c96b5b' },
  alien: { wall: '#2b2444', floor: '#1d1836', trim: '#7bf5d0', textile: '#c07bff' },
  forest: { wall: '#b9a378', floor: '#6b5031', trim: '#4f7d52', textile: '#8f5a3c' },
  'floating-city': { wall: '#9fb4bd', floor: '#5a6f7b', trim: '#6cd7e8', textile: '#3f6f93' },
  'tropical-city': { wall: '#e2cf9f', floor: '#a07c4e', trim: '#2e8f85', textile: '#3aa08e' },
  'old-town': { wall: '#c8b596', floor: '#76552f', trim: '#7a4b2c', textile: '#a34e3c' },
};

/** Rooms are a touch bigger for the alien world so the crystal furniture fits. */
function baseSize(world: WorldId): { width: number; depth: number; height: number } {
  if (world === 'alien') return { width: 10, depth: 10, height: 4.2 };
  return { width: 9, depth: 9, height: 3.6 };
}

/** FNV-1a over the address; the seed for the room's private PRNG. */
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32): stable drop-in variety per room. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the deterministic room plan for house `index` of `world`. Rooms vary
 * in size, which wall the bed leans on and which small props appear, so a row
 * of houses never looks cloned while staying perfectly reproducible.
 */
export function interiorPlan(world: WorldId, index: number): InteriorPlan {
  const key = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const rand = mulberry32(hashSeed(`${world}#${key}`));
  const base = baseSize(world);

  const width = round1(base.width + rand() * 2.6);
  const depth = round1(base.depth + rand() * 2.6);
  const height = round1(base.height + rand() * 0.9);
  const palette = PALETTES[world] ?? PALETTES['old-town'];

  const halfW = width / 2;
  const halfD = depth / 2;
  const mirror = rand() < 0.5 ? -1 : 1;

  // Bed against the back wall, tucked to one side. The door sits at x = 0 on
  // the front wall, so the bed is never in the walking line.
  const bed = { x: round1(mirror * (halfW - 1.6)), z: round1(halfD - 1.5) };

  const furniture: InteriorFurniture[] = [
    { kind: 'bed', x: bed.x, z: bed.z, rot: mirror > 0 ? Math.PI / 2 : -Math.PI / 2, size: 1 },
    { kind: 'rug', x: 0, z: 0, rot: 0, size: round1(1 + rand() * 0.5) },
    { kind: 'table', x: round1(-mirror * (halfW - 2.4)), z: round1(-halfD + 2.2), rot: rand() * Math.PI * 2, size: 1 },
    { kind: 'lamp', x: round1(mirror * (halfW - 0.9)), z: round1(-halfD + 0.9), rot: 0, size: 1 },
    { kind: 'shelf', x: round1(-mirror * (halfW - 0.55)), z: round1(0.2 - halfD * 0.15), rot: mirror > 0 ? -Math.PI / 2 : Math.PI / 2, size: 1 },
    { kind: 'crate', x: round1(-mirror * (halfW - 1.1)), z: round1(halfD - 1.0), rot: rand() * Math.PI, size: 1 },
    { kind: 'plant', x: round1(mirror * (halfW - 0.9)), z: round1(halfD - 0.9), rot: 0, size: 1 },
  ];

  if (rand() < 0.5) {
    furniture.push({ kind: 'hearth', x: 0, z: round1(halfD - 0.55), rot: Math.PI, size: 1 });
  }

  return {
    world,
    index: key,
    width: round1(width),
    depth: round1(depth),
    height,
    palette,
    door: { x: 0, z: round1(-halfD) },
    bed,
    furniture,
  };
}

/** The spot just inside the door where an entering player is placed. */
export function interiorEntrance(plan: InteriorPlan): { x: number; z: number } {
  return { x: plan.door.x, z: round1(plan.door.z + 1.3) };
}

/** True while a local point is within the room (walls + margin). */
export function interiorContains(plan: InteriorPlan, x: number, z: number, margin = 0): boolean {
  return Math.abs(x) <= plan.width / 2 + margin && Math.abs(z) <= plan.depth / 2 + margin;
}

export interface InteriorPortal {
  index: number;
  x: number;
  z: number;
}

/** The closest portal within `radius` of a point, or `null`. Pure/tie-stable. */
export function nearestInterior(
  portals: readonly InteriorPortal[],
  point: { x: number; z: number },
  radius = INTERIOR_PORTAL_RADIUS,
): InteriorPortal | null {
  let best: InteriorPortal | null = null;
  let bestDistance = radius;
  for (const portal of portals) {
    const distance = Math.hypot(point.x - portal.x, point.z - portal.z);
    if (distance <= bestDistance) {
      best = portal;
      bestDistance = distance;
    }
  }
  return best;
}
