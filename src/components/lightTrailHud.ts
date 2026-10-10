// Friends' light trail HUD: polls GET /api/guinomo/friends, shows which friends
// are online in the current world, and drives the 3D trail via
// `light_trail_update`. Reaching the beacon claims a duo poster with one
// present friend (once per friend per day) and awards adventure points.

import './lightTrail.css';
import { events } from '../core/events';
import { getWorldId } from '../core/worlds';
import { appEndpointUrl } from '../core/assets';
import { isGoldenHour } from '../core/goldenHour';
import { awardPoints, POINTS } from '../core/adventurePoints';
import {
  claimFriendMeet,
  friendsHere,
  meetingSpotFor,
  type FriendPresence,
} from '../core/friendsLight';
import { showToast } from './toast';

const POLL_MS = 30_000;

function uiLanguage(): string {
  return window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
}

let warnedOnce = false;

export function mountLightTrailHud(): void {
  if (document.getElementById('light-trail-hud')) return;

  const english = uiLanguage() === 'en';
  const world = getWorldId(new URLSearchParams(window.location.search).get('world'));

  const chip = document.createElement('div');
  chip.id = 'light-trail-chip';
  chip.hidden = true;
  chip.setAttribute('aria-live', 'polite');
  chip.title = english
    ? 'Friends here · follow the light trail to meet them'
    : 'Amigos aqui · segue o rasto luminoso até ao encontro';

  document.body.append(chip);

  let friends: FriendPresence[] = [];

  const present = () => friendsHere(friends, world);

  const render = () => {
    const here = present();
    chip.hidden = here.length === 0;
    if (here.length > 0) {
      const names = here
        .slice(0, 2)
        .map((friend) => friend.username || friend.name)
        .join(', ');
      const more = here.length > 2 ? ` +${here.length - 2}` : '';
      chip.textContent = english
        ? `✨ Friends here · ${names}${more}`
        : `✨ Amigos aqui · ${names}${more}`;
    }
    events.emit('light_trail_update', {
      visible: here.length > 0,
      spot: meetingSpotFor(world),
      friends: here.length,
    });
  };

  const refresh = async () => {
    try {
      const response = await fetch(appEndpointUrl('api/guinomo/friends'), {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Friends request failed (${response.status})`);
      const payload: { friends?: unknown } = await response.json();
      friends = Array.isArray(payload.friends) ? (payload.friends as FriendPresence[]) : [];
    } catch (error) {
      // Dev server / non-embed contexts have no friends API — stay silent.
      if (!warnedOnce) {
        warnedOnce = true;
        console.warn('Unable to load Guinomo friends:', error);
      }
      friends = [];
    }
    render();
  };

  events.on('webgl_light_friend_reached', () => {
    const now = new Date();
    // Claim the first present friend not yet unlocked today.
    const friend = present().find((entry) => claimFriendMeet(entry.id, now));
    if (!friend) return;
    const gained = awardPoints(POINTS.friendMeet, isGoldenHour(now));
    events.emit('webgl_points_changed');
    const name = friend.username || friend.name;
    showToast(
      english
        ? `✨ You followed ${name}'s light! Duo poster unlocked · +${gained} XP`
        : `✨ Seguiste o rasto da luz de ${name}! Cartaz a dois desbloqueado · +${gained} XP`,
      'violet',
    );
  });

  void refresh();
  window.setInterval(() => void refresh(), POLL_MS);
}