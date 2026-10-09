// HMAC-SHA256 request signing — client side of docs/HMAC_AUTH.md.
//
// This is the browser counterpart of php-integration/lib/hmac.php. It signs the
// canonical string:
//
//   v1
//   <METHOD>
//   <path>
//   <unix seconds>
//   <nonce, hex, >= 16 bytes>
//   <sha256 hex of the raw body>
//
// (each line terminated by "\n"), with a lowercase-hex HMAC-SHA256 signature.
//
// The shared secret must never ship inside the bundle. Provide a short-lived
// key at runtime (fetched from an authenticated endpoint) through
// `window.GUINOMO_HMAC_KEY`, plus `window.GUINOMO_HMAC_PATH` when the canonical
// path must differ from the request URL's pathname. When no key is present the
// signer is inert: callers behave exactly as before.

export const HMAC_CANONICAL_VERSION = 'v1';

export interface HmacSignature {
  /** Unix timestamp, seconds. */
  ts: number;
  /** Random lowercase-hex nonce, >= 16 bytes. */
  nonce: string;
  /** Lowercase-hex HMAC-SHA256 signature. */
  sig: string;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Random lowercase-hex nonce built from `bytes` cryptographically random bytes. */
export function createNonce(bytes = 16): string {
  const random = new Uint8Array(bytes);
  crypto.getRandomValues(random);
  return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Lowercase-hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Builds the canonical string from a pre-computed body hash. */
export function buildCanonicalString(
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  bodyHash: string,
): string {
  return [HMAC_CANONICAL_VERSION, method.toUpperCase(), path, String(timestamp), nonce, bodyHash].join('\n') + '\n';
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Signs a request body as a UTF-8 string. */
export async function signRequest(
  secret: string,
  method: string,
  path: string,
  rawBody: string,
  timestamp: number = Math.floor(Date.now() / 1000),
  nonce: string = createNonce(),
): Promise<HmacSignature> {
  const bodyHash = await sha256Hex(rawBody);
  const canonical = buildCanonicalString(method, path, timestamp, nonce, bodyHash);
  return { ts: timestamp, nonce, sig: await hmacSha256Hex(secret, canonical) };
}

/** Maps a signature to the three headers the PHP verifier reads. */
export function signatureHeaders(signature: HmacSignature): Record<string, string> {
  return {
    'X-Guinomo-Signature': signature.sig,
    'X-Guinomo-Timestamp': String(signature.ts),
    'X-Guinomo-Nonce': signature.nonce,
  };
}

export function isSigningEnabled(): boolean {
  return typeof window !== 'undefined' && typeof window.GUINOMO_HMAC_KEY === 'string' && window.GUINOMO_HMAC_KEY.length > 0;
}

/**
 * Signs `rawBody` when a runtime key is configured, otherwise returns {}.
 * The caller must send the exact same `rawBody` bytes it passed here.
 */
export async function signIfEnabled(
  method: string,
  endpointUrl: string,
  rawBody: string,
): Promise<Record<string, string>> {
  if (!isSigningEnabled()) return {};
  const path = window.GUINOMO_HMAC_PATH || new URL(endpointUrl, window.location.origin).pathname;
  const signature = await signRequest(window.GUINOMO_HMAC_KEY as string, method, path, rawBody);
  return signatureHeaders(signature);
}
