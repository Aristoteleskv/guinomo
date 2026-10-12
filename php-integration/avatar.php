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
//
// The image response is a flat, deterministic SVG avatar. Its look (hair,
// eyes, mouth, accessory) is picked per uid from a small part taxonomy —
// inspired by the Bitstrips character builder, but drawn here from scratch
// (no third-party art). The look traits are also echoed as additive DNA keys
// (`hair-style`, `hair-hex`, `eye-style`, `mouth-style`, `accessory`,
// `freckles`) so future clients can reuse them; current clients ignore them.
// The avatar also has an idle blink (SVG/SMIL, runs inside <img>); disable it
// with `?motion=off`.

session_start();

$session_uid = isset($_SESSION['hashtag_uid']) ? (int)$_SESSION['hashtag_uid'] : 1;
$requested_uid = isset($_GET['uid']) ? (int)$_GET['uid'] : $session_uid;
if ($requested_uid <= 0) {
    $requested_uid = $session_uid;
}

$format = isset($_GET['format']) ? (string)$_GET['format'] : '';

/** Deterministic index in [0, $count) from uid + salt (stable across reloads). */
function avatar_pick(int $uid, string $salt, int $count): int
{
    if ($count <= 0) {
        return 0;
    }
    // sprintf('%u') keeps crc32 unsigned on every PHP build → same pick anywhere.
    $hash = (int)sprintf('%u', crc32($salt . ':' . $uid));
    return $hash % $count;
}

/** #rgb/#rrggbb lightened (amount > 0) or darkened (amount < 0) by a ratio. */
function avatar_shade(string $hex, float $amount): string
{
    $hex = ltrim(trim($hex), '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) {
        $hex = '888888';
    }
    $channels = [
        hexdec(substr($hex, 0, 2)),
        hexdec(substr($hex, 2, 2)),
        hexdec(substr($hex, 4, 2)),
    ];
    foreach ($channels as $i => $channel) {
        $channels[$i] = $amount >= 0
            ? $channel + (255 - $channel) * $amount
            : $channel * (1 + $amount);
    }
    return sprintf('#%02x%02x%02x', (int)round($channels[0]), (int)round($channels[1]), (int)round($channels[2]));
}

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

    $hairStyles = ['short', 'bob', 'curly', 'long', 'buzz', 'ponytail'];
    $hairColors = ['#2f2118', '#4a2f1b', '#6b4423', '#8a5a2b', '#c9a227', '#1c1c1c', '#8d4b2f', '#4b4f57'];
    $eyeStyles = ['dots', 'round', 'sleepy', 'happy'];
    $mouthStyles = ['smile', 'neutral', 'grin', 'surprised'];

    $hair = $hairColors[avatar_pick($uid, 'hair', count($hairColors))];
    if ($uid % 9 === 0) {
        $hair = '#c9c9c9'; // a few greys
    }

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
        // Additive look traits (Bitstrips-style taxonomy, drawn locally).
        'hair-style' => $hairStyles[avatar_pick($uid, 'hair-style', count($hairStyles))],
        'hair-hex' => $hair,
        'eye-style' => $eyeStyles[avatar_pick($uid, 'eye-style', count($eyeStyles))],
        'mouth-style' => $mouthStyles[avatar_pick($uid, 'mouth-style', count($mouthStyles))],
        'accessory' => $uid % 5 === 0 ? 'glasses' : 'none',
        'freckles' => $uid % 7 === 0,
    ];
}

