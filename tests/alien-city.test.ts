import { describe, expect, it } from 'vitest';
import { alienBuildings, alienCityPlan, alienMinSpacing, alienRadius } from '../src/core/alienCity';

describe('cidade alien (plano)', () => {
  it('é determinística', () => {
    expect(alienCityPlan()).toEqual(alienCityPlan());
  });

  it('é maior e mais diversa do que um punhado de casas', () => {
    const plan = alienCityPlan();
    expect(plan.spires.length).toBeGreaterThanOrEqual(4);
    expect(plan.domes.length).toBeGreaterThanOrEqual(3);
    expect(plan.platforms.length).toBeGreaterThanOrEqual(3);
    expect(plan.houses.length).toBeGreaterThanOrEqual(10);
    expect(plan.warehouses.length).toBeGreaterThanOrEqual(3);
    expect(plan.castles.length).toBeGreaterThanOrEqual(2);
    expect(alienBuildings(plan).length).toBeGreaterThanOrEqual(28);
    expect(alienBuildings(plan).length).toBeGreaterThan(plan.houses.length);
  });

  it('nenhum edifício se sobrepõe a outro', () => {
    expect(alienMinSpacing(alienCityPlan())).toBeGreaterThanOrEqual(8);
  });

  it('os edifícios ficam fora da praça e dentro do centro', () => {
    const plan = alienCityPlan();
    for (const building of alienBuildings(plan)) {
      const distance = Math.hypot(building.x - plan.center.x, building.z - plan.center.z);
      expect(distance).toBeGreaterThan(plan.plazaRadius);
      expect(distance).toBeLessThanOrEqual(plan.footprint);
    }
    expect(alienRadius(plan)).toBeLessThanOrEqual(plan.footprint);
  });

  it('cabe nos limites do terreno (x ±95, z ±104)', () => {
    const plan = alienCityPlan();
    const all = [
      ...alienBuildings(plan),
      ...plan.machines,
      ...plan.lamps,
      plan.center,
    ];
    for (const p of all) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(100);
    }
  });
});
