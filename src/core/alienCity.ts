// The alien metropolis layout — a *pure plan* (positions and sizes only) so it
// can be tested without a GPU and applied by scene/worldLocations.ts. The alien
// world the user found too small becomes a real, diverse city: a plaza with a
// central crystal, crystal spires, bio-domes, floating platforms, a row of
// authored houses flanking the avenue, warehouses, citadels and alien machines.
// Kept inside the terrain bounds (x ±95, z ±104) measured at runtime.

export interface PlanPoint {
  x: number;
  z: number;
  /** Facing in radians (only meaningful for the blocky buildings). */
  rot?: number;
}

export interface AlienSpire extends PlanPoint {
  height: number;
  radius: number;
  /** Alternate crystal material for variety. */
  deep: boolean;
}

export interface AlienDome extends PlanPoint {
  radius: number;
  height: number;
}

export interface AlienPlatform extends PlanPoint {
  size: number;
  height: number;
}

export interface AlienCityPlan {
  center: PlanPoint;
  plazaRadius: number;
  crystal: { height: number; radius: number };
  spires: AlienSpire[];
  domes: AlienDome[];
  platforms: AlienPlatform[];
  houses: PlanPoint[];
  warehouses: PlanPoint[];
  castles: PlanPoint[];
  machines: PlanPoint[];
  lamps: PlanPoint[];
  /** Everything lives inside this radius from `center`. */
  footprint: number;
}

export function alienCityPlan(): AlienCityPlan {
  return {
    center: { x: 12, z: -58 },
    plazaRadius: 16,
    crystal: { height: 5.5, radius: 1.6 },
    spires: [
      { x: -28, z: -86, height: 22, radius: 2.2, deep: false },
      { x: 34, z: -92, height: 27, radius: 2.6, deep: true },
      { x: 54, z: -64, height: 19, radius: 2.0, deep: false },
      { x: -6, z: -96, height: 31, radius: 3.0, deep: true },
      { x: 74, z: -84, height: 24, radius: 2.4, deep: false },
    ],
    domes: [
      { x: -14, z: -42, radius: 5, height: 5 },
      { x: 40, z: -40, radius: 5.5, height: 6 },
      { x: 66, z: -56, radius: 4.6, height: 5 },
      { x: -24, z: -70, radius: 5, height: 5.5 },
    ],
    platforms: [
      { x: -40, z: -56, size: 6, height: 3 },
      { x: 46, z: -14, size: 5, height: 2.5 },
      { x: 78, z: -96, size: 7, height: 3.5 },
    ],
    houses: [
      { x: -20, z: -30, rot: 0.0 },
      { x: -6, z: -30, rot: 0.4 },
      { x: 8, z: -30, rot: -0.3 },
      { x: 22, z: -30, rot: 0.6 },
      { x: 36, z: -30, rot: -0.5 },
      { x: 50, z: -30, rot: 0.2 },
      { x: -13, z: -22, rot: 0.3 },
      { x: 1, z: -22, rot: -0.6 },
      { x: 15, z: -22, rot: 0.5 },
      { x: 29, z: -22, rot: -0.2 },
      { x: 43, z: -22, rot: 0.7 },
      { x: 57, z: -22, rot: -0.4 },
    ],
    warehouses: [
      { x: -44, z: -40, rot: 0.3 },
      { x: -50, z: -70, rot: -0.4 },
      { x: 78, z: -56, rot: 1.2 },
      { x: 62, z: -96, rot: -0.8 },
    ],
    castles: [
      { x: -36, z: -92, rot: 0.5 },
      { x: 18, z: -96, rot: -0.2 },
      { x: 86, z: -80, rot: 1.1 },
    ],
    machines: [
      { x: 0, z: -70 },
      { x: 52, z: -40 },
      { x: 70, z: -66 },
    ],
    lamps: [
      { x: 12, z: -40 },
      { x: 12, z: -76 },
      { x: -8, z: -58 },
      { x: 32, z: -58 },
      { x: 12, z: -16 },
      { x: 4, z: -98 },
    ],
    footprint: 82,
  };
}

/** Every building slot (not the small machines and lamps). */
export function alienBuildings(plan: AlienCityPlan): PlanPoint[] {
  return [
    ...plan.spires,
    ...plan.domes,
    ...plan.platforms,
    ...plan.houses,
    ...plan.warehouses,
    ...plan.castles,
  ];
}

/** Distance between the two closest buildings — the city never self-intersects. */
export function alienMinSpacing(plan: AlienCityPlan): number {
  const points = alienBuildings(plan);
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      min = Math.min(min, Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z));
    }
  }
  return min;
}

/** Farthest building from the centre — used to keep the city on the terrain. */
export function alienRadius(plan: AlienCityPlan): number {
  return alienBuildings(plan).reduce(
    (max, p) => Math.max(max, Math.hypot(p.x - plan.center.x, p.z - plan.center.z)),
    0,
  );
}
