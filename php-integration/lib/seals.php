<?php
declare(strict_types=1);

// File-backed seals store for the Guinomo mocks, with an optional PDO
// (production) driver — set GUINOMO_DB_DSN to use a database, otherwise the
// zero-config JSON file is used (see lib/presence.php for the same pattern).
//
// Each row is one player's explorer-trophy collection:
//   secrets — stable ids of the found hidden secrets (album progress)
//   golden  — the subset found while the golden hour was active
//   grand   — whether the 5/5 "Grand Secret" finale is unlocked
//
// The engine pushes the collection (src/core/sealsSync.ts) after every change;
// the host app's profile page reads it back with
// GET api/guinomo/seals?uid=N to show the badges to other players.

require_once __DIR__ . '/db.php';

function guinomo_seals_store_path(): string
{
    return (string)(getenv('GUINOMO_SEALS_FILE') ?: (__DIR__ . '/../.seals.json'));
}

/**
 * @return array<string, array{uid:int,secrets:list<string>,golden:list<string>,grand:bool,updated:int}>
 */
function guinomo_seals_read(): array
{
    $path = guinomo_seals_store_path();
    if (!is_file($path)) {
        return [];
    }
    $fh = @fopen($path, 'rb');
    if ($fh === false) {
        return [];
    }
    try {
        @flock($fh, LOCK_SH);
        $raw = stream_get_contents($fh);
    } finally {
        @flock($fh, LOCK_UN);
        fclose($fh);
    }
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : [];
}

/** @param array<string, mixed> $data */
function guinomo_seals_write(array $data): void
{
    $fh = @fopen(guinomo_seals_store_path(), 'cb');
    if ($fh === false) {
        return;
    }
    try {
        @flock($fh, LOCK_EX);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE));
        fflush($fh);
    } finally {
        @flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/** Cleans an array of seal ids: non-empty strings only, capped to stay sane. */
function guinomo_seals_clean_ids(mixed $value, int $limit = 32): array
{
    if (!is_array($value)) {
        return [];
    }
    $out = [];
    foreach ($value as $item) {
        if (!is_string($item) || $item === '' || strlen($item) > 200 || count($out) >= $limit) {
            continue;
        }
        $out[] = $item;
    }
    return array_values(array_unique($out));
}

function guinomo_seals_save(int $uid, array $secrets, array $golden, bool $grand, ?int $now = null): void
{
    $now ??= time();

    $pdo = guinomo_db();
    if ($pdo !== null) {
        $stmt = $pdo->prepare(
            'REPLACE INTO guinomo_seals (uid, secrets, golden, grand, updated)
             VALUES (:uid, :secrets, :golden, :grand, :updated)'
        );
        $stmt->execute([
            ':uid' => $uid,
            ':secrets' => json_encode($secrets, JSON_UNESCAPED_UNICODE),
            ':golden' => json_encode($golden, JSON_UNESCAPED_UNICODE),
            ':grand' => $grand ? 1 : 0,
            ':updated' => $now,
        ]);
        return;
    }

    $data = guinomo_seals_read();
    $data[(string)$uid] = [
        'uid' => $uid,
        'secrets' => $secrets,
        'golden' => $golden,
        'grand' => $grand,
        'updated' => $now,
    ];
    guinomo_seals_write($data);
}

/**
 * One player's trophy collection, or null when the player has none yet.
 *
 * @return array{uid:int,secrets:list<string>,golden:list<string>,grand:bool,updated:int}|null
 */
function guinomo_seals_get(int $uid): ?array
{
    $pdo = guinomo_db();
    if ($pdo !== null) {
        $stmt = $pdo->prepare('SELECT uid, secrets, golden, grand, updated FROM guinomo_seals WHERE uid = :uid');
        $stmt->execute([':uid' => $uid]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }
        return [
            'uid' => (int)$row['uid'],
            'secrets' => guinomo_seals_clean_ids(json_decode((string)$row['secrets'], true)),
            'golden' => guinomo_seals_clean_ids(json_decode((string)$row['golden'], true)),
            'grand' => (bool)(int)$row['grand'],
            'updated' => (int)$row['updated'],
        ];
    }

    foreach (guinomo_seals_read() as $entry) {
        if (!is_array($entry) || (int)($entry['uid'] ?? 0) !== $uid) {
            continue;
        }
        return [
            'uid' => $uid,
            'secrets' => guinomo_seals_clean_ids($entry['secrets'] ?? []),
            'golden' => guinomo_seals_clean_ids($entry['golden'] ?? []),
            'grand' => (bool)($entry['grand'] ?? false),
            'updated' => (int)($entry['updated'] ?? 0),
        ];
    }
    return null;
}