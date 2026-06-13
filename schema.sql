-- esprey-expenses D1 schema (single user)

CREATE TABLE IF NOT EXISTS receipts (
  id              TEXT PRIMARY KEY,
  r2_key          TEXT NOT NULL,
  thumb_r2_key    TEXT,
  source          TEXT NOT NULL,           -- 'camera' | 'email'
  source_meta     TEXT,                    -- raw email headers, sender, etc.
  vendor          TEXT,
  amount          TEXT,                    -- decimal stored as string
  currency        TEXT,
  receipt_date    TEXT,                    -- ISO 8601 yyyy-mm-dd
  company         TEXT,
  notes           TEXT,
  attendees       TEXT,                    -- JSON array of names present at expense
  category        TEXT,                    -- e.g. Meals, Hotels, Stationary
  ocr_raw         TEXT,                    -- raw JSON returned by Claude
  ocr_status      TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed|manual
  uploaded_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_uploaded ON receipts (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_company  ON receipts (company);
CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts (receipt_date);

CREATE TABLE IF NOT EXISTS companies (
  name        TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  name         TEXT PRIMARY KEY,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  name        TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token       TEXT PRIMARY KEY,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  expires_at  INTEGER NOT NULL
);
