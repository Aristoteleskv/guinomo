import { describe, expect, it } from 'vitest';
import {
  INTERIOR_PORTAL_RADIUS,
  interiorContains,
  interiorEntrance,
  interiorPlan,
  nearestInterior,
} from '../src/core/interiors';
import { WORLDS } from '../src/core/worlds';

describe('interiores (plano puro)', () => {
  it('é determinístico: o mesmo endereço dá sempre a mesma casa', () => {
    expect(interiorPlan('alien', 4)).toEqual(interiorPlan('alien', 4));
    expect(interiorPlan('old-town', 0)).toEqual(interiorPlan('old-town', 0));
  });

  it('indexa de forma estável e saneia índices inválidos', () => {
    expect(interiorPlan('alien', -3)).toEqual(interiorPlan('alien', 0));
    expect(interiorPlan('alien', 2.7)).toEqual(interiorPlan('alien', 2));
    expect(interiorPlan('alien', Number.NaN).index).toBe(0);
  });

  it('as dimensões são razoáveis e comportam a porta', () => {
    for (const world of WORLDS) {
      const plan = interiorPlan(world.id, 1);
      expect(plan.width).toBeGreaterThanOrEqual(9);
      expect(plan.width).toBeLessThanOrEqual(14);
      expect(plan.depth).toBeGreaterThanOrEqual(9);
      expect(plan.depth).toBeLessThanOrEqual(14);
      expect(plan.height).toBeGreaterThanOrEqual(3.4);
      expect(plan.height).toBeLessThanOrEqual(5.4);
      expect(plan.door.x).toBe(0);
    }
  });

  it('toda a mobília (e a cama) fica dentro das paredes', () => {
    for (const world of WORLDS) {
      for (let index = 0; index < 6; index++) {
        const plan = interiorPlan(world.id, index);
        const halfW = plan.width / 2;
        const halfD = plan.depth / 2;
        expect(Math.abs(plan.bed.x)).toBeLessThan(halfW);
        expect(Math.abs(plan.bed.z)).toBeLessThan(halfD);
        for (const item of plan.furniture) {
          expect(Math.abs(item.x)).toBeLessThanOrEqual(halfW);
          expect(Math.abs(item.z)).toBeLessThanOrEqual(halfD);
        }
      }
    }
  });

  it('as casas vizinhas não são clones', () => {
    const a = interiorPlan('alien', 0);
    const b = interiorPlan('alien', 5);
    expect(a).not.toEqual(b);
    // Each world keeps its own palette identity.
    expect(new Set(WORLDS.map((world) => interiorPlan(world.id, 0).palette.wall)).size).toBeGreaterThan(1);
  });

  it('a entrada fica dentro da casa, à frente da porta', () => {
    const plan = interiorPlan('old-town', 3);
    const entrance = interiorEntrance(plan);
    expect(interiorContains(plan, entrance.x, entrance.z)).toBe(true);
    expect(entrance.z).toBeGreaterThan(plan.door.z);
  });

  it('deteta se um ponto está dentro da casa', () => {
    const plan = interiorPlan('alien', 2);
    expect(interiorContains(plan, 0, 0)).toBe(true);
    expect(interiorContains(plan, 0, 0, 1)).toBe(true);
    expect(interiorContains(plan, plan.width, 0)).toBe(false);
    expect(interiorContains(plan, 0, plan.depth)).toBe(false);
  });

  it('escolhe o portal mais próximo dentro do raio', () => {
    const portals = [
      { index: 0, x: 0, z: 0 },
      { index: 1, x: 10, z: 0 },
      { index: 2, x: 3.1, z: 0 },
    ];
    expect(nearestInterior(portals, { x: 3, z: 0 })?.index).toBe(2);
    expect(nearestInterior(portals, { x: 9, z: 0 })?.index).toBe(1);
    // Fora do raio não há ação.
    expect(nearestInterior(portals, { x: 50, z: 50 })).toBeNull();
    expect(nearestInterior([], { x: 0, z: 0 })).toBeNull();
  });

  it('respeita um raio personalizado', () => {
    const portals = [{ index: 0, x: 0, z: 0 }];
    expect(nearestInterior(portals, { x: 5, z: 0 }, INTERIOR_PORTAL_RADIUS)).toBeNull();
    expect(nearestInterior(portals, { x: 5, z: 0 }, 6)?.index).toBe(0);
  });
});
