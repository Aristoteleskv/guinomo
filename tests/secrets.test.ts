import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allSecretsFound,
  foundSecretCount,
  isGrandSecretUnlocked,
  isWorldSecretFound,
  markGoldenSeal,
  maybeUnlockGrandSecret,
  nextSecretToFind,
  readFoundSecrets,
  readGoldenSeals,
  saveFoundSecret,
  SECRETS,
  SECRET_IDS,
  secretForWorld,
  unlockGrandSecret,
} from '../src/core/secrets';

const GRAND_SECRET_KEY = 'guinomo.grand_secret.v1';

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

describe('explorer secrets state', () => {
  it('starts empty and tolerates corrupted storage', () => {
    expect(readFoundSecrets()).toEqual([]);
    localStorage.setItem('guinomo_secrets', '{not-json');
    expect(readFoundSecrets()).toEqual([]);
  });

  it('persists found secrets idempotently', () => {
    saveFoundSecret(SECRET_IDS[0]);
    saveFoundSecret(SECRET_IDS[0]);
    expect(readFoundSecrets()).toEqual([SECRET_IDS[0]]);
  });

  it('allSecretsFound becomes true only with the five ids', () => {
    expect(allSecretsFound()).toBe(false);
    for (const id of SECRET_IDS) saveFoundSecret(id);
    expect(allSecretsFound()).toBe(true);
  });

  it('marks golden seals without duplicates', () => {
    markGoldenSeal(SECRET_IDS[0]);
    markGoldenSeal(SECRET_IDS[0]);
    expect(readGoldenSeals()).toEqual([SECRET_IDS[0]]);
  });

  it('unlocks the Grand Secret once', () => {
    expect(isGrandSecretUnlocked()).toBe(false);
    expect(unlockGrandSecret()).toBe(true);
    expect(unlockGrandSecret()).toBe(false);
    expect(isGrandSecretUnlocked()).toBe(true);
  });

  it('maybeUnlockGrandSecret fires only at the 5/5 moment', () => {
    for (const id of SECRET_IDS.slice(0, 4)) saveFoundSecret(id);
    expect(maybeUnlockGrandSecret()).toBe(false);
    expect(isGrandSecretUnlocked()).toBe(false);
    saveFoundSecret(SECRET_IDS[4]);
    expect(maybeUnlockGrandSecret()).toBe(true);
    expect(maybeUnlockGrandSecret()).toBe(false);
    expect(isGrandSecretUnlocked()).toBe(true);
  });

  it('marks the grand flag using the stable storage key', () => {
    expect(localStorage.getItem(GRAND_SECRET_KEY)).toBeNull();
    unlockGrandSecret();
    expect(localStorage.getItem(GRAND_SECRET_KEY)).toBe('1');
  });
});

describe('secret quest order', () => {
  it('maps each of the five ids to exactly one home world', () => {
    expect(SECRETS).toHaveLength(SECRET_IDS.length);
    const ids = new Set(SECRETS.map((entry) => entry.id));
    expect(ids.size).toBe(SECRETS.length);
    for (const id of SECRET_IDS) expect(ids.has(id)).toBe(true);
  });

  it('covers each secret world once and none in floating-city', () => {
    const worlds = SECRETS.map((entry) => entry.world);
    expect(new Set(worlds).size).toBe(worlds.length);
    expect(worlds).not.toContain('floating-city');
    expect(secretForWorld('floating-city')).toBeUndefined();
  });

  it('tracks the found count', () => {
    expect(foundSecretCount()).toBe(0);
    saveFoundSecret(SECRET_IDS[0]);
    saveFoundSecret(SECRET_IDS[2]);
    expect(foundSecretCount()).toBe(2);
    saveFoundSecret(SECRET_IDS[0]);
    expect(foundSecretCount()).toBe(2);
  });

  it('returns the first non-found secret in quest order', () => {
    expect(nextSecretToFind()).toEqual(SECRETS[0]);
    saveFoundSecret(SECRET_IDS[0]);
    expect(nextSecretToFind()).toEqual(SECRETS[1]);
    for (const entry of SECRETS) saveFoundSecret(entry.id);
    expect(nextSecretToFind()).toBeNull();
  });

  it('reports whether the current world still hides a secret', () => {
    expect(isWorldSecretFound('lobby')).toBe(false);
    saveFoundSecret(SECRET_IDS[0]);
    expect(isWorldSecretFound('lobby')).toBe(true);
    // Worlds without a secret never block the quest guidance.
    expect(isWorldSecretFound('floating-city')).toBe(true);
  });
});
