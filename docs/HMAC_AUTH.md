# HMAC authentication (scaffolding)

Minimal contract for signing state-changing requests between the Guinomo 3D
client and the PHP social network. This is **scaffolding**: wire it in behind a
feature flag before trusting it in production.

## Goals

- Prove that a request body (`uid`, `key`, `value`, ...) was produced by a client
  holding the shared secret, and was not replayed or tampered with.
- Keep the existing `session_start()` / `$_SESSION['hashtag_uid']` check as the
  first line of defense. HMAC is additive, never a replacement.

## Canonical string

Sign a canonical, order-stable string — not raw JSON:

```
v1
<HTTP method, uppercase>
<path, e.g. /php/save_avatar_3d.php>
<unix timestamp, seconds>
<nonce, random hex, >= 16 bytes>
<sha256 hex of the raw body>
```

Each line is separated by `\n` with a trailing newline. The body hash makes the
signature cover the payload without re-serializing it.

## PHP: sign

```php
<?php
declare(strict_types=1);

function guinomo_hmac_canonical(
    string $method,
    string $path,
    int $timestamp,
    string $nonce,
    string $rawBody
): string {
    return implode("\n", [
        'v1',
        strtoupper($method),
        $path,
        (string)$timestamp,
        $nonce,
        hash('sha256', $rawBody),
    ]) . "\n";
}

function guinomo_hmac_sign(
    string $secret,
    string $method,
    string $path,
    string $rawBody,
    ?int $timestamp = null,
    ?string $nonce = null
): array {
    $timestamp ??= time();
    $nonce ??= bin2hex(random_bytes(16));
    $canonical = guinomo_hmac_canonical($method, $path, $timestamp, $nonce, $rawBody);
    return [
        'ts' => $timestamp,
        'nonce' => $nonce,
        'sig' => hash_hmac('sha256', $canonical, $secret),
    ];
}
```

## PHP: verify

```php
<?php
declare(strict_types=1);

function guinomo_hmac_verify(
    string $secret,
    string $method,
    string $path,
    string $rawBody,
    string $signature,
    int $timestamp,
    string $nonce,
    int $maxSkewSeconds = 300
): bool {
    if (abs(time() - $timestamp) > $maxSkewSeconds) {
        return false; // stale or pre-dated request
    }

    $canonical = guinomo_hmac_canonical($method, $path, $timestamp, $nonce, $rawBody);
    $expected = hash_hmac('sha256', $canonical, $secret);

    // Constant-time compare; never use `==` for signatures.
    return hash_equals($expected, strtolower($signature));
}

// Replay protection: store seen nonces (e.g. APCu / Redis / DB) for at least
// $maxSkewSeconds and reject duplicates. Sketch:
//
//   if (!guinomo_nonce_claim($nonce, $maxSkewSeconds)) { reject(); }
```

Wire-up inside an endpoint (before touching the database):

```php
$rawBody = (string)file_get_contents('php://input');
$sig  = (string)($_SERVER['HTTP_X_GUINOMO_SIGNATURE'] ?? '');
$ts   = (int)($_SERVER['HTTP_X_GUINOMO_TIMESTAMP'] ?? 0);
$nonce = (string)($_SERVER['HTTP_X_GUINOMO_NONCE'] ?? '');

if (!guinomo_hmac_verify($secret, $_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $rawBody, $sig, $ts, $nonce)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Assinatura inválida']);
    exit;
}
```

## Client notes

- The shared secret must never be embedded in the shipped bundle. In the browser,
  fetch a short-lived signing key (or a proxy signature) from an authenticated
  endpoint, or sign server-side. A bundled constant is only acceptable for local
  development.
- Send the three headers on every state-changing request:
  - `X-Guinomo-Signature: <hex>`
  - `X-Guinomo-Timestamp: <unix seconds>`
  - `X-Guinomo-Nonce: <hex>`
- Use WebCrypto `crypto.subtle.importKey` + `crypto.subtle.sign('HMAC', ...)`
  with `SHA-256` to reproduce `hash_hmac('sha256', ...)`. Encode the canonical
  string as UTF-8; the digest must be lowercase hex to match `hash_equals`.
- Sign the exact bytes sent in the body. If the client re-serializes JSON after
  signing, verification will fail — hash once, send those bytes.

## Test vector

```
secret   = "dev-secret"
method   = "POST"
path     = "/php/save_avatar_3d.php"
ts       = 1700000000
nonce    = "0123456789abcdef0123456789abcdef"
rawBody  = {"uid":1,"key":"name_tag_color","value":"#e5b299"}

canonical = "v1\nPOST\n/php/save_avatar_3d.php\n1700000000\n0123456789abcdef0123456789abcdef\n" + sha256(rawBody) + "\n"
sig        = HMAC-SHA256(canonical, secret)  // lowercase hex
```

## Rollout checklist

1. Add the helpers to a shared `App\Core\Auth` module (not yet present).
2. Persist nonces for the skew window; reject duplicates.
3. Add the client signer behind a flag; keep sending the existing CSRF token.
4. Log verification failures without leaking the signature.
5. Only then make verification mandatory on the mocks and the real endpoint.
