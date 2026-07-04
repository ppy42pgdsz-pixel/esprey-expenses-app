-- 0015: First-login guided tour (#48a). tour_seen=1 once the user finishes
-- or skips the tour, so it only auto-starts once per person (synced across
-- their devices via the profile; localStorage is just a fast cache).

ALTER TABLE user_profile ADD COLUMN tour_seen INTEGER;
