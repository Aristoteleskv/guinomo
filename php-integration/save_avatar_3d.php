<?php
declare(strict_types=1);

session_start();

// Chave da sessão identificada no seu sistema
$id_sessao = $_SESSION['hashtag_uid'] ?? null;

header('Content-Type: application/json');

if (!$id_sessao) {
    header('HTTP/1.1 401 Unauthorized');
    echo json_encode(['success' => false, 'error' => 'Usuário não autenticado']);
    exit;
}

$uid_request = filter_input(INPUT_POST, 'uid', FILTER_VALIDATE_INT);

// Segurança: O UID enviado deve ser igual ao UID da sessão
if ($uid_request === null || (int)$id_sessao !== (int)$uid_request) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['success' => false, 'error' => 'Não autorizado a editar este avatar']);
    exit;
}

$autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

if (!class_exists(\App\Core\Database::class)) {
    require_once __DIR__ . '/../src/Core/Database.php';
}

if (!class_exists(\App\Services\AvatarService::class)) {
    require_once __DIR__ . '/../src/Services/AvatarService.php';
}

use App\Services\AvatarService;

$key = filter_input(INPUT_POST, 'key', FILTER_UNSAFE_RAW);
$value = filter_input(INPUT_POST, 'value', FILTER_UNSAFE_RAW);

// Lista de chaves que o 3D tem permissão para alterar.
// Mantenha em sincronia com os eventos emitidos pelo cliente
// (src/scene/characters.ts: hat_visible, name_tag_color).
$allowed_keys = ['hat_visible', 'name_tag_color'];

if (!in_array($key, $allowed_keys, true)) {
    echo json_encode(['success' => false, 'error' => 'Chave de configuração inválida']);
    exit;
}

// Tratamento específico por tipo de dado
if ($key === 'hat_visible') {
    $value = ($value === 'true' || $value === '1');
} elseif ($key === 'name_tag_color') {
    // Mesmo formato aceito pelo cliente (isValidNameTagColor): #rrggbb
    if (!is_string($value) || !preg_match('/^#[0-9a-f]{6}$/i', $value)) {
        echo json_encode(['success' => false, 'error' => 'Cor da etiqueta inválida']);
        exit;
    }
    $value = strtolower($value);
}

$success = AvatarService::updateAvatarMetaKey($uid_request, $key, $value);

echo json_encode(['success' => $success]);
