import { describe, expect, it } from 'vitest';
import { travelHref, WORLD_ARC_RADIUS, worldMenuLayout, type WorldMenuEntry } from '../src/core/worldMenu';
import { WORLDS } from '../src/core/worlds';

describe('menu de mundo 3D (lobby)', () => {
  it('Um orb por mundo, pela ordem do catálogo, todos com cor', () => {
    const layout = worldMenuLayout();
    expect(layout).toHaveLength(WORLDS.length);
    const ids = layout.map((entry) => entry.id);
    expect(ids).toEqual(WORLDS.map((world) => world.id));
    for (const entry of layout) {
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.label.pt.length).toBeGreaterThan(0);
      expect(entry.label.en.length).toBeGreaterThan(0);
    }
  });

  it('Posições determinísticas sobre o arco (raio fixo)', () => {
    const a = worldMenuLayout();
    const b = worldMenuLayout();
    expect(a).toEqual(b);
    for (const entry of a) {
      const radius = Math.hypot(entry.x, entry.z);
      expect(radius).toBeCloseTo(WORLD_ARC_RADIUS, 6);
    }
    // Os mundos não colapsam todos no mesmo ponto.
    const first = a[0];
    const last = a[a.length - 1];
    expect(Math.hypot(last.x - first.x, last.z - first.z)).toBeGreaterThan(WORLD_ARC_RADIUS * 0.8);
  });

  it('travelHref segue o contrato do Mapa do Mundo', () => {
    const current = 'https://exemplo/?world=lobby&outro=1#fim';
    expect(travelHref('floating-city', current)).toBe('https://exemplo/?world=floating-city&outro=1#fim');
    expect(travelHref('lobby', 'https://exemplo/?world=alien')).toBe('https://exemplo/');
  });

  it('Layout tipado contém ícones e cores de todos os mundos', () => {
    const layout: WorldMenuEntry[] = worldMenuLayout();
    for (const world of WORLDS) {
      const entry = layout.find((item) => item.id === world.id);
      expect(entry).toBeDefined();
      expect(entry?.icon).toBe(world.icon);
    }
  });
});