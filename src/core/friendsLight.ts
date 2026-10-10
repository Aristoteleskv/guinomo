// Friends' light trail: presence-level logic behind the "follow the light of a
// friend" hook. Friends online in the same world light a trail to the world's
// meeting spot; reaching it unlocks a duo poster — once per friend per day.
// Pure logic + localStorage, no DOM, so it is unit-testable.

import type { WorldId } from './worlds';

/** Distance (metres) to the meeting spot that counts as "reaching the trail". */
export const TRAIL_REACH_DISTANCE = 6;

/** Shape of the friends payload from GET /api/guinomo/friends. */
export interface FriendPresence {
  id: number;
  name: string;
  username: string;
  avatar: string;
  world: string;
  in_guinomo: boolean;
  is_online: boolean;
  room_url: string | null;
  profile_url: string;
}

/** Event payload shared between the HUD poller and the 3D trail scene. */
export interface LightTrailInfo {
  visible: boolean;
  spot: { x: number; z: number };
  friends: number;
}

/** Meeting spots per world — the city plazas are the natural gathering places;
 *  the special worlds meet at their landmarks. */
const MEETING_SPOTS: Record<WorldId, [number, number]> = {
  lobby: [0, 0],
  forest: [-15, -50],
  alien: [60, 40],
  'floating-city': [12, -58],
  'tropical-city': [12, -58],
  'old-town': [12, -58],
};

/** Meeting spot (x, z) for a world. */
export function meetingSpotFor(world: WorldId): { x: number; z: number } {
  const [x, z] = MEETING_SPOTS[world] ?? MEETING_SPOTS.lobby;
  return { x, z };
}

/** Friends currently online in Guinomo in the given world. */
export function friendsHere(friends: FriendPresence[], world: WorldId): FriendPresence[] {
  return friends.filter((friend) => friend.in_guinomo && friend.world === world);
}

const FRIEND_CLAIMS_KEY = 'guinomo.lightfriends.v1';

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type ClaimsState = Record<string, string>; // friendId → day key of last duo unlock

function readClaims(): ClaimsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(FRIEND_CLAIMS_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const claims: ClaimsState = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') claims[key] = value;
      }
      return claims;
    }
  } catch {
    // Private mode / no storage: every meet is claimable again.
  }
  return {};
}

function writeClaims(claims: ClaimsState): void {
  try {
    localStorage.setItem(FRIEND_CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // Private mode: keep the claims for the session only.
  }
}

/** Whether the duo poster can still be unlocked with this friend today. */
export function shouldClaimFriend(friendId: number, now: Date): boolean {
  return readClaims()[String(friendId)] !== dayKey(now);
}

/** Marks the duo unlock with this friend for today. Returns whether it was new. */
export function claimFriendMeet(friendId: number, now: Date): boolean {
  if (!shouldClaimFriend(friendId, now)) return false;
  const claims = readClaims();
  claims[String(friendId)] = dayKey(now);
  writeClaims(claims);
  return true;
}

/** Number of friends whose duo poster was unlocked today. */
export function duoCountToday(now: Date): number {
  const key = dayKey(now);
  return Object.values(readClaims()).filter((day) => day === key).length;
}