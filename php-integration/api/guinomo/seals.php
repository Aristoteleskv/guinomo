<?php
declare(strict_types=1);

// Guinomo seals endpoint: read/write a player's explorer-trophy collection.
//
//   POST api/guinomo/seals       — save the caller's collection (the session
//                                  uid must match the posted uid; HMAC-signed
//                                  when GUINOMO_HMAC_SECRET is configured)
//   GET  api/guinomo/seals?uid=N — public read so profile pages can show the
//                                  badges to other players
//
// Consumed by src/core/sealsSync.ts (POST). Mirrors the session rules of
// save_avatar_3d.php and the file/database duality of lib/presence.php.

session_start();
require_once __DIR__ . '/../../lib/seals.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Public read: the badge list for any profile.
if ($method === 'GET') {
    $uid = (int)($_GET['uid'] ?? 0);
    if ($uid <= 0) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['success' => false, 'error' => 'uid obrigatório']);
        exit;
    }
    $seals = guinomo_seals_get($uid);
    echo json_encode([
        'success' => true,
        'seals' => $seals, // null when the player has no trophies yet
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

$uid = (int)($_SESSION['hashtag_uid'] ?? 0);
if ($uid <= 0) {
    // Mocks have no login flow: fall back to uid 1 so local testing works.
    // In the real app a logged-in session always provides the uid.
    $uid = 1;
}

// Segurança: o UID enviado deve ser igual ao UID da sessão.
$uid_request = filter_input(INPUT_POST, 'uid', FILTER_VALIDATE_INT);
if ($uid_request === null || $uid !== (int)$uid_request) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['success' => false, 'error' => 'Não autorizado a guardar estes selos']);
    exit;
}

// Verificação HMAC opcional — ativada definindo GUINOMO_HMAC_SECRET.
// É aditiva: sem segredo, o endpoint funciona exatamente como antes.
$hmacSecret = (string)(getenv('GUINOMO_HMAC_SECRET') ?: '');
if ($hmacSecret !== '') {
    require_once __DIR__ . '/../../lib/hmac.php';
    $rawBody = (string)file_get_contents('php://input');
    if (!guinomo_hmac_verify_request($hmacSecret, $rawBody)) {
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode(['success' => false, 'error' => 'Assinatura inválida']);
        exit;
    }
}

$rawSecrets = isset($_POST['secrets']) ? json_decode((string)$_POST['secrets'], true) : [];
$rawGolden = isset($_POST['golden']) ? json_decode((string)$_POST['golden'], true) : [];
$grand = isset($_POST['grand']) && $_POST['grand'] === '1';

$secrets = guinomo_seals_clean_ids($rawSecrets);
$golden = guinomo_seals_clean_ids($rawGolden);

guinomo_seals_save($uid, $secrets, $golden, $grand);

echo json_encode([
    'success' => true,
    'secrets' => count($secrets),
    'golden' => count($golden),
    'grand' => $grand,
], JSON_UNESCAPED_UNICODE);