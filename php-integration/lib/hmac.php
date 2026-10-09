<?php
declare(strict_types=1);

// HMAC-SHA256 request signing — server side of docs/HMAC_AUTH.md.
//
// Kept dependency-free so it works in the mock folder and can be copied into
// the real app's App\Core\Auth module. Verification is additive to the session
// check and stays optional until a shared secret is configured.

require_once __DIR__ . '/db.php';

/** Canonical string; the body is hashed so the signature covers the payload. */
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

/**
 * @return array{ts:int,nonce:string,sig:string}
 */
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
    if ($timestamp <= 0 || abs(time() - $timestamp) > $maxSkewSeconds) {
        return false; // stale or pre-dated request
    }
    if ($nonce === '' || !preg_match('/^[a-f0-9]{32,}$/i', $nonce)) {
        return false;
    }

    $canonical = guinomo_hmac_canonical($method, $path, $timestamp, $nonce, $rawBody);
    $expected = hash_hmac('sha256', $canonical, $secret);

    // Constant-time compare; never use `==` for signatures.
    return hash_equals($expected, strtolower($signature));
}

function guinomo_hmac_verify_request(string $secret, string $rawBody, int $maxSkewSeconds = 300): bool
{
    $method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = (string)($_SERVER['REQUEST_URI'] ?? '/');
    $sig = (string)($_SERVER['HTTP_X_GUINOMO_SIGNATURE'] ?? '');
    $ts = (int)($_SERVER['HTTP_X_GUINOMO_TIMESTAMP'] ?? 0);
    $nonce = (string)($_SERVER['HTTP_X_GUINOMO_NONCE'] ?? '');

    if ($sig === '' || $ts === 0 || $nonce === '') {
        guinomo_hmac_log_failure('missing_headers');
        return false;
    }
    if (!guinomo_hmac_verify($secret, $method, $path, $rawBody, $sig, $ts, $nonce, $maxSkewSeconds)) {
        guinomo_hmac_log_failure('bad_signature');
        return false;
    }

    // Replay protection: a nonce may be claimed once within the skew window.
    if (!guinomo_hmac_nonce_claim($nonce, $maxSkewSeconds)) {
        guinomo_hmac_log_failure('replay_or_store');
        return false;
    }
    return true;
}

/**
 * Structured rejection log (time, uid, method, path, reason, ip). The signature
 * itself is intentionally never written. Appends to a gitignored file and
 * mirrors the line to the PHP error log.
 */
function guinomo_hmac_log_failure(string $reason): void
{
    $line = sprintf(
        '%s hmac_reject uid=%d method=%s path=%s reason=%s ip=%s',
        date('c'),
        (int)($_SESSION['hashtag_uid'] ?? 0),
        (string)($_SERVER['REQUEST_METHOD'] ?? 'GET'),
        (string)($_SERVER['REQUEST_URI'] ?? '/'),
        $reason,
        (string)($_SERVER['REMOTE_ADDR'] ?? '')
    );
    @error_log($line);
    @file_put_contents(guinomo_hmac_failure_log_path(), $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function guinomo_hmac_failure_log_path(): string
{
    return (string)(getenv('GUINOMO_HMAC_LOG') ?: (__DIR__ . '/../.hmac-failures.log'));
}

/** Nonce store path for the file driver; see guinomo_hmac_nonce_claim(). */
function guinomo_hmac_nonce_store_path(): string
{
    return (string)(getenv('GUINOMO_HMAC_NONCE_FILE') ?: (__DIR__ . '/../.hmac-nonces.json'));
}

/**
 * Returns true only the first time a nonce is seen within the skew window.
 * Uses the PDO store when GUINOMO_DB_DSN is configured (preferred for multiple
 * servers), otherwise a file-backed store.
 */
function guinomo_hmac_nonce_claim(string $nonce, int $ttlSeconds): bool
{
    $pdo = guinomo_db();
    if ($pdo !== null) {
        $now = time();
        try {
            $pdo->beginTransaction();
            $pdo->prepare('DELETE FROM guinomo_hmac_nonces WHERE ts < :cutoff')
                ->execute([':cutoff' => $now - $ttlSeconds]);
            $pdo->prepare('INSERT INTO guinomo_hmac_nonces (nonce, ts) VALUES (:nonce, :ts)')
                ->execute([':nonce' => $nonce, ':ts' => $now]);
            $pdo->commit();
            return true;
        } catch (PDOException $duplicate) {
            // Unique-key violation means the nonce was already claimed (replay).
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return false;
        }
    }

    $path = guinomo_hmac_nonce_store_path();
    // Read/write handle ('c+b'): the original 'cb' was write-only, so reading
    // the store always failed and every nonce looked unused (broken replay guard).
    $fh = @fopen($path, 'c+b');
    if ($fh === false) {
        return false; // fail closed: no store means we cannot rule out replays
    }

    try {
        if (!flock($fh, LOCK_EX)) {
            return false;
        }
        rewind($fh);
        $raw = stream_get_contents($fh);
        $seen = json_decode((string)$raw, true);
        if (!is_array($seen)) {
            $seen = [];
        }
        $now = time();
        foreach ($seen as $key => $ts) {
            if (($now - (int)$ts) > $ttlSeconds) {
                unset($seen[$key]);
            }
        }
        if (isset($seen[$nonce])) {
            return false;
        }
        $seen[$nonce] = $now;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($seen));
        fflush($fh);
        return true;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}
