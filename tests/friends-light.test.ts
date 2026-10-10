import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimFriendMeet,
  duoCountToday,
  friendsHere,
  meetingSpotFor,
  shouldClaimFriend,
  TRAIL_REACH_DISTANCE,
  type FriendPresence,
} from '../src/core/friendsLight';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:00:00'));
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).localStorage;
});

const friends: FriendPresence[] = [
  { id: 1, name: 'Ana Silva', username: 'ana', avatar: '', world: 'lobby', in_guinomo: true, is_online: true, room_url: null, profile_url: '' },
  { id: 2, name: 'Bruno Costa', username: 'bruno', avatar: '', world: 'forest', in_guinomo: true, is_online: true, room_url: null, profile_url: '' },
  // Clara is online but not in Guinomo right now — no trail.
  { id: 3, name: 'Clara Nunes', username: 'clara', avatar: '', world: 'old-town', in_guinomo: false, is_online: true, room_url: null, profile_url: '' },
];

describe('friends light trail logic', () => {
  it('lists only friends online in the same world', () => {
    expect(friendsHere(friends, 'lobby').map((friend) => friend.id)).toEqual([1]);
    expect(friendsHere(friends, 'forest').map((friend) => friend.id)).toEqual([2]);
    expect(friendsHere(friends, 'alien')).toEqual([]);
  });

  it('maps every world to a meeting spot', () => {
    for (const world of ['lobby', 'forest', 'alien', 'floating-city', 'tropical-city', 'old-town'] as const) {
      const spot = meetingSpotFor(world);
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.z)).toBe(true);
    }
  });

  it('exposes the reach distance', () => {
    expect(TRAIL_REACH_DISTANCE).toBe(6);
  });

  it('claims a duo unlock once per friend per day', () => {
    const now = new Date('2026-10-10T12:00:00');
    expect(shouldClaimFriend(1, now)).toBe(true);
    expect(claimFriendMeet(1, now)).toBe(true);
    expect(claimFriendMeet(1, now)).toBe(false);
    expect(shouldClaimFriend(1, now)).toBe(false);

    const nextDay = new Date('2026-10-11T12:00:00');
    expect(claimFriendMeet(1, nextDay)).toBe(true);
  });

  it('counts the duo unlocks of the day', () => {
    claimFriendMeet(1, new Date('2026-10-10T12:00:00'));
    claimFriendMeet(2, new Date('2026-10-10T18:00:00'));
    expect(duoCountToday(new Date('2026-10-10T20:00:00'))).toBe(2);
    expect(duoCountToday(new Date('2026-10-11T20:00:00'))).toBe(0);
  });
});