/** Hair layered over the head (head: cx=48, cy=42). */
function avatar_hair(string $style, string $hair, string $hairDark): string
{
    switch ($style) {
        case 'buzz':
            return '<path d="M28 40c1-13 9-20 20-20s19 7 20 20c-4-7-10-10-20-10s-16 3-20 10z" fill="' . $hair . '"/>';
        case 'bob':
            return '<path d="M26 42c0-15 9-23 22-23s22 8 22 23c-3-8-9-12-22-12s-19 4-22 12z" fill="' . $hair . '"/>'
                . '<path d="M25 42c-2 10-1 18 2 22l7-3c-3-6-3-13-2-19z" fill="' . $hairDark . '"/>'
                . '<path d="M71 42c2 10 1 18-2 22l-7-3c3-6 3-13 2-19z" fill="' . $hairDark . '"/>';
        case 'curly':
            return '<g fill="' . $hair . '">'
                . '<circle cx="32" cy="30" r="9"/><circle cx="48" cy="24" r="10"/><circle cx="64" cy="30" r="9"/>'
                . '<circle cx="27" cy="42" r="7"/><circle cx="69" cy="42" r="7"/></g>';
        case 'long':
            return '<path d="M26 42c0-15 9-23 22-23s22 8 22 23c-3-8-9-12-22-12s-19 4-22 12z" fill="' . $hair . '"/>'
                . '<path d="M24 42c-3 16-2 27 1 33l10 0c-3-9-3-21-2-30z" fill="' . $hair . '"/>'
                . '<path d="M72 42c3 16 2 27-1 33l-10 0c3-9 3-21 2-30z" fill="' . $hair . '"/>';
        case 'ponytail':
            return '<path d="M27 40c0-14 9-22 21-22s21 8 21 22c-3-8-9-11-21-11s-18 3-21 11z" fill="' . $hair . '"/>'
                . '<circle cx="70" cy="30" r="7" fill="' . $hairDark . '"/>'
                . '<path d="M74 34c8 4 10 14 6 24l-8-3c3-8 2-15-3-18z" fill="' . $hair . '"/>';
        case 'short':
        default:
            return '<path d="M27 41c0-15 9-23 21-23s21 8 21 23c-3-9-9-12-21-12s-18 3-21 12z" fill="' . $hair . '"/>';
    }
}

/** Brows (eyeline y≈40). Kept separate from the eyes so only the eyes blink. */
function avatar_brows(string $brow): string
{
    return '<path d="M33 40q5-3 10 0" stroke="' . $brow . '" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
        . '<path d="M53 40q5-3 10 0" stroke="' . $brow . '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
}

/** Eyes only (eyeline y≈46); the caller wraps them for the blink. */
function avatar_eyes(string $style, string $ink): string
{
    switch ($style) {
        case 'round':
            return '<g fill="#ffffff" stroke="' . $ink . '" stroke-width="0.8">'
                . '<ellipse cx="39" cy="46" rx="3.4" ry="3.8"/><ellipse cx="57" cy="46" rx="3.4" ry="3.8"/></g>'
                . '<circle cx="39" cy="46.5" r="1.7" fill="' . $ink . '"/><circle cx="57" cy="46.5" r="1.7" fill="' . $ink . '"/>';
        case 'sleepy':
            return '<path d="M35 47q4 3 8 0" stroke="' . $ink . '" stroke-width="2" fill="none" stroke-linecap="round"/>'
                . '<path d="M53 47q4 3 8 0" stroke="' . $ink . '" stroke-width="2" fill="none" stroke-linecap="round"/>';
        case 'happy':
            return '<path d="M35 48q4-5 8 0" stroke="' . $ink . '" stroke-width="2" fill="none" stroke-linecap="round"/>'
                . '<path d="M53 48q4-5 8 0" stroke="' . $ink . '" stroke-width="2" fill="none" stroke-linecap="round"/>';
        case 'dots':
        default:
            return '<circle cx="39" cy="46" r="2.4" fill="' . $ink . '"/>'
                . '<circle cx="57" cy="46" r="2.4" fill="' . $ink . '"/>';
    }
}

