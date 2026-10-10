import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSealsBody,
  currentUid,
  readSealsState,
  saveSealsToServer,
  type SealsState,
} from '../src/core/sealsSync';
import { SECRET_IDS, saveFoundSecret, unlockGrandSecret } from '../src/core/secrets';

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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
  // Minimal browser-ish window without a uid: server sync is inert by default.
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
  vi.unstubAllGlobals();
});

describe('seals server sync', () => {
  it('builds the urlencoded body the PHP endpoint parses', () => {
    const state: SealsState = { secrets: ['one'], golden: ['one'], grand: true };
    const body = buildSealsBody(7, state, 'tok');
    expect(body.get('uid')).toBe('7');
    expect(body.get('secrets')).toBe('["one"]');
    expect(body.get('golden')).toBe('["one"]');
    expect(body.get('grand')).toBe('1');
    expect(body.get('csrf_token')).toBe('tok');
  });

  it('reads the collection state from storage', () => {
    saveFoundSecret(SECRET_IDS[0]);
    unlockGrandSecret();
    const state = readSealsState();
    expect(state.secrets).toEqual([SECRET_IDS[0]]);
    expect(state.golden).toEqual([]);
    expect(state.grand).toBe(true);
  });

  it('reports uid 0 when no profile session is present', async () => {
    expect(currentUid()).toBe(0);
    await expect(saveSealsToServer(0)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the request without a uid before touching fetch', async () => {
    await expect(saveSealsToServer()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the collection for the logged-in user', async () => {
    saveFoundSecret(SECRET_IDS[0]);
    fetchMock.mockResolvedValue({ ok: true });
    const win = window as { GUINOMO_UID?: number; CSRF_TOKEN?: string; GUINOMO_HMAC_KEY?: string };
    win.GUINOMO_UID = 7;
    win.CSRF_TOKEN = 'csrf-abc';

    await expect(saveSealsToServer()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/guinomo/seals.php');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain(
      'application/x-www-form-urlencoded',
    );
    const sentBody = new URLSearchParams(String(init.body));
    expect(sentBody.get('uid')).toBe('7');
    expect(sentBody.get('secrets')).toBe(JSON.stringify([SECRET_IDS[0]]));
    expect(sentBody.get('csrf_token')).toBe('csrf-abc');
    // No runtime HMAC key → the request is unsigned (additive behaviour).
    expect((init.headers as Record<string, string>)['X-Guinomo-Signature']).toBeUndefined();
  });

  it('adds HMAC headers when a runtime signing key is configured', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const win = window as { GUINOMO_UID?: number; CSRF_TOKEN?: string; GUINOMO_HMAC_KEY?: string };
    win.GUINOMO_UID = 7;
    win.GUINOMO_HMAC_KEY = 'dev-secret';

    await expect(saveSealsToServer()).resolves.toBe(true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Guinomo-Signature']).toBeTruthy();
    expect(headers['X-Guinomo-Timestamp']).toBeTruthy();
    expect(headers['X-Guinomo-Nonce']).toBeTruthy();
  });

  it('resolves false when the endpoint fails or is missing', async () => {
    (window as { GUINOMO_UID?: number }).GUINOMO_UID = 7;
    fetchMock.mockResolvedValue({ ok: false });
    await expect(saveSealsToServer()).resolves.toBe(false);
  });
});
