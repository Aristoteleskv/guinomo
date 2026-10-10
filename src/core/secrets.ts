// Explorer secrets state: which of the five hidden secrets the player found,
// which were found while the daily golden hour was active, and the "Grand
// Secret" (the 5/5 finale) flag.
//
// This is the single source of truth for the collection keys shared by the
// set pieces (src/scene/setpieces.ts), the seals album (src/scene/album.ts)
// and the server trophies sync (src/core/sealsSync.ts). Storage keys are kept
// identical to the historical ones so existing players keep their progress.

const SECRETS_STORAGE_KEY = 'guinomo_secrets';
const GOLDEN_SEALS_KEY = 'guinomo.golden_seals.v1';
const GRAND_SECRET_KEY = 'guinomo.grand_secret.v1';

/** Stable ids of the five hidden secrets. The English copy doubles as the
 *  stable id so progress survives UI language changes (setpieces.ts). */
export const SECRET_IDS = [
  "It's a big metallic object. You want to believe it's some kind of vehicle.",
  "It's a very pale and strange looking man. He probably spends too much time on the computer.",
  "If these two white cats weren't next to each other it would seem like they were the same one.",
  'A sloth? That permanent smile it has is so creepy. What is it doing there?',
  'These things look as if they have been taken out of a video game.',
] as const;

function readStringList(storageKey: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    // Absent or corrupted storage: treat as an empty collection.
    return [];
  }
}

function writeStringList(storageKey: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Private mode / no storage: the flag lives for the session only.
  }
}

/** Reads the persisted secret ids, tolerating absent or corrupted storage. */
export function readFoundSecrets(): string[] {
  return readStringList(SECRETS_STORAGE_KEY);
}

/** Records a found secret, idempotently. */
export function saveFoundSecret(id: string): void {
  if (readFoundSecrets().includes(id)) return;
  writeStringList(SECRETS_STORAGE_KEY, [...readFoundSecrets(), id]);
}

export function isSecretFound(id: string): boolean {
  return readFoundSecrets().includes(id);
}

/** True when all five hidden secrets are in the persisted collection. */
export function allSecretsFound(): boolean {
  const found = new Set(readFoundSecrets());
  return SECRET_IDS.every((id) => found.has(id));
}

/** Secret ids discovered during the golden hour (kept as golden keepsakes). */
export function readGoldenSeals(): string[] {
  return readStringList(GOLDEN_SEALS_KEY);
}

/** Stamps a found secret as a golden-hour discovery, idempotently. */
export function markGoldenSeal(id: string): void {
  if (readGoldenSeals().includes(id)) return;
  writeStringList(GOLDEN_SEALS_KEY, [...readGoldenSeals(), id]);
}

/** True when the 5/5 Grand Secret finale is unlocked. */
export function isGrandSecretUnlocked(): boolean {
  try {
    return localStorage.getItem(GRAND_SECRET_KEY) === '1';
  } catch {
    return false;
  }
}

/** Marks the Grand Secret as unlocked; returns true only when it flips here. */
export function unlockGrandSecret(): boolean {
  if (isGrandSecretUnlocked()) return false;
  try {
    localStorage.setItem(GRAND_SECRET_KEY, '1');
  } catch {
    // Private mode / no storage: the flag lives for the session only.
  }
  return true;
}

/** Unlocks the Grand Secret as soon as the five secrets are all found; returns
 *  true only for the moment it actually unlocks (the 5/5 finale). */
export function maybeUnlockGrandSecret(): boolean {
  if (!allSecretsFound()) return false;
  return unlockGrandSecret();
}