/** Mouth (cx=48, y≈60). */
function avatar_mouth(string $style, string $ink): string
{
    switch ($style) {
        case 'neutral':
            return '<line x1="43" y1="61" x2="53" y2="61" stroke="' . $ink . '" stroke-width="2.2" stroke-linecap="round"/>';
        case 'grin':
            return '<path d="M41 57h14q0 8-7 8t-7-8z" fill="#ffffff" stroke="' . $ink . '" stroke-width="1.6"/>';
        case 'surprised':
            return '<ellipse cx="48" cy="61" rx="3.4" ry="4.4" fill="' . $ink . '"/>';
        case 'smile':
        default:
            return '<path d="M42 59q6 6 12 0" stroke="' . $ink . '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    }
}

/** Flat SVG avatar assembled from the DNA look traits. */
function avatar_svg(array $dna, bool $motion = true): string
{
    $shirt = (string)($dna['shirt-hex'] ?? '#4c80e5');
    $skin = (string)($dna['skin-hex'] ?? '#e5b299');
    $hair = (string)($dna['hair-hex'] ?? '#4a2f1b');

    $bg = avatar_shade($shirt, 0.6);
    $shirtDark = avatar_shade($shirt, -0.2);
    $skinDark = avatar_shade($skin, -0.14);
    $hairDark = avatar_shade($hair, -0.25);
    $ink = '#2b2b2b';
    $mouthInk = '#7a3b3b';

    $hairMarkup = avatar_hair((string)($dna['hair-style'] ?? 'short'), $hair, $hairDark);
    $brows = avatar_brows($hairDark);
    $eyes = avatar_eyes((string)($dna['eye-style'] ?? 'dots'), $ink);
    $mouth = avatar_mouth((string)($dna['mouth-style'] ?? 'smile'), $mouthInk);

    // Idle blink: a quick opacity dip every few seconds. SVG/SMIL animations do
    // run inside an <img>, and it is the same technique the Bitstrips
    // `morphshapes` used. `?motion=off` disables it.
    $blink = $motion
        ? '<animate attributeName="opacity" dur="5.5s" repeatCount="indefinite" values="1;1;0;1;1" keyTimes="0;0.9;0.94;0.98;1"/>'
        : '';

    $freckles = '';
    if (!empty($dna['freckles'])) {
        $freckles = '<g fill="' . $skinDark . '">'
            . '<circle cx="35" cy="57" r="1.3"/><circle cx="40" cy="59" r="1.3"/>'
            . '<circle cx="56" cy="59" r="1.3"/><circle cx="61" cy="57" r="1.3"/></g>';
    }

    $accessory = '';
    if (($dna['accessory'] ?? 'none') === 'glasses') {
        $accessory = '<g fill="none" stroke="' . $ink . '" stroke-width="1.8">'
            . '<circle cx="39" cy="46" r="7.5"/><circle cx="57" cy="46" r="7.5"/>'
            . '<line x1="46.5" y1="46" x2="49.5" y2="46"/>'
            . '<line x1="31.5" y1="45" x2="27" y2="43"/><line x1="64.5" y1="45" x2="69" y2="43"/></g>';
    }

    $hat = '';
    if (!empty($dna['hat-visible'])) {
        $hat = '<path d="M25 35c0-16 11-25 23-25s23 9 23 25z" fill="' . $shirt . '"/>'
            . '<path d="M25 35c0-16 11-25 23-25s23 9 23 25z" fill="' . $shirtDark . '" opacity="0.25"/>'
            . '<rect x="19" y="33" width="58" height="7" rx="3.5" fill="' . $hairDark . '"/>'
            . '<circle cx="48" cy="10" r="3.6" fill="' . $shirtDark . '"/>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Avatar">
  <rect width="96" height="96" rx="18" fill="{$bg}"/>
  <path d="M12 96c0-20 16-31 36-31s36 11 36 31z" fill="{$shirt}"/>
  <path d="M12 96c0-20 16-31 36-31s36 11 36 31z" fill="{$shirtDark}" opacity="0.16"/>
  <rect x="42" y="58" width="12" height="14" rx="5" fill="{$skinDark}"/>
  <circle cx="25" cy="44" r="4.2" fill="{$skin}"/>
  <circle cx="71" cy="44" r="4.2" fill="{$skin}"/>
  <ellipse cx="48" cy="42" rx="21" ry="23" fill="{$skin}"/>
  {$hairMarkup}
  {$freckles}
  {$brows}
  <g>{$eyes}{$blink}</g>
  <path d="M48 47c1.6 2.1 2.5 3.6 2.5 4.8 0 1.5-1.1 2.5-2.5 2.5s-2.5-1-2.5-2.5c0-1.2.9-2.7 2.5-4.8z" fill="{$skinDark}"/>
  {$mouth}
  {$accessory}
  {$hat}
</svg>
SVG;
}

if ($format === 'json') {
    header('Content-Type: application/json');
    echo json_encode(mock_dna($requested_uid, $session_uid), JSON_UNESCAPED_UNICODE);
    exit;
}

// Image response for <img src="avatar.php?uid=...">. `?motion=off` disables the
// idle blink (e.g. for reduced-motion clients or static screenshots).
$motion = true;
if (isset($_GET['motion']) && in_array(strtolower((string)$_GET['motion']), ['0', 'off', 'false', 'none'], true)) {
    $motion = false;
}
header('Content-Type: image/svg+xml');
header('Cache-Control: public, max-age=300');
echo avatar_svg(mock_dna($requested_uid, $session_uid), $motion);
