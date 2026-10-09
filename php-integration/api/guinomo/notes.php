<?php
declare(strict_types=1);

// Guinomo world-notes endpoint: terrain-anchored messages, one set per world.
//
// Consumed by src/scene/notes.ts:
//   GET  api/guinomo/notes.php?world=<id>
//        -> { success: true, notes: [{ id, text, x, y, z, uid, createdAt }] }
//   POST api/guinomo/notes.php  body { world, x, y, z, text }
//        -> { success: true, id }
//
// Storage follows lib/presence.php: PDO when GUINOMO_DB_DSN is configured
// (schema in lib/schema.sql), otherwise a zero-config JSON file. Validation:
// world must be known, text 1..200 chars, coordinates finite, and one note per
// 20 seconds per uid.

session_start();
require_once __DIR__ . '/../../lib/db.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

const GUINOMO_NOTES_MAX_LENGTH = 200;
const GUINOMO_NOTES_RATE_LIMIT = 20;

/** @return string[] */
function guinomo_notes_worlds(): array
{
    return ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];
}

function guinomo_notes_store_path(): string
{
    return (string)(getenv('GUINOMO_NOTES_FILE') ?: (__DIR__ . '/../../.notes.json'));
}

/** Last write per uid, used for the 20s rate limit. */
function guinomo_notes_last_post(int $uid): int
{
    if ($uid <= 0) {
        return 0;
    }

    $pdo = guinomo_db();
    if ($pdo !== null) {
        guinomo_notes_migrate($pdo);
        $stmt = $pdo->prepare('SELECT MAX(created_at) FROM guinomo_notes WHERE uid = :uid');
        $stmt->execute([':uid' => $uid]);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    $latest = 0;
    foreach (guinomo_notes_file_read() as $note) {
        if (!is_array($note)) {
            continue;
        }
        if ((int)($note['uid'] ?? 0) === $uid) {
            $latest = max($latest, (int)($note['createdAt'] ?? 0));
        }
    }
    return $latest;
}

/**
 * Notes for one world, oldest first.
 *
 * @return array<int, array{id:int,text:string,x:float,y:float,z:float,uid:int,createdAt:int}>
 */
function guinomo_notes_list(string $world): array
{
    $pdo = guinomo_db();
    if ($pdo !== null) {
        guinomo_notes_migrate($pdo);
        $stmt = $pdo->prepare(
            'SELECT id, uid, x, y, z, text, created_at FROM guinomo_notes
             WHERE world = :world ORDER BY created_at ASC, id ASC'
        );
        $stmt->execute([':world' => $world]);

        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $out[] = guinomo_notes_shape(
                (int)$row['id'],
                (string)$row['text'],
                (float)$row['x'],
                (float)$row['y'],
                (float)$row['z'],
                (int)$row['uid'],
                (int)$row['created_at']
            );
        }
        return $out;
    }

    $out = [];
    foreach (guinomo_notes_file_read() as $note) {
        if (!is_array($note) || (string)($note['world'] ?? '') !== $world) {
            continue;
        }
        $out[] = guinomo_notes_shape(
            (int)($note['id'] ?? 0),
            (string)($note['text'] ?? ''),
            (float)($note['x'] ?? 0),
            (float)($note['y'] ?? 0),
            (float)($note['z'] ?? 0),
            (int)($note['uid'] ?? 0),
            (int)($note['createdAt'] ?? 0)
        );
    }
    usort(
        $out,
        static fn(array $a, array $b): int => [$a['createdAt'], $a['id']] <=> [$b['createdAt'], $b['id']]
    );
    return $out;
}

/**
 * @return array{id:int,text:string,x:float,y:float,z:float,uid:int,createdAt:int}
 */
function guinomo_notes_shape(int $id, string $text, float $x, float $y, float $z, int $uid, int $createdAt): array
{
    return [
        'id' => $id,
        'text' => $text,
        'x' => $x,
        'y' => $y,
        'z' => $z,
        'uid' => $uid,
        'createdAt' => $createdAt,
    ];
}

