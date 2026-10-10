// Server-side trophies: pushes the player's seal collection to the host app
// (api/guinomo/seals.php) so the profile page can show explorer badges to
// other players. Additive and inert: without a logged-in uid (GUINOMO_UID) or
// with the endpoint still missing, saving is skipped silently.
//
// Write side only — the read side (GET api/guinomo/seals?uid=N) is what the
// profile badges render against (see php-integration/api/guinomo/seals.php).

import { appEndpointUrl } from './assets';
import { events } from './events';
import { signIfEnabled } from './hmac';
import { isGrandSecretUnlocked, readFoundSecrets, readGoldenSeals } from './secrets';

export interface SealsState {
  /** Stable ids of the found secrets (album progress). */
  secrets: string[];
  /** The subset of secrets found during the golden hour. */
  golden: string[];
  /** Whether the 5/5 Grand Secret finale is unlocked. */
  grand: boolean;
}

/** Reads the current trophy collection from storage. */
export function readSealsState(): SealsState {
  return {
    secrets: readFoundSecrets(),
    golden: readGoldenSeals(),
    grand: isGrandSecretUnlocked(),
  };
}

/** The logged-in user id, 0 when no profile session is present. */
export function currentUid(): number {
  return typeof window !== 'undefined' && typeof window.GUINOMO_UID === 'number' ? window.GUINOMO_UID : 0;
}

/** Pure builder: the urlencoded body the PHP endpoint parses. */
export function buildSealsBody(uid: number, state: SealsState, csrfToken = ''): URLSearchParams {
  const body = new URLSearchParams();
  body.set('uid', String(uid));
  body.set('secrets', JSON.stringify(state.secrets));
  body.set('golden', JSON.stringify(state.golden));
  body.set('grand', state.grand ? '1' : '0');
  body.set('csrf_token', csrfToken);
  return body;
}

/** POSTs the current collection to the host app. Resolves false when there is
 *  nothing to persist (no uid) or the request fails; never throws. */
export async function saveSealsToServer(uid = currentUid(), state = readSealsState()): Promise<boolean> {
  if (uid <= 0) return false;
  try {
    const endpoint = appEndpointUrl('api/guinomo/seals.php');
    const csrfToken = typeof window !== 'undefined' ? window.CSRF_TOKEN || '' : '';
    const body = buildSealsBody(uid, state, csrfToken);
    const rawBody = body.toString();
    // application/x-www-form-urlencoded (not FormData) so the exact bytes can
    // be signed, and so it matches PHP's $_POST parsing.
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    };
    // Additive HMAC signing: inert unless a runtime key is configured.
    Object.assign(headers, await signIfEnabled('POST', endpoint, rawBody));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: rawBody,
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Syncs the collection on load and after every change. Fire-and-forget. */
export function mountSealsSync(): void {
  void saveSealsToServer();
  const resync = () => {
    void saveSealsToServer();
  };
  events.on('webgl_secret_found', resync);
  events.on('webgl_grand_secret_unlocked', resync);
}
