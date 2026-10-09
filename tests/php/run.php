<?php
declare(strict_types=1);

// Dependency-free test suite for the PHP platform layer (stores + HMAC).
//
//   php tests/php/run.php
//
// Exercises both storage drivers: the JSON file fallback (default) and the PDO
// driver via a throwaway SQLite database, and cross-checks the HMAC contract
// against the same golden vector used by the browser suite
// (tests/fixtures/hmac-vector.json).

require_once __DIR__ . '/../../php-integration/lib/hmac.php';
require_once __DIR__ . '/../../php-integration/lib/presence.php';

$GLOBALS['pass'] = 0;
$GLOBALS['fail'] = 0;

function ok(bool $condition, string $name): void
{
    if ($condition) {
        $GLOBALS['pass']++;
        echo "  \033[32mok\033[0m   {$name}\n";
    } else {
        $GLOBALS['fail']++;
        echo "  \033[31mFAIL\033[0m {$name}\n";
    }
}

function eq(mixed $actual, mixed $expected, string $name): void
{
    $same = $actual === $expected;
    ok($same, $name . ($same ? '' : ' (got ' . var_export($actual, true) . ', want ' . var_export($expected, true) . ')'));
}

/** @return array<string, string> */
function vector(): array
{
    $raw = file_get_contents(__DIR__ . '/../fixtures/hmac-vector.json');
    return json_decode((string)$raw, true, 512, JSON_THROW_ON_ERROR);
}

$tmp = sys_get_temp_dir() . '/guinomo-tests-' . bin2hex(random_bytes(4));
@mkdir($tmp, 0777, true);
$cleanup = function () use ($tmp): void {
    foreach (glob($tmp . '/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($tmp);
};

echo "\nHMAC contract (shared vector)\n";
$v = vector();
$sig = guinomo_hmac_sign($v['secret'], $v['method'], $v['path'], $v['body'], (int)$v['timestamp'], $v['nonce']);
eq($sig['sig'], $v['signature'], 'PHP signer matches the JS golden signature');
eq(hash('sha256', $v['body']), $v['bodyHash'], 'PHP body hash matches the JS golden hash');
eq($sig['nonce'], $v['nonce'], 'PHP echoes the provided nonce');

echo "\nHMAC verification\n";
$now = time();
$live = guinomo_hmac_sign('dev-secret', 'POST', '/php/save_avatar_3d.php', $v['body'], $now, 'aabbccddeeff00112233445566778899');
ok(guinomo_hmac_verify('dev-secret', 'POST', '/php/save_avatar_3d.php', $v['body'], $live['sig'], $live['ts'], $live['nonce']), 'accepts a valid, fresh signature');
ok(!guinomo_hmac_verify('dev-secret', 'POST', '/php/save_avatar_3d.php', $v['body'] . ' ', $live['sig'], $live['ts'], $live['nonce']), 'rejects a tampered body');
ok(!guinomo_hmac_verify('dev-secret', 'POST', '/php/save_avatar_3d.php', $v['body'], $live['sig'], $now - 4000, $live['nonce']), 'rejects a stale timestamp');
ok(!guinomo_hmac_verify('other-secret', 'POST', '/php/save_avatar_3d.php', $v['body'], $live['sig'], $live['ts'], $live['nonce']), 'rejects a wrong secret');

echo "\nFile driver (no database configured)\n";
putenv('GUINOMO_DB_DSN');
putenv('GUINOMO_HMAC_NONCE_FILE=' . $tmp . '/nonces.json');
putenv('GUINOMO_PRESENCE_FILE=' . $tmp . '/presence.json');
$n1 = 'abcdef0123456789abcdef0123456789';
ok(guinomo_hmac_nonce_claim($n1, 300) === true, 'file: first nonce claim accepted');
ok(guinomo_hmac_nonce_claim($n1, 300) === false, 'file: replayed nonce rejected');

guinomo_presence_touch(7, 'forest', 'deadbeef', 'abc123', true, 1000);
$active = guinomo_presence_active(1000);
eq($active[7]['world'] ?? null, 'forest', 'file: presence stored per uid');
eq($active[7]['room'] ?? null, 'deadbeef', 'file: room stored');
eq(count(guinomo_presence_active(1000 + guinomo_presence_ttl() + 1)), 0, 'file: presence expires after the TTL');
guinomo_presence_touch(7, 'forest', 'deadbeef', 'abc123', false, 1001);
eq(count(guinomo_presence_active(1001)), 0, 'file: active=0 clears presence');

echo "\nPDO driver (throwaway SQLite)\n";
putenv('GUINOMO_DB_DSN=sqlite:' . $tmp . '/guinomo.sqlite');
guinomo_presence_touch(9, 'old-town', 'cafebabe', 'aabbcc', true, 2000);
$activeDb = guinomo_presence_active(2000);
eq($activeDb[9]['world'] ?? null, 'old-town', 'pdo: presence stored per uid');
eq($activeDb[9]['room'] ?? null, 'cafebabe', 'pdo: room stored');
eq(count(guinomo_presence_active(2000 + guinomo_presence_ttl() + 1)), 0, 'pdo: presence expires after the TTL');
guinomo_presence_touch(9, 'old-town', 'cafebabe', 'aabbcc', false, 2001);
eq(count(guinomo_presence_active(2001)), 0, 'pdo: active=0 clears presence');

$n2 = '11111111111111111111111111111111';
ok(guinomo_hmac_nonce_claim($n2, 300) === true, 'pdo: first nonce claim accepted');
ok(guinomo_hmac_nonce_claim($n2, 300) === false, 'pdo: replayed nonce rejected');

$cleanup();

echo "\n" . ($GLOBALS['fail'] === 0 ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m")
    . " {$GLOBALS['pass']} passed, {$GLOBALS['fail']} failed\n\n";

exit($GLOBALS['fail'] === 0 ? 0 : 1);
