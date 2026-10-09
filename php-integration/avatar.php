<?php
declare(strict_types=1);

// Mock of the social network's avatar endpoint.
//
// The 3D client calls this in two ways:
//   - `avatar.php?format=json`            -> current session user's DNA
//   - `avatar.php?uid=<id>&format=json`   -> another user's DNA
//   - `avatar.php?uid=<id>`               -> profile image (used in name tags)
//
// DNA keys consumed by src/scene/characters.ts:
//   shirt-hex, skin-hex, username, name-tag-color, hat-visible,
//   physique, age_group, is_owner, gender_category.

session_start();

$session_uid = isset($_SESSION['hashtag_uid']) ? (int)$_SESSION['hashtag_uid'] : 1;
$requested_uid = isset($_GET['uid']) ? (int)$_GET['uid'] : $session_uid;
if ($requested_uid <= 0) {
    $requested_uid = $session_uid;
}

$format = isset($_GET['format']) ? (string)$_GET['format'] : '';

/** Deterministic mock palette per user id, so reloads stay stable. */
function mock_dna(int $uid, int $session_uid): array
{
    $palettes = [
        ['#4c80e5', '#e5b299'],
        ['#e5534c', '#f0c9a0'],
        ['#43a047', '#d8b694'],
        ['#8e44ad', '#ffe0b0'],
        ['#f39c12', '#c9d5d0'],
    ];
    [$shirt, $skin] = $palettes[$uid % count($palettes)];

    return [
        'uid' => $uid,
        'username' => 'Guinomo User ' . $uid,
        'shirt-hex' => $shirt,
        'skin-hex' => $skin,
        'name-tag-color' => $skin,
        'hat-visible' => $uid % 2 === 0,
        'physique' => 'default',
        'age_group' => 'adult',
        'is_owner' => $uid === $session_uid,
        'gender_category' => 'nao_informado',
    ];
}

if ($format === 'json') {
    header('Content-Type: application/json');
    echo json_encode(mock_dna($requested_uid, $session_uid), JSON_UNESCAPED_UNICODE);
    exit;
}

// Image response for <img src="avatar.php?uid=...">.
header('Content-Type: image/svg+xml');
header('Cache-Control: public, max-age=300');
$dna = mock_dna($requested_uid, $session_uid);
$skin = htmlspecialchars((string)$dna['skin-hex'], ENT_QUOTES);
$shirt = htmlspecialchars((string)$dna['shirt-hex'], ENT_QUOTES);
?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Avatar">
  <rect width="96" height="96" rx="18" fill="<?= $shirt ?>"/>
  <circle cx="48" cy="38" r="18" fill="<?= $skin ?>"/>
  <path d="M18 96c0-17 13-28 30-28s30 11 30 28z" fill="<?= $skin ?>"/>
</svg>
