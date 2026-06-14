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
  name             TEXT PRIMARY KEY,   -- short name (used in receipts + dropdowns)
  full_name        TEXT,                -- full legal/billing name (for invoices)
  address_line1    TEXT,
  address_line2    TEXT,
  address_country  TEXT,
  vat_number       TEXT,
  created_at       INTEGER NOT NULL
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

CREATE TABLE IF NOT EXISTS currencies (
  code        TEXT PRIMARY KEY,     -- ISO 4217 e.g. USD, EUR, XOF
  name        TEXT NOT NULL,        -- human-readable, e.g. 'US Dollar'
  created_at  INTEGER NOT NULL
);

-- Personal profile of the invoicing user. Single row for now (id=1);
-- becomes one-row-per-user when we expand to multi-user.
CREATE TABLE IF NOT EXISTS user_profile (
  id              INTEGER PRIMARY KEY,
  name            TEXT,
  business_name   TEXT,
  email           TEXT,
  phone           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  address_country TEXT,
  vat_number      TEXT,
  bank_name       TEXT,
  bank_iban       TEXT,
  bank_swift      TEXT,
  updated_at      INTEGER NOT NULL
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
