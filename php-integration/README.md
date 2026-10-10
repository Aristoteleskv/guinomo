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
| `api/guinomo/seals.php` | `GET api/guinomo/seals?uid=N`, `POST api/guinomo/seals` (`uid`, `secrets`, `golden`, `grand`, `csrf_token`) | `{ "success": bool, "seals": {...} \| null }` |

## Explorer trophies (seals)

`api/guinomo/seals.php` persists each player's seal collection (the 5 found
secrets, the golden-hour subset, and the 5/5 Grand Secret flag). The engine
pushes it after every change (`src/core/sealsSync.ts`) and any profile page can
read it back publicly with `GET api/guinomo/seals?uid=N` to render the badge
trophies to other players. The store lives in `lib/seals.php` — file-backed
(`.seals.json`) by default, PDO (`guinomo_seals` table in `schema.sql`) when
`GUINOMO_DB_DSN` is set.

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

## Presence is persisted (mocks, but stateful)

`presence.php` is no longer a no-op: it writes to the file-backed store in
`lib/presence.php` (`.presence.json`, gitignored, 45s TTL, refreshed by the
client's 20s heartbeat). `friends.php` reads that store and overlays
`in_guinomo`, `world` and `room_url` onto its mocked relationship list, so the
friends panel in the 3D client reflects who is really inside a world. The TTL
is deliberately short: a tab that stops heartbeating (closed/crashed) drops out
on its own. Swap `guinomo_presence_read/write` for the production database to
go live.

### Storage drivers (file → database)

Both stores pick their driver automatically from the environment, so the mocks
stay zero-config by default and become production-ready without code changes:

| Env | Effect |
|---|---|
| `GUINOMO_DB_DSN` (+ `GUINOMO_DB_USER` / `GUINOMO_DB_PASS`) | Use PDO. Examples: `mysql:host=127.0.0.1;dbname=guinomo;charset=utf8mb4`, `sqlite:/var/lib/guinomo/app.sqlite`. Tables are created on connect. |
| unset | JSON file fallback (`GUINOMO_PRESENCE_FILE`, `GUINOMO_HMAC_NONCE_FILE`). |

`lib/schema.sql` provisions `guinomo_presence` and `guinomo_hmac_nonces` ahead
of time (`mysql -u user -p guinomo < lib/schema.sql`). `lib/db.php` is the
shared factory and migration. When `GUINOMO_DB_DSN` is set the nonce guard
moves into the database too — required for running behind multiple PHP workers.

## HMAC (optional, additive)

`lib/hmac.php` implements the contract in `docs/HMAC_AUTH.md`
(canonical string + `hash_equals` verify + nonce replay guard, file or PDO).
The browser signer lives in `src/core/hmac.ts` and is **inert unless**
`window.GUINOMO_HMAC_KEY` is set to a short-lived key — never bundle a secret.
To test end-to-end locally:

1. Set `GUINOMO_HMAC_SECRET=dev-secret` in the PHP environment (the endpoint
   verifies only when this is non-empty).
2. Inject `window.GUINOMO_HMAC_KEY = 'dev-secret'` before the app bundle runs
   (and `window.GUINOMO_HMAC_PATH` if the request path differs from the
   document root).

The golden vector lives in `tests/fixtures/hmac-vector.json` and is asserted on
**both sides**: `tests/hmac.test.ts` (browser signer) and `tests/php/run.php`
(PHP verifier), so the two implementations cannot drift.

Rejected requests are logged to `.hmac-failures.log` (gitignored) as
`time uid method path reason ip` and mirrored to the PHP error log; the
signature is never written.

## Tests

`php tests/php/run.php` (or `bun run test:php`) runs the store/HMAC suite
against both the file driver and a throwaway SQLite database. It is wired into
CI (`.github/workflows/ci.yml`, `platform` job).

