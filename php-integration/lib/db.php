<?php
declare(strict_types=1);

// Shared PDO factory for the mock/runtime stores.
//
// Unset by default, in which case every caller falls back to its file store and
// the mocks keep working with zero configuration. Set GUINOMO_DB_DSN (plus
// GUINOMO_DB_USER / GUINOMO_DB_PASS) to move presence and HMAC nonces into a
// real database — this is the switch that promotes the mocks to the production
// storage path. Schema: lib/schema.sql.
//
// Examples:
//   mysql:host=127.0.0.1;dbname=guinomo;charset=utf8mb4
//   sqlite:/var/lib/guinomo/guinomo.sqlite
//
// The connection is cached per DSN, so tests can flip the environment safely.

function guinomo_db(): ?PDO
{
    /** @var array<string, PDO|null> $cache */
    static $cache = [];

    $dsn = (string)(getenv('GUINOMO_DB_DSN') ?: '');
    if ($dsn === '') {
        return null;
    }
    if (array_key_exists($dsn, $cache)) {
        return $cache[$dsn];
    }

    try {
        $pdo = new PDO(
            $dsn,
            (string)(getenv('GUINOMO_DB_USER') ?: ''),
            (string)(getenv('GUINOMO_DB_PASS') ?: ''),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        guinomo_db_migrate($pdo);
        $cache[$dsn] = $pdo;
    } catch (Throwable $error) {
        // Fail soft: the caller falls back to its file store.
        error_log('guinomo_db: connection failed: ' . $error->getMessage());
        $cache[$dsn] = null;
    }

    return $cache[$dsn];
}

/** Idempotent schema creation; keeps the mocks runnable on a fresh database. */
function guinomo_db_migrate(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS guinomo_presence (
            uid INTEGER NOT NULL,
            tab VARCHAR(64) NOT NULL,
            world VARCHAR(32) NOT NULL,
            room VARCHAR(64) NOT NULL DEFAULT \'\',
            ts INTEGER NOT NULL,
            PRIMARY KEY (uid, tab)
        )'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS guinomo_hmac_nonces (
            nonce VARCHAR(128) NOT NULL,
            ts INTEGER NOT NULL,
            PRIMARY KEY (nonce)
        )'
    );
}
