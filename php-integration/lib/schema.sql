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
