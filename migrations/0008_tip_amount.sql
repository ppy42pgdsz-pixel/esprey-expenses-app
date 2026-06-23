-- Migration: per-receipt CUSTOM tip amount (for tips that aren't a round %).
--
-- When set, tip_amount is the absolute decimal tip (e.g. "5.00") and
-- tip_pct is 0 (the dropdown shows "Custom amount" in this case).
-- When tip_amount is NULL and tip_pct > 0, the tip is computed from the
-- percentage as before.

ALTER TABLE receipts ADD COLUMN tip_amount TEXT;
