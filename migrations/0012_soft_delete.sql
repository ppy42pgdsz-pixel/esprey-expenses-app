-- 0012: Soft delete. DELETE now stamps deleted_at (ms epoch) instead of
-- removing the row + R2 objects. Deleted receipts are hidden everywhere,
-- restorable from Trash for 30 days, then purged (row + R2) lazily.

ALTER TABLE receipts ADD COLUMN deleted_at INTEGER;
