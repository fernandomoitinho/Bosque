'use strict';

/**
 * SQLite store for Bosque Reservas.
 * Schema is created idempotently on first import. One file DB under data/.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bosque.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    segment           TEXT NOT NULL,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    party_size        INTEGER,
    requested_date    TEXT NOT NULL,
    slot_key          TEXT NOT NULL,
    package_id        TEXT,
    message           TEXT,
    status            TEXT NOT NULL DEFAULT 'new',
    calendar_event_id TEXT,
    utm_source        TEXT,
    utm_medium        TEXT,
    utm_campaign      TEXT
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    status         TEXT NOT NULL DEFAULT 'draft',
    currency       TEXT NOT NULL DEFAULT 'EUR',
    subtotal       REAL NOT NULL DEFAULT 0,
    discount_type  TEXT NOT NULL DEFAULT 'none',
    discount_value REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL DEFAULT 0,
    valid_until    TEXT,
    public_token   TEXT UNIQUE,
    notes          TEXT,
    sent_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    qty        REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    sort       INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status);
  CREATE INDEX IF NOT EXISTS idx_res_date   ON reservations(requested_date);
  CREATE INDEX IF NOT EXISTS idx_quote_res  ON quotes(reservation_id);
  CREATE INDEX IF NOT EXISTS idx_quote_tok  ON quotes(public_token);
  CREATE INDEX IF NOT EXISTS idx_items_quote ON quote_items(quote_id);
`);

module.exports = db;
