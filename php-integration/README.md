# PHP integration mocks

Minimal, dependency-free mocks of the Noop social-network endpoints that the
Guinomo client talks to. They exist so the 3D build can be developed and tested
without the full PHP/MySQL application. **None of these are production code.**

| Mock file | Client call | Response shape |
|---|---|---|
| `avatar.php` | `php/avatar.php?format=json`, `php/avatar.php?uid=N&format=json` | DNA object (`shirt-hex`, `skin-hex`, `username`, `name-tag-color`, `hat-visible`, `physique`, `age_group`, `is_owner`, `gender_category`) |
| `avatar.php` | `php/avatar.php?uid=N` (as `<img src>`) | SVG avatar image |
| `save_avatar_3d.php` | `POST php/save_avatar_3d.php` (`uid`, `key`, `value`, `csrf_token`) | `{ "success": bool }` |
| `notificacoes_action.php` | `php/notificacoes_action.php?action=recent&limit=5` | `{ "success": bool, "itens": [...] }` |
| `api/guinomo/friends.php` | `GET api/guinomo/friends` | `{ "success": true, "friends": [...] }` |
| `api/guinomo/presence.php` | `POST api/guinomo/presence` | `{ "success": true, ... }` |

## Path mapping

The client resolves endpoints relative to `window.APP_URL_PATH` (the social
network root) and prepends `php/` or `api/guinomo/`. In this folder that
prefix is represented by the file layout itself, so host these mocks with
`php-integration/` as the request root and point `APP_URL_PATH` at it, or copy
the files into the real app's `php/` and `api/guinomo/` directories.

`save_avatar_3d.php` is intentionally left at the folder root: the real
`AvatarService`/`Database` classes it references live in the parent
application. To run the mock standalone, replace the `AvatarService` call with
a stub (see the guard that requires `../src/Services/AvatarService.php`).

## Session / auth

`avatar.php` uses `$_SESSION['hashtag_uid']` like the real app, falling back to
`1` so the mocks are usable out of the box. `save_avatar_3d.php` still returns
`401` without a session, matching production behavior.
