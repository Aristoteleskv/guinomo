<?php
declare(strict_types=1);

// File-backed presence store for the Guinomo mocks, with an optional PDO
// (production) driver. Set GUINOMO_DB_DSN to use a database; otherwise the
// zero-config JSON file is used.
//
// The 3D client heartbeats every 20s (src/components/ui.ts) with
// { world, room, tab_id, active } and sends active=0 on pagehide. This store
// keeps the freshest entry per (uid, tab) with a short TTL so friends.php can
// report who is actually inside Guinomo and in which world/room.
//
// Swap between drivers without changing the callers: guinomo_presence_touch()
// and guinomo_presence_active() are the whole surface.

require_once __DIR__ . '/db.php';

/** Seconds without a heartbeat after which a presence entry is considered gone. */
function guinomo_presence_ttl(): int
{
    return 45;
}

function guinomo_presence_store_path(): string
{
    return (string)(getenv('GUINOMO_PRESENCE_FILE') ?: (__DIR__ . '/../.presence.json'));
}

/** @return array<string, array{uid:int,world:string,room:string,tab:string,ts:int}> */
function guinomo_presence_read(): array
{
    $path = guinomo_presence_store_path();
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

/** @param array<string, array<string,mixed>> $data */
function guinomo_presence_write(array $data): void
{
    $fh = @fopen(guinomo_presence_store_path(), 'cb');
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

function guinomo_presence_prune(PDO $pdo, int $now): void
{
    $stmt = $pdo->prepare('DELETE FROM guinomo_presence WHERE ts < :cutoff');
    $stmt->execute([':cutoff' => $now - guinomo_presence_ttl()]);
}

/** Adds, refreshes, or clears one tab's presence. */
function guinomo_presence_touch(
    int $uid,
    string $world,
    string $room,
    string $tabId,
    bool $active,
    ?int $now = null
): void {
    $now ??= time();
    $safeTab = substr(preg_replace('/[^a-f0-9]/i', '', $tabId) ?? '', 0, 64);
    $safeRoom = preg_replace('/[^a-f0-9]/i', '', $room) ?? '';

    $pdo = guinomo_db();
    if ($pdo !== null) {
        guinomo_presence_prune($pdo, $now);
        if ($active) {
            $stmt = $pdo->prepare(
                'REPLACE INTO guinomo_presence (uid, tab, world, room, ts)
                 VALUES (:uid, :tab, :world, :room, :ts)'
            );
            $stmt->execute([
                ':uid' => $uid,
                ':tab' => $safeTab,
                ':world' => $world,
                ':room' => $safeRoom,
                ':ts' => $now,
            ]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM guinomo_presence WHERE uid = :uid AND tab = :tab');
            $stmt->execute([':uid' => $uid, ':tab' => $safeTab]);
        }
        return;
    }

    // File fallback.
    $data = guinomo_presence_read();
    foreach ($data as $key => $entry) {
        if (!is_array($entry) || ($now - (int)($entry['ts'] ?? 0)) > guinomo_presence_ttl()) {
            unset($data[$key]);
        }
    }

    $key = $uid . ':' . $safeTab;
    if ($active) {
        $data[$key] = [
            'uid' => $uid,
            'world' => $world,
            'room' => $safeRoom,
            'tab' => $safeTab,
            'ts' => $now,
        ];
    } else {
        unset($data[$key]);
    }

    guinomo_presence_write($data);
}

/**
 * Freshest non-expired presence entry per uid.
 *
 * @return array<int, array{uid:int,world:string,room:string,ts:int}>
 */
function guinomo_presence_active(?int $now = null): array
{
    $now ??= time();
    $out = [];

    $pdo = guinomo_db();
    if ($pdo !== null) {
        $stmt = $pdo->prepare(
            'SELECT uid, world, room, ts FROM guinomo_presence
             WHERE ts >= :cutoff ORDER BY ts ASC'
        );
        $stmt->execute([':cutoff' => $now - guinomo_presence_ttl()]);
        foreach ($stmt->fetchAll() as $row) {
            $uid = (int)$row['uid'];
            $out[$uid] = [
                'uid' => $uid,
                'world' => (string)$row['world'],
                'room' => (string)$row['room'],
                'ts' => (int)$row['ts'],
            ];
        }
        return $out;
    }

    // File fallback.
    foreach (guinomo_presence_read() as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        if (($now - (int)($entry['ts'] ?? 0)) > guinomo_presence_ttl()) {
            continue;
        }
        $uid = (int)($entry['uid'] ?? 0);
        if ($uid <= 0) {
            continue;
        }
        if (!isset($out[$uid]) || (int)$entry['ts'] >= (int)$out[$uid]['ts']) {
            $out[$uid] = $entry;
        }
    }
    return $out;
}
