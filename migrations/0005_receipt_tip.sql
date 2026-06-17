-- Migration: per-receipt tip percentage so meal / taxi receipts can be saved
-- with a tip applied on top of the bill amount.
--
-- Stored as a small integer (0/5/10/15/20). The receipt's `amount` column
-- continues to hold the FINAL paid total (bill + tip); tip_pct is kept so
-- the editor can decompose the figure on reload and let the user change the
-- tip later.
--
-- One statement — paste into Cloudflare D1 console.

ALTER TABLE receipts ADD COLUMN tip_pct INTEGER NOT NULL DEFAULT 0;
