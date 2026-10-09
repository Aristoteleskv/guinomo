<?php
declare(strict_types=1);

// Guinomo presence endpoint (dev mock with a real, file-backed store).
//
// Consumed by src/components/ui.ts: POST api/guinomo/presence with the fields
// csrf_token, world, room, tab_id, active. The client only checks success:true;
// the side effect is that friends.php can now report who is really in Guinomo.
//
// session_start() gives us the identity, mirroring the real app's
// $_SESSION['hashtag_uid'] usage elsewhere in this folder.

session_start();
require_once __DIR__ . '/../../lib/presence.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

$uid = (int)($_SESSION['hashtag_uid'] ?? 0);
if ($uid <= 0) {
    // The mocks fall back to uid 1 elsewhere; stay consistent so local testing
    // works without a full login.
    $uid = 1;
}

$world = isset($_POST['world']) ? (string)$_POST['world'] : 'lobby';
$active = isset($_POST['active']) ? (string)$_POST['active'] : '1';
$tabId = isset($_POST['tab_id']) ? (string)$_POST['tab_id'] : '';
$room = isset($_POST['room']) ? (string)$_POST['room'] : '';

$allowedWorlds = ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];
if (!in_array($world, $allowedWorlds, true)) {
    $world = 'lobby';
}

$isActive = $active === '1' || strtolower($active) === 'true';
guinomo_presence_touch($uid, $world, $room, $tabId, $isActive);

echo json_encode([
    'success' => true,
    'world' => $world,
    'active' => $isActive,
    'tab_id' => $tabId,
], JSON_UNESCAPED_UNICODE);
