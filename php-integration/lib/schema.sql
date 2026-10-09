-- Guinomo store schema (presence + HMAC nonce replay guard).
--
-- Compatibility: written in portable SQL that runs on MySQL/MariaDB and SQLite.
-- The mocks create these tables automatically on connect (see lib/db.php); use
-- this file to provision the real database ahead of time.
--
--   mysql -u user -p guinomo < lib/schema.sql

CREATE TABLE IF NOT EXISTS guinomo_presence (
    uid   INTEGER      NOT NULL,
    tab   VARCHAR(64)  NOT NULL,
    world VARCHAR(32)  NOT NULL,
    room  VARCHAR(64)  NOT NULL DEFAULT '',
    ts    INTEGER      NOT NULL,
    PRIMARY KEY (uid, tab)
);

CREATE INDEX IF NOT EXISTS idx_guinomo_presence_ts ON guinomo_presence (ts);

CREATE TABLE IF NOT EXISTS guinomo_hmac_nonces (
    nonce VARCHAR(128) NOT NULL,
    ts    INTEGER      NOT NULL,
    PRIMARY KEY (nonce)
);

CREATE INDEX IF NOT EXISTS idx_guinomo_hmac_nonces_ts ON guinomo_hmac_nonces (ts);

-- World notes: terrain-anchored messages, one set per world (api/guinomo/notes.php).
CREATE TABLE IF NOT EXISTS guinomo_notes (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    uid        INT          NOT NULL DEFAULT 0,
    world      VARCHAR(32)  NOT NULL,
    x          DOUBLE       NOT NULL,
    y          DOUBLE       NOT NULL,
    z          DOUBLE       NOT NULL,
    text       VARCHAR(200) NOT NULL,
    created_at BIGINT       NOT NULL,
    INDEX idx_guinomo_notes_world (world, created_at)
);
