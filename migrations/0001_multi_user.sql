-- Migration: add multi-user support.
-- Paste into Cloudflare D1 console one statement at a time (the console
-- rejects multi-statement input). Order matters.

-- 1. team_members table. One row per person allowed into the app.
CREATE TABLE IF NOT EXISTS team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT, role TEXT NOT NULL DEFAULT 'member', is_admin INTEGER NOT NULL DEFAULT 0, added_at INTEGER NOT NULL, added_by TEXT);

-- 2. Seed Carl as the first admin (replace email if different from CARL_EMAIL).
INSERT OR IGNORE INTO team_members (email, display_name, role, is_admin, added_at, added_by) VALUES ('cesprey@gmail.com', 'Carl Esprey', 'admin', 1, strftime('%s','now') * 1000, 'system');

-- 3. user_email columns on every per-user table. Nullable so the migration is
--    safe; the app code will always set them going forward.
ALTER TABLE receipts ADD COLUMN user_email TEXT;
ALTER TABLE companies ADD COLUMN user_email TEXT;
ALTER TABLE people ADD COLUMN user_email TEXT;
ALTER TABLE categories ADD COLUMN user_email TEXT;
ALTER TABLE user_profile ADD COLUMN user_email TEXT;

-- 4. Backfill existing rows to Carl (he's the only user so far).
UPDATE receipts      SET user_email = 'cesprey@gmail.com' WHERE user_email IS NULL;
UPDATE companies     SET user_email = 'cesprey@gmail.com' WHERE user_email IS NULL;
UPDATE people        SET user_email = 'cesprey@gmail.com' WHERE user_email IS NULL;
UPDATE categories    SET user_email = 'cesprey@gmail.com' WHERE user_email IS NULL;
UPDATE user_profile  SET user_email = 'cesprey@gmail.com' WHERE user_email IS NULL;

-- 5. Indexes for the scoped lookups.
CREATE INDEX IF NOT EXISTS idx_receipts_user        ON receipts (user_email);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date   ON receipts (user_email, receipt_date);
CREATE INDEX IF NOT EXISTS idx_companies_user       ON companies (user_email);
CREATE INDEX IF NOT EXISTS idx_people_user          ON people (user_email);
CREATE INDEX IF NOT EXISTS idx_categories_user      ON categories (user_email);
CREATE INDEX IF NOT EXISTS idx_user_profile_user    ON user_profile (user_email);
