-- Migration: make `people` per-user (each team member has their own list,
-- their own favourites). SQLite can't change a PRIMARY KEY in place, so we
-- recreate the table.
--
-- Paste each statement into the D1 console one at a time.

-- 1. New table with composite PK on (user_email, name).
CREATE TABLE people_v2 (user_email TEXT NOT NULL, name TEXT NOT NULL, is_favorite INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (user_email, name));

-- 2. Copy existing rows over. Anything that has no user_email (shouldn't happen
--    after 0001 ran, but defensive) lands under Carl's account.
INSERT INTO people_v2 (user_email, name, is_favorite, created_at) SELECT COALESCE(user_email, 'cesprey@gmail.com'), name, is_favorite, created_at FROM people;

-- 3. Replace.
DROP TABLE people;

-- 4. Rename new table into place.
ALTER TABLE people_v2 RENAME TO people;

-- 5. Re-create the per-user index.
CREATE INDEX idx_people_user ON people (user_email);
