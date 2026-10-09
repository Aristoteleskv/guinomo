<?php
declare(strict_types=1);

// Mock of the Guinomo friends endpoint.
//
// Consumed by src/components/ui.ts: GET api/guinomo/friends
// Expected shape: { success: true, friends: GuinomoFriend[] }.

header('Content-Type: application/json');
header('Cache-Control: no-store');

$friends = [
    [
        'id' => 2,
        'name' => 'Ana',
        'username' => 'ana',
        'avatar' => '/php/avatar.php?uid=2',
        'world' => 'forest',
        'in_guinomo' => true,
        'is_online' => true,
        'room_url' => '/avatar-3d/index.html?uid=2&world=forest',
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
        'world' => 'old-town',
        'in_guinomo' => false,
        'is_online' => false,
        'room_url' => null,
        'profile_url' => '/perfil/joana',
    ],
];

echo json_encode(['success' => true, 'friends' => $friends], JSON_UNESCAPED_UNICODE);