/** Stores a note and returns its id. */
function guinomo_notes_add(string $world, float $x, float $y, float $z, string $text, int $uid, ?int $now = null): int
{
    $now ??= time();

    $pdo = guinomo_db();
    if ($pdo !== null) {
        guinomo_notes_migrate($pdo);
        $stmt = $pdo->prepare(
            'INSERT INTO guinomo_notes (uid, world, x, y, z, text, created_at)
             VALUES (:uid, :world, :x, :y, :z, :text, :created_at)'
        );
        $stmt->execute([
            ':uid' => $uid,
            ':world' => $world,
            ':x' => $x,
            ':y' => $y,
            ':z' => $z,
            ':text' => $text,
            ':created_at' => $now,
        ]);
        return (int)$pdo->lastInsertId();
    }

    $notes = guinomo_notes_file_read();
    $maxId = 0;
    foreach ($notes as $note) {
        if (is_array($note)) {
            $maxId = max($maxId, (int)($note['id'] ?? 0));
        }
    }
    $id = $maxId + 1;
    $notes[] = [
        'id' => $id,
        'uid' => $uid,
        'world' => $world,
        'x' => $x,
        'y' => $y,
        'z' => $z,
        'text' => $text,
        'createdAt' => $now,
    ];
    guinomo_notes_file_write($notes);
    return $id;
}

/**
 * Creates the notes table when a database is configured. DDL is chosen per
 * driver so the same endpoint runs on MySQL/MariaDB and SQLite.
 */
function guinomo_notes_migrate(PDO $pdo): void
{
    if ((string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS guinomo_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid INTEGER NOT NULL DEFAULT 0,
                world VARCHAR(32) NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                z REAL NOT NULL,
                text VARCHAR(200) NOT NULL,
                created_at INTEGER NOT NULL
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_guinomo_notes_world ON guinomo_notes (world, created_at)');
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS guinomo_notes (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            uid INT NOT NULL DEFAULT 0,
            world VARCHAR(32) NOT NULL,
            x DOUBLE NOT NULL,
            y DOUBLE NOT NULL,
            z DOUBLE NOT NULL,
            text VARCHAR(200) NOT NULL,
            created_at BIGINT NOT NULL,
            INDEX idx_guinomo_notes_world (world, created_at)
        )'
    );
}

/** @return array<int, array<string, mixed>> */
function guinomo_notes_file_read(): array
{
    $path = guinomo_notes_store_path();
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

/** @param array<int, array<string, mixed>> $notes */
function guinomo_notes_file_write(array $notes): void
{
    $fh = @fopen(guinomo_notes_store_path(), 'cb');
    if ($fh === false) {
        return;
    }
    try {
        @flock($fh, LOCK_EX);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode(array_values($notes), JSON_UNESCAPED_UNICODE));
        fflush($fh);
    } finally {
        @flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/** Accepts both form-encoded ($_POST) and JSON request bodies. */
function guinomo_notes_body(): array
{
    if (!empty($_POST)) {
        return $_POST;
    }
    $raw = (string)file_get_contents('php://input');
    if ($raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function guinomo_notes_fail(string $message, int $status): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $world = isset($_GET['world']) ? (string)$_GET['world'] : '';
    if (!in_array($world, guinomo_notes_worlds(), true)) {
        $world = 'lobby';
    }
    echo json_encode(['success' => true, 'notes' => guinomo_notes_list($world)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $body = guinomo_notes_body();

    $world = isset($body['world']) ? (string)$body['world'] : '';
    if (!in_array($world, guinomo_notes_worlds(), true)) {
        guinomo_notes_fail('Mundo inválido', 400);
    }

    $text = trim((string)($body['text'] ?? ''));
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if ($length < 1 || $length > GUINOMO_NOTES_MAX_LENGTH) {
        guinomo_notes_fail('O recado deve ter entre 1 e 200 caracteres', 400);
    }

    foreach (['x', 'y', 'z'] as $axis) {
        $value = $body[$axis] ?? null;
        if (!is_numeric($value) || !is_finite((float)$value)) {
            guinomo_notes_fail('Coordenadas inválidas', 400);
        }
    }

    // The mocks fall back to uid 1 elsewhere; stay consistent so local testing
    // works without a full login.
    $uid = (int)($_SESSION['hashtag_uid'] ?? 0);
    if ($uid <= 0) {
        $uid = 1;
    }

    $last = guinomo_notes_last_post($uid);
    if ($last > 0 && (time() - $last) < GUINOMO_NOTES_RATE_LIMIT) {
        guinomo_notes_fail('Espera 20 segundos antes de deixar outro recado', 429);
    }

    $id = guinomo_notes_add(
        $world,
        (float)$body['x'],
        (float)$body['y'],
        (float)$body['z'],
        $text,
        $uid
    );
    echo json_encode(['success' => true, 'id' => $id], JSON_UNESCAPED_UNICODE);
    exit;
}

guinomo_notes_fail('Método não permitido', 405);
