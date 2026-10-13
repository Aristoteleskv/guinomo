// 3D world menu (lobby): pure layout + travel URL built from the World Map's
// contract. Six orbs on a gentle arc around the meeting spot, deterministic —
// the same scene for every player. travelHref is byte-for-byte what the
// existing "world-travel" buttons do (ui.ts), so travelling from the orbs
// behaves exactly like the map.

import { WORLDS, type WorldId } from './worlds';

export interface WorldMenuEntry {
  id: WorldId;
  icon: string;
  label: { pt: string; en: string };
  /** Arc offset (metres) relative to the menu center. */
  x: number;
  z: number;
  /** Theme color of the orb. */
  color: string;
}

const ORB_COLORS: Record<WorldId, string> = {
  lobby: '#9ad4ff',
  alien: '#c56bff',
  forest: '#7ce38b',
  'floating-city': '#6fd8ff',
  'tropical-city': '#ffb86b',
  'old-town': '#f2a65a',
};

export const WORLD_ARC_RADIUS = 8;
export const WORLD_ORB_Y = 3.1;

/** Six orbs spread over a gentle 105° arc, oldest world first. */
export function worldMenuLayout(): WorldMenuEntry[] {
  const entries = WORLDS.map((world, index) => {
    const angle = Math.PI * 0.12 + (index / (WORLDS.length - 1)) * Math.PI * 0.76;
    return {
      id: world.id,
      icon: world.icon,
      label: world.label,
      x: Math.cos(angle) * WORLD_ARC_RADIUS,
      z: Math.sin(angle) * WORLD_ARC_RADIUS,
      color: ORB_COLORS[world.id] ?? '#ffffff',
    };
  });
  return entries;
}

/** Same navigation contract as the World Map: switch the `world` query param. */
export function travelHref(world: WorldId, current: string): string {
  const url = new URL(current);
  if (world === 'lobby') url.searchParams.delete('world');
  else url.searchParams.set('world', world);
  return url.toString();
}