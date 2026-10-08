<?php
declare(strict_types=1);

// Mock of the Guinomo presence endpoint.
//
// Consumed by src/components/ui.ts: POST api/guinomo/presence with the fields
// csrf_token, world, room, tab_id, active. The client only checks success: true.
// This mock stores nothing; it just validates the shape.

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

$world = isset($_POST['world']) ? (string)$_POST['world'] : 'lobby';
$active = isset($_POST['active']) ? (string)$_POST['active'] : '1';
$tabId = isset($_POST['tab_id']) ? (string)$_POST['tab_id'] : '';

$allowedWorlds = ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];
if (!in_array($world, $allowedWorlds, true)) {
    $world = 'lobby';
}

echo json_encode([
    'success' => true,
    'world' => $world,
    'active' => $active === '1' || $active === 'true',
    'tab_id' => $tabId,
], JSON_UNESCAPED_UNICODE);
