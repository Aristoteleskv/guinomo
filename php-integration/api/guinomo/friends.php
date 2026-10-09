<?php
declare(strict_types=1);

// Guinomo friends endpoint (dev mock).
//
// Consumed by src/components/ui.ts: GET api/guinomo/friends
// Expected shape: { success: true, friends: GuinomoFriend[] }.
//
// The friend list itself is still mocked (it depends on the real Noop follow
// tables), but `in_guinomo`, `world` and `room_url` are now derived from the
// live presence store written by presence.php, so the panel reflects who is
// actually inside the 3D world.

session_start();
require_once __DIR__ . '/../../lib/presence.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$allowedWorlds = ['lobby', 'alien', 'forest', 'floating-city', 'tropical-city', 'old-town'];

/** Builds the deep link the client uses as the "Join" button href. */
function guinomo_room_url(string $world, string $room): string
{
    $params = ['world' => $world];
    if ($room !== '') {
        $params['room'] = $room;
    }
    return '?' . http_build_query($params);
}

$friends = [
    [
        'id' => 2,
        'name' => 'Ana',
        'username' => 'ana',
        'avatar' => '/php/avatar.php?uid=2',
        'world' => 'lobby',
        'in_guinomo' => false,
        'is_online' => true,
        'room_url' => null,
        'profile_url' => '/perfil/ana',
    ],
    [
        'id' => 3,
        'name' => 'Michael',
        'username' => 'michael',
        'avatar' => '/php/avatar.php?uid=3',
        'world' => 'lobby',
        'in_guinomo' => false,
        'is_online' => true,
        'room_url' => null,
        'profile_url' => '/perfil/michael',
    ],
    [
        'id' => 4,
        'name' => 'Joana',
        'username' => 'joana',
        'avatar' => '/php/avatar.php?uid=4',
        'world' => 'lobby',
        'in_guinomo' => false,
        'is_online' => false,
        'room_url' => null,
        'profile_url' => '/perfil/joana',
    ],
];

// Overlay live presence onto the mocked relationships.
$presence = guinomo_presence_active();
foreach ($friends as &$friend) {
    $uid = (int)$friend['id'];
    if (!isset($presence[$uid])) {
        continue;
    }
    $world = (string)($presence[$uid]['world'] ?? 'lobby');
    if (!in_array($world, $allowedWorlds, true)) {
        $world = 'lobby';
    }
    $room = (string)($presence[$uid]['room'] ?? '');
    $friend['in_guinomo'] = true;
    $friend['is_online'] = true;
    $friend['world'] = $world;
    $friend['room_url'] = guinomo_room_url($world, $room);
}
unset($friend);

echo json_encode(['success' => true, 'friends' => $friends], JSON_UNESCAPED_UNICODE);
