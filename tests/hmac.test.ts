import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCanonicalString,
  createNonce,
  sha256Hex,
  signRequest,
  signatureHeaders,
} from '../src/core/hmac';

// Shared golden vector, also asserted by the PHP suite (tests/php/run.php) so
// the browser signer and the PHP verifier can never drift apart.
const vector = JSON.parse(
  readFileSync(new URL('./fixtures/hmac-vector.json', import.meta.url), 'utf8'),
) as {
  secret: string;
  method: string;
  path: string;
  timestamp: number;
  nonce: string;
  body: string;
  bodyHash: string;
  signature: string;
};

describe('HMAC request signing', () => {
  it('hashes the raw body with SHA-256', async () => {
    expect(await sha256Hex(vector.body)).toBe(vector.bodyHash);
  });

  it('builds the canonical string exactly as the PHP verifier does', () => {
    const canonical = [
      'v1',
      vector.method.toUpperCase(),
      vector.path,
      String(vector.timestamp),
      vector.nonce,
      vector.bodyHash,
    ].join('\n') + '\n';
    expect(
      buildCanonicalString(vector.method, vector.path, vector.timestamp, vector.nonce, vector.bodyHash),
    ).toBe(canonical);
  });

  it('reproduces the shared golden-vector signature', async () => {
    const signature = await signRequest(
      vector.secret,
      vector.method,
      vector.path,
      vector.body,
      vector.timestamp,
      vector.nonce,
    );
    expect(signature).toEqual({
      ts: vector.timestamp,
      nonce: vector.nonce,
      sig: vector.signature,
    });
  });

  it('changes the signature when the body is tampered with', async () => {
    const tampered = await signRequest(
      vector.secret,
      vector.method,
      vector.path,
      `${vector.body} `,
      vector.timestamp,
      vector.nonce,
    );
    expect(tampered.sig).not.toBe(vector.signature);
  });

  it('uppercases the method in the canonical string', () => {
    const canonical = buildCanonicalString('post', vector.path, vector.timestamp, vector.nonce, vector.bodyHash);
    expect(canonical.split('\n')[1]).toBe('POST');
  });

  it('maps a signature to the three verifier headers', () => {
    expect(signatureHeaders({ ts: vector.timestamp, nonce: vector.nonce, sig: vector.signature })).toEqual({
      'X-Guinomo-Signature': vector.signature,
      'X-Guinomo-Timestamp': String(vector.timestamp),
      'X-Guinomo-Nonce': vector.nonce,
    });
  });

  it('creates 16-byte lowercase-hex nonces', () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(createNonce()).not.toBe(nonce);
  });
});
