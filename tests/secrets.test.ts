import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allSecretsFound,
  isGrandSecretUnlocked,
  markGoldenSeal,
  maybeUnlockGrandSecret,
  readFoundSecrets,
  readGoldenSeals,
  saveFoundSecret,
  SECRET_IDS,
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
