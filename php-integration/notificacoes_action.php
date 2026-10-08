<?php
declare(strict_types=1);

// Mock of the social network's notification endpoint.
//
// The Guinomo UI polls:
//   notificacoes_action.php?action=recent&limit=5
// and expects `{ "itens": [ { id, titulo, texto, link, avatar, tempo } ] }`.

header('Content-Type: application/json');

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'recent';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
$limit = max(0, min(20, $limit));

if ($action !== 'recent') {
    echo json_encode(['success' => true, 'itens' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

$itens = [];
for ($i = 1; $i <= $limit; $i++) {
    $itens[] = [
        'id' => $i,
        'titulo' => 'Nova atividade',
        'texto' => 'Alguém entrou no Guinomo.',
        'link' => '/index.php?open=chat',
        'avatar' => '/php/avatar.php?uid=' . $i,
        'tempo' => $i . ' min',
    ];
}

echo json_encode(['success' => true, 'itens' => $itens], JSON_UNESCAPED_UNICODE);
